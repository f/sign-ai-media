<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-lockup-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/logo-lockup-light.png">
    <img src="./assets/logo-lockup-light.png" alt="sign-ai-media logo" width="600">
  </picture>
</p>

<p align="center">
  Sign images and videos with C2PA provenance that clearly declares AI-generated media.
</p>

`sign-ai-media` is a small open-source Node.js package for adding signed [C2PA](https://c2pa.org/) manifests to generated images and videos. It writes a standards-based AI source signal, lets you control the generator identity shown in the manifest, and exposes both a CLI and a TypeScript API.

It is designed for model hosts, generation apps, internal media pipelines, dataset tooling, and any workflow that wants to label generated media without pretending to be another provider.

## Browser Demo

Try the browser-only signer and viewer:

https://blog.fka.dev/sign-ai-media/

The demo runs entirely in the browser with `@contentauth/c2pa-web` WebAssembly and bundled development signing credentials. It is useful for testing, demos, and local experiments. Use production C2PA credentials for public/user-facing provenance.

## Claude Code Skill

This repo includes a Claude Code skill:

```text
.claude/skills/sign-ai-media/SKILL.md
```

Claude Code can load project skills from the repository's `.claude/skills/` directory. To use this skill in another project, copy the skill directory into that project's `.claude/skills/` folder:

```sh
npx skills add f/sign-ai-media --skill sign-ai-media
```

For a global install, use `-g` so Claude Code can find it from any project:

```sh
npx skills add f/sign-ai-media --skill sign-ai-media -g -y
```

Verify the global install with:

```sh
npx skills list -g
```

Then restart Claude Code, or start a new session, and ask naturally:

```text
Use the sign-ai-media skill to sign this image as AI-generated.
```

```text
Use the sign-ai-media skill to inspect this file's C2PA metadata.
```

```text
Use the sign-ai-media skill to add browser-side signing with the CDN API.
```

Use the skill when you want Claude Code to help sign media, inspect C2PA metadata, choose the right CLI flags, or integrate the browser/CDN API. The skill mirrors the same CLI, TypeScript API, and browser CDN usage documented below.

## What It Writes

The default manifest includes:

- A `c2pa.actions.v2` assertion with `action: "c2pa.created"`.
- A configurable `softwareAgent` object with `name` and optional `version`.
- The IPTC digital source type `trainedAlgorithmicMedia`.
- A `stds.schema-org.CreativeWork` assertion for optional generator, model, producer, prompt, and custom metadata.
- A C2PA signature. You can provide your own certificate/private key, or use the bundled development signer for lower-friction local use.

The default AI source marker is:

```text
http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
```

## Installation

```sh
npm install sign-ai-media
```

You can also run the CLI without installing it first:

```sh
npx sign-ai-media input.png output.png --software-agent "my-generator"
```

This package uses `@contentauth/c2pa-node`, which ships native bindings. Prebuilt binaries are available for common macOS, Linux, and Windows platforms. Other platforms may need a local Rust toolchain.

## Browser CDN API

A browser ESM bundle is published from this repository and can be loaded directly from jsDelivr:

```html
<script type="module">
  import {
    signAiGeneratedMedia,
    viewAiGeneratedMedia,
  } from "https://cdn.jsdelivr.net/gh/f/sign-ai-media@main/web/cdn/sign-ai-media.browser.js";

  const file = document.querySelector("input[type=file]").files[0];

  const { blob } = await signAiGeneratedMedia(file, {
    metadata: {
      softwareAgent: "my-generator",
      version: "1.0.0",
      generator: "My Generator",
      model: "my-model-v1",
      producer: "My Org",
      prompt: "A red fox in a snowy forest",
    },
  });

  const signedFile = new File([blob], "signed.png", { type: blob.type });
  console.log(await viewAiGeneratedMedia(signedFile));
</script>
```

For pinned production use, replace `@main` with a commit SHA or release tag.

## CLI Usage

```sh
npx sign-ai-media input.png output.png \
  --software-agent "acme-image-model" \
  --version "1.0.0" \
  --generator "Acme Image API" \
  --model "acme-diffusion-v1" \
  --producer "Acme Labs"
```

For production provenance, pass your own signing credentials:

```sh
npx sign-ai-media input.png output.png \
  --software-agent "acme-image-model" \
  --certificate ./certs/signing-cert.pem \
  --private-key ./certs/signing-key.pem \
  --algorithm es256 \
  --tsa-url "https://timestamp.example.com"
```

## Viewing Metadata

To inspect AI/C2PA metadata in a signed file, use `--view` with the input file:

```sh
npx sign-ai-media --view output.png
```

The viewer does not modify the file. It reads the active C2PA manifest, extracts the AI-generation fields written by this package, and prints a readable summary:

```text
AI media metadata: output.png
Status: C2PA manifest found
Title: output.png
Format: image/png
Claim generator: acme-image-service/1.0.0
Generator: Acme Image API
Model: acme-diffusion-v1
Producer: Acme Labs
Software agent: {"name":"acme-image-model","version":"1.0.0"}
Action: c2pa.created
Created at: 2026-05-02T09:00:00.000Z
Digital source type: http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
Validation: No validation issues reported.
Assertions:
  - c2pa.actions.v2
  - stds.schema-org.CreativeWork
```

If no C2PA manifest is present, the viewer prints:

```text
AI media metadata: input.png
Status: No C2PA manifest found.
```

Useful metadata options:

```sh
--source-type ai-generated
--claim-generator "acme-image-service/1.0.0"
--prompt "A red fox in a snowy forest"
--prompt-file ./prompt.txt
--negative-prompt "low quality, blurry"
--seed 12345
--scheduler "euler-a"
--cfg-scale 7.5
--steps 30
--created-at "2026-05-02T09:00:00Z"
--digital-source-type "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
--creative-work-json '{"usageInfo":"internal","copyrightNotice":"Acme Labs"}'
--mime-type image/png
--remote-manifest-url "https://cdn.example.com/manifests/image.c2pa"
--no-embed
```

Action/provenance options:

```sh
--action c2pa.created
--action-description "Generated from a text prompt"
--action-parameters-json '{"pipeline":"txt2img"}'
--ingredient ./source-image.png
--ingredient ./mask.png
--parent ./original.png
--model-uri "https://example.com/models/acme-diffusion-v1"
--model-hash "sha256:..."
--input-uri "https://example.com/inputs/reference.png"
--input-hash "sha256:..."
```

Training and data-mining policy options:

```sh
--ai-training-use notAllowed
--ai-generative-training-use notAllowed
--data-mining-use constrained
--ai-inference-use allowed
--training-constraint-info "See https://example.com/ai-use-policy"
```

Viewer options:

```sh
npx sign-ai-media --view output.png --json
npx sign-ai-media --view output.png --verify-trust --trust-anchors ./anchors.pem
npx sign-ai-media --view output.png --fetch-remote-manifest
npx sign-ai-media --view output.png --no-fetch-remote-manifest
```

## Why not c2patool?

[`c2patool`](https://opensource.contentauthenticity.org/docs/c2patool/) is the official general-purpose command line tool for C2PA. It can read C2PA manifest reports, inspect low-level manifest data, and add manifests to supported media files.

Use `c2patool` when you want a broad, standards-level C2PA utility.

Use `sign-ai-media` when you want a smaller tool focused on AI-generated media workflows:

- It has simple flags for common AI metadata such as `--software-agent`, `--model`, `--prompt`, `--source-type`, `--seed`, and training/data-mining policy.
- It writes an AI-oriented manifest shape by default, including `c2pa.actions.v2`, `trainedAlgorithmicMedia`, CreativeWork metadata, and optional CAWG training/data-mining assertions.
- It includes a TypeScript API for Node.js apps, queues, media pipelines, and CMS integrations.
- It includes a focused `--view` mode that extracts the AI/C2PA fields this package writes, instead of only showing a full generic manifest report.

In short: `c2patool` is the toolbox. `sign-ai-media` is the shortcut for signing and reading AI media provenance in apps and automation.

## TypeScript API

```ts
import { signAiGeneratedMedia, viewAiGeneratedMedia } from "sign-ai-media";

await signAiGeneratedMedia({
  input: "input.png",
  output: "output.png",
  metadata: {
    softwareAgent: "acme-image-model",
    version: "1.0.0",
    claimGenerator: "acme-image-service/1.0.0",
    generator: "Acme Image API",
    model: "acme-diffusion-v1",
    modelVersion: "2026-05-02",
    producer: "Acme Labs",
    prompt: "A red fox in a snowy forest",
    negativePrompt: "low quality, blurry",
    seed: 12345,
    scheduler: "euler-a",
    cfgScale: 7.5,
    steps: 30,
    actionDescription: "Generated from a text prompt",
    trainingMining: {
      "cawg.ai_training": { use: "notAllowed" },
      "cawg.ai_generative_training": { use: "notAllowed" },
    },
  },
});

const metadata = await viewAiGeneratedMedia({
  input: "output.png",
});
```

`viewAiGeneratedMedia()` returns a JSON-serializable object, so it can be logged, sent from an API route, or stored directly:

```ts
console.log(JSON.stringify(metadata, null, 2));
```

Example result:

```json
{
  "input": "output.png",
  "hasManifest": true,
  "metadata": {
    "title": "output.png",
    "format": "image/png",
    "claimGenerator": "acme-image-service/1.0.0",
    "generator": "Acme Image API",
    "model": "acme-diffusion-v1",
    "producer": "Acme Labs",
    "prompt": "A red fox in a snowy forest",
    "softwareAgent": {
      "name": "acme-image-model",
      "version": "1.0.0"
    },
    "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    "createdAt": "2026-05-02T09:00:00.000Z",
    "action": "c2pa.created",
    "signatureIssuer": "Example Signing Cert",
    "signatureTime": "2026-05-02T09:00:00+00:00"
  },
  "validationStatus": [],
  "assertionLabels": ["c2pa.actions.v2", "stds.schema-org.CreativeWork"]
}
```

When no manifest is found, the result is:

```json
{
  "input": "input.png",
  "hasManifest": false,
  "metadata": null,
  "validationStatus": [],
  "assertionLabels": []
}
```

Pass a signer when you want the manifest signed with your own production identity:

```ts
import {
  SigningAlgorithm,
  createLocalSigner,
  signAiGeneratedMedia,
} from "sign-ai-media";

const signer = await createLocalSigner({
  certificatePath: "./certs/signing-cert.pem",
  privateKeyPath: "./certs/signing-key.pem",
  algorithm: SigningAlgorithm.ES256,
  tsaUrl: "https://timestamp.example.com",
});

await signAiGeneratedMedia({
  input: "input.png",
  output: "output.png",
  signer,
  metadata: {
    softwareAgent: "acme-image-model",
    version: "1.0.0",
    claimGenerator: "acme-image-service/1.0.0",
    generator: "Acme Image API",
    model: "acme-diffusion-v1",
    producer: "Acme Labs",
    prompt: "A red fox in a snowy forest",
  },
});
```

## Metadata Fields

`metadata.softwareAgent` is required. It should name the model, service, app, or pipeline that created the media.

Optional metadata:

- `version`: version of the software agent or model.
- `claimGenerator`: C2PA user-agent style claim generator. Defaults to `softwareAgent/version`.
- `generator`: friendly generator name for CreativeWork metadata.
- `model`: model name for consumers that display richer generator details.
- `modelVersion`: model revision or version.
- `modelUri` and `modelHash`: model or model-card reference.
- `inputUri` and `inputHash`: remote input reference.
- `producer`: organization, service, or creator responsible for the output.
- `prompt`: prompt text to embed. Treat this as public metadata.
- `negativePrompt`: negative prompt text to embed. Treat this as public metadata.
- `seed`, `scheduler`, `cfgScale`, and `steps`: generation parameters.
- `createdAt`: ISO timestamp. Defaults to the current time.
- `digitalSourceType`: override the IPTC source type URL.
- `action`: C2PA action name. Defaults to `c2pa.created`.
- `actionDescription`: free-text action description.
- `actionParameters`: extra action parameters for advanced C2PA workflows.
- `trainingMining`: CAWG Training and Data Mining assertion entries.
- `creativeWork`: extra properties merged into the schema.org CreativeWork assertion.

## Digital Source Presets

Use `--source-type` for common source types without remembering the full vocabulary URL:

- `ai-generated`: created by a trained generative AI model.
- `ai-edited`: human or tool edits using generative AI, such as inpainting or outpainting.
- `algorithmic`: algorithmic media not based on sampled training data.
- `algorithmically-enhanced`: algorithmic enhancement such as denoise or sharpen.
- `composite-ai`: composite media with at least one generative AI element.
- `composite`: composite of several elements.
- `composite-capture`: composite where all elements are captures of real life.
- `capture`: digital camera or sensor capture.
- `screen-capture`: screen capture.
- `human-edited`: non-generative human edits.
- `digital-art`, `digital-creation`, `software-image`, and `data-driven`: other common IPTC source categories.
- `empty`: C2PA empty asset source type.
- `ai-data`: C2PA trained algorithmic data source type for non-media data.

You can still pass a full URL with `--digital-source-type`.

## Ingredients and Parents

Use `--ingredient` to attach source media that contributed to the signed output. Repeating the flag adds multiple `componentOf` ingredients:

```sh
npx sign-ai-media output.png signed.png \
  --software-agent "acme-image-model" \
  --ingredient ./reference.png \
  --ingredient ./mask.png
```

Use `--parent` when the output is derived from an original asset:

```sh
npx sign-ai-media edited.png signed.png \
  --software-agent "acme-editor" \
  --parent ./original.png \
  --action c2pa.edited \
  --action-description "Inpainted background"
```

## Training and Data Mining

The `--ai-training-use`, `--ai-generative-training-use`, `--data-mining-use`, and `--ai-inference-use` flags write a `cawg.training-mining` assertion using the [CAWG Training and Data Mining Assertion](https://cawg.io/training-and-data-mining/1.1/).

Each flag accepts `allowed`, `notAllowed`, or `constrained`. When using `constrained`, add `--training-constraint-info` to explain the policy or link to a license.

## Supported Media

MIME type is inferred from common media extensions:

- `.png`
- `.jpg` and `.jpeg`
- `.webp`
- `.avif`
- `.tif` and `.tiff`
- `.mp4`
- `.mov`
- `.avi`

Pass `--mime-type` or `mimeType` when the extension is missing or unusual.

## Signing Credentials

C2PA manifests need a signer, but this package does not require users to bring a certificate/private-key pair just to get started. If no signer is provided, `signAiGeneratedMedia()` and the CLI use bundled test credentials.

For production provenance, pass a local certificate/private-key pair through `createLocalSigner()` or another compatible `@contentauth/c2pa-node` signer object. Do not use another company's name, certificate, or identity fields.

### Where to get production certificates

Production C2PA signing credentials should come from a certificate authority on the C2PA trust list. The official Content Authenticity Initiative docs explain that conforming generator products must use a certificate that chains back to a trusted C2PA certificate authority, and that C2PA maintains separate trust lists for claim-signing certificates and timestamp authorities.

Start here:

- [Getting a signing certificate](https://opensource.contentauthenticity.org/docs/signing/get-cert) from the CAI open-source docs.
- [C2PA trust lists](https://opensource.contentauthenticity.org/docs/conformance/trust-lists), including the C2PA trust list and C2PA TSA trust list.
- [C2PA Conformance Explorer](https://spec.c2pa.org/conformance-explorer/) for the current readable trust-list view.
- [C2PA public trust-list repository](https://github.com/c2pa-org/conformance-public/tree/main/trust-list) for the PEM trust-list files.

Certificate authorities listed by the CAI docs include:

- [DigiCert C2PA Media Trust](https://www.digicert.com/solutions/c2pa-media-trust)
- [SSL.com C2PA Enterprise Content Authenticity Solutions](https://www.ssl.com/article/c2pa-enterprise-content-authenticity-solutions/)
- [Tauth Labs](https://tauth.io/blog/tauth-labs-becomes-c2pa-certification-authority)
- [Trufo Trust Certificate Authority](https://trufo.ai/tca)

Provider availability, onboarding requirements, and assurance levels can change, so use the official C2PA trust-list sources above as the source of truth before issuing production credentials.

### Development certificates

The bundled signer is only for local development and demos. It can prove that the package writes and signs a manifest, but it does not give your output a production identity that verifiers should trust.

Use development/test credentials for:

- Local CLI experiments.
- Integration tests.
- Demo assets where trust is not implied.

Use production credentials for:

- Public releases.
- User-facing generated media.
- Workflows where platforms or verifiers should recognize your organization as the signer.

## Verifying Output

After signing, inspect the output with a C2PA-compatible verifier such as the Content Authenticity Initiative Verify tooling or another C2PA reader. For PNG files, the embedded manifest appears in a `caBX` chunk and should include `c2pa.actions.v2` plus the `trainedAlgorithmicMedia` source type.

## Development

```sh
npm install
npm run build
npm run typecheck
node dist/cli.js --help
```

The package is intentionally small. Most of the heavy lifting is delegated to `@contentauth/c2pa-node`; this project focuses on shaping a clear AI-generation manifest and giving applications a stable CLI/API around it.

## License

GPL-3.0-or-later
