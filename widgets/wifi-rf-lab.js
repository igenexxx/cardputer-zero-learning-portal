/**
 * Interactive 2.4 GHz Wi-Fi Bell-Curve Channel Planner, 802.11 Beacon IE & Grade A-F
 * Dissector (WiFiThreatAE), and Through-Wall Motion Tripwire (WiFiMotionNet-1D) Lab.
 * Pure ES Module — zero build step, zero external dependencies.
 */

import { setupHiDpiCanvas, gaussianNoise } from "./canvas.js";

const CHANNEL_PRESETS = [
  { name: "Congested Apartment", aps: [
    { ssid: "Apt3B_Fiber", ch: 1, rssi: -54, load: 42, color: "#00d9ff" },
    { ssid: "Neighbor_502", ch: 1, rssi: -64, load: 28, color: "#38bdf8" },
    { ssid: "TP-Link_8821", ch: 3, rssi: -58, load: 36, color: "#f59e0b" },
    { ssid: "Home_Net_6", ch: 6, rssi: -51, load: 55, color: "#e879f9" },
    { ssid: "DIRECT-HP-Ink", ch: 6, rssi: -67, load: 18, color: "#a78bfa" },
    { ssid: "Xfinity_Guest", ch: 8, rssi: -62, load: 31, color: "#fb923c" },
    { ssid: "Studio_24G", ch: 11, rssi: -74, load: 12, color: "#10e191" },
  ] },
  { name: "Clean Home (1 / 6 / 11)", aps: [
    { ssid: "LivingRoom_AP", ch: 1, rssi: -48, load: 16, color: "#00d9ff" },
    { ssid: "Office_Mesh", ch: 6, rssi: -62, load: 14, color: "#10e191" },
    { ssid: "Garage_IoT", ch: 11, rssi: -71, load: 8, color: "#38bdf8" },
  ] },
  { name: "Evil-Twin Attack on Ch 6", aps: [
    { ssid: "CorpWiFi_24G", ch: 6, rssi: -59, load: 24, color: "#00d9ff" },
    { ssid: "CorpWiFi_24G [ROGUE]", ch: 6, rssi: -38, load: 4, color: "#ef4444", rogue: true },
    { ssid: "Lobby_Guest", ch: 1, rssi: -66, load: 22, color: "#10e191" },
    { ssid: "Warehouse_AP", ch: 11, rssi: -68, load: 19, color: "#38bdf8" },
  ] },
  { name: "IoT Overlap Chaos (Ch 3/8/10)", aps: [
    { ssid: "ESP_Plug_01", ch: 3, rssi: -52, load: 25, color: "#f59e0b" },
    { ssid: "Tuya_Cam_44", ch: 4, rssi: -56, load: 48, color: "#ef4444" },
    { ssid: "ZigBee_Bridge", ch: 8, rssi: -55, load: 34, color: "#e879f9" },
    { ssid: "SmartBulb_AP", ch: 10, rssi: -60, load: 26, color: "#fb923c" },
    { ssid: "Clean_Ch1", ch: 1, rssi: -78, load: 6, color: "#10e191" },
  ] },
];

