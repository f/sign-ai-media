#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { Command, InvalidArgumentError } from "commander";
import { z } from "zod";

import {
  DIGITAL_SOURCE_TYPE_PRESETS,
  SigningAlgorithm,
  createLocalSigner,
  resolveDigitalSourceType,
  signAiGeneratedMedia,
  viewAiGeneratedMedia,
  type AiGeneratedMetadata,
  type IngredientInput,
  type TrainingMiningAssertion,
  type TrainingMiningUse,
} from "./index.js";

const trainingMiningUseSchema = z.enum(["allowed", "notAllowed", "constrained"]);

const metadataSchema = z.object({
  softwareAgent: z.string().min(1),
  version: z.string().optional(),
  claimGenerator: z.string().optional(),
  generator: z.string().optional(),
  digitalSourceType: z.string().url().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  title: z.string().optional(),
  producer: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  seed: z.union([z.string(), z.number()]).optional(),
  scheduler: z.string().optional(),
  cfgScale: z.number().positive().optional(),
  steps: z.number().int().positive().optional(),
  modelVersion: z.string().optional(),
  modelUri: z.string().url().optional(),
  modelHash: z.string().optional(),
  inputUri: z.string().url().optional(),
  inputHash: z.string().optional(),
  action: z.string().optional(),
  actionDescription: z.string().optional(),
  actionParameters: z.record(z.string(), z.unknown()).optional(),
  trainingMining: z
    .record(
      z.string(),
      z.object({
        use: trainingMiningUseSchema,
        constraint_info: z.string().optional(),
      }),
    )
    .optional(),
  creativeWork: z.record(z.string(), z.unknown()).optional(),
});

