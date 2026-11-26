# Bus Studio — App Guide & Controls (`v0.2.1`)

**Bus Studio** (`bus-studio` v0.2.1) turns M5Stack CardputerZero into a non-root pocket hardware bench & **ESP32-S3 Companion Lab**: **16×8 I2C Bus Radar with `120+` `WHO_AM_I` chip identifiers (`I2CChipDB`)**, live register byte-diff & sparkline plotter, **Read-Only SPI NOR Flash JEDEC `0x9F` + Shannon entropy scanner**, **Auto-Baud Smart UART Console**, **4-CH kernel-timestamped `GPIO_V2` Logic Analyzer with IEEE 1364 `.vcd` export (`VCDExport`)**, **`bq27220` Battery `R_int` & 5-CH `m5ioe1` ADC Oscillograph**, **4-CH Hardware PWM / RC Servo Generator**, **Safe Grove / Ext 5V Rail Controller**, **ESP32-S3 Native USB-Serial/JTAG & SLIP ROM Companion Lab** (read-only eFuse `ESPSecurityGrade`, `0x8000` partition & redacted NVS audit, `CrashDoctor`, `HeapTracker`, non-invasive power/bootloop profiler, dual-gated flash backup/write), **Smart `HardwareAdvisor`**, and an embedded **6-model Pure-Go INT8 `.czml` Neural Suite (Domains `23–28`, `0 allocs/op`)**: `BusSignalNet-1D`, `BusStreamNet-1D`, `BusPowerAE`, `ESPBootCrashNet-1D`, `ESPPowerProfileNet-1D`, and `ESPFirmwareAuditNet-1D`.

> [!CAUTION]
> **3.3 V CMOS Logic, Power Rail & Zero-eFuse-Write Safety**:
> - CardputerZero's Raspberry Pi CM0 GPIOs, I2C, SPI, UART, and `m5ioe1` ADC pins are **3.3 V ONLY — NOT 5 V tolerant**. Always check target logic levels or use a 3.3 V level shifter before connecting jumper wires.
> - External power rails (`Ext 5V`, Grove VCC) default **OFF** and automatically turn **OFF** on exit (`AutoRailOffOnExit: true`). **`ProtectedPinGuard`** blocks output writes on critical CM0 system pins (LCD SPI, keyboard matrix, CC1101/NFC SPI, internal I2C0 PMIC/audio/IMU, and SDIO).
> - **Zero-eFuse-Write Invariant**: `bus-studio` NEVER burns or writes ESP32-S3 eFuse bits (`esp_efuse_audit` is strictly read-only).
> - **Redacted NVS Audit Invariant**: NVS security inspections always mask credential values (Wi-Fi PSKs, API keys, tokens) across UI, logs, and MCP JSON.

---

## 1. Home Menu, Simple vs. Expert Mode & `USB-SW` Host vs. Device/ADB Setup

![Bus Studio Home Menu](assets/bus-studio/home.png)

- **Live Bench Status Strip**: Displays active backend (`HW` vs. `SIM`), `bq27220` battery voltage & `R_int` health pill, external rail indicator (`EXT5V OFF/ON`), Black-Box ring armed state, ESP32-S3 USB target badge, and `BusPowerAE` status.
- **Simple Mode** launches with everyday hardware diagnostics front and center: **`Quick Missions`** (`#1`–`#9`), **I2C Bus Radar**, **Smart UART Console**, **4-CH Logic Analyzer**, **Power & Battery Scope**, **5-CH ADC Voltmeter**, **ESP32-S3 Companion Lab**, **AI Hardware Advisor**, **Saved & Replay**, and **Settings**.
- Press **`5 EXPERT`** on Home (or toggle in Settings) to unlock **Read-Only SPI NOR Flash**, **Protected GPIO Matrix**, **4-CH Hardware PWM & Safe Rails**, and **Color-Coded Wiring Reference Cards**.
- **Context-Aware Help (`H`)**: Press **`H`** on any screen or sub-state (e.g., I2C Radar vs. Register Plot, UART ASCII vs. HEX, Power Scope vs. 4-CH ADC, ESP32-S3 Chip/Crash/Power, Mission wizard stages, Saved List vs. Replay) to open a full-screen modal with a 2-line summary and color-coded keycap badges (**cyan** for `4..8` bottom softkeys, **amber** for hotkeys). Use **`Z`/`C`** to page overflow controls and **`H` / `Enter` / `Esc`** to close.

