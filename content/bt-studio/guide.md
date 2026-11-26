# BT Studio — App Guide & Controls (`v0.4.1`)

**BT Studio** (`bt-studio`) turns CardputerZero's onboard **Cypress Bluetooth 5.2 Dual-Mode (`hci0`)** transceiver and **BlueZ 5.82** stack into a beginner-friendly, non-root pocket Bluetooth analyzer powered by an embedded **4-model Pure-Go INT8 `.czml` Neural Suite** (`BTDeviceNet v2`, `BLEPayloadNet-1D`, `BTSeqNet-1D`, `BTAnomalyAE` — `0 allocs/op`): **Guided Quick Missions**, **Proximity Tap-to-Select (`< 30 cm`)**, **Smart Action Sheet**, **Learn My Room (`NEW ONLY`) baseline**, **GATT Security Grade (`A–F`)** auditor, **Neural Live Notify Byte-Diff**, **GATT Honeypot** mock peripheral, 46-key QWERTY **BLE/SPP serial terminal**, non-root **Classic L2CAP/SDP probe**, Wireshark `.btsnoop` exporter, temporal anti-stalking tracker guard, Kalman Foxhunt locator, and passive IoT sensor monitor.

> [!WARNING]
> **Authorized Security Research Disclaimer**: Active GATT probing/writes, GATT Honeypot peripheral emulation, BLE/SPP UART TX, Classic L2CAP/SDP probing, BLE advertising, and active Quick Missions are strictly for **authorized security research, protocol development, and testing on your own devices**. An explicit in-app confirmation modal (`ResearchAck`) gates first use, and active BLE TX / Honeypot / Notify / UART / Mission sessions automatically tear down on leaving their screen.

---

## 1. Home Menu (Live Verdict Banner & Simple vs. Expert Mode)

![BT Studio Home Menu](assets/bt-studio/home.png)

