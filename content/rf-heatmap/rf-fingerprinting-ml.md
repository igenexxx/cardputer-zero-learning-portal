# ML Deep Dive: On-Device RF Fingerprinting (Cosine k-NN)

Even when a rolling-code keyfob (`KeeLoq`) encrypts a brand-new payload on every press, its **physical RF signature** stays remarkably consistent: carrier frequency, modulation family, base time element (`TE`), pulse ratio, sync gap, frame length, and duty cycle.

`rf-heatmap` turns every saved `.sub` file (`RAW` or `Key`) into a compact **8D L2-normalized embedding** (`internal/rfml/fingerprint.go`) and matches incoming bursts in `< 15 µs` with **zero heap allocations**.

---

## 1. The 8D RF Embedding

| Index | Feature | Why It Distinguishes Transmitters |
| --- | --- | --- |
| `0` | `BandNorm` | Separates 315, 433, 868, and 915 MHz hardware |
| `1` | `ModType` | Separates OOK/AM (`0.25`) from 2-FSK/FM (`0.85`) |
| `2` | `ShortUsNorm` | Exact crystal/RC `TE` varies slightly even between remotes of the same brand |
| `3` | `LongUsNorm` | Long symbol pulse centroid |
| `4` | `RatioNorm` | `1:3` (Princeton/Linear) vs `1:2` (CAME/KeeLoq) |
| `5` | `LogSyncUs` | Inter-frame sync pause duration |
| `6` | `FrameLenNorm` | Pulses per frame (20–52 fixed vs 120–170 rolling) |
| `7` | `DutyCycle` | Carrier-on ratio across the burst |

Every vector is L2-normalized ($\hat{v} = v / \|v\|_2$) so **Cosine Similarity** reduces to a fast 8-element dot product:

$$\text{sim}(a, b) = \sum_{i=0}^{7} \hat{a}_i \cdot \hat{b}_i \in [0, 1]$$

---

## 2. Frequency Gating & Cross-Format Matching

- **±2.5 MHz Frequency Gate**: Candidates further than `2.5 MHz` from the live capture are skipped before cosine scoring, eliminating cross-band false matches.
- **Cross-Format Matching**: `ComputeEmbeddingFromKey()` synthesizes a compatible 8D embedding for saved Flipper Key files (`Princeton`, `CAME`, `Linear`), so live `RAW` captures match both `RAW` and `Key` `.sub` files seamlessly.

---

## 3. Programmatic Access via MCP (`rf_match_fingerprint`)

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rf_match_fingerprint","arguments":{"pulses":[-10500,350,-1050,1050,-350],"freq_hz":433920000,"preset":"AM650","min_similarity":0.85,"top_k":3}}}
```
