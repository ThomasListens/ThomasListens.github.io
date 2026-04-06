/**
 * dsp.js — Feature Extraction Pipeline (v8.3)
 *
 * Runs once per channel after preprocessing. Produces a `features` object
 * containing Float32Arrays for every auditory dimension, all sample-aligned,
 * all normalized to [0, 1] except phase (which stays in [-π, π]).
 *
 * FEATURE INVENTORY (24 time-series + 2 scalars + band powers):
 *
 *   From Hilbert (1 FFT call → 3 features):
 *     envelope, phase, instFreq
 *
 *   From STFT pass 1 (256ms window, 64ms hop → 5 features, ONE FFT/frame):
 *     centroid, spectralFlux, spectralBandwidth, spectralSlope, sef95
 *
 *   From STFT pass 2 (2s window, 1s hop → per-band powers):
 *     bandPowers { delta, theta, alpha, beta, lowGamma, highGamma, ... }
 *
 *   Time-domain amplitude (4 RMS modes + ratio + line length + PPAF):
 *     fastRMS (50ms), midRMS (250ms), slowRMS (1500ms), adaptiveRMS
 *     rmsRatio, lineLength, ppaf
 *
 *   Complexity (shared derivative between mobility + complexity):
 *     mobility, complexity, permEntropy
 *
 *   Morphology (voltage shape analysis):
 *     slopeAsymmetry — rise/fall temporal shape (modulates harmonic range)
 *     dutyCycle — fraction of time positive (diagnostic display)
 *
 *   Scalars (computed once per channel):
 *     signalStats { skewness, kurtosis }
 *
 * RMS MODES:
 *   fastRMS    — 50ms window. Individual bursts, HFO envelopes.
 *   midRMS     — 250ms window. BIOPAC standard. Oscillatory energy, ~2 alpha cycles.
 *   slowRMS    — 1500ms window. Overall energy contour, seizure body.
 *   adaptiveRMS — power-weighted blend of the three fixed scales.
 *                 Weighted-average center frequency across all bands determines
 *                 ideal window, which selects the blend weights via Bézier curve.
 *                 Changes smoothly (1s STFT hop, continuous weighting).
 *                 Delta-dominant → slowRMS. Gamma-dominant → fastRMS.
 *                 Mixed spectrum → intermediate blend (no discrete switching).
 *
 * NUMERICAL ROBUSTNESS:
 *   All sliding-window running sums use periodic recomputation every
 *   RECOMPUTE_INTERVAL samples to prevent float accumulation drift.
 *
 * Exports:
 *   extractFeatures(signal, fs)   → features object
 *   hilbertAnalytic(data)         → { envelope, phase }
 *   rmsEnvelope(data, winSamples) → Float32Array
 *   bandpass(data, lo, hi, fs)    → Float32Array
 *   normalizePct(arr, pLo, pHi)  → Float32Array
 *   BANDS                         → canonical band definitions
 */


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const RECOMPUTE_INTERVAL = 8192;
const RECOMPUTE_MASK     = RECOMPUTE_INTERVAL - 1;

// Downsample rate for band-specific RMS (matches AUTOMATION_RATE in mapping.js)
const DOWNSAMPLE_RATE = 60;

// ── Shared FFT buffers (reused across channels to avoid GC churn) ────────
// For 88 channels at 262K FFT size, this eliminates ~352MB of allocation churn.
let _sharedFFTRe = null;
let _sharedFFTIm = null;
let _sharedFFTN  = 0;

function _getSharedFFTBuffers(N) {
  if (N > _sharedFFTN) {
    _sharedFFTRe = new Float64Array(N);
    _sharedFFTIm = new Float64Array(N);
    _sharedFFTN  = N;
  }
  return { re: _sharedFFTRe, im: _sharedFFTIm };
}


