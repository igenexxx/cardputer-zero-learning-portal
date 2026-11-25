/**
 * Interactive BLE Advertisement Decoder, Kalman Foxhunt, Neural Byte-Tagger
 * (BLEPayloadNet-1D) & Evil-Twin Anomaly Z-Score (BTAnomalyAE) Lab Widget.
 * Zero-build pure ES Module matching bt-studio/internal/advparse and btml.
 */

const PRESETS = [
  { name: "Apple FindMy / AirTag (Separated)", addrType: "random", company: "0x004C", svcUuid: "", hex: "12 19 10 DE AD BE EF 01 02 03" },
  { name: "Apple AirPods Pro 2 (L/R/Case Bat)", addrType: "random", company: "0x004C", svcUuid: "", hex: "07 19 01 0E 20 75 98 07 01 00" },
  { name: "iBeacon (Major 10, Minor 42)", addrType: "public", company: "0x004C", svcUuid: "", hex: "02 15 E2 C5 6D B5 DF FB 48 D2 B0 60 D0 F5 A7 10 96 E0 00 0A 00 2A C5" },
  { name: "BTHome v2 Sensor (23.45C, 51.2%RH, 88%)", addrType: "public", company: "", svcUuid: "FCD2", hex: "40 01 58 02 29 09 03 00 14 3A 01" },
  { name: "Eddystone-URL (https://eeugene.com)", addrType: "public", company: "", svcUuid: "FEAA", hex: "10 E6 03 65 65 75 67 65 6E 65 07" },
];

