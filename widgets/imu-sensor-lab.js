/**
 * Interactive 9-DoF IMU Sensor Lab (v0.3.0):
 * 1) 3D Artificial Horizon & Madgwick Fusion, 2) 100 Hz Vibration FFT & ISO 10816,
 * 3) Magnetic Metal/Tracker Finder (IMUMagAnomalyAE) & STA/LTA Tamper (IMUTamperNet-1D),
 * 4) Dual-Modal Tap X-Ray (IMUTapNet-1D) & 3D Air-Writing Magic Wand (IMUGestureNet-1D).
 * Pure ES Module — zero build step, zero external dependencies.
 */

import { setupHiDpiCanvas, gaussianNoise } from "./canvas.js";

const VIB_PRESETS = [
  { name: "Quiet Desk", peaks: [], floor: 0.015, crest: 1.45, velScale: 0.28, mlClass: "Quiet_Idle", shaper: "None needed (no mechanical resonance)" },
  { name: "Balanced Fan (1800 RPM)", peaks: [{ f: 30, a: 0.24, w: 1.4 }, { f: 15, a: 0.05, w: 1.6 }], floor: 0.025, crest: 1.52, velScale: 1.15, mlClass: "Balanced_Spin", shaper: "ZV @ 30.0 Hz (Resid: 1.8% · MaxAcc: 4200 mm/s²)" },
  { name: "Imbalanced Fan (1500 RPM)", peaks: [{ f: 25, a: 0.92, w: 1.7 }, { f: 48, a: 0.26, w: 1.8 }], floor: 0.04, crest: 1.68, velScale: 5.4, mlClass: "Rotor_Imbalance", shaper: "Balance rotor blades first (1× RPM spike @ 25.0 Hz)" },
  { name: "Bearing Wear (Spalling)", peaks: [{ f: 18, a: 0.34, w: 2.2 }, { f: 34, a: 0.56, w: 3.4 }, { f: 44, a: 0.68, w: 4.1 }], floor: 0.22, crest: 4.35, velScale: 7.9, mlClass: "Bearing_Wear", shaper: "Inspect/replace bearing (broadband 30–48 Hz + high CF)" },
  { name: "K1C 3D-Printer 42 Hz Ringing", peaks: [{ f: 42, a: 0.88, w: 2.4 }, { f: 21, a: 0.14, w: 2.0 }], floor: 0.035, crest: 2.25, velScale: 3.6, mlClass: "Printer_Ringing", shaper: "MZV @ 42.0 Hz (Resid: 2.1% · MaxAcc: 5200 mm/s²)" },
];

const MAG_TRIGGERS = {
  earth: { btn: "Earth Field", label: "EARTH FIELD (CLEAN)", color: "#10e191", magDelta: 0.4, acRipple: 0.3, stalta: 1.05, aeZ: 0.65, fault: "Nominal geomagnetic vector", probs: [0.94, 0.02, 0.01, 0.01, 0.01, 0.01] },
  stud: { btn: "Wall Stud", label: "WALL STUD (FERROUS)", color: "#00d9ff", magDelta: 28.0, acRipple: 0.6, stalta: 1.15, aeZ: 3.85, fault: "Ferrous Field Distortion (Stud / Metal)", probs: [0.89, 0.04, 0.02, 0.02, 0.01, 0.02] },
  magnet: { btn: "Hidden Magnet/Tracker", label: "HIDDEN MAGNET / TRACKER", color: "#ef4444", magDelta: 115.0, acRipple: 0.8, stalta: 1.25, aeZ: 5.45, fault: "Strong Dipole Spike (Hidden Magnet / Tracker)", probs: [0.87, 0.04, 0.03, 0.02, 0.02, 0.02] },
  acwire: { btn: "AC Wire", label: "50/60 Hz LIVE AC WIRE", color: "#e879f9", magDelta: 18.0, acRipple: 16.5, stalta: 1.10, aeZ: 4.15, fault: "50/60 Hz AC Electromagnetic Ripple (Live Wire)", probs: [0.91, 0.03, 0.02, 0.01, 0.01, 0.02] },
  footstep: { btn: "Footstep", label: "FLOOR FOOTSTEP", color: "#f59e0b", magDelta: 0.8, acRipple: 0.4, stalta: 2.55, aeZ: 0.80, fault: "Nominal geomagnetic vector", probs: [0.08, 0.80, 0.06, 0.02, 0.01, 0.03] },
  knock: { btn: "Knock", label: "DESK KNOCK (JERK)", color: "#38bdf8", magDelta: 1.1, acRipple: 0.5, stalta: 4.80, aeZ: 0.92, fault: "Nominal geomagnetic vector", probs: [0.03, 0.06, 0.84, 0.04, 0.02, 0.01] },
  pickup: { btn: "Pickup Theft", label: "PICKUP THEFT (TAMPER!)", color: "#ef4444", magDelta: 14.5, acRipple: 1.2, stalta: 6.40, aeZ: 2.85, fault: "Rapid orientation shift through Earth field", probs: [0.02, 0.03, 0.04, 0.86, 0.03, 0.02] },
};

