# Acoustics, FFT, YIN Pitch & 96 kHz Ultrasonics

Audio Studio pairs CardputerZero's **Everest ES8389 Hi-Fi codec** with a zero-allocation pure-Go digital signal processing (DSP) pipeline (`internal/dsp/`). This page explains the physics and math behind each analyzer — and lets you experiment with live signals directly in your browser.

---

## 1. ES8389 Hardware Capture & DC-Blocking

When opening raw ALSA capture on `hw:1,0`, the ES8389 microphone bias capacitor produces a brief **~100 ms DC settle transient** before reaching its quiet `-75 / -81 dBFS` noise floor. Audio Studio enforces two hardware conditioning invariants:

1. **Startup Discard (`120 ms`)**: Samples arriving during the first `120 ms` are dropped before touching any FFT, SPL meter, or anomaly baseline.
2. **1st-Order DC-Blocking High-Pass Filter**:

$$y[n] = x[n] - x[n-1] + R \cdot y[n-1], \quad R = 0.995$$

This eliminates sub-5 Hz DC bias without distorting 50/60 Hz mains hum or audible bass frequencies.

---

## 2. Radix-2 FFT, Windowing & Frequency Scales

A discrete signal frame $x[0 \dots N-1]$ is tapered by a window function $w[n]$ before executing an in-place **Radix-2 Cooley-Tukey FFT** (`N = 512, 1024, 2048`):

- **Hann Window**: $w[n] = 0.5\left(1 - \cos\frac{2\pi n}{N-1}\right)$ — good frequency resolution and `-31 dB` sidelobe suppression (used for bit-exact Log-Mel ML inputs).
- **Blackman-Harris Window**: `-92 dB` sidelobe suppression for spotting weak tones next to loud carriers (e.g., harmonics or ultrasonic sidebands).

Each bin $k$ corresponds to frequency $f_k = k \cdot \frac{f_s}{N}$ and Parseval-normalized power $P[k] = \frac{|X[k]|^2}{N^2}$, converted to decibels relative to full scale (`dBFS`):

$$L[k] = \max\left(-90,\; 10\log_{10}\left(P[k] + 10^{-10}\right)\right)$$

Audio Studio maps positive FFT bins onto 64 LCD columns in three scales:
- **`LOG` (1/3-Octave RTA)**: Equal visual width per musical octave — matches human pitch perception.
- **`LIN` (Linear Hz)**: Equal Hz per column — ideal for spotting evenly spaced harmonics (`f, 2f, 3f, 4f`) and ultrasonic carriers.
- **`MEL` (HTK Mel Scale)**: $m(f) = 2595 \log_{10}(1 + f / 700)$ — exact 32-band triangular filterbank shared with `SoundNet-2D` and `AnomalyAE-2D`.

---

## 3. Interactive Acoustic Spectrum & Pitch Lab

Mix a fundamental tone, harmonics, an ultrasonic carrier, and broadband noise below to see how windowing, frequency scales, spectral flatness, and YIN pitch respond in real time:

```interactive:audio-spectrum-lab
```

---

## 4. YIN Chromatic Pitch Detection

Simple FFT peak-picking confuses strong harmonics (`2f`, `3f`) for the fundamental frequency $F_0$ and suffers coarse bin spacing at low frequencies (`46.9 Hz/bin` at `48 kHz / 1024`). Audio Studio runs the **YIN algorithm** (`internal/dsp/pitch_yin.go`) on decimated `16 kHz` frames:

1. Compute the squared difference function $d(\tau) = \sum_{j=0}^{W-1} (x[j] - x[j+\tau])^2$.
2. Normalize into the **Cumulative Mean Normalized Difference Function (CMNDF)**:
   $$d'(\tau) = \frac{d(\tau)}{\frac{1}{\tau}\sum_{k=1}^{\tau} d(k)}, \quad d'(0) = 1$$
3. Pick the first dip below threshold `0.18`, refine $\tau$ via **parabolic interpolation**, and convert $F_0 = f_s / \tau$ into nearest 12-TET note and cents deviation (`100 cents = 1 semitone`).

---

## 5. Deterministic Narrowband & 96 kHz Ultrasonic Decoders

