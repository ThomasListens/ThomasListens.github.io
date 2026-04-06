/**
 * export.js — sEEG Sonification Toolkit Export System
 *
 * Three export capabilities:
 *   1. WAV Audio Export (synthesis re-render or raw EEG)
 *   2. REAPER Automation Envelope Export (CSV + REAPER snippet)
 *   3. Wavetable Export (single-cycle or stacked multi-frame)
 *
 * All functions are pure — no shared state, no DOM access except download trigger.
 * Designed to be importable as utility functions for future real-time modules.
 *
 * Exports:
 *   exportWAV(channels, engine, options)     → triggers .wav download
 *   exportAutomation(channel, options)        → triggers .csv + .txt download
 *   exportWavetable(channel, options)         → triggers .wav download
 */

import { createVoiceGraph } from './synthesis.js';
import {
  mapControls, assignPitches, buildMasterAmplitude, buildActivityCurve,
  buildRootAmpCurve, buildMorphologyCurves, buildFMIndexCurve, buildFMAmpCurve,
  computeDistortionCurve, detectEvents, injectTransientExcitation,
} from './mapping.js';


// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Linear interpolation resampler. */
function resample(signal, fromRate, toRate) {
  if (fromRate === toRate) return new Float32Array(signal);
  const ratio = fromRate / toRate;
  const outLength = Math.floor(signal.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = signal[idx] ?? 0;
    const b = signal[idx + 1] ?? a;
    out[i] = a + frac * (b - a);
  }
  return out;
}

