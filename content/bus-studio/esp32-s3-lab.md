# ESP32-S3 Hardware, SLIP Bootloader, Security & Crash Diagnostics Lab

The **ESP32-S3** is one of the most popular dual-core Xtensa LX7 Wi-Fi + BLE 5.0 microcontrollers in modern IoT and M5Stack hardware. **Bus Studio `v0.2.0`** turns CardputerZero into a pocket, zero-laptop ESP32-S3 debugger — able to sync with the mask ROM over **RFC 1055 SLIP**, audit read-only **eFuses** and **`0x8000` partition tables**, flag **redacted NVS plaintext risks**, decode **Xtensa LX7 Guru Meditation panics**, forecast **heap OOM leaks**, and profile **non-invasive power states & bootloop sawtooths** straight from CardputerZero's USB-C OTG port!

---

## 1. Native USB-Serial/JTAG (`303a:1001`) vs. CP2102 / CH340 Bridges & Auto-Reset Timing

ESP32-S3 development boards connect to CardputerZero (with **`USB-SW` switched to `HOST`**) in one of two ways:

| Transport | Linux Device | USB `VID:PID` | Reset / Download Sequencing |
| --- | --- | --- | --- |
| **ESP32-S3 Native USB-Serial/JTAG** (`GPIO19` D-, `GPIO20` D+) | `/dev/ttyACM0` | `303a:1001` | Built into the ESP32-S3 silicon. Uses standard USB CDC `SET_CONTROL_LINE_STATE` (`DTR`/`RTS`) handled internally by the chip's USB-Serial/JTAG peripheral — **zero external auto-reset transistors or RC timing drift**! |
| **External USB-UART Bridge** (`CP2102`, `CH340`, `FT232RL`) | `/dev/ttyUSB0` | `10c4:ea60`, `1a86:7523`, `0403:6001` | Drives `EN` (chip reset) and `GPIO0` (boot strap) through a cross-coupled **2-transistor NPN auto-reset circuit** plus an `EN` RC delay capacitor (`1–10 µF`). Slow capacitors or loose jumper wires cause classic *"Failed to connect to ESP32-S3: Wrong boot mode detected"* errors. |
| **Direct 3.3 V TTL UART Wires** *(keep `USB-SW` UP for ADB!)* | `/dev/ttyS0` | N/A (`EXT 14P` or `Grove`) | Connect **EXT `Pin 4 (GND)` → `ESP GND`**, **`Pin 12 (RXD G15)` → `ESP TX`**, **`Pin 14 (TXD G14)` → `ESP RX`** — OR right-side **Grove (`grove_fun=0` UART)**: `1 BLK GND`, `3 YLW TXD → ESP RX`, `4 WHT RXD → ESP TX`. Hold ESP `BOOT` + tap `RST` to enter SLIP ROM mode. |

> [!CAUTION]
> **Safe Wiring Order on `EXT 2.54-14P` (No Hot-Swapping Caps!)**: Always power OFF CardputerZero before attaching/detaching full 14-pin Caps. When attaching 3 individual DuPont UART wires while CardputerZero stays ON (for ADB): **(1)** unplug target ESP32 power/USB first, **(2)** verify `E5V:OFF` in `Bus Studio`, **(3)** stay clear of `Pin 2 (5VIN)` next to `Pin 4 (GND)`, and **(4)** plug **`Pin 4 GND` → `Pin 12/14 RX/TX` → target power last** (unplug target power first when disconnecting). Press **`W`** anywhere in `Bus Studio` to view the live glowing CardputerZero pin-hole map!

> [!TIP]
> **Why Native USB-JTAG Can Vanish During Crashes**: Because `303a:1001` lives inside the ESP32-S3 silicon, a rapid brownout loop or firmware that reconfigures `GPIO19`/`GPIO20` as regular GPIOs will repeatedly drop `/dev/ttyACM0` from Linux! Hold the target's **BOOT (`GPIO0`)** button while tapping **RST (`EN`)** to force Joint Download Boot and keep `303a:1001` enumerated cleanly.

---

## 2. RFC 1055 `SLIP ROM Bootloader` Framing & Commands

When an ESP32-S3 enters **Joint Download Boot** (`GPIO0 = LOW`, `GPIO46 = LOW` at reset), its immutable mask ROM listens for **RFC 1055 SLIP** (Serial Line Internet Protocol) packets over UART0 or Native USB-Serial/JTAG:

1. **SLIP Byte Framing**:
   - Every packet begins and ends with delimiter **`0xC0`** (`END`).
   - Any literal `0xC0` inside the payload is escaped as **`0xDB 0xDC`** (`ESC`, `ESC_END`).
   - Any literal `0xDB` inside the payload is escaped as **`0xDB 0xDD`** (`ESC`, `ESC_ESC`).