// ─────────────────────────────────────────────────────────────────────────────
// FFT — in-place radix-2 Cooley-Tukey
// ─────────────────────────────────────────────────────────────────────────────

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fft(re, im, inverse = false) {
  const N    = re.length;
  const logN = Math.log2(N);

  for (let i = 0; i < N; i++) {
    let j = 0;
    for (let k = 0; k < logN; k++) j = (j << 1) | ((i >> k) & 1);
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

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
// ─────────────────────────────────────────────────────────────────────────────

export function hilbertAnalytic(data) {
  const origLen = data.length;
  const N  = nextPow2(origLen);
  const { re, im } = _getSharedFFTBuffers(N);

  // Zero the buffers and copy signal in
  for (let i = 0; i < origLen; i++) { re[i] = data[i]; im[i] = 0; }
  for (let i = origLen; i < N; i++) { re[i] = 0; im[i] = 0; }

  fft(re, im, false);
  for (let i = 1; i < N / 2; i++) { re[i] *= 2; im[i] *= 2; }
  for (let i = N / 2 + 1; i < N; i++) { re[i] = 0; im[i] = 0; }
  fft(re, im, true);

  // Copy results OUT before the buffers get reused
  const envelope = new Float32Array(origLen);
  const phase    = new Float32Array(origLen);
  for (let i = 0; i < origLen; i++) {
    envelope[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    phase[i]    = Math.atan2(im[i], re[i]);
  }
  return { envelope, phase };
}

function phaseToInstFreq(phase, fs, smoothMs = 10) {
  const len      = phase.length;
  const nyquist  = fs / 2;
  const instFreq = new Float32Array(len);
  const smoothSamps = Math.max(3, Math.floor(fs * smoothMs / 1000));

  for (let i = 1; i < len; i++) {
    let dp = phase[i] - phase[i - 1];
    while (dp >  Math.PI) dp -= 2 * Math.PI;
    while (dp < -Math.PI) dp += 2 * Math.PI;
    instFreq[i] = dp * fs / (2 * Math.PI);
  }
  instFreq[0] = instFreq[1] || 0;

  for (let i = 0; i < len; i++) {
    instFreq[i] = Math.max(-nyquist, Math.min(nyquist, instFreq[i]));
  }

  if (smoothSamps > 1) {
    const sm = new Float32Array(len);
    const h  = Math.floor(smoothSamps / 2);
    let sum  = 0;
    for (let i = 0; i < Math.min(smoothSamps, len); i++) sum += instFreq[i];
    for (let i = 0; i < len; i++) {
      const a = i + h, r = i - h - 1;
      if (a < len) sum += instFreq[a];
      if (r >= 0)  sum -= instFreq[r];
      if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
        sum = 0;
        const lo = Math.max(0, i - h);
        const hi = Math.min(len - 1, i + h);
        for (let j = lo; j <= hi; j++) sum += instFreq[j];
      }
      const wLo = Math.max(0, i - h);
      const wHi = Math.min(len - 1, i + h);
      sm[i] = sum / (wHi - wLo + 1);
    }
    return sm;
  }
  return instFreq;
}


// ─────────────────────────────────────────────────────────────────────────────
// STFT PASS 1 — 5 spectral features from ONE pass
// ─────────────────────────────────────────────────────────────────────────────

function _stftSpectralFeatures(signal, fs, windowMs = 256, hopMs = 64) {
  const n        = signal.length;
  const winSamps = Math.max(1, Math.floor(fs * windowMs / 1000));
  const N        = nextPow2(winSamps);
  const hopSamps = Math.max(1, Math.floor(fs * hopMs / 1000));
  const numBins  = N / 2 + 1;
  const binHz    = fs / N;

  const hann = new Float64Array(winSamps);
  for (let i = 0; i < winSamps; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winSamps - 1)));
  }

  const numFrames        = Math.max(1, Math.ceil(n / hopSamps));
  const centroidHz       = new Float32Array(numFrames);
  const flux             = new Float32Array(numFrames);
  const bandwidthHz      = new Float32Array(numFrames);
  const slope            = new Float32Array(numFrames);
  const sef95Hz          = new Float32Array(numFrames);
  const directionalFlux  = new Float32Array(numFrames);

  const re      = new Float64Array(N);
  const im      = new Float64Array(N);
  const prevPow = new Float64Array(numBins);

  // Pre-compute log frequencies for slope regression
  const slopeBinLo = Math.max(1, Math.ceil(1.0 / binHz));
  const slopeBinHi = Math.min(numBins - 1, Math.floor((fs / 4) / binHz));
  const slopeN     = Math.max(1, slopeBinHi - slopeBinLo + 1);
  const logFreqs   = new Float64Array(slopeN);
  let sumLogF = 0, sumLogF2 = 0;
  for (let j = 0; j < slopeN; j++) {
    logFreqs[j] = Math.log10((slopeBinLo + j) * binHz);
    sumLogF  += logFreqs[j];
    sumLogF2 += logFreqs[j] * logFreqs[j];
  }

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSamps;
    re.fill(0); im.fill(0);
    for (let i = 0; i < winSamps; i++) {
      re[i] = (start + i < n) ? signal[start + i] * hann[i] : 0;
    }
    fft(re, im, false);

    let centNum = 0, centDen = 0, f2pSum = 0, frameFlux = 0;
    for (let k = 0; k < numBins; k++) {
      const p  = re[k] * re[k] + im[k] * im[k];
      const hz = k * binHz;
      centNum   += hz * p;
      centDen   += p;
      f2pSum    += hz * hz * p;
      frameFlux += Math.max(0, p - prevPow[k]);
      prevPow[k] = p;
    }

    const cent = centDen > 0 ? centNum / centDen : 0;
    centroidHz[f] = cent;
    flux[f]       = frameFlux;

    // Directional flux: sign = direction of centroid shift this frame
    const centDelta = f > 0 ? cent - centroidHz[f - 1] : 0;
    directionalFlux[f] = (centDelta >= 0 ? 1 : -1) * frameFlux;

    const meanF2 = centDen > 0 ? f2pSum / centDen : 0;
    const bwSq   = meanF2 - cent * cent;
    bandwidthHz[f] = bwSq > 0 ? Math.sqrt(bwSq) : 0;

    // SEF95
    const threshold95 = centDen * 0.95;
    let cumPow = 0;
    let sef = fs / 2;
    for (let k = 0; k < numBins; k++) {
      cumPow += prevPow[k];
      if (cumPow >= threshold95) { sef = k * binHz; break; }
    }
    sef95Hz[f] = sef;

    // 1/f slope
    let sumLogP = 0, sumLogFP = 0, validN = 0;
    for (let j = 0; j < slopeN; j++) {
      const p = prevPow[slopeBinLo + j];
      if (p > 1e-20) {
        const logP = Math.log10(p);
        sumLogP  += logP;
        sumLogFP += logFreqs[j] * logP;
        validN++;
      }
    }
    if (validN > 2) {
      const denom = slopeN * sumLogF2 - sumLogF * sumLogF;
      slope[f] = denom > 1e-20
        ? (slopeN * sumLogFP - sumLogF * sumLogP) / denom : 0;
    } else {
      slope[f] = 0;
    }
  }

  return { centroidHz, flux, directionalFlux, bandwidthHz, slope, sef95Hz, hop: hopSamps, numFrames };
}


