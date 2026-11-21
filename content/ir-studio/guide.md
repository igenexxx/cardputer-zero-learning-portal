# IR Studio — App Guide & Controls

**IR Studio** (`ir-studio`) is a native 38 kHz Infrared studio, multi-protocol decoder/encoder, Flipper Zero `.ir` remote deck, Universal Power-Off `PROBE`, multi-device `MACRO` runner, and on-device pure-Go IR ML analyzer built for the **M5Stack CardputerZero** (`/dev/lirc*`, `320×170` RGB565 `/dev/fb0`, 46-key TCA8418 keyboard).

---

## Hardware Readiness & Header Badges

At startup, `ir-studio` scans `/dev/lirc0`..`/dev/lirc7` using pure-Go Linux `ioctl` calls (`CGO_ENABLED=0`, non-root via the `lirc`, `video`, and `input` groups) without needing `lircd` or `ir-ctl`. If no `/dev/lirc*` hardware is present—or when launched with `--sim`—it seamlessly activates **`SIM`** mode with realistic synthetic IR fixtures.

| Badge | Color | Meaning |
| :--- | :--- | :--- |
| **`LIRC`** | Emerald | Live `/dev/lirc*` transceiver ready (`LIRC_MODE_PULSE` TX + `LIRC_MODE_MODE2` RX). |
| **`SIM`** | Amber | Deterministic offline simulator mode (`--sim` or no `/dev/lirc*` device). |
| **`ML-CLEAN`** | Magenta | 1D K-Means Pulse Denoiser absorbed EMI glitches or quantized jitter to rescue a protocol decode. |
| **`RANK`** | Magenta | `PROBE` pack is sorted descending by 8D IR cosine similarity against your last captured button. |
| **`MCP`** | Cyan / Amber | Opt-in JSON-RPC 2.0 stdio MCP server status (`DISABLED` by default). |

---

## The 6 Application Tabs

Press **`Tab`**, **`9`**, or **`0`** to cycle across all six workspaces: **`RX` → `REMOTE` → `PROBE` → `SAVED` → `MACRO` → `SET`**.

### 1. `RX` — Live IR Capture, Ambient Monitor & ML Inspection

![IR Studio RX tab showing live pulse oscilloscope, decoded NEC frame, and ambient IR meter](assets/ir-studio/rx.png)

Point any physical IR remote at CardputerZero's IR receiver and press a button:

- **Ambient IR Interference Bar (`y = 20..30`):** Continuously measures idle receiver edges and duty cycle, reporting `AMB: CLEAN` (Emerald), `AMB: MODERATE 120Hz` (Amber, e.g. PWM LED lamp), or `AMB: SATURATED` (Red, direct sunlight).
- **Live Waveform & Protocol Banner:** Displays the mark/space pulse train, decoded protocol (`NEC`, `NECext`, `Samsung32`, `RC5`, `RC6`, `SIRC`, `Kaseikyo`) with hex `Address`/`Command`, or `RAW` carrier and pulse count.
- **ML Diagnostics:** Shows the 1D K-Means centroids (`Short`/`Long` µs), `12→24→3` MLP class (`TV/Remote`, `AC State-Frame`, or `Ambient Noise`), and top **8D IR Fingerprint** match against installed `Flipper-IRDB` packs (e.g., `Match: Daikin_ARC480.ir (96%)`).
- **Softkeys (`4..8`):**
  - **`4 HOLD` / `LEARN`**: Toggle live IR capture listening vs. holding the current frame.
  - **`5 CLEAN` / `SWEEP`**: Toggle 1D K-Means pulse denoising (`ML-CLEAN`) while listening, or trigger the **Carrier Frequency Sweeper (`36 / 38 / 40 / 56 kHz`)** when a capture is held (also available anytime via **`R`**; press **`Esc`** to cancel mid-sweep).
  - **`6 DIFF`**: Open the **AC State-Frame Inspector** to split multi-subframe HVAC bursts, verify `SUM8` checksums, and diff two captured states (`22C Cool` vs `24C Cool`) bit-by-bit.
  - **`7 SAVE`**: Save the captured button into `~/ir-studio/remotes/` (protected by **Smart Save Guard** if classified as `Ambient Noise`).
  - **`8 CARR`**: Cycle default TX carrier frequency (`36 / 38 / 40 / 56 kHz`).

---

### 2. `REMOTE` — Virtual Multi-Button Deck & Smart AC Controller

![IR Studio REMOTE tab displaying 2-column virtual remote button grid](assets/ir-studio/remote.png)

Open any `.ir` file from `SAVED` or `PROBE` to turn CardputerZero into a handheld multi-button remote control:

