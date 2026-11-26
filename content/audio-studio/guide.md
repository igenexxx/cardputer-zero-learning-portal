# Audio Studio — App Guide & Controls

**Audio Studio** (`audio-studio`) transforms CardputerZero's onboard **Everest ES8389 Hi-Fi audio codec** (`card 1: ES8389-Audio`) into a pocket **96 kHz spectrum analyzer**, **ultrasonic signal inspector (`18–48 kHz`)**, **acoustic anomaly recorder**, and **pure-Go on-device INT8 ML acoustics lab**.

> **Zero external runtimes**: Everything runs natively in pure Go (`CGO_ENABLED=0`, `0 allocs/op` on DSP & ML hot paths) with `< 15 MB` RAM footprint.

---

## Simple Mode vs. Expert Mode

Audio Studio launches into a clean **5-item Simple Mode Home Menu** (`expert_mode: false`). Press **`5 EXP+`** on Home (or toggle in **Settings**) to unlock **Expert Mode** (`EXP` magenta badge) with 4 additional engineering labs.

![Audio Studio Home Menu](assets/audio-studio/home.png)

### Simple Mode Screens (5)
1. **Listen & Classify** — Live waveform ribbon, RMS/Peak dBFS meter, real-time **`SoundNet-2D`** classification (28 classes + 5 coarse groups), 1-click `.wav` recording (`4 REC/STOP`), playback (`5 PLAY` / `SNAP`), and 1-click 32D Few-Shot custom sound enrollment (`6 ENRL`).
2. **Spectrum Waterfall** — Live 64-column spectrum + 2D scrolling spectrogram waterfall (`LOG` / `LIN` / `MEL`), Peak-Hold ticks, frequency cursor (`Z/C`), and 1-button switch between **`48 kHz`** and true hardware **`96 kHz` (`0–48 kHz`)**.
3. **Anomaly Watch** — Dual-engine acoustic anomaly monitor combining online **`BandBaseline`** (Welford + EWMA with Burst-Freeze) and **`AnomalyAE-2D`** (DCASE convolutional autoencoder with 32-band fault heatmap).
4. **My Recordings** — Browse `.wav` clips in `~/audio-studio/recordings/`. Press **`Enter` / `4 OPEN`** on any recording to open the **Waveform & Audio Player** (full amplitude waveform, recording date/time, live playback playhead via **`4 PLAY / STOP`**, offline DSP+ML **`5 INFO`**, and **`7 DEL`**). Deleting a `.wav` keeps independent 32D sound profiles intact.
5. **Settings** — Configure `Expert Mode`, `Sample Rate` (`16/48/96 kHz`), `Mic Channel`, ES8389 `PGA Gain` (`0..+42 dB`), `Hardware ALC`, `Anomaly Auto-Rec`, and opt-in `MCP Server (--mcp)`.

---

## Step-by-Step Walkthrough

### 1. Listen & Classify (`SoundNet-2D`)
![Listen & Classify Screen](assets/audio-studio/listen.png)

- Point CardputerZero toward any sound source — the waveform ribbon updates at ~20 Hz while **`SoundNet-2D`** classifies the sliding `0.78 s` Log-Mel window in `~9 ms`.
- Press **`4 REC`** to record a `.wav` clip (press **`4 STOP`** to finish) or **`5 SNAP`** to immediately save the last `2 s` from the in-RAM pre-trigger ring buffer.
- Press **`6 ENRL`** to save the current sound's **32D SupCon embedding** into your personal Few-Shot library so Audio Studio recognizes your specific machine, alarm, or doorbell.

### 2. Spectrum Waterfall, Bar-by-Bar Inspector & 30–500 Hz / 96 kHz Zoom
![Spectrum Waterfall Screen](assets/audio-studio/spectrum.png)

- Use **`Z` / `C`** (±1 bar) or **`F` / `X`** (±4 bars) to move across **any of the 64 columns** and read its exact numeric **`BAR# : Hz  NOW dB  MAX dB`** in the top telemetry strip alongside the live overall **`PEAK Hz (dB)`**.
- Press **`6`** to cycle band modes: **`48 kHz` (`40 Hz–24 kHz`)** → **`96 kHz US` (`40 Hz–48 kHz` direct ALSA)** → **`30–500 Hz` High-Res Zoom** (`2 kHz / 1024-pt` FFT, `~7.3 Hz/bar` for bass & 3D-printer belt resonances!).
- Press **`7 FREZ`** to freeze the live waterfall — the cursor automatically snaps to the strongest peak bar so you can inspect the peak and walk **`Z` / `C`** across neighboring bars at leisure.

### 3. Anomaly Watch & Automatic Pre-Trigger Recording
![Anomaly Watch Screen](assets/audio-studio/anomaly.png)

