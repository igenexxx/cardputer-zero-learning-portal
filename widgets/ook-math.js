/**
 * Pure OOK Protocol Codec & 1D K-Means Pulse Quantization Math
 * Models Princeton, CAME, and Linear OOK framing, EMI glitch injection,
 * sign-alternation-preserving glitch absorption, and 1D K-Means PulseClusters.
 */

export const PROTOCOLS = {
  princeton: {
    name: "Princeton 24-bit",
    bits: 24,
    hexDigits: 6,
    defaultHex: "A5C39E",
    ratio: 3,
    syncLowFactor: 31,
    pilotFirst: false,
    tol: 0.35,
    mask: 0xffffff,
    formatErr: (bit, rHi, rLo) => `Timing violation at bit ${bit} (ratio ${rHi.toFixed(2)}:${rLo.toFixed(2)})`,
  },
  came: {
    name: "CAME 12-bit",
    bits: 12,
    hexDigits: 3,
    defaultHex: "6B4",
    ratio: 2,
    syncLowFactor: 36,
    pilotFirst: true,
    tol: 0.28,
    mask: 0xfff,
    formatErr: (bit) => `Bit ${bit} jitter exceeded 1:2 margin`,
  },
  linear: {
    name: "Linear 10-bit",
    bits: 10,
    hexDigits: 3,
    defaultHex: "2D5",
    ratio: 3,
    syncLowFactor: 39,
    pilotFirst: false,
    tol: 0.35,
    mask: 0x3ff,
    formatErr: (bit) => `Bit ${bit} jitter exceeded 1:3 margin`,
  },
};

export function parseKeyHex(proto, keyHex) {
  const cleaned = keyHex.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, proto.hexDigits);
  return parseInt(cleaned || "0", 16) & proto.mask;
}

export function randomKeyHex(proto) {
  const maxVal = (1 << proto.bits) - 1;
  return Math.floor(Math.random() * maxVal).toString(16).toUpperCase().padStart(proto.hexDigits, "0");
}

export function encodeProtocol(proto, value, te, jitterPct) {
  const masked = value & proto.mask;
  const pulses = [];
  const j = () => 1 + ((Math.random() * 2 - 1) * jitterPct) / 100;
  const pushSync = () => pulses.push(Math.round(te * j()), -Math.round(te * proto.syncLowFactor * j()));

  if (proto.pilotFirst) pushSync();
  for (let b = proto.bits - 1; b >= 0; b--) {
    const bit = (masked >>> b) & 1;
    if (bit === 0) {
      pulses.push(Math.round(te * j()), -Math.round(te * proto.ratio * j()));
    } else {
      pulses.push(Math.round(te * proto.ratio * j()), -Math.round(te * j()));
    }
  }
  if (!proto.pilotFirst) pushSync();
  return pulses;
}

export function decodeProtocol(proto, pulses) {
  const minPulses = proto.bits * 2 + 2;
  if (pulses.length < minPulses) return { ok: false, reason: "Too few pulses" };

  const start = proto.pilotFirst ? 2 : 0;
  const end = start + proto.bits * 2;
  const pos = (proto.pilotFirst ? pulses.slice(2) : pulses).filter((p) => p > 0);
  const estTe = Math.min(...pos);
  const { ratio, tol } = proto;
  let val = 0;

  for (let i = start; i < end; i += 2) {
    const rHi = pulses[i] / estTe;
    const rLo = Math.abs(pulses[i + 1]) / estTe;
    const isZero = Math.abs(rHi - 1) <= tol && Math.abs(rLo - ratio) <= tol * ratio;
    const isOne = Math.abs(rHi - ratio) <= tol * ratio && Math.abs(rLo - 1) <= tol;
    if (!isZero && !isOne) {
      const bitIdx = (i - start) / 2;
      return { ok: false, estTe, reason: proto.formatErr(bitIdx, rHi, rLo) };
    }
    val = (val << 1) | (isOne ? 1 : 0);
  }
  return {
    ok: true,
    estTe,
    bits: proto.bits,
    hex: (val >>> 0).toString(16).toUpperCase().padStart(proto.hexDigits, "0"),
  };
}