- Navigate the 2-column button grid with **`F` / `X` / `Z` / `C`** (Up / Down / Left / Right).
- Press **`4 SEND`** or **`Enter`** to transmit the highlighted button (`Space` sends 3× burst).
- Press **`5 SWEEP`** to run the **Carrier Frequency Sweeper** (`36 → 38 → 40 → 56 kHz`) on the highlighted button for finicky receivers (Sony `40 kHz`, Philips `36 kHz`, Cisco/Motorola `56 kHz`), automatically restoring `38 kHz / 33%` afterward.
- For read-write **`[USER]`** remotes (`~/ir-studio/remotes/`), press **`6 LEARN+`** to capture and append a new button, **`R`** to rename a button on-device, or **`7 DEL`** (2-step confirm) to remove a button.
- For read-only **`[RO-DB]`** remotes (`~/ir-studio/databases/` or `GEN:TV-B-Gone`), editing is blocked; press **`8 PROMO`** (`PromoteToUser`) to copy the `.ir` file into your User Library.

#### Smart AC State-Frame Controller (`1` or `8 AC`)

![IR Studio Smart AC State-Frame Controller sub-view](assets/ir-studio/ac.png)

Press **`1`** (or **`8 AC`** on a USER remote) inside `REMOTE` to open the offline parametric **Smart AC Controller** supporting `Gree`, `Midea`, `Daikin`, `LG_AC`, `Samsung_AC`, and `Mitsubishi` with mathematically valid `SUM8`, nibble-sum, and byte-complement checksums:

- **`Z` / `C`**: Adjust target temperature (`16°C .. 30°C`).
- **`F` / `X`**: Cycle HVAC mode (`COOL` → `HEAT` → `DRY` → `FAN` → `AUTO`).
- **`R`**: Cycle AC brand (`Gree` → `Midea` → `Daikin` → `LG_AC` → `Samsung_AC` → `Mitsubishi`).
- **`4 PWR`** / **`5 FAN`** / **`6 SWING`**: Toggle power, cycle fan speed (`AUTO`/`LOW`/`MED`/`HIGH`), and toggle vertical vane swing.
- **`7 SEND`** (or **`Enter`**): Encode the full state frame + checksum and transmit immediately at `38 kHz / 33%`.
- **`8 SAVE`**: Persist the current state as a standard Flipper `.ir` button (e.g., `COOL_22C` or `Power_Off`) inside `~/ir-studio/remotes/AC_<Brand>.ir`. Press **`Esc`** to return to the `REMOTE` grid.

---

### 3. `PROBE` — Built-In `GEN:TV-B-Gone` & Universal Brand Sweep

![IR Studio PROBE tab running Universal Power-Off sweep with 12-slot rewind trail](assets/ir-studio/probe.png)

`PROBE` works **100% offline out of the box** using the compiled-in **`GEN:TV-B-Gone`** virtual pack (`GEN:TVBG` Cyan badge, **100 universal `Power` codes** across major TVs, Projectors, and Soundbars), as well as any synced read-only external `.ir` packs:

1. On a fresh install, **`GEN:TV-B-Gone`** is pre-selected automatically with `100` ready-to-fire `Power` codes. Press **`8 PACK`** to cycle `USER → GEN:TV-B-Gone → <synced DB packs>` and **`7 ACT`** to filter by action (`Power`, `Cool`, `Mute`, `Off`, `All`).
2. *(Optional — 1-Button Recovery)* If you have a half-broken remote with even **one** working button, capture it in `RX` first, then switch to `PROBE` and press **`R`** (**Smart Probe Ranking**). `ir-studio` reorders the pack descending by 8D IR cosine similarity so the closest brand/protocol fires first.
3. Adjust the sweep interval (`0.25s–5.0s`) with **`Z` / `C`** and press **`4 RUN`** (or **`Enter`**).
4. The instant the target appliance reacts, hit **`4 STOP`** or **`Space`** to halt mid-sweep.
5. Use **`F` / `X`** to backtrack along the **12-slot rewind trail** (`>` = last sent, `*` = previous 12), press **`5 TRY`** to single-test a candidate, and press **`6 SAVE`** (`PromoteToUser`) to copy the **entire matching `.ir` remote** (every button, not just Power) into `~/ir-studio/remotes/`.

---

### 4. `SAVED` — Dual-Scope `.ir` Library Browser

![IR Studio SAVED tab listing User Library and Database Pack remotes](assets/ir-studio/saved.png)

`SAVED` enforces strict separation between your read-write **User Library** (`~/ir-studio/remotes/`) and read-only **Database Packs** (`~/ir-studio/databases/<pack>/`):

- Press **`8 SRC`** to toggle between `USER` and `DB PACKS`.
- Mark multiple remotes with **`Space`**, **`1`**, or **`D`** (`[x]`) for batch operations.
- Press **`4 OPEN`** (or `Enter`) to load into `REMOTE`, **`5 SEND`** to fire the primary button, **`6 PROMO`** (in `DB`) to copy to `USER`, or **`6 PURGE`** (in `USER`) to scan and bulk-delete noise-only captures with a 2-step confirmation.
- Press **`7 DEL`** to delete the focused remote or `[x]`-selected batch (strictly blocked on read-only `DB` packs).

