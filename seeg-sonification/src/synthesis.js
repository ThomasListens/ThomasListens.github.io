/**
 * synthesis.js — Audio Building Blocks (v8.3)
 *
 * Voice graph per channel:
 *
 *   Layer 1 (Root + AM):
 *     sine(pitch) → rootGain → layer1Gain ─┐
 *                                           │
 *   Layer 2 (Phase Harmonics):              │
 *     sine(pitch×2,×3,×4) → overGain  ─┐   │
 *     sine(pitch/2,×2/3)  → underGain ─┤   │
 *                         layer2Gain  ──┤   │
 *                                       │   │
 *   Layer 3 (FM / Centroid):            │   │
 *     mod sine(pitch×2) → fmModGain    │   │
 *       → carrier.frequency            │   │
 *     carrier sine(pitch) → fmAmpGain  │   │
 *       → layer3Gain ──────────────────┤   │
 *                                       │   │
 *   Layer 4 (Transients):               │   │
 *     pitched click → transientGain ────┤   │
 *                                       ▼   ▼
 *                                   channelBus
 *                                       │
 *                                  [waveshaper]  ← per-channel distortion
 *                                       │
 *                                    trimGain    ← per-channel dB trim
 *                                       │
 *                                     panner     ← stereo position
 *                                       │
 *                                   destination
 *
 * KEY CHANGES FROM v8.2:
 *   - Waveshaper moved to END of chain (after all layers merge).
 *     All four layers get tissue-derived distortion character.
 *   - Transient templates are PITCHED to the channel's fundamental.
 *     Short sine burst at pitchHz with noise blend, so clicks sound
 *     like part of the instrument instead of a separate event.
 *   - trimGain node added for per-channel gain trim (dB offset).
 *   - Transient detection: baseline window 3s (was 500ms) so spikes
 *     fire throughout seizures, not just at onset.
 *
 * Exports:
 *   detectTransients(features, opts?)
 *   createVoiceGraph(audioCtx, destination, pitchHz, pan, distortionCurve?)
 */


// ─────────────────────────────────────────────────────────────────────────────
// TRANSIENT DETECTION (v8.3 — longer baseline, tighter gating)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect spike events from PPAF.
 *
 * v8.3: Baseline window 3s (was 500ms). At 500ms the baseline catches up
 * to seizure level within seconds, silencing transients during ictal body.
 * At 3s, the baseline lags enough that spikes fire throughout.
 *
 * @param {object} features
 * @param {object} [opts]
 * @param {number} [opts.baselineWindowMs=3000]
 * @param {number} [opts.refractoryMs=40]
 * @returns {Array<{timeSec, type, salience, ppafNorm}>}
 */
export function detectTransients(features, opts = {}) {
  const { ppaf, calibration } = features;
  const fs = calibration.fs;
  const events = [];

  const SPIKE_FLOOR    = 0.10;
  const baselineWin    = Math.floor(fs * (opts.baselineWindowMs ?? 3000) / 1000);
  const minSpikeGap    = Math.floor(fs * (opts.refractoryMs ?? 40) / 1000);
  let   baselineSum    = 0;
  let   lastSpikeSample = -minSpikeGap;

  for (let i = 0; i < ppaf.length; i++) {
    baselineSum += ppaf[i];
    if (i >= baselineWin) baselineSum -= ppaf[i - baselineWin];
    const baseline = baselineSum / Math.min(i + 1, baselineWin);

    const aboveFloor    = ppaf[i] > SPIKE_FLOOR;
    const aboveBaseline = baseline > 0.01 && ppaf[i] > baseline * 2.0;

    if ((aboveFloor && aboveBaseline) && i - lastSpikeSample >= minSpikeGap) {
      const ratio    = baseline > 0.01 ? ppaf[i] / baseline : ppaf[i] * 3;
      const salience = ratio > 4 ? 2 : ratio > 2.5 ? 1 : 0;
      events.push({ timeSec: i / fs, type: 'spike', salience, ppafNorm: ppaf[i] });
      lastSpikeSample = i;
    }
  }

  return events;
}


// (Pitched template system removed — transients are now embedded gaussian
//  bumps in the existing automation curves, with a looping noise source
//  in the voice graph for consonant attack texture. See engine.js.)


