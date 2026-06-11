/* === Per-slide audio targets ========================================
   Five-layer composition. File-based layers (drone, pulse, gait) decode
   into AudioBuffers for sample-accurate looping. Synthesized layers
   (titleChord, alphaHarmony) are Web Audio HarmonySynth instances that
   ring at constant just-intonation pitches over the C3 fundamental.

   Volume design (rationale per architecture spec):
     0:    soft C3 sine anchors the title — a single tone with the
           HarmonySynth's default gentle tremolo, set to hand off
           seamlessly to the drone at the same fundamental on slide 1
     1:    drone bed enters under the question
     2:    title chord layered over drone for the engulf/title reveal
     3:    chord clears, drone alone for the definition
     4:    pulse joins as the slide's content driver
     5:    gait joins at 3:2 against pulse — drone + pulse drop to make room
     6:    alpha harmony joins as the slide's payload — rhythm bed lowered
     7:    all four layers sustain at lowered atmospheric levels (bloom)
     8-10: pulse/gait/harmony fade out — drone alone holds the room
           through the demo (schematic + live demo), implications, and
           close (drone fades only on unload).
   ===================================================================== */
const SLIDES = [
  { index: 0,  section: '',                    audio: { titleSine: 0.15 } },
  { index: 1,  section: 'i. the question',     audio: { drone: 0.45 } },
  { index: 2,  section: 'ii. the method',      audio: { drone: 0.45, titleChord: 0.06 } }, // titleChord settled sustain — JS envelope swells then settles
  { index: 3,  section: 'ii. the method',      audio: { drone: 0.45 } },
  { index: 4,  section: 'iii. the build',      audio: { drone: 0.45, pulse: 0.7 } },
  { index: 5,  section: 'iii. the build',      audio: { drone: 0.40, pulse: 0.5, gait: 0.7 } },
  { index: 6,  section: 'iii. the build',      audio: { drone: 0.35, pulse: 0.4, gait: 0.5, alphaHarmony: 0.08 } }, // alphaHarmony settled sustain — JS envelope on entry
  { index: 7,  section: 'iii. the build',      audio: { drone: 0.30, pulse: 0.35, gait: 0.45, alphaHarmony: 0.08 } }, // bloom — sustain continues
  { index: 8,  section: 'iv. the demo',        audio: { drone: 0.30 } }, // schematic + live demo, drone alone
  { index: 9,  section: 'v. what comes next',  audio: { drone: 0.05 } }, // star map — drone hushed almost to silence for the held-breath arrival
  { index: 10, section: 'v. what comes next',  audio: { drone: 0.12, curation: 0.09 } },  // curation — the 5-series, partials fading in/out over a soft drone
  { index: 11, section: 'v. what comes next',  audio: { drone: 0.12, therapy: 0.085 } },  // therapy — the 7-series
  { index: 12, section: 'v. what comes next',  audio: { drone: 0.12, neuro: 0.07 } },     // neuromodulation — the 11-series
  { index: 13, section: 'vi. close',           audio: { drone: 0.16, home: 0.10 } },       // close — resolves to the harmonic series, drone softly on
];

/**
 * Two-oscillator harmony synthesizer with parallel reverb and a slow
 * tremolo LFO. Used for slide 2's title chord (11/8 + 16/11 above C3,
 * microtonal) and slide 6's alpha harmony (5/4 + 8/5 above C4, just-
 * intonation major third + minor sixth, one octave above the drone).
 *
 * Pitches are set once at construction and never change. setVolume()
 * fades the synth's master output only — both notes remain at their
 * constant frequencies and equal balance with each other.
 */
class HarmonySynth {
  constructor(ctx, destination, {
    ratios,
    baseFreq,
    alternate = false,
    tremoloRate,
    alternateDepth = 0.45,
    breathDepth = 0.08,
    rolloffKnee = 0,
    independent = false,
  }) {
    this.ctx = ctx;

    // Master output — the only thing setVolume touches.
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0;
    this.outputGain.connect(destination);

    // Synthetic convolver reverb — generated noise IR avoids needing
    // an external impulse-response file.
    const reverb = ctx.createConvolver();
    reverb.buffer = HarmonySynth.makeIR(ctx, 2.5, 2.0);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.45;
    reverb.connect(wetGain);
    wetGain.connect(this.outputGain);

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;
    dryGain.connect(this.outputGain);

    // LFO. In default mode, depth is shallow (0.08) and shared so both
    // tones breathe together — a slow group swell. In `alternate` mode,
    // each oscillator gets its own depth node with alternating sign, so
    // the two tones trade loudness (one swells while the other dips)
    // and the chord reads as call-and-response. Caller may override
    // tremoloRate to slow or quicken the pass; alternateDepth tunes
    // how dramatically the two tones trade (smaller = gentler).
    const defaultRate = alternate ? 0.22 : 0.18;
    const tremoloLFO = ctx.createOscillator();
    tremoloLFO.type = 'sine';
    tremoloLFO.frequency.value = tremoloRate ?? defaultRate;
    tremoloLFO.start();

    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = breathDepth;   // shared (non-alternate) breath amount
    tremoloLFO.connect(tremoloDepth);

    // One sine per ratio. Base gain 0.5 keeps headroom for both notes
    // ringing at full output.
    ratios.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * ratio;
      // Gentle high-frequency rolloff: partials above the knee get quieter
      // (gain ∝ knee/ratio), so high harmonics never dominate.
      const baseG = 0.5 * (rolloffKnee > 0 ? Math.min(1, rolloffKnee / ratio) : 1);
      const oscGain = ctx.createGain();

      if (independent) {
        // Each partial fades fully in and out on its own slow LFO (staggered
        // rates), so the chord reads as sparse and shimmering rather than a
        // sustained block — only a few partials sound at any moment.
        oscGain.gain.value = baseG * 0.5;             // DC midpoint of the fade
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.03 + i * 0.012;       // slow, staggered per partial
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = baseG * 0.5;            // swings the gain between 0 and baseG
        lfo.connect(lfoDepth);
        lfoDepth.connect(oscGain.gain);
        lfo.start();
      } else {
        oscGain.gain.value = baseG;
        if (alternate) {
          const perOscDepth = ctx.createGain();
          perOscDepth.gain.value = i % 2 === 0 ? alternateDepth : -alternateDepth;
          tremoloLFO.connect(perOscDepth);
          perOscDepth.connect(oscGain.gain);
        } else {
          tremoloDepth.connect(oscGain.gain);
        }
      }

      osc.connect(oscGain);
      oscGain.connect(dryGain);
      oscGain.connect(reverb);
      osc.start();
    });
  }

  static makeIR(ctx, durationSec, decay) {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const ir = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return ir;
  }

  setVolume(targetVolume, durationSeconds) {
    const now = this.ctx.currentTime;
    const current = this.outputGain.gain.value;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(current, now);
    this.outputGain.gain.linearRampToValueAtTime(targetVolume, now + durationSeconds);
  }
}

/**
 * Owns the deck's audio. Five layers — three file-based (drone, pulse,
 * gait) decoded into AudioBuffers for sample-accurate looping, and two
 * synthesized via HarmonySynth (titleChord, alphaHarmony).
 *
 * setSlideState(index) reads SLIDES[index].audio and crossfades all
 * layers to those targets. Layers absent from the target default to 0.
 *
 * Browser autoplay restriction: init() must run inside a user gesture.
 * onFirstGesture triggers it; subsequent setSlideState calls await the
 * in-flight init promise transparently.
 *
 * Reduced motion: all methods become no-ops, matching how the visual
 * cadences skip themselves under the same media query.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.masterVolume = 1.0;
    this.initialized = false;
    this.initPromise = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.drone = null;
    this.pulse = null;
    this.gait = null;
    this.titleSine = null;
    this.titleChord = null;
    this.alphaHarmony = null;
    // Slide 10 (star map) — one soft tone per star.
    this.starNear = null;
    this.starMid = null;
    this.starFar = null;
    // Slides 11-14 — one gentle just-intonation chord per pillar, resolving
    // to the harmonic series at the close.
    this.curationChord = null;
    this.therapyChord = null;
    this.neuroChord = null;
    this.homeChord = null;

    // Analyser tapped off the drone gain so the demo slide can drive
    // visual modulation (--drone-rms) from real audio amplitude.
    this.droneAnalyser = null;
    this.droneAnalyserData = null;
    this.rmsRafId = null;
    this.smoothedRms = 0;
  }

  async init() {
    if (this.reducedMotion) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (_) {}
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // Decode all sample buffers in parallel. Using AudioBufferSource
      // (not <audio loop>) gives sample-accurate looping with no seam
      // — important because c-drone, hr_pulse, and gait_layer all
      // expose audible discontinuities under the naive HTMLAudioElement
      // loop reseat.
      const [droneBuf, pulseBuf, gaitBuf] = await Promise.all([
        this.loadBuffer('./audio/c-drone.mp3'),
        this.loadBuffer('./audio/hr_pulse.mp3'),
        this.loadBuffer('./audio/gait_layer.mp3'),
      ]);
      this.drone = this.makeBufferPlayer(droneBuf);

      // Tap the drone gain into an analyser. AnalyserNode is non-
      // destructive — masterGain still receives the same signal. The
      // demo slide consumes the resulting --drone-rms CSS variable
      // for glyph glow; other slides ignore it.
      this.droneAnalyser = this.ctx.createAnalyser();
      this.droneAnalyser.fftSize = 1024;
      this.droneAnalyser.smoothingTimeConstant = 0.85;
      this.droneAnalyserData = new Uint8Array(this.droneAnalyser.fftSize);
      this.drone.gain.connect(this.droneAnalyser);
      this.startRmsPump();
      // hr_pulse: 5 strikes at 857ms intervals from t=0 to t=3.428s
      // plus ~0.5s trailing silence. loopEnd at 3.428 drops the silence
      // (which read as a "rest every 4 beats") and the would-be 5th
      // strike that overlaps beat 1 of the next cycle.
      this.pulse = this.makeBufferPlayer(pulseBuf, { loopEnd: 3.428 });
      this.gait = this.makeBufferPlayer(gaitBuf);

      // Synthesized layers. Drone fundamental for harmonic reference is
      // C3 ≈ 130.81 Hz — same C as c-drone.mp3.
      this.titleSine = new HarmonySynth(this.ctx, this.masterGain, {
        // Single C3 sine — same fundamental as c-drone.mp3 so the
        // handoff from slide 0 to slide 1 is harmonically seamless.
        // HarmonySynth's default non-alternate mode applies the gentle
        // shared tremolo (~0.18 Hz, 8% depth) used elsewhere in the deck.
        ratios: [1],
        baseFreq: 130.81,
      });
      this.titleChord = new HarmonySynth(this.ctx, this.masterGain, {
        // 11/8 (≈547¢) and 16/11 (≈648¢) above C4 — microtonal pitches
        // rooted in prime 11. Intentionally outside 12-TET so the chord
        // signals "composed, not preset." Raised to C4 (was C3) so the
        // dyad sits above the drone bed rather than fighting it.
        ratios: [11 / 8, 16 / 11],
        baseFreq: 261.63,
        // Antiphonal pass at a meditative pace — the two tones gently
        // trade loudness across ~12s rather than ringing together.
        // Smaller alternateDepth (0.30) makes the trade less dramatic
        // than the alphaHarmony's call-and-response.
        alternate: true,
        tremoloRate: 0.085,
        alternateDepth: 0.30,
      });
      this.alphaHarmony = new HarmonySynth(this.ctx, this.masterGain, {
        // 5/4 (just-intonation major third) + 8/5 (just-intonation
        // minor sixth) above C4 — one octave above the c-drone.mp3
        // fundamental, so the IAF "shimmer" sits clearly above the bed.
        // alternate:true swings the two tones in antiphase so they
        // take turns rather than ringing together.
        ratios: [5 / 4, 8 / 5],
        baseFreq: 261.63,
        alternate: true,
      });

      // Slide 10 (star map) — one soft tone per star: 5/4 (near), 7/4
      // (mid), 11/8 (far) above C4. Over the hushed C3 drone these are the
      // 5th, 7th and 11th partials of the fundamental — a spectral shimmer
      // for the cosmos. Same sine + reverb + tremolo treatment as the other
      // layers, but with a SLOW, DEEP breath so that — once they've entered
      // and settled — each tone organically fades in and out on its own
      // long cycle (~14–19s), the three drifting through each other.
      this.starNear = new HarmonySynth(this.ctx, this.masterGain, { ratios: [5 / 4],  baseFreq: 261.63, tremoloRate: 0.060, breathDepth: 0.45 });
      this.starMid  = new HarmonySynth(this.ctx, this.masterGain, { ratios: [7 / 4],  baseFreq: 261.63, tremoloRate: 0.052, breathDepth: 0.48 });
      this.starFar  = new HarmonySynth(this.ctx, this.masterGain, { ratios: [11 / 8], baseFreq: 261.63, tremoloRate: 0.070, breathDepth: 0.42 });

      // Section "what comes next" — a gentle just-intonation chord per pillar,
      // built on the drone's own fundamental (C3 = 130.81), so each chord is
      // literally the drone's overtones. Curation = the 5-series, therapy =
      // the 7-series, neuromodulation = the 11-series; high partials are
      // rolled off so nothing gets shrill. The close resolves them to the
      // plain harmonic series (1·2·3·4·5) — coming home to the fundamental.
      const C3 = 130.81;
      this.curationChord = new HarmonySynth(this.ctx, this.masterGain, {
        ratios: [3 / 2, 4 / 3, 5 / 4, 5 / 2, 5 / 1], baseFreq: C3, rolloffKnee: 2.5, independent: true,
      });
      this.therapyChord = new HarmonySynth(this.ctx, this.masterGain, {
        ratios: [7 / 6, 7 / 5, 7 / 4, 7 / 3, 7 / 2, 7 / 1], baseFreq: C3, rolloffKnee: 2.5, independent: true,
      });
      this.neuroChord = new HarmonySynth(this.ctx, this.masterGain, {
        ratios: [11 / 10, 11 / 9, 11 / 8, 11 / 7, 11 / 6, 11 / 5, 11 / 4, 11 / 3, 11 / 2, 11 / 1], baseFreq: C3, rolloffKnee: 2.2, independent: true,
      });
      this.homeChord = new HarmonySynth(this.ctx, this.masterGain, {
        ratios: [1, 2, 3, 4, 5], baseFreq: C3, rolloffKnee: 3.0, independent: true,
      });

      this.initialized = true;
    })();

    return this.initPromise;
  }

  async loadBuffer(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Build a continuously-playing AudioBufferSource backed by a gain
   * stage. The source starts immediately at gain=0 (silent until a
   * non-zero target arrives). Returns the gain handle so setSlideState
   * can fade it directly.
   */
  makeBufferPlayer(buffer, { loopStart = 0, loopEnd = 0 } = {}) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    if (loopEnd > 0) {
      source.loopStart = loopStart;
      source.loopEnd = loopEnd;
    }

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);

    return { gain };
  }

  /**
   * Crossfade all five layers to the target volumes for a slide. The
   * default 0.8s fade matches the visual slide-change crossfade so
   * audio and visuals settle together.
   */
  async setSlideState(slideIndex, fadeSeconds = 0.8) {
    if (this.reducedMotion) return;
    if (!this.initialized) {
      await this.init();
      if (!this.initialized) return;
    }

    const targets = SLIDES[slideIndex]?.audio || {};
    this.fadeLayer(this.drone, targets.drone || 0, fadeSeconds);
    this.fadeLayer(this.pulse, targets.pulse || 0, fadeSeconds);
    this.fadeLayer(this.gait,  targets.gait  || 0, fadeSeconds);
    if (this.titleSine)    this.titleSine.setVolume(targets.titleSine    || 0, fadeSeconds);
    if (this.titleChord)   this.titleChord.setVolume(targets.titleChord   || 0, fadeSeconds);
    if (this.alphaHarmony) this.alphaHarmony.setVolume(targets.alphaHarmony || 0, fadeSeconds);
    if (this.curationChord) this.curationChord.setVolume(targets.curation || 0, fadeSeconds);
    if (this.therapyChord)  this.therapyChord.setVolume(targets.therapy  || 0, fadeSeconds);
    if (this.neuroChord)    this.neuroChord.setVolume(targets.neuro    || 0, fadeSeconds);
    if (this.homeChord)     this.homeChord.setVolume(targets.home     || 0, fadeSeconds);
  }

  fadeLayer(player, targetVolume, durationSeconds) {
    if (!player || !this.ctx) return;
    const now = this.ctx.currentTime;
    const current = player.gain.gain.value;
    player.gain.gain.cancelScheduledValues(now);
    player.gain.gain.setValueAtTime(current, now);
    player.gain.gain.linearRampToValueAtTime(targetVolume, now + durationSeconds);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      // setTargetAtTime gives a brief smoothing to avoid a click on toggle.
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, now, 0.01);
    }
    return this.muted;
  }

  /**
   * Set the master output level. Stored on the instance so toggleMute
   * can restore to the slider's current value when unmuting. While the
   * engine is muted the gain stays at 0 — the slider position is
   * remembered for the next unmute.
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.masterVolume, now, 0.03);
    }
  }

  async suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      try { await this.ctx.suspend(); } catch (_) {}
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (_) {}
    }
  }

  /**
   * Continuously sample the drone analyser, compute RMS amplitude,
   * and write a smoothed value into --drone-rms on the document
   * element. Typical values land in 0–~0.25 while the drone is
   * audible; near zero when muted or when a slide's audio target
   * is silent. Only the demo slide's CSS reads the variable.
   */
  startRmsPump() {
    if (this.rmsRafId !== null) return;
    if (!this.droneAnalyser) return;
    const root = document.documentElement;
    const data = this.droneAnalyserData;
    const analyser = this.droneAnalyser;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      // Additional 1-pole smoothing on top of the analyser's built-in
      // smoothing — the drone is a sustained tone so per-frame jitter
      // would read as flicker rather than breath.
      this.smoothedRms = this.smoothedRms * 0.88 + rms * 0.12;
      root.style.setProperty('--drone-rms', this.smoothedRms.toFixed(4));
      this.rmsRafId = requestAnimationFrame(tick);
    };

    this.rmsRafId = requestAnimationFrame(tick);
  }

  /**
   * Fade everything to silence. Called on page unload as a courtesy
   * (the context is destroyed by the browser anyway).
   */
  stopAll(fadeSeconds = 0.4) {
    if (!this.initialized) return;
    [this.drone, this.pulse, this.gait].forEach((p) => this.fadeLayer(p, 0, fadeSeconds));
    if (this.titleSine)    this.titleSine.setVolume(0, fadeSeconds);
    if (this.titleChord)   this.titleChord.setVolume(0, fadeSeconds);
    if (this.alphaHarmony) this.alphaHarmony.setVolume(0, fadeSeconds);
    if (this.starNear)     this.starNear.setVolume(0, fadeSeconds);
    if (this.starMid)      this.starMid.setVolume(0, fadeSeconds);
    if (this.starFar)      this.starFar.setVolume(0, fadeSeconds);
    if (this.curationChord) this.curationChord.setVolume(0, fadeSeconds);
    if (this.therapyChord)  this.therapyChord.setVolume(0, fadeSeconds);
    if (this.neuroChord)    this.neuroChord.setVolume(0, fadeSeconds);
    if (this.homeChord)     this.homeChord.setVolume(0, fadeSeconds);
  }
}

