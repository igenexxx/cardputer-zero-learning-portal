# IR Studio — App Guide & Controls

**IR Studio** (`ir-studio`) is a native 38 kHz Infrared studio, multi-protocol decoder/encoder, Flipper Zero `.ir` remote deck, Universal Power-Off `PROBE`, multi-device `MACRO` runner, and on-device pure-Go IR ML analyzer built for the **M5Stack CardputerZero** (`/dev/lirc*`, `320×170` RGB565 `/dev/fb0`, 46-key TCA8418 keyboard).

---

## Hardware Readiness & Header Badges

At startup, `ir-studio` scans `/dev/lirc0`..`/dev/lirc7` using pure-Go Linux `ioctl` calls (`CGO_ENABLED=0`, non-root via the `lirc`, `video`, and `input` groups) without needing `lircd` or `ir-ctl`. If no `/dev/lirc*` hardware is present—or when launched with `--sim`—it seamlessly activates **`SIM`** mode with realistic synthetic IR fixtures.

| Badge | Color | Meaning |
| :--- | :--- | :--- |
| **`LIRC`** | Emerald | Live `/dev/lirc*` transceiver ready (`LIRC_MODE_PULSE` TX + `LIRC_MODE_MODE2` RX). |
| **`SIM`** | Amber | Deterministic offline simulator mode (`--sim` or no `/dev/lirc*` device). |
| **`EXP`** | Magenta | **Expert Mode** enabled (`expert_mode: true`), unlocking IR Lab (Scope), Macros, and DB Browser. |
| **`ML-CLEAN`** / **`PN-CLEAN`** | Magenta | 1D K-Means or `PulseNet-IR` 1D-UNet denoiser rescued a noisy/AGC-stretched capture. |
| **`AMB` / `MOD` / `SAT`** | Emerald / Amber / Red | Live ambient infrared interference monitor on capture screens. |

---

## Linear Navigation: Home Menu, Simple Mode & Expert Mode

`ir-studio` launches directly into a clean **Home Menu (`HOME`)** with breadcrumb headers (`IR STUDIO > Screen`) and predictable **`Esc` = Back** navigation so every screen's purpose is immediately clear:

![IR Studio Home Menu showing the 5 Simple Mode actions](assets/ir-studio/home.png)

- **Simple Mode (Default):** Shows the 5 everyday actions on one screen with no scrolling (**`Read & Replay`**, **`My Remotes`**, **`Universal Off`**, **`Smart AC`**, **`Settings`**).
- **Expert Mode (`5 EXP` on `HOME` or `Settings → Expert Mode`):** Persisted in `~/.config/ir-studio/config.json` (`"expert_mode": true`). Unlocks **`+3` power tools** on `HOME` (**`IR Lab (Scope)`**, **`Macros`**, **`DB Browser`**), `Tab` cycling, `[x]` batch selection, `PURGE` noise cleanup, `ACT` probe filters, and full hardware settings.
- **Safe Exit:** Pressing **`Esc`** (or **`8 QUIT`**) on `HOME` displays a confirmation banner (`Exit IR Studio? [Enter/Esc=YES]`). Press `Enter`/`Esc` to confirm or any other key to cancel (`Q` exits immediately).

---

### 1. `Read & Replay` — 2-Step Capture & Instant Test

![IR Studio Read & Replay captured signal screen with instant SEND and SAVE & OPEN](assets/ir-studio/read.png)

Select **`Read & Replay`** on `HOME` (or press **`6 READ`** from `HOME`) to clone and test any physical remote in seconds:

