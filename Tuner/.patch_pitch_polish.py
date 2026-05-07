#!/usr/bin/env python3
# Canonical rebuild of Tuner/index.html with pitch-detection polish:
#   1. 80-1200 Hz bandpass between every pitch source (mic / file) and `analyser`.
#   2. YIN confidence gate (probability >= 0.60) - below floor: no update; mid (0.60..0.85)
#      dim crosshair ~50%; high (>= 0.85) full brightness.
#   3. Adaptive lerp smoothing - alpha ~2x existing on high-conf detections,
#      alpha ~0.5x existing on borderline ones.
#
# Polarity note: yinDetect returns probability = 1 - minVal. Higher = better.
# (Existing baseline gate: probability > 0.5; YIN's internal threshold is 0.15
# on minVal, which corresponds to probability >= 0.85.)
#
# OneDrive FUSE convention: read once, mutate string in memory, atomically rewrite.

import os, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PATH = ROOT / 'index.html'

src = PATH.read_text(encoding='utf-8')
orig_len = len(src)


def replace_once(haystack, needle, replacement, label):
    n = haystack.count(needle)
    if n != 1:
        raise SystemExit("[patch] anchor not unique for {!r}: count={}".format(label, n))
    return haystack.replace(needle, replacement, 1)


# EDIT 1 - module-level state. Add `pitchBandpass` near the other audio-state
# `let` declarations (just after `pitchBuffer`).
_E1_OLD = (
    "    // Reusable buffer for analyser.getFloatTimeDomainData. Allocated once\n"
    "    // and resized only when fftSize changes. See audioLoop.\n"
    "    let pitchBuffer = null;"
)
_E1_NEW = (
    "    // Reusable buffer for analyser.getFloatTimeDomainData. Allocated once\n"
    "    // and resized only when fftSize changes. See audioLoop.\n"
    "    let pitchBuffer = null;\n"
    "    // Pitch-detection bandpass: a highpass+lowpass biquad pair (80 / 1200 Hz)\n"
    "    // sitting between every pitch source (mic or decoded file) and the\n"
    "    // pitch `analyser`. Cuts wind / HVAC rumble below 80 Hz and sibilance /\n"
    "    // hiss above 1200 Hz BEFORE YIN sees the buffer, so the algorithm\n"
    "    // doesn't have to discriminate against environmental noise. The LUFS\n"
    "    // meter, raw MIC dBFS readout, recording chain, and audible playback\n"
    "    // are all parallel to this filter - they observe the original full-band\n"
    "    // signal. Built lazily once per AudioContext via ensurePitchBandpass().\n"
    "    // YIN itself is untouched.\n"
    "    let pitchBandpass = null;\n"
    "    const PITCH_BANDPASS_LOW_HZ  = 80;    // highpass cutoff\n"
    "    const PITCH_BANDPASS_HIGH_HZ = 1200;  // lowpass cutoff\n"
    "    // YIN confidence (= 1 - minVal; higher is better) thresholds. The\n"
    "    // pitch indicator only updates when probability >= PITCH_PROB_FLOOR;\n"
    "    // when probability >= PITCH_PROB_HIGH the smoothing alpha is doubled and\n"
    "    // the crosshair shows at full alpha; in between the alpha is halved\n"
    "    // and the crosshair dims to ~50%.\n"
    "    const PITCH_PROB_FLOOR = 0.60;\n"
    "    const PITCH_PROB_HIGH  = 0.85;"
)
src = replace_once(src, _E1_OLD, _E1_NEW, "EDIT 1 (module state)")