const audioEngine = new AudioEngine();

const state = {
  currentIndex: 0,
  total: SLIDES.length,
  hasUserGesture: false,
};

const slides = [...document.querySelectorAll('.slide')];
const progressFill = document.getElementById('progress-fill');

function clampSlideIndex(index) {
  return Math.max(0, Math.min(state.total - 1, index));
}

function parseHashIndex() {
  const raw = window.location.hash.replace('#', '').trim();
  if (!raw) {
    return 0;
  }

  const numeric = Number.parseInt(raw, 10);
  if (Number.isNaN(numeric)) {
    return 0;
  }

  return clampSlideIndex(numeric - 1);
}

function renderSlides() {
  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === state.currentIndex);
  });

  const progress = ((state.currentIndex + 1) / state.total) * 100;
  progressFill.style.width = `${progress}%`;
}

async function setSlide(nextIndex, { syncHash = true } = {}) {
  const clamped = clampSlideIndex(nextIndex);
  if (clamped === state.currentIndex) {
    return;
  }
  const previousIndex = state.currentIndex;

  // Slide 2 → slide 3 needs orbit-rotation continuity. Read slide 2's
  // current rotation (computed transform), freeze its visible state so
  // the cross-fade doesn't snap, and pass the captured angle to slide
  // 3 via CSS variables so its echo orbits start exactly there.
  if (clamped === 2 && state.currentIndex === 1) {
    freezeSlide2();
  }

  // Slide 3 → slide 4: hold slide 3's engulfed blue+title state during
  // the cross-fade so the handoff to slide 4 (which starts in the same
  // visual state) is invisible.
  if (clamped === 3 && state.currentIndex === 2) {
    freezeSlide3();
  }

  // Slide 4 → slide 5: pin slide 4's trace circle to its fully-drawn
  // state so the cross-fade hands off to slide 5's carry-over inner
  // ring without a visible snap if the user advanced before the trace
  // animation completed.
  if (clamped === 5 && state.currentIndex === 4) {
    freezeSlide4Trace();
  }

  // Returning to slide 2, 3, or 4: clear their freezes so they can
  // play their cadences fresh on re-entry.
  if (clamped === 1) {
    unfreezeSlide2();
  }
  if (clamped === 2) {
    unfreezeSlide3();
  }
  if (clamped === 4) {
    unfreezeSlide4Trace();
  }

  // Slide 5 gait — continuous footstep loop + live HR/α/Tempo while
  // slide 5 is active. Drives the visible variability of α.
  if (clamped === SLIDE_GAIT_INDEX) {
    startGaitLoop();
  } else if (state.currentIndex === SLIDE_GAIT_INDEX) {
    stopGaitLoop();
  }

  // Slide 6 (IAF) — continuous wave + live HR/IAF/α/Tempo readouts
  // while slide 6 is active.
  if (clamped === SLIDE_6_INDEX) {
    startIAFLoop();
    hideIAFClocks();   // intermediate step starts hidden on (re)entry
  } else if (state.currentIndex === SLIDE_6_INDEX) {
    stopIAFLoop();
    hideIAFClocks();   // reset so a later return to IAF starts fresh
  }

  // Slide 10 (star map) — draw the dotted course downward on entry; reset
  // on leave so a return replays the draw.
  if (clamped === SLIDE_STARMAP_INDEX) {
    runStarmapReveal();
  } else if (state.currentIndex === SLIDE_STARMAP_INDEX) {
    resetStarmapReveal();
  }

  // Slide 11 (Curation) — the listener constellation drifts + aligns while
  // the slide is active.
  if (clamped === SLIDE_CURATE_INDEX) {
    startCurateLoop();
  } else if (state.currentIndex === SLIDE_CURATE_INDEX) {
    stopCurateLoop();
  }

  // Slide 12 (Therapy) — the refining constellation runs while active:
  // stars turn yellow + align onto a quickening wave, the rest fade.
  if (clamped === SLIDE_THERAPY_INDEX) {
    startTherapyLoop();
  } else if (state.currentIndex === SLIDE_THERAPY_INDEX) {
    stopTherapyLoop();
  }

  // Slide 13 (Frontier) — the resonance runs while active: a generated
  // wave locks to the carried one, swelling, warming to red.
  if (clamped === SLIDE_FRONTIER_INDEX) {
    startFrontierLoop();
  } else if (state.currentIndex === SLIDE_FRONTIER_INDEX) {
    stopFrontierLoop();
  }

  // Slide 8 (bloom) — the music lane runs while the slide is active:
  // notes swing + subdivide off the strict grid, playhead sweeping.
  if (clamped === SLIDE_BLOOM_INDEX) {
    runBloomReveal();   // set initial hidden/merged state before the slide fades in
    startBloomLoop();
  } else if (state.currentIndex === SLIDE_BLOOM_INDEX) {
    stopBloomLoop();
    resetBloomReveal();
  }

  // Demo-slide whispers + biomarker drift — start the rotating phrase
  // ghost and the live β/α readouts on entry; stop both on leave so
  // they don't bleed into the next slide.
  if (clamped === SLIDE_DEMO_INDEX) {
    startWhispers();
    startBiomarkerDrift();
  } else if (state.currentIndex === SLIDE_DEMO_INDEX) {
    stopWhispers();
    stopBiomarkerDrift();
  }

  state.currentIndex = clamped;
  renderSlides();

  if (syncHash) {
    window.location.hash = `#${clamped + 1}`;
  }

  // Audio is independent of the visual slide cross-fade. The engine
  // crossfades all five layers to the new slide's targets in parallel.
  audioEngine.setSlideState(clamped);

  // Slide 2 (engulf + title write) — titleChord runs a swell-and-settle
  // envelope: silent through the 2.5s engulf, brief attack to a gentle
  // peak as the title writes, hold a beat, then decay to a soft sustain
  // that holds beneath the bed until the slide leaves. On exit: stretch
  // the fade-out to 3.5s so the convolver tail bleeds gracefully under
  // the next slide.
  if (clamped === 2 && previousIndex < 2 && audioEngine.titleChord) {
    audioEngine.titleChord.setVolume(0, 0.05);
    setTimeout(() => {
      if (state.currentIndex === 2 && audioEngine.titleChord) {
        audioEngine.titleChord.setVolume(0.18, 1.8); // attack to peak
      }
    }, 2500);
    setTimeout(() => {
      if (state.currentIndex === 2 && audioEngine.titleChord) {
        audioEngine.titleChord.setVolume(0.06, 2.5); // decay to soft sustain
      }
    }, 5500);
  } else if (previousIndex === 2 && clamped !== 2 && audioEngine.titleChord) {
    audioEngine.titleChord.setVolume(0, 3.5);
  }

  // Slide 6 (IAF reveal) — alphaHarmony runs the same swell-and-settle
  // envelope on first entry: brief attack to a gentle peak, hold, then
  // settle to a soft sustain that holds across slides 6–7 until the
  // demo at slide 8 fades it out. Triggers only on forward entry from
  // earlier slides; back-nav from slide 7 keeps the sustain steady.
  if (clamped === 6 && previousIndex < 6 && audioEngine.alphaHarmony) {
    audioEngine.alphaHarmony.setVolume(0, 0.05);
    setTimeout(() => {
      if ((state.currentIndex === 6 || state.currentIndex === 7) && audioEngine.alphaHarmony) {
        audioEngine.alphaHarmony.setVolume(0.20, 1.6); // attack to peak
      }
    }, 200);
    setTimeout(() => {
      if ((state.currentIndex === 6 || state.currentIndex === 7) && audioEngine.alphaHarmony) {
        audioEngine.alphaHarmony.setVolume(0.08, 2.5); // decay to soft sustain
      }
    }, 2800);
  }

  // Slide 10 (star map) — the three star tones bloom in with their stars
  // (5/4 near · 7/4 mid · 11/8 far), staggered to match the draw reveal:
  // each enters to a gentle peak, then comes down to a soft sustain where
  // its slow, deep tremolo takes over and the tone fades organically in
  // and out on its own long cycle. Faded out together on leave.
  if (clamped === SLIDE_STARMAP_INDEX && audioEngine.starNear) {
    const PEAK = 0.09, SUSTAIN = 0.05;
    const tones = [
      { synth: audioEngine.starNear, at: 600 },
      { synth: audioEngine.starMid,  at: 1700 },
      { synth: audioEngine.starFar,  at: 2800 },
    ];
    tones.forEach(({ synth, at }) => {
      synth.setVolume(0, 0.05);
      setTimeout(() => { if (state.currentIndex === SLIDE_STARMAP_INDEX) synth.setVolume(PEAK, 1.8); }, at);            // enter
      setTimeout(() => { if (state.currentIndex === SLIDE_STARMAP_INDEX) synth.setVolume(SUSTAIN, 3.2); }, at + 2200);  // come down, then breathe
    });
  } else if (previousIndex === SLIDE_STARMAP_INDEX && clamped !== SLIDE_STARMAP_INDEX && audioEngine.starNear) {
    [audioEngine.starNear, audioEngine.starMid, audioEngine.starFar].forEach((s) => s.setVolume(0, 1.6));
  }
}

function extractRotateZ(element) {
  const transform = window.getComputedStyle(element).transform;
  if (!transform || transform === 'none') return 0;

  const match = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!match) return 0;

  const parts = match[1].split(',').map((s) => parseFloat(s.trim()));

  if (parts.length === 16) {
    // matrix3d is column-major. For rotateY(α) · rotateZ(β):
    //   parts[1] = sin β,  parts[5] = cos β
    return (Math.atan2(parts[1], parts[5]) * 180) / Math.PI;
  }
  if (parts.length === 6) {
    // 2D matrix(a, b, c, d, e, f) with a = cos θ, b = sin θ
    return (Math.atan2(parts[1], parts[0]) * 180) / Math.PI;
  }
  return 0;
}

function freezeSlide2() {
  const slide2 = slides[1];
  const slide3 = slides[2];
  if (!slide2 || !slide3) return;

  const orbits = [
    { sel: '.orbit-outer', traceSel: '.orbit-trace-outer', tilt:  12, strokeOp: 0.28 },
    { sel: '.orbit-inner', traceSel: '.orbit-trace-inner', tilt: -12, strokeOp: 0.7  },
  ];

  orbits.forEach(({ sel, traceSel, tilt, strokeOp }) => {
    const orbit = slide2.querySelector(sel);
    const trace = slide3.querySelector(traceSel);
    if (!orbit) return;

    const angle = extractRotateZ(orbit);

    // Freeze slide 2 orbit visible at the captured tilt+rotation so
    // the cross-fade to slide 3 hands off without a snap. With the
    // new static slide-1 design the captured angle is always 0deg
    // (no spin), but writing the inline transform still pins the
    // exact pose during the transition.
    orbit.style.transform = `rotateY(${tilt}deg) rotate(${angle}deg)`;
    orbit.style.strokeOpacity = String(strokeOp);

    // Pass the angle to slide 3's echo trace via CSS variable.
    if (trace) {
      trace.style.setProperty('--start-rotation', `${angle}deg`);
    }
  });

  // Pin every cadence-driven element at its CURRENT computed opacity
  // so the cross-fade hands off from the exact visual state the user
  // is seeing. Pinning everything to 1 would make not-yet-revealed
  // words pop in at the moment of advance — bad if the presenter
  // skips ahead before the cadence has finished. Pinning to the
  // current value keeps mid-cadence advances graceful.
  slide2.querySelectorAll('.orbit-outer, .orbit-inner, .dot, .line, .word').forEach((el) => {
    const computed = parseFloat(window.getComputedStyle(el).opacity);
    el.style.opacity = Number.isFinite(computed) ? String(computed) : '1';
  });
}

