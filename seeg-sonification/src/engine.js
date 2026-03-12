/**
 * engine.js — Playback Engine (Four-Layer Model, v8.3)
 *
 * Architecture: ONE master amplitude, FOUR character layers.
 *
 * All layers share a single master amplitude curve (weighted RMS blend).
 * Each layer adds its own character:
 *   Layer 1 (Root)       — pure sine at pitch, amplitude = masterAmp
 *   Layer 2 (Harmonics)  — over/undertones, balance from voltage polarity
 *   Layer 3 (FM)         — carrier/modulator, index from spectral centroid
 *   Layer 4 (Transients) — noise burst on noiseGain; excitation embedded in
 *                          automation curves as gaussian bumps
 *
 * Exports:
 *   Engine (class)
 */

import { AUTOMATION_RATE, DEFAULT_MASTER_TUNE, assignPitches, mapControls,
         buildMasterAmplitude, buildActivityCurve,
         buildRootAmpCurve, buildMorphologyCurves,
         buildFMIndexCurve, buildFMAmpCurve, computeDistortionCurve,
         detectEvents, injectTransientExcitation } from './mapping.js';
import { createVoiceGraph } from './synthesis.js';


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LOOKAHEAD_SEC         = 2.0;
const SCHEDULER_INTERVAL_MS = 250;
const START_LATENCY_SEC     = 0.05;
const TIMEUPDATE_INTERVAL_MS = 100;