1. Place CardputerZero near a healthy fan, 3D printer, server, or room environment and press **`4 LERN`** (`5 s` baseline calibration).
2. Ensure **`5 ARMD`** is active (armed auto-recorder).
3. When a fault, knock, bearing squeal, or alarm occurs, both the **EWMA Z-score** and **`AnomalyAE-2D` neural score** climb, the **32-band heatmap** highlights the exact anomalous frequency band, and Audio Studio automatically writes a **5-second clip (`2 s pre-trigger + 3 s post-trigger`)** to `~/audio-studio/recordings/anom_*.wav`.
4. Press **`7 LOG`** to review timestamped events.

### 4. Expert Labs (`EXP+`) — Including 3D-Printer Belt Tuner
- **Belt Tuner (3D)**: Hold CardputerZero 5–15 cm from a GT2 belt span (e.g., Creality K1C / Voron 150 mm span) and pluck it cleanly. The dedicated `2 kHz / 1024-pt` FFT locks onto the fundamental frequency in large digital **Hz** (`±0.2 Hz`), rejects louder `2×` overtones, tracks a **5-pluck Median**, shows **`TIGHTEN / OK / LOOSEN`**, and compares **Belt A vs Belt B** via **`Enter` / `5 A/B`** (`DIFF <= 2.5 Hz MATCH`). Use **`4 PRST`** (`K1C/Voron 110 Hz`, `CoreXY 95 Hz`, `Prusa 85 Hz`, `140 Hz`) and **`Z/C`** (`±1 Hz`).

![3D-Printer Belt Tuner Screen](assets/audio-studio/belt.png)

- **Oscilloscope & Tuner**: Triggered rising zero-crossing scope (`1x/2x/4x` gain) + **YIN** chromatic pitch tuner (`A4 440.0 Hz`, ±50 cents needle, clarity %, THD %).
- **Ultrasonic & Signals (`96 kHz` — 3 Labs via `6 MODE` / `Tab`)**:
  1. **`SCAN`**: Dedicated `18–48 kHz` zoom detecting ultrasonic beacons (`18–22.5 kHz`), SMPS coil whine, pest repellers, **Goertzel DTMF**, **50/60 Hz mains hum**, and ISO 8201 **T3 smoke alarms**.
  2. **`DOPPLER`**: Active ultrasonic Doppler radar (`19.5 kHz` default, `Z/C` `18.5–21.5 kHz`, **`4 START / STOP`**). Displays live `-250..+250 Hz` bipolar Doppler shift, radial velocity (`m/s`), carrier lock dB, and **`APPROACH / RECEDE / WAVE / STILL`**.
  3. **`HEAR`**: Real-time **Heterodyne Ultrasound Hearing Aid** (`4 LISTEN / MUTE`, `Z/C` tunes `LO` `18–44 kHz`, `F/X` gain `1x..16x`) shifting `LO ± 4.5 kHz` down to audible `0–4.5 kHz` (headphones recommended).

![Ultrasonic & Signals Scan](assets/audio-studio/ultra.png)
![Ultrasonic Doppler Radar](assets/audio-studio/ultra_doppler.png)
![Heterodyne Ultrasound Hearing Aid](assets/audio-studio/ultra_hear.png)

- **Sound Match & Scripts (v2 + Offline KWS)**: The single place to manage `[32D]` sounds, `[SEQ]` `2.5 s` DTW patterns (double-claps, intercom melodies), and `[KWS]` offline voice commands (`KWSNet-2D`), all with script bindings and launch logs:
  1. Press **`4 +NEW`** to choose: **Learn Live Sound (Single 32D)**, **Record Sound Pattern (2.5s DTW)**, **Add Voice Word (Offline KWS — 14 built-in commands or speak your own custom word in any language)**, **Import from Saved Recording (.wav)**, or **Calibrate Room Noise (3s BG Contrast)**.
  2. Press **`Enter`** or **`5 EDIT`** on any profile to manage its binding: **`4 FILES`** browses `~/audio-studio/scripts/`, **`5 TYPE`** edits the path on QWERTY keyboard, **`Enter` on `Min Match`** runs **Auto-Threshold**, **`6 TEST`** runs a test launch, and **`7 CLEAR`** unbinds the script.
  3. Press **`6 LOGS`** to inspect launch-only events stored in `~/audio-studio/trigger_log.jsonl` (`Enter` / `4 OPEN` shows exit code, duration, and output; `7 CLEAR` wipes all logs with confirmation).

![My Recordings Waveform Player](assets/audio-studio/saved_player.png)
![Sound Match Bindings List](assets/audio-studio/match.png)
![Sound Match Add Menu](assets/audio-studio/match_add.png)
![Sound Match Script Trigger Config](assets/audio-studio/match_trigger.png)
![Sound Match Trigger Launch Logs](assets/audio-studio/match_logs.png)

