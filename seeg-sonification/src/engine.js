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
import { normalizePct } from './dsp.js';


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
  #stereoWidth     = 1.0;    // 0=mono, 1=atlas, 2=exaggerated
  #wavetableBlend  = 0;      // 0=sine, 0.33=tri, 0.66=saw, 1=EEG
  #wtUpdateCounter = 0;
  #tuningMode      = 'rank'; // 'rank' | 'consonance'
  #octaveCap       = 4;
  #primeLimit      = null;  // null=unlimited, or 3/5/7/11/13
  #limiter         = null;
  #analyser        = null;


  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Prepare all mapping and pre-computation from preprocessed data.
   * Builds automation curves per channel + detects transients.
   */
  async prepare(preprocessed, controls = {}, { masterTune, ratioOverrides, tuningMode, octaveCap, primeLimit } = {}) {
    this.#stopInternal();

    if (tuningMode != null)  this.#tuningMode  = tuningMode;
    if (octaveCap != null)   this.#octaveCap   = octaveCap;
    if (primeLimit !== undefined) this.#primeLimit = primeLimit;

    const { channels } = preprocessed;
    const synthParams  = mapControls(controls);
    const pitchMap     = assignPitches(channels, masterTune ?? DEFAULT_MASTER_TUNE, ratioOverrides, this.#tuningMode, this.#octaveCap, this.#primeLimit);

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
        basePan:     pitch.pan,
        pan:         Math.max(-1, Math.min(1, pitch.pan * this.#stereoWidth)),
        durationSec: durCh,
        rootAmpCurve,
        morphology,
        fmIndexCurve,
        fmAmpCurve,
        events,
        distortionCurve,
        wavetableSnapshots: ch.features.wavetable?.snapshots || null,
        wavetableRate:      ch.features.wavetable?.rate || 10,
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

    // ── Master bus limiter (brick wall at -1dB) ──────────────────────
    this.#limiter = this.#audioCtx.createDynamicsCompressor();
    this.#limiter.threshold.value = -1;
    this.#limiter.knee.value      = 0;
    this.#limiter.ratio.value     = 20;
    this.#limiter.attack.value    = 0.002;
    this.#limiter.release.value   = 0.050;

    // ── Analyser for output meter ────────────────────────────────────
    this.#analyser = this.#audioCtx.createAnalyser();
    this.#analyser.fftSize = 256;
    this.#analyser.smoothingTimeConstant = 0.8;

    // Scale by masterVolume / sqrt(N) to prevent clipping
    const n = this.#voices.filter(v => !v.muted).length || 1;
    const vol = this.#synthParams.masterVolume ?? 0.7;
    const targetGain = vol / Math.sqrt(n);

    // Fade in over 30ms to avoid onset click
    this.#masterGain.gain.value = 0;
    this.#masterGain.gain.setTargetAtTime(targetGain, this.#audioCtx.currentTime, 0.010);

    // Chain: masterGain → limiter → analyser → destination
    this.#masterGain.connect(this.#limiter);
    this.#limiter.connect(this.#analyser);
    this.#analyser.connect(this.#audioCtx.destination);

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
  get analyser()    { return this.#analyser; }

  get currentTimeSec() {
    if (!this.#audioCtx || !this.#isPlaying) return this.#offsetSec;
    const elapsed = this.#audioCtx.currentTime - this.#t0;
    return Math.min(this.#offsetSec + elapsed, this.#durationSec);
  }

  /**
   * Current amplitude for each channel at playhead position.
   * Reads from pre-built rootAmpCurve — no audio analysis needed.
   * @returns {Map<string, number>} label → amplitude [0–1]
   */
  getChannelLevels() {
    const levels = new Map();
    if (!this.#isPlaying) return levels;
    const t = this.currentTimeSec;
    for (const voice of this.#voices) {
      if (!voice.rootAmpCurve) continue;
      const frame = Math.floor(t * AUTOMATION_RATE);
      const idx = Math.min(Math.max(0, frame), voice.rootAmpCurve.length - 1);
      levels.set(voice.label, voice.rootAmpCurve[idx] ?? 0);
    }
    return levels;
  }

  /**
   * Static voice properties (pitch, pan, duration, mute state).
   */
  getVoiceInfo(label) {
    const voice = this.#voices.find(v => v.label === label);
    if (!voice) return null;
    return {
      pitchHz:     voice.pitchHz,
      pan:         voice.pan,
      durationSec: voice.durationSec,
      muted:       voice.muted,
    };
  }

  /**
   * Synthesis curves for a single channel (per-channel overlay).
   * Returns references — no copies.
   */
  getVoiceCurves(label) {
    const voice = this.#voices.find(v => v.label === label);
    if (!voice) return null;
    return {
      rootAmpCurve: voice.rootAmpCurve,
      morphology:   voice.morphology,
      fmAmpCurve:   voice.fmAmpCurve,
      fmIndexCurve: voice.fmIndexCurve,
      events:       voice.events,
    };
  }

  /**
   * Per-layer summed energy across all unmuted voices.
   * Pre-multiplied by current layer gain faders.
   */
  getSummedLayers() {
    if (!this.#voices.length) return null;
    const first = this.#voices.find(v => v.rootAmpCurve);
    if (!first) return null;

    const nFrames = first.rootAmpCurve.length;
    const amp   = new Float32Array(nFrames);
    const morph = new Float32Array(nFrames);
    const fm    = new Float32Array(nFrames);

    const rG = this.#layerGains.root  ?? 1;
    const pG = this.#layerGains.phase ?? 1;
    const fG = this.#layerGains.fm    ?? 1;

    for (const voice of this.#voices) {
      if (voice.muted) continue;
      const ra = voice.rootAmpCurve;
      const m  = voice.morphology;
      const fa = voice.fmAmpCurve;
      if (!ra) continue;

      for (let i = 0; i < nFrames; i++) {
        amp[i]   += (ra[i] ?? 0) * rG;
        morph[i] += ((m.over2[i] ?? 0) + (m.over3[i] ?? 0) + (m.over4[i] ?? 0)
                   + (m.under05[i] ?? 0) + (m.under23[i] ?? 0)) * pG;
        fm[i]    += (fa[i] ?? 0) * fG;
      }
    }

    return { amp, morph, fm, nFrames };
  }

  /**
   * Merged event list across all unmuted voices, sorted by time.
   */
  getAggregateEvents() {
    const all = [];
    for (const voice of this.#voices) {
      if (voice.muted || !voice.events) continue;
      all.push(...voice.events);
    }
    all.sort((a, b) => a.timeSec - b.timeSec);
    return all;
  }


  // ── Channel controls ──────────────────────────────────────────────────────

  setChannelMute(label, muted) {
    const voice = this.#voices.find(v => v.label === label);
    if (!voice) return;
    voice.muted = muted;
    if (voice.graph) voice.graph.setMuted(muted);
    this.#updateMasterGainForChannelCount();
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
   * Takes effect immediately via hot-swap during playback.
   */
  setBandMode(mode) {
    this.#bandMode = mode;
    this.#rebuildCurves(this.#synthParams);

    if (this.#audioCtx && this.#isPlaying) {
      this.#hotSwapCurves();
    }
  }

  /**
   * Scale all channel pan values by a width multiplier.
   * 0 = mono (all center), 1 = nominal (atlas), 2 = exaggerated.
   * Clamps to [-1, +1].
   */
  setStereoWidth(width) {
    this.#stereoWidth = width;
    for (const voice of this.#voices) {
      if (!voice.graph?.panner) continue;
      const scaled = Math.max(-1, Math.min(1, voice.basePan * width));
      voice.pan = scaled;
      voice.graph.panner.pan.setTargetAtTime(scaled, this.#audioCtx.currentTime, 0.05);
    }
  }

  /**
   * Change tuning mode and/or octave cap. Requires seek() after to take effect.
   */
  setTuningMode(mode, octaveCap, primeLimit) {
    if (mode != null) this.#tuningMode = mode;
    if (octaveCap != null) this.#octaveCap = octaveCap;
    if (primeLimit !== undefined) this.#primeLimit = primeLimit;
  }

  setMasterGain(gain) {
    if (!this.#masterGain || !this.#audioCtx) return;
    const n = this.#voices.filter(v => !v.muted).length || 1;
    this.#masterGain.gain.setTargetAtTime(gain / Math.sqrt(n), this.#audioCtx.currentTime, 0.03);
  }

  /**
   * Recompute master gain for current number of active voices.
   * Smooth 100ms ramp to avoid clicks on mute/solo changes.
   */
  #updateMasterGainForChannelCount() {
    if (!this.#masterGain || !this.#audioCtx) return;
    const n = this.#voices.filter(v => !v.muted).length || 1;
    const vol = this.#synthParams.masterVolume ?? 0.7;
    const target = vol / Math.sqrt(n);
    this.#masterGain.gain.setTargetAtTime(target, this.#audioCtx.currentTime, 0.03);
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
      ratioOverrides,
      this.#tuningMode,
      this.#octaveCap,
      this.#primeLimit
    );
    for (const voice of this.#voices) {
      const entry = pitchMap.get(voice.label);
      if (!entry) continue;
      voice.pitchHz = entry.hz;
      voice.basePan = entry.pan;
      voice.pan = Math.max(-1, Math.min(1, entry.pan * this.#stereoWidth));
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
   * fullRemap=true: rebuild curves + hot-swap (smooth, no gap)
   * fullRemap=false: update synthParams only (for live faders like noise)
   */
  async setControls(_preprocessed, controls, fullRemap = false) {
    const newParams = mapControls(controls);
    this.#synthParams = newParams;

    if (fullRemap) {
      this.#rebuildCurves(newParams);

      if (this.#audioCtx && this.#isPlaying) {
        // Hot-swap: smooth transition, no audio gap
        this.#hotSwapCurves();
      }
      // If not playing, curves are ready for next play()
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
   * Interpolate a downsampled array (at ~60 Hz) back to the full
   * sample-rate length needed by the feature arrays.
   */
  #interpolateBandRMS(downsampled, targetLen) {
    if (!downsampled || downsampled.length === 0) return null;

    const out = new Float32Array(targetLen);
    const ratio = (downsampled.length - 1) / (targetLen - 1 || 1);

    for (let i = 0; i < targetLen; i++) {
      const pos = i * ratio;
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, downsampled.length - 1);
      const t = pos - lo;
      out[i] = downsampled[lo] * (1 - t) + downsampled[hi] * t;
    }
    return out;
  }

  /**
   * Return a features object with ALL amplitude sources replaced based on band mode.
   *
   * 'full'    → original features (no change)
   * band name → replace fastRMS/midRMS/slowRMS/adaptiveRMS/envelope with
   *             band-filtered versions at all 3 time scales
   * 'auto'    → softmax-weighted blend of all bands' RMS at each time scale
   */
  #applyBandMode(features) {
    if (this.#bandMode === 'full' || !features.bandPowers) return features;

    if (this.#bandMode === 'auto') {
      return this.#applyAutoBandMode(features);
    }

    // ── Specific band selected ────────────────────────────────────
    const bandName = this.#bandMode;
    const br = features.bandRMS?.[bandName];

    if (!br) {
      // Fallback: bandRMS not precomputed — old behavior
      const bandEnv = features.bandPowers[bandName];
      if (!bandEnv) return features;
      return { ...features, slowRMS: bandEnv };
    }

    // bandRMS arrays are downsampled to ~60 Hz — interpolate to sample rate
    const targetLen = features.fastRMS?.length ?? 0;
    if (targetLen === 0) return features;

    const interpFast = this.#interpolateBandRMS(br.fast, targetLen);
    const interpMid  = this.#interpolateBandRMS(br.mid, targetLen);
    const interpSlow = this.#interpolateBandRMS(br.slow, targetLen);

    return {
      ...features,
      fastRMS:     normalizePct(interpFast),
      midRMS:      normalizePct(interpMid),
      slowRMS:     normalizePct(interpSlow),
      adaptiveRMS: normalizePct(interpMid),     // default to mid for adaptive in single-band mode
      envelope:    normalizePct(interpFast),     // Hilbert proxy: band-specific fast RMS
    };
  }

  /**
   * Auto mode: softmax-weighted blend of ALL bands' RMS at each time scale.
   * The blend changes per-sample based on which band dominates.
   */
  #applyAutoBandMode(features) {
    if (!features.bandRMS || !features.bandPowers) {
      // Fallback to old softmax blend on bandPowers only
      const autoEnv = this.#softmaxBandBlend(features);
      return autoEnv ? { ...features, slowRMS: autoEnv } : features;
    }

    const bandNames = Object.keys(features.bandRMS);
    if (bandNames.length === 0) return features;

    const targetLen = features.fastRMS?.length ?? 0;
    if (targetLen === 0) return features;

    // Interpolate downsampled bandRMS to sample rate, then normalize
    const bandFastArrays = bandNames.map(name => {
      const interp = this.#interpolateBandRMS(features.bandRMS[name]?.fast, targetLen);
      return interp ? normalizePct(interp) : null;
    });
    const bandMidArrays = bandNames.map(name => {
      const interp = this.#interpolateBandRMS(features.bandRMS[name]?.mid, targetLen);
      return interp ? normalizePct(interp) : null;
    });
    const bandSlowArrays = bandNames.map(name => {
      const interp = this.#interpolateBandRMS(features.bandRMS[name]?.slow, targetLen);
      return interp ? normalizePct(interp) : null;
    });

    const SOFTMAX_TEMP = 6.0;
    const blendFast = new Float32Array(targetLen);
    const blendMid  = new Float32Array(targetLen);
    const blendSlow = new Float32Array(targetLen);

    const bandPowArrays = bandNames.map(name => features.bandPowers[name]);
    const nBands = bandNames.length;
    const weights = new Float64Array(nBands);

    for (let i = 0; i < targetLen; i++) {
      let maxVal = -Infinity;
      for (let b = 0; b < nBands; b++) {
        const v = bandPowArrays[b]?.[i] ?? 0;
        if (v > maxVal) maxVal = v;
      }

      let sumExp = 0;
      for (let b = 0; b < nBands; b++) {
        weights[b] = Math.exp(((bandPowArrays[b]?.[i] ?? 0) - maxVal) * SOFTMAX_TEMP);
        sumExp += weights[b];
      }

      if (sumExp < 1e-12) {
        blendFast[i] = features.fastRMS[i] ?? 0;
        blendMid[i]  = features.midRMS[i] ?? 0;
        blendSlow[i] = features.slowRMS[i] ?? 0;
        continue;
      }

      let fast = 0, mid = 0, slow = 0;
      for (let b = 0; b < nBands; b++) {
        const w = weights[b] / sumExp;
        fast += w * (bandFastArrays[b]?.[i] ?? 0);
        mid  += w * (bandMidArrays[b]?.[i] ?? 0);
        slow += w * (bandSlowArrays[b]?.[i] ?? 0);
      }

      blendFast[i] = fast;
      blendMid[i]  = mid;
      blendSlow[i] = slow;
    }

    return {
      ...features,
      fastRMS:     normalizePct(blendFast),
      midRMS:      normalizePct(blendMid),
      slowRMS:     normalizePct(blendSlow),
      adaptiveRMS: normalizePct(blendMid),
      envelope:    normalizePct(blendFast),
    };
  }

  /**
   * Compute the selectedBandPower for the FM Focus blend.
   * Full mode → overall energy (adaptiveRMS or slowRMS)
   * Auto mode → softmax-weighted mid RMS as spectral drive
   * Specific band → that band's mid RMS (normalized)
   */
  #computeSelectedBandPower(features) {
    if (this.#bandMode === 'full' || !features.bandPowers) {
      return features.adaptiveRMS ?? features.slowRMS;
    }
    if (this.#bandMode === 'auto') {
      const autoFeatures = this.#applyAutoBandMode(features);
      return autoFeatures.midRMS ?? features.adaptiveRMS ?? features.slowRMS;
    }
    // Specific band: use that band's mid RMS (normalized)
    const br = features.bandRMS?.[this.#bandMode];
    if (br?.mid) return normalizePct(br.mid);
    return features.bandPowers[this.#bandMode] ?? features.adaptiveRMS ?? features.slowRMS;
  }

  /**
   * Softmax-weighted blend of all band powers (temperature=6).
   * Kept as fallback for when bandRMS is not available.
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


  // ── Wavetable ───────────────────────────────────────────────────────────

  /**
   * Set wavetable blend. 0=sine, ~0.33=triangle, ~0.66=saw, 1.0=EEG.
   */
  setWavetableBlend(value) {
    // 0 = saw, 0.5 = sine (default), 1 = EEG wavetable
    this.#wavetableBlend = value;

    if (!this.#audioCtx) return;

    // At dead center (sine), use built-in type for efficiency
    if (Math.abs(value - 0.5) < 0.01) {
      for (const v of this.#voices) {
        if (v.graph?.rootOsc) v.graph.rootOsc.type = 'sine';
      }
      return;
    }

    // Left or right of center: PeriodicWave applied in updateWavetables()
  }

  /**
   * Called from the timeupdate handler. Updates wavetable oscillators at ~8Hz.
   */
  updateWavetables(currentTimeSec) {
    // Skip when at dead-center sine
    if (Math.abs(this.#wavetableBlend - 0.5) < 0.01 || !this.#audioCtx) return;

    this.#wtUpdateCounter++;
    if (this.#wtUpdateCounter % 12 !== 0) return; // ~8Hz from 100ms timer

    const blend = this.#wavetableBlend;

    for (const voice of this.#voices) {
      if (!voice.graph?.rootOsc || voice.muted) continue;
      if (!voice.wavetableSnapshots) continue;

      const snaps = voice.wavetableSnapshots;
      const rate  = voice.wavetableRate;
      const snapIdx = currentTimeSec * rate;
      const lo = Math.max(0, Math.floor(snapIdx));
      const hi = Math.min(lo + 1, snaps.length - 1);
      const t  = snapIdx - lo;

      const snapLo = snaps[lo];
      const snapHi = snaps[hi];
      if (!snapLo || !snapHi) continue;

      const numH = snapLo.real.length;
      const real = new Float32Array(numH);
      const imag = new Float32Array(numH);

      if (blend < 0.5) {
        // Left side: saw (0) → sine (0.5)
        // At 0: pure saw. At 0.5: pure sine (k=1 only).
        const sineT = blend / 0.5;  // 0→1 as blend goes 0→0.5
        for (let k = 1; k < numH; k++) {
          const saw = (1 / k) * ((k % 2 === 0) ? -1 : 1);
          const sine = k === 1 ? 1 : 0;
          real[k] = saw * (1 - sineT) + sine * sineT;
        }
      } else {
        // Right side: sine (0.5) → EEG (1.0)
        const eegT = (blend - 0.5) / 0.5;  // 0→1 as blend goes 0.5→1
        for (let k = 1; k < numH; k++) {
          const eegReal = snapLo.real[k] * (1 - t) + snapHi.real[k] * t;
          const eegImag = snapLo.imag[k] * (1 - t) + snapHi.imag[k] * t;
          const sine = k === 1 ? 1 : 0;
          real[k] = sine * (1 - eegT) + eegReal * eegT;
          imag[k] = eegImag * eegT;
        }
      }

      const wave = this.#audioCtx.createPeriodicWave(real, imag, {
        disableNormalization: false
      });
      voice.graph.rootOsc.setPeriodicWave(wave);
    }
  }

  /**
   * Get wavetable snapshots for a channel label (for UI visualization).
   */
  getWavetableSnapshots(label) {
    const voice = this.#voices.find(v => v.label === label);
    return voice?.wavetableSnapshots || null;
  }

  getWavetableRate(label) {
    const voice = this.#voices.find(v => v.label === label);
    return voice?.wavetableRate || 10;
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


  // ── Private: hot-swap automation ─────────────────────────────────────────

  /**
   * Cancel current automation on a parameter and schedule a new curve
   * with smooth splice. Blends from current parameter value into the
   * new curve over ~8 frames to prevent clicks at the transition.
   */
  #spliceAutomation(param, newCurve, startTime, duration) {
    if (!newCurve || newCurve.length < 2) return;

    const now = this.#audioCtx.currentTime;
    const currentVal = param.value;

    param.cancelScheduledValues(now);
    param.setValueAtTime(currentVal, now);

    // If the jump is small enough, schedule directly (no copy needed)
    if (Math.abs(currentVal - newCurve[0]) < 0.005) {
      try {
        param.setValueCurveAtTime(newCurve, startTime, duration);
      } catch (e) {
        param.linearRampToValueAtTime(newCurve[0], startTime + 0.01);
      }
      return;
    }

    // Blend first 8 frames from current value → new curve
    const BLEND_FRAMES = 8;
    const spliced = new Float32Array(newCurve.length);
    spliced.set(newCurve);
    const len = Math.min(BLEND_FRAMES, spliced.length);
    for (let i = 0; i < len; i++) {
      const t = (i + 1) / (len + 1);
      spliced[i] = currentVal + (spliced[i] - currentVal) * t;
    }

    try {
      param.setValueCurveAtTime(spliced, startTime, duration);
    } catch (e) {
      param.linearRampToValueAtTime(spliced[0], startTime + 0.01);
    }
  }

  /**
   * Hot-swap automation curves on all active voices WITHOUT tearing down
   * the AudioContext or voice graphs. Oscillators keep running. The listener
   * hears a smooth transition into the new curve shape.
   *
   * Used for all "rebuild" fader changes during playback.
   * NOT used for: pitch changes or transport (need new oscillators/t0).
   */
  #hotSwapCurves() {
    if (!this.#audioCtx || !this.#isPlaying) return;

    const ctx = this.#audioCtx;
    const now = ctx.currentTime;
    const elapsed = now - this.#t0;
    const currentSec = this.#offsetSec + elapsed;

    // Schedule 5ms from now (WebAudio can't schedule at exactly "now")
    const SPLICE_DELAY = 0.005;
    const t = now + SPLICE_DELAY;

    // Account for the splice delay: curve data must start from the
    // FUTURE position (currentSec + 5ms), not the current position.
    // Without this, 5ms of audio gets replayed → cumulative drift.
    const spliceSec = currentSec + SPLICE_DELAY;

    for (const voice of this.#voices) {
      if (!voice.graph || voice.muted) continue;

      const remaining = voice.durationSec - spliceSec;
      if (remaining <= 0.1) continue;

      const dur = remaining;
      if (dur < 0.05) continue;

      const frameOffset = Math.floor(spliceSec * AUTOMATION_RATE);
      const g = voice.graph;
      const morph = voice.morphology;

      // Root amplitude
      this.#spliceAutomation(
        g.rootGain.gain,
        voice.rootAmpCurve.subarray(frameOffset),
        t, dur
      );

      // Morphology (5 per-overtone curves)
      this.#spliceAutomation(g.overGains[0].gain,
        morph.over2.subarray(frameOffset), t, dur);
      this.#spliceAutomation(g.overGains[1].gain,
        morph.over3.subarray(frameOffset), t, dur);
      this.#spliceAutomation(g.overGains[2].gain,
        morph.over4.subarray(frameOffset), t, dur);
      this.#spliceAutomation(g.underGains[0].gain,
        morph.under05.subarray(frameOffset), t, dur);
      this.#spliceAutomation(g.underGains[1].gain,
        morph.under23.subarray(frameOffset), t, dur);

      // FM index + amplitude
      this.#spliceAutomation(
        g.fmModGain.gain,
        voice.fmIndexCurve.subarray(frameOffset),
        t, dur
      );
      this.#spliceAutomation(
        g.fmAmpGain.gain,
        voice.fmAmpCurve.subarray(frameOffset),
        t, dur
      );

      // Waveshaper curve (can be swapped in-place, no scheduling needed)
      if (voice.distortionCurve && g.waveshaper) {
        g.waveshaper.curve = voice.distortionCurve;
      }
    }

    // Reset transient scheduler to splice position (avoids re-firing events)
    for (let vi = 0; vi < this.#voices.length; vi++) {
      this.#nextIdx[vi] = _lowerBound(
        this.#voices[vi].events, spliceSec
      );
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
      this.updateWavetables(t);
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
      this.#limiter    = null;
      this.#analyser   = null;
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
