/**
 * mapping.js — Feature → Synthesis Parameter Mapping (v8.3)
 *
 * Architecture: ONE master amplitude, FOUR character layers.
 *
 * Master amplitude = weighted RMS blend + AM modulation + dynamic range.
 * Every layer multiplies against masterAmp for ENERGY.
 * Each layer adds its own CHARACTER (timbre, spectrum, events).
 *
 * Signal flow (mirrors the UI panel):
 *   SOURCE     → band selection, pitch assignment
 *   AMPLITUDE  → masterAmp (RMS blend × Hilbert AM × dynamic range)
 *   MORPHOLOGY → range + sensitivity (modulated by slope asymmetry + complexity)
 *   FREQUENCY  → centroid FM + mobility jitter + entropy perturbation + bandwidth spread
 *   DETECTION  → PPAF threshold + salience tiers + spectral flux + refractory
 *
 * Curves built per channel (Float32Array at AUTOMATION_RATE Hz):
 *   masterAmpCurve   — THE amplitude curve
 *   activityCurve    — line-length gate (multiplied into all layers)
 *   rootAmpCurve     — Layer 1: masterAmp × activityCurve
 *   morphologyCurves — Layer 2: 5 per-overtone gains {over2, over3, over4, under05, under23}
 *   fmIndexCurve     — Layer 3: centroid × mobility × entropy × bandwidth (Hz)
 *   fmAmpCurve       — Layer 3: masterAmp × activityCurve (output level)
 *
 * Per-channel static:
 *   distortionCurve  — WaveShaper transfer function (Float32Array, 256 points)
 *
 * Exports:
 *   AUTOMATION_RATE, DEFAULT_MASTER_TUNE, DEFAULT_CONTROLS
 *   assignPitches, mapControls
 *   buildMasterAmplitude, buildActivityCurve
 *   buildRootAmpCurve, buildMorphologyCurves
 *   buildFMIndexCurve, buildFMAmpCurve
 *   computeDistortionCurve
 */


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const AUTOMATION_RATE    = 60;
export const DEFAULT_MASTER_TUNE = 130.0;

const JI_TABLE = [
  [1,1], [9,8], [5,4], [4,3], [3,2], [5,3], [15,8],
  [2,1], [9,4], [5,2], [8,3], [3,1], [10,3], [7,2], [4,1],
];

