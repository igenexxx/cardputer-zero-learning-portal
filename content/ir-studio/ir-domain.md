# Infrared, LIRC & Protocol Theory

Infrared (IR) remote controls communicate using **940 nm near-infrared light** modulated onto a high-frequency carrier wave. Understanding the physical carrier, baseband bit encodings, stateful HVAC frames, and Linux `/dev/lirc*` kernel interfaces lets you decode, reverse-engineer, and reliably transmit almost any consumer IR device on CardputerZero.

---

## 1. 940 nm Carrier Modulation & Duty Cycle

Room lighting and sunlight emit intense continuous infrared radiation. If an IR LED simply turned ON for `560 µs` without a carrier, a photodiode could not tell a remote button press apart from a lamp or window.

Instead, every IR "mark" (carrier ON) is chopped at a **carrier frequency**—most commonly **38 kHz** (period $T = 26.3\text{ µs}$), though protocols span **36 kHz** (Philips RC5/RC6), **40 kHz** (Sony SIRC), and **56 kHz** (Bang & Olufsen, Motorola, some set-top boxes). Integrated IR receiver modules (such as Vishay TSOP38238 or VS1838B) contain an optical 940 nm daylight filter, an automatic gain control (AGC) amplifier, and a **bandpass filter** tuned to the carrier frequency, outputting a clean demodulated baseband envelope.

### Duty Cycle Trade-Off (`33%` vs `50%`)

During each `26.3 µs` carrier cycle, the **duty cycle** controls how long the IR LED is driven ON:

- **`33%` (Default, `1/3` ON):** Cuts average LED current and heat by a third while allowing higher peak pulse current (improving range) and delivering strong fundamental harmonic energy at 38 kHz.
- **`50%` (Square Wave):** Maximizes fundamental carrier power for marginal receivers or long-range AC units, at the cost of higher LED dissipation.

> [!NOTE]
> `ir-studio` enforces the **LIRC Carrier/Duty Restoration Invariant**: whenever a button specifies a custom carrier (`36–56 kHz`) or duty cycle (`1–99%`), `TXWorker` unconditionally restores the hardware defaults (`38000 Hz`, `33%`) and ensures the IR LED is dark upon completion, error, or cancellation.

---

## 2. Baseband IR Encodings

Once the receiver strips the 38 kHz carrier, a frame becomes an alternating sequence of **marks** (`+µs`, carrier ON) and **spaces** (`-µs`, carrier OFF). Consumer remotes use three major baseband modulation schemes:

### A. Pulse-Distance Encoding (`NEC`, `NECext`, `Samsung32`, `Kaseikyo`)

Every bit starts with a **fixed-width mark** (`1×TE`), and the **space duration** determines the bit value (`1×TE` = `0`, `3×TE` = `1`). A trailing stop mark terminates the last bit.

- **`NEC` (38 kHz, 32-bit, LSB-first):** Header `+9000 / -4500 µs`, `0 = +562 / -562 µs`, `1 = +562 / -1687 µs`, stop `+562 µs`. Payload is `addr, ~addr, cmd, ~cmd` (built-in bitwise inverse error check). Holding a button emits compact **NEC Repeat Frames** (`+9000 / -2250 / +562 µs`) every `108 ms`.
- **`NECext` (38 kHz, 32-bit):** Identical timing to `NEC`, but uses all 16 bits for address (`addrLo, addrHi`) and 16 bits for command (`cmdLo, cmdHi`) without inverse verification.
- **`Samsung32` (38 kHz, 32-bit):** Symmetric header `+4500 / -4500 µs`, `0 = +550 / -550 µs`, `1 = +550 / -1650 µs`, payload `addr, addr, cmd, ~cmd`.
- **`Kaseikyo` (38 kHz, 48-bit, Panasonic/Denon/JVC):** Header `+3360 / -1680 µs`, `TE = 420 µs`, 16-bit vendor ID + parity nibble + genre/data + 8-bit XOR checksum.

### B. Pulse-Width Encoding (`SIRC`)

The **space** is fixed (`-600 µs`), and the **mark width** encodes the bit (`+600 µs` = `0`, `+1200 µs` = `1`):

- **`SIRC` (40 kHz, Sony, LSB-first):** Header `+2400 / -600 µs`, 12-bit (`7-bit cmd + 5-bit addr`), 15-bit, or 20-bit frames, typically repeated 3× with a `45 ms` frame period.

### C. Bi-Phase / Manchester Encoding (`RC5`, `RC6`)

Every bit occupies a fixed total slot (`2×TE`) with a **mid-bit transition** whose direction encodes the bit—making it self-clocking and highly resilient to drift:

- **`RC5` (36 kHz, Philips, MSB-first, `TE = 889 µs`):** No AGC header; starts with two start bits (`S1=1, S2=1`) + 1 **Toggle bit (`T`)** that flips on every new keypress (distinguishing two presses from a held button) + 5-bit address + 6-bit command. `1 = -889 / +889 µs`, `0 = +889 / -889 µs`.
- **`RC6` (36 kHz, Mode 0, `TE = 444 µs`):** Header `+2666 / -889 µs`, `1 = +444 / -444 µs`, `0 = -444 / +444 µs`, with a double-width (`2×TE = 889 µs`) trailer toggle bit.

