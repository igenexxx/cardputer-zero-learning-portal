# IMU Studio — App Guide & Controls (`v0.3.1`)

**IMU Studio** (`imu-studio`) turns CardputerZero's onboard **9-DoF inertial sensors (`BMI270` 6-axis accelerometer/gyroscope + `BMM150` 3-axis magnetometer)** into a non-root pocket engineering, mechanical vibration FFT, magnetic metal/tracker finder, 3D tilt-compensated compass, seismograph tamper guard, Black-Box incident recorder, and Everyday-Carry (EDC) physics lab powered by Linux IIO sysfs `Pread` adapters and an embedded **6-model Pure-Go INT8 `.czml` Neural Suite (Domains `17–22`, ~48 KB, `0 allocs/op`)**: `IMUVibNet-1D`, `IMUTamperNet-1D`, `IMUMagAnomalyAE`, `IMUTapNet-1D`, `IMUBioNet-1D`, and `IMUGestureNet-1D`.

> [!NOTE]
> **Silent-Stealth, Smart Auto-Baseline & Non-Root Design**: `imu-studio` runs completely non-root via `/sys/bus/iio/devices/iio:device*` (`--sim` activates automatically when sensors are absent). On boot, **`AutoBaselineWarmup`** quietly monitors stationary stability to trim initial `BMI270` gyro zero-rate bias and ambient noise floor automatically. Audible alarms and Geiger clicks default to **silent/stealth (`OFF`)** so Desk Tamper Guard and magnetic sweeps never emit unexpected noise.

---

## 1. Home Menu (Smart Auto-Baseline, Live Summary & Simple vs. Expert Mode)

![IMU Studio Home Menu](assets/imu-studio/home.png)

