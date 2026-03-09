/**
 * dsp.js — Feature Extraction Pipeline (v8.2r2)
 *
 * Runs once per channel after preprocessing. Produces a `features` object
 * containing Float32Arrays for every auditory dimension, all sample-aligned,
 * all normalized to [0, 1] except phase (which stays in [-π, π]).
 *
 * FEATURE INVENTORY (21 time-series + 2 scalars + band powers):
 *
 *   From Hilbert (1 FFT call → 3 features):
 *     envelope, phase, instFreq
 *
 *   From STFT pass 1 (256ms window, 64ms hop → 5 features, ONE FFT per frame):
 *     centroid, spectralFlux, spectralBandwidth, spectralSlope, sef95
 *
 *   From STFT pass 2 (2s window, 1s hop → per-band powers):
 *     bandPowers { delta, theta, alpha, beta, lowGamma, highGamma, ... }
 *
 *   Time-domain (single O(n) pass each):
 *     ppaf, slowRMS, fastRMS, rmsRatio, lineLength
 *
 *   Complexity (shared derivative between mobility + complexity):
 *     mobility, complexity, permEntropy
 *
 *   Scalars (computed once per channel):
 *     signalStats { skewness, kurtosis }
 *
 * NUMERICAL ROBUSTNESS:
 *   All sliding-window running sums use periodic recomputation every
 *   RECOMPUTE_INTERVAL samples to prevent float accumulation drift.
 *   At 2kHz × 60min = 7.2M samples, naive running sums lose ~3-4 bits
 *   of mantissa. Recomputing from scratch every 8192 samples keeps
 *   error below 1 ULP. Cost: O(window) every 8192 samples = O(1) amortized.
 *
 * Exports:
 *   extractFeatures(signal, fs)   → features object  (main entry point)
 *   hilbertAnalytic(data)         → { envelope, phase }
 *   rmsEnvelope(data, winSamples) → Float32Array
 *   bandpass(data, lo, hi, fs)    → Float32Array
 *   normalizePct(arr, pLo, pHi)  → Float32Array
 *   BANDS                         → canonical band definitions
 */


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Running-sum recomputation interval. Every this many samples, sliding-window
 * accumulators are recomputed from scratch to eliminate float drift.
 * 8192 chosen because: (a) it's a power of 2 (fast modulo via bitmask),
 * (b) at worst-case 2s window × 2kHz = 4000 samples, the recompute cost
 * is 4000/8192 ≈ 0.5 extra passes amortized = negligible.
 */
const RECOMPUTE_INTERVAL = 8192;
const RECOMPUTE_MASK     = RECOMPUTE_INTERVAL - 1;  // for fast i & mask === 0


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
 * Instantaneous frequency from Hilbert phase.
 * Moving-average smoothing with periodic recomputation to prevent drift.
 */
