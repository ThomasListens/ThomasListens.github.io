# SEEG Sonification Engine

A web-based tool for sonifying stereoelectroencephalography (SEEG) data from the OpenNeuro ds004100 dataset (Penn/HUP Epilepsy).

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Load an EDF file to begin.

## Build for Production

```bash
npm run build
```

The `dist/` folder will contain a standalone site you can deploy anywhere (GitHub Pages, Netlify, etc.) or open `dist/index.html` directly.

## Project Structure

```
src/
  main.jsx           — React entry point
  App.jsx            — Main DAW layout component
  edf.js             — Pure JavaScript EDF parser (no dependencies)
  dsp.js             — Bandpass filtering, RMS envelopes, band definitions
  audio.js           — Web Audio API synthesis engine
  WaveformCanvas.jsx — Canvas-based waveform renderer
```

## Architecture

- **EDF Parser**: Pure JS, reads EDF headers and 16-bit integer data records, applies physical scaling
- **Signal Processing**: Biquad bandpass filters for neural frequency bands (δ θ α β γL γH), RMS envelope extraction
- **Audio Synthesis**: One sine oscillator per bipolar pair, amplitude-modulated by the EEG RMS envelope, custom just-intonation ratios per channel
- **Pitch Mapping**: Based on Desikan-Killiany atlas (Desikan et al., 2006) — inferior-superior axis maps to pitch via just intonation ratios

## Pitch Mapping Reference

Thalamus = 1/1 (220 Hz). Right hemisphere otonal, left hemisphere utonal.

| Region | DK Atlas Label | Ratio | Hz |
|--------|---------------|-------|----|
| Thalamus | bilateral | 1/1 | 220.0 |
| R. Amygdala | Right-Amygdala | TBD | — |
| R. Hippocampus | Right-Hippocampus | TBD | — |
| L. Ant. Frontal | lh.rostralmiddlefrontal | TBD | — |
| R. Ant. Frontal | rh.rostralmiddlefrontal | TBD | — |
| R. Post. Frontal | rh.caudalmiddlefrontal | TBD | — |
| R. Central | rh.precentral | TBD | — |
| R. Parietal | rh.superiorparietal | TBD | — |

## Data

- Dataset: [OpenNeuro ds004100](https://openneuro.org/datasets/ds004100)
- Subject: sub-HUP116
- SOZ: Right Amygdala + Right Hippocampus (mesial temporal lobe epilepsy)

## Credits

Thomas Listens · 2025
Desikan, R.S. et al. (2006). NeuroImage, 31:968-980.