1. **Step 1 — Aim & Press:** Point your remote 5–20 cm at CardputerZero's IR sensor and press any button once. The screen automatically freezes the captured frame so ambient light cannot overwrite it.
2. **Step 2 — Signal Captured:** Displays the decoded protocol (`NEC`, `Samsung32`, `SIRC`, `RC5`, `RC6`, `Kaseikyo`, or `PulseNet-IR` brand guess) and any matching `Flipper-IRDB` remote:
   - **`Enter` / `4 SEND`**: Immediately replay the captured signal to verify your TV/appliance reacts.
   - **`5 SAVE`**: Saves the signal into `~/ir-studio/remotes/` and **immediately opens the new remote in `Remote Deck`**, where pressing **`5 LEARN+`** lets you add more buttons one after another. (If `PulseNet-IR` classifies the capture as ambient noise, a confirmation guard asks before saving.)
   - **`6 AGAIN`**: Clears the capture and arms Step 1 again.
   - **`7 ADDDB`** *(when a `>= 80%` Flipper-IRDB match is found, also key `1`)*: Copies the **entire matching DB remote** (all buttons) into `My Remotes` and immediately opens it in `Remote Deck`. When no DB match is found, **`7 SWEEP`** (also **`R`** anytime) sweeps `36 / 38 / 40 / 56 kHz`.
   - **`8 MENU` / `Esc`**: Returns to `HOME`.

---

### 2. `My Remotes` & `Remote Deck`

![IR Studio My Remotes list](assets/ir-studio/saved.png)

![IR Studio Remote Deck displaying 2-column virtual remote button grid](assets/ir-studio/remote.png)

- **`My Remotes`** lists your saved `.ir` remotes (`4 OPEN`, `5 SEND`, `6 NEW` to jump straight into `Read & Replay`, `7 DEL`, `8 MENU`).
- **`Remote Deck`** displays a 2-column button grid navigated with **`F` / `X` / `Z` / `C`**:
  - **`Enter` / `4 SEND`**: Transmit the highlighted button (`Space` sends 3× burst).
  - **`5 LEARN+`** *(Simple Mode)* / **`6 LEARN+`** *(Expert Mode)*: Displays `AIM REMOTE & PRESS BUTTON TO ADD...` and appends the next pressed button directly into this remote.
  - **`6 NAME`** *(Simple Mode)* / **`R`**: Rename the focused button.
  - **`5 SWEEP`** *(Expert Mode)*: Sweep `36 → 38 → 40 → 56 kHz` on the highlighted button.
  - **`7 DEL`**: 2-step delete of the focused button.
  - **`8 BACK` / `Esc`**: Return to `My Remotes` (on read-only DB remotes, **`8 PROMO`** copies the full `.ir` file into `My Remotes`).

---

### 3. `Smart AC` — Parametric HVAC Controller

![IR Studio Smart AC State-Frame Controller](assets/ir-studio/ac.png)

Open **`Smart AC`** directly from `HOME` to control 6 AC brands (`Gree`, `Midea`, `Daikin`, `LG_AC`, `Samsung_AC`, `Mitsubishi`) with valid checksummed state frames:

- **`Z` / `C`**: Adjust temperature (`16°C .. 30°C`).
- **`F` / `X`**: Cycle HVAC mode (`COOL` → `HEAT` → `DRY` → `FAN` → `AUTO`).
- **`R`**: Cycle AC brand.
- **`4 PWR`** / **`5 FAN`** / **`6 SWING`**: Toggle power, fan speed (`AUTO`/`LOW`/`MED`/`HIGH`), and vane swing.
- **`7 SEND`** (or **`Enter`**): Encode the full state frame + checksum and transmit immediately.
- **`8 SAVE`**: Persist the state as a Flipper `.ir` button inside `~/ir-studio/remotes/AC_<Brand>.ir`. Press **`Esc`** to return to `HOME`.

---

### 4. `Universal Off` (`PROBE`) — Built-In `GEN:TV-B-Gone` Sweep

![IR Studio Universal Off running TV-B-Gone sweep with 12-slot rewind trail](assets/ir-studio/probe.png)

Open **`Universal Off`** from `HOME` to run offline power sweeps immediately via **`GEN:TV-B-Gone`** (100 built-in universal TV/Projector/Soundbar `Power` codes), **`GEN:TV-Service`**, or synced `Flipper-IRDB` packs:

1. Press **`Enter`** (Simple Mode) or **`4 RUN`** to start sweeping immediately; hit **`4 STOP`**, **`Space`**, or **`Esc`** the instant the device reacts.
2. Use **`F` / `X`** to backtrack along the **12-slot rewind trail** (`>` = last sent, `*` = previous 12), **`5 TRY`** to single-test, and **`6 SAVE`** (`PromoteToUser`) to save the matching remote into `My Remotes`.
3. In **Expert Mode**, **`7 ACT`** filters by action (`Power`/`Cool`/`Mute`/`All`), **`8 PACK`** switches packs, and **`R`** runs **Smart Probe Ranking** using your last captured signal.

