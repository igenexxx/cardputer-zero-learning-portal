# 9-DoF Inertial Physics, Madgwick AHRS, Vibration FFT, Input Shaper & Seismograph DSP

This deep-dive explains the MEMS sensor physics, quaternion attitude fusion, Hard/Soft-Iron magnetic calibration, `100 Hz` vibration spectrum & ISO 10816-3 velocity integration, Klipper Input Shaper damping math, and geophysical `STA/LTA` seismograph triggers powering **`imu-studio`** on M5Stack CardputerZero.

---

## 1. MEMS `BMI270` + `BMM150` Physics & Non-Root Linux IIO `Pread`

CardputerZero integrates a complete **9-Degree-of-Freedom (9-DoF)** inertial measurement stack exposed cleanly through Linux's **Industrial I/O (IIO)** kernel subsystem (`/sys/bus/iio/devices/iio:device*`):

1. **Bosch `BMI270` (6-Axis Accelerometer + Gyroscope)**:
   - **Accelerometer (`ax, ay, az`)**: Microscopic silicon proof masses suspended on spring flexures inside differential capacitive combs. Linear acceleration plus gravity ($1g \approx 9.80665\text{ m/s}^2$) deflects the mass, shifting capacitance proportional to specific force.
   - **Gyroscope (`gx, gy, gz`)**: Driven vibrating silicon resonators experiencing the **Coriolis force** ($\mathbf{F}_c = -2m(\boldsymbol{\omega} \times \mathbf{v})$) during angular rotation, yielding low-latency angular velocity (`°/s` or `rad/s`) — subject to slow thermal **zero-rate bias drift** over time.
2. **Bosch `BMM150` (3-Axis Geomagnetic Sensor)**:
   - Uses Bosch's Hall-effect + FlipCore magnetic sensing elements to measure Earth's geomagnetic flux density (`~25–65 µT`) along `X`, `Y`, and `Z`.
3. **Non-Root `Pread` Hot Path**:
   - Opening and closing sysfs files on every `100 Hz` tick wastes kernel syscalls and allocates heap objects. Instead, `imu-studio` opens each channel file descriptor once at startup (`in_accel_x_raw`, `in_anglvel_x_raw`, `in_magn_x_raw`, etc.) and reads at offset `0` via `syscall.Pread` / `os.File.ReadAt` into fixed stack byte buffers — **zero root privileges, zero `/dev/i2c-*` bus contention, zero heap allocations**.

---

## 2. Madgwick Quaternion AHRS & Gimbal-Lock Avoidance

Representing 3D orientation with naive Euler angles (`roll`, `pitch`, `yaw`) suffers from **gimbal lock** near `±90°` pitch, where roll and yaw axes collapse and trigonometric singularities explode. Furthermore:
- Integrating **gyroscope** rates alone is smooth and immune to vibration, but tiny bias errors (`0.2 °/s`) integrate into unbounded heading/level drift within seconds.
- Computing tilt from **accelerometer** gravity alone never drifts, but shakes wildly under linear motion or machinery vibration.

**`MadgwickAHRS`** fuses both sensors cleanly using a **unit quaternion** $\mathbf{q} = [q_w, q_x, q_y, q_z]^T$ ($\|\mathbf{q}\| = 1$):

1. **Gyroscope Quaternion Derivative**:
   $$\dot{\mathbf{q}}_{\omega,t} = \frac{1}{2}\,\mathbf{q}_{t-1} \otimes [0, \omega_x, \omega_y, \omega_z]^T$$
2. **Gradient-Descent Gravity Correction**:
   Defines an objective error $\mathbf{f}(\mathbf{q}, \hat{\mathbf{a}})$ between the predicted gravity direction rotated by $\mathbf{q}$ and the normalized measured accelerometer vector $\hat{\mathbf{a}}$, then takes a normalized Jacobian gradient step scaled by filter gain **$\beta$**:
   $$\dot{\mathbf{q}}_t = \dot{\mathbf{q}}_{\omega,t} - \beta \frac{\nabla \mathbf{f}}{\|\nabla \mathbf{f}\|}, \qquad \mathbf{q}_t = \frac{\mathbf{q}_{t-1} + \dot{\mathbf{q}}_t \Delta t}{\|\mathbf{q}_{t-1} + \dot{\mathbf{q}}_t \Delta t\|}$$
