# Sub-GHz & CC1101 Theory

To read a thermal waterfall or decode a keyfob reliably, you need a clear mental model of what happens between a remote's PCB trace antenna and the bytes arriving over SPI on your CardputerZero.

---

## 1. Sub-GHz ISM Bands

**ISM (Industrial, Scientific, and Medical)** bands are slices of radio spectrum set aside for unlicensed, low-power short-range devices. Because Sub-GHz wavelengths (`~33 cm` at `915 MHz` up to `~95 cm` at `315 MHz`) diffract easily around walls and foliage, they deliver much longer range per milliwatt than `2.4 GHz` Wi-Fi or Bluetooth.

| Band Preset in RF Heatmap | Sweep Range | Primary Center Freq | Region & Common Devices |
| --- | --- | --- | --- |
| `315 US` | `314.50 – 315.50 MHz` | `315.00 MHz` | North America & Japan: garage doors, car TPMS, older car keyfobs |
| `433 ISM` | `433.05 – 434.79 MHz` | `433.92 MHz` | Europe & worldwide: wireless outlets, weather stations, gate remotes, doorbells, car fobs |
| `868 EU` | `868.00 – 869.80 MHz` | `868.35 MHz` | Europe (ETSI): smart home sensors, alarm panels, LoRa EU868, modern gates |
| `915 ISM` | `902.00 – 928.00 MHz` | `915.00 MHz` | Americas & Australia: LoRa US915, utility smart meters, FHSS telemetry |
| `ALL ISM` | `300.00 – 925.00 MHz` | 24 curated channels | Multi-band reconnaissance across all common Sub-GHz center frequencies |

---

## 2. TI CC1101 Transceiver & Cap Dual SP3T Antenna Switch

The **Texas Instruments CC1101** on the Cap CC1101 & NFC is a narrowband Sub-GHz transceiver clocked by a **26 MHz reference crystal** (`f_xosc = 26,000,000 Hz`) and controlled over Linux SPI (`/dev/spidev0.1`).

### Frequency Synthesis
To tune the CC1101 to a carrier frequency `f_carrier`, the driver computes a 24-bit register word split across `FREQ2`, `FREQ1`, and `FREQ0`:

```text
FREQ = round(f_carrier × 65536 / 26,000,000)
```

Each LSB equals `26,000,000 / 65,536 ≈ 396.7 Hz`, allowing sub-kilohertz tuning accuracy across `300–928 MHz`.

### Dual SP3T Antenna Switching Network
A single RF matching filter cannot stay efficient across a 3× frequency span (`300 MHz` to `928 MHz`). The Cap CC1101 solves this with **three separate RF filter paths** selected by a dual SP3T RF switch driven by **CardputerZero `GPIO 14` (`RF_SW0`)** and the **CC1101's `GDO2` pin (`IOCFG2` register)**:

| Frequency Band | `GPIO 14` (`RF_SW0`) | CC1101 `GDO2` (`IOCFG2`) | Active Filter Path |
| --- | --- | --- | --- |
| `< 374.0 MHz` (Low) | `LOW` (`0`) | `0x6F` (Constant HIGH) | **315 MHz** low-band path |
| `374.0 – 650.5 MHz` (Mid) | `HIGH` (`1`) | `0x2F` (Constant LOW) | **433 MHz** mid-band path |
| `≥ 650.5 MHz` (High) | `HIGH` (`1`) | `0x6F` (Constant HIGH) | **868 / 915 MHz** high-band path |

> [!NOTE]
> `rf-heatmap` automatically switches both `GPIO 14` and `IOCFG2` every time it tunes across the `374 MHz` or `650.5 MHz` boundaries — even inside a single `ALL ISM` sweep — and safely restores `GPIO 14` and puts the CC1101 into `IDLE` on exit (`Q` / `Esc`).

---

## 3. RSSI & the Logarithmic dBm Scale

**RSSI (Received Signal Strength Indicator)** measures incoming RF power in **dBm** (decibels relative to 1 milliwatt). Because RF power spans many orders of magnitude, dBm is **logarithmic**:

- Every **+3 dBm** doubles the RF power.
- Every **+10 dBm** increases RF power by **10×** (so `-50 dBm` is **100,000×** stronger than `-100 dBm`).
- Because signals below `1 mW` are negative in dBm, **closer to 0 means stronger** (`-45 dBm` is loud; `-105 dBm` is quiet background noise).

The CC1101 reports a raw 8-bit two's-complement byte in status register `0x34` (`RSSI`), which `rf-heatmap` converts to dBm using the datasheet offset (`74 dB`):

```text
signed = raw >= 128 ? raw - 256 : raw
RSSI_dBm = (signed / 2) - 74
```

| Typical RSSI | Physical Interpretation |
| --- | --- |
| `-108` to `-95 dBm` | Quiet ambient noise floor (no active transmitter nearby) |
| `-90` to `-75 dBm` | Distant sensor, weak indoor telemetry, or adjacent-channel leakage |
| `-70` to `-50 dBm` | Clear nearby keyfob, remote, or continuous local interferer |
| `-45` to `-25 dBm` | Transmitter right next to the CardputerZero antenna |

---

## 4. Reading the Thermal Waterfall

The **Thermal Waterfall** plots **Frequency (horizontal)** vs. **Time (vertical, newest at top)** with **Power (color: Navy `-110 dBm` → Purple → Orange → Yellow `-35 dBm`)**. Once you recognize the three classic visual signatures, you can classify signals at a glance:

| Visual Pattern | What It Looks Like | Likely Source |
| --- | --- | --- |
| **Short horizontal burst** | Bright yellow/orange dash in 1–2 bins lasting 1–4 rows, then vanishing | **Keyfob / Remote control / Doorbell** (OOK or 2-FSK burst) |
| **Solid vertical stripe** | Persistent purple/orange column running top-to-bottom in the same bin | **Continuous interferer** (switching power supply, baby monitor, weather station carrier, nearby electronics) |
| **Diagonal / scattered hops** | Brief bright dots jumping pseudo-randomly across many bins in `915 ISM` | **FHSS (Frequency-Hopping Spread Spectrum)** — smart meters, industrial telemetry, RC links |

---

## 5. Modulation Presets (`AM650`, `AM270`, `FM238`, `FM476`)

RF Heatmap provides four Flipper-compatible asynchronous CC1101 modem presets (cycle with `M`):

| Preset | Flipper `.sub` Name | Modulation | RX Bandwidth / Deviation | Best Used For |
| --- | --- | --- | --- | --- |
| `AM650` | `FuriHalSubGhzPresetOok650Async` | **OOK / ASK** | `650 kHz` wide RX filter | Default catch-all for cheap remotes with drifting ceramic resonators |
| `AM270` | `FuriHalSubGhzPresetOok270Async` | **OOK / ASK** | `270 kHz` narrow RX filter | Cleaner decoding and higher SNR when a crystal-stabilized remote is in a noisy band |
| `FM238` | `FuriHalSubGhzPreset2FSKDev238Async` | **2-FSK** | `2.38 kHz` frequency deviation | Narrowband weather stations, TPMS, and low-rate FSK sensors |
| `FM476` | `FuriHalSubGhzPreset2FSKDev476Async` | **2-FSK** | `47.6 kHz` frequency deviation | Modern automotive fobs, alarm sensors, and higher-rate FSK telemetry |

- **OOK (On-Off Keying)** is the simplest form of ASK: the transmitter turns the RF carrier **ON** (high pulse, `+µs`) and **OFF** (low gap, `-µs`) like high-speed Morse code.
- **2-FSK (2-Level Frequency Shift Keying)** keeps the carrier continuously ON and shifts its frequency slightly up (`f + Δf` = `1`) or down (`f - Δf` = `0`), making it far more resistant to amplitude noise.

---

## 6. OOK PWM Encoding, TE, Sync Gaps & Fixed vs. Rolling Codes

Most budget 315/433 MHz remotes encode binary data using **Pulse-Width Modulation (PWM)** built around a single base time unit called **`TE` (Time Element)**, typically `250–450 µs`.

Each frame is preceded by a long **Sync Gap** (carrier OFF for `~30× TE` to `36× TE`, e.g., `-10,500 µs`) so the receiver knows where bit 0 begins.

| Protocol | Bits | Bit `0` (High : Low) | Bit `1` (High : Low) | Sync Gap | Typical `TE` |
| --- | --- | --- | --- | --- | --- |
| **Princeton (PT2262)** | `24-bit` | `1× TE` High, `3× TE` Low (`1:3`) | `3× TE` High, `1× TE` Low (`3:1`) | `> 4,000 µs` (`~31× TE`) | `350 µs` |
| **CAME** | `12-bit` / `24-bit` | `1× TE` High, `2× TE` Low (`1:2`) | `2× TE` High, `1× TE` Low (`2:1`) | `> 5,000 µs` (`~36× TE`) | `320 µs` |
| **Linear** | `10-bit` | `1× TE` High, `3× TE` Low (`1:3`) | `3× TE` High, `1× TE` Low (`3:1`) | `> 8,000 µs` (`~36× TE`) | `500 µs` |

### Fixed Codes vs. Rolling Codes
- **Fixed Code** (`Princeton`, `CAME`, `Linear`): Sends the **exact same bit sequence** every time you press the button. Simple and cheap, which is why RF Heatmap can decode and display the static hex key immediately.
- **Rolling Code** (`KeeLoq`, `Somfy Telis`, modern car fobs): Encrypts a **monotonically increasing counter** with a secret manufacturer key on every button press. Every transmission produces a completely different ciphertext; the receiver rejects any previously seen counter value to prevent simple replay attacks.

---

## Interactive Lab: OOK Pulse & TE Waveform Decoder

Experiment with protocol framing, base pulse width `TE (µs)`, and realistic clock jitter below. Watch how each bit maps to signed microsecond `RAW_Data` durations (`+` carrier ON, `-` carrier OFF) and observe when excessive jitter breaks decoding.

```interactive:ook-decoder
```

---

## 7. Flipper Zero `.sub` File Format

RF Heatmap reads and writes standard **Flipper Zero `.sub`** plain-text files so captures are 100% interoperable between CardputerZero and Flipper Zero.

### Decoded Key File (`Flipper SubGhz Key File`)
Saved from **DECODE** when a fixed-code protocol is recognized:

```text
Filetype: Flipper SubGhz Key File
Version: 1
Frequency: 433920000
Preset: FuriHalSubGhzPresetOok650Async
Protocol: Princeton
Bit: 24
Key: 00 00 00 00 00 A5 5A 1C
TE: 350
```

### RAW Pulse File (`Flipper SubGhz RAW File`)
Saved from **PULSE** when recording arbitrary timings (positive = carrier ON in `µs`, negative = carrier OFF in `µs`, chunked at 512 samples per `RAW_Data:` line):

```text
Filetype: Flipper SubGhz RAW File
Version: 1
Frequency: 433920000
Preset: FuriHalSubGhzPresetOok650Async
Protocol: RAW
RAW_Data: -10500 350 -1050 1050 -350 350 -1050 1050 -350 -10500
```