const TAMPER_CLASSES = [
  { name: "Resting_Still", color: "#10e191" }, { name: "Footstep_Floor", color: "#f59e0b" },
  { name: "Desk_Knock", color: "#00d9ff" }, { name: "Pickup_Theft", color: "#ef4444" },
  { name: "Drop_Impact", color: "#e879f9" }, { name: "Pocket_Walk", color: "#94a3b8" },
];

const TAP_PRESETS = {
  concrete: { label: "Solid Concrete", mlClass: "Solid_Concrete", tauMs: 26, f0Hz: 44, hollowPct: 12, chatter: 0, color: "#10e191", note: "High mass & heavy damping — sharp impulse dies within ~26 ms." },
  drywall: { label: "Hollow Drywall", mlClass: "Hollow_Drywall", tauMs: 118, f0Hz: 28, hollowPct: 76, chatter: 0, color: "#00d9ff", note: "Clamped drywall bay rings at ~28 Hz drum mode with slow τ decay." },
  drum: { label: "Empty Drum", mlClass: "Empty_Tank_Drum", tauMs: 195, f0Hz: 21, hollowPct: 93, chatter: 0, color: "#e879f9", note: "Low-frequency metallic/tank resonance sustains >180 ms ring-down." },
  loose: { label: "Loose Joint", mlClass: "Loose_Joint", tauMs: 88, f0Hz: 35, hollowPct: 62, chatter: 0.48, color: "#f59e0b", note: "Unbonded tile/bracket produces secondary rattle spikes in the decay tail." },
};

const WAND_SPELLS = {
  Circle_CW: { label: "Circle_CW", conf: 97, color: "#00d9ff", action: "ir-studio → ir_transmit_button (TV Power)", pts: (u) => [Math.cos(u * Math.PI * 2 - Math.PI / 2), Math.sin(u * Math.PI * 2 - Math.PI / 2), 0.22 * Math.sin(u * Math.PI * 2)] },
  Figure_8: { label: "Figure_8", conf: 95, color: "#e879f9", action: "imu-studio → imu_blackbox_control (dump_now)", pts: (u) => [Math.sin(u * Math.PI * 2), 0.65 * Math.sin(u * Math.PI * 4), 0.25 * Math.cos(u * Math.PI * 2)] },
  Z_Slash: { label: "Z_Slash", conf: 96, color: "#f59e0b", action: "wifi-studio → wifi_wol_send (Wake Workstation)", pts: (u) => (u < 0.33 ? [-0.9 + (u / 0.33) * 1.8, -0.8, -0.15] : u < 0.67 ? [0.9 - ((u - 0.33) / 0.34) * 1.8, -0.8 + ((u - 0.33) / 0.34) * 1.6, 0.2 * Math.sin((u - 0.33) * Math.PI * 3)] : [-0.9 + ((u - 0.67) / 0.33) * 1.8, 0.8, 0.15]) },
  Checkmark: { label: "Checkmark", conf: 98, color: "#10e191", action: "imu-studio → imu_tamper_arm (Silent Guard ON)", pts: (u) => (u < 0.38 ? [-0.85 + (u / 0.38) * 0.65, 0.05 + (u / 0.38) * 0.75, -0.1] : [-0.2 + ((u - 0.38) / 0.62) * 1.15, 0.8 - ((u - 0.38) / 0.62) * 1.65, 0.22 * ((u - 0.38) / 0.62)]) },
};

const eulerToQuat = (rD, pD, yD) => {
  const [r, p, y] = [rD, pD, yD].map((d) => (d * Math.PI) / 360);
  const [cr, sr, cp, sp, cy, sy] = [Math.cos(r), Math.sin(r), Math.cos(p), Math.sin(p), Math.cos(y), Math.sin(y)];
  return [cr * cp * cy + sr * sp * sy, sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * cp * cy];
};

const isoGradeForVelocity = (v) => (v < 0.71 ? { grade: "A", label: "GOOD", color: "#10e191" } : v < 1.8 ? { grade: "B", label: "SATISFACTORY", color: "#00d9ff" } : v < 4.5 ? { grade: "C", label: "MONITOR", color: "#f59e0b" } : v < 7.1 ? { grade: "D", label: "WARNING", color: "#fb923c" } : { grade: "F", label: "CRITICAL", color: "#ef4444" });

const statCard = (t, v, s, c) => `<div style="background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:7px 9px;font-family:monospace;font-size:12px;"><div style="color:#94a3b8;font-size:10px;">${t}</div><div style="color:${c};font-weight:700;font-size:14px;margin-top:2px;">${v}</div><div style="color:#94a3b8;font-size:10px;">${s}</div></div>`;

