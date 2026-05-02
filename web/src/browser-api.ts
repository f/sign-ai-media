import { createC2pa, type C2paSdk } from "@contentauth/c2pa-web/inline";

import {
  createAiGeneratedManifest,
  DIGITAL_SOURCE_TYPE_PRESETS,
  inferMimeType,
  type AiMediaMetadata,
  type ManifestDefinition,
} from "./manifest";
import { getCertificateChainPem, signCose } from "./signer";

export {
  createAiGeneratedManifest,
  DIGITAL_SOURCE_TYPE_PRESETS,
  inferMimeType,
  type AiMediaMetadata,
  type ManifestDefinition,
};

let sdk: C2paSdk | null = null;

async function getSDK(): Promise<C2paSdk> {
  if (sdk) {
    return sdk;
  }

  sdk = await createC2pa({
    settings: {
      verify: { verifyTrust: false },
    },
  });
  return sdk;
}

export interface BrowserSignOptions {
  metadata: AiMediaMetadata;
  filename?: string;
  mimeType?: string;
  reserveSize?: number;
}

export interface BrowserSignResult {
  blob: Blob;
  manifest: ManifestDefinition;
  filename: string;
}

export async function signAiGeneratedMedia(
  file: Blob | File,
  options: BrowserSignOptions,
): Promise<BrowserSignResult> {
  const c2pa = await getSDK();
  const filename = options.filename ?? getBlobName(file) ?? "media";
  const mimeType =
    options.mimeType ?? file.type ?? inferMimeType(filename) ?? "image/png";
  const manifest = createAiGeneratedManifest({
    filename,
    mimeType,
    metadata: options.metadata,
  });
  const builder = await c2pa.builder.fromDefinition(
    manifest as unknown as Parameters<typeof c2pa.builder.fromDefinition>[0],
  );
  const reserveSize = options.reserveSize ?? 20000;
  const signer = {
    sign: (data: Uint8Array<ArrayBuffer>, size: number) =>
      signCose(data, size || reserveSize),
    reserveSize: async () => reserveSize,
    alg: "es256" as const,
    certs: getCertificateChainPem(),
  };

  try {
    const signedBytes = await builder.sign(
      signer as Parameters<typeof builder.sign>[0],
      mimeType,
      file,
    );

    return {
      blob: new Blob([signedBytes], { type: mimeType }),
      manifest,
      filename: `signed-${filename}`,
    };
  } finally {
    await builder.free();
  }
}

export interface BrowserViewResult {
  hasManifest: boolean;
  manifestStore: unknown | null;
  activeManifest: unknown | null;
}

export async function viewAiGeneratedMedia(
  file: Blob | File,
): Promise<BrowserViewResult> {
  const c2pa = await getSDK();
  const reader = await c2pa.reader.fromBlob(file.type, file);

  if (!reader) {
    return { hasManifest: false, manifestStore: null, activeManifest: null };
  }

  try {
    const manifestStore = await reader.manifestStore();
    const store = manifestStore as {
      active_manifest?: string;
      manifests?: Record<string, unknown>;
    } | null;
    const activeManifest =
      store?.active_manifest && store.manifests
        ? store.manifests[store.active_manifest] ?? null
        : null;

    return {
      hasManifest: Boolean(activeManifest),
      manifestStore,
      activeManifest,
    };
  } finally {
    await reader.free();
  }
}

function getBlobName(file: Blob | File): string | null {
  return "name" in file && typeof file.name === "string" ? file.name : null;
}
