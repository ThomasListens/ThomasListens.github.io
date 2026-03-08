/**
 * dsp.js — Feature Extraction Pipeline
 *
 * Runs once per channel after preprocessing. Produces a `features` object
 * containing Float32Arrays for every auditory dimension, all sample-aligned,
 * all normalized to [0, 1] except phase (which stays in [-π, π]).
 *
 * Design principles:
 *
 *   Single Hilbert call:
 *     hilbertAnalytic() is O(N log N). The v7 code called it 3× per channel
 *     (envelope, instFreq, rhythmEnv). Here it is called exactly once, and
 *     envelope, phase, and instFreq are all derived from that one result.
 *
 *   Single STFT pass:
 *     Spectral centroid and spectral flux both need the power spectrum per
 *     frame. The STFT runs once; centroid and flux are computed from each
 *     frame's power spectrum without storing all frames simultaneously.
 *
 *   Normalization at extraction time:
 *     All features (except phase) are normalized to [0, 1] using
 *     percentile-based calibration computed from the full recording.
 *     This must happen once at load time and never again during playback.
 *     Re-normalizing in real-time would destroy the dynamic range the
 *     clinician needs to hear.
 *
 * Exports:
 *   extractFeatures(signal, fs)  → features object  (main entry point)
 *   hilbertAnalytic(data)        → { envelope, phase }
 *   rmsEnvelope(data, winSamples) → Float32Array
 *   bandpass(data, lo, hi, fs)   → Float32Array
 *   normalizePct(arr, pLo, pHi)  → Float32Array
 *   BANDS                        → canonical band definitions
 */


// ─────────────────────────────────────────────────────────────────────────────
// FFT — in-place radix-2 Cooley-Tukey
// Carried forward from v7, validated against real SEEG recordings.
// ─────────────────────────────────────────────────────────────────────────────

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place radix-2 FFT.
 * Operates on separate real and imaginary arrays (both Float64Array).
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {boolean} inverse
 */