- **Tone & Sweep Gen**: Output ear-safe (`<= 70%`) `Sine`, `Square`, `White`, `Pink`, or `Log-Chirp` test signals to the speaker while automatically muting anomaly triggers (Half-Duplex safe).

![Oscilloscope & YIN Tuner](assets/audio-studio/scope.png)
![Ultrasonic & Signals Lab](assets/audio-studio/ultra.png)

---

## Keyboard Reference

| Key | Action |
| --- | --- |
| `F` / `X` | Move Up / Down in menus; adjust scope gain or generator volume |
| `Z` / `C` | Move Left / Right; shift frequency cursor or generator pitch |
| `Enter` | Open selected menu item or trigger primary action |
| `Esc` | Step back to Home Menu (on Home: prompts Exit confirmation) |
| `4` `5` `6` `7` `8` | Bottom softkeys directly above physical keys `4..8` |
| `H` | Open Context-Aware Help for the active screen (`Z/C` flips overflow pages; cyan = `4..8` softkeys, amber = hotkeys) |
| `R` | *(SIM mode only)* Cycle 6 synthetic acoustic scenes |
| `Q` | Quit immediately |

---

## Opt-In MCP Server Over SSH

Audio Studio's pure-Go stdio JSON-RPC 2.0 MCP server is **disabled by default** (`mcp_enabled: false`).

1. Open **Settings → `MCP Server (--mcp)`** and set it to **`ENABLED`**.
2. Connect an external AI agent over SSH:

```bash
ssh zhenya@<cardputer-ip> /usr/share/APPLaunch/bin/audio-studio --mcp
```

| Tool Name | Arguments | Purpose |
| --- | --- | --- |
| `audio_status` | *(none)* | ES8389/PipeWire status, PGA/ALC, loaded `.czml` SHA-256, live dBFS |
| `audio_listen_classify` | `duration_ms` (`500..5000`) | Live capture + `SoundNet-2D` top-3, 32D embedding, YIN pitch, features |
| `audio_spectrum_snapshot` | `sample_rate`, `scale`, `band` (`full`/`bass_500hz`) | 64-bar `{bar, freq_hz, db}` spectrum + `18–48 kHz` ultrasonic snapshot |
| `audio_belt_measure` | `target_hz`, `duration_ms`, `reset` | 3D-printer GT2 belt pluck frequency (`±0.2 Hz`), dB, 5-pluck median & advice |
| `audio_anomaly_check` | `learn_sec` (`0..15`) | Trigger baseline calibration or read fused EWMA + `AnomalyAE-2D` verdict |
| `audio_decode_signals` | *(none)* | DTMF Goertzel, 50/60 Hz mains hum, T3 alarm, ultrasonic carrier detector |
| `audio_recordings_list` | *(none)* | List `.wav` recordings in `~/audio-studio/recordings/` |
| `audio_recording_analyze` | `filename` | Run offline DSP + ML analysis on a saved `.wav` clip |
| `audio_recording_delete` | `filename`, `confirm: true` | Sandboxed delete requiring explicit confirmation |
| `audio_profile_enroll` | `name` | Enroll live 32D acoustic embedding under a custom name |
| `audio_profile_match` | *(none)* | List enrolled 32D profiles (with trigger rules) & top-3 live cosine matches |
| `audio_profile_set_trigger` | `name`, `script_path`, `enabled`, `min_similarity`, `cooldown_sec` | Bind, update, or clear an executable script trigger on a profile |
| `audio_profile_test_trigger` | `name`, `confirm_exec: true` | Test-execute a profile's script and append a `test` launch log entry |
| `audio_trigger_logs_list` | `limit`, `profile` | Read newest-first persisted launch logs from `~/audio-studio/trigger_log.jsonl` |
| `audio_trigger_logs_clear` | `confirm: true` | Clear all persisted trigger launch logs |
| `audio_profile_calibrate_background` | `duration_ms` (`1000..8000`) | Calibrate room ambient noise prototypes for Background Contrast |
| `audio_profile_enroll_sequence` | `name`, `duration_ms` (`1500..3500`) | Record a multi-frame 32D temporal pattern for Subsequence DTW |
| `audio_profile_enroll_keyword` | `name`, `builtin_word`, `duration_ms` | Enroll a built-in Speech Commands word or custom 32D spoken wake-word |
| `audio_profile_auto_threshold` | `name` | Auto-compute optimal cosine threshold from positives + room background |
| `audio_kws_listen` | `duration_ms` (`400..4000`) | Run offline `KWSNet-2D` keyword recognition & 32D voice matching |
| `audio_doppler_probe` | `carrier_hz`, `duration_ms`, `confirm_audio: true` | Bounded active ultrasonic Doppler radar motion burst (`<= 5 s`) |
| `audio_generate_tone` | `wave`, `freq_hz`, `duration_sec`, `level_pct`, `confirm_audio: true` | Ear-safe (`<= 70%`, `<= 10s`) speaker test signal |