function buildMarkup() {
  const btn = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;";
  const sel = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:12px;";
  const box = "font-family:monospace;font-size:12px;background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:8px 10px;";
  const row = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;";
  const cvs = "width:100%;display:block;border:1px solid #1e293b;border-radius:6px;background:#0b1117;margin-bottom:10px;";
  const grid = "display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:8px;";
  const mkBtns = (attr, obj, lblKey) => Object.entries(obj).map(([k, v]) => `<button type="button" data-${attr}="${k}" style="${btn}color:${v.color};border-color:${v.color};">${v[lblKey]}</button>`).join("");
  return `<div class="lab-card" style="padding:16px;border:1px solid #1e293b;border-radius:10px;background:#0f1722;">
    <div style="${row}margin-bottom:12px;"><strong style="color:#00d9ff;font-size:15px;">9-DoF IMU Sensor, FFT, Seismograph, Tap X-Ray &amp; 3D Wand Lab</strong>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" data-tab="horizon" style="${btn}">1. 3D Horizon &amp; Madgwick</button>
        <button type="button" data-tab="fft" style="${btn}">2. 100 Hz Vibration FFT</button>
        <button type="button" data-tab="seismo" style="${btn}">3. Magnetics &amp; Tamper</button>
        <button type="button" data-tab="xraywand" style="${btn}">4. Tap X-Ray &amp; 3D Wand</button>
      </div></div>
    <section data-panel="horizon">
      <div style="${row}"><span style="color:#10e191;font-weight:600;font-size:13px;">Aviation Artificial Horizon, 2D Bubble Level &amp; Madgwick Quaternion Fusion</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="imu-drift-btn" style="${btn}color:#10e191;border-color:#10e191;">Madgwick AHRS: ON (Zero Drift)</button>
          <button type="button" class="imu-tare-btn" style="${btn}">Zero / Level</button>
        </div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">Pitch: <strong class="imu-pitch-val" style="color:#00d9ff;">0.0&deg;</strong><input class="imu-pitch" type="range" min="-45" max="45" step="0.5" value="0" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Roll: <strong class="imu-roll-val" style="color:#10e191;">0.0&deg;</strong><input class="imu-roll" type="range" min="-60" max="60" step="0.5" value="0" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Yaw (Compass): <strong class="imu-yaw-val" style="color:#f59e0b;">045&deg;</strong><input class="imu-yaw" type="range" min="0" max="359" step="1" value="45" style="width:100%;" /></label>
      </div>
      <canvas class="imu-hor-canvas" style="${cvs}height:225px;"></canvas>
      <div class="imu-hor-out" style="${box}color:#cbd5e1;"></div>
    </section>
    <section data-panel="fft" hidden>
      <div style="${row}"><span style="color:#00d9ff;font-weight:600;font-size:13px;">100 Hz Hann-Windowed Vibration FFT (0–50 Hz), ISO 10816-3 &amp; Input Shaper</span>
        <select class="imu-vib-preset" style="${sel}">${VIB_PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">Vibration Gain: <strong class="imu-gain-val" style="color:#f59e0b;">1.0×</strong><input class="imu-vib-gain" type="range" min="0.4" max="2.0" step="0.1" value="1.0" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Frequency Shift: <strong class="imu-shift-val" style="color:#e879f9;">0.0 Hz</strong><input class="imu-vib-shift" type="range" min="-8" max="6" step="0.5" value="0" style="width:100%;" /></label>
      </div>
      <canvas class="imu-fft-canvas" style="${cvs}height:215px;"></canvas>
      <div class="imu-fft-cards" style="${grid}"></div>
      <div class="imu-fft-shaper" style="${box}"></div>
    </section>
    <section data-panel="seismo" hidden>
      <div style="${row}"><span style="color:#10e191;font-weight:600;font-size:13px;">Magnetic Metal/Tracker Finder (IMUMagAnomalyAE) &amp; STA/LTA Tamper Lab</span>
        <button type="button" class="imu-pause-btn" style="${btn}color:#94a3b8;">Pause</button></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">${mkBtns("trig", MAG_TRIGGERS, "btn")}</div>
      <canvas class="imu-seis-canvas" style="${cvs}height:210px;"></canvas>
      <div class="imu-ae-bar" style="height:10px;background:#0b1117;border:1px solid #1e293b;border-radius:999px;overflow:hidden;position:relative;margin-bottom:8px;"></div>
      <div class="imu-seis-status" style="${box}margin-bottom:8px;"></div>
      <div class="imu-tamper-probs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;"></div>
    </section>
    <section data-panel="xraywand" hidden>
      <div style="${row}"><span style="color:#e879f9;font-weight:600;font-size:13px;">Dual-Modal Tap X-Ray (IMUTapNet-1D) &amp; 3D Air-Writing Magic Wand (IMUGestureNet-1D)</span>
        <div style="display:flex;gap:6px;">
          <button type="button" data-xwmode="tap" style="${btn}">Tap X-Ray</button>
          <button type="button" data-xwmode="wand" style="${btn}">3D Magic Wand</button>
        </div></div>
      <div class="imu-tap-bar" style="${row}">
        <div style="display:flex;gap:5px;flex-wrap:wrap;">${mkBtns("tap", TAP_PRESETS, "label")}</div>
        <label style="font-size:12px;color:#94a3b8;">BMM150 Stud ΔµT: <strong class="imu-stud-val" style="color:#00d9ff;">2 µT</strong><input class="imu-stud-mag" type="range" min="0" max="60" step="1" value="2" style="width:120px;vertical-align:middle;margin-left:6px;" /></label>
      </div>
      <div class="imu-wand-bar" style="${row}" hidden>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">${mkBtns("spell", WAND_SPELLS, "label")}</div>
        <button type="button" class="imu-wand-replay" style="${btn}">Replay 3D Cast</button>
      </div>
      <canvas class="imu-xw-canvas" style="${cvs}height:220px;"></canvas>
      <div class="imu-xw-cards" style="${grid}"></div>
      <div class="imu-xw-note" style="${box}color:#cbd5e1;"></div>
    </section></div>`;
}