3. **Zero Gimbal Lock + Relative Tare (`q_tare`)**:
   Attitude taring stores the conjugate reference quaternion $\mathbf{q}_{\text{tare}}^*$ and multiplies $\mathbf{q}_{\text{rel}} = \mathbf{q}_{\text{tare}}^* \otimes \mathbf{q}_t$ before projecting Euler angles strictly for human display.

---

## 3. Hard-Iron / Soft-Iron Calibration & Tilt-Compensated 3D Compass

In open space, rotating a `BMM150` through all 3D orientations traces a sphere centered at $(0, 0, 0)$ with radius $|\mathbf{B}_{\text{Earth}}| \approx 45\text{–}55\,\mu\text{T}$. Inside a pocket computer near batteries, speaker magnets, and steel screws, two distortions deform that sphere:
- **Hard-Iron Distortion ($\mathbf{b}_{\text{hard}}$)**: Permanent magnetized components (speaker, PCB shields) add a constant offset vector that **shifts the sphere's center** away from the origin.
- **Soft-Iron Distortion ($\mathbf{S}_{\text{soft}}$)**: Ferromagnetic metals warp local field lines depending on orientation, **stretching the sphere into an ellipsoid**.

**`MagCalibration`** restores an undistorted centered sphere:
$$\mathbf{B}_{\text{cal}} = \mathbf{S}_{\text{soft}}\,(\mathbf{B}_{\text{raw}} - \mathbf{b}_{\text{hard}})$$

### Tilt Compensation & Magnetic Inclination (Dip)
Earth's magnetic field does **not** point horizontally — at mid-latitudes it plunges downward at an **inclination (dip) angle** of `50°–70°`. Computing `atan2(my, mx)` directly produces huge heading errors whenever CardputerZero is tilted by even `10°`. `imu-studio` rotates $\mathbf{B}_{\text{cal}}$ back into the horizontal level frame using `MadgwickAHRS` roll ($\phi$) and pitch ($\theta$):
$$B_x^{(h)} = B_x \cos\theta + B_y \sin\phi\sin\theta + B_z \cos\phi\sin\theta$$
$$B_y^{(h)} = B_y \cos\phi - B_z \sin\phi$$
$$\text{Heading} = \operatorname{atan2}(-B_y^{(h)}, B_x^{(h)}) + \text{Declination}$$

---

## 4. `100 Hz` Vibration FFT, Velocity Integration & ISO 10816-3 Health

At `100 Hz` sampling (`Nyquist = 50 Hz`, covering up to **`3,000 RPM`** fundamental shaft speeds and typical 3D-printer gantry resonances `25–50 Hz`), `imu-studio` applies a **Hann window** $w[n] = \frac{1}{2}(1 - \cos(2\pi n/(N-1)))$ to suppress spectral leakage and computes an in-place **Radix-2 FFT** (`0 allocs/op`).

### Acceleration (`g`) to Mechanical Velocity (`mm/s`) Integration
Industrial machinery standards (**ISO 10816-3 / ISO 20816-3**) judge mechanical wear using **RMS vibration velocity (`mm/s`)** across `10–50 Hz` because velocity scales directly with fatigue energy across frequencies. In the frequency domain, integrating acceleration $A(f)$ (`m/s²`) is a clean algebraic division per FFT bin $f_k \ge 10\text{ Hz}$:

$$V(f_k) = \frac{A(f_k)}{2\pi f_k} \times 1000 \;\;[\text{mm/s}], \qquad v_{\text{RMS}} = \sqrt{\sum_{f_k \in [10, 50]\text{ Hz}} V_{\text{RMS}}(f_k)^2}$$