function fft(re, im, inverse = false) {
  const N    = re.length;
  const logN = Math.log2(N);

  // Bit-reversal permutation
  for (let i = 0; i < N; i++) {
    let j = 0;
    for (let k = 0; k < logN; k++) j = (j << 1) | ((i >> k) & 1);
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  // Cooley-Tukey butterfly
  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= N; size *= 2) {
    const half  = size / 2;
    const angle = sign * 2 * Math.PI / size;
    const wRe   = Math.cos(angle);
    const wIm   = Math.sin(angle);
    for (let i = 0; i < N; i += size) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j, b = a + half;
        const tRe = curRe * re[b] - curIm * im[b];
        const tIm = curRe * im[b] + curIm * re[b];
        re[b] = re[a] - tRe;  im[b] = im[a] - tIm;
        re[a] += tRe;          im[a] += tIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// HILBERT ANALYTIC SIGNAL
// Carried forward from v7, validated. Calling convention unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the analytic signal via Hilbert transform.
 *
 * Method: FFT → zero negative frequencies → IFFT.
 *   DC (bin 0) and Nyquist (bin N/2): unchanged
 *   Positive frequency bins 1..N/2-1: × 2
 *   Negative frequency bins N/2+1..N-1: × 0
 *
 * @param {Float32Array} data
 * @returns {{ envelope: Float32Array, phase: Float32Array }}
 *   envelope[i] = instantaneous amplitude (always ≥ 0)
 *   phase[i]    = instantaneous phase in [-π, π]
 */
export function hilbertAnalytic(data) {
  const origLen = data.length;
  const N  = nextPow2(origLen);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < origLen; i++) re[i] = data[i];

  fft(re, im, false);

  for (let i = 1; i < N / 2; i++) { re[i] *= 2; im[i] *= 2; }
  for (let i = N / 2 + 1; i < N; i++) { re[i] = 0; im[i] = 0; }

  fft(re, im, true);

  const envelope = new Float32Array(origLen);
  const phase    = new Float32Array(origLen);
  for (let i = 0; i < origLen; i++) {
    envelope[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    phase[i]    = Math.atan2(im[i], re[i]);
  }

  return { envelope, phase };
}

/**
 * Compute instantaneous frequency (Hz) from the Hilbert phase array.
 *
 * Instantaneous frequency = dφ/dt / (2π).
 * Phase derivative is computed with wrap-around correction to [-π, π],
 * then converted to Hz.
 *
 * The sign of the phase derivative is preserved. Negative instantaneous
 * frequency can occur in multicomponent signals (interference patterns)
 * and may carry information about phase reversal. The synthesis layer
 * receives the raw value and decides how to use it.
 *
 * A short smoothing window (default 10ms) reduces noise spikes from
 * phase quantization without blurring meaningful frequency transitions.
 *
 * @param {Float32Array} phase — from hilbertAnalytic()
 * @param {number} fs
 * @param {number} [smoothMs=10]
 * @returns {Float32Array} instantaneous frequency in Hz (NOT yet normalized)
 */
function phaseToInstFreq(phase, fs, smoothMs = 10) {
  const len         = phase.length;
  const nyquist     = fs / 2;
  const instFreq    = new Float32Array(len);
  const smoothSamps = Math.max(3, Math.floor(fs * smoothMs / 1000));

  for (let i = 1; i < len; i++) {
    let dp = phase[i] - phase[i - 1];
    // Wrap to [-π, π]
    while (dp >  Math.PI) dp -= 2 * Math.PI;
    while (dp < -Math.PI) dp += 2 * Math.PI;
    instFreq[i] = dp * fs / (2 * Math.PI);   // signed Hz
  }
  instFreq[0] = instFreq[1] || 0;

  // Clamp to ±Nyquist
  for (let i = 0; i < len; i++) {
    instFreq[i] = Math.max(-nyquist, Math.min(nyquist, instFreq[i]));
  }

  // Moving-average smoothing
  if (smoothSamps > 1) {
    const sm = new Float32Array(len);
    const h  = Math.floor(smoothSamps / 2);
    let sum  = 0;
    for (let i = 0; i < Math.min(smoothSamps, len); i++) sum += instFreq[i];
    for (let i = 0; i < len; i++) {
      const a = i + h, r = i - h - 1;
      if (a < len) sum += instFreq[a];
      if (r >= 0)  sum -= instFreq[r];
      sm[i] = sum / (Math.min(a + 1, len) - Math.max(r + 1, 0));
    }
    return sm;
  }

  return instFreq;
}


// ─────────────────────────────────────────────────────────────────────────────
// STFT — SHORT-TIME FOURIER TRANSFORM
// Used for spectral centroid and spectral flux (computed in a single pass).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute spectral centroid and spectral flux in a single STFT pass.
 *
 * Both features require the power spectrum of each short frame.
 * Rather than running two separate STFTs, this function computes
 * the spectrum once per frame and derives both features.
 *
 * Spectral centroid = weighted mean frequency (brightness).
 * Spectral flux = half-wave rectified frame-to-frame spectral difference
 *   (positive-only: responds to energy increases / onsets, not offsets).
 *
 * Window: Hann (reduces spectral leakage without excessive rolloff).
 * Frequency range for centroid: DC to Nyquist (full spectrum).
 *
 * Output is at hop rate (one value per hop). Call _interpolate() to
 * resample to the original signal's sample rate.
 *
 * @param {Float32Array} signal
 * @param {number} fs
 * @param {number} [windowMs=256]
 * @param {number} [hopMs=64]       — hop_size = window_size / 4 by default
 * @returns {{ centroidHz: Float32Array, flux: Float32Array, hop: number, numFrames: number }}
 */
function _stftCentroidFlux(signal, fs, windowMs = 256, hopMs = 64) {
  const n         = signal.length;
  const winSamps  = Math.floor(fs * windowMs / 1000);
  const N         = nextPow2(winSamps);           // FFT size (zero-padded if needed)
  const hopSamps  = Math.floor(fs * hopMs  / 1000);
  const numBins   = N / 2 + 1;                   // one-sided spectrum
  const binHz     = fs / N;                       // Hz per bin

  // Pre-compute Hann window coefficients
  const hann = new Float64Array(winSamps);
  for (let i = 0; i < winSamps; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winSamps - 1)));
  }

  const numFrames  = Math.max(1, Math.ceil(n / hopSamps));
  const centroidHz = new Float32Array(numFrames);
  const flux       = new Float32Array(numFrames);

  const re       = new Float64Array(N);
  const im       = new Float64Array(N);
  const prevPow  = new Float64Array(numBins);   // previous frame's power

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSamps;

    // Fill frame with windowed signal (zero-pad beyond signal end)
    re.fill(0); im.fill(0);
    for (let i = 0; i < winSamps; i++) {
      re[i] = (start + i < n) ? signal[start + i] * hann[i] : 0;
    }

    fft(re, im, false);

    // One-sided power spectrum
    let   centNum = 0, centDen = 0, frameFlux = 0;
    for (let k = 0; k < numBins; k++) {
      const p   = re[k] * re[k] + im[k] * im[k];
      const hz  = k * binHz;

      centNum  += hz * p;
      centDen  += p;

      // Half-wave rectified flux: only positive increases
      frameFlux += Math.max(0, p - prevPow[k]);
      prevPow[k] = p;
    }

    centroidHz[f] = centDen > 0 ? centNum / centDen : 0;
    flux[f]       = frameFlux;
  }

  return { centroidHz, flux, hop: hopSamps, numFrames };
}

