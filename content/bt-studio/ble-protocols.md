# Bluetooth 5.2 Protocols, Privacy Auditing & `BTDeviceNet` ML

This deep-dive explains the radio, protocol, security-audit, and on-device machine-learning fundamentals behind **`bt-studio`** on M5Stack CardputerZero.

---

## 1. BLE Advertising Channels & AD Structures

Bluetooth Low Energy (BLE) operates in the 2.4 GHz ISM band (`2402–2480 MHz`) across 40 channels (`2 MHz` spacing):
- **3 Primary Advertising Channels**: Channels **37** (`2402 MHz`), **38** (`2426 MHz`), and **39** (`2480 MHz`) — intentionally placed *between* Wi-Fi channels 1, 6, and 11 to minimize interference.
- **37 Data Channels**: Used after connection establishment with Adaptive Frequency Hopping (AFH).

Every legacy BLE advertising PDU carries up to **31 bytes** of **AD Structures** formatted as `[Length][AD Type][Payload...]`:
- **`0xFF` Manufacturer Specific Data**: Begins with a 16-bit little-endian Bluetooth SIG Company ID (`0x004C` Apple, `0x0499` Ruuvi, `0xEC88` Govee, `0x0006` Microsoft) followed by proprietary TLV frames.
- **`0x16` Service Data (16-bit UUID)**: Carries open ecosystem protocols such as **BTHome v2 (`0xFCD2`)**, **Eddystone / Google FMDN (`0xFEAA`)**, **Samsung SmartTag (`0xFD5A`)**, and **Xiaomi MiBeacon (`0xFE95`)**.

---

## 2. Privacy Leakage, RPA Rotation, Proximity Zones & Room Baselines

Modern operating systems rotate **Resolvable Private Addresses (RPA)** every ~15 minutes to prevent trivial MAC-address tracking. However, passive observers can still inspect:
1. **Static Public MACs**: Many IoT bulbs, beacons, headphones, and Classic BR/EDR devices broadcast permanent factory MACs (`PrivacyScore +35`).
2. **Protocol Metadata Leakage**: Apple Continuity frames passively advertise AirPods battery levels (`0x07`), lock/activity flags (`0x10`), and FindMy separated-from-owner status (`0x12`, status bit `0x10`).
3. **Cross-MAC Correlation (`TrackerGuard`)**: Even after an AirTag or SmartTag rotates its random MAC, `bt-studio` correlates payload key prefixes and **`BTDeviceNet`'s 16D SupCon embedding** across time windows to detect sustained following (`FOLLOWING` verdict).
4. **BLE Flood / Spam IDS**: `SpamDetector` tracks `new_macs/sec` and `continuity_frames/sec` with an online **Burst-Freeze EWMA baseline**, alerting immediately when anomalous advertising floods appear without poisoning the ambient baseline.

### Proximity Zones & Tap-to-Select (`RSSI >= -50 dBm`)
Because 2.4 GHz radio power drops rapidly in the near field (Log-Distance Path Loss $P(d) = P_{\text{1m}} - 10 n \log_{10}(d)$), holding a gadget within **20–30 cm** of CardputerZero creates a `15–25 dB` signal gap over room-level background devices. `bt-studio` maps raw RSSI into four human-readable **Proximity Zones**:

| Zone | RSSI Range | Distance Hint | Typical Use |
| --- | --- | --- | --- |
| **`TOUCH`** | `>= -48 dBm` | `< 0.3 m` | Touching / held next to CardputerZero (auto-locks **Tap-to-Select**) |
| **`NEAR`** | `-49 .. -62 dBm` | `~1 m` | Same desk or pocket (Radar `NEAR` filter `>= -52 dBm` isolates close targets) |
| **`ROOM`** | `-63 .. -78 dBm` | `~4 m` | Same room (smart lights, sensors, nearby laptops) |
| **`FAR`** | `< -78 dBm` | `> 8 m` | Adjacent rooms or hallways |

