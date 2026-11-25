# NFC & ISO 14443-A Theory

This guide connects every screen and feature in **NFC Studio** directly to the underlying 13.56 MHz RF physics, **ST25R3916** transceiver silicon, **ISO/IEC 14443-A** framing protocol, **NFC Forum Type 2 (NTAG21x)** memory architecture, and **Flipper `.nfc`** file format.

---

## 1. 13.56 MHz HF NFC vs. 125 kHz LF RFID

The most common surprise when first using an NFC transceiver is holding an apartment intercom keyfob or office proximity badge up to the antenna and seeing **no response at all**—even though `--probe` confirms the ST25R3916 is working perfectly.

RFID operates across completely different frequency bands with incompatible antennas and modulation schemes:

| Property | 125 kHz LF RFID | 13.56 MHz HF NFC / RFID |
| :--- | :--- | :--- |
| **Carrier Frequency** | 125 kHz (Low Frequency) | **13.56 MHz** (High Frequency) |
| **Common Standards** | EM4100 / EM4102, HID Prox, Indala, T5577 | **ISO 14443-A/B**, ISO 15693, FeliCa |
| **Typical Cards / Fobs** | Blue/grey teardrop apartment intercom fobs, older thick clamshell badges | NTAG213/215/216 stickers, MIFARE Classic/DESFire, bank cards, transit cards, smartphones |
| **Anticollision** | None (single-card broadcast) | Full binary-tree anticollision (multiple cards in field) |
| **ST25R3916 Support** | **No** (physically incompatible coil & carrier) | **Yes** (native hardware reader + Passive Target) |

### Why EM4100 / HID Prox Won't Respond to ST25R3916

Passive cards harvest power by **inductive coupling**—their internal LC tank circuit must resonate at the reader's exact carrier frequency. The ST25R3916's antenna on the Cap CC1101 & NFC is tuned to **13.56 MHz** (over 100× higher than 125 kHz). A 125 kHz EM4100 coil presents virtually infinite impedance at 13.56 MHz, cannot harvest energy, and will never modulate a reply.

> [!TIP]
> **The 2-Second Smartphone NFC Quick Test:**
> Not sure whether a mysterious fob or badge is 13.56 MHz HF or 125 kHz LF? Tap it against the back of any modern Android or iOS phone with NFC enabled (e.g., *NFC Tools*):
> - **Phone beeps / vibrates / reads UID:** It is **13.56 MHz HF NFC** — `nfc-studio` will read it!
> - **Phone does nothing at all:** It is almost certainly **125 kHz LF RFID** (EM4100 / HID Prox) or a damaged tag.

---

## 2. ST25R3916 Transceiver Architecture

The **ST25R3916** (STMicroelectronics) on the CardputerZero Cap is a high-performance 13.56 MHz NFC initiator/target IC connected to the Raspberry Pi CM0 over **SPI0 CS2 (`/dev/spidev0.2`, GPIO22)**.

### SPI Bus & Register Spaces

- **SPI Mode 1 (`CPOL=0, CPHA=1`):** Data is sampled on the **falling** edge of `SCLK` and shifted on the rising edge. Using SPI Mode 0 returns garbled registers! `nfc-studio` configures Mode 1 at **5 MHz** via `SPI_IOC_WR_MODE`.
- **Command & Register Opcodes:**
  - `0x00..0x3F`: Write Register Space A
  - `0x40 | reg`: Read Register Space A (e.g. `0x3F` = IC Identity; upper 5 bits `0x28` confirm ST25R3916, lower 3 bits give silicon revision)
  - `0x80`: Load 512-byte TX FIFO (`opLoadFIFO`)
  - `0x9F`: Read 512-byte RX FIFO (`opReadFIFO`)
  - `0xA0`: Load Passive Target A memory (`opLoadPTMemA`)
  - `0xC1..0xFC`: Direct commands (`0xC1` Set Default, `0xC2` Stop All, `0xC4` Transmit with CRC, `0xC5` Transmit without CRC, `0xC6` REQA, `0xC7` WUPA, `0xDB` Clear FIFO, `0xDF` Measure Power Supply, `0xFB` Space B prefix)
