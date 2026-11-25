# On-Device Bus & ESP32-S3 ML: 6-Model INT8 `.czml` Neural Suite (Domains `23–28`)

**Bus Studio `v0.2.0`** embeds a **6-model Pure-Go zero-allocation INT8 `.czml v1` Neural Suite** (`CGO_ENABLED=0`, **Domains `23–28`**, **`~36–42 KB` total combined footprint** across all 6 embedded models — `< 48 KB` flash budget, **`0 B/op, 0 allocs/op`**, sub-millisecond inference on CardputerZero's ARM Cortex-A53). Every model is trained offline with **PyTorch Quantization-Aware Training (QAT)** using dynamic symmetric per-sample activation quantization (`DynActQ`), exported to SHA-256-verified `.czml v1` binaries, compiled in via `//go:embed`, and parity-verified against the Python INT8 reference (`max_abs_diff <= 1e-4`).

| Model | `.czml` Domain | Footprint | Input Tensor | Architecture | Primary Task |
| --- | --- | --- | --- | --- | --- |
| **`BusSignalNet-1D`** | Domain `23` (`v100`) | `~6.5 KB` | `[4×64]` Normalized `GPIO_V2` Pulse-Width, Duty, Jitter & Edge-Density | Depthwise-Separable 1D-CNN + Dual Heads | Classifies unknown digital wires into **8 signal families** + **16D SupCon fingerprint** |
| **`BusStreamNet-1D`** | Domain `24` (`v100`) | `~5.2 KB` | `[6×32]` Rolling UART/I2C/SPI Byte-Stream Entropy, Printable & Framing Windows | Dilated 1D-TCN (`d = 1, 2, 4`) | Classifies serial & SPI flash streams into **6 payload archetypes** (`ASCII_BootLog`..`Empty_Erased_FF`) |
| **`BusPowerAE`** | Domain `25` (`v100`) | `~4.7 KB` | `[20]` `bq27220` + 5-CH `m5ioe1` ADC Power Telemetry Feature Vector | Symmetric INT8 Autoencoder (`20→32→16→8→16→32→20`) | Unsupervised battery `R_int` sag, rail brownout, ADC ripple & thermal anomaly detector (`AnomalyZ >= 3.2σ`) |
| **`ESPBootCrashNet-1D`** | Domain `26` (`v100`) | `~7.2 KB` | `[6×48]` Xtensa LX7 ROM Boot, `EXCCAUSE`, Watchdog & Reset Token Sequence | Depthwise-Separable 1D-CNN | Classifies ESP32-S3 boot logs & Guru Meditation panics into **8 root-cause classes** for **`CrashDoctor`** |
| **`ESPPowerProfileNet-1D`** | Domain `27` (`v100`) | `~6.8 KB` | `[4×64]` Non-Invasive `bq27220` + `m5ioe1` Current, Voltage & `dI/dt` Windows | Dilated 1D-TCN (`d = 1, 2, 4`) | Classifies ESP32-S3 runtime power states (`DeepSleep_uA`, `WiFi_TX_Burst`, `Bootloop_Sawtooth`, `Brownout_Reset_Loop`, etc.) |
| **`ESPFirmwareAuditNet-1D`** | Domain `28` (`v100`) | `~6.0 KB` | `[24]` Partition Table (`0x8000`), `0xE9` App Header, Read-Only eFuse & Redacted NVS Features | Compact Quantized 1D-CNN / MLP Fusion | Classifies ESP32-S3 firmware security posture into **6 risk archetypes** alongside **`ESPSecurityGrade (A–F)`** |

- **Total 6-Model Footprint**: Domains `23–25` occupy `16.4 KB` (`6,654 + 5,304 + 4,807` bytes); adding Domains `26–28` (`~20 KB`) brings the complete 6-model embedded neural suite to **`~36–42 KB` total** — smaller than a single JPEG thumbnail while delivering real-time bus, power, crash, and firmware intelligence 100% offline.

---

## 1. Shared `.czml v1` Runtime, QAT `DynActQ` & Zero-Allocation Go Kernels

All six models execute on `bus-studio`'s pure-Go INT8 inference engine (`bus-studio/internal/busml/`), sharing the repository-wide **64-byte `.czml v1` container format** (`CZML` magic, domain/version IDs, SHA-256 weight digest, temperature/calibration scalars, and 18-byte layer descriptors):

- **Pure-Go INT8 Opcodes**: `OP_CONV1D (1)`, `OP_DEPTHWISE_CONV1D (2)`, `OP_POINTWISE_CONV1D (3)`, and `OP_LINEAR (4)` with BatchNorm folded into per-output-channel `int8` weights and `float32` biases.
- **Dynamic Symmetric Activation Quantization (`DynActQ`)**:
  $$s_x = \frac{\max_i |x_i|}{127.0}, \qquad q_x[i] = \text{round}\!\left(\text{clip}\!\left(\frac{x_i}{s_x}, -127, 127\right)\right)$$
  Applying identical `DynActQ` fake-quantization during PyTorch QAT and exact `int32` multiply-accumulate in Go guarantees `<= 1e-4` numerical parity between desktop training and handheld ARM64 inference.
- **Zero-Allocation Real-Time Invariant**: Every forward pass writes intermediate feature maps into a caller-owned fixed-size workspace struct (`SignalWorkspace`, `StreamWorkspace`, `PowerAEWorkspace`, `ESPCrashWorkspace`, `ESPPowerWorkspace`, `ESPAuditWorkspace`), benchmarked at **`0 B/op, 0 allocs/op`** so high-rate logic captures, serial panic streams, and power monitoring never suffer Go garbage-collection pauses.

---

## 2. `BusSignalNet-1D` (Domain `23`) — Wire Protocol Fingerprinting

When probing an unlabeled test pad on a PCB, a naive frequency counter confuses UART bursts, I2C data frames, mechanical button bounce, and 50/60 Hz mains pickup. **`BusSignalNet-1D`** analyzes the temporal geometry of `GPIO_V2` edge intervals:

1. **Input Tensor (`[4×64]`)**: Log-scaled high/low pulse widths, instantaneous duty ratio, and timing jitter / inter-burst gap density.
2. **Backbone**: `Conv1D(4→20, k=5, s=2)` → `DW/PW(20→28, s=2)` → `DW/PW(28→32, d=2)` → `Avg+Max Pool (64D)` → Dual Linear Heads.
3. **Dual Outputs**: **8 Signal Classes** (`I2C_Traffic`, `SPI_Clock_Burst`, `UART_Serial`, `PWM_Servo`, `OneWire_Bus`, `Switch_Bounce`, `Mains_Hum_Noise`, `Idle_Line`) + **16D SupCon Fingerprint Embedding** (`bus_logic_fingerprint`).

---

## 3. `BusStreamNet-1D` (Domain `24`) — Serial & Flash Stream Archetype TCN

**`BusStreamNet-1D`** runs a **dilated 1D-TCN (`d = 1, 2, 4`)** over `[6×32]` sliding byte-window descriptors (Shannon entropy $H/8$, printable ASCII ratio, structural delimiter density, high-bit/framing-error spikes, `0x00`/`0xFF` fill ratio, and transition variance) to classify streams into **`ASCII_BootLog`**, **`JSON_NMEA_Telemetry`**, **`Binary_Sensor_Frame`**, **`Compressed_Encrypted_Blob`**, **`Baud_Mismatch_Garble`**, and **`Empty_Erased_FF`**. Whenever UART classifies as `Baud_Mismatch_Garble`, `HardwareAdvisor` immediately recommends **`Auto-Baud`** (`bus_uart_autobaud`).

---

## 4. `BusPowerAE` (Domain `25`) — Unsupervised Power & `R_int` Anomaly Autoencoder

**`BusPowerAE`** learns the healthy manifold of CardputerZero bench power operation (`20→32→16→8→16→32→20` symmetric INT8 Autoencoder over `bq27220` pack voltage/current/power/`R_int`/temp + 5-CH `m5ioe1` ADC means/ripple). Crossing **`AnomalyZ >= 3.2σ`**:
$$\text{MSE} = \frac{1}{20}\sum_{i=0}^{19}(x_i - \hat{x}_i)^2, \qquad \text{AnomalyZ} = \frac{\text{MSE} - \mu_{\text{mse}}}{\max(\sigma_{\text{mse}}, 10^{-4})}$$
raises **`POWER_ANOMALY`** on `BusEventBus` and attributes the largest per-feature residual to a plain-English **`FaultReason`**.

---

## 5. `ESPBootCrashNet-1D` (Domain `26`) — Xtensa LX7 Boot & Panic Classifier

Real-world ESP32-S3 serial logs often interleave application debug prints, truncated backtraces, watchdog warnings, and rapid ROM reboot headers (`rst:0x...`, `invalid header`, `Guru Meditation Error`). **`ESPBootCrashNet-1D`** runs a compact **Depthwise-Separable 1D-CNN** over `[6×48]` rolling serial-token & panic-feature channels:

1. **Input Tensor (`[6×48]`)**:
   - **Ch 0**: ROM bootloader & reset-reason token markers (`POWERON`, `SW_CPU_RESET`, `TG0WDT`, `BROWNOUT`).
   - **Ch 1**: Xtensa LX7 `EXCCAUSE` / exception severity encoding (`LoadProhibited=28`, `StoreProhibited=29`, `InstrFetchProhibited=20`, `IllegalInstruction=0`).
   - **Ch 2**: Stack canary & heap/PSRAM initialization error token density (`psram`, `OPI`, `canary`, `abort()`).
   - **Ch 3**: Register-dump & backtrace density (`PC:`, `EXCVADDR:`, `Backtrace: 0x4...`).
   - **Ch 4**: Line-rate burstiness and repeated-boot periodicity (separates single crashes from tight `Bootloop_Panic` cycles).
   - **Ch 5**: Printable/garble framing indicator (flags baud drift or `1.8V` flash starvation).
2. **Outputs (8 Root-Cause Classes)**: `Normal_Boot`, `Null_Deref_LoadProhibited`, `Stack_Overflow_Canary`, `Watchdog_Starvation`, `Brownout_Power_Dip`, `Flash_PSRAM_Pin_Fault`, `Corrupt_App_Header`, and `Bootloop_Panic`.
3. **CrashDoctor & `radio-bridge` Integration**: Powers `esp_crash_diagnose` and emits **`ESP_CRASH`** (`esp_crash` matcher in `radio-bridge`) so automated rules can immediately run `esp_heap_watch` and `bus_blackbox_control dump_now` on crash.

---

## 6. `ESPPowerProfileNet-1D` (Domain `27`) — Non-Invasive ESP32-S3 Power & Bootloop TCN

Even when a target ESP32-S3 has silent UART logs (`GPIO46` strapped or USB-JTAG locked), its **current waveform** tells the entire story. **`ESPPowerProfileNet-1D`** runs a **dilated 1D-TCN (`d = 1, 2, 4`)** over `[4×64]` non-invasive `bq27220` + `m5ioe1` telemetry windows:

1. **Input Tensor (`[4×64]`)**:
   - **Ch 0**: Normalized instantaneous load current $I_{\text{load}}(t)$ (`mA`).
   - **Ch 1**: First-order current derivative $dI/dt$ highlighting sharp Wi-Fi TX RF bursts vs. periodic bootloop ramp-and-drop sawtooths.
   - **Ch 2**: Supply voltage sag $\Delta V(t)$ relative to open-circuit baseline (sensitive to `3.00 V` ESP32-S3 brownout proximity).
   - **Ch 3**: Rolling local current variance / duty cycle separating continuous CPU load from `100 ms` BLE advertising spikes and micro-amp Deep Sleep.
2. **Outputs (8 Power Regimes)**: `DeepSleep_uA`, `LightSleep_Modem`, `Idle_Active`, `WiFi_TX_Burst`, `BLE_Adv_Pulse`, `Bootloop_Sawtooth`, `Brownout_Reset_Loop`, and `Overcurrent_Fault`.
3. **Automation Integration**: Emits **`ESP_POWER_STATE`** (`esp_power_state` matcher in `radio-bridge`) whenever a target slips into `Bootloop_Sawtooth` or `Brownout_Reset_Loop`.

---

## 7. `ESPFirmwareAuditNet-1D` (Domain `28`) — Partition, eFuse & Redacted NVS Posture Model

Auditing an ESP32-S3 device in the field requires synthesizing dozens of bitfields across eFuses, the `0x8000` partition table, `0xE9` headers, and NVS entropy blocks. **`ESPFirmwareAuditNet-1D`** ingests a `[24]` structured security feature vector (strictly read-only under the **`Zero-eFuse-Write`** and **`Redacted NVS Audit`** invariants):

1. **Input Features (`[24]float32`)**:
   - Read-only eFuse posture bits (`SECURE_BOOT_EN`, `SPI_BOOT_CRYPT_CNT` odd/release state, `DIS_USB_JTAG`, `DIS_PAD_JTAG`, `DIS_DOWNLOAD_MODE`, `DIS_DIRECT_BOOT`).
   - `0x8000` partition structure (valid `0xAA50` table, dual `ota_0`/`ota_1` rollback slot presence, `coredump`/`spiffs` presence, partition encryption flags).
   - `0xE9` app header integrity (chip ID `0x0009` match, SHA-256 digest flag, SPI mode/size sanity).
   - Redacted NVS risk indicators (plaintext NVS presence, sensitive key-name risk density, Shannon entropy of `nvs` vs. `app` regions — **never raw credential values**).
2. **Outputs (6 Posture Archetypes)**: `Hardened_Production`, `Dev_Unencrypted_Open`, `Debug_JTAG_Exposed`, `Plaintext_NVS_Risk`, `OTA_No_Rollback`, and `Corrupt_Or_Erased`, paired directly with **`ESPSecurityGrade (A–F)`** inside `esp_efuse_audit` and `esp_partitions_inspect`.

---

## 8. Interactive Labs: Test All 6 Domains in Your Browser

Explore bus timing, I2C pull-ups, and `BusPowerAE` in **Bus & Logic Lab**, or launch the dedicated **[ESP32-S3 Hardware & Protocol Lab →](#/esp32-s3-lab)** for `ESPBootCrashNet-1D`, `ESPPowerProfileNet-1D`, and strapping/PSRAM simulations:

```interactive:bus-logic-lab
```

---

## 9. Hot-Swap `.czml` Overrides & Opt-In MCP Verification

- **Hot-Swap Overrides (`~/.config/bus-studio/models/`)**: Drop custom SHA-256-verified `.czml v1` binaries onto CardputerZero without recompiling:
  - `~/.config/bus-studio/models/bus_signal_v1.czml` (Domain `23` — `BusSignalNet-1D`)
  - `~/.config/bus-studio/models/bus_stream_v1.czml` (Domain `24` — `BusStreamNet-1D`)
  - `~/.config/bus-studio/models/bus_power_ae_v1.czml` (Domain `25` — `BusPowerAE`)
  - `~/.config/bus-studio/models/esp_boot_crash_v1.czml` (Domain `26` — `ESPBootCrashNet-1D`)
  - `~/.config/bus-studio/models/esp_power_profile_v1.czml` (Domain `27` — `ESPPowerProfileNet-1D`)
  - `~/.config/bus-studio/models/esp_firmware_audit_v1.czml` (Domain `28` — `ESPFirmwareAuditNet-1D`)
  Corrupt digests or mismatched domain IDs automatically fall back to the compiled-in `//go:embed` weights.
- **Programmatic MCP Verification (`bus-studio --mcp`)**: Once **MCP Server** is enabled in Settings, AI agents over SSH can inspect and invoke the entire 6-model neural suite:
  - `bus_neural_suite` & `bus_status` — verify all 6 models (Domains `23–28`), versions, byte sizes, `total_byte_size`, override status, and SHA-256 digests.
  - `bus_logic_fingerprint`, `bus_uart_read_log`, `bus_spi_entropy_scan`, `bus_power_status` — Domains `23–25`.
  - `esp_crash_diagnose`, `esp_power_profile`, `esp_partitions_inspect`, `esp_efuse_audit` — Domains `26–28`.
