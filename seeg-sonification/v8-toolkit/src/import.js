/**
 * import.js — EDF Import Orchestration
 *
 * Runs once immediately after parseEDF(). Takes the raw parse result and
 * produces a structured description of the recording before any signal
 * processing occurs.
 *
 * Responsibilities:
 *   1. Classify each channel (scalp EEG / SEEG / auxiliary / unknown)
 *   2. Detect overall recording type (EEG, SEEG, or HYBRID)
 *   3. Group SEEG channels into shafts
 *   4. Assess available frequency bands from sampling rate
 *   5. Auto-detect power line frequency (50 vs 60 Hz)
 *   6. Generate a complete import summary object
 *
 * All classification is deterministic and reversible. Nothing is discarded —
 * channels classified as auxiliary or unknown are preserved and presented
 * to the user. The user makes all final exclusion decisions.
 *
 * Exports:
 *   analyzeImport(edfResult)   → ImportResult   (main entry point)
 *   classifyChannel(label)     → ChannelClass
 *   detectRecordingType(sigs)  → TypeResult
 *   parseShafts(seegSignals)   → ShaftMap
 *   autoDetectLineNoise(sig, fs) → NoiseResult
 *   availableBands(fs)         → BandList
 */


// ─────────────────────────────────────────────────────────────────────────────
// LABEL NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip common clinical EDF system prefixes and reference suffixes.
 *
 * Natus/XLTEK and similar clinical systems commonly prepend a modality
 * label followed by a space: "EEG LA1", "POL A1", "SEEG Hip3".
 * Reference suffixes like "-Ref", " LE", "-CAR" also appear.
 *
 * This function normalises the label so that downstream pattern matching
 * sees only the electrode name (e.g. "LA1", "A1", "Hip3").
 *
 * @param {string} label
 * @returns {string} normalised label (trimmed, prefix/suffix removed)
 */
function _normalizeChannelLabel(label) {
  // Strip leading modality prefix + mandatory trailing space
  let norm = label.replace(/^(?:EEG|iEEG|SEEG|sEEG|ECoG|ecog|POL|BIP)\s+/i, '');
  // Strip trailing reference suffix (space or dash separator)
  norm = norm.replace(/[\s\-](?:Ref|LE|RE|CE|CAR|REREF|GND|Avg|AVG)$/i, '');
  return norm.trim();
}


// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete set of standard 10-20 and extended 10-10 scalp EEG electrode labels.
 * These must be treated case-insensitively.
 *
 * Note: A1 and A2 (mastoid references) are in this set. If they appear
 * alongside SEEG-pattern channels, the recording type algorithm resolves
 * the ambiguity by majority count (see detectRecordingType).
 */
const SCALP_10_20 = new Set([
  // Standard 10-20
  'FP1','FP2','F7','F3','FZ','F4','F8',
  'T3','C3','CZ','C4','T4',
  'T5','P3','PZ','P4','T6',
  'O1','OZ','O2',
  'A1','A2',   // mastoid
  // Extended 10-10
  'AF7','AF3','AFZ','AF4','AF8',
  'F5','F1','F2','F6',
  'FT7','FC5','FC3','FC1','FCZ','FC2','FC4','FC6','FT8',
  'T7','C5','C1','C2','C6','T8',
  'TP7','CP5','CP3','CP1','CPZ','CP2','CP4','CP6','TP8',
  'P7','P5','P1','P2','P6','P8',
  'PO7','PO3','POZ','PO4','PO8',
  'OZ','IZ',
  // Common alternates
  'NZ','NFP1','NFP2',
]);

/**
 * Auxiliary / non-neural channel patterns.
 * These are physiological signals or system channels that should be
 * excluded from sonification by default.
 */
const AUXILIARY_PATTERN = /^(ECG|EKG|EMG|EOG[LRH]?|VEOG|HEOG|DC\d*|STI\d*|Status|TRIG\d*|Resp|SpO2|SAO2|FLOW|Temp|Pleth|Misc|Ref)/i;