# EDIT 2 - helpers right after getAudioContext().
_E2_OLD = (
    "      if (audioContext.state === 'suspended') {\n"
    "        audioContext.resume().catch(() => {});\n"
    "      }\n"
    "      return audioContext;\n"
    "    }\n"
    "\n"
    "    // One-time audio graph construction."
)
_E2_NEW = (
    "      if (audioContext.state === 'suspended') {\n"
    "        audioContext.resume().catch(() => {});\n"
    "      }\n"
    "      return audioContext;\n"
    "    }\n"
    "\n"
    "    // Lazily build the pitch-detection bandpass for the current AudioContext.\n"
    "    // Returns { hp, lp } - hp.connect(lp) is permanent. Re-creates the pair\n"
    "    // if the AudioContext has changed under us (defensive; the context is\n"
    "    // currently never closed, but this avoids cross-context node errors if\n"
    "    // that ever changes). Q = 1/sqrt(2) gives a maximally-flat passband.\n"
    "    function ensurePitchBandpass(ctx) {\n"
    "      if (pitchBandpass && pitchBandpass.hp && pitchBandpass.hp.context === ctx) {\n"
    "        return pitchBandpass;\n"
    "      }\n"
    "      const hp = ctx.createBiquadFilter();\n"
    "      hp.type = 'highpass';\n"
    "      hp.frequency.value = PITCH_BANDPASS_LOW_HZ;\n"
    "      hp.Q.value = 0.7071;\n"
    "      const lp = ctx.createBiquadFilter();\n"
    "      lp.type = 'lowpass';\n"
    "      lp.frequency.value = PITCH_BANDPASS_HIGH_HZ;\n"
    "      lp.Q.value = 0.7071;\n"
    "      hp.connect(lp);\n"
    "      pitchBandpass = { hp, lp };\n"
    "      return pitchBandpass;\n"
    "    }\n"
    "\n"
    "    // Wire `source` into the pitch analyser via the bandpass. The lp tail\n"
    "    // is reconnected to the (possibly fresh) analyser on every call so that\n"
    "    // analyser recreation in toggleListening / startFilePlayback survives.\n"
    "    // Other taps (FX chain, raw mic meter, audible destination) are NOT\n"
    "    // routed through this - callers connect those in parallel as before.\n"
    "    function connectSourceToPitchAnalyser(source) {\n"
    "      if (!source || !audioContext || !analyser) return false;\n"
    "      const bp = ensurePitchBandpass(audioContext);\n"
    "      try { bp.lp.disconnect(); } catch (_) {}\n"
    "      try { source.connect(bp.hp); } catch (_) {}\n"
    "      try { bp.lp.connect(analyser); } catch (_) {}\n"
    "      return true;\n"
    "    }\n"
    "\n"
    "    // One-time audio graph construction."
)
src = replace_once(src, _E2_OLD, _E2_NEW, "EDIT 2 (helpers after getAudioContext)")


# EDIT 3 - attachMicSource: pitch tap goes through bandpass.
_E3_OLD = (
    "    function attachMicSource(source) {\n"
    "      if (!source) return;\n"
    "      // Disconnect the previous source from the processing chain so we\n"
    "      // don't end up summing two parallel mic feeds into the recorder.\n"
    "      if (currentMicSource && currentMicSource !== source) {\n"
    "        try { currentMicSource.disconnect(); } catch (_) {}\n"
    "      }\n"
    "      currentMicSource = source;\n"
    "      try { source.connect(analyser); } catch (_) {}\n"
    "      if (micProcessing && micProcessing.head) {\n"
    "        try { source.connect(micProcessing.head); } catch (_) {}\n"
    "      }"
)
_E3_NEW = (
    "    function attachMicSource(source) {\n"
    "      if (!source) return;\n"
    "      // Disconnect the previous source from the processing chain so we\n"
    "      // don't end up summing two parallel mic feeds into the recorder.\n"
    "      if (currentMicSource && currentMicSource !== source) {\n"
    "        try { currentMicSource.disconnect(); } catch (_) {}\n"
    "      }\n"
    "      currentMicSource = source;\n"
    "      // Pitch tap: source -> bandpass(80-1200 Hz) -> analyser. Filters wind /\n"
    "      // HVAC rumble / sibilance before YIN sees the signal. Other taps\n"
    "      // (FX head, raw mic dBFS analyser) stay full-band.\n"
    "      if (!connectSourceToPitchAnalyser(source)) {\n"
    "        // Fallback: pre-bandpass behaviour, in case the bandpass couldn't be\n"
    "        // built (no audioContext / no analyser). Keeps pitch detection alive.\n"
    "        try { source.connect(analyser); } catch (_) {}\n"
    "      }\n"
    "      if (micProcessing && micProcessing.head) {\n"
    "        try { source.connect(micProcessing.head); } catch (_) {}\n"
    "      }"
)
src = replace_once(src, _E3_OLD, _E3_NEW, "EDIT 3 (attachMicSource pitch tap)")