function unfreezeSlide2() {
  const slide2 = slides[1];
  if (!slide2) return;

  const elements = slide2.querySelectorAll(
    '.orbit-outer, .orbit-inner, .dot, .line, .word'
  );
  elements.forEach((el) => {
    el.style.transform = '';
    el.style.fillOpacity = '';
    el.style.strokeOpacity = '';
    el.style.strokeDashoffset = '';
    el.style.visibility = '';
    el.style.opacity = '';
  });
}

function freezeSlide3() {
  const slide3 = slides[2];
  if (!slide3) return;

  // Pin slide-method's engulfed end-state inline so the cross-fade to
  // slide-defined doesn't reveal a snap when .active is removed and
  // the forwards-fill animations stop applying. Pin: blue background,
  // orbits at scale 7 with fully opaque blue fill, echo + dots hidden,
  // meta in paper color, title clip-path fully revealed, watermark
  // settled at 0.22 opacity.
  slide3.style.background = 'var(--ink-blue)';

  ['.orbit-trace-outer', '.orbit-trace-inner'].forEach((sel) => {
    const el = slide3.querySelector(sel);
    if (el) {
      el.style.transform = 'rotateY(0deg) scale(7)';
      el.style.fillOpacity = '1';
      el.style.strokeOpacity = '0';
    }
  });

  const collapseBundle = slide3.querySelector('.collapse-bundle');
  if (collapseBundle) collapseBundle.style.opacity = '0';

  slide3.querySelectorAll('.echo-dot-wrap').forEach((el) => {
    el.style.opacity = '0';
  });

  slide3.querySelectorAll('.slide-meta').forEach((el) => {
    el.style.color = 'var(--paper)';
    el.style.opacity = '0.55';
  });

  const title = slide3.querySelector('.reveal-title');
  if (title) {
    title.style.clipPath = 'inset(0 0 0 0)';
  }

  const watermark = slide3.querySelector('.zh-watermark-method');
  if (watermark) {
    watermark.style.opacity = '0.22';
  }
}

function unfreezeSlide3() {
  const slide3 = slides[2];
  if (!slide3) return;

  slide3.style.background = '';

  const elements = slide3.querySelectorAll(
    '.orbit-trace-outer, .orbit-trace-inner, .collapse-bundle, .echo-dot-wrap, .slide-meta, .zh-watermark-method'
  );
  elements.forEach((el) => {
    el.style.transform = '';
    el.style.fillOpacity = '';
    el.style.strokeOpacity = '';
    el.style.opacity = '';
    el.style.color = '';
  });

  const title = slide3.querySelector('.reveal-title');
  if (title) {
    title.style.clipPath = '';
  }
}

/* Slide 4 trace freeze — pin the heart slide's circle to dashoffset:0
   inline so leaving for slide 5 doesn't reveal a partial arc snapping
   to slide 5's fully-drawn carry-over inner ring. Inline style beats
   the .trace-ellipse base rule (specificity 0,1,0). The freeze is
   cleared on re-entry so the trace plays fresh. */
function freezeSlide4Trace() {
  const slide4 = slides[4];
  if (!slide4) return;
  const ellipse = slide4.querySelector('.trace-ellipse');
  if (!ellipse) return;
  ellipse.style.strokeDashoffset = '0';
}

function unfreezeSlide4Trace() {
  const slide4 = slides[4];
  if (!slide4) return;
  const ellipse = slide4.querySelector('.trace-ellipse');
  if (!ellipse) return;
  ellipse.style.strokeDashoffset = '';
}

/* === Biomarker drift — schematic numbers as live readouts ============
   β and α are the only schematic values that map to truly variable
   neural rhythms (beta band ~13–30 Hz, alpha band ~8–13 Hz). On the
   demo slide their integer readouts drift around the canonical 20 / 10
   so the schematic feels like it's sampling a real person rather than
   reciting a formula. Stride / pulse / breath stay fixed because
   they're conceptual ratios in the model, not measured rates.

   Drift is sinusoidal + small jitter, sampled at 700ms — fast enough
   to feel alive, slow enough that the audience can read each value. */
/* === Shared cardio-locomotor coupling (matches the dashboard / calculator) ====
   The tempo multiplier the dashboard applies: r = SPM / HR → Hill(r) → an
   anchor-scaled multiplier on 3-limit just-intonation anchors (rest 4/3, sync
   3/2, run 3). It RISES as you step faster relative to your pulse. Used live on
   the gait slide (driven by step rate) and as the fixed walking coupling the
   IAF + demo slides carry forward. */
const RTD_ANCHOR = 3 / 2;   // sync         (C = 0)
const RTD_BOTTOM = 4 / 3;   // full rest    (C = -1)
const RTD_TOP    = 3;       // extreme high (C = +1)
const RTD_HILL_N = 2;

function rtdMultiplier(hr, spm) {
  if (!(hr > 0)) return RTD_ANCHOR;
  const r  = spm / hr;
  const rn = Math.pow(r, RTD_HILL_N);
  const theta = rn / (1 + rn);
  const C = 2 * theta - 1;
  const slope = C <= 0 ? (RTD_ANCHOR - RTD_BOTTOM) : (RTD_TOP - RTD_ANCHOR);
  return RTD_ANCHOR + slope * C;
}

// Canonical walking operating point. Where step rate isn't being swept (the IAF
// + demo slides), the coupling is carried forward fixed from the gait slide.
// SPM 113 @ HR 80 → r ≈ 1.414 → m = 2.00 exactly — a clean walking multiplier.
const WALK_HR  = 80;
const WALK_SPM = 113;
const WALK_M   = rtdMultiplier(WALK_HR, WALK_SPM);   // = 2.00

/* === Slide 9 (demo) graphs ==========================================
   Ports of the dashboard's two curves onto the demo slide — where the
   formula's m and μ come from. The Hill graph (m = the step/heart
   coupling) is static at the walking point; the IAF graph (μ = the
   alpha factor) has a live marker that drifts with α. Built once on
   slide entry; only the IAF marker moves each drift tick. */
const IG_NS = 'http://www.w3.org/2000/svg';
const IG_X0 = 30, IG_X1 = 228, IG_Y_BOT = 124, IG_Y_TOP = 14;
const IG_A_LO = 8, IG_A_HI = 13, IG_MU_LO = 0.75, IG_MU_HI = 1.30;

let igBuilt = false;
let igIafMarker = null;