/**
 * Linear interpolation from hop-rate to sample rate.
 * Used to align STFT-derived features with Hilbert and RMS features.
 *
 * @param {Float32Array} values — one value per hop frame
 * @param {number} hop          — hop size in samples
 * @param {number} n            — target length (original signal length)
 * @returns {Float32Array}
 */
function _interpolate(values, hop, n) {
  const out = new Float32Array(n);
  const len = values.length;
  for (let i = 0; i < n; i++) {
    const pos = i / hop;
    const f0  = Math.floor(pos);
    const f1  = Math.min(f0 + 1, len - 1);
    const t   = pos - f0;
    out[i]    = values[f0] * (1 - t) + values[f1] * t;
  }
  return out;
}


// ─────────────────────────────────────────────────────────────────────────────
// STFT BAND POWERS
// Computes per-band power from STFT frames — avoids allocating full-length
// Float32Arrays for bandpass filtering (which causes OOM on long recordings).
//
// Uses a 2-second window for ≥0.5 Hz frequency resolution (resolves delta).
// Output is at hop rate; call _interpolate() to get sample-rate arrays.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute power in each frequency band from STFT frames.
 *
 * Memory usage: O(numFrames) per band, where numFrames ≈ duration / hopSec.
 * For 60 min at 2000 Hz with 1s hop: ~3600 frames vs ~28.8 MB for a full
 * Float32Array of the raw signal. No intermediate full-length arrays.
 *
 * @param {Float32Array} signal
 * @param {number} fs
 * @param {Array<{name: string, lo: number, hi: number}>} bands
 * @param {number} [windowSec=2.0] — 2s window → ≥0.5 Hz freq resolution (delta)
 * @param {number} [hopSec=1.0]    — 1s hop → 1s temporal resolution for band powers
 * @returns {{ bandPowFrames: Float32Array[], hop: number, numFrames: number }}
 *   bandPowFrames[i] corresponds to bands[i], values in RMS-equivalent amplitude
 */
function _stftBandPowers(signal, fs, bands, windowSec = 2.0, hopSec = 1.0) {
  const n        = signal.length;
  const winSamps = Math.floor(fs * windowSec);
  const N        = nextPow2(winSamps);
  const hopSamps = Math.max(1, Math.floor(fs * hopSec));
  const numBins  = N / 2 + 1;
  const binHz    = fs / N;

  const hann = new Float64Array(winSamps);
  for (let i = 0; i < winSamps; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winSamps - 1)));
  }

  const numFrames  = Math.max(1, Math.ceil(n / hopSamps));
  const bandRanges = bands.map(b => ({
    lobin: Math.max(0,          Math.ceil(b.lo  / binHz)),
    hibin: Math.min(numBins - 1, Math.floor(b.hi / binHz)),
  }));

  const bandPowFrames = bands.map(() => new Float32Array(numFrames));
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSamps;
    re.fill(0); im.fill(0);
    for (let i = 0; i < winSamps; i++) {
      re[i] = (start + i < n) ? signal[start + i] * hann[i] : 0;
    }

    fft(re, im, false);

    for (let b = 0; b < bands.length; b++) {
      const { lobin, hibin } = bandRanges[b];
      if (lobin > hibin) { bandPowFrames[b][f] = 0; continue; }
      let sum = 0;
      for (let k = lobin; k <= hibin; k++) {
        sum += re[k] * re[k] + im[k] * im[k];
      }
      // sqrt(mean power over bins) → RMS-equivalent amplitude
      bandPowFrames[b][f] = Math.sqrt(sum / (hibin - lobin + 1));
    }
  }

  return { bandPowFrames, hop: hopSamps, numFrames };
}


