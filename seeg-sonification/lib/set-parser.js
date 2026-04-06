/**
 * set-parser.js — EEGLAB .set File Parser (MATLAB v5 .mat format)
 *
 * Parses EEGLAB .set files directly in the browser. These are MATLAB v5
 * binary files containing an EEG struct with channel data, labels, and
 * sampling rate.
 *
 * When data is stored externally in a .fdt file (raw float32), the caller
 * must provide that buffer separately.
 *
 * Returns the same shape as parseEDF() so it plugs directly into
 * analyzeImport() with no changes needed downstream.
 *
 * Limitations:
 *   - MATLAB v7.3 (.mat files using HDF5) are NOT supported — detected and
 *     rejected with a clear error message.
 *   - Only extracts fields needed for EEG: data, srate, chanlocs, nbchan,
 *     pnts, xmin, xmax, event.
 *
 * Exports:
 *   parseSET(setBuffer, fdtBuffer?) → parseEDF-compatible result
 */


// ─────────────────────────────────────────────────────────────────────────────
// MATLAB v5 MAT-FILE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MI_INT8       = 1;
const MI_UINT8      = 2;
const MI_INT16      = 3;
const MI_UINT16     = 4;
const MI_INT32      = 5;
const MI_UINT32     = 6;
const MI_SINGLE     = 7;
const MI_DOUBLE     = 9;
const MI_INT64      = 12;
const MI_UINT64     = 13;
const MI_MATRIX     = 14;
const MI_COMPRESSED = 15;
const MI_UTF8       = 16;
const MI_UTF16      = 17;
const MI_UTF32      = 18;

const MX_CELL       = 1;
const MX_STRUCT     = 2;
const MX_CHAR       = 4;
const MX_DOUBLE     = 6;
const MX_SINGLE     = 7;
const MX_INT8       = 8;
const MX_UINT8      = 9;
const MX_INT16      = 10;
const MX_UINT16     = 11;
const MX_INT32      = 12;
const MX_UINT32     = 13;
const MX_INT64      = 14;
const MX_UINT64     = 15;


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an EEGLAB .set file and optional .fdt data file.
 *
 * @param {ArrayBuffer} setBuffer — contents of the .set file
 * @param {ArrayBuffer|null} fdtBuffer — contents of the .fdt file (if data is external)
 * @returns {Object} — same shape as parseEDF() output
 */