function igEl(tag, attrs) {
  const el = document.createElementNS(IG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
function igXFor(frac) { return IG_X0 + frac * (IG_X1 - IG_X0); }
function igYFor(frac) { return IG_Y_BOT + frac * (IG_Y_TOP - IG_Y_BOT); }   // frac 0..1, bottom→top

function igAxes(svg, xlabel) {
  svg.appendChild(igEl('line', { class: 'ig-axis', x1: IG_X0, y1: IG_Y_BOT, x2: IG_X1, y2: IG_Y_BOT }));
  svg.appendChild(igEl('line', { class: 'ig-axis', x1: IG_X0, y1: IG_Y_BOT, x2: IG_X0, y2: IG_Y_TOP }));
  const t = igEl('text', { class: 'ig-tick', x: (IG_X0 + IG_X1) / 2, y: 145, 'text-anchor': 'middle' });
  t.textContent = xlabel;
  svg.appendChild(t);
}

function igCurvePath(samples) {   // samples: [[xFrac, yFrac], ...]
  return samples
    .map((p, i) => (i === 0 ? 'M ' : 'L ') + igXFor(p[0]).toFixed(1) + ' ' + igYFor(p[1]).toFixed(1))
    .join(' ');
}

function igHint(svg, text, x, y, anchor) {
  const h = igEl('text', { class: 'ig-hint', x, y, 'text-anchor': anchor || 'start' });
  h.textContent = text;
  svg.appendChild(h);
}

function buildIntegrateGraphs() {
  if (igBuilt) return;
  const hill = document.getElementById('ig-hill');
  const iaf  = document.getElementById('ig-iaf');
  if (!hill || !iaf) return;

  // --- Hill graph: m = rtdMultiplier vs r = SPM/HR.  m spans 4/3 … 3. ---
  igAxes(hill, 'r = SPM / HR');
  const R_MAX = 3;
  const mFrac = (m) => (m - RTD_BOTTOM) / (RTD_TOP - RTD_BOTTOM);
  const hillPts = [];
  for (let i = 0; i <= 60; i++) {
    const r = (i / 60) * R_MAX;
    hillPts.push([r / R_MAX, mFrac(rtdMultiplier(1, r))]);
  }
  hill.appendChild(igEl('line', { class: 'ig-ref', x1: igXFor(1 / R_MAX), y1: IG_Y_BOT, x2: igXFor(1 / R_MAX), y2: IG_Y_TOP }));
  hill.appendChild(igEl('path', { class: 'ig-curve', d: igCurvePath(hillPts) }));
  const rWalk = WALK_SPM / WALK_HR;
  hill.appendChild(igEl('circle', { class: 'ig-marker', r: 5, cx: igXFor(rWalk / R_MAX), cy: igYFor(mFrac(WALK_M)) }));
  igHint(hill, 'rest', IG_X0 + 3, IG_Y_BOT - 4);
  igHint(hill, 'run',  IG_X1 - 3, IG_Y_TOP + 10, 'end');

  // --- IAF graph: μ = (IAF₀/IAF)^β over the alpha band, marker live on α. ---
  igAxes(iaf, 'α (Hz)');
  const aFrac  = (a)  => (a - IG_A_LO) / (IG_A_HI - IG_A_LO);
  const muFrac = (mu) => (mu - IG_MU_LO) / (IG_MU_HI - IG_MU_LO);
  const iafPts = [];
  for (let i = 0; i <= 60; i++) {
    const a = IG_A_LO + (i / 60) * (IG_A_HI - IG_A_LO);
    iafPts.push([aFrac(a), muFrac(iafMu(a))]);
  }
  iaf.appendChild(igEl('line', { class: 'ig-ref', x1: igXFor(aFrac(IAF_BASELINE_HZ)), y1: IG_Y_BOT, x2: igXFor(aFrac(IAF_BASELINE_HZ)), y2: IG_Y_TOP }));
  iaf.appendChild(igEl('path', { class: 'ig-curve', d: igCurvePath(iafPts) }));
  igIafMarker = igEl('circle', { class: 'ig-marker', r: 5, cx: igXFor(aFrac(IAF_BASELINE_HZ)), cy: igYFor(muFrac(1)) });
  iaf.appendChild(igIafMarker);
  igHint(iaf, 'faster', IG_X0 + 3, IG_Y_TOP + 10);
  igHint(iaf, 'slower', IG_X1 - 3, IG_Y_BOT - 4, 'end');

  igBuilt = true;
}

// Move the IAF marker to a live alpha value (used by the drift loop).
function igSetIafMarker(alphaHz) {
  if (!igIafMarker) return;
  const a = Math.max(IG_A_LO, Math.min(IG_A_HI, alphaHz));
  const aFrac  = (a - IG_A_LO) / (IG_A_HI - IG_A_LO);
  const muFrac = (iafMu(a) - IG_MU_LO) / (IG_MU_HI - IG_MU_LO);
  igIafMarker.setAttribute('cx', igXFor(aFrac).toFixed(1));
  igIafMarker.setAttribute('cy', igYFor(muFrac).toFixed(1));
}

let driftIntervalId = null;
let driftStartTime = 0;

function startBiomarkerDrift() {
  // Build the two graphs and seat the IAF marker at the α baseline. Done
  // before the reduced-motion bail so static users still get the graphs.
  buildIntegrateGraphs();
  igSetIafMarker(IAF_BASELINE_HZ);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  stopBiomarkerDrift();

  const slide = slides[SLIDE_DEMO_INDEX];
  if (!slide) return;
  const betaNum = slide.querySelector('.schematic-beta .num');
  const alphaNum = slide.querySelector('.schematic-alpha .num');
  if (!betaNum || !alphaNum) return;

  driftStartTime = performance.now();

  // Derivation cells (may be absent on older versions of the slide,
  // hence the nullable lookups). Painted alongside the schematic so
  // the audience watches α drift here drive μ and Tempo there.
  const muCell    = slide.querySelector('[data-derive="mu"]');
  const tempoCell = slide.querySelector('[data-derive="tempo"]');
  const DERIVE_HR = WALK_HR;
  const DERIVE_M  = WALK_M;   // the walking step-rate coupling (= 2.00)

  function tick() {
    const t = (performance.now() - driftStartTime) / 1000;
    // β around 20, range 17–23 (within typical beta band).
    const betaVal = Math.round(20 + 2.4 * Math.sin(t / 7) + 1.2 * Math.sin(t / 2.3) + (Math.random() - 0.5) * 0.8);
    // α around 10, range 8–12 (typical alpha band).
    const alphaVal = Math.round(10 + 1.6 * Math.sin(t / 9) + 0.8 * Math.sin(t / 3.1) + (Math.random() - 0.5) * 0.6);
    if (betaNum.textContent !== String(betaVal))  betaNum.textContent = betaVal;
    if (alphaNum.textContent !== String(alphaVal)) alphaNum.textContent = alphaVal;
    igSetIafMarker(alphaVal);   // slide the IAF-graph marker with the live α

    // Drive the derivation cells off the current α value. iafMu()
    // (defined later, hoisted) is the same coefficient curve used on
    // slide 7 so this slide reads as a continuation of that math.
    if (muCell || tempoCell) {
      const muVal    = iafMu(alphaVal);
      const tempoVal = Math.round(DERIVE_HR * DERIVE_M * muVal);
      const muStr    = muVal.toFixed(2);
      const tempoStr = String(tempoVal);
      if (muCell && muCell.textContent !== muStr)         muCell.textContent    = muStr;
      if (tempoCell && tempoCell.textContent !== tempoStr) tempoCell.textContent = tempoStr;
    }
  }

  // Wait for the schematic cadence to land on the canonical values
  // first (~3s), then begin drifting so the audience sees 20 / 10 for
  // long enough to register them as the baseline.
  setTimeout(() => {
    if (driftIntervalId === null && state.currentIndex === SLIDE_DEMO_INDEX) {
      driftIntervalId = setInterval(tick, 700);
      tick();
    }
  }, 3500);
}

function stopBiomarkerDrift() {
  if (driftIntervalId !== null) {
    clearInterval(driftIntervalId);
    driftIntervalId = null;
  }
  // Reset to canonical values so re-entry begins from baseline before
  // drifting again.
  const slide = slides[SLIDE_DEMO_INDEX];
  if (!slide) return;
  const betaNum = slide.querySelector('.schematic-beta .num');
  const alphaNum = slide.querySelector('.schematic-alpha .num');
  if (betaNum)  betaNum.textContent = '20';
  if (alphaNum) alphaNum.textContent = '10';
  const muCell    = slide.querySelector('[data-derive="mu"]');
  const tempoCell = slide.querySelector('[data-derive="tempo"]');
  if (muCell)    muCell.textContent    = '1.00';
  if (tempoCell) tempoCell.textContent = '160';
}

/* === Demo-slide whispers ============================================
   Past phrases from the deck surface one-at-a-time at low opacity in
   one of six positioned slots (corners + sides). Each whisper runs a
   single 9.5s fade-in/hold/fade-out CSS cycle, then is cleared. The
   loop schedules the next whisper at a randomised 4–8s gap so the
   cadence reads as ambient memory rather than a metronome.

   Stops on slide leave (clearTimeout + stripping whisper-active from
   any in-flight element) so phrases don't bleed into the next slide.
   Skipped under prefers-reduced-motion. */
const SLIDE_DEMO_INDEX = 8;

const WHISPER_PHRASES = [
  'time is everything',
  'moves to their own beat',
  'what does your time sound like?',
  'it starts with a pulse',
  'a 1 of 1',
  'you set the pace',
  'your perspective makes a difference',
  'the body keeps many clocks',
  'we hear you',
  '我們聽見你了',
  'meets you where you\'re at',
];

let whisperTimeoutId = null;
let whisperPhraseQueue = [];

function shuffleWhispers() {
  return [...WHISPER_PHRASES].sort(() => Math.random() - 0.5);
}

function startWhispers() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  stopWhispers(); // Clear any prior state before starting fresh.

  const slide = slides[SLIDE_DEMO_INDEX];
  if (!slide) return;
  const whisperEls = [...slide.querySelectorAll('.whisper')];
  if (!whisperEls.length) return;

  whisperPhraseQueue = shuffleWhispers();

  function pickIdle() {
    return whisperEls.filter((el) => !el.classList.contains('whisper-active'));
  }

  function nextWhisper() {
    const idle = pickIdle();
    if (idle.length === 0) {
      // All slots in flight — try again shortly.
      whisperTimeoutId = setTimeout(nextWhisper, 1500);
      return;
    }

    if (whisperPhraseQueue.length === 0) {
      whisperPhraseQueue = shuffleWhispers();
    }
    const phrase = whisperPhraseQueue.shift();
    const el = idle[Math.floor(Math.random() * idle.length)];
    el.textContent = phrase;
    el.classList.add('whisper-active');

    // Match the CSS animation duration. Element returns to the idle
    // pool after this so it can be picked again later.
    setTimeout(() => {
      el.classList.remove('whisper-active');
      el.textContent = '';
    }, 9600);

    // Stagger the next entry so two whispers may briefly co-exist
    // but never appear simultaneously. 4–8s feels like memory drift.
    const nextGap = 4000 + Math.random() * 4000;
    whisperTimeoutId = setTimeout(nextWhisper, nextGap);
  }

  // Wait for the schematic cadence to land (~3s) before whispers begin
  // so the slide's payload is read first.
  whisperTimeoutId = setTimeout(nextWhisper, 5500);
}

function stopWhispers() {
  if (whisperTimeoutId !== null) {
    clearTimeout(whisperTimeoutId);
    whisperTimeoutId = null;
  }
  const slide = slides[SLIDE_DEMO_INDEX];
  if (!slide) return;
  slide.querySelectorAll('.whisper').forEach((el) => {
    el.classList.remove('whisper-active');
    el.textContent = '';
  });
}

/* === Slide 6 (IAF) continuous loop ==================================
   Replaces the earlier frequency-modulation-only wave with a full
   IAF-driven loop: IAF sweeps 8→13→8 over a 24s cosine cycle, the
   wave's cycle count tracks instantaneous IAF, phase drift scales
   with IAF, and the four live readouts (HR / IAF / μ / Tempo)
   underneath update each frame.

   HR is stipulated as 80 BPM on this slide — the focus is the
   IAF-driven modulation, not HR. The formula is Tempo = HR × 2 × μ,
   where the ×2 is the walking stride:pulse factor carried over from
   slide 5, and μ = (IAF₀ / IAF)^β is the IAF factor — exactly the
   dashboard's biomarker term. Higher alpha than the IAF₀ baseline pulls
   μ below 1 and eases the tempo (matching the clocks demo: faster
   sampling → time feels slower); lower alpha lifts it.
   (Naming: slide 5 uses α for the state/HR modulation; this slide
   uses μ — "mu" — for the IAF-driven modulation to keep the two
   distinct. The α label on the wave glyph itself refers to the
   alpha brain rhythm, not the formula coefficient.)

   iafMu() is kept as a plain top-level function so it can be
   swapped for a log-frequency curve later without touching the loop.
   ===================================================================== */
const SLIDE_6_INDEX = 6;

const IAF_LOOP_MS      = 24000;
const IAF_MIN          = 8.0;
const IAF_MAX          = 13.0;
const IAF_BASELINE_HZ  = 10.0;   // personal baseline α — the μ = 1 pivot (the dashboard's IAF₀)
const IAF_MU_BETA      = 1.0;    // strength exponent (the dashboard's β)
const IAF_HR_FIXED     = 80;

const IAF_WAVE_X_START   = 220;
const IAF_WAVE_X_END     = 580;
const IAF_WAVE_Y_CENTER  = 160;
const IAF_WAVE_AMPLITUDE = 14;
const IAF_WAVE_SAMPLES   = 90;

// Drift rate at IAF=10 ≈ 0.5 cycles/sec across the band — visible
// motion, far slower than literal 8–13 Hz (which would smear).
const IAF_DRIFT_RATE   = 0.32;

function iafMu(iaf) {
  // μ = (IAF₀ / IAF)^β — the same IAF factor the dashboard applies. Higher
  // alpha than the baseline pulls μ below 1 (the tempo eases); lower lifts it.
  const clamped = Math.max(IAF_MIN, Math.min(IAF_MAX, iaf));
  return Math.pow(IAF_BASELINE_HZ / clamped, IAF_MU_BETA);
}

function iafTempo(hr, iaf) {
  // HR × m × μ — the same composed form as the dashboard. m is the fixed
  // walking step-rate coupling carried over from the gait slide.
  return hr * WALK_M * iafMu(iaf);
}

function iafCurrentIAF(loopT) {
  const s = (1 - Math.cos(2 * Math.PI * loopT)) / 2;
  return IAF_MIN + (IAF_MAX - IAF_MIN) * s;
}

let iafAnimationId = null;
let iafStartTime = null;
let iafLastFrame = null;
let iafPhase = 0;
let iafLastIAFTxt = '';
let iafLastMuTxt = '';
let iafLastTempoTxt = '';

function iafPaintWave(wavePath, iaf, phase) {
  const span = IAF_WAVE_X_END - IAF_WAVE_X_START;
  const dx   = span / IAF_WAVE_SAMPLES;
  let d = 'M ' + IAF_WAVE_X_START + ' ' + IAF_WAVE_Y_CENTER;
  for (let i = 1; i <= IAF_WAVE_SAMPLES; i++) {
    const x      = IAF_WAVE_X_START + i * dx;
    const xPrev  = IAF_WAVE_X_START + (i - 1) * dx;
    const xMid   = (xPrev + x) / 2;
    const tMid   = (xMid - IAF_WAVE_X_START) / span;
    const tEnd   = (x    - IAF_WAVE_X_START) / span;
    const yMid   = IAF_WAVE_Y_CENTER + IAF_WAVE_AMPLITUDE * Math.sin(tMid * iaf * 2 * Math.PI + phase);
    const yEnd   = IAF_WAVE_Y_CENTER + IAF_WAVE_AMPLITUDE * Math.sin(tEnd * iaf * 2 * Math.PI + phase);
    d += ' Q ' + xMid.toFixed(2) + ' ' + yMid.toFixed(2) + ', ' + x.toFixed(2) + ' ' + yEnd.toFixed(2);
  }
  wavePath.setAttribute('d', d);
}

function iafPaintFormula(slide, iaf) {
  const m = iafMu(iaf);
  const t = iafTempo(IAF_HR_FIXED, iaf);
  const iafStr   = iaf.toFixed(1);
  const muStr    = m.toFixed(2);
  const tempoStr = Math.round(t).toString();

  if (iafStr !== iafLastIAFTxt) {
    const el = slide.querySelector('[data-iaf-val="iaf"]');
    if (el) el.textContent = iafStr;
    iafLastIAFTxt = iafStr;
  }
  if (muStr !== iafLastMuTxt) {
    const el = slide.querySelector('[data-iaf-val="mu"]');
    if (el) el.textContent = muStr;
    iafLastMuTxt = muStr;
  }
  if (tempoStr !== iafLastTempoTxt) {
    const el = slide.querySelector('[data-iaf-val="tempo"]');
    if (el) el.textContent = tempoStr;
    iafLastTempoTxt = tempoStr;
  }
}

function startIAFLoop() {
  stopIAFLoop();

  const slide = slides[SLIDE_6_INDEX];
  if (!slide) return;
  const wavePath = slide.querySelector('#iaf-wave');
  if (!wavePath) return;

  // HR is static on this slide; paint once.
  const hrEl = slide.querySelector('[data-iaf-val="hr"]');
  if (hrEl) hrEl.textContent = IAF_HR_FIXED.toString();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const midIAF = (IAF_MIN + IAF_MAX) / 2;
    iafPaintWave(wavePath, midIAF, 0);
    iafPaintFormula(slide, midIAF);
    return;
  }

  iafStartTime = null;
  iafLastFrame = null;
  iafPhase = 0;

  // Paint t=0 immediately so the slide doesn't flash with the seed
  // <path d="M 220 160 L 580 160"> placeholder for one frame.
  iafPaintWave(wavePath, IAF_MIN, 0);
  iafPaintFormula(slide, IAF_MIN);

  function frame(now) {
    if (iafStartTime === null) {
      iafStartTime = now;
      iafLastFrame = now;
    }
    const dt = Math.min(0.1, (now - iafLastFrame) / 1000);
    iafLastFrame = now;

    const loopT = ((now - iafStartTime) % IAF_LOOP_MS) / IAF_LOOP_MS;
    const iaf   = iafCurrentIAF(loopT);

    // Drift integrated from instantaneous IAF — higher IAF actually
    // drifts faster, so the wave "feels" the frequency change.
    iafPhase += iaf * IAF_DRIFT_RATE * dt;

    iafPaintWave(wavePath, iaf, iafPhase);
    iafPaintFormula(slide, iaf);

    iafAnimationId = window.requestAnimationFrame(frame);
  }

  iafAnimationId = window.requestAnimationFrame(frame);
}

function stopIAFLoop() {
  if (iafAnimationId !== null) {
    cancelAnimationFrame(iafAnimationId);
    iafAnimationId = null;
  }
  iafPhase = 0;
  iafStartTime = null;
  iafLastFrame = null;
  iafLastIAFTxt = '';
  iafLastMuTxt = '';
  iafLastTempoTxt = '';
}

/* === IAF frame-rate clocks (intermediate reveal) ====================
   The IAF slide has one intermediate step: a forward keypress reveals
   two clocks in place of the wave visual + quote, demonstrating the
   INVERSE relationship — a higher perceptual frame rate makes the world
   feel SLOWER (the slow-motion-camera / time-dilation effect), not
   faster.

   Both clocks render the same idea (a sweeping hand), but:
     · the HIGH-fps clock turns slowly + smoothly, finely sampled (a
       dense tick ring with the lit tick gliding) — the moment stretched
       out, every slice caught.
     · the LOW-fps clock whips around fast, snapping at a low sample rate
       (choppy) with a short motion-blur ghost-trail — the moment a blur
       that's gone before you've grasped it.

   Both clocks share ONE lap time (data-rev-ms), start at 12 together and
   meet at 12 together every lap — so the same real time always passes.
   The only variable is the frame rate (data-fps): the low clock (12)
   stutters and feels faster, the high clock (120) glides and feels
   slower. Revealed in two steps — low clock (left) first, then the high
   clock (right) beside it; a third forward press advances. No on-screen
   numbers (narrated 12 vs 120).

   Built lazily on first reveal, animated by rAF while shown, paused when
   hidden, reset whenever the slide is entered or left. */
const IAF_CLOCK_SVG_NS = 'http://www.w3.org/2000/svg';
const IAF_CLOCK_CX = 110, IAF_CLOCK_CY = 110;
const IAF_CLOCK_R_TICK_IN = 78, IAF_CLOCK_R_TICK_OUT = 90;
const IAF_CLOCK_R_HAND = 64, IAF_CLOCK_R_DOT = 84;

let iafStep = 0;                 // 0 none · 1 left/low · 2 both
let iafClocks = null;            // built clock descriptors, or null until first reveal
let iafClockAnimId = null;

function buildIAFClock(svg) {
  const n      = parseInt(svg.dataset.ticks, 10) || 12;
  const revMs  = parseFloat(svg.dataset.revMs) || 1000;
  const fps    = parseFloat(svg.dataset.fps) || 60;
  const ghosts = parseInt(svg.dataset.ghosts, 10) || 0;
  const kind   = svg.dataset.role === 'low' ? 'low' : 'high';

  // Tick ring — density encodes how finely this clock samples.
  const ticksGroup = document.createElementNS(IAF_CLOCK_SVG_NS, 'g');
  const ticks = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n * 360 - 90) * Math.PI / 180;   // i=0 at 12 o'clock
    const line = document.createElementNS(IAF_CLOCK_SVG_NS, 'line');
    line.setAttribute('x1', (IAF_CLOCK_CX + IAF_CLOCK_R_TICK_IN  * Math.cos(a)).toFixed(2));
    line.setAttribute('y1', (IAF_CLOCK_CY + IAF_CLOCK_R_TICK_IN  * Math.sin(a)).toFixed(2));
    line.setAttribute('x2', (IAF_CLOCK_CX + IAF_CLOCK_R_TICK_OUT * Math.cos(a)).toFixed(2));
    line.setAttribute('y2', (IAF_CLOCK_CY + IAF_CLOCK_R_TICK_OUT * Math.sin(a)).toFixed(2));
    line.setAttribute('class', 'tick');
    ticksGroup.appendChild(line);
    ticks.push(line);
  }
  svg.appendChild(ticksGroup);

  // Motion-blur ghost-trail (low-fps clock only) — drawn under the hand,
  // smearing back across the arc the hand jumped between samples.
  const ghostEls = [];
  for (let i = 0; i < ghosts; i++) {
    const g = document.createElementNS(IAF_CLOCK_SVG_NS, 'line');
    g.setAttribute('x1', IAF_CLOCK_CX); g.setAttribute('y1', IAF_CLOCK_CY);
    g.setAttribute('x2', IAF_CLOCK_CX); g.setAttribute('y2', IAF_CLOCK_CY - IAF_CLOCK_R_HAND);
    g.setAttribute('class', 'hand hand-ghost');
    g.style.opacity = (0.16 * (1 - i / ghosts)).toFixed(3);
    svg.appendChild(g);
    ghostEls.push(g);
  }

  const hand = document.createElementNS(IAF_CLOCK_SVG_NS, 'line');
  hand.setAttribute('x1', IAF_CLOCK_CX); hand.setAttribute('y1', IAF_CLOCK_CY);
  hand.setAttribute('x2', IAF_CLOCK_CX); hand.setAttribute('y2', IAF_CLOCK_CY - IAF_CLOCK_R_HAND);
  hand.setAttribute('class', 'hand');
  svg.appendChild(hand);

  const dot = document.createElementNS(IAF_CLOCK_SVG_NS, 'circle');
  dot.setAttribute('r', '5'); dot.setAttribute('class', 'sample-dot');
  svg.appendChild(dot);

  const hub = document.createElementNS(IAF_CLOCK_SVG_NS, 'circle');
  hub.setAttribute('cx', IAF_CLOCK_CX); hub.setAttribute('cy', IAF_CLOCK_CY); hub.setAttribute('r', '4.5');
  hub.setAttribute('class', 'hub');
  svg.appendChild(hub);

  // Ambient warm/cool wash behind the dial — tints the felt speed without
  // recolouring the dial itself. Inserted first so it sits behind all.
  const wash = document.createElementNS(IAF_CLOCK_SVG_NS, 'ellipse');
  wash.setAttribute('cx', IAF_CLOCK_CX); wash.setAttribute('cy', IAF_CLOCK_CY);
  wash.setAttribute('rx', '104'); wash.setAttribute('ry', '104');
  wash.setAttribute('class', 'iaf-wash');
  svg.insertBefore(wash, svg.firstChild);

  // The racing lane for this clock lives in a separate full-width element
  // (.iaf-tracks), wired up in ensureIAFClocksBuilt — see trackRow etc.
  return {
    n, revMs, baseFps: fps, kind, ghostCount: ghosts, el: svg,
    hand, dot, ghostEls, ticks, lastTickIdx: -1,
    trackRow: null, trackMarker: null, trackGhosts: [],
  };
}

