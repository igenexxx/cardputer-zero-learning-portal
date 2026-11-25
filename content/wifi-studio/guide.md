# WiFi Studio — App Guide & Controls (`v0.1.0`)

**WiFi Studio** (`wifi-studio`) turns CardputerZero's onboard **2.4 GHz Wi-Fi (`wlan0`)** transceiver into a non-root pocket wireless engineering, WIDS, LAN reconnaissance, and Everyday-Carry (EDC) RF sensing lab powered by `fi.w1.wpa_supplicant1` D-Bus (`netdev`), `/proc/net/wireless`, unprivileged Linux sockets, and an embedded **3-model Pure-Go INT8 `.czml` Neural Suite** (`WiFiAPNet-1D`, `WiFiMotionNet-1D`, `WiFiThreatAE` — `0 allocs/op`).

> [!WARNING]
> **Authorized Security Research & Network Testing Disclaimer**: Active LAN host/port scans, RTSP/ONVIF hidden-camera checks, Ping/DNS/TLS probes, Captive Portal checks, and Wake-on-LAN magic packets are strictly for **authorized network diagnostics, privacy auditing, and testing on networks and devices you own or have explicit permission to inspect**. An in-app disclaimer modal (`ResearchAck`) gates first use, and MCP/bridge active tools require `confirm_net: true`.

---

## 1. Home Menu (Live Airspace Verdict & Simple vs. Expert Mode)

![WiFi Studio Home Menu](assets/wifi-studio/home.png)