### CardputerZero `USB-SW` Switch: `HOST` vs. `DEV / ADB`

Before plugging an **ESP32-S3** (Native USB-Serial/JTAG `303a:1001` or CP2102/CH340 board) into CardputerZero's USB-C port via an OTG cable/adapter, check the physical **`USB-SW`** slide switch:

1. **Slide `USB-SW` to `HOST`**: Switches CardputerZero's CM0 USB port into USB Host mode so `/dev/ttyACM0` (Native ESP32-S3 USB-JTAG `303a:1001`) or `/dev/ttyUSB0` (CP2102/CH340/FTDI) enumerates cleanly without root.
2. **Use Wi-Fi SSH for `--mcp` Automation**: While `USB-SW` is in `HOST`, USB-C ADB/gadget mode to your PC is disconnected — connect AI agents over Wi-Fi (`ssh zhenya@cardputerzero /usr/share/APPLaunch/bin/bus-studio --mcp`).
3. **Slide `USB-SW` back to `DEV / ADB`** whenever you want to plug CardputerZero back into a laptop as a USB Device/ADB gadget.
4. **Want to Keep ADB Active While Connecting an ESP32?** Leave `USB-SW` UP (`DEV / ADB`) and wire the ESP32 over **3.3 V TTL UART** using either the top **14-pin `EXT 2.54-14P`** header (`Pin 4 GND`, `Pin 12 RXD → ESP TX`, `Pin 14 TXD → ESP RX`) or the right-side **Grove `HY2.0-4P`** port (`1 BLK GND`, `3 YLW TXD → ESP RX`, `4 WHT RXD → ESP TX` with `grove_fun = 0` UART mode).

### Hot-Plug & Power-Off Hardware Safety Rules (Top 14-Pin `EXT` vs. Side Grove)

> [!WARNING]
> **Should CardputerZero Be Powered OFF When Connecting to the Top 14-Pin Header?**
> - **Full 14-Pin Cap Modules (`CC1101/NFC`, `LoRa`, etc.) — ALWAYS POWER OFF**: Never hot-swap a full Cap onto `EXT 2.54-14P`. Even a slight tilt while seating a 2×7 header can short `Pin 2 (5VIN)` or `Pin 6 (5VOUT)` into `Pin 4 (GND)` or adjacent 3.3 V CM0 GPIOs.
> - **Individual DuPont Signal Wires (`GND + TX + RX`) — Power Off Recommended; Strict 4-Step Rule If Live**:
>   - *Safest workflow*: Power OFF both CardputerZero and the target MCU, seat jumper wires, visually verify **`Pin 2 (5VIN)`** is untouched, then power on.
>   - *If keeping CardputerZero ON (e.g., to keep ADB alive)*, follow all 4 rules strictly:
>     1. **Unplug power/USB from the target ESP32/MCU** while inserting wires.
>     2. Confirm **`E5V:OFF`** in `Bus Studio` (default OFF, so `Pin 6` has no 5 V).
>     3. Keep metal jumper pins clear of **`Pin 2 (5VIN)`** — it sits right next to `Pin 4 (GND)` at `2.54 mm` pitch.
>     4. **Connection order**: Connect **`Pin 4 (GND)` first** → **`Pin 12 (RXD)` & `Pin 14 (TXD)`** → **power the target MCU last**. Disconnect in reverse order (unplug target power first).
> - **Side Grove Port (`HY2.0-4P`) — Safer Keyed Plug**: Because Grove uses a polarized plastic housing that cannot be misaligned, plugging a Grove-to-DuPont lead while `G5V:OFF` is far safer than probing bare 2.54 mm pins (still power the target MCU only after wires are seated).

