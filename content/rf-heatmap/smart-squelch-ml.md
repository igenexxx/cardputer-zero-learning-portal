# On-Device ML: Smart Squelch & Auto-Lock

Traditional handheld RF scanners force you to babysit a single **static squelch knob** (e.g., `-78 dBm`). In a clean rural field, `-78 dBm` works fine. In a real apartment, office, or city street, it breaks down immediately.

Feature #1 of `rf-heatmap` (`internal/rfml/baseline.go`) solves this with **per-bin online statistical machine learning** that runs in **271 nanoseconds per sweep** using **zero heap allocations** and **under 1 KB of active RAM**.

---

## 1. Why Static Squelch Fails in Urban RF Environments

Across a 36-bin sweep of `433 ISM`, the noise floor is **never flat**:

- **Bin 4** might sit quietly at `-106 dBm` (a weak distant sensor at `-84 dBm` is a crystal-clear `+22 dB` signal — yet a static `-78 dBm` squelch **misses it completely**).
- **Bin 10** might host a continuous switching-power-supply spur or nearby thermostat humming at `-64 dBm` — a static `-78 dBm` squelch **triggers nonstop false positives**, locking the scanner onto useless noise.
- **Ambient drift**: As you walk from indoors to outdoors, or as temperature changes, the entire noise floor shifts by `5–10 dBm`.

What we actually want is a **per-bin adaptive model** that continuously learns what "normal background" looks like on *each individual frequency*, and flags only **statistically anomalous bursts**.

---

## 2. Algorithm Walkthrough (`internal/rfml/baseline.go`)

`BinBaseline` tracks an independent online mean (`μ_i`) and variance (`σ_i²`) for every frequency bin `i` (up to `MaxBaselineBins = 64`).

### Stage A: Welford Warmup (First 5 Samples)
Exponentially Weighted Moving Averages (EWMA) converge slowly from zero. To give accurate statistics within ~1 second of launching or changing bands, the first `WarmupSamples = 5` readings use **Welford's exact online algorithm**:

```text
samples += 1
delta   = x - mean
mean   += delta / samples
delta2  = x - mean
m2     += delta * delta2
varEWMA = m2 / (samples - 1)   // when samples > 1
```

Until `samples >= 5`, `Ready(bin)` returns `false` and `SmartThreshold` safely falls back to the manual squelch (`-78 dBm`).

### Stage B: Effective Standard Deviation Floor (`σ_min = 2.0 dBm`)
On a very quiet channel, CC1101 RSSI readings can repeat identically (`-106, -106, -106`), driving sample variance to `0`. Dividing by `0` would explode the Z-score on a tiny `1 dBm` quantization step. Therefore, standard deviation is always floored:

```text
σ_eff = max(sqrt(varEWMA), 2.0 dBm)
```

### Stage C: Burst-Freeze Guard (`z ≥ 3.0`)
Here is the most important trick in online RF anomaly detection: **if you feed an active keyfob burst into your noise-floor EWMA, the noise floor gets dragged upward and blinds the detector to the rest of the burst.**

Before updating the EWMA on a warmed-up bin, `UpdateBin` computes the incoming reading's Z-score:

```text
z = (x - μ_i) / σ_eff
if z >= 3.0:
    return   // Burst-Freeze Guard: pause baseline adaptation!
```

- **Short keyfob burst**: Jumps to `z = +12.0`, hits the freeze guard, and **never pollutes `μ_i`**.
- **Slow ambient drift** (walking between rooms): Changes gradually (`z < 3.0`), so the EWMA tracks it smoothly.
- **Persistent static interferer** (present during warmup or slowly ramping): Absorbed cleanly into that single bin's baseline so it stops triggering false alarms.

### Stage D: Steady-State EWMA Mean & Variance (`α = 0.03`)
For every non-anomalous sample (`z < 3.0`), the bin updates its exponentially weighted mean and variance with smoothing factor `α = 0.03` (~33-sample effective memory window):

