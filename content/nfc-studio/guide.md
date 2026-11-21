# NFC Studio — App Guide & Controls

**NFC Studio** (`nfc-studio`) is a native 13.56 MHz HF NFC scanner, hex/NDEF memory inspector, hardware UID card emulator, and Flipper-compatible `.nfc` library manager built for the **M5Stack CardputerZero** and its **Cap CC1101 & NFC** expansion (powered by the **ST25R3916** transceiver).

> [!WARNING]
> **Never hot-swap the Cap CC1101 & NFC module!** Always power off the CardputerZero completely before attaching or removing the expansion Cap to prevent damage to the 5 V rail, SPI bus, or ST25R3916 transceiver.

---

## Hardware Readiness & Automatic Setup

When `nfc-studio` launches on CardputerZero, it handles all low-level Linux hardware initialization automatically:

1. **5 V Cap Rail Enable (`ext_5v_out` / GPIO26):** Drives GPIO26 high (`pinctrl set 26 op dh`) and writes `1` to `/sys/class/leds/ext_5v_out/brightness`, powering the Cap's ST25R3916 and antenna matching network.
2. **Automatic SPI CS2 Overlay (`spi0-spidev2-gpio22-overlay`):** Unlike the CC1101 Sub-GHz radio on `/dev/spidev0.1`, the ST25R3916 uses Chip Select 2 on **GPIO22**, exposed at `/dev/spidev0.2`. If `/dev/spidev0.2` does not exist yet, `nfc-studio` automatically loads the Device Tree overlay:
   ```bash
   dtoverlay spi0-spidev2-gpio22-overlay
   ```
   The `.deb` package installs `/etc/sudoers.d/nfc-studio` so users in the `spi` or `gpio` group can load this overlay passwordlessly via `sudo -n dtoverlay spi0-spidev2-gpio22-overlay`, then waits up to 1 second for `udev` to apply `0660` permissions.
3. **ST25R3916 Silicon Verification:** Opens `/dev/spidev0.2` in **SPI Mode 1** (`CPOL=0, CPHA=1`) at **5 MHz**, reads register `0x3F` (Identity) to verify the chip (`id & 0xF8 == 0x28`), applies ST's thermal erratum, measures the supply rail via internal ADC (`23.4 mV/step`), and displays a startup toast such as `ST25R3916 rev5 (3346mV)`.

### Header Status Badges

The top status bar displays the active mode (`SCAN`, `DUMP`, `EMU`, `SAVED`), operating frequency (`13.56 MHz ISO14443`), and a right-hand hardware badge:

| Badge | Color | Meaning |
| :--- | :--- | :--- |
| **`ST25R39`** | Emerald | Live ST25R3916 hardware initialized on `/dev/spidev0.2`. All scanning and Passive Target emulation run on real RF silicon. |
| **`SIM`** | Amber | Simulator / Demo mode. Activated automatically if the Cap is absent or fails to initialize, or manually via `--sim`. Preloads a sample NTAG215 tag (`cardputer.cc`) so you can explore the UI offline. |

---

## The 4 Application Tabs

Use **`Tab`** or **`8`** (`MODE`) at any time to cycle through the four views: **`SCAN` → `DUMP` → `EMU` → `SAVED`**.

### 1. `SCAN` — Live 13.56 MHz ISO 14443-A Discovery

![NFC Studio SCAN tab showing 13.56 MHz radar, tag summary, and NDEF preview](assets/nfc-studio/scan.png)

The `SCAN` tab runs a background hardware poller every **180 ms** (keeping SPI I/O off the UI thread) to discover ISO 14443-A tags without freezing the display.

- **Left Adaptive ADC Radar Panel:** Driven by live ST25R3916 `MeasureAmplitude (0xD3)` / `MeasurePhase (0xD5)` readings through `FieldBaseline`. Its center glyph adapts to the detected source (NTAG chip, MIFARE/DESFire access card, Encrypted padlock, or `!` Metal Detune alert), while the concentric rings, corner lock reticles, bottom signal bar, and footer report live RF coupling:
  - **`LOCK XX%`** (Emerald): Optimal antenna **Sweet Spot** (`75–100%` coupling).
  - **`SIG XX%`** (Cyan): Weak coupling — move the tag closer to the antenna center.
  - **`METAL!`** (Red/Amber): Conductive metal detuning detected (`|PhaseZ| >= 6σ`).
  - **`13.56M`** (Muted) / **`PAUSED`** (Amber): Idle polling or paused via `4` (`HOLD`) / `Space`.