| `ISO10816Grade` | Velocity RMS (`mm/s`) | Machinery Condition |
| --- | --- | --- |
| **`A` (Good)** | `< 0.71` | Newly commissioned or precision balanced fan/motor/gantry |
| **`B` (Satisfactory)** | `0.71 – 1.80` | Acceptable for unrestricted continuous operation |
| **`C` (Monitor)** | `1.80 – 4.50` | Elevated imbalance or belt tension drift — schedule maintenance |
| **`D` (Warning)** | `4.50 – 7.10` | Unsatisfactory for long-term run — inspect bearings/mounts |
| **`F` (Critical)** | `> 7.10` | Severe vibration risking mechanical damage (`VIB_FAULT`) |

`VibMetrics` also computes **Crest Factor** ($\text{CF} = a_{\text{peak}} / a_{\text{RMS}}$): pure sinusoidal imbalance has $\text{CF} \approx 1.41$, whereas early **bearing race spalling** emits sharp periodic impacts driving $\text{CF} > 3.5$ long before overall RMS rises!

---

## 5. Klipper Input Shaper (`ZV` / `MZV` / `EI`) Resonance Damping Math

3D printers like the **Creality K1C** suffer from surface "ringing" (ghosting) after sharp corners when stepper acceleration excites the frame/belt's natural resonant frequency $f_n$ (typically `35–50 Hz` on CoreXY gantries) with small damping ratio $\zeta \approx 0.05\text{–}0.10$.

**Input Shaping** convolves motion commands with a carefully timed sequence of impulses separated by half the damped period $T_d = 1 / (f_n \sqrt{1 - \zeta^2})$ so the second impulse's oscillation cancels the first in destructive interference! Letting $K = \exp\!\left(-\frac{\zeta \pi}{\sqrt{1 - \zeta^2}}\right)$:

- **`ZV` (Zero Vibration, 2 impulses)**: Fastest response & sharpest corners, lowest smoothing, but sensitive to `±5%` frequency drift ($A_1 = \frac{1}{1+K}$, $A_2 = \frac{K}{1+K}$ at $t = 0, \frac{T_d}{2}$).
- **`MZV` (Modified Zero Vibration, 3 impulses)**: Gold standard for K1C/CoreXY — tolerates wider resonance bandwidth (`±10%`) with near-zero residual ringing (`< 3%`) and moderate max acceleration limit.
- **`EI` (Extra Insensitive, 3 impulses)**: Broadest `±20%` tolerance for heavy bedslinger Y-axes or dual-peak frames at the cost of stronger corner smoothing.

`imu-studio` analyzes peak width (Q-factor) and secondary peaks in the `100 Hz` sweep to emit a concrete **`InputShaperRecommendation`** (`shaper_type`, `shaper_freq`, predicted residual %, and max safe acceleration).

---

## 6. Interactive 4-Tab IMU Sensor, Vibration FFT, Seismograph, Tap X-Ray & 3D Wand Lab

Explore all four domains live in your browser below — test **Madgwick fusion vs. raw gyro drift**, switch machinery/3D-printer presets in the **100 Hz FFT & ISO 10816 Lab**, trigger **metal/tracker/tamper events** in the **Magnetic & Seismograph oscilloscope**, and test **structural Tap X-Ray ring-down curves (`τ` & `Hollowness%`) or 3D Magic Wand strokes** in **Tab 4**:

```interactive:imu-sensor-lab
```

---

## 7. Geophysical `STA/LTA` Seismograph & Jerk Secret Knock Matching

- **`STALTADetector`**: Continuously maintains two exponential energy averages of linear acceleration magnitude $e[n] = \|\mathbf{a}_{\text{lin}}[n]\|^2$: a fast **Short-Term Average** (`STA`, `~0.3 s`) and a slow **Long-Term Average** (`LTA`, `~4.0 s`). Because `STA / LTA` is a **dimensionless ratio**, it automatically adapts to quiet wooden desks or humming HVAC floors without manual threshold tweaking, firing `TAMPER_ALERT` cleanly when `STA/LTA` crosses the armed trigger ratio (confirmed by `IMUTamperNet-1D`).
- **`KnockMatcher` (High-Pass Jerk `da/dt`)**: Knocks produce crisp `10–30 ms` spikes in acceleration derivative (**jerk**, $j[n] = (a_z[n] - a_z[n-1]) f_s$). By recording inter-tap intervals $[dt_1, dt_2, \dots, dt_k]$ and normalizing each gap by the total sequence duration ($\hat{r}_i = dt_i / \sum dt_j$), `KnockMatcher` matches your enrolled secret knock rhythm even if you tap `±20%` faster or slower!

