# Domain Glossary

A practical, categorized reference of **50+ terms** covering Sub-GHz RF, on-device ML & DSP, 13.56 MHz NFC / ISO 14443-A, and CardputerZero hardware. Use the top search bar to jump to any term instantly.

---

## Sub-GHz & RF

### `.sub` File
A plain-text Flipper Zero compatible Sub-GHz capture file (`Filetype: Flipper SubGhz RAW File` or `Key File`). Stores carrier frequency in Hz, modulation preset (e.g. `FuriHalSubGhzPresetOok650Async`), and either a decoded protocol key or signed microsecond pulse timings (`RAW_Data: +350 -1050 ...`), where positive numbers are RF-ON durations and negative numbers are RF-OFF gaps.

### 2-FSK (Binary Frequency-Shift Keying)
A digital modulation scheme that represents binary `0` and `1` by shifting the carrier frequency slightly below or above the center frequency ($f_c \pm \Delta f$). More noise-immune than OOK/ASK and common in weather stations, TPMS sensors, and modern telemetry.

### Auto-Probe (`PROBE` Mode)
A timed, interruptible Sub-GHz playlist transmitter in `rf-heatmap` that steps through a read-only **Database Pack**, a database-free **Virtual Generator Pack** (`GEN:CAME-12`, `GEN:Linear-10`, `GEN:CAME-868`), or the **User Library** at a configurable interval (`0.05s–5.0s`). Supports instant mid-burst cancellation (`STOP`), 12-slot visual `>` / `*` sent-history markers for reaction-time backtracking, single-candidate `TRY`, and one-key promotion of the winning signal into `~/rf-heatmap/captures/`.

### Virtual Generator Pack (`GEN:*`)
An O(1)-memory catalog in `rf-heatmap`'s `PROBE` mode (`GeneratorCatalog`) that synthesizes short fixed-code Sub-GHz keys on the fly (`Linear 10-bit` = 1,024 keys; `CAME 12-bit` = 4,096 keys) without requiring `.sub` files on disk, supporting live `B`/`M` carrier frequency and modulation overrides and one-key saving to the User Library.

### Database Pack vs. User Library
`rf-heatmap`'s strict storage separation between read-write user captures (`~/rf-heatmap/captures/`, managed in `SAVED`) and read-only external `.sub` collections (`~/rf-heatmap/databases/<pack>/` and `~/subg/files/`, probed in `PROBE`). External packs are lazy-parsed and protected from `DEL` and `PURGE`.

### Incremental Delta Sync (`dbsync` & `.sync-state.json`)
`rf-heatmap`'s pure-Go synchronization engine for remote `.sub` database sources (GitHub repositories via Git Trees API or HTTPS JSON manifests configured in `~/.config/rf-heatmap/sources.json`). Uses HTTP `ETag` (`304 Not Modified`) and per-file Git `SHA` / `SHA-256` hashes stored in `.sync-state.json` inside `~/rf-heatmap/databases/<id>/` so re-syncing downloads only new or modified `.sub` files.

### OOK Keying (`GDO0` / `GPIO 15`)
Asynchronous serial transmission on the TI CC1101 (`IOCFG0 = 0x0D`, `PKTCTRL0 = 0x32`), where CardputerZero drives `GPIO 15` (`GDO0`) high (`+µs`) to emit the RF carrier and low (`-µs`) to silence it via Linux `/dev/gpiochip0` v2 ioctl, restoring `IDLE` and High-Z (`0x2E`) on completion or cancellation.

### Promote to User
Copying a confirmed working `.sub` signal from a read-only external **Database Pack** into the read-write **User Library** (`~/rf-heatmap/captures/`) with path-sandbox validation and collision-safe naming (`name_2.sub`).

### CC1101
Texas Instruments' ultra-low-power Sub-GHz RF transceiver IC on the CardputerZero Cap. Covers 300–348 MHz, 387–464 MHz, and 779–928 MHz; supports OOK, ASK, 2-FSK, GFSK, and MSK; provides hardware RSSI readout and SPI control on `/dev/spidev0.1`.

### dBm (Decibel-Milliwatts)
A logarithmic unit of absolute RF power referenced to 1 milliwatt ($0\text{ dBm} = 1\text{ mW}$). Every 10 dB decrease divides power by 10. Typical Sub-GHz noise floors sit around **−105 to −95 dBm**, while a nearby keyfob burst spikes to **−55 to −30 dBm**.

### FHSS (Frequency-Hopping Spread Spectrum)
A transmission technique that rapidly switches the carrier across many narrow channels in a pseudo-random sequence to resist interference and jamming. Appears on a waterfall display as scattered short blips jumping across frequency bins.

### Fixed Code vs. Rolling Code (KeeLoq)
- **Fixed Code** (e.g., Princeton PT2262, CAME 12-bit, Linear 10-bit) transmits the exact same static bit sequence on every button press—easy to decode and vulnerable to simple replay.
- **Rolling Code** (e.g., Microchip **KeeLoq** 66-bit) encrypts a monotonically incrementing counter with a shared secret key so every press produces a different ciphertext, defeating naive replay attacks.

### ISM Band (Industrial, Scientific & Medical)
License-free radio frequency allocations used by consumer remotes, sensors, and IoT devices. Common Sub-GHz ISM bands are **315 MHz** (North America/Japan), **433.92 MHz** (Europe/Global), **868 MHz** (Europe), and **915 MHz** (Americas/Australia).

### OOK / ASK (On-Off Keying / Amplitude-Shift Keying)
Amplitude modulation where digital data is conveyed by changing carrier strength. **OOK** is the simplest binary case of ASK: carrier ON = `1` (high pulse), carrier OFF = `0` (low gap). Used by the vast majority of garage openers, doorbell chimes, and wireless outlets.

### Peak-Hold
A spectrum analyzer trace mode that latches the maximum RSSI value observed in each frequency bin over time (or with slow decay), allowing brief millisecond keyfob bursts to remain visible on screen after the button is released.

### RSSI (Received Signal Strength Indicator)
A real-time measurement of incoming RF power at the receiver's tuned channel, converted from the CC1101's signed 8-bit `RSSI` status register into dBm ($\text{dBm} = \text{raw}/2 - 74$).

### SP3T Antenna Switch
A Single-Pole Triple-Throw RF switch on the Cap CC1101 & NFC controlled by two GPIO pins (`SW0`, `SW1`) that routes the CC1101's RF port to the optimal matching network for the selected frequency band (315 MHz, 433 MHz, or 868/915 MHz).

### Squelch
An RSSI threshold (in dBm) below which incoming signals are ignored as background noise. Only energy above the squelch line triggers pulse capture or signal alerts.

### Sub-GHz
Radio frequencies below 1 GHz (typically 300–928 MHz in ISM applications). Lower frequencies penetrate walls better and consume far less power than 2.4 GHz Wi-Fi/BLE, making them ideal for remotes, sensors, and smart meters.

### Sync Gap (Preamble / Inter-Frame Pause)
A deliberately long RF-OFF pause (typically $10\times$ to $35\times$ the base Time Element `TE`, e.g. 5–15 ms) that separates repeated transmissions of a keyfob frame so the receiver knows where a new packet starts.

### TE (Time Element)
The fundamental unit pulse width (in microseconds, e.g. `320 µs` or `350 µs`) of an OOK protocol. Short pulses are typically $1\times\text{TE}$ and long pulses are $3\times\text{TE}$ (a 1:3 ratio in Princeton/CAME), allowing decoders to normalize timing jitter.

### Thermal Waterfall
A scrolling 2D spectrogram plotting **frequency** on the X-axis, **time** on the Y-axis (newest at the top), and **RSSI intensity** as a heat colormap (dark navy → cyan → yellow → crimson). Reveals intermittent bursts, drift, and duty cycles at a glance.

---

## On-Device ML & DSP

### 1D K-Means
A lightweight one-dimensional clustering algorithm used in OOK pulse decoding to automatically partition raw microsecond pulse durations into "short" ($1\times\text{TE}$) and "long" ($3\times\text{TE}$) symbol clusters without hardcoding exact timing tables.

### Auto-Lock
An intelligent frequency-tracking feature in `rf-heatmap` that monitors per-bin Z-scores and automatically snaps the tuning cursor onto the strongest genuine RF burst when $z \ge 4.0$, with a manual-override cooldown so it never fights user input.

### Burst-Freeze Guard
A safeguard in the EWMA noise-floor estimator: whenever a bin's current reading exceeds $z \ge 3.0$ (an active transmission), that bin's baseline mean and variance are **frozen** for that frame so a strong signal cannot poison or pull up its own noise floor.

### EWMA (Exponentially Weighted Moving Average)
An $O(1)$ streaming filter that tracks each frequency bin's rolling mean ($\mu_i$) and variance ($\sigma_i^2$) with smoothing factor $\alpha$ (e.g. $\alpha = 0.03$):
$$\mu_t = (1-\alpha)\mu_{t-1} + \alpha x_t$$
Requires almost zero memory (< 1 KB for 36 bins) and adapts smoothly to slow ambient RF drift.

### Feature Extraction
The process of distilling raw RF samples or pulse streams into compact numerical descriptors—such as pulse-width ratios, base `TE`, sync-gap duration, bit count, and peak RSSI—used by protocol decoders and classifiers.

### Kalman Filter
A recursive state estimator that fuses noisy measurements with a prediction model to produce a smooth, low-latency estimate of a continuously varying quantity (such as tracking RSSI trends or carrier drift).

### Noise Floor
The baseline ambient RF power present in a channel when no intentional signal is transmitting—composed of thermal noise plus local electronic interference (switching power supplies, USB harmonics, Wi-Fi bleed).

### Smart Squelch
An adaptive, per-bin threshold computed by `rf-heatmap`'s ML engine: $\text{Threshold}_i = \mu_i + k\sigma_i$. Unlike a flat global squelch line, Smart Squelch automatically rises over noisy urban interferers while staying hyper-sensitive on quiet bins.

### Welford Warmup
An exact, numerically stable online mean/variance algorithm run during the first $N$ sweep frames (e.g. `5` samples) to initialize each bin's $\mu_i$ and $\sigma_i$ accurately before handing off to steady-state EWMA tracking.

### Z-Score
A dimensionless measure of how many standard deviations an observed RSSI reading $x_i$ stands above its bin's learned baseline:
$$z_i = \frac{x_i - \mu_i}{\max(\sigma_i, \sigma_{\min})}$$
A Z-score of `0` is normal background noise; $z \ge 3.0$ flags a likely burst; $z \ge 4.0$ triggers Auto-Lock.

