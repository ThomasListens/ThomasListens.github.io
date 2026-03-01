/**
 * SEEG Sonification — Modular Synthesis Engine
 *
 * Voice modes:
 *   sine            Pure tone, amplitude = total RMS. The baseline.
 *   filtered-noise  White noise → bandpass at ratio Hz. Activity narrows
 *                   bandwidth, so pitch "emerges from chaos."
 *   subtractive     Sawtooth → lowpass. Cutoff tracks spectral centroid.
 *   band-additive   6 sine partials, each amplitude = its EEG band.
 *   layered         THREE simultaneous layers:
 *                     L1: AM sine — ratio pitch, RMS amplitude (identity + energy)
 *                     L2: FM sine — EEG voltage → frequency deviation (contour)
 *                     L3: Derivative noise — rate-of-change → filtered noise bursts (transients)
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
 * Normalize to -1..+1 range (preserving sign).
 */
function normalizeBipolar(data, s0, s1) {
  let peak = 0;
  for (let i = s0; i < s1; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  if (peak === 0) return new Float32Array(s1 - s0);
  const out = new Float32Array(s1 - s0);
  for (let i = 0; i < out.length; i++) out[i] = data[s0 + i] / peak;
  return out;
}

/**
 * Compute the absolute first derivative of a signal, then smooth it.
 * Returns a 0–1 normalized envelope of rate-of-change.
 */
function derivativeEnvelope(data, s0, s1, smoothWindow) {
  const len = s1 - s0;
  const deriv = new Float32Array(len);
  for (let i = 1; i < len; i++) {
    deriv[i] = Math.abs(data[s0 + i] - data[s0 + i - 1]);
  }
  deriv[0] = deriv[1] || 0;

  // Smooth with a simple moving average
  const smoothed = new Float32Array(len);
  const halfWin = Math.floor(smoothWindow / 2);
  let sum = 0;
  // Initialize window
  for (let i = 0; i < Math.min(smoothWindow, len); i++) sum += deriv[i];
  for (let i = 0; i < len; i++) {
    const addIdx = i + halfWin;
    const removeIdx = i - halfWin - 1;
    if (addIdx < len) sum += deriv[addIdx];
    if (removeIdx >= 0) sum -= deriv[removeIdx];
    const count = Math.min(addIdx + 1, len) - Math.max(removeIdx + 1, 0);
    smoothed[i] = sum / count;
  }

  return normalize(smoothed);
}

/**
 * Schedule a 0–1 envelope onto a GainNode's gain parameter.
 * Uses ~60 automation points per real-time second.
 */
function scheduleEnvelope(gainParam, envelope, fs, audioStart, rate, sStart, sEnd) {
  const realDur = (sEnd - sStart) / fs / rate;
  const N = Math.min(Math.ceil(realDur * 60), 8000);
  const step = (sEnd - sStart) / N;

  gainParam.setValueAtTime(0.001, audioStart);
  for (let i = 0; i < N; i++) {
    const si = Math.min(sStart + Math.floor(i * step), envelope.length - 1);
    const t  = audioStart + (i / N) * realDur;
    gainParam.linearRampToValueAtTime(Math.max(0.001, envelope[si]), t);
  }
}

/**
 * Schedule a bipolar (-1..+1) signal onto an AudioParam.
 * Used for FM modulation of frequency.
 */
function scheduleBipolarEnvelope(param, envelope, baseValue, deviationRange, fs, audioStart, rate, sStart, sEnd) {
  const realDur = (sEnd - sStart) / fs / rate;
  const N = Math.min(Math.ceil(realDur * 120), 12000); // higher resolution for FM
  const step = (sEnd - sStart) / N;
  const envLen = envelope.length;

  param.setValueAtTime(baseValue, audioStart);
  for (let i = 0; i < N; i++) {
    const si = Math.min(Math.floor(i * step), envLen - 1);
    const t  = audioStart + (i / N) * realDur;
    const freqVal = baseValue + envelope[si] * deviationRange;
    param.linearRampToValueAtTime(freqVal, t);
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
console.time('voice-build');

// ─── SINE ────────────────────────────────────────────────────

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

function buildFilteredNoise(ctx, hz, data, _bands, fs, t0, rate, s0, s1) {
  const dur = (s1 - s0) / fs / rate;

  const bufLen = Math.ceil(ctx.sampleRate * (dur + 0.5));
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const bd = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) bd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = hz;

  const env = normalize(rmsEnvelope(data, Math.floor(fs * 0.05)));
  const N = Math.min(Math.ceil(dur * 60), 8000);
  const step = (s1 - s0) / N;
  bpf.Q.setValueAtTime(1, t0);
  for (let i = 0; i < N; i++) {
    const si = Math.min(s0 + Math.floor(i * step), env.length - 1);
    const t  = t0 + (i / N) * dur;
    bpf.Q.linearRampToValueAtTime(1 + env[si] * 29, t);
  }

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

  const weights = [0.05, 0.15, 0.3, 0.5, 0.8, 1.0];
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


// ─── LAYERED ─────────────────────────────────────────────────
// Three simultaneous layers, each capturing a different dimension:
//
// LAYER 1 — AM Sine (Identity + Energy)
//   Pure sine at ratio frequency.
//   Amplitude = RMS envelope of EEG.
//   Tells you: which region, how much overall energy.
//
// LAYER 2 — FM Sine (Voltage Contour)
//   Sine at ratio frequency, but frequency modulated by the raw EEG voltage.
//   Positive voltage → pitch bends up, negative → bends down.
//   Tells you: the shape of the neural signal. Spikes = quick pitch jabs,
//   slow waves = gentle wobbles.
//   FM deviation range is a fraction of the center frequency.
//
// LAYER 3 — Derivative Noise (Transients)
//   Filtered noise at ratio frequency.
//   Amplitude driven by |dV/dt| — the rate of change of voltage.
//   Slow drift = silence. Sharp spike = noise burst.
//   Higher derivative also narrows the Q (more pitched burst).
//   Tells you: where the sudden transitions are.

function buildLayered(ctx, hz, data, bandEnvs, fs, t0, rate, s0, s1) {
  const dur = (s1 - s0) / fs / rate;
  const cleanups = [];

  // Output mixer — all three layers sum here
  const mixer = ctx.createGain();
  mixer.gain.value = 1.0;

  // ── LAYER 1: AM Sine ──────────────────────────────────
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = hz;

  const gain1 = ctx.createGain();
  gain1.gain.value = 0.001;
  const rmsEnv = normalize(rmsEnvelope(data, Math.floor(fs * 0.05)));
  const amEnv = new Float32Array(rmsEnv.length);
  for (let i = 0; i < rmsEnv.length; i++) amEnv[i] = Math.pow(rmsEnv[i], 0.6) * 0.7 + 0.02;
  scheduleEnvelope(gain1.gain, amEnv, fs, t0, rate, s0, s1);

  const l1mix = ctx.createGain();
  l1mix.gain.value = 0.45;   // Layer 1 level
  osc1.connect(gain1);
  gain1.connect(l1mix);
  l1mix.connect(mixer);
  osc1.start(t0);
  osc1.stop(t0 + dur + 0.1);
  cleanups.push(() => { try { osc1.stop(); } catch (_) {} });

  // ── LAYER 2: FM Sine ──────────────────────────────────
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';

  // FM deviation: ±30% of center frequency
  // Low hz (220) → ±66 Hz. High hz (440) → ±132 Hz.
  // This is a starting point — tunable.
  const fmDeviation = hz * 0.3;

  // Normalize EEG voltage to -1..+1 in the play region
  const bipolar = normalizeBipolar(data, s0, s1);

  // Schedule frequency modulation
  scheduleBipolarEnvelope(
    osc2.frequency, bipolar,
    hz, fmDeviation,
    fs, t0, rate, 0, s1 - s0
  );

  // FM layer also gets gentle AM from RMS so it's not constant volume
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.001;
  const fmAmpEnv = new Float32Array(rmsEnv.length);
  for (let i = 0; i < rmsEnv.length; i++) fmAmpEnv[i] = Math.pow(rmsEnv[i], 0.4) * 0.5 + 0.05;
  scheduleEnvelope(gain2.gain, fmAmpEnv, fs, t0, rate, s0, s1);

  const l2mix = ctx.createGain();
  l2mix.gain.value = 0.3;    // Layer 2 level
  osc2.connect(gain2);
  gain2.connect(l2mix);
  l2mix.connect(mixer);
  osc2.start(t0);
  osc2.stop(t0 + dur + 0.1);
  cleanups.push(() => { try { osc2.stop(); } catch (_) {} });

  // ── LAYER 3: Derivative Noise ─────────────────────────
  // Noise source
  const bufLen = Math.ceil(ctx.sampleRate * (dur + 0.5));
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const bd = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) bd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  // Bandpass at ratio frequency
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = hz;

  // Derivative envelope — smooth over ~10ms to avoid pure sample-rate clicking
  const smoothSamples = Math.max(3, Math.floor(fs * 0.01));
  const derivEnv = derivativeEnvelope(data, s0, s1, smoothSamples);

  // Derivative controls both amplitude and Q
  // Low derivative → quiet, wide (washy). High derivative → loud, narrow (pitched burst).
  const N = Math.min(Math.ceil(dur * 80), 10000);  // slightly higher resolution for transients
  const step = (s1 - s0) / N;
  bpf.Q.setValueAtTime(1, t0);
  for (let i = 0; i < N; i++) {
    const si = Math.min(Math.floor(i * step), derivEnv.length - 1);
    const t  = t0 + (i / N) * dur;
    const d = derivEnv[si];
    // Q: low derivative = 1 (wide), high = 25 (pitched)
    bpf.Q.linearRampToValueAtTime(1 + d * 24, t);
  }

  // Amplitude follows derivative with a sharper curve
  const gain3 = ctx.createGain();
  gain3.gain.value = 0.001;
  const noiseAmpEnv = new Float32Array(derivEnv.length);
  for (let i = 0; i < derivEnv.length; i++) {
    // Power curve makes it more percussive — quiet when derivative is low,
    // pops out on sharp transitions
    noiseAmpEnv[i] = Math.pow(derivEnv[i], 1.5) * 0.9;
  }
  // Use the derivative envelope indexed from 0 (since it's already s0-relative)
  const derivRealDur = (s1 - s0) / fs / rate;
  const dN = Math.min(Math.ceil(derivRealDur * 80), 10000);
  const dStep = derivEnv.length / dN;
  gain3.gain.setValueAtTime(0.001, t0);
  for (let i = 0; i < dN; i++) {
    const si = Math.min(Math.floor(i * dStep), noiseAmpEnv.length - 1);
    const t  = t0 + (i / dN) * derivRealDur;
    gain3.gain.linearRampToValueAtTime(Math.max(0.001, noiseAmpEnv[si]), t);
  }

  const l3mix = ctx.createGain();
  l3mix.gain.value = 0.35;   // Layer 3 level
  noise.connect(bpf);
  bpf.connect(gain3);
  gain3.connect(l3mix);
  l3mix.connect(mixer);
  noise.start(t0);
  noise.stop(t0 + dur + 0.1);
  cleanups.push(() => { try { noise.stop(); } catch (_) {} });

  return {
    output: mixer,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}

console.timeEnd('voice-build');

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
  'layered': {
    name: 'Layered',
    short: 'LYR',
    description: 'AM sine + FM voltage contour + derivative noise transients.',
    build: buildLayered,
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

  async start({
    channels,
    ratios,
    fundamentalHz,
    playbackRate,
    channelStates,
    voiceModes = {},
    bandEnvelopes = {},
    startPct = 0,
    loopStart = null,
    loopEnd = null,
    onProgress,
    onEnd,
  }) {
    this.init();
    this.stop();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this._lastParams = {
      channels, ratios, fundamentalHz, playbackRate, channelStates,
      voiceModes, bandEnvelopes, loopStart, loopEnd, onProgress, onEnd,
    };

    this.playbackRate = playbackRate;
    this._onProgress = onProgress;
    this._onEnd = onEnd;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    this.startTime = now;

    let maxLen = 0;
    channels.forEach((ch) => { if (ch.data.length > maxLen) maxLen = ch.data.length; });

    const regionStart = loopStart != null ? loopStart : startPct;
    const regionEnd   = loopEnd   != null ? loopEnd   : 1;
    this._startPct = regionStart;
    this._endPct   = regionEnd;

    const refFs = channels[0]?.fs || 500;
    const regionDuration = ((regionEnd - regionStart) * maxLen) / refFs / playbackRate;
    this.duration = regionDuration;

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