// ─────────────────────────────────────────────────────────────────────────────
// STFT PASS 2 — Band powers (2s window for delta resolution)
// ─────────────────────────────────────────────────────────────────────────────

function _stftBandPowers(signal, fs, bands, windowSec = 2.0, hopSec = 1.0) {
  const n        = signal.length;
  const winSamps = Math.max(1, Math.floor(fs * windowSec));
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
    lobin: Math.max(0,           Math.ceil(b.lo / binHz)),
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
      bandPowFrames[b][f] = Math.sqrt(sum / (hibin - lobin + 1));
    }
  }

  return { bandPowFrames, hop: hopSamps, numFrames };
}


// ─────────────────────────────────────────────────────────────────────────────
// INTERPOLATION
// ─────────────────────────────────────────────────────────────────────────────

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
// PPAF
// ─────────────────────────────────────────────────────────────────────────────

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
// RMS ENVELOPE — drift-safe, used for all three fixed windows
// ─────────────────────────────────────────────────────────────────────────────

export function rmsEnvelope(data, windowSamples) {
  const n   = data.length;
  const env = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += data[i] * data[i];
    if (i >= windowSamples) sum -= data[i - windowSamples] * data[i - windowSamples];
    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      sum = 0;
      const lo = Math.max(0, i - windowSamples + 1);
      for (let j = lo; j <= i; j++) sum += data[j] * data[j];
    }
    if (sum < 0) sum = 0;
    env[i] = Math.sqrt(sum / Math.min(i + 1, windowSamples));
  }
  return env;
}


// ─────────────────────────────────────────────────────────────────────────────
// RMS ENVELOPE — downsampled output (for band-specific RMS)
//
// Runs the same drift-safe sliding window at full sample rate but only
// stores output every `skip` samples. Same accuracy, ~17× less memory.
// ─────────────────────────────────────────────────────────────────────────────

function rmsEnvelopeDownsampled(data, windowSamples, skip) {
  const n = data.length;
  const outLen = Math.ceil(n / skip);
  const env = new Float32Array(outLen);
  let sum = 0;
  let outIdx = 0;

  for (let i = 0; i < n; i++) {
    sum += data[i] * data[i];
    if (i >= windowSamples) sum -= data[i - windowSamples] * data[i - windowSamples];

    // Periodic recomputation for drift safety
    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      sum = 0;
      const lo = Math.max(0, i - windowSamples + 1);
      for (let j = lo; j <= i; j++) sum += data[j] * data[j];
    }
    if (sum < 0) sum = 0;

    // Only store at the downsampled rate
    if (i % skip === 0) {
      env[outIdx++] = Math.sqrt(sum / Math.min(i + 1, windowSamples));
    }
  }
  return env;
}


// ─────────────────────────────────────────────────────────────────────────────
// LINE LENGTH — drift-safe
// ─────────────────────────────────────────────────────────────────────────────

function _lineLength(signal, fs, windowMs = 200) {
  const n   = signal.length;
  const win = Math.max(2, Math.floor(fs * windowMs / 1000));
  const ll  = new Float32Array(n);
  let sum = 0;
  for (let i = 1; i < n; i++) {
    const diff = Math.abs(signal[i] - signal[i - 1]);
    sum += diff;
    if (i > win) sum -= Math.abs(signal[i - win] - signal[i - win - 1]);
    if ((i & RECOMPUTE_MASK) === 0) {
      sum = 0;
      const lo = Math.max(1, i - win + 1);
      for (let j = lo; j <= i; j++) sum += Math.abs(signal[j] - signal[j - 1]);
    }
    if (sum < 0) sum = 0;
    ll[i] = sum / Math.min(i, win);
  }
  ll[0] = ll[1] || 0;
  return ll;
}


// ─────────────────────────────────────────────────────────────────────────────
// HJORTH PARAMETERS — mobility + complexity, shared derivative, drift-safe
// ─────────────────────────────────────────────────────────────────────────────