In Guided Missions (`Audit My Gadget`, `Decode BLE Button`, `Spy on Companion App`), `NearestCandidate(devices, minRSSI=-50, connectableOnly, maxAge)` picks the strongest *fresh* device meeting the threshold, eliminating raw MAC hunting while providing a **`5 PICK`** fallback for low-TX gadgets peaking around `-60 dBm`.

### Known Environment Baseline & Rotating-RPA Matching (`known_env.json`)
Urban apartments easily contain `30–60` ambient Bluetooth radios. `Learn My Room` records an 8-second baseline into `~/.config/bt-studio/known_env.json` (`0600`) so Radar's **`NEW ONLY`** filter hides familiar devices. Naive MAC-only whitelists fail within 15 minutes when phones and watches rotate their RPA MACs; `KnownEnvStore.Match(addr, fingerprintKey)` solves this with two-tier matching:
- **Public / Static MACs**: Matched strictly by canonical 48-bit MAC address.
- **Rotating-RPA Household Devices**: Matched by a soft **`FingerprintKey`** (`Vendor|Protocol|Name`, e.g., `Apple|Apple Continuity|`) recorded at baseline time so your own Apple Watch or iPhone stays quiet across 15-minute RPA rotations while an unfamiliar brand, sensor, or guest tracker immediately flags **`[NEW]`**.

---

## 3. Interactive BLE Packet Decoder, Foxhunt & Smart Field Guesser Lab

Experiment directly in your browser below: decode real BLE Manufacturer/Service HEX frames (AirTag, AirPods, iBeacon, BTHome v2, Eddystone-URL) with live Privacy Exposure scoring, test the **1D-Kalman RSSI + Proximity Zone** locator, and step packets through the **Live GATT Notify Byte-Diff + `Smart Field Guesser`**!

```interactive:bt-ble-lab
```

---

## 4. GATT Security Posture Auditing & `Security Grade (A–F)` Rubric

When you connect to an authorized BLE peripheral in **GATT Explorer & Audit**, BlueZ resolves its **ATT** attribute table into hierarchical `GattService1 → GattCharacteristic1` entries. `bt-studio`'s pure-Go `AuditGattProfile` inspects characteristic flags and readable cleartext values:
- **`HIGH`**: Characteristics advertising `write-without-response` with no `encrypt-*` or `authenticated-*` requirement — any nearby client can inject commands blindly.
- **`WARN`**: Unauthenticated `write` characteristics that accept writes prior to bonding/encryption.
- **`INFO`**: Cleartext `Device Information (0x180A)` disclosures (Serial Number `0x2A25`, Firmware Revision `0x2A26`, Hardware Revision `0x2A27`) useful for firmware fingerprinting.

To make GATT audit results immediately actionable on CardputerZero's `320×170` display, `AuditGattProfile` synthesizes a **`SecurityGrade (A–F)`** and plain-English **`PlainSummary`**:

| Grade | Criteria in `AuditGattProfile` | Plain-English Risk Verdict |
| --- | --- | --- |
| **`F`** | `RiskScore >= 50` **or** `>= 2` unauthenticated `write-without-response` characteristics | *Critical: accepts blind commands without pairing!* |
| **`D`** | `>= 1` unauthenticated `write-without-response` **or** `RiskScore >= 30` | *High risk: open write surface without encryption* |
| **`C`** | `>= 1` unauthenticated `write` characteristic | *Caution: writable characteristic without pairing* |
| **`B`** | Zero unauthenticated writes; cleartext `Device Information` readable | *Good: read-only, exposes firmware/model info* |
| **`A`** | Zero unauthenticated writes **and** zero cleartext info leaks | *Strong: encrypted or minimal read-only GATT* |

---

## 5. GATT Live Notify Byte-Diff & Zero-Alloc `Smart Field Guesser`

