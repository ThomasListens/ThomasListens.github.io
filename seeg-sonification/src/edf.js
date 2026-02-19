/**
 * Pure JavaScript EDF (European Data Format) parser.
 * No external dependencies.
 *
 * Reference: https://www.edfplus.info/specs/edf.html
 *
 * Usage:
 *   const buffer = await file.arrayBuffer();
 *   const edf = parseEDF(buffer);
 *   // edf.signals[i].label, .data (Float32Array), .fs, etc.
 */

export function parseEDF(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder('ascii');

  const str = (offset, len) =>
    decoder.decode(new Uint8Array(buffer, offset, len)).trim();
  const num = (offset, len) => {
    const s = str(offset, len);
    return s === '' ? 0 : Number(s);
  };

  // ── Fixed header (256 bytes) ──────────────────────────────
  const version = str(0, 8);
  const patient = str(8, 80);
  const recording = str(88, 80);
  const startDate = str(168, 8);
  const startTime = str(176, 8);
  const headerBytes = num(184, 8);
  const numRecords = num(236, 8);
  const recordDuration = num(244, 8);
  const numSignals = num(252, 4);

  // ── Per-signal headers ────────────────────────────────────
  const base = 256;
  const signals = [];

  for (let i = 0; i < numSignals; i++) {
    const label = str(base + i * 16, 16);
    const transducer = str(base + numSignals * 16 + i * 80, 80);
    const physDim = str(base + numSignals * 96 + i * 8, 8);
    const physMin = num(base + numSignals * 104 + i * 8, 8);
    const physMax = num(base + numSignals * 112 + i * 8, 8);
    const digMin = num(base + numSignals * 120 + i * 8, 8);
    const digMax = num(base + numSignals * 128 + i * 8, 8);
    const prefilter = str(base + numSignals * 136 + i * 80, 80);
    const samplesPerRec = num(base + numSignals * 216 + i * 8, 8);

    const fs = samplesPerRec / recordDuration;
    const scale = (physMax - physMin) / (digMax - digMin);
    const dc = physMin - digMin * scale;

    signals.push({
      label,
      transducer,
      physDim,
      physMin,
      physMax,
      digMin,
      digMax,
      prefilter,
      samplesPerRec,
      fs,
      scale,
      dc,
      data: null,
    });
  }

  // ── Read data records ─────────────────────────────────────
  for (let i = 0; i < numSignals; i++) {
    signals[i].data = new Float32Array(numRecords * signals[i].samplesPerRec);
  }

  let offset = headerBytes;
  for (let rec = 0; rec < numRecords; rec++) {
    for (let i = 0; i < numSignals; i++) {
      const n = signals[i].samplesPerRec;
      for (let s = 0; s < n; s++) {
        if (offset + 2 > buffer.byteLength) break;
        const raw = view.getInt16(offset, true); // little-endian
        signals[i].data[rec * n + s] = raw * signals[i].scale + signals[i].dc;
        offset += 2;
      }
    }
  }

  return {
    version,
    patient,
    recording,
    startDate,
    startTime,
    headerBytes,
    numRecords,
    recordDuration,
    duration: numRecords * recordDuration,
    numSignals,
    signals,
  };
}

/**
 * Identify electrode shafts from signal labels.
 * Returns { shaftName: [{ label, contact, signal }, ...], ... }
 */
export function identifyShafts(signals) {
  const SCALP = new Set([
    'C3','C4','CZ','F3','F4','F7','F8','FP1','FP2','FZ',
    'O1','O2','P3','P4','PZ','T3','T4','T5','T6',
  ]);

  const shaftMap = {};

  signals.forEach((sig) => {
    const upper = sig.label.toUpperCase();
    if (upper.startsWith('EKG') || upper.startsWith('ECG') || SCALP.has(upper)) return;

    // Match shaft name + contact number: e.g. "LAF1", "RAF-A3", "RC-B4"
    const match = sig.label.match(/^([A-Za-z][\w-]*?)(\d+)$/);
    if (match) {
      const shaft = match[1];
      const contact = parseInt(match[2]);
      if (!shaftMap[shaft]) shaftMap[shaft] = [];
      shaftMap[shaft].push({ label: sig.label, contact, signal: sig });
    }
  });

  // Sort contacts within each shaft by contact number
  Object.keys(shaftMap).forEach((k) => {
    shaftMap[k].sort((a, b) => a.contact - b.contact);
  });

  return shaftMap;
}

/**
 * Compute bipolar derivations for a set of contacts.
 * Convention: deep-first (1-2, 2-3, 3-4)
 */
export function computeBipolarPairs(contacts) {
  const pairs = [];
  for (let i = 0; i < contacts.length - 1; i++) {
    const c1 = contacts[i];
    const c2 = contacts[i + 1];
    if (c2.contact - c1.contact === 1) {
      const data = new Float32Array(c1.signal.data.length);
      for (let s = 0; s < data.length; s++) {
        data[s] = c1.signal.data[s] - c2.signal.data[s];
      }
      pairs.push({
        label: `${c1.contact}-${c2.contact}`,
        fullLabel: `${c1.label}-${c2.label}`,
        data,
        fs: c1.signal.fs,
      });
    }
  }
  return pairs;
}
