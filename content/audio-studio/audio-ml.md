# On-Device Audio ML: SoundNet-2D, AnomalyAE-2D & Few-Shot 32D

Audio Studio runs **two embedded INT8 `.czml v1` neural models** trained on Google Colab GPU alongside an online statistical baseline — all in pure Go (`CGO_ENABLED=0`, `0 allocs/op`, SHA-256 verified, bit-exact with Python INT8 reference within `<= 1e-5`).

---

## 1. `SoundNet-2D` (`.czml` Domain `7`)

`SoundNet-2D` classifies everyday, environmental, safety, and electronic sounds in ~9 ms on Cortex-A53 while simultaneously outputting a **32D metric embedding** for on-device Few-Shot learning.

- **Input Tensor (`[2 × 32 × 48]`)**:
  - **Channel 0 (`Calibrated Log-Mel`)**: `32` HTK Mel bands (`60–7800 Hz`) across `48` hop-256 frames (`0.784 s` window at `16 kHz`), linearly mapping `[-90, 0] dBFS` to `[0, 1]`. Preserves true physical loudness so `Quiet_Room` never confuses with `Wideband_Noise_Static`.
  - **Channel 1 (`Temporal Delta ΔLog-Mel`)**: `clamp((Ch0[t] - Ch0[t-1]) * 4.0, -1, 1)` — completely **gain-invariant** and highlights sharp acoustic onsets (glass break, door knock, keyboard clicks, speech syllables, T3 alarm edges).
- **Backbone**: 5-stage Depthwise-Separable 2D-CNN (`2→16→32→48→64→96`) + Global Average & Max Pooling (`192 → 64`) with dual heads:
  - **28 Fine Classes** across 5 coarse groups (`Safety`, `Machine_Tech`, `Human_Media`, `Environment`, `Signal_Diag`), trained on Hugging Face **ESC-50**, **UrbanSound8K**, **LibriSpeech**, and physically modeled hardware/telecom signals (`Mains_Hum_50_60Hz`, `Coil_Whine_SMPS`, `Printer_Stepper_Mech`, `DTMF_Telecom`, `Smoke_Alarm_T3`, `Ultrasonic_Beacon`).
  - **32D SupCon Embedding Head**: L2-normalized vector on $S^{31}$ trained jointly with Supervised Contrastive Loss (`SupCon`) so custom user sounds cluster tightly.

---

## 2. `AnomalyAE-2D` (`.czml` Domain `8`) & Hybrid Fusion

Detecting mechanical faults (a failing fan bearing, scraping 3D-printer linear rail, or knocking pump) cannot rely on fixed sound labels alone — every machine sounds unique! Audio Studio combines **two complementary engines**:

1. **Online `BandBaseline` (Statistical EWMA + Burst-Freeze)**:
   - Learns per-band mean $\mu_b$ and variance $\sigma_b^2$ across all 32 Mel bands during `4 LERN` (`5 s`) and adapts slowly during quiet operation.
   - **Burst-Freeze Invariant**: Any band with $z_b = (x_b - \mu_b)/\max(\sigma_b, \sigma_{\min}) \ge 3.0$ freezes its EWMA update so sustained anomalies cannot poison the learned reference.
2. **`AnomalyAE-2D` (DCASE Convolutional Autoencoder)**:
   - Trained exclusively on **healthy/normal industrial machine audio** (DCASE 2020 Task 2 `fan`, `pump`, `slider`, `valve` + real HVAC/engine baselines) using a **gain-invariant `[1 × 32 × 32]` patch-centered Log-Mel input** (`clamp((mel - mean)*2.5 + 0.5, 0, 1)`), so moving CardputerZero closer or farther from a motor does not trigger false alarms!
   - Compresses `1024` spectrogram pixels through a **`32D` bottleneck (`32×` compression)** and reconstructs via `NearestUpsample2× + Depthwise-Separable Conv2D` (zero checkerboard artifacts, `~4.5 ms/op`).
   - Unseen mechanical faults fail to reconstruct cleanly, spiking both the scalar **Reconstruction MSE** and the **32-band `BandError[b]` heatmap** pinpointing the exact defective frequency band.

### Interactive Acoustic Anomaly & Autoencoder Simulator

Explore how `BandBaseline` Z-scores and `AnomalyAE-2D` per-band reconstruction errors react to mechanical faults below:

```interactive:audio-anomaly-lab
```

---

## 3. On-Device 32D Few-Shot Enrollment & Script Triggers (`SoundProfileIndex` + `trigger.Dispatcher`)

Pressing **`6 ENRL`** in `Listen & Classify` (or **`4 ENRL`** in `Sound Match (32D)`, or **`6 ENRL`** on a saved `.wav` clip in `My Recordings`) stores the L2-normalized `[32]float32` embedding in `~/.config/audio-studio/profiles.json`. Subsequent live frames compute exact cosine similarity $\cos\theta = \mathbf{q} \cdot \mathbf{p}_i$ against every enrolled profile — recognizing custom sounds in seconds without retraining in Colab.

Each enrolled profile can optionally bind a **`TriggerRule`** (`script_path`, `enabled`, `min_similarity`, `cooldown_sec`) that launches an executable script on CardputerZero whenever the live microphone matches that profile while **`Sound Match (32D)`** is open:

1. **Multi-Layer False-Trigger Suppression**:
   - **Screen-Scoped Arming**: Automatic triggers are armed *only* while `TabMatch` is open and `Settings.TriggersEnabled == true`, and are muted automatically during speaker playback (Half-Duplex Safety).
   - **Energy Gate (`RMS >= -65 dBFS`)**: Near-silence frames never accumulate match streaks.
   - **Streak Debounce (`ConfirmStreakFrames = 2`)**: Requires two consecutive `SoundNet-2D` windows (~`400 ms`) exceeding the profile's cosine threshold (`default 0.76`, tunable `0.50–0.98`).
   - **Per-Profile Cooldown (`2–300 s`, default `10 s`)**: Prevents sustained sounds from spawning repeated subprocesses.
2. **Process-Group Isolation & Launch-Only Logging**:
   - Scripts execute directly via `exec.CommandContext` (never `sh -c`) inside their own Unix process group (`Setpgid: true`) with a hard `15 s` timeout (`SIGKILL` to `-pgid` on timeout), `4 KB` stdout/stderr cap, and max `2` concurrent launches.
   - Logs are written **strictly when a script is launched** to bounded JSONL (`~/audio-studio/trigger_log.jsonl`, max `200` entries), viewable and clearable directly in **`Sound Match → 6 LOGS`**.

---

## 4. Sound Match v2: Background Contrast, Sequence DTW & Auto-Threshold

- **Background Contrast (Hard Negatives)**: Calibrating 3 seconds of room noise (`4 +NEW → Calibrate Room Noise`) stores up to `12` ambient 32D prototypes. Live matches must satisfy both `sim >= MinSimilarity` **and** `sim - max(sim_background) >= 0.12`, slashing false launches in noisy rooms.
- **Subsequence DTW Pattern Matching (`internal/audioml/sequence.go`)**: Records `2.5 s` multi-frame `32D` trajectories (`6–12` frames) for double-claps, intercom melodies, or triple appliance beeps. A zero-allocation stack DP matrix (`[17][17]float32`) aligns the live `16`-frame `EmbeddingRing` tail to the pattern with Sakoe-Chiba warping tolerance (`±2` frames).
- **Auto-Threshold Calibration**: Pressing **`Enter`** on `Min Match` in Script Setup calculates the midpoint between intra-profile positive consistency (`minPos`) and worst-case room background similarity (`maxBg`), snapped to `2%` increments in `[62%, 94%]`.

---

## 5. Offline Keyword Spotting (`KWSNet-2D`, `.czml` Domain `9`)

`KWSNet-2D` (~`48 KB` INT8 Depthwise-Separable 2D-CNN, `0 allocs/op`, `~3.5 ms` on Cortex-A53) shares the exact `[2 × 32 × 48]` Log-Mel + Delta frontend with `SoundNet-2D` and is trained on **Google Speech Commands v0.02** (`105,829` utterances across 35 words):

- **16 Built-In Command Classes**: `_silence_`, `_unknown_`, `yes`, `no`, `up`, `down`, `left`, `right`, `on`, `off`, `stop`, `go`, `forward`, `backward`, `follow`, `marvin`.
- **32D SupCon Voice-Keyword Embedding**: Trained jointly across all 35 words so you can enroll **any custom spoken wake-word in any language** (English, Russian, etc.) in 1–3 takes and bind it directly to an executable script in `Sound Match & Scripts` — 100% offline.
