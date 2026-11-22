# On-Device NFC ML (`internal/nfcml`): `NFC-InductiveNet` & `NFC-DumpNet`

`nfc-studio` embeds two **pure-Go, zero-dependency INT8 `.czml v1` neural models** (`CGO_ENABLED=0`, SHA-256 verified, ~38.3 KB combined; optional overrides in `~/.config/nfc-studio/models/`) alongside deterministic DSP & entropy profilers for 13.56 MHz ST25R3916 operations on CardputerZero (Cortex-A53 @ 1.0 GHz):

| Model | Size | Input | Output | Live Cortex-A53 Latency |
| :--- | :---: | :--- | :--- | :---: |
| **`NFC-InductiveNet`** | **13.6 KB** (`13,899 B`) | `[4, 32]` `(ΔAmp, ΔPhase, dA/dt, dP/dt)` | 7 materials (`AIR`, `FERROUS_STEEL`, `ALUMINUM`, `COPPER_BRASS`, `RESONANT_TAG`, `PHONE_ACTIVE`, `WATER_DIELECTRIC`) + continuous moisture % | **1.05 ms/op** (`0 allocs/op`) |
| **`NFC-DumpNet`** | **24.7 KB** (`25,327 B`) | `[48]` UID/ATQA/SAK + entropy + byte-nibble histogram | 10 card ecosystems (`Blank`, `NDEF_URI_Text`, `NDEF_WiFi_vCard`, `Transit_Card`, `Access_MIFARE`, `Hotel_Key`, `Gaming_Amiibo`, `EMV_Payment`, `DESFire_App`, `Encrypted_Proprietary`) + **32D SupCon embedding** | **0.29 ms/op** |

## 1. Dump Entropy & `NFC-DumpNet` Ecosystem Profiler (`profile.go`, `neural_nets.go`)
`AnalyzeDump` computes Shannon entropy ($H = -\sum p_i \log_2 p_i$, `0.0–8.0 bits/byte`), user-memory fill ratio, printable ASCII ratio, and NDEF TLV (`0x03`) presence over `P04+` user pages (`0` heap allocations). `AnalyzeTag` augments this with **`NFC-DumpNet`** to classify the card's high-level ecosystem and produce a **32D SupCon learned embedding** (`ComputeEmbedding`, exposed via `nfc_analyze_tag`, `nfc_match_fingerprint`, and `nfc_model_info`).

| Heuristic Class | Meaning |
| --- | --- |
| **`BLANK`** | `< 3%` non-zero/non-`0xFF` bytes in user memory |
| **`NDEF`** | Valid NFC Forum TLV (`0x03`) URI, Text, or Wi-Fi WSC payload detected |
| **`PROPRIETARY`** | Structured vendor/application binary or ASCII data without NDEF |
| **`ENCRYPTED`** | High Shannon entropy (`>= 6.4 bits/byte`) and low ASCII ratio (`< 45%`) |

## 2. 32D SupCon Tag Fingerprint k-NN (`fingerprint.go`)
Encodes any `.nfc` dump through **`NFC-DumpNet`** into an L2-normalized `[32]float32` signature (falling back to 8D structural features if no `.czml` model is available) and performs UID-length-gated cosine k-NN matching against your saved `.nfc` library (`Match: <tag>.nfc (96%)` toast on discovery and MCP tool `nfc_match_fingerprint`).

## 3. `NFC-InductiveNet` Trajectory Classifier & Moisture Estimator (`inductive.go`, `neural_nets.go`)
Feeds the rolling 32-sample ST25R3916 amplitude/phase trajectory `(ΔAmp, ΔPhase)` plus first derivatives `(dA/dt, dP/dt)` into a 1D-CNN (`95.33%` material accuracy, `3.25%` moisture MAE) to distinguish `FERROUS_STEEL`, `ALUMINUM`, `COPPER_BRASS`, `RESONANT_TAG`, `PHONE_ACTIVE`, and `WATER_DIELECTRIC` (`0–100%` moisture) in **1.05 ms/op** with zero allocations (`nfc_inductive_sense`).

## 4. Reader IAT Tracker & Auto-Pause (`reader_iat.go`)
Monitors external reader `HITS` during Passive Target A emulation (`EMU` & `PROBE`) in a fixed 16-slot inter-arrival ring:
- **`QUIET`**: No recent reader field activity.
- **`POLL <N>ms`**: Steady periodic `REQA`/`WUPA` polling beacon.
- **`ENGAGED!`**: Rapid multi-hit transaction burst (`<= 90 ms` or `< 0.5×` baseline period) indicating the reader engaged with the active UID — automatically pauses `PROBE` (`Auto-Emu`) on the matching tag!

## 5. ST25R3916 ADC RF Field Calibration (`field_baseline.go`) & Cross-Studio `Timeline-Seq`
Uses ST25R3916 direct commands `MeasureAmplitude (0xD3)` and `MeasurePhase (0xD5)` (`AD_CONV_OUT 0x25`) with a Welford-warmup + EWMA baseline and detune-freeze guard (`|z| >= 3.0`) to classify live 13.56 MHz antenna coupling in `SCAN` (`FLD: SWEET SPOT`, `FLD: WEAK`, `FLD: METAL / DETUNED!`, `FLD: IDLE`) and via MCP `nfc_measure_field`. When combined with `rf-heatmap` and `ir-studio` via **`radio-bridge --timeline --ml-score`**, **`Timeline-Seq`** (21.2 KB INT8 1D-TCN, `4.53 ms/op`, `0 allocs/op`) detects cross-channel causal flows (`Access_Unlock_Flow`, `SmartHome_Chain`) and attacks (`RollJam_Suspect`, `Replay_Suspect`, `RF_Jamming_Event`).
