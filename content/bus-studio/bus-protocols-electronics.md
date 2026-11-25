# Hardware Bus Protocols, Signal Integrity, Power Physics & IEEE `.vcd` Theory

This deep-dive explains the electrical physics, timing budgets, wire protocols, safety limits, and waveform formats behind **`bus-studio`** on M5Stack CardputerZero — so every I2C ACK, SPI JEDEC read, UART framing error, GPIO bounce glitch, and battery voltage sag makes complete physical sense.

---

## 1. I2C Open-Drain Signaling, Pull-Up RC Rise Time & `WHO_AM_I`

Unlike push-pull buses, **I²C (Inter-Integrated Circuit)** uses **open-drain** (or open-collector) NMOS drivers on both `SDA` (data) and `SCL` (clock). Devices can **only pull a line LOW to `GND`** — they **never actively drive it HIGH**. Instead, external pull-up resistors $R_p$ connected to `3.3 V` charge the total bus capacitance $C_{\text{bus}}$ (PCB traces + jumper wires + chip input pins, typically `30–200 pF`) back up to logic `1`.

### Pull-Up Resistor & Rise-Time Math
When an open-drain transistor releases `SDA` or `SCL`, the bus voltage rises exponentially:

$$V(t) = V_{DD}\left(1 - e^{-t / (R_p C_{\text{bus}})}\right)$$

Between standard CMOS thresholds $V_{IL} = 0.3\,V_{DD}$ (`0.99 V`) and $V_{IH} = 0.7\,V_{DD}$ (`2.31 V`), the `30% → 70%` rise time is:

$$t_r = R_p C_{\text{bus}} \ln\!\left(\frac{0.7}{0.3}\right) \approx 0.8473 \, R_p C_{\text{bus}}$$

- **Too weak $R_p$ (e.g., `47 kΩ` on long `200 pF` jumpers)**: $t_r \approx 8.0\,\mu\text{s}$ — completely violating I2C Standard Mode (`100 kHz`, $t_{r,\max} = 1000\text{ ns}$) and Fast Mode (`400 kHz`, $t_{r,\max} = 300\text{ ns}$). `SCL` never reaches $V_{IH}$ before sampling, producing phantom NACKs or corrupted reads.
- **Too strong $R_p$ (e.g., `330 Ω`)**: Forces `10 mA` sink current ($I_{OL} = 3.3\text{ V} / R_p$), exceeding the `3 mA` Standard/Fast Mode sink limit and raising $V_{OL}$ above `0.4 V` so devices fail to see logic `0`.
- **Sweet Spot (`3.3 V` bench)**: **`4.7 kΩ`** for `100 kHz` or **`2.2 kΩ`** for `400 kHz` (`I_OL ≈ 0.7–1.5 mA`).

### 7-Bit Addressing, ACK/NACK & `WHO_AM_I` (`I2CChipDB`)
Every I2C transaction opens with a **START** (`SDA` falling while `SCL` is HIGH), followed by a **7-bit address (`0x03–0x77`)** + 1 R/W bit. Any chip matching that address pulls `SDA` LOW on the 9th clock pulse (**ACK**). Because dozens of sensors share popular addresses (e.g., `0x68` can be `MPU6050`, `BMI270`, `DS3231`, or `ICM-20948`; `0x76` can be `BMP280`, `BME280`, `BME680`, or `MS5611`), `bus-studio`'s **`I2CChipDB`** safely reads canonical **`WHO_AM_I` / Chip-ID registers** (such as `0xD0 = 0x60` for `BME280`, `0x75 = 0x68` for `MPU6050`) to fingerprint the exact silicon without guessing.

---

## 2. SPI Modes (`CPOL`/`CPHA`), Read-Only `JEDEC 0x9F` & Shannon Entropy

**SPI (Serial Peripheral Interface)** is a full-duplex, push-pull 4-wire synchronous bus (`SCLK`, `MOSI`, `MISO`, `CS#`) capable of megahertz speeds without pull-up rise-time bottlenecks.