# EDIT 4 - applyVoiceFX doRebuild: same change for the in-place rewire.
_E4_OLD = (
    "        // Re-route the live mic source through the rebuilt head.\n"
    "        if (currentMicSource) {\n"
    "          try { currentMicSource.disconnect(); } catch (_) {}\n"
    "          if (analyser) { try { currentMicSource.connect(analyser); } catch (_) {} }\n"
    "          try { currentMicSource.connect(micProcessing.head); } catch (_) {}\n"
    "          if (micProcessing.rawMicAnalyser) {\n"
    "            try { currentMicSource.connect(micProcessing.rawMicAnalyser); } catch (_) {}\n"
    "          }\n"
    "        }"
)
_E4_NEW = (
    "        // Re-route the live mic source through the rebuilt head.\n"
    "        if (currentMicSource) {\n"
    "          try { currentMicSource.disconnect(); } catch (_) {}\n"
    "          // Pitch tap goes through the 80-1200 Hz bandpass (see\n"
    "          // connectSourceToPitchAnalyser). Fallback to a direct connect\n"
    "          // if the bandpass isn't available yet.\n"
    "          if (analyser && !connectSourceToPitchAnalyser(currentMicSource)) {\n"
    "            try { currentMicSource.connect(analyser); } catch (_) {}\n"
    "          }\n"
    "          try { currentMicSource.connect(micProcessing.head); } catch (_) {}\n"
    "          if (micProcessing.rawMicAnalyser) {\n"
    "            try { currentMicSource.connect(micProcessing.rawMicAnalyser); } catch (_) {}\n"
    "          }\n"
    "        }"
)
src = replace_once(src, _E4_OLD, _E4_NEW, "EDIT 4 (applyVoiceFX doRebuild)")


# EDIT 5 - teardownVoiceFXForExit: same change.
_E5_OLD = (
    "      if (currentMicSource) {\n"
    "        try { currentMicSource.disconnect(); } catch (_) {}\n"
    "        if (analyser) { try { currentMicSource.connect(analyser); } catch (_) {} }\n"
    "        try { currentMicSource.connect(micProcessing.head); } catch (_) {}\n"
    "        if (micProcessing.rawMicAnalyser) {\n"
    "          try { currentMicSource.connect(micProcessing.rawMicAnalyser); } catch (_) {}\n"
    "        }\n"
    "      }\n"
    "      updateVoiceProcNote();\n"
    "      updateVoiceReverbControlsVisibility();\n"
    "    }"
)
_E5_NEW = (
    "      if (currentMicSource) {\n"
    "        try { currentMicSource.disconnect(); } catch (_) {}\n"
    "        // Pitch tap through bandpass (see connectSourceToPitchAnalyser).\n"
    "        if (analyser && !connectSourceToPitchAnalyser(currentMicSource)) {\n"
    "          try { currentMicSource.connect(analyser); } catch (_) {}\n"
    "        }\n"
    "        try { currentMicSource.connect(micProcessing.head); } catch (_) {}\n"
    "        if (micProcessing.rawMicAnalyser) {\n"
    "          try { currentMicSource.connect(micProcessing.rawMicAnalyser); } catch (_) {}\n"
    "        }\n"
    "      }\n"
    "      updateVoiceProcNote();\n"
    "      updateVoiceReverbControlsVisibility();\n"
    "    }"
)
src = replace_once(src, _E5_OLD, _E5_NEW, "EDIT 5 (teardownVoiceFXForExit)")


