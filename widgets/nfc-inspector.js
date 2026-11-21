/**
 * ISO 14443-A Handshake & NDEF Inspector Widget
 * Visualizes anticollision cascade, BCC1/BCC2 XOR checks, Type 2 NDEF TLV pages,
 * and Flipper Zero .nfc export.
 */

import { copyText } from "./canvas.js";

const PRESETS = {
  ntag215: { label: "NTAG215 7B", uid: "04 A1 B2 C3 D4 E5 80", atqa: "44 00", sak: "00", url: "https://cardputer.dev/rf-lab", isLf: false },
  mifare1k: { label: "MIFARE Classic 1K 4B", uid: "DE AD BE EF", atqa: "04 00", sak: "08", url: "", isLf: false },
  desfire: { label: "ISO14443-4 DESFire", uid: "04 52 1A 9E 3C 61 80", atqa: "44 03", sak: "20", url: "", isLf: false },
  lf125: { label: "125 kHz LF Card", uid: "", atqa: "", sak: "", url: "", isLf: true },
};

const URI_PREFIXES = [
  { code: 0x01, text: "http://www." },
  { code: 0x02, text: "https://www." },
  { code: 0x03, text: "http://" },
  { code: 0x04, text: "https://" },
];

function parseHexBytes(str) {
  const clean = str.replace(/[^0-9a-fA-F]/g, "");
  const out = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

const hexByte = (b) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
const fmtBytes = (arr) => arr.map(hexByte).join(" ");

function identifyCard(atqa, sak, uidLen) {
  const sakVal = sak[0] ?? 0;
  const atqaHex = fmtBytes(atqa.slice(0, 2));
  if (sakVal === 0x00 && uidLen === 7) return { name: "NTAG215 (Type 2)", deviceType: "NTAG/Ultralight", isType2: true };
  if (sakVal === 0x00) return { name: "MIFARE Ultralight", deviceType: "NTAG/Ultralight", isType2: true };
  if (sakVal === 0x08) return { name: "MIFARE Classic 1K", deviceType: "Mifare Classic", isType2: false };
  if (sakVal === 0x18) return { name: "MIFARE Classic 4K", deviceType: "Mifare Classic", isType2: false };
  if ((sakVal & 0x20) !== 0) return { name: "ISO 14443-4 / DESFire", deviceType: "ISO14443-4A", isType2: false };
  return { name: `ISO 14443-3A (${atqaHex})`, deviceType: "ISO14443-3A", isType2: false };
}

function buildNdefTlv(urlStr) {
  const raw = (urlStr || "").trim();
  if (!raw) return [0x03, 0x00, 0xfe];

  let prefixCode = 0x00;
  let body = raw;
  for (const p of URI_PREFIXES) {
    if (raw.toLowerCase().startsWith(p.text)) {
      prefixCode = p.code;
      body = raw.slice(p.text.length);
      break;
    }
  }

  const payload = [prefixCode, ...new TextEncoder().encode(body)];
  // Well-known URI record: MB=1 ME=1 SR=1 TNF=0x01 -> 0xD1, TypeLen=1, PayloadLen, Type='U'(0x55)
  const ndefMsg = [0xd1, 0x01, payload.length & 0xff, 0x55, ...payload];
  return [0x03, ndefMsg.length & 0xff, ...ndefMsg, 0xfe];
}

function buildSingleCascade(uid, atqa, sak) {
  const bcc1 = uid[0] ^ uid[1] ^ uid[2] ^ uid[3];
  return {
    bccText: `BCC1 = 0x${hexByte(bcc1)} (OK)`,
    pages: [],
    cascadeLines: [
      `1. WUPA (0x52) -> ATQA: ${fmtBytes(atqa.slice(0, 2))}`,
      `2. CL1 ANTICOLL (0x93 0x20):`,
      `   UID0..3: ${fmtBytes(uid)}`,
      `   BCC1   : ${hexByte(uid[0])} ^ ${hexByte(uid[1])} ^ ${hexByte(uid[2])} ^ ${hexByte(uid[3])} = ${hexByte(bcc1)}`,
      `3. CL1 SELECT (0x93 0x70) -> SAK: ${hexByte(sak[0])} (UID Complete)`,
    ],
  };
}

function buildDoubleCascade(uid, atqa, sak, url) {
  const ct = 0x88;
  const bcc1 = ct ^ uid[0] ^ uid[1] ^ uid[2];
  const bcc2 = uid[3] ^ uid[4] ^ uid[5] ^ uid[6];
  const tlv = buildNdefTlv(url);
  const pages = [
    [uid[0], uid[1], uid[2], bcc1],
    [uid[3], uid[4], uid[5], uid[6]],
    [bcc2, 0x48, 0x00, 0x00],
    [0xe1, 0x10, 0x3e, 0x00],
  ];
  for (let i = 0; i < tlv.length; i += 4) {
    pages.push([tlv[i] ?? 0x00, tlv[i + 1] ?? 0x00, tlv[i + 2] ?? 0x00, tlv[i + 3] ?? 0x00]);
  }
  return {
    bccText: `BCC1:${hexByte(bcc1)} BCC2:${hexByte(bcc2)}`,
    pages,
    cascadeLines: [
      `1. WUPA (0x52) -> ATQA: ${fmtBytes(atqa.slice(0, 2))}`,
      `2. CL1 ANTICOLL (0x93 0x20):`,
      `   CT+UID0..2: 88 ${fmtBytes(uid.slice(0, 3))}`,
      `   BCC1      : 88 ^ ${hexByte(uid[0])} ^ ${hexByte(uid[1])} ^ ${hexByte(uid[2])} = ${hexByte(bcc1)}`,
      `   CL1 SELECT -> SAK: 04 (Cascade bit set -> continue to CL2)`,
      `3. CL2 ANTICOLL (0x95 0x20):`,
      `   UID3..6: ${fmtBytes(uid.slice(3, 7))}`,
      `   BCC2   : ${hexByte(uid[3])} ^ ${hexByte(uid[4])} ^ ${hexByte(uid[5])} ^ ${hexByte(uid[6])} = ${hexByte(bcc2)}`,
      `   CL2 SELECT -> SAK: ${hexByte(sak[0])} (UID Complete)`,
    ],
  };
}

function formatNdefPanel(card, sak, pages) {
  if (card.isType2 && pages.length > 0) {
    return [
      "Page 03 CC: E1 10 3E 00 (Magic=0xE1, v1.0, 496B, R/W)",
      "--- Type 2 Memory Dump ---",
      ...pages.map((p, idx) => {
        const ascii = p.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ".")).join("");
        return `Page ${String(idx).padStart(2, "0")}: ${fmtBytes(p)}  |${ascii}|`;
      }),
    ].join("\n");
  }
  if (sak[0] === 0x08) {
    return [
      "MIFARE Classic 1K does not use Type 2 Capability Container.",
      "Memory is organized into 16 sectors x 4 blocks (16 bytes each),",
      "protected by CRYPTO1 Key A / Key B authentication.",
    ].join("\n");
  }
  return [
    "ISO 14443-4 (T=CL) smartcard detected (SAK bit 5 set).",
    "Uses RATS (0xE0) -> ATS -> ISO 7816-4 APDU NDEF file selection.",
  ].join("\n");
}