// Build the ghost dots for a lane (low-fps lanes get a short trail), and
// return its marker + ghosts. Ghosts are inserted before the marker so it
// draws on top.
function buildIAFLane(row, ghosts) {
  const marker = row.querySelector('.iaf-track-marker');
  const trackGhosts = [];
  for (let i = 0; i < ghosts; i++) {
    const g = document.createElement('span');
    g.className = 'iaf-track-marker iaf-track-marker-ghost';
    g.style.opacity = (0.16 * (1 - i / ghosts)).toFixed(3);
    row.insertBefore(g, marker);
    trackGhosts.push(g);
  }
  return { marker, trackGhosts };
}

function setHandAngle(el, angle) {
  el.setAttribute('transform', `rotate(${angle.toFixed(2)} ${IAF_CLOCK_CX} ${IAF_CLOCK_CY})`);
}

function renderIAFClock(clock, now) {
  // Both clocks share one lap time (clock.revMs) and meet at the lap line
  // together; only the frame rate differs (low = choppy, high = smooth).
  const fps = clock.baseFps;
  const stepMs = 1000 / fps;
  const sampleNow = Math.floor(now / stepMs) * stepMs;   // sample on the fps grid
  const angle = ((sampleNow / clock.revMs) * 360) % 360;

  setHandAngle(clock.hand, angle);

  // Ghost-trail smears back across the arc skipped since the last sample.
  if (clock.ghostEls.length) {
    const jumpDeg = (stepMs / clock.revMs) * 360;
    const span = Math.min(jumpDeg, 90);             // cap so a fast spin can't wrap
    for (let i = 0; i < clock.ghostEls.length; i++) {
      const frac = (i + 1) / (clock.ghostEls.length + 1);
      setHandAngle(clock.ghostEls[i], angle - span * frac);
    }
  }

  const a = (angle - 90) * Math.PI / 180;
  clock.dot.setAttribute('cx', (IAF_CLOCK_CX + IAF_CLOCK_R_DOT * Math.cos(a)).toFixed(2));
  clock.dot.setAttribute('cy', (IAF_CLOCK_CY + IAF_CLOCK_R_DOT * Math.sin(a)).toFixed(2));

  const tickIdx = Math.round(angle / 360 * clock.n) % clock.n;
  if (tickIdx !== clock.lastTickIdx) {
    if (clock.lastTickIdx >= 0) clock.ticks[clock.lastTickIdx].classList.remove('tick-active');
    clock.ticks[tickIdx].classList.add('tick-active');
    clock.lastTickIdx = tickIdx;
  }

  // Racing lane — same phase as the hand, mapped to the full-width lane
  // as a left percentage. Resets to 0 at each lap line, so both markers
  // finish together.
  const phase = (sampleNow % clock.revMs) / clock.revMs;
  if (clock.trackMarker) {
    clock.trackMarker.style.left = (phase * 100).toFixed(2) + '%';
    if (clock.trackGhosts.length) {
      const spanFrac = Math.min(stepMs / clock.revMs, 1);
      for (let i = 0; i < clock.trackGhosts.length; i++) {
        const frac = (i + 1) / (clock.trackGhosts.length + 1);
        const gp = Math.max(0, phase - spanFrac * frac);
        clock.trackGhosts[i].style.left = (gp * 100).toFixed(2) + '%';
      }
    }
  }
}

function ensureIAFClocksBuilt() {
  if (iafClocks) return;
  const container = document.getElementById('iaf-clocks');
  if (!container) return;
  iafClocks = [...container.querySelectorAll('.iaf-clock-face')].map(buildIAFClock);

  // Wire each clock to its full-width racing lane (matched by role).
  iafClocks.forEach((c) => {
    const row = container.querySelector(`.iaf-track-row[data-role="${c.kind}"]`);
    if (!row) return;
    const lane = buildIAFLane(row, c.ghostCount);
    c.trackRow = row;
    c.trackMarker = lane.marker;
    c.trackGhosts = lane.trackGhosts;
  });

}

function iafClocksFrame(now) {
  // All built clocks advance off the same clock so they stay in lockstep;
  // not-yet-revealed ones update invisibly (opacity 0) and so are already
  // in sync when they fade in.
  for (const c of iafClocks) renderIAFClock(c, now);
  iafClockAnimId = window.requestAnimationFrame(iafClocksFrame);
}

// Step machine: 0 = none, 1 = left/low clock, 2 = both. Drives the
// wave/quote fade-out, the per-clock fade-in, and the animation loop.
function setIAFStep(step) {
  const slide = slides[SLIDE_6_INDEX];
  const container = document.getElementById('iaf-clocks');
  if (!slide || !container) return;
  const clamped = Math.max(0, Math.min(2, step));
  if (clamped >= 1) ensureIAFClocksBuilt();
  iafStep = clamped;

  // Wave + quote step aside (and the backdrop shows) whenever a clock is up.
  slide.classList.toggle('iaf-clocks-active', clamped >= 1);
  container.setAttribute('aria-hidden', clamped >= 1 ? 'false' : 'true');

  // Reveal the clocks + lanes up to the current step — low first, then high.
  if (iafClocks) {
    iafClocks.forEach((c, i) => {
      const shown = i < clamped;
      c.el.classList.toggle('is-shown', shown);
      if (c.trackRow) c.trackRow.classList.toggle('is-shown', shown);
    });
  }

  if (clamped === 0) {
    if (iafClockAnimId !== null) {
      cancelAnimationFrame(iafClockAnimId);
      iafClockAnimId = null;
    }
    return;
  }

  // Respect reduced-motion: hold a static snapshot.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    if (iafClocks) iafClocks.forEach((c) => renderIAFClock(c, 0));
    return;
  }
  if (iafClockAnimId === null) {
    iafClockAnimId = window.requestAnimationFrame(iafClocksFrame);
  }
}

// Used by setSlide on entry/leave to reset the step machine.
function hideIAFClocks() {
  setIAFStep(0);
}

/* === Slide 5 gait loop ==============================================
   A continuous 20s oscillation of HR and STEP RATE. Both sweep once per
   loop (cosine, seam-matched at t=0/t=1): HR drifts gently while SPM
   sweeps wider, so r = SPM/HR — and the coupling m = rtdMultiplier(HR,
   SPM) — visibly climbs as the pace picks up. Tempo = HR × m, the same
   math the dashboard uses. Footsteps land at the STEP rate (one print
   per step) so the band speeds up and slows with SPM. The live HR / SPM
   / m / Tempo values in the formula block are written each frame, gated
   against the last value so the DOM doesn't churn unnecessarily.
   ===================================================================== */
const SLIDE_GAIT_INDEX = 5;

const GAIT_LOOP_MS      = 20000;
const GAIT_HR_MIN       = 74;    // gentle pulse drift; step rate is the focus here
const GAIT_HR_MAX       = 86;
const GAIT_SPM_MIN      = 90;    // step-rate sweep: brisk walk → jog
const GAIT_SPM_MAX      = 180;
const GAIT_MAX_PRINTS   = 14;
const GAIT_BAND_LEFT    = 90;   // SVG x of leftmost slot in the 1200-wide band
const GAIT_BAND_RIGHT   = 1110;
const GAIT_BAND_MID_Y   = 100;
const GAIT_STEP_OFFSET  = 11;   // L above / R below the dashed centerline
const GAIT_LEAVE_MS     = 360;

// Tempo = HR × m, where m = rtdMultiplier(HR, SPM) — the dashboard's coupling.
function gaitTempo(hr, spm) {
  return hr * rtdMultiplier(hr, spm);
}

// Full cosine cycle over the loop — apex at t=0.5, derivatives zero
// at t=0 and t=1 so the seam is invisible.
function gaitCurrentHR(loopT) {
  const s = (1 - Math.cos(2 * Math.PI * loopT)) / 2;
  return GAIT_HR_MIN + (GAIT_HR_MAX - GAIT_HR_MIN) * s;
}

// Step rate sweeps in phase with HR but over a wider span, so r = SPM/HR — and
// therefore the coupling m — visibly climbs as the pace picks up.
function gaitCurrentSPM(loopT) {
  const s = (1 - Math.cos(2 * Math.PI * loopT)) / 2;
  return GAIT_SPM_MIN + (GAIT_SPM_MAX - GAIT_SPM_MIN) * s;
}

let gaitAnimationId = null;
let gaitQueue = [];
let gaitNextId = 0;
let gaitStartTime = null;
let gaitLastFrame = null;
let gaitPhase = 0;
let gaitLastHRTxt = '';
let gaitLastSpmTxt = '';
let gaitLastMultTxt = '';
let gaitLastTempoTxt = '';

function gaitSlotX(slotIdx) {
  const denom = Math.max(1, GAIT_MAX_PRINTS - 1);
  return GAIT_BAND_LEFT + (slotIdx / denom) * (GAIT_BAND_RIGHT - GAIT_BAND_LEFT);
}

function gaitRepositionAll() {
  const N = gaitQueue.length;
  const startSlot = GAIT_MAX_PRINTS - N;
  for (let i = 0; i < N; i++) {
    const fs = gaitQueue[i];
    const slot = startSlot + i;
    const x = gaitSlotX(slot);
    const y = GAIT_BAND_MID_Y + ((fs.id % 2 === 0) ? -GAIT_STEP_OFFSET : GAIT_STEP_OFFSET);
    fs.el.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y + ')');
  }
}

function gaitMakeFootstep(id, layer) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(SVG_NS, 'g');
  g.classList.add('gait-footstep');
  g.dataset.id = id;
  g.dataset.side = (id % 2 === 0) ? 'L' : 'R';

  // Horizontal oval: long axis = walking direction, viewed from above.
  const ellipse = document.createElementNS(SVG_NS, 'ellipse');
  ellipse.setAttribute('class', 'gait-footstep-print');
  ellipse.setAttribute('rx', '13');
  ellipse.setAttribute('ry', '7');
  g.appendChild(ellipse);
  layer.appendChild(g);
  return g;
}

function gaitSpawnFootstep(layer) {
  const id = gaitNextId++;
  const el = gaitMakeFootstep(id, layer);
  gaitQueue.push({ el: el, id: id });
  gaitRepositionAll();

  if (gaitQueue.length > GAIT_MAX_PRINTS) {
    const oldest = gaitQueue.shift();
    oldest.el.classList.add('leaving');
    gaitRepositionAll();
    window.setTimeout(function () {
      if (oldest.el.parentNode) oldest.el.parentNode.removeChild(oldest.el);
    }, GAIT_LEAVE_MS);
  }
}

function gaitPaintFormula(slide, hr, spm) {
  const m = rtdMultiplier(hr, spm);
  const t = hr * m;
  const hrStr    = Math.round(hr).toString();
  const spmStr   = Math.round(spm).toString();
  const mStr     = m.toFixed(2);
  const tempoStr = Math.round(t).toString();

  if (hrStr !== gaitLastHRTxt) {
    const el = slide.querySelector('[data-gait-val="hr"]');
    if (el) el.textContent = hrStr;
    gaitLastHRTxt = hrStr;
  }
  if (spmStr !== gaitLastSpmTxt) {
    const el = slide.querySelector('[data-gait-val="spm"]');
    if (el) el.textContent = spmStr;
    gaitLastSpmTxt = spmStr;
  }
  if (mStr !== gaitLastMultTxt) {
    const el = slide.querySelector('[data-gait-val="mult"]');
    if (el) el.textContent = mStr;
    gaitLastMultTxt = mStr;
  }
  if (tempoStr !== gaitLastTempoTxt) {
    const el = slide.querySelector('[data-gait-val="tempo"]');
    if (el) el.textContent = tempoStr;
    gaitLastTempoTxt = tempoStr;
  }
}

function startGaitLoop() {
  stopGaitLoop();

  const slide = slides[SLIDE_GAIT_INDEX];
  if (!slide) return;
  const layer = slide.querySelector('.gait-footstep-layer');
  if (!layer) return;

  // Reduced motion: paint a single static snapshot at the loop midpoint
  // and skip the rAF loop entirely. The CSS @media block makes the
  // prints render at their target opacity without the entry animation.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (let i = 0; i < GAIT_MAX_PRINTS; i++) gaitSpawnFootstep(layer);
    gaitPaintFormula(slide, WALK_HR, WALK_SPM);
    return;
  }

  gaitStartTime = null;
  gaitLastFrame = null;
  gaitPhase = 0;

  // Seed a few prints so the band reads as mid-stride from t=0
  // rather than empty for the first second.
  for (let i = 0; i < 4; i++) gaitSpawnFootstep(layer);

  function frame(now) {
    if (gaitStartTime === null) {
      gaitStartTime = now;
      gaitLastFrame = now;
    }
    const dt = Math.min(0.1, (now - gaitLastFrame) / 1000);
    gaitLastFrame = now;

    const loopT = ((now - gaitStartTime) % GAIT_LOOP_MS) / GAIT_LOOP_MS;
    const hr    = gaitCurrentHR(loopT);
    const spm   = gaitCurrentSPM(loopT);

    // Footsteps land at the STEP rate now (one print per step), so the band
    // visibly speeds up and slows with SPM.
    gaitPhase += (spm / 60) * dt;
    while (gaitPhase >= 1) {
      gaitSpawnFootstep(layer);
      gaitPhase -= 1;
    }

    gaitPaintFormula(slide, hr, spm);

    gaitAnimationId = window.requestAnimationFrame(frame);
  }

  gaitAnimationId = window.requestAnimationFrame(frame);
}

function stopGaitLoop() {
  if (gaitAnimationId !== null) {
    cancelAnimationFrame(gaitAnimationId);
    gaitAnimationId = null;
  }
  // Drain the print queue + clear the layer so re-entry begins fresh
  // instead of inheriting a half-full band from the previous visit.
  const slide = slides[SLIDE_GAIT_INDEX];
  if (slide) {
    const layer = slide.querySelector('.gait-footstep-layer');
    if (layer) while (layer.firstChild) layer.removeChild(layer.firstChild);
  }
  gaitQueue = [];
  gaitNextId = 0;
  gaitPhase = 0;
  gaitStartTime = null;
  gaitLastFrame = null;
  gaitLastHRTxt = '';
  gaitLastSpmTxt = '';
  gaitLastMultTxt = '';
  gaitLastTempoTxt = '';
}