function _hjorthParams(data, fs, windowMs = 200) {
  const win = Math.floor(fs * windowMs / 1000);
  const len = data.length;
  const mob = new Float32Array(len);
  const cpx = new Float32Array(len);

  const d1 = new Float32Array(len);
  for (let i = 1; i < len; i++) d1[i] = (data[i] - data[i - 1]) * fs;
  d1[0] = d1[1] || 0;

  const d2 = new Float32Array(len);
  for (let i = 1; i < len; i++) d2[i] = (d1[i] - d1[i - 1]) * fs;
  d2[0] = d2[1] || 0;

  let sigSum = 0, d1Sum = 0, d2Sum = 0;
  for (let i = 0; i < len; i++) {
    sigSum += data[i] * data[i];
    d1Sum  += d1[i]   * d1[i];
    d2Sum  += d2[i]   * d2[i];
    if (i >= win) {
      sigSum -= data[i - win] * data[i - win];
      d1Sum  -= d1[i - win]   * d1[i - win];
      d2Sum  -= d2[i - win]   * d2[i - win];
    }
    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      sigSum = 0; d1Sum = 0; d2Sum = 0;
      const lo = Math.max(0, i - win + 1);
      for (let j = lo; j <= i; j++) {
        sigSum += data[j] * data[j];
        d1Sum  += d1[j]   * d1[j];
        d2Sum  += d2[j]   * d2[j];
      }
    }
    if (sigSum < 0) sigSum = 0;
    if (d1Sum  < 0) d1Sum  = 0;
    if (d2Sum  < 0) d2Sum  = 0;

    const w      = Math.min(i + 1, win);
    const sigRMS = Math.sqrt(sigSum / w);
    const d1RMS  = Math.sqrt(d1Sum / w);
    const d2RMS  = Math.sqrt(d2Sum / w);

    const m = sigRMS > 1e-6 ? (d1RMS / sigRMS) / (2 * Math.PI) : 0;
    mob[i] = m;
    const mobD1 = d1RMS > 1e-6 ? (d2RMS / d1RMS) / (2 * Math.PI) : 0;
    cpx[i] = m > 1e-6 ? mobD1 / m : 1.0;
  }
  return { mobility: mob, complexity: cpx };
}

export function hjorthMobility(data, fs, windowMs = 200) {
  return _hjorthParams(data, fs, windowMs).mobility;
}


// ─────────────────────────────────────────────────────────────────────────────
// PERMUTATION ENTROPY — O(n) with 6-element counter
// ─────────────────────────────────────────────────────────────────────────────

function _permutationEntropy(signal, fs, windowMs = 500) {
  const n   = signal.length;
  const win = Math.max(10, Math.floor(fs * windowMs / 1000));
  const pe  = new Float32Array(n);

  const nPatterns = 6;
  const logM = Math.log(nPatterns);

  function patIdx(a, b, c) {
    if (a < b) {
      if (b < c) return 0;
      if (a < c) return 1;
      return 3;
    } else {
      if (a < c) return 2;
      if (b < c) return 4;
      return 5;
    }
  }

  const pats = new Uint8Array(n);
  const end  = n - 2;
  for (let i = 0; i < end; i++) {
    pats[i] = patIdx(signal[i], signal[i + 1], signal[i + 2]);
  }
  for (let i = Math.max(0, end); i < n; i++) pats[i] = pats[end - 1] || 0;

  const counts = new Int32Array(nPatterns);
  let windowN = 0;

  for (let i = 0; i < n; i++) {
    counts[pats[i]]++;
    windowN++;
    if (i >= win) { counts[pats[i - win]]--; windowN--; }

    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      counts.fill(0); windowN = 0;
      const lo = Math.max(0, i - win + 1);
      for (let j = lo; j <= i; j++) { counts[pats[j]]++; windowN++; }
    }

    let H = 0;
    const wn = Math.max(1, windowN);
    for (let p = 0; p < nPatterns; p++) {
      if (counts[p] > 0) {
        const prob = counts[p] / wn;
        H -= prob * Math.log(prob);
      }
    }
    pe[i] = H / logM;
  }
  return pe;
}


// ─────────────────────────────────────────────────────────────────────────────
// SLOPE ASYMMETRY — rise/fall temporal shape (morphology modulator)
//
// Ratio of positive-slope RMS to negative-slope RMS within a window.
// Pure sine → 1.0 (symmetric). Spike-and-wave → >>1 (fast rise, slow fall).
// Reversed (slow rise, fast fall) → <<1.
//
// Used by Morphology: sharp transients momentarily widen harmonic range.
// ─────────────────────────────────────────────────────────────────────────────

function _slopeAsymmetry(signal, fs, windowMs = 200) {
  const n   = signal.length;
  const win = Math.max(4, Math.floor(fs * windowMs / 1000));
  const sa  = new Float32Array(n);

  let posSum = 0, negSum = 0;
  let posCnt = 0, negCnt = 0;

  for (let i = 1; i < n; i++) {
    const d = signal[i] - signal[i - 1];
    const ad = Math.abs(d);

    if (d > 0) { posSum += ad; posCnt++; }
    else       { negSum += ad; negCnt++; }

    if (i > win) {
      const dOld = signal[i - win] - signal[i - win - 1];
      const adOld = Math.abs(dOld);
      if (dOld > 0) { posSum -= adOld; posCnt--; }
      else          { negSum -= adOld; negCnt--; }
    }

    // Periodic recomputation for drift safety
    if ((i & RECOMPUTE_MASK) === 0) {
      posSum = 0; negSum = 0; posCnt = 0; negCnt = 0;
      const lo = Math.max(1, i - win + 1);
      for (let j = lo; j <= i; j++) {
        const dj = signal[j] - signal[j - 1];
        const adj = Math.abs(dj);
        if (dj > 0) { posSum += adj; posCnt++; }
        else        { negSum += adj; negCnt++; }
      }
    }

    if (posSum < 0) posSum = 0;
    if (negSum < 0) negSum = 0;

    // Ratio of mean positive slope to mean negative slope
    // Result: 1.0 = symmetric, >1 = fast rise / slow fall, <1 = slow rise / fast fall
    const posMean = posCnt > 0 ? posSum / posCnt : 0;
    const negMean = negCnt > 0 ? negSum / negCnt : 0;
    const denom = posMean + negMean;

    // Map to [0, 1] where 0.5 = symmetric:
    //   posMean / (posMean + negMean) → 0.5 for sine, >0.5 for sharp rise
    sa[i] = denom > 1e-9 ? posMean / denom : 0.5;
  }
  sa[0] = sa[1] || 0.5;

  return sa;
}