- **Right Tag Summary Card:** Displays the identified card family (`NTAG21x / MFU`, `MIFARE Classic 1K`, `MIFARE Classic 4K`, `ISO14443-4 / DESFire`, or `ISO14443-3A`), full hex **UID** (4-byte or 7-byte), **ATQA** (2 bytes), **SAK** (1 byte), and dumped page count.
- **Bottom NDEF Strip:** Automatically scans Type 2 user memory (Page 4+) for an NDEF TLV (`0x03`) and previews decoded URI or Text payloads (e.g., `NDEF [URI]: https://cardputer.cc`).

> [!TIP]
> Hold the card flat against the **top/back NFC antenna area of the Cap** within **1–3 cm**. When a new UID enters the field, a toast pops up (`Found: NTAG21x / MFU`) and the radar status flips to **`DETECTED`**.

---

### 2. `DUMP` — Color-Coded Memory Hex & NDEF Inspector

![NFC Studio DUMP tab showing color-coded NTAG215 pages and ASCII sidebar](assets/nfc-studio/dump.png)

When a Type 2 tag (`SAK == 0x00`, such as NTAG213/215/216 or MIFARE Ultralight) is scanned or loaded from `SAVED`, `nfc-studio` dumps all readable 4-byte pages via ISO 14443-A `READ (0x30)` commands.

The hex viewer color-codes pages by their architectural role:

| Page Range | Color | Contents |
| :--- | :--- | :--- |
| **`P00` – `P02`** | **Cyan** | 7-byte UID, BCC0/BCC1 check bytes, Internal byte, and Static Lock bytes |
| **`P03`** | **Amber** | **Capability Container (CC)** — e.g. `E1 10 3E 00` (NDEF magic, version, size, access) |
| **`P04+`** | **Emerald** | User memory, NDEF TLV (`0x03`), URI/Text records, and Terminator (`0xFE`) |

Each row shows the page index (`P00`), 4 hex bytes, and a printable ASCII gutter (`|card|`). Press **`F` / `X`** (or `Up` / `Down`) to scroll through every page, **`7` (`TOP`)** to jump back to `P00`, and **`4` (`NDEF` / `HEX`)** to toggle between raw page hex and the structured NDEF view.

---

### 3. `EMU` — Hardware Passive Target Card Emulation (NFC-A & FeliCa)

![NFC Studio EMU tab emulating an NTAG215 UID with live reader hit counter](assets/nfc-studio/emu.png)

The `EMU` tab switches the ST25R3916 out of Reader mode and into **Passive Target Mode** — supporting both **ISO 14443-A (`PT_A 0xA0`)** and **FeliCa / NFC-F (`PT_F 0xA8`, 212/424 kbps)**. The transceiver turns off its own RF carrier and listens for an external reader's 13.56 MHz field, responding autonomously in hardware to `REQA`/`WUPA`/`SELECT` (NFC-A) or `SENSF_REQ` (FeliCa `IDm`/`PMm`/`System Code`). *(Per the ST25R3916 datasheet, NFC-B and NFC-V are read-only.)*

- **Status, Border & External Reader RF Radar:** Switches from `IDLE` (grey border) to **`EMULATING 13.56MHz`** (emerald border). On the right side, the live **EMU Radar** animates outward transmission waves, displays the source glyph for the emulated card, measures real **external 13.56 MHz reader field strength** (`RF 0–100%` via `MeasureExternalField`), and flashes **`HIT!`** on every reader wake/select event.
- **`HITS` Counter:** Increments in real time whenever `regInterruptTarget (0x1D)` detects an external reader waking (`WUA` / `WUF`) or selecting (`SDDC`) your emulated card.
- **Quick Presets:**
  - **`5` (`RND`)**: Generates a fresh random UID/IDm (preserving NXP `0x04` for 7B NTAG and `0x01` for 8B FeliCa IDm).
  - **`6` (`TYPE`)**: Cycles instantaneously between **7-byte NTAG215** (`NFC-A`), **4-byte MIFARE Classic 1K** (`NFC-A`), and **8-byte FeliCa** (`NFC-F`, `IDm` + `PMm` + `SYS 88 B4`).
  - **`7` (`RST`)**: Resets the `HITS` counter to `0`.