- **Live Home Verdict Banner**: The top status bar translates live Bluetooth telemetry into plain English — **emerald** (`All clear · N nearby · M sensors`), **amber** (nearby unknown tracker or unfamiliar `[NEW]` devices since your room baseline), or **red** (BLE Spam flood or untrusted `FOLLOWING` tracker).
- Starts in **Simple Mode** (**7** everyday screens, starting with **`Quick Missions`** at **#1**): `Quick Missions`, `BLE & BT Radar`, `Tracker & Privacy Guard`, `RSSI Foxhunt`, `BLE Sensors Live`, `Saved & Captures`, and `Settings`.
- Press **`5 EXPERT`** on Home (or toggle in Settings) to unlock **+6 Research Labs**: **GATT Explorer & Audit**, **Beacon & GATT Honeypot**, **BLE/SPP Terminal**, **Classic L2CAP / SDP**, **Airspace Activity & IDS**, and **Presence & Scripts**.
- **Context-Aware Help (`H`)**: Press **`H`** on any screen, overlay, or active mission stage (or **`7 HELP`** on Home) to open a screen-specific Help modal with a 2-line summary card, cyan **`4`..`8`** softkey badges, amber hotkey badges, and automatic **`Z`/`C`** pagination (`H` / `Enter` / `Esc` closes).

---

## 2. Quick Missions (5 Guided 3-Step Wizards)

![BT Studio Quick Missions Menu](assets/bt-studio/missions.png)

Open **`Quick Missions`** (`#1` on Home) to execute real Bluetooth security and reverse-engineering workflows in 3 guided steps — no need to memorize 12 separate tabs:

1. **Check Room for Trackers**: Runs a focused 10 s passive sweep and prints a plain-English verdict (`ALL CLEAR` vs `1 SUSPECT TAG`) enriched with **`BTSeqNet-1D`** trajectory badges (`CO-MOVING %` red vs `STATIONARY` emerald vs `SPOOF ANOM` amber). Press **`4 HUNT`** to launch Kalman Foxhunt immediately or **`5 PCAP`** to export forensic `.btsnoop` evidence.
2. **Audit My Gadget (Tap)**:
   - *Step 1 (Proximity Tap-to-Select)*: Hold your own BLE gadget within **20–30 cm** of CardputerZero (`RSSI >= -50 dBm`) to auto-lock it without hunting through MAC addresses — or press **`5 PICK`** to manually select the strongest visible device if a low-TX gadget peaks near `-60 dBm`.
   - *Step 2*: Confirms the Authorized Research Disclaimer and runs a full GATT discovery + `AuditGattProfile`.
   - *Step 3*: Displays a large **`GRADE A–F`** security scorecard and one-line plain-English risk verdict:

![Quick Mission GATT Security Grade Scorecard](assets/bt-studio/mission_grade.png)

   - Press **`4 SAVE+PCAP`** to archive `.btjson` + `.btsnoop`, or **`5 BYTE-DIFF`** to jump straight into Live Notify reverse engineering.
3. **Decode BLE Button (Tap)**: Tap-to-Select your BLE remote/sensor → auto-connects and subscribes to the first `notify` characteristic → prompts *"Press button / trigger sensor now!"* while running **`BLEPayloadNet-1D`** neural per-byte coloring (`INT16_LE/BE` cyan, `CRC_OR_ENC` magenta, `BTN_FLAG` amber/red, `SEQ_CTR` green) alongside the zero-alloc **`Smart Field Guesser`** + **`6 PCAP`** export.
4. **Spy on Companion App**: Tap-to-Select (or load a saved `.btjson` capture) → auto-clones the GATT tree into a live **GATT Honeypot** → prompts *"Open mobile app now"* and streams intercepted cleartext `READ`/`WRITE` commands (`~/bt-studio/honeypot_log.jsonl`) with guaranteed auto-teardown on `Esc`.
5. **Learn My Room (Baseline)**: Captures your normal room/office ambient devices for 8 s and saves `~/.config/bt-studio/known_env.json` (`0600`). Press **`4 VIEW NEW`** to jump directly into Radar filtered to **`NEW ONLY`** (hiding ~90% of household background noise), or **`5 CLEAR`** to reset the baseline.

> [!TIP]
> **Try it on hardware in 30 seconds**: Open **Quick Missions → Learn My Room (Baseline)** and wait 8 s while your normal desk devices are idle. Press **`4 VIEW NEW`** — Radar clears out familiar ambient devices. Now wake up a spare Bluetooth gadget or smartwatch and watch it pop up instantly with a **`[NEW]`** badge!

---

## 3. BLE & BT Radar, 18-Class `BTDeviceNet v2`, `[ANOM]` & Smart Action Sheet

![BLE & BT Radar](assets/bt-studio/radar.png)

- Live non-root BlueZ `DuplicateData` scan combining BLE and Classic BR/EDR devices with:
  - **18-Class `BTDeviceNet v2` Humanized Labels**: Unnamed RPA devices automatically resolve using raw 31-byte AD + tabular fusion (`[AUD] Apple Earbuds`, `[TAG] AirTag / FindMy`, `[WCH] Apple Watch`, `[SNS] BTHome Sensor`, `[LOC] Smart Lock`, `[DEV] ESP32/nRF DevBoard`, `[LAB] Flipper / Research`, `[CAR] OBD-II Car`, `[IOT] Smart Light`).
  - **Evil-Twin `[ANOM]` Autoencoder Badge (`BTAnomalyAE`)**: Devices whose RF/AD feature reconstruction error exceeds **`AnomalyZ >= 3.2σ`** display a red **`[ANOM]`** warning tag directly on Radar so spoofed beacons and Evil-Twin clones stand out immediately.
  - **Proximity Zones**: Plain-English distance tags (`TOUCH` `<0.3m`, `NEAR` `~1m`, `ROOM` `~4m`, `FAR` `>8m`) alongside **`P:0..99`** Privacy Exposure Score.
  - **`[NEW]` Badge & Filters (`4`)**: Cycle `ALL / BLE / BR-EDR / NAMED / TRACK / NEAR / NEW` (`NEAR` isolates `RSSI >= -52 dBm`; `NEW` hides known baseline devices from `Learn My Room`).
  - **`5 RSSI/PRIV/NAME`**: Sort by signal strength, Privacy Exposure Score, or name.
- **Smart Action Sheet (`Enter`)**: Pressing **`Enter`** on any device opens a context-aware action menu showing only the **3–5 most relevant actions** for *that* device's detected capabilities (e.g., Tracker → Foxhunt/Trust; BLE NUS → Serial Terminal; Classic → L2CAP/SDP + SPP; Connectable IoT → GATT Audit / Byte-Diff / Honeypot Clone; Sensor → Live Sensor Card):

![Smart Action Sheet on Radar](assets/bt-studio/radar_actions.png)

- Navigate actions with `F`/`X`, press **`Enter` / `4 RUN`** to launch directly into the target lab with MAC and transport pre-filled (active RF actions automatically check `ResearchAck`), or press **`5 INFO`** to open the full **Device Privacy Dossier** — which displays the **`BTAnomalyAE`** diagnostic line (`RF ANOMALY: 4.1σ (Timing/Jitter mismatch)`) whenever a device is flagged:

![Device Privacy Inspector](assets/bt-studio/radar_inspect.png)

---

## 4. Tracker & Privacy Guard (`BTSeqNet-1D` Trajectory & BLE Spam IDS)

![Tracker & Privacy Guard](assets/bt-studio/tracker.png)

- Monitors untrusted **Apple FindMy / AirTag**, **Samsung SmartTag**, **Tile**, **Chipolo**, and **Google FMDN** trackers.
- Correlates **RPA MAC rotations** using key prefixes and **`BTDeviceNet v2`'s 16D SupCon embedding** so rotating MACs still accumulate duration (`FOLLOWING` / `WATCH` / `SAFE`).
- Runs **`BTSeqNet-1D`** over 64-second rolling RF + ambient crowd-churn trajectories and displays a live trajectory badge: **`CO-MOVING 91%`** (red) when a tag persists across changing surroundings, **`STATIONARY`** (emerald) for harmless neighbor tags, or **`SPOOF ANOM`** (amber) for abnormal beacon spoofing.
- Runs an online EWMA **BLE Spam / Continuity Flood IDS** (Burst-Freeze) and logs confirmed incidents to `~/bt-studio/alerts.jsonl` (`5 LOG`, `6 CLEAR`).

---

## 5. RSSI Foxhunt (1D-Kalman Proximity & Geiger) & Passive Sensors

![RSSI Foxhunt](assets/bt-studio/foxhunt.png)

- Smooths noisy BLE RSSI through a zero-allocation **1D Kalman filter** into **`CLOSER`** (emerald), **`FARTHER`** (amber), or **`STEADY`** (cyan) plus a Log-Distance Path Loss meter estimate and 60-sample sparkline. Press **`4 GEIG`** for optional audio clicks.

![BLE Sensors Live](assets/bt-studio/sensors.png)

- Passively decodes unencrypted environmental & smart-home broadcasts without pairing: **BTHome v2 (`0xFCD2`)**, **Xiaomi MiBeacon (`0xFE95`) / ATC1441 / PVVX (`0x181A`)**, **RuuviTag RAWv2 (`0x0499`)**, **Govee (`0xEC88`)**, and **Eddystone-TLM (`0xFEAA`)**.

---

## 6. Expert Lab: GATT Security Grade (`A–F`) & Neural Live Notify Byte-Diff

![GATT Security Posture Audit](assets/bt-studio/gatt_audit.png)

- **GATT Explorer & Security Grade (`A–F`)**: Press **`4 SCAN`** to connect to your target device, enumerate services/characteristics, read readable values (UTF-8 + HEX), and press **`6 AUDIT`** to display a bold **`GRADE A–F`** badge and plain-English summary at the top of the Audit card alongside unauthenticated `write` / `write-without-response` findings. Use **`Space`** for confirmation-gated `0x01` write probes and **`7 SAVE`** to archive the full GATT audit as `.btjson`.

![GATT Live Notify Byte-Diff](assets/bt-studio/gatt_notify.png)

- **Live Notify Stream + `BLEPayloadNet-1D` Neural Per-Byte Coloring**: Select any characteristic and press **`Enter` or `5 SUB`** to subscribe to live notifications (`StartNotify`).
  - Once `>= 4` packets arrive, **`BLEPayloadNet-1D`** classifies every byte offset at **`0 allocs/op`** and color-codes the hex grid: **`INT16_LE` / `INT16_BE`** multi-byte sensor pairs in **cyan**, **`CRC_OR_ENC`** checksums / encrypted payloads in **magenta**, **`BTN_FLAG`** hardware button bits in **amber/red**, and **`SEQ_CTR`** counters in **green**.
  - The live **`AI:`** banner (`AI: INT16_LE@2-3 BTN@4 CRC@5 | Checksummed (95%)`) summarizes detected fields, stream archetype (`Plaintext_Sensor`, `Button_Control`, `IMU_MultiAxis`, `ASCII_Serial`, `Checksummed_Frame`, `Encrypted_Random`), and complements the instant **`GUESS:`** heuristic bar.
  - The bottom diff inspector displays the exact offset, transition (`0x44 -> 0x45`), **`XOR` bitmask**, historical `[min..max]` bounds, change count, and ASCII preview.
  - Press **`4 PAUSE/RESUME`**, **`5 CLEAR`** to reset counters, or **`6 PCAP`** to export the full notification sequence as a Wireshark-native `.btsnoop` capture!

---

## 7. Expert Lab: Beacon TX & GATT Honeypot Clone Server

![Beacon & Adv Lab](assets/bt-studio/beacon.png)

- Press **`6 MODE`** or **`Tab`** inside **Beacon & GATT Honeypot** to switch between **BEACON TX** (single-instance `iBeacon`, `Eddystone-URL`, `Virtual BTHome v2`, `Clone Saved Capture (1x)`, `Custom AD`) and **GATT HONEYPOT**:

![GATT Honeypot Clone Server](assets/bt-studio/honeypot.png)

- **GATT Honeypot (`GattManager1.RegisterApplication`)**: Choose any built-in lab template (`SmartLock_Mock`, `Nordic_NUS_Sink`, `IoT_Config_Portal`) or any **saved `.btjson` capture** with `F`/`X`, then press **`4 START`**.
- CardputerZero registers the full GATT service/characteristic hierarchy plus a connectable peripheral advertisement so companion smartphone apps discover, connect, and send commands directly to CardputerZero!
- Every incoming `READ` and `WRITE` payload appears live on screen and appends to `~/bt-studio/honeypot_log.jsonl`. Press **`5 PCAP`** to export intercepted ATT packets to Wireshark `.btsnoop`. Leaving the tab unconditionally unregisters the GATT application and advertisement.

---

## 8. Expert Lab: 46-Key QWERTY BLE/SPP Terminal & Classic L2CAP / SDP

![BLE/SPP Serial Terminal](assets/bt-studio/terminal.png)

- **BLE/SPP Terminal**: Talk directly to **BLE Nordic UART (`NUS`, `6E400001-...`)** devices (ESP32, nRF52) or **Classic Bluetooth SPP (`RFCOMM` channels `1..30`)** modules (HC-05, ELM327 OBD-II).
  - In **`[KEYS]`** mode: `F` toggles `BLE NUS` vs `SPP`, `X` increments RFCOMM channel, `Z`/`C` picks target MAC, **`4 CONN/DISC`** connects, **`5 MACRO`** sends quick presets (`AT`, `ATI`, `ATZ`, `010C`, `HELP`, `STATUS`), **`6 HEX/ASC`** toggles HEX display, **`7 CLR`** clears scrollback.
  - Press **`Tab`** to toggle **`[TYPE]`** mode for full Shift-aware 46-key QWERTY typing (`Enter` sends `\r\n`, `Backspace` edits, `Up/Down` recalls macros, `Esc` clears or exits `[TYPE]`).

![Classic L2CAP RTT & Native SDP Probe](assets/bt-studio/classic_sdp.png)

- **Classic L2CAP / SDP Probe**: Pure-Go non-root `AF_BLUETOOTH` `SOCK_SEQPACKET` (`PSM 0x0001`) reachability ping & RTT measurement (detects powered-on hidden/non-discoverable Classic devices) plus a native **SDP `PDU 0x06`/`0x07`** service parser showing exact **RFCOMM channel badges (`RFCOMM:1`, `RFCOMM:3`)**.
- Press **`4 PROBE`** on any target MAC, then press **`5 SPP`** to jump directly into the **BLE/SPP Terminal** pre-configured for that MAC and discovered RFCOMM channel!

---

## 9. Wireshark `.btsnoop` Export, MCP Server (`31` Tools) & `radio-bridge`

- **Wireshark Export (`~/bt-studio/exports/*.btsnoop`)**: Press **`6 PCAP`** in **Saved & Captures** (live Radar LE Advertising Reports), **`6 PCAP`** in **GATT Live Notify** (ATT `0x1B` Notifications), **`5 PCAP`** in **GATT Honeypot** (ATT `0x12` Write Requests / `0x0B` Read Responses), or **`4 SAVE+PCAP` / `5 PCAP`** directly inside Quick Missions. Copy `.btsnoop` off CardputerZero and open directly in Wireshark for native HCI/L2CAP/ATT dissection!
- **Hot-Swap Neural Models**: Drop verified custom `.czml` overrides into `~/.config/bt-studio/models/` (`bt_device_v2.czml`, `bt_payload_v1.czml`, `bt_seq_v1.czml`, `bt_anomaly_ae_v1.czml`); see the **[ML: 4-Model INT8 Neural Suite](#bt-ml)** deep-dive for full architecture details.
- **MCP Server (`--mcp` over SSH)**: Disabled by default (`mcp_enabled: false`). Enable in **Settings**, then connect:
  ```bash
  ssh zhenya@cardputerzero /usr/share/APPLaunch/bin/bt-studio --mcp
  ```
  Exposes **31 typed tools**:
  - All 28 v0.3.0 tools — with **`bt_status`** reporting all 4 `.czml` models/hashes, **`bt_device_inspect`** enriched with `anomaly` (`BTAnomalyAE`), **`bt_tracker_audit`** enriched with `seq_ai` (`BTSeqNet-1D`), and **`bt_gatt_notify_sample`** enriched with `neural_analysis` (`BLEPayloadNet-1D`).
  - **+3 v0.4.0 Neural Suite Tools**:
    - `bt_payload_analyze` (`samples_hex` optional — defaults to active live Notify buffer) — runs `BLEPayloadNet-1D` returning per-byte roles (`INT16_LE`, `CRC_OR_ENC`, `BTN_FLAG`, etc.), stream archetype, `encrypted_suspect`, and `has_checksum`.
    - `bt_seq_assess` (`address` optional) — runs `BTSeqNet-1D` on a tracked device or global airspace returning behavior class (`Co_Moving_Tracker`, `Stationary_Ambient`, `BLE_Spam_Flood`, etc.) and calibrated `stalk_risk`.
    - `bt_anomaly_scan` (`min_z`, default `3.2`) — scans all visible Radar devices with `BTAnomalyAE` and returns Evil-Twin / spoofed-advertisement suspects with `anomaly_z` and `fault_reason`.
- **`radio-bridge` Integration**: `bt-studio` is registered as `StudioBT ("bt-studio")` so cross-studio rules can match `bt_address`, `bt_event` (`ON_ENTER`/`ON_BUTTON`), or `bt_tracker_verdict` (`FOLLOWING`) and trigger allowlisted actions (`bt_beacon_start`, `bt_beacon_stop`, `bt_export_btsnoop`, `bt_classic_probe`).
