const DEV_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIChzCCAi6gAwIBAgIUcCTmJHYF8dZfG0d1UdT6/LXtkeYwCgYIKoZIzj0EAwIw
gYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJU29tZXdoZXJl
MScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3QgQ0ExGTAXBgNV
BAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVkaWF0ZSBDQTAe
Fw0yMjA2MTAxODQ2NDBaFw0zMDA4MjYxODQ2NDBaMIGAMQswCQYDVQQGEwJVUzEL
MAkGA1UECAwCQ0ExEjAQBgNVBAcMCVNvbWV3aGVyZTEfMB0GA1UECgwWQzJQQSBU
ZXN0IFNpZ25pbmcgQ2VydDEZMBcGA1UECwwQRk9SIFRFU1RJTkdfT05MWTEUMBIG
A1UEAwwLQzJQQSBTaWduZXIwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQPaL6R
kAkYkKU4+IryBSYxJM3h77sFiMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWky
l3QGuV/wt0MrAPDoo3gwdjAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB/wQMMAoGCCsG
AQUFBwMEMA4GA1UdDwEB/wQEAwIGwDAdBgNVHQ4EFgQUFznP0y83joiNOCedQkxT
tAMyNcowHwYDVR0jBBgwFoAUDnyNcma/osnlAJTvtW6A4rYOL2swCgYIKoZIzj0E
AwIDRwAwRAIgOY/2szXjslg/MyJFZ2y7OH8giPYTsvS7UPRP9GI9NgICIDQPMKrE
LQUJEtipZ0TqvI/4mieoyRCeIiQtyuS0LACz
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICajCCAg+gAwIBAgIUfXDXHH+6GtA2QEBX2IvJ2YnGMnUwCgYIKoZIzj0EAwIw
dzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlTb21ld2hlcmUx
GjAYBgNVBAoMEUMyUEEgVGVzdCBSb290IENBMRkwFwYDVQQLDBBGT1IgVEVTVElO
R19PTkxZMRAwDgYDVQQDDAdSb290IENBMB4XDTIyMDYxMDE4NDY0MFoXDTMwMDgy
NzE4NDY0MFowgYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJ
U29tZXdoZXJlMScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3Qg
Q0ExGTAXBgNVBAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVk
aWF0ZSBDQTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHllI4O7a0EkpTYAWfPM
D6Rnfk9iqhEmCQKMOR6J47Rvh2GGjUw4CS+aLT89ySukPTnzGsMQ4jK9d3V4Aq4Q
LsOjYzBhMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQW
BBQOfI1yZr+iyeUAlO+1boDitg4vazAfBgNVHSMEGDAWgBRembiG4Xgb2VcVWnUA
UrYpDsuojDAKBggqhkjOPQQDAgNJADBGAiEAtdZ3+05CzFo90fWeZ4woeJcNQC4B
84Ill3YeZVvR8ZECIQDVRdha1xEDKuNTAManY0zthSosfXcvLnZui1A/y/DYeg==
-----END CERTIFICATE-----`;

const DEV_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgfNJBsaRLSeHizv0m
GL+gcn78QmtfLSm+n+qG9veC2W2hRANCAAQPaL6RkAkYkKU4+IryBSYxJM3h77sF
iMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWkyl3QGuV/wt0MrAPDo
-----END PRIVATE KEY-----`;

function pemToArrayBuffer(pem: string, label: string): ArrayBuffer {
  const lines = pem.split("\n");
  const b64 = lines
    .filter((l) => !l.startsWith(`-----BEGIN ${label}`) && !l.startsWith(`-----END ${label}`))
    .join("");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function pemsToDer(pem: string): Uint8Array[] {
  const certs: Uint8Array[] = [];
  const blocks = pem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );
  if (!blocks) return certs;
  for (const block of blocks) {
    certs.push(new Uint8Array(pemToArrayBuffer(block, "CERTIFICATE")));
  }
  return certs;
}

let cachedKey: CryptoKey | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const der = pemToArrayBuffer(DEV_KEY_PEM, "PRIVATE KEY");
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

export function getCertificateChainDer(): Uint8Array[] {
  return pemsToDer(DEV_CERT_PEM);
}

export function getCertificateChainPem(): string {
  return DEV_CERT_PEM;
}

export interface BrowserSigner {
  type: "local";
  certificate: Uint8Array;
  privateKey: CryptoKey;
  algorithm: "es256";
  tsaUrl?: string;
}

export async function createDevSigner(): Promise<BrowserSigner> {
  const key = await getPrivateKey();
  const certs = getCertificateChainDer();
  const combined = concatUint8Arrays(certs);
  return {
    type: "local",
    certificate: combined,
    privateKey: key,
    algorithm: "es256",
  };
}

export async function signRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const key = await getPrivateKey();
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    data.buffer as ArrayBuffer,
  );
  return new Uint8Array(sig) as Uint8Array<ArrayBuffer>;
}

export async function signCose(
  dataToBeSigned: Uint8Array<ArrayBuffer>,
  reserveSize: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const { buildProtectedHeaders, buildSigStructure, buildCoseSign1 } = await import("./cose");
  const protectedHeaders = buildProtectedHeaders();
  const sigStructure = buildSigStructure(protectedHeaders, dataToBeSigned);

  const key = await getPrivateKey();
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sigStructure.buffer as ArrayBuffer,
    ),
  );
  const rawSig = normalizeEcdsaSignature(signature);

  console.log("[sign-ai-media] raw ECDSA signature size:", rawSig.length);

  return buildCoseSign1(
    protectedHeaders,
    rawSig,
    reserveSize,
  ) as Uint8Array<ArrayBuffer>;
}

function normalizeEcdsaSignature(signature: Uint8Array): Uint8Array {
  if (signature.length === 64) {
    return signature;
  }

  // Some WebCrypto implementations return ASN.1 DER ECDSA signatures.
  // COSE ES256 requires IEEE P1363: r || s, 32 bytes each.
  if (signature[0] !== 0x30) {
    throw new Error(`Unsupported ECDSA signature format (${signature.length} bytes)`);
  }

  let offset = 2;
  if (signature[1] & 0x80) {
    offset = 2 + (signature[1] & 0x7f);
  }

  const r = readDerInteger(signature, offset);
  const s = readDerInteger(signature, r.nextOffset);

  return concatFixed(r.value, s.value, 32);
}

function readDerInteger(
  bytes: Uint8Array,
  offset: number,
): { value: Uint8Array; nextOffset: number } {
  if (bytes[offset] !== 0x02) {
    throw new Error("Invalid DER ECDSA signature");
  }
  const length = bytes[offset + 1];
  const start = offset + 2;
  const end = start + length;
  return { value: bytes.slice(start, end), nextOffset: end };
}

function concatFixed(r: Uint8Array, s: Uint8Array, width: number): Uint8Array {
  const out = new Uint8Array(width * 2);
  out.set(trimOrPad(r, width), 0);
  out.set(trimOrPad(s, width), width);
  return out;
}

function trimOrPad(value: Uint8Array, width: number): Uint8Array {
  const trimmed =
    value.length > width ? value.slice(value.length - width) : value;
  const out = new Uint8Array(width);
  out.set(trimmed, width - trimmed.length);
  return out;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}
