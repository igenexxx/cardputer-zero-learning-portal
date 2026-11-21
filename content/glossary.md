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
