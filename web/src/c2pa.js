import { createC2pa } from "@contentauth/c2pa-web";
import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";
import { signCose, getCertificateChainPem } from "./signer";
import { createAiGeneratedManifest, } from "./manifest";
let sdk = null;
async function getSDK() {
    if (sdk)
        return sdk;
    sdk = await createC2pa({
        wasmSrc,
        settings: {
            verify: { verifyTrust: false },
        },
    });
    return sdk;
}
export async function viewMedia(file) {
    const c2pa = await getSDK();
    const reader = await c2pa.reader.fromBlob(file.type, file);
    if (!reader) {
        return { hasManifest: false, manifestStore: null, summary: null };
    }
    const manifestStore = await reader.manifestStore();
    await reader.free();
    const store = manifestStore;
    if (!store?.active_manifest || !store?.manifests) {
        return { hasManifest: false, manifestStore: null, summary: null };
    }
    const active = store.manifests[store.active_manifest];
    if (!active) {
        return { hasManifest: false, manifestStore: store, summary: null };
    }
    const summary = extractSummary(active);
    return { hasManifest: true, manifestStore: store, summary };
}
export async function signMedia(file, metadata) {
    const c2pa = await getSDK();
    const mimeType = file.type || "image/png";
    const manifest = createAiGeneratedManifest({
        filename: file.name,
        mimeType,
        metadata,
    });
    const builder = await c2pa.builder.fromDefinition(manifest);
    const RESERVE = 20000;
    const signer = {
        sign: async (data, reserveSize) => {
            const cose = await signCose(data, reserveSize || RESERVE);
            const padSize = reserveSize || RESERVE;
            console.log("[sign-ai-media] COSE_Sign1 size:", cose.length, "reserveSize:", padSize);
            return cose;
        },
        reserveSize: async () => RESERVE,
        alg: "es256",
        certs: getCertificateChainPem(),
    };
    const signedBytes = await builder.sign(signer, mimeType, file);
    const outName = `signed-${file.name}`;
    const blob = new Blob([signedBytes], { type: mimeType });
    await builder.free();
    return { blob, filename: outName, manifest };
}
function extractSummary(manifest) {
    const actionAssertion = manifest.assertions?.find((a) => a.label === "c2pa.actions.v2");
    const creativeWork = manifest.assertions?.find((a) => a.label === "stds.schema-org.CreativeWork");
    const trainingMining = manifest.assertions?.find((a) => a.label === "cawg.training-mining");
    const actions = actionAssertion?.data
        ?.actions;
    const action = actions?.[0];
    const cw = (creativeWork?.data ?? {});
    const actionParameters = action?.parameters && typeof action.parameters === "object"
        ? action.parameters
        : {};
    const softwareAgent = action?.softwareAgent ??
        cw.softwareAgent ??
        firstClaimGeneratorInfo(manifest);
    const claimGenerator = getClaimGenerator(manifest);
    return {
        title: manifest.title ?? null,
        format: manifest.format ?? null,
        claimGenerator,
        generator: cw.generator ?? claimGenerator ?? null,
        model: cw.model ?? actionParameters.model ?? null,
        producer: cw.producer ?? null,
        prompt: cw.prompt ?? null,
        negativePrompt: cw.negativePrompt ?? null,
        softwareAgent,
        action: action?.action ?? null,
        digitalSourceType: action?.digitalSourceType ?? cw.digitalSourceType ?? null,
        createdAt: action?.when ?? null,
        generation: cw.generation ??
            (Object.keys(actionParameters).length > 0 ? actionParameters : null),
        trainingMining: trainingMining?.data ?? null,
        signatureIssuer: manifest.signature_info?.issuer ?? null,
        signatureTime: manifest.signature_info?.time ?? null,
        signatureAlgorithm: manifest.signature_info?.alg ?? null,
    };
}
function getClaimGenerator(manifest) {
    if (manifest.claim_generator) {
        return manifest.claim_generator;
    }
    return (manifest.claim_generator_info
        ?.map((info) => (info.version ? `${info.name}/${info.version}` : info.name))
        .filter(Boolean)
        .join(" ") || null);
}
function firstClaimGeneratorInfo(manifest) {
    const [info] = manifest.claim_generator_info ?? [];
    return info?.name ? { name: info.name, version: info.version } : null;
}
