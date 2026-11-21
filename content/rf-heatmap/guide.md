# RF Heatmap — App Guide & Controls

**RF Heatmap** (`rf-heatmap`) is a pure-Go, zero-dependency Sub-GHz spectrum analyzer, thermal waterfall, RSSI oscilloscope, OOK protocol decoder, and Flipper `.sub` library built specifically for the **M5Stack CardputerZero** (`320×170` framebuffer `/dev/fb0`) and **Cap CC1101**.

It ships with on-device **Smart Squelch** and **Auto-Lock** machine learning enabled out of the box, letting you spot and capture bursts even in noisy urban RF environments.

---

## Header Status Bar & Badges

Every screen shares a compact top status bar (`y = 0..17`) showing live radio state at a glance:

| Badge | Color | Meaning |
| --- | --- | --- |
| `RF-HEAT` | Cyan | Application identifier |
| `HEATMAP` / `PULSE` / `DECODE` / `SAVED` / `PROBE` / `SET` | Cyan outline | Currently active mode tab |
| `433.92M AM650` | White | Active tuned frequency (MHz) and modulation preset |
| `ASQ` | **Green** (ON) / Gray (OFF) | **Auto Squelch** (on-device ML adaptive threshold). Toggle with `S`. |
| `LOCK` | **Cyan** (ON) / Gray (OFF) | **Auto-Lock** (automatically snaps cursor to `z ≥ 4.0` bursts). Toggle with `L`. |
| `CC1101` / `SIM` | **Green** (`CC1101`) / **Amber** (`SIM`) | Live SPI CC1101 hardware detected vs. built-in realistic RF simulator mode |

---

## The 4 Modes (Tabs)

Switch between modes at any time using `Tab` or bottom key `8 (MODE)`.

### 1. HEATMAP — Spectrum Analyzer & Thermal Waterfall

![RF Heatmap — Spectrum and Thermal Waterfall](assets/rf-heatmap/heatmap.png)

The **HEATMAP** tab sweeps up to **36 frequency bins** across the selected ISM band (`433 ISM`, `868 EU`, `315 US`, `915 ISM`, or `ALL ISM`) and displays two synchronized views:

- **Top Info Strip**:
  - Band name (e.g., `433 ISM`).
  - `PK 433.92M -46dBm` — strongest peak frequency and RSSI seen recently.
  - `Z+12.4` (magenta, shown during active bursts) — live anomaly Z-score from the per-bin ML baseline.
  - `CUR 433.92M` (white) or `LCK 433.92M` (green when **Auto-Lock** has snapped onto an active burst).
- **Live Spectrum Bars (top chart)**:
  - Vertical bars show instantaneous RSSI per bin.
  - **Amber ticks** mark slowly decaying **Peak-Hold** levels.
  - **Gray ticks** mark each bin's learned EWMA noise floor (`μ_i`).
  - **Magenta ticks** mark each bin's adaptive Smart Squelch threshold (`μ_i + k·σ_i`) when `ASQ` is ON.
  - **Cyan frame** highlights the active cursor bin.
- **Thermal Waterfall (bottom chart)**:
  - Scrolls 56 rows of history downward using an Inferno thermal palette: **Deep Navy (`-110 dBm`) → Purple → Orange → Bright Yellow (`-35 dBm`)**.
- **Bottom Nav Bar (`4..8`)**: `4 HOLD/RUN` · `5 BAND` · `6 LOCK` · `7 MOD` · `8 MODE`.

### 2. PULSE — RSSI Oscilloscope & RAW Capture

![RF Heatmap — PULSE Oscilloscope and RAW Capture](assets/rf-heatmap/pulse.png)

Pressing `Enter` or `6 (LOCK)` from **HEATMAP** locks onto the strongest peak (if `PeakDBm > -85 dBm`, otherwise the cursor frequency) and jumps straight into **PULSE**:

- **Top Card**: Large tuned frequency readout (`433.92 MHz`), live RSSI in `dBm` (turns **green** whenever signal ≥ effective squelch), `AUTO SQ` + live `Z:+x.x` readout when warmed up, and status line showing effective squelch (`ASQ:-88dBm(k3.5)` or `SQ:-78dBm`) and captured RAW pulse count.
- **Scrolling RSSI Oscilloscope (64 samples)**:
  - **Dotted gray line**: Learned EWMA noise floor (`μ`).
  - **Dashed cyan line** (Auto Squelch) or **dashed amber line** (Manual Squelch): Active squelch gate.
  - **Green bars**: Samples crossing above squelch.
- **Fine Tuning**: Use `Z` / `C` to step frequency by `±50 kHz` (resets the single-channel noise baseline automatically), and `F` / `X` to tune Smart Squelch sensitivity `k` (`2.0` to `6.0` in `0.5` steps) or manual squelch (`±2 dBm`).
- **Bottom Nav Bar (`4..8`)**: `4 REC/STOP` · `5 TX` · `6 SAVE` · `7 MOD` · `8 MODE`.

### 3. DECODE — Live OOK, Rolling-Code & Sensor Analyzer

![RF Heatmap — DECODE Live OOK Protocol Analyzer](assets/rf-heatmap/decode.png)

The **DECODE** tab listens on the tuned frequency and automatically decodes fixed-code and rolling-code OOK remote frames (`Princeton`, `PT2262` tri-state, `EV1527`, `CAME 12/24-bit`, `Linear 10-bit`, `Holtek HT12E/HT6P20B`, `Nice FLO 12/24-bit`, `KeeLoq / HCS301 66-bit`, and `Somfy Telis 56-bit Manchester RTS`):

- **Top Highlight Box**: Displays the most recently decoded frame — protocol name, bit length, base pulse width `TE (µs)`, hex key (plus PT2262 tri-state string when valid), and magenta `ML-CLEAN` badge when recovered by 1D K-Means denoising.
- **Active Rolling-Code Detector & 2-Step Replay Guard**: Automatically flags `KeeLoq`, `Somfy Telis`, and consecutive captures with matching serial/timing + hopping encrypted payloads using an amber **`ROLLING`** pill badge (`SER:<hex> HOP:<hex>` or `CNT:<hex>`). Pressing `5 (TX)` warns before transmitting (`ROLLING CODE! TX may desync - 5 again`); pressing `7 (CLR)` clears the log and resets the detector.
- **TPMS & Weather Station `SENSORS` Sub-View (`R`)**: Press **`R`** in `DECODE` to monitor automotive **TPMS** (`Schrader` / `Toyota` on `433.92 MHz` or `315 MHz` using the CC1101 **`GFSK99`** preset) and **433 MHz Weather Stations** (`Oregon Scientific`, `Acurite`, `LaCrosse`). Press `5 (UNIT)` to toggle `kPa/°C` ↔ `PSI/°F`, `6 (PROF)` / `B` to switch sensor profiles, and `Esc` / `8 (BACK)` to return and restore your previous preset.
- **Save as `.sub` Key File**: Press `6 (SAVE)` to write a Flipper-compatible `Flipper SubGhz Key File` directly into `~/rf-heatmap/captures/`.
- **Bottom Nav Bar (`4..8`)**: `4 HOLD/RUN` · `5 TX` · `6 SAVE` · `7 CLR` · `8 MODE`.

### 3b. Full-Screen FOXHUNT Geiger Mode (`G`) & RAW Trimmer (`T`)