- **True `96 kHz` Ultrasonic Routing**: Because PipeWire's default graph clock locks to `48,000 Hz` (`24 kHz` Nyquist ceiling), switching to `96 kHz` opens direct ALSA `hw:1,0` to unlock real **`18–48 kHz`** bandwidth — exposing ultrasonic cross-device tracking beacons (`18–22.5 kHz`), switching-power-supply **coil whine (`20–45 kHz`)**, and piezoelectric repellers.
- **Goertzel DTMF Matrix**: Evaluates exact single-frequency DFT bins for the 4 row (`697, 770, 852, 941 Hz`) and 4 column (`1209, 1336, 1477, 1633 Hz`) telecom tones with twist (`<= 10 dB`) and 2nd-harmonic rejection to prevent false triggers on human speech.
- **50/60 Hz Mains Hum & T3 Smoke Alarm**: Checks `50+100 Hz` vs `60+120 Hz` power against a `73 Hz` off-grid reference, and flags resonant `3.0–3.35 kHz` narrowband peaks characteristic of ISO 8201 T3 alarms.

---

## 6. High-Resolution 3D-Printer Belt Tension Physics (`BeltAnalyzer`)

A standard `48 kHz / 1024-pt` FFT has `46.9 Hz/bin` spacing — far too coarse to distinguish an `85 Hz` Prusa belt from a `110 Hz` CoreXY belt. `BeltAnalyzer` (`internal/dsp/belt.go`) applies an anti-aliasing IIR low-pass filter plus `8:1` decimation (`16 kHz → 2,000 Hz`) and runs a `1024`-point Hann FFT (`512 ms` window = **`1.953 Hz/bin`**), followed by:

1. **Sub-Harmonic Fundamental Verification**: Plucked GT2 belts frequently radiate a stronger 2nd harmonic (`2·F0`) than the fundamental. If bin `p/2` (`>= 45 Hz`) sits within `9 dB` of the strongest peak `p` and `>= 8 dB` above the noise floor, `BeltAnalyzer` locks onto `p/2` instead of octave-doubling.
2. **3-Point Log-Parabolic Interpolation**: Fits a parabola through `ln P[k-1], ln P[k], ln P[k+1]` to resolve the resonant frequency within **`±0.2 Hz`**.
3. **Pluck Auto-Lock & 5-Pluck Median**: Captures the highest-SNR frame of each damped belt ring (`0.3–0.8 s`), holds the numeric Hz readout after the ring fades, and computes the median across the last 5 plucks for repeatable CoreXY Belt A vs. Belt B matching.

---

## 7. Active 96 kHz Ultrasonic Doppler Radar & Heterodyne Hearing Aid

Because CardputerZero's ES8389 codec supports **clock-locked `96 kHz` full-duplex** (`arecord hw:1,0` + `aplay hw:1,0` simultaneously), Audio Studio unlocks two active ultrasonic labs inside **`Ultrasonic & Signals`** (`6 MODE` switches **`SCAN | DOPPLER | HEAR`**):

1. **Ultrasonic Doppler Radar (`internal/dsp/doppler.go`)**:
   - Emits a gentle inaudible sine carrier (`19.5 kHz` default — peak `+25.2 dB` SNR on CardputerZero's micro-speaker; tunable `18.5–21.5 kHz`).
   - Moving objects shift the reflected frequency by $\Delta f = \frac{2 v}{c} f_c$ ($c \approx 343\text{ m/s}$). A hand moving at `0.5 m/s` shifts `19.5 kHz` by `+56.8 Hz`.
   - Zero-allocation I/Q baseband demodulation + `1,000 Hz` decimation + `256`-pt complex FFT yields `3.9 Hz/bin` (`~3.4 cm/s` velocity resolution) across `-250..+250 Hz`, classifying **`APPROACH`**, **`RECEDE`**, **`WAVE`**, and **`STILL`**.
2. **Real-Time Heterodyne "Ultrasound Hearing Aid" (`internal/dsp/heterodyne.go`)**:
   - High-passes capture at `17.5 kHz` (stripping audible voice/music), multiplies by a tunable local oscillator $\cos(2\pi f_{\text{LO}} t)$ (`18–44 kHz`), low-passes at `4.5 kHz`, and soft-limits output (`tanh` cap `<= 65%`) to let you **hear** `18–48 kHz` coil whine, air leaks, repellers, and bats in real time.

### Interactive Ultrasonic Doppler & Heterodyne Simulator

```interactive:audio-doppler-lab
```