function phaseToInstFreq(phase, fs, smoothMs = 10) {
  const len         = phase.length;
  const nyquist     = fs / 2;
  const instFreq    = new Float32Array(len);
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

    // Initialize window
    for (let i = 0; i < Math.min(smoothSamps, len); i++) sum += instFreq[i];

    for (let i = 0; i < len; i++) {
      const a = i + h, r = i - h - 1;
      if (a < len) sum += instFreq[a];
      if (r >= 0)  sum -= instFreq[r];

      // Periodic recomputation to prevent float drift
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
//
// Extracts centroid, flux, bandwidth, 1/f slope, and SEF95 from each frame's
// power spectrum. One FFT per frame, five features out.
//
// Per-frame overhead vs old 2-feature version:
//   bandwidth: +1 accumulator in existing bin loop (f²×P)
//   SEF95: +1 cumulative scan over bins (~128 iterations)
//   slope: +~50 log10 calls + regression formula
//   Total: ~15% additional cost, zero additional FFTs.
// ─────────────────────────────────────────────────────────────────────────────

function _stftSpectralFeatures(signal, fs, windowMs = 256, hopMs = 64) {
  const n        = signal.length;
  const winSamps = Math.floor(fs * windowMs / 1000);
  const N        = nextPow2(winSamps);
  const hopSamps = Math.floor(fs * hopMs / 1000);
  const numBins  = N / 2 + 1;
  const binHz    = fs / N;

  const hann = new Float64Array(winSamps);
  for (let i = 0; i < winSamps; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winSamps - 1)));
  }

  const numFrames   = Math.max(1, Math.ceil(n / hopSamps));
  const centroidHz  = new Float32Array(numFrames);
  const flux        = new Float32Array(numFrames);
  const bandwidthHz = new Float32Array(numFrames);
  const slope       = new Float32Array(numFrames);
  const sef95Hz     = new Float32Array(numFrames);

  const re      = new Float64Array(N);
  const im      = new Float64Array(N);
  const prevPow = new Float64Array(numBins);

  // Pre-compute log frequencies for slope regression (skip DC)
  // Range: ~1 Hz to Nyquist/2 to avoid edge effects
  const slopeBinLo = Math.max(1, Math.ceil(1.0 / binHz));
  const slopeBinHi = Math.min(numBins - 1, Math.floor((fs / 4) / binHz));
  const slopeN     = Math.max(1, slopeBinHi - slopeBinLo + 1);
  const logFreqs   = new Float64Array(slopeN);
  let   sumLogF = 0, sumLogF2 = 0;
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

    // ── Single pass over bins: centroid + flux + bandwidth accumulators ───
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

    // Bandwidth = sqrt(E[f²] - centroid²) — variance formula, no second pass
    const meanF2 = centDen > 0 ? f2pSum / centDen : 0;
    const bwSq   = meanF2 - cent * cent;
    bandwidthHz[f] = bwSq > 0 ? Math.sqrt(bwSq) : 0;

    // ── SEF95: cumulative power scan ─────────────────────────────────────
    const threshold95 = centDen * 0.95;
    let cumPow = 0;
    let sef = fs / 2;
    for (let k = 0; k < numBins; k++) {
      cumPow += prevPow[k];
      if (cumPow >= threshold95) { sef = k * binHz; break; }
    }
    sef95Hz[f] = sef;

    // ── 1/f slope: log-log linear regression ─────────────────────────────
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
        ? (slopeN * sumLogFP - sumLogF * sumLogP) / denom
        : 0;
    } else {
      slope[f] = 0;
    }
  }

  return { centroidHz, flux, bandwidthHz, slope, sef95Hz, hop: hopSamps, numFrames };
}


// ─────────────────────────────────────────────────────────────────────────────
// STFT PASS 2 — Band powers (2s window for delta resolution)
// ─────────────────────────────────────────────────────────────────────────────

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
// INTERPOLATION — hop rate to sample rate
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
// PPAF — Peak-to-Peak Amplitude Fluctuation
//
// O(n × half_window) brute-force min/max scan. At 2kHz with 7.5ms half-window
// that's ~15 comparisons per sample — fast enough. A sliding deque O(n) would
// help if window size increases, but adds complexity not warranted here.
// Flagged for future optimization if halfWindowMs becomes configurable.
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
// RMS ENVELOPE — with periodic recomputation for drift prevention
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sliding-window RMS with drift-safe accumulation.
 *
 * Running sum-of-squares is recomputed from scratch every RECOMPUTE_INTERVAL
 * samples to prevent float accumulation error over millions of add/subtract
 * cycles. The guard `if (sum < 0) sum = 0` catches residual drift between
 * recomputation points.
 */
export function rmsEnvelope(data, windowSamples) {
  const n   = data.length;
  const env = new Float32Array(n);
  let sum = 0;

  for (let i = 0; i < n; i++) {
    sum += data[i] * data[i];
    if (i >= windowSamples) sum -= data[i - windowSamples] * data[i - windowSamples];

    // Periodic recomputation from scratch
    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      sum = 0;
      const lo = Math.max(0, i - windowSamples + 1);
      for (let j = lo; j <= i; j++) sum += data[j] * data[j];
    }

    if (sum < 0) sum = 0;  // catch residual drift between recomputations
    env[i] = Math.sqrt(sum / Math.min(i + 1, windowSamples));
  }

  return env;
}


// ─────────────────────────────────────────────────────────────────────────────
// LINE LENGTH — universal activity detector, drift-safe
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

    // Periodic recomputation
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
// HJORTH PARAMETERS — mobility + complexity from ONE shared derivative
//
// Both parameters share the first derivative. Complexity additionally needs
// the second derivative — one more O(n) pass on the first derivative.
// Three running accumulators (sigSum, d1Sum, d2Sum) all get periodic
// recomputation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{ mobility: Float32Array, complexity: Float32Array }}
 */