const program = new Command()
  .name("sign-ai-media")
  .description("Sign media with C2PA metadata declaring AI generation.")
  .argument("[input]", "input media path")
  .argument("[output]", "output media path")
  .option("--view <input-file>", "view AI/C2PA metadata from a signed media file")
  .option("--json", "print --view output as JSON")
  .option(
    "--software-agent <name>",
    "model, service, app, or pipeline that created the media",
  )
  .option("--version <version>", "software agent version")
  .option(
    "--claim-generator <value>",
    "C2PA claim_generator value; defaults to software-agent/version",
  )
  .option("--generator <name>", "friendly generator name")
  .option("--model <name>", "model name")
  .option("--model-version <version>", "model revision or version")
  .option("--model-uri <url>", "URI for the model or model card")
  .option("--model-hash <sha256>", "hash for the model or model card")
  .option("--input-uri <url>", "URI for a remote input used to create the media")
  .option("--input-hash <sha256>", "hash for the remote input")
  .option("--producer <name>", "producer or organization name")
  .option("--prompt <text>", "prompt to embed in metadata")
  .option("--prompt-file <path>", "read prompt text from a file")
  .option("--negative-prompt <text>", "negative prompt to embed in metadata")
  .option("--negative-prompt-file <path>", "read negative prompt text from a file")
  .option("--seed <value>", "generation seed")
  .option("--scheduler <name>", "generation scheduler/sampler name")
  .option("--cfg-scale <number>", "classifier-free guidance scale", parsePositiveNumber)
  .option("--steps <number>", "generation step count", parsePositiveInteger)
  .option("--title <title>", "human-readable asset title")
  .option("--created-at <iso>", "creation timestamp", parseDateTime)
  .option(
    "--source-type <preset>",
    `digital source preset: ${Object.keys(DIGITAL_SOURCE_TYPE_PRESETS).join(", ")}`,
  )
  .option(
    "--digital-source-type <url>",
    "IPTC digital source type URL",
  )
  .option("--action <name>", "C2PA action name", "c2pa.created")
  .option("--action-description <text>", "free-text C2PA action description")
  .option(
    "--action-parameters-json <json>",
    "JSON object merged into the C2PA action parameters",
    parseJsonObject,
  )
  .option(
    "--creative-work-json <json>",
    "JSON object merged into schema.org CreativeWork metadata",
    parseJsonObject,
  )
  .option(
    "--ingredient <path>",
    "add a componentOf C2PA ingredient; repeat for multiple inputs",
    collect,
    [],
  )
  .option("--parent <path>", "add a parentOf C2PA ingredient")
  .option(
    "--ai-training-use <allowed|notAllowed|constrained>",
    "CAWG use policy for non-generative AI training",
    parseTrainingMiningUse,
  )
  .option(
    "--ai-generative-training-use <allowed|notAllowed|constrained>",
    "CAWG use policy for generative AI training",
    parseTrainingMiningUse,
  )
  .option(
    "--data-mining-use <allowed|notAllowed|constrained>",
    "CAWG use policy for text/data mining",
    parseTrainingMiningUse,
  )
  .option(
    "--ai-inference-use <allowed|notAllowed|constrained>",
    "CAWG use policy for AI inference",
    parseTrainingMiningUse,
  )
  .option(
    "--training-constraint-info <text>",
    "constraint details for constrained CAWG training/data-mining entries",
  )
  .option("--certificate <path>", "C2PA signing certificate path")
  .option("--private-key <path>", "C2PA signing private key path")
  .option(
    "--algorithm <algorithm>",
    `signing algorithm: ${Object.values(SigningAlgorithm).join(", ")}`,
    parseAlgorithm,
  )
  .option("--tsa-url <url>", "timestamp authority URL for local signing")
  .option("--mime-type <mime>", "override input MIME type")
  .option("--vendor <name>", "manifest label vendor prefix")
  .option("--remote-manifest-url <url>", "store manifest remotely at this URL")
  .option("--verify-trust", "verify trust while reading with --view")
  .option("--trust-anchors <path-or-pem>", "trust anchors for --view validation")
  .option("--fetch-remote-manifest", "fetch remote manifests while reading with --view")
  .option("--no-fetch-remote-manifest", "do not fetch remote manifests while reading with --view")
  .option("--no-embed", "do not embed the signed manifest in the output asset")
  .action(
    async (input: string | undefined, output: string | undefined, rawOptions) => {
      if (rawOptions.view) {
        const result = await viewAiGeneratedMedia({
          input: rawOptions.view,
          mimeType: rawOptions.mimeType,
          verifyTrust: rawOptions.verifyTrust,
          trustAnchors: rawOptions.trustAnchors,
          remoteManifestFetch: rawOptions.fetchRemoteManifest,
        });

        if (rawOptions.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printViewResult(result);
        }
        return;
      }

      if (!input || !output) {
        throw new Error("input and output are required unless --view is used");
      }

      if (!rawOptions.softwareAgent) {
        throw new Error("--software-agent is required when signing media");
      }

      const prompt = await readExclusiveTextOption(
        rawOptions.prompt,
        rawOptions.promptFile,
        "--prompt",
        "--prompt-file",
      );
      const negativePrompt = await readExclusiveTextOption(
        rawOptions.negativePrompt,
        rawOptions.negativePromptFile,
        "--negative-prompt",
        "--negative-prompt-file",
      );
      const digitalSourceType = resolveSourceType(
        rawOptions.sourceType,
        rawOptions.digitalSourceType,
      );
      const trainingMining = createTrainingMiningAssertion(rawOptions);

      const metadata = metadataSchema.parse({
        softwareAgent: rawOptions.softwareAgent,
        version: rawOptions.version,
        claimGenerator: rawOptions.claimGenerator,
        generator: rawOptions.generator,
        digitalSourceType,
        createdAt: rawOptions.createdAt,
        title: rawOptions.title,
        producer: rawOptions.producer,
        model: rawOptions.model,
        modelVersion: rawOptions.modelVersion,
        modelUri: rawOptions.modelUri,
        modelHash: rawOptions.modelHash,
        inputUri: rawOptions.inputUri,
        inputHash: rawOptions.inputHash,
        prompt,
        negativePrompt,
        seed: rawOptions.seed,
        scheduler: rawOptions.scheduler,
        cfgScale: rawOptions.cfgScale,
        steps: rawOptions.steps,
        action: rawOptions.action,
        actionDescription: rawOptions.actionDescription,
        actionParameters: rawOptions.actionParametersJson,
        trainingMining,
        creativeWork: rawOptions.creativeWorkJson,
      }) satisfies AiGeneratedMetadata;

      const signer = await resolveSigner(rawOptions);

      const result = await signAiGeneratedMedia({
        input,
        output,
        metadata,
        signer,
        mimeType: rawOptions.mimeType,
        vendor: rawOptions.vendor,
        embed: rawOptions.embed,
        remoteManifestUrl: rawOptions.remoteManifestUrl ?? null,
        ingredients: createIngredients(rawOptions),
      });

      console.log(`Signed AI-generated media: ${result.output}`);
    },
  );

program.parseAsync().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error(z.prettifyError(error));
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});

function parseAlgorithm(value: string): SigningAlgorithm {
  if (Object.values(SigningAlgorithm).includes(value as SigningAlgorithm)) {
    return value as SigningAlgorithm;
  }

  throw new InvalidArgumentError(`unsupported signing algorithm: ${value}`);
}

function parseTrainingMiningUse(value: string): TrainingMiningUse {
  const parsed = trainingMiningUseSchema.safeParse(value);

  if (!parsed.success) {
    throw new InvalidArgumentError(
      `expected allowed, notAllowed, or constrained: ${value}`,
    );
  }

  return parsed.data;
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`expected a positive number: ${value}`);
  }

  return parsed;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`expected a positive integer: ${value}`);
  }

  return parsed;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function resolveSigner(rawOptions: {
  certificate?: string;
  privateKey?: string;
  algorithm?: SigningAlgorithm;
  tsaUrl?: string;
}) {
  const hasCertificate = Boolean(rawOptions.certificate);
  const hasPrivateKey = Boolean(rawOptions.privateKey);

  if (hasCertificate !== hasPrivateKey) {
    throw new Error("--certificate and --private-key must be provided together");
  }

  if (!hasCertificate || !hasPrivateKey) {
    console.warn(
      "No signing certificate/private key provided; using bundled test credentials. Use --certificate and --private-key for production provenance.",
    );

    return undefined;
  }

  return createLocalSigner({
    certificatePath: rawOptions.certificate!,
    privateKeyPath: rawOptions.privateKey!,
    algorithm: rawOptions.algorithm,
    tsaUrl: rawOptions.tsaUrl,
  });
}

function parseDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    throw new InvalidArgumentError(`invalid ISO timestamp: ${value}`);
  }

  return date.toISOString();
}

async function readExclusiveTextOption(
  inlineValue: string | undefined,
  filePath: string | undefined,
  inlineFlag: string,
  fileFlag: string,
): Promise<string | undefined> {
  if (inlineValue && filePath) {
    throw new Error(`${inlineFlag} and ${fileFlag} cannot be used together`);
  }

  if (!filePath) {
    return inlineValue;
  }

  return readFile(filePath, "utf8");
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("expected a JSON object");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new InvalidArgumentError(`invalid JSON object: ${message}`);
  }
}

function resolveSourceType(
  sourceType: string | undefined,
  digitalSourceType: string | undefined,
): string | undefined {
  if (sourceType && digitalSourceType) {
    throw new Error("--source-type and --digital-source-type cannot be used together");
  }

  return sourceType ? resolveDigitalSourceType(sourceType) : digitalSourceType;
}

function createIngredients(rawOptions: {
  ingredient?: string[];
  parent?: string;
}): IngredientInput[] {
  return [
    ...(rawOptions.parent
      ? [{ path: rawOptions.parent, relationship: "parentOf" as const }]
      : []),
    ...(rawOptions.ingredient ?? []).map((path) => ({
      path,
      relationship: "componentOf" as const,
    })),
  ];
}

function createTrainingMiningAssertion(rawOptions: {
  aiTrainingUse?: TrainingMiningUse;
  aiGenerativeTrainingUse?: TrainingMiningUse;
  dataMiningUse?: TrainingMiningUse;
  aiInferenceUse?: TrainingMiningUse;
  trainingConstraintInfo?: string;
}): TrainingMiningAssertion | undefined {
  const entries: TrainingMiningAssertion = {};

  addTrainingMiningEntry(
    entries,
    "cawg.ai_training",
    rawOptions.aiTrainingUse,
    rawOptions.trainingConstraintInfo,
  );
  addTrainingMiningEntry(
    entries,
    "cawg.ai_generative_training",
    rawOptions.aiGenerativeTrainingUse,
    rawOptions.trainingConstraintInfo,
  );
  addTrainingMiningEntry(
    entries,
    "cawg.data_mining",
    rawOptions.dataMiningUse,
    rawOptions.trainingConstraintInfo,
  );
  addTrainingMiningEntry(
    entries,
    "cawg.ai_inference",
    rawOptions.aiInferenceUse,
    rawOptions.trainingConstraintInfo,
  );

  return Object.keys(entries).length > 0 ? entries : undefined;
}

function addTrainingMiningEntry(
  entries: TrainingMiningAssertion,
  key: keyof TrainingMiningAssertion,
  use: TrainingMiningUse | undefined,
  constraintInfo: string | undefined,
) {
  if (!use) {
    return;
  }

  entries[key] = {
    use,
    ...(use === "constrained" && constraintInfo
      ? { constraint_info: constraintInfo }
      : {}),
  };
}

function printViewResult(result: Awaited<ReturnType<typeof viewAiGeneratedMedia>>) {
  console.log(`AI media metadata: ${result.input}`);

  if (!result.hasManifest || !result.metadata) {
    console.log("Status: No C2PA manifest found.");
    return;
  }

  const { metadata } = result;

  printField("Status", "C2PA manifest found");
  printField("Title", metadata.title);
  printField("Format", metadata.format);
  printField("Claim generator", metadata.claimGenerator);
  printField("Generator", metadata.generator);
  printField("Model", metadata.model);
  printField("Producer", metadata.producer);
  printField("Generation", metadata.generation);
  printField("Software agent", formatValue(metadata.softwareAgent));
  printField("Action", metadata.action);
  printField("Action description", metadata.actionDescription);
  printField("Action parameters", metadata.actionParameters);
  printField("Created at", metadata.createdAt);
  printField("Digital source type", metadata.digitalSourceType);
  printField("Prompt", metadata.prompt);
  printField("Negative prompt", metadata.negativePrompt);
  printField("Training/data mining", metadata.trainingMining);
  printField("Signature issuer", metadata.signatureIssuer);
  printField("Signature time", metadata.signatureTime);

  if (result.validationStatus.length > 0) {
    console.log("Validation:");
    for (const status of result.validationStatus) {
      const explanation = status.explanation ? ` - ${status.explanation}` : "";
      console.log(`  - ${status.code}${explanation}`);
    }
  } else {
    console.log("Validation: No validation issues reported.");
  }

  if (result.assertionLabels.length > 0) {
    console.log("Assertions:");
    for (const label of result.assertionLabels) {
      console.log(`  - ${label}`);
    }
  }
}

function printField(label: string, value: unknown) {
  const formatted = formatValue(value);

  if (formatted) {
    console.log(`${label}: ${formatted}`);
  }
}

function formatValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}
