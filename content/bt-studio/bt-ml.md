# On-Device Bluetooth ML: 4-Model INT8 `.czml` Neural Suite

**BT Studio `v0.4.0`** embeds a complete **4-model Pure-Go zero-allocation INT8 `.czml v1` Neural Suite** (`~112 KB` total flash, **`< 0.5 ms`** combined inference on CardputerZero's ARM Cortex-A53, **`0 B/op, 0 allocs/op`**, `CGO_ENABLED=0`). Every model is trained offline on Google Colab NVIDIA L4 GPU with **PyTorch Quantization-Aware Training (QAT)** and verified bit-for-bit against a NumPy INT8 reference evaluator (`max_abs_diff <= 1e-4`).

| Model | `.czml` Domain | Flash (INT8) | Input Tensor | Primary Task |
| --- | --- | --- | --- | --- |
| **`BTDeviceNet v2`** | Domain `10` (`v200`) | `~38 KB` | Raw AD `[3×32]` + Tabular `[32]` | 18-class device taxonomy + 16D SupCon RPA embedding |
| **`BLEPayloadNet-1D`** | Domain `11` (`v100`) | `~32 KB` | Byte-diff stats `[10×32]` | 9 per-byte protocol roles + 6 stream archetypes |
| **`BTSeqNet-1D`** | Domain `12` (`v100`) | `~26 KB` | 64 s trajectory `[8×32]` | 6 temporal behaviors + calibrated `StalkRisk` |
| **`BTAnomalyAE`** | Domain `13` (`v100`) | `~16 KB` | Device features `[32]` | Unsupervised Evil-Twin / spoof Z-score + `FaultReason` |

---

## 1. Shared `.czml v1` Runtime, QAT & Bit-Exact Go ↔ Python Parity

All four models execute on a single pure-Go INT8 engine (`bt-studio/internal/btml/czml_loader.go` + `ops_conv1d.go`) sharing the canonical 64-byte `.czml v1` container format (`CZML` magic, SHA-256 payload digest, Softmax/AE calibration scalars, and 18-byte layer descriptors):

- **Supported INT8 Opcodes**:
  - `OP_CONV1D (1)` — standard 1D convolution `[oc, ic, k]` with padding and dilation.
  - `OP_DEPTHWISE_CONV1D (2)` — per-channel depthwise 1D convolution `[oc, 1, k]`.
  - `OP_POINTWISE_CONV1D (3)` — `1×1` pointwise channel mixer `[oc, ic, 1]`.
  - `OP_LINEAR (4)` — dense fully-connected layer `[oc, ic]`.
- **Dynamic Per-Sample INT8 Quantization (`DynActQ`)**: During both QAT fine-tuning in PyTorch and runtime execution in Go, activations are symmetrically quantized per sample (`scale = maxAbs / 127.0`), multiplied against per-output-channel `int8` weights with folded BatchNorm scales/biases, and clamped with `ReLU6`. This guarantees **`<= 1e-4`** numerical parity across all exported `*_parity.json` test fixtures.
- **Zero-Allocation Hot Path Invariant**: Every model runs inside a caller-owned fixed-size workspace struct (`DeviceWorkspace`, `PayloadWorkspace`, `SeqWorkspace`, `AnomalyWorkspace`) — verified in Go benchmarks at **`0 B/op, 0 allocs/op`** so real-time `DuplicateData` scanning never triggers garbage-collection pauses on CardputerZero.
- **Hot-Swap Model Overrides**: Models are compiled in via `//go:embed`, but dropping a verified custom `.czml` file into `~/.config/bt-studio/models/` (`bt_device_v2.czml`, `bt_payload_v1.czml`, `bt_seq_v1.czml`, `bt_anomaly_ae_v1.czml`) overrides the embedded weights automatically after SHA-256 verification (with safe fallback on corruption or mismatch).

---

## 2. `BTDeviceNet v2` (`.czml` Domain `10` v200) — Raw-Byte + Tabular Fusion

Anonymous BLE peripherals frequently omit `LocalName` and rotate their MAC address every 15 minutes (RPA). While `v100` relied purely on summary features, **`BTDeviceNet v2`** fuses **raw 31-byte advertisement framing** directly with tabular RF statistics:

1. **Raw-Byte AD Branch (`[3 × 32]` 1D-CNN)**:
   - `ch 0`: Normalized raw payload bytes (`byte_val / 255.0`).
   - `ch 1`: `valid_mask` (`1.0` for real bytes, `0.0` for zero padding).
   - `ch 2`: `section_tag` (`0.25` = AD header/flags, `0.60` = Manufacturer Data `0xFF`, `1.0` = Service Data `0x16`).
   - Topology: `Conv1D(3→24, k=3)` → `DWConv1D(24, k=3)` → `PWConv1D(24→32)` → `AvgMaxPool(32→64)`.
2. **Tabular RF Branch (`[32]float32`)**:
   - Address type, transport, payload length/entropy, advertising cadence, RSSI variance, Company/UUID hints, and burst rate → `Linear(32→48, ReLU6)`.
3. **Fusion & Dual Heads**:
   - `Concat(64, 48 → 112)` → `Linear(112→48, ReLU6)` branching into:
     - **Head 1 (`Linear(48→16)` + L2-Norm)**: **16D SupCon Embedding** on the unit hypersphere $S^{15}$ for cross-MAC RPA correlation inside `TrackerGuard`.
     - **Head 2 (`Linear(48→18)` + Temperature Scaling)**: **18 fine-grained classes**, expanding `v100`'s 14 classes with **`Apple_Watch` (`[WCH]`)**, **`Smart_Lock_Access` (`[LOC]`)**, **`ESP32_nRF_DevBoard` (`[DEV]`)**, and **`Flipper_Research_Tool` (`[LAB]`)**.
4. **Backwards Compatibility**: `LoadBTDeviceNet` natively loads `v200` (8-layer fusion) and gracefully falls back to `v100` (5-layer MLP) if a user supplies a legacy `.czml` override.

---

## 3. `BLEPayloadNet-1D` (`.czml` Domain `11`) — Per-Byte Protocol Segmentation

Rule-based byte diffing (`InferByteFields`) quickly spots static headers and single-bit buttons, but struggles to tell apart **16-bit little-endian sensor pairs (`INT16_LE`)**, **trailing `CRC-8` checksums**, and **AES-CTR encrypted frames**. **`BLEPayloadNet-1D`** runs directly on `ByteDiffTracker`'s 64-packet ring (`>= 4` frames) to segment every byte offset simultaneously:

### `[10 × 32]` Zero-Alloc Feature Tensor (per byte offset `i ∈ 0..31`)
| Ch | Feature | What It Captures |
| --- | --- | --- |
| `0` | `present_mask` | Active payload length vs. padding |
| `1` | `mean(x_i) / 255` | Low boolean flags/counters vs. printable ASCII (`0x20..0x7E`) |
| `2` | `(max_i - min_i) / 255` | Dynamic value range across captured notifications |
| `3` | `change_rate_i` | Static frame headers (`0.0`) vs. continuous telemetry (`1.0`) |
| `4` | `popcount(xor_union_i) / 8` | Single-bit button toggles (`0.125`) vs. full-byte entropy (`~1.0`) |
| `5` | `mono_step_ratio_i` | Monotonic `+1 / -1 mod 256` sequence counters |
| `6` | `ascii_ratio_i` | Printable ASCII text fraction (`0x20..0x7E`, `\r`, `\n`) |
| `7` | `shannon_entropy_norm_i` | High normalized Shannon entropy (`> 0.85`) signaling CRC/nonce/AES |
| `8` | `corr_prev_i` | Carry/delta correlation with byte `i-1` (separates `INT16_LE` vs `INT16_BE`) |
| `9` | `corr_next_i` + trailing flag | Carry/delta correlation with byte `i+1` and trailing `CRC-8` / XOR detection |

### Dual-Head Segmentation & Archetype Architecture
- **Backbone (9 layers, `~31 KB` INT8)**: `Conv1D(10→32, k=3)` followed by three Depthwise-Separable blocks (`32→48`, dilated `d=2` `48→48`, `48→32`), giving each byte a receptive field wide enough to see neighboring LSB/MSB pairs and frame boundaries.
- **Head A (Per-Byte Segmentation, `PWConv1D(32→9)`)**: Assigns each offset one of **9 roles**: `PAD`, `HDR_STATIC`, `SEQ_CTR` (green), `BTN_FLAG` (amber/red), `UINT8_VAL`, `INT16_LE` (cyan), `INT16_BE` (cyan), `ASCII_TXT`, and `CRC_OR_ENC` (magenta).
- **Head B (Stream Archetype, `AvgMaxPool(32→64)` → `Linear(64→6)`)**: Classifies the overall notification stream into `Plaintext_Sensor`, `Button_Control`, `IMU_MultiAxis`, `ASCII_Serial`, `Checksummed_Frame`, or `Encrypted_Random` (flagging `EncryptedSuspect` when random ciphertext dominates).

---

## 4. `BTSeqNet-1D` (`.czml` Domain `12`) — Temporal Anti-Stalking & Crowd Churn

A major limitation of simple duration-based tracker alerts is **stationary false positives**: your neighbor's AirTag or a coworker's Tile stays visible for hours while you sit at home or in a café. **`BTSeqNet-1D`** solves this by analyzing **64-second rolling trajectories** (`32` two-second buckets) combining target RF physics with **ambient crowd churn**:

- **Input Tensor `[8 × 32]`** (per 2-second bucket `t`):
  1. `rssi_norm` — normalized proximity envelope `(rssi + 100) / 70`.
  2. `drssi_norm` — approach / recede velocity `clamp((drssi + 25) / 50)`.
  3. `adv_interval_norm` — advertising cadence `ms / 2000`.
  4. `jitter_ratio` — real quartz-crystal stability vs. software spoofing jitter.
  5. `rpa_rotated` — binary flag when a MAC rotation event occurs.
  6. **`bg_crowd_churn`** — Jaccard turnover (`0..1`) of *other* ambient MAC addresses around you. **High ambient crowd churn while the target persists at steady proximity is the physical signature of a `Co_Moving_Tracker`!**
  7. `new_mac_rate_norm` — ambient advertising flood rate (`pps / 20`).
  8. `continuity_rate_norm` — Apple Continuity / Fast Pair / Swift Pair spam burst rate.
- **Dilated 1D-TCN Backbone (8 layers, `~25 KB` INT8)**: `Conv1D(8→32, d=1)` → `DW/PW(32→48, d=2)` → `DW/PW(48→48, d=4)` → `AvgMaxPool(48→96)` → `Linear(96→32)`:
  - **Head A (`Linear(32→6)`)**: `Stationary_Ambient`, `Passing_By`, `Co_Moving_Tracker`, `BLE_Spam_Flood`, `Beacon_Spoof_Anomaly`, `Active_Prober`.
  - **Head B (`Linear(32→1)` + Sigmoid)**: Calibrated continuous **`StalkRisk ∈ [0, 1]`**, surfaced in Tracker Guard as `CO-MOVING 91%` (red), `STATIONARY` (emerald), or `SPOOF ANOM` (amber).

---

## 5. `BTAnomalyAE` (`.czml` Domain `13`) — Unsupervised Evil-Twin Detection

What if an attacker clones a benign device's name, Company ID, or beacon UUID using a software radio or microcontroller? Supervised classifiers may still label the clone as `Earbuds_Audio` or `Beacon_Static`, because the static identifiers match. **`BTAnomalyAE`** catches these **Evil-Twin / Spoofed Clones** without needing labeled attack examples:

- **Symmetric INT8 Autoencoder (`6` `OP_LINEAR` layers, `~15 KB`)**:
  - **Encoder**: `32 → 48 (ReLU6) → 24 (ReLU6) → 12 (ReLU6)` bottleneck (`2.67×` compression over the `[32]float32` device feature manifold).
  - **Decoder**: `12 → 24 (ReLU6) → 48 (ReLU6) → 32 (None)` reconstructing the expected benign feature profile $\hat{\mathbf{x}}$.
- **Calibrated Z-Score Scoring**:
  - Benign validation reconstruction error statistics ($\mu_{\text{mse}}, \sigma_{\text{mse}}$) are stored directly inside the `.czml` header (`TempFine`, `TempCoarse`).
  - At runtime:
    $$\text{MSE} = \frac{1}{32}\sum_{i=0}^{31}(x_i - \hat{x}_i)^2, \qquad \text{AnomalyZ} = \frac{\text{MSE} - \mu_{\text{mse}}}{\max(\sigma_{\text{mse}}, 10^{-4})}$$
  - Devices crossing **`AnomalyZ >= 3.2σ`** receive a red **`[ANOM]`** tag on Radar and a plain-English **`FaultReason`** inside Device Inspector derived from $\arg\max_i (x_i - \hat{x}_i)^2$:
    - `Timing/Jitter mismatch` (software-scheduled spoofing vs. hardware BLE controller clock)
    - `TX/RSSI mismatch` (declared `TxPower` contradicts physical received signal envelope)
    - `AD Payload anomaly` (malformed TLV lengths, abnormal entropy, or truncated AD structures)
    - `Vendor/UUID mismatch` (inconsistent Company ID, Service UUID, and address type)

---

## 6. Interactive Neural Byte-Tagger & Evil-Twin Anomaly Lab

Test **`BLEPayloadNet-1D`** per-byte protocol segmentation (`HeartRate + CRC8`, `6-Axis IMU (INT16_LE)`, `Encrypted AES-CTR`, `Button Remote`) and **`BTAnomalyAE`** Evil-Twin Z-score fault attribution directly in your browser below:

```interactive:bt-ble-lab
```

---

## 7. Programmatic Verification via Opt-In MCP (`v0.4.0`, 31 Tools)

When **MCP Server (`--mcp`)** is explicitly enabled in `bt-studio` Settings, AI agents can inspect model hashes and invoke all 4 neural models directly over SSH:

- **`bt_status`**: Returns loaded `.czml` metadata, domain IDs, versions, override status, and SHA-256 digests for all 4 models.
- **`bt_payload_analyze`**: Runs `BLEPayloadNet-1D` on custom `samples_hex` or the live GATT Notify buffer, returning per-byte roles, archetype, `encrypted_suspect`, and `has_checksum`.
- **`bt_seq_assess`**: Runs `BTSeqNet-1D` on a tracked device or global airspace, returning behavior class, confidence, and calibrated `stalk_risk`.
- **`bt_anomaly_scan`**: Scans all visible Radar devices with `BTAnomalyAE` (`min_z`, default `3.2`), reporting anomalous Evil-Twin candidates and their `fault_reason`.