export function injectGlitches(rawPulses) {
  if (rawPulses.length <= 10) return rawPulses;
  const injected = [];
  for (let i = 0; i < rawPulses.length; i++) {
    const p = rawPulses[i];
    if ((i === 4 || i === 12) && Math.abs(p) > 400 && Math.abs(p) < 3000) {
      const half = Math.round(p / 2);
      injected.push(half, p > 0 ? -25 : 25, p - half);
    } else {
      injected.push(p);
    }
  }
  return injected;
}

function absorbGlitchesAndMerge(raw, minGlitchUs) {
  const cleaned = [];
  let glitchesRemoved = 0;
  for (const p of raw) {
    const mag = Math.abs(p);
    if (mag === 0 || mag < minGlitchUs) {
      glitchesRemoved++;
      if (cleaned.length > 0) {
        cleaned[cleaned.length - 1] += cleaned[cleaned.length - 1] < 0 ? -mag : mag;
      }
      continue;
    }
    const sameSign = cleaned.length > 0 && ((cleaned[cleaned.length - 1] > 0 && p > 0) || (cleaned[cleaned.length - 1] < 0 && p < 0));
    if (sameSign) {
      cleaned[cleaned.length - 1] += cleaned[cleaned.length - 1] < 0 ? -mag : mag;
      continue;
    }
    cleaned.push(p);
  }
  return { cleaned, glitchesRemoved };
}

function clusterPulseTimings(mags) {
  const sorted = [...mags].sort((a, b) => a - b);
  let c0 = sorted[Math.floor(sorted.length / 5)];
  let c1 = sorted[Math.floor((sorted.length * 4) / 5)];

  for (let iter = 0; iter < 16; iter++) {
    const mid = 0.5 * (c0 + c1);
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (const m of mags) {
      if (m <= mid) { s0 += m; n0++; } else { s1 += m; n1++; }
    }
    if (!n0 || !n1) break;
    const nc0 = s0 / n0;
    const nc1 = s1 / n1;
    if (Math.abs(nc0 - c0) < 0.5 && Math.abs(nc1 - c1) < 0.5) {
      c0 = nc0;
      c1 = nc1;
      break;
    }
    c0 = nc0;
    c1 = nc1;
  }
  return { shortUs: Math.round(Math.min(c0, c1)), longUs: Math.round(Math.max(c0, c1)) };
}

function quantizePulses(cleaned, shortUs, longUs, syncThr) {
  const mid = 0.5 * (shortUs + longUs);
  return cleaned.map((p) => {
    const m = Math.abs(p);
    if (m > syncThr) return p;
    const q = m > mid ? longUs : shortUs;
    return p < 0 ? -q : q;
  });
}

export function denoiseAndQuantize(raw, minGlitchUs = 60, syncThr = 3500) {
  const { cleaned, glitchesRemoved } = absorbGlitchesAndMerge(raw, minGlitchUs);
  const mags = cleaned.map((p) => Math.abs(p)).filter((m) => m <= syncThr);
  if (mags.length < 6) return { quantized: cleaned, glitchesRemoved, shortUs: 0, longUs: 0 };

  const { shortUs, longUs } = clusterPulseTimings(mags);
  const quantized = quantizePulses(cleaned, shortUs, longUs, syncThr);
  return { quantized, glitchesRemoved, shortUs, longUs };
}

export function decodeWithKMeans(proto, pulses, enableKMeans) {
  let decoded = decodeProtocol(proto, pulses);
  let mlRecovered = false;
  let kmStats = null;

  if (!decoded.ok && enableKMeans) {
    kmStats = denoiseAndQuantize(pulses);
    const retry = decodeProtocol(proto, kmStats.quantized);
    if (retry.ok) {
      decoded = retry;
      mlRecovered = true;
    }
  }
  return { decoded, mlRecovered, kmStats };
}

export function formatRawData(pulses) {
  return `RAW_Data: ${pulses.map((p) => (p > 0 ? `+${p}` : `${p}`)).join(" ")}`;
}