// ─────────────────────────────────────────────────────────────────────────────
// PPAF — Peak-to-Peak Amplitude Fluctuation
// Extracted from v7 engine.js. This is the raw feature; detection thresholds
// live in synthesis.js.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Peak-to-peak amplitude fluctuation: max − min within a symmetric window.
 *
 * Validated for LVFA (low-voltage fast activity) detection (Wang et al. 2025).
 * Unlike the Hilbert envelope (which tracks slow amplitude modulation),
 * PPAF captures rapid voltage excursions within 15ms — characteristic of
 * ictal oscillations even at low absolute amplitude.
 *
 * IMPORTANT: This must be computed on the raw (preprocessed) signal,
 * NOT on a bandpassed version. Bandpass filtering attenuates the sharp
 * transients that PPAF is designed to detect.
 *
 * @param {Float32Array} signal — preprocessed signal (DC removed, notch filtered)
 * @param {number} fs
 * @param {number} [halfWindowMs=7.5] — half-window each side (15ms total)
 * @returns {Float32Array} PPAF values (NOT yet normalized)
 */
function _ppaf(signal, fs, halfWindowMs = 7.5) {
  const n      = signal.length;
  const half   = Math.floor(fs * halfWindowMs / 1000);
  const result = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let mn = signal[lo], mx = signal[lo];
    for (let j = lo + 1; j <= hi; j++) {
      if (signal[j] < mn) mn = signal[j];
      if (signal[j] > mx) mx = signal[j];
    }
    result[i] = mx - mn;
  }

  return result;
}


// ─────────────────────────────────────────────────────────────────────────────
// RMS ENVELOPE
// Carried forward from v7 unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sliding-window root mean square envelope.
 *
 * @param {Float32Array} data
 * @param {number} windowSamples
 * @returns {Float32Array}
 */
export function rmsEnvelope(data, windowSamples) {
  const env = new Float32Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
    if (i >= windowSamples) sum -= data[i - windowSamples] * data[i - windowSamples];
    if (sum < 0) sum = 0;
    env[i] = Math.sqrt(sum / Math.min(i + 1, windowSamples));
  }
  return env;
}


// ─────────────────────────────────────────────────────────────────────────────
// HJORTH MOBILITY
// Carried forward from v7 unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hjorth Mobility: RMS(derivative) / RMS(signal) per window.
 * Units: Hz. Higher = more high-frequency content.
 *
 * @param {Float32Array} data
 * @param {number} fs
 * @param {number} [windowMs=200]
 * @returns {Float32Array} mobility in Hz (NOT yet normalized)
 */
export function hjorthMobility(data, fs, windowMs = 200) {
  const win  = Math.floor(fs * windowMs / 1000);
  const len  = data.length;
  const mob  = new Float32Array(len);

  const deriv = new Float32Array(len);
  for (let i = 1; i < len; i++) deriv[i] = (data[i] - data[i - 1]) * fs;
  deriv[0] = deriv[1] || 0;

  let sigSum = 0, drvSum = 0;
  for (let i = 0; i < len; i++) {
    sigSum += data[i] * data[i];
    drvSum += deriv[i] * deriv[i];
    if (i >= win) {
      sigSum -= data[i - win] * data[i - win];
      drvSum -= deriv[i - win] * deriv[i - win];
    }
    if (sigSum < 0) sigSum = 0;
    if (drvSum < 0) drvSum = 0;
    const w      = Math.min(i + 1, win);
    const sigRMS = Math.sqrt(sigSum / w);
    const drvRMS = Math.sqrt(drvSum / w);
    mob[i] = sigRMS > 1e-6 ? (drvRMS / sigRMS) / (2 * Math.PI) : 0;
  }

  return mob;
}


