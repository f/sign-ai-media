import { getCertificateChainDer } from "./signer";

/**
 * Builds a COSE_Sign1 structure (RFC 9052) for C2PA signing.
 *
 * COSE_Sign1 = [
 *   protected   : bstr,   // CBOR map { 1: -7 } (alg = ES256)
 *   unprotected : map,    // { 33: [cert1, cert2, ...] } (x5chain)
 *   payload     : nil,    // detached
 *   signature   : bstr    // raw ECDSA signature
 * ]
 */
export function buildCoseSign1(
  protectedHeaders: Uint8Array,
  rawSignature: Uint8Array,
  targetSize?: number,
): Uint8Array {
  if (!targetSize) {
    return buildTaggedCoseSign1(protectedHeaders, rawSignature, 0);
  }

  for (let padLength = 0; padLength < targetSize; padLength++) {
    const cose = buildTaggedCoseSign1(protectedHeaders, rawSignature, padLength);
    if (cose.length === targetSize) {
      return cose;
    }
    if (cose.length > targetSize) {
      break;
    }
  }

  throw new Error(`Could not pad COSE_Sign1 to ${targetSize} bytes`);
}

function buildTaggedCoseSign1(
  protectedHeaders: Uint8Array,
  rawSignature: Uint8Array,
  padLength: number,
): Uint8Array {
  const unprotectedEntries: [Uint8Array, Uint8Array][] = [];

  if (padLength > 0) {
    unprotectedEntries.push([
      cborTstr("pad"),
      cborBstr(new Uint8Array(padLength)),
    ]);
  }

  return cborTag(
    18,
    cborArray([
      cborBstr(protectedHeaders),
      cborMap(unprotectedEntries),
      cborNull(),
      cborBstr(rawSignature),
    ]),
  );
}

export function buildProtectedHeaders(): Uint8Array {
  const certs = getCertificateChainDer();

  // { 1: -7, 33: [cert1, cert2, ...] }
  // 1  -> alg, -7 -> ES256
  // 33 -> x5chain, which c2pa-rs expects in the protected header.
  return cborSerialize(
    cborMap([
      [cborUint(1), cborNegInt(6)],
      [cborUint(33), cborArray(certs.map(cborBstr))],
    ]),
  );
}

export function buildSigStructure(
  protectedHeaders: Uint8Array,
  payload: Uint8Array,
): Uint8Array {
  // Sig_structure = ["Signature1", protected, external_aad, payload]
  return cborSerialize(
    cborArray([
      cborTstr("Signature1"),
      cborBstr(protectedHeaders),
      cborBstr(new Uint8Array(0)), // external_aad
      cborBstr(payload),
    ]),
  );
}

// --- Minimal CBOR encoder (deterministic, no library needed) ---

type CborValue = Uint8Array;

function cborSerialize(value: CborValue): Uint8Array {
  return value;
}

function cborUint(n: number): CborValue {
  return encodeMajor(0, n);
}

function cborNegInt(n: number): CborValue {
  // CBOR negative: -1 - n, so -7 → major 1, value 6
  return encodeMajor(1, n);
}

function cborBstr(bytes: Uint8Array): CborValue {
  const head = encodeMajor(2, bytes.length);
  return concat(head, bytes);
}

function cborTstr(str: string): CborValue {
  const encoded = new TextEncoder().encode(str);
  const head = encodeMajor(3, encoded.length);
  return concat(head, encoded);
}

function cborTag(tag: number, value: CborValue): CborValue {
  return concat(encodeMajor(6, tag), value);
}

function cborArray(items: CborValue[]): CborValue {
  const head = encodeMajor(4, items.length);
  return concatAll([head, ...items]);
}

function cborMap(entries: [CborValue, CborValue][]): CborValue {
  const head = encodeMajor(5, entries.length);
  const parts: CborValue[] = [head];
  for (const [k, v] of entries) {
    parts.push(k, v);
  }
  return concatAll(parts);
}

function cborNull(): CborValue {
  return new Uint8Array([0xf6]);
}

function encodeMajor(major: number, value: number): Uint8Array {
  const mt = major << 5;
  if (value < 24) {
    return new Uint8Array([mt | value]);
  } else if (value < 0x100) {
    return new Uint8Array([mt | 24, value]);
  } else if (value < 0x10000) {
    return new Uint8Array([mt | 25, (value >> 8) & 0xff, value & 0xff]);
  } else if (value < 0x100000000) {
    return new Uint8Array([
      mt | 26,
      (value >> 24) & 0xff,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
  }
  throw new Error(`CBOR value too large: ${value}`);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function concatAll(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}