// ─────────────────────────────────────────────────────────────────────────────
// VOICE GRAPH — END-OF-CHAIN WAVESHAPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the four-layer voice graph for one channel.
 *
 * All layers → channelBus → [waveshaper] → trimGain → panner → destination
 *
 * @param {AudioContext} audioCtx
 * @param {AudioNode}    destination
 * @param {number}       pitchHz
 * @param {number}       pan — [-1, 1]
 * @param {Float32Array|null} distortionCurve
 * @returns {VoiceGraph}
 */
export function createVoiceGraph(audioCtx, destination, pitchHz, pan, distortionCurve = null) {

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT CHAIN:
  //   channelBus → preShaperGain → [waveshaper] → trimGain → panner → dest
  //
  // preShaperGain (normally 1.0) is briefly spiked to 3-6× by the transient
  // scheduler, pushing the existing signal into waveshaper saturation.
  // No new sources — the voice itself crunches at each spike.
  // ═══════════════════════════════════════════════════════════════════════════

  const panner = new StereoPannerNode(audioCtx, { pan });

  const trimGain = audioCtx.createGain();
  trimGain.gain.value = 1.0;

  const preShaperGain = audioCtx.createGain();
  preShaperGain.gain.value = 1.0;

  const channelBus = audioCtx.createGain();
  channelBus.gain.value = 1.0;

  channelBus.connect(preShaperGain);

  const waveshaper = audioCtx.createWaveShaper();
  waveshaper.oversample = '2x';
  if (distortionCurve) {
    // Full tissue-derived distortion from kurtosis/skewness
    waveshaper.curve = distortionCurve;
  } else {
    // Mild tanh even at drive=0 so preShaperGain spikes create saturation crunch.
    // gain=1 passes through nearly clean; gain>1 hits the tanh knee.
    const mild = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      mild[i] = Math.tanh(x * 1.5);
    }
    waveshaper.curve = mild;
  }
  preShaperGain.connect(waveshaper);
  waveshaper.connect(trimGain);

  trimGain.connect(panner);
  panner.connect(destination);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: Root + AM
  // ═══════════════════════════════════════════════════════════════════════════

  // Dual root oscillators for click-free wavetable morphing.
  // One is active, the other idles at zero gain. On wavetable update,
  // the new PeriodicWave is set on the idle osc, then gains crossfade.
  const rootOscA = audioCtx.createOscillator();
  rootOscA.type = 'sine';
  rootOscA.frequency.value = pitchHz;
  const rootOscGainA = audioCtx.createGain();
  rootOscGainA.gain.value = 1.0;  // A starts active

  const rootOscB = audioCtx.createOscillator();
  rootOscB.type = 'sine';
  rootOscB.frequency.value = pitchHz;
  const rootOscGainB = audioCtx.createGain();
  rootOscGainB.gain.value = 0.0;  // B starts idle

  const rootGain = audioCtx.createGain();
  rootGain.gain.value = 0;

  const layer1Gain = audioCtx.createGain();
  layer1Gain.gain.value = 1.0;

  rootOscA.connect(rootOscGainA);
  rootOscB.connect(rootOscGainB);
  rootOscGainA.connect(rootGain);
  rootOscGainB.connect(rootGain);
  rootGain.connect(layer1Gain);
  layer1Gain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: Morphology — Per-Overtone Gain Nodes
  //
  // Each overtone/undertone gets its own gain node so harmonic RANGE can be
  // controlled independently. Range fader + slope asymmetry determine which
  // overtones are active at each moment.
  //
  // Graph:
  //   osc×2  → over2Gain  ─┐
  //   osc×3  → over3Gain  ─┼─ layer2Gain → channelBus
  //   osc×4  → over4Gain  ─┤
  //   osc×½  → under05Gain ┤
  //   osc×⅔  → under23Gain ┘
  // ═══════════════════════════════════════════════════════════════════════════

  // Overtone oscillators: ×2 (octave), ×3 (fifth+oct), ×4 (2 octaves)
  const overOsc2 = audioCtx.createOscillator();
  overOsc2.type = 'sine';
  overOsc2.frequency.value = pitchHz * 2;

  const overOsc3 = audioCtx.createOscillator();
  overOsc3.type = 'sine';
  overOsc3.frequency.value = pitchHz * 3;

  const overOsc4 = audioCtx.createOscillator();
  overOsc4.type = 'sine';
  overOsc4.frequency.value = pitchHz * 4;

  // Undertone oscillators: ×½ (sub-octave), ×⅔ (sub-fifth)
  const underOsc05 = audioCtx.createOscillator();
  underOsc05.type = 'sine';
  underOsc05.frequency.value = pitchHz * 0.5;

  const underOsc23 = audioCtx.createOscillator();
  underOsc23.type = 'sine';
  underOsc23.frequency.value = pitchHz * (2/3);

  // Per-overtone gain nodes (individually automatable)
  const over2Gain = audioCtx.createGain();
  over2Gain.gain.value = 0;

  const over3Gain = audioCtx.createGain();
  over3Gain.gain.value = 0;

  const over4Gain = audioCtx.createGain();
  over4Gain.gain.value = 0;

  const under05Gain = audioCtx.createGain();
  under05Gain.gain.value = 0;

  const under23Gain = audioCtx.createGain();
  under23Gain.gain.value = 0;

  const layer2Gain = audioCtx.createGain();
  layer2Gain.gain.value = 1.0;

  // Wire: each osc → its own gain → layer2 bus
  overOsc2.connect(over2Gain);
  overOsc3.connect(over3Gain);
  overOsc4.connect(over4Gain);
  underOsc05.connect(under05Gain);
  underOsc23.connect(under23Gain);

  over2Gain.connect(layer2Gain);
  over3Gain.connect(layer2Gain);
  over4Gain.connect(layer2Gain);
  under05Gain.connect(layer2Gain);
  under23Gain.connect(layer2Gain);

  layer2Gain.connect(channelBus);

  // Collect for convenience
  const overOscs  = [overOsc2, overOsc3, overOsc4];
  const underOscs = [underOsc05, underOsc23];
  const overGains  = [over2Gain, over3Gain, over4Gain];
  const underGains = [under05Gain, under23Gain];


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: FM / Centroid
  // ═══════════════════════════════════════════════════════════════════════════

  const fmCarrier = audioCtx.createOscillator();
  fmCarrier.type = 'sine';
  fmCarrier.frequency.value = pitchHz;

  const fmModulator = audioCtx.createOscillator();
  fmModulator.type = 'sine';
  fmModulator.frequency.value = pitchHz * 2;

  const fmModGain = audioCtx.createGain();
  fmModGain.gain.value = 0;

  const fmAmpGain = audioCtx.createGain();
  fmAmpGain.gain.value = 0;

  const layer3Gain = audioCtx.createGain();
  layer3Gain.gain.value = 1.0;

  fmModulator.connect(fmModGain);
  fmModGain.connect(fmCarrier.frequency);

  fmCarrier.connect(fmAmpGain);
  fmAmpGain.connect(layer3Gain);
  layer3Gain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // NOISE SOURCE — pitched noise burst for transient consonant attack
  //
  // Bandpass-filtered around the channel's fundamental so it sounds like a
  // breathy/plucky attack on the same note, not broadband static.
  // Normally silent (noiseGain=0). Scheduler bumps briefly at events.
  //
  // noiseSource → noiseBandpass(pitchHz, Q=3) → noiseGain → channelBus
  // ═══════════════════════════════════════════════════════════════════════════

  // 100ms looping buffer — short enough to avoid memory waste, long enough to avoid audible looping
  const noiseLen = Math.floor(audioCtx.sampleRate * 0.1);
  const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = noiseBuf;
  noiseSource.loop = true;

  const noiseBandpass = audioCtx.createBiquadFilter();
  noiseBandpass.type = 'bandpass';
  noiseBandpass.frequency.value = pitchHz;
  noiseBandpass.Q.value = 3;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0;

  noiseSource.connect(noiseBandpass);
  noiseBandpass.connect(noiseGain);
  noiseGain.connect(channelBus);


  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════════════════

  const allOscs = [rootOscA, rootOscB, ...overOscs, ...underOscs, fmCarrier, fmModulator];
  let _muted = false;

  return {
    rootOscA, rootOscB, rootOscGainA, rootOscGainB,  // dual oscs for wavetable crossfade
    allOscs,
    noiseSource,   // started separately (not in allOscs — no frequency)
    rootGain, layer1Gain,
    overGains, underGains, overOscs, underOscs, layer2Gain,
    fmModGain, fmAmpGain, layer3Gain,
    noiseGain, noiseBandpass,
    preShaperGain, channelBus, waveshaper, trimGain, panner,

    get muted() { return _muted; },
    setMuted(m) {
      _muted = m;
      if (m) {
        try { panner.disconnect(destination); } catch (_) {}
      } else {
        try { panner.connect(destination); } catch (_) {}
      }
    },
  };
}