/** Normalize a Float32Array to ±1.0 peak in-place. Returns the scale factor. */
function normalizePeak(signal) {
  let peak = 0;
  for (let i = 0; i < signal.length; i++) {
    const abs = Math.abs(signal[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return 0;
  const scale = 1.0 / peak;
  for (let i = 0; i < signal.length; i++) signal[i] *= scale;
  return scale;
}

/** Normalize to [0, 1] range. */
function normalizeRange01(signal) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < signal.length; i++) {
    if (signal[i] < min) min = signal[i];
    if (signal[i] > max) max = signal[i];
  }
  const range = max - min;
  if (range === 0) { signal.fill(0.5); return; }
  for (let i = 0; i < signal.length; i++) signal[i] = (signal[i] - min) / range;
}

/**
 * WAV encoder — pure JS, no dependencies.
 * @param {Float32Array[]} channelBuffers — one per channel, all same length
 * @param {number} sampleRate
 * @param {number} bitDepth — 16 or 32
 * @returns {Blob}
 */
function encodeWAV(channelBuffers, sampleRate, bitDepth) {
  const numChannels = channelBuffers.length;
  const numSamples  = channelBuffers[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate   = sampleRate * blockAlign;
  const dataSize   = numSamples * blockAlign;
  const audioFormat = bitDepth === 32 ? 3 : 1; // 3=IEEE float, 1=PCM

  // fmt chunk size: 16 for PCM, 18 for float (extra 2 bytes for cbSize=0)
  const fmtChunkSize = bitDepth === 32 ? 18 : 16;
  const headerSize = 12 + (8 + fmtChunkSize) + 8; // RIFF + fmt + data header
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view   = new DataView(buffer);
  let offset = 0;

  function writeStr(s) { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); }
  function writeU32(v) { view.setUint32(offset, v, true); offset += 4; }
  function writeU16(v) { view.setUint16(offset, v, true); offset += 2; }

  // RIFF header
  writeStr('RIFF');
  writeU32(fileSize - 8);
  writeStr('WAVE');

  // fmt chunk
  writeStr('fmt ');
  writeU32(fmtChunkSize);
  writeU16(audioFormat);
  writeU16(numChannels);
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(bitDepth);
  if (bitDepth === 32) writeU16(0); // cbSize for float format

  // data chunk
  writeStr('data');
  writeU32(dataSize);

  // Interleaved sample data
  for (let s = 0; s < numSamples; s++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const val = channelBuffers[ch][s] ?? 0;
      if (bitDepth === 32) {
        view.setFloat32(offset, val, true);
        offset += 4;
      } else {
        const i16 = Math.max(-32768, Math.min(32767, Math.round(val * 32767)));
        view.setInt16(offset, i16, true);
        offset += 2;
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Trigger a file download. */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Sanitize a label for use in filenames. */
function safeLabel(label) {
  return label.replace(/[^a-zA-Z0-9_-]/g, '_');
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. WAV AUDIO EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export sonification or raw EEG as WAV.
 *
 * @param {Array} channels — preprocessed channel objects with .data, .fs, .label, .features
 * @param {Object} options
 * @param {string} options.mode — 'synthesis' | 'raw'
 * @param {string} options.scope — 'whole' | 'selection'
 * @param {number} [options.selectionStart] — seconds
 * @param {number} [options.selectionEnd] — seconds
 * @param {boolean} [options.sumChannels=true]
 * @param {number} [options.bitDepth=32]
 * @param {number} [options.sampleRate=48000]
 * @param {Object} [options.synthConfig] — { controls, masterTune, ratioOverrides, tuningMode, octaveCap, primeLimit, layerMix, playbackRate }
 * @param {Function} [options.onProgress] — callback(message)
 */
export async function exportWAV(channels, options = {}) {
  const {
    mode = 'raw',
    scope = 'whole',
    selectionStart = 0,
    selectionEnd = 0,
    sumChannels = true,
    bitDepth = 32,
    sampleRate = 48000,
    synthConfig = null,
    onProgress = null,
  } = options;

  if (!channels || channels.length === 0) {
    throw new Error('No channels to export.');
  }

  const scopeLabel = scope === 'selection' ? 'sel' : 'full';

  if (mode === 'raw') {
    // ── Raw EEG export ──────────────────────────────────────────────────
    const buffers = [];
    for (const ch of channels) {
      const startSamp = scope === 'selection' ? Math.floor(selectionStart * ch.fs) : 0;
      const endSamp   = scope === 'selection' ? Math.ceil(selectionEnd * ch.fs) : ch.data.length;
      const slice = ch.data.slice(startSamp, endSamp);
      const resampled = resample(slice, ch.fs, sampleRate);
      normalizePeak(resampled);
      buffers.push({ data: resampled, label: ch.label });
    }

    if (sumChannels && buffers.length > 1) {
      const len = Math.max(...buffers.map(b => b.data.length));
      const mixed = new Float32Array(len);
      for (const b of buffers) {
        for (let i = 0; i < b.data.length; i++) mixed[i] += b.data[i];
      }
      normalizePeak(mixed);
      const blob = encodeWAV([mixed], sampleRate, bitDepth);
      triggerDownload(blob, `seeg_raw_mixed_${scopeLabel}.wav`);
    } else {
      for (const b of buffers) {
        const blob = encodeWAV([b.data], sampleRate, bitDepth);
        triggerDownload(blob, `seeg_raw_${safeLabel(b.label)}_${scopeLabel}.wav`);
      }
    }

  } else if (mode === 'synthesis') {
    // ── Synthesis re-render via OfflineAudioContext ──────────────────────
    if (!synthConfig) throw new Error('Synthesis config required for synthesis export.');

    const { controls, masterTune = 130, ratioOverrides = null,
            tuningMode = 'rank', octaveCap = 4, primeLimit = null,
            layerMix = { root: 1, phase: 1, fm: 1, transient: 1 },
            playbackRate = 1.0 } = synthConfig;

    const synthParams = mapControls(controls);
    const pitchMapExport = assignPitches(channels, masterTune, ratioOverrides, tuningMode, octaveCap, primeLimit);

    const startSec = scope === 'selection' ? selectionStart : 0;
    const endSec   = scope === 'selection' ? selectionEnd :
      channels.reduce((mx, ch) => Math.max(mx, ch.data.length / ch.fs), 0);
    const dataDuration = endSec - startSec;
    const renderDuration = dataDuration / playbackRate;

    if (onProgress) onProgress(`Rendering ${dataDuration.toFixed(1)}s of synthesis audio...`);

    const AUTOMATION_RATE = 60;

    if (sumChannels) {
      // Render all channels into one OfflineAudioContext
      const offCtx = new OfflineAudioContext(2, Math.ceil(renderDuration * sampleRate), sampleRate);
      const masterGain = offCtx.createGain();
      const n = channels.length || 1;
      const vol = synthParams.masterVolume ?? 0.7;
      masterGain.gain.value = vol / Math.sqrt(n);
      masterGain.connect(offCtx.destination);

      _renderVoices(offCtx, masterGain, channels, synthParams, pitchMapExport,
        layerMix, startSec, renderDuration, AUTOMATION_RATE);

      const rendered = await offCtx.startRendering();
      const chBufs = [];
      for (let c = 0; c < rendered.numberOfChannels; c++) {
        chBufs.push(rendered.getChannelData(c));
      }
      const blob = encodeWAV(chBufs, sampleRate, bitDepth);
      triggerDownload(blob, `seeg_synth_mixed_${scopeLabel}.wav`);

    } else {
      // Render each channel separately
      for (const ch of channels) {
        if (onProgress) onProgress(`Rendering ${ch.label}...`);
        const offCtx = new OfflineAudioContext(2, Math.ceil(renderDuration * sampleRate), sampleRate);
        const masterGain = offCtx.createGain();
        masterGain.gain.value = synthParams.masterVolume ?? 0.7;
        masterGain.connect(offCtx.destination);

        _renderVoices(offCtx, masterGain, [ch], synthParams, pitchMapExport,
          layerMix, startSec, renderDuration, AUTOMATION_RATE);

        const rendered = await offCtx.startRendering();
        const chBufs = [];
        for (let c = 0; c < rendered.numberOfChannels; c++) {
          chBufs.push(rendered.getChannelData(c));
        }
        const blob = encodeWAV(chBufs, sampleRate, bitDepth);
        triggerDownload(blob, `seeg_synth_${safeLabel(ch.label)}_${scopeLabel}.wav`);
      }
    }
  }
}

/**
 * Build and activate voice graphs on an OfflineAudioContext.
 * Mirrors engine.js #activateVoices but for offline rendering.
 */
function _renderVoices(ctx, destination, channels, synthParams, pitchMap, layerMix, startSec, renderDuration, AUTOMATION_RATE) {
  const START_LATENCY = 0.05;
  const t0 = ctx.currentTime + START_LATENCY;

  // Compute global p95 for intensity scaling
  const globalP95 = channels.reduce((mx, ch) => {
    return Math.max(mx, ch.features?.calibration?.ampCeiling ?? 0);
  }, 0);

  for (const ch of channels) {
    if (!ch.features) continue;
    const pitch = pitchMap.get(ch.label) ?? { hz: 220, pan: 0 };
    const durCh = ch.data.length / ch.fs;
    const features = ch.features;

    // Build curves (same as engine.prepare)
    const masterAmp     = buildMasterAmplitude(features, synthParams, durCh);
    const activityCurve = buildActivityCurve(features, synthParams, durCh);

    // Intensity scaling
    const intensityBlend = 1.0 - (synthParams.intensity ?? 0);
    if (intensityBlend > 0 && globalP95 > 0) {
      const chCeil = features.calibration?.ampCeiling ?? globalP95;
      const scale  = 1.0 - intensityBlend + intensityBlend * (chCeil / globalP95);
      for (let j = 0; j < masterAmp.length; j++) masterAmp[j] *= scale;
    }

    const rootAmpCurve  = buildRootAmpCurve(masterAmp, activityCurve);
    const morphology    = buildMorphologyCurves(features, masterAmp, synthParams, activityCurve);
    const fmIndexCurve  = buildFMIndexCurve(features, synthParams, durCh, pitch.hz, activityCurve);
    const maxFMIndex    = (synthParams.fmDepthScale ?? 0) * pitch.hz;
    const fmAmpCurve    = buildFMAmpCurve(masterAmp, activityCurve, fmIndexCurve, maxFMIndex);

    // Detect and inject transient excitation (same as live engine)
    const events = detectEvents(ch.features, synthParams, ch.fs);
    injectTransientExcitation(
      { rootAmpCurve, morphology, fmIndexCurve },
      events, synthParams, durCh
    );

    // Distortion curve
    const distortionCurve = computeDistortionCurve(features, synthParams.drive);

    // Slice from startSec
    const frameOffset = Math.floor(startSec * AUTOMATION_RATE);
    const rootSlice   = rootAmpCurve.subarray(frameOffset);
    const fmIdxSlice  = fmIndexCurve.subarray(frameOffset);
    const fmAmpSlice  = fmAmpCurve.subarray(frameOffset);
    const morphSlices = {
      over2:   morphology.over2.subarray(frameOffset),
      over3:   morphology.over3.subarray(frameOffset),
      over4:   morphology.over4.subarray(frameOffset),
      under05: morphology.under05.subarray(frameOffset),
      under23: morphology.under23.subarray(frameOffset),
    };

    if (rootSlice.length < 2) continue;

    // Create voice graph
    const graph = createVoiceGraph(ctx, destination, pitch.hz, pitch.pan, distortionCurve);

    // Apply layer gains — noiseGain stays at 0; transient events schedule it
    if (graph.layer1Gain) graph.layer1Gain.gain.value = layerMix.root ?? 1;
    if (graph.layer2Gain) graph.layer2Gain.gain.value = layerMix.phase ?? 1;
    if (graph.layer3Gain) graph.layer3Gain.gain.value = layerMix.fm ?? 1;
    // noiseGain.gain.value stays 0 — scheduler bumps it per-event below

    // Start oscillators
    for (const osc of graph.allOscs) {
      osc.start(t0);
      osc.stop(t0 + renderDuration + 0.1);
    }
    graph.noiseSource.start(t0);
    graph.noiseSource.stop(t0 + renderDuration + 0.1);

    // Schedule automation curves
    try { graph.rootGain.gain.setValueCurveAtTime(rootSlice, t0, renderDuration); } catch (_) {}

    const morphTargets = [
      { gain: graph.overGains[0],  curve: morphSlices.over2 },
      { gain: graph.overGains[1],  curve: morphSlices.over3 },
      { gain: graph.overGains[2],  curve: morphSlices.over4 },
      { gain: graph.underGains[0], curve: morphSlices.under05 },
      { gain: graph.underGains[1], curve: morphSlices.under23 },
    ];
    for (const { gain, curve } of morphTargets) {
      if (curve.length < 2) continue;
      try { gain.gain.setValueCurveAtTime(curve, t0, renderDuration); } catch (_) {}
    }

    try { graph.fmModGain.gain.setValueCurveAtTime(fmIdxSlice, t0, renderDuration); } catch (_) {}
    try { graph.fmAmpGain.gain.setValueCurveAtTime(fmAmpSlice, t0, renderDuration); } catch (_) {}

    // ── Schedule transient events (mirrors engine.js #schedulerTick) ──
    // Pre-schedule all noise bursts + saturation spikes at once since
    // OfflineAudioContext renders synchronously — no lookahead timer needed.
    const transientLevel = layerMix.transient ?? 1;
    if (transientLevel > 0.001 && events.length > 0) {
      const detLevel  = synthParams.detectionLevel ?? 0.7;
      const satMix    = synthParams.embeddedMix    ?? 0.5;
      const noiseMix  = synthParams.noiseMix       ?? 0.4;
      const attackMax = (synthParams.noiseAttackMs  ?? 15) / 1000;
      const attackMin = 0.002;
      const decayMin  = 0.015;
      const decayMax  = (synthParams.noiseDecayMs   ?? 80) / 1000;

      for (const ev of events) {
        const evTime = ev.timeSec - startSec;
        if (evTime < 0 || evTime > renderDuration) continue;

        const exc    = Math.min(1, ev.excitation * detLevel) * transientLevel;
        const attack = attackMax - (attackMax - attackMin) * exc;
        const decay  = decayMin  + (decayMax  - decayMin) * exc;
        const t      = t0 + evTime;

        // Saturation: spike preShaperGain → pushes voice into waveshaper
        if (satMix > 0.01 && ev.type === 'ppaf') {
          const satPeak = 1.0 + exc * satMix * 4.0;
          graph.preShaperGain.gain.setValueAtTime(1.0, t);
          graph.preShaperGain.gain.linearRampToValueAtTime(satPeak, t + attack);
          graph.preShaperGain.gain.setTargetAtTime(1.0, t + attack, decay / 3);
        }

        // Pitched noise burst
        if (noiseMix > 0.01) {
          const noisePeak = exc * noiseMix * 0.6;
          graph.noiseGain.gain.setValueAtTime(0, t);
          graph.noiseGain.gain.linearRampToValueAtTime(noisePeak, t + attack);
          graph.noiseGain.gain.setTargetAtTime(0.0001, t + attack, decay / 3);
        }
      }
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. REAPER AUTOMATION ENVELOPE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export EEG signal as automation envelope (CSV + REAPER snippet).
 *
 * @param {Object} channel — { data, fs, label, features }
 * @param {Object} options
 * @param {string} options.scope — 'whole' | 'selection'
 * @param {number} [options.selectionStart]
 * @param {number} [options.selectionEnd]
 * @param {string} options.signalSource — 'raw' | 'envelope' | 'derivative' | 'bandpass'
 * @param {string} [options.band] — for bandpass: 'delta'|'theta'|'alpha'|'beta'|'lowGamma'|'highGamma'
 * @param {number} [options.pointsPerSecond=50]
 * @param {boolean} [options.normalize=true]
 */
export function exportAutomation(channel, options = {}) {
  const {
    scope = 'whole',
    selectionStart = 0,
    selectionEnd = 0,
    signalSource = 'envelope',
    band = 'alpha',
    pointsPerSecond = 50,
    normalize = true,
  } = options;

  if (!channel?.data) throw new Error('No channel data.');

  // ── Select signal source ──────────────────────────────────────────────
  let signal;
  switch (signalSource) {
    case 'raw':
      signal = new Float32Array(channel.data);
      break;
    case 'envelope':
      signal = channel.features?.envelope
        ? new Float32Array(channel.features.envelope)
        : new Float32Array(channel.data);
      break;
    case 'derivative': {
      const src = channel.data;
      signal = new Float32Array(src.length);
      for (let i = 1; i < src.length; i++) {
        signal[i] = Math.abs(src[i] - src[i - 1]) * channel.fs;
      }
      signal[0] = signal[1] ?? 0;
      break;
    }
    case 'bandpass': {
      const bp = channel.features?.bandRMS;
      if (bp && bp[band]) {
        signal = new Float32Array(bp[band]);
      } else {
        throw new Error(`Band "${band}" not available. Available: ${bp ? Object.keys(bp).join(', ') : 'none'}`);
      }
      break;
    }
    default:
      signal = new Float32Array(channel.data);
  }

  // ── Slice to scope ──────────────────────────────────────────────────
  const fs = channel.fs;
  // Handle signals that may be at a different rate (e.g., bandRMS at 60Hz)
  const sigFs = (signal.length === channel.data.length) ? fs : (signal.length / (channel.data.length / fs));
  const startIdx = scope === 'selection' ? Math.floor(selectionStart * sigFs) : 0;
  const endIdx   = scope === 'selection' ? Math.ceil(selectionEnd * sigFs) : signal.length;
  const sliced = signal.slice(startIdx, endIdx);

  // ── Peak-preserving decimation ────────────────────────────────────────
  const windowSize = Math.max(1, Math.floor(sigFs / pointsPerSecond));
  const points = [];
  const startTime = scope === 'selection' ? selectionStart : 0;

  for (let i = 0; i < sliced.length; i += windowSize) {
    const end = Math.min(i + windowSize, sliced.length);
    let maxVal = sliced[i];
    let maxAbs = Math.abs(sliced[i]);
    for (let j = i + 1; j < end; j++) {
      const abs = Math.abs(sliced[j]);
      if (abs > maxAbs) { maxAbs = abs; maxVal = sliced[j]; }
    }
    const timeSec = startTime + (i + windowSize / 2) / sigFs;
    points.push({ time: timeSec, value: maxVal });
  }

  // ── Normalize to [0, 1] ──────────────────────────────────────────────
  if (normalize && points.length > 0) {
    let min = Infinity, max = -Infinity;
    for (const p of points) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
    const range = max - min || 1;
    for (const p of points) p.value = (p.value - min) / range;
  }

  const label = safeLabel(channel.label);
  const endTime = points.length > 0 ? points[points.length - 1].time : 0;
  const duration = endTime - startTime;

  // ── File A: CSV ──────────────────────────────────────────────────────
  let csv = 'time_sec,value\n';
  for (const p of points) {
    csv += `${p.time.toFixed(4)},${p.value.toFixed(6)}\n`;
  }
  const csvBlob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(csvBlob, `seeg_${label}_${signalSource}_automation.csv`);

  // ── File B: Envelope as audio WAV ───────────────────────────────────
  // Export the envelope as a mono WAV file (values 0–1 → audio amplitude).
  // In REAPER: put on a track, then use Parameter Modulation → Audio control
  // signal on any plugin parameter to drive it from this track. No extensions needed.
  const envSampleRate = Math.max(pointsPerSecond * 2, 100); // at least 2× density for smooth audio
  const envDuration = duration > 0 ? duration : 1;
  const envSamples = Math.ceil(envDuration * envSampleRate);
  const envAudio = new Float32Array(envSamples);

  // Interpolate points into audio buffer
  for (let i = 0; i < envSamples; i++) {
    const t = i / envSampleRate;
    // Find surrounding points
    let lo = 0, hi = points.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].time - startTime <= t) lo = mid; else hi = mid;
    }
    const p0 = points[lo], p1 = points[hi];
    const t0 = p0.time - startTime, t1 = p1.time - startTime;
    const frac = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    envAudio[i] = p0.value + frac * (p1.value - p0.value);
  }

  const envWavBlob = encodeWAV([envAudio], envSampleRate, 32);
  triggerDownload(envWavBlob, `seeg_${label}_${signalSource}_envelope.wav`);

  // Also keep the CSV for spreadsheet / scripting use
  // (CSV was already downloaded above)
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. WAVETABLE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export EEG segment as wavetable (single-cycle or stacked multi-frame).
 *
 * @param {Object} channel — { data, fs, label }
 * @param {Object} options
 * @param {number} options.selectionStart — seconds (required)
 * @param {number} options.selectionEnd — seconds (required)
 * @param {number} [options.frameSize=1024]
 * @param {number} [options.outputSampleRate=44100]
 * @param {string} [options.mode='single'] — 'single' | 'stack'
 */
export function exportWavetable(channel, options = {}) {
  const {
    selectionStart,
    selectionEnd,
    frameSize = 1024,
    outputSampleRate = 44100,
    mode = 'single',
  } = options;

  if (selectionStart == null || selectionEnd == null || selectionEnd <= selectionStart) {
    throw new Error('A time selection is required for wavetable export.');
  }

  const minDurationMs = (frameSize / outputSampleRate) * 1000;
  const selDuration = selectionEnd - selectionStart;
  if (selDuration < frameSize / outputSampleRate) {
    throw new Error(`Selection too short for wavetable export. Select at least ${minDurationMs.toFixed(0)}ms.`);
  }

  // Slice and resample
  const startSamp = Math.floor(selectionStart * channel.fs);
  const endSamp   = Math.ceil(selectionEnd * channel.fs);
  const slice = channel.data.slice(startSamp, endSamp);
  const resampled = resample(slice, channel.fs, outputSampleRate);

  const label = safeLabel(channel.label);

  if (mode === 'single') {
    // ── Single frame ──────────────────────────────────────────────────
    const frame = resampled.slice(0, frameSize);
    if (frame.length < frameSize) {
      throw new Error(`Selection too short. Got ${frame.length} samples, need ${frameSize}.`);
    }
    normalizePeak(frame);
    _applyEdgeFade(frame, 4);

    const blob = encodeWAV([frame], outputSampleRate, 32);
    triggerDownload(blob, `seeg_wt_${label}_${frameSize}.wav`);

  } else {
    // ── Stacked multi-frame with 75% overlap ─────────────────────────
    // Overlap ensures adjacent frames share most of their content,
    // producing smooth morph transitions in Vital/Surge/Serum.
    const hopSize = Math.floor(frameSize / 4); // 75% overlap
    const numFrames = Math.floor((resampled.length - frameSize) / hopSize) + 1;
    if (numFrames < 2) {
      throw new Error('Selection too short for stacked wavetable. Need at least 2 frames.');
    }

    // Cap at 256 frames (Vital's max) — pick evenly spaced if too many
    const maxFrames = 256;
    let stride = 1;
    let actualFrames = numFrames;
    if (numFrames > maxFrames) {
      stride = Math.ceil(numFrames / maxFrames);
      actualFrames = Math.floor(numFrames / stride);
    }

    // Build Hanning window
    const hann = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frameSize - 1)));
    }

    const total = new Float32Array(actualFrames * frameSize);
    for (let fi = 0; fi < actualFrames; fi++) {
      const srcIdx = fi * stride;
      const offset = srcIdx * hopSize;
      const frame = new Float32Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        frame[i] = (resampled[offset + i] ?? 0) * hann[i];
      }
      normalizePeak(frame);
      total.set(frame, fi * frameSize);
    }

    const blob = encodeWAV([total], outputSampleRate, 32);
    triggerDownload(blob, `seeg_wt_stack_${label}_${frameSize}x${actualFrames}.wav`);
  }
}

/** Apply a short linear fade at start and end to ensure click-free looping. */
function _applyEdgeFade(frame, fadeSamples) {
  for (let i = 0; i < fadeSamples && i < frame.length; i++) {
    const t = i / fadeSamples;
    frame[i] *= t;
    frame[frame.length - 1 - i] *= t;
  }
}
