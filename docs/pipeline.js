// Config
// Hosted ONNX artifacts. cardnames_onnx.json is the ViT-index-keyed variant
// built by export_models.py; the card_id-keyed one lives on the model repo.
const BUCKET = "https://huggingface.co/buckets/Aminoquiz/draw2-bucket/resolve/onnx_models";
const NAMES_URL           = `${BUCKET}/cardnames_onnx.json?download=true`;
const YOLO_URL            = `${BUCKET}/ygo_yolo.onnx?download=true`;
const VIT_FP32_URL        = `${BUCKET}/vit_fp32.onnx?download=true`;
const VIT_FP16_URL        = `${BUCKET}/vit_fp16.onnx?download=true`;
const VIT_YUGISCAN_URL    = `${BUCKET}/vit_yugiscan_int8.onnx?download=true`;
const YUGISCAN_LABELS_URL = `${BUCKET}/card_labels_yugiscan.json?download=true`;
const CROP_SIZE  = 224;
const CONF_THRESH = 0.20;
const VIT_TOPK   = 3;

// ViT normalization
const MEAN = [0.5, 0.5, 0.5];
const STD  = [0.5, 0.5, 0.5];

// State
let yoloSession = null;
let vitSession  = null;
let cardnames   = {};
let cardId2Names = {}; // card_id -> {EN,FR,JA,...}, for Small's plain-string labels
let modelsReady = false;
let currentStream = null;
let cancelRequested = false;
let currentPrecision = null; // "fp32", "fp16", or "yugiscan"

// Debug Console
let dbgErrorCount = 0;

function dbgAppend(level, ...args) {
    const logEl = document.getElementById("dbg-log");
    if (!logEl) return;
    const text = args.map(a =>
        typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)
    ).join(" ");
    const ts = new Date().toLocaleTimeString("fr-FR", { hour12: false });
    const el = document.createElement("div");
    el.className = `dbg-entry ${level}`;
    const tsSpan = document.createElement("span");
    tsSpan.className = "dbg-ts";
    tsSpan.textContent = ts;
    const msgNode = document.createTextNode(" " + text);
    el.appendChild(tsSpan);
    el.appendChild(msgNode);
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
    if (level === "err") {
        dbgErrorCount++;
        const toggle = document.getElementById("dbg-toggle");
        const label  = document.getElementById("dbg-label");
        const body   = document.getElementById("dbg-body");
        if (toggle) toggle.classList.add("has-error");
        if (label)  label.textContent = `Debug log (${dbgErrorCount} error${dbgErrorCount > 1 ? "s" : ""})`;
        if (body)   body.hidden = false; // auto-open on first error
    }
}

function dbgProgress(id, label, current, total, width = 20) {
    const logEl = document.getElementById("dbg-log");
    if (!logEl) return;
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const filled = Math.round((pct / 100) * width);
    const bar = "#".repeat(filled) + "-".repeat(width - filled);
    const text = `${label} [${bar}] ${pct}% (${current}/${total})`;
    const elId = `dbg-progress-${id}`;
    let el = document.getElementById(elId);
    if (!el) {
        el = document.createElement("div");
        el.id = elId;
        el.className = "dbg-entry log";
        const tsSpan = document.createElement("span");
        tsSpan.className = "dbg-ts";
        tsSpan.textContent = new Date().toLocaleTimeString("fr-FR", { hour12: false });
        el.appendChild(tsSpan);
        el.appendChild(document.createTextNode(""));
        logEl.appendChild(el);
    }
    el.lastChild.textContent = " " + text;
    logEl.scrollTop = logEl.scrollHeight;
}

function dbgProgressDone(id) {
    const el = document.getElementById(`dbg-progress-${id}`);
    if (el) el.removeAttribute("id");
}

// Proxy console
const _log  = console.log.bind(console);
const _warn = console.warn.bind(console);
const _err  = console.error.bind(console);
console.log   = (...a) => { _log(...a);  dbgAppend("log",  ...a); };
console.warn  = (...a) => { 
    _warn(...a); 
    const str = a.map(String).join(" ").toLowerCase();
    if (str.includes("onnx") || str.includes("ort") || str.includes("webgpu") || str.includes("wasm")) return;
    dbgAppend("warn", ...a); 
};
console.error = (...a) => { _err(...a);  dbgAppend("err",  ...a); };

window.addEventListener("unhandledrejection", e => {
    console.error("Unhandled:", String(e.reason));
});

// Verbosity (low = milestones only, high = per-step timings)
let verbosity = localStorage.getItem("draw2_verbosity") || "low";
function isVerbose() { return verbosity === "high"; }
const dbg = (...a) => { if (isVerbose()) console.log(...a); };
const status = (...a) => console.log(...a);

function injectVerbosityToggle() {
    const logEl = $("dbg-log");
    const header = logEl && logEl.previousElementSibling;
    if (!header || $("verbosity-toggle")) return;

    const wrap = document.createElement("div");
    wrap.id = "verbosity-toggle";
    wrap.style.cssText = "display:flex;align-items:center;gap:6px;font-family:monospace;font-size:10px;margin-left:12px;";
    wrap.innerHTML = `
        <span style="opacity:.5;">verbosity</span>
        <button id="verbosity-low"  type="button" style="padding:2px 8px;border-radius:999px;border:1px solid rgba(160,160,160,.35);cursor:pointer;background:transparent;color:inherit;">low</button>
        <button id="verbosity-high" type="button" style="padding:2px 8px;border-radius:999px;border:1px solid rgba(160,160,160,.35);cursor:pointer;background:transparent;color:inherit;">high</button>
    `;
    header.appendChild(wrap);

    const lowBtn = $("verbosity-low"), highBtn = $("verbosity-high");
    const refresh = () => {
        if (lowBtn)  { lowBtn.style.background  = verbosity === "low"  ? "#10b981" : "transparent"; lowBtn.style.color  = verbosity === "low"  ? "#000" : "inherit"; }
        if (highBtn) { highBtn.style.background = verbosity === "high" ? "#10b981" : "transparent"; highBtn.style.color = verbosity === "high" ? "#000" : "inherit"; }
    };
    lowBtn?.addEventListener("click", () => { verbosity = "low"; localStorage.setItem("draw2_verbosity", "low"); refresh(); });
    highBtn?.addEventListener("click", () => { verbosity = "high"; localStorage.setItem("draw2_verbosity", "high"); refresh(); });
    refresh();
}

// Load Panel
const $ = id => document.getElementById(id);

const T = (key, vars) => (window.t ? window.t(key, vars) : key);

// Small's labels are plain strings; cross-reference cardId2Names for those.
function localizedName(entry) {
    const lang = (window.getLang?.() || "en").toUpperCase();
    return entry[lang] || entry.EN;
}
function cardNameFor(entry, index) {
    if (typeof entry === "string") {
        const cardId = entry.match(/-(\d+)$/)?.[1];
        const localized = cardId && cardId2Names[cardId];
        if (localized) return localizedName(localized);
        return entry.replace(/-\d+$/, "").replace(/-/g, " ");
    }
    if (!entry) return String(index);
    return localizedName(entry) || String(index);
}

function setLoadStatus(text, pct, hint = "") {
    const bar = $("lp-bar");
    if (bar) bar.style.width = pct + "%";

    const label = $("btn-load-label");
    if (label) label.textContent = hint ? `${text} (${hint})` : `${text} - ${Math.round(pct)}%`;

    const s = $("lp-status"), p = $("lp-pct"), h = $("lp-hint");
    if (s) s.textContent = text;
    if (p) p.textContent = Math.round(pct) + "%";
    if (h) h.textContent = hint;
}