// ─────────────────────────────────────────────────────────────────────────────
// DUTY CYCLE — fraction of time signal is positive (morphology diagnostic)
//
// 0.5 = symmetric oscillation. 0.2 = brief positive, long negative (spike-wave).
// Computed as windowed running average of (voltage > 0) indicator.
// Primarily a diagnostic/display feature, not a synthesis modulator.
// ─────────────────────────────────────────────────────────────────────────────

function _dutyCycle(signal, fs, windowMs = 500) {
  const n   = signal.length;
  const win = Math.max(4, Math.floor(fs * windowMs / 1000));
  const dc  = new Float32Array(n);

  let posCount = 0;

  for (let i = 0; i < n; i++) {
    if (signal[i] > 0) posCount++;
    if (i >= win && signal[i - win] > 0) posCount--;

    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      posCount = 0;
      const lo = Math.max(0, i - win + 1);
      for (let j = lo; j <= i; j++) {
        if (signal[j] > 0) posCount++;
      }
    }

    dc[i] = posCount / Math.min(i + 1, win);
  }

  return dc;
}


// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE RMS — power-weighted band-driven blend of fast/mid/slow
//
// Computes a power-weighted average center frequency across ALL bands,
// then maps that to an ideal RMS window (2 cycles of the effective frequency).
// The three fixed RMS envelopes are blended via Bézier interpolation.
//
// Unlike winner-takes-all (which flips discretely between bands), power
// weighting produces a continuous, stable blend parameter. When one band
// dominates (e.g., theta seizure), the weighted average converges to that
// band's center anyway. When power is mixed (interictal baseline), the
// average sits between contributing bands — no jumping.
//
// Band center frequencies:
//   delta=2Hz → ideal 1000ms → pure slowRMS
//   theta=6Hz → ideal 333ms → midRMS ↔ slowRMS blend
//   alpha=10.5Hz → ideal 190ms → fastRMS ↔ midRMS blend
//   beta=21Hz → ideal 95ms → fastRMS ↔ midRMS blend
//   lowGamma=50Hz → ideal 40ms → pure fastRMS
//   highGamma=110Hz → ideal 18ms → pure fastRMS
//
// Blend is quadratic (Bézier-style) for smooth transitions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build adaptive RMS from three fixed-scale envelopes + band power data.
 *
 * @param {Float32Array} rawFast  — 50ms RMS (NOT normalized)
 * @param {Float32Array} rawMid   — 250ms RMS (NOT normalized)
 * @param {Float32Array} rawSlow  — 1500ms RMS (NOT normalized)
 * @param {Object} bandPowFrames  — { name: Float32Array } at hop rate (NOT interpolated)
 * @param {Array<{name, lo, hi}>} availBands — bands that were computed
 * @param {number} bpHop          — hop in samples for band power frames
 * @param {number} n              — signal length
 * @returns {Float32Array} — NOT normalized (same scale as raw RMS)
 */
