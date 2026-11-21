# On-Device IR ML: Denoiser, Classifier & Fingerprint

`ir-studio` embeds a **pure-Go, zero-dependency, zero-allocation** machine learning engine (`internal/irml/`) tailored to 38 kHz Infrared physics on the CardputerZero (ARM Cortex-A53, `CGO_ENABLED=0`). Every hot-path function runs in microseconds using stack-allocated fixed arrays (`[12]float32`, `[8]float32`) and caller-owned scratch slices (`0 B/op, 0 allocs/op`).

---

## 1. 1D K-Means IR Pulse Denoiser (`ML-CLEAN`)

Real-world IR receivers (TSOP38238 / VS1838B) introduce two systematic artifacts:
1. **AGC Pulse Stretching (`±80..150 µs`):** Strong nearby remotes widen marks and shrink spaces (or vice versa), pushing timings outside strict decoder windows.
2. **Sub-120 µs EMI Glitches:** Switching power supplies, sunlight edges, and PWM LED lamps inject brief spikes (`< 120 µs`) that split a single mark or space into three fragments.

### Two-Stage Zero-Allocation Pipeline (`internal/irml/cluster.go`)

1. **Glitch Absorption (`DenoiseIRPulsesInto`):**
   - Scans raw signed pulses (`+mark µs`, `-space µs`).
   - Any internal pulse with `|p| < DefaultIRMinGlitchUs` (`120 µs`) is **absorbed into the preceding pulse** (conserving total frame period!), and any adjacent same-sign pulses are coalesced so strict `+mark / -space` alternation is guaranteed.
2. **Header-Preserving 1D K-Means Quantization (`ClusterIRTimings` + `QuantizeIRPulsesInto`):**
   - Pulses with `|p| >= DefaultIRHeaderMinUs` (`2200 µs`) are classified as AGC preambles (`9000 / 4500 µs`) or inter-frame gaps and **excluded** from data clustering so headers are never distorted.
   - Deterministic `k = 2` 1D K-Means (initialized from min/max quantiles, capped at `20` iterations) partitions all data pulses into `ShortUs` (`1×TE`) and `LongUs` (`2×–3×TE`) centroids.
   - Each data pulse within `±35%` of its assigned centroid snaps cleanly to `±ShortUs` or `±LongUs`. Re-running the protocol decoder rescues degraded `NEC`, `Samsung32`, `RC5`, `RC6`, and `SIRC` frames, lighting up the Magenta **`ML-CLEAN`** badge.

---

## 2. IR Signal Classifier & Smart Save Guard

Not every IR capture is a valid remote button. `internal/irml/classifier.go` extracts a normalized **`IRFeatureVector [12]float32`** and evaluates a tiny pure-Go **`12 → 24 (ReLU) → 3 (Softmax)` MLP** (`0 allocs/op`, `< 5 µs/op`) to classify every capture into three domain classes:

| Class | Characteristics | App Behavior |
| :--- | :--- | :--- |
| **`TV/Remote`** | 12–32 bit frames (`20–90` pulses), clean `Short`/`Long` ratio, low jitter | Saved cleanly as `parsed` or `raw` remote button |
| **`AC State-Frame`** | `64–200+` bit stateful HVAC bursts (`128–600+` pulses), multi-subframe gaps | Unlocks one-key **AC State-Frame Inspector** (`6 DIFF`) |
| **`Ambient Noise`** | Sunlight AGC chatter, 100/120 Hz PWM LED flicker, `JitterRatio > 0.35`, high glitch density | Triggers **Smart Save Guard** & bulk **`PURGE`** |

### The 12 Normalized Features (`[0, 1]`)

`CarrierNorm`, `HasHeader`, `HeaderMarkNorm`, `HeaderSpaceNorm`, `ShortUsNorm`, `LongUsNorm`, `RatioNorm`, `JitterRatio`, `PulsesPerFrameNorm`, `SubframeCountNorm`, `GlitchDensity`, and `DutyCycle`. Any `NaN`/`±Inf` values are clamped safely before inference so Softmax probabilities always sum to `1.0`.

### Smart Save Guard & Bulk `PURGE`