---

## 8. `v0.2.0` Engineering Deep-Dive: Black-Box Ring, 3D Quaternion Projection, Gait DSP & Dual-Axis Shaper Budgeting

### 8.1 `PreTriggerRing` Circular Memory Design (`5 s Pre + 10 s Post`)
Continuous `100 Hz` 9-DoF logging straight to microSD wears flash memory and fills storage with hours of idle flat lines. `imu-studio`'s **`PreTriggerRing`** solves this with a fixed, zero-allocation circular buffer held strictly in RAM:
- **Pre-Trigger Window (`500` frames = `5.0 s` @ `100 Hz`)**: A single write head `head = (head + 1) % 500` overwrites the oldest 9-DoF sample in $O(1)$ time with **zero disk writes** during idle monitoring.
- **Post-Trigger Capture (`1,000` frames = `10.0 s` @ `100 Hz`)**: The instant `TAMPER_ALERT`, `DROP_SHOCK`, `MAG_ANOMALY`, `VIB_FAULT`, or an explicit `imu_blackbox_control dump_now` fires, the ring snapshots its `5 s` pre-trigger history, continues capturing `10 s` of post-event aftermath (`1,500` total frames), and atomically writes a sandboxed `0600` CSV trace into `~/imu-studio/exports/` — emitting a `BLACKBOX_SAVED` event on `StudioEventBus`.