const IE_PRESETS = [
  {
    name: "Enterprise WPA3 + PMF (802.11w)", ssid: "CorpCampus-24", bssid: "3C:28:6D:41:8A:10",
    vendor: "Ubiquiti / Enterprise", grade: "A", gradeColor: "#10e191",
    summary: "Strong: WPA3-SAE with mandatory PMF (802.11w), WPS disabled, 802.11k/v/r active.",
    baseHash: "a94c1f7e2d80b613", obsHash: "a94c1f7e2d80b613", drift: 4, downgrade: 0, jitter: 6,
    ies: [
      ["0x00", "SSID", '"CorpCampus-24" (13 B)', "OK", "#10e191"],
      ["0x03", "DS Parameter Set", "Channel 11 (2462 MHz)", "OK", "#10e191"],
      ["0x0B", "BSS Load", "6 STAs · 14% Airtime · AAC 27900", "INFO", "#00d9ff"],
      ["0x2D", "HT Capabilities", "802.11n 20 MHz · Short GI · 2×2 MIMO", "OK", "#10e191"],
      ["0x30", "RSN (WPA3-SAE)", "CCMP-128 · AKM 0x08 (SAE) · MFPC=1 MFPR=1", "STRONG", "#10e191"],
      ["0x36", "Mobility Domain", "802.11r FT-SAE Fast Roaming", "OK", "#00d9ff"],
      ["0x7F", "Extended Caps", "BSS Transition (11v) + RRM (11k)", "OK", "#10e191"],
    ],
  },
  {
    name: "Vulnerable WPS Router", ssid: "HomeRouter_58C2", bssid: "C0:25:E9:58:C2:11",
    vendor: "TP-Link Consumer", grade: "D", gradeColor: "#f59e0b",
    summary: "High risk: Legacy TKIP/CCMP mixed mode, PMF disabled, unlocked WPS 2.0 PIN TLV.",
    baseHash: "7f21c409b51e883a", obsHash: "7f21c409b51e883a", drift: 12, downgrade: 28, jitter: 14,
    ies: [
      ["0x00", "SSID", '"HomeRouter_58C2" (15 B)', "OK", "#94a3b8"],
      ["0x03", "DS Parameter Set", "Channel 6 (2437 MHz)", "OK", "#94a3b8"],
      ["0x0B", "BSS Load", "11 STAs · 49% Airtime", "BUSY", "#f59e0b"],
      ["0x30", "RSN (WPA2-PSK)", "TKIP+CCMP Mixed · AKM 0x02 · MFPC=0 MFPR=0", "WEAK", "#f59e0b"],
      ["0xDD", "WPS TLV (00:50:F2:04)", "WPS 2.0 Configured · Setup Locked=0 (PIN/PBC)", "VULN", "#ef4444"],
      ["0xDD", "Vendor WMM", "00:50:F2:02 QoS Parameter Set", "INFO", "#00d9ff"],
    ],
  },
  {
    name: "Evil Twin Hostapd Clone", ssid: "CorpCampus-24", bssid: "3C:28:6D:41:8A:10",
    vendor: "Spoofed OUI (Linux hostapd)", grade: "F", gradeColor: "#ef4444",
    summary: "CRITICAL: Evil-Twin clone! RSN downgraded & IE Structure SHA-256 drifted from baseline.",
    baseHash: "a94c1f7e2d80b613", obsHash: "e409d12c9a66f041", drift: 90, downgrade: 85, jitter: 62,
    ies: [
      ["0x00", "SSID", '"CorpCampus-24" (Cloned SSID)', "CLONE", "#ef4444"],
      ["0x03", "DS Parameter Set", "Channel 6 (Baseline was Ch 11!)", "DRIFT", "#ef4444"],
      ["0x0B", "BSS Load", "MISSING (Expected in Enterprise baseline)", "DRIFT", "#f59e0b"],
      ["0x30", "RSN Security", "STRIPPED -> Open Captive / WPA2 Downgrade", "CRIT", "#ef4444"],
      ["0x36", "Mobility Domain", "MISSING (No 802.11r/k/v Enterprise IEs)", "DRIFT", "#ef4444"],
      ["0xDD", "Vendor OUI", "Generic Linux nl80211 / hostapd stack", "ANOM", "#e879f9"],
    ],
  },
  {
    name: "Hidden Spy Camera (SoftAP)", ssid: "ESP_CAM_4A9F", bssid: "24:6F:28:4A:9F:02",
    vendor: "Espressif Inc. (IoT Camera OUI)", grade: "D", gradeColor: "#f59e0b",
    summary: "Spycam Suspect (91/100): Minimal Espressif SoftAP IE stack, no PMF, RTSP/ONVIF cues.",
    baseHash: "Not in KnownEnv baseline", obsHash: "51bc88e2041f77c9", drift: 68, downgrade: 42, jitter: 58,
    ies: [
      ["0x00", "SSID", '"ESP_CAM_4A9F" (Camera SoftAP Pattern)', "SUSPECT", "#ef4444"],
      ["0x03", "DS Parameter Set", "Channel 4 (Non-standard IoT channel)", "WARN", "#f59e0b"],
      ["0x2D", "HT Capabilities", "Minimal 20 MHz 1×1 SISO (ESP32/HiSilicon)", "IOT", "#e879f9"],
      ["0x30", "RSN (WPA2-PSK)", "CCMP · Default Factory PSK Risk · PMF=OFF", "WEAK", "#f59e0b"],
      ["0xDD", "Vendor OUI", "18:FE:34 / 24:6F:28 Espressif Minimal TLV", "SPYCAM", "#ef4444"],
    ],
  },
];