export async function parseSET(setBuffer, fdtBuffer = null) {
  // ── Check for HDF5 (MATLAB v7.3) ────────────────────────────────────────
  const magic = new Uint8Array(setBuffer, 0, 8);
  const hdf5sig = [0x89, 0x48, 0x44, 0x46, 0x0D, 0x0A, 0x1A, 0x0A];
  if (hdf5sig.every((b, i) => magic[i] === b)) {
    throw new Error(
      'This .set file uses MATLAB v7.3 (HDF5) format, which is not supported.\n\n' +
      'To convert, open MATLAB and run:\n' +
      "  load('yourfile.set', '-mat');\n" +
      "  save('yourfile_v5.set', 'EEG', '-v6');\n\n" +
      'Or in EEGLAB: File → Save as → select MATLAB v6 format.'
    );
  }

  // ── Parse MAT v5 header ──────────────────────────────────────────────────
  const headerText = _readAscii(setBuffer, 0, 116);
  const view = new DataView(setBuffer);
  const version = view.getUint16(124, true);
  const endianMark = _readAscii(setBuffer, 126, 2);
  const littleEndian = (endianMark === 'IM');

  if (endianMark !== 'IM' && endianMark !== 'MI') {
    throw new Error('Not a valid MATLAB v5 .mat file (bad endian marker: "' + endianMark + '")');
  }

  // ── Read top-level data elements ─────────────────────────────────────────
  const variables = {};
  let offset = 128;
  let elemCount = 0;

  while (offset < setBuffer.byteLength) {
    const elem = await _readDataElement(setBuffer, offset, littleEndian);
    if (!elem) break;
    elemCount++;
    console.log(`[set-parser] element #${elemCount}: type=${elem.type}, name="${elem.name}", hasValue=${elem.value != null}, nextOffset=${elem.nextOffset}`);
    if (elem.name) {
      variables[elem.name] = elem.value;
    }
    offset = elem.nextOffset;
  }

  console.log(`[set-parser] parsed ${elemCount} elements, variables: [${Object.keys(variables).join(', ')}]`);

  // ── Find the EEG struct ──────────────────────────────────────────────────
  // EEGLAB saves in two styles:
  //   1. Single 'EEG' struct variable containing all fields
  //   2. Each field as a separate top-level variable (save -struct flag / older versions)
  let EEG = variables['EEG'] || variables['eeg'];
  if (!EEG || typeof EEG !== 'object') {
    // Check for struct-style: srate/nbchan/data exist as top-level variables
    if (variables['srate'] != null && variables['data'] != null) {
      console.log('[set-parser] no EEG struct found — using top-level variables as EEG fields');
      EEG = variables;
    } else {
      EEG = Object.values(variables)[0];
    }
  }
  if (!EEG || typeof EEG !== 'object') {
    throw new Error('Could not find EEG struct or fields in .set file.');
  }

  // The EEG variable might be a struct array with one element
  const eeg = Array.isArray(EEG) ? EEG[0] : EEG;

  // ── Extract metadata ─────────────────────────────────────────────────────
  const srate  = _getNum(eeg, 'srate') || _getNum(eeg, 'Fs') || 256;
  const nbchan = _getNum(eeg, 'nbchan') || 0;
  const pnts   = _getNum(eeg, 'pnts') || 0;
  const xmin   = _getNum(eeg, 'xmin') || 0;
  const xmax   = _getNum(eeg, 'xmax') || 0;

  // ── Extract channel labels ───────────────────────────────────────────────
  const chanlocs = eeg.chanlocs || eeg.Chanlocs || null;
  const labels = _extractLabels(chanlocs, nbchan);

  // ── Extract data ─────────────────────────────────────────────────────────
  let data = null; // channels × timepoints

  const _dataType = eeg.data == null ? 'null' :
    typeof eeg.data === 'string' ? `string("${eeg.data.slice(0, 60)}")` :
    eeg.data?.constructor?.name || typeof eeg.data;
  const _dims = eeg.data?._dims || 'none';
  console.log(`[set-parser] srate=${srate}, nbchan=${nbchan}, pnts=${pnts}, data type=${_dataType}, data length=${eeg.data?.length ?? 'N/A'}, dims=${_dims}, fdtBuffer=${fdtBuffer ? fdtBuffer.byteLength + ' bytes' : 'none'}`);

  // Case 1: data is inline (numeric array)
  if (eeg.data != null && (eeg.data instanceof Float32Array || eeg.data instanceof Float64Array)) {
    data = eeg.data;
  } else if (eeg.data != null && Array.isArray(eeg.data)) {
    data = new Float32Array(eeg.data);
  }

  // Case 2: data is a filename string → use fdtBuffer
  if (data === null && typeof eeg.data === 'string') {
    if (!fdtBuffer) {
      const fdtName = eeg.data.trim();
      throw new Error(
        'This .set file stores data externally in "' + fdtName + '".\n\n' +
        'Please drop both the .set and .fdt files together.'
      );
    }
    data = new Float32Array(fdtBuffer);
  }

  // Case 3: data stored as raw bytes in a numeric matrix we already parsed
  if (data === null && fdtBuffer) {
    data = new Float32Array(fdtBuffer);
  }

  if (data === null) {
    throw new Error('Could not extract EEG data from .set file. Data field is missing or unrecognized.');
  }

  // ── Determine dimensions ─────────────────────────────────────────────────
  const nChannels = nbchan || (pnts > 0 ? Math.round(data.length / pnts) : labels.length || 1);
  const nPoints   = pnts   || Math.floor(data.length / nChannels);

  if (data.length < nChannels * nPoints) {
    throw new Error(
      'Data size mismatch: expected ' + (nChannels * nPoints) + ' samples ' +
      '(' + nChannels + ' ch × ' + nPoints + ' pts), got ' + data.length
    );
  }

  // ── Build signals array (same shape as parseEDF) ─────────────────────────
  const duration = nPoints / srate;
  // Fake a record structure compatible with EDF expectations
  const recordDuration = 1; // 1-second records
  const samplesPerRec  = Math.round(srate);
  const numRecords     = Math.ceil(duration);

  // Detect storage order: MAT v5 inline data is column-major,
  // but .fdt data (raw float32 blob) is row-major (contiguous channels).
  // Heuristic: sample channel 0 with both strides, compare variance.
  let _isColumnMajor = false;
  if (nChannels > 1 && nPoints > 100) {
    let sumRow = 0, sumRow2 = 0, sumCol = 0, sumCol2 = 0;
    const N = Math.min(100, nPoints);
    for (let t = 0; t < N; t++) {
      const vRow = data[t];                    // row-major: ch0 contiguous
      const vCol = data[t * nChannels];        // col-major: stride by nChannels
      sumRow += vRow; sumRow2 += vRow * vRow;
      sumCol += vCol; sumCol2 += vCol * vCol;
    }
    const varRow = sumRow2 / N - (sumRow / N) ** 2;
    const varCol = sumCol2 / N - (sumCol / N) ** 2;
    _isColumnMajor = varCol > varRow;
    console.log(`[set-parser] storage: varRow=${varRow.toExponential(3)}, varCol=${varCol.toExponential(3)} → ${_isColumnMajor ? 'column-major' : 'row-major'}`);
  }

  const signals = [];
  for (let ch = 0; ch < nChannels; ch++) {
    const channelData = new Float32Array(nPoints);
    if (_isColumnMajor) {
      for (let t = 0; t < nPoints; t++) channelData[t] = data[t * nChannels + ch];
    } else {
      const base = ch * nPoints;
      for (let t = 0; t < nPoints; t++) channelData[t] = data[base + t];
    }

    // Compute physical min/max for metadata
    let physMin = Infinity, physMax = -Infinity;
    for (let t = 0; t < nPoints; t++) {
      const v = channelData[t];
      if (v < physMin) physMin = v;
      if (v > physMax) physMax = v;
    }

    const label = labels[ch] || ('Ch' + (ch + 1));

    signals.push({
      label,
      transducer:    '',
      physDim:       'uV',        // EEGLAB data is typically in µV
      physMin,
      physMax,
      digMin:        -32768,
      digMax:        32767,
      prefilter:     '',
      samplesPerRec,
      fs:            srate,
      scale:         1,           // data is already in physical units
      dc:            0,
      isAnnotation:  false,
      data:          channelData,
    });
  }

  // ── Extract events as annotations ────────────────────────────────────────
  const annotations = _extractEvents(eeg, srate);

  // ── Return parseEDF-compatible shape ─────────────────────────────────────
  return {
    patient:        eeg.subject  || eeg.setname || '(EEGLAB)',
    recording:      eeg.setname  || eeg.filename || '(EEGLAB .set)',
    startDate:      '',
    startTime:      '',
    headerBytes:    0,
    numRecords,
    recordDuration,
    duration,
    isEDFPlus:      false,
    isDiscontinuous: false,
    annotations,
    signals,
    allSignals:     signals,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// MAT v5 BINARY PARSER
// ─────────────────────────────────────────────────────────────────────────────

/** Read ASCII string from buffer. */
function _readAscii(buffer, offset, length) {
  const bytes = new Uint8Array(buffer, offset, length);
  let s = '';
  for (let i = 0; i < length; i++) {
    if (bytes[i] === 0) break;
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

/**
 * Read a single MAT v5 data element at the given offset.
 * Returns { type, size, data, name, value, nextOffset }.
 */
async function _readDataElement(buffer, offset, le) {
  if (offset + 8 > buffer.byteLength) return null;

  const view = new DataView(buffer);

  // Check for Small Data Element format (SDE):
  // If the two upper bytes of the first 4-byte word are non-zero,
  // this is an SDE where type is in lower 2 bytes, size in upper 2 bytes,
  // and data is in the next 4 bytes.
  let type, size, dataOffset, nextOffset;

  const word0 = view.getUint32(offset, le);
  const upperTwo = le ? (word0 >>> 16) : (word0 & 0xFFFF);

  if (upperTwo !== 0 && upperTwo <= 4) {
    // Small Data Element
    type = le ? (word0 & 0xFFFF) : (word0 >>> 16);
    size = upperTwo;
    dataOffset = offset + 4;
    nextOffset = offset + 8;
  } else {
    // Normal tag
    type = view.getUint32(offset, le);
    size = view.getUint32(offset + 4, le);
    dataOffset = offset + 8;
    // Data is padded to 8-byte boundary
    nextOffset = dataOffset + Math.ceil(size / 8) * 8;
  }

  if (dataOffset + size > buffer.byteLength) return null;

  // Handle compressed elements
  if (type === MI_COMPRESSED) {
    console.log(`[set-parser] compressed element at offset ${offset}, size=${size}`);
    try {
      const compressed = new Uint8Array(buffer, dataOffset, size);
      const decompressed = await _decompress(compressed);
      console.log(`[set-parser] decompressed ${size} → ${decompressed.byteLength} bytes`);
      // Parse the decompressed data as a data element
      const inner = await _readDataElement(decompressed.buffer, 0, le);
      if (inner) {
        inner.nextOffset = nextOffset;
        return inner;
      }
      console.warn('[set-parser] decompressed but inner parse returned null');
    } catch (e) {
      console.warn('[set-parser] decompression failed at offset', offset, e.message || e);
      return { type, size, name: null, value: null, nextOffset };
    }
  }

  // Handle matrix elements
  if (type === MI_MATRIX) {
    const result = await _parseMatrix(buffer, dataOffset, dataOffset + size, le);
    return { type, size, name: result.name, value: result.value, nextOffset };
  }

  return { type, size, name: null, value: null, nextOffset };
}

/**
 * Decompress zlib-compressed data using DecompressionStream.
 */
async function _decompress(compressed) {
  // Try browser DecompressionStream first
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      // Write compressed data and close
      writer.write(compressed);
      writer.close();

      // Read all decompressed chunks
      const chunks = [];
      let totalLen = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLen += value.byteLength;
      }

      // Concatenate
      const result = new Uint8Array(totalLen);
      let pos = 0;
      for (const chunk of chunks) {
        result.set(new Uint8Array(chunk.buffer || chunk), pos);
        pos += chunk.byteLength;
      }
      return result;
    } catch (_) {
      // Fall through to manual attempt
    }
  }

  // Fallback: try raw inflate (skip 2-byte zlib header)
  if (typeof DecompressionStream !== 'undefined') {
    const raw = compressed.slice(2); // skip zlib header
    const ds = new DecompressionStream('raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(raw);
    writer.close();

    const chunks = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLen += value.byteLength;
    }
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk.buffer || chunk), pos);
      pos += chunk.byteLength;
    }
    return result;
  }

  throw new Error('No decompression API available');
}