function _adaptiveRMS(rawFast, rawMid, rawSlow, bandPowFrames, availBands, bpHop, n) {
  const adaptive = new Float32Array(n);

  // Center frequencies for each band
  const bandCenters = {
    delta: 2, theta: 6, alpha: 10.5, beta: 21.5,
    lowGamma: 50, highGamma: 110, hfoRipple: 165, hfoFast: 375,
  };

  // Power-weighted average center frequency across ALL bands.
  // Each band contributes proportionally to its power — no discrete switching.
  // When one band dominates, the weighted average converges to that band's
  // center frequency (same as winner-takes-all in the limit).
  // When power is mixed, the average sits between the contributing bands,
  // producing a smooth, stable window selection.
  const numBpFrames = availBands.length > 0 ? bandPowFrames[availBands[0].name]?.length ?? 0 : 0;
  const domFreqAtFrame = new Float32Array(numBpFrames);

  for (let f = 0; f < numBpFrames; f++) {
    let sumPow = 0, sumWeighted = 0;
    for (let b = 0; b < availBands.length; b++) {
      const pow = bandPowFrames[availBands[b].name]?.[f] ?? 0;
      const center = bandCenters[availBands[b].name] ?? 10;
      sumWeighted += pow * center;
      sumPow += pow;
    }
    domFreqAtFrame[f] = sumPow > 1e-9 ? sumWeighted / sumPow : 10;
  }

  // Interpolate dominant frequency to sample rate (smooth 1s transitions)
  const domFreq = bpHop > 0 ? _interpolate(domFreqAtFrame, bpHop, n) : null;

  for (let i = 0; i < n; i++) {
    // Ideal window in ms: 2 cycles of dominant frequency
    const freq = domFreq ? domFreq[i] : 10;
    const idealMs = freq > 0.5 ? 2000 / freq : 1500;

    // Quadratic blend across three scales:
    //   idealMs ≤ 50    → pure fast
    //   idealMs = 250   → pure mid
    //   idealMs ≥ 1500  → pure slow
    //   Between → smooth quadratic (Bézier) interpolation

    let val;
    if (idealMs <= 50) {
      val = rawFast[i];
    } else if (idealMs <= 250) {
      // Blend fast → mid
      const t = (idealMs - 50) / 200;
      val = rawFast[i] * (1 - t) * (1 - t)
          + rawMid[i]  * 2 * t * (1 - t)
          + rawMid[i]  * t * t;
    } else if (idealMs <= 1500) {
      // Blend mid → slow
      const t = (idealMs - 250) / 1250;
      val = rawMid[i]  * (1 - t) * (1 - t)
          + rawSlow[i] * 2 * t * (1 - t)
          + rawSlow[i] * t * t;
    } else {
      val = rawSlow[i];
    }

    adaptive[i] = val;
  }

  return adaptive;
}


// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

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
// BANDPASS + BANDS
// ─────────────────────────────────────────────────────────────────────────────

function _biquadBandpassCoeffs(fc, Q, fs) {
  const w0 = (2 * Math.PI * fc) / fs;
  const sinW0 = Math.sin(w0), cosW0 = Math.cos(w0);
  const alpha = sinW0 / (2 * Q);
  const a0 = 1 + alpha;
  return {
    b0: alpha/a0, b1: 0, b2: -alpha/a0,
    a1: (-2*cosW0)/a0, a2: (1-alpha)/a0,
  };
}

function _applyBandpassBiquad(data, c, out) {
  if (!out) out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

export function bandpass(data, lo, hi, fs, passes = 2) {
  if (lo >= hi || lo >= fs / 2) return new Float32Array(data.length);
  const fc = Math.sqrt(lo * hi);
  const Q = Math.max(fc / (hi - lo), 0.5);
  const coeffs = _biquadBandpassCoeffs(fc, Q, fs);

  // Ping-pong between two buffers to avoid intermediate allocations
  const buf1 = new Float32Array(data.length);
  const buf2 = new Float32Array(data.length);

  _applyBandpassBiquad(data, coeffs, buf1);
  if (passes >= 2) {
    _applyBandpassBiquad(buf1, coeffs, buf2);
    return buf2;
  }
  return buf1;
}

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

function _pct(arr, p) {
  const maxSamples = 10_000;
  const step = Math.max(1, Math.floor(arr.length / maxSamples));
  const sample = [];
  for (let i = 0; i < arr.length; i += step) sample.push(arr[i]);
  sample.sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sample.length - 1, Math.floor(p * (sample.length - 1))));
  return sample[idx];
}

export function normalizePct(arr, pLo = 0.05, pHi = 0.95) {
  const floor = _pct(arr, pLo);
  const ceiling = _pct(arr, pHi);
  const range = ceiling - floor;
  const out = new Float32Array(arr.length);
  if (range < 1e-12) return out;
  for (let i = 0; i < arr.length; i++) {
    out[i] = Math.max(0, Math.min(1, (arr[i] - floor) / range));
  }
  return out;
}

function _amplitudeCalibration(signal) {
  const abs = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) abs[i] = Math.abs(signal[i]);
  return { ampFloor: _pct(abs, 0.05), ampCeiling: _pct(abs, 0.95) };
}


// ─────────────────────────────────────────────────────────────────────────────
// WAVETABLE PRECOMPUTATION
//
// Extracts Fourier coefficients from sliding windows of the EEG signal.
// Each snapshot captures the harmonic shape of the waveform at that moment.
// During playback, the engine applies these via setPeriodicWave() so the
// oscillator's timbre IS the brain signal's shape.
//
// Memory: 32 harmonics × 2 arrays × 4 bytes × 10 fps × 240s ≈ 614 KB/ch.
// ─────────────────────────────────────────────────────────────────────────────

const WAVETABLE_RATE = 10;   // snapshots per second
const WT_WINDOW      = 256;  // FFT window size (samples)
const WT_HARMONICS   = 32;   // harmonics to extract

