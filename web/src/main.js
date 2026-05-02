import { viewMedia, signMedia } from "./c2pa";
import { DIGITAL_SOURCE_TYPE_PRESETS, inferMimeType } from "./manifest";
let currentMode = "sign";
let selectedFile = null;
function $(id) {
    return document.getElementById(id);
}
function init() {
    setupTabs();
    setupDropZone();
    setupSourceTypeSelect();
    setupFormSubmit();
}
function setupTabs() {
    $("tab-sign").addEventListener("click", () => switchMode("sign"));
    $("tab-view").addEventListener("click", () => switchMode("view"));
}
function switchMode(mode) {
    currentMode = mode;
    selectedFile = null;
    $("tab-sign").classList.toggle("tab-active", mode === "sign");
    $("tab-view").classList.toggle("tab-active", mode === "view");
    $("sign-form").classList.toggle("hidden", mode !== "sign");
    $("output").innerHTML = "";
    $("drop-label").textContent =
        mode === "sign"
            ? "Drop image or video to sign"
            : "Drop signed file to inspect";
    $("file-name").textContent = "";
    $("file-name").classList.add("hidden");
    $("file-input").value = "";
}
function setupDropZone() {
    const zone = $("drop-zone");
    const input = $("file-input");
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("drop-active");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drop-active"));
    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drop-active");
        const file = e.dataTransfer?.files[0];
        if (file)
            onFileSelected(file);
    });
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (file)
            onFileSelected(file);
    });
}
async function onFileSelected(file) {
    selectedFile = file;
    $("file-name").textContent = file.name;
    $("file-name").classList.remove("hidden");
    if (currentMode === "view") {
        doView(file);
    }
    else {
        await prefillFromFile(file);
    }
}
async function prefillFromFile(file) {
    clearFormFields();
    try {
        const result = await viewMedia(file);
        if (!result.hasManifest || !result.summary) {
            setField("software-agent", file.name.replace(/\.[^.]+$/, ""));
            return;
        }
        const s = result.summary;
        const agent = s.softwareAgent;
        const agentName = objectField(agent, "name") ?? stringValue(agent);
        const agentVersion = objectField(agent, "version");
        const claimGenerator = stringValue(s.claimGenerator);
        setField("software-agent", agentName ?? claimGenerator);
        setField("version", agentVersion);
        setField("generator", stringValue(s.generator) ?? claimGenerator ?? agentName);
        setField("model", stringValue(s.model) ?? agentName);
        setField("producer", s.producer);
        setField("prompt", s.prompt);
        setField("negative-prompt", s.negativePrompt);
        const gen = s.generation;
        if (gen && typeof gen === "object") {
            const g = gen;
            setField("seed", g.seed);
        }
        const dst = typeof s.digitalSourceType === "string" ? s.digitalSourceType : null;
        if (dst) {
            const preset = Object.entries(DIGITAL_SOURCE_TYPE_PRESETS).find(([, v]) => v === dst);
            if (preset) {
                $("source-type").value = preset[0];
            }
        }
    }
    catch {
        setField("software-agent", file.name.replace(/\.[^.]+$/, ""));
    }
}
function setField(id, value) {
    if (value === null || value === undefined || value === "")
        return;
    const el = $(id);
    el.value = String(value);
}
function clearFormFields() {
    for (const id of [
        "software-agent",
        "version",
        "generator",
        "model",
        "producer",
        "prompt",
        "negative-prompt",
        "seed",
    ]) {
        $(id).value = "";
    }
    $("source-type").value = "ai-generated";
}
function objectField(value, key) {
    if (!value || typeof value !== "object" || !(key in value)) {
        return null;
    }
    return stringValue(value[key]);
}
function stringValue(value) {
    if (typeof value === "string" && value.trim()) {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return null;
}
function setupSourceTypeSelect() {
    const select = $("source-type");
    for (const key of Object.keys(DIGITAL_SOURCE_TYPE_PRESETS)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key;
        if (key === "ai-generated")
            opt.selected = true;
        select.appendChild(opt);
    }
}
function setupFormSubmit() {
    $("sign-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            showError("Select a file first.");
            return;
        }
        await doSign(selectedFile);
    });
}
async function doView(file) {
    const out = $("output");
    out.innerHTML = `<div class="status-loading">Reading C2PA metadata&hellip;</div>`;
    try {
        const result = await viewMedia(file);
        if (!result.hasManifest) {
            out.innerHTML = `
        <div class="result-card">
          <h3>No C2PA manifest found</h3>
          <p class="muted">This file does not contain C2PA metadata.</p>
        </div>`;
            return;
        }
        const summary = result.summary;
        let html = `<div class="result-card"><h3>C2PA Metadata</h3><table class="meta-table">`;
        for (const [key, val] of Object.entries(summary)) {
            if (val === null || val === undefined)
                continue;
            const display = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
            html += `<tr><td class="meta-key">${formatLabel(key)}</td><td class="meta-val">${escapeHtml(display)}</td></tr>`;
        }
        html += `</table>`;
        html += `<details class="raw-details"><summary>Full manifest store (JSON)</summary><pre>${escapeHtml(JSON.stringify(result.manifestStore, null, 2))}</pre></details>`;
        html += `</div>`;
        out.innerHTML = html;
    }
    catch (err) {
        showError(err instanceof Error ? err.message : String(err));
    }
}
async function doSign(file) {
    const out = $("output");
    out.innerHTML = `<div class="status-loading">Signing&hellip; this may take a moment.</div>`;
    const get = (id) => ($(id).value || "").trim();
    const metadata = {
        softwareAgent: get("software-agent") || "sign-ai-media-web",
        version: get("version") || undefined,
        generator: get("generator") || undefined,
        model: get("model") || undefined,
        producer: get("producer") || undefined,
        prompt: get("prompt") || undefined,
        negativePrompt: get("negative-prompt") || undefined,
        digitalSourceType: DIGITAL_SOURCE_TYPE_PRESETS[get("source-type")] || undefined,
        seed: get("seed") || undefined,
    };
    if (!file.type && !inferMimeType(file.name)) {
        showError("Cannot detect MIME type. Use a file with a known extension (png, jpg, webp, mp4, etc.).");
        return;
    }
    try {
        const result = await signMedia(file, metadata);
        const url = URL.createObjectURL(result.blob);
        const isImage = result.blob.type.startsWith("image/");
        let html = `<div class="result-card"><h3>Signed successfully</h3>`;
        if (isImage) {
            html += `<img src="${url}" alt="Signed media" class="preview-img" />`;
        }
        html += `<a href="${url}" download="${escapeHtml(result.filename)}" class="download-btn">Download ${escapeHtml(result.filename)}</a>`;
        html += `<details class="raw-details"><summary>Manifest definition (JSON)</summary><pre>${escapeHtml(JSON.stringify(result.manifest, null, 2))}</pre></details>`;
        html += `</div>`;
        out.innerHTML = html;
    }
    catch (err) {
        showError(err instanceof Error ? err.message : String(err));
    }
}
function showError(msg) {
    $("output").innerHTML = `<div class="error-card">${escapeHtml(msg)}</div>`;
}
function formatLabel(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}
function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
}
document.addEventListener("DOMContentLoaded", init);