function formatFlipperNfc(card, uid, atqa, sak, pages) {
  const lines = [
    "Filetype: Flipper NFC device",
    "Version: 4",
    `Device type: ${card.deviceType}`,
    `UID: ${fmtBytes(uid)}`,
    `ATQA: ${fmtBytes(atqa.slice(0, 2))}`,
    `SAK: ${hexByte(sak[0])}`,
  ];
  if (card.isType2 && pages.length > 0) {
    lines.push(
      "Data format version: 2",
      "NTAG/Ultralight type: NTAG215",
      `Pages total: ${pages.length}`,
      `Pages read: ${pages.length}`,
      ...pages.map((p, idx) => `Page ${idx}: ${fmtBytes(p)}`)
    );
  }
  return lines.join("\n");
}

function buildTemplate(state) {
  return `
    <div class="widget-card">
      <div class="widget-header">
        <div class="widget-title-group">
          <span class="widget-badge">Interactive NFC Lab</span>
          <h3 class="widget-title">ISO 14443-A Handshake &amp; NDEF Inspector</h3>
        </div>
        <span class="status-pill ok" data-role="nfc-pill">ISO 14443-A</span>
      </div>
      <div class="widget-body">
        <div class="widget-actions" data-role="presets">
          <button type="button" class="widget-btn is-active" data-preset="ntag215">NTAG215 7B</button>
          <button type="button" class="widget-btn" data-preset="mifare1k">MIFARE Classic 1K 4B</button>
          <button type="button" class="widget-btn" data-preset="desfire">ISO14443-4 DESFire</button>
          <button type="button" class="widget-btn" data-preset="lf125">125 kHz LF Card</button>
        </div>
        <div class="widget-controls-grid">
          <div class="widget-control"><label>UID (4 or 7 hex bytes)</label><input type="text" data-field="uid" value="${state.uid}" spellcheck="false"></div>
          <div class="widget-control"><label>ATQA (2 hex bytes)</label><input type="text" data-field="atqa" value="${state.atqa}" spellcheck="false"></div>
          <div class="widget-control"><label>SAK (1 hex byte)</label><input type="text" data-field="sak" value="${state.sak}" spellcheck="false"></div>
        </div>
        <div class="widget-control"><label>NDEF URI Payload (Type 2 / NTAG21x)</label><input type="text" data-field="url" value="${state.url}" placeholder="https://example.com" spellcheck="false"></div>
        <div class="widget-readouts">
          <div class="readout-tile"><span class="readout-label">Detected Type</span><span class="readout-value is-cyan" data-role="card-type">--</span></div>
          <div class="readout-tile"><span class="readout-label">UID Length</span><span class="readout-value" data-role="uid-len">--</span></div>
          <div class="readout-tile"><span class="readout-label">BCC1 / BCC2 XOR</span><span class="readout-value is-emerald" data-role="bcc-status">--</span></div>
          <div class="readout-tile"><span class="readout-label">ST25R3916 Mode</span><span class="readout-value is-magenta" data-role="rf-compat">--</span></div>
        </div>
        <div class="widget-subpanel-grid">
          <div class="widget-subpanel"><h4 class="widget-subpanel-title">Anticollision Cascade &amp; BCC Verification</h4><div class="widget-code-panel" data-role="cascade-out"></div></div>
          <div class="widget-subpanel"><h4 class="widget-subpanel-title">NTAG Capability Container &amp; NDEF TLV (0x03)</h4><div class="widget-code-panel" data-role="ndef-out"></div></div>
        </div>
        <div class="widget-subpanel">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.45rem;">
            <h4 class="widget-subpanel-title" style="margin:0;">Flipper Zero .nfc Preview</h4>
            <div class="widget-actions">
              <button type="button" class="widget-btn" data-action="copy-nfc">Copy .nfc</button>
              <button type="button" class="widget-btn" data-action="download-nfc">Download .nfc</button>
            </div>
          </div>
          <div class="widget-code-panel" data-role="flipper-out"></div>
        </div>
      </div>
    </div>
  `;
}

