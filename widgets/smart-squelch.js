/**
 * Smart Squelch & Auto-Lock ML Spectrum Simulator Widget
 * Simulates a 36-bin Sub-GHz RSSI sweep with Welford warmup, EWMA baseline,
 * Burst-Freeze guard, adaptive Smart Squelch threshold, and Auto-Lock.
 */

import { setupHiDpiCanvas, gaussianNoise } from "./canvas.js";

const BINS = 36;
const BASE_FREQ_MHZ = 433.05;
const STEP_MHZ = 0.05;
const WARMUP_FRAMES = 5;
const SIGMA_MIN = 2.0;
const FREEZE_Z = 3.0;
const MIN_DBM = -115;
const MAX_DBM = -45;

const TEMPLATE = `
  <div class="widget-card">
    <div class="widget-header">
      <div class="widget-title-group">
        <span class="widget-badge">Interactive ML Lab</span>
        <h3 class="widget-title">Smart Squelch &amp; Auto-Lock Spectrum Simulator</h3>
      </div>
      <span class="status-pill ok" data-role="lock-pill">SCANNING</span>
    </div>
    <div class="widget-body">
      <div class="widget-canvas-wrap">
        <canvas class="widget-canvas" data-role="canvas" aria-label="36-bin RF spectrum with EWMA baseline and Smart Squelch threshold"></canvas>
      </div>
      <div class="widget-readouts">
        <div class="readout-tile"><span class="readout-label">Peak Bin / Freq</span><span class="readout-value is-cyan" data-role="peak-freq">--</span></div>
        <div class="readout-tile"><span class="readout-label">Peak RSSI</span><span class="readout-value" data-role="peak-rssi">--</span></div>
        <div class="readout-tile"><span class="readout-label">Peak Z-Score</span><span class="readout-value is-amber" data-role="peak-z">0.00 σ</span></div>
        <div class="readout-tile"><span class="readout-label">Auto-Lock Target</span><span class="readout-value is-emerald" data-role="lock-freq">None</span></div>
      </div>
      <div class="widget-controls-grid">
        <div class="widget-control"><label>Alpha (&alpha;) <strong data-role="val-alpha">0.03</strong></label><input type="range" min="0.01" max="0.20" step="0.01" value="0.03" data-control="alpha"></div>
        <div class="widget-control"><label>Squelch K <strong data-role="val-k">3.0</strong></label><input type="range" min="1.5" max="6.0" step="0.1" value="3.0" data-control="squelchK"></div>
        <div class="widget-control"><label>Lock Z <strong data-role="val-lockz">4.0</strong></label><input type="range" min="2.5" max="6.0" step="0.1" value="4.0" data-control="lockZ"></div>
      </div>
      <div class="widget-actions">
        <button type="button" class="widget-btn" data-toggle="interferer">Static Interferer (Bin 10, -64 dBm)</button>
        <button type="button" class="widget-btn" data-toggle="keyfob">Keyfob Burst (Bin 18, -58 dBm)</button>
        <button type="button" class="widget-btn is-active-emerald" data-toggle="freeze">Burst-Freeze Guard: ON</button>
        <button type="button" class="widget-btn" data-action="reset">Reset Baseline</button>
      </div>
      <p class="widget-note">
        Legend: <span style="color:#00d9ff">Cyan</span> = RSSI spectrum,
        <span style="color:#10e191">Green</span> = EWMA mean (&mu;<sub>i</sub>),
        <span style="color:#f59e0b">Amber</span> = Smart Squelch (&mu;<sub>i</sub> + k&sigma;<sub>i</sub>),
        <span style="color:#e879f9">Magenta</span> = Auto-Lock bin (z &ge; Lock Z).
      </p>
    </div>
  </div>
`;

function createState() {
  return {
    alpha: 0.03,
    squelchK: 3.0,
    lockZ: 4.0,
    staticInterferer: false,
    keyfobBurst: false,
    burstFreeze: true,
    frame: 0,
    mean: new Float64Array(BINS),
    m2: new Float64Array(BINS),
    variance: new Float64Array(BINS),
    rssi: new Float64Array(BINS),
    zScore: new Float64Array(BINS),
    lockedBin: -1,
    peakBin: 0,
    peakZ: 0,
    peakRssi: -100,
    timerId: null,
  };
}

function resetBaseline(state) {
  state.frame = 0;
  state.lockedBin = -1;
  state.mean.fill(-98.0);
  state.m2.fill(0);
  state.variance.fill(SIGMA_MIN * SIGMA_MIN);
  state.rssi.fill(-98.0);
  state.zScore.fill(0);
}

function sampleBinRssi(binIdx, staticInterferer, burstActive) {
  let sample = -98.5 + Math.sin(binIdx * 0.25) * 1.1 + gaussianNoise() * 1.9;
  if (staticInterferer) {
    if (binIdx === 10) sample = Math.max(sample, -64.0 + gaussianNoise() * 0.8);
    else if (Math.abs(binIdx - 10) === 1) sample = Math.max(sample, -82.0 + gaussianNoise() * 1.2);
  }
  if (burstActive) {
    if (binIdx === 18) sample = Math.max(sample, -58.0 + gaussianNoise() * 1.0);
    else if (Math.abs(binIdx - 18) === 1) sample = Math.max(sample, -76.0 + gaussianNoise() * 1.4);
  }
  return sample;
}