---

## NFC & RFID

### External Reader Field Detection
Measuring the 13.56 MHz RF carrier amplitude emitted by an external NFC reader (such as a phone or access-control terminal) using the ST25R3916 `MeasureAmplitude (0xD3)` ADC command while the local TX driver is off in Passive Target (card emulation) mode. Powers `nfc-studio`'s live `EMU` radar RF strength bar (`0–100%`) and `nfc_get_status` MCP telemetry.

### `.nfc` File
A plain-text Flipper Zero compatible NFC dump format (`Filetype: Flipper NFC device`, `Version: 4`) storing `Device type`, `UID`, `ATQA`, `SAK`, `Pages total`, and hex `Page N:` / `Block N:` rows. Fully interoperable between `nfc-studio` and Flipper Zero.

### 13.56 MHz HF vs. 125 kHz LF
Two physically distinct RFID bands. **13.56 MHz HF** (NFC, ISO 14443-A, NTAG, MIFARE) uses resonant HF coils and supports anticollision and smartphones. **125 kHz LF** (EM4100, HID Prox, apartment intercom fobs) uses low-frequency coils and will **not** respond to a 13.56 MHz ST25R3916 transceiver.

### Anticollision
The ISO 14443-A binary-tree procedure (`[SEL, 0x20]`) that allows a reader to isolate and retrieve the unique UID of a single tag even when multiple cards are present in the 13.56 MHz field simultaneously.

### ATQA (Answer To Request A)
A 2-byte response sent by an ISO 14443-A tag immediately after `REQA (0x26)` or `WUPA (0x52)`. Encodes UID size and anticollision capabilities (e.g. `44 00` for 7-byte NTAG21x, `04 00` for 4-byte MIFARE Classic 1K).

### BCC (Block Check Character)
A 1-byte XOR checksum appended to every 4-byte anticollision cascade chunk: $\text{BCC} = b_0 \oplus b_1 \oplus b_2 \oplus b_3$. Both the reader and the tag verify BCC to catch RF bit errors during UID discovery.

### Capability Container (CC)
Page 3 (4 bytes) of an NFC Forum Type 2 tag (NTAG21x / Ultralight). Byte 0 is the NDEF magic `0xE1`, byte 1 is the mapping version (`0x10` = v1.0), byte 2 is usable NDEF memory size divided by 8 bytes (e.g. `0x3E` = 496 bytes for NTAG215), and byte 3 sets read/write access (`0x00` = open).

### Cascade Tag (`0x88`)
A special sentinel byte placed in position 0 of a Cascade Level 1 (or 2) anticollision response to inform the reader that the tag's UID is longer than 4 bytes (7-byte or 10-byte UID) and another Cascade Level (`0x95` / `0x97`) is required.

### ISO 14443-A
The international standard governing 13.56 MHz proximity smart cards and NFC Type 2 / Type 4 tags. Defines physical 106 kbps Modified Miller / Manchester modulation, short frames (`WUPA`/`REQA`), anticollision, `SELECT`, and `CRC_A`.

### MIFARE Classic / CRYPTO1
A widely deployed 13.56 MHz card family (`ATQA 04 00`, `SAK 08` for 1K; `ATQA 02 00`, `SAK 18` for 4K) organized into 16-byte blocks grouped in sectors protected by Key A / Key B and the proprietary **CRYPTO1** stream cipher.

### NDEF & TLV (`0x03`)
**NFC Data Exchange Format**—the standard container for cross-platform URLs (`'U'`), plain text (`'T'`), and MIME payloads on NFC tags. On Type 2 tags, NDEF messages are wrapped inside a **TLV (Type-Length-Value)** block starting with type byte `0x03` at Page 4+ and ending with terminator `0xFE`.

### NTAG21x / Type 2 Tag
NXP's popular NFC Forum Type 2 tag family (**NTAG213** 144B, **NTAG215** 504B, **NTAG216** 888B) with 7-byte UIDs (`04 ...`), `ATQA 44 00`, `SAK 00`, and open 4-byte page memory readable via command `0x30`.

### Passive Target Emulation (`0xA0`)
An ST25R3916 hardware mode where the transceiver disables its own RF carrier, loads a 15-byte **PT_A** memory image (`ATQA + UID + SAK`) via SPI opcode `0xA0`, and responds autonomously via load modulation to an external reader's `REQA`/`WUPA`, anticollision, and `SELECT` commands.

### SAK (Select Acknowledge)
A 1-byte response returned by a tag after a `SELECT` command. Bit 2 (`0x04`) indicates whether the UID is incomplete (cascade needed); once clear, SAK identifies the card type (`0x00` = NTAG/Ultralight, `0x08` = MIFARE Classic 1K, `0x18` = MIFARE Classic 4K, `0x20` = ISO 14443-4 / DESFire).

### SELECT
The ISO 14443-A command (`[SEL, 0x70, b0..b3, BCC]` + CRC_A) sent after anticollision to confirm a specific tag's cascade chunk and retrieve its `SAK` byte.

### ST25R3916
STMicroelectronics' 13.56 MHz NFC universal transceiver IC on the CardputerZero Cap. Communicates over **SPI Mode 1** (`/dev/spidev0.2`), features a 512-byte FIFO, automatic CRC/parity framing, supply ADC measurement, and hardware Passive Target card emulation.

### UID (4-Byte / 7-Byte Unique Identifier)
The hardware serial number transmitted by an ISO 14443-A tag during anticollision. Single-size UIDs are **4 bytes** (e.g. MIFARE Classic); double-size UIDs are **7 bytes** (e.g. NTAG21x, where byte 0 is the manufacturer ID such as `0x04` for NXP).

### WUPA / REQA
7-bit ISO 14443-A short polling commands sent by a reader to detect nearby tags. **`REQA` (`0x26`)** wakes only cards in the `IDLE` state; **`WUPA` (`0x52`)** wakes both `IDLE` and `HALT` cards, making discovery more reliable.

### Magic Card (`Gen1A` & `Gen2 / CUID`)
Special MIFARE Classic–compatible test cards whose **Block 0 (Manufacturer Block / 4-byte UID + BCC + SAK + ATQA)** is writable. **Gen1A** cards respond to an unencrypted backdoor (`HALT` → 7-bit `0x40` → 8-bit `0x43`) unlocking all blocks in plaintext without Crypto1; **Gen2 / CUID** cards look identical to standard MIFARE Classic cards to readers and allow writing Block 0 after normal Sector 0 Crypto1 authentication.

### Crypto1 (48-Bit LFSR & 9-Bit Encrypted Parity)
The proprietary stream cipher used by MIFARE Classic 1K/4K cards. Because the ST25R3916 lacks a hardware Crypto1 engine, `nfc-studio` implements known-key Crypto1 authentication in pure Go (`internal/st25r3916/crypto1.go`) using ST25R3916's raw-parity mode (`no_tx_par` / `no_rx_par`) to pack 9-bit `(data + encrypted odd parity)` streams.

### Sector Trailer & Access Bits
The final block of every MIFARE Classic sector (`blk 3, 7, 11, ...` in 1K; `blk 143, 159, ...` in upper 4K) storing **Key A (6B)**, **Access Bits (4B)**, and **Key B (6B)**. Writing invalid Access Bits permanently locks a sector; `nfc-studio` skips sector trailers by default (`6 SAFE` / `include_trailers: false`).

### `WritePlan` / `WriteStrategy`
Pure-domain Single Source of Truth (`internal/nfcfile/write_plan.go`) that inspects any Flipper `.nfc` dump and plans safe writable pages or blocks (`ntag_pages`, `magic_gen1a`, `magic_gen2`, `mifare_sectors`, `nfcv_blocks`, or `unsupported`) identically for both the CardputerZero UI and MCP server.

### `ProbeBlankTarget` / `ReconcileWritePlan`
Non-destructive ST25R3916 blank-card identifier (`internal/st25r3916/blank_probe.go`) paired with a pure-domain cross-card compatibility engine (`internal/nfcfile/write_compat.go`). Detects NTAG213/215/216, Gen1A (`0x40`/`0x43`), MIFARE Classic 1K/4K, ISO 15693 NFC-V, and read-only cards before any write occurs, automatically adapting trailing-zero NTAG dumps and falling back cleanly when Block 0 is locked.

---

## CardputerZero Hardware

### `/dev/fb0`
The Linux kernel's raw framebuffer device for CardputerZero's **320×170 RGB565 LCD**. Both `rf-heatmap` and `nfc-studio` render directly to `/dev/fb0` in pure Go for crisp, zero-dependency, low-latency graphics.

### `/dev/spidev0.1`
Linux SPI user-space device node connected to **SPI0 Chip Select 1**, wired to the **CC1101** Sub-GHz transceiver on the Cap CC1101 & NFC.

### `/dev/spidev0.2`
Linux SPI user-space device node connected to **SPI0 Chip Select 2 (GPIO22)**, wired to the **ST25R3916** 13.56 MHz NFC transceiver on the Cap CC1101 & NFC. Created dynamically by `spi0-spidev2-gpio22-overlay`.

### `APPLaunch`
CardputerZero's built-in graphical application launcher. Discovers installed `.desktop` entries in `/usr/share/APPLaunch/applications/`, binaries in `/usr/share/APPLaunch/bin/`, and icons in `/usr/share/APPLaunch/share/images/`.

### Cap CC1101 & NFC
M5Stack's snap-on RF expansion module for CardputerZero housing both a **TI CC1101** Sub-GHz transceiver (with SP3T antenna switch) and an **ST ST25R3916** 13.56 MHz NFC transceiver + PCB coil. Never hot-swap while powered.

### CM0 / BCM2837
The **Raspberry Pi Compute Module 0** (quad-core ARM Cortex-A53 `arm64`, BCM2837 SoC) at the heart of CardputerZero, running Debian Linux with native Go `GOARCH=arm64` binaries.

### `evdev`
The Linux kernel's generic input event interface (`/dev/input/event*` and `/dev/input/by-path/*i2c*-event`), used by CardputerZero apps to read key presses and key repeats directly from the 46-key I2C matrix keyboard without needing X11 or Wayland.

### `ext_5v_out` / GPIO26
The switched 5 V power rail supplying the Cap CC1101 & NFC expansion header. Enabled via `pinctrl set 26 op dh` and `/sys/class/leds/ext_5v_out/brightness` before opening SPI devices.

