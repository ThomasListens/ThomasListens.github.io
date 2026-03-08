/**
 * synthesis.js — Audio Building Blocks (v8.2 — Four-Layer + Distortion)
 *
 * Voice graph per channel:
 *
 *   Layer 1 (Root + AM):
 *     sine(pitch) → [waveshaper] → rootGain → layer1Gain → panner
 *     The waveshaper is optional — only inserted when drive > 0.
 *     Its curve is unique per channel, derived from tissue statistics.
 *
 *   Layer 2 (Phase Harmonics):
 *     sine(pitch×2,×3,×4) → overGain → layer2Gain → panner
 *     sine(pitch/2,×2/3)  → underGain → layer2Gain → panner
 *     Crossfade driven by signed voltage (not Hilbert phase).
 *
 *   Layer 3 (FM / Centroid):
 *     modulator sine(pitch×2) → fmModGain → carrier.frequency
 *     carrier sine(pitch) → fmAmpGain → layer3Gain → panner
 *
 *   Layer 4 (Transients):
 *     AudioBufferSourceNode (cloned on demand) → transientGain → panner
 *
 * Exports:
 *   detectTransients(features)
 *   prerenderTemplates(audioCtx)
 *   createVoiceGraph(audioCtx, destination, pitchHz, pan, distortionCurve?)
 */


// ─────────────────────────────────────────────────────────────────────────────
// TRANSIENT DETECTION (v8.2 — ticker removed, only spikes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect transient events in pre-extracted, normalized feature arrays.
 *
 * v8.2: Ticker detection REMOVED. Only spike detection remains.
 *
 * 'spike' — PPAF threshold crossing
 *   Fires when normalized PPAF exceeds a fixed noise floor.
 *   User-controlled spikeThreshold applied at SCHEDULING time.
 *
 * @param {{ envelope: Float32Array, ppaf: Float32Array, calibration: {fs: number} }} features
 * @returns {Array<{timeSec: number, type: 'spike', salience: 0|1|2, ppafNorm: number}>}
 */
export function detectTransients(features) {
  const { ppaf, calibration } = features;
  const fs = calibration.fs;
  const events = [];

  // ── Spike: PPAF above fixed noise floor + running baseline ────────────────
  const SPIKE_FLOOR  = 0.10;
  const baselineWin  = Math.floor(fs * 0.5);
  const minSpikeGap  = Math.floor(fs * 0.030);   // 30ms refractory
  let   baselineSum  = 0;
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
// TEMPLATE PRE-RENDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-render AudioBuffers for spike transients × 3 salience tiers.
 * Template keys: 'spike-0', 'spike-1', 'spike-2'
 */
export function prerenderTemplates(audioCtx) {
  const sr = audioCtx.sampleRate;
  const templates = new Map();

  const spikeSpecs = [
    { salience: 0, gain: 0.15, decayMs: 10, noiseBlend: 0.3 },
    { salience: 1, gain: 0.35, decayMs: 15, noiseBlend: 0.5 },
    { salience: 2, gain: 0.65, decayMs: 22, noiseBlend: 0.7 },
  ];

  for (const spec of spikeSpecs) {
    const n   = Math.floor(sr * 0.030);  // 30ms max
    const buf = audioCtx.createBuffer(1, n, sr);
    const ch  = buf.getChannelData(0);
    const dec = (spec.decayMs / 1000) * sr;

    for (let i = 0; i < n; i++) {
      const env   = Math.exp(-i / dec);
      const noise = (Math.random() * 2 - 1) * spec.noiseBlend;
      const click = (i < 3 ? 1.0 : 0) * (1 - spec.noiseBlend);
      ch[i] = (noise + click) * env * spec.gain;
    }

    // Mild highpass to remove low-frequency thump
    for (let i = n - 1; i > 0; i--) {
      ch[i] = ch[i] - ch[i - 1] * 0.7;
    }

    templates.set(`spike-${spec.salience}`, buf);
  }

  return templates;
}


// ─────────────────────────────────────────────────────────────────────────────
// VOICE GRAPH — FOUR-LAYER + WAVESHAPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the four-layer voice graph for one channel.
 *
 * @param {AudioContext} audioCtx
 * @param {AudioNode}    destination — master gain node
 * @param {number}       pitchHz
 * @param {number}       pan — [-1, 1]
 * @param {Float32Array|null} distortionCurve — from computeDistortionCurve()
 * @returns {VoiceGraph}
 */
export function createVoiceGraph(audioCtx, destination, pitchHz, pan, distortionCurve = null) {

  const panner = new StereoPannerNode(audioCtx, { pan });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: Root + AM + optional distortion
  // ═══════════════════════════════════════════════════════════════════════════

  const rootOsc = audioCtx.createOscillator();
  rootOsc.type = 'sine';
  rootOsc.frequency.value = pitchHz;

  const rootGain = audioCtx.createGain();
  rootGain.gain.value = 0;

  const layer1Gain = audioCtx.createGain();
  layer1Gain.gain.value = 1.0;

  // Distortion: WaveShaperNode with per-channel curve
  let waveshaper = null;
  if (distortionCurve) {
    waveshaper = audioCtx.createWaveShaper();
    waveshaper.curve = distortionCurve;
    waveshaper.oversample = '2x';

    rootOsc.connect(waveshaper);
    waveshaper.connect(rootGain);
  } else {
    rootOsc.connect(rootGain);
  }

  rootGain.connect(layer1Gain);
  layer1Gain.connect(panner);


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
  layer2Gain.connect(panner);


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
  layer3Gain.connect(panner);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: Transients
  // ═══════════════════════════════════════════════════════════════════════════

  const transientGain = audioCtx.createGain();
  transientGain.gain.value = 1.0;
  transientGain.connect(panner);


  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════════════════

  panner.connect(destination);

  const allOscs = [rootOsc, ...overOscs, ...underOscs, fmCarrier, fmModulator];

  let _muted = false;

  return {
    allOscs,
    rootGain,
    layer1Gain,
    overGain,
    underGain,
    layer2Gain,
    fmModGain,
    fmAmpGain,
    layer3Gain,
    transientGain,
    panner,
    waveshaper,

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