function updateBinBaseline(state, i, sample) {
  if (state.frame <= WARMUP_FRAMES) {
    const n = state.frame;
    if (n === 1) {
      state.mean[i] = sample;
      state.m2[i] = 0;
    } else {
      const delta = sample - state.mean[i];
      state.mean[i] += delta / n;
      state.m2[i] += delta * (sample - state.mean[i]);
    }
    const v = n > 1 ? state.m2[i] / (n - 1) : SIGMA_MIN * SIGMA_MIN;
    state.variance[i] = Math.max(v, SIGMA_MIN * SIGMA_MIN);
    state.zScore[i] = 0;
    return;
  }

  const sigma = Math.max(Math.sqrt(state.variance[i]), SIGMA_MIN);
  const z = (sample - state.mean[i]) / sigma;
  state.zScore[i] = z;

  // Burst-Freeze Invariant: strong anomalies must not poison EWMA mean/variance
  if (!(state.burstFreeze && z >= FREEZE_Z)) {
    const diff = sample - state.mean[i];
    state.mean[i] += state.alpha * diff;
    state.variance[i] = Math.max(
      (1 - state.alpha) * (state.variance[i] + state.alpha * diff * diff),
      SIGMA_MIN * SIGMA_MIN
    );
  }
}

function stepSimulation(state) {
  state.frame += 1;
  let bestBin = 0;
  let bestZ = -999;
  const burstActive = state.keyfobBurst && (state.frame % 12) < 7;

  for (let i = 0; i < BINS; i++) {
    const sample = sampleBinRssi(i, state.staticInterferer, burstActive);
    state.rssi[i] = sample;
    updateBinBaseline(state, i, sample);
    if (state.zScore[i] > bestZ) {
      bestZ = state.zScore[i];
      bestBin = i;
    }
  }

  state.peakBin = bestBin;
  state.peakZ = bestZ;
  state.peakRssi = state.rssi[bestBin];
  state.lockedBin = state.frame > WARMUP_FRAMES && bestZ >= state.lockZ ? bestBin : -1;
}

function drawDbmGrid(ctx, geom, yForDbm) {
  ctx.strokeStyle = "#172330";
  ctx.lineWidth = 1;
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "#6c829a";
  ctx.textAlign = "right";
  for (let dbm = -110; dbm <= -50; dbm += 15) {
    const y = yForDbm(dbm);
    ctx.beginPath();
    ctx.moveTo(geom.padL, y);
    ctx.lineTo(geom.width - geom.padR, y);
    ctx.stroke();
    ctx.fillText(`${dbm}`, geom.padL - 6, y + 4);
  }
}

function drawSpectrumBars(ctx, state, geom, yForDbm) {
  for (let i = 0; i < BINS; i++) {
    const x = geom.padL + i * geom.binW + 1.5;
    const bw = Math.max(2, geom.binW - 3);
    const y = yForDbm(state.rssi[i]);
    const h = geom.padT + geom.plotH - y;
    const sigma = Math.max(Math.sqrt(state.variance[i]), SIGMA_MIN);
    const thresh = state.mean[i] + state.squelchK * sigma;

    if (i === state.lockedBin) ctx.fillStyle = "rgba(232, 121, 249, 0.85)";
    else if (state.rssi[i] >= thresh && state.frame > WARMUP_FRAMES) ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
    else ctx.fillStyle = "rgba(0, 217, 255, 0.55)";
    ctx.fillRect(x, y, bw, Math.max(1, h));
  }
}

function drawOverlayLine(ctx, geom, yForDbm, valueAt, color, dashed) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashed ? [5, 4] : []);
  ctx.beginPath();
  for (let i = 0; i < BINS; i++) {
    const cx = geom.padL + (i + 0.5) * geom.binW;
    const cy = yForDbm(valueAt(i));
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawAutoLockMarker(ctx, state, geom) {
  if (state.lockedBin < 0) return;
  const lx = geom.padL + (state.lockedBin + 0.5) * geom.binW;
  ctx.strokeStyle = "#e879f9";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lx, geom.padT);
  ctx.lineTo(lx, geom.padT + geom.plotH);
  ctx.stroke();

  ctx.fillStyle = "#e879f9";
  ctx.textAlign = "center";
  ctx.fillText(`LOCK B${state.lockedBin}`, Math.min(geom.width - 44, Math.max(geom.padL + 36, lx)), geom.padT + 11);
}

function drawFreqAxis(ctx, geom) {
  ctx.fillStyle = "#6c829a";
  ctx.textAlign = "center";
  for (let i = 0; i < BINS; i += 6) {
    const cx = geom.padL + (i + 0.5) * geom.binW;
    const mhz = (BASE_FREQ_MHZ + i * STEP_MHZ).toFixed(2);
    ctx.fillText(`${mhz}`, cx, geom.height - 8);
  }
}