### Canonical Protocol Timing Reference

| Protocol | Carrier | Header (`+mark / -space`) | `0` Bit (µs) | `1` Bit (µs) | Frame Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`NEC` / `NECext`** | `38 kHz` | `+9000 / -4500` | `+562 / -562` | `+562 / -1687` | 32 bits (LSB) |
| **`Samsung32`** | `38 kHz` | `+4500 / -4500` | `+550 / -550` | `+550 / -1650` | 32 bits (LSB) |
| **`Kaseikyo`** | `38 kHz` | `+3360 / -1680` | `+420 / -420` | `+420 / -1260` | 48 bits (LSB) |
| **`SIRC`** | `40 kHz` | `+2400 / -600` | `+600 / -600` | `+1200 / -600` | 12 / 15 / 20 bits (LSB) |
| **`RC5`** | `36 kHz` | None (`S1, S2, T`) | `+889 / -889` | `-889 / +889` | 14 bits (MSB) |
| **`RC6`** | `36 kHz` | `+2666 / -889` | `-444 / +444` | `+444 / -444` | 20 bits (MSB) |

---

## 3. Interactive Lab: IR Protocol & 1D K-Means Waveform Explorer

Select a protocol (`NEC`, `Samsung32`, `RC5`, `SIRC`), inject realistic TSOP receiver timing jitter (`0–150 µs`) and ambient EMI glitches, and toggle the **1D K-Means Pulse Denoiser** to watch how `ir-studio` rescues corrupted frames in real time:

```interactive:ir-protocol-lab
```

---

## 4. Stateful AC Frames & `SUM8` Checksums

Unlike TV remotes—which send a tiny stateless command ("Volume Up")—air conditioner (HVAC) remotes transmit the **entire unit state** on every single button press: power state, mode (`Cool`/`Heat`/`Dry`/`Fan`), target temperature, fan speed, louver swing, timer, and a trailing checksum.

- **Multi-Subframe Structure:** A single Daikin, Mitsubishi, or Fujitsu keypress often transmits **64–200+ bits** split across 2–3 subframes separated by `8–35 ms` inter-subframe gaps (`DefaultACSubframeGapUs = 8000 µs`).
- **`SUM8` Integrity Check:** Most HVAC frames terminate each subframe with an 8-bit modular checksum:
  $$\text{bytes}[N-1] = \left(\sum_{i=0}^{N-2} \text{bytes}[i]\right) \bmod 256$$
- **Bit-by-Bit State Diff (`RX → 6 DIFF`):** Pinning `22C Cool` as Baseline `A` and capturing `24C Cool` as `B` computes `ValA ^ ValB` per byte across subframes, instantly exposing the temperature field and the matching `SUM8` checksum delta (e.g., `+2°C` increments both the temperature byte and the final checksum byte by the same offset).

---

## 5. Linux `/dev/lirc*` Kernel Interface & `TransceiverGate`

`ir-studio` communicates directly with the Linux kernel's LIRC character device (`/dev/lirc0..7`) via pure-Go `ioctl` syscalls (`internal/lirc/ioctl.go`), requiring zero CGO and zero external daemons:

| `ioctl` Constant | Hex Code | Purpose |
| :--- | :--- | :--- |
| `LIRC_GET_FEATURES` | `0x80046900` | Query `LIRC_CAN_SEND_PULSE` (`0x02`) and `LIRC_CAN_REC_MODE2` (`0x40000`) |
| `LIRC_SET_SEND_MODE` | `0x40046911` | Select `LIRC_MODE_PULSE` (`0x02`) — odd-length array of positive `uint32` µs durations |
| `LIRC_SET_REC_MODE` | `0x40046912` | Select `LIRC_MODE_MODE2` (`0x04`) — 32-bit packets with type in top byte |
| `LIRC_SET_SEND_CARRIER` | `0x40046913` | Set TX carrier frequency (`36000–56000 Hz`, default `38000 Hz`) |
| `LIRC_SET_SEND_DUTY_CYCLE` | `0x40046915` | Set TX carrier duty cycle (`1–99%`, default `33%`) |
| `LIRC_SET_REC_TIMEOUT` / `_REPORTS` | `0x40046918` / `0x40046919` | Emit `LIRC_MODE2_TIMEOUT` (`0x03000000`) to delimit end-of-frame cleanly |

### `mode2` Packet Format & Optical Mutual Exclusion

Each `uint32` read in `LIRC_MODE_MODE2` packs an 8-bit packet type (`pkt & 0xFF000000`) and a 24-bit microsecond duration (`pkt & 0x00FFFFFF`): `0x01000000` = Pulse (`+mark`), `0x00000000` = Space (`-space`), and `0x03000000` = Frame Timeout.

Because CardputerZero's IR emitter and photodiode sit millimeters apart, firing TX while RX is listening causes optical self-blinding loopback. **`TransceiverGate`** enforces strict mutual exclusion: before `TXWorker` transmits, `RXWorker` is muted and flushed; after TX completes, the gate waits a **`>= 20 ms` optical settle guard** before resuming RX.