> [!NOTE]
> Switching away from `EMU` via `Tab` / `8` automatically stops emulation and puts the ST25R3916 into a safe idle state (`FieldOff`).

---

### 4. `SAVED` — User `.nfc` Library

![NFC Studio SAVED tab listing exported Flipper-compatible .nfc files](assets/nfc-studio/saved.png)

Pressing **`6` (`SAVE`)** in `SCAN` or `DUMP` writes the current tag as a standard **Flipper Zero Version 4 `.nfc`** file named `tag_HHMMSS.nfc` strictly inside your read-write **User Library** (`~/nfc-studio/tags/`). External database packs live separately and are never mixed here.

Scroll with **`F` / `X`**, mark multiple tags with **`Space` / `1` / `D`** (`[x]`), then press **`4` (`EMU`)** / **`Enter`** to emulate, **`5` (`DUMP`)** to inspect, **`6` (`DEL`)** / `Del` to delete 1 or the selected batch (2-step confirmation), or **`7` (`SYNC`)** to rescan.

---

### 5. `PROBE` — Auto-Emu Playlist & External `.nfc` Databases

![NFC Studio PROBE tab with Auto-Emu and rewind markers](assets/nfc-studio/probe.png)

The **`PROBE`** tab lets you step automatically through read-only external `.nfc` database packs (`~/nfc-studio/databases/<pack>/` and `~/zerosub/nfc/`) or your `USER` library at a configurable dwell interval (`0.5s–8.0s`):

- Press **`7` (`PACK`)** to switch between `DB:<pack>`, `ext:zerosub`, and `USER`; adjust dwell time with **`Z` / `C`**.
- Press **`4` (`AUTO`)** / **`Space`** to begin sequential Passive Target A emulation. Hit **`4` (`STOP`)** / **`Space`** / **`Enter`** immediately when the reader responds — **`>`** (last emulated) and **`*`** (previous 12) let you backtrack with **`F` / `X`**, single-test with **`5` (`TRY`)**, and copy the winning `.nfc` into `~/nfc-studio/tags/` with **`6` (`SAVE`)**.
- Delete unwanted `.nfc` files inside downloaded `~/nfc-studio/databases/<pack>/` folders with **`1` / `D`** + **`Del`** (2-step confirm; recorded in `.sync-state.json` `ignored` so future syncs skip them).
- Sync remote GitHub or HTTPS JSON manifest `.nfc` sources configured in **`~/.config/nfc-studio/sources.json`** via **`SET → Sync DB Sources`** or **`nfc-studio --sync`**, and toggle or batch-delete pack folders & entries in **`SET → Manage DB Sources`**.

Example **`~/.config/nfc-studio/sources.json`** (synced into read-only **`~/nfc-studio/databases/<id>/`** with `.sync-state.json` delta tracking):

```json
[
  {
    "id": "amiibo-nfc",
    "type": "github",
    "owner": "Lucaslhm",
    "repo": "Flipper-NFC-DB",
    "branch": "main",
    "subpath": "Amiibo",
    "enabled": true,
    "prune": false
  }
]
```

---

### Built-In Help Overlay (`H`)

![NFC Studio built-in 4-page Help modal](assets/nfc-studio/help.png)

Press **`H`** from any screen to open the 4-page on-device quick reference covering controls, tag fields (`UID`/`ATQA`/`SAK`), color-coded NTAG memory layout, and emulation/library paths. Turn pages with **`Z` / `C`** (or `Left` / `Right` / `Space` / `Tab`) and close with **`Enter`**, **`H`**, **`Q`**, or **`Esc`**.

---

## Complete Keyboard Controls

CardputerZero's 46-key matrix maps directly to the 5 bottom-bar softkeys (`4`–`8`) plus ergonomic navigation keys:

### Global Keys

| Key | Action |
| :--- | :--- |
| **`Tab`** or **`8`** | Cycle active tab (`SCAN` → `DUMP` → `EMU` → `SAVED`) |
| **`4` `5` `6` `7` `8`** | Trigger the 5 context-sensitive bottom softkey buttons |
| **`F` / `X`** (or `↑` / `↓`) | Scroll memory pages (`DUMP`) or file list (`SAVED`) |
| **`Z` / `C`** (or `←` / `→`) | Previous / Next page inside the Help overlay |
| **`Enter`** | Quick-emulate current tag (`SCAN`), start/stop emulation (`EMU`), or emulate selected file (`SAVED`) |
| **`H`** | Toggle 4-page built-in Help overlay |
| **`Q`** or **`Esc`** | Close Help overlay, or quit `nfc-studio` cleanly (powers down RF field) |

