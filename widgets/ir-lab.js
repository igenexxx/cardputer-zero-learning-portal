/**
 * Interactive 38 kHz Infrared Protocol & 1D K-Means Pulse Denoiser Lab
 * Zero-build native ES module rendering HiDPI Canvas waveforms and live decoding.
 */

import { setupHiDpiCanvas, copyText } from "./canvas.js";
import {
  IR_PROTOCOLS,
  encodeIR,
  applyJitterAndGlitches,
  denoiseIRPulses,
  decodeIR,
  formatFlipperData,
} from "./ir-math.js";

const TEMPLATE = `
  <div class="widget-card">
    <div class="widget-header">
      <div class="widget-title-group">
        <span class="widget-badge">Interactive IR Lab</span>
        <h3 class="widget-title">38 kHz IR Protocol &amp; 1D K-Means Pulse Denoiser</h3>
      </div>
      <span class="status-pill ok" data-role="decode-pill">DECODE OK</span>
    </div>
    <div class="widget-body">
      <div class="widget-controls-grid">
        <div class="widget-control">
          <label>Protocol</label>
          <select data-control="protocol">
            <option value="nec">NEC (38 kHz · Pulse-Distance)</option>
            <option value="samsung32">Samsung32 (38 kHz · Pulse-Distance)</option>
            <option value="rc5">RC5 (36 kHz · Bi-Phase Manchester)</option>
            <option value="sirc">SIRC-12 (40 kHz · Pulse-Width)</option>
          </select>
        </div>
        <div class="widget-control">
          <label>Timing Jitter <strong data-role="val-jitter">40 µs</strong></label>
          <input type="range" min="0" max="150" step="5" value="40" data-control="jitter">
        </div>
        <div class="widget-control">
          <label>EMI Glitches <strong data-role="val-glitches">2 spikes</strong></label>
          <input type="range" min="0" max="6" step="1" value="2" data-control="glitches">
        </div>
      </div>
      <div class="widget-actions" style="align-items: center;">
        <div class="widget-control" style="max-width: 110px;">
          <label>Addr (Hex)</label>
          <input type="text" value="04" maxlength="2" data-control="addr" spellcheck="false">
        </div>
        <div class="widget-control" style="max-width: 110px;">
          <label>Cmd (Hex)</label>
          <input type="text" value="08" maxlength="2" data-control="cmd" spellcheck="false">
        </div>
        <button type="button" class="widget-btn is-active" data-action="toggle-kmeans" style="margin-top: 1.15rem;">1D K-Means: ON</button>
        <button type="button" class="widget-btn" data-action="resample" style="margin-top: 1.15rem;">New Noise Seed</button>
        <button type="button" class="widget-btn" data-action="copy-raw" style="margin-top: 1.15rem;">Copy .ir data:</button>
      </div>
      <div class="widget-canvas-wrap">
        <canvas class="widget-canvas" data-role="canvas" aria-label="IR mark and space pulse waveform"></canvas>
      </div>
      <div class="widget-readouts">
        <div class="readout-tile"><span class="readout-label">Protocol / Carrier</span><span class="readout-value is-cyan" data-role="out-proto">--</span></div>
        <div class="readout-tile"><span class="readout-label">Decoded Addr / Cmd</span><span class="readout-value is-emerald" data-role="out-decode">--</span></div>
        <div class="readout-tile"><span class="readout-label">K-Means Centroids</span><span class="readout-value is-magenta" data-role="out-centroids">--</span></div>
        <div class="readout-tile"><span class="readout-label">Glitches / Duration</span><span class="readout-value is-amber" data-role="out-meta">--</span></div>
      </div>
      <div class="widget-subpanel">
        <h4 class="widget-subpanel-title">Flipper .ir RAW data: (µs)</h4>
        <div class="widget-code-panel" data-role="raw-output"></div>
      </div>
    </div>
  </div>
`;