### `spi0-spidev2-gpio22-overlay`
The CardputerZero Linux Device Tree overlay that maps **GPIO22** as SPI0 Chip Select 2 and instantiates `/dev/spidev0.2` for the ST25R3916 NFC transceiver. Loaded automatically by `nfc-studio` on startup.

---

## Agent Automation & MCP

### MCP (Model Context Protocol)
An open JSON-RPC 2.0 protocol that lets AI agents discover (`tools/list`) and invoke (`tools/call`) typed hardware and software capabilities. Both `rf-heatmap` and `nfc-studio` ship zero-dependency pure-Go MCP servers accessible via `--mcp`.

### JSON-RPC 2.0
A lightweight stateless remote procedure call protocol encoded in JSON, used as the wire format for MCP requests, responses, and structured error codes (`-32700` parse error, `-32601` method not found, `-32602` invalid params).

### stdio Transport
Running an MCP server over standard input (`stdin`) and standard output (`stdout`) with newline-delimited JSON messages. On CardputerZero this enables zero-port remote automation directly over SSH (`ssh <device> <app> --mcp`).

### Opt-In Security (`mcp_enabled`)
A default-deny security model where each application's MCP server is disabled (`mcp_enabled: false`) until the user explicitly enables it in the in-app **`SET`** (Settings) tab, persisted in `$HOME/.config/<app>/config.json`.

### Pulse Quantization
Snapping noisy, jitter-skewed RF pulse durations (`±µs`) to their nearest discovered K-Means timing centroids (`±ShortUs` or `±LongUs`) while preserving polarity and sync gaps, enabling reliable second-pass OOK protocol decoding.

### Glitch Merging
Absorbing sub-threshold EMI spikes (`|p| < 60 µs`) into adjacent pulses and coalescing consecutive same-sign intervals so a short dropout inside a carrier pulse restores the original pulse width instead of corrupting bit alignment.

### Jitter Ratio
The mean normalized absolute deviation between raw data-pulse widths and their assigned K-Means centroids (`|d - centroid| / centroid`). Values `< 0.15` indicate a crisp remote signal; `> 0.32` indicates heavy noise or unstructured interference.

### MLP (Multi-Layer Perceptron)
A feed-forward neural network made of dense matrix layers with non-linear activations (`ReLU`). `rf-heatmap` embeds a tiny `12 → 24 → 5` pure-Go MLP (437 `float32` weights, `255 ns/op`, `0 allocs`) to classify unknown Sub-GHz captures on CardputerZero.

### Softmax
An output-layer normalization function $\text{softmax}(z_k) = \frac{e^{z_k - \max z}}{\sum_j e^{z_j - \max z}}$ that converts raw neural-network logits into calibrated probabilities summing to `1.0` across all signal classes.

### Duty Cycle
The fraction of total capture time during which the RF carrier is active (`sum(+high) / sum(|all|)`). Weather sensors typically have low duty cycles (`12–36%`), OOK remotes sit near `35–55%`, and continuous jammers exceed `75%`.

### Feature Vector
A fixed-length numeric summary (`[12]float32` in `internal/rfml/features.go`) condensing a variable-length RAW pulse capture into normalized physical metrics (`TE`, pulse ratio, jitter, duty cycle, pulses/frame, SNR, glitch rate) for fast ML inference.

### RF Fingerprinting
Identifying a physical radio transmitter from its structural and timing characteristics (carrier frequency, `TE`, pulse ratio, sync gap, frame length, duty cycle) rather than its decoded payload — allowing recognition of known rolling-code remotes even when their encrypted payload changes every press.

### Embedding
A compact, L2-normalized fixed-length numeric vector (`[8]float32` in `internal/rfml/fingerprint.go`) representing a transmitter's RF signature in geometric space so similar transmitters lie close together.

### Cosine Similarity
The dot product of two L2-normalized embeddings ($\cos\theta \in [0, 1]$), measuring directional similarity independent of vector magnitude. `rf-heatmap` uses cosine similarity with a `±2.5 MHz` frequency gate to match live captures against saved `.sub` files.

### k-NN (k-Nearest Neighbors)
A non-parametric ML lookup algorithm that ranks stored reference embeddings by distance/similarity to a query vector and returns the top-`k` closest matches (`FingerprintIndex.TopK`).

### Kalman Gain
The adaptive weighting factor $K = P_{\text{pred}} / (P_{\text{pred}} + R)$ inside a Kalman filter that balances trust between the previous smoothed state and each noisy new RSSI measurement.

### Foxhunt
Radio direction-finding / transmitter localization by observing signal strength trends (`CLOSER` vs `FARTHER`) while moving a receiver toward the RF source.

### Inter-Arrival Time (IAT)
The elapsed time between consecutive rising-edge RF bursts on a channel. Regular periodic beacons exhibit near-constant IAT (`CV <= 0.15`), while manual remote presses have irregular IAT.

### Coefficient of Variation (CV)
The dimensionless ratio of standard deviation to mean ($\sigma / \mu$). `PeriodicityTracker` uses `CV <= 0.15` over burst IATs to distinguish automated periodic beacons from human button presses.

---

## Infrared & LIRC

### 1D K-Means IR Denoiser
`ir-studio`'s zero-allocation pulse-cleaning pipeline (`internal/irml/cluster.go`) that absorbs sub-`120 µs` ambient/AGC EMI glitches into preceding pulses (preserving mark/space alternation and frame period), keeps AGC preambles (`>= 2200 µs`) intact, and quantizes jittery data symbols to `ShortUs`/`LongUs` 1D K-Means centroids to rescue protocol decoding (`ML-CLEAN`).

### AC State-Frame
A long, stateful HVAC infrared packet (`64–200+` bits, often split across 2–3 subframes with `> 8000 µs` gaps) transmitted on every air-conditioner keypress. Encodes full appliance state (power, temperature, mode, fan, swing) and usually ends with a `SUM8` modular checksum.

### Ambient IR Interference
Unwanted optical infrared energy from sunlight (DC photodiode saturation) or PWM-dimmed LED lamps and fluorescent ballasts (`100 Hz` / `120 Hz` flicker) that injects spurious edges into `/dev/lirc*`. Tracked continuously by `AmbientMonitor` (`CLEAN` / `MODERATE` / `SATURATED`).

### Carrier Frequency
The high-frequency modulation rate (`36–56 kHz`, nominal `38 kHz`) at which a 940 nm IR LED is pulsed during every mark so integrated receivers (TSOP/VS1838) can reject steady ambient light via an internal bandpass filter.

### Duty Cycle (IR)
The percentage of each IR carrier cycle during which the emitter LED is powered ON (`33%` default vs `50%` square wave). `33%` reduces LED heating and allows higher peak current while maintaining strong fundamental carrier amplitude.

### Flipper `.ir` Format
A plain-text multi-button Infrared remote file (`Filetype: IR signals file`, `Version: 1`) containing `#`-delimited `type: parsed` commands (`protocol`, `address`, `command`) and `type: raw` signals (`frequency`, `duty_cycle`, positive microsecond `data:`). Fully interoperable between `ir-studio`, Flipper Zero, and `Flipper-IRDB`.

### IR Fingerprint k-NN
`ir-studio`'s zero-allocation nearest-neighbor matcher (`internal/irml/fingerprint.go`) that projects any captured or parsed IR button into an L2-normalized **8D timing embedding** (`[8]float32`) and ranks `Flipper-IRDB` remotes by cosine similarity with a **`±4 kHz` carrier gate** for single-button remote model recovery.

### IR Macro
An ordered sequence of `(remote, button, delay_after_ms)` steps stored in `~/.config/ir-studio/macros.json` (`0600`) that automates multi-appliance routines (e.g., TV + Soundbar + HDMI input) with cancellable inter-step delays.

### LIRC mode2
The Linux kernel's `/dev/lirc*` raw IR receive stream (`LIRC_MODE_MODE2 = 0x04`), delivering 32-bit packets whose top byte distinguishes marks (`LIRC_MODE2_PULSE = 0x01000000`), spaces (`LIRC_MODE2_SPACE = 0x00000000`), and end-of-frame timeouts (`LIRC_MODE2_TIMEOUT = 0x03000000`), with microsecond duration in the lower 24 bits.

### Manchester Encoding
A self-clocking bi-phase baseband modulation used by Philips **`RC5`** (`36 kHz`, `TE = 889 µs`) and **`RC6`** (`36 kHz`, `TE = 444 µs`) where every bit occupies a fixed slot and is encoded by the **direction of the mid-bit mark/space transition** (`1 = -TE/+TE`, `0 = +TE/-TE` in RC5).

### Mark / Space
The two alternating baseband states of a demodulated IR pulse train: a **Mark** (`+µs`) is an active carrier-modulated LED burst; a **Space** (`-µs`) is a silent LED-OFF gap.

### NEC Repeat Frame
A compact 3-pulse frame (`+9000 µs` mark, `-2250 µs` space, `+562 µs` stop mark) emitted every `108 ms` while a button is held down on an `NEC` remote, signaling the receiver to repeat the previously decoded command without retransmitting all 32 bits.

### Pulse-Distance Encoding
An IR baseband modulation used by **`NEC`**, **`NECext`**, **`Samsung32`**, and **`Kaseikyo`** where every bit begins with a constant-width mark (`1×TE`) and binary `0` vs `1` is encoded by the following **space** length (`1×TE` = `0`, `3×TE` = `1`).

### Smart Probe Ranking
Pressing **`R`** in `ir-studio`'s `PROBE` tab to reorder the active `Flipper-IRDB` pack descending by 8D IR cosine similarity against the last captured button, transmitting the most likely brand and protocol candidates first.

### Smart Save Guard
An `ir-studio` UX safeguard powered by the `12→24→3` IR MLP classifier: when a live capture is classified as `Ambient Noise` with confidence `>= 85%`, pressing `SAVE` prompts for explicit confirmation before writing to `~/ir-studio/remotes/`.

### TransceiverGate
`ir-studio`'s hardware synchronization coordinator (`internal/lirc/gate.go`) enforcing strict TX/RX mutual exclusion on `/dev/lirc*`: mutes and flushes `RXWorker` before transmission and enforces a **`>= 20 ms` post-TX optical settle guard** so emitted IR pulses never loop back into RX.

### Carrier Frequency Sweeper (`SweepCarrier`)
`ir-studio`'s rapid multi-carrier resend utility (`internal/lirc/sweeper.go`, `5 SWEEP` / `ir_sweep_carrier`) that transmits an IR signal sequentially across `[36000, 38000, 40000, 56000]` Hz to trigger finicky receivers (Philips RC5 `36 kHz`, Sony SIRC `40 kHz`, Cisco/Motorola `56 kHz`) and unconditionally restores hardware defaults (`38000 Hz / 33%`) on completion, error, or cancellation.

