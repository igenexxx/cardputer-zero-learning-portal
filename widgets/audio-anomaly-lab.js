/**
 * Interactive Acoustic Anomaly Watch (BandBaseline EWMA + AnomalyAE-2D Simulator)
 * Zero-build native ES module visualizing 32-band fault reconstruction heatmaps.
 */

import { setupHiDpiCanvas } from "./canvas.js";

const TEMPLATE = `
  <div class="widget-card">
    <div class="widget-header">
      <div class="widget-title-group">
        <span class="widget-badge">Interactive ML Lab</span>
        <h3 class="widget-title">BandBaseline EWMA + AnomalyAE-2D Fault Heatmap</h3>
      </div>
      <span class="status-pill ok" data-role="verdict-pill">NORMAL</span>
    </div>
    <div class="widget-body">
      <div class="widget-controls-grid">
        <div class="widget-control">
          <label>Fault Type</label>
          <select data-control="fault">
            <option value="none">Healthy Machine (Normal Baseline)</option>
            <option value="bearing">Bearing Race Squeal (~3.4 kHz)</option>
            <option value="knock">Periodic Shaft Knock (Mid-Band)</option>
            <option value="imbalance">Rotor Blade Imbalance (Low-Freq)</option>
            <option value="scrape">Metallic Friction Scrape (High-Band)</option>
          </select>
        </div>
        <div class="widget-control">
          <label>Fault Severity <strong data-role="val-sev">65%</strong></label>
          <input type="range" min="0" max="100" step="5" value="65" data-control="sev">
        </div>
        <div class="widget-control">
          <label>Alert Sensitivity <strong data-role="val-sens">Medium (56)</strong></label>
          <input type="range" min="35" max="80" step="5" value="55" data-control="sens">
        </div>
      </div>
      <div class="widget-canvas-wrap">
        <canvas class="widget-canvas" data-role="canvas" aria-label="32-band anomaly reconstruction error heatmap"></canvas>
      </div>
      <div class="widget-readouts">
        <div class="readout-tile"><span class="readout-label">Fused Anomaly Score</span><span class="readout-value is-magenta" data-role="out-score">--</span></div>
        <div class="readout-tile"><span class="readout-label">BandBaseline Max Z</span><span class="readout-value is-cyan" data-role="out-z">--</span></div>
        <div class="readout-tile"><span class="readout-label">AnomalyAE-2D MSE</span><span class="readout-value is-amber" data-role="out-mse">--</span></div>
        <div class="readout-tile"><span class="readout-label">Hotspot Band</span><span class="readout-value is-emerald" data-role="out-hot">--</span></div>
      </div>
    </div>
  </div>
`;

function melCenterHz(b) {
  const mMin = 2595 * Math.log10(1 + 60 / 700);
  const mMax = 2595 * Math.log10(1 + 7800 / 700);
  const m = mMin + ((mMax - mMin) * (b + 1)) / 33;
  return 700 * (Math.pow(10, m / 2595) - 1);
}

export function mountAudioAnomalyLab(el) {
  el.innerHTML = TEMPLATE;
  const q = (s) => el.querySelector(s);
  const canvas = q('[data-role="canvas"]');
  const faultSel = q('[data-control="fault"]');
  const sevIn = q('[data-control="sev"]');
  const sensIn = q('[data-control="sens"]');
  const pill = q('[data-role="verdict-pill"]');

  function render() {
    const fault = faultSel.value;
    const sev = Number(sevIn.value) / 100;
    const thresh = Number(sensIn.value);

    q('[data-role="val-sev"]').textContent = `${Math.round(sev * 100)}%`;
    q('[data-role="val-sens"]').textContent = `${thresh <= 45 ? "High" : thresh >= 70 ? "Low" : "Medium"} (${thresh})`;

    const bands = 32;
    const heat = new Float32Array(bands);
    let maxZ = 0.7;
    let mse = 0.0042;
    let hotBand = 6;
    let hotVal = 0;

    for (let b = 0; b < bands; b++) {
      let baseErr = 0.06 + 0.04 * Math.abs(Math.sin(b * 1.9));
      if (fault === "bearing") {
        const d = (b - 23) / 2.2;
        baseErr += sev * 0.92 * Math.exp(-d * d);
      } else if (fault === "knock") {
        const d = (b - 14) / 4.2;
        baseErr += sev * 0.78 * Math.exp(-d * d);
      } else if (fault === "imbalance") {
        const d = (b - 3) / 2.8;
        baseErr += sev * 0.85 * Math.exp(-d * d);
      } else if (fault === "scrape") {
        const d = (b - 27) / 3.8;
        baseErr += sev * 0.88 * Math.exp(-d * d);
      }
      heat[b] = Math.min(1, baseErr);
      if (heat[b] > hotVal) {
        hotVal = heat[b];
        hotBand = b;
      }
    }

    if (fault !== "none") {
      maxZ = 1.1 + sev * 7.2;
      mse = 0.0045 + sev * sev * 0.038;
    }
    const baseScore = Math.max(0, Math.min(100, (maxZ - 1.2) * 18));
    const aeScore = Math.max(0, Math.min(100, ((mse - 0.0045) / 0.006 + 1) * 18));
    const fused = Math.round(0.55 * baseScore + 0.45 * aeScore);

    let verdict = "NORMAL";
    let pillCls = "ok";
    if (fused >= thresh) {
      verdict = "ANOMALY (AUTO-REC 2s+3s)";
      pillCls = "err";
    } else if (fused >= thresh * 0.68) {
      verdict = "WATCH";
      pillCls = "warn";
    }
    pill.textContent = verdict;
    pill.className = `status-pill ${pillCls}`;

    q('[data-role="out-score"]').textContent = `${fused} / 100`;
    q('[data-role="out-z"]').textContent = `+${maxZ.toFixed(1)}σ (Burst-Freeze)`;
    q('[data-role="out-mse"]').textContent = mse.toFixed(4);
    const hz = melCenterHz(hotBand);
    q('[data-role="out-hot"]').textContent = hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz (B${hotBand})` : `${Math.round(hz)} Hz (B${hotBand})`;

    const { ctx, width, height } = setupHiDpiCanvas(canvas, 190);
    ctx.fillStyle = "#0b1117";
    ctx.fillRect(0, 0, width, height);

    const padX = 16;
    const plotW = width - padX * 2;
    const plotH = height - 42;
    const bw = plotW / bands;
    for (let b = 0; b < bands; b++) {
      const h = Math.max(4, heat[b] * plotH);
      ctx.fillStyle = heat[b] > 0.7 ? "#ef4444" : heat[b] > 0.42 ? "#f59e0b" : "#00d9ff";
      ctx.fillRect(padX + b * bw, height - 24 - h, Math.max(3, bw - 3), h);
    }

    // Threshold reference line.
    const thY = height - 24 - (thresh / 100) * plotH;
    ctx.strokeStyle = "#e879f9";
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, thY);
    ctx.lineTo(width - padX, thY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText("60 Hz (Mel 0)", padX, height - 7);
    ctx.fillText("1.2 kHz", width / 2 - 22, height - 7);
    ctx.fillText("7.8 kHz (Mel 31)", width - 118, height - 7);
  }

  [faultSel, sevIn, sensIn].forEach((i) => i.addEventListener("input", render));
  window.addEventListener("resize", render);
  render();
  return () => window.removeEventListener("resize", render);
}
