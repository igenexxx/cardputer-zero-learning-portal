# On-Device Wi-Fi ML: 3-Model INT8 `.czml` Neural Suite

**WiFi Studio `v0.1.0`** embeds a **3-model Pure-Go zero-allocation INT8 `.czml v1` Neural Suite** (`CGO_ENABLED=0`, **`0 B/op, 0 allocs/op`**, sub-millisecond inference on CardputerZero's ARM Cortex-A53). Every model is trained offline with **PyTorch Quantization-Aware Training (QAT)** using dynamic symmetric per-sample activation quantization (`DynActQ`), exported to SHA-256-verified `.czml v1` binaries, embedded via `//go:embed`, and parity-verified against the Python INT8 reference (`max_abs_diff <= 1e-4`).

| Model | `.czml` Domain | Input Tensor | Architecture | Primary Task |
| --- | --- | --- | --- | --- |
| **`WiFiAPNet-1D`** | Domain `14` (`v100`) | Raw IE Sequence + Tabular AP Vector | Raw-IE 1D-CNN + Tabular Fusion + Dual Heads | Fine-grained 2.4 GHz AP hardware/ecosystem classification + **16D SupCon embedding** |
| **`WiFiMotionNet-1D`** | Domain `15` (`v100`) | 10 Hz Rolling Multipath Trajectory (`6.4 s`) | Dilated 1D-TCN (`d = 1, 2, 4`) | Through-wall **`MotionTripwire`** (`Still_Room`, `Human_Walk`, `Door_Event`, `RF_Interference`) |
| **`WiFiThreatAE`** | Domain `16` (`v100`) | Normalized AP IE/RF Feature Vector | Unsupervised Symmetric INT8 Autoencoder | Calibrated Evil-Twin / rogue SoftAP **`AnomalyZ >= 3.2σ`** + per-feature `FaultReason` |

---

## 1. Shared `.czml v1` Engine, QAT `DynActQ` & Zero-Allocation Go Kernels

All three models execute on `wifi-studio`'s pure-Go INT8 engine (`wifi-studio/internal/wifiml/`), sharing the repository-wide **64-byte `.czml v1` container format** (`CZML` magic, domain/version IDs, SHA-256 weight digest, calibration scalars, and 18-byte layer descriptors):

- **Pure-Go INT8 Opcodes**: `OP_CONV1D (1)`, `OP_DEPTHWISE_CONV1D (2)`, `OP_POINTWISE_CONV1D (3)`, and `OP_LINEAR (4)` with BatchNorm folded directly into per-output-channel `int8` weights and `float32` biases.
- **Dynamic Symmetric Activation Quantization (`DynActQ`)**:
  $$s_x = \frac{\max_i |x_i|}{127.0}, \qquad q_x[i] = \text{round}\!\left(\text{clip}\!\left(\frac{x_i}{s_x}, -127, 127\right)\right)$$
  Applying identical `DynActQ` fake-quantization during PyTorch QAT and exact integer multiply-accumulate in Go guarantees bit-consistent parity (`<= 1e-4`) between desktop training and handheld ARM64 execution.
- **Zero-Allocation Hot Path Invariant**: Every forward pass writes intermediate activations into a caller-owned fixed-size workspace struct (`APWorkspace`, `MotionWorkspace`, `ThreatWorkspace`), verified by Go benchmarks (`for b.Loop()`) at **`0 B/op, 0 allocs/op`** so continuous `wpa_supplicant1` scans and `10 Hz` motion polling never trigger GC pauses.

---

## 2. `WiFiAPNet-1D` (`.czml` Domain `14`) — Raw-IE 1D-CNN + Tabular Fusion

Vendor OUI lookups alone fail whenever an AP randomizes its MAC, spoofs an OUI (`hostapd`), or broadcasts a generic SSID. **`WiFiAPNet-1D`** fuses the **ordered 802.11 Beacon IE tag sequence** directly with RF and security metadata:

1. **Raw-IE Sequence Branch (1D-CNN)**:
   - Encodes ordered Information Element Tag IDs, normalized element lengths, and vendor/extension indicators into a fixed-length multi-channel sequence tensor.
   - `Conv1D` → `Depthwise/Pointwise Conv1D` → `AvgMaxPool` extracts structural firmware motifs (e.g., Enterprise `802.11k/v/r` IE chains vs. minimal Espressif/Tuya SoftAP stacks vs. Linux `nl80211`/`hostapd` ordering).
2. **Tabular RF & Security Branch (`OP_LINEAR`)**:
   - Ingests normalized RSSI, channel number (`1–13`), RSN/WPA3/PMF/WPS bitflags, BSS Load station count & airtime, HT MIMO width, beacon interval, and OUI category hints.
3. **Fusion & Dual Heads**:
   - Concatenates pooled IE features with tabular embeddings through a fused `ReLU6` projection into:
     - **Head A (Classification + Temperature Scaling)**: Predicts fine-grained AP archetypes (`Enterprise_AP`, `Consumer_Router`, `Mesh_Node`, `Mobile_Hotspot`, `IoT_ESP_SoftAP`, `Hidden_IP_Cam`, `Rogue_Hostapd`, `Printer_Appliance`).
     - **Head B (16D SupCon Embedding)**: Outputs an L2-normalized vector on the unit hypersphere $S^{15}$ enabling cosine similarity matching across BSSIDs, multi-SSID virtual APs, and Evil-Twin investigations.

---

## 3. `WiFiMotionNet-1D` (`.czml` Domain `15`) — 10 Hz Dilated 1D-TCN

Thresholding raw RSSI variance alone confuses a passing person with a kitchen microwave oven or a door slamming shut. **`WiFiMotionNet-1D`** operates on a **6.4-second rolling window** (`64` samples at `10 Hz`) combining multipath amplitude physics with MAC-layer retry telemetry:

- **Input Trajectory Channels (per `100 ms` bucket)**:
  - Demeaned multipath RSSI residual (`rssi - ewma_mean`)
  - First-order RSSI velocity (`Δrssi`) and short-window rolling variance
  - MAC-layer TX retry rate & retry delta (separating broadband 2.45 GHz `RF_Interference` spikes from human Fresnel-zone fading!)
  - Link quality & bitrate modulation downshift indicator
- **Dilated Temporal Convolutional Backbone (`d = 1, 2, 4`)**:
  - `Conv1D (d=1)` captures fast `100–300 ms` transient edges (microwave pulses and door slams).
  - `DW/PW Conv1D (d=2)` captures `~0.5–1.5 s` human walking cadence (0.8–2.0 Hz gait envelope).
  - `DW/PW Conv1D (d=4)` aggregates full multi-second room context before `AvgMaxPool` → `Linear` softmax over **4 states**:
    - **`Still_Room`** (emerald) — nominal thermal noise floor
    - **`Human_Walk`** (amber) — rhythmic Fresnel multipath modulation (`MOTION_DETECTED`)
    - **`Door_Event`** (cyan) — sharp step-change multipath reflection
    - **`RF_Interference`** (magenta) — non-human 2.4 GHz microwave/Bluetooth burst with elevated TX retries

---

## 4. `WiFiThreatAE` (`.czml` Domain `16`) — Unsupervised Evil-Twin Autoencoder

Novel Evil-Twin toolkits, custom Wi-Fi Pineapples, and misconfigured captive-portal clones may never appear identically in supervised training sets. **`WiFiThreatAE`** models the manifold of **legitimate** 2.4 GHz Access Points using an unsupervised **symmetric INT8 Autoencoder**:

- **Bottleneck Topology**: `Input → Hidden → Bottleneck → Hidden → Output` (`OP_LINEAR` + `ReLU6` encoder/decoder) trained exclusively on benign consumer, enterprise, mesh, and hotspot beacons so out-of-distribution clones incur high reconstruction error.
- **Calibrated Z-Score Gate (`AnomalyZ >= 3.2σ`)**:
  - Calibration statistics ($\mu_{\text{mse}}, \sigma_{\text{mse}}$) are stored directly in the `.czml` header:
    $$\text{MSE} = \frac{1}{D}\sum_{i=0}^{D-1}(x_i - \hat{x}_i)^2, \qquad \text{AnomalyZ} = \frac{\text{MSE} - \mu_{\text{mse}}}{\max(\sigma_{\text{mse}}, 10^{-4})}$$
  - APs exceeding **`3.2σ`** receive a red **`[ANOM]`** badge on Radar, trigger WIDS **`EVIL_TWIN`** events, and attribute the peak squared error term $\arg\max_i (x_i - \hat{x}_i)^2$ to a plain-English **`FaultReason`**:
    - `IE Structure Drift (Hash mismatch)`
    - `Security Downgrade (RSN/PMF stripped)`
    - `Beacon Timing / OUI Anomaly`
    - `Rogue SoftAP / Minimal IE Footprint`

---

## 5. Interactive Lab: Test `WiFiThreatAE` & `WiFiMotionNet-1D` Live

Switch to **Tab 2 (`Beacon IE & Grade A–F`)** below to perturb IE drift, security downgrade, and beacon jitter sliders against the `3.2σ` `WiFiThreatAE` gate — or open **Tab 3 (`Motion Tripwire`)** to inject `Human Walking`, `Door Event`, and `Microwave RF Burst` waveforms into `WiFiMotionNet-1D`:

```interactive:wifi-rf-lab
```

---

## 6. Hot-Swap `.czml` Model Overrides & Opt-In MCP Verification

- **Hot-Swap Overrides (`~/.config/wifi-studio/models/`)**: Drop custom SHA-256-verified `.czml v1` files onto CardputerZero without recompiling:
  - `~/.config/wifi-studio/models/wifi_ap_v1.czml` (Domain `14`)
  - `~/.config/wifi-studio/models/wifi_motion_v1.czml` (Domain `15`)
  - `~/.config/wifi-studio/models/wifi_threat_ae_v1.czml` (Domain `16`)
  Every override is SHA-256 checked on startup; corrupt or wrong-domain files automatically fall back to the compiled-in `//go:embed` weights.
- **Programmatic MCP Inspection (`wifi-studio --mcp`)**: Once **MCP Server** is enabled in Settings, AI agents over SSH can verify model hashes and query all three models directly:
  - `wifi_status` — reports domain IDs, versions, override state, and SHA-256 digests for all 3 `.czml` models.
  - `wifi_ap_classify` — returns `WiFiAPNet-1D` class probabilities and 16D SupCon embedding for any BSSID.
  - `wifi_motion_assess` — returns live 10 Hz `MotionTripwire` Fresnel variance and `WiFiMotionNet-1D` state probabilities.
  - `wifi_threat_scan` — runs `WiFiThreatAE` across all visible APs (`min_z`, default `3.2`) returning Evil-Twin / rogue AP suspects and `fault_reason`.