export function precomputeWavetables(signal, fs, numHarmonics = WT_HARMONICS) {
  const durSec  = signal.length / fs;
  const nSnaps  = Math.max(2, Math.ceil(durSec * WAVETABLE_RATE));
  const snapshots = new Array(nSnaps);
  const halfWin = Math.floor(WT_WINDOW / 2);

  const hann = new Float32Array(WT_WINDOW);
  for (let i = 0; i < WT_WINDOW; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (WT_WINDOW - 1)));
  }

  for (let si = 0; si < nSnaps; si++) {
    const timeSec = si / WAVETABLE_RATE;
    const center  = Math.floor(timeSec * fs);
    const start   = Math.max(0, center - halfWin);

    const real = new Float32Array(numHarmonics + 1);
    const imag = new Float32Array(numHarmonics + 1);

    // Partial DFT — only first numHarmonics (not full FFT)
    for (let k = 1; k <= numHarmonics; k++) {
      let re = 0, im = 0;
      const freqStep = 2 * Math.PI * k / WT_WINDOW;
      for (let i = 0; i < WT_WINDOW; i++) {
        const idx = start + i;
        const sample = idx < signal.length ? signal[idx] : 0;
        const windowed = sample * hann[i];
        const angle = freqStep * i;
        re += windowed * Math.cos(angle);
        im -= windowed * Math.sin(angle);
      }
      real[k] = re / WT_WINDOW;
      imag[k] = im / WT_WINDOW;
    }

    snapshots[si] = { real, imag };
  }

  return { rate: WAVETABLE_RATE, snapshots };
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all features from a single preprocessed channel.
 *
 * Computation order:
 *   1.  Hilbert (1 FFT)               → envelope, phase, instFreq
 *   2.  STFT pass 1 (5 from 1 pass)   → centroid, flux, bandwidth, slope, sef95
 *   3.  PPAF                           → ppaf
 *   4.  RMS × 3 fixed windows          → fastRMS, midRMS, slowRMS → rmsRatio
 *   5.  Hjorth (shared deriv)          → mobility, complexity
 *   6.  Line length                    → lineLength
 *   7.  Permutation entropy            → permEntropy
 *   8.  Signal statistics              → skewness, kurtosis
 *   9.  STFT pass 2 (band powers)      → per-band power
 *  10.  Adaptive RMS (from 4 + 9)     → adaptiveRMS
 *  11.  Amplitude calibration          → ampFloor, ampCeiling
 *  12.  Normalize all to [0, 1]
 *
 * @param {Float32Array} signal
 * @param {number} fs
 * @returns {FeatureObject}
 */
