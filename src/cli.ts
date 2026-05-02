#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { z } from "zod";

import {
  SigningAlgorithm,
  createLocalSigner,
  signAiGeneratedMedia,
  viewAiGeneratedMedia,
  type AiGeneratedMetadata,
} from "./index.js";

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
  creativeWork: z.record(z.string(), z.unknown()).optional(),
});

const program = new Command()
  .name("sign-ai-media")
  .description("Sign media with C2PA metadata declaring AI generation.")
  .argument("[input]", "input media path")
  .argument("[output]", "output media path")
  .option("--view <input-file>", "view AI/C2PA metadata from a signed media file")
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
  .option("--producer <name>", "producer or organization name")
  .option("--prompt <text>", "prompt to embed in metadata")
  .option("--title <title>", "human-readable asset title")
  .option("--created-at <iso>", "creation timestamp", parseDateTime)
  .option(
    "--digital-source-type <url>",
    "IPTC digital source type URL",
  )
  .option(
    "--creative-work-json <json>",
    "JSON object merged into schema.org CreativeWork metadata",
    parseJsonObject,
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
  .option("--no-embed", "do not embed the signed manifest in the output asset")
  .action(
    async (input: string | undefined, output: string | undefined, rawOptions) => {
      if (rawOptions.view) {
        const result = await viewAiGeneratedMedia({
          input: rawOptions.view,
          mimeType: rawOptions.mimeType,
        });

        printViewResult(result);
        return;
      }

      if (!input || !output) {
        throw new Error("input and output are required unless --view is used");
      }

      if (!rawOptions.softwareAgent) {
        throw new Error("--software-agent is required when signing media");
      }

      const metadata = metadataSchema.parse({
        softwareAgent: rawOptions.softwareAgent,
        version: rawOptions.version,
        claimGenerator: rawOptions.claimGenerator,
        generator: rawOptions.generator,
        digitalSourceType: rawOptions.digitalSourceType,
        createdAt: rawOptions.createdAt,
        title: rawOptions.title,
        producer: rawOptions.producer,
        model: rawOptions.model,
        prompt: rawOptions.prompt,
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
  printField("Software agent", formatValue(metadata.softwareAgent));
  printField("Action", metadata.action);
  printField("Created at", metadata.createdAt);
  printField("Digital source type", metadata.digitalSourceType);
  printField("Prompt", metadata.prompt);
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
