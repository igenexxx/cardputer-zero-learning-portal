/**
 * Interactive 1D Kalman Filter Foxhunt Radar Lab
 * Demonstrates CC1101 RSSI smoothing, Q/R tuning, Kalman gain K, and trend detection.
 */

import { setupHiDpiCanvas, gaussianNoise } from "./canvas.js";

const HISTORY_LEN = 90;
const MIN_DBM = -105;
const MAX_DBM = -25;
const TREND_EPS = 0.45;

function distanceToTrueDbm(meters) {
  const clamped = Math.max(1, Math.min(50, meters));
  return -32 - 34 * Math.log10(clamped);
}

function proximityPercent(dbm) {
  const pct = ((dbm - MIN_DBM) / (MAX_DBM - MIN_DBM)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function classifyTrend(velocity) {
  if (velocity >= TREND_EPS) return { label: "^CLOSER", cls: "good" };
  if (velocity <= -TREND_EPS) return { label: "vFARTHER", cls: "warn" };
  return { label: "=STEADY", cls: "muted" };
}

function stepKalman(state, zDbm) {
  if (!state.initialized) {
    state.x = zDbm;
    state.p = state.r;
    state.gain = 1;
    state.velocity = 0;
    state.initialized = true;
    return;
  }
  const prevX = state.x;
  const pPred = state.p + state.q;
  const k = pPred / (pPred + state.r);
  state.x = state.x + k * (zDbm - state.x);
  state.p = (1 - k) * pPred;
  state.gain = k;
  state.velocity = 0.7 * state.velocity + 0.3 * (state.x - prevX);
}

function dbmToY(dbm, height) {
  const padTop = 18;
  const padBot = 24;
  const t = (dbm - MIN_DBM) / (MAX_DBM - MIN_DBM);
  const clamped = Math.max(0, Math.min(1, t));
  return height - padBot - clamped * (height - padTop - padBot);
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px monospace";
  ctx.lineWidth = 1;
  for (const dbm of [-100, -80, -60, -40]) {
    const y = dbmToY(dbm, height);
    ctx.beginPath();
    ctx.moveTo(42, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();
    ctx.fillText(`${dbm}dB`, 4, y + 4);
  }
}

function drawSeries(ctx, series, width, height, color, lineWidth, dashed = false) {
  if (series.length < 2) return;
  const plotW = width - 54;
  const stepX = plotW / (HISTORY_LEN - 1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([4, 4]);
  ctx.beginPath();
  series.forEach((val, idx) => {
    const x = 42 + idx * stepX;
    const y = dbmToY(val, height);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function renderFoxhuntCanvas(canvas, state) {
  const { ctx, width, height } = setupHiDpiCanvas(canvas, 220);
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  drawSeries(ctx, state.trueHist, width, height, "rgba(148,163,184,0.45)", 1.2, true);
  drawSeries(ctx, state.rawHist, width, height, "rgba(245,158,11,0.55)", 1.3, false);
  drawSeries(ctx, state.kalmanHist, width, height, "#22d3ee", 2.4, false);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#f59e0b";
  ctx.fillText("RAW RSSI", 48, 13);
  ctx.fillStyle = "#22d3ee";
  ctx.fillText("KALMAN x_hat", 122, 13);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("TRUE PATH-LOSS", 224, 13);
}

function renderFoxhuntReadouts(els, state) {
  const trend = classifyTrend(state.velocity);
  const raw = state.rawHist[state.rawHist.length - 1] ?? MIN_DBM;
  els.rawVal.textContent = `${raw.toFixed(1)} dBm`;
  els.kalmanVal.textContent = `${state.x.toFixed(1)} dBm`;
  els.trendVal.textContent = trend.label;
  els.proxVal.textContent = `${proximityPercent(state.x)}%`;
  els.gainVal.textContent = state.gain.toFixed(3);
  els.distVal.textContent = `${state.distance.toFixed(1)} m`;
  els.qVal.textContent = state.q.toFixed(1);
  els.rVal.textContent = state.r.toFixed(1);
  els.jitVal.textContent = `±${state.jitter.toFixed(0)} dB`;
}

function buildFoxhuntMarkup() {
  return `
    <div class="widget-card">
      <div class="widget-header">
        <div>
          <h4 class="widget-title">Interactive Lab: 1D Kalman Filter Foxhunt Radar</h4>
          <p class="widget-subtitle">Walk closer/farther from a 433 MHz transmitter and tune Q (process) vs R (measurement) noise</p>
        </div>
        <div class="widget-actions">
          <button type="button" class="btn-secondary" data-action="walk">Auto-Walk: OFF</button>
          <button type="button" class="btn-secondary" data-action="reset">Reset Filter</button>
        </div>
      </div>
      <canvas class="widget-canvas" aria-label="Kalman Foxhunt RSSI graph"></canvas>
      <div class="widget-readouts">
        <div class="readout-item"><span>Raw RSSI</span><strong data-out="raw">--</strong></div>
        <div class="readout-item"><span>Kalman x̂</span><strong data-out="kalman">--</strong></div>
        <div class="readout-item"><span>Trend</span><strong data-out="trend">=STEADY</strong></div>
        <div class="readout-item"><span>Proximity</span><strong data-out="prox">0%</strong></div>
        <div class="readout-item"><span>Gain K</span><strong data-out="gain">--</strong></div>
      </div>
      <div class="widget-controls">
        <label>Distance <strong data-out="dist">15.0 m</strong>
          <input type="range" data-in="dist" min="1" max="50" step="0.5" value="15">
        </label>
        <label>Process Noise Q <strong data-out="q">1.2</strong>
          <input type="range" data-in="q" min="0.2" max="5.0" step="0.2" value="1.2">
        </label>
        <label>Meas. Noise R <strong data-out="r">18.0</strong>
          <input type="range" data-in="r" min="4" max="40" step="1" value="18">
        </label>
        <label>CC1101 Jitter <strong data-out="jit">±6 dB</strong>
          <input type="range" data-in="jit" min="1" max="12" step="1" value="6">
        </label>
      </div>
    </div>
  `;
}

function queryFoxhuntEls(container) {
  return {
    canvas: container.querySelector("canvas"),
    walkBtn: container.querySelector('[data-action="walk"]'),
    resetBtn: container.querySelector('[data-action="reset"]'),
    distIn: container.querySelector('[data-in="dist"]'),
    qIn: container.querySelector('[data-in="q"]'),
    rIn: container.querySelector('[data-in="r"]'),
    jitIn: container.querySelector('[data-in="jit"]'),
    rawVal: container.querySelector('[data-out="raw"]'),
    kalmanVal: container.querySelector('[data-out="kalman"]'),
    trendVal: container.querySelector('[data-out="trend"]'),
    proxVal: container.querySelector('[data-out="prox"]'),
    gainVal: container.querySelector('[data-out="gain"]'),
    distVal: container.querySelector('[data-out="dist"]'),
    qVal: container.querySelector('[data-out="q"]'),
    rVal: container.querySelector('[data-out="r"]'),
    jitVal: container.querySelector('[data-out="jit"]'),
  };
}

export function mountFoxhuntRadar(container) {
  container.innerHTML = buildFoxhuntMarkup();
  const els = queryFoxhuntEls(container);
  const state = {
    distance: 15,
    walkDir: -1,
    autoWalk: false,
    q: 1.2,
    r: 18.0,
    jitter: 6,
    initialized: false,
    x: -72,
    p: 18,
    gain: 0.25,
    velocity: 0,
    trueHist: [],
    rawHist: [],
    kalmanHist: [],
  };

  const resetFilter = () => {
    state.initialized = false;
    state.trueHist = [];
    state.rawHist = [];
    state.kalmanHist = [];
  };

  els.distIn.addEventListener("input", () => {
    state.distance = parseFloat(els.distIn.value);
  });
  els.qIn.addEventListener("input", () => {
    state.q = parseFloat(els.qIn.value);
  });
  els.rIn.addEventListener("input", () => {
    state.r = parseFloat(els.rIn.value);
  });
  els.jitIn.addEventListener("input", () => {
    state.jitter = parseFloat(els.jitIn.value);
  });
  els.walkBtn.addEventListener("click", () => {
    state.autoWalk = !state.autoWalk;
    els.walkBtn.textContent = `Auto-Walk: ${state.autoWalk ? "ON" : "OFF"}`;
  });
  els.resetBtn.addEventListener("click", resetFilter);

  const timer = setInterval(() => {
    if (state.autoWalk) {
      state.distance += state.walkDir * 0.65;
      if (state.distance <= 2) state.walkDir = 1;
      if (state.distance >= 42) state.walkDir = -1;
      els.distIn.value = state.distance.toFixed(1);
    }
    const trueDbm = distanceToTrueDbm(state.distance);
    const rawDbm = trueDbm + gaussianNoise() * (state.jitter * 0.65);
    stepKalman(state, rawDbm);
    state.trueHist.push(trueDbm);
    state.rawHist.push(rawDbm);
    state.kalmanHist.push(state.x);
    if (state.rawHist.length > HISTORY_LEN) {
      state.trueHist.shift();
      state.rawHist.shift();
      state.kalmanHist.shift();
    }
    renderFoxhuntCanvas(els.canvas, state);
    renderFoxhuntReadouts(els, state);
  }, 110);

  return () => clearInterval(timer);
}