- **Thermal Erratum & Supply Measurement:** During initialization, `nfc-studio` sends ST's test-access sequence (`0xFC 0x04 0x10`) to prevent premature overheat trips, runs `cmdMeasurePowerSupp (0xDF)`, and reads `regADConverterOut (0x25)` at **23.4 mV/step**. If the measured supply is between 2.4 V and 4.0 V, it sets the `ioSupply3V` bit in `regIOConfig2 (0x01)`.

### 512-Byte FIFO & 2-Byte CRC Retention

The ST25R3916 features a **512-byte shared FIFO**. Byte count is split across `regFIFOStatus1 (0x1E)` (low 8 bits) and the upper 2 bits of `regFIFOStatus2 (0x1F)`.

> [!IMPORTANT]
> **Critical Hardware Quirk — 2-Byte CRC Retention:**
> Even when the ST25R3916 verifies a received ISO 14443-A CRC_A in hardware and raises no `irqErrCRC` error, it **retains the 2-byte CRC inside the RX FIFO**. For example, a Type 2 `READ (0x30)` command returns 16 data bytes + 2 CRC bytes = **18 bytes** in the FIFO. The driver slices only the first 16 bytes for the 4 pages.

### Interrupt Registers & `T_guard` Power-Up Timing

Instead of relying on a dedicated IRQ GPIO pin, `nfc-studio` burst-reads the 4 consecutive interrupt registers (`0x1A`–`0x1D`) in a single SPI transfer (reading clears them):

| Register | Name | Key Bits Used |
| :--- | :--- | :--- |
| **`0x1A`** | Main IRQ | `RXS (0x20)` RX Start, `RXE (0x10)` RX End, `TXE (0x08)` TX End, `COL (0x04)` Bit Collision |
| **`0x1B`** | Timer & NFC IRQ | `NRE (0x40)` No-Response Timer Expired (ticks = 64 carrier periods ≈ `4.72 µs/tick`) |
| **`0x1C`** | Error & Wake-up IRQ | `CRC (0x40)`, `Parity (0x20)`, `Soft/Hard Framing (0x10 / 0x08)` |
| **`0x1D`** | Passive Target IRQ | `WUA (0x80)` Wake-up A, `SDDC (0x10)` SDD Complete (reader selected emulated card) |

Before every poll cycle, `nfc-studio` performs a **3 ms field-off reset** (guaranteeing that any card left in `HALT` or ISO 14443-4 state returns to `IDLE`), then turns on the 13.56 MHz carrier (`opEnable | opRxEnable | opTxEnable`) and waits **`T_guard = 6 ms`** so the passive tag's capacitor charges fully before the first `WUPA` frame is transmitted.

---

## 3. ISO 14443-A Full Handshake

Every time you tap a card in `SCAN` mode, `PollISO14443A()` executes the standard ISO/IEC 14443-3 Type A discovery state machine:

```text
Reader (ST25R3916)                              Tag (PICC)
──────────────────                              ──────────
[RF Field OFF 3ms → ON + T_guard 6ms]
  ──── WUPA (0x52, 7-bit short frame) ───────►  (Wakes IDLE & HALT cards)
  ◄─── ATQA (2 bytes, e.g. 44 00) ────────────

  ── Cascade Level 1 (CL1 = 0x93) ──
  ──── [93 20] (Anticollision, no CRC) ──────►
  ◄─── [b0 b1 b2 b3 BCC] (5 bytes) ───────────  (Verify: b0^b1^b2^b3 == BCC)
  ──── [93 70 b0 b1 b2 b3 BCC + CRC_A] ──────►  (SELECT CL1)
  ◄─── [SAK1 + CRC_A] ────────────────────────  (If SAK1 & 0x04 != 0 → Cascade!)

  ── Cascade Level 2 (CL2 = 0x95, for 7B UID) ──
  ──── [95 20] (Anticollision, no CRC) ──────►
  ◄─── [u3 u4 u5 u6 BCC2] (5 bytes) ──────────  (Verify: u3^u4^u5^u6 == BCC2)
  ──── [95 70 u3 u4 u5 u6 BCC2 + CRC_A] ─────►  (SELECT CL2)
  ◄─── [SAK2 + CRC_A] ────────────────────────  (SAK2 & 0x04 == 0 → UID Complete!)
```

