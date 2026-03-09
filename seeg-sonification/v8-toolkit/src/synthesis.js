/**
 * synthesis.js — Audio Building Blocks (v8.3)
 *
 * Voice graph per channel:
 *
 *   Layer 1 (Root + AM):
 *     sine(pitch) → rootGain → layer1Gain ─┐
 *                                           │
 *   Layer 2 (Phase Harmonics):              │
 *     sine(pitch×2,×3,×4) → overGain  ─┐   │
 *     sine(pitch/2,×2/3)  → underGain ─┤   │
 *                         layer2Gain  ──┤   │
 *                                       │   │
 *   Layer 3 (FM / Centroid):            │   │
 *     mod sine(pitch×2) → fmModGain    │   │
 *       → carrier.frequency            │   │
 *     carrier sine(pitch) → fmAmpGain  │   │
 *       → layer3Gain ──────────────────┤   │
 *                                       │   │
 *   Layer 4 (Transients):               │   │
 *     pitched click → transientGain ────┤   │
 *                                       ▼   ▼
 *                                   channelBus
 *                                       │
 *                                  [waveshaper]  ← per-channel distortion
 *                                       │
 *                                    trimGain    ← per-channel dB trim
 *                                       │
 *                                     panner     ← stereo position
 *                                       │
 *                                   destination
 *
 * KEY CHANGES FROM v8.2:
 *   - Waveshaper moved to END of chain (after all layers merge).
 *     All four layers get tissue-derived distortion character.
 *   - Transient templates are PITCHED to the channel's fundamental.
 *     Short sine burst at pitchHz with noise blend, so clicks sound
 *     like part of the instrument instead of a separate event.
 *   - trimGain node added for per-channel gain trim (dB offset).
 *   - Transient detection: baseline window 3s (was 500ms) so spikes
 *     fire throughout seizures, not just at onset.
 *
 * Exports:
 *   detectTransients(features, opts?)
 *   prerenderPitchedClick(audioCtx, pitchHz, salience)
 *   prerenderTemplates(audioCtx, pitchHz)
 *   createVoiceGraph(audioCtx, destination, pitchHz, pan, distortionCurve?)
 */


// ─────────────────────────────────────────────────────────────────────────────
// TRANSIENT DETECTION (v8.3 — longer baseline, tighter gating)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect spike events from PPAF.
 *
 * v8.3: Baseline window 3s (was 500ms). At 500ms the baseline catches up
 * to seizure level within seconds, silencing transients during ictal body.
 * At 3s, the baseline lags enough that spikes fire throughout.
 *
 * @param {object} features
 * @param {object} [opts]
 * @param {number} [opts.baselineWindowMs=3000]
 * @param {number} [opts.refractoryMs=40]
 * @returns {Array<{timeSec, type, salience, ppafNorm}>}
 */
export function detectTransients(features, opts = {}) {
  const { ppaf, calibration } = features;
  const fs = calibration.fs;
  const events = [];

  const SPIKE_FLOOR    = 0.10;
  const baselineWin    = Math.floor(fs * (opts.baselineWindowMs ?? 3000) / 1000);
  const minSpikeGap    = Math.floor(fs * (opts.refractoryMs ?? 40) / 1000);
  let   baselineSum    = 0;
  let   lastSpikeSample = -minSpikeGap;

  for (let i = 0; i < ppaf.length; i++) {
    baselineSum += ppaf[i];
    if (i >= baselineWin) baselineSum -= ppaf[i - baselineWin];
    const baseline = baselineSum / Math.min(i + 1, baselineWin);

    const aboveFloor    = ppaf[i] > SPIKE_FLOOR;
    const aboveBaseline = baseline > 0.01 && ppaf[i] > baseline * 2.0;

    if ((aboveFloor && aboveBaseline) && i - lastSpikeSample >= minSpikeGap) {
      const ratio    = baseline > 0.01 ? ppaf[i] / baseline : ppaf[i] * 3;
      const salience = ratio > 4 ? 2 : ratio > 2.5 ? 1 : 0;
      events.push({ timeSec: i / fs, type: 'spike', salience, ppafNorm: ppaf[i] });
      lastSpikeSample = i;
    }
  }

  return events;
}


// ─────────────────────────────────────────────────────────────────────────────
// PITCHED TRANSIENT TEMPLATES
//
// Each channel gets clicks pitched to its fundamental. A short sine burst
// with exponential decay + noise texture. The click sounds like part of
// the channel's voice, not a separate event layered on top.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-render a pitched click for one channel at one salience tier.
 *
 * @param {AudioContext} audioCtx
 * @param {number} pitchHz — channel fundamental
 * @param {number} salience — 0, 1, or 2
 * @returns {AudioBuffer}
 */
export function prerenderPitchedClick(audioCtx, pitchHz, salience) {
  const sr = audioCtx.sampleRate;

  const specs = [
    { gain: 0.15, decayMs: 12, noiseBlend: 0.15, toneGain: 0.85 },
    { gain: 0.35, decayMs: 18, noiseBlend: 0.30, toneGain: 0.70 },
    { gain: 0.65, decayMs: 25, noiseBlend: 0.45, toneGain: 0.55 },
  ];
  const spec = specs[salience] ?? specs[0];

  const n   = Math.floor(sr * 0.035);
  const buf = audioCtx.createBuffer(1, n, sr);
  const ch  = buf.getChannelData(0);
  const dec = (spec.decayMs / 1000) * sr;
  const omega = 2 * Math.PI * pitchHz / sr;

  for (let i = 0; i < n; i++) {
    const env     = Math.exp(-i / dec);
    const tone    = Math.sin(omega * i) * spec.toneGain;
    const noise   = (Math.random() * 2 - 1) * spec.noiseBlend;
    const impulse = i < 2 ? 0.3 : 0;
    ch[i] = (tone + noise + impulse) * env * spec.gain;
  }

  // Mild highpass to remove low-frequency thump
  for (let i = n - 1; i > 0; i--) {
    ch[i] = ch[i] - ch[i - 1] * 0.6;
  }

  return buf;
}