async function fetchWithProgress(url, label, fromPct, toPct, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}  ${url}`);
    const total = parseInt(res.headers.get("Content-Length") || "0", 10);
    const reader = res.body.getReader();
    let received = 0;
    const chunks = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) {
            const frac = received / total;
            const pct  = fromPct + frac * (toPct - fromPct);
            const recMB  = (received / 1e6).toFixed(1);
            const totMB  = (total    / 1e6).toFixed(1);
            setLoadStatus(label, pct, `${recMB} / ${totMB} MB`);
        }
    }
    const all = new Uint8Array(received);
    let pos = 0;
    for (const c of chunks) { all.set(c, pos); pos += c.length; }
    return all.buffer;
}

let loadAbortController = null;

async function init() {
    const btn = $("btn-load");
    const label = $("btn-load-label");
    const precision = document.querySelector('input[name="model"]:checked')?.value || "fp32";
    
    let vitUrl = VIT_YUGISCAN_URL;
    let namesUrl = YUGISCAN_LABELS_URL;
    if (precision === "fp16") {
        vitUrl = VIT_FP16_URL;
        namesUrl = NAMES_URL;
    } else if (precision === "fp32") {
        vitUrl = VIT_FP32_URL;
        namesUrl = NAMES_URL;
    }

    loadAbortController = new AbortController();
    const signal = loadAbortController.signal;

    if (btn && !label) btn.textContent = T("runtime.loading");
    $("load-progress")?.removeAttribute("hidden");

    try {
        ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
        ort.env.logLevel = "error";
        ort.env.wasm.proxy = true; // Run WASM in a dedicated Web Worker

        setLoadStatus(T("runtime.dl_yolo"), 0, "");
        const yoloBuf = await fetchWithProgress(
            YOLO_URL, T("runtime.dl_yolo"), 0, 30, signal
        );
        setLoadStatus(T("runtime.compiling_yolo"), 30, "");
        yoloSession = await ort.InferenceSession.create(yoloBuf, {
            executionProviders: ["webgpu", "wasm"],
            logSeverityLevel: 3
        });

        const vitSize = precision === "fp32" ? "386 MB" : precision === "fp16" ? "193 MB" : "40 MB";
        setLoadStatus(T("runtime.dl_vit", { size: vitSize }), 32, "");
        const vitBuf = await fetchWithProgress(
            vitUrl, T("runtime.dl_vit", { size: vitSize }), 32, 92, signal
        );
        setLoadStatus(T("runtime.compiling_vit"), 92, "");
        
        // Quantized INT8 graphs run on WASM to avoid WebGPU INT8 quantization issues
        const vitProviders = (precision === "fp32" || precision === "fp16") ? ["webgpu", "wasm"] : ["wasm"];
        vitSession = await ort.InferenceSession.create(vitBuf, {
            executionProviders: vitProviders,
            logSeverityLevel: 3
        });

        const labelsBuf = await fetchWithProgress(namesUrl, "Downloading card DB", 92, 100, signal);
        cardnames = JSON.parse(new TextDecoder().decode(labelsBuf));

        if (precision === "yugiscan" && Object.keys(cardId2Names).length === 0) {
            const namesBuf = await fetch(NAMES_URL, { signal }).then(r => r.arrayBuffer());
            const localized = JSON.parse(new TextDecoder().decode(namesBuf));
            for (const entry of Object.values(localized)) {
                if (entry?.card_id) cardId2Names[entry.card_id] = entry;
            }
        }

        setLoadStatus(T("runtime.warming_up"), 98, "");
        // WebGPU compiles shader pipelines on first real use, not at session
        // creation. Paying that cost here (dummy zero tensors) keeps it off
        // the first live-detection frames.
        await yoloSession.run({ [yoloSession.inputNames[0]]: new ort.Tensor("float32", new Float32Array(3 * YOLO_SIZE * YOLO_SIZE), [1, 3, YOLO_SIZE, YOLO_SIZE]) });
        await vitSession.run({ [vitSession.inputNames[0]]: new ort.Tensor("float32", new Float32Array(3 * CROP_SIZE * CROP_SIZE), [1, 3, CROP_SIZE, CROP_SIZE]) });

        setLoadStatus(T("runtime.ready"), 100, "");
        await new Promise(r => setTimeout(r, 600));

        if (btn) btn.disabled = true;
        if (label) label.textContent = T("runtime.engine_ready");
        else if (btn) btn.textContent = T("runtime.engine_ready");
        $("lp-bar")?.style.setProperty("width", "100%");
        $("load-progress")?.setAttribute("hidden", "");

        currentPrecision = precision;
        modelsReady = true;
        enableInputs();

        const precisionLabel = { yugiscan: "Small", fp16: "Medium", fp32: "Max" }[precision] || precision;
        status(T("runtime.model_downloaded", { model: precisionLabel }));

    } catch (err) {
        $("lp-bar")?.style.setProperty("width", "0%");
        if (err.name === "AbortError") {
            if (btn) btn.disabled = false;
            if (label) label.textContent = T("demo.btn_download");
            return;
        }
        if (label) label.textContent = T("runtime.retry");
        if (btn) btn.disabled = false;
        console.error(err);
    } finally {
        loadAbortController = null;
    }
}

function enableInputs() {
    $("dz-browse").disabled = false;
    $("btn-webcam").disabled = false;
    const dz = $("dropzone");
    dz.removeAttribute("data-disabled");
    dz.setAttribute("tabindex", "0");
    $("dropzone-lock")?.setAttribute("hidden", "");
    document.querySelectorAll(".sample-btn").forEach(b => b.disabled = false);

    // Small (WASM) stutters too badly for live mode; Medium/Max run on WebGPU.
    const btnLive = $("btn-live");
    if (btnLive) {
        const liveOk = currentPrecision === "fp32" || currentPrecision === "fp16";
        btnLive.disabled = !liveOk;
        btnLive.title = liveOk ? "" : "Live detection needs the Medium or Max model for smooth results";
    }
}

function setRunLabel(text) {
    const l = $("running-label");
    if (l) l.textContent = text;
}

function createSteps(labels) {
    const stepsEl = $("inference-steps");
    if (!stepsEl) return [];
    stepsEl.innerHTML = "";
    return labels.map(text => {
        const el = document.createElement("div");
        el.className = "inference-step";
        el.innerHTML = `<span class="step-icon"></span><span>${text}</span>`;
        stepsEl.appendChild(el);
        return el;
    });
}

function stepDone(el) {
    if (!el) return;
    el.className = "inference-step done";
    el.querySelector(".step-icon").textContent = "";
}
function stepActive(el) {
    if (!el) return;
    el.className = "inference-step active";
    el.querySelector(".step-icon").textContent = "";
}

function solveHomography(src, dst) {
    const A = [];
    for (let i = 0; i < 4; i++) {
        const sx = src[i].x, sy = src[i].y;
        const dx = dst[i].x, dy = dst[i].y;
        A.push([-sx, -sy, -1, 0, 0, 0, dx*sx, dx*sy, dx]);
        A.push([0, 0, 0, -sx, -sy, -1, dy*sx, dy*sy, dy]);
    }
    return solveH8x8(A);
}

function solveH8x8(A) {
    const B = A.map(row => row.slice(0, 8));
    const b = A.map(row => -row[8]);
    const h = gaussSolve(B, b);
    if (!h) return null;
    return [[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1.0]];
}

function gaussSolve(A, b) {
    const n = 8;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let maxRow = col, maxVal = Math.abs(M[col][col]);
        for (let row = col+1; row < n; row++) {
            if (Math.abs(M[row][col]) > maxVal) { maxVal = Math.abs(M[row][col]); maxRow = row; }
        }
        [M[col], M[maxRow]] = [M[maxRow], M[col]];
        if (Math.abs(M[col][col]) < 1e-12) return null;
        const inv = 1 / M[col][col];
        for (let j = col; j <= n; j++) M[col][j] *= inv;
        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const f = M[row][col];
            for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
        }
    }
    return M.map(row => row[n]);
}

function applyH(Hinv, dx, dy) {
    const [a,b,c] = Hinv[0], [d,e,f] = Hinv[1], [g,h,i] = Hinv[2];
    const w = g*dx + h*dy + i;
    return { x: (a*dx + b*dy + c) / w, y: (d*dx + e*dy + f) / w };
}

function invertH(H) {
    const [[a,b,c],[d,e,f],[g,h,i]] = H;
    const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
    if (Math.abs(det) < 1e-12) return null;
    const v = 1/det;
    return [
        [(e*i-f*h)*v, (c*h-b*i)*v, (b*f-c*e)*v],
        [(f*g-d*i)*v, (a*i-c*g)*v, (c*d-a*f)*v],
        [(d*h-e*g)*v, (b*g-a*h)*v, (a*e-b*d)*v]
    ];
}

function warpPerspective(srcImageData, srcPts, outW, outH) {
    const dstPts = [
        {x:0,   y:0  }, {x:outW, y:0  },
        {x:outW, y:outH}, {x:0,   y:outH},
    ];
    const H = solveHomography(srcPts, dstPts);
    if (!H) return null;
    const Hinv = invertH(H);
    if (!Hinv) return null;

    const srcW = srcImageData.width, srcH = srcImageData.height;
    const src = srcImageData.data;
    const out = new Uint8ClampedArray(outW * outH * 4);

    for (let dy = 0; dy < outH; dy++) {
        for (let dx = 0; dx < outW; dx++) {
            const { x: sx, y: sy } = applyH(Hinv, dx+.5, dy+.5);
            const x0 = Math.floor(sx), y0 = Math.floor(sy);
            const x1 = x0+1, y1 = y0+1;
            const fx = sx-x0, fy = sy-y0;
            const oi = (dy*outW + dx) * 4;
            if (x0 < 0 || y0 < 0 || x1 >= srcW || y1 >= srcH) {
                out[oi+3] = 255; continue;
            }
            const i00=(y0*srcW+x0)*4, i10=(y0*srcW+x1)*4;
            const i01=(y1*srcW+x0)*4, i11=(y1*srcW+x1)*4;
            for (let c = 0; c < 3; c++) {
                out[oi+c] = Math.round(
                    src[i00+c]*(1-fx)*(1-fy) + src[i10+c]*fx*(1-fy) +
                    src[i01+c]*(1-fx)*fy     + src[i11+c]*fx*fy
                );
            }
            out[oi+3] = 255;
        }
    }
    return new ImageData(out, outW, outH);
}

const YOLO_SIZE = 640;

function preprocessYOLO(imageData) {
    const { width: srcW, height: srcH } = imageData;
    const scale = Math.min(YOLO_SIZE/srcW, YOLO_SIZE/srcH);
    const newW = Math.round(srcW*scale), newH = Math.round(srcH*scale);
    const padX = Math.floor((YOLO_SIZE-newW)/2);
    const padY = Math.floor((YOLO_SIZE-newH)/2);

    const offscreen = new OffscreenCanvas(YOLO_SIZE, YOLO_SIZE);
    const ctx = offscreen.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, YOLO_SIZE, YOLO_SIZE);

    const small = new OffscreenCanvas(newW, newH);
    const sCtx = small.getContext("2d");
    const bmp = imageDataToBitmap(imageData);
    sCtx.drawImage(bmp, 0, 0, newW, newH);
    ctx.drawImage(small, padX, padY);
    bmp.close();

    const ld = ctx.getImageData(0, 0, YOLO_SIZE, YOLO_SIZE).data;
    const tensor = new Float32Array(3 * YOLO_SIZE * YOLO_SIZE);
    const area = YOLO_SIZE * YOLO_SIZE;
    for (let i = 0; i < area; i++) {
        tensor[i]        = ld[i*4]   / 255;
        tensor[area+i]   = ld[i*4+1] / 255;
        tensor[area*2+i] = ld[i*4+2] / 255;
    }
    return { tensor, scale, padX, padY };
}

function imageDataToBitmap(imageData) {
    const c = new OffscreenCanvas(imageData.width, imageData.height);
    c.getContext("2d").putImageData(imageData, 0, 0);
    return c.transferToImageBitmap();
}

function parseYOLOOutput(output, scale, padX, padY) {
    const data  = output.data;
    const shape = output.dims;
    const featsFirst = shape[1] < shape[2];
    const rows = featsFirst ? shape[2] : shape[1];
    const cols = featsFirst ? shape[1] : shape[2];
    const detections = [];

    for (let i = 0; i < rows; i++) {
        let xc, yc, w, h, angle, conf;
        if (featsFirst) {
            xc=data[0*rows+i]; yc=data[1*rows+i]; w=data[2*rows+i];
            h=data[3*rows+i]; conf=data[4*rows+i]; angle=data[5*rows+i];
        } else {
            xc=data[i*cols+0]; yc=data[i*cols+1]; w=data[i*cols+2];
            h=data[i*cols+3]; conf=data[i*cols+4]; angle=data[i*cols+5];
        }
        if (conf < CONF_THRESH) continue;
        const x  = (xc - padX) / scale;
        const y  = (yc - padY) / scale;
        const bw = w / scale, bh = h / scale;
        const pts = xywhrToCorners(x, y, bw, bh, angle);
        detections.push({ pts, conf, w: bw, h: bh });
    }
    return nmsOBB(detections);
}

function xywhrToCorners(cx, cy, w, h, angle) {
    const cos=Math.cos(angle), sin=Math.sin(angle);
    const hw=w/2, hh=h/2;
    return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([dx,dy]) => ({
        x: cx + dx*cos - dy*sin,
        y: cy + dx*sin + dy*cos
    }));
}

function nmsOBB(dets, thresh=0.5) {
    dets.sort((a,b) => b.conf - a.conf);
    const keep=[], sup=new Set();
    for (let i=0; i<dets.length; i++) {
        if (sup.has(i)) continue;
        keep.push(dets[i]);
        for (let j=i+1; j<dets.length; j++) {
            if (iouApprox(dets[i].pts, dets[j].pts) > thresh) sup.add(j);
        }
    }
    return keep;
}

function iouApprox(a, b) {
    const ax=[Math.min(...a.map(p=>p.x)),Math.max(...a.map(p=>p.x))];
    const ay=[Math.min(...a.map(p=>p.y)),Math.max(...a.map(p=>p.y))];
    const bx=[Math.min(...b.map(p=>p.x)),Math.max(...b.map(p=>p.x))];
    const by=[Math.min(...b.map(p=>p.y)),Math.max(...b.map(p=>p.y))];
    const ix=Math.max(0,Math.min(ax[1],bx[1])-Math.max(ax[0],bx[0]));
    const iy=Math.max(0,Math.min(ay[1],by[1])-Math.max(ay[0],by[0]));
    const inter=ix*iy;
    const aA=(ax[1]-ax[0])*(ay[1]-ay[0]);
    const bA=(bx[1]-bx[0])*(by[1]-by[0]);
    return inter / (aA + bA - inter + 1e-8);
}

function preprocessViT(imageData) {
    const src=imageData.data, area=CROP_SIZE*CROP_SIZE;
    const tensor=new Float32Array(3*area);
    for (let i=0; i<area; i++) {
        tensor[i]        = (src[i*4]   /255 - MEAN[0]) / STD[0];
        tensor[area+i]   = (src[i*4+1] /255 - MEAN[1]) / STD[1];
        tensor[area*2+i] = (src[i*4+2] /255 - MEAN[2]) / STD[2];
    }
    return tensor;
}

function softmax(arr) {
    const max=Math.max(...arr);
    const ex=arr.map(x=>Math.exp(x-max));
    const s=ex.reduce((a,b)=>a+b,0);
    return ex.map(x=>x/s);
}

function topK(logits, k) {
    let maxVal = -Infinity;
    for (let i = 0; i < logits.length; i++) if (logits[i] > maxVal) maxVal = logits[i];
    
    let probs;
    if (maxVal <= 1.0) {
        probs = Array.from(logits);
    } else {
        probs = softmax(Array.from(logits));
    }
    
    return probs.map((p,i)=>({i,p})).sort((a,b)=>b.p-a.p).slice(0,k);
}

function correctRotation(imageData) {
    const w = CROP_SIZE, h = CROP_SIZE, data = imageData.data;
    const margin = Math.round(w * 0.15); 
    let topL = 0, botL = 0, leftL = 0, rightL = 0;
    
    // Top & Bottom
    for (let y = 0; y < margin; y++) {
        for (let x = margin; x < w - margin; x++) {
            const i1 = (y * w + x) * 4;
            topL += 0.299 * data[i1] + 0.587 * data[i1+1] + 0.114 * data[i1+2];
            const i2 = ((h - 1 - y) * w + x) * 4;
            botL += 0.299 * data[i2] + 0.587 * data[i2+1] + 0.114 * data[i2+2];
        }
    }
    // Left & Right
    for (let y = margin; y < h - margin; y++) {
        for (let x = 0; x < margin; x++) {
            const i1 = (y * w + x) * 4;
            leftL += 0.299 * data[i1] + 0.587 * data[i1+1] + 0.114 * data[i1+2];
            const i2 = (y * w + (w - 1 - x)) * 4;
            rightL += 0.299 * data[i2] + 0.587 * data[i2+1] + 0.114 * data[i2+2];
        }
    }
    
    const max = Math.max(topL, botL, leftL, rightL);
    if (max === botL) return 0;
    if (max === topL) return 180;
    if (max === leftL) return 270;
    return 90;
}

// Rotation fallback: try other 3 orientations if top-1 confidence is suspiciously low
const ROTATION_FALLBACK_CONFIDENCE = 0.15;
const ALL_ROTATIONS = [0, 90, 180, 270];

async function classifyCrop(imageData) {
    const vitTensor = preprocessViT(imageData);
    const vitInput  = new ort.Tensor("float32", vitTensor, [1,3,CROP_SIZE,CROP_SIZE]);
    const vitOut    = await vitSession.run({ [vitSession.inputNames[0]]: vitInput });
    const logits    = vitOut[vitSession.outputNames[0]].data;
    const top = topK(logits, VIT_TOPK);
    return { top, confidence: top[0]?.p ?? 0 };
}

async function classifyWithRotationFallback(crop) {
    const guess = correctRotation(crop);
    let bestRot = guess;
    let bestCorrected = rotateImageData(crop, guess);
    let best = await classifyCrop(bestCorrected);

    if (best.confidence < ROTATION_FALLBACK_CONFIDENCE) {
        dbg(`  low confidence (${(best.confidence*100).toFixed(1)}%) at rot=${guess}, trying other rotations`);
        for (const rot of ALL_ROTATIONS) {
            if (rot === guess) continue;
            const corrected = rotateImageData(crop, rot);
            const result = await classifyCrop(corrected);
            dbg(`    rot=${rot}: ${(result.confidence*100).toFixed(1)}%`);
            if (result.confidence > best.confidence) {
                bestRot = rot; bestCorrected = corrected; best = result;
            }
        }
    }
    return { rotation: bestRot, corrected: bestCorrected, top: best.top };
}

function rotateImageData(imageData, degrees) {
    if (degrees===0) return imageData;
    const w=imageData.width, h=imageData.height;
    const c=new OffscreenCanvas(w,h);
    const ctx=c.getContext("2d");
    const bmp=imageDataToBitmap(imageData);
    ctx.translate(w/2,h/2);
    ctx.rotate(degrees*Math.PI/180);
    ctx.drawImage(bmp,-w/2,-h/2);
    bmp.close();
    return ctx.getImageData(0,0,w,h);
}

// Drawing & UI
function drawDetections(ctx, refWidth, detections, predictions) {
    detections.forEach(({pts},idx) => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x,pts[0].y);
        for (let i=1;i<4;i++) ctx.lineTo(pts[i].x,pts[i].y);
        ctx.closePath();
        ctx.strokeStyle="#c8a95e";
        ctx.lineWidth=Math.max(2,refWidth/400);
        ctx.stroke();

        if (predictions[idx]?.[0]) {
            const name=predictions[idx][0].name||"";
            const topX=Math.min(...pts.map(p=>p.x));
            const topY=Math.min(...pts.map(p=>p.y));
            const fs=Math.max(12,refWidth/60);
            ctx.font=`bold ${fs}px Inter,sans-serif`;
            const tw=ctx.measureText(name).width;
            ctx.fillStyle="rgba(0,0,0,.65)";
            ctx.fillRect(topX-2,topY-fs-4,tw+8,fs+6);
            ctx.fillStyle="#c8a95e";
            ctx.fillText(name,topX+2,topY-4);
        }
    });
}

function drawOverlay(canvas, srcImage, detections, predictions) {
    canvas.width=srcImage.width; canvas.height=srcImage.height;
    const ctx=canvas.getContext("2d");
    const bmp=imageDataToBitmap(srcImage);
    ctx.drawImage(bmp,0,0);
    bmp.close();
    drawDetections(ctx, srcImage.width, detections, predictions);
}

// Letterboxes the rendered result to match the result card's actual content
// box aspect ratio (not just its aspect-video CSS ratio: padding shifts the
// two slightly apart) with black bars, so a square/portrait source image
// never leaves uneven empty gutters around the canvas content, which would
// throw off the BorderTrail loading animation.
function getResultAspect() {
    const wrap = document.getElementById("canvas-wrap");
    if (wrap) {
        const cs = getComputedStyle(wrap);
        const w = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const h = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        if (w > 0 && h > 0) return w / h;
    }
    return 16 / 9;
}
function drawOverlayLetterboxed(canvas, srcImage, detections, predictions) {
    const targetAspect = getResultAspect();
    const srcAspect = srcImage.width / srcImage.height;
    const canvasW = srcAspect > targetAspect ? srcImage.width : Math.round(srcImage.height * targetAspect);
    const canvasH = srcAspect > targetAspect ? Math.round(srcImage.width / targetAspect) : srcImage.height;
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasW, canvasH);

    const offsetX = Math.round((canvasW - srcImage.width) / 2);
    const offsetY = Math.round((canvasH - srcImage.height) / 2);
    const bmp = imageDataToBitmap(srcImage);
    ctx.drawImage(bmp, offsetX, offsetY);
    bmp.close();

    ctx.save();
    ctx.translate(offsetX, offsetY);
    drawDetections(ctx, srcImage.width, detections, predictions);
    ctx.restore();
}

//  RESULT CARDS 
function renderResultCards(grid, croppedImages, predictions) {
    grid.innerHTML="";
    croppedImages.forEach((cropData,idx) => {
        if (!cropData) return;
        const top=predictions[idx]?.[0];
        const name=top?.name||top?.label||"Unknown";
        const score=top ? (top.p*100).toFixed(1)+"%" : "";

        const item=document.createElement("div");
        item.className="flex bg-white border border-zinc-200 rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow group";

        const cc=document.createElement("canvas");
        cc.width=CROP_SIZE; cc.height=CROP_SIZE; cc.className="w-24 h-24 object-contain bg-zinc-900 shrink-0 border-r border-zinc-200";
        cc.getContext("2d").putImageData(cropData,0,0);

        const meta=document.createElement("div"); meta.className="p-3 flex-1 min-w-0 flex flex-col justify-center";
        const nameEl=document.createElement("div"); nameEl.className="font-display font-bold text-zinc-900 truncate mb-1";
        nameEl.textContent=name; nameEl.title=name;
        const scoreEl=document.createElement("div"); scoreEl.className="font-mono text-emerald-600 text-sm font-semibold";
        scoreEl.textContent=score;

        meta.appendChild(nameEl); meta.appendChild(scoreEl);
        item.appendChild(cc); item.appendChild(meta);
        grid.appendChild(item);
    });
}

async function detectAndClassify(imageData, { showSteps = true, onDetections, onCard } = {}) {
    const stepsEl = showSteps ? $("inference-steps") : null;
    if (stepsEl) stepsEl.innerHTML = "";

    if (cancelRequested) throw new Error("Cancelled by user");

    setRunLabel("Detecting cards......");
    const steps = showSteps ? createSteps(["YOLO - object detection", "Warping card crops"]) : [];
    if (showSteps) { stepActive(steps[0]); await nextFrame(); }

    dbg(`Image: ${imageData.width}${imageData.height}`);
    if (cancelRequested) throw new Error("Cancelled by user");

    const { tensor: yoloTensor, scale, padX, padY } = preprocessYOLO(imageData);
    dbg(`YOLO preprocess done  scale=${scale.toFixed(3)} padX=${padX} padY=${padY}`);

    const yoloInput = new ort.Tensor("float32", yoloTensor, [1,3,YOLO_SIZE,YOLO_SIZE]);
    dbg("Running YOLO inference......");
    const yoloOut   = await yoloSession.run({ [yoloSession.inputNames[0]]: yoloInput });
    const rawOut    = yoloOut[yoloSession.outputNames[0]];
    dbg(`YOLO output shape: [${rawOut.dims.join(", ")}]`);

    const detections = parseYOLOOutput(rawOut, scale, padX, padY);
    dbg(`Detections after NMS: ${detections.length} (conf${CONF_THRESH})`);
    onDetections?.(detections);

    if (showSteps) stepDone(steps[0]);
    if (cancelRequested) throw new Error("Cancelled by user");

    if (detections.length === 0) {
        return { detections: [], allPredictions: [], croppedImages: [] };
    }

    setRunLabel(`Classifying card${detections.length>1?"s":""}...`);
    if (showSteps) stepActive(steps[1]);
    const vitSteps = detections.map((_, i) => {
        if (!showSteps) return null;
        const el = document.createElement("div");
        el.className = "inference-step";
        el.innerHTML = `<span class="step-icon"></span><span>ViT - card ${i+1}/${detections.length}</span>`;
        if (stepsEl) stepsEl.appendChild(el);
        return el;
    });
    if (showSteps) stepDone(steps[1]);

    const croppedImages = [];
    const allPredictions = [];

    for (let idx = 0; idx < detections.length; idx++) {
        if (cancelRequested) {
            dbg("Pipeline cancelled during ViT loop.");
            throw new Error("Cancelled by user");
        }
        const det = detections[idx];
        if (showSteps) stepActive(vitSteps[idx]);
        await nextFrame(); // yield before each card's ViT call so a busy scene doesn't freeze rendering

        dbg(`Card ${idx+1}: warping perspective`);
        const t0 = performance.now();
        const crop = warpPerspective(imageData, det.pts, CROP_SIZE, CROP_SIZE);
        dbg(`  warpPerspective done in ${(performance.now()-t0).toFixed(0)}ms`);

        if (!crop) {
            console.warn(`  Card ${idx+1}: warpPerspective returned null (degenerate homography?)`);
            if (showSteps) stepDone(vitSteps[idx]);
            croppedImages.push(null);
            allPredictions.push([]);
            continue;
        }

        dbg(`  Running ViT......`);
        const t1 = performance.now();
        const { rotation, corrected, top } = await classifyWithRotationFallback(crop);
        dbg(`  rotation correction: ${rotation}`);
        dbg(`  ViT done in ${(performance.now()-t1).toFixed(0)}ms`);
        croppedImages.push(corrected);

        const topPreds  = top.map(({i,p}) => ({ name: cardNameFor(cardnames[String(i)], i), p, i }));
        dbg(`  Top-1: "${topPreds[0]?.name}" (${(topPreds[0]?.p*100).toFixed(1)}%)`);
        onCard?.(idx, detections.length, topPreds);
        allPredictions.push(topPreds);
        if (showSteps) stepDone(vitSteps[idx]);
    }

    return { detections, allPredictions, croppedImages };
}

// Main Pipeline
async function runPipeline(imageData) {
    if (cancelRequested) return;

    const g = $("gif-result"); if (g) g.remove();
    const dl = $("gif-dl"); if (dl) dl.remove();
    if ($("canvas-out")) $("canvas-out").style.display = "";

    const resultsEl  = $("results");
    const grid       = $("cards-grid");
    const canvasOut  = $("canvas-out");
    const canvasWrap = $("canvas-wrap");
    const runRow     = $("running-row");

    cancelRequested = false;
    const pipelineT0 = performance.now();

    if (runRow) runRow.hidden = false;
    if (resultsEl) resultsEl.hidden = true;
    if (canvasWrap) canvasWrap.hidden = false;

    // Letterbox the preview up front, before inference runs: the BorderTrail
    // loading effect hugs the card edge, so the shown frame must already be
    // padded to the card's aspect ratio, not just the final result.
    if (canvasOut) drawOverlayLetterboxed(canvasOut, imageData, [], []);

    // Pause decorative background during inference to preserve GPU budget
    window.__bgAnim?.pause();
    if ($("canvas-trail")) $("canvas-trail").hidden = false;
    try {
        const { detections, allPredictions, croppedImages } = await detectAndClassify(imageData, {
            onDetections: dets => status(T("log.found_cards", { count: dets.length })),
            onCard: (idx, total, topPreds) => status(T("log.card_progress", { idx: idx+1, total, name: topPreds[0]?.name, pct: ((topPreds[0]?.p ?? 0)*100).toFixed(1) }))
        });

        if (detections.length === 0) {
            if (runRow) runRow.hidden = true;
            if (canvasOut) drawOverlayLetterboxed(canvasOut, imageData, [], []);
            if (grid) grid.innerHTML = `<p style="grid-column:1/-1;color:var(--muted);font-size:.875rem;">No cards found above confidence threshold (${CONF_THRESH*100}%). Try a clearer image.</p>`;
            if (resultsEl) resultsEl.hidden = false;
            return;
        }

        dbg("Rendering overlay");
        if (canvasOut) drawOverlayLetterboxed(canvasOut, imageData, detections, allPredictions);
        if (grid) renderResultCards(grid, croppedImages, allPredictions);
        if (runRow) runRow.hidden = true;
        if (resultsEl) resultsEl.hidden = false;
        status(T("log.done_in", { ms: (performance.now()-pipelineT0).toFixed(0) }));

    } catch (err) {
        if (err.message === "Cancelled by user") {
            dbg("Execution aborted.");
            if (runRow) runRow.hidden = true;
            if (canvasWrap) canvasWrap.hidden = true;
            resetUI();
            return;
        }
        console.error("Pipeline error:", err.message, err.stack);
        const runRow = $("running-row");
        const grid = $("cards-grid");
        const resultsEl = $("results");
        if (runRow) runRow.hidden = true;
        setRunLabel("");
        if (grid) grid.innerHTML = `<p style="grid-column:1/-1;color:var(--danger);font-size:.875rem;">Error: ${err.message}</p>`;
        if (resultsEl) resultsEl.hidden = false;
    } finally {
        window.__bgAnim?.resume();
        if ($("canvas-trail")) $("canvas-trail").hidden = true;
    }
}

function nextFrame() {
    return new Promise(r => requestAnimationFrame(r));
}

// Image Input
function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width=img.naturalWidth; c.height=img.naturalHeight;
            c.getContext("2d").drawImage(img,0,0);
            URL.revokeObjectURL(url);
            resolve(c.getContext("2d").getImageData(0,0,c.width,c.height));
        };
        img.onerror = reject;
        img.src = url;
    });
}

function hideDropzoneOnLoad() {
    const dz = $("dropzone");
    if (dz && !("keepVisible" in dz.dataset)) dz.hidden = true;
}

function resetUI() {
    if ($("canvas-wrap")) $("canvas-wrap").hidden = true;
    if ($("results")) $("results").hidden = true;
    if ($("running-row")) $("running-row").hidden = true;
    if ($("dropzone")) $("dropzone").hidden = false;
    if ($("webcam-row")) $("webcam-row").style.display = "";
}

function setupLoadButton() {
    const btnCancel = $("btn-cancel");
    if (btnCancel) btnCancel.addEventListener("click", () => { cancelRequested = true; });

    const btn = $("btn-load");
    if (btn) btn.addEventListener("click", () => {
        if (loadAbortController) loadAbortController.abort();
        else init();
    });

    document.querySelectorAll('input[name="model"]').forEach(radio => {
        radio.addEventListener("change", () => {
            if (modelsReady && radio.value !== currentPrecision && btn) {
                btn.disabled = false;
                $("btn-load-label").textContent = T("demo.btn_download");
                $("lp-bar")?.style.setProperty("width", "0%");
            }
        });
    });
}

function setupDropzone() {
    const dz      = $("dropzone");
    const input   = $("file-input");
    const browse  = $("dz-browse");
    const resetBtn = $("btn-reset");

    if (!dz || !input) return;

    const guard = () => { if (!modelsReady) return false; return true; };

    if (browse) browse.addEventListener("click", e => { e.stopPropagation(); if(guard()) input.click(); });
    dz.addEventListener("click", () => { if(guard()) input.click(); });
    dz.addEventListener("keydown", e => { if((e.key==="Enter"||e.key===" ")&&guard()) input.click(); });

    dz.addEventListener("dragover", e => {
        e.preventDefault();
        if (modelsReady) dz.classList.add("drag-over");
    });
    dz.addEventListener("dragleave", e => {
        e.preventDefault();
        dz.classList.remove("border-emerald-500", "bg-emerald-50");
    });
    dz.addEventListener("drop", e => {
        e.preventDefault();
        dz.classList.remove("border-emerald-500", "bg-emerald-50");
        if(guard() && e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0]);
    });

    document.addEventListener("paste", (e) => {
        if (!modelsReady) return;
        if (cancelRequested) return;
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    handleImage(file);
                    return;
                }
            }
        }
    });

    input.addEventListener("change", () => { if(input.files[0]) handleImage(input.files[0]); });
    if (resetBtn) resetBtn.addEventListener("click", resetUI);
}

function setupSampleButtons() {
    // Sits inside #dropzone; don't also trigger its file picker on click.
    $("source-video-link")?.addEventListener("click", e => e.stopPropagation());

    document.querySelectorAll(".sample-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation(); // buttons sit inside #dropzone; don't also trigger its file picker
            if (!modelsReady || btn.disabled) return;
            const url  = btn.dataset.sample;
            const type = btn.dataset.sampleType || "";
            const name = url.split("/").pop();
            try {
                status(T("log.loading_sample", { name }));
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buf  = await res.arrayBuffer();
                const file = new File([buf], name, { type });
                hideDropzoneOnLoad();
                if ($("webcam-row")) $("webcam-row").style.display = "none";
                await handleImage(file);
            } catch (err) {
                console.error("Failed to load sample:", err.message);
                alert(`Couldn't load sample file: ${err.message}`);
            }
        });
    });
}

