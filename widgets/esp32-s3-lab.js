/**
 * Interactive ESP32-S3 Hardware, Strapping/Octal PSRAM, CrashDoctor & Power Lab (bus-studio v0.2.0).
 * 1) ESP32-S3 Strapping Pin & Octal PSRAM Pin-Conflict Simulator,
 * 2) Xtensa LX7 Guru Meditation & Heap Leak OOM Forecaster,
 * 3) Non-Invasive ESP Power State & Bootloop Sawtooth Lab.
 * Pure ES Module — zero build step, zero external dependencies.
 */

import { setupHiDpiCanvas } from "./canvas.js";

const CRASH_PRESETS = {
  load_prohibited: {
    label: "LoadProhibited (EXCCAUSE=28)", exc: "28 (LoadProhibited)", pc: "0x420084A2",
    addr: "0x00000014", cls: "Null_Deref_LoadProhibited", conf: "96.4%", clr: "#ef4444",
    fix: "Null struct ptr + 0x14 offset read; check malloc/ps_malloc return before deref.",
  },
  instr_fetch: {
    label: "InstrFetchProhibited (EXCCAUSE=20)", exc: "20 (InstrFetchProhibited)", pc: "0x00000000",
    addr: "0x00000000", cls: "Bootloop_Panic", conf: "94.1%", clr: "#ef4444",
    fix: "Null function callback or corrupted return address on stack; verify IRAM_ATTR ISRs.",
  },
  task_wdt: {
    label: "Task WDT Timeout (TG0WDT)", exc: "WDT (Task Watchdog)", pc: "0x4200419C",
    addr: "0x00000000", cls: "Watchdog_Starvation", conf: "95.8%", clr: "#f59e0b",
    fix: "Tight loop starves IDLE0 task; insert vTaskDelay(1) or yield inside polling loops.",
  },
  stack_canary: {
    label: "Stack Canary Watchpoint", exc: "Canary Corrupt (Task Stack)", pc: "0x4037B210",
    addr: "0x3FC9A0FC", cls: "Stack_Overflow_Canary", conf: "97.2%", clr: "#ef4444",
    fix: "Large local array overflowed task stack; raise xTaskCreate stack or allocate in PSRAM.",
  },
  brownout: {
    label: "Brownout Detector Triggered", exc: "RTC_SW_BROWNOUT", pc: "0x40043A40",
    addr: "0x00000000", cls: "Brownout_Power_Dip", conf: "98.0%", clr: "#f59e0b",
    fix: "3.3V rail dipped <3.00V during Wi-Fi TX burst; shorten USB cable & add 100uF bulk cap.",
  },
  clean: {
    label: "Clean Running Firmware", exc: "None (POWERON_RESET)", pc: "0x42001080",
    addr: "0x00000000", cls: "Normal_Boot", conf: "99.1%", clr: "#10e191",
    fix: "No panic detected. Monitor HeapTracker slope & largest-block fragmentation.",
  },
};

const POWER_MODES = {
  deep: { label: "Deep Sleep (15 uA)", cls: "DeepSleep_uA", avgMa: 0.015, peakMa: 0.04, ev: "ESP_POWER_STATE:DeepSleep_uA", clr: "#10e191" },
  light: { label: "Light / Modem Sleep (18 mA)", cls: "LightSleep_Modem", avgMa: 18, peakMa: 42, ev: "ESP_POWER_STATE:LightSleep_Modem", clr: "#00d9ff" },
  wifi_tx: { label: "Wi-Fi TX Burst (320 mA spikes)", cls: "WiFi_TX_Burst", avgMa: 135, peakMa: 320, ev: "ESP_POWER_STATE:WiFi_TX_Burst", clr: "#f59e0b" },
  ble_adv: { label: "BLE Advertising Pulse (100 ms)", cls: "BLE_Adv_Pulse", avgMa: 28, peakMa: 115, ev: "ESP_POWER_STATE:BLE_Adv_Pulse", clr: "#00d9ff" },
  bootloop: { label: "Bootloop Sawtooth (1.4 Hz Reset)", cls: "Bootloop_Sawtooth", avgMa: 148, peakMa: 295, ev: "ESP_POWER_STATE:Bootloop_Sawtooth", clr: "#ef4444" },
  brownout: { label: "Brownout Voltage Collapse", cls: "Brownout_Reset_Loop", avgMa: 175, peakMa: 410, ev: "ESP_CRASH:Brownout", clr: "#ef4444" },
};