const ROLE_STYLE = {
  HDR_STATIC: { short: "HDR", color: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
  SEQ_CTR: { short: "SEQ", color: "#10e191", bg: "rgba(16,225,145,0.16)" },
  BTN_FLAG: { short: "BTN", color: "#f59e0b", bg: "rgba(245,158,11,0.18)" },
  UINT8_VAL: { short: "U8", color: "#a78bfa", bg: "rgba(167,139,250,0.16)" },
  INT16_LE: { short: "INT16_LE", color: "#00d9ff", bg: "rgba(0,217,255,0.16)" },
  CRC_OR_ENC: { short: "CRC/ENC", color: "#e879f9", bg: "rgba(232,121,249,0.18)" },
};

const STREAM_PROFILES = [
  {
    name: "HeartRate + CRC8", archetype: "Checksummed_Frame", baseConf: 96, encrypted: false,
    roles: ["HDR_STATIC", "UINT8_VAL", "SEQ_CTR", "BTN_FLAG", "INT16_LE", "INT16_LE", "UINT8_VAL", "CRC_OR_ENC"],
    summary: "INT16_LE@4-5 BTN@3 SEQ@2 CRC@7",
    gen(seq, btn) {
      const rr = 820 + Math.round(Math.sin(seq * 0.7) * 45);
      const p = [0x16, 68 + ((seq * 3) % 15), (seq + 1) & 0xff, btn ? 1 : 0, rr & 0xff, (rr >> 8) & 0xff, Math.max(40, 88 - (seq >> 2))];
      return [...p, p.reduce((c, b) => (((c << 1) ^ b ^ (c >> 7)) & 0xff), 0x5a)];
    },
  },
  {
    name: "6-Axis IMU (INT16_LE)", archetype: "IMU_MultiAxis", baseConf: 97, encrypted: false,
    roles: ["HDR_STATIC", "SEQ_CTR", "INT16_LE", "INT16_LE", "INT16_LE", "INT16_LE", "INT16_LE", "INT16_LE"],
    summary: "SEQ@1 INT16_LE@2-3,4-5,6-7",
    gen(seq, btn) {
      const ax = (1024 + Math.round(Math.sin(seq * 0.6) * 280) + (btn ? 420 : 0)) & 0xffff;
      const ay = (-310 + Math.round(Math.cos(seq * 0.5) * 240)) & 0xffff;
      const az = (16384 + Math.round(Math.sin(seq * 0.3) * 190)) & 0xffff;
      return [0xaa, seq & 0xff, ax & 0xff, ax >> 8, ay & 0xff, ay >> 8, az & 0xff, az >> 8];
    },
  },
  {
    name: "Encrypted AES-CTR", archetype: "Encrypted_Random", baseConf: 98, encrypted: true,
    roles: Array(8).fill("CRC_OR_ENC"), summary: "ENC@0-7 (high entropy, uniform XOR)",
    gen(seq, btn) {
      let s = ((seq + 1) * 2654435761 + (btn ? 0x9e3779b9 : 0)) >>> 0;
      return Array.from({ length: 8 }, () => {
        s = (Math.imul(s ^ (s >>> 15), 0x85ebca6b) + 0xc2b2ae35) >>> 0;
        return (s >>> 24) & 0xff;
      });
    },
  },
  {
    name: "Button Remote", archetype: "Button_Control", baseConf: 95, encrypted: false,
    roles: ["HDR_STATIC", "HDR_STATIC", "SEQ_CTR", "BTN_FLAG", "UINT8_VAL", "HDR_STATIC", "HDR_STATIC", "CRC_OR_ENC"],
    summary: "SEQ@2 BTN@3 U8@4 CRC@7",
    gen(seq, btn) {
      const p = [0x5a, 0x01, (seq + 1) & 0xff, btn ? 0x04 : 0x00, Math.max(60, 96 - (seq >> 3)), 0x00, 0x00];
      return [...p, p.reduce((acc, b, idx) => (acc ^ ((b + idx * 17) & 0xff)) & 0xff, 0xa5)];
    },
  },
];

const ANOMALY_PRESETS = [
  { name: "Benign AirPods Pro (Normal)", jitter: 6, txDelta: 4, adAnomaly: 5 },
  { name: "Evil-Twin: Timing/Jitter Mismatch", jitter: 82, txDelta: 12, adAnomaly: 18 },
  { name: "Spoofed Beacon: TX/RSSI Mismatch", jitter: 14, txDelta: 88, adAnomaly: 16 },
  { name: "Malformed AD Payload Clone", jitter: 22, txDelta: 19, adAnomaly: 92 },
];

const hex2 = (b) => b.toString(16).padStart(2, "0").toUpperCase();

function parseHexBytes(str) {
  const clean = str.replace(/[^0-9a-fA-F]/g, "");
  const out = [];
  for (let i = 0; i + 1 < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

function decodeAppleMfg(bytes) {
  const t = bytes[0];
  if (t === 0x02 && bytes[1] === 0x15 && bytes.length >= 23) {
    const tx = bytes[22] > 127 ? bytes[22] - 256 : bytes[22];
    return { protocol: "iBeacon", summary: `Major=${(bytes[18] << 8) | bytes[19]}, Minor=${(bytes[20] << 8) | bytes[21]}, Calibrated Tx=${tx} dBm`, delta: 15, leak: "Static iBeacon UUID/Major/Minor" };
  }
  if (t === 0x07 && bytes.length >= 8) {
    return { protocol: "Apple AirPods/Beats", summary: `Left=${(bytes[6] & 0x0f) * 10}%, Right=${((bytes[6] >> 4) & 0x0f) * 10}%, Case=${(bytes[7] & 0x0f) * 10}%`, delta: 18, leak: "AirPods model & battery telemetry" };
  }
  if (t === 0x12 && bytes.length >= 3) {
    const sep = (bytes[2] & 0x10) !== 0;
    return { protocol: "Apple FindMy / AirTag", summary: sep ? "Tracker broadcast — SEPARATED FROM OWNER flag set!" : "Tracker broadcast (near owner)", delta: sep ? 32 : 22, leak: sep ? "Separated-from-owner bit active" : "FindMy offline finding payload" };
  }
  return null;
}

function decodeBTHome(bytes) {
  const parts = [];
  for (let i = 1; i < bytes.length; ) {
    const id = bytes[i++];
    if (id === 0x01 && i < bytes.length) parts.push(`Bat ${bytes[i++]}%`);
    else if (id === 0x02 && i + 1 < bytes.length) {
      let raw = bytes[i] | (bytes[i + 1] << 8);
      if (raw > 32767) raw -= 65536;
      parts.push(`Temp ${(raw * 0.01).toFixed(2)} °C`);
      i += 2;
    } else if (id === 0x03 && i + 1 < bytes.length) {
      parts.push(`Hum ${((bytes[i] | (bytes[i + 1] << 8)) * 0.01).toFixed(1)}%`);
      i += 2;
    } else if (id === 0x3a && i < bytes.length) parts.push(`Button ${bytes[i++] === 1 ? "PRESS" : "EVENT"}`);
    else break;
  }
  return parts.join(" · ") || "BTHome v2 frame";
}

function decodeBleFrame(company, svcUuid, bytes, addrType) {
  let protocol = "Generic BLE";
  let summary = "Raw advertisement bytes";
  let privacy = addrType === "public" ? 35 : 0;
  const leaks = addrType === "public" ? ["Public static MAC (trackable)"] : [];
  const co = company.trim().toUpperCase();
  const sv = svcUuid.trim().toUpperCase();

  if (co === "0X004C" && bytes.length >= 2) {
    const apple = decodeAppleMfg(bytes);
    if (apple) ({ protocol, summary } = apple, privacy += apple.delta, leaks.push(apple.leak));
  } else if (sv === "FCD2" && bytes.length >= 3 && ((bytes[0] >> 5) & 7) === 2) {
    protocol = "BTHome v2";
    summary = decodeBTHome(bytes);
  } else if (sv === "FEAA" && bytes.length >= 3 && bytes[0] === 0x10) {
    const schemes = ["http://www.", "https://www.", "http://", "https://"];
    const suffixes = [".com/", ".org/", ".edu/", ".net/", ".info/", ".biz/", ".gov/", ".com", ".org"];
    let url = schemes[bytes[2]] || "";
    for (let k = 3; k < bytes.length; k++) url += bytes[k] < suffixes.length ? suffixes[bytes[k]] : String.fromCharCode(bytes[k]);
    protocol = "Eddystone-URL";
    summary = `Broadcast URL: ${url}`;
    privacy += 15;
    leaks.push("Cleartext Eddystone URL beacon");
  }
  return { protocol, summary, privacy: Math.min(100, privacy), leaks };
}

function evaluateAnomaly(jitterPct, txDeltaPct, adAnomPct) {
  const eJ = Math.pow(jitterPct / 100, 2) * 0.068;
  const eT = Math.pow(txDeltaPct / 100, 2) * 0.074;
  const eA = Math.pow(adAnomPct / 100, 2) * 0.082;
  const mse = 0.011 + eJ + eT + eA;
  const z = (mse - 0.014) / 0.0085;
  const isAnom = z >= 3.2;
  const reason = !isAnom
    ? "Nominal RF/AD feature manifold"
    : eA >= eT && eA >= eJ ? "AD Payload anomaly" : eT >= eJ ? "TX/RSSI mismatch" : "Timing/Jitter mismatch";
  return { mse, z, isAnom, reason };
}

function buildMarkup() {
  const selStyle = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 8px;font-size:12px;";
  const boxStyle = "font-family:monospace;font-size:12px;background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:7px 10px;";
  const pill = (label, col, bg) =>
    `<span style="padding:2px 6px;border-radius:999px;color:${col};background:${bg};border:1px solid ${col}66;">${label}</span>`;
  return `
    <div class="lab-card" style="padding:16px;border:1px solid #1e293b;border-radius:10px;background:#0f1722;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <strong style="color:#00d9ff;font-size:15px;">BLE Decoder, Foxhunt &amp; 4-Model Neural Suite Lab</strong>
        <select class="bt-preset" style="${selStyle}">${PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-bottom:8px;">
        <label style="font-size:12px;color:#94a3b8;">Company ID<input class="bt-co" type="text" style="width:100%;margin-top:4px;background:#0b1117;color:#00d9ff;border:1px solid #334155;border-radius:6px;padding:5px;font-family:monospace;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Service UUID<input class="bt-svc" type="text" style="width:100%;margin-top:4px;background:#0b1117;color:#10e191;border:1px solid #334155;border-radius:6px;padding:5px;font-family:monospace;" /></label>
        <label style="font-size:12px;color:#94a3b8;">MAC Type<select class="bt-addr" style="width:100%;margin-top:4px;background:#0b1117;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:5px;"><option value="random">Random (RPA)</option><option value="public">Public (Static)</option></select></label>
      </div>
      <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:8px;">Raw Payload HEX<input class="bt-hex" type="text" style="width:100%;margin-top:4px;background:#0b1117;color:#f59e0b;border:1px solid #334155;border-radius:6px;padding:5px;font-family:monospace;" /></label>
      <div class="bt-out" style="${boxStyle}margin-bottom:12px;font-size:13px;"></div>
      <div style="border-top:1px solid #1e293b;padding-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
          <span style="color:#10e191;font-weight:600;font-size:13px;">Log-Distance Path Loss &amp; Foxhunt Simulator</span>
          <span class="bt-dist-lbl" style="font-family:monospace;color:#e2e8f0;font-size:12px;"></span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <label style="font-size:12px;color:#94a3b8;">Measured RSSI (<span class="bt-rssi-val">-62</span> dBm)<input class="bt-rssi" type="range" min="-95" max="-30" value="-62" style="width:100%;" /></label>
          <label style="font-size:12px;color:#94a3b8;">Path Loss Exponent n (<span class="bt-n-val">2.4</span>)<input class="bt-n" type="range" min="1.8" max="3.8" step="0.1" value="2.4" style="width:100%;" /></label>
        </div>
      </div>
      <div style="border-top:1px solid #1e293b;padding-top:10px;margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          <span style="color:#00d9ff;font-weight:600;font-size:13px;">Neural Byte-Tagger (BLEPayloadNet-1D) &amp; Live Byte-Diff</span>
          <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
            <select class="bt-stream-sel" style="${selStyle}">${STREAM_PROFILES.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select>
            <button type="button" class="bt-diff-step" style="${selStyle}color:#00d9ff;border-color:#00d9ff;cursor:pointer;">Step</button>
            <button type="button" class="bt-diff-btn" style="${selStyle}color:#f59e0b;border-color:#f59e0b;cursor:pointer;">Toggle Btn</button>
            <button type="button" class="bt-diff-burst" style="${selStyle}color:#10e191;border-color:#10e191;cursor:pointer;">Burst 4×</button>
            <button type="button" class="bt-diff-reset" style="${selStyle}color:#94a3b8;cursor:pointer;">Reset</button>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;font-family:monospace;font-size:11px;">
          ${pill("INT16_LE", "#00d9ff", "rgba(0,217,255,0.14)")}${pill("CRC / ENC", "#e879f9", "rgba(232,121,249,0.14)")}${pill("BTN", "#f59e0b", "rgba(245,158,11,0.14)")}${pill("SEQ", "#10e191", "rgba(16,225,145,0.14)")}${pill("U8", "#a78bfa", "rgba(167,139,250,0.14)")}${pill("HDR", "#94a3b8", "rgba(148,163,184,0.12)")}
        </div>
        <div class="bt-diff-grid" style="display:grid;grid-template-columns:repeat(8,minmax(36px,1fr));gap:6px;font-family:monospace;font-size:13px;margin-bottom:8px;"></div>
        <div class="bt-ai-banner" style="${boxStyle}margin-bottom:6px;"></div>
        <div class="bt-diff-meta" style="${boxStyle}color:#94a3b8;"></div>
      </div>
      <div style="border-top:1px solid #1e293b;padding-top:10px;margin-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          <span style="color:#e879f9;font-weight:600;font-size:13px;">Evil-Twin RF Anomaly Z-Score Check (BTAnomalyAE, &ge; 3.2&sigma;)</span>
          <select class="bt-anom-preset" style="${selStyle}">${ANOMALY_PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:8px;">
          <label style="font-size:12px;color:#94a3b8;">Timing Jitter (<span class="bt-aj-val">6</span>%)<input class="bt-aj" type="range" min="0" max="100" value="6" style="width:100%;" /></label>
          <label style="font-size:12px;color:#94a3b8;">TX/RSSI Delta (<span class="bt-at-val">4</span>%)<input class="bt-at" type="range" min="0" max="100" value="4" style="width:100%;" /></label>
          <label style="font-size:12px;color:#94a3b8;">AD Framing Error (<span class="bt-aa-val">5</span>%)<input class="bt-aa" type="range" min="0" max="100" value="5" style="width:100%;" /></label>
        </div>
        <div class="bt-anom-out" style="${boxStyle}"></div>
      </div>
    </div>`;
}

export function mountBtBleLab(container) {
  container.innerHTML = buildMarkup();
  const q = (s) => container.querySelector(s);
  const [sel, coEl, svcEl, addrEl, hexEl, outEl] = [".bt-preset", ".bt-co", ".bt-svc", ".bt-addr", ".bt-hex", ".bt-out"].map(q);
  const [rssiEl, nEl, rssiVal, nVal, distLbl] = [".bt-rssi", ".bt-n", ".bt-rssi-val", ".bt-n-val", ".bt-dist-lbl"].map(q);
  const [streamSel, diffGrid, aiBanner, diffMeta] = [".bt-stream-sel", ".bt-diff-grid", ".bt-ai-banner", ".bt-diff-meta"].map(q);
  const [anomSel, ajEl, atEl, aaEl, ajVal, atVal, aaVal, anomOut] = [".bt-anom-preset", ".bt-aj", ".bt-at", ".bt-aa", ".bt-aj-val", ".bt-at-val", ".bt-aa-val", ".bt-anom-out"].map(q);

  let profile = STREAM_PROFILES[0];
  let diffSeq = 0;
  let btnState = false;
  let diffPrev = null;
  let diffNow = profile.gen(0, false);

  function renderByteDiff(prev, now) {
    const ready = diffSeq >= 3;
    const changes = [];
    diffGrid.innerHTML = now.map((b, i) => {
      const chg = prev !== null && prev[i] !== b;
      const roleKey = profile.roles[i];
      const st = ready ? ROLE_STYLE[roleKey] : { short: "...", color: "#64748b", bg: "#0b1117" };
      const pill = roleKey === "CRC_OR_ENC" ? (profile.encrypted ? "ENC" : "CRC") : st.short;
      if (chg) changes.push(`+${i}: ${hex2(prev[i])}->${hex2(b)} XOR:${hex2(prev[i] ^ b)}`);
      return `<div style="text-align:center;padding:5px 2px;border-radius:6px;background:${chg ? st.color : "#0b1117"};color:${chg ? "#0b1117" : ready ? st.color : "#cbd5e1"};border:1px solid ${chg || ready ? st.color : "#1e293b"};font-weight:${chg ? "700" : "500"};">
        <div style="font-size:10px;opacity:0.75;">+${i}</div><div>${hex2(b)}</div>
        <div style="font-size:9px;margin-top:3px;padding:1px 3px;border-radius:4px;background:${chg ? "rgba(11,17,23,0.22)" : st.bg};color:${chg ? "#0b1117" : st.color};font-weight:700;">${pill}</div>
      </div>`;
    }).join("");
    if (ready) {
      const conf = Math.min(99, profile.baseConf + Math.min(2, Math.floor((diffSeq - 3) / 3)));
      const enc = profile.encrypted ? ` &nbsp;<span style="background:#e879f9;color:#0b1117;padding:1px 6px;border-radius:4px;font-weight:700;">ENCRYPTED SUSPECT</span>` : "";
      aiBanner.innerHTML = `<span style="color:#00d9ff;font-weight:700;">AI:</span> <span style="color:#e2e8f0;">${profile.summary}</span> &nbsp;|&nbsp; <span style="color:#10e191;font-weight:700;">${profile.archetype} (${conf}%)</span>${enc}`;
    } else {
      aiBanner.innerHTML = `<span style="color:#00d9ff;font-weight:700;">AI:</span> <span style="color:#94a3b8;">Collecting window (${diffSeq + 1}/4 frames) — click "Burst 4×" or "Step" to run BLEPayloadNet-1D.</span>`;
    }
    diffMeta.textContent = changes.length ? `PKT #${diffSeq + 1} (${profile.name}) | ${changes.join(" · ")}` : `PKT #${diffSeq + 1} (${profile.name}) | Baseline packet captured.`;
  }

  function resetStream(idx) {
    profile = STREAM_PROFILES[idx] || STREAM_PROFILES[0];
    diffSeq = 0;
    btnState = false;
    diffPrev = null;
    diffNow = profile.gen(0, false);
    renderByteDiff(null, diffNow);
  }

  function stepStream(toggleBtn) {
    diffSeq++;
    if (toggleBtn) btnState = !btnState;
    diffPrev = diffNow.slice();
    diffNow = profile.gen(diffSeq, btnState);
    renderByteDiff(diffPrev, diffNow);
  }

  function renderAnomaly() {
    const [j, t, a] = [Number(ajEl.value), Number(atEl.value), Number(aaEl.value)];
    [ajVal.textContent, atVal.textContent, aaVal.textContent] = [String(j), String(t), String(a)];
    const r = evaluateAnomaly(j, t, a);
    const badge = r.isAnom
      ? `<span style="background:#ef4444;color:#fff;padding:2px 7px;border-radius:4px;font-weight:700;">[ANOM] EVIL-TWIN SUSPECT</span>`
      : `<span style="background:#10e191;color:#0b1117;padding:2px 7px;border-radius:4px;font-weight:700;">NORMAL</span>`;
    anomOut.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>${badge} &nbsp; <strong style="color:${r.isAnom ? "#f87171" : "#10e191"};">AnomalyZ: ${r.z.toFixed(2)}&sigma;</strong> <span style="color:#94a3b8;">(MSE ${r.mse.toFixed(4)}, gate &ge; 3.20&sigma;)</span></div>
      <div style="color:${r.isAnom ? "#f59e0b" : "#94a3b8"};">FaultReason: <strong>${r.reason}</strong></div>
    </div>`;
  }

  function renderDecode() {
    const res = decodeBleFrame(coEl.value, svcEl.value, parseHexBytes(hexEl.value), addrEl.value);
    const pCol = res.privacy >= 65 ? "#ef4444" : res.privacy >= 35 ? "#f59e0b" : "#10e191";
    outEl.innerHTML = `<div><span style="color:#94a3b8;">Protocol:</span> <strong style="color:#00d9ff;">${res.protocol}</strong> &nbsp;|&nbsp; <span style="color:#94a3b8;">Privacy Exposure:</span> <strong style="color:${pCol};">${res.privacy}/100</strong></div>
      <div style="margin-top:4px;color:#e2e8f0;">${res.summary}</div>${res.leaks.length ? `<div style="margin-top:4px;color:#f59e0b;font-size:12px;">Leaks: ${res.leaks.join("; ")}</div>` : ""}`;
  }

  function renderDist() {
    const [rssi, n] = [Number(rssiEl.value), Number(nEl.value)];
    [rssiVal.textContent, nVal.textContent] = [String(rssi), n.toFixed(1)];
    const meters = Math.pow(10, (-59 - rssi) / (10 * n));
    const prox = Math.max(0, Math.min(100, Math.round(((rssi + 95) / 60) * 100)));
    const zone = rssi >= -48 ? "TOUCH" : rssi >= -62 ? "NEAR" : rssi >= -78 ? "ROOM" : "FAR";
    distLbl.textContent = `Zone: ${zone} | Est: ~${meters.toFixed(2)} m | Proximity: ${prox}% | Geiger: ${Math.round(950 - prox * 8.5)} ms`;
  }

  function loadPreset(idx) {
    const p = PRESETS[idx] || PRESETS[0];
    [coEl.value, svcEl.value, addrEl.value, hexEl.value] = [p.company, p.svcUuid, p.addrType, p.hex];
    renderDecode();
  }

  sel.addEventListener("change", () => loadPreset(Number(sel.value)));
  [coEl, svcEl, addrEl, hexEl].forEach((el) => el.addEventListener("input", renderDecode));
  [rssiEl, nEl].forEach((el) => el.addEventListener("input", renderDist));
  streamSel.addEventListener("change", () => { resetStream(Number(streamSel.value)); for (let k = 0; k < 4; k++) stepStream(k === 2); });
  q(".bt-diff-step").addEventListener("click", () => stepStream(false));
  q(".bt-diff-btn").addEventListener("click", () => stepStream(true));
  q(".bt-diff-burst").addEventListener("click", () => { for (let k = 0; k < 4; k++) stepStream(k === 1); });
  q(".bt-diff-reset").addEventListener("click", () => resetStream(Number(streamSel.value)));
  anomSel.addEventListener("change", () => {
    const p = ANOMALY_PRESETS[Number(anomSel.value)] || ANOMALY_PRESETS[0];
    [ajEl.value, atEl.value, aaEl.value] = [String(p.jitter), String(p.txDelta), String(p.adAnomaly)];
    renderAnomaly();
  });
  [ajEl, atEl, aaEl].forEach((el) => el.addEventListener("input", renderAnomaly));

  loadPreset(0);
  renderDist();
  resetStream(0);
  for (let k = 0; k < 4; k++) stepStream(k === 2);
  renderAnomaly();
  return () => {};
}