/**
 * Parse a MI_MATRIX element into a JS value.
 * Handles: numeric arrays, char arrays, structs, cell arrays.
 */
async function _parseMatrix(buffer, start, end, le) {
  let pos = start;
  const view = new DataView(buffer);

  // Sub-element reader
  function readTag() {
    if (pos + 4 > end) return null;
    const word0 = view.getUint32(pos, le);
    const upper = le ? (word0 >>> 16) : (word0 & 0xFFFF);
    let type, size, dOff, nOff;

    if (upper !== 0 && upper <= 4) {
      // Small data element
      type = le ? (word0 & 0xFFFF) : (word0 >>> 16);
      size = upper;
      dOff = pos + 4;
      nOff = pos + 8;
    } else {
      type = view.getUint32(pos, le);
      size = view.getUint32(pos + 4, le);
      dOff = pos + 8;
      nOff = dOff + Math.ceil(size / 8) * 8;
    }

    if (dOff + size > buffer.byteLength) return null;
    return { type, size, dataOffset: dOff, nextOffset: nOff };
  }

  // 1. Array flags
  const flagsTag = readTag();
  if (!flagsTag) return { name: '', value: null };
  const arrayClass = view.getUint8(flagsTag.dataOffset + (le ? 0 : 3)) & 0xFF;
  pos = flagsTag.nextOffset;

  // 2. Dimensions
  const dimsTag = readTag();
  if (!dimsTag) return { name: '', value: null };
  const nDims = dimsTag.size / 4;
  const dims = [];
  for (let i = 0; i < nDims; i++) {
    dims.push(view.getInt32(dimsTag.dataOffset + i * 4, le));
  }
  pos = dimsTag.nextOffset;

  // 3. Name
  const nameTag = readTag();
  if (!nameTag) return { name: '', value: null };
  const name = _readAscii(buffer, nameTag.dataOffset, nameTag.size);
  pos = nameTag.nextOffset;

  // ── Numeric arrays ──────────────────────────────────────────────────────
  if ([MX_DOUBLE, MX_SINGLE, MX_INT8, MX_UINT8, MX_INT16, MX_UINT16,
       MX_INT32, MX_UINT32, MX_INT64, MX_UINT64].includes(arrayClass)) {
    const dataTag = readTag();
    if (!dataTag) return { name, value: null };

    const value = _readNumericData(buffer, dataTag.dataOffset, dataTag.size, dataTag.type, le);
    pos = dataTag.nextOffset;

    // Scalar → unwrap
    if (value.length === 1) return { name, value: value[0] };
    // Return typed array with dimension info
    value._dims = dims;
    return { name, value };
  }

  // ── Character arrays ────────────────────────────────────────────────────
  if (arrayClass === MX_CHAR) {
    const dataTag = readTag();
    if (!dataTag) return { name, value: '' };

    let str = '';
    if (dataTag.type === MI_UTF8 || dataTag.type === MI_INT8 || dataTag.type === MI_UINT8) {
      str = _readAscii(buffer, dataTag.dataOffset, dataTag.size);
    } else if (dataTag.type === MI_UTF16 || dataTag.type === MI_UINT16) {
      const arr = new Uint16Array(buffer.slice(dataTag.dataOffset, dataTag.dataOffset + dataTag.size));
      str = String.fromCharCode(...arr).replace(/\0+$/, '');
    } else {
      // Fallback: try ASCII
      str = _readAscii(buffer, dataTag.dataOffset, dataTag.size);
    }

    return { name, value: str.trim() };
  }

  // ── Struct arrays ───────────────────────────────────────────────────────
  if (arrayClass === MX_STRUCT) {
    // Field name length
    const fnLenTag = readTag();
    if (!fnLenTag) return { name, value: {} };
    const fieldNameLen = view.getInt32(fnLenTag.dataOffset, le);
    pos = fnLenTag.nextOffset;

    // Field names
    const fnTag = readTag();
    if (!fnTag) return { name, value: {} };
    const numFields = fnTag.size / fieldNameLen;
    const fieldNames = [];
    for (let i = 0; i < numFields; i++) {
      fieldNames.push(_readAscii(buffer, fnTag.dataOffset + i * fieldNameLen, fieldNameLen));
    }
    pos = fnTag.nextOffset;

    // Number of struct elements
    const numElements = dims.reduce((a, b) => a * b, 1);

    // Read field values
    const structs = [];
    for (let e = 0; e < numElements; e++) {
      const obj = {};
      for (const fn of fieldNames) {
        if (pos >= end) break;

        const elemTag = readTag();
        if (!elemTag) break;

        if (elemTag.type === MI_MATRIX && elemTag.size > 0) {
          const inner = await _parseMatrix(buffer, elemTag.dataOffset,
            elemTag.dataOffset + elemTag.size, le);
          obj[fn] = inner.value;
        } else {
          // Empty matrix or non-matrix field
          obj[fn] = null;
        }
        pos = elemTag.nextOffset;
      }
      structs.push(obj);
    }

    return { name, value: numElements === 1 ? structs[0] : structs };
  }

  // ── Cell arrays ─────────────────────────────────────────────────────────
  if (arrayClass === MX_CELL) {
    const numElements = dims.reduce((a, b) => a * b, 1);
    const cells = [];

    for (let i = 0; i < numElements; i++) {
      if (pos >= end) break;
      const elemTag = readTag();
      if (!elemTag) break;

      if (elemTag.type === MI_MATRIX && elemTag.size > 0) {
        const inner = await _parseMatrix(buffer, elemTag.dataOffset,
          elemTag.dataOffset + elemTag.size, le);
        cells.push(inner.value);
      } else {
        cells.push(null);
      }
      pos = elemTag.nextOffset;
    }

    return { name, value: cells };
  }

  return { name, value: null };
}

