/**
 * edf-parser.js — EDF/EDF+ Binary Format Parser
 *
 * Parses the EDF (European Data Format) binary format.
 * Returns raw signal data in physical units (µV, mV, etc.) with calibration
 * metadata. No signal processing of any kind — that is preprocess.js's job.
 *
 * EDF spec:  https://www.edfplus.info/specs/edf.html
 * EDF+ spec: https://www.edfplus.info/specs/edfplus.html
 *
 * Exports:
 *   parseEDF(arrayBuffer) → { signals, annotations, metadata }
 */


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an EDF or EDF+ file from an ArrayBuffer.
 *
 * @param {ArrayBuffer} buffer — raw file contents
 * @returns {{
 *   signals:     Array<Signal>,   — neural + non-neural channels, excludes annotation channels
 *   allSignals:  Array<Signal>,   — all channels including annotation channels
 *   annotations: Array<Annotation>, — seizure markers etc. (EDF+ only, else [])
 *   patient:     string,
 *   recording:   string,
 *   startDate:   string,          — dd.mm.yy
 *   startTime:   string,          — hh.mm.ss
 *   duration:    number,          — total recording duration in seconds
 *   numRecords:  number,          — actual records read (may be less if file truncated)
 *   recordDuration: number,       — seconds per data record
 *   isEDFPlus:   boolean,
 *   isDiscontinuous: boolean,
 * }}
 *
 * Signal shape:
 *   { label, transducer, physDim, physMin, physMax, digMin, digMax,
 *     prefilter, samplesPerRec, fs, scale, dc, isAnnotation,
 *     data: Float32Array }   — data in physical units
 *
 * Annotation shape:
 *   { onset: number, duration: number, label: string }
 */
