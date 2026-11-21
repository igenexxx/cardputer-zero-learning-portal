/**
 * Pure-JS Infrared Protocol Encoders/Decoders & 1D K-Means Pulse Denoiser
 * Supports NEC, Samsung32, RC5 (14-bit), and SIRC (12-bit) with synthetic
 * timing jitter (0-150 us), EMI glitch injection, and header-preserving K-Means.
 */

export const IR_PROTOCOLS = {
  nec: {
    id: "nec",
    name: "NEC",
    encoding: "Pulse-Distance (LSB)",
    carrierHz: 38000,
    dutyPct: 33,
    defaultAddr: 0x04,
    defaultCmd: 0x08,
    headerMark: 9000,
    headerSpace: 4500,
    shortUs: 562,
    longUs: 1687,
  },
  samsung32: {
    id: "samsung32",
    name: "Samsung32",
    encoding: "Pulse-Distance (LSB)",
    carrierHz: 38000,
    dutyPct: 33,
    defaultAddr: 0x07,
    defaultCmd: 0x02,
    headerMark: 4500,
    headerSpace: 4500,
    shortUs: 550,
    longUs: 1650,
  },
  rc5: {
    id: "rc5",
    name: "RC5",
    encoding: "Bi-Phase Manchester (MSB)",
    carrierHz: 36000,
    dutyPct: 33,
    defaultAddr: 0x00,
    defaultCmd: 0x0c,
    headerMark: 0,
    headerSpace: 0,
    shortUs: 889,
    longUs: 1778,
  },
  sirc: {
    id: "sirc",
    name: "SIRC-12",
    encoding: "Pulse-Width (LSB)",
    carrierHz: 40000,
    dutyPct: 33,
    defaultAddr: 0x01,
    defaultCmd: 0x15,
    headerMark: 2400,
    headerSpace: 600,
    shortUs: 600,
    longUs: 1200,
  },
};

const MIN_GLITCH_US = 120;
const HEADER_MIN_US = 2200;

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function coalesceSigned(pulses) {
  const out = [];
  for (const p of pulses) {
    if (p === 0) continue;
    if (out.length > 0 && (out[out.length - 1] > 0) === (p > 0)) {
      out[out.length - 1] += p;
    } else {
      out.push(p);
    }
  }
  return out;
}

export function encodeIR(protoId, addr, cmd) {
  const p = IR_PROTOCOLS[protoId] || IR_PROTOCOLS.nec;
  const pulses = [];

  if (protoId === "nec" || protoId === "samsung32") {
    pulses.push(p.headerMark, -p.headerSpace);
    const bytes =
      protoId === "nec"
        ? [addr & 0xff, (~addr) & 0xff, cmd & 0xff, (~cmd) & 0xff]
        : [addr & 0xff, addr & 0xff, cmd & 0xff, (~cmd) & 0xff];
    for (const b of bytes) {
      for (let i = 0; i < 8; i++) {
        const bit = (b >>> i) & 1;
        pulses.push(p.shortUs, -(bit ? p.longUs : p.shortUs));
      }
    }
    pulses.push(p.shortUs);
    return pulses;
  }

  if (protoId === "sirc") {
    pulses.push(p.headerMark, -p.headerSpace);
    const word = ((addr & 0x1f) << 7) | (cmd & 0x7f);
    for (let i = 0; i < 12; i++) {
      const bit = (word >>> i) & 1;
      pulses.push(bit ? p.longUs : p.shortUs, -p.shortUs);
    }
    return pulses.slice(0, -1);
  }

  // RC5: 14-bit MSB-first (S1=1, S2=1, T=0, 5-bit addr, 6-bit cmd)
  const frame = (1 << 13) | (1 << 12) | ((addr & 0x1f) << 6) | (cmd & 0x3f);
  const raw = [];
  for (let i = 13; i >= 0; i--) {
    const bit = (frame >>> i) & 1;
    if (bit === 1) raw.push(-p.shortUs, p.shortUs);
    else raw.push(p.shortUs, -p.shortUs);
  }
  const merged = coalesceSigned(raw);
  return merged[0] < 0 ? merged.slice(1) : merged;
}

export function applyJitterAndGlitches(cleanPulses, jitterUs, glitchCount, seed = 1) {
  const jittered = cleanPulses.map((val, idx) => {
    if (jitterUs <= 0) return val;
    const sign = val > 0 ? 1 : -1;
    const mag = Math.abs(val);
    const delta = Math.round((seededUnit(seed * 97 + idx * 13 + 7) * 2 - 1) * jitterUs);
    return sign * Math.max(150, mag + delta);
  });

  if (glitchCount <= 0) return jittered;
  const out = [...jittered];
  const step = Math.max(2, Math.floor(out.length / (glitchCount + 1)));
  let inserted = 0;
  for (let i = 2; i < out.length - 1 && inserted < glitchCount; i += step + 2) {
    const orig = out[i];
    const mag = Math.abs(orig);
    if (mag < 320) continue;
    const sign = orig > 0 ? 1 : -1;
    const glitchMag = 45 + Math.floor(seededUnit(seed * 31 + inserted * 19) * 55);
    const half = Math.floor((mag - glitchMag) / 2);
    out.splice(i, 1, sign * half, -sign * glitchMag, sign * (mag - glitchMag - half));
    inserted++;
  }
  return out;
}