### `GEN:TV-B-Gone` Virtual Pack
`ir-studio`'s compiled-in, zero-disk read-only virtual database pack (`internal/library/tvbgone.go`) bundling 100 priority-ordered universal `Power` codes across major TV, Projector, and Soundbar brands for 100% offline `PROBE` sweeps immediately on first boot before running `--sync`.

### Smart AC State-Frame Controller
`ir-studio`'s interactive parametric HVAC controller (`internal/irfile/ac_state.go`, `REMOTE → AC`, `ir_send_ac_state`) that synthesizes complete, checksummed IR state frames (`SUM8`, 4-bit nibble sum, or byte-complement pairs) on the fly for `Gree`, `Midea`, `Daikin`, `LG_AC`, `Samsung_AC`, and `Mitsubishi` mini-split units and saves any state as a standard Flipper `.ir` button.

---

## Pure-Go On-Device Neural Suite (`.czml v1`)

### CZML (CardputerZero ML Binary v1)
A compact, zero-dependency little-endian binary neural model format (`CZML` magic, 64-byte header with `DomainID`, `ModelVersion`, `Flags`, payload length `<= 2 MiB`, SHA-256 integrity digest, calibrated Softmax temperatures `TempFine`/`TempCoarse`, UTF-8 label table, and per-output-channel symmetric `int8` weights with folded BatchNorm `float32` scales and biases). Embedded directly via `//go:embed` with optional verified user overrides in `~/.config/<app>/models/*.czml`.

### PulseNet (`PulseNet-RF` & `PulseNet-IR`)
A multi-task Pure-Go INT8 Depthwise-Separable 1D-TCN (`~72 KB`, `67K` parameters, `16.6 ms/op`, `0 allocs/op` on Cortex-A53) trained offline via Teacher→Student Knowledge Distillation and QAT on 11,471 real Flipper `.sub` and 8,907 real Flipper `.ir` captures. Predicts fine protocol families (28 RF / 24 IR), coarse classes, 32D SupCon embeddings, and runs a lazy 1D-UNet asymmetric AGC denoiser (`PN-CLEAN`).

### SpectrumNet-2D
A 17.5 KB INT8 Depthwise-Separable 2D-CNN (`5.38 ms/op`, `0 allocs/op` on Cortex-A53) embedded in `rf-heatmap` that inspects `32×36` thermal waterfall spectrograms to classify 8 RF scenes (`Quiet`, `Narrowband_OOK`, `Periodic_Beacon`, `Wideband_EMI_SMPS`, `FHSS_Hopper`, `LoRa_Chirp`, `CW_Jammer`, `RollJam_Suspect`) and render live LCD warning pills.

### NFC-InductiveNet
A 13.6 KB INT8 1D-CNN (`1.05 ms/op`, `0 allocs/op` on Cortex-A53) embedded in `nfc-studio` that classifies 32-sample ST25R3916 `(ΔAmp, ΔPhase, dA/dt, dP/dt)` approach trajectories across 7 materials (`AIR`, `FERROUS_STEEL`, `ALUMINUM`, `COPPER_BRASS`, `RESONANT_TAG`, `PHONE_ACTIVE`, `WATER_DIELECTRIC`) and estimates continuous dielectric moisture percentage (`0–100%`).

### NFC-DumpNet
A 24.7 KB INT8 quantized MLP (`0.29 ms/op` on Cortex-A53) embedded in `nfc-studio` that maps 48 structural, header, nibble-histogram, and page-entropy features of any `.nfc` dump into 10 card ecosystems (`Blank`, `NDEF_URI_Text`, `NDEF_WiFi_vCard`, `Transit_Card`, `Access_MIFARE`, `Hotel_Key`, `Gaming_Amiibo`, `EMV_Payment`, `DESFire_App`, `Encrypted_Proprietary`) plus an L2-normalized 32D SupCon tag fingerprint.

### Timeline-Seq
A 21.2 KB INT8 dilated 1D-TCN (`4.53 ms/op`, `0 allocs/op` on Cortex-A53) embedded in `radio-bridge` (`--timeline --ml-score` / `--correlate --ml-score`) that scores up to 32 simultaneous multi-modal `RF + NFC + IR` events into 7 scenarios (`Normal_Idle`, `SmartHome_Chain`, `Access_Unlock_Flow`, `Replay_Suspect`, `RollJam_Suspect`, `Probe_BruteForce`, `RF_Jamming_Event`) with a calibrated causal confidence score.

### Knowledge Distillation (KD)
A model compression technique where a large FP32 Teacher network (`ResTCN-Transformer`) transfers its soft probability distribution (`KL divergence` at temperature $\tau$) to a compact Student network (`PulseNet`), preserving accuracy under tight ARM Cortex-A53 RAM and latency budgets.

### QAT (Quantization-Aware Training)
Simulating symmetric INT8 weight and dynamic activation rounding inside the forward pass (via Straight-Through Estimators) during the final GPU epochs so the model adapts to `int8` discretization error prior to `.czml` export.

### SupCon (Supervised Contrastive Learning)
A metric-learning loss that pulls normalized 32D embeddings of captures from the same protocol/device family together on the unit hypersphere $S^{31}$ while pushing different families apart, powering cross-format RF, IR, and NFC k-NN fingerprinting.

### Temperature Scaling
A single-parameter post-training calibration step dividing logits by an optimized scalar $T > 0$ (minimizing validation NLL) so Softmax confidences accurately reflect true empirical accuracy (low Expected Calibration Error, e.g., `ECE = 0.0012` for `PulseNet-RF`).

### RollJam Attack
A two-stage rolling-code interception technique where a narrowband jammer blocks a receiver on an adjacent frequency bin while capturing a vehicle/gate keyfob's rolling transmission, then replays the first code while hoarding the second. Detected across both 2D spectrum waterfalls (`SpectrumNet-2D`) and multi-modal timelines (`Timeline-Seq`).

### Simple Mode & Expert Mode (`expert_mode`)
A progressive-disclosure UI pattern used across CardputerZero applications (`ir-studio`, `rf-heatmap`, `nfc-studio`, `audio-studio`, persisted in `~/.config/<app>/config.json`). **Simple Mode** (`expert_mode: false`, default) presents a linear, task-oriented Home Menu with 4–5 items; **Expert Mode** (`expert_mode: true`, magenta `EXP` badge) unlocks full engineering labs.

---

## Acoustics, 96 kHz Ultrasonics & Audio ML (`audio-studio`)

### ES8389 Audio Codec
Everest Semiconductor's Hi-Fi stereo audio codec (`card 1: ES8389-Audio`) onboard CardputerZero supporting `8–96 kHz` `S16_LE/S24_LE/S32_LE` capture and playback, `0..+42 dB` hardware PGA gain in `3 dB` steps, and toggleable hardware ALC.

### DC-Blocking Filter
A 1st-order high-pass filter ($y[n] = x[n] - x[n-1] + 0.995\,y[n-1]$) applied immediately after discarding the initial `120 ms` ES8389 ADC bias-settle transient so DC offsets never corrupt SPL meters, FFT DC bins, or anomaly baselines.

### HTK Mel Filterbank
A bank of 32 overlapping triangular frequency filters spaced evenly on the perceptual Mel scale ($m(f) = 2595 \log_{10}(1 + f/700)$) from `60 Hz` to `7800 Hz`, forming the bit-exact Log-Mel input shared between `ml-lab/audio_ml/` and `audio-studio/internal/dsp/mel.go`.

### Spectral Flatness
The ratio of the geometric mean to the arithmetic mean of a power spectrum ($[0, 1]$). Values near `0` indicate a pure tonal carrier (sine wave, siren, coil whine); values near `1` indicate broadband noise (static, airflow, rain).

### Spectral Flux
The L2 norm of positive frame-to-frame spectral magnitude changes, quantifying sharp acoustic transients (impacts, glass breaks, knocks, keyboard clicks).

### YIN Pitch Estimator
An autocorrelation-based fundamental frequency ($F_0$) algorithm using the Cumulative Mean Normalized Difference Function (CMNDF) with parabolic lag interpolation (`internal/dsp/pitch_yin.go`) for octave-error-resistant chromatic tuning (`50–4000 Hz`).

### Goertzel Algorithm
An efficient $O(N)$ second-order IIR resonator that evaluates a single DFT frequency bin without running a full FFT — used by `audio-studio` to decode the 8-tone DTMF matrix (`697..1633 Hz`) and `50/60 Hz` mains hum with zero heap allocations.

### `SoundNet-2D` (`.czml` Domain `7`)
A pure-Go zero-allocation INT8 Depthwise-Separable 2D-CNN embedded in `audio-studio` that classifies `[2×32×48]` (`Log-Mel + ΔLog-Mel`) spectrograms into 28 real-world & engineering sound classes while producing L2-normalized 32D SupCon embeddings for on-device Few-Shot enrollment (`SoundProfileIndex`).

### `AnomalyAE-2D` (`.czml` Domain `8`)
A pure-Go zero-allocation INT8 2D Convolutional Autoencoder (`32D` bottleneck, `NearestUpsample2× + DW/PW Conv2D`) trained on DCASE industrial machine baselines (`fan`, `pump`, `slider`, `valve`). Reconstructs gain-invariant `[1×32×32]` Log-Mel patches to score mechanical faults and produce a 32-band error heatmap fused with `BandBaseline` EWMA.

### `PreTriggerRing`
A bounded in-RAM circular PCM16 audio buffer (`<= 240,000` samples = `480 KB`) that continuously holds the most recent seconds of microphone input with zero SD-card wear, flushing a combined `2 s pre-trigger + 3 s post-trigger` `.wav` clip only when `Anomaly Watch` confirms an anomaly.

### `BeltAnalyzer`
`audio-studio`'s zero-allocation high-resolution sub-500 Hz frequency analyzer (`internal/dsp/belt.go`) that decimates `16 kHz` audio `8:1` to `2,000 Hz` and runs a `1024`-pt Hann FFT (`1.953 Hz/bin`) with sub-harmonic verification and log-parabolic interpolation (`±0.2 Hz`) to capture plucked 3D-printer GT2 belt frequencies, 5-pluck medians, and CoreXY Belt A vs. Belt B matches.