/* === Slide 8 (bloom) music lane =====================================
   The synthesis slide's centerpiece — a beat lane that enacts the
   slide's thesis: "Time isn't measured. It's composed." A strict,
   evenly-spaced metronome grid (measured) sits behind noteheads that
   swing off it and subdivide (composed). A slow tension cycle — read it
   as stress / beta power rising and settling — drives how finely each
   beat subdivides (quarters → eighths → sixteenths); a breath cycle
   drives how far the offbeats swing; an accent on every third sixteenth
   paints a 3-over-4 cross-rhythm (tempos within the tempo). A playhead
   sweeps the lane and strikes each note it passes.

   Lazily built on first entry, animated by rAF while slide 8 is active,
   stopped on leave, static snapshot under reduced motion — mirroring
   the gait / IAF loop lifecycle.
   ===================================================================== */
const SLIDE_BLOOM_INDEX = 7;

const BLOOM_NS = 'http://www.w3.org/2000/svg';
const BLOOM_X0 = 60, BLOOM_X1 = 940, BLOOM_Y = 78;
const BLOOM_BEATS = 4;
const BLOOM_FINE  = 4;                              // sixteenth grid: 4 slots / beat
const BLOOM_SLOTS = BLOOM_BEATS * BLOOM_FINE;       // 16 slots across the lane
const BLOOM_LOOP_MS     = 16000;                    // tension rise/fall cycle
const BLOOM_BREATH_MS   = 5200;                     // swing breathing cycle
const BLOOM_PLAYHEAD_MS = 4000;                     // one playhead sweep
const BLOOM_SWING_MAX   = 0.38;                     // peak swing, fraction of a slot

let bloomBuilt = false;
let bloomNotes = [];
let bloomPlayhead = null;
let bloomAnimId = null;
let bloomStart = null;

function bloomSlotX(i) {
  return BLOOM_X0 + (i + 0.5) * ((BLOOM_X1 - BLOOM_X0) / BLOOM_SLOTS);
}

function bloomSmoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// How "present" a slot is at a given tension. Main beats are always on;
// eighth offbeats bloom in at mid tension; sixteenths at high tension.
function bloomActivation(i, tension) {
  if (i % BLOOM_FINE === 0) return 1;                            // downbeats
  if (i % 2 === 0) return bloomSmoothstep(0.20, 0.46, tension);  // eighth offbeats
  return bloomSmoothstep(0.54, 0.82, tension);                   // sixteenths
}

function buildBloomLane() {
  if (bloomBuilt) return;
  const slide = slides[SLIDE_BLOOM_INDEX];
  if (!slide) return;
  const grid = slide.querySelector('.bloom-grid');
  const notesG = slide.querySelector('.bloom-notes');
  bloomPlayhead = slide.querySelector('.bloom-playhead');
  if (!grid || !notesG) return;

  // Strict metronome grid — one faint tick per slot; beat ticks darker.
  for (let i = 0; i < BLOOM_SLOTS; i++) {
    const x = bloomSlotX(i);
    const tick = document.createElementNS(BLOOM_NS, 'line');
    tick.setAttribute('x1', x.toFixed(1));
    tick.setAttribute('x2', x.toFixed(1));
    tick.setAttribute('y1', (BLOOM_Y - 9).toFixed(1));
    tick.setAttribute('y2', (BLOOM_Y + 9).toFixed(1));
    tick.setAttribute('class', i % BLOOM_FINE === 0 ? 'bloom-gridline bloom-gridline-beat' : 'bloom-gridline');
    grid.appendChild(tick);
  }

  // Note pool — one notehead + accent wedge per slot.
  bloomNotes = [];
  for (let i = 0; i < BLOOM_SLOTS; i++) {
    const isBeat = i % BLOOM_FINE === 0;
    const g = document.createElementNS(BLOOM_NS, 'g');
    g.setAttribute('class', 'bloom-note' + (isBeat ? ' bloom-note-beat' : ''));

    const head = document.createElementNS(BLOOM_NS, 'ellipse');
    head.setAttribute('rx', isBeat ? '7' : '5.5');
    head.setAttribute('ry', isBeat ? '5' : '4');
    head.setAttribute('class', 'bloom-note-head');
    g.appendChild(head);

    const accent = document.createElementNS(BLOOM_NS, 'path');
    accent.setAttribute('d', 'M -5 -15 L 5 -11 L -5 -7');   // ">" wedge above the note
    accent.setAttribute('class', 'bloom-note-accent');
    accent.style.opacity = '0';
    g.appendChild(accent);

    notesG.appendChild(g);
    bloomNotes.push({ g, head, accent, slot: i, isBeat });
  }

  bloomBuilt = true;
}

function bloomPaint(elapsed) {
  const slotW = (BLOOM_X1 - BLOOM_X0) / BLOOM_SLOTS;
  const loopT = (elapsed % BLOOM_LOOP_MS) / BLOOM_LOOP_MS;
  const tension = (1 - Math.cos(2 * Math.PI * loopT)) / 2;       // 0 → 1 → 0
  const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * (elapsed % BLOOM_BREATH_MS) / BLOOM_BREATH_MS);
  const swing = BLOOM_SWING_MAX * breath * tension;              // only swings once subdivided
  const headX = BLOOM_X0 + ((elapsed % BLOOM_PLAYHEAD_MS) / BLOOM_PLAYHEAD_MS) * (BLOOM_X1 - BLOOM_X0);

  if (bloomPlayhead) {
    bloomPlayhead.setAttribute('transform', 'translate(' + headX.toFixed(1) + ' 0)');
  }

  for (const n of bloomNotes) {
    const act = bloomActivation(n.slot, tension);
    const sw = n.isBeat ? 0 : swing * slotW;
    const x = bloomSlotX(n.slot) + sw;

    // Playhead strike — notes near the head lift + swell briefly.
    const strike = Math.max(0, 1 - Math.abs(x - headX) / (slotW * 1.2)) * act;
    const lift = strike * 7;
    const scale = 1 + strike * 0.45;

    n.g.setAttribute('transform',
      'translate(' + x.toFixed(1) + ' ' + (BLOOM_Y - lift).toFixed(1) + ') scale(' + scale.toFixed(3) + ')');
    n.g.style.opacity = act.toFixed(3);

    // Accent: downbeats always; plus every 3rd slot once sixteenths bloom
    // (a 3-over-4 cross-rhythm — tempos within the tempo).
    const cross = !n.isBeat && (n.slot % 3 === 0) && tension > 0.62;
    n.g.classList.toggle('bloom-note-cross', cross);
    const showAccent = n.isBeat || cross;
    n.accent.style.opacity = showAccent ? (0.45 + 0.55 * strike).toFixed(3) : '0';
  }
}

function bloomPaintStatic() {
  const slotW = (BLOOM_X1 - BLOOM_X0) / BLOOM_SLOTS;
  const tension = 0.5;
  const swing = BLOOM_SWING_MAX * 0.5 * tension;
  for (const n of bloomNotes) {
    const act = bloomActivation(n.slot, tension);
    const sw = n.isBeat ? 0 : swing * slotW;
    const x = bloomSlotX(n.slot) + sw;
    n.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + BLOOM_Y + ')');
    n.g.style.opacity = act.toFixed(3);
    n.accent.style.opacity = n.isBeat ? '0.55' : '0';
    n.g.classList.remove('bloom-note-cross');
  }
}

function startBloomLoop() {
  buildBloomLane();
  if (!bloomBuilt) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Static snapshot at mid-tension — subdivided + gently swung, no sweep.
    if (bloomPlayhead) bloomPlayhead.style.opacity = '0';
    bloomPaintStatic();
    return;
  }

  stopBloomLoop();
  if (bloomPlayhead) bloomPlayhead.style.opacity = '';
  bloomStart = null;

  function frame(now) {
    if (bloomStart === null) bloomStart = now;
    bloomPaint(now - bloomStart);
    bloomAnimId = window.requestAnimationFrame(frame);
  }
  bloomAnimId = window.requestAnimationFrame(frame);
}

function stopBloomLoop() {
  if (bloomAnimId !== null) {
    cancelAnimationFrame(bloomAnimId);
    bloomAnimId = null;
  }
  bloomStart = null;
}

/* === Slide 8 (bloom) staged reveal ==================================
   Toggles the bloom-* classes (styled in styles.css) on a timer so the
   slide builds in 7 beats: bio list → context list → the music lane
   parts them into the stress/mindset rows → connectors → bridges. The
   CSS transitions do the actual motion; this just flips classes.
   Re-runs on each entry; reduced motion / no-JS shows the finished
   composition (the .bloom-animating class is what hides things to start,
   so we simply don't add it under reduced motion). ==================== */
/* The build runs in two halves so the presenter controls the pivot: the
   two lists populate automatically on entry, then the slide HOLDS; a
   forward keypress (see handleKeydown) fires the split/transform — the
   lane parts the lists, the connectors rise, the bridges draw. A back
   press reverses it; a second forward press advances the slide. Mirrors
   the IAF slide's intermediate-step pattern. */
const BLOOM_LIST_STEPS = [          // auto, on entry — the two lists
  [1300, 'bloom-show-bio'],
  [3100, 'bloom-show-context'],
];
const BLOOM_TRANSFORM_STEPS = [     // on the split press — the composition
  [0,    'bloom-parted'],
  [1100, 'bloom-show-connectors'],
  [2100, 'bloom-show-bridges'],
  [3000, 'bloom-show-close'],       // "Time isn't just measured. It's composed." lands last
];
const BLOOM_REVEAL_CLASSES = [
  'bloom-show-bio', 'bloom-show-context', 'bloom-parted',
  'bloom-show-connectors', 'bloom-show-bridges', 'bloom-show-close',
];
let bloomRevealTimers = [];
let bloomTransformTimers = [];
let bloomStep = 0;                  // 0 = lists shown, awaiting split · 1 = transformed

function clearBloomRevealTimers() {
  bloomRevealTimers.forEach(clearTimeout);
  bloomRevealTimers = [];
}
function clearBloomTransformTimers() {
  bloomTransformTimers.forEach(clearTimeout);
  bloomTransformTimers = [];
}

function resetBloomReveal() {
  clearBloomRevealTimers();
  clearBloomTransformTimers();
  bloomStep = 0;
  const slide = slides[SLIDE_BLOOM_INDEX];
  if (!slide) return;
  slide.classList.remove('bloom-animating', ...BLOOM_REVEAL_CLASSES);
}

function runBloomReveal() {
  const slide = slides[SLIDE_BLOOM_INDEX];
  if (!slide) return;
  clearBloomRevealTimers();
  clearBloomTransformTimers();
  slide.classList.remove(...BLOOM_REVEAL_CLASSES);
  bloomStep = 0;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    slide.classList.remove('bloom-animating');   // finished composition shows
    bloomStep = 1;                               // already composed → presses advance
    return;
  }

  slide.classList.add('bloom-animating');         // hide + merge to start
  for (const [ms, cls] of BLOOM_LIST_STEPS) {     // lists build; the split waits for a press
    bloomRevealTimers.push(window.setTimeout(() => {
      if (state.currentIndex === SLIDE_BLOOM_INDEX) slide.classList.add(cls);
    }, ms));
  }
}

// Forward press on the bloom slide — fire the split/transform cascade.
function bloomSplit() {
  const slide = slides[SLIDE_BLOOM_INDEX];
  if (!slide || bloomStep === 1) return;
  bloomStep = 1;
  // Snap both lists in first, in case the presenter triggers the split
  // before they've finished populating.
  clearBloomRevealTimers();
  slide.classList.add('bloom-show-bio', 'bloom-show-context');
  clearBloomTransformTimers();
  for (const [ms, cls] of BLOOM_TRANSFORM_STEPS) {
    bloomTransformTimers.push(window.setTimeout(() => {
      if (state.currentIndex === SLIDE_BLOOM_INDEX) slide.classList.add(cls);
    }, ms));
  }
}

// Back press on the bloom slide — reverse the split, back to the two lists.
function bloomUnsplit() {
  const slide = slides[SLIDE_BLOOM_INDEX];
  if (!slide || bloomStep === 0) return;
  bloomStep = 0;
  clearBloomTransformTimers();
  slide.classList.remove('bloom-parted', 'bloom-show-connectors', 'bloom-show-bridges');
}

/* === Slide 10 (starmap) faint field =================================
   The background star field — the many other applications RTD could
   touch. Built once; deterministic positions (a tiny seeded PRNG) so it
   renders identically every load. Subtle field-wide redshift: bluer at
   left, redder at right, echoing the three charted stars. ============= */
const SLIDE_STARMAP_INDEX = 9;

function buildStarfield() {
  const slide = slides[SLIDE_STARMAP_INDEX];
  if (!slide) return;
  const field = slide.querySelector('.starmap-field');
  if (!field || field.childElementCount > 0) return;   // build once
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seed = 20260610;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 56; i++) {
    const x = 40 + rnd() * 1520;
    const y = 70 + rnd() * 720;
    const r = (0.6 + rnd() * 1.7).toFixed(2);
    const op = (0.10 + rnd() * 0.26).toFixed(2);
    // field-wide redshift: blue at left, amber mid, red at right
    const tint = x < 600 ? '#5C7FA3' : (x < 1050 ? '#C89B52' : '#B83A36');
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x.toFixed(1));
    c.setAttribute('cy', y.toFixed(1));
    c.setAttribute('r', r);
    c.setAttribute('fill', tint);
    c.setAttribute('opacity', op);
    // Faint twinkle — base opacity exposed as --o so the keyframe can dip
    // each star relative to its own brightness. Skipped under reduced motion.
    c.style.setProperty('--o', op);
    if (!reduced) {
      c.style.animation = `starmap-twinkle ${(3.5 + rnd() * 4).toFixed(1)}s ease-in-out ${(rnd() * 5).toFixed(1)}s infinite`;
    }
    field.appendChild(c);
  }
}

/* Draw the dotted lines downward on entry — the #starmap-reveal clip rect
   grows top→bottom, so the dots appear in sequence (the course charting
   itself). The stars + titles fade in via CSS, timed to the front passing
   each. Reset on leave so re-entry redraws; reduced motion shows it open. */
const STARMAP_DRAW_MS = 3500;
const STARMAP_DRAW_H  = 716;
let starmapDrawId = null;
let starmapDrawStart = null;

function starmapRevealRect() {
  const slide = slides[SLIDE_STARMAP_INDEX];
  return slide ? slide.querySelector('.starmap-reveal-rect') : null;
}

function runStarmapReveal() {
  const rect = starmapRevealRect();
  if (!rect) return;
  if (starmapDrawId !== null) { cancelAnimationFrame(starmapDrawId); starmapDrawId = null; }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    rect.setAttribute('height', STARMAP_DRAW_H);   // fully drawn, no animation
    return;
  }

  rect.setAttribute('height', '0');                // start undrawn
  starmapDrawStart = null;
  function frame(now) {
    if (starmapDrawStart === null) starmapDrawStart = now;
    const t = Math.min(1, (now - starmapDrawStart) / STARMAP_DRAW_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOut
    rect.setAttribute('height', (eased * STARMAP_DRAW_H).toFixed(1));
    starmapDrawId = t < 1 ? requestAnimationFrame(frame) : null;
  }
  starmapDrawId = requestAnimationFrame(frame);
}

