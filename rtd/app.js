/* === Per-slide audio targets ========================================
   Five-layer composition. File-based layers (drone, pulse, gait) decode
   into AudioBuffers for sample-accurate looping. Synthesized layers
   (titleChord, alphaHarmony) are Web Audio HarmonySynth instances that
   ring at constant just-intonation pitches over the C3 fundamental.

   Volume design (rationale per architecture spec):
     1: drone bed enters under the question
     2: title chord layered over drone for the engulf/title reveal
     3: chord clears, drone alone for the definition
     4: pulse joins as the slide's content driver
     5: gait joins at 3:2 against pulse — drone + pulse drop to make room
     6: alpha harmony joins as the slide's payload — rhythm bed lowered
     7: all four layers sustain at lowered atmospheric levels
     8+: fade to silence for the demo
   ===================================================================== */
const SLIDES = [
  { index: 0,  section: '',                    audio: {} },
  { index: 1,  section: 'i. the question',     audio: { drone: 0.45 } },
  { index: 2,  section: 'ii. the method',      audio: { drone: 0.45, titleChord: 0.55 } },
  { index: 3,  section: 'ii. the method',      audio: { drone: 0.45 } },
  { index: 4,  section: 'iii. the build',      audio: { drone: 0.45, pulse: 0.7 } },
  { index: 5,  section: 'iii. the build',      audio: { drone: 0.40, pulse: 0.5, gait: 0.7 } },
  { index: 6,  section: 'iii. the build',      audio: { drone: 0.35, pulse: 0.4, gait: 0.5, alphaHarmony: 0.6 } },
  { index: 7,  section: 'iii. the build',      audio: { drone: 0.30, pulse: 0.35, gait: 0.45, alphaHarmony: 0.5 } }, // 7a — expansion
  { index: 8,  section: 'iii. the build',      audio: { drone: 0.30, pulse: 0.35, gait: 0.45, alphaHarmony: 0.5 } }, // 7b — integration (same audio bed)
  { index: 9,  section: 'iv. the demo',        audio: {} }, // demo frame — silence before the demo
  { index: 10, section: 'iv. the demo',        audio: {} },
  { index: 11, section: 'v. what comes next',  audio: {} },
  { index: 12, section: 'v. what comes next',  audio: {} },
  { index: 13, section: 'vi. close',           audio: {} },
];

/**
 * Two-oscillator harmony synthesizer with parallel reverb and a slow
 * tremolo LFO. Used for slide 2's title chord (11/8 + 16/11 above C3,
 * microtonal) and slide 6's alpha harmony (5/4 + 8/5 above C3, just-
 * intonation major third + minor sixth).
 *
 * Pitches are set once at construction and never change. setVolume()
 * fades the synth's master output only — both notes remain at their
 * constant frequencies and equal balance with each other.
 */