- **FOXHUNT Geiger Mode (`G` from `HEATMAP` or `PULSE`)**: Locks onto a single carrier frequency with a full-width thermal RSSI bar, amber peak-hold marker, Kalman `^CLOSER` / `vFARTHER` proximity readout, and 12-segment visual/audio Geiger tick cadence (`0–20 Hz`). Use `Z/C` for `±50 kHz` tuning, `4 (RST PK)` to reset peak-hold, `5 (MUTE)` to mute clicker output, and `Esc` / `8 (BACK)` to exit immediately without quitting the app.
- **On-Device RAW Trimmer & Repeater (`T` from `PULSE` or `SAVED`)**: Displays a pulse-activity minimap highlighting `[START..END]` burst bounds (auto-suggested via `5 AUTO`), adjusts repeat count `1x..10x` with `F/X`, enforces strict `+high / -low` sign alternation, and saves atomically (`7 SAVE`) strictly into `~/rf-heatmap/captures/` (never modifying read-only `databases/`).

### 4. SAVED — User `.sub` File Library

![RF Heatmap — SAVED File Library](assets/rf-heatmap/saved.png)

The **SAVED** tab manages your personal **User Library** strictly inside `~/rf-heatmap/captures/` (read-write). External database packs live separately and can never be accidentally deleted here:

- Use `F` / `X` to scroll through saved captures showing filename, frequency (`MHz`), and protocol (`RAW`, `Princeton`, `CAME`, `Linear`).
- Press `4 (TX)` or `Enter` to transmit asynchronously over CC1101 GDO0, `5 (LOAD)` to load the file's frequency into **PULSE**, `6 (DEL)` to delete the file, or `7 (PURGE)` (press twice within 3 s) to bulk-remove RAW captures classified as **Noise** by the on-device MLP.
- **Bottom Nav Bar (`4..8`)**: `4 TX` · `5 LOAD` · `6 DEL` · `7 PURGE` · `8 MODE`.

### 5. PROBE — Auto-Probe & External Databases

![RF Heatmap — PROBE Auto-Search & Databases](assets/rf-heatmap/probe.png)

The **PROBE** tab lets you automatically step through Flipper-compatible `.sub` packs at a configurable interval — ideal when you lost a remote and want to find which signal in a database triggers your device:

- **Separated Read-Only Databases & Built-In Generators**: Drop external Flipper `.sub` folders into `~/rf-heatmap/databases/<pack>/` (legacy `~/subg/files/` is also mounted read-only), or probe **without any database files** using built-in O(1) **Virtual Generator Packs** (`GEN:CAME-12` 4096 keys @ 433.92 MHz, `GEN:Linear-10` 1024 keys @ 315.00 MHz, `GEN:CAME-868` 4096 keys @ 868.35 MHz — press `B` to cycle frequency `315/433.92/868.35/915 MHz` and `M` for modulation). Press `7 (PACK)` to cycle `DB:*` → `GEN:*` → `USER`.
- **Configurable Interval (`0.05s–5.0s`)**: Press `Z` / `C` (or `5 INT-` / `6 INT+` while running) to adjust the delay between probes (`0.05s`, `0.1s`, `0.3s`, `0.5s`, `1.0s`, `1.5s`, `2.0s`, `3.0s`, `5.0s`), automatically persisted to `config.json`.
- **Instant Stop & Reaction-Time Rewind**:
  1. Press `4 (AUTO)` or `Space` to start Auto-Probe from the current cursor.
  2. The moment your target device reacts, hit **`4 (STOP)`**, **`Space`**, or **`Enter`** — transmission cancels immediately and the session enters **`PAUSE`**.
  3. Because human reaction takes 0.5–2 seconds, **PROBE** marks the last sent entry with a green **`>`** and the previous **12** sent entries with amber **`*`** glyphs (covering fast `0.05s–0.1s` generator sweeps too).
  4. Walk back up the list with **`F` / `X`**, press **`Enter`** or **`5 (TRY)`** to single-fire the highlighted candidate until you isolate the exact match.
  5. Press **`6 (SAVE)`** to copy the winning `.sub` from the read-only external pack into your personal `~/rf-heatmap/captures/` User Library.