/**
 * Read numeric data from a MAT element into a typed array.
 */
function _readNumericData(buffer, offset, size, type, le) {
  switch (type) {
    case MI_DOUBLE: {
      const n = size / 8;
      const arr = new Float64Array(n);
      const v = new DataView(buffer);
      for (let i = 0; i < n; i++) arr[i] = v.getFloat64(offset + i * 8, le);
      return arr;
    }
    case MI_SINGLE: {
      const n = size / 4;
      const arr = new Float32Array(n);
      const v = new DataView(buffer);
      for (let i = 0; i < n; i++) arr[i] = v.getFloat32(offset + i * 4, le);
      return arr;
    }
    case MI_INT32: {
      const n = size / 4;
      const arr = new Int32Array(n);
      const v = new DataView(buffer);
      for (let i = 0; i < n; i++) arr[i] = v.getInt32(offset + i * 4, le);
      return arr;
    }
    case MI_UINT32: {
      const n = size / 4;
      const arr = new Uint32Array(n);
      const v = new DataView(buffer);
      for (let i = 0; i < n; i++) arr[i] = v.getUint32(offset + i * 4, le);
      return arr;
    }
    case MI_INT16: {
      const n = size / 2;
      const arr = new Int16Array(n);
      const v = new DataView(buffer);
      for (let i = 0; i < n; i++) arr[i] = v.getInt16(offset + i * 2, le);
      return arr;
    }
    case MI_UINT16: {
      const n = size / 2;
      const arr = new Uint16Array(n);
      const v = new DataView(buffer);
      for (let i = 0; i < n; i++) arr[i] = v.getUint16(offset + i * 2, le);
      return arr;
    }
    case MI_INT8: {
      return new Int8Array(buffer.slice(offset, offset + size));
    }
    case MI_UINT8: {
      return new Uint8Array(buffer.slice(offset, offset + size));
    }
    default: {
      // Fallback: try as float64
      const n = size / 8;
      if (n > 0 && Number.isInteger(n)) {
        const arr = new Float64Array(n);
        const v = new DataView(buffer);
        for (let i = 0; i < n; i++) arr[i] = v.getFloat64(offset + i * 8, le);
        return arr;
      }
      return new Float32Array(0);
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FIELD EXTRACTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Safely get a numeric field from the EEG struct. */
function _getNum(obj, key) {
  if (!obj) return null;
  const v = obj[key];
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Float64Array || v instanceof Float32Array) return v[0];
  if (Array.isArray(v)) return Number(v[0]);
  return Number(v) || null;
}

/**
 * Extract channel labels from chanlocs struct.
 * EEGLAB chanlocs is a struct array with a 'labels' field.
 */
function _extractLabels(chanlocs, nbchan) {
  const labels = [];

  if (!chanlocs) {
    for (let i = 0; i < nbchan; i++) labels.push('Ch' + (i + 1));
    return labels;
  }

  // chanlocs can be: array of structs, or a single struct with array fields
  if (Array.isArray(chanlocs)) {
    for (const loc of chanlocs) {
      if (loc && (loc.labels || loc.Labels)) {
        labels.push(String(loc.labels || loc.Labels).trim());
      } else {
        labels.push('Ch' + (labels.length + 1));
      }
    }
  } else if (typeof chanlocs === 'object') {
    // Single struct — labels might be a cell array of strings
    const lblField = chanlocs.labels || chanlocs.Labels;
    if (Array.isArray(lblField)) {
      for (const l of lblField) labels.push(String(l).trim());
    } else if (typeof lblField === 'string') {
      labels.push(lblField.trim());
    }
  }

  // Pad if needed
  while (labels.length < nbchan) {
    labels.push('Ch' + (labels.length + 1));
  }

  return labels;
}

/**
 * Extract EEGLAB events as annotations (same shape as EDF+ annotations).
 */
function _extractEvents(eeg, srate) {
  const events = eeg.event || eeg.Event;
  if (!events) return [];

  const annotations = [];
  const eventList = Array.isArray(events) ? events : [events];

  for (const evt of eventList) {
    if (!evt) continue;

    const latency = _getNum(evt, 'latency');
    if (latency == null) continue;

    // EEGLAB latency is in samples (1-indexed)
    const onset = (latency - 1) / srate;
    const duration = (_getNum(evt, 'duration') || 0) / srate;
    const label = String(evt.type || evt.Type || 'event').trim();

    annotations.push({ onset, duration, label });
  }

  annotations.sort((a, b) => a.onset - b.onset);
  return annotations;
}