async function handleImage(file) {
    hideDropzoneOnLoad();
    if ($("webcam-row")) $("webcam-row").style.display = "none";
    if (file.type === 'image/gif' || file.type.startsWith('video/')) {
        await processAnimated(file);
    } else {
        const imageData = await loadImageFromFile(file);
        await runPipeline(imageData);
    }
}

// Live webcam detection: YOLO runs every tick, ViT classification refreshes periodically
let liveActive = false;
const LIVE_CLASSIFY_INTERVAL_MS = 700;

function centroidOf(pts) {
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x, y };
}

async function liveLoop(video) {
    const liveCanvas  = $("webcam-live-canvas");
    const latencyEl   = $("webcam-live-latency");
    const scratch = document.createElement("canvas");
    const sctx = scratch.getContext("2d", { willReadFrequently: true });

    let heldDetections  = [];
    let heldPredictions = [];
    let lastClassifyAt  = 0;

    while (liveActive) {
        const t0 = performance.now();
        if (!video.videoWidth) { await nextFrame(); continue; } // stream not ready yet

        scratch.width = video.videoWidth;
        scratch.height = video.videoHeight;
        sctx.drawImage(video, 0, 0);
        const imageData = sctx.getImageData(0, 0, scratch.width, scratch.height);

        try {
            // -- YOLO: every tick, cheap --
            const { tensor: yoloTensor, scale, padX, padY } = preprocessYOLO(imageData);
            const yoloInput = new ort.Tensor("float32", yoloTensor, [1,3,YOLO_SIZE,YOLO_SIZE]);
            const yoloOut   = await yoloSession.run({ [yoloSession.inputNames[0]]: yoloInput });
            const detections = parseYOLOOutput(yoloOut[yoloSession.outputNames[0]], scale, padX, padY);
            if (!liveActive) break;

            const countChanged  = detections.length !== heldDetections.length;
            const dueToRefresh  = performance.now() - lastClassifyAt > LIVE_CLASSIFY_INTERVAL_MS;
            let predictions;

            if (detections.length === 0) {
                predictions = [];
                heldDetections = []; heldPredictions = [];
            } else if (countChanged || dueToRefresh) {
                // -- ViT: only here, the expensive part --
                predictions = [];
                for (const det of detections) {
                    if (!liveActive) break;
                    const crop = warpPerspective(imageData, det.pts, CROP_SIZE, CROP_SIZE);
                    if (!crop) { predictions.push([]); continue; }
                    const { top } = await classifyWithRotationFallback(crop);
                    predictions.push(top.map(({i, p}) => ({ name: cardNameFor(cardnames[String(i)], i), p, i })));
                    await nextFrame(); // yield between cards so a busy scene doesn't freeze the tab
                }
                if (!liveActive) break;
                heldDetections  = detections;
                heldPredictions = predictions;
                lastClassifyAt  = performance.now();
            } else {
                // Re-pair previous labels to new boxes by nearest centroid
                predictions = detections.map(det => {
                    const c = centroidOf(det.pts);
                    let best = 0, bestDist = Infinity;
                    heldDetections.forEach((hd, i) => {
                        const hc = centroidOf(hd.pts);
                        const d = Math.hypot(c.x - hc.x, c.y - hc.y);
                        if (d < bestDist) { bestDist = d; best = i; }
                    });
                    return heldPredictions[best] || [];
                });
            }

            if (liveCanvas) drawOverlay(liveCanvas, imageData, detections, predictions);
            if (latencyEl) latencyEl.textContent = `${(performance.now() - t0).toFixed(0)}ms`;
        } catch (err) {
            console.error("Live detection error:", err.message);
            break;
        }
        await nextFrame();
    }
}