function drawHorizonCanvas(canvas, pitch, roll, yaw, driftMode, driftErr) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 225);
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
  const splitX = Math.floor(w * 0.6), cx = Math.floor(splitX / 2), cy = Math.floor(h / 2) + 8, rHor = Math.min(cx - 18, h / 2 - 22);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rHor, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate((-roll * Math.PI) / 180);
  const pitchPx = (pitch / 45) * rHor * 0.9;
  ctx.fillStyle = "#0c3559"; ctx.fillRect(-rHor * 2, -rHor * 2 + pitchPx, rHor * 4, rHor * 2);
  ctx.fillStyle = "#3f2718"; ctx.fillRect(-rHor * 2, pitchPx, rHor * 4, rHor * 2);
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-rHor * 2, pitchPx); ctx.lineTo(rHor * 2, pitchPx); ctx.stroke();
  ctx.font = "9px monospace"; ctx.fillStyle = "#e2e8f0";
  for (const deg of [-30, -20, -10, 10, 20, 30]) {
    const py = pitchPx - (deg / 45) * rHor * 0.9, half = deg % 20 === 0 ? 24 : 14;
    ctx.strokeStyle = "rgba(226,232,240,0.75)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-half, py); ctx.lineTo(half, py); ctx.stroke();
    if (deg % 20 === 0) ctx.fillText(`${Math.abs(deg)}`, half + 4, py + 3);
  }
  ctx.restore();
  ctx.strokeStyle = driftMode ? "#f59e0b" : "#00d9ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, rHor, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.beginPath();
  ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 9, cy); ctx.lineTo(cx - 9, cy + 5);
  ctx.moveTo(cx + 26, cy); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx + 9, cy + 5); ctx.stroke();
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#121a23"; ctx.fillRect(cx - 48, 6, 96, 16); ctx.strokeStyle = "#1e293b"; ctx.strokeRect(cx - 48, 6, 96, 16);
  ctx.fillStyle = "#00d9ff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
  ctx.fillText(`HDG ${String(Math.round((yaw + 360) % 360)).padStart(3, "0")}°`, cx, 18);
  const bx = splitX + Math.floor((w - splitX) / 2), rBub = Math.min((w - splitX) / 2 - 20, rHor - 4), level = Math.hypot(pitch, roll) < 1.2;
  ctx.fillStyle = "#121a23"; ctx.beginPath(); ctx.arc(bx, cy, rBub, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = level ? "#10e191" : "#334155"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, cy, rBub * 0.45, 0, Math.PI * 2);
  ctx.moveTo(bx - rBub, cy); ctx.lineTo(bx + rBub, cy); ctx.moveTo(bx, cy - rBub); ctx.lineTo(bx, cy + rBub); ctx.stroke();
  const dx = Math.max(-rBub + 10, Math.min(rBub - 10, (roll / 35) * (rBub - 10)));
  const dy = Math.max(-rBub + 10, Math.min(rBub - 10, (-pitch / 35) * (rBub - 10)));
  ctx.fillStyle = level ? "rgba(16,225,145,0.85)" : "rgba(0,217,255,0.82)"; ctx.beginPath(); ctx.arc(bx + dx, cy + dy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px monospace"; ctx.fillText(level ? "LEVEL LOCK" : "2D BUBBLE", bx, 18);
  if (driftMode) { ctx.fillStyle = "#f59e0b"; ctx.font = "10px monospace"; ctx.fillText(`RAW GYRO DRIFT: +${driftErr.toFixed(1)}°`, bx, h - 8); }
  ctx.textAlign = "left";
}

function synthesizeFFT(preset, gain, shiftHz) {
  const bins = 64, mags = new Float32Array(bins); let peakBin = 1, peakVal = 0;
  for (let i = 1; i < bins; i++) {
    const f = (i / (bins - 1)) * 50; let v = preset.floor * (0.75 + Math.random() * 0.5);
    for (const pk of preset.peaks) v += pk.a * Math.exp(-(((f - Math.max(4, Math.min(48, pk.f + shiftHz))) / pk.w) ** 2));
    mags[i] = v * gain; if (mags[i] > peakVal) { peakVal = mags[i]; peakBin = i; }
  }
  return { mags, peakHz: (peakBin / (bins - 1)) * 50, velMmS: preset.velScale * gain * (1 + (Math.random() - 0.5) * 0.04) };
}