function queryElements(el) {
  const q = (sel) => el.querySelector(sel);
  return {
    canvas: q('[data-role="canvas"]'),
    protoSel: q('[data-control="protocol"]'),
    jitterSlider: q('[data-control="jitter"]'),
    glitchSlider: q('[data-control="glitches"]'),
    addrInput: q('[data-control="addr"]'),
    cmdInput: q('[data-control="cmd"]'),
    valJitter: q('[data-role="val-jitter"]'),
    valGlitches: q('[data-role="val-glitches"]'),
    decodePill: q('[data-role="decode-pill"]'),
    outProto: q('[data-role="out-proto"]'),
    outDecode: q('[data-role="out-decode"]'),
    outCentroids: q('[data-role="out-centroids"]'),
    outMeta: q('[data-role="out-meta"]'),
    rawOutput: q('[data-role="raw-output"]'),
    kmeansBtn: q('[data-action="toggle-kmeans"]'),
    resampleBtn: q('[data-action="resample"]'),
    copyBtn: q('[data-action="copy-raw"]'),
  };
}

function parseHexByte(str, fallback) {
  const cleaned = (str || "").replace(/[^0-9a-fA-F]/g, "");
  if (!cleaned) return fallback;
  return parseInt(cleaned.slice(0, 2), 16) & 0xff;
}