Most proprietary BLE gadgets (smart scales, locks, LED strips, fitness bands, gamepads) communicate over undocumented vendor-specific GATT characteristics (`0xFF00..0xFFFF` or 128-bit UUIDs) using **ATT Handle Value Notifications (`0x1B`)**. Reverse-engineering these binary frames manually is tedious; `bt-studio`'s zero-allocation **`ByteDiffTracker`** automates byte attribution in real time:
- For every arriving notification packet $P_t$, each byte offset $i \in [0, 63]$ is compared against the previous packet $P_{t-1}$:
  - **Change mask**: $C_t[i] = (P_t[i] \neq P_{t-1}[i])$ highlights exact active fields (button flags, sequence counters, sensor LSB/MSB) in amber/red.
  - **Bitwise XOR delta**: $X_t[i] = P_t[i] \oplus P_{t-1}[i]$ immediately exposes single-bit flag toggles (e.g. `XOR: 0x01` on bit 0 when pressing a hardware button) versus multi-bit analog telemetry.
  - **Envelope tracking**: Per-offset `[MinVal, MaxVal]` and cumulative `ChangeCount` distinguish monotonic counters (`00..FF`), bounded sensor fields, and static magic headers.

### Zero-Alloc `InferByteFields` Heuristics (`0 B/op, 0 allocs/op`)
To turn raw byte diffs into instant reverse-engineering hypotheses, `ByteDiffTracker` maintains fixed-size stack/struct arrays (`xorUnion[64]`, `monoStepCount[64]`, `lastDelta[64]`, `minVal[64]`, `maxVal[64]`) updated inside `Ingest()` with zero heap allocations. `InferByteFields(snap, &out)` fills a caller-provided `[64]FieldHypothesis` array using five deterministic rules:
1. **`FieldStatic` (`STATIC` / Header)**: `ChangeCount == 0` after `>= 3` packets — protocol magic bytes, frame headers, or fixed opcodes.
2. **`FieldBitFlag` (`BTN(bK)`)**: `ChangeCount > 0` and the cumulative bitwise XOR union across all transitions has popcount `1` (`bits.OnesCount8(xorUnion[i]) == 1`) — isolates an exact single-bit hardware button, switch, or boolean status flag at bit index `k` (`0..7`).
3. **`FieldCounter` (`SEQ +1`)**: `ChangeCount >= 2` with monotonic `±1 mod 256` steps (`monoStepCount`) — detects rolling packet sequence numbers and keepalive counters.
4. **`FieldSensor` (`SENSOR`)**: Multi-bit changes staying within a smooth bounded envelope (`MaxVal - MinVal <= 48`) — identifies heart-rate, temperature, battery, or slow analog gauge telemetry.
5. **`FieldVariable` (`VAR`)**: Wide or high-entropy mutations exceeding the bounded sensor envelope (`MaxVal - MinVal > 48`) — flags rolling checksums, CRCs, encrypted nonces, or high-variance payload data.

---

## 6. BlueZ `GattManager1` Honeypot Emulation & Mobile-App Interception

When auditing how a mobile companion app authenticates to your own BLE peripheral, observing over-the-air traffic passively is often blocked by frequency hopping or link-layer encryption. Instead, a **GATT Honeypot / Cloned Mock Peripheral** acts as the legitimate GATT server:
1. `bt-studio` exports an `org.freedesktop.DBus.ObjectManager` tree (`/org/cardputer/btstudio/app`) containing cloned `GattService1` and `GattCharacteristic1` objects cloned from a `.btjson` capture or research template (`SmartLock_Mock`, `Nordic_NUS_Sink`, `IoT_Config_Portal`).
2. BlueZ's `org.bluez.GattManager1.RegisterApplication` mounts those services into `bluetoothd`'s local ATT database completely **non-root**, paired with a connectable `Type: "peripheral"` `LEAdvertisement1`.
3. When the mobile app connects and invokes `WriteValue(value, opts)`, `bt-studio` intercepts the cleartext application-layer payload (PINs, provisioning tokens, command opcodes) and appends structured JSONL entries to `~/bt-studio/honeypot_log.jsonl`.

