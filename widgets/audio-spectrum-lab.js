/**
 * Interactive Acoustic Spectrum, Windowing & YIN Pitch Lab
 * Zero-build native ES module matching audio-studio/internal/dsp/.
 */

import { setupHiDpiCanvas } from "./canvas.js";

const TEMPLATE = `
  <div class="widget-card">
    <div class="widget-header">
      <div class="widget-title-group">
        <span class="widget-badge">Interactive DSP Lab</span>
        <h3 class="widget-title">FFT Spectrum, Windowing, Mel Scale &amp; 96 kHz Ultrasonics</h3>
      </div>
      <span class="status-pill ok" data-role="badge">48 kHz AUDIBLE</span>
    </div>
    <div class="widget-body">
      <div class="widget-controls-grid">
        <div class="widget-control">
          <label>Fundamental F0 <strong data-role="val-f0">440 Hz (A4)</strong></label>
          <input type="range" min="80" max="4000" step="10" value="440" data-control="f0">
        </div>
        <div class="widget-control">
          <label>Harmonic Distortion <strong data-role="val-harm">25%</strong></label>
          <input type="range" min="0" max="100" step="5" value="25" data-control="harm">
        </div>
        <div class="widget-control">
          <label>Noise Floor <strong data-role="val-noise">10%</strong></label>
          <input type="range" min="0" max="80" step="5" value="10" data-control="noise">
        </div>
        <div class="widget-control">
          <label>Ultrasonic Carrier <strong data-role="val-us">21.5 kHz</strong></label>
          <input type="range" min="0" max="42000" step="500" value="21500" data-control="us">
        </div>
      </div>
      <div class="widget-actions">
        <button type="button" class="widget-btn is-active" data-scale="log">Scale: LOG RTA</button>
        <button type="button" class="widget-btn" data-scale="lin">Scale: LINEAR</button>
        <button type="button" class="widget-btn" data-scale="mel">Scale: MEL-32</button>
        <button type="button" class="widget-btn is-active" data-rate="96000">Rate: 96 kHz (ALSA)</button>
        <button type="button" class="widget-btn" data-win="hann">Window: Hann</button>
      </div>
      <div class="widget-canvas-wrap">
        <canvas class="widget-canvas" data-role="canvas" aria-label="Interactive acoustic FFT spectrum"></canvas>
      </div>
      <div class="widget-readouts">
        <div class="readout-tile"><span class="readout-label">YIN Chromatic Pitch</span><span class="readout-value is-emerald" data-role="out-pitch">--</span></div>
        <div class="readout-tile"><span class="readout-label">Spectral Flatness</span><span class="readout-value is-cyan" data-role="out-flat">--</span></div>
        <div class="readout-tile"><span class="readout-label">Ultrasonic 18-48k</span><span class="readout-value is-magenta" data-role="out-us">--</span></div>
        <div class="readout-tile"><span class="readout-label">Nyquist Ceiling</span><span class="readout-value is-amber" data-role="out-nyq">--</span></div>
      </div>
    </div>
  </div>
`;

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function freqToNote(hz) {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const note = NOTES[((nearest % 12) + 12) % 12];
  const oct = Math.floor(nearest / 12) - 1;
  return `${note}${oct} (${cents >= 0 ? "+" : ""}${cents}c)`;
}

function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