// ─────────────────────────────────────────────────────────────────────────────
// BANDPASS FILTER + BAND POWERS
// Carried forward from v7 unchanged.
// ─────────────────────────────────────────────────────────────────────────────

function _biquadBandpassCoeffs(fc, Q, fs) {
  const w0    = (2 * Math.PI * fc) / fs;
  const sinW0 = Math.sin(w0);
  const cosW0 = Math.cos(w0);
  const alpha = sinW0 / (2 * Q);
  const a0    = 1 + alpha;
  return {
    b0:  alpha / a0,
    b1:  0,
    b2: -alpha / a0,
    a1: (-2 * cosW0) / a0,
    a2:  (1 - alpha) / a0,
  };
}

function _applyBandpassBiquad(data, c) {
  const out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

/**
 * Bandpass filter using cascaded biquads.
 * Geometric center frequency, bandwidth = hi - lo.
 *
 * @param {Float32Array} data
 * @param {number} lo — low cutoff Hz
 * @param {number} hi — high cutoff Hz
 * @param {number} fs
 * @param {number} [passes=2]
 * @returns {Float32Array}
 */
export function bandpass(data, lo, hi, fs, passes = 2) {
  if (lo >= hi || lo >= fs / 2) return new Float32Array(data.length);
  const fc     = Math.sqrt(lo * hi);
  const Q      = Math.max(fc / (hi - lo), 0.5);
  const coeffs = _biquadBandpassCoeffs(fc, Q, fs);
  let result   = data;
  for (let p = 0; p < passes; p++) result = _applyBandpassBiquad(result, coeffs);
  return result;
}

/**
 * Canonical neural frequency bands.
 * HFO bands are included but flagged; availability is checked at runtime
 * against the recording's sampling rate.
 */
export const BANDS = [
  { name: 'delta',     lo: 0.5,  hi: 4,    color: '#6366f1', note: 'Slow waves' },
  { name: 'theta',     lo: 4,    hi: 8,    color: '#06b6d4', note: 'Temporal, drowsiness' },
  { name: 'alpha',     lo: 8,    hi: 13,   color: '#22c55e', note: 'Posterior dominant' },
  { name: 'beta',      lo: 13,   hi: 30,   color: '#eab308', note: 'Active processing' },
  { name: 'lowGamma',  lo: 30,   hi: 70,   color: '#f97316', note: 'Cognitive binding' },
  { name: 'highGamma', lo: 70,   hi: 150,  color: '#ef4444', note: 'Cortical activation (SEEG)' },
  { name: 'hfoRipple', lo: 80,   hi: 250,  color: '#a855f7', note: 'HFO epileptogenic marker' },
  { name: 'hfoFast',   lo: 250,  hi: 500,  color: '#ec4899', note: 'Fast ripple' },
];


// ─────────────────────────────────────────────────────────────────────────────
// PERCENTILE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the p-th percentile of an array.
 *
 * Uses a subsample of up to 10,000 elements to avoid O(N log N) cost on
 * large recordings (e.g., 307,200 samples at 1024 Hz × 5 min).
 * The subsample is regularly spaced, giving a statistically representative
 * estimate.
 *
 * @param {Float32Array} arr
 * @param {number} p — fraction in [0, 1]
 * @returns {number}
 */
function _pct(arr, p) {
  const maxSamples = 10_000;
  const step       = Math.max(1, Math.floor(arr.length / maxSamples));
  const sample     = [];
  for (let i = 0; i < arr.length; i += step) sample.push(arr[i]);
  sample.sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sample.length - 1, Math.floor(p * (sample.length - 1))));
  return sample[idx];
}