function resetStarmapReveal() {
  if (starmapDrawId !== null) { cancelAnimationFrame(starmapDrawId); starmapDrawId = null; }
  const rect = starmapRevealRect();
  if (rect) rect.setAttribute('height', '0');   // collapse so a return redraws
}

/* === Slide 11 (Curation) — listener constellation ===================
   A scattered sky of small stars drifts gently. The blue ones share a
   single pulse — listeners whose physiological response matches yours —
   and after a few seconds they slowly align into a clear direction:
   curation finding your people in the noise and pointing you onward.
   A background layer behind the text. Built once; animated while slide
   11 is active; reduced motion shows the aligned end-state. =========== */
const SLIDE_CURATE_INDEX = 10;   // slide 11 / data-slide-index 10

const CURATE_NS = 'http://www.w3.org/2000/svg';
const CURATE_N = 50;             // total stars in the sky
const CURATE_BLUE = 18;          // how many are matches (blue, shared pulse)
const CURATE_ALIGN_START = 1800; // ms — matches begin to align
const CURATE_ALIGN_END   = 5500; // ms — fully aligned
const CURATE_PULSE_HZ    = 0.42; // shared pulse rate of the matches
// The matches align onto the horizontal title rule (viewBox y=300) and
// FORM it — sitting in the clear band under the title, nothing obscured.
const CURATE_LINE_A = { x: 150, y: 300 };
const CURATE_LINE_B = { x: 1450, y: 300 };
const CURATE_AMP = 22;            // sine amplitude (viewBox units)
const CURATE_CYCLES = 1.6;        // sine cycles across the span
const CURATE_WAVE_PERIOD = 16;    // seconds: the wave sways this slowly
const CURATE_WAVE_SWAY = 1.3;     // radians: how far the phase rocks
const CURATE_K = (2 * Math.PI * CURATE_CYCLES) / (CURATE_LINE_B.x - CURATE_LINE_A.x);

let curateBuilt = false;
let curateStars = [];
let curateLineEl = null;
let curateArrowEl = null;
let curateAnimId = null;
let curateStart = null;
let curateLastFrame = null;

function curateSmooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// The wave the matches form: a slowly swaying sine across the span.
function curateWaveY(x, phase) {
  return CURATE_LINE_A.y + CURATE_AMP * Math.sin(CURATE_K * (x - CURATE_LINE_A.x) + phase);
}
function curateWaveD(phase) {
  const x0 = CURATE_LINE_A.x, x1 = CURATE_LINE_B.x, N = 72;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const x = x0 + (i / N) * (x1 - x0);
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + curateWaveY(x, phase).toFixed(1) + ' ';
  }
  return d;
}

function buildCurateField() {
  if (curateBuilt) return;
  const slide = slides[SLIDE_CURATE_INDEX];
  if (!slide) return;
  const field = slide.querySelector('.curate-field');
  if (!field) return;

  let seed = 71237;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // The dotted title rule — fades in as the matches align onto it, so it
  // reads as formed by them rather than simply drawn.
  curateLineEl = document.createElementNS(CURATE_NS, 'path');
  curateLineEl.setAttribute('class', 'curate-line');
  curateLineEl.setAttribute('d', curateWaveD(0));
  curateLineEl.style.opacity = '0';
  field.appendChild(curateLineEl);

  curateStars = [];
  for (let i = 0; i < CURATE_N; i++) {
    const isBlue = i < CURATE_BLUE;
    const c = document.createElementNS(CURATE_NS, 'circle');
    c.setAttribute('class', isBlue ? 'curate-star curate-star-blue' : 'curate-star');
    field.appendChild(c);
    curateStars.push({
      el: c,
      isBlue,
      sx: 60 + rnd() * 1480,           // scattered start
      sy: 70 + rnd() * 760,
      vx: (rnd() - 0.5) * 16,          // gentle drift, viewBox px/s
      vy: (rnd() - 0.5) * 16,
      baseR: isBlue ? (2.6 + rnd() * 1.3) : (0.8 + rnd() * 1.5),
      baseOp: isBlue ? 0.6 : (0.12 + rnd() * 0.16),
      twRate: 0.5 + rnd() * 1.1,       // neutral twinkle
      twPh: rnd() * Math.PI * 2,
      tx: 0, ty: 0,
    });
  }

  // Distribute the blue matches evenly along the direction vector.
  const blues = curateStars.filter((s) => s.isBlue);
  blues.forEach((s, k) => {
    const f = blues.length > 1 ? k / (blues.length - 1) : 0.5;
    s.tx = CURATE_LINE_A.x + f * (CURATE_LINE_B.x - CURATE_LINE_A.x);
    s.ty = CURATE_LINE_A.y + f * (CURATE_LINE_B.y - CURATE_LINE_A.y);
  });

  curateBuilt = true;
}

function curatePaintStatic() {
  // Aligned end-state (reduced motion): matches on the wave, sky scattered.
  if (curateLineEl) { curateLineEl.setAttribute('d', curateWaveD(0)); curateLineEl.style.opacity = '0.5'; }
  for (const s of curateStars) {
    s.el.setAttribute('cx', (s.isBlue ? s.tx : s.sx).toFixed(1));
    s.el.setAttribute('cy', (s.isBlue ? curateWaveY(s.tx, 0) : s.sy).toFixed(1));
    s.el.setAttribute('r', s.baseR.toFixed(2));
    s.el.style.opacity = s.baseOp.toFixed(3);
  }
}

function startCurateLoop() {
  buildCurateField();
  if (!curateBuilt) return;
  stopCurateLoop();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    curatePaintStatic();
    return;
  }

  curateStart = null;
  curateLastFrame = null;
  function frame(now) {
    if (curateStart === null) { curateStart = now; curateLastFrame = now; }
    const dt = Math.min(0.05, (now - curateLastFrame) / 1000);
    curateLastFrame = now;
    const elapsed = now - curateStart;
    const align = curateSmooth(CURATE_ALIGN_START, CURATE_ALIGN_END, elapsed);
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * CURATE_PULSE_HZ * elapsed / 1000);
    const phase = CURATE_WAVE_SWAY * Math.sin(2 * Math.PI * elapsed / 1000 / CURATE_WAVE_PERIOD);

    for (const s of curateStars) {
      // drift the scatter position, wrapping at the edges
      s.sx += s.vx * dt; s.sy += s.vy * dt;
      if (s.sx < 30) s.sx = 1570; else if (s.sx > 1570) s.sx = 30;
      if (s.sy < 40) s.sy = 860; else if (s.sy > 860) s.sy = 40;

      let x, y, op, r;
      if (s.isBlue) {
        const ty = curateWaveY(s.tx, phase);   // its spot on the swaying wave
        x = s.sx + (s.tx - s.sx) * align;      // ease from drift onto the wave
        y = s.sy + (ty - s.sy) * align;
        op = s.baseOp * (0.55 + 0.45 * pulse); // one shared pulse
        r = s.baseR * (0.85 + 0.3 * pulse);
      } else {
        x = s.sx; y = s.sy;
        const tw = 0.5 + 0.5 * Math.sin(s.twPh + elapsed / 1000 * s.twRate);
        op = s.baseOp * (0.4 + 0.6 * tw);
        r = s.baseR;
      }
      s.el.setAttribute('cx', x.toFixed(1));
      s.el.setAttribute('cy', y.toFixed(1));
      s.el.setAttribute('r', r.toFixed(2));
      s.el.style.opacity = op.toFixed(3);
    }

    // the dotted wave fades in (and keeps swaying) over the back half of
    // the align, as the matches settle onto it
    const lineOp = curateSmooth(0.55, 1.0, align);
    if (curateLineEl) {
      curateLineEl.setAttribute('d', curateWaveD(phase));
      curateLineEl.style.opacity = (lineOp * 0.5).toFixed(3);
    }

    curateAnimId = requestAnimationFrame(frame);
  }
  curateAnimId = requestAnimationFrame(frame);
}

function stopCurateLoop() {
  if (curateAnimId !== null) { cancelAnimationFrame(curateAnimId); curateAnimId = null; }
  curateStart = null;
  curateLastFrame = null;
}

/* === Slide 12 (Therapy) — the line refines ==========================
   The wave from curation is already here; we don't rebuild it. The points
   sit on it from the start. Over a few seconds the frequency climbs (the
   wave tightens and quickens) and some points fade out — fewer points,
   a faster wave. The survivors (and the line) warm from blue to amber as
   curation becomes therapy. Built once; animated while slide 12 is
   active; reduced motion shows the refined end-state. ================= */
const SLIDE_THERAPY_INDEX = 11;
const THERAPY_NS = 'http://www.w3.org/2000/svg';
const THERAPY_POINTS = 18;        // points already on the line (from curation)
const THERAPY_TRANS_START = 1200; // ms before the refining begins
const THERAPY_TRANS_END = 6500;   // ms when fully refined
const THERAPY_AMP = 20;
const THERAPY_CYC0 = 1.6, THERAPY_CYC1 = 2.8;      // frequency increases
const THERAPY_OMEGA0 = 0.4, THERAPY_OMEGA1 = 1.6;  // and the wave quickens
const THERAPY_SWAY = 1.4;         // radians of phase rock
const THERAPY_X0 = 150, THERAPY_X1 = 1450, THERAPY_BASEY = 300;
const THERAPY_PULSE_HZ = 0.5;
const THERAPY_COLD = '#5C7FA3';   // carried-over blue (curation)
const THERAPY_WARM = '#DCA94A';   // points warm to yellow
const THERAPY_AMBER = '#C89B52';  // the line warms to amber

let therapyBuilt = false;
let therapyStars = [];
let therapyWaveEl = null;
let therapyAnimId = null;
let therapyStart = null;
let therapyLastFrame = null;
let therapySway = 0;

function therapySmooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function therapyLerpHex(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}
function therapyWaveYAt(x, k, phase) {
  return THERAPY_BASEY + THERAPY_AMP * Math.sin(k * (x - THERAPY_X0) + phase);
}
function therapyWaveD(k, phase) {
  const N = 84;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const x = THERAPY_X0 + (i / N) * (THERAPY_X1 - THERAPY_X0);
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + therapyWaveYAt(x, k, phase).toFixed(1) + ' ';
  }
  return d;
}
function therapyKFor(prog) {
  const cycles = THERAPY_CYC0 + (THERAPY_CYC1 - THERAPY_CYC0) * prog;
  return (2 * Math.PI * cycles) / (THERAPY_X1 - THERAPY_X0);
}

function buildTherapyField() {
  if (therapyBuilt) return;
  const slide = slides[SLIDE_THERAPY_INDEX];
  if (!slide) return;
  const field = slide.querySelector('.therapy-field');
  if (!field) return;

  let seed = 49157;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  therapyWaveEl = document.createElementNS(THERAPY_NS, 'path');
  therapyWaveEl.setAttribute('class', 'therapy-wave');
  therapyWaveEl.setAttribute('d', therapyWaveD(therapyKFor(0), 0));
  therapyWaveEl.style.opacity = '0.5';   // the line is already here
  field.appendChild(therapyWaveEl);

  therapyStars = [];
  for (let i = 0; i < THERAPY_POINTS; i++) {
    // every third point fades out, so the survivors stay spread along the wave
    const fader = (i % 3 === 1);
    const c = document.createElementNS(THERAPY_NS, 'circle');
    c.setAttribute('class', 'therapy-star');
    c.setAttribute('fill', THERAPY_COLD);   // starts blue, carried from curation
    field.appendChild(c);
    therapyStars.push({
      el: c, fader,
      tx: THERAPY_X0 + (i / (THERAPY_POINTS - 1)) * (THERAPY_X1 - THERAPY_X0),
      baseR: 2.6 + rnd() * 1.2,
      baseOp: 0.62,
      twRate: 0.5 + rnd() * 1.1, twPh: rnd() * Math.PI * 2,
    });
  }

  therapyBuilt = true;
}

function therapyRender(prog, phase, pulse, elapsedS) {
  const k = therapyKFor(prog);
  if (therapyWaveEl) {
    therapyWaveEl.setAttribute('d', therapyWaveD(k, phase));
    therapyWaveEl.setAttribute('stroke', therapyLerpHex(THERAPY_COLD, THERAPY_AMBER, prog));
  }
  for (const s of therapyStars) {
    const y = therapyWaveYAt(s.tx, k, phase);
    s.el.setAttribute('cx', s.tx.toFixed(1));
    s.el.setAttribute('cy', y.toFixed(1));
    s.el.setAttribute('r', (s.baseR * (0.85 + 0.3 * pulse)).toFixed(2));
    if (s.fader) {
      const tw = 0.5 + 0.5 * Math.sin(s.twPh + elapsedS * s.twRate);
      s.el.style.opacity = (s.baseOp * (0.4 + 0.6 * tw) * (1 - prog)).toFixed(3);   // fades out
    } else {
      s.el.setAttribute('fill', therapyLerpHex(THERAPY_COLD, THERAPY_WARM, prog));  // warms to yellow
      s.el.style.opacity = (s.baseOp * (0.62 + 0.38 * pulse)).toFixed(3);
    }
  }
}

function therapyPaintStatic() {
  therapyRender(1, 0, 1, 0);   // refined end-state, no animation
}

function startTherapyLoop() {
  buildTherapyField();
  if (!therapyBuilt) return;
  stopTherapyLoop();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    therapyPaintStatic();
    return;
  }
  therapyStart = null;
  therapyLastFrame = null;
  therapySway = 0;
  function frame(now) {
    if (therapyStart === null) { therapyStart = now; therapyLastFrame = now; }
    const dt = Math.min(0.05, (now - therapyLastFrame) / 1000);
    therapyLastFrame = now;
    const elapsed = now - therapyStart;
    const prog = therapySmooth(THERAPY_TRANS_START, THERAPY_TRANS_END, elapsed);
    const omega = THERAPY_OMEGA0 + (THERAPY_OMEGA1 - THERAPY_OMEGA0) * prog;  // quickens
    therapySway += omega * dt;
    const phase = THERAPY_SWAY * Math.sin(therapySway);
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * THERAPY_PULSE_HZ * elapsed / 1000);

    therapyRender(prog, phase, pulse, elapsed / 1000);
    therapyAnimId = requestAnimationFrame(frame);
  }
  therapyAnimId = requestAnimationFrame(frame);
}

function stopTherapyLoop() {
  if (therapyAnimId !== null) { cancelAnimationFrame(therapyAnimId); therapyAnimId = null; }
  therapyStart = null;
  therapyLastFrame = null;
  therapySway = 0;
}

/* === Slide 13 (Frontier) — resonance ================================
   The wave carried from therapy meets a second, generated wave that
   starts off-frequency and out of phase. Over a few seconds the second
   locks to the first (同頻, same frequency) and they resonate together
   (共振, amplitude swells), the whole thing warming from amber to red:
   a future we can hear together. Built once; animated while slide 13 is
   active; reduced motion shows the resonant end-state. ================ */