function drawFFTCanvas(canvas, mags, peakHz, gradeColor) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 215);
  const [padL, padR, padT, padB] = [38, 16, 20, 28], [plotW, plotH] = [w - padL - padR, h - padT - padB];
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h); ctx.font = "10px monospace";
  for (let g = 0; g <= 4; g++) {
    const y = padT + (g / 4) * plotH;
    ctx.strokeStyle = "#1e293b"; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = "#64748b"; ctx.fillText(`${(2.0 - g * 0.5).toFixed(1)}g`, 4, y + 3);
  }
  ctx.fillStyle = "rgba(0,217,255,0.05)"; ctx.fillRect(padL + (10 / 50) * plotW, padT, w - padR - (padL + (10 / 50) * plotW), plotH);
  const barW = Math.max(2, plotW / mags.length - 1);
  for (let i = 1; i < mags.length; i++) {
    const f = (i / (mags.length - 1)) * 50, bh = Math.min(plotH - 2, (mags[i] / 2.0) * plotH);
    ctx.fillStyle = Math.abs(f - peakHz) < 1.2 ? gradeColor : f >= 10 ? "#00d9ff" : "#475569";
    ctx.fillRect(padL + (i / mags.length) * plotW, padT + plotH - bh, barW, bh);
  }
  const px = padL + (peakHz / 50) * plotW;
  ctx.strokeStyle = gradeColor; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + plotH); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = gradeColor; ctx.fillText(`PEAK ${peakHz.toFixed(1)} Hz (${Math.round(peakHz * 60)} RPM)`, Math.min(w - 175, Math.max(padL + 4, px - 50)), padT - 5);
  ctx.fillStyle = "#94a3b8"; for (const f of [0, 10, 20, 30, 40, 50]) ctx.fillText(`${f}Hz`, padL + (f / 50) * plotW - 10, h - 8);
}

function drawSeismoCanvas(canvas, magBuf, staBuf, activeColor) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 210);
  const [padL, padR, padT, padB, topH] = [46, 14, 14, 22, 86], [plotW, botY] = [w - padL - padR, padT + topH + 16], botH = h - botY - padB;
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1e293b"; ctx.strokeRect(padL, padT, plotW, topH); ctx.strokeRect(padL, botY, plotW, botH);
  ctx.font = "10px monospace"; ctx.fillStyle = "#94a3b8";
  ctx.fillText("ΔµT", 8, padT + 14); ctx.fillText("STA/LTA", 2, botY + 14); ctx.fillText("Live Magnetic Anomaly & Seismograph Window (6.4 s)", padL + 6, h - 6);
  const plotLine = (buf, maxV, y0, bh, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    buf.forEach((v, i) => { const x = padL + (i / (buf.length - 1)) * plotW, y = y0 + bh - 4 - Math.min(1, Math.max(0, v / maxV)) * (bh - 10); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke();
  };
  plotLine(magBuf, 130, padT, topH, "#00d9ff");
  const gateY = botY + botH - 4 - (3.0 / 7.5) * (botH - 10);
  ctx.strokeStyle = "rgba(239,68,68,0.55)"; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(padL, gateY); ctx.lineTo(padL + plotW, gateY); ctx.stroke(); ctx.setLineDash([]);
  plotLine(staBuf, 7.5, botY, botH, activeColor);
}

function drawTapXRayCanvas(canvas, preset, studMag, phase) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 220);
  const [padL, padR, padT, padB] = [44, 18, 22, 26], [plotW, plotH] = [w - padL - padR, h - padT - padB], midY = padT + plotH / 2;
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1e293b"; ctx.strokeRect(padL, padT, plotW, plotH);
  ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(padL + plotW, midY); ctx.stroke();
  const effTau = Math.max(22, preset.tauMs * (studMag >= 18 && preset.mlClass === "Hollow_Drywall" ? 0.58 : 1.0)), totalMs = 640, amp = plotH * 0.42;
  ctx.strokeStyle = "rgba(148,163,184,0.35)"; ctx.setLineDash([4, 3]);
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * totalMs, x = padL + (t / totalMs) * plotW, y = midY + sgn * amp * Math.exp(-t / effTau);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.strokeStyle = preset.color; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * totalMs, x = padL + (t / totalMs) * plotW;
    let val = Math.exp(-t / effTau) * Math.cos(2 * Math.PI * preset.f0Hz * (t / 1000) + phase * 0.08);
    if (preset.chatter > 0) val += preset.chatter * Math.exp(-(((t - 185) / 28) ** 2)) * Math.sin(t * 0.27);
    const y = midY - Math.max(-1, Math.min(1, val)) * amp;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  const tauX = padL + Math.min(1, effTau / totalMs) * plotW;
  ctx.strokeStyle = "#f59e0b"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(tauX, padT); ctx.lineTo(tauX, padT + plotH); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = "10px monospace"; ctx.fillStyle = "#f59e0b"; ctx.fillText(`τ = ${Math.round(effTau)} ms (37% amp)`, Math.min(w - 135, tauX + 6), padT + 14);
  ctx.fillStyle = "#94a3b8"; ctx.fillText("a(t)", 10, midY + 3);
  for (const ms of [0, 160, 320, 480, 640]) ctx.fillText(`${ms}ms`, padL + (ms / totalMs) * plotW - 12, h - 8);
  return effTau;
}