const MOTION_SCENES = {
  still: { label: "STILL ROOM", color: "#10e191", amp: 0.45, freq: 0.12, retryBase: 1.5, retrySpike: 0.6, probs: [0.92, 0.04, 0.02, 0.02] },
  walk: { label: "HUMAN WALKING", color: "#f59e0b", amp: 4.8, freq: 0.85, retryBase: 6.5, retrySpike: 5.5, probs: [0.05, 0.86, 0.06, 0.03] },
  door: { label: "DOOR EVENT", color: "#00d9ff", amp: 7.4, freq: 0.35, retryBase: 4.0, retrySpike: 9.0, probs: [0.07, 0.14, 0.76, 0.03] },
  microwave: { label: "MICROWAVE RF BURST", color: "#e879f9", amp: 2.6, freq: 2.4, retryBase: 18.0, retrySpike: 14.0, probs: [0.03, 0.06, 0.05, 0.86] },
};

const MOTION_CLASSES = [
  { name: "Still_Room", color: "#10e191" }, { name: "Human_Walk", color: "#f59e0b" },
  { name: "Door_Event", color: "#00d9ff" }, { name: "RF_Interference", color: "#e879f9" },
];

const channelFreqMHz = (ch) => 2407 + ch * 5;

function computeChannelScore(targetCh, aps, loadScale, adjWeight) {
  let penalty = 0, coCount = 0, adjCount = 0, airtime = 0;
  for (const ap of aps) {
    const df = Math.abs(channelFreqMHz(targetCh) - channelFreqMHz(ap.ch));
    if (df >= 22) continue;
    const ov = 1 - df / 22, strength = Math.max(0.12, (ap.rssi + 96) / 62), isCo = ap.ch === targetCh;
    isCo ? coCount++ : adjCount++;
    penalty += ov * strength * (18 + ap.load * 0.45 * loadScale) * (isCo ? 1.0 : adjWeight);
    airtime += ov * ap.load * loadScale * (isCo ? 1.0 : 0.65);
  }
  return { score: Math.max(0, Math.min(100, Math.round(100 - penalty))), coCount, adjCount, airtime: Math.min(99, Math.round(airtime)) };
}

function evaluateWifiAnomaly(drift, downgrade, jitter) {
  const eD = ((drift / 100) ** 2) * 0.088, eS = ((downgrade / 100) ** 2) * 0.076, eJ = ((jitter / 100) ** 2) * 0.052;
  const mse = 0.009 + eD + eS + eJ, z = (mse - 0.012) / 0.0082, isAnom = z >= 3.2;
  const reason = !isAnom ? "Nominal 802.11 IE & RF beacon manifold"
    : eD >= eS && eD >= eJ ? "IE Structure Drift (Hash mismatch)"
    : eS >= eJ ? "Security Downgrade (RSN/PMF stripped)" : "Beacon Timing / OUI Anomaly";
  return { mse, z, isAnom, reason };
}

