/**
 * SEEG Sonification — Modular Synthesis Engine
 *
 * Each "voice mode" is a hypothesis about what matters in the EEG signal.
 * The engine lets you assign a mode per channel and A/B test them.
 *
 * Voice modes:
 *   sine            Pure tone, amplitude = total RMS. The baseline.
 *   filtered-noise  White noise → bandpass at ratio Hz. Activity narrows
 *                   bandwidth, so pitch "emerges from chaos."
 *   subtractive     Sawtooth → lowpass. Cutoff tracks spectral centroid
 *                   of EEG bands: delta-dominant = dark, gamma = bright.
 *   band-additive   6 sine partials, each amplitude-controlled by its
 *                   corresponding EEG frequency band.
 *
 * All modes share the same interface:
 *   build(ctx, hz, eegData, bandEnvelopes, fs,
 *         audioStartTime, playbackRate, startSample, endSample) → { output, cleanup }
 */

import { rmsEnvelope, bandpass, BANDS } from './dsp.js';

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

export function parseRatio(ratioStr) {
  const parts = String(ratioStr).split('/').map(Number);
  if (parts.length === 2 && parts[1] !== 0 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] / parts[1];
  }
  if (parts.length === 1 && !isNaN(parts[0])) return parts[0];
  return 1;
}

/** Normalize a Float32Array to 0–1 range. */
function normalize(env) {
  let peak = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > peak) peak = env[i];
  if (peak === 0) return new Float32Array(env.length);
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) out[i] = env[i] / peak;
  return out;
}

/**
 * Schedule a 0–1 envelope onto a GainNode's gain parameter.
 * Uses ~60 automation points per real-time second.
 */
function scheduleEnvelope(gainParam, envelope, fs, audioStart, rate, sStart, sEnd) {
  const realDur = (sEnd - sStart) / fs / rate;
  const N = Math.min(Math.ceil(realDur * 60), 8000); // cap to avoid huge automation
  const step = (sEnd - sStart) / N;

  gainParam.setValueAtTime(0.001, audioStart);
  for (let i = 0; i < N; i++) {
    const si = Math.min(sStart + Math.floor(i * step), envelope.length - 1);
    const t  = audioStart + (i / N) * realDur;
    gainParam.linearRampToValueAtTime(Math.max(0.001, envelope[si]), t);
  }
}

/** Compute band envelopes if not already provided. */
function ensureBandEnvelopes(bandEnvs, eegData, fs) {
  if (bandEnvs && bandEnvs.length === 6 && bandEnvs[0]) return bandEnvs;
  const win = Math.floor(fs * 0.05);
  return BANDS.map((b) => {
    const hi = Math.min(b.hi, fs / 2 - 1);
    if (b.lo >= hi) return new Float32Array(eegData.length);
    return rmsEnvelope(bandpass(eegData, b.lo, hi, fs), win);
  });
}


// ═══════════════════════════════════════════════════════════════
// VOICE BUILDERS
// ═══════════════════════════════════════════════════════════════

// ─── SINE ────────────────────────────────────────────────────
// Pure sine, amplitude = total RMS. Your control condition.

function buildSine(ctx, hz, data, _bands, fs, t0, rate, s0, s1) {
  const dur = (s1 - s0) / fs / rate;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;

  const gain = ctx.createGain();
  const env = normalize(rmsEnvelope(data, Math.floor(fs * 0.05)));
  const shaped = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) shaped[i] = Math.pow(env[i], 0.6) * 0.85 + 0.02;

  scheduleEnvelope(gain.gain, shaped, fs, t0, rate, s0, s1);
  osc.connect(gain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.1);

  return { output: gain, cleanup: () => { try { osc.stop(); } catch (_) {} } };
}


// ─── FILTERED NOISE ──────────────────────────────────────────
// White noise → bandpass at ratio Hz.
//   Low activity → wide bandwidth → washy, no clear pitch
//   High activity → narrow bandwidth → pitch crystallizes from noise
//
// This is your idea: the ratio emerges from chaos.

function buildFilteredNoise(ctx, hz, data, _bands, fs, t0, rate, s0, s1) {
  const dur = (s1 - s0) / fs / rate;

  // Noise buffer
  const bufLen = Math.ceil(ctx.sampleRate * (dur + 0.5));
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const bd = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) bd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  // Bandpass at target pitch
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = hz;

  // Q tracks amplitude: quiet → Q=1 (wide/diffuse), loud → Q=30 (pitched)
  const env = normalize(rmsEnvelope(data, Math.floor(fs * 0.05)));
  const N = Math.min(Math.ceil(dur * 60), 8000);
  const step = (s1 - s0) / N;
  bpf.Q.setValueAtTime(1, t0);
  for (let i = 0; i < N; i++) {
    const si = Math.min(s0 + Math.floor(i * step), env.length - 1);
    const t  = t0 + (i / N) * dur;
    bpf.Q.linearRampToValueAtTime(1 + env[si] * 29, t);   // 1–30
  }

  // Amplitude also follows envelope
  const gain = ctx.createGain();
  const ampEnv = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) ampEnv[i] = Math.pow(env[i], 0.5) * 0.9 + 0.05;
  scheduleEnvelope(gain.gain, ampEnv, fs, t0, rate, s0, s1);

  noise.connect(bpf);
  bpf.connect(gain);
  noise.start(t0);
  noise.stop(t0 + dur + 0.1);

  return { output: gain, cleanup: () => { try { noise.stop(); } catch (_) {} } };
}