---

### 5. Expert Mode Tools (`IR Lab`, `Macros`, `DB Browser`)

Enable **Expert Mode** (`5 EXP` on `HOME` or `Settings → Expert Mode`) to unlock the full engineering lab:

#### `IR Lab (Scope)` (`RX`)

![IR Studio Expert IR Lab showing pulse oscilloscope, decoded NEC frame, and k-NN matches](assets/ir-studio/rx.png)

- Live mark/space pulse oscilloscope, 1D K-Means centroids (`Short`/`Long` µs), `PulseNet-IR` 24-class protocol classifier, 32D SupCon k-NN remote matches, **AC State-Frame Bit Diff (`6 DIFF`)**, `4 HOLD/LEARN`, `5 CLEAN/SWEEP`, `7 SAVE`, and `8 CARR`.

#### `Macros`

![IR Studio MACRO tab showing ordered multi-device IR macro steps](assets/ir-studio/macro.png)

- Chain commands across multiple `My Remotes` files (`~/.config/ir-studio/macros.json`, `0600`) with configurable `50–10000 ms` delays (`4 RUN/STOP`, `5 NEW`, `6 ADD`, `7 DEL`, `8 EDIT`, `Z`/`C` delay step, `Esc` back).

#### `DB Browser`

- Browse read-only synced `Flipper-IRDB` packs (`~/ir-studio/databases/<pack>/`), mark multiple user remotes with `1`/`Space` (`[x]`), bulk-remove noise captures (`6 PURGE`), copy DB remotes to `My Remotes` (`6 PROMO`), and toggle `USER`/`DB` via `8 SRC`.

---

### 6. `Settings` — Mode, MCP & DB Sync

![IR Studio Settings screen with Expert Mode, MCP Server, DB Sync, and TX Carrier](assets/ir-studio/set.png)

Saved atomically to `~/.config/ir-studio/config.json` (`0600`):

- **Simple Mode (4 rows):** `Expert Mode` (`OFF`/`ON`), `MCP Server (SSH)` (`OFF` by default), `Sync DB Sources`, and `TX Carrier Freq` (`36/38/40/56 kHz`).
- **Expert Mode (7 rows):** Adds `TX Duty Cycle` (`33%`/`50%`), `Probe Interval` (`0.25s..5.0s`), and `Manage DB Sources` (`6 SRCS`).

---

## Finding Relevant Flipper-IRDB Packs

