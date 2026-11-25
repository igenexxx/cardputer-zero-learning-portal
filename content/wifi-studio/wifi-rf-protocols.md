# 2.4 GHz Wi-Fi RF Physics, 802.11 Beacon IEs, WIDS & LAN Forensics

This deep-dive explains the radio spectrum math, 802.11 management frame forensics, Evil-Twin intrusion detection, Fresnel-zone through-wall motion physics, and non-root LAN reconnaissance powering **`wifi-studio`** on M5Stack CardputerZero.

---

## 1. 2.4 GHz Channel Overlap Math (`1 / 6 / 11` Orthogonality)

The 2.4 GHz ISM band (`2400–2483.5 MHz`) divides Wi-Fi channels on a **5 MHz center-frequency grid**:

$$f_c(k) = 2407 + 5k \text{ MHz}, \qquad k \in \{1, 2, \dots, 13\}$$

However, every legacy DSSS (`802.11b`) or HT20 OFDM (`802.11g/n`) channel occupies **22 MHz** of RF bandwidth ($f_c \pm 11\text{ MHz}$). Because channels are spaced only 5 MHz apart while spanning 22 MHz:
- **Adjacent-channel interference (ACI)** occurs whenever $|k_a - k_b| < 5$, i.e. $|f_c(k_a) - f_c(k_b)| < 22\text{ MHz}$. Unlike polite co-channel CSMA/CA sharing on the *same* channel, partially overlapping transmitters cannot reliably decode each other's preambles and instead collide as raw broadband noise — collapsing throughput and spiking TX retries!
- **Orthogonal (non-overlapping) triplet**: Channels **1** (`2412 MHz`), **6** (`2437 MHz`), and **11** (`2462 MHz`) sit **25 MHz apart** ($\ge 22\text{ MHz}$), yielding **zero** spectral overlap:

$$\text{Overlap}(k_a, k_b) = \max\!\left(0,\; 1 - \frac{|f_c(k_a) - f_c(k_b)|}{22}\right)$$

### `ChannelBellScore` (`0–100`)
`wifi-studio`'s Bell-Curve Planner plots each AP's parabolic 22 MHz spectral envelope and computes **`ChannelBellScore`** for every candidate channel $c \in [1..13]$ by combining:
1. **Co-channel contention** ($k = c$): weighted by received signal strength (normalized above `-96 dBm`) and real **BSS Load (`IE 0x0B`)** channel utilization.
2. **Adjacent-channel overlap penalty** ($0 < |k - c| < 5$): scaled by $\text{Overlap}(c, k)$ and an adjacent-interference multiplier (penalizing mid-channel deployments like Ch `3`, `4`, `8`, or `9`).
3. **Optimal `1 / 6 / 11` selection**: recommends the highest-scoring orthogonal channel so your AP maximizes airtime efficiency without poisoning neighbors.

---

## 2. 802.11 Beacon Management Frames & Information Elements (`BeaconIEInfo`)

Every Access Point broadcasts an **802.11 Management Beacon** roughly every `100 TU` (`102.4 ms`). CardputerZero's non-root `fi.w1.wpa_supplicant1` D-Bus interface (`BSS.Properties["IEs"]`) exposes the raw **Information Element (IE)** byte stream without requiring monitor mode or `root`!

Each IE follows a strict **Tag-Length-Value (TLV)** layout `[Tag: 1 B][Len: 1 B][Value: Len B]`:

| Tag ID | Element Name | Engineering & Security Meaning |
| --- | --- | --- |
| **`0x00`** | **SSID** | Network name (`0..32` UTF-8 bytes); length `0` indicates a hidden SSID. |
| **`0x03`** | **DS Parameter Set** | Authoritative primary 2.4 GHz channel (`1..13`) — mismatches against actual RF frequency hint at spoofing or repeater relay. |
| **`0x0B`** | **BSS Load (QBSS)** | 5-byte real-time congestion telemetry: `Station Count` (`uint16 LE`), `Channel Utilization` (`0..255` → `0..100%` airtime), and `Available Admission Capacity`. Powers `ChannelBellScore` and **`CrowdPulse`**. |
| **`0x2D`** | **HT Capabilities** | `802.11n` PHY parameters (20/40 MHz, Short GI, MIMO spatial streams). Helps distinguish enterprise multi-stream APs from 1×1 SISO ESP32/camera SoftAPs. |
| **`0x30`** | **RSN (WPA2 / WPA3)** | Group/Pairwise ciphers (`TKIP` `00:0F:AC:02` vs `CCMP-128` `00:0F:AC:04`), AKM suites (`PSK` `0x02`, `802.1X` `0x01`, **`WPA3-SAE` `0x08`**, `FT-SAE` `0x09`), and **PMF (`802.11w`)** capability bits **`MFPC`** (Capable) and **`MFPR`** (Required). |
| **`0x36` / `0x7F`** | **Mobility Domain & Ext Caps** | Fast roaming (`802.11r`), Radio Resource Measurement (`802.11k`), and BSS Transition Management (`802.11v`). |
| **`0xDD`** | **Vendor Specific / WPS** | Prefixed by a 3-byte OUI + 1-byte type: e.g., **WPS TLV (`00:50:F2:04`)** revealing `WPS State`, `AP Setup Locked`, device model, and PIN/PBC vulnerabilities, plus WMM QoS (`00:50:F2:02`) and chipset OUIs (Espressif, Broadcom, Qualcomm, Ubiquiti). |

### `WiFiSecurityGrade (A–F)` Rubric
`wifi-studio` translates raw `BeaconIEInfo` flags into an instant plain-English security grade:

| Grade | Criteria | Meaning |
| --- | --- | --- |
| **`A`** | **WPA3-SAE** (or `802.1X` Enterprise) + **`PMF (802.11w)` Required** (`MFPR=1`) + **WPS Off** | Strong: resistant to offline dictionary attacks and unauthenticated deauth floods. |
| **`B`** | **WPA2-CCMP** + **PMF Capable/Required** + **WPS Off** (or WPA3 transition cleanly configured) | Good: solid AES-CCMP encryption; enable WPA3-only + mandatory PMF when legacy clients allow. |
| **`C`** | **WPA2-CCMP** without PMF (`MFPC=0`) and WPS disabled | Caution: vulnerable to unauthenticated management-frame deauth/disassoc spoofing. |
| **`D`** | Legacy **TKIP** enabled, or **unlocked WPS 2.0 PIN/PBC** exposed (`0xDD 00:50:F2:04`) | High risk: WPS Pixie-Dust / PIN brute-force or deprecated cipher surface. |
| **`F`** | **Open** (no RSN), **WEP**, or active **Evil-Twin / Security Downgrade** detected | Critical: traffic unencrypted or spoofed rogue AP actively attacking clients! |

### SHA-256 `IEFingerprintHash` & Evil-Twin Detection
Cloning an AP's SSID and spoofing its MAC address (`BSSID`) takes one line in `hostapd`. However, different Wi-Fi stacks (Ubiquiti, Apple, Cisco, TP-Link, Linux `hostapd`, ESP32 SoftAP) emit remarkably distinct **ordered IE tag lists, capability bitmasks, and vendor OUI sequences**. `wifi-studio` hashes this canonical structure into **`IEFingerprintHash` (SHA-256)**. If a cloned AP broadcasts your SSID (and even your exact BSSID!) with a different `IEFingerprintHash` — or strips WPA3/PMF down to Open/WPA2 — WIDS fires an **`EVIL_TWIN`** alert immediately.

---

## 3. Interactive 2.4 GHz Bell-Curve, Beacon IE & Motion Tripwire Lab

Experiment live in your browser across all three tabs below: optimize **2.4 GHz `1 / 6 / 11` channel placement**, dissect **802.11 Beacon IEs + `WiFiSecurityGrade` + `WiFiThreatAE` Z-scores**, and inject events into the **10 Hz Through-Wall Motion Tripwire oscilloscope**!