const PIN_ROWS = [
  { gpio: 0, role: "BOOT Strap", note: "LOW=Download, HIGH=SPI Boot" },
  { gpio: 3, role: "JTAG Strap", note: "USB-JTAG vs Pad JTAG select" },
  { gpio: 4, role: "ADC1 / GPIO", note: "Safe user peripheral pin" },
  { gpio: 10, role: "FSPI CS / GPIO", note: "Safe user SPI/I2C pin" },
  { gpio: 19, role: "USB D-", note: "Native USB-Serial/JTAG (303a:1001)" },
  { gpio: 20, role: "USB D+", note: "Native USB-Serial/JTAG (303a:1001)" },
  { gpio: 35, role: "SPIIO4 / OPI", note: "Reserved on Octal PSRAM (R8)" },
  { gpio: 36, role: "SPIIO5 / OPI", note: "Reserved on Octal PSRAM (R8)" },
  { gpio: 37, role: "SPIIO6/DQS", note: "Reserved on Octal PSRAM (R8)" },
  { gpio: 45, role: "VDD_SPI Strap", note: "0=3.3V Quad, 1=1.8V Octal" },
  { gpio: 46, role: "LOG/Mode Strap", note: "Must stay LOW on boot" },
];

const card = (k, v, s, c) =>
  `<div style="background:#0b1117;border:1px solid #1e293b;border-radius:6px;padding:7px 9px;font-family:monospace;font-size:12px;">` +
  `<div style="color:#94a3b8;font-size:10px;">${k}</div><div style="color:${c};font-weight:700;font-size:13px;margin-top:2px;">${v}</div>` +
  `<div style="color:#94a3b8;font-size:10px;margin-top:2px;">${s}</div></div>`;