function drawWandCanvas(canvas, spell, progress, rotAngle) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 220);
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 + 4, scale = Math.min(w, h) * 0.36;
  const project = ([x, y, z]) => {
    const ca = Math.cos(rotAngle), sa = Math.sin(rotAngle), rx = x * ca - z * sa, f = (scale * 2.4) / (x * sa + z * ca + 2.8);
    return [cx + rx * f, cy + y * f];
  };
  for (const [ax, lbl, col] of [[[1.1, 0, 0], "X", "#ef4444"], [[0, -1.0, 0], "Y", "#10e191"], [[0, 0, 1.1], "Z", "#00d9ff"]]) {
    const [x0, y0] = project([0, 0, 0]), [x1, y1] = project(ax);
    ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = col; ctx.font = "10px monospace"; ctx.fillText(lbl, x1 + 3, y1 + 3);
  }
  ctx.globalAlpha = 1;
  const pts = Array.from({ length: 32 }, (_, i) => project(spell.pts(i / 31))), count = Math.max(2, Math.min(32, Math.floor(progress * 32)));
  ctx.strokeStyle = spell.color; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i < count; i++) i === 0 ? ctx.moveTo(pts[i][0], pts[i][1]) : ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i === count - 1 ? "#f8fafc" : spell.color;
    ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], i === count - 1 ? 5 : 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#94a3b8"; ctx.font = "10px monospace";
  ctx.fillText(`StrokeRecorder: ${count}/32 equidistant arc-length points (Madgwick World Frame)`, 10, 16);
  ctx.fillStyle = spell.color; ctx.fillText(`Spell: ${spell.label}`, 10, h - 8);
}

