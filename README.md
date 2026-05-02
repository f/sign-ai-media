# sign-ai-media

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

This package uses `c2pa-node`, which ships native bindings. Prebuilt binaries are available for common macOS, Linux, and Windows platforms. Other platforms may need a local Rust toolchain.

## CLI Usage

```sh
sign-ai-media input.png output.png \
  --software-agent "acme-image-model" \
  --version "1.0.0" \
  --generator "Acme Image API" \
  --model "acme-diffusion-v1" \
  --producer "Acme Labs"
```

For production provenance, pass your own signing credentials:

```sh
sign-ai-media input.png output.png \
  --software-agent "acme-image-model" \
  --certificate ./certs/signing-cert.pem \
  --private-key ./certs/signing-key.pem \
  --algorithm es256 \
  --tsa-url "https://timestamp.example.com"
```

Useful metadata options:

```sh
--claim-generator "acme-image-service/1.0.0"
--prompt "A red fox in a snowy forest"
--created-at "2026-05-02T09:00:00Z"
--digital-source-type "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
--creative-work-json '{"usageInfo":"internal","copyrightNotice":"Acme Labs"}'
--mime-type image/png
--remote-manifest-url "https://cdn.example.com/manifests/image.c2pa"
--no-embed
```

## TypeScript API

```ts
import { signAiGeneratedMedia } from "sign-ai-media";

await signAiGeneratedMedia({
  input: "input.png",
  output: "output.png",
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
- `producer`: organization, service, or creator responsible for the output.
- `prompt`: prompt text to embed. Treat this as public metadata.
- `createdAt`: ISO timestamp. Defaults to the current time.
- `digitalSourceType`: override the IPTC source type URL.
- `creativeWork`: extra properties merged into the schema.org CreativeWork assertion.

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

C2PA manifests need a signer, but this package does not require users to bring a certificate/private-key pair just to get started. If no signer is provided, `signAiGeneratedMedia()` and the CLI use `c2pa-node`'s bundled test signer.

For production provenance, pass a local certificate/private-key pair through `createLocalSigner()` or another compatible `c2pa-node` signer object. Do not use another company's name, certificate, or identity fields. Test credentials should not be used for production provenance.

## Verifying Output

After signing, inspect the output with a C2PA-compatible verifier such as the Content Authenticity Initiative Verify tooling or another C2PA reader. For PNG files, the embedded manifest appears in a `caBX` chunk and should include `c2pa.actions.v2` plus the `trainedAlgorithmicMedia` source type.

## Development

```sh
npm install
npm run build
npm run typecheck
node dist/cli.js --help
```

The package is intentionally small. Most of the heavy lifting is delegated to `c2pa-node`; this project focuses on shaping a clear AI-generation manifest and giving applications a stable CLI/API around it.

## License

ISC
