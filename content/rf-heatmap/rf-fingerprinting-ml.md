# ML Deep Dive: On-Device 32D RF Fingerprinting (SupCon + Cosine k-NN)

Even when a rolling-code keyfob (`KeeLoq`, `Somfy RTS`, `StarLine`) encrypts a brand-new payload on every press, its **physical RF waveform signature** stays remarkably consistent: carrier band, modulation family, crystal/RC timing drift, preamble rhythm, pulse ratio, and frame geometry.

`rf-heatmap` encodes every live capture or saved `.sub` file (`RAW` or `Key`) through **`PulseNet-RF` Head B** into an **L2-normalized 32D learned embedding** (`[32]float32`, trained with **Supervised Contrastive Loss (`SupCon`)** for **97.7% clean / 96.4% noisy Recall@1**) and matches incoming bursts with **zero heap allocations**.

---

## 1. Learned 32D Hypersphere vs. Legacy 8D Handcrafted Features

`PulseNet-RF` projects the 198D pooled temporal convolutional representation (Avg+Max over the dilated DS-TCN + 6 physical metadata priors) through a quantized linear projection and L2 normalization ($\hat{v} = v / \|v\|_2 \in S^{31}$). Because every vector lies on the 32D unit hypersphere, **Cosine Similarity** reduces to a 32-element dot product:

$$\text{sim}(a, b) = \sum_{i=0}^{31} \hat{a}_i \cdot \hat{b}_i \in [0, 1]$$

- **Why 32D SupCon outperforms 8D heuristics**: Handcrafted ratios collapse distinct protocols that share `TE ≈ 350–400 µs` (`Princeton`, `CAME`, `GateTX`, `KeeLoq`). Supervised Contrastive training pulls noisy jittered captures of the *same* remote together while pushing different protocol families to orthogonal hemispheres.

---

## 2. Frequency Gating & Cross-Format Matching

- **±2.5 MHz Frequency Gate**: Candidates further than `2.5 MHz` from the live capture are skipped before cosine scoring, eliminating cross-band false matches (`315 / 433 / 868 / 915 MHz`).
- **Cross-Format Matching**: `ComputeEmbeddingFromKey()` synthesizes canonical alternating `µs` pulses from saved Flipper Key files (`Princeton`, `CAME`, `Nice`, `KeeLoq`, `Linear`) and encodes them through the **exact same `PulseNet-RF` backbone**, so live `RAW` captures match both `RAW` and `Key` `.sub` files in one shared 32D manifold.

---

## 3. Programmatic Access via MCP (`rf_match_fingerprint`)

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rf_match_fingerprint","arguments":{"pulses":[-10500,350,-1050,1050,-350],"freq_hz":433920000,"preset":"AM650","min_similarity":0.85,"top_k":3}}}
```