### Step-by-Step Breakdown

1. **`WUPA (0x52)` vs. `REQA (0x26)`:** Both are 7-bit short frames. `WUPA` wakes both `IDLE` and `HALT` cards, making polling much more resilient than `REQA`. The tag responds with 2-byte **`ATQA`** (Answer To Request A), which encodes UID size bits and anticollision support.
2. **Anticollision (`[SEL, 0x20]`):** `SEL` is `0x93` (CL1), `0x95` (CL2), or `0x97` (CL3), and `0x20` is NVB (Number of Valid Bits = 2 bytes, 0 extra bits). Hardware anticollision (`regISO14443A = 0x01`) and `auxNoCRCRx (0x80)` are enabled because anticollision replies carry no CRC—instead, byte 4 is the **BCC (Block Check Character)**, an XOR checksum:
   $$\text{BCC} = b_0 \oplus b_1 \oplus b_2 \oplus b_3$$
3. **`SELECT` (`[SEL, 0x70, b0..b3, BCC]` + CRC_A):** NVB `0x70` means all 7 bytes are complete. The card replies with 1-byte **`SAK`** (Select Acknowledge) + 2-byte CRC_A.
   - If bit 2 of SAK is set (`SAK & 0x04 != 0`) or `b0 == 0x88`, the UID is **incomplete** and the reader advances to the next Cascade Level.
   - When `SAK & 0x04 == 0`, the UID is complete and SAK identifies the card's protocol layer.

### 4-Byte vs. 7-Byte UIDs (`CT = 0x88`)

- **Single-size (4-byte UID, e.g. MIFARE Classic 1K):** Resolved in CL1 alone (`0x93`). `clBytes[0..3]` are `UID0..UID3`, and `SAK` has bit 2 clear (e.g. `0x08`).
- **Double-size (7-byte UID, e.g. NTAG215):** In CL1, byte 0 is the **Cascade Tag `CT = 0x88`**, followed by `UID0, UID1, UID2` (where `UID0 = 0x04` denotes NXP Semiconductors), and `SAK1` is `0x04`. In CL2 (`0x95`), the tag sends `UID3, UID4, UID5, UID6` and final `SAK2 = 0x00`.
- **Triple-size (10-byte UID):** Uses `CT = 0x88` in both CL1 and CL2, finishing in CL3 (`0x97`).

---

## 4. Card Families & Memory Architecture

### NTAG21x / MIFARE Ultralight (NFC Forum Type 2 Tag)

Identified by **`ATQA = 44 00`**, **`SAK = 0x00`**, and a **7-byte UID**. Memory is organized into **4-byte pages** read 4 pages (16 bytes) at a time with command **`READ (0x30, startPage)`**:

| Pages | Role | Example Bytes (NTAG215) | Notes |
| :--- | :--- | :--- | :--- |
| **`P00`** | UID0–2 + BCC0 | `04 A1 B2 77` | `BCC0 = 0x88 ^ UID0 ^ UID1 ^ UID2` |
| **`P01`** | UID3–6 | `C3 D4 E5 F6` | Second half of 7-byte UID |
| **`P02`** | BCC1, Internal, Lock0–1 | `11 48 00 00` | `BCC1 = UID3 ^ UID4 ^ UID5 ^ UID6`; static lock bits |
| **`P03`** | **Capability Container (CC)** | `E1 10 3E 00` | `E1` = NDEF magic, `10` = v1.0, `3E` = 62 × 8 = **496B** user NDEF (`12` = 144B NTAG213, `6D` = 872B NTAG216), `00` = R/W open |
| **`P04+`** | **User Memory / NDEF TLV** | `03 11 D1 01 ... FE` | TLV-wrapped NDEF messages |

#### NDEF TLV (`0x03`) Decoding

