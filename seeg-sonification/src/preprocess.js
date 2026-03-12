/**
 * preprocess.js — Signal Preprocessing Pipeline
 *
 * Runs once at import time, after parseEDF() and analyzeImport().
 * Produces "clean" signal arrays stored in memory, ready for feature extraction.
 *
 * Pipeline order (v8 spec §4.1 — order is mandatory):
 *   Step 1: DC Removal         — per-channel mean subtraction
 *   Step 2: Notch Filtering    — zero-phase IIR biquad at lineFreq + harmonics
 *   Step 3: Re-referencing     — bipolar (SEEG) or common average (EEG)
 *   Step 4: Quality Assessment — RMS, variance, kurtosis, line noise residual
 *
 * Design decisions:
 *
 *   DC removal via mean subtraction rather than high-pass filter:
 *     A high-pass filter (even at 0.5 Hz) attenuates slow ictal activity in
 *     the delta band and introduces edge artifacts. Mean subtraction removes
 *     only the exact DC component (0 Hz) and is fully transparent — the result
 *     is uniquely determined and reversible. It also corrects the monopolar
 *     reference DC offset before bipolar derivation.
 *
 *   Zero-phase notch filter:
 *     Standard causal (single-pass) IIR filtering introduces a frequency-
 *     dependent phase shift. For line noise rejection this is acceptable in
 *     real-time, but for offline analysis it distorts the phase relationships
 *     between channels that are used for connectivity analysis and that are
 *     audible in the sonification. Forward + backward pass (filtfilt) doubles
 *     the effective filter order and eliminates all phase distortion.
 *
 *   Bipolar referencing for SEEG:
 *     The clinical standard. Each adjacent-contact subtraction localizes the
 *     recorded field potential to the tissue between the two contacts (~3.5 mm
 *     for standard SEEG electrodes). Shared far-field activity (including the
 *     reference electrode artifact) cancels in the subtraction.
 *
 *   Common Average Reference for scalp EEG:
 *     Removes globally shared noise (reference electrode, powerline residual).
 *     Known limitation: a single bad channel contaminates the average.
 *     Exclude known-bad channels before applying CAR.
 *
 * Exports:
 *   preprocessRecording(edfResult, importResult, options) → PreprocessResult
 *   removeDC(signal)                     → Float32Array
 *   applyNotch(signal, fs, lineFreq)     → Float32Array
 *   bipolarReference(contacts)           → Array<BipolarChannel>
 *   carReference(channels)               → Array<Float32Array>
 *   assessQuality(signal, fs, lineFreq)  → QualityReport
 *   notchCoeffs(fc, Q, fs)              → { b, a }   (exported for testing)
 *   applyZeroPhase(signal, b, a)         → Float32Array (exported for testing)
 */


// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: DC REMOVAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove the DC offset from a signal by subtracting its mean.
 *
 * This is applied to raw monopolar channels before any filtering or
 * re-referencing. It corrects for:
 *   - Reference electrode DC potential
 *   - Amplifier DC offset
 *   - Large baseline drift that could affect filter initialization
 *
 * The removed DC value is returned alongside the clean signal so that
 * calibration metadata can record what was removed.
 *
 * @param {Float32Array} signal — raw physical units (µV, mV, etc.)
 * @returns {{ clean: Float32Array, dc: number }}
 */
export function removeDC(signal) {
  const n = signal.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += signal[i];
  const dc = sum / n;

  const clean = new Float32Array(n);
  for (let i = 0; i < n; i++) clean[i] = signal[i] - dc;

  return { clean, dc };
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: NOTCH FILTERING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute IIR biquad notch (band-stop) filter coefficients.
 *
 * Uses the Audio EQ Cookbook formula (Robert Bristow-Johnson).
 * The notch has a very narrow rejection band centered at fc.
 *
 * Q = fc / bandwidth, so for a 2 Hz bandwidth:
 *   Q = fc / 2  →  Q=30 at 60 Hz, Q=25 at 50 Hz, Q=60 at 120 Hz
 *
 * Callers should pass Q = fc / 2 for consistent 2 Hz bandwidth
 * regardless of the harmonic being filtered.
 *
 * @param {number} fc — notch center frequency (Hz)
 * @param {number} Q  — quality factor (higher = narrower notch)
 * @param {number} fs — sample rate (Hz)
 * @returns {{ b: [b0,b1,b2], a: [1, a1,a2] }}  (normalized, a0=1)
 */
export function notchCoeffs(fc, Q, fs) {
  const w0    = (2 * Math.PI * fc) / fs;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Q);

  // Raw coefficients
  const b0 =  1;
  const b1 = -2 * cosw0;
  const b2 =  1;
  const a0 =  1 + alpha;
  const a1 = -2 * cosw0;
  const a2 =  1 - alpha;

  // Normalize so a[0] = 1
  return {
    b: [b0 / a0,  b1 / a0,  b2 / a0],
    a: [1,         a1 / a0,  a2 / a0],
  };
}

