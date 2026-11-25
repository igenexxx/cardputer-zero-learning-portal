/**
 * Interactive Hardware Bus, Logic Analyzer, I2C Pull-Up & Power R_int Lab (bus-studio).
 * 1) 4-CH Logic & UART Baud-Mismatch Simulator,
 * 2) I2C Pull-Up / 16x8 Bus Radar & WHO_AM_I Explorer,
 * 3) PWM / RC Servo & Battery R_int Sag Lab.
 * Pure ES Module — zero build step, zero external dependencies.
 */

import { setupHiDpiCanvas } from "./canvas.js";

const BAUDS = [9600, 19200, 38400, 57600, 74880, 115200, 230400];
const UART_MSGS = ["OK!", "BUS", "AT\r", "HI!"];
const I2C_CHIPS = {
  0x28: { name: "BNO055", kind: "9-DoF Fusion IMU", reg: "0x00", id: "0xA0", notes: "Bosch absolute orientation sensor" },
  0x3c: { name: "SSD1306", kind: "128x64 OLED Display", reg: "0x00", id: "Status", notes: "Command/data OLED controller" },
  0x40: { name: "INA219", kind: "Current/Power Monitor", reg: "0x00", id: "0x399F", notes: "High-side shunt & bus power ADC" },
  0x50: { name: "AT24C256", kind: "32 KB I2C EEPROM", reg: "0x0000", id: "Array", notes: "2-byte addressed EEPROM" },
  0x68: { name: "MPU6050", kind: "6-Axis Accel/Gyro", reg: "0x75", id: "0x68", notes: "Shared with DS3231 & BMI270" },
  0x76: { name: "BME280", kind: "Temp/Hum/Press", reg: "0xD0", id: "0x60", notes: "0x58=BMP280, 0x60=BME280, 0x61=BME680" },
};
const PWM_MODES = {
  servo: { freq: 50, unit: "ms", min: 1.0, max: 2.0, step: 0.05, val: 1.5 },
  led: { freq: 1000, unit: "%", min: 5, max: 95, step: 5, val: 45 },
  fan: { freq: 25000, unit: "%", min: 10, max: 100, step: 5, val: 60 },
};

const card = (k, v, s, c) =>
  `<div style="background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:7px 9px;font-family:monospace;font-size:12px;">` +
  `<div style="color:#94a3b8;font-size:10px;">${k}</div><div style="color:${c};font-weight:700;font-size:14px;margin-top:2px;">${v}</div>` +
  `<div style="color:#94a3b8;font-size:10px;">${s}</div></div>`;

function simulateUart(txBaud, rxBaud, text, noisy) {
  const txBitUs = 1e6 / txBaud, rxBitUs = 1e6 / rxBaud;
  const txBits = [], rxChars = [];
  let frameErrs = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i), frame = [0];
    for (let b = 0; b < 8; b++) frame.push((code >> b) & 1);
    frame.push(1);
    txBits.push(...frame);
    let rxByte = 0;
    for (let b = 0; b < 8; b++) {
      const idx = Math.floor(((1.5 + b) * rxBitUs) / txBitUs);
      let bit = idx < frame.length ? frame[idx] : 1;
      if (noisy && b === 3) bit ^= 1;
      rxByte |= bit << b;
    }
    const stopIdx = Math.floor((9.5 * rxBitUs) / txBitUs);
    const bad = (stopIdx < frame.length ? frame[stopIdx] : 1) !== 1 || noisy;
    if (bad) frameErrs++;
    rxChars.push({ byte: rxByte, ch: rxByte >= 0x20 && rxByte <= 0x7e ? String.fromCharCode(rxByte) : "." });
  }
  return { txBits, rxChars, frameErrs, errPct: ((rxBaud - txBaud) / txBaud) * 100, txBitUs, rxBitUs };
}