- **Bottom Nav Bar (`4..8`)**:
  - Idle/Paused: `4 AUTO/CONT` · `5 TRY` · `6 SAVE` · `7 PACK` · `8 MODE`
  - Running: `4 STOP` · `5 INT-` · `6 INT+` · `7 PACK` · `8 MODE`

#### Finding & Adding Relevant `.sub` Databases

Before downloading large archives, use this four-step checklist to find focused, relevant Sub-GHz packs for your target device:

1. **Confirm the Target Uses Sub-GHz RF (Not IR or 2.4 GHz)**:
   - Check the device label or original remote's **FCC ID** (look it up on `fccid.io`) for an ISM frequency: **`315 MHz`**, **`433.92 MHz`**, **`868.35 MHz`**, or **`915 MHz`**.
   - Most wall-mounted air conditioners and TVs use **38 kHz Infrared (IR)** rather than Sub-GHz RF — a CC1101 transceiver can only trigger RF-controlled appliances (ceiling fans, RF blinds/shutters, RF outlets, LED controllers, doorbells, barriers, and RF heaters/ACs).
2. **Identify Brand, Model & Modulation**:
   - Knowing the brand (e.g., *Hunter*, *Harbor Breeze*, *Sonoff RF*, *CAME*, *Dooya*) and band (`433.92 MHz` vs `315 MHz`) lets you pull a targeted 10–300 file subfolder instead of probing thousands of unrelated signals.
   - If the device uses a short fixed-code protocol (`CAME 12-bit` or `Linear 10-bit`), you do not even need a database — use the built-in **`GEN:CAME-12`**, **`GEN:Linear-10`**, or **`GEN:CAME-868`** virtual packs directly in **PROBE**.
3. **Where to Search for Quality Flipper `.sub` Collections**:
   - **Curated Community Repositories**:
     - `https://github.com/UberGuidoZ/Flipper` — well-organized subfolders under `Sub-GHz/` (`Ceiling_Fans`, `Remote_Outlet_Switches`, `LED`, `Doorbells`, `Smart_Home_Remotes`, `Fans`, `Air_Filtration`, `Thermostat`).
     - `https://github.com/Zero-Sploit/FlipperZero-Subghz-DB` — community-aggregated `.sub` packs.
     - `https://github.com/djsime1/awesome-flipperzero` — curated index linking to specialized Sub-GHz collections.
   - **Targeted GitHub Code Search Queries**:
     - By device brand: `path:*.sub "Flipper SubGhz" "<brand>"`
     - By exact frequency & protocol: `path:*.sub "Frequency: 433920000" "Protocol: Princeton" "<device>"`
4. **Register Only the Relevant Subfolder (`sources.json` or MCP)**:
   - Add a targeted `subpath` in `~/.config/rf-heatmap/sources.json` (or via MCP `rf_add_source` with a `github_url`), then run **`rf-heatmap --sync`** or **`SET → Sync DB Sources`**. Each source syncs into its own read-only folder (`~/rf-heatmap/databases/<id>/`), and subsequent syncs use HTTP `ETag` (`304 Not Modified`) and per-file `SHA` tracking (`.sync-state.json`) to download only new or changed files:

```json
[
  {
    "id": "ceiling_fans",
    "type": "github",
    "owner": "UberGuidoZ",
    "repo": "Flipper",
    "branch": "main",
    "subpath": "Sub-GHz/Ceiling_Fans",
    "enabled": true
  }
]
```

> [!TIP]
> Always point `subpath` at a specific device category folder (e.g. `Sub-GHz/Ceiling_Fans` instead of the entire repo root). Smaller, focused packs probe faster, keep RAM usage minimal on CardputerZero, and make reaction-time backtracking in **PROBE** much easier.

### Built-in 5-Page Help Overlay (`H`)

![RF Heatmap — Built-in Help Overlay](assets/rf-heatmap/help.png)