### Sub-Harmonic Verification
A fundamental-frequency safeguard that inspects `bin/2` whenever a spectral peak is detected; if the sub-harmonic carries substantial energy above the noise floor (within `9 dB` of the peak), the analyzer selects `F0` rather than locking onto a stronger `2·F0` mechanical overtone.

### Log-Parabolic Peak Interpolation
A closed-form 3-point quadratic fit over $\ln P[k-1], \ln P[k], \ln P[k+1]$ that estimates the true continuous peak frequency between discrete FFT bins (`±0.2 Hz` accuracy at `1.95 Hz/bin`).

### `TriggerRule`
A per-profile automation configuration attached to a `SoundProfile` in `~/.config/audio-studio/profiles.json` (`script_path`, `enabled`, `min_similarity`, `cooldown_sec`) specifying which executable script launches when live audio matches that custom 32D sound profile inside `Sound Match (32D)`.

### `TriggerLog` (`trigger_log.jsonl`)
A bounded, persistent JSON-Lines log file (`~/audio-studio/trigger_log.jsonl`, capped at `200` entries, `0600` permissions) that records a timestamped entry strictly whenever a sound-profile script trigger launches (status, exit code, duration, similarity, and truncated output), inspectable and clearable inside `Sound Match → 6 LOGS`.

### Streak Debounce
Requiring `N` consecutive ML inference frames (`ConfirmStreakFrames = 2`, ~`400 ms`) above both the RMS floor (`-65 dBFS`) and cosine similarity threshold before firing an external script trigger, rejecting single-frame transient false positives.

### Cooldown
A per-profile minimum refractory window (`2–300 s`, default `10 s`) enforced after a script launch so continuous matching sounds do not repeatedly spawn duplicate processes.

### Ultrasonic Doppler Shift
The apparent frequency shift $\Delta f = \frac{2v}{c} f_c$ of an ultrasonic carrier ($19.5\text{ kHz}$) reflected from a moving target at radial velocity $v$ ($c \approx 343\text{ m/s}$). Positive $\Delta f$ indicates motion toward the sensor (`APPROACH`); negative $\Delta f$ indicates motion away (`RECEDE`).

### I/Q Baseband Demodulation
Multiplying a narrowband carrier signal by quadrature oscillators $\cos(2\pi f_c t)$ (In-phase) and $-\sin(2\pi f_c t)$ (Quadrature) and low-pass decimating to isolate signed frequency offsets (`-250..+250 Hz`) around $f_c$ without losing motion direction.

### Heterodyne Mixing
Frequency-translating an inaudible ultrasonic band (`18–48 kHz`) down into human hearing (`0–4.5 kHz`) by multiplying the high-passed microphone signal with a tunable local oscillator $\cos(2\pi f_{\text{LO}} t)$ and low-pass filtering the difference frequency $|f - f_{\text{LO}}|$.

### Subsequence DTW (Dynamic Time Warping)
A dynamic-programming sequence alignment algorithm that matches a multi-frame temporal pattern (`2–3 s` of consecutive 32D embeddings) against the trailing edge of a live embedding ring while tolerating slight speed variations (`±2` frames).

### Background Contrast
Comparing a candidate profile's live cosine similarity against calibrated room-noise prototypes (`margin = sim_target - max(sim_background) >= 0.12`) to prevent ambient room noise from triggering scripts.

### Keyword Spotting (KWS / `KWSNet-2D`)
Always-offline voice-command recognition (`.czml` Domain `9`, `~48 KB` INT8) classifying `[2×32×48]` Log-Mel windows into 16 Speech Commands v2 words while outputting a 32D SupCon voice embedding for custom wake-word enrollment in any language.

### BLE Advertising Channels (37 / 38 / 39)
The three primary 2.4 GHz BLE broadcast channels (`2402`, `2426`, `2480 MHz`) positioned between Wi-Fi channels 1, 6, and 11 where peripherals transmit up to 31 bytes of AD Structures (`0xFF` Manufacturer Data, `0x16` Service Data) without establishing a connection.

### RPA (Resolvable Private Address)
A rotating 48-bit random BLE MAC address generated from an Identity Resolving Key (IRK) every ~15 minutes to prevent passive tracking. `bt-studio`'s `TrackerGuard` correlates RPA rotations across time using tracker key prefixes and `BTDeviceNet`'s 16D SupCon embeddings.

### Apple Continuity (`0x004C`)
Apple's proprietary BLE Manufacturer Data protocol suite carrying Proximity Pairing (`0x07` AirPods/Beats battery), FindMy offline finding (`0x12` AirTag status & separated-from-owner bit), iBeacon (`0x02 0x15`), Nearby Info (`0x10`), AirDrop (`0x05`), and Handoff (`0x0C`).

### BTHome v2 (`0xFCD2`)
An open, standardized, pairing-free BLE Service Data format supported by Home Assistant, Shelly BLU, and custom thermometer firmwares for broadcasting temperature, humidity, pressure, battery, motion, and button press events.

### GATT Security Posture Audit
Systematic inspection of a BLE peripheral's `GattService1` / `GattCharacteristic1` flags to identify unauthenticated `write-without-response` (`HIGH`) or `write` (`WARN`) surfaces and cleartext Device Information disclosures (`INFO`).

### Log-Distance Path Loss Model
An RF propagation formula $d = 10^{(P_{\text{1m}} - \text{RSSI})/(10 n)}$ used by `bt-studio`'s 1D-Kalman Foxhunt to estimate distance in meters from calibrated `TxPower` ($P_{\text{1m}}$), Kalman-filtered RSSI, and indoor path-loss exponent ($n \approx 2.4$).

### `BTDeviceNet` (`.czml` Domain `10`)
A pure-Go zero-allocation INT8 multi-task Bluetooth classifier embedded in `bt-studio`. Upgraded in `v0.4.0` (`v200`, `~38 KB` `.czml`, with `v100` fallback) to fuse a Raw-31-Byte AD 1D-CNN (`[3×32]`) with the `[32]float32` tabular feature vector, classifying anonymous/RPA Bluetooth devices into 18 fine-grained classes (`Apple_Watch`, `Smart_Lock_Access`, `ESP32_nRF_DevBoard`, `Flipper_Research_Tool`, etc.) while outputting a 16D L2-normalized SupCon embedding for cross-MAC correlation.

### GATT Honeypot
A cloned or template-driven local BLE peripheral server registered non-root via BlueZ `org.bluez.GattManager1.RegisterApplication` and paired with a connectable `LEAdvertisement1`, allowing security researchers to intercept and log cleartext `READ`/`WRITE` payloads sent by mobile companion apps (`~/bt-studio/honeypot_log.jsonl`).

### ATT Handle Value Notification
Bluetooth Attribute Protocol opcode `0x1B` pushed asynchronously from a BLE peripheral to a subscribed central (`GattCharacteristic1.StartNotify`) without requiring polling. `bt-studio`'s zero-allocation `ByteDiffTracker` diffs consecutive notification payloads to highlight mutating offsets and XOR bitmasks.

### Nordic UART (NUS)
A widely adopted BLE vendor serial profile (`Service 6E400001-B5A3-F393-E0A9-E50E24DCCA9E`) pairing a writable `RX` characteristic (`6E400002`) with a notifying `TX` characteristic (`6E400003`) to emulate full-duplex serial consoles on ESP32 and nRF52 boards.

### RFCOMM / SPP
The Classic Bluetooth (BR/EDR) serial transport layer (**RFCOMM** channels `1..30`, **Serial Port Profile** UUID `0x1101`) emulating RS-232 streams over L2CAP (`PSM 0x0003`) for HC-05 modules, ELM327 OBD-II adapters, and embedded serial consoles. Accessed non-root in `bt-studio` via `AF_BLUETOOTH` `SOCK_STREAM`.

### SDP Service Discovery
The Classic Bluetooth **Service Discovery Protocol** running on L2CAP `PSM 0x0001`. `bt-studio` sends native `ServiceSearchAttributeRequest` (`PDU 0x06`) queries and parses returned **Data Elements** (`PDU 0x07`) to enumerate `ServiceClassIDList`, `ServiceName`, and exact `RFCOMM` channel numbers without `root` or `sdptool`.

### L2CAP PSM
**Protocol/Service Multiplexer** — a 16-bit odd port-like identifier on Bluetooth Classic's Logical Link Control and Adaptation Protocol (L2CAP) layer (e.g. `0x0001` = SDP, `0x0003` = RFCOMM, `0x0019` = AVDTP/A2DP). Probing `PSM 0x0001` via non-root `SOCK_SEQPACKET` detects hidden Classic devices and measures baseband RTT.

### BTSnoop v1
The standard **RFC 1761** Bluetooth packet capture format (`Magic: "btsnoop\x00"`, `Version: 1`, `DataLink: 1002` HCI UART H4) natively dissected by Wireshark. `bt-studio` exports Radar LE Advertising Reports (`0x04 0x3E`) and GATT Notify/Honeypot ATT PDUs (`0x02` ACL → L2CAP `0x0004` → ATT) into `~/bt-studio/exports/*.btsnoop`.

### Proximity Tap-to-Select
A near-field target picker in `bt-studio` (`NearestCandidate`, default `RSSI >= -50 dBm`, `< 30 cm`, with a `5 PICK` manual fallback) that locks onto a Bluetooth device held right next to CardputerZero, replacing raw MAC-address hunting in Guided Quick Missions and `bt_nearest_device`.

### Known Environment Baseline
A persistent ambient Bluetooth snapshot saved to `~/.config/bt-studio/known_env.json` (`0600`) via `bt-studio`'s **Learn My Room** mission (`KnownEnvStore` / `bt_env_learn`). Matches static MACs exactly and rotating-RPA household devices via soft `FingerprintKey` (`Vendor|Protocol|Name`) so Radar's **`NEW ONLY`** filter hides familiar background radios without false alarms after 15-minute RPA rotations.

### Byte-Diff Field Inference
Zero-allocation heuristic classification (`InferByteFields`, `0 B/op, 0 allocs/op`) over `ByteDiffTracker` notification streams in `bt-studio` that labels each byte offset in real time as `STATIC` (constant header/magic), `SEQ +1` (monotonic mod-256 counter), `BTN(bK)` (single-bit XOR toggle), `SENSOR` (bounded smooth range `<= 48`), or `VAR` (wide payload/checksum).

### GATT Security Grade (A-F)
A plain-English security posture rating (`A` strong read-only/encrypted through `F` critical blind `write-without-response`) computed by `ble.AuditGattProfile` in `bt-studio` alongside a one-line `PlainSummary`, surfaced in GATT Explorer, Guided Missions, and `bt_mission_audit_nearest`.