### Per-Tab Softkeys (`4` – `8`)

| Tab | `4` | `5` | `6` | `7` | `8` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SCAN`** | `HOLD` / `SCAN` (also `Space`) | `EMU` (also `Enter`) | `SAVE` (`.nfc`) | `DUMP` | `MODE` |
| **`DUMP`** | `NDEF` / `HEX` (also `Space`) | `EMU` | `SAVE` (`.nfc`) | `TOP` (scroll to `P00`) | `MODE` |
| **`EMU`** | `START` / `STOP` (`Space`/`Enter`) | `RND` (random UID) | `4B/7B` (NTAG ↔ MFC1K) | `RST` (zero hits) | `MODE` |
| **`SAVED`** | `EMU` (also `Enter`) | `DUMP` | `DEL` (`Del`/`Bksp`) | `SYNC` (rescan) | `MODE` |

---

## CLI Options & `--probe` Diagnostic Mode

While `nfc-studio` launches full-screen from **APPLaunch** on `/dev/fb0`, you can also invoke it over SSH for headless hardware diagnostics or custom testing:

```bash
# Headless hardware check: loads overlay, verifies ST25R3916, polls 5x for a tag, prints result and exits
/usr/share/APPLaunch/bin/nfc-studio --probe

# Launch UI in offline simulator mode (no hardware required)
/usr/share/APPLaunch/bin/nfc-studio --sim