### 8.2 3D Quaternion Wireframe Cube Projection ($\mathbf{q} \cdot \mathbf{v} \cdot \mathbf{q}^{-1}$)
To render a smooth, gimbal-lock-free 3D wireframe cube on CardputerZero's `320×170` RGB565 framebuffer without trigonometric Euler matrices, `imu-studio` rotates each of the 8 cube vertices $\mathbf{v} = (x, y, z)$ directly by the live unit quaternion $\mathbf{q} = (q_w, \mathbf{q}_v)$ via the Hamilton sandwich product:
$$\mathbf{v}' = \mathbf{q} \otimes (0, \mathbf{v}) \otimes \mathbf{q}^{-1} = \mathbf{v} + 2\,\mathbf{q}_v \times (\mathbf{q}_v \times \mathbf{v} + q_w \mathbf{v})$$
This Rodrigues-quaternion form requires only two cross products per vertex (`0` trig calls, `0` heap allocations). Each rotated vertex $(x', y', z')$ is then projected onto screen pixels with a perspective camera at depth $D$:
$$u = c_x + \frac{f \cdot x'}{D + z'}, \qquad v = c_y - \frac{f \cdot y'}{D + z'}$$
Connecting the 12 cube edges (plus color-coded `X`/`Y`/`Z` body axes) renders an instant physical mirror of CardputerZero's 3D attitude.

### 8.3 `0.8–3.2 Hz` Bandpass Gait Pedometer & Stride Symmetry (`StepCounter`)
Human walking and jogging produce a periodic vertical/triaxial acceleration waveform concentrated strictly between **`0.8 Hz` (`48 spm`)** and **`3.2 Hz` (`192 spm`)**:
1. **Gravity Removal & Bandpass Isolation**: `StepCounter` computes triaxial acceleration magnitude $\|\mathbf{a}[n]\|$, strips the `1g` DC gravity component with a high-pass filter ($f_c \approx 0.8\text{ Hz}$), and suppresses high-frequency hand-tremor / pocket rattle with a low-pass filter ($f_c \approx 3.2\text{ Hz}$).
2. **Hysteresis Peak Detection + Refractory Lockout**: A step is counted only when the filtered envelope rises above the upper threshold and falls below the lower hysteresis gate after a minimum `280 ms` refractory interval (blocking double-counts from heel-strike shockwaves).
3. **Cadence (`spm`) & Alternating Stride Symmetry (`%`)**: Rolling inter-step intervals $\Delta t_k$ yield instantaneous cadence $\text{spm} = 60 / \overline{\Delta t}$. Comparing consecutive odd (left) vs. even (right) step durations measures gait symmetry:
$$\text{Symmetry} = 100\% \times \left(1 - \frac{|\overline{\Delta t}_{\text{odd}} - \overline{\Delta t}_{\text{even}}|}{\max(\overline{\Delta t}_{\text{odd}}, \overline{\Delta t}_{\text{even}})}\right)$$
Balanced walking scores `92–100%`, while a limp or uneven load drops symmetry noticeably.

### 8.4 Paired X+Y Klipper `[input_shaper]` `max_accel` Budgeting (`DualShaperBundle`)
A single-axis resonance sweep is only half the story for a 3D printer: CoreXY (e.g., Creality K1C) and bedslinger printers exhibit **different** natural frequencies on `X` vs. `Y` because moving masses and belt paths differ.
- **`DualShaperBundle`** records independent sweeps for both `X` and `Y` (`shaper_type_x`, `shaper_freq_x`, $a_{\max,X}$ and `shaper_type_y`, `shaper_freq_y`, $a_{\max,Y}$).
- Because Klipper enforces a **single** global `[printer] max_accel` limit across combined diagonal moves, the safe global acceleration budget is bounded by the weaker (lower-frequency or wider-damped) axis:
$$a_{\max,\text{global}} = \min\!\big(a_{\max,X},\; a_{\max,Y}\big)$$
- Exporting the bundle generates a ready-to-paste `printer.cfg` block containing both `[input_shaper]` axis pairs and the conservative `[printer] max_accel` ceiling, while the opt-in **Moonraker Read-Only Bridge** (`confirm_net: true`) queries `/printer/objects/query?toolhead&configfile` over HTTP `GET` to verify live printer state without ever sending G-code or mutating firmware configuration.

---

## 9. `v0.3.0` Unconventional EDC Physics & DSP: Tap Ring-Down, BCG/Tremor, Side-Channel & 3D Stroke Resampling

### 9.1 Structural Impulse Ring-Down Physics (`τ` Decay, Panel Drum Modes & Dual-Modal Stud Fusion)
When you tap a wall, ceramic tile, or liquid tank beside CardputerZero, the impact excites the structure's local flexural modes, producing a damped oscillation governed by a second-order underdamped impulse response:
$$a(t) = A_0 \, e^{-t/\tau} \cos(2\pi f_0 t + \phi), \qquad \tau = \frac{1}{\zeta \omega_0} = \frac{Q}{\pi f_0}$$
- **Solid Masonry / Concrete (`Solid_Concrete`)**: High mass density and high structural damping yield a **very short decay constant** ($\tau \approx 18\text{–}35\text{ ms}$), minimal low-frequency flexural bounce, and low `Hollowness%` (`< 20%`).
- **Hollow Drywall Cavity & Empty Tank/Drum (`Hollow_Drywall`, `Empty_Tank_Drum`)**: Unsupported thin panels act as clamped membranes with low-frequency **drum modes** ($f_0 \approx 18\text{–}42\text{ Hz}$ inside the `100 Hz` Nyquist band) and long exponential ring-down tails ($\tau \approx 85\text{–}220\text{ ms}$, `Hollowness%` `65–95%`).
- **Loose Joint / Unbonded Tile (`Loose_Joint`)**: Produces secondary rattle/chatter peaks after the primary impact and irregular multi-mode envelopes with elevated late-window energy ratio ($E_{\text{late}} / E_{\text{early}}$).
- **Dual-Modal `BMM150` Fusion**: A hollow drywall cavity right over a steel stud or copper/iron pipe looks partially damped mechanically, while `BMM150` simultaneously detects a localized magnetic anomaly (`ΔµT >= 15 µT`). **`TapCaptureBuffer`** records the `0.64 s` (`64` samples @ `100 Hz`) post-jerk ring-down together with calibrated `ΔµT` so **`IMUTapNet-1D`** unambiguously separates `Wood_Stud` (damped, low `ΔµT`) from `Metal_Stud_Pipe` (damped, elevated `ΔµT`).

### 9.2 Contactless Ballistocardiography (`3–15 mg` Aortic Recoil) & `4–12 Hz` Physiological Hand Tremor
> [!WARNING]
> **Non-Medical Educational Physics Note**: Both BCG and hand-tremor analytics in `imu-studio` are experimental physics demonstrations of MEMS sensitivity — never clinical instruments or medical diagnostic tools.

- **Ballistocardiography (BCG)**: On every heartbeat, the left ventricle ejects ~`70 mL` of blood upward into the aortic arch and then downward through the descending aorta. By Newton's third law, this momentum transfer generates a tiny head-to-foot ballistic recoil (**J-wave peak** of only **`3–15 mg`** = `0.03–0.15 m/s²`) detectable by the `BMI270` 16-bit accelerometer when resting gently on the sternum or wrist.
  - A zero-alloc `0.7–3.0 Hz` (`42–180 BPM`) bandpass filter + envelope autocorrelation extracts the cardiac recoil rhythm, while a parallel `0.15–0.5 Hz` (`9–30 BrPM`) low-pass channel tracks slow chest-wall respiratory rise and fall.
- **`4–12 Hz` Physiological Hand Tremor (Soldering Steadiness)**: Even a healthy outstretched hand exhibits subtle neuromuscular micro-oscillations centered between **`4 Hz` and `12 Hz`** (accentuated by caffeine, fatigue, or heavy grip tension). Integrating the `4–12 Hz` bandpass acceleration (`mg` RMS) and angular-rate (`°/s` RMS) power yields a repeatable **Soldering Steadiness Score (`0–100`)** before fine-pitch SMD soldering.

### 9.3 Desk Keystroke Acoustic-Mechanical Side-Channel Timing Entropy
Every keypress on a mechanical or laptop keyboard injects a localized elastic impulse into the desk surface that travels outward as a flexural wave (`~100–400 m/s`), reaching CardputerZero's `BMI270` accelerometer milliseconds later.
- **`KeystrokeSideChannel`** runs a strictly local educational demonstration: it detects typing onset impulses via high-pass jerk, measures the sequence of **inter-keystroke intervals** ($\text{IKI}_k = t_k - t_{k-1}$), and computes the binned **Shannon timing entropy**:
  $$H(\text{IKI}) = -\sum_{b=1}^{B} p_b \log_2 p_b \;\;[\text{bits}]$$
- Repetitive cadence or rhythmic password entry exhibits lower `IKI` entropy and distinctive burst clustering — illustrating why physical isolation of inertial sensors matters in security engineering, **without ever attempting character recovery, keylogging, or storage**.

### 9.4 Speed-Invariant 3D Quaternion Air-Writing Stroke Resampling (`StrokeRecorder`)
Raw hand gestures drawn in 3D space vary wildly in duration (`0.4 s` quick flick vs. `1.8 s` careful circle) and handheld roll/pitch orientation. **`StrokeRecorder`** solves both problems with zero heap allocations:
1. **Gravity-Aligned World-Frame Rotation**: Each `BMI270` sample is rotated from CardputerZero's tilted body frame into a level Earth frame using the live `MadgwickAHRS` unit quaternion ($\mathbf{a}_{\text{world}} = \mathbf{q} \cdot \mathbf{a}_{\text{body}} \cdot \mathbf{q}^{-1} - [0, 0, 1g]^T$) and integrated with drift-damped velocity decay into a smooth 3D path $\mathbf{P}[k] = (x_k, y_k, z_k)$.
2. **Cumulative Arc-Length Parameterization**: Computes cumulative path distance along the raw captured points:
   $$s[0] = 0, \qquad s[k] = s[k-1] + \|\mathbf{P}[k] - \mathbf{P}[k-1]\|_2, \qquad L = s[M-1]$$
3. **Equidistant `N = 32` Resampling & Bounding-Sphere Normalization**: Linearly interpolates exactly `32` uniformly spaced points at $s_j = \frac{j}{31} L$ ($j = 0\dots 31$), subtracts the centroid $\bar{\mathbf{P}}$, and normalizes by RMS radius. Whether you draw a **`Circle_CW`**, **`Figure_8`**, or **`Z_Slash`** in `0.5 s` or `2.0 s`, **`IMUGestureNet-1D`** receives the exact same canonical `[6×32]` 3D geometric tensor!