function setupWebcam() {
    const btnStart = $("btn-webcam");
    const btnSnap  = $("btn-snap");
    const btnStop  = $("btn-stop-webcam");
    const btnLive  = $("btn-live");
    const video    = $("webcam-video");
    const wrap     = $("webcam-wrap");
    const liveCanvas  = $("webcam-live-canvas");
    const liveBadge   = $("webcam-live-badge");

    if (!btnStart || !video) return;

    function stopLive() {
        liveActive = false;
        window.__bgAnim?.resume();
        if (btnLive) btnLive.textContent = T("runtime.live_detect");
        if (liveCanvas) liveCanvas.hidden = true;
        if (liveBadge) liveBadge.hidden = true;
    }

    btnStart.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!modelsReady) return;
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", aspectRatio: { ideal: 16/9 } } });
            video.srcObject = currentStream;
            hideDropzoneOnLoad();
            const webcamRow = btnStart.closest(".webcam-row");
            if (webcamRow) webcamRow.style.display = "none";
            if ($("canvas-wrap")) $("canvas-wrap").hidden = true;
            if ($("results")) $("results").hidden = true;
            $("gif-result")?.remove();
            $("gif-dl")?.remove();
            if (wrap) wrap.hidden = false;
        } catch { alert("Webcam access denied or unavailable."); }
    });

    if (btnLive) btnLive.addEventListener("click", () => {
        if (!modelsReady) return;
        if (liveActive) {
            stopLive();
            return;
        }
        if (currentPrecision !== "fp32" && currentPrecision !== "fp16") {
            alert("Live detection needs the Medium or Max model for smooth results. Switch precision and reload the engine to use it.");
            return;
        }
        liveActive = true;
        window.__bgAnim?.pause();
        btnLive.textContent = T("runtime.stop_detecting");
        if (liveCanvas) liveCanvas.hidden = false;
        if (liveBadge) liveBadge.hidden = false;
        liveLoop(video);
    });

    if (btnSnap) btnSnap.addEventListener("click", () => {
        stopLive();
        const c = document.createElement("canvas");
        c.width=video.videoWidth; c.height=video.videoHeight;
        c.getContext("2d").drawImage(video,0,0);
        stopWebcam();
        if (wrap) wrap.hidden = true;
        runPipeline(c.getContext("2d").getImageData(0,0,c.width,c.height));
    });

    if (btnStop) btnStop.addEventListener("click", () => { stopLive(); stopWebcam(); if (wrap) wrap.hidden=true; resetUI(); });
}