function buildMarkup() {
  const btn = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-bottom:3px solid transparent;border-radius:6px 6px 0 0;padding:6px 10px;font-size:12px;cursor:pointer;";
  const sel = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:12px;";
  const row = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;";
  const cvs = "width:100%;display:block;border:1px solid #1e293b;border-radius:6px;background:#0b1117;margin-bottom:10px;";
  const grid = "display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-bottom:8px;";
  const baudOpts = (def) => BAUDS.map((b) => `<option value="${b}"${b === def ? " selected" : ""}>${b} bps</option>`).join("");
  const msgOpts = UART_MSGS.map((m) => `<option value="${m}">${m.replace("\r", "\\r")}</option>`).join("");
  const radarCells = Array.from({ length: 128 }, (_, a) => {
    const rsv = a < 3 || a > 0x77, hit = I2C_CHIPS[a];
    const s = `background:${hit ? "#0d3b36" : rsv ? "#0b1117" : "#111a26"};color:${hit ? "#10e191" : rsv ? "#334155" : "#64748b"};border:1px solid ${hit ? "#10e191" : "#1e293b"};border-radius:3px;padding:2px 0;font-family:monospace;font-size:10px;cursor:${hit ? "pointer" : "default"};`;
    return `<button type="button" data-i2c="${a}" style="${s}" ${hit ? "" : "disabled"}>${a.toString(16).toUpperCase().padStart(2, "0")}</button>`;
  }).join("");

  return `<div class="lab-card" style="padding:16px;border:1px solid #1e293b;border-radius:10px;background:#0f1722;">
    <div style="${row}margin-bottom:12px;border-bottom:1px solid #1e293b;padding-bottom:8px;">
      <strong style="color:#00d9ff;font-size:15px;">Hardware Bus, 4-CH Logic, I2C Pull-Up &amp; Battery R_int Lab</strong>
      <div role="tablist" aria-label="Bus Studio interactive labs" style="display:flex;gap:6px;overflow-x:auto;">
        <button type="button" role="tab" id="bus-t-logic" data-tab="logic" aria-selected="true" style="${btn}color:#00d9ff;border-bottom-color:#00d9ff;">1. 4-CH Logic &amp; UART</button>
        <button type="button" role="tab" id="bus-t-i2c" data-tab="i2c" aria-selected="false" style="${btn}">2. I2C Pull-Up &amp; Radar</button>
        <button type="button" role="tab" id="bus-t-pwr" data-tab="power" aria-selected="false" style="${btn}">3. PWM Servo &amp; R_int Sag</button>
      </div>
    </div>
    <div role="tabpanel" aria-labelledby="bus-t-logic" data-panel="logic">
      <div style="${row}">
        <label style="font-size:12px;color:#94a3b8;">TX Baud <select class="bl-tx" style="${sel}">${baudOpts(115200)}</select></label>
        <label style="font-size:12px;color:#94a3b8;">RX Baud <select class="bl-rx" style="${sel}">${baudOpts(115200)}</select></label>
        <label style="font-size:12px;color:#94a3b8;">Payload <select class="bl-msg" style="${sel}">${msgOpts}</select></label>
        <label style="font-size:12px;color:#f59e0b;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="bl-noise" /> Glitch / Bounce</label>
        <button type="button" class="bl-auto" style="background:#10392f;color:#10e191;border:1px solid #10e191;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;">Auto-Baud Lock</button>
      </div>
      <canvas class="bl-logic-cvs" style="${cvs}height:220px;"></canvas>
      <div class="bl-logic-stats" style="${grid}"></div>
    </div>
    <div role="tabpanel" aria-labelledby="bus-t-i2c" data-panel="i2c" hidden>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">Pull-Up R_p: <strong class="bl-rp-v" style="color:#00d9ff;">4.7 k&Omega;</strong><input class="bl-rp" type="range" min="1" max="47" step="0.5" value="4.7" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Bus Cap C_bus: <strong class="bl-cb-v" style="color:#10e191;">100 pF</strong><input class="bl-cb" type="range" min="20" max="400" step="10" value="100" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Speed <select class="bl-spd" style="${sel}width:100%;"><option value="100">100 kHz Standard (&le;1000ns)</option><option value="400" selected>400 kHz Fast (&le;300ns)</option><option value="1000">1 MHz Fast+ (&le;120ns)</option></select></label>
      </div>
      <canvas class="bl-i2c-cvs" style="${cvs}height:175px;"></canvas>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Click a glowing green address on the 16&times;8 I2C Radar to probe <code style="color:#00d9ff;">WHO_AM_I</code> (I2CChipDB):</div>
      <div class="bl-radar" style="display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:3px;margin-bottom:10px;">${radarCells}</div>
      <div class="bl-i2c-stats" style="${grid}"></div>
    </div>
    <div role="tabpanel" aria-labelledby="bus-t-pwr" data-panel="power" hidden>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">PWM Mode <select class="bl-pmode" style="${sel}width:100%;"><option value="servo" selected>RC Servo (50 Hz)</option><option value="led">LED Dimmer (1 kHz)</option><option value="fan">4-Pin Fan (25 kHz)</option></select></label>
        <label style="font-size:12px;color:#94a3b8;"><span class="bl-plbl">Servo Pulse</span>: <strong class="bl-pval" style="color:#00d9ff;">1.50 ms</strong><input class="bl-pctl" type="range" min="1.0" max="2.0" step="0.05" value="1.5" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Battery OCV: <strong class="bl-ocv-v" style="color:#10e191;">3.85 V</strong><input class="bl-ocv" type="range" min="3.30" max="4.20" step="0.05" value="3.85" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Load Step &Delta;I: <strong class="bl-di-v" style="color:#f59e0b;">0.80 A</strong><input class="bl-di" type="range" min="0.05" max="2.00" step="0.05" value="0.80" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Cell R_int: <strong class="bl-ri-v" style="color:#e879f9;">120 m&Omega;</strong><input class="bl-ri" type="range" min="40" max="450" step="10" value="120" style="width:100%;" /></label>
      </div>
      <canvas class="bl-pwr-cvs" style="${cvs}height:215px;"></canvas>
      <div class="bl-pwr-stats" style="${grid}"></div>
    </div>
  </div>`;
}