function hex2(n) {
  return (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function drawTrace(ctx, pulses, totalVis, maxVis, geom, stroke, lineWidth, yOffset) {
  const { padL, plotW, hiY, loY } = geom;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  let x = padL;
  ctx.moveTo(x, loY + yOffset);
  for (const p of pulses) {
    const w = (Math.min(Math.abs(p), maxVis) / totalVis) * plotW;
    const y = (p > 0 ? hiY : loY) + yOffset;
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    x += w;
  }
  ctx.lineTo(x, loY + yOffset);
  ctx.stroke();
}

function drawIrWaveform(canvas, rawPulses, denoisedPulses, state, proto) {
  const { ctx, width, height } = setupHiDpiCanvas(canvas, 210);
  ctx.fillStyle = "#080d12";
  ctx.fillRect(0, 0, width, height);

  const padL = 42, padR = 14, padT = 26, padB = 28;
  const plotW = width - padL - padR;
  const hiY = padT + 14;
  const loY = height - padB - 14;
  const geom = { padL, plotW, hiY, loY };

  ctx.strokeStyle = "#172330";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, hiY); ctx.lineTo(width - padR, hiY);
  ctx.moveTo(padL, loY); ctx.lineTo(width - padR, loY);
  ctx.stroke();

  ctx.fillStyle = "#6c829a";
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText("MARK", padL - 6, hiY + 4);
  ctx.fillText("SPACE", padL - 6, loY + 4);

  const maxVis = 3200;
  const totalRaw = rawPulses.reduce((a, p) => a + Math.min(Math.abs(p), maxVis), 0) || 1;
  const totalClean = denoisedPulses.reduce((a, p) => a + Math.min(Math.abs(p), maxVis), 0) || 1;

  drawTrace(ctx, rawPulses, totalRaw, maxVis, geom, state.kmeans ? "rgba(0, 217, 255, 0.45)" : "#00d9ff", 1.75, 0);
  if (state.kmeans) {
    drawTrace(ctx, denoisedPulses, totalClean, maxVis, geom, "#e879f9", 2, -2);
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#00d9ff";
  ctx.fillText("Cyan: Captured RX", padL, 15);
  if (state.kmeans) {
    ctx.fillStyle = "#e879f9";
    ctx.fillText("Magenta: 1D K-Means Denoised", padL + 132, 15);
  }
  ctx.fillStyle = "#6c829a";
  ctx.fillText(`${proto.encoding} · ${proto.carrierHz / 1000} kHz (${proto.dutyPct}%) · Jitter ±${state.jitterUs} µs`, padL, height - 8);
}

function updateReadouts(ui, proto, activePulses, decoded, km, kmeansOn) {
  const totalMs = activePulses.reduce((a, p) => a + Math.abs(p), 0) / 1000;
  ui.outProto.textContent = `${proto.name} · ${proto.carrierHz / 1000} kHz`;
  ui.outCentroids.textContent = km.shortUs > 0 ? `${km.shortUs} / ${km.longUs} µs (${km.jitterPct}%)` : "--";
  ui.outMeta.textContent = `${kmeansOn ? km.glitchesRemoved : 0} absorbed · ${totalMs.toFixed(1)} ms`;
  ui.rawOutput.textContent = formatFlipperData(activePulses);

  if (decoded.ok) {
    ui.decodePill.textContent = kmeansOn && (km.glitchesRemoved > 0 || km.jitterPct > 4) ? "ML-CLEAN OK" : "DECODE OK";
    ui.decodePill.className = "status-pill ok";
    ui.outDecode.textContent = `0x${hex2(decoded.addr)} / 0x${hex2(decoded.cmd)}`;
    ui.outDecode.className = "readout-value is-emerald";
  } else {
    ui.decodePill.textContent = "DECODE FAILED";
    ui.decodePill.className = "status-pill err";
    ui.outDecode.textContent = decoded.reason || "Error";
    ui.outDecode.className = "readout-value is-red";
  }
}

export function mountIrLab(el) {
  const state = {
    protocol: "nec",
    addr: IR_PROTOCOLS.nec.defaultAddr,
    cmd: IR_PROTOCOLS.nec.defaultCmd,
    jitterUs: 40,
    glitches: 2,
    kmeans: true,
    seed: 1,
  };

  el.innerHTML = TEMPLATE;
  const ui = queryElements(el);

  function render() {
    const proto = IR_PROTOCOLS[state.protocol];
    const clean = encodeIR(state.protocol, state.addr, state.cmd);
    const noisy = applyJitterAndGlitches(clean, state.jitterUs, state.glitches, state.seed);
    const km = denoiseIRPulses(noisy);
    const active = state.kmeans ? km.pulses : noisy;
    const decoded = decodeIR(state.protocol, active);

    updateReadouts(ui, proto, active, decoded, km, state.kmeans);
    drawIrWaveform(ui.canvas, noisy, km.pulses, state, proto);
  }

  ui.protoSel.addEventListener("change", () => {
    state.protocol = ui.protoSel.value;
    const p = IR_PROTOCOLS[state.protocol];
    state.addr = p.defaultAddr;
    state.cmd = p.defaultCmd;
    ui.addrInput.value = hex2(state.addr);
    ui.cmdInput.value = hex2(state.cmd);
    render();
  });
  ui.jitterSlider.addEventListener("input", () => {
    state.jitterUs = parseInt(ui.jitterSlider.value, 10);
    ui.valJitter.textContent = `${state.jitterUs} µs`;
    render();
  });
  ui.glitchSlider.addEventListener("input", () => {
    state.glitches = parseInt(ui.glitchSlider.value, 10);
    ui.valGlitches.textContent = `${state.glitches} spike${state.glitches === 1 ? "" : "s"}`;
    render();
  });
  ui.addrInput.addEventListener("input", () => {
    state.addr = parseHexByte(ui.addrInput.value, state.addr);
    render();
  });
  ui.cmdInput.addEventListener("input", () => {
    state.cmd = parseHexByte(ui.cmdInput.value, state.cmd);
    render();
  });
  ui.kmeansBtn.addEventListener("click", () => {
    state.kmeans = !state.kmeans;
    ui.kmeansBtn.textContent = `1D K-Means: ${state.kmeans ? "ON" : "OFF"}`;
    ui.kmeansBtn.classList.toggle("is-active", state.kmeans);
    render();
  });
  ui.resampleBtn.addEventListener("click", () => {
    state.seed++;
    render();
  });
  ui.copyBtn.addEventListener("click", () => copyText(ui.rawOutput.textContent, ui.copyBtn, "Copy .ir data:"));

  const onResize = () => render();
  window.addEventListener("resize", onResize);
  render();
  return () => window.removeEventListener("resize", onResize);
}