function stopWebcam() {
    currentStream?.getTracks().forEach(t => t.stop());
    currentStream = null;
}

// Keeps the fullscreen bubble glued to the image's own corner, not the
// letterboxed canvas box: object-contain can leave empty gutter around the
// image, so the button offset is derived from the actual rendered rect.
function setupFullscreenButtonPosition() {
    const canvasOut = $("canvas-out");
    const btn = $("btn-fullscreen");
    if (!canvasOut || !btn) return;

    function reposition() {
        const boxW = canvasOut.clientWidth, boxH = canvasOut.clientHeight;
        if (!boxW || !boxH || !canvasOut.width || !canvasOut.height) return;
        const scale = Math.min(boxW / canvasOut.width, boxH / canvasOut.height);
        const offsetX = (boxW - canvasOut.width * scale) / 2;
        const offsetY = (boxH - canvasOut.height * scale) / 2;
        const margin = 14;
        btn.style.top = (offsetY + margin) + "px";
        btn.style.right = (offsetX + margin) + "px";
    }
    new ResizeObserver(reposition).observe(canvasOut);
}

// Fullscreen Viewer
function setupFullscreenViewer() {
    const btn      = $("btn-fullscreen");
    const closeBtn = $("btn-fullscreen-close");
    const viewer   = $("fullscreen-viewer");
    const img      = $("fullscreen-viewer-img");
    if (!btn || !viewer || !img) return;

    function open() {
        const gifResult = $("gif-result");
        const canvasOut = $("canvas-out");
        if (gifResult && gifResult.src) {
            img.src = gifResult.src;
        } else if (canvasOut && canvasOut.width) {
            img.src = canvasOut.toDataURL();
        } else {
            return;
        }
        viewer.hidden = false;
    }
    function close() {
        viewer.hidden = true;
        img.src = "";
    }

    btn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    viewer.addEventListener("click", e => { if (e.target === viewer) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !viewer.hidden) close(); });
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
    setupLoadButton();
    setupDropzone();
    setupWebcam();
    setupSampleButtons();
    setupFullscreenViewer();
    setupFullscreenButtonPosition();
    injectVerbosityToggle();
});