function queryNfcElements(el) {
  const q = (sel) => el.querySelector(sel);
  return {
    uidIn: q('[data-field="uid"]'),
    atqaIn: q('[data-field="atqa"]'),
    sakIn: q('[data-field="sak"]'),
    urlIn: q('[data-field="url"]'),
    nfcPill: q('[data-role="nfc-pill"]'),
    cardTypeEl: q('[data-role="card-type"]'),
    uidLenEl: q('[data-role="uid-len"]'),
    bccStatusEl: q('[data-role="bcc-status"]'),
    rfCompatEl: q('[data-role="rf-compat"]'),
    cascadeOut: q('[data-role="cascade-out"]'),
    ndefOut: q('[data-role="ndef-out"]'),
    flipperOut: q('[data-role="flipper-out"]'),
    copyBtn: q('[data-action="copy-nfc"]'),
    dlBtn: q('[data-action="download-nfc"]'),
    presetBtns: [...el.querySelectorAll("[data-preset]")],
  };
}

function renderLfIncompatible(ui) {
  ui.nfcPill.textContent = "NO 13.56 MHz RESPONSE";
  ui.nfcPill.className = "status-pill err";
  ui.cardTypeEl.textContent = "125 kHz LF (EM4100 / HID)";
  ui.uidLenEl.textContent = "N/A (LF)";
  ui.bccStatusEl.textContent = "No WUPA Reply";
  ui.bccStatusEl.className = "readout-value is-red";
  ui.rfCompatEl.textContent = "Incompatible (HF Only)";
  ui.cascadeOut.textContent = [
    "TX > WUPA (0x52) at 13.56 MHz",
    "RX < TIMEOUT (no load modulation)",
    "",
    "Why: ST25R3916 is a 13.56 MHz HF transceiver.",
    "125 kHz LF fobs (EM4100, T5577, HID Prox) operate",
    "108x lower in frequency and have no ISO 14443-A IC.",
  ].join("\n");
  ui.ndefOut.textContent = "No Type 2 Capability Container or NDEF TLV available for 125 kHz LF tags.";
  ui.flipperOut.textContent = "# 125 kHz LF cards use Flipper .rfid files, not .nfc (13.56 MHz) files.";
}