// ─────────────────────────────────────────────────────────────────────────────
// ENGINE CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class Engine {

  // ── Private state ─────────────────────────────────────────────────────────
  #audioCtx        = null;
  #masterGain      = null;
  #voices          = [];
  #durationSec     = 0;
  #isPlaying       = false;
  #t0              = 0;
  #offsetSec       = 0;
  #schedulerTimer  = null;
  #timeupdateTimer = null;
  #nextIdx         = [];
  #listeners       = { timeupdate: [], ended: [] };
  #prepared        = false;
  #synthParams     = {};
  #preprocessed    = null;
  #layerGains      = { root: 1, phase: 1, fm: 1, transient: 1 };
  #bandMode        = 'full'; // 'full' | band name | 'auto'


  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Prepare all mapping and pre-computation from preprocessed data.
   * Builds automation curves per channel + detects transients.
   */
  async prepare(preprocessed, controls = {}, { masterTune, ratioOverrides } = {}) {
    this.#stopInternal();

    const { channels } = preprocessed;
    const synthParams  = mapControls(controls);
    const pitchMap     = assignPitches(channels, masterTune ?? DEFAULT_MASTER_TUNE, ratioOverrides);

    const durationSec = channels.reduce((mx, ch) => {
      const d = ch.data.length / ch.fs;
      return d > mx ? d : mx;
    }, 0);

    // ── Intensity: absolute voltage scaling ──────────────────────────────────
    // At intensity=0 all channels are percentile-normalized (equal expressive range).
    // At intensity=1 channels are scaled by their voltage relative to the loudest.
    // globalP95 = loudest channel's calibrated ceiling; each channel is scaled by
    // its own ceiling / globalP95 so the loudest channel stays at 1.0.
    const globalP95 = channels.reduce((mx, ch) => {
      const ceil = ch.features?.calibration?.ampCeiling ?? 0;
      return ceil > mx ? ceil : mx;
    }, 0);

    const voices = [];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];

      if (!ch.features) {
        console.warn(`[Engine] Channel ${ch.label} has no features — skipped`);
        continue;
      }

      const pitch = pitchMap.get(ch.label) ?? { hz: 220, pan: 0 };
      const durCh = ch.data.length / ch.fs;

      // ── Band mode envelope override ─────────────────────────────────────
      const features = this.#applyBandMode(ch.features);

      // ── Inject selectedBandPower for FM Focus blend ──────────────────
      const featuresForFM = { ...features,
        selectedBandPower: this.#computeSelectedBandPower(ch.features) };

      // ── Build master amplitude + activity gate ────────────────────────
      const masterAmp     = buildMasterAmplitude(features, synthParams, durCh);
      const activityCurve = buildActivityCurve(features, synthParams, durCh);

      // ── Intensity: blend normalized ↔ absolute voltage scaling ──────
      // intensity=0 → all channels equal (normalized). intensity=1 → quiet
      // channels sound quiet, loud channels loud (absolute µV differences).
      const intensityBlend = synthParams.intensity ?? 0;
      if (intensityBlend > 0 && globalP95 > 0) {
        const chCeil  = ch.features.calibration?.ampCeiling ?? globalP95;
        const scale   = 1.0 - intensityBlend + intensityBlend * (chCeil / globalP95);
        for (let j = 0; j < masterAmp.length; j++) masterAmp[j] *= scale;
      }

      // ── Layer 1: Root ──────────────────────────────────────────────
      const rootAmpCurve  = buildRootAmpCurve(masterAmp, activityCurve);

      // ── Layer 2: Morphology (5 per-overtone curves) ────────────────
      const morphology    = buildMorphologyCurves(features, masterAmp, synthParams, activityCurve);

      // ── Layer 3: Frequency ─────────────────────────────────────────
      const fmIndexCurve  = buildFMIndexCurve(featuresForFM, synthParams, durCh, pitch.hz, activityCurve);
      const maxFMIndex    = synthParams.fmDepthScale * pitch.hz;
      const fmAmpCurve    = buildFMAmpCurve(masterAmp, activityCurve, fmIndexCurve, maxFMIndex);

      // ── Per-channel distortion curve ────────────────────────────────────
      const distortionCurve = computeDistortionCurve(features, synthParams.drive);

      // ── Detect events from RAW features (absolute thresholds) ──────────
      const events = detectEvents(ch.features, synthParams, ch.fs);

      // ── Inject excitation bumps into the curves we just built ──────────
      injectTransientExcitation(
        { rootAmpCurve, morphology, fmIndexCurve },
        events, synthParams, durCh
      );

      voices.push({
        label:       ch.label,
        pitchHz:     pitch.hz,
        pan:         pitch.pan,
        durationSec: durCh,
        rootAmpCurve,
        morphology,
        fmIndexCurve,
        fmAmpCurve,
        events,
        distortionCurve,
        graph:       null,
        muted:       false,
      });
    }

    this.#voices       = voices;
    this.#durationSec  = durationSec;
    this.#synthParams  = synthParams;
    this.#preprocessed = preprocessed;
    this.#prepared     = true;

    console.log(
      `[Engine] Prepared: ${voices.length} voices, ` +
      `${voices.reduce((s, v) => s + v.events.length, 0)} transient events, ` +
      `duration ${durationSec.toFixed(1)}s`
    );
  }


  /**
   * Start or resume playback.
   */
  async play() {
    if (!this.#prepared) throw new Error('[Engine] call prepare() before play()');
    if (this.#isPlaying) return;

    // Resume from pause
    if (this.#audioCtx && this.#audioCtx.state === 'suspended') {
      await this.#audioCtx.resume();
      this.#isPlaying = true;
      this.#startTimers();
      return;
    }

    // Fresh start
    this.#audioCtx   = new AudioContext();
    this.#masterGain = this.#audioCtx.createGain();

    // Scale by masterVolume / sqrt(N) to prevent clipping
    const n = this.#voices.filter(v => !v.muted).length || 1;
    const vol = this.#synthParams.masterVolume ?? 0.7;
    const targetGain = vol / Math.sqrt(n);

    // Fade in over 30ms to avoid onset click
    this.#masterGain.gain.value = 0;
    this.#masterGain.gain.setTargetAtTime(targetGain, this.#audioCtx.currentTime, 0.010);
    this.#masterGain.connect(this.#audioCtx.destination);

    this.#activateVoices();
    this.#applyLayerGains();

    this.#isPlaying = true;
    this.#startTimers();
  }


  async pause() {
    if (!this.#isPlaying || !this.#audioCtx) return;
    await this.#audioCtx.suspend();
    this.#isPlaying = false;
    this.#stopTimers();
  }

  stop() {
    this.#stopInternal();
    this.#offsetSec = 0;
  }

  async seek(timeSec, autoPlay = true) {
    const wasPlaying = this.#isPlaying;

    // Fade out before teardown to avoid click
    if (this.#masterGain && this.#audioCtx) {
      this.#masterGain.gain.setTargetAtTime(0, this.#audioCtx.currentTime, 0.008);
      await new Promise(r => setTimeout(r, 30));
    }

    this.#stopInternal();
    this.#offsetSec = Math.max(0, Math.min(timeSec, this.#durationSec));
    if (wasPlaying || autoPlay) await this.play();
  }

  destroy() {
    this.#stopInternal();
    this.#voices    = [];
    this.#prepared  = false;
  }


  // ── State accessors ───────────────────────────────────────────────────────

  get isPlaying()   { return this.#isPlaying; }
  get durationSec() { return this.#durationSec; }

  get currentTimeSec() {
    if (!this.#audioCtx || !this.#isPlaying) return this.#offsetSec;
    const elapsed = this.#audioCtx.currentTime - this.#t0;
    return Math.min(this.#offsetSec + elapsed, this.#durationSec);
  }


  // ── Channel controls ──────────────────────────────────────────────────────

  setChannelMute(label, muted) {
    const voice = this.#voices.find(v => v.label === label);
    if (!voice) return;
    voice.muted = muted;
    if (voice.graph) voice.graph.setMuted(muted);
  }

  /**
   * Set per-channel gain trim in dB.
   * @param {string} label
   * @param {number} dB — typically -20 to +12
   */
  setChannelGainTrim(label, dB) {
    const voice = this.#voices.find(v => v.label === label);
    if (!voice) return;
    voice.gainTrimDB = dB;
    if (voice.graph && this.#audioCtx) {
      const linear = Math.pow(10, dB / 20);
      voice.graph.trimGain.gain.setTargetAtTime(linear, this.#audioCtx.currentTime, 0.02);
    }
  }

  /**
   * Set band mode for envelope source.
   * 'full' = full-spectrum slowRMS (default)
   * band name = use that band's power envelope
   * 'auto' = use the most energetic band at each time point
   * Requires seek() after to take effect.
   */
  setBandMode(mode) {
    this.#bandMode = mode;
    this.#rebuildCurves(this.#synthParams);
  }

  setMasterGain(gain) {
    if (!this.#masterGain) return;
    const n = this.#voices.filter(v => !v.muted).length || 1;
    this.#masterGain.gain.value = gain / Math.sqrt(n);
  }

  /**
   * Update pitch for a single channel. Requires seek() after to take effect.
   */
  setChannelPitch(label, hz) {
    const voice = this.#voices.find(v => v.label === label);
    if (!voice) return;
    voice.pitchHz = hz;
    if (this.#preprocessed) {
      const ch = this.#preprocessed.channels.find(c => c.label === label);
      if (ch?.features) {
        const act = buildActivityCurve(ch.features, this.#synthParams, voice.durationSec);
        voice.fmIndexCurve = buildFMIndexCurve(ch.features, this.#synthParams, voice.durationSec, hz, act);
      }
    }
  }

  /**
   * Update ALL voice pitches from new masterTune. Requires seek() after.
   */
  setMasterTune(masterTune, ratioOverrides) {
    const pitchMap = assignPitches(
      this.#preprocessed?.channels ?? [],
      masterTune,
      ratioOverrides
    );
    for (const voice of this.#voices) {
      const entry = pitchMap.get(voice.label);
      if (!entry) continue;
      voice.pitchHz = entry.hz;
      if (this.#preprocessed) {
        const ch = this.#preprocessed.channels.find(c => c.label === voice.label);
        if (ch?.features) {
          const act = buildActivityCurve(ch.features, this.#synthParams, voice.durationSec);
          voice.fmIndexCurve = buildFMIndexCurve(ch.features, this.#synthParams, voice.durationSec, entry.hz, act);
        }
      }
    }
  }

  /**
   * Set per-layer gain levels (layer mix knobs).
   * Applied immediately via smooth ramp — no curve rebuild needed.
   *
   * @param {{ root?: number, phase?: number, fm?: number, transient?: number }} gains
   */
  setLayerGains(gains) {
    // Store for re-application after voice rebuild
    if (gains.root != null)      this.#layerGains.root = gains.root;
    if (gains.phase != null)     this.#layerGains.phase = gains.phase;
    if (gains.fm != null)        this.#layerGains.fm = gains.fm;
    if (gains.transient != null) this.#layerGains.transient = gains.transient;

    if (!this.#audioCtx) return;
    this.#applyLayerGains();
  }

  /**
   * Get the summed energy contour across all unmuted voices,
   * weighted by layer mix gains. Used for the mix bus display.
   *
   * @param {{ root?: number, phase?: number, fm?: number }} layerGains
   * @returns {Float32Array|null}
   */
  getSummedCurve(layerGains = {}) {
    if (!this.#voices.length) return null;

    const first = this.#voices.find(v => v.rootAmpCurve);
    if (!first) return null;

    const nFrames = first.rootAmpCurve.length;
    const sum     = new Float32Array(nFrames);
    const rG = layerGains.root  ?? 1;
    const pG = layerGains.phase ?? 1;
    const fG = layerGains.fm    ?? 1;

    for (const voice of this.#voices) {
      if (voice.muted) continue;

      const ra = voice.rootAmpCurve;
      const m  = voice.morphology;
      const fa = voice.fmAmpCurve;

      if (!ra) continue;

      for (let i = 0; i < nFrames; i++) {
        const morphSum = (m.over2[i] ?? 0) + (m.over3[i] ?? 0) + (m.over4[i] ?? 0)
                       + (m.under05[i] ?? 0) + (m.under23[i] ?? 0);
        sum[i] += (ra[i] ?? 0) * rG
               +  morphSum * pG
               +  (fa[i] ?? 0) * fG;
      }
    }

    return sum;
  }


  /**
   * Live-update perceptual controls during playback.
   *
   * Sensitivity + Transient Clarity → immediate.
   * Dynamic Range + Spectral Detail → rebuild curves + restart.
   */
  async setControls(_preprocessed, controls, fullRemap = false) {
    const newParams = mapControls(controls);
    this.#synthParams = newParams;

    if (fullRemap) {
      const wasPlaying = this.#isPlaying;
      const currentSec = this.currentTimeSec;
      this.#rebuildCurves(newParams);
      if (this.#audioCtx) {
        await this.seek(currentSec, wasPlaying);
      }
    }
  }


  /**
   * Rebuild all curves per voice. Fast: no FFT, just array math.
   */
  #rebuildCurves(synthParams) {
    if (!this.#preprocessed) return;
    const channelMap = new Map(this.#preprocessed.channels.map(c => [c.label, c]));

    for (const voice of this.#voices) {
      const ch = channelMap.get(voice.label);
      if (!ch?.features) continue;

      const features = this.#applyBandMode(ch.features);
      const featuresForFM = { ...features,
        selectedBandPower: this.#computeSelectedBandPower(ch.features) };

      const masterAmp     = buildMasterAmplitude(features, synthParams, voice.durationSec);
      const act           = buildActivityCurve(features, synthParams, voice.durationSec);
      const rootAmpCurve  = buildRootAmpCurve(masterAmp, act);
      const morphology    = buildMorphologyCurves(features, masterAmp, synthParams, act);
      const fmIndexCurve  = buildFMIndexCurve(featuresForFM, synthParams, voice.durationSec, voice.pitchHz, act);

      const events = detectEvents(ch.features, synthParams, ch.fs);
      injectTransientExcitation({ rootAmpCurve, morphology, fmIndexCurve }, events, synthParams, voice.durationSec);

      voice.rootAmpCurve    = rootAmpCurve;
      voice.morphology      = morphology;
      voice.fmIndexCurve    = fmIndexCurve;
      voice.fmAmpCurve      = buildFMAmpCurve(masterAmp, act, fmIndexCurve, synthParams.fmDepthScale * voice.pitchHz);
      voice.distortionCurve = computeDistortionCurve(features, synthParams.drive);
      voice.events          = events;
    }
  }

  /**
   * Return a features object with slowRMS replaced based on band mode.
   * 'full'    → original features (no change)
   * band name → use bandPowers[name] as slowRMS
   * 'auto'    → softmax-weighted blend of all band powers
   */
  #applyBandMode(features) {
    if (this.#bandMode === 'full' || !features.bandPowers) return features;
    if (this.#bandMode === 'auto') {
      const autoEnv = this.#softmaxBandBlend(features);
      return autoEnv ? { ...features, slowRMS: autoEnv } : features;
    }
    const bandEnv = features.bandPowers[this.#bandMode];
    if (!bandEnv) return features;
    return { ...features, slowRMS: bandEnv };
  }

  /**
   * Compute the selectedBandPower for the FM Focus blend.
   * Full mode → overall energy (adaptiveRMS or slowRMS)
   * Auto mode → softmax-weighted dominant band
   * Specific band → that band's power envelope
   */
  #computeSelectedBandPower(features) {
    if (this.#bandMode === 'full' || !features.bandPowers) {
      return features.adaptiveRMS ?? features.slowRMS;
    }
    if (this.#bandMode === 'auto') {
      return this.#softmaxBandBlend(features) ?? features.adaptiveRMS ?? features.slowRMS;
    }
    return features.bandPowers[this.#bandMode] ?? features.adaptiveRMS ?? features.slowRMS;
  }

  /**
   * Softmax-weighted blend of all band powers (temperature=6).
   * Strongest band dominates but transitions stay continuous.
   * Returns null if no bandPowers or empty.
   */
  #softmaxBandBlend(features) {
    const bands = Object.values(features.bandPowers ?? {});
    if (bands.length === 0) return null;

    const SOFTMAX_TEMP = 6.0;
    const len     = bands[0].length;
    const out     = new Float32Array(len);
    const weights = new Array(bands.length);

    for (let i = 0; i < len; i++) {
      let maxVal = -Infinity;
      for (const b of bands) { if (b[i] > maxVal) maxVal = b[i]; }

      let sumExp = 0;
      for (let b = 0; b < bands.length; b++) {
        weights[b] = Math.exp((bands[b][i] - maxVal) * SOFTMAX_TEMP);
        sumExp += weights[b];
      }

      let val = 0;
      if (sumExp > 1e-12) {
        for (let b = 0; b < bands.length; b++) {
          val += (weights[b] / sumExp) * bands[b][i];
        }
      }
      out[i] = val;
    }
    return out;
  }


  // ── Event system ──────────────────────────────────────────────────────────

  on(event, handler) {
    if (this.#listeners[event]) this.#listeners[event].push(handler);
  }

  off(event, handler) {
    if (this.#listeners[event]) {
      this.#listeners[event] = this.#listeners[event].filter(h => h !== handler);
    }
  }

  #emit(event, data) {
    for (const h of (this.#listeners[event] ?? [])) {
      try { h(data); } catch (_) {}
    }
  }


  #applyLayerGains() {
    if (!this.#audioCtx) return;
    const now = this.#audioCtx.currentTime;
    const g = this.#layerGains;
    for (const v of this.#voices) {
      if (!v.graph) continue;
      v.graph.layer1Gain.gain.setTargetAtTime(g.root, now, 0.05);
      v.graph.layer2Gain.gain.setTargetAtTime(g.phase, now, 0.05);
      v.graph.layer3Gain.gain.setTargetAtTime(g.fm, now, 0.05);
    }
  }

  // ── Private: voice activation ─────────────────────────────────────────────

  /**
   * Create voice graphs for all channels and apply automation curves.
   */
  #activateVoices() {
    const ctx = this.#audioCtx;

    this.#nextIdx = this.#voices.map(v =>
      _lowerBound(v.events, this.#offsetSec)
    );

    // ── Pass 1: Create all voice graphs (heavy work, no timing) ───────
    const voiceData = [];
    for (const voice of this.#voices) {
      const graph = createVoiceGraph(ctx, this.#masterGain, voice.pitchHz, voice.pan, voice.distortionCurve);
      voice.graph = graph;

      if (voice.muted) graph.setMuted(true);

      if (voice.gainTrimDB) {
        const linear = Math.pow(10, voice.gainTrimDB / 20);
        graph.trimGain.gain.value = linear;
      }

      const frameOffset = Math.floor(this.#offsetSec * AUTOMATION_RATE);
      const remaining   = voice.durationSec - this.#offsetSec;

      if (remaining <= 0) { voiceData.push(null); continue; }

      const rootSlice  = voice.rootAmpCurve.subarray(frameOffset);
      const fmIdxSlice = voice.fmIndexCurve.subarray(frameOffset);
      const fmAmpSlice = voice.fmAmpCurve.subarray(frameOffset);

      if (rootSlice.length < 2) { voiceData.push(null); continue; }

      // Pre-slice morphology curves
      const morph = voice.morphology;
      const morphSlices = {
        over2:   morph.over2.subarray(frameOffset),
        over3:   morph.over3.subarray(frameOffset),
        over4:   morph.over4.subarray(frameOffset),
        under05: morph.under05.subarray(frameOffset),
        under23: morph.under23.subarray(frameOffset),
      };

      voiceData.push({ voice, graph, remaining, rootSlice, morphSlices, fmIdxSlice, fmAmpSlice });
    }

    // ── Capture t0 AFTER all graph creation ───────────────────────────
    const t0  = ctx.currentTime + START_LATENCY_SEC;
    this.#t0  = t0;

    // ── Pass 2: Start oscillators + schedule curves (timing-critical) ─
    for (const vd of voiceData) {
      if (!vd) continue;
      const { voice, graph, remaining, rootSlice, morphSlices, fmIdxSlice, fmAmpSlice } = vd;

      for (const osc of graph.allOscs) {
        osc.start(t0);
        osc.stop(t0 + remaining + 0.1);
      }

      graph.noiseSource.start(t0);
      graph.noiseSource.stop(t0 + remaining + 0.1);

      // Layer 1: Root amplitude
      try {
        graph.rootGain.gain.setValueCurveAtTime(rootSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] rootAmpCurve failed for ${voice.label}:`, e);
        graph.rootGain.gain.value = 0.1;
      }

      // Layer 2: Per-overtone morphology curves (5 curves)
      const morphTargets = [
        { gain: graph.overGains[0],  curve: morphSlices.over2 },
        { gain: graph.overGains[1],  curve: morphSlices.over3 },
        { gain: graph.overGains[2],  curve: morphSlices.over4 },
        { gain: graph.underGains[0], curve: morphSlices.under05 },
        { gain: graph.underGains[1], curve: morphSlices.under23 },
      ];
      for (const { gain, curve } of morphTargets) {
        if (curve.length < 2) continue;
        try {
          gain.gain.setValueCurveAtTime(curve, t0, remaining);
        } catch (e) {
          console.warn(`[Engine] morphology curve failed for ${voice.label}:`, e);
        }
      }

      // Layer 3: FM index + amplitude
      try {
        graph.fmModGain.gain.setValueCurveAtTime(fmIdxSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] fmIndexCurve failed for ${voice.label}:`, e);
      }

      try {
        graph.fmAmpGain.gain.setValueCurveAtTime(fmAmpSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] fmAmpCurve failed for ${voice.label}:`, e);
      }
    }
  }


  // ── Private: transient scheduler ──────────────────────────────────────────

  #schedulerTick() {
    if (!this.#audioCtx || !this.#isPlaying) return;

    const ctx           = this.#audioCtx;
    const scheduleUntil = ctx.currentTime + LOOKAHEAD_SEC;
    const p             = this.#synthParams;
    const detLevel      = p.detectionLevel  ?? 0.7;
    const satMix        = p.embeddedMix     ?? 0.5;   // "Saturation" fader → embeddedMix
    const noiseMix      = p.noiseMix        ?? 0.4;

    // Faders set the envelope RANGE; excitation magnitude interpolates within it.
    // Large event → fast attack (crack) + long decay (resonant ring)
    // Small event → slow attack (tap)   + short decay (brief)
    const attackMax = (p.noiseAttackMs ?? 15) / 1000;
    const attackMin = 0.002;   // 2ms floor
    const decayMin  = 0.015;   // 15ms floor
    const decayMax  = (p.noiseDecayMs ?? 80) / 1000;

    for (let vi = 0; vi < this.#voices.length; vi++) {
      const voice = this.#voices[vi];
      if (voice.muted || !voice.graph) continue;

      const events         = voice.events;
      const { noiseGain, preShaperGain } = voice.graph;
      let   idx            = this.#nextIdx[vi];

      while (idx < events.length) {
        const ev        = events[idx];
        const evCtxTime = this.#t0 + (ev.timeSec - this.#offsetSec);

        if (evCtxTime > scheduleUntil) break;
        if (evCtxTime < ctx.currentTime - 0.010) { idx++; continue; }

        const exc    = Math.min(1, ev.excitation * detLevel);
        const attack = attackMax - (attackMax - attackMin) * exc;
        const decay  = decayMin  + (decayMax  - decayMin)  * exc;
        const t      = Math.max(ctx.currentTime + 0.001, evCtxTime);

        // ── SATURATION: spike preShaperGain → pushes voice into waveshaper ──
        // At exc=1, satMix=1: gain spikes to 5× → heavy crunch → recovers.
        // Mild tanh waveshaper is always in chain so this crunches even at drive=0.
        if (satMix > 0.01 && ev.type === 'ppaf') {
          const satPeak = 1.0 + exc * satMix * 4.0;
          preShaperGain.gain.cancelScheduledValues(t);
          preShaperGain.gain.setValueAtTime(1.0, t);
          preShaperGain.gain.linearRampToValueAtTime(satPeak, t + attack);
          preShaperGain.gain.setTargetAtTime(1.0, t + attack, decay / 3);
        }

        // ── PITCHED NOISE: bandpassed burst at channel fundamental ────────
        // Filtered to pitchHz — sounds like a resonant thump at the right pitch.
        if (noiseMix > 0.01) {
          const noisePeak = exc * noiseMix * 0.6;
          noiseGain.gain.cancelScheduledValues(t);
          noiseGain.gain.setValueAtTime(0, t);
          noiseGain.gain.linearRampToValueAtTime(noisePeak, t + attack);
          noiseGain.gain.setTargetAtTime(0.0001, t + attack, decay / 3);
        }

        idx++;
      }

      this.#nextIdx[vi] = idx;
    }
  }


  // ── Private: timers ───────────────────────────────────────────────────────

  #startTimers() {
    this.#schedulerTimer = setInterval(
      () => this.#schedulerTick(),
      SCHEDULER_INTERVAL_MS
    );
    this.#schedulerTick();

    this.#timeupdateTimer = setInterval(() => {
      const t = this.currentTimeSec;
      this.#emit('timeupdate', t);
      if (t >= this.#durationSec - 0.1) {
        this.#stopInternal();
        this.#offsetSec = 0;
        this.#emit('ended', null);
      }
    }, TIMEUPDATE_INTERVAL_MS);
  }

  #stopTimers() {
    if (this.#schedulerTimer) {
      clearInterval(this.#schedulerTimer);
      this.#schedulerTimer = null;
    }
    if (this.#timeupdateTimer) {
      clearInterval(this.#timeupdateTimer);
      this.#timeupdateTimer = null;
    }
  }

  #stopInternal() {
    this.#stopTimers();
    this.#isPlaying = false;

    if (this.#audioCtx) {
      try { this.#audioCtx.close(); } catch (_) {}
      this.#audioCtx   = null;
      this.#masterGain = null;
    }

    for (const v of this.#voices) { v.graph = null; }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────


function _lowerBound(events, targetSec) {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (events[mid].timeSec < targetSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