/**
 * Normalize an array to [0, 1] using percentile-based calibration.
 *
 * floor   = p_lo-th percentile  (noise floor, default 5th)
 * ceiling = p_hi-th percentile  (typical maximum, default 95th)
 *
 * Values below floor → 0, above ceiling → 1.
 * The 5%/95% range preserves the meaningful dynamic range while being
 * robust to outliers (electrode pops, saturation artifacts).
 *
 * This MUST be computed once at load time from the full recording and
 * applied uniformly. Per-window normalization erases the dynamic
 * contrast the clinician needs to hear.
 *
 * @param {Float32Array} arr
 * @param {number} [pLo=0.05]
 * @param {number} [pHi=0.95]
 * @returns {Float32Array} values clamped to [0, 1]
 */
export function normalizePct(arr, pLo = 0.05, pHi = 0.95) {
  const floor   = _pct(arr, pLo);
  const ceiling = _pct(arr, pHi);
  const range   = ceiling - floor;
  const out     = new Float32Array(arr.length);

  if (range < 1e-12) {
    // Degenerate case: flat signal or constant feature
    // Leave as zeros — the quality assessment in preprocess.js will have
    // flagged this channel already.
    return out;
  }

  for (let i = 0; i < arr.length; i++) {
    out[i] = Math.max(0, Math.min(1, (arr[i] - floor) / range));
  }
  return out;
}

/**
 * Compute amplitude calibration parameters from a signal.
 * Returns p5 and p95 of the absolute value, used for metadata.
 *
 * @param {Float32Array} signal
 * @returns {{ ampFloor: number, ampCeiling: number }}
 */