### Official CardputerZero `EXT 2.54-14P` & `HY2.0-4P` Pinout (Verified `docs.m5stack.com`)

Holding CardputerZero facing you (LCD upright), the top **`EXT 2.54-14P`** female header has odd pins (`1..13`) on the outer/top row and even pins (`2..14`) on the inner/LCD-side row:

| Odd (Outer Row) | Signal | Even (Inner Row) | Signal |
| --- | --- | --- | --- |
| **Pin 1** | `G26` (`HAT_P0` / `USB_D+`*) | **Pin 2** | `5VIN` *(Power Input — do not short!)* |
| **Pin 3** | `G23` (`HAT_P1` / `USB_D-`*) | **Pin 4** | **`GND`** *(0 V common)* |
| **Pin 5** | `G22` (GPIO) | **Pin 6** | `5VOUT` (`ext_5v_out`, OFF by default) |
| **Pin 7** | `G11` (`SPI0_CLK`) | **Pin 8** | `G02` (`I2C1_SDA`) |
| **Pin 9** | `G10` (`SPI0_MOSI`) | **Pin 10** | `G03` (`I2C1_SCL`) |
| **Pin 11** | `G09` (`SPI0_MISO`) | **Pin 12** | **`G15`** (`UART_RXD` ← target `TX`) |
| **Pin 13** | `G07` (`SPI0_CS1`) | **Pin 14** | **`G14`** (`UART_TXD` → target `RX`) |

*\*`Pin 1` & `Pin 3` default to GPIO (`G26`/`G23`) unless `ext_usb_gpio_fun = 1`.*

**Right-Side Grove (`HY2.0-4P`)** — dual-mode via `grove_fun` (`GPIO4`):
- **Pin 1 (Black)**: `GND` | **Pin 2 (Red)**: `5VOUT` (`grove_5v_out`, `< 500 mA`, OFF by default)
- **Pin 3 (Yellow)**: `G14 UART_TXD` (`grove_fun = 0`, default) **or** `G02 I2C1_SDA` (`grove_fun = 1`)
- **Pin 4 (White)**: `G15 UART_RXD` (`grove_fun = 0`, default) **or** `G03 I2C1_SCL` (`grove_fun = 1`)

---

## 2. Quick Missions (9 Guided Wiring & ESP32-S3 Hardware Wizards)

![Bus Studio Quick Missions Menu](assets/bus-studio/missions.png)

![Bus Studio Guided Mission Color-Coded Wiring Card](assets/bus-studio/mission_wiring.png)

Open **`Quick Missions`** (`#1` on Home) for step-by-step guided bench workflows complete with on-screen **color-coded wiring pinout diagrams** before a single signal is probed:

1. **Identify Unknown I2C Sensor (`I2CChipDB`)**: Displays Grove Port A wiring (**Black** `GND`, **Red** `3.3V`, **Yellow** `SDA`, **White** `SCL`), scans `0x03–0x77`, probes `WHO_AM_I` registers across `120+` chips, and highlights newly attached parts against `KnownEnv`.
2. **Auto-Baud Unknown UART Target (`TX ↔ RX`)**: Guides 3-wire crossover wiring (`GND–GND`, target `TX → CM0 RX`, target `RX ← CM0 TX`), auto-locks baud (`9600–921600`), and passes decoded output to **`BusStreamNet-1D`**.
3. **Probe Unknown Digital Wire (4-CH Logic + `BusSignalNet-1D`)**: Guides safe `CH0–CH3` logic hookup, captures kernel-timestamped `GPIO_V2` edges, classifies the wire, and saves a one-press PulseView **`.vcd`** file.
4. **Battery Health & `R_int` (`ΔV/ΔI`) Load Sag Audit**: Computes internal resistance $R_{\text{int}} = \Delta V / \Delta I$ (`mΩ`), predicts brownout margin, and scores power health via **`BusPowerAE`**.
5. **Read-Only SPI NOR Flash Fingerprint (`JEDEC 0x9F`)**: Displays 3.3 V SOIC-8 clip pinout, executes read-only **`JEDEC 0x9F`** lookup, verifies MISO isn't stuck at `0xFF`/`0x00`, and scans block **Shannon entropy**.
6. **Test RC Servo / PWM Fan (`50 Hz` / `25 kHz`)**: Verifies safe PWM routing via `ProtectedPinGuard`, sweeps `1.0–2.0 ms` (`0°–180°`) servo pulses or `25 kHz` fan duty cycle while watching `bq27220` current draw.
7. **ESP32-S3 Chip, Partition & eFuse Security Audit**: Confirms `USB-SW` → `HOST`, syncs over **`SLIP ROM Bootloader`** (`303a:1001` or `/dev/ttyUSB*`), reports silicon revision, Flash & Quad/Octal PSRAM, runs strictly read-only eFuse audit (**`ESPSecurityGrade A–F`**), inspects the `0x8000` partition table + redacted NVS keys, and invokes **`ESPFirmwareAuditNet-1D`**.
8. **ESP32-S3 CrashDoctor & Live Heap Leak Watch**: Attaches to the ESP32-S3 serial stream, dissects **Xtensa LX7 Guru Meditation** panics (`EXCCAUSE`, `PC`, `EXCVADDR`, backtrace) with **`CrashDoctor`** + **`ESPBootCrashNet-1D`**, and charts real-time DRAM/PSRAM heap decay + Time-to-OOM via **`HeapTracker`**.
9. **ESP32-S3 Non-Invasive Power State & Bootloop Profiler**: Profiles ESP32-S3 current regimes (`DeepSleep_uA`, `LightSleep_Modem`, `WiFi_TX_Burst`, `BLE_Adv_Pulse`, `Bootloop_Sawtooth`, `Brownout_Reset_Loop`) using CardputerZero's onboard `bq27220` + `m5ioe1` sensors and **`ESPPowerProfileNet-1D`** with zero shunt-cutting required.

> [!TIP]
> **Try ESP32-S3 Companion Lab in 30 seconds**: Flip CardputerZero's **`USB-SW`** to **`HOST`**, plug an ESP32-S3 board into the USB-C port with an OTG cable, launch **Quick Missions → #7 ESP32-S3 Chip & eFuse Security Audit**, and watch `bus-studio` identify the chip, Octal/Quad PSRAM variant, `0x8000` partitions, and `ESPSecurityGrade` without a laptop!

---

## 3. ESP32-S3 Companion Lab Views (`v0.2.0`)

![ESP32-S3 Chip Info and eFuse Security Audit](assets/bus-studio/esp_chip_audit.png)

- **Chip Info, Partitions & Read-Only eFuse Audit (`esp_chip_audit.png`)**: Shows USB transport (`Native USB-JTAG 303a:1001` vs `CP2102/CH340`), chip revision, MAC, Flash JEDEC size, Quad vs. Octal PSRAM badge, read-only eFuse lock matrix (`Secure Boot v2`, `Flash Encryption`, `USB-JTAG`, `Download Mode`), **`ESPSecurityGrade (A–F)`**, `0x8000` partition table + `0xE9` app header summary, redacted NVS exposure count, and **`ESPFirmwareAuditNet-1D`** verdict. Press **`Tab`** to switch between **Chip/eFuse**, **Partitions/NVS**, and **Gated Flash Backup/Write**.

![ESP32-S3 CrashDoctor and HeapTracker](assets/bus-studio/esp_crash_heap.png)

