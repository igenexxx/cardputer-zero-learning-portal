/**
 * Interactive Ultrasonic Doppler Radar & Heterodyne Ultrasound Tuner Lab.
 * Visualizes df = (2 * v / c) * f_carrier and real-time heterodyne down-conversion (f_US -> |f_US - f_LO|).
 * Pure ES Module — zero build step, zero external dependencies.
 */

export function mountAudioDopplerLab(container) {
  container.innerHTML = `
    <div class="widget-card">
      <div class="widget-header">
        <strong>Ultrasonic Doppler Radar &amp; Heterodyne Tuner Lab</strong>
        <span class="widget-badge" data-role="badge">APPROACH +0.45 m/s</span>
      </div>
      <div class="widget-controls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin:10px 0;">
        <label>Mode
          <select data-role="mode">
            <option value="doppler" selected>Doppler Radar (19.5 kHz TX)</option>
            <option value="heterodyne">Heterodyne Hearing Aid (18-48 kHz)</option>
          </select>
        </label>
        <label>Carrier / LO Freq: <span data-role="freq-val">19.5 kHz</span>
          <input type="range" data-role="freq" min="18.0" max="44.0" step="0.5" value="19.5" />
        </label>
        <label>Target Velocity / US Source: <span data-role="vel-val">+0.45 m/s</span>
          <input type="range" data-role="vel" min="-1.50" max="1.50" step="0.05" value="0.45" />
        </label>
        <label>Ultrasound Source (Het): <span data-role="src-val">26.0 kHz</span>
          <input type="range" data-role="src" min="18.5" max="46.0" step="0.5" value="26.0" />
        </label>
      </div>
      <canvas data-role="canvas" width="640" height="210" style="width:100%;height:auto;border:1px solid var(--border);border-radius:6px;background:#0b1117;"></canvas>
      <div class="widget-metrics" data-role="metrics" style="display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-family:var(--font-mono);font-size:0.84rem;"></div>
    </div>
  `;

  const modeEl = container.querySelector('[data-role="mode"]');
  const freqEl = container.querySelector('[data-role="freq"]');
  const velEl = container.querySelector('[data-role="vel"]');
  const srcEl = container.querySelector('[data-role="src"]');
  const freqVal = container.querySelector('[data-role="freq-val"]');
  const velVal = container.querySelector('[data-role="vel-val"]');
  const srcVal = container.querySelector('[data-role="src-val"]');
  const badgeEl = container.querySelector('[data-role="badge"]');
  const metricsEl = container.querySelector('[data-role="metrics"]');
  const canvas = container.querySelector('[data-role="canvas"]');
  const ctx = canvas.getContext("2d");

  const render = () => {
    const mode = modeEl.value;
    const freqK = parseFloat(freqEl.value);
    const vel = parseFloat(velEl.value);
    const srcK = parseFloat(srcEl.value);
    freqVal.textContent = `${freqK.toFixed(1)} kHz`;
    velVal.textContent = `${vel >= 0 ? "+" : ""}${vel.toFixed(2)} m/s`;
    srcVal.textContent = `${srcK.toFixed(1)} kHz`;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#0b1117";
    ctx.fillRect(0, 0, w, h);

    if (mode === "doppler") {
      const fc = Math.min(21500, Math.max(18500, freqK * 1000));
      const df = (2 * vel / 343.0) * fc;
      const state = Math.abs(df) < 10 ? "STILL" : df > 0 ? "APPROACH" : "RECEDE";
      badgeEl.textContent = `${state} (${df >= 0 ? "+" : ""}${df.toFixed(1)} Hz)`;

      const midX = w / 2;
      ctx.strokeStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(0, h - 28);
      ctx.lineTo(w, h - 28);
      ctx.stroke();

      // Draw bipolar Doppler spectrum (-250..+250 Hz)
      const bins = 64;
      const bw = (w - 40) / bins;
      for (let i = 0; i < bins; i++) {
        const f = -250 + (i + 0.5) * (500 / bins);
        const carrierLeak = Math.exp(-(f * f) / 40) * 0.92;
        const echoPeak = Math.exp(-Math.pow(f - df, 2) / 140) * (Math.abs(vel) > 0.05 ? 0.68 : 0.02);
        const floor = 0.07 + 0.03 * Math.abs(Math.sin(i * 1.7));
        const lvl = Math.min(1, Math.max(floor, carrierLeak, echoPeak));
        const bh = lvl * (h - 52);
        ctx.fillStyle = Math.abs(f) < 12 ? "#f59e0b" : f > 0 ? "#10e191" : "#00d9ff";
        ctx.fillRect(20 + i * bw, h - 28 - bh, bw - 2, bh);
      }
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px monospace";
      ctx.fillText("-250 Hz (RECEDE)", 18, h - 10);
      ctx.fillText("0 Hz Carrier", midX - 42, h - 10);
      ctx.fillText("+250 Hz (APPROACH)", w - 148, h - 10);

      metricsEl.innerHTML = `
        <span>Carrier: <b>${(fc / 1000).toFixed(1)} kHz</b></span>
        <span>Doppler Shift: <b>${df >= 0 ? "+" : ""}${df.toFixed(1)} Hz</b></span>
        <span>Velocity: <b>${vel >= 0 ? "+" : ""}${vel.toFixed(2)} m/s</b></span>
        <span>State: <b>${state}</b></span>
      `;
    } else {
      const loK = freqK;
      const audibleK = Math.abs(srcK - loK);
      const audible = audibleK <= 4.5;
      badgeEl.textContent = audible ? `AUDIBLE ${(audibleK * 1000).toFixed(0)} Hz` : "OUT OF PASSBAND";

      // Draw 18..48 kHz band with highlighted [LO-4.5, LO+4.5] window
      const fToX = (fk) => 20 + ((fk - 18.0) / 30.0) * (w - 40);
      const xLo = fToX(Math.max(18.0, loK - 4.5));
      const xHi = fToX(Math.min(48.0, loK + 4.5));
      ctx.fillStyle = "rgba(16, 225, 145, 0.14)";
      ctx.fillRect(xLo, 18, xHi - xLo, h - 46);
      ctx.strokeStyle = "#10e191";
      ctx.strokeRect(xLo, 18, xHi - xLo, h - 46);

      // LO marker
      const xCenter = fToX(loK);
      ctx.strokeStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(xCenter, 18);
      ctx.lineTo(xCenter, h - 28);
      ctx.stroke();

      // Ultrasound source spike
      const xSrc = fToX(srcK);
      ctx.fillStyle = "#e879f9";
      ctx.fillRect(xSrc - 4, 34, 8, h - 62);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px monospace";
      ctx.fillText("18 kHz", 18, h - 10);
      ctx.fillText(`LO ${loK.toFixed(1)} kHz`, Math.max(60, Math.min(w - 110, xCenter - 32)), 14);
      ctx.fillText("48 kHz (96k Nyquist)", w - 155, h - 10);

      metricsEl.innerHTML = `
        <span>LO Freq: <b>${loK.toFixed(1)} kHz</b></span>
        <span>US Source: <b>${srcK.toFixed(1)} kHz</b></span>
        <span>Shifted Audible: <b>${(audibleK * 1000).toFixed(0)} Hz</b></span>
        <span>Passband (<=4.5 kHz): <b>${audible ? "YES" : "FILTERED"}</b></span>
      `;
    }
  };

  [modeEl, freqEl, velEl, srcEl].forEach((el) => el.addEventListener("input", render));
  render();
}
