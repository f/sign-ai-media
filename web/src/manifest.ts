const IPTC_BASE = "http://cv.iptc.org/newscodes/digitalsourcetype/";

export const DIGITAL_SOURCE_TYPE_PRESETS: Record<string, string> = {
  "ai-generated": `${IPTC_BASE}trainedAlgorithmicMedia`,
  "ai-edited": `${IPTC_BASE}compositeWithTrainedAlgorithmicMedia`,
  algorithmic: `${IPTC_BASE}algorithmicMedia`,
  "algorithmically-enhanced": `${IPTC_BASE}algorithmicallyEnhanced`,
  "composite-ai": `${IPTC_BASE}compositeSynthetic`,
  composite: `${IPTC_BASE}composite`,
  "composite-capture": `${IPTC_BASE}compositeCapture`,
  capture: `${IPTC_BASE}digitalCapture`,
  "screen-capture": `${IPTC_BASE}screenCapture`,
  "human-edited": `${IPTC_BASE}humanEdits`,
  "digital-art": `${IPTC_BASE}digitalArt`,
  "digital-creation": `${IPTC_BASE}digitalCreation`,
  "software-image": `${IPTC_BASE}softwareImage`,
  "data-driven": `${IPTC_BASE}dataDrivenMedia`,
  empty: "http://c2pa.org/digitalsourcetype/empty",
  "ai-data": "http://c2pa.org/digitalsourcetype/trainedAlgorithmicData",
};

export const DEFAULT_DIGITAL_SOURCE_TYPE =
  `${IPTC_BASE}trainedAlgorithmicMedia`;

export interface AiMediaMetadata {
  softwareAgent: string;
  version?: string;
  claimGenerator?: string;
  generator?: string;
  digitalSourceType?: string;
  createdAt?: string;
  title?: string;
  producer?: string;
  model?: string;
  prompt?: string;
  negativePrompt?: string;
  seed?: string | number;
  scheduler?: string;
  cfgScale?: number;
  steps?: number;
  action?: string;
  actionDescription?: string;
  trainingMining?: Record<
    string,
    { use: string; constraint_info?: string }
  >;
}

export interface ManifestDefinition {
  claim_generator: string;
  claim_generator_info: Array<{ name: string; version?: string }>;
  format: string;
  title: string;
  assertions: Array<{ label: string; data: Record<string, unknown> }>;
}

export function createAiGeneratedManifest(opts: {
  filename: string;
  mimeType: string;
  metadata: AiMediaMetadata;
}): ManifestDefinition {
  const { filename, mimeType, metadata } = opts;
  const when = metadata.createdAt ?? new Date().toISOString();
  const softwareAgent: Record<string, string> = { name: metadata.softwareAgent };
  if (metadata.version) softwareAgent.version = metadata.version;

  const digitalSourceType =
    metadata.digitalSourceType ?? DEFAULT_DIGITAL_SOURCE_TYPE;
  const claimGenerator =
    metadata.claimGenerator ?? formatClaimGenerator(metadata.softwareAgent, metadata.version);

  const generation = stripUndefined({
    model: metadata.model,
    seed: metadata.seed,
    scheduler: metadata.scheduler,
    cfgScale: metadata.cfgScale,
    steps: metadata.steps,
  });

  return {
    claim_generator: claimGenerator,
    claim_generator_info: [softwareAgent as { name: string; version?: string }],
    format: mimeType,
    title: metadata.title ?? filename,
    assertions: [
      {
        label: "c2pa.actions.v2",
        data: {
          actions: [
            {
              action: metadata.action ?? "c2pa.created",
              when,
              softwareAgent,
              digitalSourceType,
              ...(metadata.actionDescription
                ? { description: metadata.actionDescription }
                : {}),
              ...(Object.keys(generation).length > 0
                ? { parameters: generation }
                : {}),
            },
          ],
        },
      },
      ...(metadata.trainingMining
        ? [
            {
              label: "cawg.training-mining",
              data: { entries: metadata.trainingMining },
            },
          ]
        : []),
      {
        label: "stds.schema-org.CreativeWork",
        data: {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          generator:
            metadata.generator ?? metadata.model ?? metadata.softwareAgent,
          producer: metadata.producer,
          model: metadata.model,
          softwareAgent,
          prompt: metadata.prompt,
          negativePrompt: metadata.negativePrompt,
          generation,
          digitalSourceType,
        },
      },
    ],
  };
}

function formatClaimGenerator(name: string, version?: string): string {
  const normalized = name.trim().replace(/\s+/g, "-");
  return version ? `${normalized}/${version}` : normalized;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  ) as T;
}

const MIME_BY_EXT: Record<string, string> = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  avi: "video/msvideo",
  mov: "video/quicktime",
  mp4: "video/mp4",
};

export function inferMimeType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}