- **CrashDoctor & HeapTracker (`esp_crash_heap.png`)**: Live Xtensa LX7 panic decoder extracting `EXCCAUSE` (`LoadProhibited`, `InstrFetchProhibited`, `TG0WDT`, `StackCanary`, `Brownout`), `PC`/`EXCVADDR` registers, plain-English fix suggestions, and **`ESPBootCrashNet-1D`** classification. Press **`Tab`** for **`HeapTracker`** plotting free DRAM/PSRAM, min-free watermark, largest contiguous block fragmentation %, leak slope (`B/s`), and projected Time-to-OOM.

![ESP32-S3 Non-Invasive Power State and Bootloop Profiler](assets/bus-studio/esp_power_profile.png)

- **Non-Invasive ESP Power & Bootloop Profiler (`esp_power_profile.png`)**: Dual-trace `bq27220` current (`mA`) and supply voltage (`V`) scope tuned for ESP32-S3 signatures, flagging `3.00 V` brownout dips, Wi-Fi TX bursts, and periodic **`Bootloop_Sawtooth`** reset cycles via **`ESPPowerProfileNet-1D`** (`ESP_POWER_STATE` events on `BusEventBus`).

![ESP32-S3 Strapping Pins and Octal PSRAM Pinout Reference](assets/bus-studio/esp_s3_pinout.png)

- **ESP32-S3 Strapping & Octal PSRAM Pinout Reference (`esp_s3_pinout.png`)**: Instant pocket wiring card calling out **`GPIO0`**, **`GPIO3`**, **`GPIO45` (`VDD_SPI`)**, **`GPIO46`** strapping pins, **`GPIO19/20`** Native USB D-/D+, and red warnings on **`GPIO35–37`** (permanently occupied by Octal `OPI` PSRAM on `N8R8`/`N16R8` modules).

---

## 4. I2C Bus Radar (`16×8`) & Live Register Byte-Diff / Sparkline Plotter

![16x8 I2C Bus Radar and WHO_AM_I Identification](assets/bus-studio/i2c_radar.png)

![I2C Live Register Byte-Diff and Sparkline Plotter](assets/bus-studio/i2c_plot.png)

- **16×8 Bus Radar**: Displays all 128 7-bit addresses (`0x00–0x7F`; reserved ranges dimmed). Active ACKed addresses glow emerald (`Known`) or cyan (`NEW` vs. `KnownEnv`).
- Move cursor with **`F`/`X`/`Z`/`C`**, press **`Enter`** to probe `WHO_AM_I` against **`I2CChipDB` (`120+` chips)**, or press **`Tab`** for **Live Register Byte-Diff & 16-bit Sparkline Plotter**.
- Softkeys: **`4 SCAN`**, **`5 ID`**, **`6 DIFF`**, **`7 ENV`**, **`8 BUS`**.

---

## 5. Auto-Baud Smart UART Console

![Auto-Baud Smart UART Console](assets/bus-studio/uart_console.png)

- Opens `/dev/ttyS0`, `/dev/ttyUSB*`, or `/dev/ttyACM*` without root.
- **Auto-Baud (`4 AUTO`)**: Locks `9600–921600` (including ESP8266 `74880` and ESP32-S3 `115200` ROM logs) with framing-error scoring and **`BusStreamNet-1D`** payload badges (`ASCII_BootLog`, `JSON_NMEA_Telemetry`, `Binary_Sensor_Frame`, `Baud_Mismatch_Garble`).
- Press **`Tab`** for Dual Hex/ASCII Dump, **`5 BAUD`** to cycle speed, **`6 SEND`** for gated TX, and **`7 SAVE`** to archive logs inside `~/bus-studio/logs/`.

---

## 6. 4-CH Kernel-Timestamped Logic Analyzer & IEEE `.vcd` Export

![4-Channel Logic Analyzer Waveforms and Protocol Decode](assets/bus-studio/logic_waves.png)

- Captures 4 channels (`CH0–CH3`) using Linux `GPIO_V2` nanosecond kernel edge timestamps.
- **Protocol Decoders (`Tab`)**: PWM, RC Servo (`µs`/`0°–180°`), UART 8N1, I2C, and 1-Wire ROM, paired with **`BusSignalNet-1D`** (`5 AI`) and IEEE 1364 **`VCDExport`** (`6 VCD`, saved to `~/bus-studio/captures/*.vcd` for PulseView/GTKWave).

