/**
 * engine.js — Playback Engine (Four-Layer Model, v8.3)
 *
 * Orchestrates all audio for the entire recording. Owns the AudioContext,
 * voice graphs, per-channel templates, and scheduling.
 *
 * v8.3 changes:
 *   - Per-channel pitched templates (clicks match channel fundamental)
 *   - Templates stored on voice objects, not shared globally
 *   - synthesis.js provides prerenderTemplates(audioCtx, pitchHz)
 *   - trimGain + channelBus + end-of-chain waveshaper (via synthesis.js)
 *
 * Unchanged from Phase 1:
 *   - Transient look-ahead scheduler
 *   - Seek via context teardown + rebuild
 *   - Suspend/resume timing pattern
 *   - Event system (timeupdate, ended)
 *
 * Exports:
 *   Engine (class)
 */

import { AUTOMATION_RATE, DEFAULT_MASTER_TUNE, assignPitches, mapControls,
         buildActivityCurve, buildRootAmpCurve, buildOverCurve, buildUnderCurve,
         buildFMIndexCurve, buildFMAmpCurve, computeDistortionCurve } from './mapping.js';
import { detectTransients, prerenderTemplates, createVoiceGraph } from './synthesis.js';


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


  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Prepare all mapping and pre-computation from preprocessed data.
   * Builds five automation curves per channel + detects transients.
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

    const voices = [];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];

      if (!ch.features) {
        console.warn(`[Engine] Channel ${ch.label} has no features — skipped`);
        continue;
      }

      const pitch = pitchMap.get(ch.label) ?? { hz: 220, pan: 0 };
      const durCh = ch.data.length / ch.fs;

      // ── Build activity curve FIRST (gates all other curves) ───────────
      const activityCurve = buildActivityCurve(ch.features, synthParams, durCh);

      // ── Build five automation curves ────────────────────────────────────
      const rootAmpCurve  = buildRootAmpCurve(ch.features, synthParams, durCh, activityCurve);
      const overCurve     = buildOverCurve(ch.features, synthParams, durCh, activityCurve);
      const underCurve    = buildUnderCurve(ch.features, synthParams, durCh, activityCurve);
      const fmIndexCurve  = buildFMIndexCurve(ch.features, synthParams, durCh, pitch.hz, activityCurve);
      const fmAmpCurve    = buildFMAmpCurve(ch.features, synthParams, durCh, activityCurve);

      // ── Per-channel distortion curve ────────────────────────────────────
      const distortionCurve = computeDistortionCurve(ch.features, synthParams.drive);

      // ── Detect transients (threshold-agnostic) ──────────────────────────
      const transients = detectTransients(ch.features);

      voices.push({
        label:       ch.label,
        pitchHz:     pitch.hz,
        pan:         pitch.pan,
        durationSec: durCh,
        rootAmpCurve,
        overCurve,
        underCurve,
        fmIndexCurve,
        fmAmpCurve,
        transients,
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
      `${voices.reduce((s, v) => s + v.transients.length, 0)} transient events, ` +
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
    this.#masterGain.gain.value = vol / Math.sqrt(n);
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
      const ov = voice.overCurve;
      const un = voice.underCurve;
      const fa = voice.fmAmpCurve;

      if (!ra) continue;

      for (let i = 0; i < nFrames; i++) {
        sum[i] += (ra[i] ?? 0) * rG
               +  (ov[i] ?? 0) * pG
               +  (un[i] ?? 0) * pG
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

    // Apply transientGain immediately
    if (this.#audioCtx) {
      const now = this.#audioCtx.currentTime;
      for (const v of this.#voices) {
        if (v.graph) {
          v.graph.transientGain.gain.setTargetAtTime(newParams.transientGain, now, 0.05);
        }
      }
    }

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
   * Rebuild all five curves per voice. Fast: no FFT, just array math.
   */
  #rebuildCurves(synthParams) {
    if (!this.#preprocessed) return;
    const channelMap = new Map(this.#preprocessed.channels.map(c => [c.label, c]));

    for (const voice of this.#voices) {
      const ch = channelMap.get(voice.label);
      if (!ch?.features) continue;

      const act = buildActivityCurve(ch.features, synthParams, voice.durationSec);
      voice.rootAmpCurve    = buildRootAmpCurve(ch.features, synthParams, voice.durationSec, act);
      voice.overCurve       = buildOverCurve(ch.features, synthParams, voice.durationSec, act);
      voice.underCurve      = buildUnderCurve(ch.features, synthParams, voice.durationSec, act);
      voice.fmIndexCurve    = buildFMIndexCurve(ch.features, synthParams, voice.durationSec, voice.pitchHz, act);
      voice.fmAmpCurve      = buildFMAmpCurve(ch.features, synthParams, voice.durationSec, act);
      voice.distortionCurve = computeDistortionCurve(ch.features, synthParams.drive);
    }
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
      v.graph.transientGain.gain.setTargetAtTime(g.transient, now, 0.05);
    }
  }

  // ── Private: voice activation ─────────────────────────────────────────────

  /**
   * Create voice graphs for all channels and apply five automation curves.
   */
  #activateVoices() {
    const ctx = this.#audioCtx;
    const t0  = ctx.currentTime + START_LATENCY_SEC;
    this.#t0  = t0;

    this.#nextIdx = this.#voices.map(v =>
      _lowerBound(v.transients, this.#offsetSec)
    );

    for (const voice of this.#voices) {
      const graph = createVoiceGraph(ctx, this.#masterGain, voice.pitchHz, voice.pan, voice.distortionCurve);
      voice.graph = graph;

      // Per-channel pitched templates (clicks match channel's fundamental)
      voice.templates = prerenderTemplates(ctx, voice.pitchHz);

      if (voice.muted) graph.setMuted(true);

      const frameOffset = Math.floor(this.#offsetSec * AUTOMATION_RATE);
      const remaining   = voice.durationSec - this.#offsetSec;

      if (remaining <= 0) continue;

      // Slice all five curves from seek offset
      const rootSlice  = voice.rootAmpCurve.subarray(frameOffset);
      const overSlice  = voice.overCurve.subarray(frameOffset);
      const underSlice = voice.underCurve.subarray(frameOffset);
      const fmIdxSlice = voice.fmIndexCurve.subarray(frameOffset);
      const fmAmpSlice = voice.fmAmpCurve.subarray(frameOffset);

      if (rootSlice.length < 2) continue;

      // ── Start ALL oscillators ─────────────────────────────────────────
      for (const osc of graph.allOscs) {
        osc.start(t0);
        osc.stop(t0 + remaining + 0.1);
      }

      // ── Apply five automation curves ──────────────────────────────────

      // Layer 1: Root amplitude
      try {
        graph.rootGain.gain.setValueCurveAtTime(rootSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] rootAmpCurve failed for ${voice.label}:`, e);
        graph.rootGain.gain.value = 0.1;
      }

      // Layer 2: Overtone blend
      try {
        graph.overGain.gain.setValueCurveAtTime(overSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] overCurve failed for ${voice.label}:`, e);
      }

      // Layer 2: Undertone blend
      try {
        graph.underGain.gain.setValueCurveAtTime(underSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] underCurve failed for ${voice.label}:`, e);
      }

      // Layer 3: FM modulation index (Hz)
      try {
        graph.fmModGain.gain.setValueCurveAtTime(fmIdxSlice, t0, remaining);
      } catch (e) {
        console.warn(`[Engine] fmIndexCurve failed for ${voice.label}:`, e);
      }

      // Layer 3: FM output amplitude
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

    const ctx = this.#audioCtx;
    const scheduleUntil = ctx.currentTime + LOOKAHEAD_SEC;

    for (let vi = 0; vi < this.#voices.length; vi++) {
      const voice = this.#voices[vi];
      if (voice.muted || !voice.graph) continue;

      const events = voice.transients;
      let   idx    = this.#nextIdx[vi];

      while (idx < events.length) {
        const ev        = events[idx];
        const evCtxTime = this.#t0 + (ev.timeSec - this.#offsetSec);

        if (evCtxTime > scheduleUntil) break;
        if (evCtxTime < ctx.currentTime - 0.010) { idx++; continue; }

        if (ev.type === 'spike' && ev.ppafNorm < this.#synthParams.spikeThreshold) {
          idx++;
          continue;
        }

        const key      = `${ev.type}-${ev.salience}`;
        const template = voice.templates?.get(key);
        if (template) {
          const source = ctx.createBufferSource();
          source.buffer = template;
          source.connect(voice.graph.transientGain);
          source.start(Math.max(ctx.currentTime, evCtxTime));
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

    for (const v of this.#voices) { v.graph = null; v.templates = null; }
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