---

### 5. `MACRO` — Multi-Device IR Sequences

![IR Studio MACRO tab showing ordered multi-device IR macro steps](assets/ir-studio/macro.png)

Chain commands across multiple User Library remotes (e.g., *Movie Night*: `TV_LG.ir:Power` → wait `800 ms` → `Soundbar.ir:Power` → wait `500 ms` → `TV_LG.ir:HDMI_2`), persisted in `~/.config/ir-studio/macros.json` (`0600`):

- Press **`4 RUN`** (or `Enter`) to execute the selected macro asynchronously with a live step progress bar.
- Press **`4 STOP`**, **`Space`**, or **`Esc`** at any time to cancel mid-delay or mid-TX in `< 50 ms`.
- Use **`5 NEW`**, **`6 ADD`**, **`7 DEL`**, and **`8 EDIT`** (with `Z`/`C` adjusting `delay_after_ms` in `100 ms` steps) to author macros directly on CardputerZero.

---

### 6. `SET` — Hardware, Manage DB Sources & Opt-In MCP

![IR Studio SET tab with LIRC carrier, DB source sync, and MCP Server toggle](assets/ir-studio/set.png)

Configure hardware defaults and remote databases in `SET` (saved atomically to `~/.config/ir-studio/config.json` with `0600` permissions):

- **LIRC Device:** Auto-discovered `/dev/lirc0` (or `SIM` fallback).
- **Default Carrier & Duty Cycle:** Select `36 / 38 / 40 / 56 kHz` and `33% / 50%` duty cycle.
- **MCP Server (SSH):** **Disabled by default** (`mcp_enabled: false`). Toggle ON with **`4 TOGGLE`** or **`Enter`**, then press **`8 SAVE`**.
- **Manage DB Sources:** Toggle enabled sources, add HTTPS GitHub/manifest sources (**`6 ADD`**), remove sources (**`7 DEL`** with `[x]` multi-select via `Space`/`1`/`D`), or trigger incremental ETag/SHA delta sync (**`5 SYNC`** or CLI `ir-studio --sync`).

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

## Keyboard Reference & Built-In Help (`H`)

Press **`H`** from any tab to open the **5-page built-in Help modal** (`Z`/`C` turns pages `1/5..5/5`; `H`/`Esc` closes).

| Global Key | Function |
| :--- | :--- |
| **`Tab` / `9` / `0`** | Switch active tab (`RX`, `REMOTE`, `PROBE`, `SAVED`, `MACRO`, `SET`) |
| **`F` / `X` / `Z` / `C`** | Up / Down / Left / Right navigation |
| **`4`..`8`** | Bottom softkey tiles aligned above keys `4..8` |
| **`1` / `D` / `Space`** | Multi-select `[x]` toggle (`Space` also halts active `PROBE`) |
| **`R`** | Smart Probe Ranking (8D IR cosine similarity sort in `PROBE`) |
| **`H`** | Toggle 5-page built-in Help modal |
| **`Esc`** | Cancel TX/RX/Probe/Macro, dismiss modal, or exit cleanly |

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
| `ir_analyze_pulses` | Run 1D K-Means denoiser (`short_us`, `long_us`, `sync_us`, `glitches_removed`) |
| `ir_classify_signal` | Run `12→24→3` MLP (`TV/Remote`, `AC State-Frame`, `Ambient Noise`) |
| `ir_match_fingerprint` | 8D L2-normalized k-NN match across installed packs (`±4 kHz` carrier-gated) |
| `ir_rank_probe_pack` | Rank a `PROBE` pack descending by cosine similarity to a reference capture |
| `ir_purge_noise` | Scan/purge noise-only User Library `.ir` files (`dry_run: true` default; `confirm: true` to delete) |
| `ir_list_remotes` / `ir_read_remote` | Inspect User Library or read-only pack `.ir` files (`1 MiB` cap, path-sandboxed) |
| `ir_save_remote` / `ir_delete_remote` | Save or delete User Library `.ir` files (`delete` requires **`confirm: true`**) |
| `ir_list_databases` / `ir_promote_remote` | List synced packs or copy a full `.ir` remote into `~/ir-studio/remotes/` |
| `ir_list_sources` / `ir_add_source` | Manage HTTPS-only remote `.ir` sources in `~/.config/ir-studio/sources.json` |
| `ir_sync_sources` | Incremental `ETag`/`SHA` delta sync into `~/ir-studio/databases/<id>/` |
| `ir_remove_source` / `ir_delete_pack_files` | Batch-remove sources or specific pack files (**`confirm: true`**) |