// ─── SUBTRACTIVE ─────────────────────────────────────────────
// Sawtooth → lowpass filter.
// Cutoff tracks spectral centroid of EEG:
//   delta-dominant = dark/muffled, gamma-dominant = bright/buzzy.
// Maps *spectral content* of EEG → *spectral content* of audio.

function buildSubtractive(ctx, hz, data, bandEnvs, fs, t0, rate, s0, s1) {
  const dur = (s1 - s0) / fs / rate;
  const bEnvs = ensureBandEnvelopes(bandEnvs, data, fs);
  const normB = bEnvs.map(normalize);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = hz;

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.Q.value = 2;

  // Weighted band sum → brightness → filter cutoff
  const weights = [0.05, 0.15, 0.3, 0.5, 0.8, 1.0]; // delta→highGamma
  const minCut = hz;
  const maxCut = Math.min(hz * 12, ctx.sampleRate / 2 - 100);

  const N = Math.min(Math.ceil(dur * 60), 8000);
  const step = (s1 - s0) / N;
  lpf.frequency.setValueAtTime(minCut, t0);

  for (let i = 0; i < N; i++) {
    const si = Math.min(s0 + Math.floor(i * step), data.length - 1);
    const t  = t0 + (i / N) * dur;
    let wSum = 0, wTot = 0;
    normB.forEach((env, bi) => {
      wSum += (env[Math.min(si, env.length - 1)] || 0) * weights[bi];
      wTot += weights[bi];
    });
    const brightness = wSum / wTot;
    lpf.frequency.linearRampToValueAtTime(minCut + brightness * (maxCut - minCut), t);
  }

  // Amplitude
  const gain = ctx.createGain();
  const totalRms = normalize(rmsEnvelope(data, Math.floor(fs * 0.05)));
  const ampEnv = new Float32Array(totalRms.length);
  for (let i = 0; i < totalRms.length; i++) ampEnv[i] = Math.pow(totalRms[i], 0.6) * 0.7 + 0.02;
  scheduleEnvelope(gain.gain, ampEnv, fs, t0, rate, s0, s1);

  osc.connect(lpf);
  lpf.connect(gain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.1);

  return { output: gain, cleanup: () => { try { osc.stop(); } catch (_) {} } };
}


// ─── BAND-ADDITIVE ───────────────────────────────────────────
// 6 sine partials (harmonics 1–6), each amplitude = its EEG band.
//   Partial 1 (fundamental) ← delta
//   Partial 2 (octave)      ← theta
//   Partial 3 (12th)        ← alpha
//   Partial 4 (2 octaves)   ← beta
//   Partial 5               ← low gamma
//   Partial 6               ← high gamma
//
// Delta-dominant → warm fundamental.
// Gamma-dominant → bright upper partials.

function buildBandAdditive(ctx, hz, data, bandEnvs, fs, t0, rate, s0, s1) {
  const dur = (s1 - s0) / fs / rate;
  const bEnvs = ensureBandEnvelopes(bandEnvs, data, fs);
  const normB = bEnvs.map(normalize);

  const mixer = ctx.createGain();
  mixer.gain.value = 0.4;
  const cleanups = [];

  const partialGains = [1.0, 0.7, 0.5, 0.35, 0.25, 0.18];

  for (let pi = 0; pi < 6; pi++) {
    const partialHz = hz * (pi + 1);
    if (partialHz > ctx.sampleRate / 2 - 100) continue;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = partialHz;

    const gain = ctx.createGain();
    const shaped = new Float32Array(normB[pi].length);
    for (let i = 0; i < shaped.length; i++) {
      shaped[i] = Math.pow(normB[pi][i], 0.7) * partialGains[pi];
    }
    scheduleEnvelope(gain.gain, shaped, fs, t0, rate, s0, s1);

    osc.connect(gain);
    gain.connect(mixer);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
    cleanups.push(() => { try { osc.stop(); } catch (_) {} });
  }

  return { output: mixer, cleanup: () => cleanups.forEach((fn) => fn()) };
}


