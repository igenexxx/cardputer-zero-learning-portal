# ML Deep Dive: On-Device Signal Type Classifier (Tiny MLP)

Hardcoded protocol decoders only recognize a handful of fixed-code remotes (`Princeton`, `CAME`, `Linear`). When an unknown 433/868 MHz transmission hits the antenna — a KeeLoq car keyfob, a weather station, a continuous interferer, or random atmospheric noise — `rf-heatmap` classifies it on-device using a **pure-Go 2-layer Multi-Layer Perceptron (`12 → 24 ReLU → 5 Softmax`)**.

- **Model footprint**: 437 `float32` parameters (**~1.75 KB** embedded in `internal/rfml/model_weights.go`)
- **Inference speed**: **~255 ns/op** (`0 B/op`, `0 allocs/op`) on Go 1.27 with full stack-array bounds-check elimination
- **Offline training**: Reproducible zero-dependency Python 3 trainer (`rf-heatmap/scripts/train_rfml.py`, **99.8% validation accuracy**)

---

## 1. Five Target Signal Classes

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