### `BLEPayloadNet-1D`
A pure-Go zero-allocation INT8 Depthwise-Separable 1D-CNN (`.czml` Domain `11`, `~32 KB`) embedded in `bt-studio` that ingests `[10×32]` per-offset statistical features from `ByteDiffTracker` (`>= 4` captured GATT notifications) to predict 9 per-byte protocol roles (`PAD`, `HDR_STATIC`, `SEQ_CTR`, `BTN_FLAG`, `UINT8_VAL`, `INT16_LE`, `INT16_BE`, `ASCII_TXT`, `CRC_OR_ENC`) and 6 stream archetypes (`Plaintext_Sensor`, `Button_Control`, `IMU_MultiAxis`, `ASCII_Serial`, `Checksummed_Frame`, `Encrypted_Random`).

### `BTSeqNet-1D`
A pure-Go zero-allocation INT8 dilated 1D-TCN (`.czml` Domain `12`, `~26 KB`, dilations `d=1, 2, 4`) embedded in `bt-studio` that inspects `[8×32]` 64-second rolling RF trajectories paired with ambient crowd churn (`bg_crowd_churn`) to separate genuine `Co_Moving_Tracker` threats from `Stationary_Ambient` or `Passing_By` devices while detecting `BLE_Spam_Flood`, `Beacon_Spoof_Anomaly`, and `Active_Prober` with a calibrated `StalkRisk ∈ [0, 1]`.

### `BTAnomalyAE`
A pure-Go zero-allocation INT8 symmetric Autoencoder (`.czml` Domain `13`, `~16 KB`, `32→48→24→12→24→48→32`) embedded in `bt-studio` that reconstructs benign `[32]float32` Bluetooth device feature vectors and flags out-of-distribution Evil-Twin or spoofed frames whenever `AnomalyZ = (MSE - mu) / sigma >= 3.2σ`, mapping the peak reconstruction error to a plain-English `FaultReason`.

### Evil-Twin RF Anomaly
A spoofed or cloned Bluetooth peripheral or beacon that mimics a legitimate device's MAC, name, Company ID, or UUID while exhibiting subtle physical or structural inconsistencies (software advertising jitter, `TxPower`/RSSI mismatch, or malformed AD framing) detected unsupervised by `BTAnomalyAE` (`[ANOM]` badge) and `bt_anomaly_scan`.

### Per-Byte Protocol Segmentation
Assigning a semantic data-type label to every individual byte offset of an unknown binary packet stream in a single forward pass — as performed by `BLEPayloadNet-1D` in `bt-studio`'s Live Notify view to distinguish adjacent `INT16_LE`/`INT16_BE` multi-byte sensor pairs, bit-flag buttons, sequence counters, static headers, and trailing `CRC`/encrypted bytes automatically.

---

## Wi-Fi 2.4 GHz, 802.11 IEs, WIDS & EDC Sensing

### 802.11 Beacon IE
A variable-length Tag-Length-Value (`[Tag ID][Length][Payload...]`) **Information Element** carried inside 802.11 Management Beacon and Probe Response frames advertising SSID (`0x00`), DS channel (`0x03`), BSS Load (`0x0B`), HT Capabilities (`0x2D`), RSN security (`0x30`), Extended Capabilities (`0x7F`), and Vendor/WPS extensions (`0xDD`). Dissected zero-alloc by `wifi-studio`'s `BeaconIEInfo` parser.

### BSS Load (`IE 0x0B`)
An 802.11e/802.11k Beacon Information Element (`Tag 11`, 5 bytes) reporting an Access Point's real-time **Station Count** (16-bit LE), **Channel Utilization** (`0–255` scaled to `0–100%` airtime busyness), and **Available Admission Capacity**. Used by `wifi-studio`'s `ChannelBellScore` planner and `CrowdPulse` occupancy tracker.

### PMF (`802.11w`)
**Protected Management Frames** (IEEE `802.11w`), signaled inside the RSN (`IE 0x30`) Capabilities bits `MFPC` (Capable) and `MFPR` (Required). Cryptographically authenticates deauthentication and disassociation management frames, neutralizing classic unauthenticated Wi-Fi deauth attacks; mandatory in `WPA3-SAE` and required for `WiFiSecurityGrade` `A`.

### WPA3-SAE
**Simultaneous Authentication of Equals** (RSN AKM Suite `00:0F:AC:08`), WPA3-Personal's Dragonfly zero-knowledge handshake that replaces WPA2-PSK's 4-way handshake to eliminate offline dictionary cracking while mandating `PMF (802.11w)` forward secrecy.

### WPS TLV
**Wi-Fi Protected Setup** Type-Length-Value attributes carried inside Microsoft Vendor IE `0xDD` (`OUI 00:50:F2`, Type `0x04`). Exposes router model strings, configuration state, and `AP Setup Locked` flags; unlocked WPS PIN mode is vulnerable to Pixie-Dust and online brute-force attacks and degrades `WiFiSecurityGrade`.

### IE Structure Fingerprint
`wifi-studio`'s canonical SHA-256 digest (`IEFingerprintHash`) computed over an Access Point's ordered 802.11 IE Tag ID sequence, RSN AKM/cipher capabilities, and vendor OUI structure. Even when an attacker spoofs an AP's exact SSID, BSSID, and channel, a Linux `hostapd` or ESP32 SoftAP emits a distinctly different IE layout, triggering an instant WIDS drift alert.

### Evil Twin
A rogue Wi-Fi Access Point masquerading under a legitimate network's SSID (and often cloned BSSID) to intercept credentials, strip WPA3/WPA2 down to Open or Captive Portal, or perform man-in-the-middle attacks. Detected in `wifi-studio` via `IEFingerprintHash` drift, security downgrade checks, and `WiFiThreatAE` (`AnomalyZ >= 3.2σ`).

### Fresnel-Zone Multipath Motion
Through-wall motion sensing exploiting constructive and destructive RF phase interference when a human body crosses the first **Fresnel Zone** ($r_1 = \frac{1}{2}\sqrt{\lambda d}$, $\lambda \approx 12.2\text{ cm}$ at `2.45 GHz`) between a router and CardputerZero. `wifi-studio`'s `MotionTripwire` samples 10 Hz RSSI and TX retry ripple non-root via `/proc/net/wireless` and feeds `WiFiMotionNet-1D` without needing monitor-mode CSI drivers.

### Captive Portal
A network-access interception wall (common in hotels, airports, and rogue Evil Twins) that hijacks cleartext HTTP requests with `302/307` redirects or custom login pages before granting internet access. Inspected in `wifi-studio`'s Link Health and Net-Tools labs via HTTP `204` connectivity probes.

### ARP Spoofing
A Layer-2 LAN attack where a rogue host sends forged gratuitous ARP replies mapping the default gateway's IPv4 address to the attacker's MAC address for traffic interception. Detected passively in `wifi-studio`'s LAN Recon screen by monitoring `/proc/net/arp` for duplicate MACs across distinct IPs or unexpected gateway MAC flips.

### Wake-on-LAN (WoL)
A Layer-2/UDP power-management trigger sending a 102-byte **Magic Packet** (`6× 0xFF` followed by `16×` the target NIC's 6-byte MAC address) over UDP port `9` to wake sleeping PCs or servers on the local subnet. Gated behind `ResearchAck` in UI and `confirm_net: true` in `wifi_wol_send` MCP and `radio-bridge`.

### `WiFiAPNet-1D`
A pure-Go zero-allocation INT8 Raw-IE 1D-CNN + Tabular Fusion model (`.czml` Domain `14`) embedded in `wifi-studio` that classifies 2.4 GHz Access Points into hardware/ecosystem archetypes (Enterprise AP, Consumer Router, Mesh Node, Mobile Hotspot, IoT/ESP SoftAP, Hidden IP Camera, Rogue `hostapd`, Printer/Appliance) and outputs a 16D L2-normalized SupCon embedding.

### `WiFiMotionNet-1D`
A pure-Go zero-allocation INT8 10 Hz dilated 1D-TCN (`.czml` Domain `15`) embedded in `wifi-studio` that classifies rolling 6.4-second multipath RSSI and TX retry ripple windows into `Still_Room`, `Human_Walk`, `Door_Event`, and `RF_Interference` to power Through-Wall `MotionTripwire`.

### `WiFiThreatAE`
A pure-Go zero-allocation INT8 unsupervised symmetric Autoencoder (`.czml` Domain `16`) embedded in `wifi-studio` that reconstructs benign 2.4 GHz AP feature vectors and raises an Evil-Twin / rogue SoftAP alert whenever `AnomalyZ = (MSE - mu) / sigma >= 3.2σ`, outputting per-feature `FaultReason` attribution.

---

## 9-DoF Inertial Engineering, Vibration FFT & IMU ML (`imu-studio`)

### `BMI270`
Bosch Sensortec's ultra-low-power 6-axis MEMS IMU onboard CardputerZero combining a 16-bit triaxial accelerometer (`±2g`–`±16g`) and 16-bit triaxial Coriolis gyroscope (`±125`–`±2000 °/s`). Read non-root in `imu-studio` via Linux IIO sysfs `Pread` file descriptors.

### `BMM150`
Bosch Sensortec's 3-axis geomagnetic FlipCore/Hall sensor onboard CardputerZero measuring magnetic flux density in microtesla (`µT`, Earth's field `~25–65 µT`). Powers `imu-studio`'s tilt-compensated 3D Compass and Magnetic Metal / Stud / Tracker Finder.

### Madgwick AHRS
A computationally efficient, zero-allocation quaternion orientation filter (`MadgwickAHRS`) that fuses high-rate gyroscope angular velocity with accelerometer gravity (and optionally magnetometer north) via a gradient-descent correction step ($\beta$), preventing gyroscope drift and eliminating Euler gimbal lock.

### Hard-Iron / Soft-Iron Calibration
Two-stage `BMM150` magnetometer compensation (`MagCalibration`) correcting permanent-magnet field offsets (**Hard-Iron** vector $\mathbf{b}_{\text{hard}}$ that shifts the sphere origin) and ferromagnetic distortion (**Soft-Iron** matrix $\mathbf{S}_{\text{soft}}$ that stretches the sphere into an ellipsoid) via a guided figure-8 sweep.

### Magnetic Inclination (Dip)
The vertical angle at which Earth's geomagnetic field lines enter the ground (`0°` at the magnetic equator, `~60°–70°` at mid-latitudes, `90°` at the poles). Because the field is tilted steeply downward, 3D compasses must apply roll/pitch tilt compensation before computing horizontal heading.