# Custom SPI device, framebuffer, or tags directory
/usr/share/APPLaunch/bin/nfc-studio --spi /dev/spidev0.2 --fb /dev/fb0 --tags ~/my-nfc-tags
```

### Example `--probe` Output

When the Cap is seated and an NTAG215 card is held near the antenna:

```text
ST25R3916 OK: id=0x2D rev=5 supply=3346mV
TAG FOUND: UID=04A1B2C3D4E5F6 ATQA=4400 SAK=00 Pages=135
```

If the chip is healthy but no 13.56 MHz card is in range:

```text
ST25R3916 OK: id=0x2D rev=5 supply=3346mV
No ISO14443-A tag detected: st25r3916: no tag response
```

> [!IMPORTANT]
> If `--probe` reports `ST25R3916 OK` with `supply=~3300mV` (or `~5000mV`), your SPI bus, overlay, and power rail are 100% healthy. If a specific keyfob still yields `no tag response`, it is almost certainly a **125 kHz LF RFID** fob (like EM4100 or HID Prox) rather than a 13.56 MHz NFC tag. See [NFC & ISO 14443-A Theory](#/nfc-domain) for the 2-second smartphone test.

---

## Hands-On Lab Exercises

### Lab 1: Comparing an NTAG215 Sticker vs. a MIFARE Classic 1K Card

1. Launch **NFC Studio** and confirm the top-right badge reads **`ST25R39`** (green).
2. Place an **NTAG215** (or NTAG213/216) tag on the Cap antenna:
   - Observe the radar label turn green (**`DETECTED`**).
   - Note the **7-byte UID** starting with `04` (NXP Semiconductors), **`ATQA: 44 00`**, **`SAK: 00`**, and a non-zero page count (e.g., `135 pages (540 bytes)` for NTAG215 or `45 pages (180 bytes)` for NTAG213).
3. Now swap in a **MIFARE Classic 1K** transit or access card:
   - Observe the **4-byte UID**, **`ATQA: 04 00`**, and **`SAK: 08`**.
   - Notice `MEM: 0 pages` — because `SAK == 0x08` indicates CRYPTO1-authenticated sectors rather than open Type 2 pages, `nfc-studio` completes ISO 14443-A anticollision cleanly without attempting brute-force authentication.

### Lab 2: Inspecting Hex Pages, NDEF Decoding & Exporting `.nfc`

1. Scan an NTAG21x tag that contains a URL or text record (or launch with `--sim`).
2. Press **`7` (`DUMP`)** to open the color-coded page viewer:
   - Verify **Cyan** pages `P00–P02` hold the 7-byte UID and lock bytes.
   - Check **Amber** page `P03` starts with `E1` (NDEF Capability Container). Multiply byte 2 (`P03[2]`) by 8 to calculate the NDEF user memory size in bytes (e.g., `0x3E × 8 = 496 bytes`).
   - Scroll down with **`X`** into **Emerald** pages `P04+` and locate `03` (NDEF TLV tag) and `FE` (Terminator TLV).
3. Press **`4` (`NDEF`)** to view the decoded URI/Text record, then press **`6` (`SAVE`)** to export a Flipper-compatible `.nfc` file to `~/nfc-studio/tags/`.
4. Press **`Tab`** twice to open **`SAVED`** and confirm your new `tag_HHMMSS.nfc` file appears in the library.

### Lab 3: Hardware UID Emulation & Reader Hit Verification

1. From `SCAN`, `DUMP`, or `SAVED`, select any tag and press **`5` (`EMU`)** (or **`4` (`EMU`)** in `SAVED`).
2. Confirm the screen border turns emerald and displays **`EMULATING 13.56MHz`**.
3. Hold an Android or iOS smartphone running an NFC reader app (such as *NFC Tools*)—or a USB ACR122U / Flipper Zero in NFC Read mode—within 1–2 cm of the Cap's NFC antenna.
4. Watch **`HITS`** increment on CardputerZero and verify the exact **UID**, **ATQA**, and **SAK** reported by the external reader.
5. Press **`5` (`RND`)** to randomize the UID on the fly, or **`6` (`4B/7B`)** to flip between 7-byte NTAG215 and 4-byte MIFARE Classic 1K profiles, and re-read with the phone to see the emulated identity change immediately.

---

## Settings (`SET`) & Built-In MCP Server (SSH Opt-In)

![NFC Studio Settings screen](assets/nfc-studio/settings.png)

Press **`Tab`** or **`8 (MODE)`** to open the **`SET`** tab. Settings persist in `$HOME/.config/nfc-studio/config.json` (`0600` permissions):

- **MCP Server (SSH)**: **Disabled by default** (`mcp_enabled: false`). Toggle ON with `Enter` / `Space` / `4 (TOGGLE)` to enable programmatic SSH stdio access for AI agents.
- **Auto Scan on Start**: Controls whether 13.56 MHz polling starts immediately on launch.

### Invoking Over SSH (`--mcp`)

```bash
ssh <cardputer-host> /usr/share/APPLaunch/bin/nfc-studio --mcp
```

| MCP Tool | Purpose |
| --- | --- |
| `nfc_get_status` | ST25R3916 chip identity (`0x2A`), revision, supply mV, settings |
| `nfc_scan_tag` | Live ISO 14443-A poll (`UID`, `ATQA`, `SAK`, NTAG pages, parsed `NDEF`) |
| `nfc_parse_ndef` | Decode NDEF URI/TEXT TLV (`0x03`) from hex pages |
| `nfc_emulate_tag` | Hardware Passive Target A emulation (`confirm_rf: true`, max 30s) |
| `nfc_list_saved` / `nfc_read_saved` | Inspect saved Flipper `.nfc` library |
| `nfc_save_tag` / `nfc_delete_saved` | Save or delete `.nfc` files (`delete` requires `confirm: true`) |
| `nfc_write_ntag` | Write 4-byte NTAG213/215/216 pages (`WRITE 0xA2`) with read-back verify & system-page guard (`confirm_write: true`) |
| `nfc_clone_magic_uid` | Clone 4-byte UID + XOR BCC onto Gen1A (`0x40`/`0x43`) or Gen2/CUID Magic Card (`confirm_write: true`) |
| `nfc_compose_ndef` | Compose URL, Text, or Wi-Fi WSC NDEF TLV into 4-byte pages (optional `save_name` or `write_to_tag` with `confirm_write: true`) |
| `nfc_dict_scan` | Known-key MIFARE Classic 1K/4K dictionary scan (built-in + `~/.config/nfc-studio/mf_keys.dict`, optional `.nfc` v4 export) |
| `nfc_inspect_emv` | Strictly read-only ISO-DEP/EMV inspector (`RATS` + `SELECT PPSE` + `READ RECORD`) with mandatory PAN masking |
| `nfc_scan_multiprotocol` | Sequential ST25R3916 discovery across NFC-A, NFC-B (`SENSB_REQ`), NFC-F/FeliCa (`SENSF_REQ`), and NFC-V/ISO 15693 (`INVENTORY`) |