export function denoiseIRPulses(rawPulses) {
  const absorbed = [];
  let glitchesRemoved = 0;
  for (const p of rawPulses) {
    const mag = Math.abs(p);
    if (mag === 0) {
      glitchesRemoved++;
      continue;
    }
    if (mag < MIN_GLITCH_US) {
      glitchesRemoved++;
      if (absorbed.length > 0) {
        const prev = absorbed[absorbed.length - 1];
        absorbed[absorbed.length - 1] = prev > 0 ? prev + mag : prev - mag;
      }
      continue;
    }
    absorbed.push(p);
  }
  const cleaned = coalesceSigned(absorbed);
  const dataMags = cleaned.map(Math.abs).filter((m) => m < HEADER_MIN_US);
  if (dataMags.length < 4) {
    return { pulses: cleaned, shortUs: 0, longUs: 0, jitterPct: 0, glitchesRemoved };
  }

  let c0 = Math.min(...dataMags);
  let c1 = Math.max(...dataMags);
  if (c1 - c0 < 80) c1 = c0;

  for (let iter = 0; iter < 20 && c1 > c0; iter++) {
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (const m of dataMags) {
      if (Math.abs(m - c0) <= Math.abs(m - c1)) { s0 += m; n0++; }
      else { s1 += m; n1++; }
    }
    const next0 = n0 > 0 ? s0 / n0 : c0;
    const next1 = n1 > 0 ? s1 / n1 : c1;
    if (Math.abs(next0 - c0) < 0.5 && Math.abs(next1 - c1) < 0.5) break;
    c0 = next0;
    c1 = next1;
  }

  const shortUs = Math.round(Math.min(c0, c1));
  const longUs = Math.round(Math.max(c0, c1));
  let errSum = 0;
  for (const m of dataMags) {
    const target = Math.abs(m - shortUs) <= Math.abs(m - longUs) ? shortUs : longUs;
    errSum += target > 0 ? Math.abs(m - target) / target : 0;
  }
  const jitterPct = Math.round((errSum / dataMags.length) * 100);

  const quantized = cleaned.map((p) => {
    const mag = Math.abs(p);
    if (mag >= HEADER_MIN_US) return p;
    const sign = p > 0 ? 1 : -1;
    const target = Math.abs(mag - shortUs) <= Math.abs(mag - longUs) ? shortUs : longUs;
    if (target > 0 && Math.abs(mag - target) / target <= 0.35) return sign * target;
    return p;
  });

  return { pulses: quantized, shortUs, longUs, jitterPct, glitchesRemoved };
}

function approx(val, target, tolUs) {
  return Math.abs(val - target) <= tolUs;
}

function decodePulseDistance(pulses, proto) {
  if (pulses.length < 67) return null;
  if (!approx(pulses[0], proto.headerMark, 600) || !approx(-pulses[1], proto.headerSpace, 450)) return null;
  const bytes = [0, 0, 0, 0];
  const tol = 95;
  for (let b = 0; b < 32; b++) {
    const mk = pulses[2 + b * 2];
    const sp = -pulses[3 + b * 2];
    if (!approx(mk, proto.shortUs, tol)) return null;
    if (approx(sp, proto.longUs, tol * 1.4)) bytes[b >> 3] |= 1 << (b & 7);
    else if (!approx(sp, proto.shortUs, tol)) return null;
  }
  if (proto.id === "nec" && ((bytes[0] ^ bytes[1]) !== 0xff || (bytes[2] ^ bytes[3]) !== 0xff)) return null;
  if (proto.id === "samsung32" && (bytes[0] !== bytes[1] || (bytes[2] ^ bytes[3]) !== 0xff)) return null;
  return { ok: true, protocol: proto.name, addr: bytes[0], cmd: bytes[2] };
}

function decodeSirc(pulses, proto) {
  if (pulses.length < 25) return null;
  if (!approx(pulses[0], proto.headerMark, 300) || !approx(-pulses[1], proto.headerSpace, 95)) return null;
  let word = 0;
  for (let i = 0; i < 12; i++) {
    const mk = pulses[2 + i * 2];
    if (approx(mk, proto.longUs, 100)) word |= 1 << i;
    else if (!approx(mk, proto.shortUs, 95)) return null;
    if (i < 11 && !approx(-pulses[3 + i * 2], proto.shortUs, 95)) return null;
  }
  return { ok: true, protocol: proto.name, addr: (word >>> 7) & 0x1f, cmd: word & 0x7f };
}

function decodeRc5(pulses, proto) {
  const halfBits = [0]; // leading space of S1=1
  for (const p of pulses) {
    const mag = Math.abs(p);
    const level = p > 0 ? 1 : 0;
    if (approx(mag, proto.shortUs, 95)) halfBits.push(level);
    else if (approx(mag, proto.longUs, 140)) halfBits.push(level, level);
    else return null;
  }
  if (halfBits.length === 27) halfBits.push(0);
  if (halfBits.length < 28) return null;
  let frame = 0;
  for (let i = 0; i < 14; i++) {
    const a = halfBits[i * 2];
    const b = halfBits[i * 2 + 1];
    if (a === b) return null;
    frame = (frame << 1) | (a === 0 && b === 1 ? 1 : 0);
  }
  if ((frame >>> 12) !== 0b11) return null;
  return { ok: true, protocol: proto.name, addr: (frame >>> 6) & 0x1f, cmd: frame & 0x3f };
}

export function decodeIR(protoId, pulses) {
  const proto = IR_PROTOCOLS[protoId] || IR_PROTOCOLS.nec;
  if (protoId === "nec" || protoId === "samsung32") {
    return decodePulseDistance(pulses, proto) || { ok: false, reason: "Timing/checksum mismatch" };
  }
  if (protoId === "sirc") {
    return decodeSirc(pulses, proto) || { ok: false, reason: "Pulse-width jitter error" };
  }
  return decodeRc5(pulses, proto) || { ok: false, reason: "Manchester edge error" };
}

export function formatFlipperData(pulses) {
  return pulses.map((p) => Math.abs(Math.round(p))).join(" ");
}