---

## 7. Non-Root Classic BR/EDR L2CAP (`PSM 0x0001`), Native SDP & RFCOMM

Classic Bluetooth (BR/EDR) tools like `l2ping` traditionally demand `root` (`CAP_NET_RAW`) because they open `SOCK_RAW` HCI/L2CAP sockets. However, Linux permits unprivileged users to open **`AF_BLUETOOTH` `SOCK_SEQPACKET` (`BTPROTO_L2CAP`)** and **`SOCK_STREAM` (`BTPROTO_RFCOMM`)** sockets:
- **L2CAP Reachability Probe**: Connecting non-blocking to a target Classic MAC on **PSM `0x0001` (SDP)** triggers a real baseband page + L2CAP channel setup. Even if the device has discovery disabled ("hidden"), a powered-on Classic radio responds and yields an exact **L2CAP Connect RTT (ms)**.
- **Native SDP Discovery (`PDU 0x06` / `0x07`)**: Over that same `PSM 0x0001` socket, `bt-studio` sends an `SDP_ServiceSearchAttributeRequest` querying `PublicBrowseRoot (0x1002)` for `ServiceClassIDList (0x0001)`, `ProtocolDescriptorList (0x0004)`, and `ServiceName (0x0100)`. Decoding the returned **SDP Data Elements (DE)** reveals every advertised profile and its exact **RFCOMM channel (`1..30`)** so you can open a **Classic SPP** serial session immediately — or connect over **BLE Nordic UART (`6E400001-B5A3-F393-E0A9-E50E24DCCA9E`)** for modern BLE MCUs.

---

## 8. Wireshark-Native `BTSnoop v1` (RFC 1761) Export

To bridge handheld CardputerZero captures with deep desktop analysis in **Wireshark**, `bt-studio`'s pure-Go `internal/btsnoop` package synthesizes standard **RFC 1761 BTSnoop v1** captures (`Magic: "btsnoop\x00"`, `Version: 1`, `DataLink: 1002` HCI UART H4, microsecond timestamps relative to `0000-01-01` epoch `0x00dcddb30f2f8000`):
- **Radar Exports**: Wraps each observed BLE advertisement into an authentic **HCI Event `0x04 0x3E` (LE Meta Event, Subevent `0x02` LE Advertising Report)** with little-endian MAC, reconstructed `<= 31 B` AD structures, and signed RSSI.
- **Notify & Honeypot Exports**: Wraps each captured GATT payload into **HCI ACL Data (`0x02`) → L2CAP Fixed CID `0x0004` (ATT) → ATT PDU** (`0x1B` Notification, `0x12` Write Request, `0x0B` Read Response), enabling instant Wireshark ATT/GATT dissection without raw HCI capture permissions.

---

## 9. On-Device INT8 `BTDeviceNet` (`.czml` Domain `10`)

Many nearby BLE devices broadcast **random MACs with no LocalName**. `bt-studio` embeds **`BTDeviceNet`** (`11.0 KB` INT8 `.czml`, trained on Google Colab NVIDIA L4 with QAT + SupCon loss + Temperature Calibration):
- **Input (`[32]float32`)**: Address type, transport, payload length/entropy, advertising interval, RSSI variance, Company/UUID hints, and burst rate.
- **Topology**: `32 → 64 → 64 → 32` (`ReLU6`, per-channel INT8 weights + dynamic INT8 activations) branching into a **16D L2-normalized SupCon embedding** and a **14-class device classifier** (`97.9%` INT8 reference test accuracy, bit-exact Go ↔ Python parity `<= 1e-4`, **`0 B/op, 0 allocs/op`**).
