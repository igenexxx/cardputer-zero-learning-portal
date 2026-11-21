/**
 * OOK Pulse & TE Waveform Lab Widget
 * Renders interactive Princeton, CAME, and Linear OOK waveforms with optional
 * EMI glitch injection and 1D K-Means pulse denoising/quantization.
 */

import { setupHiDpiCanvas, copyText } from "./canvas.js";
import { PROTOCOLS, parseKeyHex, randomKeyHex, encodeProtocol, injectGlitches, decodeWithKMeans, formatRawData } from "./ook-math.js";

const TEMPLATE = `
  <div class="widget-card">
    <div class="widget-header">
      <div class="widget-title-group">
        <span class="widget-badge">Interactive RF Lab</span>
        <h3 class="widget-title">OOK Pulse &amp; TE Waveform Decoder</h3>
      </div>
      <span class="status-pill ok" data-role="decode-pill">DECODE OK</span>
    </div>
    <div class="widget-body">
      <div class="widget-controls-grid">
        <div class="widget-control"><label>Protocol</label><select data-control="protocol"><option value="princeton">Princeton 24-bit (1:3)</option><option value="came">CAME 12-bit (1:2)</option><option value="linear">Linear 10-bit (1:3)</option></select></div>
        <div class="widget-control"><label>Time Element (TE) <strong data-role="val-te">350 µs</strong></label><input type="range" min="200" max="500" step="10" value="350" data-control="te"></div>
        <div class="widget-control"><label>Timing Jitter <strong data-role="val-jitter">5%</strong></label><input type="range" min="0" max="30" step="1" value="5" data-control="jitter"></div>
      </div>
      <div class="widget-actions" style="align-items: center;">
        <div class="widget-control" style="flex: 1; min-width: 180px;"><label>Key Hex</label><input type="text" value="A5C39E" maxlength="8" data-control="keyhex" spellcheck="false"></div>
        <button type="button" class="widget-btn" data-action="toggle-glitches" style="margin-top: 1.15rem;">EMI Glitches: OFF</button>
        <button type="button" class="widget-btn is-active" data-action="toggle-kmeans" style="margin-top: 1.15rem;">1D K-Means: ON</button>
        <button type="button" class="widget-btn" data-action="randomize" style="margin-top: 1.15rem;">Randomize Key</button>
        <button type="button" class="widget-btn" data-action="copy-raw" style="margin-top: 1.15rem;">Copy RAW_Data</button>
      </div>
      <div class="widget-canvas-wrap"><canvas class="widget-canvas" data-role="canvas" aria-label="OOK high/low RF pulse waveform"></canvas></div>
      <div class="widget-readouts">
        <div class="readout-tile"><span class="readout-label">Decoded Protocol</span><span class="readout-value is-cyan" data-role="out-proto">--</span></div>
        <div class="readout-tile"><span class="readout-label">Decoded Key</span><span class="readout-value is-emerald" data-role="out-key">--</span></div>
        <div class="readout-tile"><span class="readout-label">Estimated TE</span><span class="readout-value" data-role="out-te">--</span></div>
        <div class="readout-tile"><span class="readout-label">Frame Duration</span><span class="readout-value is-amber" data-role="out-dur">--</span></div>
      </div>
      <div class="widget-subpanel">
        <h4 class="widget-subpanel-title">Flipper .sub Signed RAW_Data (µs)</h4>
        <div class="widget-code-panel" data-role="raw-output"></div>
      </div>
    </div>
  </div>
`;

