/**
 * Digital Signal Processing utilities for SEEG sonification.
 * Bandpass filtering and envelope extraction.
 */

// ── Biquad bandpass filter coefficients ─────────────────────
function biquadBandpassCoeffs(fc, Q, fs) {
  const w0 = (2 * Math.PI * fc) / fs;
  const sinW0 = Math.sin(w0);
  const cosW0 = Math.cos(w0);
  const alpha = sinW0 / (2 * Q);

  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

// ── Apply biquad filter (direct form I) ─────────────────────
function applyBiquad(data, coeffs) {
  const out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 =
      coeffs.b0 * x0 +
      coeffs.b1 * x1 +
      coeffs.b2 * x2 -
      coeffs.a1 * y1 -
      coeffs.a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/**
 * Bandpass filter using cascaded biquads.
 * @param {Float32Array} data - input signal
 * @param {number} lo - low cutoff frequency (Hz)
 * @param {number} hi - high cutoff frequency (Hz)
 * @param {number} fs - sample rate (Hz)
 * @param {number} passes - number of filter passes (default 2)
 * @returns {Float32Array} filtered signal
 */
export function bandpass(data, lo, hi, fs, passes = 2) {
  if (lo >= hi || lo >= fs / 2) return new Float32Array(data.length);

  const fc = Math.sqrt(lo * hi);
  const Q = fc / (hi - lo);
  const coeffs = biquadBandpassCoeffs(fc, Math.max(Q, 0.5), fs);

  let result = data;
  for (let p = 0; p < passes; p++) {
    result = applyBiquad(result, coeffs);
  }
  return result;
}

/**
 * Compute RMS envelope with sliding window.
 * @param {Float32Array} data - input signal
 * @param {number} windowSamples - window size in samples
 * @returns {Float32Array} RMS envelope
 */
export function rmsEnvelope(data, windowSamples) {
  const env = new Float32Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
    if (i >= windowSamples) {
      sum -= data[i - windowSamples] * data[i - windowSamples];
    }
    // Clamp sum to avoid negative values from floating point drift
    if (sum < 0) sum = 0;
    env[i] = Math.sqrt(sum / Math.min(i + 1, windowSamples));
  }
  return env;
}

/**
 * Canonical neural frequency bands.
 */
export const BANDS = [
  { name: 'δ', full: 'Delta',  lo: 0.5, hi: 4,   color: '#6366f1' },
  { name: 'θ', full: 'Theta',  lo: 4,   hi: 8,   color: '#06b6d4' },
  { name: 'α', full: 'Alpha',  lo: 8,   hi: 13,  color: '#22c55e' },
  { name: 'β', full: 'Beta',   lo: 13,  hi: 30,  color: '#eab308' },
  { name: 'γL', full: 'Low γ', lo: 30,  hi: 70,  color: '#f97316' },
  { name: 'γH', full: 'High γ',lo: 70,  hi: 150, color: '#ef4444' },
];

/**
 * Compute band envelopes for a signal.
 * @param {Float32Array} data - input signal
 * @param {number} fs - sample rate
 * @param {number} windowMs - envelope window in milliseconds (default 100)
 * @returns {Float32Array[]} array of 6 RMS envelopes, one per band
 */
export function computeBandEnvelopes(data, fs, windowMs = 100) {
  const windowSamples = Math.floor(fs * windowMs / 1000);
  return BANDS.map((band) => {
    const hiClamped = Math.min(band.hi, fs / 2 - 1);
    if (band.lo >= hiClamped) return new Float32Array(data.length);
    const filtered = bandpass(data, band.lo, hiClamped, fs);
    return rmsEnvelope(filtered, windowSamples);
  });
}
