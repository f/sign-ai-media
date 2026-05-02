import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import {
  Builder,
  LocalSigner as ContentAuthLocalSigner,
  Reader,
  type FileAsset,
  type SigningAlg,
} from "@contentauth/c2pa-node";

const DEFAULT_DIGITAL_SOURCE_TYPE =
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";

const DEVELOPMENT_CERTIFICATE_URL = new URL(
  "../assets/certs/development-cert.pem",
  import.meta.url,
);
const DEVELOPMENT_PRIVATE_KEY_URL = new URL(
  "../assets/certs/development-key.pem",
  import.meta.url,
);

const MIME_BY_EXTENSION = new Map<string, string>([
  [".avif", "image/avif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
  [".avi", "video/msvideo"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
]);

export interface AiGeneratedMetadata {
  /**
   * Name of the model, service, app, or pipeline that created the media.
   * Stored in the C2PA action's softwareAgent object.
   */
  softwareAgent: string;
  /**
   * Version of the software agent, model, service, or pipeline.
   */
  version?: string;
  /**
   * User-agent style claim generator string. If omitted, it is derived from
   * softwareAgent/version.
   */
  claimGenerator?: string;
  /**
   * Friendly generator name stored in schema.org CreativeWork metadata.
   */
  generator?: string;
  /**
   * IPTC digital source type. Defaults to trainedAlgorithmicMedia.
   */
  digitalSourceType?: string;
  /**
   * Creation timestamp. Defaults to the current time.
   */
  createdAt?: string | Date;
  /**
   * Human-readable title for the signed asset. Defaults to the input filename.
   */
  title?: string;
  /**
   * Optional organization or service name for CreativeWork metadata.
   */
  producer?: string;
  /**
   * Optional model name for consumers that display richer generator details.
   */
  model?: string;
  /**
   * Optional prompt. Be careful: embedded C2PA metadata can be read by others.
   */
  prompt?: string;
  /**
   * Extra assertion objects to merge into the schema.org CreativeWork assertion.
   */
  creativeWork?: Record<string, unknown>;
}

export interface LocalSignerOptions {
  certificatePath: string;
  privateKeyPath: string;
  algorithm?: SigningAlgorithm;
  tsaUrl?: string;
}

export interface SignAiGeneratedImageOptions {
  input: string;
  output: string;
  metadata: AiGeneratedMetadata;
  signer?: Signer;
  mimeType?: string;
  vendor?: string;
  embed?: boolean;
  remoteManifestUrl?: string | null;
}

export interface SignAiGeneratedImageResult {
  output: string;
  manifest: ManifestDefinition;
}

export type SignAiGeneratedMediaOptions = SignAiGeneratedImageOptions;
export type SignAiGeneratedMediaResult = SignAiGeneratedImageResult;

export interface ViewAiGeneratedMediaOptions {
  input: string;
  mimeType?: string;
}

export interface ViewAiGeneratedMediaResult {
  input: string;
  hasManifest: boolean;
  metadata: ExtractedAiGeneratedMetadata | null;
  validationStatus: ExtractedValidationStatus[];
  assertionLabels: string[];
}

export interface ExtractedAiGeneratedMetadata {
  title: string | null;
  format: string | null;
  claimGenerator: string | null;
  generator: JsonValue;
  model: JsonValue;
  producer: JsonValue;
  prompt: JsonValue;
  softwareAgent: JsonValue;
  digitalSourceType: JsonValue;
  createdAt: string | null;
  action: string | null;
  signatureIssuer: string | null;
  signatureTime: string | null;
}

export interface ExtractedValidationStatus {
  code: string;
  explanation: string | null;
  url: string | null;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ManifestDefinition {
  claim_generator: string;
  claim_generator_info: Array<{ name: string; version?: string }>;
  format: string;
  title: string;
  assertions: Array<{
    label: string;
    data: Record<string, unknown>;
  }>;
  vendor?: string;
}

export enum SigningAlgorithm {
  ES256 = "es256",
  ES384 = "es384",
  ES512 = "es512",
  PS256 = "ps256",
  PS384 = "ps384",
  PS512 = "ps512",
  Ed25519 = "ed25519",
}

export type LocalSigner = ContentAuthLocalSigner;
export type Signer = ContentAuthLocalSigner;

export async function createLocalSigner({
  certificatePath,
  privateKeyPath,
  algorithm,
  tsaUrl,
}: LocalSignerOptions): Promise<LocalSigner> {
  const [certificate, privateKey] = await Promise.all([
    readFile(certificatePath),
    readFile(privateKeyPath),
  ]);

  return ContentAuthLocalSigner.newSigner(
    certificate,
    privateKey,
    (algorithm ?? SigningAlgorithm.ES256) as SigningAlg,
    tsaUrl,
  );
}

export async function createTestSigner(): Promise<LocalSigner> {
  const [certificate, privateKey] = await Promise.all([
    readFile(DEVELOPMENT_CERTIFICATE_URL),
    readFile(DEVELOPMENT_PRIVATE_KEY_URL),
  ]);

  return ContentAuthLocalSigner.newSigner(
    certificate,
    privateKey,
    SigningAlgorithm.ES256,
    "http://timestamp.digicert.com",
  );
}

export async function signAiGeneratedImage({
  input,
  output,
  metadata,
  signer,
  mimeType = inferMimeType(input),
  vendor,
  embed = true,
  remoteManifestUrl = null,
}: SignAiGeneratedImageOptions): Promise<SignAiGeneratedImageResult> {
  const manifest = createAiGeneratedManifest({
    input,
    mimeType,
    metadata,
    vendor,
  });
  const effectiveSigner = signer ?? (await createTestSigner());
  const asset: FileAsset = { path: input, mimeType };
  const builder = Builder.withJson(
    manifest as Parameters<typeof Builder.withJson>[0],
  );
  builder.updateManifestProperty("claim_version", 2);

  if (!embed) {
    builder.setNoEmbed(true);
  }

  if (remoteManifestUrl) {
    builder.setRemoteUrl(remoteManifestUrl);
  }

  builder.sign(effectiveSigner, asset, { path: output });

  return {
    output,
    manifest,
  };
}

export async function signAiGeneratedMedia(
  options: SignAiGeneratedMediaOptions,
): Promise<SignAiGeneratedMediaResult> {
  return signAiGeneratedImage(options);
}

export async function viewAiGeneratedMedia({
  input,
  mimeType,
}: ViewAiGeneratedMediaOptions): Promise<ViewAiGeneratedMediaResult> {
  const asset: FileAsset = mimeType ? { path: input, mimeType } : { path: input };
  const reader = await Reader.fromAsset(asset);
  const activeManifest = reader?.getActive() ?? null;
  const manifestStore = reader?.json() as ManifestStoreLike | null | undefined;
  const validationStatus = normalizeValidationStatus(
    manifestStore?.validation_status ?? [],
  );
  const metadata = activeManifest
    ? extractAiGeneratedMetadata(activeManifest)
    : null;

  return {
    input,
    hasManifest: Boolean(activeManifest),
    metadata,
    validationStatus,
    assertionLabels:
      activeManifest?.assertions
        ?.map((assertion: ManifestAssertionLike) => assertion.label)
        .sort() ?? [],
  };
}

export function createAiGeneratedManifest({
  input,
  mimeType,
  metadata,
  vendor,
}: {
  input: string;
  mimeType: string;
  metadata: AiGeneratedMetadata;
  vendor?: string;
}): ManifestDefinition {
  const when = normalizeTimestamp(metadata.createdAt);
  const softwareAgent = {
    name: metadata.softwareAgent,
    ...(metadata.version ? { version: metadata.version } : {}),
  };
  const digitalSourceType =
    metadata.digitalSourceType ?? DEFAULT_DIGITAL_SOURCE_TYPE;
  const claimGenerator =
    metadata.claimGenerator ??
    formatClaimGenerator(metadata.softwareAgent, metadata.version);

  return {
    claim_generator: claimGenerator,
    claim_generator_info: [softwareAgent],
    format: mimeType,
    title: metadata.title ?? basename(input),
    assertions: [
      {
        label: "c2pa.actions.v2",
        data: {
          actions: [
            {
              action: "c2pa.created",
              when,
              softwareAgent,
              digitalSourceType,
            },
          ],
        },
      },
      {
        label: "stds.schema-org.CreativeWork",
        data: {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          generator:
            metadata.generator ?? metadata.model ?? metadata.softwareAgent,
          producer: metadata.producer,
          softwareAgent,
          prompt: metadata.prompt,
          digitalSourceType,
          ...metadata.creativeWork,
        },
      },
    ],
    ...(vendor ? { vendor } : {}),
  };
}

export function inferMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  const mimeType = MIME_BY_EXTENSION.get(extension);

  if (!mimeType) {
    throw new Error(
      `Unsupported media extension "${extension}". Pass mimeType explicitly.`,
    );
  }

  return mimeType;
}

export function formatClaimGenerator(name: string, version?: string): string {
  const normalizedName = name.trim().replace(/\s+/g, "-");

  return version ? `${normalizedName}/${version}` : normalizedName;
}

function extractAiGeneratedMetadata(manifest: ManifestLike): ExtractedAiGeneratedMetadata {
  const actionAssertion = manifest.assertions?.find(
    (assertion: ManifestAssertionLike) => assertion.label === "c2pa.actions.v2",
  );
  const creativeWorkAssertion = manifest.assertions?.find(
    (assertion: ManifestAssertionLike) =>
      assertion.label === "stds.schema-org.CreativeWork",
  );
  const action = getFirstAction(actionAssertion?.data);
  const creativeWork =
    creativeWorkAssertion?.data && typeof creativeWorkAssertion.data === "object"
      ? (creativeWorkAssertion.data as Record<string, unknown>)
      : {};

  return {
    title: manifest.title ?? null,
    format: manifest.format ?? null,
    claimGenerator: getClaimGenerator(manifest),
    generator: toJsonValue(creativeWork.generator),
    model: toJsonValue(creativeWork.model),
    producer: toJsonValue(creativeWork.producer),
    prompt: toJsonValue(creativeWork.prompt),
    softwareAgent: toJsonValue(action?.softwareAgent ?? creativeWork.softwareAgent),
    digitalSourceType: toJsonValue(
      action?.digitalSourceType ?? creativeWork.digitalSourceType,
    ),
    createdAt: typeof action?.when === "string" ? action.when : null,
    action: typeof action?.action === "string" ? action.action : null,
    signatureIssuer: manifest.signature_info?.issuer ?? null,
    signatureTime: manifest.signature_info?.time ?? null,
  };
}

function normalizeValidationStatus(
  statuses: ValidationStatusLike[],
): ExtractedValidationStatus[] {
  return statuses.map((status) => ({
    code: status.code,
    explanation: status.explanation ?? null,
    url: status.url ?? null,
  }));
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]),
    );
  }

  return null;
}

type ManifestStoreLike = {
  validation_status?: ValidationStatusLike[] | null;
};

type ManifestLike = {
  assertions?: ManifestAssertionLike[];
  claim_generator?: string | null;
  claim_generator_info?: Array<{ name?: string; version?: string }>;
  format?: string | null;
  signature_info?: {
    issuer?: string | null;
    time?: string | null;
  } | null;
  title?: string | null;
};

type ManifestAssertionLike = {
  label: string;
  data?: unknown;
};

type ValidationStatusLike = {
  code: string;
  explanation?: string | null;
  url?: string | null;
};

function getClaimGenerator(manifest: ManifestLike): string | null {
  if (manifest.claim_generator) {
    return manifest.claim_generator;
  }

  const generatorInfo = manifest.claim_generator_info ?? [];

  if (generatorInfo.length === 0) {
    return null;
  }

  return generatorInfo
    .map(({ name, version }) => (version ? `${name}/${version}` : name))
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function getFirstAction(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const actions = (data as { actions?: unknown }).actions;

  if (!Array.isArray(actions)) {
    return null;
  }

  const [action] = actions;

  return action && typeof action === "object"
    ? (action as Record<string, unknown>)
    : null;
}

function normalizeTimestamp(value: string | Date | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : value;
}