function queryElements(el) {
  const q = (sel) => el.querySelector(sel);
  return {
    canvas: q('[data-role="canvas"]'), protoSel: q('[data-control="protocol"]'),
    teSlider: q('[data-control="te"]'), jitterSlider: q('[data-control="jitter"]'),
    keyInput: q('[data-control="keyhex"]'), valTe: q('[data-role="val-te"]'),
    valJitter: q('[data-role="val-jitter"]'), decodePill: q('[data-role="decode-pill"]'),
    outProto: q('[data-role="out-proto"]'), outKey: q('[data-role="out-key"]'),
    outTe: q('[data-role="out-te"]'), outDur: q('[data-role="out-dur"]'),
    rawOutput: q('[data-role="raw-output"]'), copyBtn: q('[data-action="copy-raw"]'),
    glitchBtn: q('[data-action="toggle-glitches"]'), kmeansBtn: q('[data-action="toggle-kmeans"]'),
    randomizeBtn: q('[data-action="randomize"]'),
  };
}

function drawWaveformGrid(ctx, geom) {
  const { width, padL, padR, hiY, loY } = geom;
  ctx.strokeStyle = "#172330";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, hiY);
  ctx.lineTo(width - padR, hiY);
  ctx.moveTo(padL, loY);
  ctx.lineTo(width - padR, loY);
  ctx.stroke();

  ctx.fillStyle = "#6c829a";
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText("HIGH", padL - 6, hiY + 4);
  ctx.fillText("LOW", padL - 6, loY + 4);
}

function drawPulseTrace(ctx, pulses, visualDurations, totalVis, geom, te) {
  const { padL, plotW, hiY, loY } = geom;
  ctx.strokeStyle = "#00d9ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let x = padL;
  ctx.moveTo(x, loY);

  for (let i = 0; i < pulses.length; i++) {
    const w = (visualDurations[i] / totalVis) * plotW;
    const y = pulses[i] > 0 ? hiY : loY;
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);

    if (Math.abs(pulses[i]) > te * 10) {
      ctx.save();
      ctx.fillStyle = "rgba(245, 158, 11, 0.14)";
      ctx.fillRect(x, hiY - 4, w, loY - hiY + 8);
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "center";
      ctx.fillText("SYNC GAP", x + w / 2, hiY - 8);
      ctx.restore();
    }
    x += w;
  }
  ctx.lineTo(x, loY);
  ctx.stroke();
}

function drawBitLabels(ctx, proto, value, pulses, visualDurations, totalVis, geom) {
  const { padL, padT, plotW } = geom;
  const startIdx = proto.pilotFirst ? 2 : 0;
  let bx = padL;
  for (let k = 0; k < startIdx; k++) bx += (visualDurations[k] / totalVis) * plotW;

  ctx.fillStyle = "#10e191";
  ctx.textAlign = "center";
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  for (let b = 0; b < proto.bits; b++) {
    const idx = startIdx + b * 2;
    if (idx + 1 >= pulses.length) break;
    const pairW = ((visualDurations[idx] + visualDurations[idx + 1]) / totalVis) * plotW;
    const bitVal = (value >>> (proto.bits - 1 - b)) & 1;
    if (pairW >= 10) ctx.fillText(String(bitVal), bx + pairW / 2, padT + 4);
    bx += pairW;
  }
}

function drawWaveform(canvas, state, proto, value, pulses) {
  const { ctx, width, height } = setupHiDpiCanvas(canvas, 200);
  ctx.fillStyle = "#080d12";
  ctx.fillRect(0, 0, width, height);

  const padL = 36, padR = 14, padT = 28, padB = 30;
  const geom = { width, height, padL, padR, padT, plotW: width - padL - padR, hiY: padT + 18, loY: height - padB - 14 };

  // Compress huge sync gap so active data bits stay readable
  const maxVisual = state.te * 8;
  const visualDurations = pulses.map((p) => Math.min(Math.abs(p), maxVisual));
  const totalVis = visualDurations.reduce((a, b) => a + b, 0) || 1;

  drawWaveformGrid(ctx, geom);
  drawPulseTrace(ctx, pulses, visualDurations, totalVis, geom, state.te);
  drawBitLabels(ctx, proto, value, pulses, visualDurations, totalVis, geom);

  ctx.fillStyle = "#6c829a";
  ctx.textAlign = "left";
  ctx.fillText(`TE = ${state.te} µs · Jitter = ±${state.jitter}% · Bits = ${proto.bits}`, padL, height - 8);
}