/**
 * Apply a biquad IIR filter in a single forward (causal) pass.
 *
 * Implements the Direct Form II transposed difference equation:
 *   y[n] = b[0]×x[n] + b[1]×x[n-1] + b[2]×x[n-2]
 *         - a[1]×y[n-1] - a[2]×y[n-2]
 *
 * This is a building block. For offline processing, use applyZeroPhase()
 * to eliminate phase distortion.
 *
 * @param {Float32Array} signal
 * @param {number[]} b — [b0, b1, b2]
 * @param {number[]} a — [1, a1, a2]  (a[0] must be 1)
 * @returns {Float32Array}
 */
export function applyBiquad(signal, b, a) {
  const n   = signal.length;
  const out = new Float32Array(n);

  let x1 = 0, x2 = 0;
  let y1 = 0, y2 = 0;

  for (let i = 0; i < n; i++) {
    const x0 = signal[i];
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2
                          - a[1] * y1 - a[2] * y2;
    out[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }

  return out;
}

/**
 * Apply a biquad filter with zero phase shift (forward + backward pass).
 *
 * Equivalent to MATLAB's filtfilt(). The forward pass is applied, the
 * output is reversed, the same filter is applied again, then reversed back.
 * This eliminates all phase distortion and doubles the effective filter order.
 *
 * Effect on the notch: a single-pass 2nd-order notch becomes an effective
 * 4th-order notch with zero phase, sharper rolloff, and symmetric response.
 *
 * Note on edge effects: the filter state is initialized at 0 on each pass.
 * For very long recordings with stable signal content this is negligible,
 * but the first and last few milliseconds of each channel may show minor
 * edge artifacts. This is acceptable for the notch filter application.
 *
 * @param {Float32Array} signal
 * @param {number[]} b — [b0, b1, b2]
 * @param {number[]} a — [1, a1, a2]
 * @returns {Float32Array}
 */
export function applyZeroPhase(signal, b, a) {
  // Forward pass
  const forward = applyBiquad(signal, b, a);

  // Reverse
  const reversed = forward.slice().reverse();

  // Backward pass (same filter on reversed signal)
  const backward = applyBiquad(reversed, b, a);

  // Reverse again to restore original time direction
  return backward.reverse();
}

/**
 * Apply zero-phase notch filtering at lineFreq and all harmonics up to Nyquist.
 *
 * Bandwidth is fixed at 2 Hz per notch (Q = fc/2), which is tight enough
 * to preserve neural signals immediately adjacent to line frequency while
 * fully suppressing the interference.
 *
 * Harmonics: lineFreq, 2×lineFreq, 3×lineFreq, 4×lineFreq (up to Nyquist).
 * At 60 Hz with fs=1024: suppresses 60, 120, 180, 240 Hz.
 * At 50 Hz with fs=1024: suppresses 50, 100, 150, 200 Hz.
 *
 * @param {Float32Array} signal — DC-removed signal
 * @param {number} fs — sample rate
 * @param {number} lineFreq — 50 or 60
 * @returns {Float32Array} notch-filtered signal
 */
export function applyNotch(signal, fs, lineFreq) {
  const nyquist  = fs / 2;
  const bandwidth = 2;   // Hz, per notch

  let filtered = signal;

  for (let harmonic = lineFreq; harmonic < nyquist; harmonic += lineFreq) {
    const Q = harmonic / bandwidth;
    const { b, a } = notchCoeffs(harmonic, Q, fs);
    filtered = applyZeroPhase(filtered, b, a);
  }

  return filtered;
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: RE-REFERENCING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bipolar re-reference: adjacent-contact subtraction within a shaft.
 *
 * Clinical convention: label = "A2-A1" means channel A2 minus channel A1
 * (deeper/distal contact minus shallower/proximal contact), following the
 * standard that the deeper contact is listed first.
 *
 * This produces N-1 bipolar channels from N monopolar contacts.
 * Non-consecutive contacts (gaps in contact numbering) are skipped with
 * a warning — a gap indicates a broken or excluded contact.
 *
 * @param {Array<{ signal: Signal, contact: number }>} contacts
 *   — shaft contacts sorted by contact number (output of parseShafts)
 * @returns {Array<{
 *   label:    string,       — e.g. "A2-A1"
 *   data:     Float32Array, — clean bipolar signal (distal - proximal)
 *   fs:       number,
 *   contact1: number,       — proximal contact number
 *   contact2: number,       — distal contact number
 *   qualityExcluded: boolean,
 * }>}
 */
export function bipolarReference(contacts) {
  const pairs = [];

  for (let i = 0; i < contacts.length - 1; i++) {
    const proximal = contacts[i];     // lower contact number (shallower)
    const distal   = contacts[i + 1]; // higher contact number (deeper)

    // Skip non-consecutive contacts
    if (distal.contact - proximal.contact !== 1) {
      console.warn(
        `Bipolar: skipping non-consecutive pair ` +
        `${proximal.signal.label}–${distal.signal.label} ` +
        `(contacts ${proximal.contact} and ${distal.contact})`
      );
      continue;
    }

    const sig1 = proximal.signal;
    const sig2 = distal.signal;

    if (sig1.fs !== sig2.fs) {
      console.warn(
        `Bipolar: sample rate mismatch ${sig1.label}(${sig1.fs}) vs ` +
        `${sig2.label}(${sig2.fs}) — skipping`
      );
      continue;
    }

    // Use the pre-processed (DC-removed, notch-filtered) data if available,
    // falling back to raw data
    const data1 = sig1.cleanData ?? sig1.data;
    const data2 = sig2.cleanData ?? sig2.data;

    const len  = Math.min(data1.length, data2.length);
    const data = new Float32Array(len);

    // distal minus proximal: A2-A1 convention
    for (let s = 0; s < len; s++) {
      data[s] = data2[s] - data1[s];
    }

    pairs.push({
      label:    `${sig2.label}-${sig1.label}`,
      data,
      fs:       sig1.fs,
      contact1: proximal.contact,
      contact2: distal.contact,
    });
  }

  return pairs;
}

/**
 * Common Average Reference (CAR): subtract the mean across all channels
 * at each time point.
 *
 * Used as the default re-referencing scheme for scalp EEG.
 * Removes globally shared noise (reference electrode artifact, powerline
 * residual) while preserving local spatial differences.
 *
 * Precondition: all channels must have the same length and sampling rate.
 * Channels known to be bad should be excluded before calling this function,
 * as a single bad channel corrupts the average.
 *
 * @param {Array<Float32Array>} channels — DC-removed, notch-filtered
 * @returns {Array<Float32Array>} re-referenced channels (same length, same order)
 */
export function carReference(channels) {
  if (channels.length === 0) return [];
  const n    = channels[0].length;
  const nCh  = channels.length;

  // Compute the mean across channels at each sample
  const avg = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < nCh; c++) sum += channels[c][i];
    avg[i] = sum / nCh;
  }

  // Subtract the mean from each channel
  return channels.map(ch => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = ch[i] - avg[i];
    return out;
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: SIGNAL QUALITY ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assess signal quality after preprocessing.
 *
 * This runs on the fully preprocessed signal (after DC removal, notch
 * filtering, and re-referencing). It produces quality metrics for each
 * channel and assigns a color-coded status flag for the UI.
 *
 * Metrics:
 *   rms       — root mean square amplitude (reflects signal energy)
 *   variance  — signal variance (Hjorth Activity)
 *   kurtosis  — fourth-order moment / variance² (artifact sensitivity)
 *   lineResidual — power at lineFreq after notch (checks filter effectiveness)
 *
 * Status flags:
 *   'good'   — all metrics in expected range
 *   'warn'   — one metric out of range (clinician should check)
 *   'bad'    — flat/saturated/extremely noisy (likely broken electrode)
 *
 * @param {Float32Array} signal — preprocessed (DC-removed, notch-filtered)
 * @param {number} fs
 * @param {number} lineFreq — 50 or 60 (for residual check)
 * @returns {{
 *   rms:         number,
 *   variance:    number,
 *   kurtosis:    number,
 *   lineResidual: number,
 *   issues:      string[],
 *   status:      'good' | 'warn' | 'bad',
 * }}
 */
export function assessQuality(signal, fs, lineFreq) {
  const n = signal.length;
  const issues = [];

  if (n === 0) {
    return { rms: 0, variance: 0, kurtosis: 0, lineResidual: 0,
             issues: ['No data'], status: 'bad' };
  }

  // ── RMS and mean ────────────────────────────────────────────────────────────
  let sum = 0, sumSq = 0;
  for (let i = 0; i < n; i++) {
    sum   += signal[i];
    sumSq += signal[i] * signal[i];
  }
  const mean = sum / n;
  const rms  = Math.sqrt(sumSq / n);

  // ── Variance (Hjorth Activity) ───────────────────────────────────────────────
  // After DC removal, mean ≈ 0, so variance ≈ sumSq/n = rms².
  // Computing explicitly to be precise.
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = signal[i] - mean;
    varSum += d * d;
  }
  const variance = varSum / n;

  // ── Kurtosis ────────────────────────────────────────────────────────────────
  // Gaussian noise: kurtosis ≈ 3. EEG baseline is near-Gaussian.
  // High (>10): transient artifacts (electrode pops, movement).
  // Low (<1.5): flat/dead or hard-clipped (saturated) channel.
  let kurt4 = 0;
  for (let i = 0; i < n; i++) {
    const d = signal[i] - mean;
    kurt4 += d * d * d * d;
  }
  const kurtosis = variance > 0 ? (kurt4 / n) / (variance * variance) : 0;

  // ── Line noise residual ──────────────────────────────────────────────────────
  // Use Goertzel to check power remaining at lineFreq after notch filtering.
  // Compare to power at a neighboring frequency (lineFreq + 10 Hz) as baseline.
  // High ratio indicates ineffective notch (unusual sampling rate edge case, etc.)
  const windowSamples = Math.min(n, Math.floor(fs * 10));
  const segment = signal.subarray(0, windowSamples);
  const lineResidual = _goertzelNorm(segment, lineFreq, lineFreq + 10, fs);

  // ── Flat line detection ──────────────────────────────────────────────────────
  // After preprocessing, a genuinely flat channel will have near-zero variance.
  // Threshold is empirical: <0.1 µV² is effectively zero for SEEG/EEG.
  if (variance < 0.1) {
    issues.push('Flat line (variance < 0.1 µV²) — possible broken electrode');
  }

  // ── Saturation / clipping ────────────────────────────────────────────────────
  // A saturated channel accumulates many samples at the same extremal value.
  // After DC removal, look for more than 0.5% of samples at min or max.
  let minVal = signal[0], maxVal = signal[0];
  for (let i = 1; i < n; i++) {
    if (signal[i] < minVal) minVal = signal[i];
    if (signal[i] > maxVal) maxVal = signal[i];
  }
  const range = maxVal - minVal;
  if (range > 0) {
    const margin = range * 0.001;
    let railCount = 0;
    for (let i = 0; i < n; i++) {
      if (signal[i] <= minVal + margin || signal[i] >= maxVal - margin) railCount++;
    }
    const railPct = (railCount / n) * 100;
    if (railPct > 0.5) {
      issues.push(`Possible saturation (${railPct.toFixed(1)}% at rail)`);
    }
  }

  // ── Kurtosis flags ──────────────────────────────────────────────────────────
  if (kurtosis > 10) {
    issues.push(`High kurtosis (${kurtosis.toFixed(1)}) — transient artifacts likely`);
  }
  if (kurtosis < 1.5 && variance > 0.1) {
    // Low kurtosis with non-flat signal = saturated or heavily clipped
    issues.push(`Low kurtosis (${kurtosis.toFixed(1)}) — possible saturation`);
  }

  // ── Excessive noise ──────────────────────────────────────────────────────────
  // For bipolar SEEG, RMS > 500 µV is almost certainly artifact.
  // For monopolar or scalp EEG, threshold is higher.
  if (rms > 1000) {
    issues.push(`Excessive RMS (${rms.toFixed(0)} µV)`);
  }

  // ── Line noise residual ──────────────────────────────────────────────────────
  // Ratio > 5 means much more power at lineFreq than at +10 Hz — notch may not
  // have been applied, or this is a pathologically line-noise-contaminated channel.
  if (lineResidual > 5) {
    issues.push(`Line noise residual elevated (ratio ${lineResidual.toFixed(1)}×)`);
  }

  const status = issues.length === 0
    ? 'good'
    : issues.some(m => m.startsWith('Flat') || m.startsWith('Excessive'))
      ? 'bad'
      : 'warn';

  return { rms, variance, kurtosis, lineResidual, issues, status };
}

/**
 * Goertzel power ratio: power at targetFreq relative to power at refFreq.
 * A ratio near 1.0 means the two frequencies have equal power.
 * A high ratio means targetFreq has anomalously more power than refFreq.
 */
function _goertzelPower(signal, targetFreq, fs) {
  const omega = (2 * Math.PI * targetFreq) / fs;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < signal.length; i++) {
    s0 = signal[i] + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

function _goertzelNorm(signal, targetFreq, refFreq, fs) {
  const target = _goertzelPower(signal, targetFreq, fs);
  const ref    = _goertzelPower(signal, refFreq,    fs);
  return ref > 0 ? target / ref : 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract shaft name from a channel label.
 * Handles both standard monopolar ("LHA3" → "LHA") and pre-bipolar
 * ("LHA3-LHA1" → "LHA") labels so TCP can group them correctly.
 *
 * @param {string} label
 * @returns {string | null}
 */
function _normalizeLabel(label) {
  let norm = label.replace(/^(?:EEG|iEEG|SEEG|sEEG|ECoG|ecog|POL|BIP)\s+/i, '');
  norm = norm.replace(/[\s\-](?:Ref|LE|RE|CE|CAR|REREF|GND|Avg|AVG)$/i, '');
  return norm.trim();
}

function _shaftFromLabel(label) {
  const clean  = _normalizeLabel(label);
  const sepIdx = clean.lastIndexOf('-');
  if (sepIdx > 0) {
    const left  = clean.slice(0, sepIdx);
    const right = clean.slice(sepIdx + 1);
    const leftM  = left.match(/^([A-Za-z][A-Za-z0-9'.-]*?)\d+$/);
    const rightM = right.match(/^([A-Za-z][A-Za-z0-9'.-]*?)\d+$/);
    if (leftM && rightM && leftM[1].toUpperCase() === rightM[1].toUpperCase()) {
      return leftM[1];
    }
  }
  const m = clean.match(/^([A-Za-z][A-Za-z0-9'.-]*?)\d+$/);
  return m ? m[1] : null;
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full preprocessing pipeline on a parsed EDF recording.
 *
 * This is the single entry point for the preprocessing layer. It is called
 * once after the user confirms the import summary (line noise frequency,
 * reference mode, channel exclusions).
 *
 * @param {Object} edfResult    — from parseEDF()
 * @param {Object} importResult — from analyzeImport()
 * @param {Object} options
 * @param {number}   options.lineFreq      — 50 or 60 Hz
 * @param {string}   options.referenceMode — 'bipolar' | 'car' | 'none'
 * @param {string[]} [options.excludeLabels] — channel labels to exclude
 *
 * @returns {{
 *   channels: Array<Channel>,   — ready for feature extraction
 *   quality:  Object,           — per-channel quality reports
 *   options:  Object,           — options as applied (for audit trail)
 * }}
 *
 * Channel shape:
 * {
 *   label:    string,           — e.g. "A2-A1" (bipolar) or "Fp1" (scalp)
 *   data:     Float32Array,     — preprocessed signal in physical units
 *   fs:       number,
 *   shaft:    string | null,    — shaft name for SEEG, null for scalp
 *   contact1: number | null,
 *   contact2: number | null,
 *   referenceMode: string,
 * }
 */
export function preprocessRecording(edfResult, importResult, options) {
  const {
    lineFreq,
    referenceMode = importResult.type === 'EEG' ? 'car' : 'bipolar',
    excludeLabels = [],
    includeShafts = null,  // null = all shafts; string[] = only these shafts
  } = options;

  const excludeSet        = new Set(excludeLabels.map(l => l.trim()));
  const includeShaftsSet  = includeShafts ? new Set(includeShafts) : null;
  const quality    = {};
  const channels   = [];

  // ── Step 1 + 2: DC removal and notch filtering ──────────────────────────────
  // Applied to every neural signal (scalp + seeg) before re-referencing.
  // Auxiliary and unknown channels are not processed.

  const neuralSignals = [
    ...importResult.scalp,
    // SEEG signals filtered by selected shafts (shaft selection at import)
    ...importResult.seeg.filter(sig => {
      if (!includeShaftsSet) return true;
      const shaft = _shaftFromLabel(sig.label);
      return !shaft || includeShaftsSet.has(shaft);
    }),
  ].filter(sig => !excludeSet.has(sig.label));

  // Annotate each signal with its cleaned data in-place (stored on signal object
  // so that bipolarReference() and carReference() can access it cleanly)
  for (const sig of neuralSignals) {
    const { clean, dc } = removeDC(sig.data);
    sig._dc = dc;     // retain for calibration metadata
    sig.cleanData = lineFreq > 0
      ? applyNotch(clean, sig.fs, lineFreq)
      : clean;
  }

  // ── Step 3: Re-referencing ──────────────────────────────────────────────────

  if (referenceMode === 'bipolar') {
    // SEEG bipolar — per shaft, adjacent contacts
    for (const [shaftName, contacts] of Object.entries(importResult.shafts)) {
      if (includeShaftsSet && !includeShaftsSet.has(shaftName)) continue;
      // Filter to only included signals that have been cleaned
      const cleanContacts = contacts.filter(
        c => !excludeSet.has(c.signal.label) && c.signal.cleanData != null
      );
      if (cleanContacts.length < 2) continue;

      const pairs = bipolarReference(cleanContacts);

      for (const pair of pairs) {
        channels.push({
          label:         pair.label,
          data:          pair.data,
          fs:            pair.fs,
          shaft:         shaftName,
          contact1:      pair.contact1,
          contact2:      pair.contact2,
          referenceMode: 'bipolar',
        });
      }
    }

    // Scalp channels in a HYBRID recording get CAR treatment
    if (importResult.scalp.length > 0) {
      const scalpClean = importResult.scalp
        .filter(s => !excludeSet.has(s.label) && s.cleanData != null)
        .map(s => s.cleanData);

      const scalpSignals = importResult.scalp
        .filter(s => !excludeSet.has(s.label) && s.cleanData != null);

      const carred = carReference(scalpClean);

      for (let i = 0; i < scalpSignals.length; i++) {
        channels.push({
          label:         scalpSignals[i].label,
          data:          carred[i],
          fs:            scalpSignals[i].fs,
          shaft:         null,
          contact1:      null,
          contact2:      null,
          referenceMode: 'car',
        });
      }
    }

  } else if (referenceMode === 'car') {
    // Scalp EEG — common average reference
    const cleanSignals = neuralSignals.filter(s => s.cleanData != null);
    const cleanArrays  = cleanSignals.map(s => s.cleanData);
    const carred       = carReference(cleanArrays);

    for (let i = 0; i < cleanSignals.length; i++) {
      channels.push({
        label:         cleanSignals[i].label,
        data:          carred[i],
        fs:            cleanSignals[i].fs,
        shaft:         null,
        contact1:      null,
        contact2:      null,
        referenceMode: 'car',
      });
    }

  } else {
    // referenceMode === 'none' — monopolar or pre-bipolar, no re-referencing
    for (const sig of neuralSignals) {
      if (!sig.cleanData) continue;
      channels.push({
        label:         sig.label,
        data:          sig.cleanData,
        fs:            sig.fs,
        shaft:         _shaftFromLabel(sig.label),
        contact1:      null,
        contact2:      null,
        referenceMode: 'none',
      });
    }
  }

  // ── Step 4: Quality assessment ──────────────────────────────────────────────
  // Runs on the final re-referenced signal. This is the state the clinician
  // will actually hear, so quality flags here are directly actionable.
  for (const ch of channels) {
    quality[ch.label] = assessQuality(ch.data, ch.fs, lineFreq);
    ch.quality = quality[ch.label];
  }

  // ── Clean up temporary .cleanData annotations ───────────────────────────────
  for (const sig of neuralSignals) {
    delete sig.cleanData;
  }

  const appliedOptions = { lineFreq, referenceMode, excludeLabels };

  console.log(
    `Preprocessing complete: ${channels.length} channels | ` +
    `DC removal + notch(${lineFreq} Hz) + ${referenceMode}`
  );

  const badCount  = channels.filter(ch => ch.quality?.status === 'bad').length;
  const warnCount = channels.filter(ch => ch.quality?.status === 'warn').length;
  if (badCount > 0 || warnCount > 0) {
    console.warn(`Quality: ${badCount} bad, ${warnCount} warn — review channel list`);
  }

  return { channels, quality, options: appliedOptions };
}