---

## 7. Battery Scope (`bq27220`), `R_int` Sag & 5-CH ADC Voltmeter (`m5ioe1`)

![Battery Scope and R_int Sag Oscillograph](assets/bus-studio/power_scope.png)

![5-Channel m5ioe1 ADC Voltmeter](assets/bus-studio/adc_voltmeter.png)

- **Battery Power Scope (`bq27220`)**: Real-time `V/I/W/SoC/Temp` and **`R_int = ΔV / ΔI`** (`mΩ`) paired with **`BusPowerAE`** (`AnomalyZ >= 3.2σ` → `POWER_ANOMALY`).
- **5-CH ADC Voltmeter (`m5ioe1`)**: Five `0.00–3.30 V` analog channels with live ripple bars and `> 3.1 V` over-voltage warnings.

---

## 8. Expert Labs: Read-Only SPI Flash, Protected GPIO Matrix, 4-CH PWM & Wiring Reference

![Read-Only SPI NOR Flash JEDEC 0x9F and Shannon Entropy](assets/bus-studio/spi_flash.png)

- **Read-Only SPI NOR Flash Lab**: `JEDEC 0x9F`, status `0x05`, safe `0x03` dumps (`~/bus-studio/dumps/*.bin`), and per-block Shannon entropy. **Never issues erase or program opcodes.**

![Protected GPIO Matrix](assets/bus-studio/gpio_matrix.png)

- **Protected GPIO Matrix**: Live `HIGH`/`LOW` pills on all 28 user-bank CM0 GPIOs with red **`LOCK`** badges enforced by **`ProtectedPinGuard`**.

![4-CH Hardware PWM and Safe Rail Controller](assets/bus-studio/pwm_gen.png)

- **4-CH Hardware PWM & Safe Rail Controller**: Hardware PWM (`50 Hz` Servo, `1 kHz` LED, `25 kHz` PC fan) and explicitly gated `Ext 5V` / Grove VCC rails (`AutoRailOffOnExit: true`).

![Interactive CardputerZero Physical Wire Map (Press W from Any Tab)](assets/bus-studio/wiring_ref.png)

- **Interactive Visual CardputerZero Wire Maps (Press `W` from ANY Tab!)**: Renders a top-down silhouette of the actual CardputerZero chassis (`EXT 2.54-14P` top socket + right-side `HY2.0-4P` Grove socket) with **glowing colored dots on the exact physical holes to plug jumper wires into** across **8 pages** (`Z`/`C` or `4`/`5`): (1) ESP32/S3 UART on EXT 14P, (2) ESP32/UART on Grove Right, (3) I2C Sensor (Grove/EXT), (4) SPI NOR Flash SOIC-8 on EXT 14P, (5) 4-CH Logic Probe on EXT 14P, (6) Full Official EXT 2.54-14P Pinout, (7) Dual-Mode Grove UART/I2C, and (8) ESP32-S3 Strapping & Octal PSRAM. Press **`6`** right on the diagram to switch hardware **`Grove MUX (UART ↔ I2C)`** live, and **`7`** to toggle **`Grove 5V`**.

---

## 9. Saved Captures, Black-Box Replay, AI `HardwareAdvisor` & Settings

![Saved Captures and Black-Box Replay](assets/bus-studio/saved_replay.png)

![AI Hardware Advisor Diagnostics](assets/bus-studio/ai_advisor.png)

![Bus Studio Settings and Opt-In MCP Server](assets/bus-studio/settings.png)