### ISO 10816-3 Velocity RMS
The international rotating-machinery vibration health standard (updated as ISO 20816-3) classifying equipment severity into **`ISO10816Grade`** zones (`A` `< 0.71 mm/s` Good through `F` `> 7.10 mm/s` Critical) based on frequency-integrated RMS vibration velocity ($V(f) = A(f)/(2\pi f)$) across `10–50 Hz`.

### Klipper Input Shaper (`ZV` / `MZV` / `EI`)
A motion-control resonance cancellation filter used in Klipper / Creality K1C 3D printers that splits stepper commands into timed impulses spaced by half the frame's resonant period to cancel ghosting/ringing: **`ZV`** (Zero Vibration, fastest/narrowest), **`MZV`** (Modified ZV, balanced CoreXY default), and **`EI`** (Extra Insensitive, widest `±20%` tolerance).

### STA/LTA Seismic Trigger
A classic geophysical event detector (**Short-Term Average / Long-Term Average**, `STALTADetector`) that computes the dimensionless ratio between fast (`~0.3 s`) and slow (`~4.0 s`) linear-acceleration energy windows to trigger `TAMPER_ALERT` or seismic events reliably across varying ambient floor noise levels.

### G-G Traction Circle
A 2D polar plot of lateral (`X`) versus longitudinal (`Y`) acceleration in multiples of gravity (`g`) used in motorsport and EDC shock logging to visualize cornering, braking, and combined grip envelopes alongside peak `DROP_SHOCK` impulse captures.

### `IMUVibNet-1D`
A pure-Go zero-allocation INT8 Depthwise-Separable 1D-CNN (`.czml` Domain `17`) embedded in `imu-studio` that classifies `100 Hz` triaxial vibration spectra and time-domain envelopes into 6 machinery states (`Quiet_Idle`, `Balanced_Spin`, `Rotor_Imbalance`, `Bearing_Wear`, `Loose_Mount`, `Printer_Ringing`) while producing a 16D SupCon embedding for `MachineProfile` drift tracking.

### `IMUTamperNet-1D`
A pure-Go zero-allocation INT8 dilated 1D-TCN (`.czml` Domain `18`, dilations `d = 1, 2, 4`) embedded in `imu-studio` that classifies rolling 6-axis accelerometer + gyroscope windows into 6 physical handling states (`Resting_Still`, `Footstep_Floor`, `Desk_Knock`, `Pickup_Theft`, `Drop_Impact`, `Pocket_Walk`) to suppress false Desk Tamper Guard alarms.

### `IMUMagAnomalyAE`
A pure-Go zero-allocation INT8 unsupervised symmetric Autoencoder (`.czml` Domain `19`) embedded in `imu-studio` that reconstructs calibrated geomagnetic feature vectors (`|B|`, inclination dip, spatial gradient, `50/60 Hz` AC ripple) and flags hidden magnets, trackers, studs, or live AC wiring whenever `AnomalyZ >= 3.2σ` (`MAG_ANOMALY`).

### Auto-Baseline Warmup
`imu-studio`'s automatic boot-time calibration routine (`AutoBaselineWarmup`) that watches for stationary stability during startup (`|gyro| < 1.5 °/s`) to silently trim initial `BMI270` gyroscope zero-rate bias and ambient magnetic/vibration noise floors without overwriting persisted calibration if the device is moving.

### Black-Box PreTriggerRing
A bounded in-RAM circular 9-DoF telemetry buffer (`PreTriggerRing`, `5 s` pre-trigger + `10 s` post-trigger at `100 Hz` = `1,500` frames) in `imu-studio` that incurs zero continuous microSD wear while idle and atomically dumps a complete before-and-after incident CSV to `~/imu-studio/exports/` (`BLACKBOX_SAVED`) on `TAMPER_ALERT`, `DROP_SHOCK`, `MAG_ANOMALY`, `VIB_FAULT`, or `imu_blackbox_control dump_now`.

### Dual-Axis Input Shaper
`imu-studio`'s paired `X` + `Y` Klipper resonance workflow (`DualShaperBundle` / `imu_shaper_dual`) that records independent gantry sweeps for both axes, computes separate `shaper_type_x`/`shaper_freq_x` and `shaper_type_y`/`shaper_freq_y` recommendations, budgets the global `[printer] max_accel` to $\min(a_{\max,X}, a_{\max,Y})$, and exports a ready-to-paste `printer.cfg` snippet.

### Moonraker Read-Only Bridge
An opt-in, strictly read-only HTTP `GET` probe in `imu-studio` (`imu_shaper_dual moonraker_status`, gated behind `confirm_net: true`) that queries a local Klipper/Creality K1C Moonraker API to inspect active `[input_shaper]` settings and toolhead state without ever transmitting G-code or altering printer configuration.

### StudioEventBus
`imu-studio`'s monotonic cursor-indexed event ring exposed over MCP via `imu_events_poll(since_id, limit)` that delivers structured physical events (`TAMPER_ALERT`, `DROP_SHOCK`, `MAG_ANOMALY`, `VIB_FAULT`, `KNOCK_MATCH`, `BLACKBOX_SAVED`, `TAP_MATERIAL`, `GESTURE_MATCH` with `imu_gesture`) reliably to `radio-bridge` and external AI agents without missed or duplicate alerts.

### Gait Cadence & Symmetry
Human walking metrics computed zero-alloc by `imu-studio`'s `StepCounter` (`0.8–3.2 Hz` bandpass pedometer): **Cadence** is the step rate in steps per minute (`spm = 60 / mean_step_dt`), and **Stride Symmetry (`%`)** compares alternating odd (left) vs. even (right) step durations to quantify balanced gait (`92–100%`) versus uneven stride.

### `IMUTapNet-1D`
A pure-Go zero-allocation INT8 Depthwise-Separable 1D-CNN (`.czml` Domain `20`) embedded in `imu-studio` that fuses `0.64 s` structural tap impulse ring-down envelopes (`TapCaptureBuffer`), `0–50 Hz` panel resonance spectra, and calibrated `BMM150` magnetic stud deltas (`ΔµT`) to classify walls, studs, pipes, tanks, and loose joints (`Solid_Concrete`, `Hollow_Drywall`, `Wood_Stud`, `Metal_Stud_Pipe`, `Empty_Tank_Drum`, `Loose_Joint`), estimate `Hollowness%`, and emit a 16D SupCon surface embedding (`TAP_MATERIAL`).

### `IMUBioNet-1D`
A pure-Go zero-allocation INT8 dilated 1D-TCN (`.czml` Domain `21`, `d = 1, 2, 4`) embedded in `imu-studio` for strictly non-medical educational micro-motion sensing: scores contactless Ballistocardiography (BCG) cardiac/respiratory signal quality, grades `4–12 Hz` physiological hand tremor steadiness for SMD soldering, and detects local desk keystroke vibration bursts.

### `IMUGestureNet-1D`
A pure-Go zero-allocation INT8 Depthwise-Separable 1D-CNN + Dual-Head model (`.czml` Domain `22`) embedded in `imu-studio` that classifies `[6×32]` arc-length-resampled 3D air-writing wand trajectories (`StrokeRecorder`) into 8 built-in spells (`Circle_CW`, `Circle_CCW`, `Figure_8`, `Z_Slash`, `Checkmark`, `Triangle`, `Up_Flick`, `Down_Flick`) plus a 16D SupCon embedding for custom user spells (`GESTURE_MATCH`).

### Ballistocardiography (BCG)
Contactless measurement of tiny (`3–15 mg`) mechanical body recoil impulses produced when the heart ejects blood through the aortic arch (`0.7–3.0 Hz` cardiac band) alongside slower chest respiratory motion (`0.15–0.5 Hz`). Demonstrated experimentally in `imu-studio` using the `BMI270` 16-bit accelerometer — strictly educational and non-medical.

### Physiological Hand Tremor (4–12 Hz)
Subtle involuntary neuromuscular micro-oscillations in the `4–12 Hz` band present in any unsupported human hand (amplified by caffeine, fatigue, or grip tension). Bandpass-filtered in `imu-studio`'s Soldering Hand-Steadiness lab to compute tremor RMS and a `0–100` steadiness score prior to fine-pitch electronics rework.

### Acoustic-Mechanical Side-Channel
Information leakage caused by physical elastic waves propagating through a desk or chassis when keys are typed or actuators move nearby. Demonstrated locally in `imu-studio`'s `KeystrokeSideChannel` lab by measuring desk flexural vibration bursts and inter-keystroke interval (`IKI`) Shannon timing entropy for security awareness without ever decoding or storing typed text.

### 3D Air-Gesture Stroke Resampling
Normalizing a variable-speed 3D hand trajectory (`StrokeRecorder`) by rotating raw `BMI270` motion into the gravity-aligned world frame via `MadgwickAHRS` quaternions, computing cumulative 3D arc length $s(t)$, and interpolating `N = 32` equidistant spatial control points so fast and slow air-writing spells produce identical tensors for `IMUGestureNet-1D`.

---

## Hardware Bus, Logic Analyzer & Power Profiling (`bus-studio`)

### I2C Open-Drain
An electrical bus topology used on I²C `SDA` and `SCL` lines where devices can only pull the wire LOW to `GND` and never actively drive it HIGH. External pull-up resistors ($R_p$, typically `2.2–4.7 kΩ` to `3.3 V`) charge bus capacitance $C_{\text{bus}}$ back up to logic `1` with `30%→70%` rise time $t_r \approx 0.8473\,R_p C_{\text{bus}}$, enabling safe multi-device wired-AND arbitration without bus contention shorts.

### `WHO_AM_I`
A read-only silicon identification register present on most I²C and SPI sensors (for example, register `0xD0 = 0x60` on a `BME280` or `0x75 = 0x68` on an `MPU6050`). Used by `bus-studio`'s **`I2CChipDB`** (`120+` chips) to disambiguate multiple devices sharing the same 7-bit I²C address.

### `JEDEC 0x9F`
The standardized SPI NOR flash **Read Identification (`RDID`)** command (`0x9F`) returning a 3-byte signature: Manufacturer ID (e.g., `0xEF` Winbond, `0xC8` GigaDevice), Memory Type, and Capacity Code ($2^n$ bytes). Executed strictly read-only in `bus-studio` (`bus_spi_jedec`) alongside floating-MISO checks (`0xFF`/`0x00`).