function buildMarkup() {
  const btn = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;";
  const sel = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:12px;";
  const box = "font-family:monospace;font-size:12px;background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:8px 10px;";
  const row = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;";
  const cvs = "width:100%;display:block;border:1px solid #1e293b;border-radius:6px;background:#0b1117;margin-bottom:10px;";
  return `<div class="lab-card" style="padding:16px;border:1px solid #1e293b;border-radius:10px;background:#0f1722;">
    <div style="${row}margin-bottom:12px;"><strong style="color:#00d9ff;font-size:15px;">2.4 GHz Wi-Fi Engineering, IE Forensics &amp; Motion Sensing Lab</strong>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" data-tab="spectrum" style="${btn}">1. Bell-Curve Planner</button>
        <button type="button" data-tab="ie" style="${btn}">2. Beacon IE &amp; Grade A–F</button>
        <button type="button" data-tab="motion" style="${btn}">3. Motion Tripwire</button>
      </div></div>
    <section data-panel="spectrum">
      <div style="${row}"><span style="color:#10e191;font-weight:600;font-size:13px;">2.4 GHz 22 MHz Overlapping Parabolic Channel Planner (Ch 1–13)</span>
        <select class="wf-ch-preset" style="${sel}">${CHANNEL_PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">Inspect Channel: <strong class="wf-ch-val" style="color:#00d9ff;">Ch 11</strong><input class="wf-ch-target" type="range" min="1" max="13" value="11" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Congestion Load: <strong class="wf-load-val" style="color:#f59e0b;">1.0×</strong><input class="wf-ch-load" type="range" min="0.5" max="2.0" step="0.1" value="1.0" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Adjacent Penalty: <strong class="wf-adj-val" style="color:#e879f9;">0.85×</strong><input class="wf-ch-adj" type="range" min="0.4" max="1.2" step="0.05" value="0.85" style="width:100%;" /></label>
      </div>
      <canvas class="wf-spec-canvas" style="${cvs}height:220px;"></canvas>
      <div class="wf-spec-scores" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin-bottom:8px;"></div>
      <div class="wf-spec-summary" style="${box}"></div>
    </section>
    <section data-panel="ie" hidden>
      <div style="${row}"><span style="color:#00d9ff;font-weight:600;font-size:13px;">802.11 Beacon IE Dissector, Security Grade (A–F) &amp; WiFiThreatAE</span>
        <select class="wf-ie-preset" style="${sel}">${IE_PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select></div>
      <div class="wf-ie-header" style="${box}margin-bottom:8px;"></div>
      <div class="wf-ie-table" style="overflow-x:auto;margin-bottom:10px;"></div>
      <div class="wf-ie-hash" style="${box}margin-bottom:10px;"></div>
      <div style="border-top:1px solid #1e293b;padding-top:10px;">
        <div style="color:#e879f9;font-weight:600;font-size:13px;margin-bottom:6px;">WiFiThreatAE Unsupervised Evil-Twin Z-Score (Gate &ge; 3.2&sigma;)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-bottom:8px;">
          <label style="font-size:12px;color:#94a3b8;">IE Tag Drift (<span class="wf-zd-val">4</span>%)<input class="wf-zd" type="range" min="0" max="100" value="4" style="width:100%;" /></label>
          <label style="font-size:12px;color:#94a3b8;">RSN/PMF Downgrade (<span class="wf-zs-val">0</span>%)<input class="wf-zs" type="range" min="0" max="100" value="0" style="width:100%;" /></label>
          <label style="font-size:12px;color:#94a3b8;">Beacon Jitter/OUI (<span class="wf-zj-val">6</span>%)<input class="wf-zj" type="range" min="0" max="100" value="6" style="width:100%;" /></label>
        </div>
        <div class="wf-ae-bar" style="height:12px;background:#0b1117;border:1px solid #1e293b;border-radius:999px;overflow:hidden;position:relative;margin-bottom:8px;"></div>
        <div class="wf-ae-out" style="${box}"></div>
      </div>
    </section>
    <section data-panel="motion" hidden>
      <div style="${row}"><span style="color:#10e191;font-weight:600;font-size:13px;">Through-Wall 10 Hz Fresnel Multipath Oscilloscope &amp; WiFiMotionNet-1D</span>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button type="button" data-scene="still" style="${btn}color:#10e191;border-color:#10e191;">Still Room</button>
          <button type="button" data-scene="walk" style="${btn}color:#f59e0b;border-color:#f59e0b;">Human Walking</button>
          <button type="button" data-scene="door" style="${btn}color:#00d9ff;border-color:#00d9ff;">Door Event</button>
          <button type="button" data-scene="microwave" style="${btn}color:#e879f9;border-color:#e879f9;">Microwave RF Burst</button>
          <button type="button" class="wf-mot-pause" style="${btn}color:#94a3b8;">Pause</button>
        </div></div>
      <div style="${row}"><label style="font-size:12px;color:#94a3b8;flex:1;min-width:180px;">Tripwire Sensitivity (<span class="wf-sens-val">1.0×</span>)<input class="wf-mot-sens" type="range" min="0.5" max="2.0" step="0.1" value="1.0" style="width:100%;" /></label>
        <div class="wf-mot-badge" style="font-family:monospace;font-size:12px;"></div></div>
      <canvas class="wf-mot-canvas" style="${cvs}height:210px;"></canvas>
      <div class="wf-mot-probs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-bottom:8px;"></div>
      <div class="wf-mot-stats" style="${box}color:#94a3b8;"></div>
    </section></div>`;
}

