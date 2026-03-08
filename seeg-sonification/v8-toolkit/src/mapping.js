/**
 * mapping.js — Feature → Synthesis Parameter Mapping (v8.2)
 *
 * COMPREHENSIVE REWRITE — 11 faders, organized by synthesis layer.
 *
 * Fader groups:
 *   ENERGY   — rootVolume, amDepth, range
 *   HARMONICS — harmonicDepth, fmDepth, fmJitter
 *   CHARACTER — drive (per-channel distortion from tissue statistics)
 *   TRANSIENTS — spikeSensitivity, clickVolume
 *   MASTER    — activityGate (line length threshold), masterVolume
 *
 * Curves built per channel (Float32Array at AUTOMATION_RATE Hz):
 *   rootAmpCurve     — Layer 1: root sine amplitude
 *   overCurve        — Layer 2: overtone bank gain
 *   underCurve       — Layer 2: undertone bank gain
 *   fmIndexCurve     — Layer 3: FM modulation depth (Hz)
 *   fmAmpCurve       — Layer 3: FM carrier output level
 *   activityCurve    — Master: line-length-derived gate (multiplied into all layers)
 *
 * Per-channel (computed once, not a curve):
 *   distortionCurve  — WaveShaper transfer function (Float32Array, 256 points)
 *
 * Exports:
 *   AUTOMATION_RATE
 *   DEFAULT_MASTER_TUNE
 *   DEFAULT_CONTROLS
 *   assignPitches(channels, masterTune, ratioOverrides)
 *   mapControls(controls)
 *   buildActivityCurve(features, params, durSec)
 *   buildRootAmpCurve(features, params, durSec, activityCurve)
 *   buildOverCurve(features, params, durSec, activityCurve)
 *   buildUnderCurve(features, params, durSec, activityCurve)
 *   buildFMIndexCurve(features, params, durSec, pitchHz, activityCurve)
 *   buildFMAmpCurve(features, params, durSec, activityCurve)
 *   computeDistortionCurve(features, drive)
 */


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const AUTOMATION_RATE = 60;
export const DEFAULT_MASTER_TUNE = 130.0;

// Just-intonation ratios for contacts within a shaft.
const JI_TABLE = [
  [1,1], [9,8], [5,4], [4,3], [3,2], [5,3], [15,8],
  [2,1], [9,4], [5,2], [8,3], [3,1], [10,3], [7,2], [4,1],
];

// Shaft spacing ratios (perfect fifths, wrapping down)
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

/**
 * Assign a ratio and pan to each channel based on shaft grouping.
 *
 * Within a shaft: contacts get successive JI ratios.
 * Between shafts: bases are spaced by perfect fifths (×3/2).
 * Left-hemisphere shafts pan left, right-hemisphere pan right.
 *
 * Returns a Map where each entry has:
 *   ratio      — numeric multiplier relative to masterTune
 *   ratioLabel — human-readable fraction string (e.g. "3/2")
 *   hz         — masterTune × ratio
 *   pan        — stereo position [-1, 1]
 *
 * @param {Array<{label: string, shaft: string}>} channels
 * @param {number} [masterTune=DEFAULT_MASTER_TUNE]
 * @param {Map<string, number>} [ratioOverrides] — label → ratio (user edits)
 * @returns {Map<string, {ratio: number, ratioLabel: string, hz: number, pan: number}>}
 */