- **Live Airspace Verdict Banner**: Translates real-time 2.4 GHz radio telemetry into plain English — **emerald** (`All clear · N APs · Best Ch 11`), **amber** (heavy channel congestion, unlocked WPS router, or `[NEW]` ambient APs since your room baseline), or **red** (active Evil-Twin `IEFingerprintHash` drift, `WiFiThreatAE` `[ANOM]`, ARP Spoof, or `SPYCAM_SUSPECT`).
- Starts in **Simple Mode** (**7** everyday screens, starting with **`Quick Missions`** at **#1**): `Quick Missions`, `Bell-Curve Spectrum`, `Wi-Fi Radar`, `RSSI Foxhunt`, `Link Health`, `Saved & Exports`, and `Settings`.
- Press **`5 EXPERT`** on Home (or toggle in Settings) to unlock **+6 Engineering Labs**: **Beacon IE Forensics**, **Evil-Twin WIDS**, **LAN & IoT Recon**, **Motion Tripwire & Crowd Pulse**, **Room Heatmap**, and **Net-Tools**.

---

## 2. Quick Missions (6 Guided 3-Step Wizards)

![WiFi Studio Quick Missions Menu](assets/wifi-studio/missions.png)

Open **`Quick Missions`** (`#1` on Home) to run complete wireless diagnostics and EDC privacy sweeps in three guided steps:

1. **Check Room for Hidden Cameras (`HiddenCameraSweep`)**: Scans 2.4 GHz SoftAP OUIs (Espressif, Tuya, Hikvision, Dahua, HiSilicon) and minimal beacon IE stacks, optionally combining authorized LAN mDNS/SSDP/RTSP (`554`)/ONVIF discovery (`ResearchAck` required) into a ranked **`SPYCAM_SUSPECT`** verdict. Press **`4 HUNT`** to walk toward a suspect with Foxhunt or **`5 PCAP`** to archive RadioTap evidence.
2. **Find Best Wi-Fi Channel**: Collects visible APs and BSS Load (`IE 0x0B`) airtime, computes 22 MHz parabolic overlap scores (**`ChannelBellScore`**, `0–100`), and picks the cleanest orthogonal channel among **`1 / 6 / 11`**.
3. **Audit My Wi-Fi Router**: Dissects your selected router's 802.11 Beacon Information Elements (`RSN`, `WPA3-SAE`, `PMF 802.11w`, `WPS TLV`, `802.11k/v/r`) into a bold **`WiFiSecurityGrade (A–F)`** scorecard with plain-English remediation advice and **`4 PCAP`** export.
4. **Check for Evil Twin / Rogue AP**: Compares live beacons against pinned **`IEFingerprintHash`** SHA-256 baselines and runs **`WiFiThreatAE`** (`AnomalyZ >= 3.2σ`) to expose spoofed clones, security downgrades, and rogue `hostapd` transmitters.
5. **Set Up Through-Wall Motion Tripwire**: Samples 6 seconds of quiet room RSSI on your connected AP (`/proc/net/wireless`), locks the Fresnel-zone variance floor, and arms **`MotionTripwire`** + **`WiFiMotionNet-1D`** at `10 Hz` to detect walking movement or door openings through drywall.
6. **Learn My Room (Baseline)**: Captures familiar surrounding APs and LAN hosts into `~/.config/wifi-studio/known_env.json` (`0600`). Press **`4 VIEW NEW`** to jump directly into Radar filtered to **`NEW ONLY`**, or **`5 CLEAR`** to reset the baseline.

> [!TIP]
> **Try it on hardware in 30 seconds**: Open **Quick Missions → Find Best Wi-Fi Channel** in your home or office. Within 5 seconds, WiFi Studio overlays every neighbor AP's 22 MHz bell curve across Channels `1–13` and highlights the highest-scoring non-overlapping channel (`1`, `6`, or `11`) so you can re-tune your router immediately.

---

## 3. 2.4 GHz Bell-Curve Channel Planner (`1 / 6 / 11`)

![2.4 GHz Bell-Curve Channel Planner](assets/wifi-studio/spectrum.png)

- Plots real-time parabolic **22 MHz spectral curves** for every visible AP across Channels `1–13` (`2412–2472 MHz`), with vertical dashed markers on orthogonal channels **`1`**, **`6`**, and **`11`**.
- Displays **`ChannelBellScore` (`0–100`)** badges combining co-channel RSSI contention, adjacent-channel partial overlap penalties, and live **BSS Load (`IE 0x0B`)** airtime utilization.
- Use **`Z`/`C`** to move the cyan inspection cursor across Channels `1–13`, **`Tab`** to toggle `1–13 Full` vs `1 / 6 / 11 Focus`, and **`4 SCAN`** to trigger an immediate fresh `wpa_supplicant1` sweep.

---

## 4. Wi-Fi Radar & Context-Aware Smart Action Sheet

![Wi-Fi AP Radar](assets/wifi-studio/radar.png)

- Live AP discovery table displaying SSID, channel, RSSI (`dBm`), **`WiFiSecurityGrade (A–F)`**, **`WiFiAPNet-1D`** archetype badge (`[ENT]` Enterprise, `[RTR]` Consumer Router, `[IOT]` ESP/IoT SoftAP, `[CAM]` IP Camera, `[HOT]` Hotspot, `[ROG]` Hostapd), red **`[ANOM]`** `WiFiThreatAE` alerts, and **`[NEW]`** baseline tags.
- Press **`4 FILT`** to cycle `ALL / OPEN / WPS / WPA3 / ANOM / NEW`, and **`5 SORT`** to sort by `RSSI / GRADE / CH / NAME`.
- Pressing **`Enter`** on any AP opens the context-aware **Smart Action Sheet**, offering only the highest-value actions for that specific AP:

![Wi-Fi Radar Smart Action Sheet](assets/wifi-studio/radar_actions.png)

- Navigate with **`F`/`X`** and press **`Enter` / `4 RUN`** to launch **RSSI Foxhunt**, **IE Forensics**, **Pin WIDS Baseline**, **Security Grade Audit**, or **Export RadioTap `.pcap`** with the AP's BSSID pre-filled.

---

## 5. RSSI Foxhunt (1D-Kalman) & Link Health / Captive Portal

- **RSSI Foxhunt**: Smooths noisy 2.4 GHz beacon RSSI through a zero-alloc **1D Kalman filter** into **`CLOSER`** (emerald), **`FARTHER`** (amber), or **`STEADY`** (cyan), with a Log-Distance Path Loss distance estimate, 60-sample sparkline, and optional audio Geiger ticks (`4 GEIG`, OFF by default). Ideal for locating a hidden camera SoftAP or rogue AP inside a room.

![Link Health & Captive Portal Inspector](assets/wifi-studio/link.png)

- **Link Health & Captive Portal**: Tracks active `wlan0` RSSI, negotiated bitrate, TX retry ratio, link quality (`/proc/net/wireless`), default gateway RTT, DNS lookup time, and HTTP `204` **Captive Portal** redirect inspection (`4 CHECK`, gated by `ResearchAck`).

---

## 6. Expert Lab: 802.11 Beacon IE Forensics & Evil-Twin WIDS

![802.11 Beacon IE Forensics](assets/wifi-studio/ie_forensics.png)

- **Beacon IE Forensics**: Inspects decoded **`BeaconIEInfo`** TLVs tag-by-tag (`0x00 SSID`, `0x03 DS`, `0x0B BSS Load`, `0x2D HT`, `0x30 RSN/WPA3/PMF`, `0x7F Ext Caps`, `0xDD Vendor/WPS`), displays the full **`WiFiSecurityGrade (A–F)`** checklist, and prints the AP's canonical SHA-256 **`IEFingerprintHash`**. Press **`5 PIN`** to save the AP's IE fingerprint as a trusted WIDS baseline or **`6 PCAP`** to export its RadioTap Beacon frame.

![Evil-Twin WIDS & Rogue Monitor](assets/wifi-studio/wids.png)

- **Evil-Twin WIDS**: Continuously monitors for SSID clones, security downgrades (WPA3 → WPA2/Open), missing Enterprise/Vendor IEs, **`IEFingerprintHash`** drift, and unsupervised **`WiFiThreatAE`** anomalies (`AnomalyZ >= 3.2σ`) with plain-English `FaultReason` attribution. Confirmed alerts log to `~/wifi-studio/alerts.jsonl` (`5 LOG`, `6 CLEAR`).

---

## 7. Expert Lab: Through-Wall Motion Tripwire, Crowd Pulse & Room Heatmap

![Through-Wall Wi-Fi Motion Tripwire & Crowd Pulse](assets/wifi-studio/motion.png)

- **Motion Tripwire & Crowd Pulse**: Press **`Tab`** to switch between:
  - **`MotionTripwire`**: Live `10 Hz` multipath RSSI + TX retry oscilloscope fed from `/proc/net/wireless` and scored by **`WiFiMotionNet-1D`** (`Still_Room`, `Human_Walk`, `Door_Event`, `RF_Interference`). Press **`4 CAL`** to recalibrate the room floor and **`Z`/`C`** to tune tripwire sensitivity.
  - **`CrowdPulse`**: Ambient 2.4 GHz occupancy churn meter aggregating visible BSSID turnover and **BSS Load (`IE 0x0B`)** station counts across surrounding APs.

![Room Heatmap Floorplan Mapper](assets/wifi-studio/heatmap.png)

- **Room Heatmap Mapper (`RoomHeatmap`)**: Walk room-to-room placing spatial `(x, y)` RSSI and link-quality markers on an interactive grid (`F`/`X`/`Z`/`C` move cursor, **`Enter` / `4 PIN`** records averaged RSSI, **`5 EXPORT`** writes JSON/CSV to `~/wifi-studio/exports/`, **`6 CLEAR`** resets the map) to find dead zones and optimal router placement.

---

## 8. Expert Lab: LAN/IoT Recon, Net-Tools & Wake-on-LAN

![LAN & IoT Recon](assets/wifi-studio/lan.png)

- **LAN & IoT Recon**: Press **`Tab`** to toggle **Passive Recon** (zero packets transmitted: `/proc/net/arp` table + **ARP-Spoof duplicate-MAC detector**, multicast **mDNS** `224.0.0.251:5353`, and **SSDP** `239.255.255.250:1900` IoT announcements) vs. **Authorized Active Recon** (`ResearchAck` gated: bounded TCP service check for HTTP/HTTPS/SSH/RTSP `554`/ONVIF/MQTT and **`5 WOL`** Wake-on-LAN Magic Packet sender).
- **Net-Tools Lab**: Non-root Ping RTT, DNS resolver latency, HTTP/Captive-Portal probe, TLS certificate expiry & cipher suite inspection, and saved Wake-on-LAN host launcher.

---

## 9. Opt-In MCP Server (`24` Tools over SSH) & `radio-bridge`

MCP is **disabled by default** (`mcp_enabled: false` in `~/.config/wifi-studio/config.json`). Enable **MCP Server (`--mcp`)** inside **Settings**, then connect over SSH:

```bash
ssh zhenya@cardputerzero /usr/share/APPLaunch/bin/wifi-studio --mcp
```

### Complete 24-Tool Reference
- **Discovery & Spectrum (6)**: `wifi_status` (includes loaded `.czml` model hashes), `wifi_scan_snapshot`, `wifi_ap_inspect`, `wifi_ap_actions`, `wifi_channel_audit`, `wifi_foxhunt_sample`
- **Security, WIDS & Neural Suite (5)**: `wifi_security_audit`, `wifi_wids_status`, `wifi_threat_scan` (`min_z`, default `3.2`), `wifi_ap_classify`, `wifi_motion_assess`
- **EDC Sensing & Link Health (5)**: `wifi_link_health`, `wifi_crowd_pulse`, `wifi_hidden_camera_sweep` (`confirm_net: true` when `include_lan: true`), `wifi_heatmap_sample` (`confirm: true` for `clear`), `wifi_env_learn` (`confirm: true` for `clear`)
- **LAN Recon & Active Net-Tools (5)**: `wifi_lan_passive`, `wifi_lan_scan` (`confirm_net: true`), `wifi_wol_send` (`confirm_net: true`), `wifi_net_probe` (`confirm_net: true`), `wifi_captive_check` (`confirm_net: true`)
- **Exports & Captures (3)**: `wifi_export_pcap`, `wifi_captures_list`, `wifi_captures_delete` (`confirm: true`)

### `radio-bridge` Automation (`StudioWiFi`)
`wifi-studio` is registered in `radio-bridge` as `StudioWiFi ("wifi-studio")`:
- **Match criteria**: `wifi_ssid`, `wifi_bssid`, `wifi_event` (`EVIL_TWIN`, `MOTION_DETECTED`, `NEW_LAN_HOST`, `SPYCAM_SUSPECT`).
- **Allowlisted actions**: `wifi_export_pcap` (non-TX), `wifi_channel_audit` (non-TX), and `wifi_wol_send` (requires `confirm_tx: true` in `triggers.json`, automatically injecting `confirm_net: true`).