// Video/GIF processing parameters
const MAX_PREDICTION_SIDE = 1920;
const GIF_OUTPUT_SIDE = 1280;
const EXTRACT_FPS = 15;
const INFERENCE_FPS = 5;

async function processAnimated(file) {
    const g = $("gif-result"); if (g) g.remove();
    const dl = $("gif-dl"); if (dl) dl.remove();
    if ($("canvas-out")) $("canvas-out").style.display = "";
    if ($("canvas-wrap")) $("canvas-wrap").hidden = false;
    const runRow = $("running-row");
    if (runRow) runRow.hidden = false;
    cancelRequested = false;

    function cancelCleanup() {
        dbg("Execution aborted.");
        if (runRow) runRow.hidden = true;
        if ($("canvas-wrap")) $("canvas-wrap").hidden = true;
        resetUI();
    }

    window.__bgAnim?.pause();
    if ($("canvas-trail")) $("canvas-trail").hidden = false;
    try {

    if (!window.GIF) {
        setRunLabel("Loading GIF encoder...");
        status(T("log.loading_gif_encoder"));
        await new Promise(r => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";
            s.onload = r;
            document.head.appendChild(s);
        });
    }

    setRunLabel("Extracting frames...");
    const frames = [];

    if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.muted = true;
        await new Promise((r, reject) => { video.onloadeddata = r; video.onerror = reject; });
        if (video.duration > 15) {
            alert("Please use a short clip (under 15s) for this in-browser demo.");
            if (runRow) runRow.hidden = true;
            if ($("canvas-wrap")) $("canvas-wrap").hidden = true;
            resetUI();
            return;
        }

        const canvas = document.createElement("canvas");
        const scale = Math.min(1.0, MAX_PREDICTION_SIDE / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");

        const totalFrames = Math.floor(video.duration * EXTRACT_FPS);
        status(T("log.extract_video", { dur: video.duration.toFixed(1), fps: EXTRACT_FPS, w: canvas.width, h: canvas.height }));
        for (let i = 0; i < totalFrames; i++) {
            video.currentTime = i / EXTRACT_FPS;
            await new Promise(r => { video.onseeked = r; });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            setRunLabel(`Extracting frames (${i+1}/${totalFrames})...`);
            dbgProgress("extract", "Extracting frames", i + 1, totalFrames);
        }
        dbgProgressDone("extract");
        status(T("log.extraction_done", { count: frames.length }));
    } else if (file.type === "image/gif") {
        if (!window.ImageDecoder) {
            alert("Your browser doesn't support GIF frame extraction (use Chrome or Edge).");
            if (runRow) runRow.hidden = true;
            if ($("canvas-wrap")) $("canvas-wrap").hidden = true;
            resetUI();
            return;
        }
        const decoder = new ImageDecoder({ type: "image/gif", data: file.stream() });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const frameCount = Math.min(track.frameCount, 30);
        status(T("log.extract_gif", { count: frameCount }));
        for (let i = 0; i < frameCount; i++) {
            const result = await decoder.decode({ frameIndex: i });
            const vf = result.image;
            const canvas = document.createElement("canvas");
            const scale = Math.min(1.0, MAX_PREDICTION_SIDE / Math.max(vf.displayWidth, vf.displayHeight));
            canvas.width = Math.round(vf.displayWidth * scale);
            canvas.height = Math.round(vf.displayHeight * scale);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(vf, 0, 0, canvas.width, canvas.height);
            frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            vf.close();
            setRunLabel(`Extracting frames (${i+1}/${frameCount})...`);
            dbgProgress("extract", "Extracting frames", i + 1, frameCount);
        }
        dbgProgressDone("extract");
        status(T("log.extraction_done", { count: frames.length }));
    }

    if (frames.length === 0) { if (runRow) runRow.hidden = true; if ($("canvas-wrap")) $("canvas-wrap").hidden = true; resetUI(); return; }

    // Inference on keyframes (stride = EXTRACT_FPS / INFERENCE_FPS)
    const stride = Math.max(1, Math.round(EXTRACT_FPS / INFERENCE_FPS));
    const keyIndices = [];
    for (let i = 0; i < frames.length; i += stride) keyIndices.push(i);
    if (keyIndices[keyIndices.length - 1] !== frames.length - 1) keyIndices.push(frames.length - 1);

    const keyResults = new Map();
    status(T("log.running_detection", { count: keyIndices.length }));
    for (let k = 0; k < keyIndices.length; k++) {
        if (cancelRequested) break;
        const idx = keyIndices[k];
        setRunLabel(`Analyzing key frame ${k+1}/${keyIndices.length}...`);
        const { detections, allPredictions } = await detectAndClassify(frames[idx], { showSteps: false });
        keyResults.set(idx, { detections, allPredictions });
        dbgProgress("infer", "Running detection", k + 1, keyIndices.length);
        await nextFrame();
    }
    dbgProgressDone("infer");
    if (cancelRequested) { cancelCleanup(); return; }
    status(T("log.keyframe_done"));

    function nearestKey(i) {
        let best = keyIndices[0], bestDist = Infinity;
        for (const k of keyIndices) {
            const d = Math.abs(k - i);
            if (d < bestDist) { bestDist = d; best = k; }
        }
        return best;
    }

    const outScale = Math.min(1.0, GIF_OUTPUT_SIDE / Math.max(frames[0].width, frames[0].height));
    const gifW = Math.round(frames[0].width * outScale);
    const gifH = Math.round(frames[0].height * outScale);
    const workerStr = `importScripts("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");`;
    const blob = new Blob([workerStr], {type: "application/javascript"});
    const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: URL.createObjectURL(blob),
        width: gifW,
        height: gifH
    });

    const gifFrameCanvas = document.createElement("canvas");
    gifFrameCanvas.width = gifW;
    gifFrameCanvas.height = gifH;
    const gifFrameCtx = gifFrameCanvas.getContext("2d");

    const canvasOut = $("canvas-out");
    status(T("log.rendering_frames", { count: frames.length }));
    for (let i = 0; i < frames.length; i++) {
        if (cancelRequested) break;
        const { detections, allPredictions } = keyResults.get(nearestKey(i)) || { detections: [], allPredictions: [] };
        if (canvasOut) drawOverlayLetterboxed(canvasOut, frames[i], detections, allPredictions);

        gifFrameCtx.clearRect(0, 0, gifW, gifH);
        if (canvasOut) {
            // canvasOut is letterboxed for on-page display; crop back out just
            // the real frame (skip the black bars) so the exported GIF keeps
            // the source's original aspect ratio, not the UI card's.
            const cropX = Math.round((canvasOut.width - frames[i].width) / 2);
            const cropY = Math.round((canvasOut.height - frames[i].height) / 2);
            gifFrameCtx.drawImage(canvasOut, cropX, cropY, frames[i].width, frames[i].height, 0, 0, gifW, gifH);
        }
        gif.addFrame(gifFrameCanvas, {delay: Math.round(1000 / EXTRACT_FPS), copy: true});

        setRunLabel(`Rendering frame ${i+1}/${frames.length}...`);
        dbgProgress("render", "Rendering frames", i + 1, frames.length);
        if (i % 5 === 0) await nextFrame();
    }
    dbgProgressDone("render");
    if (cancelRequested) { cancelCleanup(); return; }
    status(T("log.frame_rendering_done"));

    } finally {
        window.__bgAnim?.resume();
        if ($("canvas-trail")) $("canvas-trail").hidden = true;
    }

    setRunLabel("Encoding output GIF...");
    status(T("log.encoding_gif"));
    gif.on("finished", function(blob) {
        setRunLabel("Engine Ready");
        if (runRow) runRow.hidden = true;
        status(T("log.gif_ready", { size: (blob.size/1024).toFixed(0) }));
        const cOut = document.getElementById("canvas-out");
        const existingImg = document.getElementById("gif-result");
        if (existingImg) existingImg.remove();
        const existingDl = document.getElementById("gif-dl");
        if (existingDl) existingDl.remove();

        const img = document.createElement("img");
        img.id = "gif-result";
        img.src = URL.createObjectURL(blob);
        img.className = cOut.className;

        cOut.style.display = "none";
        cOut.parentNode.insertBefore(img, cOut);

        const dl = document.createElement("a");
        dl.id = "gif-dl";
        dl.href = img.src;
        dl.download = "draw2_prediction.gif";
        dl.className = "absolute bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg hover:bg-emerald-400 z-50";
        dl.textContent = T("runtime.download_gif");
        img.parentNode.style.position = "relative";
        img.parentNode.appendChild(dl);
    });
    gif.render();
}