Press `H` at any time to open the 5-page on-device quick reference covering controls, waterfall interpretation, squelch/modulation, Auto-Probe & databases, and decode/saved workflows. Flip pages with `Z` / `C` (or `Space` / `Tab`) and close with `H`, `Enter`, or `Esc`.

---

## Complete Keyboard Controls

CardputerZero uses a compact 46-key layout where `F/X/Z/C` act as directional arrows and `4–8` map directly to the 5 bottom-bar softkeys.

| Key | Global / Mode Action |
| --- | --- |
| `4` `5` `6` `7` `8` | Trigger the 5 bottom navigation bar softkeys for the current tab |
| `Tab` or `8` | Cycle mode: `HEATMAP → PULSE → DECODE → SAVED` |
| `F` / `X` (`↑` / `↓`) | **HEATMAP**: Cycle band (`F`) / Clear Peak-Hold (`X`) · **PULSE**: Adjust Smart Squelch `k` (`±0.5`, range `2.0–6.0`) or Manual Squelch (`±2 dBm`) · **SAVED**: Move list selection up/down |
| `Z` / `C` (`←` / `→`) | **HEATMAP**: Move cursor bin left/right (activates 15-sweep Auto-Lock cooldown) · **PULSE**: Fine-tune frequency `-50 kHz` / `+50 kHz` · **HELP**: Previous / Next page |
| `B` | Cycle ISM band preset (`433 ISM → 868 EU → 315 US → 915 ISM → ALL ISM`) and reset ML baseline |
| `M` | Cycle CC1101 modulation preset (`AM650 → AM270 → FM238 → FM476`) |
| **`S`** | **Toggle Auto Squelch (`ASQ`)** between ML Smart Squelch and Manual dBm threshold |
| **`L`** | **Toggle Auto-Lock (`LOCK`)** between automatic burst snapping and manual cursor |
| `Enter` | **HEATMAP**: Lock onto peak/cursor & jump to `PULSE` · **PULSE / DECODE / SAVED**: Transmit (`TX`) |
| `Space` | Context primary action (`HOLD/RUN` in Heatmap/Decode, `REC/STOP` in Pulse) |
| `H` | Toggle 4-page interactive Help modal |
| `Q` or `Esc` | Quit safely (returns CC1101 to `IDLE` and restores `GPIO 14`) |

---

## Lab Exercise: Capture & Decode a Remote in 15 Seconds

Grab any **433.92 MHz fixed-code remote** that you own (e.g., a wireless power outlet fob, LED dimmer, or doorbell transmitter) and run this end-to-end workflow:

1. **Launch & Verify Hardware** *(2 sec)*
   Start `rf-heatmap` from `APPLaunch` (or SSH). Check the top-right header pills: confirm `CC1101` (green), `ASQ` (green), and `LOCK` (cyan) are active, and the band is `433 ISM`.
2. **Let the Baseline Warm Up** *(2 sec)*
   Wait ~1 second without pressing your remote. After 5 sweeps, the gray noise floor ticks and magenta Smart Squelch ticks appear across all 36 bins.
3. **Trigger the Remote & Watch Auto-Lock** *(3 sec)*
   Press and hold a button on your remote for 1 second. Watch a bright yellow streak ignite on the Thermal Waterfall, `Z+xx.x` flash in magenta, and **Auto-Lock** snap the cyan cursor box onto the exact bin (`LCK 433.92M`).
4. **Lock & Inspect in PULSE** *(3 sec)*
   Press `Enter` (or `6 LOCK`). You jump straight to **PULSE** tuned to `433.92 MHz`. Press your remote again and verify the RSSI bars surge **green** above the dashed cyan Smart Squelch line.
   - *(Optional RAW capture)* Press `4 (REC)`, press the remote twice, press `4 (STOP)`, then `6 (SAVE)` to save a `raw_HHMMSS.sub` file.