- **Saved Captures & Replay**: Browse and replay `.vcd`, `.bin`, UART logs, and RAM Black-Box dumps sandboxed in `~/bus-studio/{captures,dumps,logs}/` (`0600`).
- **Smart `HardwareAdvisor`**: Press **`ADV`** anywhere for instant plain-English bench fixes (I2C pull-ups, UART baud garble, SPI floating MISO, battery `R_int` sag, and ESP32-S3 strapping/Octal PSRAM conflicts).
- **Settings**: Configure Simple/Expert Mode, default I2C/UART/SPI/ESP ports, **`AutoRailOffOnExit`** (`ON`), Black-Box Auto-Arm, and **MCP Server (`--mcp`, OFF by default)**.

---

## 10. Opt-In MCP Server (`38` Tools) & `radio-bridge` Integration

Enable **MCP Server (`--mcp`)** in **Settings** (`~/.config/bus-studio/config.json` → `"mcp_enabled": true`), then connect over Wi-Fi SSH:

```bash
ssh zhenya@cardputerzero /usr/share/APPLaunch/bin/bus-studio --mcp
```

### All 38 MCP Tools

| Category | Tools | Safety Gate Notes |
| --- | --- | --- |
| **Status & Advisor (4)** | `bus_status`, `bus_advisor_diagnose`, `bus_neural_suite`, `bus_events_poll` | Read-only diagnostics, 6-model `.czml` digests & `BusEventBus` cursor feed (includes `ESP_CRASH`, `ESP_POWER_STATE`) |
| **I2C Lab (6)** | `bus_i2c_list`, `bus_i2c_scan`, `bus_i2c_identify`, `bus_i2c_read_regs`, `bus_i2c_diff_watch`, `bus_i2c_known_env` | `bus_i2c_known_env clear` requires `confirm: true` |
| **SPI Flash Lab (3)** | `bus_spi_jedec`, `bus_spi_read_dump`, `bus_spi_entropy_scan` | Strictly read-only (`0x9F`, `0x03`, `<= 16 MiB`); never erases or writes flash |
| **UART Console (4)** | `bus_uart_ports`, `bus_uart_autobaud`, `bus_uart_read_log`, `bus_uart_send` | `bus_uart_send` requires explicit `confirm_hw: true` (`<= 256` bytes) |
| **Logic Analyzer (4)** | `bus_logic_capture`, `bus_logic_decode`, `bus_logic_fingerprint`, `bus_logic_export_vcd` | `.vcd`/`.csv` sandboxed strictly to `~/bus-studio/captures/` (`0600`); `clear` requires `confirm: true` |
| **GPIO, PWM & Rails (5)** | `bus_gpio_read_all`, `bus_gpio_set`, `bus_pwm_control`, `bus_rails_status`, `bus_rails_set` | `bus_gpio_set`, `bus_pwm_control` (enable), `bus_rails_set` require `confirm_hw: true` + `ProtectedPinGuard` |
| **Power & Captures (4)** | `bus_power_status`, `bus_adc_read`, `bus_blackbox_control`, `bus_captures_manage` | `bus_captures_manage delete` requires `confirm: true` |
| **ESP32-S3 Companion Lab (8)** | `esp_chip_info`, `esp_efuse_audit`, `esp_partitions_inspect`, `esp_crash_diagnose`, `esp_heap_watch`, `esp_power_profile`, `esp_flash_backup`, `esp_flash_write` | First 6 are strictly read-only (`Zero-eFuse-Write` & `Redacted NVS Audit` invariants) and allowlisted in `radio-bridge`; `esp_flash_backup` requires `confirm_hw: true`; `esp_flash_write` requires `confirm_hw: true` + `confirm_flash_write: true` + read-back verification — **both flash tools are permanently blocked in `radio-bridge`** |

### Next Steps in the Learning Portal
- Master I2C/SPI/UART/PWM/Power theory in **[Bus Protocols & Electronics Theory →](#/bus-protocols)**.
- Explore SLIP ROM framing, strapping pins, Octal PSRAM, eFuses, and Xtensa panics in **[ESP32-S3 Hardware & Protocol Lab →](#/esp32-s3-lab)**.
- Dive into all 6 models (Domains `23–28`) in **[ML: 6-Model INT8 Bus Neural Suite →](#/bus-ml)**.