function buildMarkup() {
  const btn = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-bottom:3px solid transparent;border-radius:6px 6px 0 0;padding:6px 10px;font-size:12px;cursor:pointer;";
  const sel = "background:#182230;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:12px;";
  const row = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;";
  const cvs = "width:100%;display:block;border:1px solid #1e293b;border-radius:6px;background:#0b1117;margin-bottom:10px;";
  const grid = "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;";
  const crashOpts = Object.entries(CRASH_PRESETS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");
  const pwrOpts = Object.entries(POWER_MODES).map(([k, v]) => `<option value="${k}"${k === "bootloop" ? " selected" : ""}>${v.label}</option>`).join("");
  const wireOpts = [4, 10, 19, 35, 36, 37, 45, 46].map((g) => `<option value="${g}"${g === 35 ? " selected" : ""}>GPIO${g}</option>`).join("");

  return `<div class="lab-card" style="padding:16px;border:1px solid #1e293b;border-radius:10px;background:#0f1722;">
    <div style="${row}margin-bottom:12px;border-bottom:1px solid #1e293b;padding-bottom:8px;">
      <strong style="color:#00d9ff;font-size:15px;">ESP32-S3 Strapping/PSRAM, CrashDoctor &amp; Power Lab</strong>
      <div role="tablist" aria-label="ESP32-S3 interactive labs" style="display:flex;gap:6px;overflow-x:auto;">
        <button type="button" role="tab" id="esp-t-pin" data-tab="pin" aria-selected="true" style="${btn}color:#00d9ff;border-bottom-color:#00d9ff;">1. Strapping &amp; Octal PSRAM</button>
        <button type="button" role="tab" id="esp-t-crash" data-tab="crash" aria-selected="false" style="${btn}">2. CrashDoctor &amp; Heap OOM</button>
        <button type="button" role="tab" id="esp-t-pwr" data-tab="pwr" aria-selected="false" style="${btn}">3. Power &amp; Bootloop Lab</button>
      </div>
    </div>
    <div role="tabpanel" aria-labelledby="esp-t-pin" data-panel="pin">
      <div style="${row}">
        <label style="font-size:12px;color:#94a3b8;">Module <select class="es-mod" style="${sel}">
          <option value="quad_no">N8 / N16 (Quad Flash, No PSRAM)</option>
          <option value="quad_r2">N8R2 (Quad Flash + 2MB Quad PSRAM)</option>
          <option value="octal_r8" selected>N16R8 / N8R8 (8MB Octal PSRAM)</option>
        </select></label>
        <label style="font-size:12px;color:#94a3b8;">Wire Sensor To <select class="es-wire" style="${sel}">${wireOpts}</select></label>
        <label style="font-size:12px;color:#e2e8f0;"><input type="checkbox" class="es-g0" checked /> GPIO0 HIGH (Run)</label>
        <label style="font-size:12px;color:#e2e8f0;"><input type="checkbox" class="es-g45" /> GPIO45 HIGH (1.8V)</label>
        <label style="font-size:12px;color:#e2e8f0;"><input type="checkbox" class="es-g46" /> GPIO46 HIGH</label>
        <label style="font-size:12px;color:#e2e8f0;"><input type="checkbox" class="es-g3" /> GPIO3 HIGH</label>
      </div>
      <canvas class="es-pin-cvs" style="${cvs}height:215px;"></canvas>
      <div class="es-pin-stats" style="${grid}"></div>
    </div>
    <div role="tabpanel" aria-labelledby="esp-t-crash" data-panel="crash" hidden>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">Panic Scenario <select class="es-crash" style="${sel}width:100%;">${crashOpts}</select></label>
        <label style="font-size:12px;color:#94a3b8;">Free Heap: <strong class="es-heap-v" style="color:#10e191;">220 KB</strong><input class="es-heap" type="range" min="48" max="320" step="8" value="220" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Leak Slope: <strong class="es-leak-v" style="color:#f59e0b;">384 B/s</strong><input class="es-leak" type="range" min="0" max="2048" step="32" value="384" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Fragmentation: <strong class="es-frag-v" style="color:#e879f9;">35%</strong><input class="es-frag" type="range" min="5" max="80" step="5" value="35" style="width:100%;" /></label>
      </div>
      <canvas class="es-crash-cvs" style="${cvs}height:215px;"></canvas>
      <div class="es-crash-stats" style="${grid}"></div>
    </div>
    <div role="tabpanel" aria-labelledby="esp-t-pwr" data-panel="pwr" hidden>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:#94a3b8;">ESP Power State <select class="es-pmode" style="${sel}width:100%;">${pwrOpts}</select></label>
        <label style="font-size:12px;color:#94a3b8;">Supply V_oc: <strong class="es-voc-v" style="color:#10e191;">3.45 V</strong><input class="es-voc" type="range" min="3.15" max="4.20" step="0.05" value="3.45" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">Cable+Cell R: <strong class="es-rpath-v" style="color:#f59e0b;">240 m&Omega;</strong><input class="es-rpath" type="range" min="50" max="600" step="10" value="240" style="width:100%;" /></label>
        <label style="font-size:12px;color:#94a3b8;">TX Peak Current: <strong class="es-ipeak-v" style="color:#00d9ff;">320 mA</strong><input class="es-ipeak" type="range" min="80" max="500" step="10" value="320" style="width:100%;" /></label>
      </div>
      <canvas class="es-pwr-cvs" style="${cvs}height:220px;"></canvas>
      <div class="es-pwr-stats" style="${grid}"></div>
    </div>
  </div>`;
}

export function mountESP32S3Lab(container) {
  container.innerHTML = buildMarkup();
  const q = (s) => container.querySelector(s);
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  const panels = [...container.querySelectorAll('[role="tabpanel"]')];
  let activeTab = "pin";

  function renderPins() {
    const mod = q(".es-mod").value, wire = Number(q(".es-wire").value);
    const g0 = q(".es-g0").checked, g45 = q(".es-g45").checked, g46 = q(".es-g46").checked, g3 = q(".es-g3").checked;
    const isOctal = mod === "octal_r8";
    const bootMode = g0 ? "SPI Flash Boot" : (!g46 ? "Joint Download (USB/UART)" : "INVALID (GPIO0=0 & GPIO46=1)");
    const bootBad = !g0 && g46;
    const vddSpi = g45 ? "1.8 V" : "3.3 V";
    const vddMismatch = !isOctal && g45;
    const wireConflict = (isOctal && [35, 36, 37].includes(wire))
      ? { state: "OCTAL PSRAM CONFLICT", clr: "#ef4444", msg: `GPIO${wire} drives Octal OPI PSRAM bus on R8 — wiring crashes boot!` }
      : [19, 20].includes(wire)
        ? { state: "USB-JTAG CONFLICT", clr: "#ef4444", msg: `GPIO${wire} is Native USB D-/D+ (303a:1001) — breaks /dev/ttyACM0!` }
        : [0, 45, 46].includes(wire)
          ? { state: "STRAPPING CAUTION", clr: "#f59e0b", msg: `GPIO${wire} is latched at reset; external pull-up/down can trap boot.` }
          : { state: "SAFE USER GPIO", clr: "#10e191", msg: `GPIO${wire} is free for I2C/SPI/UART/PWM on ${mod.toUpperCase()}.` };

    const { ctx, width: w, height: h } = setupHiDpiCanvas(q(".es-pin-cvs"), 215);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5, boxW = Math.min(200, w * 0.34), boxH = h - 30, bx = cx - boxW / 2, by = 15;
    ctx.fillStyle = "#111a26"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, boxW, boxH); ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = "#00d9ff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
    ctx.fillText("ESP32-S3 SoC", cx, by + 26);
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px monospace";
    ctx.fillText(isOctal ? "OPI 8MB PSRAM (GPIO35-37)" : mod === "quad_r2" ? "QPI 2MB PSRAM (Free 35-37)" : "Quad Flash Only", cx, by + 44);
    ctx.fillStyle = bootBad ? "#ef4444" : g0 ? "#10e191" : "#f59e0b";
    ctx.fillText(bootMode, cx, by + 68);
    ctx.fillStyle = vddMismatch ? "#ef4444" : "#e2e8f0";
    ctx.fillText(`VDD_SPI=${vddSpi} · JTAG=${g3 ? "PAD" : "USB"}`, cx, by + 88);
    ctx.fillStyle = wireConflict.clr;
    ctx.fillText(`Probe -> GPIO${wire}`, cx, by + 114);
    ctx.fillText(wireConflict.state, cx, by + 132);
    ctx.textAlign = "left";

    PIN_ROWS.forEach((p, idx) => {
      const left = idx < 6, rowI = left ? idx : idx - 6;
      const py = 28 + rowI * 31;
      const conflict = (isOctal && [35, 36, 37].includes(p.gpio)) || [19, 20].includes(p.gpio);
      const strap = [0, 3, 45, 46].includes(p.gpio);
      const clr = p.gpio === wire ? wireConflict.clr : conflict ? "#ef4444" : strap ? "#f59e0b" : "#10e191";
      const px = left ? 10 : bx + boxW + 14;
      const tagW = Math.max(96, (w - boxW) / 2 - 22);
      ctx.fillStyle = p.gpio === wire ? "#1e293b" : "#0f1722";
      ctx.strokeStyle = clr; ctx.lineWidth = p.gpio === wire ? 2.2 : 1;
      ctx.fillRect(px, py - 12, tagW, 22); ctx.strokeRect(px, py - 12, tagW, 22);
      ctx.fillStyle = clr; ctx.font = "10px monospace";
      ctx.fillText(`IO${String(p.gpio).padStart(2, "0")} ${p.role}`, px + 5, py + 2);
    });

    q(".es-pin-stats").innerHTML =
      card("Boot Mode", bootMode, `GPIO0=${g0 ? 1 : 0}, GPIO46=${g46 ? 1 : 0}`, bootBad ? "#ef4444" : g0 ? "#10e191" : "#f59e0b") +
      card("VDD_SPI Rail", vddSpi, vddMismatch ? "Warning: 1.8V starves 3.3V Quad flash!" : "Matches selected flash rail", vddMismatch ? "#ef4444" : "#10e191") +
      card(`Target GPIO${wire}`, wireConflict.state, wireConflict.msg, wireConflict.clr) +
      card("USB-JTAG Source", g3 ? "GPIO39-42 Pad JTAG" : "Native USB 303a:1001", "Zero-eFuse-Write read-only audit", "#00d9ff");
  }

  function renderCrash() {
    const preset = CRASH_PRESETS[q(".es-crash").value];
    const freeKb = Number(q(".es-heap").value), leakBs = Number(q(".es-leak").value), fragPct = Number(q(".es-frag").value);
    q(".es-heap-v").textContent = `${freeKb} KB`; q(".es-leak-v").textContent = `${leakBs} B/s`; q(".es-frag-v").textContent = `${fragPct}%`;
    const largestKb = Math.max(4, freeKb * (1 - fragPct / 100));
    const oomSec = leakBs > 0 ? Math.max(0, ((freeKb - 16) * 1024) / leakBs) : Infinity;
    const oomTxt = !isFinite(oomSec) ? "Stable (No Leak)" : oomSec < 120 ? `${Math.round(oomSec)} s` : `${(oomSec / 60).toFixed(1)} min`;

    const { ctx, width: w, height: h } = setupHiDpiCanvas(q(".es-crash-cvs"), 215);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);

    // Top panic dissector banner
    ctx.fillStyle = "#111a26"; ctx.fillRect(10, 8, w - 20, 44);
    ctx.strokeStyle = preset.clr; ctx.strokeRect(10, 8, w - 20, 44);
    ctx.fillStyle = preset.clr; ctx.font = "bold 11px monospace";
    ctx.fillText(`Guru Meditation / Reset: ${preset.exc}`, 18, 25);
    ctx.fillStyle = "#cbd5e1"; ctx.font = "10px monospace";
    ctx.fillText(`PC=${preset.pc}  EXCVADDR=${preset.addr}  Model D26 -> ${preset.cls} (${preset.conf})`, 18, 42);

    // Heap decay plot (0..600s horizon)
    const x0 = 46, yTop = 66, yBot = h - 22, cw = w - x0 - 16, ch = yBot - yTop, tHorizon = 600;
    const yMap = (kb) => yBot - (Math.max(0, Math.min(320, kb)) / 320) * ch;
    const yOom = yMap(16);
    ctx.strokeStyle = "#ef4444"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, yOom); ctx.lineTo(w - 16, yOom); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#ef4444"; ctx.font = "10px monospace"; ctx.fillText("16 KB Critical OOM Floor", x0 + 6, yOom - 4);

    const drawCurve = (startKb, scale, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let px = 0; px <= cw; px++) {
        const t = (px / cw) * tHorizon;
        const val = Math.max(0, startKb - (leakBs * t * scale) / 1024);
        const y = yMap(val);
        if (px === 0) ctx.moveTo(x0 + px, y); else ctx.lineTo(x0 + px, y);
      }
      ctx.stroke();
    };
    drawCurve(freeKb, 1.0, "#10e191");
    drawCurve(largestKb, 1.15, "#e879f9");
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("320KB", 6, yTop + 6); ctx.fillText("0KB", 18, yBot);
    ctx.fillText("t=0s (Green: Free Heap · Magenta: Largest Contiguous Block)", x0, h - 6);

    q(".es-crash-stats").innerHTML =
      card("ESPBootCrashNet (D26)", preset.cls, `Confidence ${preset.conf}`, preset.clr) +
      card("CrashDoctor Advice", preset.exc, preset.fix, preset.clr) +
      card("HeapTracker OOM ETA", oomTxt, `Leak slope -${leakBs} B/s`, oomSec < 300 ? "#ef4444" : oomSec < 1800 ? "#f59e0b" : "#10e191") +
      card("Largest Free Block", `${largestKb.toFixed(1)} KB`, `Frag ${fragPct}% (${largestKb < 32 ? "TLS/WiFi alloc risk" : "Healthy"})`, largestKb < 32 ? "#ef4444" : "#10e191");
  }

  function renderPower() {
    const key = q(".es-pmode").value, mode = POWER_MODES[key];
    const voc = Number(q(".es-voc").value), rPathM = Number(q(".es-rpath").value), iPeakMa = Number(q(".es-ipeak").value);
    q(".es-voc-v").textContent = `${voc.toFixed(2)} V`; q(".es-rpath-v").textContent = `${rPathM} mΩ`; q(".es-ipeak-v").textContent = `${iPeakMa} mA`;

    const effPeak = key === "deep" ? 0.04 : key === "light" ? 42 : key === "ble_adv" ? Math.min(iPeakMa, 140) : iPeakMa;
    const droopV = (effPeak / 1000) * (rPathM / 1000);
    const vMin = Math.max(2.3, voc - droopV), brownout = vMin < 3.00;
    const runH = mode.avgMa > 0 ? 1400 / mode.avgMa : 99999;
    const runTxt = runH > 48 ? `${(runH / 24).toFixed(1)} days` : `${runH.toFixed(1)} hrs`;

    const { ctx, width: w, height: h } = setupHiDpiCanvas(q(".es-pwr-cvs"), 220);
    ctx.fillStyle = "#0b1117"; ctx.fillRect(0, 0, w, h);
    const x0 = 48, cw = w - x0 - 14;

    // Upper trace: Current (0..500 mA)
    const iTop = 20, iBot = 104, iMap = (ma) => iBot - (Math.min(500, Math.max(0, ma)) / 500) * (iBot - iTop);
    ctx.fillStyle = "#00d9ff"; ctx.font = "10px monospace"; ctx.fillText("I_load (mA)", 6, 15);
    ctx.strokeStyle = "#1e293b"; ctx.beginPath(); ctx.moveTo(x0, iBot); ctx.lineTo(w - 14, iBot); ctx.stroke();

    // Lower trace: Voltage (2.5..4.2 V)
    const vTop = 122, vBot = h - 20, vMap = (v) => vBot - ((Math.min(4.2, Math.max(2.5, v)) - 2.5) / 1.7) * (vBot - vTop);
    const yBO = vMap(3.0);
    ctx.strokeStyle = "#ef4444"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, yBO); ctx.lineTo(w - 14, yBO); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#ef4444"; ctx.fillText("3.00V ESP32-S3 Brownout", x0 + 6, yBO - 4);
    ctx.fillStyle = "#10e191"; ctx.fillText("V_rail (V)", 6, vTop + 10);

    const sampleI = (u) => {
      if (key === "deep") return 0.5;
      if (key === "light") return (u * 6) % 1 < 0.25 ? 42 : 12;
      if (key === "ble_adv") return (u * 8) % 1 < 0.08 ? effPeak : 14;
      if (key === "wifi_tx") return (u * 5) % 1 < 0.22 ? effPeak : 65 + 12 * Math.sin(u * 40);
      if (key === "bootloop") { const p = (u * 3.5) % 1; return p < 0.12 ? 25 : p < 0.72 ? 55 + p * (effPeak - 55) : 18; }
      const p = (u * 4.5) % 1; return p < 0.55 ? 70 + p * effPeak : 12;
    };

    ctx.strokeStyle = "#00d9ff"; ctx.lineWidth = 2; ctx.beginPath();
    for (let px = 0; px <= cw; px++) {
      const y = iMap(sampleI(px / cw));
      if (px === 0) ctx.moveTo(x0 + px, y); else ctx.lineTo(x0 + px, y);
    }
    ctx.stroke();

    ctx.strokeStyle = brownout ? "#ef4444" : "#10e191"; ctx.lineWidth = 2; ctx.beginPath();
    for (let px = 0; px <= cw; px++) {
      const v = Math.max(2.5, voc - (sampleI(px / cw) / 1000) * (rPathM / 1000));
      const y = vMap(v);
      if (px === 0) ctx.moveTo(x0 + px, y); else ctx.lineTo(x0 + px, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.fillText("0 s", x0, h - 5); ctx.fillText("2.5 s window (Non-Invasive bq27220 + m5ioe1)", w - 265, h - 5);

    const verdictCls = brownout ? "Brownout_Reset_Loop" : mode.cls;
    q(".es-pwr-stats").innerHTML =
      card("ESPPowerProfileNet (D27)", verdictCls, brownout ? "Rail crossed <3.00V!" : mode.label, brownout ? "#ef4444" : mode.clr) +
      card("Avg Current / 1400mAh", `${mode.avgMa < 1 ? (mode.avgMa * 1000).toFixed(0) + " uA" : mode.avgMa + " mA"}`, `Est. runtime ~${runTxt}`, "#00d9ff") +
      card("Peak Rail Droop", `-${Math.round(droopV * 1000)} mV`, `V_min = ${vMin.toFixed(2)} V (margin ${(vMin - 3.0).toFixed(2)}V)`, brownout ? "#ef4444" : "#10e191") +
      card("radio-bridge Event", brownout ? "ESP_CRASH:Brownout" : mode.ev, "Read-only triage allowed", brownout ? "#ef4444" : "#e879f9");
  }

  const renderActive = () => (activeTab === "pin" ? renderPins() : activeTab === "crash" ? renderCrash() : renderPower());
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
  [".es-mod", ".es-wire", ".es-g0", ".es-g45", ".es-g46", ".es-g3"].forEach((s) => q(s).addEventListener("input", renderPins));
  [".es-crash", ".es-heap", ".es-leak", ".es-frag"].forEach((s) => q(s).addEventListener("input", renderCrash));
  [".es-pmode", ".es-voc", ".es-rpath", ".es-ipeak"].forEach((s) => q(s).addEventListener("input", renderPower));

  window.addEventListener("resize", renderActive);
  renderActive();
  return () => window.removeEventListener("resize", renderActive);
}