const SHAFT_RATIOS = [];
{
  let r = 1;
  for (let i = 0; i < 20; i++) {
    SHAFT_RATIOS.push(r);
    r *= 3 / 2;
    if (r > 6) r /= 2;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PITCH ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

export function assignPitches(channels, masterTune = DEFAULT_MASTER_TUNE, ratioOverrides = null) {
  const result = new Map();
  const shafts = new Map();
  for (const ch of channels) {
    const key = ch.shaft || ch.label;
    if (!shafts.has(key)) shafts.set(key, []);
    shafts.get(key).push(ch.label);
  }

  const shaftNames = [...shafts.keys()];

  for (let si = 0; si < shaftNames.length; si++) {
    const name   = shaftNames[si];
    const labels = shafts.get(name);
    const shaftMul = SHAFT_RATIOS[si % SHAFT_RATIOS.length];

    const first = name.charAt(0).toUpperCase();
    let pan = 0;
    if (first === 'L') pan = -0.3 - (si * 0.05);
    else if (first === 'R') pan = 0.3 + (si * 0.05);
    pan = Math.max(-1, Math.min(1, pan));

    for (let ci = 0; ci < labels.length; ci++) {
      const ji = JI_TABLE[ci % JI_TABLE.length];
      const contactRatio = ji[0] / ji[1];
      const fullRatio = shaftMul * contactRatio;
      const overrideRatio = ratioOverrides?.get(labels[ci]);
      const ratio = overrideRatio ?? fullRatio;

      result.set(labels[ci], {
        ratio,
        ratioLabel: overrideRatio != null ? _ratioToLabel(ratio) : _buildLabel(shaftMul, ji),
        hz: masterTune * ratio,
        pan,
      });
    }
  }
  return result;
}

function _buildLabel(shaftMul, ji) {
  if (shaftMul === 1) return `${ji[0]}/${ji[1]}`;
  const num = shaftMul * ji[0];
  const den = ji[1];
  const g = _gcd(Math.round(num * 1000), Math.round(den * 1000));
  const n = Math.round(num * 1000 / g);
  const d = Math.round(den * 1000 / g);
  return `${n}/${d}`;
}

function _ratioToLabel(r) {
  const candidates = [
    [1,1],[9,8],[5,4],[4,3],[3,2],[5,3],[15,8],
    [2,1],[9,4],[5,2],[8,3],[3,1],[10,3],[7,2],[4,1],
    [1,2],[2,3],[3,4],[4,5],[8,9],[6,1],[7,1],[8,1],
  ];
  for (const [n, d] of candidates) {
    if (Math.abs(r - n/d) < 0.001) return `${n}/${d}`;
  }
  return r % 1 === 0 ? `${r}/1` : r.toFixed(3);
}

function _gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}


// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONTROLS — all panel faders
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONTROLS = {
  // AMPLITUDE
  rmsFast:      0.0,
  rmsMid:       0.0,
  rmsSlow:      0.5,
  rmsAdaptive:  0.5,
  amDepth:      0.3,
  range:        0.6,

  // MORPHOLOGY
  harmonicRange:    0.5,    // base harmonic extent (×2/×½ always, ×3/×4 fade in)
  sensitivity:      0.4,    // base crossfade steepness (overtone/undertone switching)
  slopeDepth:       0.4,    // └ slope directional bias (rise→overt steeper, fall→under)
  complexityDepth:  0.5,    // └ complexity certainty (predictable→narrow, chaotic→wide)

  // FREQUENCY
  focus:           0.5,     // 0=centroid (global), 1=selected band power (targeted)
  mobilityDepth:   0.3,     // └ slew rate (low mob=slow glide, high mob=fast track)
  bandwidthSpread: 0.0,     // spectral sideband spread
  entropyDepth:    0.0,     // └ entropy certainty (predictable→narrow, chaotic→wide)

  // DETECTION
  ppafThreshold:   0.5,     // 0=20µV (most sensitive) → 1=500µV (high threshold, fewer events)
  fluxSensitivity: 0.0,     // 0=off → 1=sensitive (normalized threshold)
  refractoryMs:    40,      // min inter-event gap (ms)
  detectionLevel:  0.7,     // overall intensity (scales all excitation)
  saturation:      0.5,     // preShaperGain spike + curve bump intensity
  noiseMix:        0.4,     // pitched noise burst level
  noiseAttackMs:   15,      // envelope attack (ms) — magnitude shortens this
  noiseDecayMs:    80,      // envelope decay (ms) — magnitude lengthens this

  // OUTPUT
  activityGate: 0.3,
  drive:        0.0,
  intensity:    0.0,     // 0=percentile-normalized, 1=absolute µV scaling
  masterVolume: 0.7,
};


// ─────────────────────────────────────────────────────────────────────────────
// CONTROLS → SYNTH PARAMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map user-facing faders to internal synthesis parameters.
 *
 * Every panel fader gets translated to a synthesis-ready value here.
 * Curve builders and the engine scheduler read from this object only —
 * they never touch the raw controls.
 */
export function mapControls(controls = {}) {
  const c = { ...DEFAULT_CONTROLS, ...controls };

  return {
    // ── AMPLITUDE ──────────────────────────────────────────────
    rmsMix: {
      fast:     c.rmsFast,
      mid:      c.rmsMid,
      slow:     c.rmsSlow,
      adaptive: c.rmsAdaptive,
    },
    amDepth:      c.amDepth,
    ampFloor:     0.02 * (1 - c.range),     // quiet floor shrinks as range increases
    ampCeiling:   0.08 + 0.32 * c.range,    // loud ceiling grows with range

    // ── MORPHOLOGY ─────────────────────────────────────────────
    harmonicRange:    c.harmonicRange,
    sensitivity:      c.sensitivity,
    slopeDepth:       c.slopeDepth,       // directional bias: rise→overt, fall→under
    complexityDepth:  c.complexityDepth,  // certainty: predictable→narrow, chaotic→wide

    // ── FREQUENCY ──────────────────────────────────────────────
    focus:           c.focus,            // 0=centroid, 1=selected band power
    fmDepthScale:    6.0,                // fixed max FM index (6× pitch)
    mobilityDepth:   c.mobilityDepth,    // sub: slew rate
    bandwidthSpread: c.bandwidthSpread * 2.0,
    entropyDepth:    c.entropyDepth,

    // ── DETECTION ──────────────────────────────────────────────
    // Logarithmic µV threshold: fader 0 → 20µV (sensitive/many), fader 1 → 500µV (few events)
    ppafThresholdUV: 20 * Math.pow(25, c.ppafThreshold),
    // Flux: normalized threshold (0=off, lower=more sensitive)
    fluxThreshold:   0.85 - c.fluxSensitivity * 0.70,
    refractoryMs:    c.refractoryMs,
    detectionLevel:  c.detectionLevel,
    embeddedMix:     c.saturation,        // curve bump intensity (scheduler reads this for drive spikes too)
    saturationMix:   c.saturation,        // alias — both names used across scheduler/inject
    noiseMix:        c.noiseMix,          // noise burst level (0=none, 1=prominent)
    noiseAttackMs:   c.noiseAttackMs,     // noise burst attack (ms)
    noiseDecayMs:    c.noiseDecayMs,      // noise burst decay (ms)
    // Gaussian bump window widths (fixed, not user-facing)
    ppafBumpWidth:   8,    // ±8 frames at 60Hz ≈ ±133ms
    fluxBumpWidth:   6,    // ±6 frames at 60Hz ≈ ±100ms

    // ── OUTPUT ─────────────────────────────────────────────────
    activityGate:  c.activityGate,
    drive:         c.drive,
    intensity:     c.intensity,    // 0=normalized, 1=absolute voltage scaling
    masterVolume:  c.masterVolume,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: sample feature at automation rate
// ─────────────────────────────────────────────────────────────────────────────

function _at(featureArray, frame, featureLen, nFrames) {
  if (!featureArray || featureLen === 0) return 0;
  const idx = Math.floor(frame * featureLen / nFrames);
  return featureArray[Math.min(idx, featureLen - 1)] ?? 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// MASTER AMPLITUDE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE amplitude curve. All layers multiply against this for energy.
 *
 * Pipeline:
 *   1. Weighted blend of 4 RMS windows (fast/mid/slow/adaptive)
 *   2. Hilbert envelope AM rides on top (tremolo texture)
 *   3. Dynamic range scaling to [ampFloor, ampCeiling]
 *
 * The RMS faders control temporal resolution:
 *   fastRMS  (50ms)   — individual burst tracking
 *   midRMS   (250ms)  — oscillatory energy (BIOPAC standard)
 *   slowRMS  (1500ms) — seizure-level contour
 *   adaptive          — band-power-driven auto-blend
 */
export function buildMasterAmplitude(features, params, durSec) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const len     = features.slowRMS?.length ?? features.fastRMS?.length ?? 0;

  const wF = params.rmsMix.fast;
  const wM = params.rmsMix.mid;
  const wS = params.rmsMix.slow;
  const wA = params.rmsMix.adaptive;
  const totalW = wF + wM + wS + wA;
  const norm = totalW > 0.001 ? 1 / totalW : 1;
  const fallback = totalW < 0.001;

  const amD   = params.amDepth;
  const floor = params.ampFloor;
  const range = params.ampCeiling - floor;

  for (let i = 0; i < nFrames; i++) {
    const fast = _at(features.fastRMS,     i, len, nFrames);
    const mid  = _at(features.midRMS,      i, len, nFrames);
    const slow = _at(features.slowRMS,     i, len, nFrames);
    const adap = _at(features.adaptiveRMS, i, len, nFrames);
    const env  = _at(features.envelope,    i, len, nFrames);

    // 1. Weighted RMS blend
    const rms = fallback
      ? (features.adaptiveRMS ? adap : slow)  // fallback chain: adaptive → slow
      : (fast * wF + mid * wM + slow * wS + adap * wA) * norm;

    // 2. Hilbert envelope AM (tremolo riding on RMS contour)
    const am = rms * (1 - amD) + rms * env * amD;

    // 3. Dynamic range scaling
    curve[i] = Math.max(0.001, floor + am * range);
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY CURVE (line length → master gate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activity gate from line length.
 * activityGate=0 → always open (1.0).
 * activityGate=1 → strict gating (quiet when line length is low).
 * Multiplied into ALL layer curves.
 */
export function buildActivityCurve(features, params, durSec) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const len     = features.lineLength?.length ?? 0;

  if (len === 0 || params.activityGate <= 0.001) {
    curve.fill(1.0);
    return curve;
  }

  const gate = params.activityGate;

  for (let i = 0; i < nFrames; i++) {
    const ll    = _at(features.lineLength, i, len, nFrames);
    const floor = 1.0 - gate;
    curve[i] = Math.min(1.0, floor + (1.0 - floor) * ll * ll);
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1: Root Amplitude
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Root sine amplitude = masterAmp × activityCurve.
 * The root's loudness IS the master amplitude. Nothing else.
 */
export function buildRootAmpCurve(masterAmp, activityCurve) {
  const n = masterAmp.length;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    curve[i] = Math.max(0.001, masterAmp[i] * activityCurve[i]);
  }
  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2: Morphology — Per-Overtone Gain Curves
//
// Five curves, one per harmonic oscillator:
//   over2Curve  (×2 overtone — octave)
//   over3Curve  (×3 overtone — fifth+octave)
//   over4Curve  (×4 overtone — two octaves)
//   under05Curve (×½ undertone — sub-octave)
//   under23Curve (×⅔ undertone — sub-fifth)
//
// Two faders control the morphology:
//   RANGE       — base harmonic extent (which oscillators are active)
//                 modulated by SLOPE ASYMMETRY (sharp transients widen range)
//   SENSITIVITY — crossfade steepness (how hard the polarity switching is)
//                 modulated by COMPLEXITY (chaotic = more reactive)
//
// All curves derive amplitude from masterAmp (unified energy).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build per-overtone gain curves for the morphology layer.
 *
 * Returns an object with 5 Float32Arrays:
 *   { over2, over3, over4, under05, under23 }
 *
 * Each curve = polarityCrossfade × rangeRolloff × masterAmp × activityCurve
 *
 * Range rolloff per oscillator (how far into the series):
 *   ×2 and ×½:  always active once range > 0 (nearest harmonics)
 *   ×3 and ×⅔:  fade in as effectiveRange passes 0.33
 *   ×4:         fades in as effectiveRange passes 0.66
 *
 * effectiveRange = baseRange + slopeAsymmetry × slopeDepth
 *   Sharp voltage transients momentarily widen the range (more overtones)
 *   Smooth oscillations keep the range narrow (fewer, warmer overtones)
 *
 * Sensitivity (crossfade steepness):
 *   Low sensitivity → gentle crossfade, both banks play moderately
 *   High sensitivity → hard switching per sample (overtones OR undertones)
 *   Modulated by complexity: chaotic signal = steeper crossfade
 *
 * @param {object} features
 * @param {Float32Array} masterAmp
 * @param {object} params
 * @param {Float32Array} activityCurve
 * @returns {{ over2: Float32Array, over3: Float32Array, over4: Float32Array,
 *             under05: Float32Array, under23: Float32Array }}
 */
export function buildMorphologyCurves(features, masterAmp, params, activityCurve) {
  const nFrames   = masterAmp.length;
  const sigLen    = features.cleanSignal?.length ?? 0;
  const cpxLen    = features.complexity?.length ?? 0;
  const slopeLen  = features.slopeAsymmetry?.length ?? 0;
  const ceiling   = features.calibration?.ampCeiling || 1;

  const baseSteepness   = params.sensitivity * 4.0;
  const slopeDepth      = params.slopeDepth;
  const complexityDepth = params.complexityDepth;

  // Glide smoothing: high sensitivity = fast reactive crossfade,
  // low sensitivity = slow glide between states (registers feel legato).
  // At sensitivity=1: smoothing=0.30 (fast)
  // At sensitivity=0: smoothing=0.95 (very slow glide)
  const glideSmoothing = 0.95 - params.sensitivity * 0.65;

  const over2   = new Float32Array(nFrames);
  const over3   = new Float32Array(nFrames);
  const over4   = new Float32Array(nFrames);
  const under05 = new Float32Array(nFrames);
  const under23 = new Float32Array(nFrames);

  // Smoothed crossfade state (persists across frames)
  let smoothedOver  = 0;
  let smoothedUnder = 0;

  for (let i = 0; i < nFrames; i++) {
    const voltage = _at(features.cleanSignal,    i, sigLen,   nFrames);
    const cpx     = _at(features.complexity,     i, cpxLen,   nFrames);
    const slope   = _at(features.slopeAsymmetry, i, slopeLen, nFrames);
    const energy  = masterAmp[i] * activityCurve[i];

    // ── RANGE + COMPLEXITY ─────────────────────────────────────────
    // Complexity as certainty: predictable → narrow, chaotic → wide.
    // cpx=0 (organized seizure) → range narrows below base setting.
    // cpx=1 (chaotic baseline) → range widens above base setting.
    // complexityDepth=0 → complexity has no effect on range.
    const cpxMod = 1.0 + (cpx - 0.5) * complexityDepth * 2.0;
    const effectiveRange = Math.max(0, Math.min(1, params.harmonicRange * cpxMod));

    // Soft sigmoid rolloff — all overtones present at lower range values.
    // ×2/×½: full presence quickly (sigmoid centered at 0.15)
    // ×3/×⅔: fades in from range ~0.2 (sigmoid centered at 0.35)
    // ×4:    fades in from range ~0.35 (sigmoid centered at 0.50)
    // At range=0.5 (default): ×2≈1.0, ×3≈0.82, ×4≈0.50
    const r2  = 1.0 / (1.0 + Math.exp(-12 * (effectiveRange - 0.15)));
    const r3  = 1.0 / (1.0 + Math.exp(-10 * (effectiveRange - 0.35)));
    const r4  = 1.0 / (1.0 + Math.exp(-10 * (effectiveRange - 0.50)));
    const r05 = r2;
    const r23 = r3;

    // ── SENSITIVITY + SLOPE ────────────────────────────────────────
    // Slope as directional bias: fast rise → overtone crossfade
    // steepens; fast fall → undertone crossfade steepens.
    // slopeBias ∈ [-1,+1]: +1 = sharp rise, -1 = sharp fall.
    // slopeDepth=0 → both sides equal (symmetric crossfade).
    const slopeBias = (slope - 0.5) * 2.0 * slopeDepth;
    const overSteepness  = baseSteepness * (1.0 + Math.max(0,  slopeBias));
    const underSteepness = baseSteepness * (1.0 + Math.max(0, -slopeBias));

    const normV = voltage / Math.max(ceiling, 1e-6);

    // Raw crossfade from voltage polarity
    const rawOver  = Math.max(0, Math.tanh( normV * overSteepness));
    const rawUnder = Math.max(0, Math.tanh(-normV * underSteepness));

    // Smooth glide between states (one-pole lowpass)
    // The crossfade now GLIDES like a singer shifting registers.
    smoothedOver  = smoothedOver  * glideSmoothing + rawOver  * (1 - glideSmoothing);
    smoothedUnder = smoothedUnder * glideSmoothing + rawUnder * (1 - glideSmoothing);

    // Both banks at moderate level when sensitivity is near zero
    const neutralBase = params.sensitivity < 0.01 ? 0.5 : 0;

    // ── FINAL PER-OSCILLATOR GAINS ─────────────────────────────────
    over2[i]   = Math.max(0.001, (neutralBase + smoothedOver)  * r2  * energy);
    over3[i]   = Math.max(0.001, (neutralBase + smoothedOver)  * r3  * energy);
    over4[i]   = Math.max(0.001, (neutralBase + smoothedOver)  * r4  * energy);
    under05[i] = Math.max(0.001, (neutralBase + smoothedUnder) * r05 * energy);
    under23[i] = Math.max(0.001, (neutralBase + smoothedUnder) * r23 * energy);
  }

  return { over2, over3, over4, under05, under23 };
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3: Frequency — FM Synthesis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FM modulation index curve (in Hz).
 *
 * Four features drive the modulation:
 *   Spectral Centroid → base FM depth (brightness → richness)
 *   Hjorth Mobility   → FM jitter (frequency instability → roughness)
 *   Perm. Entropy     → FM perturbation (predictability → stability)
 *   Spectral Bandwidth → FM sideband spread (narrow → tonal, wide → noisy)
 *
 * FM index is a SPECTRAL property — it determines WHAT the sound sounds like.
 * The FM carrier's OUTPUT level is gated by masterAmp (in fmAmpCurve),
 * but the modulation DEPTH here is NOT amplitude-gated.
 * Activity curve still gates it (no FM during silence).
 */
export function buildFMIndexCurve(features, params, durSec, pitchHz, activityCurve) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const centLen = features.centroid?.length ?? 0;
  const mobLen  = features.mobility?.length ?? 0;
  const entLen  = features.permEntropy?.length ?? 0;
  const bwLen   = features.spectralBandwidth?.length ?? 0;
  const bpLen   = features.selectedBandPower?.length ?? centLen;

  const maxIndex = params.fmDepthScale * pitchHz;
  const focus    = params.focus ?? 0.5;   // 0=centroid, 1=selected band power
  const mobDepth = params.mobilityDepth;
  const bwSpread = params.bandwidthSpread;
  const entDepth = params.entropyDepth;

  let prevIndex = 0;

  for (let i = 0; i < nFrames; i++) {
    const cent    = _at(features.centroid,          i, centLen, nFrames);
    const bandPow = _at(features.selectedBandPower, i, bpLen,   nFrames);
    const mob     = _at(features.mobility,          i, mobLen,  nFrames);
    const ent     = _at(features.permEntropy,       i, entLen,  nFrames);
    const bw      = _at(features.spectralBandwidth, i, bwLen,   nFrames);
    const act     = activityCurve ? activityCurve[i] : 1.0;

    // ── FOCUS BLEND ──────────────────────────────────────────
    // 0 = centroid (global spectral picture)
    // 1 = selected band power (targeted, tracks Source selection)
    const spectralDrive = cent * (1 - focus) + bandPow * focus;
    const rawIndex = spectralDrive * maxIndex;

    // ── MOBILITY → SLEW RATE ─────────────────────────────────
    // NOT jitter. Temporal resolution of FM changes.
    // Low mobility → heavy smoothing → FM glides slowly.
    // High mobility → light smoothing → FM tracks instantly.
    // mobDepth=0 → no smoothing (instant response regardless of signal).
    const smoothing = (1.0 - mob) * mobDepth * 0.95;
    const smoothedIndex = i === 0
      ? rawIndex
      : prevIndex * smoothing + rawIndex * (1 - smoothing);
    prevIndex = smoothedIndex;

    // ── BANDWIDTH + ENTROPY → SIDEBAND SPREAD ────────────────
    // Entropy as certainty: predictable → narrow, chaotic → wide.
    // certaintyScale ∈ [0.5, 1.5]; at entDepth=0, effectiveBW = bw.
    const certaintyScale = 0.5 + ent;
    const effectiveBW = bw * (1.0 - entDepth + certaintyScale * entDepth);
    const bandwidthScale = 1.0 + effectiveBW * bwSpread;

    // ── COMBINED ─────────────────────────────────────────────
    curve[i] = smoothedIndex * bandwidthScale * act;
  }

  return curve;
}


/**
 * FM carrier output amplitude curve.
 * Follows masterAmp × activityCurve — same loudness as root.
 * FM CHARACTER (index from centroid/mobility/entropy/bandwidth) varies.
 * FM LOUDNESS does not vary independently.
 */
/**
 * @param {Float32Array} masterAmp
 * @param {Float32Array} activityCurve
 * @param {Float32Array} fmIndexCurve — used for loudness compensation
 * @param {number} maxIndex — fmDepthScale × pitchHz
 */
export function buildFMAmpCurve(masterAmp, activityCurve, fmIndexCurve, maxIndex) {
  const n = masterAmp.length;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // FM index compensation: more sidebands = more perceived energy.
    // Reduce output gain as index grows so loudness stays perceptually constant.
    // At indexNorm=0: compensation=1.0 (full level)
    // At indexNorm=1: compensation=0.4 (tamed)
    const indexNorm  = maxIndex > 0 ? Math.abs(fmIndexCurve[i]) / maxIndex : 0;
    const compensation = 1.0 / (1.0 + indexNorm * 1.5);
    curve[i] = Math.max(0.001, masterAmp[i] * activityCurve[i] * compensation);
  }
  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// DISTORTION CURVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-channel WaveShaper transfer function from signal statistics.
 *
 * Reads pre-computed kurtosis and skewness from features.signalStats
 * (computed once in dsp.js — no redundant calculation).
 *
 * Kurtosis → waveshaper hardness (spiky tissue = hard clipping).
 * Skewness → even/odd harmonic balance (asymmetric = even harmonics).
 * Drive fader → wet/dry blend (0 = bypass, 1 = full distortion).
 *
 * Returns Float32Array(256) for WaveShaperNode.curve, or null if drive=0.
 */
export function computeDistortionCurve(features, drive) {
  if (drive < 0.001) return null;

  // Read pre-computed stats from dsp.js
  const kurtosis = features.signalStats?.kurtosis ?? 0;
  const skewness = features.signalStats?.skewness ?? 0;

  const size = 256;
  const curve = new Float32Array(size);

  // Kurtosis maps to hardness: excess kurtosis > 0 = peaked = harder clipping
  // Range roughly [-1, +10], mapped to [0, 1]
  const hardness = Math.max(0, Math.min(1, (kurtosis + 1) / 8));

  // Skewness maps to asymmetry: positive skew = positive half clips harder
  const asymmetry = Math.tanh(skewness * 0.4);

  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;  // [-1, 1]

    // Soft saturation (tanh)
    const soft = Math.tanh(x * (1 + drive * 4));
    // Hard clipping
    const hard = Math.max(-1, Math.min(1, x * (1 + drive * 8)));

    // Blend soft/hard based on tissue kurtosis
    let y = soft * (1 - hardness) + hard * hardness;

    // Asymmetric component from skewness (adds even harmonics)
    y += asymmetry * drive * 0.2 * (1 - x * x);

    // Wet/dry blend
    curve[i] = x * (1 - drive) + y * drive;
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// DETECTION — Event detection + curve excitation injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect PPAF and directional flux events from raw features.
 *
 * PPAF events use an absolute µV threshold — same threshold behaves
 * consistently across recordings regardless of baseline amplitude.
 * Flux events use a normalized threshold against spectralFlux [0,1].
 *
 * Returns continuous excitation magnitudes (no tiers):
 *   excitation = how far above threshold, clamped [0, 1]
 *   direction  = +1 (spectrum brightened) or -1 (darkened), flux only
 *
 * @param {object} features — must include ppafRaw, spectralFlux, directionalFlux
 * @param {object} params   — from mapControls
 * @param {number} fs       — sample rate
 * @returns {Array<{sampleIndex, timeSec, type, excitation, direction?}>}
 */
export function detectEvents(features, params, fs) {
  const events = [];
  const refractorySamples = Math.floor(fs * params.refractoryMs / 1000);

  // ── PPAF events (amplitude discharges) ──────────────────────────
  const ppafRaw = features.ppafRaw;
  if (ppafRaw && params.ppafThresholdUV > 0) {
    const thresh = params.ppafThresholdUV;
    let lastSample = -refractorySamples;

    for (let i = 0; i < ppafRaw.length; i++) {
      const excess = ppafRaw[i] - thresh;
      if (excess > 0 && i - lastSample >= refractorySamples) {
        events.push({
          sampleIndex: i,
          timeSec:     i / fs,
          type:        'ppaf',
          excitation:  Math.min(1.0, excess / thresh),
        });
        lastSample = i;
      }
    }
  }

  // ── Directional flux events (spectral transitions) ───────────────
  const normFlux = features.spectralFlux;
  const dirFlux  = features.directionalFlux;
  if (normFlux && dirFlux && params.fluxThreshold < 0.84) {
    const thresh = params.fluxThreshold;
    let lastSample = -refractorySamples;

    for (let i = 0; i < normFlux.length; i++) {
      const excess = normFlux[i] - thresh;
      if (excess > 0 && i - lastSample >= refractorySamples) {
        events.push({
          sampleIndex: i,
          timeSec:     i / fs,
          type:        'flux',
          excitation:  Math.min(1.0, excess / (1 - thresh + 0.01)),
          direction:   dirFlux[i] >= 0 ? 1 : -1,
        });
        lastSample = i;
      }
    }
  }

  events.sort((a, b) => a.timeSec - b.timeSec);
  return events;
}


/**
 * Inject gaussian excitation bumps into existing automation curves in-place.
 *
 * Called after all curves are built. Modifies curves additively —
 * the curves are later clamped to valid ranges by setValueCurveAtTime.
 *
 * PPAF events perturb: rootAmpCurve (louder) + all morphology curves
 *   (harmonic flash) + fmIndex (timbral flare).
 * Flux events perturb: fmIndex only, DIRECTIONALLY (up=brighter, down=darker).
 *
 * @param {{ rootAmpCurve, morphology, fmIndexCurve }} curves
 * @param {Array} events  — from detectEvents()
 * @param {object} params — from mapControls
 * @param {number} durSec
 */
export function injectTransientExcitation(curves, events, params, durSec) {
  const nFrames    = curves.rootAmpCurve.length;
  const level      = params.detectionLevel;
  const embeddedMix = params.embeddedMix ?? 1.0;
  if (level < 0.001 || embeddedMix < 0.001 || events.length === 0) return;

  for (const ev of events) {
    const centerFrame = Math.round(ev.timeSec / durSec * nFrames);
    if (centerFrame < 0 || centerFrame >= nFrames) continue;

    const excStrength = ev.excitation * level;   // event strength for width/shape
    const exc = excStrength * embeddedMix;         // scaled for curve magnitude

    if (ev.type === 'ppaf') {
      // Width scales with event strength — large spike = sustained flare, small = brief flash.
      // excStrength=0 → width × 0.5 (brief), excStrength=1 → width × 1.0 (full)
      const rangeW = Math.ceil(params.ppafBumpWidth * (0.5 + excStrength * 0.5));
      const emb    = exc;

      // NO rootAmpCurve bump — amplitude already tracks the spike via RMS.
      // Embedding adds CHARACTER (timbre), not loudness. Louder is Amplitude's job.

      // Morphology: MULTIPLICATIVE timbral brightening.
      // Higher overtones get bigger boosts — spikes are broadband, emphasize upper partials.
      _multiplyGaussianBump(curves.morphology.over2,   centerFrame, rangeW, emb * 2.0, nFrames);
      _multiplyGaussianBump(curves.morphology.over3,   centerFrame, rangeW, emb * 2.5, nFrames);
      _multiplyGaussianBump(curves.morphology.over4,   centerFrame, rangeW, emb * 3.0, nFrames);
      _multiplyGaussianBump(curves.morphology.under05, centerFrame, rangeW, emb * 2.0, nFrames);
      _multiplyGaussianBump(curves.morphology.under23, centerFrame, rangeW, emb * 2.5, nFrames);

      // FM: spectral complexity spikes
      _addGaussianBump(curves.fmIndexCurve, centerFrame, rangeW, emb * 0.5, nFrames);

    } else if (ev.type === 'flux') {
      // FM only, signed: upward shift brightens, downward darkens.
      _addGaussianBump(curves.fmIndexCurve, centerFrame, params.fluxBumpWidth,
        exc * 0.5 * ev.direction, nFrames);
    }
  }
}


/**
 * Add a gaussian bump to a Float32Array at a given frame, in-place.
 * magnitude can be negative (for downward flux FM dips).
 */
function _addGaussianBump(curve, center, halfWidth, magnitude, nFrames) {
  const sigma2 = (halfWidth / 2.5) ** 2 * 2;
  const lo = Math.max(0, center - halfWidth);
  const hi = Math.min(nFrames - 1, center + halfWidth);
  for (let i = lo; i <= hi; i++) {
    const d = i - center;
    curve[i] += magnitude * Math.exp(-(d * d) / sigma2);
  }
}

/**
 * Multiply a gaussian bump onto a Float32Array at a given frame, in-place.
 * boostFactor=1.0 → curve doubles at peak (100% boost).
 * boostFactor=2.0 → curve triples at peak.
 * Active tissue gets overdriven harder than quiet tissue — physically correct.
 */
function _multiplyGaussianBump(curve, center, halfWidth, boostFactor, nFrames) {
  const sigma2 = (halfWidth / 2.5) ** 2 * 2;
  const lo = Math.max(0, center - halfWidth);
  const hi = Math.min(nFrames - 1, center + halfWidth);
  for (let i = lo; i <= hi; i++) {
    const d = i - center;
    const g = Math.exp(-(d * d) / sigma2);
    curve[i] *= (1.0 + boostFactor * g);
  }
}