/**
 * Pre-render templates for all 3 salience tiers at a given pitch.
 * Keys: 'spike-0', 'spike-1', 'spike-2'
 *
 * NOTE: Now takes pitchHz parameter. Engine must call this per-channel
 * OR once with a representative pitch. See engine.js changes.
 *
 * @param {AudioContext} audioCtx
 * @param {number} [pitchHz=440]
 * @returns {Map<string, AudioBuffer>}
 */
export function prerenderTemplates(audioCtx, pitchHz = 440) {
  const templates = new Map();
  for (let s = 0; s < 3; s++) {
    templates.set(`spike-${s}`, prerenderPitchedClick(audioCtx, pitchHz, s));
  }
  return templates;
}


// ─────────────────────────────────────────────────────────────────────────────
// VOICE GRAPH — END-OF-CHAIN WAVESHAPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the four-layer voice graph for one channel.
 *
 * All layers → channelBus → [waveshaper] → trimGain → panner → destination
 *
 * @param {AudioContext} audioCtx
 * @param {AudioNode}    destination
 * @param {number}       pitchHz
 * @param {number}       pan — [-1, 1]
 * @param {Float32Array|null} distortionCurve
 * @returns {VoiceGraph}
 */
export function createVoiceGraph(audioCtx, destination, pitchHz, pan, distortionCurve = null) {

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT CHAIN: channelBus → [waveshaper] → trimGain → panner → destination
  // ═══════════════════════════════════════════════════════════════════════════

  const panner = new StereoPannerNode(audioCtx, { pan });

  const trimGain = audioCtx.createGain();
  trimGain.gain.value = 1.0;

  const channelBus = audioCtx.createGain();
  channelBus.gain.value = 1.0;

  let waveshaper = null;
  if (distortionCurve) {
    waveshaper = audioCtx.createWaveShaper();
    waveshaper.curve = distortionCurve;
    waveshaper.oversample = '2x';
    channelBus.connect(waveshaper);
    waveshaper.connect(trimGain);
  } else {
    channelBus.connect(trimGain);
  }

  trimGain.connect(panner);
  panner.connect(destination);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: Root + AM
  // ═══════════════════════════════════════════════════════════════════════════

  const rootOsc = audioCtx.createOscillator();
  rootOsc.type = 'sine';
  rootOsc.frequency.value = pitchHz;

  const rootGain = audioCtx.createGain();
  rootGain.gain.value = 0;

  const layer1Gain = audioCtx.createGain();
  layer1Gain.gain.value = 1.0;

  rootOsc.connect(rootGain);
  rootGain.connect(layer1Gain);
  layer1Gain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: Phase Harmonics
  // ═══════════════════════════════════════════════════════════════════════════

  const overOscs = [2, 3, 4].map(ratio => {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.value = pitchHz * ratio;
    return o;
  });

  const underOscs = [0.5, 2/3].map(ratio => {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.value = pitchHz * ratio;
    return o;
  });

  const overGain = audioCtx.createGain();
  overGain.gain.value = 0;

  const underGain = audioCtx.createGain();
  underGain.gain.value = 0;

  const layer2Gain = audioCtx.createGain();
  layer2Gain.gain.value = 1.0;

  for (const o of overOscs)  o.connect(overGain);
  for (const o of underOscs) o.connect(underGain);

  overGain.connect(layer2Gain);
  underGain.connect(layer2Gain);
  layer2Gain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: FM / Centroid
  // ═══════════════════════════════════════════════════════════════════════════

  const fmCarrier = audioCtx.createOscillator();
  fmCarrier.type = 'sine';
  fmCarrier.frequency.value = pitchHz;

  const fmModulator = audioCtx.createOscillator();
  fmModulator.type = 'sine';
  fmModulator.frequency.value = pitchHz * 2;

  const fmModGain = audioCtx.createGain();
  fmModGain.gain.value = 0;

  const fmAmpGain = audioCtx.createGain();
  fmAmpGain.gain.value = 0;

  const layer3Gain = audioCtx.createGain();
  layer3Gain.gain.value = 1.0;

  fmModulator.connect(fmModGain);
  fmModGain.connect(fmCarrier.frequency);

  fmCarrier.connect(fmAmpGain);
  fmAmpGain.connect(layer3Gain);
  layer3Gain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: Transients → channelBus (gets distortion like everything else)
  // ═══════════════════════════════════════════════════════════════════════════

  const transientGain = audioCtx.createGain();
  transientGain.gain.value = 1.0;
  transientGain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  const allOscs = [rootOsc, ...overOscs, ...underOscs, fmCarrier, fmModulator];
  let _muted = false;

  return {
    allOscs,
    rootGain, layer1Gain,
    overGain, underGain, layer2Gain,
    fmModGain, fmAmpGain, layer3Gain,
    transientGain,
    channelBus, waveshaper, trimGain, panner,

    get muted() { return _muted; },
    setMuted(m) {
      _muted = m;
      if (m) {
        try { panner.disconnect(destination); } catch (_) {}
      } else {
        try { panner.connect(destination); } catch (_) {}
      }
    },
  };
}
