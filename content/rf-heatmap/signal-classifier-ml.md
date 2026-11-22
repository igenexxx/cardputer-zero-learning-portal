# ML Deep Dive: `PulseNet-RF` (28 Protocols) & `SpectrumNet-2D`

Hardcoded protocol decoders only recognize a handful of fixed-code remotes (`Princeton`, `CAME`, `Linear`). When an unknown 315/433/868/915 MHz transmission hits the CC1101 antenna — a KeeLoq/StarLine/FAAC rolling keyfob, an Oregon/Acurite weather station, a TPMS tire sensor, a POCSAG pager, a continuous jammer, or a RollJam attack — `rf-heatmap` classifies it on-device using two **pure-Go, zero-allocation INT8 neural networks** packaged in the SHA-256-verified **`.czml v1`** binary format (`CGO_ENABLED=0`, zero Python/ONNX/TFLite runtimes).

| Model | File Size | Input Tensor | Outputs | Live Cortex-A53 @ 1.0 GHz |
| :--- | :---: | :--- | :--- | :---: |
| **`PulseNet-RF`** | **72.6 KB** (`74,377 B`) | `[3, 256]` pulses + `[6]` metadata | 28 fine protocols, 5 coarse classes, 32D SupCon embedding, 1D-UNet AGC denoiser | **16.6 ms/op** (`0 allocs/op`) |
| **`SpectrumNet-2D`** | **17.5 KB** (`17,930 B`) | `[2, 32, 36]` RSSI + delta waterfall | 8 RF scenes (`Quiet`, `Narrowband_OOK`, `Periodic_Beacon`, `Wideband_EMI_SMPS`, `FHSS_Hopper`, `LoRa_Chirp`, `CW_Jammer`, `RollJam_Suspect`) | **5.4 ms/op** (`0 allocs/op`) |
| Legacy `12→24→5` MLP | 1.75 KB | `[12]` K-Means summary | Fallback 5-class coarse classifier if `.czml` unavailable | **0.002 ms/op** (`0 allocs/op`) |

---

## 1. `PulseNet-RF` Architecture & Offline GPU Training (`ml-lab/`)

`PulseNet-RF` is a multi-task **Depthwise-Separable Temporal Convolutional Network (DS-TCN)** trained on an NVIDIA A100 GPU over **11,471 real-world Flipper `.sub` captures** (strictly group-split by remote directory/stem to guarantee zero train/test leakage):

- **Input Representation (`[3, 256]`)**: Each non-zero signed pulse duration `p` (`+mark` / `-space` in `µs`) becomes 3 channels: `sign(p) ∈ {-1, +1}`, `log1p(|p|) / log1p(100000)`, and clipped temporal derivative `Δlog × 3`, concatenated after Global Avg+Max Pooling with 6 metadata priors (`band`, `is_fsk`, `snr`, `log_len`, `duty`, `glitch_rate`).
- **Teacher → Student Knowledge Distillation + QAT**: A 400K-parameter FP32 Teacher (`ResTCN-Transformer`) distills dark knowledge into a **67,555-parameter Student** fine-tuned with **Quantization-Aware Training (QAT)** using dynamic per-tensor symmetric INT8 activations and per-channel INT8 weights with folded BatchNorm (`int32` MACs).
- **Temperature Calibration & Bit-Exact Parity**: Post-training L-BFGS temperature scaling yields **ECE = 0.0012** on clean captures (**98.11%** 28-class accuracy / **99.46%** 5-class accuracy) and **96.97%** under heavy clock drift, asymmetric AGC stretching, and EMI glitch injection. Pure-Go inference matches the Python INT8 reference to **`5.22e-07` max abs diff** across all 64 golden vectors on both `x86_64` and `arm64`.
- **Lazy 1D-UNet AGC Denoiser (`PN-CLEAN`)**: Only invoked when Pass 1 (strict OOK) and Pass 2 (1D K-Means `ML-CLEAN`) fail to decode, correcting asymmetric mark-stretch / space-shrink distortion while preserving strict `+/-` sign alternation.

## 2. `SpectrumNet-2D` Waterfall Scene & RollJam Detector

Every 4th sweep in `HEATMAP`, `rf-heatmap` feeds the last `32` waterfall rows × `36` frequency bins (absolute normalized dBm + delta above per-bin Welford baseline) into a 9-layer INT8 Depthwise-Separable 2D-CNN (**99.89%** test accuracy). When `RollJam_Suspect` (adjacent narrowband jammer + interleaved keyfob bursts) or `CW_Jammer` triggers with confidence `>= 65%`, a red **`ROLLJAM!`** or **`CW JAM!`** alert pill appears on the top-right of the waterfall.

---

## 3. Five Coarse Signal Classes & 28 Fine Protocol Families

| Class | Typical Real-World Sources | Distinguishing RF Signature |
| --- | --- | --- |
| **Fixed OOK** | Garage doors, gates, wireless doorbells (`Princeton`, `CAME`, `Linear`) | 20–56 pulses/frame, crisp `1:2`–`1:3` ratio, low jitter, 2–6 repeats |
| **Rolling / KeyFob** | KeeLoq, automotive remotes, modern alarm fobs | Long 110–180 pulses/frame (64–66 bits + preamble), `1:2` PWM, high SNR |
| **Sensor / Weather** | Outdoor thermometers, TPMS, smart-home telemetry | Wider `TE` (`520–1400 µs`), low carrier duty cycle (`12–36%`), 1–3 bursts |
| **CW / Jammer** | Continuous carrier, baby monitor, stuck button, wideband interferer | High duty cycle (`> 74%`), no sync gaps, high SNR |
| **Noise** | Atmospheric static, switching power supplies, EMI | High jitter (`> 0.30`), high `< 60 µs` glitch rate, low SNR |

---

## 2. The 12-Feature Vector (`internal/rfml/features.go`)

Every raw capture is transformed into 12 normalized `[0, 1]` features reusing the 1D K-Means clusterer:
1. `BandNorm` (`315 / 433 / 868 / 915 MHz`)
2. `LogPulseCount` (`log10(N+1)/3`)
3. `ShortUsNorm` (`ShortUs / 1500`)
4. `LongUsNorm` (`LongUs / 3000`)
5. `RatioNorm` (`LongShortRatio / 5`)
6. `LogSyncUs` (`log10(SyncUs+1)/5`)
7. `JitterRatio` (within-cluster timing jitter)
8. `DutyCycle` (`sum(+hi) / sum(|all|)`)
9. `FrameLenNorm` (`dataPulses / max(syncGaps, 1) / 180`)
10. `FrameRepsNorm` (`min(syncGaps, 8) / 8`)
11. `SNRNorm` (`clamp(snrDB, 0, 50) / 50`)
12. `GlitchRate` (`glitchesRemoved / len(raw)`)

---

## 3. Smart Save Noise Guard

When you press **`6 (SAVE)`** in `PULSE` on a capture classified as **`Noise` with confidence `>= 85%`**, `rf-heatmap` warns `Noise (96%)! 6 again to save` instead of cluttering `~/rf-heatmap/captures/`. Pressing `6` a second time within 3 seconds forces the save if you intentionally want to archive raw EMI.

---

## 4. Interactive Lab: Live Signal Classifier Explorer

Pick a real-world RF preset or drag the feature sliders to see how the 12-feature representation drives Softmax probabilities across all 5 classes:

```interactive:signal-classifier
```

---

## 5. Programmatic Access via MCP (`rf_classify_signal`)

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rf_classify_signal","arguments":{"pulses":[25,-40,190,-15,780,-30,120,-20,1450,-35],"freq_hz":433920000,"snr_db":3}}}
```