# EDIT 6 - file playback: route audible path direct to destination, pitch tap
# through the bandpass. NOTE: the source has indented blank lines.
_E6_OLD = (
    "      analyser = audioContext.createAnalyser();\n"
    "      analyser.fftSize = 4096;\n"
    "      \n"
    "      sourceNode.connect(analyser);\n"
    "      analyser.connect(audioContext.destination);"
)
_E6_NEW = (
    "      analyser = audioContext.createAnalyser();\n"
    "      analyser.fftSize = 4096;\n"
    "      \n"
    "      // Audible playback path stays full-band: source -> destination directly.\n"
    "      // Pitch tap (separate, parallel) runs through the 80-1200 Hz bandpass\n"
    "      // -> analyser, so YIN sees a cleaner spectrum without colouring what\n"
    "      // the user hears. The analyser is no longer in the speaker path.\n"
    "      sourceNode.connect(audioContext.destination);\n"
    "      if (!connectSourceToPitchAnalyser(sourceNode)) {\n"
    "        // Fallback if the bandpass couldn't be built - keep pitch detection alive.\n"
    "        sourceNode.connect(analyser);\n"
    "      }"
)
src = replace_once(src, _E6_OLD, _E6_NEW, "EDIT 6 (startFilePlayback pitch tap)")


# EDIT 7 - audioLoop: confidence gate + adaptive smoothing.
_E7_OLD = (
    "          const result = yinDetect(pitchBuffer, audioContext.sampleRate);\n"
    "\n"
    "          if (result.freq > 50 && result.freq < 2000 && result.probability > 0.5) {\n"
    "            let rawCents = 1200 * Math.log2(result.freq / config.refFreq);\n"
    "\n"
    "            const baseAlpha = 0.03 + (config.responsiveness / 10) * 0.25;\n"
    "            const smoothingFactor = 16 / (config.smoothing + 1);\n"
    "            const alpha = Math.max(0.005, baseAlpha * Math.min(1, smoothingFactor));\n"
    "\n"
    "            if (smoothedFreq === null) {\n"
    "              smoothedFreq = result.freq;\n"
    "              smoothedCents = rawCents;\n"
    "            } else {\n"
    "              smoothedFreq += (result.freq - smoothedFreq) * alpha;\n"
    "              smoothedCents += (rawCents - smoothedCents) * alpha;\n"
    "            }\n"
    "\n"
    "            currentProbability = result.probability;\n"
    "            lastPitchTime = now;\n"
    "            lastValidPitch = { freq: smoothedFreq, cents: smoothedCents, probability: result.probability };\n"
    "          }"
)
_E7_NEW = (
    "          const result = yinDetect(pitchBuffer, audioContext.sampleRate);\n"
    "\n"
    "          // Confidence gate: below the floor we treat the frame as \"not\n"
    "          // sure\" and don't touch the smoothed pitch - the previous valid\n"
    "          // value stays on screen and the existing fade-out logic in\n"
    "          // draw() handles long pauses. (YIN's `probability = 1 - minVal`,\n"
    "          // so HIGHER is cleaner.)\n"
    "          if (result.freq > 50 && result.freq < 2000 && result.probability >= PITCH_PROB_FLOOR) {\n"
    "            let rawCents = 1200 * Math.log2(result.freq / config.refFreq);\n"
    "\n"
    "            // Base lerp from user sliders (responsiveness / smoothing).\n"
    "            const baseAlpha = 0.03 + (config.responsiveness / 10) * 0.25;\n"
    "            const smoothingFactor = 16 / (config.smoothing + 1);\n"
    "            let alpha = Math.max(0.005, baseAlpha * Math.min(1, smoothingFactor));\n"
    "            // Adaptive smoothing: snappier when YIN is confident (captures\n"
    "            // vibrato / micro-pitch on clean singing), heavier when borderline\n"
    "            // (suppresses jumpy frames). Multiplicative modifier preserves\n"
    "            // the user's slider preferences as the baseline.\n"
    "            if (result.probability >= PITCH_PROB_HIGH) {\n"
    "              alpha = Math.min(0.5, alpha * 2.2);   // ~0.4 at default sliders\n"
    "            } else {\n"
    "              alpha = Math.max(0.04, alpha * 0.5);  // ~0.09 at default sliders\n"
    "            }\n"
    "\n"
    "            if (smoothedFreq === null) {\n"
    "              smoothedFreq = result.freq;\n"
    "              smoothedCents = rawCents;\n"
    "            } else {\n"
    "              smoothedFreq += (result.freq - smoothedFreq) * alpha;\n"
    "              smoothedCents += (rawCents - smoothedCents) * alpha;\n"
    "            }\n"
    "\n"
    "            currentProbability = result.probability;\n"
    "            lastPitchTime = now;\n"
    "            lastValidPitch = { freq: smoothedFreq, cents: smoothedCents, probability: result.probability };\n"
    "          }"
)
src = replace_once(src, _E7_OLD, _E7_NEW, "EDIT 7 (YIN gate + adaptive smoothing)")