function drawSpectrumCanvas(canvas, aps, targetCh) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 220);
  const [padL, padR, padT, padB] = [42, 16, 18, 30];
  const [plotW, plotH] = [w - padL - padR, h - padT - padB];
  const xOf = (f) => padL + ((f - 2400) / 84) * plotW;
  const yOf = (db) => padT + ((Math.max(-96, Math.min(-28, db)) + 28) / -68) * plotH;
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h); ctx.font = "10px monospace";
  for (const db of [-35, -55, -75, -90]) {
    const y = yOf(db);
    ctx.strokeStyle = "#1e293b"; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = "#64748b"; ctx.fillText(`${db}`, 8, y + 3);
  }
  for (const ch of [1, 6, 11]) {
    const x = xOf(channelFreqMHz(ch));
    ctx.strokeStyle = "rgba(16,225,145,0.22)"; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke(); ctx.setLineDash([]);
  }
  const tFc = channelFreqMHz(targetCh), yBase = yOf(-96);
  ctx.fillStyle = "rgba(0,217,255,0.09)"; ctx.fillRect(xOf(tFc - 11), padT, xOf(tFc + 11) - xOf(tFc - 11), plotH);
  ctx.strokeStyle = "#00d9ff"; ctx.lineWidth = 1.2; ctx.strokeRect(xOf(tFc - 11), padT, xOf(tFc + 11) - xOf(tFc - 11), plotH);
  for (const ap of aps) {
    const fc = channelFreqMHz(ap.ch), peakH = yBase - yOf(ap.rssi);
    ctx.beginPath(); ctx.moveTo(xOf(fc - 11), yBase);
    for (let s = 0; s <= 44; s++) {
      const df = -11 + (s / 44) * 22, shape = Math.max(0, 1 - (df / 11) ** 2);
      ctx.lineTo(xOf(fc + df), yBase - peakH * (shape ** 0.72));
    }
    ctx.lineTo(xOf(fc + 11), yBase); ctx.closePath();
    ctx.fillStyle = ap.rogue ? "rgba(239,68,68,0.24)" : `${ap.color}26`; ctx.fill();
    ctx.strokeStyle = ap.color; ctx.lineWidth = ap.rogue ? 2.2 : 1.6; ctx.stroke();
    ctx.fillStyle = ap.color;
    ctx.fillText(`${ap.ssid.slice(0, 12)} (${ap.rssi})`, Math.max(padL + 2, Math.min(w - padR - 95, xOf(fc) - 34)), Math.max(padT + 10, yOf(ap.rssi) - 4));
  }
  for (let ch = 1; ch <= 13; ch++) {
    const ortho = ch === 1 || ch === 6 || ch === 11;
    ctx.fillStyle = ch === targetCh ? "#00d9ff" : ortho ? "#10e191" : "#64748b";
    ctx.font = ortho || ch === targetCh ? "bold 10px monospace" : "10px monospace";
    ctx.fillText(String(ch), xOf(channelFreqMHz(ch)) - (ch >= 10 ? 6 : 3), h - 10);
  }
  ctx.fillStyle = "#94a3b8"; ctx.font = "10px monospace"; ctx.fillText("dBm", 6, padT - 4);
}