// ═══════════════════════════════════════════════════════════════
// VOICE MODE REGISTRY
// ═══════════════════════════════════════════════════════════════

export const VOICE_MODES = {
  'sine': {
    name: 'Sine',
    short: 'SIN',
    description: 'Pure tone, amplitude = total RMS',
    build: buildSine,
  },
  'filtered-noise': {
    name: 'Filtered Noise',
    short: 'NSE',
    description: 'Noise → bandpass. Activity sharpens pitch from chaos.',
    build: buildFilteredNoise,
  },
  'subtractive': {
    name: 'Subtractive',
    short: 'SUB',
    description: 'Saw → LPF. Gamma = bright, delta = dark.',
    build: buildSubtractive,
  },
  'band-additive': {
    name: 'Band Additive',
    short: 'ADD',
    description: '6 partials, each driven by its EEG band.',
    build: buildBandAdditive,
  },
};

export const DEFAULT_VOICE_MODE = 'sine';


// ═══════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════

export class SonificationEngine {
  constructor() {
    this.ctx = null;
    this.voices = [];
    this.masterGain = null;
    this.analyser = null;
    this.startTime = 0;
    this.duration = 0;
    this.playbackRate = 1;
    this.isPlaying = false;
    this._animFrame = null;
    this._onProgress = null;
    this._onEnd = null;
    this._startPct = 0;
    this._endPct = 1;
    this._lastParams = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Start playback.
   *
   * Backwards-compatible: old callers that don't pass voiceModes / bandEnvelopes /
   * startPct / loopStart / loopEnd will just get sine voices from 0–100%.
   */
  start({
    channels,
    ratios,
    fundamentalHz,
    playbackRate,
    channelStates,
    voiceModes = {},           // { label: 'sine' | 'filtered-noise' | ... }
    bandEnvelopes = {},        // { label: Float32Array[6] }
    startPct = 0,
    loopStart = null,
    loopEnd = null,
    onProgress,
    onEnd,
  }) {
    this.init();
    this.stop();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Save for seekTo
    this._lastParams = {
      channels, ratios, fundamentalHz, playbackRate, channelStates,
      voiceModes, bandEnvelopes, loopStart, loopEnd, onProgress, onEnd,
    };

    this.playbackRate = playbackRate;
    this._onProgress = onProgress;
    this._onEnd = onEnd;

    // Master chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    this.startTime = now;

    // Determine region
    let maxLen = 0;
    channels.forEach((ch) => { if (ch.data.length > maxLen) maxLen = ch.data.length; });

    const regionStart = loopStart != null ? loopStart : startPct;
    const regionEnd   = loopEnd   != null ? loopEnd   : 1;
    this._startPct = regionStart;
    this._endPct   = regionEnd;

    const refFs = channels[0]?.fs || 500;
    const regionDuration = ((regionEnd - regionStart) * maxLen) / refFs / playbackRate;
    this.duration = regionDuration;

    // Build voices
    channels.forEach((ch) => {
      if (!channelStates[ch.label]) return;

      const ratioVal = parseRatio(ratios[ch.label] || '1/1');
      const hz = fundamentalHz * ratioVal;
      const modeKey = voiceModes[ch.label] || DEFAULT_VOICE_MODE;
      const mode = VOICE_MODES[modeKey] || VOICE_MODES[DEFAULT_VOICE_MODE];

      const chStart = Math.floor(regionStart * ch.data.length);
      const chEnd   = Math.floor(regionEnd   * ch.data.length);
      const bEnvs   = bandEnvelopes[ch.label] || null;

      const voice = mode.build(
        this.ctx, hz, ch.data, bEnvs, ch.fs,
        now, playbackRate, chStart, chEnd
      );

      const panner = this.ctx.createStereoPanner();
      panner.pan.value = 0;
      voice.output.connect(panner);
      panner.connect(this.masterGain);

      this.voices.push({ ...voice, panner });
    });

    this.isPlaying = true;
    this._animate();
  }

  seekTo(pct) {
    if (!this._lastParams) return;
    this.stop();
    this.start({ ...this._lastParams, startPct: pct });
  }

  stop() {
    this.voices.forEach((v) => { if (v.cleanup) v.cleanup(); });
    this.voices = [];
    this.isPlaying = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  getAnalyser() { return this.analyser; }

  _animate() {
    if (!this.isPlaying || !this.ctx) return;
    const elapsed = this.ctx.currentTime - this.startTime;
    const pct = this._startPct + (elapsed / this.duration) * (this._endPct - this._startPct);

    if (this._onProgress) this._onProgress(Math.min(pct, this._endPct));

    if (elapsed >= this.duration) {
      this.isPlaying = false;
      if (this._onEnd) this._onEnd();
      return;
    }
    this._animFrame = requestAnimationFrame(() => this._animate());
  }

  dispose() {
    this.stop();
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }
}
