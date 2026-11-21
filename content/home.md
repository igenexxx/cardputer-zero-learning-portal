# CardputerZero RF & NFC Learning Portal

Welcome to the interactive engineering handbook for **M5Stack CardputerZero** (Raspberry Pi CM0, 320×170 LCD, 46-key matrix keyboard) paired with the **Cap CC1101 & NFC** expansion module.

This portal bridges the gap between **pressing keys on pocket radio hardware** and **understanding the physics, digital signal processing, on-device machine learning, and wire protocols** happening underneath.

---

## How to Use This Portal

Every topic follows a three-step loop designed for hands-on mastery:

1. **Learn the Theory** — Read the concise domain guides covering Sub-GHz ISM propagation, CC1101 transceiver architecture, online EWMA anomaly detection, and 13.56 MHz ISO 14443-A NFC handshakes.
2. **Experiment in Interactive Labs** — Use the embedded browser labs (Smart Squelch & Auto-Lock simulator, OOK Pulse & TE Waveform Decoder, and ISO 14443-A / NDEF Inspector) to manipulate parameters and observe real-time behavior before touching RF hardware.
3. **Test Live on CardputerZero** — Follow the step-by-step device exercises using **RF Heatmap** and **NFC Studio** directly on your CardputerZero with the Cap CC1101 & NFC attached.

> [!TIP]
> Use the **Search** bar in the top header to jump straight to any concept, register, protocol, or keybinding across all guides and the [Domain Glossary](#/glossary).

---

## Applications & Learning Tracks

### 1. RF Heatmap — Sub-GHz Studio (`300–928 MHz`)

A zero-dependency Go spectrum analyzer, thermal waterfall, RSSI oscilloscope, OOK protocol decoder, and Flipper `.sub` studio driven by the **TI CC1101** transceiver and on-device **Smart Squelch** ML.

| Module | What You Will Master | Link |
| --- | --- | --- |
| **App Guide & Controls** | All 4 tabs (`HEATMAP`, `PULSE`, `DECODE`, `SAVED`), full keymap, header badges (`ASQ`, `LOCK`, `CC1101`/`SIM`), and a 15-second remote capture lab | [Open RF Heatmap Guide →](#/rf-guide) |
| **Sub-GHz & CC1101 Theory** | ISM bands (`315 / 433.92 / 868.35 / 915 MHz`), dual SP3T antenna switching, dBm math, waterfall reading, `AM650`/`FM238` presets, OOK PWM encoding, `.sub` format + **Interactive OOK Lab** | [Open Sub-GHz Theory →](#/rf-domain) |
| **ML: Smart Squelch & Auto-Lock** | Online Welford warmup, per-bin EWMA mean/variance (`α = 0.03`), burst-freeze guard (`z ≥ 3.0`), Z-score anomaly detection, Auto-Lock (`z ≥ 4.0`) + **Interactive Smart Squelch Lab** | [Open Smart Squelch ML →](#/rf-ml) |

### 2. NFC Studio — 13.56 MHz HF Lab (`ISO 14443-A`)

A pure-Go NFC reader, NTAG21x/MIFARE inspector, NDEF parser, and Passive Target card emulator built for the **ST25R3916** HF transceiver.

| Module | What You Will Master | Link |
| --- | --- | --- |
| **App Guide & Controls** | All 4 tabs (`SCAN`, `DUMP`, `EMU`, `SAVED`), automatic SPI overlay loading, `--probe` diagnostics, and hands-on card scanning & UID emulation labs | [Open NFC Studio Guide →](#/nfc-guide) |
| **NFC & ISO 14443-A Theory** | 13.56 MHz HF vs 125 kHz LF physics, ST25R3916 FIFO & IRQ architecture, `WUPA → ATQA → Anticollision → SAK` handshake, 4B/7B UIDs, NTAG memory & NDEF TLV + **Interactive NFC Lab** | [Open NFC Theory →](#/nfc-domain) |

### 3. IR Studio — 38 kHz Infrared Lab (`/dev/lirc*`)

A pure-Go 38 kHz Infrared transceiver studio, multi-protocol encoder/decoder (`NEC`, `Samsung32`, `RC5`, `RC6`, `SIRC`, `Kaseikyo`), Flipper `.ir` virtual remote deck, Universal Power-Off `PROBE`, multi-device `MACRO` runner, and zero-allocation on-device IR ML engine.

| Module | What You Will Master | Link |
| --- | --- | --- |
| **App Guide & Controls** | All 6 tabs (`RX`, `REMOTE`, `PROBE`, `SAVED`, `MACRO`, `SET`), Universal Power-Off `PROBE`, `Flipper-IRDB` pack sync, and 21-tool SSH MCP setup | [Open IR Studio Guide →](#/ir-guide) |
| **Infrared, LIRC & Protocol Theory** | 940 nm carrier & duty cycle, pulse-distance vs pulse-width vs Manchester encoding, stateful AC frames & `SUM8`, Linux `/dev/lirc*` ioctls + **Interactive IR Lab** | [Open IR Theory →](#/ir-domain) |
| **ML: Pulse Denoiser, Classifier & Fingerprint** | 1D K-Means pulse denoiser (`ML-CLEAN`), `12→24→3` MLP + Smart Save Guard, 8D IR Fingerprint k-NN (`±4 kHz` gate), Smart Probe Ranking (`R`), and Ambient IR monitor | [Open IR ML →](#/ir-ml) |

### 4. Reference & Vocabulary

| Module | What You Will Master | Link |
| --- | --- | --- |
| **Domain Glossary** | 40+ crisp engineering definitions spanning Sub-GHz RF, on-device ML/DSP, NFC/RFID protocols, and CardputerZero Linux hardware | [Open Domain Glossary →](#/glossary) |

---

## Hardware & Legal Safety

> [!WARNING]
> **Never hot-swap the Cap CC1101 & NFC module.** Always power off the CardputerZero completely before attaching or detaching the expansion cap. Hot-plugging can brown out the 3.3 V / 5 V rails, corrupt the SPI bus, or permanently damage the CC1101, ST25R3916, or CM0 GPIO pins.

> [!IMPORTANT]
> **Transmit responsibly and legally.** Receiving passive RF signals in unlicensed ISM bands is generally permitted for research and learning, but **transmitting (`TX`)** must strictly obey your regional regulations (e.g., FCC Part 15 in the US, ETSI EN 300 220 in the EU — frequency limits, duty cycle, and ERP). Only test transmission, replay, or NFC emulation on **devices, remotes, and tags that you own**.