export function assignPitches(channels, masterTune = DEFAULT_MASTER_TUNE, ratioOverrides = null) {
  const result = new Map();

  // Group by shaft
  const shafts = new Map();
  for (const ch of channels) {
    const key = ch.shaft || ch.label;
    if (!shafts.has(key)) shafts.set(key, []);
    shafts.get(key).push(ch.label);
  }

  const shaftNames = [...shafts.keys()];

  for (let si = 0; si < shaftNames.length; si++) {
    const name    = shaftNames[si];
    const labels  = shafts.get(name);
    const shaftMul = SHAFT_RATIOS[si % SHAFT_RATIOS.length];

    // Pan: L-prefix → left, R-prefix → right, else center
    const first = name.charAt(0).toUpperCase();
    let pan = 0;
    if (first === 'L') pan = -0.3 - (si * 0.05);
    else if (first === 'R') pan = 0.3 + (si * 0.05);
    pan = Math.max(-1, Math.min(1, pan));

    for (let ci = 0; ci < labels.length; ci++) {
      const ji = JI_TABLE[ci % JI_TABLE.length];
      const contactRatio = ji[0] / ji[1];
      const fullRatio = shaftMul * contactRatio;

      // Check for user override
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

/** Build a fraction label like "3/2" or "27/16" (shaft×contact). */
function _buildLabel(shaftMul, ji) {
  if (shaftMul === 1) return `${ji[0]}/${ji[1]}`;
  const num = shaftMul * ji[0];
  const den = ji[1];
  const g = _gcd(Math.round(num * 1000), Math.round(den * 1000));
  const n = Math.round(num * 1000 / g);
  const d = Math.round(den * 1000 / g);
  return `${n}/${d}`;
}

/** Approximate a decimal ratio to the nearest simple fraction label. */
function _ratioToLabel(r) {
  const candidates = [
    [1,1],[9,8],[5,4],[4,3],[3,2],[5,3],[15,8],
    [2,1],[9,4],[5,2],[8,3],[3,1],[10,3],[7,2],[4,1],
    [1,2],[2,3],[3,4],[4,5],[8,9],
    [6,1],[7,1],[8,1],
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
// CONTROLS → SYNTH PARAMS (11 faders)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default control values — exported so UI can initialize faders.
 */
export const DEFAULT_CONTROLS = {
  // ENERGY
  rootVolume: 0.7,
  amDepth:    0.3,
  range:      0.6,

  // HARMONICS
  harmonicDepth: 0.4,
  fmDepth:       0.5,
  fmJitter:      0.3,

  // CHARACTER
  drive: 0.0,

  // TRANSIENTS
  spikeSensitivity: 0.4,
  clickVolume:      0.5,

  // MASTER
  activityGate: 0.3,
  masterVolume: 0.7,
};


/**
 * Map 11 user-facing faders to internal synthesis parameters.
 *
 * @param {object} controls — fader values (0–1 each)
 * @returns {object} synthParams
 */
export function mapControls(controls = {}) {
  const c = { ...DEFAULT_CONTROLS, ...controls };

  return {
    // ENERGY — Layer 1
    rootGain:     c.rootVolume * 0.40,
    amDepth:      c.amDepth,
    ampFloor:     0.02 * (1 - c.range),
    ampCeiling:   0.08 + 0.32 * c.range,

    // HARMONICS — Layers 2 & 3
    harmonicDepth: c.harmonicDepth * 0.50,
    fmDepthScale:  c.fmDepth * 6.0,
    fmJitter:      c.fmJitter,
    fmAmpScale:    0.05 + 0.35 * c.fmDepth,

    // CHARACTER
    drive: c.drive,

    // TRANSIENTS — Layer 4
    spikeThreshold: 0.85 - c.spikeSensitivity * 0.70,
    transientGain:  0.2 + c.clickVolume * 1.6,

    // MASTER
    activityGate:  c.activityGate,
    masterVolume:  c.masterVolume,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: sample feature at automation rate
// ─────────────────────────────────────────────────────────────────────────────

function _at(featureArray, frame, featureLen, nFrames) {
  const idx = Math.floor(frame * featureLen / nFrames);
  return featureArray[Math.min(idx, featureLen - 1)] ?? 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY CURVE (line length → master gate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the activity gate curve from line length.
 *
 * At activityGate=0, the curve is all 1.0 (always open).
 * At activityGate=1, the curve follows line length strictly.
 * This curve is multiplied into ALL other layer curves.
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
    const ll = _at(features.lineLength, i, len, nFrames);
    const floor  = 1.0 - gate;
    const gateVal = floor + (1.0 - floor) * ll * ll;
    curve[i] = Math.min(1.0, gateVal);
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1: Root + AM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Root sine amplitude curve.
 * slowRMS sets the energy contour. Hilbert envelope adds tremolo (AM).
 * Activity gate multiplied in. Dynamic range controls floor/ceiling.
 */
export function buildRootAmpCurve(features, params, durSec, activityCurve) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const len     = features.slowRMS.length;

  const { rootGain, amDepth, ampFloor, ampCeiling } = params;

  for (let i = 0; i < nFrames; i++) {
    const slow = _at(features.slowRMS,  i, len, nFrames);
    const env  = _at(features.envelope, i, len, nFrames);
    const act  = activityCurve ? activityCurve[i] : 1.0;

    const base = slow * (1 - amDepth) + slow * env * amDepth;
    const amp = ampFloor + base * (ampCeiling - ampFloor);
    curve[i] = amp * rootGain * act;
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2: Phase Harmonics (CORRECTED — uses signed voltage, not Hilbert phase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Overtone bank gain curve.
 * Uses the signed voltage (cleanSignal) normalized by ampCeiling.
 * Positive voltage → overtones rise.
 * Gated by envelope and activity curve.
 */
export function buildOverCurve(features, params, durSec, activityCurve) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const sigLen  = features.cleanSignal.length;
  const envLen  = features.envelope.length;
  const depth   = params.harmonicDepth;
  const ceiling = features.calibration.ampCeiling || 1;

  for (let i = 0; i < nFrames; i++) {
    const voltage = _at(features.cleanSignal, i, sigLen, nFrames);
    const env     = _at(features.envelope, i, envLen, nFrames);
    const act     = activityCurve ? activityCurve[i] : 1.0;

    const normV = voltage / Math.max(ceiling, 1e-6);
    const blend = 0.5 + 0.5 * Math.tanh(normV * 2.0);

    curve[i] = blend * env * depth * act;
  }

  return curve;
}


/**
 * Undertone bank gain curve.
 * Mirror of overCurve: negative voltage → undertones rise.
 */
export function buildUnderCurve(features, params, durSec, activityCurve) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const sigLen  = features.cleanSignal.length;
  const envLen  = features.envelope.length;
  const depth   = params.harmonicDepth;
  const ceiling = features.calibration.ampCeiling || 1;

  for (let i = 0; i < nFrames; i++) {
    const voltage = _at(features.cleanSignal, i, sigLen, nFrames);
    const env     = _at(features.envelope, i, envLen, nFrames);
    const act     = activityCurve ? activityCurve[i] : 1.0;

    const normV = voltage / Math.max(ceiling, 1e-6);
    const blend = 0.5 + 0.5 * Math.tanh(normV * 2.0);

    curve[i] = (1 - blend) * env * depth * act;
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3: FM / Centroid
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FM modulation index curve (in Hz).
 * Centroid drives base depth. Mobility adds jitter (dedicated fader).
 * Activity-gated and envelope-gated.
 */
export function buildFMIndexCurve(features, params, durSec, pitchHz, activityCurve) {
  const nFrames  = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve    = new Float32Array(nFrames);
  const len      = features.centroid.length;

  const maxIndex = params.fmDepthScale * pitchHz;
  const jitter   = params.fmJitter;

  for (let i = 0; i < nFrames; i++) {
    const cent = _at(features.centroid,  i, len, nFrames);
    const mob  = _at(features.mobility,  i, len, nFrames);
    const env  = _at(features.envelope,  i, len, nFrames);
    const act  = activityCurve ? activityCurve[i] : 1.0;

    const instability = 1.0 + mob * jitter;

    curve[i] = cent * instability * maxIndex * env * act;
  }

  return curve;
}


/**
 * FM carrier output amplitude curve.
 * Envelope-gated, activity-gated.
 */
export function buildFMAmpCurve(features, params, durSec, activityCurve) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const len     = features.envelope.length;
  const scale   = params.fmAmpScale;

  for (let i = 0; i < nFrames; i++) {
    const env  = _at(features.envelope, i, len, nFrames);
    const slow = _at(features.slowRMS,  i, len, nFrames);
    const act  = activityCurve ? activityCurve[i] : 1.0;

    curve[i] = (env * 0.6 + slow * 0.4) * scale * act;
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// DISTORTION CURVE (per-channel WaveShaper transfer function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a per-channel distortion curve from signal statistics.
 *
 * Kurtosis → waveshaper hardness (sharp spiky tissue vs smooth).
 * Skewness → even/odd harmonic balance (asymmetric waveforms).
 * Drive fader → blend between clean (linear) and shaped (nonlinear).
 *
 * Returns a Float32Array(256) for WaveShaperNode.curve.
 * At drive=0, returns null (bypass — no distortion node needed).
 */
export function computeDistortionCurve(features, drive) {
  if (drive < 0.001) return null;

  const signal = features.cleanSignal;
  const n = signal.length;

  const step = Math.max(1, Math.floor(n / 10000));
  let sum = 0, count = 0;
  for (let i = 0; i < n; i += step) { sum += signal[i]; count++; }
  const mean = sum / count;

  let sum2 = 0, sum3 = 0, sum4 = 0;
  for (let i = 0; i < n; i += step) {
    const d = signal[i] - mean;
    const d2 = d * d;
    sum2 += d2;
    sum3 += d2 * d;
    sum4 += d2 * d2;
  }
  const variance = sum2 / count;
  const std = Math.sqrt(variance);
  const kurtosis = std > 1e-9 ? (sum4 / count) / (variance * variance) - 3 : 0;
  const skewness = std > 1e-9 ? (sum3 / count) / (std * std * std) : 0;

  const size = 256;
  const curve = new Float32Array(size);

  const hardness = Math.max(0, Math.min(1, (kurtosis + 1) / 8));
  const asymmetry = Math.tanh(skewness * 0.4);

  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;

    const soft = Math.tanh(x * (1 + drive * 4));
    const hard = Math.max(-1, Math.min(1, x * (1 + drive * 8)));

    let y = soft * (1 - hardness) + hard * hardness;
    y += asymmetry * drive * 0.2 * (1 - x * x);

    curve[i] = x * (1 - drive) + y * drive;
  }

  return curve;
}


// ─────────────────────────────────────────────────────────────────────────────
// LEGACY SHIMS (remove once engine.js is fully updated)
// ─────────────────────────────────────────────────────────────────────────────

export function buildAmplitudeCurve(features, params, durSec) {
  const activity = buildActivityCurve(features, params, durSec);
  return buildRootAmpCurve(features, params, durSec, activity);
}

export function buildBrightnessCurve(features, params, durSec) {
  const nFrames = Math.max(2, Math.ceil(durSec * AUTOMATION_RATE));
  const curve   = new Float32Array(nFrames);
  const len     = features.centroid?.length ?? 0;
  if (len === 0) { curve.fill(400); return curve; }
  for (let i = 0; i < nFrames; i++) {
    const cent = _at(features.centroid, i, len, nFrames);
    curve[i] = 200 + cent * 4800;
  }
  return curve;
}
