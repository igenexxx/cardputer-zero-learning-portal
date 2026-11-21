# ML Deep Dive: 1D K-Means Pulse Clustering & Glitch Denoiser

Weak or distant 433/868 MHz remotes rarely arrive as crisp square waves. Multipath fading, oscillator drift, and short EMI spikes introduce **timing jitter (±20–35%)** and **sub-60 µs dropouts** that break strict ratio-based OOK protocol decoders.

`rf-heatmap` solves this on-device using a deterministic, zero-dependency **1D K-Means pulse clustering & glitch-merging pipeline** (`internal/rfml/cluster.go`) running in `< 0.2 ms` on ARM Cortex-A53.

---

## 1. Why Strict Decoders Fail on Weak Signals

Classic fixed-code decoders (`Princeton`, `CAME`, `Linear`) expect tight pulse-width ratios (for example, `1:3` or `3:1` within `[2.0, 4.5]`). Two real-world artifacts break this:

1. **EMI Dropout Glitches**: A `25 µs` noise spike in the middle of a `+1050 µs` high pulse splits it into `[+500, -25, +525]`, shifting every subsequent bit pair out of alignment.
2. **Edge Jitter**: At low SNR, comparator edges slip so a `1:3` symbol (`+1050 / -350`) arrives as `+920 / -470` (ratio `1.95`), failing the `>= 2.0` gate on a single bit and discarding the entire 24-bit frame.

---

## 2. Three-Stage Pipeline (`internal/rfml/cluster.go`)

### Stage 1: Glitch Merging (`DenoisePulses`)
Instead of naively deleting glitches (which would leave two consecutive positive pulses), any pulse with `|p| < 60 µs` is **absorbed into the preceding pulse** and adjacent same-sign pulses are merged:

```text
Raw:     [ +500, -25, +525, -350 ]
Step 1:  -25 absorbed into +500 -> +525
Step 2:  +525 merged with +525  -> +1050
Result:  [ +1050, -350 ]   (1 glitch removed, alternation preserved!)
```

### Stage 2: Sync Separation & Deterministic 1D K-Means (`ClusterTimings`)
Long inter-frame sync gaps (`|p| > 3500 µs`, such as `-10500 µs`) are separated from data-bit pulses so they never pull the long-bit centroid upward.

On the remaining data-pulse magnitudes, deterministic **1D K-Means (`k = 2`)** initializes centroids at the `p20` and `p80` quantiles and iterates until convergence (`< 0.5 µs` shift, typically 3–5 iterations):
- **`ShortUs`** → estimated base time element **`TE`**
- **`LongUs`** → long symbol centroid (`~3×TE` for Princeton/Linear, `~2×TE` for CAME)
- **`JitterRatio`** → mean normalized deviation from nearest centroid
- **`ModulationHint`** → `OOK PWM 1:3`, `OOK PWM 1:2`, `Uniform / Manchester`, or `Noise / Unstructured`

### Stage 3: Centroid Quantization & Fallback Decode (`QuantizePulses`)
Every data pulse is snapped to its nearest centroid (`±ShortUs` or `±LongUs`) while preserving polarity and sync gaps. `subfile.DecodeOOK()` runs strict decoding first; only on failure does it invoke the K-Means quantized pass, flagging recovered frames with `Denoised: true` (`ML-CLEAN` badge in the UI and `denoised: true` in MCP).

---

## 3. Interactive Lab: Test Jitter, Glitches & K-Means Recovery

Crank **Jitter** to `30%`, enable **EMI Glitches**, and toggle **1D K-Means Denoise** OFF vs ON to watch strict decoding break and K-Means quantization rescue the exact key:

```interactive:ook-decoder
```

---

## 4. Programmatic Access via MCP (`rf_analyze_pulses`)

With MCP enabled in **`SET`**, external agents can inspect pulse clusters and trigger denoised decoding over SSH:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rf_analyze_pulses","arguments":{"pulses":[-10500,460,-25,480,-470,440,-860]}}}
```