Starting at Page 4, user memory contains **Type-Length-Value (TLV)** blocks:
- `0x00`: NULL TLV (padding, 1 byte)
- **`0x03`**: **NDEF Message TLV** → next byte is message length `L`, followed by `L` bytes of NDEF records
- `0xFE`: Terminator TLV (end of data)

Inside an NDEF Message, a typical Short Record (`SR=1`, `MB=1`, `ME=1`, `TNF=0x01` Well-Known → header byte `0xD1`):
```text
03 11          TLV Type=0x03 (NDEF), Length=17 bytes
D1 01 0D 55    Header=0xD1 (MB|ME|SR|TNF=1), TypeLen=1, PayloadLen=13, Type='U' (0x55 URI)
04             URI Identifier Code: 0x04 = "https://" (0x03="http://", 0x01="http://www.", 0x02="https://www.")
63 61 72 ...   ASCII "cardputer.cc"
FE             Terminator TLV
```

### MIFARE Classic 1K (`ATQA 04 00`, `SAK 08`)

MIFARE Classic 1K is a legacy proprietary card with **1,024 bytes** organized into **16 sectors × 4 blocks × 16 bytes**:
- Block 0 of Sector 0 holds the manufacturer UID and BCC.
- Block 3 of every sector is the **Sector Trailer**: 6-byte **Key A**, 4-byte **Access Bits**, and 6-byte **Key B**.
- Before reading or writing any sector, the reader must complete a mutual 3-pass authentication handshake using the **CRYPTO1** stream cipher. Because `nfc-studio` focuses on standards-compliant ISO 14443-A discovery and Type 2 / NDEF inspection, it identifies MIFARE Classic cards cleanly via UID/ATQA/SAK without attempting proprietary key attacks.

---

## 5. Passive Target A (`0xA0`) Hardware Emulation

In `EMU` mode, the ST25R3916 operates as an **ISO 14443-A Passive Target (PICC)** using dedicated on-chip hardware:

1. `BuildPTMemoryA(uid, atqa, sak)` constructs a **15-byte Passive Target A memory image**:
   - **4-byte UID:** `[ATQA0, ATQA1, UID0, UID1, UID2, UID3, SAK, 0..0]`
   - **7-byte UID:** `[ATQA0, ATQA1, UID0, UID1, UID2, UID3, UID4, UID5, UID6, SAK, 0..0]`
