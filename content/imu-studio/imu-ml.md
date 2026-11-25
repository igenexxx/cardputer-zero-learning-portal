# On-Device IMU ML: 6-Model INT8 `.czml` Neural Suite (Domains `17–22`)

**IMU Studio `v0.3.0`** embeds a **6-model Pure-Go zero-allocation INT8 `.czml v1` Neural Suite** (`CGO_ENABLED=0`, **~48 KB total across Domains `17–22`**, **`0 B/op, 0 allocs/op`**, sub-millisecond inference on CardputerZero's ARM Cortex-A53). Every model is trained offline with **PyTorch Quantization-Aware Training (QAT)** using dynamic symmetric per-sample activation quantization (`DynActQ`), exported to SHA-256-verified `.czml v1` binaries, compiled in via `//go:embed`, and parity-verified against the Python INT8 reference (`max_abs_diff <= 1e-4`).

| Model | `.czml` Domain | Input Tensor | Architecture | Primary Task |
| --- | --- | --- | --- | --- |
| **`IMUVibNet-1D`** | Domain `17` (`v100`) | `[4×64]` `100 Hz` Triaxial FFT Spectrum + Envelope | Depthwise-Separable 1D-CNN + Dual Heads | Machinery & 3D-printer vibration health (10 classes) + **16D SupCon embedding** for `MachineProfile` drift |
| **`IMUTamperNet-1D`** | Domain `18` (`v100`) | `[6×32]` Rolling 6-Axis Linear-Accel + Gyro Window | Dilated 1D-TCN (`d = 1, 2, 4`) | Physical security & handling classification (`Still_Guarded`, `Footstep_Floor`, `Door_Vibration`, `Knock_Tap`, `Pickup_Theft`, `Drop_Shock`) |
| **`IMUMagAnomalyAE`** | Domain `19` (`v100`) | `[24]` Calibrated 3-Axis Magnetic Feature Vector | Symmetric INT8 Autoencoder (`24→36→18→8→18→36→24`) | Unsupervised hidden magnet / tracker / stud / AC wiring **`AnomalyZ >= 3.2σ`** + plain-English `FaultReason` |
| **`IMUTapNet-1D`** | Domain `20` (`v100`) | `[4×64]` Structural Impulse Ring-Down + `0–50 Hz` FFT + `BMM150` `ΔµT` | Depthwise-Separable 1D-CNN + Dual Heads | Dual-Modal Wall/Tank/Material Tap X-Ray (6 classes), **`Hollowness%`** estimation & **16D SupCon** custom surface embedding |
| **`IMUBioNet-1D`** | Domain `21` (`v100`) | `[4×64]` Bandpass Micro-Accel (`BCG`/`Tremor`/`IKI`) + Gyro Envelope | Dilated 1D-TCN (`d = 1, 2, 4`) | Non-medical contactless **BCG** pulse/breath quality, **`4–12 Hz` soldering tremor** steadiness & local desk keystroke vibration burst classification |
| **`IMUGestureNet-1D`** | Domain `22` (`v100`) | `[6×32]` Arc-Length-Resampled 3D Quaternion Trajectory + Angular Velocity | Depthwise-Separable 1D-CNN + Dual Heads | Speed-invariant 3D Air-Writing Magic Wand (8 built-in spells) + **16D SupCon embedding** for custom user spells (`GESTURE_MATCH`) |

---

## 1. Shared `.czml v1` Engine, QAT `DynActQ` & Zero-Allocation Go Kernels

All six models execute on `imu-studio`'s pure-Go INT8 inference engine (`imu-studio/internal/imuml/`), reusing the repository-wide **64-byte `.czml v1` container format** (`CZML` magic, domain/version IDs, SHA-256 weight digest, temperature/calibration scalars, and 18-byte layer descriptors):

- **Pure-Go INT8 Opcodes**: `OP_CONV1D (1)`, `OP_DEPTHWISE_CONV1D (2)`, `OP_POINTWISE_CONV1D (3)`, and `OP_LINEAR (4)` with BatchNorm folded directly into per-output-channel `int8` weights and `float32` biases.
- **Dynamic Symmetric Activation Quantization (`DynActQ`)**:
  $$s_x = \frac{\max_i |x_i|}{127.0}, \qquad q_x[i] = \text{round}\!\left(\text{clip}\!\left(\frac{x_i}{s_x}, -127, 127\right)\right)$$
  Matching `DynActQ` fake-quantization during PyTorch QAT with exact integer multiply-accumulate in Go preserves `<= 1e-4` numerical parity between desktop training and handheld ARM64 execution.
- **Zero-Allocation Real-Time Invariant**: Every forward pass writes intermediate feature maps into a caller-owned fixed-size workspace struct (`VibWorkspace`, `TamperWorkspace`, `MagAEWorkspace`, `TapWorkspace`, `BioWorkspace`, `GestureWorkspace`), verified by Go benchmarks (`for b.Loop()`) at **`0 B/op, 0 allocs/op`** so `100 Hz` vibration FFT, `STA/LTA` tamper sampling, tap capture, BCG filtering, and 3D wand recognition never stall on Go GC pauses.

---

## 2. `IMUVibNet-1D` (`.czml` Domain `17`) — Machinery Health & 16D SupCon Drift

Scalar RMS thresholds alone cannot distinguish a single-frequency unbalanced fan (`1× RPM` tonal peak) from broadband bearing spalling (elevated high-frequency floor + high crest factor) or a loose mounting bracket (sub-harmonics `0.5×`, `1.5×`, `2×`). **`IMUVibNet-1D`** inspects both spectral shape and impulse statistics simultaneously:

1. **Input Tensor (`[4×64]`)**: Normalized `0–50 Hz` log-magnitude FFT bins across `X`, `Y`, `Z`, and triaxial magnitude paired with velocity-weighted spectral energy and crest cues.
2. **Depthwise-Separable 1D-CNN Backbone (7 layers)**: `Conv1D(4→20, k=5, s=2)` → `DW/PW(20→28, s=2)` → `DW/PW(28→32, d=2)` → `Avg+Max Pool (64D)`.
3. **Dual Heads**:
   - **Head A (Temperature-Scaled Classification)**: Predicts **10 machinery & vibration classes** (`Quiet_Desk`, `Fan_Balanced`, `Fan_Imbalance`, `Motor_Bearing_Wear`, `3DPrinter_Resonance`, `Compressor_Pump`, `Vehicle_Idle`, `Vehicle_Rough_Road`, `Human_Walking`, `Impact_Knock`).
   - **Head B (16D SupCon Embedding)**: Projects the vibration signature onto the unit hypersphere $S^{15}$. Saved **`MachineProfile`** baselines store this 16D vector alongside velocity RMS so rising cosine distance + velocity drift triggers **`VIB_FAULT`** early.

---

## 3. `IMUTamperNet-1D` (`.czml` Domain `18`) — Dilated 1D-TCN Tamper Classifier

Simple acceleration thresholds on a desk alarm constantly misfire whenever someone walks across the floor, shuts a nearby door, or types nearby. **`IMUTamperNet-1D`** runs a **7-layer dilated 1D Temporal Convolutional Network (`d = 1, 2`)** over rolling **`[6×32]`** 6-axis `BMI270` windows (`linear ax/ay/az`, `gx/gy/gz` at `20 Hz` = `1.6 s` context):

- **Multi-Scale Receptive Field**: Resolves millisecond impulse transients (`Knock_Tap`, `Drop_Shock`), `0.3–0.8 s` rotation + vertical lift (`Pickup_Theft`), and multi-second structural waves (`Footstep_Floor`, `Door_Vibration`, `Still_Guarded`).
- **False-Alarm Suppression**: `Desk Tamper Guard` fuses `STALTADetector` ratios with `IMUTamperNet-1D` so benign floor vibrations classify as `Footstep_Floor`, whereas lifting or jostling the laptop fires an immediate silent **`TAMPER_ALERT`**.

---

## 4. `IMUMagAnomalyAE` (`.czml` Domain `19`) — Unsupervised Magnetic Anomaly Autoencoder

Hidden neodymium magnets, magnetic GPS trackers, steel wall studs, and energized AC power cables distort Earth's geomagnetic field in diverse, unpredictable ways. **`IMUMagAnomalyAE`** learns the compact manifold of **clean geomagnetic backgrounds** (`25–65 µT`) using a **6-layer symmetric INT8 Autoencoder** (`24→36→18→8→18→36→24`):

- **Input Feature Manifold (`[24]float32`)**: Calibrated total field deviation `Δ|B|` (`µT`), magnetic inclination (dip) shift `Δdip`, spatial/temporal gradient `d|B|/dt`, orthogonal axis imbalance, and `50/60 Hz` AC ripple energy.
- **Calibrated Z-Score Gate (`AnomalyZ >= 3.2σ`)**:
  $$\text{MSE} = \frac{1}{24}\sum_{i=0}^{23}(x_i - \hat{x}_i)^2, \qquad \text{AnomalyZ} = \frac{\text{MSE} - \mu_{\text{mse}}}{\max(\sigma_{\text{mse}}, 10^{-4})}$$
  Exceeding **`3.2σ`** raises **`MAG_ANOMALY`** and maps the peak residual group to a plain-English **`FaultReason`** (`Ferrous metal / stud / rebar`, `Permanent magnet / speaker / tracker`, `AC power wire / coil ripple`, or `Compass distortion / uncalibrated field`).

---

## 5. `IMUTapNet-1D` (`.czml` Domain `20`) — Dual-Modal Wall & Material Tap X-Ray

Distinguishing hollow drywall, solid masonry, wood studs, steel studs/pipes, empty tanks, and loose tiles requires jointly examining **how fast an impact rings down** and **whether ferrous mass sits behind the surface**:

1. **Input Tensor (`[4×64]`)**:
   - **Ch 0**: Normalized `0.64 s` (`64` samples @ `100 Hz`) post-impact normal-axis ring-down waveform from `TapCaptureBuffer`.
   - **Ch 1**: Log-magnitude `0–50 Hz` panel resonance spectrum highlighting low-frequency flexural drum modes (`18–42 Hz`).
   - **Ch 2**: Instantaneous Hilbert/RMS decay envelope capturing exponential time constant **`τ`** and secondary rattle spikes (`Loose_Joint`).
   - **Ch 3**: Paired calibrated `BMM150` magnetic stud delta (`ΔµT` + gradient) fused across the capture window.
2. **Architecture (7-layer Depthwise-Separable 1D-CNN + Dual Heads, `~9 KB` INT8)**:
   - `Conv1D(4→20, k=5, s=2)` → `DW/PW(20→28, s=2)` → `DW/PW(28→32, d=2)` → `Avg+Max Pool (64D)` → Dual Linear Heads.
3. **Dual Outputs**:
   - **Head A (Classification + `Hollowness%`)**: Predicts **6 structural classes** — `Solid_Concrete`, `Hollow_Drywall`, `Wood_Stud`, `Metal_Stud_Pipe`, `Empty_Tank_Drum`, and `Loose_Joint` — paired with continuous `Hollowness%` (`0–100%`) and `τ (ms)`.
   - **Head B (16D SupCon Surface Embedding)**: Enables **`imu_tap_inspect enroll|compare`** so users can enroll any reference surface (e.g., `Full_Tank` vs. `Empty_Tank`, `Good_Tile` vs. `Hollow_Tile`) and compare new taps via cosine similarity.

---

## 6. `IMUBioNet-1D` (`.czml` Domain `21`) — Micro-Motion BCG, Soldering Tremor & Keystroke Side-Channel

> [!WARNING]
> **Non-Medical Educational Invariant**: `IMUBioNet-1D` is strictly an educational/experimental micro-motion physics classifier — never a clinical diagnostic model — and its desk side-channel mode strictly classifies local vibration burst energy without decoding typed text.

1. **Input Tensor (`[4×64]`)**:
   - **Ch 0**: `0.7–3.0 Hz` bandpass micro-acceleration (`3–15 mg` cardiac BCG recoil envelope).
   - **Ch 1**: `0.15–0.5 Hz` low-pass respiratory chest/surface motion trace.
   - **Ch 2**: `4–12 Hz` physiological hand-tremor bandpass accelerometer + gyroscope RMS envelope.
   - **Ch 3**: High-pass flexural jerk channel capturing desk keystroke impulse density and `IKI` bursts.
2. **Architecture (7-layer Dilated 1D-TCN, `~8 KB` INT8)**:
   - `Conv1D(4→20, k=5, s=2)` → `DW/PW(20→28, d=1)` → `DW/PW(28→32, d=2)` → `DW/PW(32→32, d=4)` → `Avg+Max Pool (64D)` → `Linear(64→24)` → `Linear(24→6)`.
3. **Outputs**: Classifies micro-motion regimes (`BCG_Clean_Pulse`, `BCG_Motion_Artifact`, `Hand_Steady_Soldering`, `Hand_Elevated_Tremor`, `Desk_Typing_Burst`, `Quiet_Rest`) to gate reliable BCG BPM/BrPM readouts, grade soldering steadiness (`0–100`), and highlight local keystroke timing bursts in **`imu_bio_assess`**.

---

## 7. `IMUGestureNet-1D` (`.czml` Domain `22`) — Speed-Invariant 3D Air-Writing Magic Wand

Raw time-indexed hand gestures break down whenever a user waves faster or slower. **`IMUGestureNet-1D`** consumes the **arc-length-resampled `[6×32]` 3D trajectory** produced by **`StrokeRecorder`**:

1. **Input Tensor (`[6×32]`)**:
   - **Ch 0–2**: Centroid-centered, RMS-normalized 3D world-frame coordinates `(x, y, z)` resampled at `32` equidistant arc-length steps.
   - **Ch 3–5**: Normalized unit tangent direction & angular-rate curvature `(dx/ds, dy/ds, ω_norm)` preserving clockwise vs. counter-clockwise winding (`Circle_CW` vs. `Circle_CCW`) and sharp corners (`Z_Slash`, `Checkmark`, `Triangle`).
2. **Architecture (7-layer Depthwise-Separable 1D-CNN + Dual Heads, `~9 KB` INT8)**:
   - `Conv1D(6→24, k=3, s=1)` → `DW/PW(24→32, s=2)` → `DW/PW(32→32, d=2)` → `Avg+Max Pool (64D)` → Dual Linear Heads.
3. **Dual Outputs**:
   - **Head A (8 Built-In Spells)**: `Circle_CW`, `Circle_CCW`, `Figure_8`, `Z_Slash`, `Checkmark`, `Triangle`, `Up_Flick`, `Down_Flick`.
   - **Head B (16D SupCon Spell Embedding)**: Lets users enroll arbitrary custom 3D spells (`imu_gesture_assess enroll` or UI `5 ENROLL`) and match them via L2-normalized cosine similarity, publishing **`GESTURE_MATCH`** (`imu_gesture`) on `StudioEventBus` for `radio-bridge`.

---

## 8. Interactive Lab: Test All 6 Models Across 4 Tabs

Open **Tab 2 (`100 Hz Vibration FFT`)** to test `IMUVibNet-1D`, **Tab 3 (`Magnetics & Tamper`)** for `IMUMagAnomalyAE` & `IMUTamperNet-1D`, or **Tab 4 (`Tap X-Ray & 3D Wand`)** to experiment with structural ring-down decay curves (`IMUTapNet-1D`) and speed-invariant 3D Magic Wand strokes (`IMUGestureNet-1D`):

```interactive:imu-sensor-lab
```

---

## 9. Hot-Swap `.czml` Model Overrides & Opt-In MCP Verification

- **Hot-Swap Overrides (`~/.config/imu-studio/models/`)**: Drop custom SHA-256-verified `.czml v1` binaries onto CardputerZero without recompiling:
  - `~/.config/imu-studio/models/imu_vib_v1.czml` (Domain `17` — `IMUVibNet-1D`)
  - `~/.config/imu-studio/models/imu_tamper_v1.czml` (Domain `18` — `IMUTamperNet-1D`)
  - `~/.config/imu-studio/models/imu_mag_ae_v1.czml` (Domain `19` — `IMUMagAnomalyAE`)
  - `~/.config/imu-studio/models/imu_tap_v1.czml` (Domain `20` — `IMUTapNet-1D`)
  - `~/.config/imu-studio/models/imu_bio_v1.czml` (Domain `21` — `IMUBioNet-1D`)
  - `~/.config/imu-studio/models/imu_gesture_v1.czml` (Domain `22` — `IMUGestureNet-1D`)
  Every override is SHA-256 validated on startup; corrupt or mismatched-domain files automatically fall back to the compiled-in `//go:embed` weights.
- **Programmatic MCP Inspection (`imu-studio --mcp`)**: Once **MCP Server** is enabled in Settings, AI agents over SSH can verify model hashes and query all six neural models directly:
  - `imu_neural_suite` & `imu_status` — report domain IDs (`17–22`), versions, byte sizes, override state, class labels, and SHA-256 digests for all 6 `.czml` models.
  - `imu_vib_snapshot` & `imu_machines_compare` — return `VibMetrics`, `ISO10816Grade`, `IMUVibNet-1D` class probabilities, 16D SupCon embedding, and machine drift scores.
  - `imu_tamper_status` — returns live `STA/LTA` ratio and `IMUTamperNet-1D` physical event probabilities.
  - `imu_mag_scan` — returns calibrated `|B|`, `ΔµT`, dip angle, AC ripple, and `IMUMagAnomalyAE` `AnomalyZ` + `fault_reason`.
  - `imu_tap_inspect` — runs Dual-Modal Wall/Material Tap X-Ray (`IMUTapNet-1D` class, `Hollowness%`, `τ`, `BMM150` stud fusion, custom surface enroll/compare).
  - `imu_bio_assess` — queries non-medical `IMUBioNet-1D` BCG pulse/breath, `4–12 Hz` hand-steadiness, or local desk keystroke timing-entropy metrics.
  - `imu_gesture_assess` — captures, classifies, and enrolls 3D Air-Writing Magic Wand spells via `IMUGestureNet-1D` + 16D SupCon matching.