function _amplitudeCalibration(signal) {
  const abs = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) abs[i] = Math.abs(signal[i]);
  return {
    ampFloor:   _pct(abs, 0.05),
    ampCeiling: _pct(abs, 0.95),
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// LINE LENGTH — activity detector (master gate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute sliding-window line length.
 *
 * Line length = sum of |sample[i] - sample[i-1]| over a window.
 * Measures how much the signal "wiggles" — responds to BOTH amplitude
 * AND frequency simultaneously. Used as the master activity gate.
 *
 * @param {Float32Array} signal — preprocessed signal
 * @param {number} fs
 * @param {number} [windowMs=200] — window size
 * @returns {Float32Array} — NOT yet normalized
 */
function _lineLength(signal, fs, windowMs = 200) {
  const n   = signal.length;
  const win = Math.max(2, Math.floor(fs * windowMs / 1000));
  const ll  = new Float32Array(n);

  let sum = 0;
  for (let i = 1; i < n; i++) {
    const diff = Math.abs(signal[i] - signal[i - 1]);
    sum += diff;
    if (i > win) {
      sum -= Math.abs(signal[i - win] - signal[i - win - 1]);
    }
    ll[i] = sum / Math.min(i, win);
  }
  ll[0] = ll[1] || 0;

  return ll;
}


// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL SKEWNESS — waveform asymmetry (distortion character)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute global skewness of the signal.
 * Used for per-channel distortion curve asymmetry (even harmonics).
 *
 * @param {Float32Array} signal
 * @returns {number} skewness (unbounded, typically -2 to +2)
 */
function _globalSkewness(signal) {
  const n = signal.length;
  const step = Math.max(1, Math.floor(n / 10000));

  let sum = 0, count = 0;
  for (let i = 0; i < n; i += step) { sum += signal[i]; count++; }
  const mean = sum / count;

  let sum2 = 0, sum3 = 0;
  for (let i = 0; i < n; i += step) {
    const d = signal[i] - mean;
    sum2 += d * d;
    sum3 += d * d * d;
  }
  const std = Math.sqrt(sum2 / count);
  if (std < 1e-9) return 0;
  return (sum3 / count) / (std * std * std);
}


// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL KURTOSIS — waveform peakedness (distortion hardness)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute excess kurtosis of the signal.
 * Used for per-channel distortion waveshaper hardness.
 *
 * @param {Float32Array} signal
 * @returns {number} excess kurtosis (typically -1 to +10)
 */
function _globalKurtosis(signal) {
  const n = signal.length;
  const step = Math.max(1, Math.floor(n / 10000));

  let sum = 0, count = 0;
  for (let i = 0; i < n; i += step) { sum += signal[i]; count++; }
  const mean = sum / count;

  let sum2 = 0, sum4 = 0;
  for (let i = 0; i < n; i += step) {
    const d = signal[i] - mean;
    const d2 = d * d;
    sum2 += d2;
    sum4 += d2 * d2;
  }
  const variance = sum2 / count;
  if (variance < 1e-18) return 0;
  return (sum4 / count) / (variance * variance) - 3;
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all features from a single preprocessed channel.
 *
 * This is the single entry point for the feature extraction layer.
 * Call it once per channel after preprocessRecording() completes.
 *
 * Computation order:
 *   1. Hilbert analytic signal (one FFT) → envelope, phase, instFreq
 *   2. STFT (one pass)                   → centroid, spectralFlux
 *   3. PPAF                              → peak-to-peak fluctuation
 *   4. RMS (slow + fast)                 → energy envelopes + ratio
 *   5. Hjorth mobility                   → signal complexity
 *   6. Band powers                       → per-band RMS envelopes
 *   7. Normalize all to [0, 1]
 *
 * @param {Float32Array} signal — from preprocessRecording() channel.data
 * @param {number} fs           — channel.fs
 * @param {Object} [opts]
 * @param {number[]} [opts.bandHiOverride]  — override band hi cutoffs (future use)
 *
 * @returns {FeatureObject} — see contract below
 *
 * FeatureObject shape (v8 spec §5.10):
 * {
 *   // Raw signal (reference for transient detection — must use this, not a filtered copy)
 *   cleanSignal:  Float32Array,     — the input signal, stored by reference
 *
 *   // Hilbert-derived (sample-aligned, all normalized to [0,1] except phase)
 *   envelope:     Float32Array,     — [0,1] instantaneous amplitude
 *   phase:        Float32Array,     — [-π, π] instantaneous phase (NOT normalized)
 *   instFreq:     Float32Array,     — [0,1] instantaneous frequency (signed → shifted)
 *
 *   // Spectral (STFT-derived, interpolated to sample rate, [0,1])
 *   centroid:     Float32Array,     — [0,1] spectral brightness
 *   spectralFlux: Float32Array,     — [0,1] spectral change rate (onset sensitive)
 *
 *   // Amplitude (sample-aligned, [0,1])
 *   ppaf:         Float32Array,     — [0,1] peak-to-peak amplitude fluctuation
 *   slowRMS:      Float32Array,     — [0,1] 1.5s energy envelope
 *   fastRMS:      Float32Array,     — [0,1] 50ms energy envelope
 *   rmsRatio:     Float32Array,     — [0,1] local energy anomaly (fast/slow)
 *
 *   // Complexity (sample-aligned, [0,1])
 *   mobility:     Float32Array,     — [0,1] Hjorth mobility (mean frequency)
 *
 *   // Band powers (bandpass → RMS, [0,1], omitted if fs too low)
 *   bandPowers: {
 *     delta:      Float32Array,
 *     theta:      Float32Array,
 *     alpha:      Float32Array,
 *     beta:       Float32Array,
 *     lowGamma:   Float32Array,
 *     highGamma:  Float32Array,     — only if fs ≥ 512
 *     hfoRipple:  Float32Array,     — only if fs ≥ 1024
 *     hfoFast:    Float32Array,     — only if fs ≥ 2048
 *   },
 *
 *   // Calibration metadata
 *   calibration: {
 *     ampFloor:   number,           — 5th percentile of |signal| (physical units)
 *     ampCeiling: number,           — 95th percentile of |signal| (physical units)
 *     fs:         number,
 *   }
 * }
 */
export function extractFeatures(signal, fs) {
  const n       = signal.length;
  const nyquist = fs / 2;

  // ── 1. Hilbert analytic signal — ONE call, three features ──────────────────
  const { envelope: rawEnv, phase } = hilbertAnalytic(signal);
  const rawInstFreq = phaseToInstFreq(phase, fs);

  // ── 2. STFT — ONE pass, centroid + flux ────────────────────────────────────
  const { centroidHz, flux: rawFlux, hop } =
    _stftCentroidFlux(signal, fs, 256, 64);

  // Interpolate from hop rate to sample rate
  const rawCentroid = _interpolate(centroidHz, hop, n);
  const rawFluxFull = _interpolate(rawFlux,    hop, n);

  // ── 3. PPAF ────────────────────────────────────────────────────────────────
  const rawPpaf = _ppaf(signal, fs, 7.5);

  // ── 4. RMS envelopes ───────────────────────────────────────────────────────
  const slowWin   = Math.floor(fs * 1.5);
  const fastWin   = Math.floor(fs * 0.050);
  const rawSlow   = rmsEnvelope(signal, slowWin);
  const rawFast   = rmsEnvelope(signal, fastWin);

  // RMS ratio: local energy anomaly (values > 1 mean "louder than background")
  const rawRatio  = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rawRatio[i] = rawSlow[i] > 1e-9 ? rawFast[i] / rawSlow[i] : 0;
  }

  // ── 5. Hjorth mobility ─────────────────────────────────────────────────────
  const rawMobility = hjorthMobility(signal, fs, 200);

  // ── 5b. Line length ───────────────────────────────────────────────────────
  const rawLineLength = _lineLength(signal, fs, 200);

  // ── 5c. Signal statistics (for distortion curves) ─────────────────────────
  const signalSkewness = _globalSkewness(signal);
  const signalKurtosis = _globalKurtosis(signal);

  // ── 6. Band powers — from STFT (no full-length bandpass allocations) ────────
  //
  // WHY: bandpass() + rmsEnvelope() allocate Float32Array(signal.length) per
  // pass. At 2000 Hz × 60 min, each is ~28.8 MB. With 6 bands × 2 passes =
  // ~346 MB per channel → RangeError on long files.
  //
  // FIX: compute band powers from STFT frames (2s window, 1s hop).
  // Each band needs only Float32Array(numFrames ≈ 3600) ≈ 14 KB, then
  // interpolated to full length as the final output (unavoidable).
  const availBands = BANDS
    .filter(b => b.lo < nyquist)
    .map(b => ({ name: b.name, lo: b.lo, hi: Math.min(b.hi, nyquist - 1) }));

  const { bandPowFrames, hop: bpHop } = _stftBandPowers(signal, fs, availBands);

  const bandPowersRaw = {};
  for (let b = 0; b < availBands.length; b++) {
    bandPowersRaw[availBands[b].name] = _interpolate(bandPowFrames[b], bpHop, n);
  }

  // ── 7. Amplitude calibration ───────────────────────────────────────────────
  const { ampFloor, ampCeiling } = _amplitudeCalibration(signal);

  // ── 8. Normalize all features to [0, 1] ───────────────────────────────────
  //
  // instFreq is signed (can be negative). Shift to [0, 1] by mapping
  // [-nyquist, +nyquist] → [0, 1] so that zero frequency = 0.5,
  // positive = above 0.5, negative = below 0.5.
  // This preserves the directional information while fitting [0,1].
  const instFreqNorm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    instFreqNorm[i] = Math.max(0, Math.min(1, (rawInstFreq[i] + nyquist) / (2 * nyquist)));
  }

  const bandPowers = {};
  for (const [name, raw] of Object.entries(bandPowersRaw)) {
    bandPowers[name] = normalizePct(raw);
  }

  return {
    cleanSignal:  signal,                       // reference — do not copy

    envelope:     normalizePct(rawEnv),
    phase,                                      // [-π, π], NOT normalized
    instFreq:     instFreqNorm,

    centroid:     normalizePct(rawCentroid),
    spectralFlux: normalizePct(rawFluxFull),

    ppaf:         normalizePct(rawPpaf),
    slowRMS:      normalizePct(rawSlow),
    fastRMS:      normalizePct(rawFast),
    rmsRatio:     normalizePct(rawRatio),

    mobility:     normalizePct(rawMobility),

    lineLength:   normalizePct(rawLineLength),

    bandPowers,

    signalStats: {
      skewness: signalSkewness,
      kurtosis: signalKurtosis,
    },

    calibration: {
      ampFloor,
      ampCeiling,
      fs,
    },
  };
}