function drawSpectrum(canvas, state) {
  const { ctx, width, height } = setupHiDpiCanvas(canvas, 240);
  const padL = 44, padR = 14, padT = 16, padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const geom = { width, height, padL, padR, padT, plotH, binW: plotW / BINS };

  const yForDbm = (dbm) => {
    const clamped = Math.max(MIN_DBM, Math.min(MAX_DBM, dbm));
    return padT + plotH * (1 - (clamped - MIN_DBM) / (MAX_DBM - MIN_DBM));
  };

  ctx.fillStyle = "#080d12";
  ctx.fillRect(0, 0, width, height);

  drawDbmGrid(ctx, geom, yForDbm);
  drawSpectrumBars(ctx, state, geom, yForDbm);
  drawOverlayLine(ctx, geom, yForDbm, (i) => state.mean[i], "#10e191", false);
  drawOverlayLine(
    ctx,
    geom,
    yForDbm,
    (i) => state.mean[i] + state.squelchK * Math.max(Math.sqrt(state.variance[i]), SIGMA_MIN),
    "#f59e0b",
    true
  );
  drawAutoLockMarker(ctx, state, geom);
  drawFreqAxis(ctx, geom);
}

function renderSquelchReadouts(ui, state) {
  const peakMhz = (BASE_FREQ_MHZ + state.peakBin * STEP_MHZ).toFixed(2);
  ui.peakFreqEl.textContent = `Bin ${state.peakBin} (${peakMhz} MHz)`;
  ui.peakRssiEl.textContent = `${state.peakRssi.toFixed(1)} dBm`;
  ui.peakZEl.textContent = `${state.peakZ.toFixed(2)} σ`;

  if (state.frame <= WARMUP_FRAMES) {
    ui.lockFreqEl.textContent = `Warmup (${state.frame}/${WARMUP_FRAMES})`;
    ui.lockPillEl.textContent = "WARMUP";
    ui.lockPillEl.className = "status-pill warn";
  } else if (state.lockedBin >= 0) {
    const lockMhz = (BASE_FREQ_MHZ + state.lockedBin * STEP_MHZ).toFixed(2);
    ui.lockFreqEl.textContent = `Bin ${state.lockedBin} · ${lockMhz} MHz`;
    ui.lockPillEl.textContent = `AUTO-LOCK ${lockMhz} MHz`;
    ui.lockPillEl.className = "status-pill ok";
  } else {
    ui.lockFreqEl.textContent = "No Lock";
    ui.lockPillEl.textContent = "BASELINE TRACKING";
    ui.lockPillEl.className = "status-pill ok";
  }
}

function bindSquelchEvents(el, state) {
  const sliders = [
    ["alpha", "val-alpha", 2],
    ["squelchK", "val-k", 1],
    ["lockZ", "val-lockz", 1],
  ];
  for (const [key, role, digits] of sliders) {
    const out = el.querySelector(`[data-role="${role}"]`);
    el.querySelector(`[data-control="${key}"]`).addEventListener("input", (e) => {
      state[key] = parseFloat(e.target.value);
      out.textContent = state[key].toFixed(digits);
    });
  }

  const btnInterferer = el.querySelector('[data-toggle="interferer"]');
  btnInterferer.addEventListener("click", () => {
    state.staticInterferer = !state.staticInterferer;
    btnInterferer.classList.toggle("is-active-amber", state.staticInterferer);
  });

  const btnKeyfob = el.querySelector('[data-toggle="keyfob"]');
  btnKeyfob.addEventListener("click", () => {
    state.keyfobBurst = !state.keyfobBurst;
    btnKeyfob.classList.toggle("is-active-magenta", state.keyfobBurst);
  });

  const btnFreeze = el.querySelector('[data-toggle="freeze"]');
  btnFreeze.addEventListener("click", () => {
    state.burstFreeze = !state.burstFreeze;
    btnFreeze.textContent = `Burst-Freeze Guard: ${state.burstFreeze ? "ON" : "OFF"}`;
    btnFreeze.classList.toggle("is-active-emerald", state.burstFreeze);
  });

  el.querySelector('[data-action="reset"]').addEventListener("click", () => resetBaseline(state));
}

export function mountSmartSquelch(el) {
  const state = createState();
  resetBaseline(state);
  el.innerHTML = TEMPLATE;

  const ui = {
    canvas: el.querySelector('[data-role="canvas"]'),
    peakFreqEl: el.querySelector('[data-role="peak-freq"]'),
    peakRssiEl: el.querySelector('[data-role="peak-rssi"]'),
    peakZEl: el.querySelector('[data-role="peak-z"]'),
    lockFreqEl: el.querySelector('[data-role="lock-freq"]'),
    lockPillEl: el.querySelector('[data-role="lock-pill"]'),
  };

  bindSquelchEvents(el, state);

  const tick = () => {
    stepSimulation(state);
    drawSpectrum(ui.canvas, state);
    renderSquelchReadouts(ui, state);
  };

  tick();
  state.timerId = window.setInterval(tick, 180);

  return () => {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  };
}
