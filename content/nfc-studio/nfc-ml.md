# On-Device NFC ML (`internal/nfcml`)

`nfc-studio` includes a zero-allocation, pure-Go on-device ML & DSP suite (`internal/nfcml`) tailored for 13.56 MHz ST25R3916 operations on CardputerZero's 512 MB ARM64 Linux environment:

## 1. Dump Entropy & Structure Profiler (`profile.go`)
Computes Shannon entropy ($H = -\sum p_i \log_2 p_i$, `0.0–8.0 bits/byte`), user-memory fill ratio, printable ASCII ratio, and NDEF TLV (`0x03`) presence over `P04+` user pages using a stack-allocated 256-bucket histogram (`0` heap allocations):

| Class | Meaning |
| --- | --- |
| **`BLANK`** | `< 3%` non-zero/non-`0xFF` bytes in user memory |
| **`NDEF`** | Valid NFC Forum TLV (`0x03`) URI or Text payload detected |
| **`PROPRIETARY`** | Structured vendor/application binary or ASCII data without NDEF |
| **`ENCRYPTED`** | High Shannon entropy (`>= 6.4 bits/byte`) and low ASCII ratio (`< 45%`) |

## 2. 8D Tag Fingerprint k-NN (`fingerprint.go`)
Extracts an L2-normalized `[8]float32` structural signature from `(UID length, ATQA, SAK, page count, fill ratio, Shannon entropy, ASCII ratio, NDEF flag)` and performs UID-length-gated cosine k-NN matching against your saved `.nfc` library (`Match: <tag>.nfc (96%)` toast on discovery and MCP tool `nfc_match_fingerprint`).

## 3. Reader IAT Tracker & Auto-Pause (`reader_iat.go`)
Monitors external reader `HITS` during Passive Target A emulation (`EMU` & `PROBE`) in a fixed 16-slot inter-arrival ring:
- **`QUIET`**: No recent reader field activity.
- **`POLL <N>ms`**: Steady periodic `REQA`/`WUPA` polling beacon.
- **`ENGAGED!`**: Rapid multi-hit transaction burst (`<= 90 ms` or `< 0.5×` baseline period) indicating the reader engaged with the active UID — automatically pauses `PROBE` (`Auto-Emu`) on the matching tag!

## 4. ST25R3916 ADC RF Field Calibration (`field_baseline.go`)
Uses ST25R3916 direct commands `MeasureAmplitude (0xD3)` and `MeasurePhase (0xD5)` (`AD_CONV_OUT 0x25`) with a Welford-warmup + EWMA baseline and detune-freeze guard (`|z| >= 3.0`) to classify live 13.56 MHz antenna coupling in `SCAN` (`FLD: SWEET SPOT`, `FLD: WEAK`, `FLD: METAL / DETUNED!`, `FLD: IDLE`) and via MCP `nfc_measure_field`.