function _hjorthParams(data, fs, windowMs = 200) {
  const win = Math.floor(fs * windowMs / 1000);
  const len = data.length;
  const mob = new Float32Array(len);
  const cpx = new Float32Array(len);

  // First derivative (shared — computed once, used by both parameters)
  const d1 = new Float32Array(len);
  for (let i = 1; i < len; i++) d1[i] = (data[i] - data[i - 1]) * fs;
  d1[0] = d1[1] || 0;

  // Second derivative (for complexity only)
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

    // Periodic recomputation of all three accumulators
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

    // Mobility = d1RMS / sigRMS (in Hz, divided by 2π)
    const m = sigRMS > 1e-6 ? (d1RMS / sigRMS) / (2 * Math.PI) : 0;
    mob[i] = m;

    // Complexity = mobility(d1) / mobility(signal)
    const mobD1 = d1RMS > 1e-6 ? (d2RMS / d1RMS) / (2 * Math.PI) : 0;
    cpx[i] = m > 1e-6 ? mobD1 / m : 1.0;
  }

  return { mobility: mob, complexity: cpx };
}

// Legacy export for backwards compatibility
export function hjorthMobility(data, fs, windowMs = 200) {
  return _hjorthParams(data, fs, windowMs).mobility;
}


// ─────────────────────────────────────────────────────────────────────────────
// PERMUTATION ENTROPY — signal predictability/regularity
//
// Uses embedding dimension m=3, delay τ=1 → 6 possible ordinal patterns.
// Sliding window (~500ms) Shannon entropy normalized by log(3!) = log(6).
// O(n) with a 6-element integer counter — negligible per-sample cost.
//
// Low entropy = regular/predictable (seizure rhythm).
// High entropy = complex/irregular (normal baseline).
// ─────────────────────────────────────────────────────────────────────────────

function _permutationEntropy(signal, fs, windowMs = 500) {
  const n   = signal.length;
  const win = Math.max(10, Math.floor(fs * windowMs / 1000));
  const pe  = new Float32Array(n);

  const nPatterns = 6;  // 3! = 6
  const logM = Math.log(nPatterns);

  // Lehmer code for 3 elements → pattern index 0–5
  function patIdx(a, b, c) {
    if (a < b) {
      if (b < c) return 0;  // 0 1 2
      if (a < c) return 1;  // 0 2 1
      return 3;              // 2 0 1
    } else {
      if (a < c) return 2;  // 1 0 2
      if (b < c) return 4;  // 1 2 0
      return 5;              // 2 1 0
    }
  }

  // Pre-compute pattern index per sample
  const pats = new Uint8Array(n);
  const end  = n - 2;  // need i, i+1, i+2
  for (let i = 0; i < end; i++) {
    pats[i] = patIdx(signal[i], signal[i + 1], signal[i + 2]);
  }
  for (let i = Math.max(0, end); i < n; i++) pats[i] = pats[end - 1] || 0;

  // Sliding window entropy with periodic recomputation
  const counts = new Int32Array(nPatterns);
  let windowN = 0;

  for (let i = 0; i < n; i++) {
    counts[pats[i]]++;
    windowN++;

    if (i >= win) {
      counts[pats[i - win]]--;
      windowN--;
    }

    // Periodic recomputation of counts (prevents integer drift — unlikely
    // with Int32 but maintains consistency with other accumulators)
    if ((i & RECOMPUTE_MASK) === 0 && i > 0) {
      counts.fill(0);
      windowN = 0;
      const lo = Math.max(0, i - win + 1);
      for (let j = lo; j <= i; j++) {
        counts[pats[j]]++;
        windowN++;
      }
    }

    // Shannon entropy
    let H = 0;
    const wn = Math.max(1, windowN);
    for (let p = 0; p < nPatterns; p++) {
      if (counts[p] > 0) {
        const prob = counts[p] / wn;
        H -= prob * Math.log(prob);
      }
    }

    pe[i] = H / logM;  // normalize to [0, 1]
  }

  return pe;
}


// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL STATISTICS — scalars for distortion character
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
// BANDPASS + BAND DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

function _biquadBandpassCoeffs(fc, Q, fs) {
  const w0    = (2 * Math.PI * fc) / fs;
  const sinW0 = Math.sin(w0);
  const cosW0 = Math.cos(w0);
  const alpha = sinW0 / (2 * Q);
  const a0    = 1 + alpha;
  return {
    b0:  alpha / a0, b1: 0, b2: -alpha / a0,
    a1: (-2 * cosW0) / a0, a2: (1 - alpha) / a0,
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

export function bandpass(data, lo, hi, fs, passes = 2) {
  if (lo >= hi || lo >= fs / 2) return new Float32Array(data.length);
  const fc     = Math.sqrt(lo * hi);
  const Q      = Math.max(fc / (hi - lo), 0.5);
  const coeffs = _biquadBandpassCoeffs(fc, Q, fs);
  let result   = data;
  for (let p = 0; p < passes; p++) result = _applyBandpassBiquad(result, coeffs);
  return result;
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
  const step       = Math.max(1, Math.floor(arr.length / maxSamples));
  const sample     = [];
  for (let i = 0; i < arr.length; i += step) sample.push(arr[i]);
  sample.sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sample.length - 1, Math.floor(p * (sample.length - 1))));
  return sample[idx];
}