### The 4 SPI Modes
Clock polarity (`CPOL`) selects idle clock level (`0 = LOW`, `1 = HIGH`) and clock phase (`CPHA`) selects whether data is sampled on the **leading (`0`)** or **trailing (`1`)** clock edge:
- **Mode 0 (`CPOL=0, CPHA=0`)** and **Mode 3 (`CPOL=1, CPHA=1`)** are used by virtually all SPI NOR flash chips (`W25Qxx`, `GD25Qxx`, `MX25Lxx`).

### Read-Only NOR Flash Inspection (`JEDEC 0x9F` & `0x03`)
To protect target firmware from accidental corruption, `bus-studio` strictly limits SPI flash transactions to **read-only opcodes**:
1. **`0x9F` (RDID — JEDEC ID)**: Returns 3 bytes — **Manufacturer ID** (e.g., `0xEF` Winbond, `0xC8` GigaDevice, `0xC2` Macronix, `0x20` Micron), **Memory Type**, and **Capacity Code** ($2^{\text{cap}}$ bytes, e.g., `0x17 = 2^{23} = 8\text{ MiB}` = `64 Mbit`). If `bus-studio` reads `0xFF 0xFF 0xFF` or `0x00 0x00 0x00`, `HardwareAdvisor` immediately flags an unseated SOIC-8 clip, missing `3.3 V` power, or floating/shorted `MISO`.
2. **`0x03` (Sequential Read) + Shannon Entropy**: For each flash block, `bus-studio` computes byte-distribution **Shannon entropy**:
   $$H = -\sum_{i=0}^{255} p_i \log_2(p_i) \quad [\text{bits/byte}, \;\; 0 \le H \le 8]$$
   - $H \approx 0.0$: Erased `0xFF` or zero-filled padding.
   - $H \approx 3.5\text{–}5.2$: Plaintext ASCII strings, bootlogs, or configuration tables.
   - $H \approx 5.5\text{–}6.8$: Uncompressed ARM/Xtensa/RISC-V machine code.
   - $H \ge 7.6$: Compressed (`gzip`/`LZMA`/`SquashFS`) or **encrypted** firmware blobs.

---

## 3. UART `8N1` Framing, Baud-Rate Error Math & `Auto-Baud`

**UART** has no shared clock line — transmitter and receiver rely on independent local oscillators agreed to a nominal **baud rate** (`9600` to `921600 bps`). In canonical **`8N1`** format, every byte occupies **10 bit periods** ($T_{\text{bit}} = 1/\text{baud}$):
- **Idle**: Line stays HIGH (`1`).
- **Start Bit (`1` bit)**: Falling edge to LOW (`0`) synchronizes the receiver's bit timer; the receiver samples at the center of each subsequent bit ($1.5\,T_b, 2.5\,T_b, \dots, 9.5\,T_b$).
- **Data Bits (`8` bits)**: Transmitted **LSB first** (`b0` through `b7`).
- **Stop Bit (`1` bit)**: Must sample HIGH (`1`) at $t = 9.5\,T_{\text{rx}}$.

### Clock Drift & UART Framing Error Budget
If the transmitter runs at baud $B_{\text{tx}}$ and the receiver samples at $B_{\text{rx}}$, the cumulative timing slip by the center of the Stop Bit (`9.5` bit times after the Start edge) is:

$$\Delta t_{\text{stop}} = 9.5 \cdot \left|\frac{1}{B_{\text{tx}}} - \frac{1}{B_{\text{rx}}}\right|$$

To still land inside the `±0.5` bit window of the Stop Bit (allowing `~0.15` bit margin for rise-time jitter), the total relative baud mismatch must stay below:

$$\left|\frac{B_{\text{rx}} - B_{\text{tx}}}{B_{\text{tx}}}\right| < \frac{0.35}{9.5} \approx 3.7\% \quad (\text{practical design limit } \pm 2\%)$$

When mismatch exceeds this threshold, the receiver samples a `0` data bit where the `1` Stop Bit should be — triggering a **UART Framing Error** and spewing non-ASCII garble (`0xFE`, `0x80`, `ÿ`). **`Auto-Baud`** solves this by measuring the **shortest high/low pulse width** $T_{\min}$ across incoming edges (which corresponds to a single isolated `1` or `0` bit) and snapping $1 / T_{\min}$ to the nearest standard baud rate (`74880` for ESP8266 ROM, `115200` for Linux/ESP32, `9600` for GPS NMEA).