export function mountAudioSpectrumLab(el) {
  el.innerHTML = TEMPLATE;
  const q = (s) => el.querySelector(s);
  const canvas = q('[data-role="canvas"]');
  const f0In = q('[data-control="f0"]');
  const harmIn = q('[data-control="harm"]');
  const noiseIn = q('[data-control="noise"]');
  const usIn = q('[data-control="us"]');
  const badge = q('[data-role="badge"]');
  const scaleBtns = Array.from(el.querySelectorAll("[data-scale]"));
  const rateBtn = q("[data-rate]");
  const winBtn = q("[data-win]");

  const state = { scale: "log", rate: 96000, win: "hann" };

  function render() {
    const f0 = Number(f0In.value);
    const harm = Number(harmIn.value) / 100;
    const noise = Number(noiseIn.value) / 100;
    const usFreq = Number(usIn.value);
    const nyq = state.rate / 2;

    q('[data-role="val-f0"]').textContent = `${f0} Hz (${freqToNote(f0).split(" ")[0]})`;
    q('[data-role="val-harm"]').textContent = `${Math.round(harm * 100)}%`;
    q('[data-role="val-noise"]').textContent = `${Math.round(noise * 100)}%`;
    q('[data-role="val-us"]').textContent = usFreq >= 18000 ? `${(usFreq / 1000).toFixed(1)} kHz` : "OFF";
    badge.textContent = state.rate >= 96000 ? "96 kHz ULTRASONIC" : "48 kHz AUDIBLE";

    const cols = 64;
    const fLo = 40;
    const fHi = state.scale === "mel" ? Math.min(7800, nyq) : nyq;
    const sidelobe = state.win === "hann" ? 0.04 : 0.16;
    const vals = new Float32Array(cols);
    let sumP = 0;
    let logSum = 0;

    for (let c = 0; c < cols; c++) {
      const t = (c + 0.5) / cols;
      let fc = fLo + (fHi - fLo) * t;
      if (state.scale === "log") fc = fLo * Math.pow(fHi / fLo, t);
      else if (state.scale === "mel") fc = melToHz(hzToMel(fLo) + (hzToMel(fHi) - hzToMel(fLo)) * t);

      let p = 1e-6 + noise * noise * 0.04 * (0.6 + 0.4 * Math.sin(c * 7.3));
      const bw = Math.max(45, fc * (state.scale === "lin" ? 0.025 : 0.06));
      for (let h = 1; h <= 4; h++) {
        const fh = f0 * h;
        if (fh > nyq) break;
        const amp = h === 1 ? 0.85 : (0.5 * harm) / h;
        const d = Math.abs(fc - fh) / bw;
        p += amp * amp * (Math.exp(-d * d * 2.2) + sidelobe / (1 + d * d * 4));
      }
      if (usFreq >= 18000 && usFreq <= nyq) {
        const d = Math.abs(fc - usFreq) / Math.max(250, bw);
        p += 0.35 * Math.exp(-d * d * 2.5);
      }
      const db = Math.max(-90, Math.min(0, 10 * Math.log10(p)));
      vals[c] = (db + 90) / 90;
      sumP += p;
      logSum += Math.log(Math.max(p, 1e-9));
    }

    const flatness = Math.min(1, Math.exp(logSum / cols) / Math.max(sumP / cols, 1e-9));
    q('[data-role="out-pitch"]').textContent = `${f0} Hz · ${freqToNote(f0)}`;
    q('[data-role="out-flat"]').textContent = `${flatness.toFixed(3)} (${flatness < 0.15 ? "Tonal" : "Broadband"})`;
    q('[data-role="out-nyq"]').textContent = `${(nyq / 1000).toFixed(0)} kHz`;
    if (usFreq >= 18000 && usFreq <= nyq) {
      const kind = usFreq <= 22500 ? "Ultrasonic Beacon" : "SMPS Coil Whine";
      q('[data-role="out-us"]').textContent = `${kind} @ ${(usFreq / 1000).toFixed(1)} kHz`;
    } else if (usFreq >= 18000 && usFreq > nyq) {
      q('[data-role="out-us"]').textContent = "HIDDEN (>24k Nyquist!)";
    } else {
      q('[data-role="out-us"]').textContent = "Quiet";
    }

    const { ctx, width, height } = setupHiDpiCanvas(canvas, 210);
    ctx.fillStyle = "#0b1117";
    ctx.fillRect(0, 0, width, height);

    // Highlight 18-48 kHz ultrasonic band when visible.
    if (fHi > 18000) {
      let usFrac = (18000 - fLo) / (fHi - fLo);
      if (state.scale === "log") usFrac = Math.log(18000 / fLo) / Math.log(fHi / fLo);
      const usX = Math.max(0, Math.floor(usFrac * (width - 24)) + 12);
      ctx.fillStyle = "rgba(232, 121, 249, 0.10)";
      ctx.fillRect(usX, 12, width - 12 - usX, height - 34);
      ctx.fillStyle = "#e879f9";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillText("18-48kHz ULTRASONIC", usX + 6, 26);
    }

    const padX = 12;
    const plotW = width - padX * 2;
    const plotH = height - 36;
    const colW = plotW / cols;
    for (let c = 0; c < cols; c++) {
      const h = Math.max(2, vals[c] * plotH);
      ctx.fillStyle = vals[c] > 0.72 ? "#f59e0b" : vals[c] > 0.45 ? "#10e191" : "#00d9ff";
      ctx.fillRect(padX + c * colW, height - 22 - h, Math.max(2, colW - 2), h);
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText("40 Hz", padX, height - 6);
    ctx.fillText(`${(fHi / 1000).toFixed(1)} kHz`, width - 64, height - 6);
  }

  [f0In, harmIn, noiseIn, usIn].forEach((i) => i.addEventListener("input", render));
  scaleBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      state.scale = btn.dataset.scale;
      scaleBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      render();
    })
  );
  rateBtn.addEventListener("click", () => {
    state.rate = state.rate === 96000 ? 48000 : 96000;
    rateBtn.textContent = state.rate === 96000 ? "Rate: 96 kHz (ALSA)" : "Rate: 48 kHz (PW)";
    rateBtn.classList.toggle("is-active", state.rate === 96000);
    render();
  });
  winBtn.addEventListener("click", () => {
    state.win = state.win === "hann" ? "rect" : "hann";
    winBtn.textContent = state.win === "hann" ? "Window: Hann" : "Window: Rectangular";
    render();
  });

  window.addEventListener("resize", render);
  render();
  return () => window.removeEventListener("resize", render);
}