2. **8-Byte Little-Endian Command Header**:
   - Byte `0`: Direction (`0x00` = Host → ROM request, `0x01` = ROM → Host response)
   - Byte `1`: Command opcode
   - Bytes `2–3`: Payload length (`uint16` LE)
   - Bytes `4–7`: XOR checksum (initialized to `0xEF` for flash data commands) or return value in responses.
3. **Core ROM Opcodes Used by `bus-studio`**:
   - **`SYNC` (`0x08`)**: 36-byte sync pattern (`0x07 0x07 0x12 0x20` + `32× 0x55`) locking baud rate and verifying the ROM is alive.
   - **`READ_REG` (`0x0A`)**: Strictly read-only 32-bit peripheral register read used by `esp_chip_info` and `esp_efuse_audit` (`EFUSE_RD_*` registers) to inspect silicon revision, MAC address, Flash/PSRAM strapping, and security flags without ever issuing a write!
   - **`SPI_ATTACH` (`0x0D`) & `SPI_SET_PARAMS` (`0x0B`)**: Attaches the external SPI NOR flash pins and sets flash geometry before read/verify operations.
   - **`SPI_FLASH_MD5` (`0x13`)**: Computes hardware MD5 over a flash region on-chip for fast read-back integrity verification.
   - **`FLASH_BEGIN` (`0x02`), `FLASH_DATA` (`0x03`), `FLASH_END` (`0x04`)**: Used **only** by explicitly dual-gated `esp_flash_write` (`confirm_hw: true` + `confirm_flash_write: true`) — permanently blocked from `radio-bridge`.

---

## 3. Quad vs. Octal PSRAM, Strapping Pins (`GPIO0/3/45/46`) & `GPIO35–37`

Two of the most frequent ESP32-S3 hardware failures happen before `app_main()` ever runs — caused by **strapping pin pulls** or **Octal PSRAM pin collisions**:

### Strapping Pin Boot Truth Table (Sampled on `EN` Rising Edge)

| Strapping Pin | Internal Pull | Boot Role | Common Bench Trap |
| --- | --- | --- | --- |
| **`GPIO0`** | Weak Pull-Up (`1`) | `1` = SPI Flash Boot; `0` = Joint Download Boot (`USB/UART`) | Wiring an active-LOW button or unpowered I2C sensor here traps the board in download mode on every power-up. |
| **`GPIO3`** | Floating | Selects JTAG signal source (`0` = USB-Serial/JTAG, `1` = GPIO39–42 Pad JTAG when `EFUSE_STRAP_JTAG_SEL=1`) | External pull-ups can unexpectedly switch JTAG away from Native USB. |
| **`GPIO45`** | Weak Pull-Down (`0`) | **`VDD_SPI` Flash Voltage**: `0` = **`3.3 V`** (Quad Flash/PSRAM); `1` = **`1.8 V`** (Octal `OPI` 1.8 V Flash/PSRAM) | Pulling `GPIO45` HIGH on a 3.3 V Quad Flash module starves the SPI flash at 1.8 V, causing instant `invalid header: 0xffffffff` bootloops! |
| **`GPIO46`** | Weak Pull-Down (`0`) | Combined with `GPIO0` for ROM boot mode & ROM boot log print enable (`0` = print enabled) | Pulling `GPIO46` HIGH while `GPIO0 = LOW` enters an invalid mode and blocks flashing. |

### Why `GPIO35`, `GPIO36`, and `GPIO37` Are Off-Limits on Octal PSRAM (`N8R8` / `N16R8`)

- **Quad Flash / Quad PSRAM (`N8`, `N16`, `N8R2`)**: Uses 4 data lanes (`SPID`, `SPIQ`, `SPIWP`, `SPIHD` on dedicated internal pins `GPIO26–32`), leaving **`GPIO35`, `GPIO36`, and `GPIO37`** free for user peripherals.
- **Octal (`OPI`) 8 MB PSRAM (`N8R8`, `N16R8`)**: Doubles memory bandwidth to 8 data lines (`SPIIO4–SPIIO7` + `SPIDQS`), physically consuming **`GPIO35`, `GPIO36`, and `GPIO37`** inside the module shield! Connecting an OLED, SD card, or sensor to `GPIO35–37` on an `R8` module shorts the PSRAM bus and triggers immediate **`Flash_PSRAM_Pin_Fault`** boot crashes.

---

## 4. `0x8000` Partition Table, `0xE9` App Image Header, eFuse Security & Redacted NVS Audit

### Flash Memory Layout (`0x0000` → End of Flash)

