/**
 * On-Device Signal Type Classifier (12->24->5 MLP) Simulator Widget
 * Models softmax class probabilities across Fixed OOK, Rolling/KeyFob,
 * Sensor/Weather, CW/Jammer, and Noise classes.
 */

const CLASSES = [
  { name: "Fixed OOK", color: "#10e191" },
  { name: "Rolling/KeyFob", color: "#00d9ff" },
  { name: "Sensor/Weather", color: "#f59e0b" },
  { name: "CW/Jammer", color: "#e879f9" },
  { name: "Noise", color: "#ef4444" },
];

const PRESETS = {
  fixed: { te: 350, ratio: 3.0, frameLen: 48, duty: 45, jitter: 5, snr: 34, glitch: 1 },
  rolling: { te: 380, ratio: 2.0, frameLen: 148, duty: 50, jitter: 7, snr: 32, glitch: 2 },
  sensor: { te: 850, ratio: 2.5, frameLen: 54, duty: 24, jitter: 8, snr: 22, glitch: 3 },
  jammer: { te: 900, ratio: 1.5, frameLen: 24, duty: 88, jitter: 6, snr: 38, glitch: 2 },
  noise: { te: 220, ratio: 2.8, frameLen: 60, duty: 42, jitter: 55, snr: 4, glitch: 42 },
};

const SLIDER_KEYS = ["te", "frameLen", "duty", "jitter", "snr", "glitch"];

const TEMPLATE = `
  <div class="widget-card">
    <div class="widget-header">
      <div class="widget-title-group">
        <span class="widget-badge">Interactive ML Lab</span>
        <h3 class="widget-title">On-Device PulseNet-RF (28 Protocols + 5 Coarse Classes)</h3>
      </div>
      <span class="status-pill ok" data-role="cls-pill">Fixed OOK</span>
    </div>
    <div class="widget-body">
      <div class="widget-actions">
        <button type="button" class="widget-btn is-active" data-preset="fixed">Garage Remote (Fixed OOK)</button>
        <button type="button" class="widget-btn" data-preset="rolling">Car KeyFob (Rolling)</button>
        <button type="button" class="widget-btn" data-preset="sensor">Weather Sensor</button>
        <button type="button" class="widget-btn" data-preset="jammer">CW / Jammer</button>
        <button type="button" class="widget-btn" data-preset="noise">Urban Noise</button>
      </div>
      <div class="widget-controls-grid">
        <div class="widget-control">
          <label>Base TE <strong data-v="te">350 µs</strong></label>
          <input type="range" min="150" max="1400" step="10" value="350" data-s="te">
        </div>
        <div class="widget-control">
          <label>Pulses / Frame <strong data-v="frameLen">48</strong></label>
          <input type="range" min="12" max="180" step="2" value="48" data-s="frameLen">
        </div>
        <div class="widget-control">
          <label>Duty Cycle <strong data-v="duty">45%</strong></label>
          <input type="range" min="10" max="98" step="1" value="45" data-s="duty">
        </div>
        <div class="widget-control">
          <label>Timing Jitter <strong data-v="jitter">5%</strong></label>
          <input type="range" min="0" max="80" step="1" value="5" data-s="jitter">
        </div>
        <div class="widget-control">
          <label>SNR <strong data-v="snr">34 dB</strong></label>
          <input type="range" min="0" max="50" step="1" value="34" data-s="snr">
        </div>
        <div class="widget-control">
          <label>Glitch Rate <strong data-v="glitch">1%</strong></label>
          <input type="range" min="0" max="70" step="1" value="1" data-s="glitch">
        </div>
      </div>
      <div class="widget-subpanel" data-role="pulsenet-meta" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;font-family:var(--font-mono);font-size:0.8rem;"></div>
      <div class="widget-subpanel" data-role="prob-bars"></div>
    </div>
  </div>
`;

function formatSliderValue(key, val) {
  if (key === "te") return `${val} µs`;
  if (key === "snr") return `${val} dB`;
  if (key === "frameLen") return `${val}`;
  return `${val}%`;
}

