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

This package uses `@contentauth/c2pa-node`, which ships native bindings. Prebuilt binaries are available for common macOS, Linux, and Windows platforms. Other platforms may need a local Rust toolchain.

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
    producer: "Acme Labs",
    prompt: "A red fox in a snowy forest",
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