```text
diff    = x - mean
mean   += 0.03 * diff
varEWMA = (1 - 0.03) * varEWMA + 0.03 * (diff * (x - mean))
```

Notice the `diff * (x - mean)` term (using the pre-update `diff` and post-update `x - mean`), which guarantees non-negative variance updates in floating-point arithmetic.

---

## 3. Smart Squelch & Auto-Lock

Once warmed up, two user-facing features consume the learned `(μ_i, σ_eff)` model:

### Smart Squelch (`S` to toggle, `F` / `X` to tune `k`)
For any bin `i`, the adaptive threshold is:

```text
SmartThreshold(i) = clamp(round(μ_i + k · σ_eff), -120 dBm, -20 dBm)
```

- **Default `k = 3.5`** (statistically ~3.5 standard deviations above the local noise floor).
- In **PULSE** mode with `ASQ` ON, press **`F` / `X`** to tune `k` from **`2.0`** (aggressive — catches very weak signals) up to **`6.0`** (strict — rejects all minor interference) in `0.5` steps.
- On the **HEATMAP** chart, each bin shows its learned noise floor as a **gray tick** and its Smart Squelch threshold as a **magenta tick**.
- On the **PULSE** oscilloscope, the noise floor appears as a **dotted gray line** and the Smart Squelch threshold as a **dashed cyan line** (amber when switched to manual squelch with `S`).

### Auto-Lock (`L` to toggle, `z ≥ 4.0`)
After each full sweep in **HEATMAP**, `DetectBurst` scans all ready bins and selects the single bin with the **highest Z-score ≥ `4.0`**:

1. The top info strip flashes **`Z+xx.x`** in magenta.
2. If **Auto-Lock (`LOCK`)** is ON, the cyan cursor automatically snaps to that bin (`LCK 433.92M` in green), ready for an instant one-key `Enter` jump into **PULSE**.
3. **Manual Cursor Cooldown (`15` sweeps)**: Whenever you manually move the cursor with `Z` or `C`, Auto-Lock yields for 15 sweeps so it never fights your hand while you inspect an adjacent channel.

---

## Interactive Lab: Smart Squelch & Auto-Lock Simulator

Test the exact `BinBaseline` math live in your browser! Try turning on the **Static Interferer**, then toggle **Burst-Freeze Guard OFF** and trigger the **Keyfob Burst** repeatedly to see how the noise floor gets poisoned without the guard.

```interactive:smart-squelch
```

---

## 4. Why Classical Pure-Go ML Beats Heavy Runtimes on Cortex-A53

The CardputerZero's Raspberry Pi CM0 (quad-core Cortex-A53) runs Linux, so you *could* theoretically install Python, PyTorch, or TensorFlow Lite. Why did we write `internal/rfml` in ~270 lines of dependency-free Go instead?

| Metric | Pure-Go `internal/rfml` | Typical Python / TFLite Stack |
| --- | --- | --- |
| **Inference Latency** | **`271 ns/op`** (36-bin sweep + detect) | `5–50 ms` per inference + IPC overhead |
| **Heap Allocations** | **`0 B/op`, `0 allocs/op`** (no GC pauses) | Continuous tensor & interpreter allocations |
| **Memory Footprint** | **`< 1 KB`** active state (single-channel) / `~2 KB` max struct | `80–300 MB` RAM + shared libraries |
| **Startup Time** | **`< 50 ms`** cold launch from `APPLaunch` | `2–6 seconds` runtime + model load |
| **Training Data Needed** | **Zero** — adapts online in 5 sweeps (~1 sec) | Requires labeled datasets & retraining per environment |
| **Packaging** | Single static `arm64` binary (`CGO_ENABLED=0`) | Complex runtime dependencies in `.deb` |

> [!TIP]
> On embedded Linux hardware with tight frame budgets (`320×170` framebuffer updates + microsecond SPI polling), **online statistical ML** (Welford, EWMA, Z-score, 1D K-Means, Kalman filters) delivers immediate, explainable, zero-allocation intelligence without sacrificing battery life or responsiveness.