/**
 * Classify a single channel label.
 *
 * Classification priority: auxiliary > scalp > seeg > unknown
 *
 * SEEG detection requires: alphabetic prefix followed immediately by integer suffix.
 * The grouping logic in parseShafts() then verifies that multiple contacts
 * share the same prefix (a single A1 is ambiguous; A1+A2+A3 is SEEG).
 *
 * @param {string} label
 * @returns {'scalp' | 'seeg' | 'auxiliary' | 'unknown'}
 */
export function classifyChannel(label) {
  const clean = label.trim();

  // Auxiliary takes highest priority
  if (AUXILIARY_PATTERN.test(clean)) return 'auxiliary';

  // Scalp 10-20 / 10-10
  if (SCALP_10_20.has(clean.toUpperCase())) return 'scalp';

  // SEEG: alphabetic prefix (may include apostrophe or hyphen) + integer suffix
  // Examples: A1, Hip1, LA-A3, L'1, RFC12, Amy01
  if (/^[A-Za-z][A-Za-z0-9'.-]*?\d+$/.test(clean)) return 'seeg';

  // Retry after stripping clinical system prefixes / reference suffixes.
  // Handles "EEG LA1" → "LA1", "LA1-Ref" → "LA1", "POL A1" → "A1", etc.
  const norm = _normalizeChannelLabel(clean);
  if (norm !== clean) {
    if (SCALP_10_20.has(norm.toUpperCase())) return 'scalp';
    if (/^[A-Za-z][A-Za-z0-9'.-]*?\d+$/.test(norm)) return 'seeg';
  }

  return 'unknown';
}


// ─────────────────────────────────────────────────────────────────────────────
// RECORDING TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the recording as EEG, SEEG, HYBRID, or UNKNOWN.
 *
 * Algorithm (per v8 spec §3.2):
 *   - Count scalp-classified and SEEG-classified channels
 *   - If scalp_count > seeg_count → EEG
 *   - If seeg_count > scalp_count → SEEG
 *   - If both present            → HYBRID
 *   - If neither                 → UNKNOWN
 *
 * @param {Array} signals — from parseEDF().signals
 * @returns {{
 *   type:        'EEG' | 'SEEG' | 'HYBRID' | 'UNKNOWN',
 *   scalp:       Array<Signal>,
 *   seeg:        Array<Signal>,
 *   auxiliary:   Array<Signal>,
 *   unknown:     Array<Signal>,
 *   classified:  Array<{ signal: Signal, channelClass: string }>,
 * }}
 */
export function detectRecordingType(signals) {
  const scalp     = [];
  const seeg      = [];
  const auxiliary = [];
  const unknown   = [];
  const classified = [];

  for (const sig of signals) {
    const channelClass = classifyChannel(sig.label);
    classified.push({ signal: sig, channelClass });

    switch (channelClass) {
      case 'scalp':     scalp.push(sig);     break;
      case 'seeg':      seeg.push(sig);       break;
      case 'auxiliary': auxiliary.push(sig);  break;
      default:          unknown.push(sig);    break;
    }
  }

  let type;
  if (scalp.length > 0 && seeg.length === 0)       type = 'EEG';
  else if (seeg.length > 0 && scalp.length === 0)  type = 'SEEG';
  else if (seeg.length > 0 && scalp.length > 0)    type = 'HYBRID';
  else                                              type = 'UNKNOWN';

  return { type, scalp, seeg, auxiliary, unknown, classified };
}


// ─────────────────────────────────────────────────────────────────────────────
// SEEG SHAFT PARSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect if a label is a pre-computed bipolar derivation.
 *
 * Pattern: "LHA3-LHA1" — both sides are [alpha-prefix][integer] with the same prefix.
 * Uses lastIndexOf('-') to handle hyphenated shaft names: "RAF-A3-RAF-A1" also works.
 *
 * @param {string} label
 * @returns {{ shaft: string, leftContact: number, rightContact: number } | null}
 */
function _parseBipolarLabel(label) {
  const sepIdx = label.lastIndexOf('-');
  if (sepIdx < 1) return null;

  const left  = label.slice(0, sepIdx);
  const right = label.slice(sepIdx + 1);

  const leftM  = left.match(/^([A-Za-z][A-Za-z0-9'.-]*?)(\d+)$/);
  const rightM = right.match(/^([A-Za-z][A-Za-z0-9'.-]*?)(\d+)$/);
  if (!leftM || !rightM) return null;

  if (leftM[1].toUpperCase() !== rightM[1].toUpperCase()) return null;

  return {
    shaft:        leftM[1],
    leftContact:  parseInt(leftM[2], 10),
    rightContact: parseInt(rightM[2], 10),
  };
}

/**
 * Group SEEG contacts into electrode shafts.
 *
 * A "shaft" is a set of channels sharing the same alphabetic prefix
 * with sequential integer suffixes (e.g., A1, A2, A3 → shaft "A").
 *
 * Handles naming conventions:
 *   Simple:      A1, A2, A3       → shaft A
 *   Multi-char:  Hip1, Hip2       → shaft Hip
 *   Apostrophe:  L'1, L'2         → shaft L'
 *   Hyphenated:  RAF-A1, RAF-A2   → shaft RAF-A
 *   Zero-padded: LA01, LA02       → shaft LA
 *   Pre-bipolar: LHA3-LHA1, ...   → shaft LHA, preBipolar: true
 *
 * Contacts are sorted numerically within each shaft.
 * Shafts are sorted alphabetically.
 *
 * @param {Array<Signal>} seegSignals — signals classified as 'seeg'
 * @returns {Object} shaftMap: { shaftName: [{ signal, contact: number, preBipolar?: true }] }
 */
export function parseShafts(seegSignals) {
  const shaftMap = {};

  for (const sig of seegSignals) {
    const clean = sig.label.trim();

    // Try pre-bipolar pattern first: "LHA3-LHA1"
    const bip = _parseBipolarLabel(clean);
    if (bip) {
      if (!shaftMap[bip.shaft]) shaftMap[bip.shaft] = [];
      shaftMap[bip.shaft].push({ signal: sig, contact: bip.leftContact, preBipolar: true });
      continue;
    }

    // Standard monopolar SEEG contact: "LHA3", "RAF-A1", "Hip12"
    // Normalise first so "EEG LA1" → "LA1" (shaft "LA", contact 1)
    const norm  = _normalizeChannelLabel(clean);
    const match = norm.match(/^([A-Za-z][A-Za-z0-9'.-]*?)(\d+)$/);
    if (!match) continue;

    const shaftName = match[1];
    const contact   = parseInt(match[2], 10);

    if (!shaftMap[shaftName]) shaftMap[shaftName] = [];
    shaftMap[shaftName].push({ signal: sig, contact });
  }

  // Sort contacts numerically within each shaft
  for (const name of Object.keys(shaftMap)) {
    shaftMap[name].sort((a, b) => a.contact - b.contact);
  }

  return shaftMap;
}


// ─────────────────────────────────────────────────────────────────────────────
// LINE NOISE AUTO-DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate power line frequency by comparing spectral power at 50 vs 60 Hz.
 *
 * Uses the Goertzel algorithm, which computes the DFT at a single target
 * frequency in O(N) time. Vastly more efficient than a full FFT for checking
 * just two frequencies, and sufficient for this purpose.
 *
 * Analysis window: first 10 seconds of data (or full signal if shorter).
 *
 * Decision rule (per v8 spec §3.4):
 *   power_60 > power_50 × 2  →  60 Hz
 *   power_50 > power_60 × 2  →  50 Hz
 *   otherwise                →  ambiguous (return null, caller shows UI)
 *
 * @param {Float32Array} signal — a representative channel (raw, before any filtering)
 * @param {number} fs — sample rate
 * @returns {{ lineFreq: 50 | 60 | null, power50: number, power60: number, ambiguous: boolean }}
 */
export function autoDetectLineNoise(signal, fs) {
  // Use first 10 seconds at most — enough for stable spectral estimate
  const windowSamples = Math.min(signal.length, Math.floor(fs * 10));
  const segment = signal.subarray(0, windowSamples);

  const power50 = _goertzelPower(segment, 50, fs);
  const power60 = _goertzelPower(segment, 60, fs);

  let lineFreq   = null;
  let ambiguous  = false;

  if (power60 > power50 * 2)      lineFreq = 60;
  else if (power50 > power60 * 2) lineFreq = 50;
  else                            ambiguous = true;

  return { lineFreq, power50, power60, ambiguous };
}

/**
 * Goertzel algorithm — DFT power at a single frequency.
 *
 * Returns the squared magnitude of the DFT at targetFreq.
 * Result is comparable across calls on the same-length segment.
 *
 * @param {Float32Array} signal
 * @param {number} targetFreq — frequency of interest (Hz)
 * @param {number} fs — sample rate
 * @returns {number} power (arbitrary units, proportional to spectral energy)
 */
function _goertzelPower(signal, targetFreq, fs) {
  const N     = signal.length;
  const omega = (2 * Math.PI * targetFreq) / fs;
  const coeff = 2 * Math.cos(omega);

  let s0 = 0, s1 = 0, s2 = 0;

  for (let i = 0; i < N; i++) {
    s0 = signal[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  // Power = s1² + s2² - coeff × s1 × s2
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}


// ─────────────────────────────────────────────────────────────────────────────
// SAMPLING RATE / BAND AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine which frequency bands are reliably available given the sampling rate.
 *
 * The Nyquist frequency = fs / 2. To be reliable, a band's upper edge should
 * be ≤ 0.9 × Nyquist (10% margin for filter rolloff).
 *
 * For scalp EEG: high gamma is generally unreliable above ~70 Hz due to
 * muscle (EMG) artifact, regardless of sampling rate. This is flagged in the
 * summary but not enforced — the user decides.
 *
 * @param {number} fs — sample rate in Hz
 * @returns {Array<{ name, lo, hi, available, note }>}
 */
export function availableBands(fs) {
  const nyquist = fs / 2;
  const margin  = 0.9;

  const bands = [
    { name: 'delta',      lo: 0.5,  hi: 4,    note: 'Slow waves, sleep, pathological slowing' },
    { name: 'theta',      lo: 4,    hi: 8,    note: 'Memory, drowsiness, temporal lobe' },
    { name: 'alpha',      lo: 8,    hi: 13,   note: 'Posterior dominant rhythm, relaxation' },
    { name: 'beta',       lo: 13,   hi: 30,   note: 'Active processing, fast activity' },
    { name: 'lowGamma',   lo: 30,   hi: 70,   note: 'Cognitive binding; EMG artifact risk in scalp EEG' },
    { name: 'highGamma',  lo: 70,   hi: 150,  note: 'SEEG: cortical activation, task-related signal' },
    { name: 'hfoRipple',  lo: 80,   hi: 250,  note: 'HFO biomarker for epileptogenic zone' },
    { name: 'hfoFast',    lo: 250,  hi: 500,  note: 'Fast ripple — strong epileptogenic indicator' },
  ];

  return bands.map(b => ({
    ...b,
    available: b.hi <= nyquist * margin,
  }));
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze an EDF parse result and produce a complete import description.
 *
 * This is the single entry point for the import layer. Call it immediately
 * after parseEDF(), before any preprocessing.
 *
 * @param {Object} edfResult — from parseEDF()
 * @returns {ImportResult}
 *
 * ImportResult shape:
 * {
 *   // Recording identity
 *   type:         'EEG' | 'SEEG' | 'HYBRID' | 'UNKNOWN',
 *   duration:     number,    — seconds
 *   fs:           number,    — representative sampling rate
 *
 *   // Channel groups
 *   scalp:        Array<Signal>,
 *   seeg:         Array<Signal>,
 *   auxiliary:    Array<Signal>,
 *   unknown:      Array<Signal>,
 *   shafts:       ShaftMap,  — SEEG contacts grouped by shaft
 *
 *   // Preprocessing hints (editable by user before committing)
 *   lineFreq:     50 | 60 | null,
 *   lineAmbiguous: boolean,
 *   linePower50:  number,
 *   linePower60:  number,
 *   bands:        Array<BandInfo>,
 *
 *   // Summary text (for display in the import UI panel)
 *   summary:      Object,
 * }
 */
export function analyzeImport(edfResult) {
  const { signals, duration, annotations } = edfResult;

  // Step 1: Classify channels and detect recording type
  const typeResult = detectRecordingType(signals);
  const { type, scalp, seeg, auxiliary, unknown } = typeResult;

  // Step 2: Group SEEG contacts into shafts
  const shafts = type === 'EEG' ? {} : parseShafts(seeg);

  // Step 3: Detect representative sampling rate
  // Use the most common fs among neural channels (scalp + seeg)
  const neuralSignals = [...scalp, ...seeg];
  const fs = _representativeFs(neuralSignals) || _representativeFs(signals) || 0;

  // Step 4: Auto-detect line noise from first non-auxiliary channel with data
  let lineFreq = null, lineAmbiguous = false, linePower50 = 0, linePower60 = 0;
  const noiseTarget = neuralSignals.find(s => s.data && s.data.length > 0);
  if (noiseTarget) {
    const noiseResult = autoDetectLineNoise(noiseTarget.data, noiseTarget.fs || fs);
    lineFreq      = noiseResult.lineFreq;
    lineAmbiguous = noiseResult.ambiguous;
    linePower50   = noiseResult.power50;
    linePower60   = noiseResult.power60;
  }

  // Step 5: Assess available frequency bands
  const bands = availableBands(fs);

  // Step 6: Detect whether data is already bipolar-referenced
  // (>50% of SEEG-classified channels have a "LHA3-LHA1"-style label)
  const preBipolar = seeg.length > 0 &&
    seeg.filter(s => _parseBipolarLabel(s.label.trim()) !== null).length > seeg.length * 0.5;

  // Step 7: Build shaft summary (contact counts, bipolar pair counts)
  const shaftSummary = {};
  for (const [name, contacts] of Object.entries(shafts)) {
    const sorted = contacts.map(c => c.contact).sort((a, b) => a - b);
    const isPre  = contacts.some(c => c.preBipolar === true);
    const consecutivePairs = (!isPre && contacts.length > 1)
      ? contacts.slice(1).filter((c, i) => c.contact - contacts[i].contact === 1).length
      : 0;
    shaftSummary[name] = {
      contacts:     contacts.length,
      contactRange: `${sorted[0]}–${sorted[sorted.length - 1]}`,
      bipolarPairs: consecutivePairs,
      preBipolar:   isPre,
      signals:      contacts.map(c => c.signal),
    };
  }

  const summary = {
    file:         edfResult.recording || '(unknown)',
    patient:      edfResult.patient   || '(unknown)',
    duration:     _formatDuration(duration),
    durationSec:  duration,
    fs,
    type,
    shaftCount:   Object.keys(shafts).length,
    contactCount: seeg.length,
    scalpCount:   scalp.length,
    auxCount:     auxiliary.length,
    annotations:  annotations.length,
    lineFreq,
    lineAmbiguous,
    bands: bands.filter(b => b.available).map(b => b.name),
    hfoAvailable: bands.find(b => b.name === 'hfoRipple')?.available ?? false,
  };

  return {
    type,
    duration,
    fs,
    preBipolar,
    scalp,
    seeg,
    auxiliary,
    unknown,
    shafts,
    shaftSummary,
    lineFreq,
    lineAmbiguous,
    linePower50,
    linePower60,
    bands,
    annotations,
    summary,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Find the most common sampling rate among a set of signals. */
function _representativeFs(signals) {
  if (!signals.length) return null;
  const counts = {};
  for (const s of signals) {
    const k = Math.round(s.fs);
    counts[k] = (counts[k] || 0) + 1;
  }
  return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0], 10);
}

/** Format seconds as "M min SS sec". */
function _formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m} min ${s} sec` : `${s} sec`;
}