### UART Framing Error
A serial reception fault triggered when the UART receiver fails to observe a valid logic-HIGH **Stop Bit** at `9.5` bit periods after the falling Start Bit edge — most commonly caused by a transmitter/receiver baud-rate mismatch exceeding `~3.5%`, inverted logic polarity, or missing shared `GND`.

### Auto-Baud
An automatic serial bit-rate estimation algorithm in `bus-studio` (`bus_uart_autobaud`) that measures the shortest isolated pulse width $T_{\min}$ on an incoming UART wire ($B \approx 1 / T_{\min}$), snaps to standard rates (`9600–921600`, including `74880`), and validates candidate rates against framing-error and printable-ASCII ratios.

### `GPIO_V2 Edge Capture`
Linux's modern non-root GPIO character-device ioctl interface (`GPIO_V2_GET_LINE_IOCTL` on `/dev/gpiochip*`) used by `bus-studio`'s 4-CH Logic Analyzer to receive rising and falling edge events stamped with monotonic nanosecond kernel interrupt timestamps — avoiding slow `/sys/class/gpio` polling jitter.

### `IEEE 1364 VCD`
**Value Change Dump (`.vcd`)**, an ASCII event-driven digital waveform interchange format defined by IEEE 1364 (Verilog). Generated by `bus-studio`'s **`VCDExport`** (`bus_logic_export_vcd`) strictly inside `~/bus-studio/exports/` (`0600`) for direct protocol inspection in **sigrok PulseView** and **GTKWave**.

### PWM Duty Cycle
The percentage of one periodic Pulse-Width Modulation cycle spent at logic HIGH ($D = t_{\text{high}} / T \times 100\%$). Controls average power for LEDs (`1 kHz`) and 4-pin PC fans (`25 kHz`), while `50 Hz` RC hobby servos encode angle (`0°–180°`) directly in absolute high-pulse width (`1.0–2.0 ms`).

### Li-Ion Internal Resistance
The effective series impedance $R_{\text{int}} = \Delta V / \Delta I$ (`mΩ`) inside a lithium-ion cell measured by `bus-studio` from `bq27220` voltage sag under load steps. Healthy cells typically measure `40–120 mΩ`; aged or cold cells exceeding `250 mΩ` suffer severe voltage droop ($V_{\text{load}} = V_{\text{OC}} - I R_{\text{int}}$) that can trip `3.3 V` regulator brownouts under Wi-Fi or servo surges.

### `BusSignalNet-1D`
A pure-Go zero-allocation INT8 Depthwise-Separable 1D-CNN (`.czml` Domain `23`) embedded in `bus-studio` that classifies `GPIO_V2` logic pulse-timing tensors into 8 signal families (`I2C_Traffic`, `SPI_Clock_Burst`, `UART_Serial`, `PWM_Servo`, `OneWire_Bus`, `Switch_Bounce`, `Mains_Hum_Noise`, `Idle_Line`) and emits a 16D SupCon wire fingerprint (`bus_logic_fingerprint`).

### `BusStreamNet-1D`
A pure-Go zero-allocation INT8 dilated 1D-TCN (`.czml` Domain `24`, `d = 1, 2, 4`) embedded in `bus-studio` that classifies UART, I2C, and SPI NOR flash byte-stream windows into 6 archetypes (`ASCII_BootLog`, `JSON_NMEA_Telemetry`, `Binary_Sensor_Frame`, `Compressed_Encrypted_Blob`, `Baud_Mismatch_Garble`, `Empty_Erased_FF`).

### `BusPowerAE`
A pure-Go zero-allocation INT8 unsupervised symmetric Autoencoder (`.czml` Domain `25`) embedded in `bus-studio` that scores `bq27220` battery and 5-CH `m5ioe1` ADC power telemetry (`V_bat`, `I_load`, `R_int`, rail droop, temperature, ripple) to detect brownouts, degraded cells, or rail faults (`AnomalyZ >= 3.2σ`, `POWER_ANOMALY`).

### `ProtectedPinGuard`
`bus-studio`'s immutable SSOT pin safety guard that unconditionally blocks GPIO output or PWM actuation on system-critical CardputerZero CM0 pins (LCD SPI, keyboard matrix, CC1101/NFC SPI, internal I2C0 PMIC/audio/IMU, SDIO) to protect hardware integrity.

### `BusEventBus`
`bus-studio`'s monotonic cursor-indexed event ring exposed via `bus_events_poll(since_id, limit)` that delivers `I2C_DEVICE_FOUND`, `SIGNAL_DETECTED`, `UART_KEYWORD`, `POWER_ANOMALY`, `BLACKBOX_SAVED`, `ESP_CRASH`, and `ESP_POWER_STATE` events to `radio-bridge` (`StudioBus`) and MCP agents.

### `HardwareAdvisor`
`bus-studio`'s plain-English electronics diagnostics engine (`bus_advisor_diagnose`) that correlates bus states, pull-up/NACK errors, UART baud garble, SPI `0xFF`/`0x00` floating MISO lines, battery `R_int` sag, ESP32-S3 strapping/Octal PSRAM pin conflicts, and `.czml` ML outputs into actionable bench wiring fixes.

### SLIP Bootloader
The **RFC 1055 Serial Line Internet Protocol** (`0xC0` frame delimiters, `0xDB 0xDC`/`0xDB 0xDD` byte-stuffing escapes) spoken by the ESP32-S3 immutable mask ROM over UART0 or Native USB-Serial/JTAG. Used by `bus-studio` for non-root chip ID (`SYNC 0x08`, `READ_REG 0x0A`), read-only eFuse/partition inspection, and dual-gated verified flash operations (`SPI_FLASH_MD5 0x13`).

### ESP32-S3 Native USB-JTAG
ESP32-S3's integrated USB 1.1 Full-Speed CDC ACM + JTAG controller (`VID:PID 303a:1001` on `GPIO19` D- / `GPIO20` D+, enumerating as `/dev/ttyACM*` when CardputerZero's `USB-SW` is set to `HOST`). Enables zero-transistor USB CDC reset/download sequencing without an external CP2102 or CH340 bridge.

### Strapping Pins
Hardware-sampled ESP32-S3 GPIO lines (**`GPIO0`**, **`GPIO3`**, **`GPIO45`**, **`GPIO46`**) whose voltage levels are latched on the rising edge of `EN` (reset) to select SPI Boot vs. Joint Download Boot (`GPIO0`/`GPIO46`), JTAG signal source (`GPIO3`), and `VDD_SPI` flash supply voltage (`GPIO45`: `0 = 3.3 V` Quad, `1 = 1.8 V` Octal). Unintended external pull-ups/pull-downs on these pins cause silent bootloops.

### Octal PSRAM
High-bandwidth 8-lane (`OPI`) external pseudo-static RAM (`8 MB`, found on ESP32-S3 `N8R8` and `N16R8` modules) that permanently consumes **`GPIO35`, `GPIO36`, and `GPIO37`** (`SPIIO4–SPIIO7` / `DQS`) inside the module shield. Wiring user sensors or displays to `GPIO35–37` on an Octal PSRAM board triggers immediate boot crashes.

### eFuse Security
One-Time Programmable (`OTP`) hardware configuration bits inside ESP32-S3 controlling **Secure Boot v2** (`SECURE_BOOT_EN`), **Flash Encryption** (`SPI_BOOT_CRYPT_CNT`), **JTAG lockout** (`DIS_USB_JTAG`/`DIS_PAD_JTAG`), and **Download Mode lockout** (`DIS_DOWNLOAD_MODE`). Audited strictly read-only in `bus-studio` (`Zero-eFuse-Write Invariant`) to compute **`ESPSecurityGrade (A–F)`**.

### Guru Meditation
The Xtensa LX7 fatal CPU exception banner emitted by ESP-IDF firmware on an unhandled fault (`Guru Meditation Error: Core N panic'ed (...)`), reporting **`EXCCAUSE`** (e.g., `28 LoadProhibited`, `29 StoreProhibited`, `20 InstrFetchProhibited`), **`PC`**, **`EXCVADDR`**, and **`Backtrace`**. Automatically parsed by `bus-studio`'s **`CrashDoctor`** and **`ESPBootCrashNet-1D`**.

### NVS Partition
ESP-IDF's **Non-Volatile Storage** flash partition (`Type 0x01`, `Subtype 0x02` in the `0x8000` partition table) storing key-value configuration namespaces (often Wi-Fi credentials, MQTT tokens, or device keys). Unless Flash Encryption or NVS Encryption is enabled, NVS pages reside in plaintext; `bus-studio` flags exposed key names while enforcing the **`Redacted NVS Audit Invariant`** so raw secrets are never printed.

### `ESPBootCrashNet-1D`
A pure-Go zero-allocation INT8 Depthwise-Separable 1D-CNN (`.czml` Domain `26`) embedded in `bus-studio` that classifies Xtensa LX7 ROM boot logs, Guru Meditation panics, watchdog timeouts, and brownout sequences into 8 root-cause classes (`Normal_Boot`, `Null_Deref_LoadProhibited`, `Stack_Overflow_Canary`, `Watchdog_Starvation`, `Brownout_Power_Dip`, `Flash_PSRAM_Pin_Fault`, `Corrupt_App_Header`, `Bootloop_Panic`) for `CrashDoctor` and `ESP_CRASH` events.

### `ESPPowerProfileNet-1D`
A pure-Go zero-allocation INT8 dilated 1D-TCN (`.czml` Domain `27`, `d = 1, 2, 4`) embedded in `bus-studio` that classifies non-invasive `bq27220` + `m5ioe1` current/voltage waveforms into 8 ESP32-S3 power states (`DeepSleep_uA`, `LightSleep_Modem`, `Idle_Active`, `WiFi_TX_Burst`, `BLE_Adv_Pulse`, `Bootloop_Sawtooth`, `Brownout_Reset_Loop`, `Overcurrent_Fault`) and emits `ESP_POWER_STATE` events.

### `ESPFirmwareAuditNet-1D`
A pure-Go zero-allocation INT8 quantized 1D-CNN / Fusion model (`.czml` Domain `28`) embedded in `bus-studio` that evaluates `0x8000` partition layouts, `0xE9` app image headers, read-only eFuse flags, and redacted NVS/entropy descriptors into 6 firmware security archetypes (`Hardened_Production`, `Dev_Unencrypted_Open`, `Debug_JTAG_Exposed`, `Plaintext_NVS_Risk`, `OTA_No_Rollback`, `Corrupt_Or_Erased`) paired with `ESPSecurityGrade (A–F)`.
