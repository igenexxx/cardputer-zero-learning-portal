# ML Deep Dive: 1D Kalman Filter Foxhunt & Periodicity Tracker

Locating a physical Sub-GHz transmitter ("Foxhunt") with raw CC1101 RSSI readings is frustrating because multipath reflections and AGC stepping cause `±6–10 dBm` jitter from sample to sample. Meanwhile, identifying whether a channel carries a periodic weather beacon (`every 15s`), manual remote clicks, or a continuous jammer requires tracking burst arrival times.

`rf-heatmap` combines a **1D Scalar Kalman Filter** (`internal/rfml/kalman.go`) with a fixed-ring **IAT Periodicity Tracker** (`internal/rfml/periodicity.go`) running with **0 heap allocations** on Go 1.27.

---

## 1. 1D Scalar Kalman Filter (`KalmanRSSI`)

At each `PULSE` tick, the filter maintains an estimate $\hat{x}$ (dBm) and uncertainty covariance $P$:

1. **Predict**: $P_{\text{pred}} = P + Q$ (process noise $Q = 1.2$ lets the estimate follow your walking speed)
2. **Kalman Gain**: $K = \frac{P_{\text{pred}}}{P_{\text{pred}} + R}$ (measurement noise $R = 18.0$ suppresses `±6 dBm` CC1101 jitter)
3. **Update**: $\hat{x} \leftarrow \hat{x} + K (z - \hat{x})$, $P \leftarrow (1 - K) P_{\text{pred}}$

From the smoothed slope (`Velocity`), `PULSE` displays:
- **`^CLOSER`** (green): signal trending upward (`>= +0.45 dBm/step`)
- **`vFARTHER`** (amber): signal trending downward (`<= -0.45 dBm/step`)
- **`=STEADY`** (muted): constant distance, plus `ProximityPct` (`0–100%`)

---

## 2. Inter-Arrival Time (IAT) Periodicity (`PeriodicityTracker`)

Two fixed ring buffers (`[64]bool` duty ratio + `[16]time.Time` debounced burst rising edges) classify channel behavior in $O(1)$:

| Label | Detection Rule | Typical Source |
| --- | --- | --- |
| **`CW/JAMMER`** | Active duty ratio `>= 80%` over `>= 20` samples | Continuous carrier, baby monitor, jammer |
| **`BEACON Xs`** | `>= 3` bursts, `mean IAT >= 0.5s`, Coefficient of Variation $CV = \sigma / \mu \le 0.15$ | Weather stations, TPMS, smart-home telemetry |
| **`BURST`** | `>= 1` burst, irregular spacing ($CV > 0.15$) | Manual garage/gate keyfob presses |
| **`QUIET`** | No active bursts above Smart Squelch | Idle channel |

---

## 3. Interactive Lab: 1D Kalman Filter Foxhunt Simulator

Experiment with walking closer/farther from a 433 MHz transmitter, injecting CC1101 RSSI jitter, and tuning $Q$ vs $R$:

```interactive:foxhunt-radar
```

---

## 4. Programmatic Access via MCP (`rf_foxhunt_track`)

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rf_foxhunt_track","arguments":{"freq_hz":433920000,"samples":16,"interval_ms":20}}}
```