---

## 4. Interactive 3-Tab Hardware Bus, I2C Pull-Up & Power Sag Lab

Experiment with all three physical domains live in your browser below — break a UART link with baud mismatch in **Tab 1**, tune I2C pull-up resistors and click chips on the `16×8` radar in **Tab 2**, and test RC servo pulses alongside Li-Ion `R_int` brownout sag in **Tab 3**:

```interactive:bus-logic-lab
```

---

## 5. GPIO Bounce, 3.3 V ESD Protection & `GPIO_V2` Kernel Edge Capture

- **Why 5 V Destroys 3.3 V CM0 Pins**: CMOS inputs contain internal **ESD protection clamping diodes** between the pin and the `3.3 V` supply rail (`VDD`). Applying `5.0 V` directly forward-biases the upper clamp diode (`5.0 V - 3.3 V - 0.6 V = 1.1 V` across a tiny silicon diode), injecting destructive latch-up current into the SoC. Always step 5 V signals down via a bidirectional MOSFET level shifter or a `10 kΩ / 20 kΩ` resistor divider ($5\text{ V} \times \frac{20}{10+20} = 3.33\text{ V}$).
- **Mechanical Switch Bounce (`1–20 ms`)**: Pressing a tactile button causes microscopic metal contacts to chatter open/closed 5–30 times over several milliseconds. `BusSignalNet-1D` recognizes irregular `50 µs–4 ms` micro-bursts as `Switch_Bounce` rather than a clean digital protocol.
- **Linux `GPIO_V2` Edge Capture (`GPIO_V2_GET_LINE_IOCTL`)**: Rather than burning CPU polling `/sys/class/gpio` (which suffers millisecond OS scheduling jitter), `bus-studio` requests rising/falling edge events directly through Linux's modern **`gpiochip` v2 character-device ioctl** — the kernel ISR attaches monotonic **nanosecond hardware timestamps** in interrupt context and streams them to non-root Go code.

---

## 6. PWM / RC Servos, Li-Ion Internal Resistance (`R_int`) & IEEE `.vcd`

### PWM Duty Cycle & RC Servo Standard (`50 Hz`)
- **Duty Cycle**: $D = \frac{t_{\text{high}}}{T} \times 100\%$ controls average voltage/power delivered to LEDs (`1 kHz`) or 4-pin PC fans (`25 kHz` above human hearing).
- **RC Hobby Servos (`50 Hz`, $T = 20\text{ ms}$)**: Encode mechanical horn angle strictly in the **absolute high-pulse width** — `1.0 ms` (`5%` duty) = `0°`, `1.5 ms` (`7.5%`) = `90°` center, and `2.0 ms` (`10%`) = `180°`.

### Li-Ion Battery Internal Resistance ($R_{\text{int}} = \Delta V / \Delta I$)
Every rechargeable lithium cell behaves as an ideal open-circuit voltage source $V_{\text{OC}}$ in series with an internal impedance $R_{\text{int}}$ (healthy fresh 18650/LiPo: **`40–100 mΩ`**; aging or cold cell: **`200–450 mΩ`**). Under a load current step $\Delta I$, terminal voltage drops instantaneously:

$$V_{\text{load}} = V_{\text{OC}} - I_{\text{load}} \cdot R_{\text{int}}, \qquad R_{\text{int}} = \frac{V_1 - V_2}{I_2 - I_1} = \frac{\Delta V}{\Delta I}$$

If an aged cell (`R_int = 350 mΩ`) at `3.70 V` OCV experiences a `1.4 A` Wi-Fi/servo surge, terminal voltage crashes by `0.49 V` down to **`3.21 V`** — tripping the `3.3 V` regulator brownout reset even when State-of-Charge reads `45%`!

### IEEE 1364 `.vcd` (Value Change Dump)
`bus-studio`'s **`VCDExport`** writes compact event-driven **IEEE 1364 `.vcd`** files containing `$timescale 1us`, 1-bit wire declarations (`$var wire 1 ! ch0 $end`), and delta timestamps (`#0`, `#104 1!`, `#208 0!`). Because only transitions are stored, multi-second logic captures take mere kilobytes and open natively in **sigrok PulseView** and **GTKWave** for deep desktop protocol analysis.