- **Smart Save Guard (`RX` / `REMOTE`):** When `Class == Ambient Noise` with `Confidence >= 0.85` (`IsNoise == true`), pressing `SAVE` pauses with an Amber warning (`ML: Ambient Noise (94%)! Save anyway?`) so room lighting never pollutes `~/ir-studio/remotes/`.
- **Bulk Noise Purge (`SAVED → PURGE` & MCP `ir_purge_noise`):** Scans User Library `.ir` files and flags files where **every** button is classified as `Ambient Noise`. Multi-button remotes containing even one valid `TV/Remote`, `AC State-Frame`, or `type: parsed` button are protected, and read-only `DatabasePack` directories are **never** touched.

---

## 3. 8D IR Fingerprint k-NN & Smart Probe Ranking

Suppose you have a half-broken air conditioner or TV remote where `Power` is dead, but `Vol+` or `Mute` still blinks. `internal/irml/fingerprint.go` extracts an **L2-normalized 8D timing embedding (`IREmbedding [8]float32`)** from that single button:

| Dim | Feature | What It Captures |
| :---: | :--- | :--- |
| `0` | `CarrierFreqNorm` | Carrier band (`36–56 kHz`; neutral `38 kHz` prior if demodulated RX) |
| `1` | `HeaderMarkNorm` | AGC preamble mark duration (`0..10000 µs`) |
| `2` | `HeaderSpaceNorm` | AGC preamble space duration (`0..6000 µs`) |
| `3` | `Bit0RatioNorm` | Base `TE` / short symbol scale (`0..1500 µs`) |
| `4` | `Bit1RatioNorm` | `LongUs / ShortUs` modulation ratio (`0..5.0`) |
| `5` | `FrameLenNorm` | Pulses per frame (`0..400`) |
| `6` | `RepeatPatternNorm` | `0.0` single-shot, `0.5` full-frame repeat, `1.0` dedicated repeat code |
| `7` | `DutyCycle` | Active mark ratio across the frame |

### `±4 kHz` Carrier-Gated Cosine Similarity

Because every `IREmbedding` has unit L2 norm ($\|\mathbf{v}\|_2 = 1$), similarity between a live capture $\mathbf{q}$ and a catalog entry $\mathbf{e}$ is a 0-allocation dot product:

$$\text{sim}(\mathbf{q}, \mathbf{e}) = \sum_{i=0}^{7} q_i e_i \in [0, 1]$$

- **Carrier Gate (`MaxCarrierDeltaHz = 4000 Hz`):** When both query and candidate have measured carrier frequencies, candidates differing by more than **`±4 kHz`** (e.g., `36 kHz` vs `56 kHz`) are immediately rejected.
- **Single-Button Remote Recovery:** `IRFingerprintIndex.MatchTopK` deduplicates by remote file path and surfaces matches with `Similarity >= 0.85` (e.g., `Match: Daikin_ARC480.ir (96%)`) so one keypress promotes the **entire multi-button `.ir` file** into `~/ir-studio/remotes/`.
- **Smart Probe Ranking (`R` in `PROBE`):** Pressing `R` calls `RankCandidatesByEmbedding`, reordering the active `PROBE` pack descending by cosine similarity to your last captured button so the right brand/protocol transmits first.

---

## 4. Ambient IR Interference Monitoring

`AmbientMonitor` (`internal/irml/ambient.go`) tracks a zero-allocation `1.0 s` sliding window over idle `/dev/lirc*` receiver edges:

- **`EdgesPerSec`** and **`NoiseDutyPct`** classify room optical conditions in real time:
  - **`CLEAN`** (Emerald): `< 15 edges/s` and `< 5%` duty.
  - **`MODERATE`** (Amber): `15–150 edges/s` or `5–25%` duty (typical of PWM-dimmed LED bulbs).
  - **`SATURATED`** (Red): `> 150 edges/s` or `> 25%` duty (direct sunlight saturating the photodiode AGC).
- **`FlickerHz`** identifies periodic mains interference (`100 Hz` / `120 Hz` fluorescent or LED driver harmonics) and warns you to shield the sensor before learning a remote.

---

## 5. Try the Interactive IR Denoiser & Protocol Lab

Experiment directly with synthetic jitter (`0–150 µs`), EMI glitch injection, and 1D K-Means centroid quantization below:

```interactive:ir-lab
```