```interactive:wifi-rf-lab
```

---

## 4. Fresnel-Zone Physics Behind Through-Wall Wi-Fi Motion Sensing

Dedicated Wi-Fi radar research often uses custom kernel patches to extract subcarrier **Channel State Information (CSI)**. CardputerZero runs strictly **non-root**, yet still achieves practical through-wall motion detection (**`MotionTripwire`**) using Fresnel-zone multipath physics:

1. **First Fresnel Zone Radius**: At $f = 2.45\text{ GHz}$, the RF wavelength is $\lambda = c / f \approx 12.2\text{ cm}$. Between a router and CardputerZero separated by distance $d$, the midpoint cross-sectional radius of the first Fresnel ellipsoid is:
   $$r_1 = \frac{1}{2}\sqrt{\lambda d}$$
   For a typical $d = 6\text{ m}$ indoor link, $r_1 \approx 0.43\text{ m}$ — roughly the width of a human torso.
2. **Multipath Phasor Cancellation**: The receiver sums the direct line-of-sight wave plus wall/ceiling/floor reflections:
   $$E_{\text{rx}}(t) = \sum_{k} A_k e^{-j(2\pi d_k(t) / \lambda)}$$
   Because a human body is ~65% water (high dielectric constant at 2.4 GHz), walking through the Fresnel zone shifts path lengths $d_k(t)$ by half-wavelength multiples (`~6 cm`), driving rapid **`3–10 dB` RSSI ripples** and transient **MAC-layer TX retry bursts** even through drywall!
3. **Non-Root 10 Hz Sampling**: `wifi-studio` polls `/proc/net/wireless` and `wpa_supplicant1` link stats at **`10 Hz`** (`0 allocs/op`), separating slow thermal drift (`Still_Room`), rhythmic gait modulation (`Human_Walk`), sharp single-step multipath transitions (`Door_Event`), and high-retry broadband bursts (`RF_Interference`, e.g., 2.45 GHz microwave ovens) via **`WiFiMotionNet-1D`**.

---

## 5. Non-Root LAN Forensics: mDNS, SSDP, ARP-Spoof, Hidden Cameras & WoL

Once connected to an authorized network, `wifi-studio` performs Layer-2/Layer-3 diagnostics using standard unprivileged sockets and kernel procfs tables:

- **Passive Service Discovery (Zero TX)**:
  - **mDNS (`224.0.0.251:5353`)**: Listens for Bonjour/Avahi `_http._tcp`, `_ssh._tcp`, `_airplay._tcp`, `_hap._tcp`, and `_rtsp._tcp` announcements.
  - **SSDP (`239.255.255.250:1900`)**: Captures UPnP `NOTIFY` headers revealing smart TVs, routers, and IP camera XML descriptors.
  - **ARP-Spoof Detector (`/proc/net/arp`)**: Inspects the kernel neighbor cache for **two distinct IPv4 hosts sharing the same non-gateway MAC** or an unexpected **default-gateway MAC flip** — the classic signature of a Layer-2 ARP-poisoning MITM attack.
- **`HiddenCameraSweep`**: Combines passive 2.4 GHz SoftAP fingerprinting (Espressif/Tuya/Hikvision/Dahua/HiSilicon OUIs + minimal 1×1 SISO IE stacks) with authorized LAN service checks (RTSP port `554`, ONVIF HTTP/WS-Discovery, embedded web consoles) to rank `SPYCAM_SUSPECT` hosts cleanly.
- **Wake-on-LAN (`WoL`)**: Constructs a standard **102-byte Magic Packet** (`6 × 0xFF` header followed by `16 ×` the target NIC's 6-byte MAC) and transmits it over UDP port `9` (gated behind `ResearchAck` in UI and `confirm_net: true` in MCP and `radio-bridge`).