5. **Decode & Save the Key** *(5 sec)*
   Press `Tab` to enter **DECODE**. Press your remote once more — the top card displays the protocol (e.g., `Princeton (24-bit, TE=350us)`) and hex key. Press `6 (SAVE)` to store it as a Flipper-compatible `.sub` Key file, then press `Tab` to verify it appears in **SAVED**.

> [!TIP]
> If your remote shows strong yellow bursts in **HEATMAP** and green bars in **PULSE** but never decodes in **DECODE**, it likely uses a **rolling code** (e.g., KeeLoq) or **2-FSK** modulation. Try pressing `M` to test `FM238` / `FM476`, or read [Sub-GHz & CC1101 Theory](#/rf-domain) to learn why rolling codes differ from fixed OOK frames.

---

## Settings (`SET`) & Built-In MCP Server (SSH Opt-In)

![RF Heatmap Settings screen](assets/rf-heatmap/settings.png)

Press **`Tab`** or **`8 (MODE)`** to reach the **`SET`** tab. All settings are stored in `$HOME/.config/rf-heatmap/config.json` (`0600` permissions):

- **MCP Server (SSH)**: **Disabled by default** (`mcp_enabled: false`). Toggle ON with `Enter` / `Space` / `4 (TOGGLE)` to allow external AI agents to control `rf-heatmap` over SSH stdio.
- **Auto Squelch / Auto-Lock / Squelch K**: Persists your preferred ML Smart Squelch defaults across restarts.
- **Reset ML Baseline**: Instantly clears `SweepBaseline`, `LiveBaseline`, Kalman Foxhunt state, and IAT activity tracker when moving into a new RF environment without changing ISM bands.
- **Sync DB Sources**: Runs a non-blocking incremental delta sync for all enabled remote sources in `~/.config/rf-heatmap/sources.json` (GitHub repositories via Git Trees API or HTTPS JSON manifests), downloading **only new or changed `.sub` files** into isolated `~/rf-heatmap/databases/<id>/` folders using `ETag` (`304 Not Modified`) and per-file `SHA` tracking (`.sync-state.json`). Also runnable headlessly via `rf-heatmap --sync`.
- **Manage DB Sources**: Opens a dedicated sub-screen listing all configured sources and downloaded `~/rf-heatmap/databases/<id>/` folders. Mark one or multiple items with `Space`/`Enter`/`1`/`D` (`[x]`), toggle `ON/OFF` (`4`), delete pack directories only (`5 DIR`, 2-step confirm), or delete both `sources.json` entries and pack directories (`6 ALL` / `Del`, 2-step confirm). Individual `.sub` files can also be batch-deleted in `SAVED` (`Space` + `6 DEL`) and inside downloaded `DB:*` packs in `PROBE` (`1`/`D` + `Del`, automatically recorded in `.sync-state.json` `ignored` so future syncs won't re-download them).

### Invoking Over SSH (`--mcp`)

```bash
ssh <cardputer-host> /usr/share/APPLaunch/bin/rf-heatmap --mcp
```

| MCP Tool | Purpose |
| --- | --- |
| `rf_get_status` | CC1101 chip identity (`0x00`/`0x14`), settings, bands, presets |
| `rf_sweep_band` | Multi-sweep ISM band scan with `rfml.BinBaseline` noise floor & anomaly bursts |
| `rf_read_rssi` | Live single-channel RSSI sampling with Smart Squelch stats |
| `rf_decode_ook` | Decode signed µs pulses (`Princeton`, `PT2262`, `EV1527`, `CAME`, `Linear`, `Holtek`, `Nice FLO`, `KeeLoq`, `Somfy Telis`) |
| `rf_analyze_rolling_code` | Analyze 1..8 captures for `KeeLoq`, `Somfy Telis`, or generic consecutive rolling-code hopping |
| `rf_decode_sensor` | Decode TPMS (`Schrader`/`Toyota`) or Weather (`Oregon`/`Acurite`/`LaCrosse`) telemetry (supports `sim_sample: true`) |
| `rf_foxhunt_sample` | Lightweight locked-frequency RSSI sample with peak-hold, Kalman state, and Geiger cadence |
| `rf_trim_raw` | Trim leading/trailing noise from RAW `.sub` or inline pulses, repeat `1..10x`, and save atomically into `captures/` |
| `rf_list_saved` / `rf_read_saved` | Inspect Flipper `.sub` files (supports `source` and `pack` filters) |
| `rf_list_databases` / `rf_promote_to_user` | List separated `UserLibrary` and external `DatabasePack`s; copy winning external `.sub` to `captures/` |
| `rf_transmit_saved` | Encode and transmit a `.sub` signal via CC1101 GDO0 (requires `confirm_rf: true`) |
| `rf_list_sources` / `rf_add_source` / `rf_remove_source` / `rf_sync_sources` | Manage remote GitHub/manifest `.sub` sources (`sources.json`) and run incremental ETag/SHA delta sync into `~/rf-heatmap/databases/<id>/` |
| `rf_save_capture` / `rf_delete_saved` | Save or delete `.sub` captures (`delete` requires `confirm: true`) |
| `rf_purge_noise` | Scan captures for MLP-classified Noise `.sub` files (`dry_run: true` default; delete requires `dry_run: false, confirm: true`) |

### Automatic 1D K-Means Glitch Denoising (`DECODE` & `rf_analyze_pulses`)
- When a weak or jittery capture fails strict OOK ratio checks, `rf-heatmap` automatically runs **1D K-Means pulse clustering** (`internal/rfml/cluster.go`) to merge `< 60 µs` EMI glitches, estimate `TE`, and quantize pulses to centroids.
- Recovered frames display a magenta **`ML-CLEAN`** badge in `DECODE`; unrecognized signals show their discovered `ModulationHint`, `TE`, `LONG`, `JIT%`, and merged glitch count.
- Exposed via MCP as **`rf_analyze_pulses`** (and `denoised: true` in `rf_decode_ook`). See [ML: 1D K-Means Pulse Denoiser](#/rf-ml-cluster).

### On-Device Signal Classifier & Smart Save Guard (`rf_classify_signal`)
- Stopping `REC` in `PULSE` automatically runs the **12→24→5 pure-Go MLP** (`internal/rfml/classifier.go`) to label unknown captures (`Fixed OOK`, `Rolling/KeyFob`, `Sensor/Weather`, `CW/Jammer`, or `Noise`) with Softmax confidence.
- **Smart Save Guard**: high-confidence `Noise (>= 85%)` warns before saving (`6 again to save` forces save within 3s).
- Exposed via MCP as **`rf_classify_signal`**. See [ML: 12->24->5 Signal Classifier](#/rf-ml-classify).

### On-Device RF Fingerprinting (`rf_match_fingerprint`)
- On startup and whenever you press **`7 (SYNC)`** in `SAVED`, `rf-heatmap` indexes all `.sub` files (`RAW` and `Key`) as 8D L2-normalized RF embeddings in RAM.
- Stopping `REC` in `PULSE` compares the live burst against your library; matches (`similarity >= 88%` within `±2.5 MHz`) immediately display a toast `Match: <file>.sub (95%)`.
- Exposed via MCP as **`rf_match_fingerprint`**. See [ML: RF Fingerprinting (k-NN)](#/rf-ml-fingerprint).

### Kalman Foxhunt Radar & Periodicity Tracker (`PULSE` & `rf_foxhunt_track`)
- Along the top inner strip of the `PULSE` oscilloscope, `rf-heatmap` displays **`FOX:-62dBm ^CLOSER 57%`** (1D Kalman-smoothed RSSI + proximity) and the live temporal activity tag (**`BEACON 15.0s`**, **`CW/JAMMER`**, **`BURST`**, or **`QUIET`**).
- Exposed via MCP as **`rf_foxhunt_track`**. See [ML: Kalman Foxhunt & Periodicity](#/rf-ml-foxhunt).