2. `nfc-studio` uploads this image via SPI opcode **`0xA0` (`opLoadPTMemA`)**.
3. It sets `regMode (0x03) = 0x88` (Target mode, NFC-A) and `regOpControl (0x02) = opEnable | opRxEnable` (**TX field OFF** — load modulation is powered by the external reader's field).
4. The ST25R3916 handles `REQA`/`WUPA`, anticollision, and `SELECT` autonomously in silicon with microsecond precision. Each time an external reader wakes or selects the emulated card, the chip sets `irqTargetWUA (0x80)` or `irqTargetSDDC (0x10)` in `regInterruptTarget (0x1D)`, incrementing the `HITS` counter in `nfc-studio`.

---

## 6. Flipper Zero `.nfc` File Format

`nfc-studio` reads and writes standard **Flipper Zero Version 4 `.nfc`** text files, making tags seamlessly portable between CardputerZero and Flipper Zero:

```text
Filetype: Flipper NFC device
Version: 4
Device type: NTAG215
UID: 04 A1 B2 C3 D4 E5 F6
ATQA: 44 00
SAK: 00
Pages total: 9
Page 0: 04 A1 B2 77
Page 1: C3 D4 E5 F6
Page 2: 11 48 00 00
Page 3: E1 10 3E 00
Page 4: 03 11 D1 01
Page 5: 0D 55 04 63
Page 6: 61 72 64 70
Page 7: 75 74 65 72
Page 8: 2E 63 63 FE
```

Both `Page N:` (4-byte Type 2 pages) and `Block N:` (16-byte MIFARE blocks) are parsed cleanly by `internal/nfcfile/nfcfile.go`.

---

## 7. Physical Card Writing: NTAG21x, Magic Gen1A, Gen2/CUID & Pure-Go Crypto1

Understanding what silicon **can** and **cannot** be rewritten prevents wasted blank cards and bricked sectors:

| Card Family | UID Rewritable? | Write Protocol on ST25R3916 | Safety Guard in `nfc-studio` |
| :--- | :--- | :--- | :--- |
| **NTAG213 / 215 / 216 (Type 2)** | **No** (factory laser-locked in `P00–P02`) | `WRITE (0xA2, page, b0..b3)` + `READ (0x30)` verify | Blocks `P00–P03` (UID/Lock/CC) and trailing dynamic-lock/config pages by default (`ErrProtectedPage`). |
| **Magic Card Gen1A (Chinese UID)** | **Yes** (4B Block 0 + BCC) | `HALT (0x50 0x00)` → 7-bit `0x40` → 8-bit `0x43` → plaintext `WRITE (0xA0, blk)` | Unlocks **all** 1K/4K blocks without Crypto1! Skips sector trailers (`blk%4==3`) unless `TRLR!` / `include_trailers: true`. |
| **Magic Card Gen2 / CUID** | **Yes** (4B Block 0 via Sector 0 auth) | 3-pass **Crypto1** known-key auth (`no_tx_par`/`no_rx_par` 9-bit framing) → encrypted `WRITE (0xA0, blk)` | Uses pure-Go 48-bit Crypto1 LFSR in `internal/st25r3916/crypto1.go` strictly with known keys (factory `FF..FF` or `.nfc` trailer keys). |
| **Standard MIFARE Classic 1K/4K** | **No** (Block 0 is factory RO) | Same pure-Go known-key Crypto1 on data blocks `1..63` / `1..255` | Skips Block 0 and sector trailers by default so bad access bits never brick a sector. |
| **ISO 15693 / NFC-V (SLIX/ICODE)** | **No** (64-bit UID is factory RO) | Addressed `WRITE_SINGLE_BLOCK (0x21)` + `READ_SINGLE_BLOCK (0x20)` verify | Enforces 4-byte blocks and verifies read-back after every block. |
| **EMV / DESFire / FeliCa / NFC-B** | **No** | Hardware cryptography / non-writable silicon | Rejected cleanly by `BuildWritePlan` (`StrategyUnsupported`); use **Emulate** for FeliCa IDm. |

### How Pure-Go Crypto1 Runs on ST25R3916 (No Hardware Crypto Engine)

Unlike legacy PN532/MFRC522 chips, the **ST25R3916** does not embed a proprietary MIFARE Crypto1 block. Instead, it exposes **transparent raw-parity mode** in `regISO14443A (0x05)` (`no_tx_par = 0x80`, `no_rx_par = 0x40`):
1. Reader sends plaintext `AUTH_A (0x60)` / `AUTH_B (0x61)` + block index with standard CRC and receives the tag's 4-byte nonce $n_T$.
2. `internal/st25r3916/crypto1.go` initializes the 48-bit LFSR with the known 6-byte key, shifts $\text{UID} \oplus n_T$, generates a random 4-byte reader nonce $n_R$, and computes $a_R = \text{PRNG}(n_T, 64)$.
3. Every encrypted byte carries an **encrypted odd-parity bit** ($p_i = \text{oddParity}(m_i) \oplus f(\text{LFSR})$), yielding **9 bits per byte** packed LSB-first into the ST25R3916 FIFO via `PackParityBits` and `regTxBytes1/2`.
4. After verifying the card's encrypted $a_T = \text{PRNG}(n_T, 96)$, subsequent `WRITE (0xA0)` and `READ (0x30)` frames (with ISO 14443-A CRC16) and 4-bit ACKs (`0x0A`) flow encrypted across the same 9-bit transparent channel.

### Cross-Card Compatibility Matrix (`AUTO` Mode)

| Source `.nfc` → Blank Card | Compatibility | Behavior in `AUTO` Mode |
| :--- | :---: | :--- |
| **NTAG213 → NTAG215 / 216** | Exact | Writes all user pages `P04+` directly. |
| **NTAG215 / 216 → NTAG213** | Adapted (if payload ≤ 36 pg) | Automatically trims trailing `0x00` padding after NDEF `0xFE`; rejects if active payload exceeds 144 bytes. |
| **MIFARE 1K → Magic Gen1A (1K/4K)** | Exact / Adapted | Detects `0x40`/`0x43` non-destructively; clones Block 0 UID + all readable data blocks. |
| **MIFARE 1K → Gen2 CUID / Regular 1K** | Exact | Tries Crypto1 Block 0 (`Gen2/CUID`); if Block 0 returns `NAK` (regular MIFARE), falls back to writing data blocks `1..63` (`DATA OK - UID locked`). |
| **NTAG21x (7B) ↔ MIFARE Classic (4B)** | Incompatible | Rejected before any RF write (`NTAG (7B) != MIFARE 1K (4B)`). |
| **DESFire / EMV / FeliCa / 125 kHz LF** | Incompatible | Rejected with exact reason (use **Emulate** for FeliCa IDm; 125 kHz LF is unsupported by ST25R3916). |

---

## 8. Practical Guide: Card & Keyfob Types, Purposes & Which Blank to Choose

Not all NFC cards and plastic keyfobs ("fobs") are interchangeable. Use this quick reference to match every physical card/fob on your bench to the right real-world job:

### Quick Decision Table (Goal → Best Card / Fob)

| What You Want to Do | Recommended Card / Fob | iPhone Support? | UID Changeable? | `nfc-studio` Mode |
| :--- | :--- | :---: | :---: | :--- |
| **Tap-to-join Guest Wi-Fi, URLs, vCards** | **NTAG213 / NTAG215 / NTAG216** | Yes (native, no app) | No (7B factory RO) | `WRITE -> QUICK NDEF` |
| **iPhone Shortcuts / Home Assistant / `radio-bridge` triggers** | **NTAG213 / NTAG215** | Yes (native) | No (7B factory RO) | `READ` / `WRITE` |
| **Nintendo Amiibo backups (Switch / 3DS)** | **NTAG215** *(strictly 504 B!)* | Yes | No | `READ` / `WRITE` |
| **Enroll a new key into your own smart lock / ESP32 (RC522/PN532)** | **Standard MIFARE Classic 1K** (e.g. NXP / Fudan FM11RF08) | **No** *(iOS blocks Crypto1)* | No (4B Block 0 RO) | `READ` / `WRITE` (data sectors) |
| **Learn sectors, Key A/B, Access Bits & Value Blocks (e-wallet)** | **Standard MIFARE Classic 1K / 4K** | **No** | No | `READ` / `HEX` / `nfc_dict_scan` |
| **Clone a 4B UID + 1K/4K dump onto a physical test card** | **Magic Card `Gen1A`** *(fast backdoor)* or **`Gen2 / CUID`** *(stealth)* | **No** | **Yes** (4B Block 0) | `WRITE -> AUTO DET` |
| **Long-range library / ski-pass / warehouse asset tags** | **ISO 15693 / NFC-V** (ICODE SLIX / SLIX2) | Yes (iOS 13+) | No (8B `E0..` RO) | `READ` / `WRITE` (`0x21`) |
| **Transit / e-money IDm experiments (Suica / PASMO / Octopus)** | **FeliCa / NFC-F** (or CardputerZero `EMU`) | Yes | No | `EMU` (Passive Target F) |
| **Contactless bank cards / e-Passports / modern AES corporate badges** | **ISO 14443-4 / DESFire / EMV** (`SAK 0x20`) | Yes (Apple Pay / apps) | No (hardware crypto) | `nfc_inspect_emv` (read-only) |
| **Legacy apartment intercoms ("домофоны") / HID Prox fobs** | **125 kHz LF RFID** (EM4100 / T5577) | **No** | Only T5577 (125 kHz writer) | **Not supported** *(ST25R3916 is 13.56 MHz only)* |

### Detailed Breakdown by Card / Keyfob Family

1. **NTAG213 / NTAG215 / NTAG216 (`SAK = 0x00`, 7-byte UID)**
   - **Best for:** Everyday smartphone automation, Wi-Fi tap cards, digital business cards, product/equipment labels, Home Assistant & iPhone Shortcuts triggers, and **Nintendo Amiibo** (**NTAG215** specifically — `504 bytes` user memory).
   - **Capacities:** `NTAG213` = `144 B` (`36` user pages), `NTAG215` = `504 B` (`126` pages), `NTAG216` = `888 B` (`222` pages).
   - **Limits:** Factory UID (`P00–P02`) is laser-locked and cannot be changed; cannot impersonate a 4-byte MIFARE Classic access badge. Rated for ~100,000 rewrites unless permanent lock bits are set (`nfc-studio` guards lock/OTP pages automatically).

2. **Standard MIFARE Classic 1K / 4K (`SAK = 0x08` / `0x18`, 4-byte UID, e.g. Fudan FM11RF08)**
   - **Best for:** Registering your own physical access cards/keyfobs into locks, intercoms, or **ESP32-S3 + RC522/PN532** projects where you can enroll the card's native UID; experimenting with 16 independent Crypto1 sectors (`752 B` writable user data in 1K), custom `Key A / Key B`, Access Bits, and hardware increment/decrement **Value Blocks**.
   - **Limits:** `Block 0` (manufacturer UID) is read-only — **cannot clone another card's UID**. **Apple iPhones do not support MIFARE Classic**, and many non-NXP Android phones also omit Crypto1 hardware, so avoid MIFARE Classic for smartphone URL/Wi-Fi tags.

3. **Magic Cards & Keyfobs (`Gen1A` vs. `Gen2 / CUID`)**
   - **Best for:** Authorized physical security testing and replicating 4-byte MIFARE Classic test badges onto real silicon.
   - **`Gen1A` (Chinese UID Backdoor):** Unlocks all blocks (`0..63` / `0..255`) in plaintext via `HALT` → 7-bit `0x40` → 8-bit `0x43` without Crypto1. Fast and almost impossible to brick, *but* some strict security readers detect and reject Gen1A cards by sending `0x40` as a honeypot check.
   - **`Gen2 / CUID` (Direct Write):** Behaves identically to a genuine MIFARE Classic card (does **not** answer `0x40`/`0x43`) and allows rewriting `Block 0` through normal Sector 0 Crypto1 authentication (`nfc-studio` supports this natively via Pure-Go Crypto1!). **Caution:** Writing an invalid BCC byte in `Block 0` or invalid Access Bits in a sector trailer can lock a Gen2 card (`nfc-studio` auto-computes BCC and skips sector trailers by default via `6 SAFE`).

4. **ISO 15693 / NFC-V (`ICODE SLIX`, 8-byte UID `E0..`)**
   - **Best for:** Longer read range (up to ~10 cm on larger coils), library books, ski passes, smart medication/supply labels, and industrial inventory tags.

5. **FeliCa (`NFC-F`), DESFire & EMV (`SAK = 0x20`)**
   - **Best for:** High-security transit, corporate access, and payment cards backed by hardware AES/3DES/RSA/ECC cryptography. Cannot be cloned onto blank tags — use `nfc-studio`'s **Emulate (`EMU`)** for FeliCa `IDm` testing and **`nfc_inspect_emv`** for strictly read-only masked-PAN inspection.

6. **125 kHz LF RFID Keyfobs (EM4100 / T5577 / HID Prox)**
   - Visually identical to 13.56 MHz blue/gray plastic keyfobs, but operate at **125 kHz** (100× lower frequency). Neither smartphones nor CardputerZero's 13.56 MHz **ST25R3916** can read or write them — `nfc-studio` will report `No 13.56MHz blank (125kHz unsupported)`.

---

## 9. Interactive Lab: ISO 14443-A & NDEF Inspector

Experiment with real 4-byte and 7-byte UIDs, inspect live Cascade Level 1/2 frames and BCC XOR checksums, encode custom NDEF URLs into Type 2 TLV pages, and generate a ready-to-save Flipper `.nfc` file:

```interactive:nfc-inspector
```