export function extractFeatures(signal, fs) {
  const n       = signal.length;
  const nyquist = fs / 2;

  // ── 1. Hilbert ─────────────────────────────────────────────────────────────
  const { envelope: rawEnv, phase } = hilbertAnalytic(signal);
  const rawInstFreq = phaseToInstFreq(phase, fs);

  // ── 2. STFT pass 1 — 5 spectral features ──────────────────────────────────
  const {
    centroidHz, flux: fluxFrames, directionalFlux: dirFluxFrames,
    bandwidthHz, slope: slopeFrames, sef95Hz, hop
  } = _stftSpectralFeatures(signal, fs, 256, 64);

  const rawCentroid       = _interpolate(centroidHz,    hop, n);
  const rawFlux           = _interpolate(fluxFrames,    hop, n);
  const rawDirectionalFlux = _interpolate(dirFluxFrames, hop, n);
  const rawBandwidth      = _interpolate(bandwidthHz,   hop, n);
  const rawSlope          = _interpolate(slopeFrames,   hop, n);
  const rawSef95     = _interpolate(sef95Hz,      hop, n);

  // ── 3. PPAF ────────────────────────────────────────────────────────────────
  const rawPpaf = _ppaf(signal, fs, 7.5);

  // ── 4. Three fixed RMS envelopes ───────────────────────────────────────────
  const fastWin = Math.floor(fs * 0.050);    // 50ms — bursts, HFOs
  const midWin  = Math.floor(fs * 0.250);    // 250ms — BIOPAC standard, oscillatory
  const slowWin = Math.floor(fs * 1.5);      // 1500ms — overall contour

  const rawFast = rmsEnvelope(signal, fastWin);
  const rawMid  = rmsEnvelope(signal, midWin);
  const rawSlow = rmsEnvelope(signal, slowWin);

  // RMS ratio: fast/slow local anomaly
  const rawRatio = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rawRatio[i] = rawSlow[i] > 1e-9 ? rawFast[i] / rawSlow[i] : 0;
  }

  // ── 5. Hjorth ──────────────────────────────────────────────────────────────
  const { mobility: rawMobility, complexity: rawComplexity } =
    _hjorthParams(signal, fs, 200);

  // ── 6. Line length ─────────────────────────────────────────────────────────
  const rawLineLength = _lineLength(signal, fs, 200);

  // ── 7. Permutation entropy ─────────────────────────────────────────────────
  const rawPermEntropy = _permutationEntropy(signal, fs, 500);

  // ── 7b. Morphology features ───────────────────────────────────────────────
  const rawSlopeAsym = _slopeAsymmetry(signal, fs, 200);
  const rawDutyCycle = _dutyCycle(signal, fs, 500);

  // ── 8. Signal statistics ───────────────────────────────────────────────────
  const signalSkewness = _globalSkewness(signal);
  const signalKurtosis = _globalKurtosis(signal);

  // ── 9. Band powers (STFT pass 2) ──────────────────────────────────────────
  const availBands = BANDS
    .filter(b => b.lo < nyquist)
    .map(b => ({ name: b.name, lo: b.lo, hi: Math.min(b.hi, nyquist - 1) }));

  const { bandPowFrames, hop: bpHop } = _stftBandPowers(signal, fs, availBands);

  // Store raw band powers at frame rate (for adaptive RMS) AND interpolated
  const bandPowRawFrames = {};
  const bandPowersRaw = {};
  for (let b = 0; b < availBands.length; b++) {
    bandPowRawFrames[availBands[b].name] = bandPowFrames[b];
    bandPowersRaw[availBands[b].name] = _interpolate(bandPowFrames[b], bpHop, n);
  }

  // ── 9b. Band-specific RMS at all 3 time scales (downsampled to 60 Hz) ──
  // Runs sliding window at full sample rate for accuracy, but only stores
  // one output per automation frame. Memory: ~900KB per channel vs ~20MB.
  // Reusable bandpass buffers avoid 12 allocations per band.
  const bandRMS = {};
  const rmsSkip = Math.max(1, Math.floor(fs / DOWNSAMPLE_RATE));

  const _bpBuf1 = new Float32Array(n);
  const _bpBuf2 = new Float32Array(n);

  for (let b = 0; b < availBands.length; b++) {
    const band = availBands[b];
    const fc = Math.sqrt(band.lo * band.hi);
    const Q = Math.max(fc / (band.hi - band.lo), 0.5);
    const coeffs = _biquadBandpassCoeffs(fc, Q, fs);

    _applyBandpassBiquad(signal, coeffs, _bpBuf1);   // pass 1
    _applyBandpassBiquad(_bpBuf1, coeffs, _bpBuf2);  // pass 2

    bandRMS[band.name] = {
      fast: rmsEnvelopeDownsampled(_bpBuf2, fastWin, rmsSkip),
      mid:  rmsEnvelopeDownsampled(_bpBuf2, midWin, rmsSkip),
      slow: rmsEnvelopeDownsampled(_bpBuf2, slowWin, rmsSkip),
    };
  }

  // ── 10. Adaptive RMS (blends fast/mid/slow using dominant band) ────────────
  const rawAdaptive = _adaptiveRMS(
    rawFast, rawMid, rawSlow,
    bandPowRawFrames, availBands, bpHop, n
  );

  // ── 11. Amplitude calibration ──────────────────────────────────────────────
  const { ampFloor, ampCeiling } = _amplitudeCalibration(signal);

  // ── 12. Normalize ──────────────────────────────────────────────────────────

  const instFreqNorm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    instFreqNorm[i] = Math.max(0, Math.min(1, (rawInstFreq[i] + nyquist) / (2 * nyquist)));
  }

  const bandPowers = {};
  for (const [name, raw] of Object.entries(bandPowersRaw)) {
    bandPowers[name] = normalizePct(raw);
  }

  return {
    cleanSignal: signal,

    // ── Hilbert (3) ──────────────────────────────────────────────────────────
    envelope:     normalizePct(rawEnv),
    phase,
    instFreq:     instFreqNorm,

    // ── STFT pass 1 (5+1) ───────────────────────────────────────────────────
    centroid:          normalizePct(rawCentroid),
    spectralFlux:      normalizePct(rawFlux),
    directionalFlux:   rawDirectionalFlux,    // signed, NOT normalized (direction matters)
    spectralBandwidth: normalizePct(rawBandwidth),
    spectralSlope:     normalizePct(rawSlope),
    sef95:             normalizePct(rawSef95),

    // ── Amplitude (7) ────────────────────────────────────────────────────────
    ppaf:        normalizePct(rawPpaf),   // [0,1] for display
    ppafRaw:     rawPpaf,                 // raw µV for absolute threshold detection
    fastRMS:     normalizePct(rawFast),       // 50ms — bursts
    midRMS:      normalizePct(rawMid),        // 250ms — oscillatory (BIOPAC standard)
    slowRMS:     normalizePct(rawSlow),       // 1500ms — contour
    adaptiveRMS: normalizePct(rawAdaptive),   // band-driven blend of fast/mid/slow
    rmsRatio:    normalizePct(rawRatio),       // fast/slow anomaly
    lineLength:  normalizePct(rawLineLength),

    // ── Complexity (3) ───────────────────────────────────────────────────────
    mobility:    normalizePct(rawMobility),
    complexity:  normalizePct(rawComplexity),
    permEntropy: normalizePct(rawPermEntropy),

    // ── Morphology (2) ──────────────────────────────────────────────────────
    slopeAsymmetry: normalizePct(rawSlopeAsym),   // rise/fall ratio → range modulation
    dutyCycle:      rawDutyCycle,                   // [0,1] already — 0.5 = symmetric

    // ── Band powers ──────────────────────────────────────────────────────────
    bandPowers,

    // ── Band-specific RMS (3 time scales per band, RAW not normalized) ─────
    bandRMS,

    // ── Scalars ──────────────────────────────────────────────────────────────
    signalStats: { skewness: signalSkewness, kurtosis: signalKurtosis },

    // ── Wavetable (precomputed harmonic snapshots) ─────────────────────────
    wavetable: precomputeWavetables(signal, fs),

    // ── Calibration ──────────────────────────────────────────────────────────
    calibration: { ampFloor, ampCeiling, fs },
  };
}