class HarmonySynth {
  constructor(ctx, destination, { ratios, baseFreq }) {
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

    // Slow breathing — LFO sums into each oscillator's gain param.
    // 0.18 Hz = one full breath every ~5.5 seconds, which reads as
    // patient rather than nervous. Depth 0.08 keeps the modulation
    // subtle enough that you sense it without naming it.
    const tremoloLFO = ctx.createOscillator();
    tremoloLFO.type = 'sine';
    tremoloLFO.frequency.value = 0.18;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.08;
    tremoloLFO.connect(tremoloDepth);
    tremoloLFO.start();

    // One sine per ratio. Each oscillator at -6dB so the chord fits
    // headroom when both ring together at full output.
    ratios.forEach((ratio) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * ratio;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.5;
      tremoloDepth.connect(oscGain.gain);
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
    this.titleChord = null;
    this.alphaHarmony = null;
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
      // hr_pulse: 5 strikes at 857ms intervals from t=0 to t=3.428s
      // plus ~0.5s trailing silence. loopEnd at 3.428 drops the silence
      // (which read as a "rest every 4 beats") and the would-be 5th
      // strike that overlaps beat 1 of the next cycle.
      this.pulse = this.makeBufferPlayer(pulseBuf, { loopEnd: 3.428 });
      this.gait = this.makeBufferPlayer(gaitBuf);

      // Synthesized layers. Drone fundamental for harmonic reference is
      // C3 ≈ 130.81 Hz — same C as c-drone.mp3.
      this.titleChord = new HarmonySynth(this.ctx, this.masterGain, {
        // 11/8 (≈547¢) and 16/11 (≈648¢) above C3 — microtonal pitches
        // rooted in prime 11. Intentionally outside 12-TET so the chord
        // signals "composed, not preset."
        ratios: [11 / 8, 16 / 11],
        baseFreq: 130.81,
      });
      this.alphaHarmony = new HarmonySynth(this.ctx, this.masterGain, {
        // 5/4 (just-intonation major third) + 8/5 (just-intonation
        // minor sixth) above C3.
        ratios: [5 / 4, 8 / 5],
        baseFreq: 130.81,
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
    if (this.titleChord)   this.titleChord.setVolume(targets.titleChord   || 0, fadeSeconds);
    if (this.alphaHarmony) this.alphaHarmony.setVolume(targets.alphaHarmony || 0, fadeSeconds);
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
   * Fade everything to silence. Called on page unload as a courtesy
   * (the context is destroyed by the browser anyway).
   */
  stopAll(fadeSeconds = 0.4) {
    if (!this.initialized) return;
    [this.drone, this.pulse, this.gait].forEach((p) => this.fadeLayer(p, 0, fadeSeconds));
    if (this.titleChord)   this.titleChord.setVolume(0, fadeSeconds);
    if (this.alphaHarmony) this.alphaHarmony.setVolume(0, fadeSeconds);
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

  // Slide 6 wave — continuous oscillation while slide 6 is active.
  if (clamped === SLIDE_6_INDEX) {
    startSlide6Wave();
  } else if (state.currentIndex === SLIDE_6_INDEX) {
    stopSlide6Wave();
  }

  state.currentIndex = clamped;
  renderSlides();

  if (syncHash) {
    window.location.hash = `#${clamped + 1}`;
  }

  // Audio is independent of the visual slide cross-fade. The engine
  // crossfades all five layers to the new slide's targets in parallel.
  audioEngine.setSlideState(clamped);

  // Slide 2 (engulf + title write) wants the chord more deliberately
  // paced than the default 0.8s crossfade. On entry from earlier in
  // the deck: hold silent for 2.5s while the engulf runs, then fade
  // in over 2.5s synced with the title text writing (which starts at
  // t=2.5s and finishes at t=4.2s). On exit: stretch the fade-out to
  // 3.5s so the convolver tail bleeds gracefully under the next slide.
  if (clamped === 2 && previousIndex < 2 && audioEngine.titleChord) {
    audioEngine.titleChord.setVolume(0, 0.05);
    setTimeout(() => {
      if (state.currentIndex === 2 && audioEngine.titleChord) {
        audioEngine.titleChord.setVolume(0.55, 2.5);
      }
    }, 2500);
  } else if (previousIndex === 2 && clamped !== 2 && audioEngine.titleChord) {
    audioEngine.titleChord.setVolume(0, 3.5);
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

/* === Slide 6 wave oscillation =======================================
   The wave between the two vertical curves oscillates continuously
   while slide 6 is active — frequency drifts slowly between 2 and 5
   cycles across the visible width on a 12s period, and a steady phase
   advance gives a rightward "flow" so the wave reads as unfolding
   rather than standing in place. Pure CSS can't drive a path's `d`
   attribute per-frame; this rAF loop rewrites it each tick.
   ===================================================================== */
const SLIDE_6_INDEX = 6;
let slide6WaveAnimationId = null;

function startSlide6Wave() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const wavePath = document.querySelector('.slide-iaf-cadence .iaf-wave');
  if (!wavePath) return;

  const xStart = 220;
  const xEnd = 580;
  const yCenter = 160;
  const amplitude = 14;
  const numSamples = 60;

  const freqMin = 2.0;
  const freqMax = 5.0;
  const modPeriod = 12000; // ms — full cycle of frequency modulation

  const startTime = performance.now();

  function frame(now) {
    const t = now - startTime;
    const modPhase = (t / modPeriod) * Math.PI * 2;
    const freq = freqMin + (freqMax - freqMin) * (0.5 + 0.5 * Math.sin(modPhase));
    const phase = (t / 1500) * Math.PI * 2;

    const dx = (xEnd - xStart) / numSamples;
    let d = `M ${xStart} ${yCenter}`;
    for (let i = 1; i <= numSamples; i++) {
      const x = xStart + i * dx;
      const xPrev = xStart + (i - 1) * dx;
      const xMid = (xPrev + x) / 2;
      const xMidNorm = (xMid - xStart) / (xEnd - xStart);
      const xNorm = (x - xStart) / (xEnd - xStart);
      const yMid = yCenter + amplitude * Math.sin(xMidNorm * freq * Math.PI * 2 + phase);
      const yEnd = yCenter + amplitude * Math.sin(xNorm * freq * Math.PI * 2 + phase);
      d += ` Q ${xMid} ${yMid}, ${x} ${yEnd}`;
    }

    wavePath.setAttribute('d', d);
    slide6WaveAnimationId = requestAnimationFrame(frame);
  }

  slide6WaveAnimationId = requestAnimationFrame(frame);
}

function stopSlide6Wave() {
  if (slide6WaveAnimationId !== null) {
    cancelAnimationFrame(slide6WaveAnimationId);
    slide6WaveAnimationId = null;
  }
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
})();