function renderDecodeReadouts(ui, proto, pulses, { decoded, mlRecovered, kmStats }) {
  const totalUs = pulses.reduce((acc, p) => acc + Math.abs(p), 0);
  ui.outProto.textContent = proto.name;
  ui.outDur.textContent = `${(totalUs / 1000).toFixed(2)} ms`;

  if (decoded.ok) {
    ui.decodePill.textContent = mlRecovered ? `ML-CLEAN (GL:${kmStats.glitchesRemoved})` : "DECODE OK";
    ui.decodePill.className = "status-pill ok";
    ui.outKey.textContent = `0x${decoded.hex}`;
    ui.outKey.className = "readout-value is-emerald";
    ui.outTe.textContent = `${mlRecovered ? kmStats.shortUs : decoded.estTe} µs`;
  } else {
    ui.decodePill.textContent = "JITTER / SYNC ERROR";
    ui.decodePill.className = "status-pill err";
    ui.outKey.textContent = decoded.reason || "Failed";
    ui.outKey.className = "readout-value is-red";
    ui.outTe.textContent = decoded.estTe ? `${decoded.estTe} µs` : "--";
  }

  ui.rawOutput.textContent = formatRawData(pulses);
}

function bindOokEvents(ui, state, onUpdate) {
  const bindToggle = (btn, key, label) => btn.addEventListener("click", () => {
    state[key] = !state[key];
    btn.textContent = `${label}: ${state[key] ? "ON" : "OFF"}`;
    btn.classList.toggle("is-active", state[key]);
    onUpdate();
  });
  bindToggle(ui.glitchBtn, "glitches", "EMI Glitches");
  bindToggle(ui.kmeansBtn, "kmeans", "1D K-Means");

  ui.protoSel.addEventListener("change", () => {
    state.protocol = ui.protoSel.value;
    state.keyHex = PROTOCOLS[state.protocol].defaultHex;
    ui.keyInput.value = state.keyHex;
    onUpdate();
  });
  ui.teSlider.addEventListener("input", () => { state.te = parseInt(ui.teSlider.value, 10); ui.valTe.textContent = `${state.te} µs`; onUpdate(); });
  ui.jitterSlider.addEventListener("input", () => { state.jitter = parseInt(ui.jitterSlider.value, 10); ui.valJitter.textContent = `${state.jitter}%`; onUpdate(); });
  ui.keyInput.addEventListener("input", () => { state.keyHex = ui.keyInput.value; onUpdate(); });
  ui.randomizeBtn.addEventListener("click", () => {
    state.keyHex = randomKeyHex(PROTOCOLS[state.protocol]);
    ui.keyInput.value = state.keyHex;
    onUpdate();
  });
  ui.copyBtn.addEventListener("click", () => copyText(ui.rawOutput.textContent, ui.copyBtn, "Copy RAW_Data"));
}

export function mountOokDecoder(el) {
  const state = {
    protocol: "princeton",
    te: 350,
    jitter: 5,
    glitches: false,
    kmeans: true,
    keyHex: PROTOCOLS.princeton.defaultHex,
    pulses: [],
  };

  el.innerHTML = TEMPLATE;
  const ui = queryElements(el);

  function update() {
    const proto = PROTOCOLS[state.protocol];
    const num = parseKeyHex(proto, state.keyHex);
    const encoded = encodeProtocol(proto, num, state.te, state.jitter);
    state.pulses = state.glitches ? injectGlitches(encoded) : encoded;

    const result = decodeWithKMeans(proto, state.pulses, state.kmeans);
    renderDecodeReadouts(ui, proto, state.pulses, result);
    drawWaveform(ui.canvas, state, proto, num, state.pulses);
  }

  bindOokEvents(ui, state, update);
  update();
  return null;
}