- **Smart Boot `AutoBaselineWarmup`**: During the first seconds after launch, if CardputerZero rests still (`|gyro| < 1.5 °/s`), `AutoBaselineWarmup` automatically locks an initial gyro zero-rate bias and ambient magnetic/vibration floor with a live banner badge (`WARMUP` → `CAL OK`) — zero manual menus required. If the unit is already moving in your hand, warmup defers gracefully without corrupting stored calibration.
- **Live Telemetry Status Banner**: Summarizes live orientation (`P/R`), magnetic field (`|B| µT`), vibration health (`ISO10816Grade`), Black-Box `PreTriggerRing` armed state, and Tamper Watch status at a glance.
- Starts in **Simple Mode** (**7** everyday screens, beginning with **`Quick Missions`** at **#1**): `Quick Missions` (8 wizards), `3D Horizon & Level`, `Magnetic Finder`, `Vibration FFT`, `3D Compass`, `Saved & Replay`, and `Settings`.
- Press **`7 EXPERT`** on Home (or toggle in Settings) to unlock **+9 Engineering & Unconventional EDC Labs**: **Seismograph & Tamper Guard**, **Dual-Axis 3D-Printer Input Shaper**, **G-Force Traction Circle, Pedometer & Drop Logger**, **Machine Baseline Drift**, **Raw 9-DoF IIO**, **Secret Knock Matcher**, **Wall/Material Tap X-Ray**, **Contactless BCG / Soldering Tremor / Keystroke Side-Channel**, and **3D Air-Writing Magic Wand**.
- **Context-Aware Help (`H` / `8 HELP` on Home)**: Press **`H`** on any screen or sub-view (including Mission stages, Horizon views, Saved Action Sheet/Replay, Dual-Axis Shaper, or Bio Lab modes) to open a full-screen cyan-framed help modal tailored strictly to the active screen — with a 2-line summary, **cyan** `4`..`8` softkey badges, **amber** hotkey badges, and automatic pagination (`Z`/`C` to page, `H`/`Enter`/`Esc` to close).

---

## 2. Quick Missions (8 Guided 3-Step Physical Wizards)

![IMU Studio Quick Missions Menu](assets/imu-studio/missions.png)

Open **`Quick Missions`** (`#1` on Home) to execute real-world inertial measurements through interactive 3-step guided hardware flows:

1. **Level a Shelf / Frame (`MadgwickAHRS`)**: Place CardputerZero on your reference surface, press **`4 TARE`** if zeroing a relative slope, and align until the 2D bubble bullseye turns **emerald** (`|pitch| < 0.3°`, `|roll| < 0.3°`).
2. **Find Wall Studs, Metal & Hidden Magnets**: Hold CardputerZero in open air and press **`4 TARE`** to lock Earth's local magnetic field (`~45–55 µT`), then sweep slowly across drywall, furniture, or a vehicle frame to spot ferrous studs, hidden magnets/trackers (`ΔµT`), or `50/60 Hz` live wiring flagged by **`IMUMagAnomalyAE`** (`AnomalyZ >= 3.2σ`).
3. **Check Fan / Motor / Bearing Health**: Rest CardputerZero firmly against a server chassis, fan housing, or pump. Runs a **3-second averaged `100 Hz` Hann-windowed FFT**, integrates `10–50 Hz` velocity RMS (`mm/s`), assigns **`ISO10816Grade (A–F)`**, and runs **`IMUVibNet-1D`** fault classification.
4. **Arm Silent Desk / Laptop Tamper Guard**: Places CardputerZero flat on a desk or laptop lid, runs a **4-second physical settle countdown** (so you can step away without triggering a false alarm), locks ambient floor tremor, arms **`STALTADetector`** + **`IMUTamperNet-1D`** + **Black-Box `PreTriggerRing`** in **silent stealth mode**, and logs `TAMPER_ALERT`, `DROP_SHOCK`, and `BLACKBOX_SAVED` events.
5. **Calibrate Compass & Gyro Bias (8-Wedge Wheel)**: Step 1 keeps CardputerZero motionless for 3 seconds to capture `BMI270` zero-rate gyroscope bias; Step 2 guides a smooth 3D figure-8 rotation around a live **8-Wedge Compass Calibration Wheel** until all 8 directional octants light emerald, fitting `BMM150` Hard-Iron offsets (`b_hard`) and Soft-Iron axis scales (`S_soft`) saved to `~/.config/imu-studio/calibration.json` (`0600`).
6. **Learn Machine Vibration Baseline (3 s Averaged FFT + QWERTY Naming)**: Captures a **3-second averaged `100 Hz` vibration FFT** against a healthy fan, pump, or gantry, opens the **built-in QWERTY keyboard namer** (`K1C_Gantry`, `NAS_Fan_1`, etc.), and persists a reference **`MachineProfile`** (`~/.config/imu-studio/machines.json`, `0600`) including peak Hz, velocity RMS, and **`IMUVibNet-1D`** 16D SupCon embedding.
7. **Wall / Tank Tap X-Ray (`TapCaptureBuffer` + `IMUTapNet-1D`)**: Hold CardputerZero firmly against a wall, water/propane tank, tile, or wooden beam, tap once beside the chassis with your knuckle, and read the dual-modal **structural ring-down decay `τ` + `BMM150` magnetic stud delta** verdict (`Solid Concrete`, `Hollow Drywall`, `Wood Stud`, `Metal Stud/Pipe`, `Empty Drum`, `Loose Joint`) along with live **`Hollowness%`**.
8. **3D Air Magic Wand (`StrokeRecorder` + `IMUGestureNet-1D`)**: Hold **`Enter`** (or softkey **`4 CAST`**), draw a smooth 3D symbol in mid-air (`Circle_CW`, `Figure_8`, `Z_Slash`, `Checkmark`, or a custom enrolled spell), release to classify speed-invariantly, and emit **`GESTURE_MATCH`** (`imu_gesture`) over `StudioEventBus` to trigger cross-studio `radio-bridge` automations!

![8-Wedge Compass Calibration Wheel](assets/imu-studio/compass_cal.png)

> [!TIP]
> **Try it on hardware in 30 seconds**: Open **Quick Missions → #7 Wall / Tank Tap X-Ray**, press CardputerZero against a hollow drywall panel vs. a solid concrete pillar or stud, tap next to it, and watch **`Hollowness%`** and decay **`τ (ms)`** jump instantly!

---

## 3. 3D Artificial Horizon, 2D Bubble Level & 3D Wireframe Cube (`MadgwickAHRS`)

![3D Artificial Horizon and 2D Bubble Level](assets/imu-studio/horizon.png)

![3D Quaternion Wireframe Cube](assets/imu-studio/horizon_cube.png)

- Fuses `BMI270` 3-axis gyroscope rates and accelerometer gravity via quaternion **`MadgwickAHRS`** (eliminating Euler gimbal lock even at `±90°` pitch).
- Press **`Tab`** to cycle all four live orientation views:
  1. **Aviation Artificial Horizon** (pitch ladder, roll bank arc, live yaw/pitch/roll angles)
  2. **2D Spirit Bubble Level** (dual-axis bullseye turning emerald when level)
  3. **Split Precision Readout** (large numeric pitch/roll/yaw tilt readout)
  4. **3D Quaternion Wireframe Cube** — real-time perspective-projected 3D wireframe cube rotated directly by the unit quaternion ($\mathbf{q} \cdot \mathbf{v} \cdot \mathbf{q}^{-1}$) with color-coded `X`/`Y`/`Z` body axes and zero gimbal lock.
- Press **`4 TARE`** to set the current surface as `0.0° / 0.0°` (`q_tare`), **`5 MOUNT`** to cycle physical mounting orientations (`Flat`, `Vertical`, `Printer-X`, `Printer-Y`), and **`6 RESET`** to clear tare.

---

## 4. Magnetic Metal, Stud & Tracker Finder

![Magnetic Metal and Tracker Finder](assets/imu-studio/magnet.png)

- Displays calibrated total field magnitude `|B|` (`µT`), signed ambient delta `ΔµT`, magnetic inclination dip angle, `50/60 Hz` AC ripple detector (live mains wiring), and **`IMUMagAnomalyAE`** reconstruction error **`AnomalyZ`** (`>= 3.2σ` triggers amber/red **`MAG_ANOMALY`**).
- Press **`4 TARE`** to zero the local geomagnetic baseline, **`5 GEIG`** to toggle optional audio Geiger clicks (`OFF` by default), and **`6 CAL`** to jump to Hard/Soft-Iron figure-8 calibration.

---

## 5. 100 Hz Vibration FFT & ISO 10816-3 Health Analyzer

![100 Hz Vibration FFT and ISO 10816 Health](assets/imu-studio/vib_fft.png)

- Streams `BMI270` acceleration at **`100 Hz`** into a zero-allocation Hann-windowed Radix-2 FFT (`0–50 Hz` Nyquist bandwidth, `0.78 Hz/bin` at 128-pt or `0.39 Hz/bin` at 256-pt).
- Computes **`VibMetrics`**: dominant peak frequency (`Hz` and equivalent shaft `RPM = Hz × 60`), acceleration RMS (`g`), frequency-domain integrated velocity RMS (`mm/s`), crest factor, **`ISO10816Grade (A–F)`**, and **`IMUVibNet-1D`** fault diagnosis.
- Press **`Tab`** to cycle analyzed axis (`MAG` triaxial magnitude / `X` / `Y` / `Z`), **`Z`/`C`** to step the FFT frequency inspection cursor, **`4 HOLD`** to freeze/peak-hold, and **`5 CSV`** to export a sandboxed spectrum snapshot.

---

## 6. Tilt-Compensated 3D Compass & 8-Wedge Calibrator

![Tilt-Compensated 3D Compass](assets/imu-studio/compass.png)

- Applies persisted Hard-Iron (`b_hard`) and Soft-Iron (`S_soft`) **`MagCalibration`** to `BMM150` readings, then derotates the magnetic vector into the horizontal Earth plane using `MadgwickAHRS` roll and pitch so the heading stays accurate even when CardputerZero is tilted up to `±45°`.
- Shows compass rose, numeric bearing (`000°–359°`), 16-point cardinal heading, magnetic dip angle, configurable magnetic declination (`Z`/`C`), and **`CAL`** quality pill (`4 CAL` launches the visual **8-Wedge Compass Calibration Wheel** shown in Section 2).

---

## 7. Saved Captures, Black-Box `PreTriggerRing` & In-App Replay Viewer

![Saved Captures and In-App Replay Viewer](assets/imu-studio/saved_replay.png)

- **Black-Box `PreTriggerRing` (`5 s Pre + 10 s Post` RAM Recorder)**: Continuously buffers the last `5 s` of `100 Hz` 9-DoF telemetry strictly in RAM (`0` microSD wear while idle). When armed and a `TAMPER_ALERT`, `DROP_SHOCK`, `MAG_ANOMALY`, `VIB_FAULT`, or manual `DUMP` fires, it appends `10 s` of post-event aftermath (`1,500` frames total), saves an atomic `0600` CSV inside `~/imu-studio/exports/`, and publishes **`BLACKBOX_SAVED`** on `StudioEventBus`.
- **In-App Replay Viewer (`TabSaved` Smart Action Sheet)**: Open **`Saved & Replay`** on Home, select any CSV or Black-Box dump (`F`/`X`), and press **`Enter`** to launch the **Smart Action Sheet** (`Replay Trace`, `Inspect Summary`, `Delete Capture`).
  - Inside **Replay Viewer**, use **`Z`/`C`** to scrub the timeline cursor across pre-trigger (`t < 0 s`) and post-trigger (`t >= 0 s`) inertial peaks, **`Tab`** to switch plotted channels (`Accel G` / `Gyro °/s` / `Mag µT`), and **`Esc`** to return cleanly.

---

## 8. Expert Lab: Seismograph & Silent Tamper Guard (`STALTADetector`)

![Seismograph and Silent Tamper Guard](assets/imu-studio/seismo.png)

- Plots a live scrolling triaxial seismic waveform alongside the geophysical **STA/LTA** energy ratio (`0.3 s` short window vs. `4.0 s` long window), **`IMUTamperNet-1D`** real-time class probabilities, and the live **Black-Box `PreTriggerRing`** status badge.
- Press **`4 ARM`** to arm or disarm silent Tamper Guard, **`5 BBOX`** to arm/dump the Black-Box ring immediately, **`Z`/`C`** to adjust sensitivity (`LOW / MED / HIGH`), and **`6 CSV`** to archive an incident trace to `~/imu-studio/exports/`.

---

## 9. Expert Lab: Dual-Axis 3D-Printer Input Shaper (`DualShaperBundle` — Klipper / Creality K1C)

![3D-Printer Input Shaper Lab](assets/imu-studio/shaper.png)

![Dual-Axis Klipper Input Shaper](assets/imu-studio/shaper_dual.png)

- Mount CardputerZero rigidly onto a 3D-printer toolhead or bed (`5 MOUNT` → `Printer-X` / `Printer-Y`), run a frequency test sweep or rapid print infill pass, and inspect the `0–50 Hz` mechanical resonance peak.
- Press **`Tab`** to toggle between **Single-Axis Live Shaper** (`InputShaperRecommendation`) and **Dual-Axis `DualShaperBundle` (X + Y)**:
  - Record both **`X`** (`4 REC-X`) and **`Y`** (`5 REC-Y`) gantry resonances independently.
  - Automatically computes separate `shaper_type_x`/`shaper_freq_x` and `shaper_type_y`/`shaper_freq_y` recommendations, budgets the conservative global `[printer] max_accel = min(a_max_X, a_max_Y)`, and exports a ready-to-paste `printer.cfg` block (`6 EXPORT`) into `~/imu-studio/exports/`.
  - **Read-Only Moonraker Status Bridge**: Optionally query a local Klipper/K1C Moonraker host (`moonraker_url`) over read-only HTTP `GET` to inspect live printer `[input_shaper]` parameters without ever sending G-code (strictly gated by `confirm_net: true` in MCP).

---

## 10. Expert Lab: G-Force Traction Circle, Drop Shock Logger & Software Pedometer (`StepCounter`)

![G-Force Traction Circle and Drop Logger](assets/imu-studio/gforce.png)

- Plots real-time lateral (`X`) vs. longitudinal (`Y`) acceleration on a 2D automotive/EDC **G-G friction circle** with peak-hold trail (`Tab` cycles `±2g` / `±4g` / `±8g` traction ranges, Drop Shock Log, and the **Software Gait Pedometer**).
- Simultaneously runs an automatic **`DROP_SHOCK`** impulse monitor recording free-fall transitions and peak impact `G` timestamps for package shipping or equipment shock audits (`4 RESET` clears peaks).
- **Software Gait Pedometer (`StepCounter`)**: Runs a zero-allocation **`0.8–3.2 Hz`** bandpass filter over triaxial linear acceleration to count steps in pocket/hand carry, displaying live total steps, rolling **cadence (`spm`)**, and alternating left/right **stride symmetry (`%`)** (`4 RESET` zeroes session steps).

---

## 11. Expert Lab: Machine Baseline Drift, Raw 9-DoF & Secret Knock

![Machine Baseline Drift Comparison](assets/imu-studio/machines.png)

- **Machine Baseline Drift (`MachineProfile`)**: Select any saved machine profile (`F`/`X`) and press **`Enter`** to compare live velocity RMS, peak frequency shift, and **`IMUVibNet-1D`** 16D SupCon cosine distance against the stored healthy baseline — flagging early bearing wear or belt slip (`VIB_FAULT`). Press **`4 LEARN`** to capture a 3 s averaged FFT + QWERTY name or **`6 DEL`** to remove one.

![Raw 9-DoF IIO Telemetry Inspector](assets/imu-studio/raw9dof.png)

- **Raw 9-DoF IIO Telemetry**: Direct engineering view of `BMI270` (`ax/ay/az`, `gx/gy/gz`, die temperature) and `BMM150` (`mx/my/mz`), effective sample rate (`Hz`), IIO device paths, and active gyro/mag calibration offsets.

![Secret Knock Rhythm Matcher](assets/imu-studio/knock.png)

- **Secret Knock Matcher (`KnockMatcher`)**: Detects sharp surface taps via high-pass acceleration **jerk (`da/dt`)** and matches normalized inter-tap timing ratios invariant to slight tempo drift. Press **`4 ENROLL`** to record a 3–8 tap rhythm and emit **`KNOCK_MATCH`** events (pairable with `radio-bridge` to arm Tamper Guard, trigger a Black-Box dump, or send Wake-on-LAN!).

---

## 12. Expert Lab: Dual-Modal Wall & Material Tap X-Ray (`TapCaptureBuffer` + `IMUTapNet-1D`)

![Dual-Modal Wall and Material Tap X-Ray](assets/imu-studio/tap_inspect.png)

- **How It Works on Hardware**: Press CardputerZero flat against drywall, concrete, ceramic tile, a water/propane tank, or a wooden beam and knock firmly `3–10 cm` beside the chassis.
- **`TapCaptureBuffer`** triggers automatically on the sharp jerk onset, captures the `0.64 s` (`64`-sample @ `100 Hz`) structural ring-down tail, fits the exponential damping time constant **`τ (ms)`** and dominant flexural drum frequency **`f₀ (Hz)`**, and fuses them with the simultaneous calibrated **`BMM150` magnetic stud delta (`ΔµT`)**.
- **`IMUTapNet-1D` (Domain `20`)** classifies the surface (`Solid_Concrete`, `Hollow_Drywall`, `Wood_Stud`, `Metal_Stud_Pipe`, `Empty_Tank_Drum`, `Loose_Joint`), displays a live **`Hollowness%`** bar, emits **`TAP_MATERIAL`** on `StudioEventBus`, and lets you enroll custom reference surfaces (`4 ENROLL` + QWERTY label) to compare unknown tiles, beams, or liquid tank fill levels via 16D SupCon cosine similarity (`5 CMP`, `6 CLEAR`).

---

## 13. Expert Lab: Contactless BCG Pulse/Breathing, Soldering Hand-Steadiness & Keystroke Side-Channel (`IMUBioNet-1D`)

![Contactless BCG, Soldering Tremor and Keystroke Side-Channel Lab](assets/imu-studio/bio_sense.png)

> [!WARNING]
> **Strict Non-Medical & Local-Only Security Disclaimer**: Contactless **Ballistocardiography (BCG)** pulse/breathing estimates and **`4–12 Hz` physiological hand tremor** metrics are **strictly experimental and educational physics demonstrations** — CardputerZero is **NOT** a medical device and MUST NEVER be used for clinical diagnosis, health monitoring, or medical decisions. The **Desk Keystroke Side-Channel Demo** measures local table-vibration timing entropy strictly for physical-security awareness; it NEVER decodes, logs, or transmits typed characters.

Press **`Tab`** to switch between the three micro-motion sub-modes powered by **`IMUBioNet-1D` (Domain `21`)**:
1. **Contactless BCG Pulse & Breathing (`BCG`)**: Rest CardputerZero gently on your sternum while seated calmly and still. Isolates `3–15 mg` aortic blood-ejection recoil in the `0.7–3.0 Hz` cardiac band (`BPM` estimate + signal quality meter) and slow chest-wall motion in the `0.15–0.5 Hz` respiratory band (`BrPM`).
2. **Soldering Hand-Steadiness (`TREMOR`)**: Hold CardputerZero in your soldering posture for `3–5 s`. Quantifies **`4–12 Hz` physiological hand tremor** RMS (`mg` & `°/s`) and scores a `0–100` steadiness grade (`Steady`, `Mild Caffeine/Fatigue`, `Elevated Tremor`) before tackling fine-pitch SMD rework.
3. **Desk Keystroke Side-Channel Demo (`SIDECH`)**: Place CardputerZero flat on a wooden/composite desk near a keyboard and type normally. Visualizes how surface flexural shockwaves leak keystroke timing bursts and computes live **inter-keystroke interval (`IKI`) Shannon entropy (`bits`)** to demonstrate physical acoustic-mechanical side-channel leakage locally.

---

## 14. Expert Lab: 3D Air-Writing Magic Wand & `radio-bridge` Spell Rules (`StrokeRecorder` + `IMUGestureNet-1D`)

![3D Air-Writing Magic Wand and Spell Matcher](assets/imu-studio/gesture_wand.png)

- **Speed-Invariant 3D Spells**: Hold **`Enter`** (or softkey **`4 CAST`**), trace a 3D gesture in the air (`Circle_CW`, `Circle_CCW`, `Figure_8`, `Z_Slash`, `Checkmark`, `Triangle`, `Up_Flick`, `Down_Flick`), and release. **`StrokeRecorder`** rotates raw acceleration/gyro into the gravity-aligned world frame via `MadgwickAHRS` quaternions and resamples your stroke to `32` equidistant arc-length control points so fast and slow wand sweeps match identically!
- **Custom 16D SupCon Spells**: Press **`5 ENROLL`**, draw your own signature 3D motion twice, and name it with the built-in QWERTY keyboard (e.g., `Desk_Lights` or `Studio_Panic`). **`IMUGestureNet-1D` (Domain `22`)** matches both built-in spells and custom 16D cosine prototypes (`6 CLEAR` resets custom spells).
- **Cross-Studio `radio-bridge` Magic Wand Automation**: Every confident spell emits `imu_event: "GESTURE_MATCH"` with `imu_gesture: "<SpellName>"` on `StudioEventBus`. Example `~/.config/radio-bridge/triggers.json` rule waving `Circle_CW` to toggle a TV via `ir-studio` (or `Z_Slash` to wake a workstation via `wifi-studio` WoL):

```json
{
  "id": "wand-circle-tv-power",
  "enabled": true,
  "source": "imu-studio",
  "match": { "imu_event": "GESTURE_MATCH", "imu_gesture": "Circle_CW" },
  "actions": [{
    "target": "ir-studio",
    "tool": "ir_transmit_button",
    "confirm_tx": true,
    "params": { "remote": "LivingRoom_TV", "button": "Power" }
  }]
}
```

---

## 15. Opt-In MCP Server (`30` Tools over SSH) & `radio-bridge`

MCP is **disabled by default** (`mcp_enabled: false` in `~/.config/imu-studio/config.json`). Enable **MCP Server (`--mcp`)** inside **Settings**, then connect over SSH:

```bash
ssh zhenya@cardputerzero /usr/share/APPLaunch/bin/imu-studio --mcp
```

### Complete 30-Tool Reference
- **Sensing & Attitude (6)**: `imu_status` (includes `AutoBaselineWarmup` & loaded `.czml` model hashes), `imu_read_9dof`, `imu_attitude_snapshot`, `imu_compass_read`, `imu_tare_attitude`, `imu_mount_set`
- **Vibration & Engineering (5)**: `imu_vib_snapshot`, `imu_shaper_analyze`, `imu_shaper_dual` (`action: status|record_x|record_y|export_cfg|moonraker_status|clear`, `name`, `moonraker_url`, **`confirm_net: true`** for `moonraker_status`), `imu_machines_compare`, `imu_machines_manage` (`action: status|learn|delete|clear`, `confirm: true` for `delete`/`clear`)
- **Magnetics, Security, Gait & Events (8)**: `imu_mag_scan`, `imu_mag_tare`, `imu_tamper_status`, `imu_tamper_arm` (`armed`, `sensitivity`), `imu_gforce_status` (`action: status|reset`), `imu_knock_status` (`action: status|enroll|clear`), `imu_pedometer_status` (`action: status|reset`), `imu_events_poll` (`since_id`, `limit` — cursor-based `StudioEventBus` feed)
- **Unconventional EDC & Neural Suite (4)**:
  - `imu_tap_inspect` (`action: status|enroll|compare|clear`, `label`) — Dual-modal Tap X-Ray (`TapCaptureBuffer` + `IMUTapNet-1D` + `BMM150` stud fusion)
  - `imu_bio_assess` (`mode: bcg|tremor|sidechannel`) — Non-medical `IMUBioNet-1D` BCG pulse/breathing, `4–12 Hz` soldering steadiness, and local keystroke timing-entropy demo
  - `imu_gesture_assess` (`action: status|capture|enroll|clear`, `name`) — 3D Air-Writing Magic Wand (`StrokeRecorder` + `IMUGestureNet-1D` built-in & custom spells)
  - `imu_neural_suite` *(none)* — Inspects all 6 embedded `.czml` models (Domains `17–22`), SHA-256 digests, byte sizes, class labels, and hot-swap override state
- **Calibration, Black-Box & Storage (7)**: `imu_calibration_status`, `imu_calibration_gyro_bias`, `imu_calibration_reset` (`confirm: true`), `imu_blackbox_control` (`action: status|arm|disarm|dump_now`, `reason`), `imu_export_csv` (`name`), `imu_captures_list`, `imu_captures_delete` (`name`, `confirm: true`)

### `radio-bridge` Automation (`StudioIMU`)
`imu-studio` is registered in `radio-bridge` as `StudioIMU ("imu-studio")`:
- **Match criteria**: `imu_event` (`TAMPER_ALERT`, `DROP_SHOCK`, `MAG_ANOMALY`, `VIB_FAULT`, `KNOCK_MATCH`, `BLACKBOX_SAVED`, `TAP_MATERIAL`, `GESTURE_MATCH`), `imu_machine`, and **`imu_gesture`** (exact case-insensitive match for built-in spells like `"Circle_CW"`, `"Z_Slash"`, `"Figure_8"` or custom spell names).
- **Allowlisted actions**: `imu_vib_snapshot` (non-TX), `imu_export_csv` (non-TX), `imu_tamper_arm` (non-TX), and `imu_blackbox_control` (non-TX — allowing e.g. `wifi-studio` `MOTION_DETECTED`, `imu-studio` `TAMPER_ALERT`, or a custom 3D Magic Wand spell to trigger an instant `5 s pre + 10 s post` Black-Box dump, or waving a spell to fire allowlisted `ir-studio` / `wifi-studio` WoL actions with `confirm_tx: true`).
