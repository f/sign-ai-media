---
name: sign-ai-media
description: >-
  Sign images and videos with C2PA provenance declaring AI-generated media, and
  inspect existing AI/C2PA metadata. Use when the user asks to sign, label, tag,
  watermark, or mark media as AI-generated, add C2PA manifests, embed
  provenance, view AI metadata in a file, or work with digital source types.
---

# sign-ai-media

CLI and TypeScript library for embedding signed C2PA manifests in images and videos to label them as AI-generated.

## Prerequisites

The package must be installed first. From the project root:

```sh
npm install
npm run build
```

After building, the CLI is available at `node dist/cli.js` or via `npx sign-ai-media` if installed globally.

For development without building, use `npx tsx src/cli.ts` instead.

## Signing Media

**Minimum required**: `input`, `output`, and `--software-agent`.

```sh
npx sign-ai-media input.png output.png --software-agent "my-generator"
```

### Common signing pattern

```sh
npx sign-ai-media input.png output.png \
  --software-agent "acme-image-model" \
  --version "1.0.0" \
  --generator "Acme Image API" \
  --model "acme-diffusion-v1" \
  --producer "Acme Labs" \
  --prompt "A red fox in a snowy forest" \
  --source-type ai-generated
```

### With production credentials

```sh
npx sign-ai-media input.png output.png \
  --software-agent "acme-image-model" \
  --certificate ./certs/signing-cert.pem \
  --private-key ./certs/signing-key.pem \
  --algorithm es256 \
  --tsa-url "https://timestamp.example.com"
```

Without `--certificate`/`--private-key`, the bundled development signer is used automatically (fine for local testing, not for production).

## Viewing Metadata

```sh
npx sign-ai-media --view output.png
npx sign-ai-media --view output.png --json
```

`--json` returns machine-readable output. Use it when piping results or inspecting fields programmatically.

## CLI Flag Reference

### Identity & metadata

| Flag | Description |
|------|-------------|
| `--software-agent <name>` | **Required.** Model, service, or pipeline name |
| `--version <ver>` | Software agent version |
| `--generator <name>` | Friendly generator name for CreativeWork |
| `--model <name>` | Model name |
| `--model-version <ver>` | Model revision |
| `--producer <name>` | Organization or creator name |
| `--claim-generator <val>` | C2PA claim_generator override |

### Generation parameters

| Flag | Description |
|------|-------------|
| `--prompt <text>` | Prompt text (public metadata) |
| `--prompt-file <path>` | Read prompt from file |
| `--negative-prompt <text>` | Negative prompt text |
| `--negative-prompt-file <path>` | Read negative prompt from file |
| `--seed <value>` | Generation seed |
| `--scheduler <name>` | Scheduler/sampler name |
| `--cfg-scale <num>` | CFG scale (positive number) |
| `--steps <num>` | Step count (positive integer) |
| `--created-at <iso>` | Creation timestamp |

### Source type

| Flag | Description |
|------|-------------|
| `--source-type <preset>` | Preset name (see below) |
| `--digital-source-type <url>` | Full IPTC URL override |

Source type presets: `ai-generated`, `ai-edited`, `algorithmic`, `algorithmically-enhanced`, `composite-ai`, `composite`, `composite-capture`, `capture`, `screen-capture`, `human-edited`, `digital-art`, `digital-creation`, `software-image`, `data-driven`, `empty`, `ai-data`.

Default is `ai-generated` (`trainedAlgorithmicMedia`).

### Ingredients

| Flag | Description |
|------|-------------|
| `--ingredient <path>` | Add componentOf ingredient (repeatable) |
| `--parent <path>` | Add parentOf ingredient |

### Training/data-mining policy (CAWG)

| Flag | Values |
|------|--------|
| `--ai-training-use` | `allowed`, `notAllowed`, `constrained` |
| `--ai-generative-training-use` | `allowed`, `notAllowed`, `constrained` |
| `--data-mining-use` | `allowed`, `notAllowed`, `constrained` |
| `--ai-inference-use` | `allowed`, `notAllowed`, `constrained` |
| `--training-constraint-info <text>` | Explanation for `constrained` entries |

### Signing credentials

| Flag | Description |
|------|-------------|
| `--certificate <path>` | PEM certificate path |
| `--private-key <path>` | PEM private key path |
| `--algorithm <alg>` | `es256`, `es384`, `es512`, `ps256`, `ps384`, `ps512`, `ed25519` |
| `--tsa-url <url>` | Timestamp authority URL |

### Advanced

| Flag | Description |
|------|-------------|
| `--action <name>` | C2PA action (default: `c2pa.created`) |
| `--action-description <text>` | Action description |
| `--action-parameters-json <json>` | Extra action parameters as JSON |
| `--creative-work-json <json>` | Extra CreativeWork properties as JSON |
| `--mime-type <mime>` | Override MIME type |
| `--remote-manifest-url <url>` | Store manifest remotely |
| `--no-embed` | Don't embed manifest in output |
| `--vendor <name>` | Manifest label vendor prefix |

### Viewer flags

| Flag | Description |
|------|-------------|
| `--view <file>` | View mode (no signing) |
| `--json` | JSON output for `--view` |
| `--verify-trust` | Verify trust chain |
| `--trust-anchors <path>` | PEM trust anchors |
| `--fetch-remote-manifest` | Fetch remote manifests |
| `--no-fetch-remote-manifest` | Skip remote manifests |

## TypeScript API

```typescript
import { signAiGeneratedMedia, viewAiGeneratedMedia } from "sign-ai-media";

await signAiGeneratedMedia({
  input: "input.png",
  output: "output.png",
  metadata: {
    softwareAgent: "my-generator",
    version: "1.0.0",
    generator: "My Generator",
    model: "my-model-v1",
    producer: "My Org",
    prompt: "A sunset over mountains",
  },
});

const result = await viewAiGeneratedMedia({ input: "output.png" });
```

## Supported formats

PNG, JPEG, WebP, AVIF, TIFF, MP4, MOV, AVI. Use `--mime-type` for unusual extensions.

## Workflow guidance

- **Signing then verifying**: always run `--view` on the output after signing to confirm the manifest was embedded correctly.
- **Batch signing**: loop over files in a shell script; each call is independent.
- **Prompt from file**: use `--prompt-file` for long prompts instead of inline `--prompt` to avoid shell quoting issues.
- **`--certificate` and `--private-key`** must always be provided together. Omitting both uses the bundled dev signer.
- **`--source-type` and `--digital-source-type`** are mutually exclusive.
- **`--prompt` and `--prompt-file`** are mutually exclusive (same for `--negative-prompt`/`--negative-prompt-file`).