function drawMotionCanvas(canvas, rssiBuf, retryBuf, sceneColor) {
  const { ctx, width: w, height: h } = setupHiDpiCanvas(canvas, 210);
  const [padL, padR, padT, padB, topH] = [42, 14, 16, 22, 98];
  const [plotW, botY] = [w - padL - padR, padT + topH + 18], botH = h - botY - padB;
  const mean = rssiBuf.reduce((a, b) => a + b, 0) / rssiBuf.length;
  const yRssi = (v) => padT + topH / 2 - (v + 58) * (topH / 20);
  ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1e293b"; ctx.strokeRect(padL, padT, plotW, topH); ctx.strokeRect(padL, botY, plotW, botH);
  ctx.fillStyle = "#94a3b8"; ctx.font = "10px monospace";
  ctx.fillText("RSSI", 6, padT + 12); ctx.fillText("-58", 10, padT + topH / 2 + 3);
  ctx.fillText("RETRY", 4, botY + 12); ctx.fillText("10 Hz Rolling Multipath Window (6.4 s)", padL + 6, h - 6);
  ctx.strokeStyle = "rgba(148,163,184,0.35)"; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(padL, yRssi(mean)); ctx.lineTo(padL + plotW, yRssi(mean)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = sceneColor; ctx.lineWidth = 2; ctx.beginPath();
  rssiBuf.forEach((v, i) => {
    const x = padL + (i / (rssiBuf.length - 1)) * plotW, y = Math.max(padT + 2, Math.min(padT + topH - 2, yRssi(v)));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  const barW = Math.max(2, plotW / retryBuf.length - 1);
  retryBuf.forEach((r, i) => {
    const bh = Math.min(botH - 2, (r / 35) * (botH - 4));
    ctx.fillStyle = r > 14 ? "#e879f9" : r > 6 ? "#f59e0b" : "#00d9ff";
    ctx.fillRect(padL + (i / retryBuf.length) * plotW, botY + botH - bh - 1, barW, bh);
  });
}

export function mountWifiRfLab(container) {
  container.innerHTML = buildMarkup();
  const q = (s) => container.querySelector(s);
  const tabBtns = [...container.querySelectorAll("[data-tab]")], panels = [...container.querySelectorAll("[data-panel]")];
  const [chPresetEl, chTargetEl, chLoadEl, chAdjEl, chValEl, loadValEl, adjValEl, specCanvas, specScoresEl, specSummaryEl] = [
    ".wf-ch-preset", ".wf-ch-target", ".wf-ch-load", ".wf-ch-adj", ".wf-ch-val", ".wf-load-val", ".wf-adj-val",
    ".wf-spec-canvas", ".wf-spec-scores", ".wf-spec-summary",
  ].map(q);
  const [iePresetEl, ieHeaderEl, ieTableEl, ieHashEl, zdEl, zsEl, zjEl, zdVal, zsVal, zjVal, aeBarEl, aeOutEl] = [
    ".wf-ie-preset", ".wf-ie-header", ".wf-ie-table", ".wf-ie-hash", ".wf-zd", ".wf-zs", ".wf-zj",
    ".wf-zd-val", ".wf-zs-val", ".wf-zj-val", ".wf-ae-bar", ".wf-ae-out",
  ].map(q);
  const [motCanvas, motPauseBtn, motSensEl, sensValEl, motBadgeEl, motProbsEl, motStatsEl] = [
    ".wf-mot-canvas", ".wf-mot-pause", ".wf-mot-sens", ".wf-sens-val", ".wf-mot-badge", ".wf-mot-probs", ".wf-mot-stats",
  ].map(q);
  let activeTab = "spectrum", currentScene = "still", paused = false, tick = 0;
  const rssiBuf = Array.from({ length: 64 }, () => -58), retryBuf = Array.from({ length: 64 }, () => 1.5);

  const renderSpectrum = () => {
    const preset = CHANNEL_PRESETS[Number(chPresetEl.value)] || CHANNEL_PRESETS[0];
    const [targetCh, loadScale, adjWeight] = [Number(chTargetEl.value), Number(chLoadEl.value), Number(chAdjEl.value)];
    [chValEl.textContent, loadValEl.textContent, adjValEl.textContent] = [`Ch ${targetCh} (${channelFreqMHz(targetCh)} MHz)`, `${loadScale.toFixed(1)}×`, `${adjWeight.toFixed(2)}×`];
    drawSpectrumCanvas(specCanvas, preset.aps, targetCh);
    const ortho = [1, 6, 11].map((ch) => ({ ch, ...computeChannelScore(ch, preset.aps, loadScale, adjWeight) }));
    const best = ortho.reduce((a, b) => (b.score > a.score ? b : a), ortho[0]), sel = computeChannelScore(targetCh, preset.aps, loadScale, adjWeight);
    const cards = [...ortho, ...(![1, 6, 11].includes(targetCh) ? [{ ch: targetCh, ...sel, custom: true }] : [])];
    specScoresEl.innerHTML = cards.map((c) => {
      const col = c.score >= 70 ? "#10e191" : c.score >= 40 ? "#f59e0b" : "#ef4444";
      return `<div style="background:#0b1117;border:1px solid ${c.ch === best.ch && !c.custom ? "#10e191" : "#1e293b"};border-radius:6px;padding:7px 9px;font-family:monospace;font-size:12px;"><div style="display:flex;justify-content:space-between;"><strong>Ch ${c.ch}</strong><span style="color:${col};font-weight:700;">${c.score}/100</span></div><div style="color:#94a3b8;font-size:11px;margin-top:3px;">Co:${c.coCount} · Adj:${c.adjCount} · Air:${c.airtime}%</div></div>`;
    }).join("");
    const rogue = preset.aps.find((a) => a.rogue);
    specSummaryEl.innerHTML = `<span style="color:#10e191;font-weight:700;">BEST 1/6/11 PICK: Ch ${best.ch} (${channelFreqMHz(best.ch)} MHz, ${best.score}/100)</span> &nbsp;|&nbsp; <span style="color:#00d9ff;">Selected Ch ${targetCh}: ${sel.score}/100 (Co:${sel.coCount}, Adj:${sel.adjCount})</span>${rogue ? `<div style="color:#ef4444;margin-top:4px;">WIDS Alert: Strong co-channel clone "${rogue.ssid}" at ${rogue.rssi} dBm on Ch ${rogue.ch}!</div>` : ""}`;
  };

  const renderAnomaly = () => {
    const [d, s, j] = [Number(zdEl.value), Number(zsEl.value), Number(zjEl.value)];
    [zdVal.textContent, zsVal.textContent, zjVal.textContent] = [String(d), String(s), String(j)];
    const r = evaluateWifiAnomaly(d, s, j), barCol = r.isAnom ? "#ef4444" : r.z >= 2.2 ? "#f59e0b" : "#10e191";
    aeBarEl.innerHTML = `<div style="width:${Math.max(2, Math.min(100, (r.z / 6) * 100))}%;height:100%;background:${barCol};"></div><div style="position:absolute;left:${(3.2 / 6) * 100}%;top:0;bottom:0;width:2px;background:#e2e8f0;"></div>`;
    const badge = r.isAnom ? `<span style="background:#ef4444;color:#fff;padding:2px 7px;border-radius:4px;font-weight:700;">[ANOM] EVIL-TWIN / ROGUE</span>` : `<span style="background:#10e191;color:#0b1117;padding:2px 7px;border-radius:4px;font-weight:700;">NOMINAL</span>`;
    aeOutEl.innerHTML = `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;"><div>${badge} &nbsp;<strong style="color:${barCol};">AnomalyZ: ${r.z.toFixed(2)}&sigma;</strong> <span style="color:#94a3b8;">(MSE ${r.mse.toFixed(4)}, gate &ge; 3.20&sigma;)</span></div><div style="color:${r.isAnom ? "#f59e0b" : "#94a3b8"};">FaultReason: <strong>${r.reason}</strong></div></div>`;
  };

  const renderIE = () => {
    const p = IE_PRESETS[Number(iePresetEl.value)] || IE_PRESETS[0], match = p.baseHash === p.obsHash;
    ieHeaderEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="color:#00d9ff;">${p.ssid}</strong> <span style="color:#94a3b8;">(${p.bssid} · ${p.vendor})</span></div><span style="background:${p.gradeColor};color:#0b1117;padding:2px 10px;border-radius:6px;font-weight:800;">GRADE ${p.grade}</span></div><div style="margin-top:5px;color:#e2e8f0;">${p.summary}</div>`;
    ieTableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:12px;"><thead><tr style="border-bottom:1px solid #1e293b;color:#94a3b8;text-align:left;"><th style="padding:4px 6px;">Tag</th><th style="padding:4px 6px;">Element</th><th style="padding:4px 6px;">Decoded Value</th><th style="padding:4px 6px;">Flag</th></tr></thead><tbody>${p.ies.map(([t, n, v, st, c]) => `<tr style="border-bottom:1px solid #1e293b66;"><td style="padding:4px 6px;color:#00d9ff;">${t}</td><td style="padding:4px 6px;color:#e2e8f0;">${n}</td><td style="padding:4px 6px;color:#cbd5e1;">${v}</td><td style="padding:4px 6px;color:${c};font-weight:700;">${st}</td></tr>`).join("")}</tbody></table>`;
    ieHashEl.innerHTML = `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;"><span>Baseline SHA-256: <strong style="color:#94a3b8;">${p.baseHash}</strong></span><span>Observed SHA-256: <strong style="color:${match ? "#10e191" : "#ef4444"};">${p.obsHash}</strong></span><span style="color:${match ? "#10e191" : "#ef4444"};font-weight:700;">${match ? "IE HASH MATCH" : "IE FINGERPRINT DRIFT!"}</span></div>`;
    renderAnomaly();
  };

  const stepMotion = () => {
    const sc = MOTION_SCENES[currentScene] || MOTION_SCENES.still, sens = Number(motSensEl.value);
    tick++;
    const wave = currentScene === "door"
      ? Math.exp(-(((tick % 24) - 8) / 3.5) ** 2) * sc.amp * (tick % 48 < 24 ? 1 : -1)
      : Math.sin(tick * sc.freq) * sc.amp + Math.cos(tick * sc.freq * 0.43) * (sc.amp * 0.45);
    rssiBuf.push(-58 + (wave + gaussianNoise() * (currentScene === "still" ? 0.35 : 0.9)) * Math.sqrt(sens));
    rssiBuf.shift();
    retryBuf.push(Math.max(0.2, sc.retryBase + Math.abs(Math.sin(tick * sc.freq * 1.1)) * sc.retrySpike + Math.abs(gaussianNoise()) * 1.1));
    retryBuf.shift();
  };

  const renderMotion = () => {
    const sc = MOTION_SCENES[currentScene] || MOTION_SCENES.still, sens = Number(motSensEl.value);
    sensValEl.textContent = `${sens.toFixed(1)}×`;
    drawMotionCanvas(motCanvas, rssiBuf, retryBuf, sc.color);
    const mean = rssiBuf.reduce((a, b) => a + b, 0) / rssiBuf.length;
    const variance = rssiBuf.reduce((a, v) => a + (v - mean) ** 2, 0) / rssiBuf.length;
    const avgRetry = retryBuf.reduce((a, b) => a + b, 0) / retryBuf.length;
    motBadgeEl.innerHTML = `<span style="background:${sc.color};color:#0b1117;padding:3px 9px;border-radius:6px;font-weight:800;">${sc.label}</span> &nbsp;<span style="color:${variance * sens >= 2.4 ? "#f59e0b" : "#94a3b8"};">${variance * sens >= 2.4 ? "TRIPWIRE: ALERT" : "TRIPWIRE: QUIET"}</span>`;
    motProbsEl.innerHTML = MOTION_CLASSES.map((cls, i) => {
      const p = Math.min(99, Math.max(1, Math.round(sc.probs[i] * 100 + Math.sin(tick * 0.3 + i) * 2)));
      return `<div style="background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:6px 8px;font-family:monospace;font-size:11px;"><div style="display:flex;justify-content:space-between;"><span style="color:${cls.color};font-weight:700;">${cls.name}</span><span>${p}%</span></div><div style="height:6px;background:#182230;border-radius:999px;margin-top:4px;overflow:hidden;"><div style="width:${p}%;height:100%;background:${cls.color};"></div></div></div>`;
    }).join("");
    motStatsEl.textContent = `Fresnel Variance (σ²): ${variance.toFixed(2)} dB² | Mean RSSI: ${mean.toFixed(1)} dBm | Retry Ripple: ${avgRetry.toFixed(1)}% | WiFiMotionNet-1D (10 Hz TCN)`;
  };

  const setTab = (tab) => {
    activeTab = tab;
    tabBtns.forEach((b) => {
      const on = b.dataset.tab === tab;
      [b.style.borderColor, b.style.color, b.style.background] = on ? ["#00d9ff", "#00d9ff", "rgba(0,217,255,0.14)"] : ["#334155", "#e2e8f0", "#182230"];
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    if (tab === "spectrum") renderSpectrum();
    if (tab === "ie") renderIE();
    if (tab === "motion") renderMotion();
  };

  tabBtns.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  [chPresetEl, chTargetEl, chLoadEl, chAdjEl].forEach((el) => el.addEventListener("input", renderSpectrum));
  iePresetEl.addEventListener("change", () => {
    const p = IE_PRESETS[Number(iePresetEl.value)] || IE_PRESETS[0];
    [zdEl.value, zsEl.value, zjEl.value] = [String(p.drift), String(p.downgrade), String(p.jitter)];
    renderIE();
  });
  [zdEl, zsEl, zjEl].forEach((el) => el.addEventListener("input", renderAnomaly));
  container.querySelectorAll("[data-scene]").forEach((b) => b.addEventListener("click", () => {
    currentScene = b.dataset.scene; for (let k = 0; k < 10; k++) stepMotion(); renderMotion();
  }));
  motPauseBtn.addEventListener("click", () => { paused = !paused; motPauseBtn.textContent = paused ? "Resume" : "Pause"; });
  motSensEl.addEventListener("input", renderMotion);

  for (let k = 0; k < 24; k++) stepMotion();
  const timer = window.setInterval(() => { if (!paused) { stepMotion(); if (activeTab === "motion") renderMotion(); } }, 100);
  setTab("spectrum");
  return () => { window.clearInterval(timer); };
}