function renderInvalidInput(ui, uidLen) {
  ui.nfcPill.textContent = "INVALID HEX INPUT";
  ui.nfcPill.className = "status-pill warn";
  ui.cardTypeEl.textContent = "Check UID (4B/7B), ATQA (2B), SAK (1B)";
  ui.uidLenEl.textContent = `${uidLen} bytes`;
  ui.bccStatusEl.textContent = "Incomplete";
  ui.bccStatusEl.className = "readout-value is-amber";
  ui.rfCompatEl.textContent = "13.56 MHz HF";
  ui.cascadeOut.textContent = "Enter a 4-byte or 7-byte hex UID, 2-byte ATQA, and 1-byte SAK.";
  ui.ndefOut.textContent = "--";
  ui.flipperOut.textContent = "--";
}

function renderNfcState(ui, state) {
  if (state.isLf) {
    renderLfIncompatible(ui);
    return;
  }

  const uid = parseHexBytes(state.uid);
  const atqa = parseHexBytes(state.atqa);
  const sak = parseHexBytes(state.sak);
  if ((uid.length !== 4 && uid.length !== 7) || atqa.length < 2 || sak.length < 1) {
    renderInvalidInput(ui, uid.length);
    return;
  }

  const card = identifyCard(atqa, sak, uid.length);
  const cascade = uid.length === 4 ? buildSingleCascade(uid, atqa, sak) : buildDoubleCascade(uid, atqa, sak, state.url);

  ui.nfcPill.textContent = "ISO 14443-A VALID";
  ui.nfcPill.className = "status-pill ok";
  ui.cardTypeEl.textContent = card.name;
  ui.uidLenEl.textContent = `${uid.length} bytes (${uid.length === 7 ? "Double" : "Single"})`;
  ui.rfCompatEl.textContent = "ST25R3916 Ready";
  ui.bccStatusEl.textContent = cascade.bccText;
  ui.bccStatusEl.className = "readout-value is-emerald";
  ui.cascadeOut.textContent = cascade.cascadeLines.join("\n");
  ui.ndefOut.textContent = formatNdefPanel(card, sak, cascade.pages);
  ui.flipperOut.textContent = formatFlipperNfc(card, uid, atqa, sak, cascade.pages);
}

function downloadNfcFile(filename, content) {
  const blob = new Blob([content + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function bindNfcEvents(ui, state, onRender) {
  ui.presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.preset;
      Object.assign(state, { preset: key }, PRESETS[key]);
      ui.uidIn.value = state.uid;
      ui.atqaIn.value = state.atqa;
      ui.sakIn.value = state.sak;
      ui.urlIn.value = state.url;
      ui.presetBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      onRender();
    });
  });

  [[ui.uidIn, "uid"], [ui.atqaIn, "atqa"], [ui.sakIn, "sak"], [ui.urlIn, "url"]].forEach(([input, field]) => {
    input.addEventListener("input", () => {
      state.isLf = false;
      state[field] = input.value;
      ui.presetBtns.forEach((b) => b.classList.remove("is-active"));
      onRender();
    });
  });

  ui.copyBtn.addEventListener("click", () => copyText(ui.flipperOut.textContent, ui.copyBtn, "Copy .nfc"));
  ui.dlBtn.addEventListener("click", () => downloadNfcFile(`${state.preset || "card"}.nfc`, ui.flipperOut.textContent));
}

export function mountNfcInspector(el) {
  const state = { preset: "ntag215", ...PRESETS.ntag215 };
  el.innerHTML = buildTemplate(state);
  const ui = queryNfcElements(el);
  const onRender = () => renderNfcState(ui, state);

  bindNfcEvents(ui, state, onRender);
  onRender();
  return null;
}