export function mountImuSensorLab(container) {
  container.innerHTML = buildMarkup();
  const q = (s) => container.querySelector(s);
  const tabBtns = [...container.querySelectorAll("[data-tab]")], panels = [...container.querySelectorAll("[data-panel]")], xwModeBtns = [...container.querySelectorAll("[data-xwmode]")];
  const [pitchEl, rollEl, yawEl, pitchVal, rollVal, yawVal, driftBtn, tareBtn, horCanvas, horOut] = [".imu-pitch", ".imu-roll", ".imu-yaw", ".imu-pitch-val", ".imu-roll-val", ".imu-yaw-val", ".imu-drift-btn", ".imu-tare-btn", ".imu-hor-canvas", ".imu-hor-out"].map(q);
  const [vibPresetEl, vibGainEl, vibShiftEl, gainVal, shiftVal, fftCanvas, fftCards, fftShaper] = [".imu-vib-preset", ".imu-vib-gain", ".imu-vib-shift", ".imu-gain-val", ".imu-shift-val", ".imu-fft-canvas", ".imu-fft-cards", ".imu-fft-shaper"].map(q);
  const [seisCanvas, pauseBtn, aeBar, seisStatus, tamperProbs] = [".imu-seis-canvas", ".imu-pause-btn", ".imu-ae-bar", ".imu-seis-status", ".imu-tamper-probs"].map(q);
  const [tapBar, wandBar, studMagEl, studVal, wandReplayBtn, xwCanvas, xwCards, xwNote] = [".imu-tap-bar", ".imu-wand-bar", ".imu-stud-mag", ".imu-stud-val", ".imu-wand-replay", ".imu-xw-canvas", ".imu-xw-cards", ".imu-xw-note"].map(q);

  let activeTab = "horizon", driftMode = false, driftErr = 0, paused = false, tick = 0, activeTrig = "earth", xwMode = "tap", activeTap = "drywall", activeSpell = "Circle_CW", wandProg = 1.0;
  const magBuf = Array.from({ length: 64 }, () => 0.5), staBuf = Array.from({ length: 64 }, () => 1.0);

  const renderHorizon = () => {
    const [pBase, rBase, yBase] = [Number(pitchEl.value), Number(rollEl.value), Number(yawEl.value)];
    const effP = Math.max(-45, Math.min(45, pBase + (driftMode ? driftErr * 0.55 : 0))), effR = Math.max(-60, Math.min(60, rBase + (driftMode ? driftErr : 0))), effY = (yBase + (driftMode ? driftErr * 1.4 : 0) + 360) % 360;
    [pitchVal.textContent, rollVal.textContent, yawVal.textContent] = [`${pBase.toFixed(1)}°`, `${rBase.toFixed(1)}°`, `${String(Math.round(yBase)).padStart(3, "0")}°`];
    drawHorizonCanvas(horCanvas, effP, effR, effY, driftMode, driftErr);
    const [qw, qx, qy, qz] = eulerToQuat(effR, effP, effY);
    const tag = driftMode ? `<span style="color:#f59e0b;font-weight:700;">RAW GYRO ONLY (Unbounded Drift +${driftErr.toFixed(1)}°)</span>` : `<span style="color:#10e191;font-weight:700;">MADGWICK AHRS β=0.10 (Gravity-Locked · 0 Gimbal Lock)</span>`;
    horOut.innerHTML = `${tag}<div style="margin-top:4px;color:#94a3b8;">Quaternion: q=[${qw.toFixed(3)}, ${qx.toFixed(3)}, ${qy.toFixed(3)}, ${qz.toFixed(3)}] | Pitch ${effP.toFixed(1)}° · Roll ${effR.toFixed(1)}° · Yaw ${effY.toFixed(0)}°</div>`;
  };

  const renderFFT = () => {
    const preset = VIB_PRESETS[Number(vibPresetEl.value)] || VIB_PRESETS[0], [gain, shiftHz] = [Number(vibGainEl.value), Number(vibShiftEl.value)];
    [gainVal.textContent, shiftVal.textContent] = [`${gain.toFixed(1)}×`, `${shiftHz >= 0 ? "+" : ""}${shiftHz.toFixed(1)} Hz`];
    const { mags, peakHz, velMmS } = synthesizeFFT(preset, gain, shiftHz), iso = isoGradeForVelocity(velMmS);
    drawFFTCanvas(fftCanvas, mags, peakHz, iso.color);
    fftCards.innerHTML = [statCard("PEAK FREQ / RPM", `${peakHz.toFixed(1)} Hz`, `${Math.round(peakHz * 60)} RPM`, "#00d9ff"), statCard("VELOCITY RMS", `${velMmS.toFixed(2)} mm/s`, `Crest Factor: ${preset.crest.toFixed(2)}`, iso.color), statCard("ISO 10816-3 GRADE", `GRADE ${iso.grade}`, iso.label, iso.color), statCard("IMUVibNet-1D", preset.mlClass, "INT8 Domain 17 (0 allocs)", "#e879f9")].join("");
    fftShaper.innerHTML = `<span style="color:#10e191;font-weight:700;">Klipper Input Shaper Advice:</span> <span style="color:#e2e8f0;">${preset.shaper}</span>`;
  };

  const stepSeismo = () => {
    const tr = MAG_TRIGGERS[activeTrig] || MAG_TRIGGERS.earth; tick++;
    magBuf.push(Math.max(0, tr.magDelta + Math.sin(tick * (activeTrig === "acwire" ? 1.9 : 0.4)) * tr.acRipple + Math.abs(gaussianNoise()) * 0.9)); magBuf.shift();
    const imp = (activeTrig === "knock" || activeTrig === "footstep") ? (tick % 12 < 3 ? tr.stalta : 1.15) : tr.stalta + Math.sin(tick * 0.7) * 0.35;
    staBuf.push(Math.max(0.5, imp + Math.abs(gaussianNoise()) * 0.18)); staBuf.shift();
  };

  const renderSeismo = () => {
    const tr = MAG_TRIGGERS[activeTrig] || MAG_TRIGGERS.earth, curMag = magBuf[magBuf.length - 1], curSta = staBuf[staBuf.length - 1];
    drawSeismoCanvas(seisCanvas, magBuf, staBuf, tr.color);
    const z = Math.max(0.2, tr.aeZ + Math.sin(tick * 0.25) * 0.12), isAnom = z >= 3.2, barCol = isAnom ? "#ef4444" : z >= 2.2 ? "#f59e0b" : "#10e191";
    aeBar.innerHTML = `<div style="width:${Math.min(100, (z / 6.5) * 100)}%;height:100%;background:${barCol};"></div><div style="position:absolute;left:${(3.2 / 6.5) * 100}%;top:0;bottom:0;width:2px;background:#e2e8f0;"></div>`;
    const magBadge = isAnom ? `<span style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;">[MAG_ANOMALY]</span>` : `<span style="background:#10e191;color:#0b1117;padding:2px 6px;border-radius:4px;font-weight:700;">CLEAN FIELD</span>`;
    const tamBadge = curSta >= 3.0 ? `<span style="background:#f59e0b;color:#0b1117;padding:2px 6px;border-radius:4px;font-weight:700;">STA/LTA TRIGGERED</span>` : `<span style="color:#94a3b8;">STA/LTA QUIET</span>`;
    seisStatus.innerHTML = `<div>${magBadge} &nbsp;<strong style="color:${barCol};">IMUMagAnomalyAE: ${z.toFixed(2)}&sigma;</strong> <span style="color:#94a3b8;">(|B| ${(48.5 + curMag).toFixed(1)} µT, Δ${curMag.toFixed(1)} µT)</span> &nbsp;|&nbsp; ${tamBadge} (${curSta.toFixed(2)}×)</div><div style="margin-top:4px;color:#cbd5e1;">FaultReason: <strong>${tr.fault}</strong> · Active Scenario: <strong style="color:${tr.color};">${tr.label}</strong></div>`;
    tamperProbs.innerHTML = TAMPER_CLASSES.map((cls, i) => {
      const p = Math.min(99, Math.max(1, Math.round(tr.probs[i] * 100 + Math.sin(tick * 0.3 + i) * 2)));
      return `<div style="background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:5px 7px;font-family:monospace;font-size:11px;"><div style="display:flex;justify-content:space-between;"><span style="color:${cls.color};font-weight:700;">${cls.name}</span><span>${p}%</span></div><div style="height:5px;background:#182230;border-radius:999px;margin-top:3px;overflow:hidden;"><div style="width:${p}%;height:100%;background:${cls.color};"></div></div></div>`;
    }).join("");
  };

  const renderXRayWand = () => {
    xwModeBtns.forEach((b) => { const on = b.dataset.xwmode === xwMode; [b.style.borderColor, b.style.color, b.style.background] = on ? ["#e879f9", "#e879f9", "rgba(232,121,249,0.14)"] : ["#334155", "#e2e8f0", "#182230"]; });
    tapBar.hidden = xwMode !== "tap"; wandBar.hidden = xwMode !== "wand";
    if (xwMode === "tap") {
      const preset = TAP_PRESETS[activeTap] || TAP_PRESETS.drywall, studMag = Number(studMagEl.value); studVal.textContent = `${studMag} µT`;
      const effTau = drawTapXRayCanvas(xwCanvas, preset, studMag, tick), isMetal = studMag >= 18 && preset.mlClass === "Hollow_Drywall";
      const cls = isMetal ? "Metal_Stud_Pipe" : preset.mlClass, hollow = isMetal ? 34 : preset.hollowPct;
      xwCards.innerHTML = [statCard("IMUTapNet-1D (Dom 20)", cls, "Event: TAP_MATERIAL", isMetal ? "#f59e0b" : preset.color), statCard("HOLLOWNESS", `${hollow}%`, hollow >= 60 ? "Resonant Cavity" : "Backed / Solid", hollow >= 60 ? "#e879f9" : "#10e191"), statCard("RING-DOWN τ / f₀", `${Math.round(effTau)} ms`, `Mode f₀: ${preset.f0Hz} Hz`, "#00d9ff"), statCard("BMM150 FUSION", `Δ${studMag} µT`, studMag >= 18 ? "Ferrous Stud/Pipe!" : "Non-Ferrous", studMag >= 18 ? "#f59e0b" : "#94a3b8")].join("");
      xwNote.innerHTML = `<strong style="color:${preset.color};">${preset.label}:</strong> ${isMetal ? "BMM150 magnetic delta ≥ 18 µT overrides hollow bay → Metal_Stud_Pipe!" : preset.note}`;
    } else {
      const spell = WAND_SPELLS[activeSpell] || WAND_SPELLS.Circle_CW;
      drawWandCanvas(xwCanvas, spell, wandProg, tick * 0.04);
      xwCards.innerHTML = [statCard("IMUGestureNet-1D", spell.label, "INT8 Domain 22 (0 allocs)", spell.color), statCard("CONFIDENCE", `${spell.conf}%`, "Speed-Invariant N=32", "#10e191"), statCard("EVENT BUS", "GESTURE_MATCH", `imu_gesture: "${spell.label}"`, "#00d9ff"), statCard("CUSTOM SPELLS", "16D SupCon", "Cosine k-NN Enrollable", "#e879f9")].join("");
      xwNote.innerHTML = `<strong style="color:#10e191;">radio-bridge Rule Preview:</strong> <code>{"imu_event":"GESTURE_MATCH","imu_gesture":"${spell.label}"}</code> → <strong style="color:${spell.color};">${spell.action}</strong>`;
    }
  };

  const setTab = (tab) => {
    activeTab = tab;
    tabBtns.forEach((b) => { const on = b.dataset.tab === tab; [b.style.borderColor, b.style.color, b.style.background] = on ? ["#00d9ff", "#00d9ff", "rgba(0,217,255,0.14)"] : ["#334155", "#e2e8f0", "#182230"]; });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    ({ horizon: renderHorizon, fft: renderFFT, seismo: renderSeismo, xraywand: renderXRayWand }[tab] || renderHorizon)();
  };

  tabBtns.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  [pitchEl, rollEl, yawEl].forEach((el) => el.addEventListener("input", renderHorizon));
  driftBtn.addEventListener("click", () => { driftMode = !driftMode; driftErr = 0; driftBtn.textContent = driftMode ? "Raw Gyro Drift: ON (No Fusion)" : "Madgwick AHRS: ON (Zero Drift)"; [driftBtn.style.color, driftBtn.style.borderColor] = driftMode ? ["#f59e0b", "#f59e0b"] : ["#10e191", "#10e191"]; renderHorizon(); });
  tareBtn.addEventListener("click", () => { pitchEl.value = "0"; rollEl.value = "0"; driftErr = 0; renderHorizon(); });
  [vibPresetEl, vibGainEl, vibShiftEl].forEach((el) => el.addEventListener("input", renderFFT));
  container.querySelectorAll("[data-trig]").forEach((b) => b.addEventListener("click", () => { activeTrig = b.dataset.trig; for (let k = 0; k < 8; k++) stepSeismo(); renderSeismo(); }));
  pauseBtn.addEventListener("click", () => { paused = !paused; pauseBtn.textContent = paused ? "Resume" : "Pause"; });
  xwModeBtns.forEach((b) => b.addEventListener("click", () => { xwMode = b.dataset.xwmode; wandProg = 0.08; renderXRayWand(); }));
  container.querySelectorAll("[data-tap]").forEach((b) => b.addEventListener("click", () => { activeTap = b.dataset.tap; renderXRayWand(); }));
  studMagEl.addEventListener("input", renderXRayWand);
  container.querySelectorAll("[data-spell]").forEach((b) => b.addEventListener("click", () => { activeSpell = b.dataset.spell; wandProg = 0.08; renderXRayWand(); }));
  wandReplayBtn.addEventListener("click", () => { wandProg = 0.08; renderXRayWand(); });

  for (let k = 0; k < 24; k++) stepSeismo();
  const timer = window.setInterval(() => {
    if (!paused) {
      if (driftMode) driftErr = Math.min(36, driftErr + 0.35);
      stepSeismo();
      if (xwMode === "wand" && wandProg < 1.0) wandProg = Math.min(1.0, wandProg + 0.08);
      if (activeTab === "horizon" && driftMode) renderHorizon();
      if (activeTab === "seismo") renderSeismo();
      if (activeTab === "xraywand") renderXRayWand();
    }
  }, 100);
  setTab("horizon");
  return () => { window.clearInterval(timer); };
}