# EDIT 8 - draw: dim the crosshair to ~50% when latest detection is borderline.
_E8_OLD = (
    "      const targetOpacity = isActive ? Math.min(1, currentProbability * 1.2) : displayProbability * 0.5;\n"
    "      indicatorOpacity += (targetOpacity - indicatorOpacity) * 0.2;"
)
_E8_NEW = (
    "      // Active-frame opacity. When the freshest detection is in the\n"
    "      // borderline confidence band (FLOOR..HIGH) we halve the target\n"
    "      // alpha so the crosshair visibly dims - a quiet \"I'm unsure right\n"
    "      // now\" cue without changing the user-facing toggles. High-confidence\n"
    "      // frames still pop to full brightness.\n"
    "      const lowConf = isActive && displayProbability < PITCH_PROB_HIGH;\n"
    "      const baseTargetOpacity = isActive\n"
    "        ? Math.min(1, currentProbability * 1.2)\n"
    "        : displayProbability * 0.5;\n"
    "      const targetOpacity = lowConf ? baseTargetOpacity * 0.5 : baseTargetOpacity;\n"
    "      indicatorOpacity += (targetOpacity - indicatorOpacity) * 0.2;"
)
src = replace_once(src, _E8_OLD, _E8_NEW, "EDIT 8 (low-conf crosshair dim)")


# Sanity checks
if not src.rstrip().endswith('</html>'):
    raise SystemExit("[patch] safety: file no longer ends with </html>")
if 'pitchBandpass' not in src:
    raise SystemExit("[patch] safety: pitchBandpass missing post-edit")
if 'PITCH_PROB_FLOOR' not in src:
    raise SystemExit("[patch] safety: PITCH_PROB_FLOOR missing post-edit")
n_calls = src.count('connectSourceToPitchAnalyser')
if n_calls < 5:
    raise SystemExit("[patch] safety: connectSourceToPitchAnalyser call sites = {}".format(n_calls))

# Atomic rewrite via temp + os.replace (OneDrive FUSE friendly).
tmp = PATH.with_suffix('.html.patchtmp')
tmp.write_text(src, encoding='utf-8')
os.replace(str(tmp), str(PATH))

sys.stdout.write("[patch] OK. orig_len={} new_len={} delta={} call_sites={}\n".format(
    orig_len, len(src), len(src) - orig_len, n_calls))
sys.stdout.flush()