function scoreClasses(s) {
  const z = [
    // Fixed OOK: 20..60 pulses/frame, TE < 500, low jitter, moderate duty, good SNR
    3.4 - Math.abs(s.frameLen - 44) / 22 - Math.max(0, s.te - 520) / 180 - s.jitter / 12 - s.glitch / 15 + (s.snr - 12) / 20 - Math.max(0, s.duty - 65) / 12,
    // Rolling/KeyFob: 110..180 pulses/frame, TE < 500, low jitter, good SNR
    3.8 - Math.abs(s.frameLen - 145) / 35 - Math.max(0, s.te - 520) / 180 - s.jitter / 14 - s.glitch / 15 + (s.snr - 12) / 22 - Math.max(0, s.duty - 68) / 12,
    // Sensor/Weather: wide TE (550..1400), low duty cycle (12..36%)
    3.3 - Math.abs(s.te - 880) / 320 - Math.abs(s.duty - 24) / 16 - s.jitter / 16 - s.glitch / 18 + (s.snr - 8) / 25,
    // CW/Jammer: high duty cycle (>72%), high SNR, low jitter
    -1.2 + (s.duty - 62) / 7 + (s.snr - 15) / 22 - s.jitter / 18 - s.glitch / 16,
    // Noise: high jitter (>30%), high glitch rate, low SNR
    -1.8 + s.jitter / 11 + s.glitch / 10 + (16 - s.snr) / 9,
  ];
  const m = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function findBestClassIndex(probs) {
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }
  return bestIdx;
}

function buildProbBarsHtml(probs, bestIdx) {
  return CLASSES.map((c, i) => {
    const w = (probs[i] * 100).toFixed(1);
    return `
      <div style="display:grid;grid-template-columns:130px 1fr 54px;gap:10px;align-items:center;margin:6px 0;">
        <span style="font-size:0.84rem;color:${i === bestIdx ? c.color : "#94a3b8"};font-weight:${i === bestIdx ? 700 : 500};">${c.name}</span>
        <div style="height:10px;background:#080d12;border:1px solid #1e293b;border-radius:999px;overflow:hidden;">
          <div style="width:${w}%;height:100%;background:${c.color};transition:width 140ms ease;"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:0.8rem;text-align:right;">${w}%</span>
      </div>`;
  }).join("");
}

function inferFineProtocol(bestIdx, s) {
  if (bestIdx === 0) {
    if (s.frameLen <= 30) return "CAME_12";
    return s.te <= 420 ? "Princeton" : "Nice_FLO";
  }
  if (bestIdx === 1) return s.te >= 550 ? "Somfy_Telis_RTS" : "KeeLoq_HCS301";
  if (bestIdx === 2) return s.te >= 650 ? "Oregon_Weather" : "TPMS_Sensor";
  if (bestIdx === 3) return "CW_Jammer";
  return "EMI_Atmospheric_Noise";
}

function renderClassification(ui, state) {
  const probs = scoreClasses(state);
  const bestIdx = findBestClassIndex(probs);
  const best = CLASSES[bestIdx];
  const pct = (probs[bestIdx] * 100).toFixed(1);
  const guardNote = bestIdx === 4 && probs[bestIdx] >= 0.75 ? " · SAVE BLOCKED" : "";
  const fineProto = inferFineProtocol(bestIdx, state);
  const denoiserMode = state.jitter >= 22 || state.glitch >= 15
    ? "PN-CLEAN (1D-UNet AGC Rescue)"
    : (state.jitter >= 10 ? "ML-CLEAN (1D K-Means)" : "Pass-1 Direct Decode");

  ui.pill.textContent = `${best.name} (${pct}%)${guardNote}`;
  ui.pill.className = `status-pill ${bestIdx === 4 ? "err" : "ok"}`;
  ui.metaEl.innerHTML = `
    <span>PulseNet-RF Fine: <strong style="color:${best.color};">${fineProto}</strong></span>
    <span>Denoiser: <strong style="color:#e879f9;">${denoiserMode}</strong></span>
    <span>Embed: <strong>32D SupCon INT8</strong></span>`;
  ui.barsEl.innerHTML = buildProbBarsHtml(probs, bestIdx);
}

function bindClassifierEvents(el, state, onRender) {
  for (const key of SLIDER_KEYS) {
    const inp = el.querySelector(`[data-s="${key}"]`);
    const out = el.querySelector(`[data-v="${key}"]`);
    inp.addEventListener("input", () => {
      state[key] = Number(inp.value);
      out.textContent = formatSliderValue(key, state[key]);
      onRender();
    });
  }

  const presetBtns = [...el.querySelectorAll("[data-preset]")];
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      presetBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      Object.assign(state, PRESETS[btn.dataset.preset]);
      for (const key of SLIDER_KEYS) {
        el.querySelector(`[data-s="${key}"]`).value = String(state[key]);
        el.querySelector(`[data-v="${key}"]`).textContent = formatSliderValue(key, state[key]);
      }
      onRender();
    });
  });
}

export function mountSignalClassifier(el) {
  const state = { ...PRESETS.fixed };
  el.innerHTML = TEMPLATE;

  const ui = {
    pill: el.querySelector('[data-role="cls-pill"]'),
    metaEl: el.querySelector('[data-role="pulsenet-meta"]'),
    barsEl: el.querySelector('[data-role="prob-bars"]'),
  };
  const onRender = () => renderClassification(ui, state);

  bindClassifierEvents(el, state, onRender);
  onRender();
  return null;
}