export function mountBusLogicLab(container) {
  container.innerHTML = buildMarkup();
  const q = (s) => container.querySelector(s);
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  const panels = [...container.querySelectorAll('[role="tabpanel"]')];
  let activeTab = "logic", selectedAddr = 0x76;

  function renderLogic() {
    const sim = simulateUart(Number(q(".bl-tx").value), Number(q(".bl-rx").value), q(".bl-msg").value, q(".bl-noise").checked);
    const noisy = q(".bl-noise").checked;
    const { ctx, width: w, height: h } = setupHiDpiCanvas(q(".bl-logic-cvs"), 220);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);

    const x0 = 104, span = w - x0 - 14, bitW = span / 10;
    ctx.font = "11px monospace";
    [["CH0 UART TX", "#00d9ff", 42], ["CH1 RX STROBE", "#f59e0b", 94], ["CH2 I2C SCL", "#10e191", 146], ["CH3 PWM / TRIG", "#e879f9", 196]].forEach(([lbl, clr, y]) => {
      ctx.fillStyle = clr; ctx.fillText(lbl, 8, y - 6);
      ctx.strokeStyle = "#1e293b"; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w - 10, y); ctx.stroke();
    });

    ctx.strokeStyle = "#00d9ff"; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const x = x0 + i * bitW, y = sim.txBits[i] ? 20 : 42;
      if (i === 0) ctx.moveTo(x, 20);
      ctx.lineTo(x, y); ctx.lineTo(x + bitW, y);
    }
    ctx.stroke();

    for (let k = 0; k < 10; k++) {
      const sx = x0 + ((0.5 + k) * (sim.rxBitUs / sim.txBitUs)) * bitW;
      if (sx > w - 12) break;
      ctx.strokeStyle = ctx.fillStyle = k === 9 && sim.frameErrs > 0 ? "#ef4444" : "#f59e0b";
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, 70); ctx.lineTo(sx, 94); ctx.stroke();
      ctx.fillRect(sx - 2, 68, 4, 4);
    }

    const drawPulseRow = (color, baseY, count, duty) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = x0 + (i / count) * span, pw = (span / count) * duty;
        ctx.lineTo(x, baseY); ctx.lineTo(x, baseY - 22); ctx.lineTo(x + pw, baseY - 22); ctx.lineTo(x + pw, baseY);
      }
      ctx.stroke();
    };
    drawPulseRow("#10e191", 146, 18, 0.45);
    drawPulseRow("#e879f9", 196, noisy ? 22 : 5, noisy ? 0.25 : 0.35);

    const garbled = Math.abs(sim.errPct) > 3.5 || noisy;
    const decStr = sim.rxChars.map((c) => c.ch).join("");
    const hexStr = sim.rxChars.map((c) => c.byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
    q(".bl-logic-stats").innerHTML =
      card("Baud Drift", `${sim.errPct >= 0 ? "+" : ""}${sim.errPct.toFixed(1)}%`, "Max safe <= 3.5%", garbled ? "#ef4444" : "#10e191") +
      card("Decoded RX", `"${decStr}"`, `HEX: ${hexStr} · FE:${sim.frameErrs}`, garbled ? "#f59e0b" : "#00d9ff") +
      card("BusSignalNet-1D", noisy ? "Switch_Bounce" : "UART_Serial", "Domain 23 (0 allocs)", noisy ? "#f59e0b" : "#10e191") +
      card("BusStreamNet-1D", garbled ? "Baud_Mismatch_Garble" : "ASCII_BootLog", garbled ? "Advisor: Run Auto-Baud" : "Domain 24 clean 8N1", garbled ? "#ef4444" : "#10e191");
  }

  function renderI2C() {
    const rpK = Number(q(".bl-rp").value), cbPf = Number(q(".bl-cb").value), spdK = Number(q(".bl-spd").value);
    q(".bl-rp-v").textContent = `${rpK.toFixed(1)} kΩ`; q(".bl-cb-v").textContent = `${cbPf} pF`;
    const tauNs = rpK * cbPf, trNs = 0.8473 * tauNs;
    const maxTr = spdK === 100 ? 1000 : spdK === 400 ? 300 : 120, iolMa = 3.3 / rpK;
    const okTr = trNs <= maxTr, okIol = iolMa <= 3.0;
    const { ctx, width: w, height: h } = setupHiDpiCanvas(q(".bl-i2c-cvs"), 175);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);

    const x0 = 46, yTop = 22, yBot = h - 24, cw = w - x0 - 18, ch = yBot - yTop;
    const tMaxNs = Math.max(maxTr * 3, 600), vToY = (v) => yBot - (v / 3.3) * ch;
    [[2.31, "VIH 2.31V", "#10e191"], [0.99, "VIL 0.99V", "#f59e0b"]].forEach(([v, lbl, clr]) => {
      const y = vToY(v);
      ctx.strokeStyle = clr; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w - 14, y); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = clr; ctx.font = "10px monospace"; ctx.fillText(lbl, x0 + 6, y - 4);
    });
    const xSpec = x0 + Math.min(1, maxTr / tMaxNs) * cw;
    ctx.strokeStyle = "#ef4444"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xSpec, yTop); ctx.lineTo(xSpec, yBot); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#ef4444"; ctx.fillText(`t_r max ${maxTr}ns`, Math.min(xSpec + 4, w - 110), yTop + 10);

    ctx.strokeStyle = okTr && okIol ? "#00d9ff" : "#ef4444"; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let px = 0; px <= cw; px++) {
      const y = vToY(3.3 * (1 - Math.exp(-((px / cw) * tMaxNs) / Math.max(tauNs, 1))));
      if (px === 0) ctx.moveTo(x0 + px, y); else ctx.lineTo(x0 + px, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px monospace";
    ctx.fillText("3.3V", 8, yTop + 4); ctx.fillText("0.0V", 8, yBot);
    ctx.fillText("0 ns", x0, h - 7); ctx.fillText(`${Math.round(tMaxNs)} ns`, w - 58, h - 7);

    const chip = I2C_CHIPS[selectedAddr] || I2C_CHIPS[0x76];
    const hexAddr = `0x${selectedAddr.toString(16).toUpperCase().padStart(2, "0")}`;
    container.querySelectorAll("[data-i2c]").forEach((b) => {
      const a = Number(b.dataset.i2c);
      if (I2C_CHIPS[a]) b.style.outline = a === selectedAddr ? "2px solid #00d9ff" : "none";
    });
    q(".bl-i2c-stats").innerHTML =
      card("Rise Time t_r", `${Math.round(trNs)} ns`, `Limit <= ${maxTr} ns @ ${spdK}kHz`, okTr ? "#10e191" : "#ef4444") +
      card("Sink Current I_OL", `${iolMa.toFixed(2)} mA`, "Spec <= 3.0 mA", okIol ? "#10e191" : "#ef4444") +
      card(`Chip @ ${hexAddr}`, chip.name, chip.kind, "#00d9ff") +
      card("WHO_AM_I Probe", `${chip.reg} -> ${chip.id}`, chip.notes, "#e879f9");
  }

  function renderPower() {
    const mode = PWM_MODES[q(".bl-pmode").value];
    const pv = Number(q(".bl-pctl").value), ocv = Number(q(".bl-ocv").value);
    const dI = Number(q(".bl-di").value), rIntM = Number(q(".bl-ri").value);
    q(".bl-plbl").textContent = mode.unit === "ms" ? "Servo Pulse" : "Duty Cycle";
    q(".bl-pval").textContent = mode.unit === "ms" ? `${pv.toFixed(2)} ms` : `${Math.round(pv)}%`;
    q(".bl-ocv-v").textContent = `${ocv.toFixed(2)} V`; q(".bl-di-v").textContent = `${dI.toFixed(2)} A`; q(".bl-ri-v").textContent = `${rIntM} mΩ`;

    const dutyPct = mode.unit === "ms" ? (pv / 20) * 100 : pv;
    const servoDeg = mode.unit === "ms" ? Math.round((pv - 1.0) * 180) : null;
    const sagV = dI * (rIntM / 1000), vLoad = Math.max(2.4, ocv - sagV), brownout = vLoad < 3.30;
    const zScore = Math.max(0.4, (rIntM - 90) / 55 + (brownout ? 2.4 : 0) + (sagV > 0.35 ? 1.1 : 0));
    const { ctx, width: w, height: h } = setupHiDpiCanvas(q(".bl-pwr-cvs"), 215);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#00d9ff"; ctx.font = "11px monospace";
    ctx.fillText(`PWM ${mode.freq} Hz · Duty ${dutyPct.toFixed(1)}%${servoDeg !== null ? ` · Servo ${servoDeg}°` : ""}`, 12, 16);
    ctx.strokeStyle = "#00d9ff"; ctx.lineWidth = 2; ctx.beginPath();
    const pw = (w - 24) / 4, hiW = pw * Math.min(0.95, Math.max(0.05, dutyPct / 100));
    for (let i = 0; i < 4; i++) {
      const x = 12 + i * pw;
      ctx.moveTo(x, 76); ctx.lineTo(x, 30); ctx.lineTo(x + hiW, 30); ctx.lineTo(x + hiW, 76); ctx.lineTo(x + pw, 76);
    }
    ctx.stroke();

    const y0 = 104, y1 = h - 18, vMap = (v) => y1 - ((Math.max(2.6, Math.min(4.3, v)) - 2.6) / 1.7) * (y1 - y0);
    const y33 = vMap(3.3);
    ctx.strokeStyle = "#ef4444"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(12, y33); ctx.lineTo(w - 12, y33); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#ef4444"; ctx.fillText("3.30V LDO Brownout Line", 14, y33 - 4);

    ctx.strokeStyle = brownout ? "#ef4444" : "#10e191"; ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(12, vMap(ocv)); ctx.lineTo(w * 0.35, vMap(ocv));
    ctx.lineTo(w * 0.37, vMap(vLoad)); ctx.lineTo(w * 0.78, vMap(vLoad));
    ctx.lineTo(w * 0.82, vMap(ocv - sagV * 0.12)); ctx.lineTo(w - 12, vMap(ocv));
    ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.fillText(`OCV ${ocv.toFixed(2)}V -> Load ${vLoad.toFixed(2)}V (-${Math.round(sagV * 1000)}mV)`, 12, h - 5);

    const fault = brownout ? "BROWNOUT_SAG (<3.30V)" : rIntM > 220 ? "HIGH_RINT_AGED_CELL" : "NOMINAL_POWER";
    q(".bl-pwr-stats").innerHTML =
      card("PWM / Servo", servoDeg !== null ? `${servoDeg}° (${pv.toFixed(2)} ms)` : `${dutyPct.toFixed(0)}% @ ${mode.freq}Hz`, "ProtectedPinGuard OK", "#00d9ff") +
      card("Voltage Sag ΔV", `-${Math.round(sagV * 1000)} mV`, `V_load = ${vLoad.toFixed(2)} V`, brownout ? "#ef4444" : "#10e191") +
      card("Est. R_int (ΔV/ΔI)", `${rIntM} mΩ`, rIntM < 120 ? "Healthy Cell" : rIntM < 220 ? "Aging Cell" : "Replace Cell", rIntM > 220 ? "#f59e0b" : "#10e191") +
      card("BusPowerAE (D25)", `Z = ${zScore.toFixed(2)}σ`, fault, zScore >= 3.2 ? "#ef4444" : "#10e191");
  }

  const renderActive = () => (activeTab === "logic" ? renderLogic() : activeTab === "i2c" ? renderI2C() : renderPower());
  const selectTab = (name, focus = false) => {
    activeTab = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute("aria-selected", String(on));
      t.style.color = on ? "#00d9ff" : "#e2e8f0";
      t.style.borderBottomColor = on ? "#00d9ff" : "transparent";
      if (on && focus) t.focus();
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
    renderActive();
  };

  tabs.forEach((t, idx) => {
    t.addEventListener("click", () => selectTab(t.dataset.tab));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") selectTab(tabs[(idx + 1) % tabs.length].dataset.tab, true);
      if (e.key === "ArrowLeft") selectTab(tabs[(idx - 1 + tabs.length) % tabs.length].dataset.tab, true);
    });
  });
  q(".bl-auto").addEventListener("click", () => { q(".bl-rx").value = q(".bl-tx").value; q(".bl-noise").checked = false; renderLogic(); });
  [".bl-tx", ".bl-rx", ".bl-msg", ".bl-noise"].forEach((s) => q(s).addEventListener("input", renderLogic));
  [".bl-rp", ".bl-cb", ".bl-spd"].forEach((s) => q(s).addEventListener("input", renderI2C));
  q(".bl-radar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i2c]");
    if (b && I2C_CHIPS[Number(b.dataset.i2c)]) { selectedAddr = Number(b.dataset.i2c); renderI2C(); }
  });
  q(".bl-pmode").addEventListener("change", () => {
    const m = PWM_MODES[q(".bl-pmode").value], ctl = q(".bl-pctl");
    ctl.min = m.min; ctl.max = m.max; ctl.step = m.step; ctl.value = m.val;
    renderPower();
  });
  [".bl-pctl", ".bl-ocv", ".bl-di", ".bl-ri"].forEach((s) => q(s).addEventListener("input", renderPower));

  window.addEventListener("resize", renderActive);
  renderActive();
  return () => window.removeEventListener("resize", renderActive);
}