export function parseEDF(buffer) {
  const view    = new DataView(buffer);
  const decoder = new TextDecoder('ascii');

  const str = (offset, len) =>
    decoder.decode(new Uint8Array(buffer, offset, len)).trim();
  const num = (offset, len) => {
    const s = str(offset, len);
    return s === '' ? 0 : Number(s);
  };

  // ── Fixed header (256 bytes) ────────────────────────────────────────────────
  const patient        = str(8,   80);
  const recording      = str(88,  80);
  const startDate      = str(168,  8);
  const startTime      = str(176,  8);
  const headerBytes    = num(184,  8);  // total header size in bytes
  const reserved       = str(192, 44);
  const numRecords     = num(236,  8);  // data records in file (-1 = unknown)
  const recordDuration = num(244,  8);  // seconds per data record
  const numSignals     = num(252,  4);

  const isEDFPlus      = reserved.startsWith('EDF+C') || reserved.startsWith('EDF+D');
  const isDiscontinuous = reserved.startsWith('EDF+D');

  if (isDiscontinuous) {
    console.warn('EDF+D (discontinuous) detected — timestamps may have gaps');
  }

  // ── Signal headers (256 bytes × numSignals, packed field-by-field) ──────────
  //
  // Each field is stored as a block: all values for signal 0, then signal 1, etc.
  // Field sizes (bytes each): label=16, transducer=80, physDim=8, physMin=8,
  //   physMax=8, digMin=8, digMax=8, prefilter=80, samplesPerRec=8, reserved=32
  //
  const SH = 256;   // signal header base offset (immediately after fixed header)
  const signals = [];

  for (let i = 0; i < numSignals; i++) {
    const label         = str(SH + i * 16, 16);
    const transducer    = str(SH + numSignals * 16  + i * 80,  80);
    const physDim       = str(SH + numSignals * 96  + i * 8,    8);
    const physMin       = num(SH + numSignals * 104 + i * 8,    8);
    const physMax       = num(SH + numSignals * 112 + i * 8,    8);
    const digMin        = num(SH + numSignals * 120 + i * 8,    8);
    const digMax        = num(SH + numSignals * 128 + i * 8,    8);
    const prefilter     = str(SH + numSignals * 136 + i * 80,  80);
    const samplesPerRec = num(SH + numSignals * 216 + i * 8,    8);

    // Physical units: physical = digital × scale + dc
    const scale = (digMax !== digMin)
      ? (physMax - physMin) / (digMax - digMin)
      : 0;
    const dc = physMin - digMin * scale;

    const fs = recordDuration > 0 ? samplesPerRec / recordDuration : 0;

    // EDF+ stores seizure markers in a reserved annotation channel
    const isAnnotation = label === 'EDF Annotations' || label === 'BDF Annotations';

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
      isAnnotation,
      data: null,   // filled below
    });
  }

  // ── Validate before reading data ────────────────────────────────────────────
  const expectedDataBytes = numRecords * signals.reduce(
    (sum, s) => sum + s.samplesPerRec * 2, 0
  );
  const availableDataBytes = buffer.byteLength - headerBytes;

  if (availableDataBytes < expectedDataBytes) {
    console.warn(
      `EDF truncated: expected ${expectedDataBytes} data bytes, ` +
      `got ${availableDataBytes}. Some records may be incomplete.`
    );
  }

  // ── Allocate output arrays ──────────────────────────────────────────────────
  for (let i = 0; i < numSignals; i++) {
    signals[i].data = new Float32Array(numRecords * signals[i].samplesPerRec);
  }

  // ── Read data records ───────────────────────────────────────────────────────
  //
  // EDF data is stored record-by-record, signals interleaved within each record.
  // Each sample is a 2-byte signed little-endian integer.
  //
  let offset = headerBytes;
  let recordsRead = 0;

  outer: for (let rec = 0; rec < numRecords; rec++) {
    for (let i = 0; i < numSignals; i++) {
      const n = signals[i].samplesPerRec;
      const base = rec * n;
      for (let s = 0; s < n; s++) {
        if (offset + 2 > buffer.byteLength) break outer;
        const raw = view.getInt16(offset, /* littleEndian= */ true);
        signals[i].data[base + s] = raw * signals[i].scale + signals[i].dc;
        offset += 2;
      }
    }
    recordsRead++;
  }

  if (recordsRead < numRecords) {
    console.warn(`Only ${recordsRead}/${numRecords} records read (truncated file)`);
    for (let i = 0; i < numSignals; i++) {
      const actualLen = recordsRead * signals[i].samplesPerRec;
      signals[i].data = signals[i].data.subarray(0, actualLen);
    }
  }

  // ── Parse EDF+ annotations ──────────────────────────────────────────────────
  let annotations = [];
  if (isEDFPlus) {
    annotations = _parseAnnotations(signals, recordsRead);
  }

  return {
    patient,
    recording,
    startDate,
    startTime,
    headerBytes,
    numRecords: recordsRead,
    recordDuration,
    duration: recordsRead * recordDuration,
    isEDFPlus,
    isDiscontinuous,
    annotations,
    signals:    signals.filter(s => !s.isAnnotation),
    allSignals: signals,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: EDF+ ANNOTATION PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract seizure onset markers from EDF+ annotation channels.
 * Annotations are stored as TAL (Time-stamped Annotation Lists) encoded
 * as ASCII text packed into int16 fields in the data records.
 *
 * TAL format: +onset\x15[duration]\x14[label]\x14\x00
 */
function _parseAnnotations(signals, numRecords) {
  const annotations = [];
  const annotSignals = signals.filter(s => s.isAnnotation);

  for (const sig of annotSignals) {
    for (let rec = 0; rec < numRecords; rec++) {
      const start = rec * sig.samplesPerRec;
      const end   = Math.min(start + sig.samplesPerRec, sig.data.length);

      // Recover raw int16 bytes from physical values (annotation channels
      // store ASCII in the binary fields, so we reverse the scaling)
      const bytes = [];
      for (let i = start; i < end; i++) {
        const raw = Math.round((sig.data[i] - sig.dc) / (sig.scale || 1));
        bytes.push(raw & 0xFF);
        bytes.push((raw >> 8) & 0xFF);
      }

      const text = String.fromCharCode(...bytes.filter(b => b !== 0));
      const tals  = text.split('\x14').filter(Boolean);

      for (const tal of tals) {
        const parts    = tal.split('\x15');
        if (!parts[0]) continue;
        const onset    = parseFloat(parts[0].replace(/[^0-9.+-]/g, ''));
        if (isNaN(onset)) continue;
        const duration = parts.length > 1 ? (parseFloat(parts[1]) || 0) : 0;
        const label    = parts.length > 2 ? parts.slice(2).join(' ').trim() : '';
        if (label) annotations.push({ onset, duration, label });
      }
    }
  }

  annotations.sort((a, b) => a.onset - b.onset);
  return annotations;
}