export function normalizePct(arr, pLo = 0.05, pHi = 0.95) {
  const floor   = _pct(arr, pLo);
  const ceiling = _pct(arr, pHi);
  const range   = ceiling - floor;
  const out     = new Float32Array(arr.length);
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
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all features from a single preprocessed channel.
 *
 * Computation order (shared intermediates marked):
 *
 *   1.  Hilbert (1 FFT)              → envelope, phase, instFreq
 *   2.  STFT pass 1 (5 from 1 pass)  → centroid, flux, bandwidth, slope, sef95
 *   3.  PPAF (O(n×w))                → ppaf
 *   4.  RMS × 2 (O(n) each)          → slowRMS, fastRMS → rmsRatio
 *   5.  Hjorth (SHARED deriv)         → mobility, complexity
 *   6.  Line length (O(n))            → lineLength
 *   7.  Perm. entropy (O(n))          → permEntropy
 *   8.  Signal stats (O(n/step))      → skewness, kurtosis [scalars]
 *   9.  STFT pass 2 (band powers)     → per-band RMS
 *  10.  Amp calibration               → ampFloor, ampCeiling [scalars]
 *  11.  Normalize all to [0, 1]
 *
 * Total FFTs: 1 (Hilbert) + numFrames_pass1 + numFrames_pass2
 * Total O(n) passes: ~10 linear, with drift-safe accumulators
 *
 * @param {Float32Array} signal — from preprocessRecording() channel.data
 * @param {number} fs
 * @returns {FeatureObject}
 */
export function extractFeatures(signal, fs) {
  const n       = signal.length;
  const nyquist = fs / 2;

  // ── 1. Hilbert analytic signal ─────────────────────────────────────────────
  const { envelope: rawEnv, phase } = hilbertAnalytic(signal);
  const rawInstFreq = phaseToInstFreq(phase, fs);

  // ── 2. STFT pass 1 — 5 spectral features from ONE FFT per frame ───────────
  const {
    centroidHz, flux: fluxFrames, bandwidthHz, slope: slopeFrames, sef95Hz,
    hop
  } = _stftSpectralFeatures(signal, fs, 256, 64);

  const rawCentroid  = _interpolate(centroidHz,   hop, n);
  const rawFlux      = _interpolate(fluxFrames,   hop, n);
  const rawBandwidth = _interpolate(bandwidthHz,  hop, n);
  const rawSlope     = _interpolate(slopeFrames,  hop, n);
  const rawSef95     = _interpolate(sef95Hz,      hop, n);

  // ── 3. PPAF ────────────────────────────────────────────────────────────────
  const rawPpaf = _ppaf(signal, fs, 7.5);

  // ── 4. RMS envelopes ───────────────────────────────────────────────────────
  const slowWin  = Math.floor(fs * 1.5);
  const fastWin  = Math.floor(fs * 0.050);
  const rawSlow  = rmsEnvelope(signal, slowWin);
  const rawFast  = rmsEnvelope(signal, fastWin);

  const rawRatio = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rawRatio[i] = rawSlow[i] > 1e-9 ? rawFast[i] / rawSlow[i] : 0;
  }

  // ── 5. Hjorth mobility + complexity (SHARED derivative) ────────────────────
  const { mobility: rawMobility, complexity: rawComplexity } =
    _hjorthParams(signal, fs, 200);

  // ── 6. Line length ─────────────────────────────────────────────────────────
  const rawLineLength = _lineLength(signal, fs, 200);

  // ── 7. Permutation entropy ─────────────────────────────────────────────────
  const rawPermEntropy = _permutationEntropy(signal, fs, 500);

  // ── 8. Signal statistics ───────────────────────────────────────────────────
  const signalSkewness = _globalSkewness(signal);
  const signalKurtosis = _globalKurtosis(signal);

  // ── 9. Band powers (STFT pass 2) ──────────────────────────────────────────
  const availBands = BANDS
    .filter(b => b.lo < nyquist)
    .map(b => ({ name: b.name, lo: b.lo, hi: Math.min(b.hi, nyquist - 1) }));

  const { bandPowFrames, hop: bpHop } = _stftBandPowers(signal, fs, availBands);

  const bandPowersRaw = {};
  for (let b = 0; b < availBands.length; b++) {
    bandPowersRaw[availBands[b].name] = _interpolate(bandPowFrames[b], bpHop, n);
  }

  // ── 10. Amplitude calibration ──────────────────────────────────────────────
  const { ampFloor, ampCeiling } = _amplitudeCalibration(signal);

  // ── 11. Normalize ──────────────────────────────────────────────────────────

  const instFreqNorm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    instFreqNorm[i] = Math.max(0, Math.min(1, (rawInstFreq[i] + nyquist) / (2 * nyquist)));
  }

  const bandPowers = {};
  for (const [name, raw] of Object.entries(bandPowersRaw)) {
    bandPowers[name] = normalizePct(raw);
  }

  return {
    // Raw signal reference (for Layer 2 voltage polarity + transient detection)
    cleanSignal: signal,

    // ── Hilbert-derived (3) ──────────────────────────────────────────────────
    envelope:     normalizePct(rawEnv),
    phase,                                        // [-π, π], NOT normalized
    instFreq:     instFreqNorm,                   // [0,1], 0.5 = 0 Hz

    // ── STFT-derived (5 from 1 pass) ─────────────────────────────────────────
    centroid:          normalizePct(rawCentroid),   // spectral center of mass
    spectralFlux:      normalizePct(rawFlux),       // onset-sensitive spectral change
    spectralBandwidth: normalizePct(rawBandwidth),  // spectral spread (narrow vs broad)
    spectralSlope:     normalizePct(rawSlope),      // 1/f exponent (brain state)
    sef95:             normalizePct(rawSef95),      // 95th percentile frequency

    // ── Amplitude (4) ────────────────────────────────────────────────────────
    ppaf:       normalizePct(rawPpaf),              // rapid voltage excursions
    slowRMS:    normalizePct(rawSlow),              // 1.5s energy
    fastRMS:    normalizePct(rawFast),              // 50ms energy
    rmsRatio:   normalizePct(rawRatio),             // local energy anomaly

    // ── Activity (1) ─────────────────────────────────────────────────────────
    lineLength: normalizePct(rawLineLength),        // universal activity level

    // ── Complexity (3, mobility+complexity share derivative) ──────────────────
    mobility:    normalizePct(rawMobility),         // Hjorth: mean frequency
    complexity:  normalizePct(rawComplexity),        // Hjorth: bandwidth / sine-likeness
    permEntropy: normalizePct(rawPermEntropy),       // predictability (low = regular)

    // ── Band powers (from STFT pass 2) ───────────────────────────────────────
    bandPowers,

    // ── Scalars (not time-series — for distortion curves) ────────────────────
    signalStats: {
      skewness: signalSkewness,
      kurtosis: signalKurtosis,
    },

    // ── Calibration metadata ─────────────────────────────────────────────────
    calibration: {
      ampFloor,
      ampCeiling,
      fs,
    },
  };
}