1. **Second-Stage Bootloader (`0x0000` on ESP32-S3)**: Begins with the Espressif **`0xE9` image magic byte**, SPI flash mode (`QIO`/`DIO`/`QOUT`/`DOUT`), clock speed, flash size, entry address, and extended header (`chip_id = 0x0009` for ESP32-S3, SHA-256 append flag).
2. **Partition Table (`0x8000`, 3 KiB)**: Consists of 32-byte entries starting with magic **`0xAA50`** (`[0xAA, 0x50]` on disk), `Type` (`0x00` = `app`, `0x01` = `data`), `Subtype` (`factory`, `ota_0`, `ota_1`, `nvs = 0x02`, `phy_init = 0x01`, `spiffs = 0x82`, `coredump = 0x03`), `Offset`, `Size`, 16-byte `Label`, and `Flags` (`bit 0 = encrypted`), terminated by a `0xEBEB` MD5 checksum record.
3. **Application Partitions (`0x10000`+)**: Each `factory`/`ota_x` slot begins with an **`0xE9` App Image Header** followed by `esp_app_desc_t` (project name, firmware version, compile timestamp, IDF version, and ELF SHA-256).

### eFuse Security (`Zero-eFuse-Write Invariant`) & `ESPSecurityGrade (A–F)`

ESP32-S3 stores security posture inside **One-Time Programmable (OTP) eFuse blocks** — once burned from `0` to `1`, an eFuse bit can **never** be undone. `bus-studio` enforces the **`Zero-eFuse-Write Invariant`** (strictly read-only `READ_REG` inspection) and computes **`ESPSecurityGrade (A–F)`**:

- **Secure Boot v2 (`SECURE_BOOT_EN`)**: RSA-3072 / ECDSA signature verification of bootloader and app images.
- **Flash Encryption (`SPI_BOOT_CRYPT_CNT`)**: Odd number of set bits enables transparent AES-XTS flash encryption (`Release` mode sets all 3 bits `0b111` so encryption cannot be disabled).
- **Debug & Download Lockout (`DIS_USB_JTAG`, `DIS_PAD_JTAG`, `DIS_DOWNLOAD_MODE`)**: Prevents physical attackers from dumping flash or halting the CPU over USB-JTAG.
- **Plaintext NVS Audit (`Redacted NVS Audit Invariant`)**: Unencrypted `nvs` partitions frequently store Wi-Fi `ssid`/`pass`, MQTT passwords, and API tokens in plaintext key-value pages. `esp_partitions_inspect` flags exposed key names and namespaces while **always redacting raw secret values** so audit logs never leak credentials.

---

## 5. Xtensa LX7 Guru Meditation Panics & `HeapTracker` OOM Math

When firmware faults on ESP32-S3, the Xtensa LX7 exception vector prints a **`Guru Meditation Error`** containing the hardware **`EXCCAUSE`** code, faulting **`PC`** (Program Counter), **`EXCVADDR`** (bad memory address), and stack **`Backtrace`**:

| `EXCCAUSE` | Name | Typical Root Cause & `CrashDoctor` Fix |
| --- | --- | --- |
| **`28`** | `LoadProhibited` | Read from an unmapped address (usually `EXCVADDR < 0x1000` = `NULL` pointer + struct field offset after failed `malloc`/`ps_malloc`). |
| **`29`** | `StoreProhibited` | Write through a `NULL` or freed pointer, or writing to read-only flash `.rodata`. |
| **`20`** | `InstrFetchProhibited` | CPU jumped to `0x00000000` (uninitialized callback) or executed non-IRAM code while flash cache was disabled during an SPI write/ISR. |
| **`0`** | `IllegalInstruction` | Corrupted function pointer, stack smash, or unaligned jump into data memory. |
| **`TG0WDT` / `IntWDT`** | Watchdog Reset | A high-priority FreeRTOS task or ISR spun without yielding (`vTaskDelay` / `portYIELD`), starving the Task or Interrupt Watchdog. |
| **`StackCanary`** | Stack Overflow | Local buffers exceeded the task's `xTaskCreate` stack allocation and overwrote the FreeRTOS `0xA5A5A5A5` canary guard words. |

**`HeapTracker` OOM Forecasting**: Even without an instant crash, slow memory leaks silently kill IoT nodes hours later. `HeapTracker` fits a rolling linear regression over free DRAM/PSRAM samples $H(t)$ to compute leak slope $m = dH/dt$ (`B/s`), estimates Time-to-OOM $t_{\text{OOM}} = (H_{\text{now}} - H_{\text{floor}}) / |m|$, and watches **`largest_free_block / free_heap`** fragmentation (because TLS/Wi-Fi sockets fail as soon as contiguous free blocks shrink below `~16–32 KB`).

---

## 6. Interactive Browser Lab: ESP32-S3 Strapping/PSRAM, CrashDoctor & Power Profiler

Experiment with Octal PSRAM `GPIO35–37` conflicts and strapping boot modes (**Tab 1**), dissect Xtensa LX7 Guru Meditation panics and heap OOM curves (**Tab 2**), and simulate non-invasive ESP32-S3 Wi-Fi TX bursts vs. bootloop sawtooth voltage collapse (**Tab 3**):

```interactive:esp32-s3-lab
```