The community repository [`Lucaslhm/Flipper-IRDB`](https://github.com/Lucaslhm/Flipper-IRDB) contains thousands of `.ir` files organized by appliance category:

- `ACs/` — Air conditioners (Daikin, Gree, Mitsubishi, Fujitsu, Midea, LG, Samsung)
- `TVs/` — Televisions (LG, Samsung, Sony, Philips, Panasonic, Hisense, TCL)
- `Fans/`, `LEDs/`, `Projectors/`, `Audio/`, `Cameras/`

> [!TIP]
> Instead of syncing the entire repository (tens of thousands of files), register **targeted subfolders** in **`~/.config/ir-studio/sources.json`** (or via **`SET → Manage DB Sources`** / MCP `ir_add_source`), then run **`ir-studio --sync`** or **`SET → Sync DB Sources`**:

```json
[
  {
    "id": "flipper-tvs",
    "name": "Flipper-IRDB TVs",
    "kind": "github",
    "repo": "Lucaslhm/Flipper-IRDB",
    "branch": "main",
    "path_prefix": "TVs",
    "enabled": true,
    "prune": false
  },
  {
    "id": "flipper-acs",
    "name": "Flipper-IRDB ACs",
    "kind": "github",
    "repo": "Lucaslhm/Flipper-IRDB",
    "branch": "main",
    "path_prefix": "ACs",
    "enabled": true,
    "prune": false
  }
]
```

Each enabled source syncs into its own read-only pack folder at **`~/ir-studio/databases/<id>/`** and stores Git `SHA` / HTTP `ETag` state in **`~/ir-studio/databases/<id>/.sync-state.json`**, so subsequent syncs download only added or updated `.ir` files. Your personal remotes stay isolated in **`~/ir-studio/remotes/`**.

---

## Keyboard Reference & Context-Aware Help (`H`)

Press **`H`** from any screen or sub-view to open the **Context-Aware Help modal** tailored to the active screen and sub-state (e.g., `HOME MENU`, `READ & REPLAY (LISTEN/CAPTURED)`, `MY REMOTES`, `DB BROWSER`, `REMOTE DECK`, `UNIVERSAL OFF`, `SMART AC CONTROLLER`, `IR LAB`, `MACROS`, `SETTINGS`, and `MANAGE DB SOURCES`). Bottom-bar softkeys (`4..8`) are highlighted in **cyan**, keyboard hotkeys in **amber**, and multi-page lists paginate automatically with **`Z`/`C`** (`H`/`Enter`/`Esc` closes).

| Global Key | Function |
| :--- | :--- |
| **`F` / `X` / `Z` / `C`** | Up / Down / Left / Right navigation |
| **`Enter`** | Primary action (Open item, Replay captured signal, Send button, Start/Stop Universal Off) |
| **`4`..`8`** | Bottom softkey tiles aligned above keys `4..8` |
| **`Esc`** | Step back (`Remote → My Remotes → HOME`); prompts exit confirmation on `HOME` |
| **`Tab` / `9` / `0`** | Return to `HOME` (Simple Mode) or cycle all screens (Expert Mode) |
| **`H`** | Toggle context-aware Help modal for the active screen |
| **`Q`** | Immediate clean exit (restores `38 kHz / 33%` defaults) |

---

## Built-In MCP Server (SSH Opt-In)

After enabling **MCP Server** in `SET`, connect any MCP-compatible AI agent over SSH:

```bash
ssh <cardputer-host> /usr/share/APPLaunch/bin/ir-studio --mcp
```

> [!IMPORTANT]
> If `mcp_enabled` is `false`, `ir-studio --mcp` exits non-zero without writing JSON-RPC frames and instructs you to enable MCP in `SET`. Every TX tool requires `confirm_ir: true`, and every destructive delete tool requires `confirm: true`.

| Tool | Purpose & Safety Gate |
| :--- | :--- |
| `ir_get_status` | Hardware mode (`LIRC`/`SIM`), carrier/duty, ambient noise %, counts, MCP status |
| `ir_learn_signal` | Exclusive RX capture (`timeout_ms: 500..15000`) with ML class & fingerprint match |
| `ir_transmit_button` | Transmit a remote button from UserLibrary, synced pack, or `GEN:TV-B-Gone` (**`confirm_ir: true`**, `repeat: 1..5`, carrier/duty restore) |
| `ir_send_ac_state` | Encode & transmit a checksummed parametric AC state frame (`Gree`, `Midea`, `Daikin`, `LG_AC`, `Samsung_AC`, `Mitsubishi`, **`confirm_ir: true`**, optional `save_as`) |
| `ir_sweep_carrier` | Resend a signal or pulse train across `[36000, 38000, 40000, 56000]` Hz (**`confirm_ir: true`**, guaranteed `38 kHz / 33%` restore) |
| `ir_run_macro` / `ir_list_macros` | List or run multi-device IR macros (**`confirm_ir: true`**, `<= 30 s` cap) |
| `ir_analyze_pulses` | Run 1D K-Means (`ML-CLEAN`) + lazy `PulseNet-IR` 1D-UNet TSOP AGC denoiser (`PN-CLEAN`) |
| `ir_classify_signal` | Run `PulseNet-IR` INT8 1D-CNN (24 IR brand/protocol families + `TV/Remote`, `AC State-Frame`, `Ambient Noise`) |
| `ir_match_fingerprint` | 32D L2-normalized SupCon k-NN match across installed packs (`±4 kHz` carrier-gated) |
| `ir_rank_probe_pack` | Rank a `PROBE` pack descending by 32D cosine similarity to a reference capture |
| `ir_model_info` | Inspect active embedded/override `PulseNet-IR` `.czml` model (`version`, `sha256`, `byte_size`, 24 classes, `~/.config/ir-studio/models/`) |
| `ir_purge_noise` | Scan/purge noise-only User Library `.ir` files (`dry_run: true` default; `confirm: true` to delete) |
| `ir_list_remotes` / `ir_read_remote` | Inspect User Library or read-only pack `.ir` files (`1 MiB` cap, path-sandboxed) |
| `ir_save_remote` / `ir_delete_remote` | Save or delete User Library `.ir` files (`delete` requires **`confirm: true`**) |
| `ir_list_databases` / `ir_promote_remote` | List synced packs or copy a full `.ir` remote into `~/ir-studio/remotes/` |
| `ir_list_sources` / `ir_add_source` | Manage HTTPS-only remote `.ir` sources in `~/.config/ir-studio/sources.json` |
| `ir_sync_sources` | Incremental `ETag`/`SHA` delta sync into `~/ir-studio/databases/<id>/` |
| `ir_remove_source` / `ir_delete_pack_files` | Batch-remove sources or specific pack files (**`confirm: true`**) |
| `ir_import_pronto` / `ir_export_pronto` | Lossless Pronto Hex (`0000 006D ...`) import (optional path-sandboxed `save_as`) and export from any button or pulse train |
| `ir_modem_send` / `ir_modem_recv` | 38 kHz IR optical data modem (`<= 64 B` payload + CRC-8-CCITT, `±120 µs` jitter tolerant; send requires **`confirm_ir: true`**) |
| `ir_tripwire_probe` | Bounded 38 kHz reflective/beam-break optical tripwire probe (`1..10` pings, **`confirm_ir: true`**, `SIM` fallback) |
| `ir_measure_flicker` | RX-only LED/screen PWM flicker meter (`window_ms: 200..5000`, TX strictly off, IEEE 1789 `SAFE`/`LOW_RISK`/`HIGH_FLICKER`/`NO_FLICKER`) |
| `ir_measure_rpm` | 38 kHz optical IR RPM tachometer (`confirm_ir: true`, `blades: 1..12`, `window_ms: 200..5000`, median outlier rejection & `38 kHz / 33%` restore) |

---

## Optical Lab: PWM Flicker Meter & 940 nm RPM Tachometer

CardputerZero's paired `/dev/lirc0` (940 nm IR LED) and `/dev/lirc1` (38 kHz IR receiver) unlock two non-contact optical instruments available via MCP (`ir_measure_flicker` and `ir_measure_rpm`) and Go APIs (`lirc.MeasureFlicker` / `lirc.MeasureRPM`):

- **LED / Screen PWM Flicker Meter (`ir_measure_flicker`):** Keeps the IR emitter strictly off while sampling `/dev/lirc1` (`200..5000 ms`) to measure dominant PWM frequency (`Hz`), duty cycle (`%`), jitter (`%`), and **IEEE 1789-2015** eye-safety risk (`SAFE` `>= 3125 Hz`, `LOW_RISK` `1250..3125 Hz`, `HIGH_FLICKER` `< 1250 Hz`, or `NO_FLICKER`).
- **Optical IR RPM Tachometer (`ir_measure_rpm`):** Emits bounded 38 kHz probe bursts (`confirm_ir: true`), measures reflected blade-pass periodicity with a median-filtered outlier rejector, divides by `blades` (`1..12`) to compute `RPM = (BladeFreqHz * 60) / blades`, and unconditionally restores `38 kHz / 33%`.

### 940 nm Optical Tachometer Target Tips

- **Dark / black surfaces (fans, pulleys, dark plastic):** Apply a small strip of **aluminum foil or metallic tape** (`> 85%` reflectance at 940 nm — strongest signal), or use a white electrical/masking tape strip or correction-fluid dot.
- **Shiny metal shafts (spindles, motor axles):** Wrap the shaft with **matte black electrical or cloth tape**, leaving one narrow bare-metal strip exposed (or place a foil strip on top of the matte black wrap) to maximize optical contrast.
- **Fans (PC coolers / 3D printer cooling fans):** Often no marker is needed — the fan blades themselves chop and reflect the 38 kHz beam; simply set `blades` to the exact blade count (e.g., `5`, `7`, or `9`).

> [!TIP]
> **940 nm IR Gotcha:** Ordinary black permanent markers are often nearly transparent at 940 nm infrared! Always use **matte black electrical tape** instead of marker ink when darkening bright shafts for optical RPM measurements.