const SLIDE_FRONTIER_INDEX = 12;
const FRONTIER_NS = 'http://www.w3.org/2000/svg';
const FRONTIER_POINTS = 7;         // fewest of all: the frontier's handful
const FRONTIER_TRANS_START = 1500;
const FRONTIER_TRANS_END = 7000;
const FRONTIER_AMP0 = 17, FRONTIER_AMP1 = 27;       // amplitude swells (resonance)
const FRONTIER_CYC_A = 3.4;        // tightest / fastest wavelength of the three
const FRONTIER_CYC_B0 = 2.4;       // the generated wave starts off-frequency
const FRONTIER_OMEGA = 1.8;        // quickest sway of the three
const FRONTIER_SWAY = 1.2;
const FRONTIER_PHASE_OFF = Math.PI;// generated wave starts out of phase
const FRONTIER_X0 = 150, FRONTIER_X1 = 1450, FRONTIER_BASEY = 300;
const FRONTIER_PULSE_HZ = 0.6;
const FRONTIER_AMBER = '#C89B52';  // carried amber (the line)
const FRONTIER_RED = '#B83A36';    // warms to red
const FRONTIER_YELLOW = '#DCA94A'; // points carried from therapy

let frontierBuilt = false;
let frontierStars = [];
let frontierWaveA = null, frontierWaveB = null;
let frontierAnimId = null, frontierStart = null, frontierLast = null, frontierSway = 0;

function frontierSmooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function frontierWaveYAt(x, k, phase, amp) {
  return FRONTIER_BASEY + amp * Math.sin(k * (x - FRONTIER_X0) + phase);
}
function frontierWaveD(k, phase, amp) {
  const N = 88;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const x = FRONTIER_X0 + (i / N) * (FRONTIER_X1 - FRONTIER_X0);
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + frontierWaveYAt(x, k, phase, amp).toFixed(1) + ' ';
  }
  return d;
}

function buildFrontierField() {
  if (frontierBuilt) return;
  const slide = slides[SLIDE_FRONTIER_INDEX];
  if (!slide) return;
  const field = slide.querySelector('.frontier-field');
  if (!field) return;

  let seed = 90341;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  frontierWaveB = document.createElementNS(FRONTIER_NS, 'path');   // generated wave (behind)
  frontierWaveB.setAttribute('class', 'frontier-wave-b');
  frontierWaveB.style.opacity = '0';
  field.appendChild(frontierWaveB);

  frontierWaveA = document.createElementNS(FRONTIER_NS, 'path');   // carried wave (primary)
  frontierWaveA.setAttribute('class', 'frontier-wave-a');
  frontierWaveA.style.opacity = '0.5';
  field.appendChild(frontierWaveA);

  frontierStars = [];
  for (let i = 0; i < FRONTIER_POINTS; i++) {
    const c = document.createElementNS(FRONTIER_NS, 'circle');
    c.setAttribute('class', 'frontier-star');
    c.setAttribute('fill', FRONTIER_YELLOW);
    field.appendChild(c);
    frontierStars.push({
      el: c,
      tx: FRONTIER_X0 + (i / (FRONTIER_POINTS - 1)) * (FRONTIER_X1 - FRONTIER_X0),
      baseR: 2.6 + rnd() * 1.2,
      baseOp: 0.64,
    });
  }
  frontierBuilt = true;
}

function frontierRender(prog, phase, pulse) {
  const amp = FRONTIER_AMP0 + (FRONTIER_AMP1 - FRONTIER_AMP0) * prog;
  const kA = (2 * Math.PI * FRONTIER_CYC_A) / (FRONTIER_X1 - FRONTIER_X0);
  const cycB = FRONTIER_CYC_B0 + (FRONTIER_CYC_A - FRONTIER_CYC_B0) * prog;   // freq locks to A
  const kB = (2 * Math.PI * cycB) / (FRONTIER_X1 - FRONTIER_X0);
  const phaseB = phase + FRONTIER_PHASE_OFF * (1 - prog);                     // phase locks to A

  if (frontierWaveA) {
    frontierWaveA.setAttribute('d', frontierWaveD(kA, phase, amp));
    frontierWaveA.setAttribute('stroke', therapyLerpHex(FRONTIER_AMBER, FRONTIER_RED, prog));
  }
  if (frontierWaveB) {
    frontierWaveB.setAttribute('d', frontierWaveD(kB, phaseB, amp));
    frontierWaveB.style.opacity = (0.34 + 0.16 * prog).toFixed(3);
  }
  for (const s of frontierStars) {
    s.el.setAttribute('cx', s.tx.toFixed(1));
    s.el.setAttribute('cy', frontierWaveYAt(s.tx, kA, phase, amp).toFixed(1));
    s.el.setAttribute('r', (s.baseR * (0.85 + 0.35 * pulse)).toFixed(2));
    s.el.setAttribute('fill', therapyLerpHex(FRONTIER_YELLOW, FRONTIER_RED, prog));   // warms to red
    s.el.style.opacity = (s.baseOp * (0.6 + 0.4 * pulse)).toFixed(3);
  }
}

function frontierPaintStatic() {
  frontierRender(1, 0, 1);   // resonant end-state, no animation
}

function startFrontierLoop() {
  buildFrontierField();
  if (!frontierBuilt) return;
  stopFrontierLoop();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    frontierPaintStatic();
    return;
  }
  frontierStart = null;
  frontierLast = null;
  frontierSway = 0;
  function frame(now) {
    if (frontierStart === null) { frontierStart = now; frontierLast = now; }
    const dt = Math.min(0.05, (now - frontierLast) / 1000);
    frontierLast = now;
    const elapsed = now - frontierStart;
    const prog = frontierSmooth(FRONTIER_TRANS_START, FRONTIER_TRANS_END, elapsed);
    frontierSway += FRONTIER_OMEGA * dt;
    const phase = FRONTIER_SWAY * Math.sin(frontierSway);
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * FRONTIER_PULSE_HZ * elapsed / 1000);
    frontierRender(prog, phase, pulse);
    frontierAnimId = requestAnimationFrame(frame);
  }
  frontierAnimId = requestAnimationFrame(frame);
}

function stopFrontierLoop() {
  if (frontierAnimId !== null) { cancelAnimationFrame(frontierAnimId); frontierAnimId = null; }
  frontierStart = null;
  frontierLast = null;
  frontierSway = 0;
}

function nextSlide() {
  setSlide(state.currentIndex + 1);
}

function previousSlide() {
  setSlide(state.currentIndex - 1);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
    return;
  }

  document.documentElement.requestFullscreen?.();
}

function jumpByDigit(key) {
  const mapping = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9 };
  if (mapping[key] === undefined) {
    return false;
  }

  setSlide(mapping[key]);
  return true;
}

function onFirstGesture() {
  if (state.hasUserGesture) {
    return;
  }

  state.hasUserGesture = true;
  // Boot the AudioEngine inside the gesture so the AudioContext starts
  // in 'running' state. init() decodes all sample buffers and stands up
  // both HarmonySynths; subsequent setSlideState calls await it.
  audioEngine.init().then(() => {
    // Land on the current slide's audio target as soon as init resolves.
    audioEngine.setSlideState(state.currentIndex);
  });
}

function handleKeydown(event) {
  onFirstGesture();

  const { key } = event;

  if (jumpByDigit(key)) {
    event.preventDefault();
    return;
  }

  // IAF slide reveals the frame-rate clocks in two intermediate steps:
  // a forward press adds the next clock (left/low first, then right/high);
  // a back press removes the last one. Only once both are shown does a
  // forward press fall through to advance the slide (and a back press with
  // none shown falls through to the previous slide).
  if (state.currentIndex === SLIDE_6_INDEX) {
    const goForward = key === 'ArrowRight' || key === 'PageDown' || (key === ' ' && !event.shiftKey);
    const goBack    = key === 'ArrowLeft'  || key === 'PageUp'   || (key === ' ' && event.shiftKey);
    if (goForward && iafStep < 2) {
      event.preventDefault();
      setIAFStep(iafStep + 1);
      return;
    }
    if (goBack && iafStep > 0) {
      event.preventDefault();
      setIAFStep(iafStep - 1);
      return;
    }
  }

  // Bloom slide holds at the two lists until a forward press fires the
  // split/transform; a back press reverses it. Once composed (or under
  // reduced motion, where bloomStep starts at 1), presses fall through
  // to normal slide navigation.
  if (state.currentIndex === SLIDE_BLOOM_INDEX) {
    const goForward = key === 'ArrowRight' || key === 'PageDown' || (key === ' ' && !event.shiftKey);
    const goBack    = key === 'ArrowLeft'  || key === 'PageUp'   || (key === ' ' && event.shiftKey);
    if (goForward && bloomStep === 0) {
      event.preventDefault();
      bloomSplit();
      return;
    }
    if (goBack && bloomStep === 1) {
      event.preventDefault();
      bloomUnsplit();
      return;
    }
  }

  // Shift+Space steps back; plain Space advances.
  if (key === ' ' && event.shiftKey) {
    event.preventDefault();
    previousSlide();
    return;
  }

  if (key === 'ArrowRight' || key === ' ' || key === 'PageDown') {
    event.preventDefault();
    nextSlide();
    return;
  }

  if (key === 'ArrowLeft' || key === 'PageUp') {
    event.preventDefault();
    previousSlide();
    return;
  }

  if (key === 'Home') {
    event.preventDefault();
    setSlide(0);
    return;
  }

  if (key === 'End') {
    event.preventDefault();
    setSlide(state.total - 1);
    return;
  }

  if (key.toLowerCase() === 'm') {
    event.preventDefault();
    const isMuted = audioEngine.toggleMute();
    console.log('[RTD audio] mute', { isMuted });
    return;
  }

  if (key.toLowerCase() === 'v') {
    event.preventDefault();
    toggleVolumeControl();
    return;
  }

  if (key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
    return;
  }

  if (key === 'Escape' && document.fullscreenElement) {
    document.exitFullscreen?.();
  }
}

function handleVisibility() {
  if (document.hidden) {
    audioEngine.suspend();
    return;
  }
  if (state.hasUserGesture) {
    audioEngine.resume();
  }
}

// Position the orbits dynamically by following the rendered text on
// the slide. Slides 1 and 2 used to depend on this — their orbit cy
// followed the "Moves to Their Own Beat" line — but the new design
// fixes both slides at cy=650 (the question's focus axis), so they
// opt out here and use the cx/cy/rx/ry values declared in the HTML.
// The function is kept in place for any future slide that wants
// dynamic alignment.
function alignOrbits() {
  document.querySelectorAll('section.slide').forEach((slide) => {
    const idx = parseInt(slide.dataset.slideIndex, 10);
    if (idx === 1 || idx === 2) return;

    const svg = slide.querySelector('.slide-ellipse');
    if (!svg) return;

    const statement = slide.querySelector('.statement, .echo-statement');
    if (!statement) return;

    const lines = statement.querySelectorAll(':scope > p');
    if (lines.length < 3) return;

    const svgRect = svg.getBoundingClientRect();
    if (svgRect.height === 0) return; // hidden / not laid out yet

    const toViewBoxY = (clientY) =>
      ((clientY - svgRect.top) / svgRect.height) * 900;

    const line1Bottom = toViewBoxY(lines[0].getBoundingClientRect().bottom);
    const line2Bottom = toViewBoxY(lines[1].getBoundingClientRect().bottom);
    const line3Rect = lines[2].getBoundingClientRect();
    const line3Center = toViewBoxY(line3Rect.top + line3Rect.height / 2);

    // Outer ellipse: top sits 8 viewBox units below "Time is Everything";
    // inner ellipse: top sits 8 viewBox units below "& Everyone".
    // Both centers align with the "Moves to Their Own Beat" line so the
    // dots (at the inner ellipse's horizontal tips) land in that line.
    const outerRy = Math.max(40, line3Center - line1Bottom - 8);
    const innerRy = Math.max(20, line3Center - line2Bottom - 8);

    const outer = svg.querySelector('.orbit-outer, .orbit-trace-outer');
    const inner = svg.querySelector('.orbit-inner, .orbit-trace-inner');
    setEllipseGeom(outer, line3Center, outerRy);
    setEllipseGeom(inner, line3Center, innerRy);

    svg.querySelectorAll('.dot, .echo-dot-wrap > circle').forEach((el) => {
      el.setAttribute('cy', line3Center.toFixed(2));
    });

    svg.querySelectorAll('.orbit, .orbit-trace').forEach((el) => {
      el.style.transformOrigin = `800px ${line3Center.toFixed(2)}px`;
    });
  });
}

function setEllipseGeom(el, cy, ry) {
  if (!el) return;
  el.setAttribute('cy', cy.toFixed(2));
  el.setAttribute('ry', ry.toFixed(2));
  if (typeof el.getTotalLength === 'function') {
    // +2 user-unit safety margin in case of subpixel rounding when the
    // dash terminates at the path's start point.
    const len = Math.ceil(el.getTotalLength()) + 2;
    el.style.setProperty('--perimeter', len);
  }
}

/* === Volume control =================================================
   Fixed master-volume slider in the bottom-right. The slider drives
   audioEngine.masterVolume directly, with a 30ms smoothing target so
   drags don't zip the gain and click. 'v' hotkey toggles visibility
   without affecting audio — useful for hiding the UI during a live
   presentation. */
const volumeControl = document.getElementById('volume-control');
const volumeSlider = document.getElementById('volume-slider');

if (volumeSlider) {
  volumeSlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    audioEngine.setMasterVolume(value);
  });

  // The slider lives outside the keyboard nav loop — when it receives
  // focus, arrow keys would otherwise both move the thumb and advance
  // the slide. Stop propagation so the deck's keydown handler ignores
  // events sourced from the slider.
  volumeSlider.addEventListener('keydown', (event) => {
    event.stopPropagation();
  });
}

function toggleVolumeControl() {
  if (!volumeControl) return;
  volumeControl.classList.toggle('volume-control-hidden');
}

window.addEventListener('click', onFirstGesture, { once: false });
window.addEventListener('keydown', handleKeydown);
window.addEventListener('hashchange', () => {
  setSlide(parseHashIndex(), { syncHash: false });
});
window.addEventListener('resize', alignOrbits);
document.addEventListener('visibilitychange', handleVisibility);
window.addEventListener('beforeunload', () => audioEngine.stopAll(0.2));
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(alignOrbits);
}

(function init() {
  // No audio init here — the AudioContext can't start until a user
  // gesture, so onFirstGesture handles boot. Page-load just renders.
  state.currentIndex = parseHashIndex();
  renderSlides();
  alignOrbits();
  buildStarfield();   // populate the slide-10 star map's faint field once
  if (state.currentIndex === SLIDE_STARMAP_INDEX) {
    runStarmapReveal();   // deep-link straight onto the star map: draw it
  }
  if (state.currentIndex === SLIDE_CURATE_INDEX) {
    startCurateLoop();    // deep-link onto the Curation slide
  }
  if (state.currentIndex === SLIDE_THERAPY_INDEX) {
    startTherapyLoop();   // deep-link onto the Therapy slide
  }
  if (state.currentIndex === SLIDE_FRONTIER_INDEX) {
    startFrontierLoop();  // deep-link onto the Frontier slide
  }

  // Deep-link safety: setSlide's enter/leave hooks only fire on
  // navigation, so kick off the slide-6 wave or demo whispers if the
  // page loads directly into one of those slides.
  if (state.currentIndex === SLIDE_GAIT_INDEX) {
    startGaitLoop();
  }
  if (state.currentIndex === SLIDE_6_INDEX) {
    startIAFLoop();
  }
  if (state.currentIndex === SLIDE_BLOOM_INDEX) {
    runBloomReveal();
    startBloomLoop();
  }
  if (state.currentIndex === SLIDE_DEMO_INDEX) {
    startWhispers();
    startBiomarkerDrift();
  }
})();
