#!/usr/bin/env python3
"""Canonical rebuild: replace spectrum-curve viz with aurora cloud field."""
import io, os, sys

SRC_INPUT = os.environ.get('INDEX_SOURCE', '/tmp/index_original.html')
SRC_OUT   = os.environ.get('INDEX_OUTPUT', '/sessions/eager-quirky-cori/mnt/ThomasListens.github.io/Tuner/index.html')

with io.open(SRC_INPUT, 'r', encoding='utf-8', newline='') as f:
    text = f.read()

assert "drawSpectrumIdleHint" in text, "expected idle-hint helper"
assert "spectrumEnergyEMA" in text, "expected current spectrum state"

# Edit 1: state declarations
OLD_STATE = (
    "    // Reusable Uint8Array for spectrum visualizer FFT reads. Same GC-\n"
    "    // avoidance pattern as pitchBuffer / micLevelBuf.\n"
    "    let spectrumBuf = null;\n"
    "    let spectrumYs = null;\n"
    "    // Per-Y energy buckets for the vertical spectrum curve. Allocated\n"
    "    // lazily in drawSpectrum() once we know the bucket count. The EMA\n"
    "    // is a peak-decay-style \"wake\": each frame the held value drops to\n"
    "    // 75% of itself but jumps instantly when live energy exceeds it,\n"
    "    // so transients leave a brief contrail in the curve.\n"
    "    let spectrumEnergyEMA = null;\n"
    "    // Loudest-band detection state, written by drawSpectrum() and read\n"
    "    // by the big nearest-ratio label so spectrum mode shows the FFT\n"
    "    // peak's ratio with the same typography as the YIN-driven label.\n"
    "    let spectrumPeakRatio = null;\n"
    "    let spectrumPeakStrength = 0;\n"
)
NEW_STATE = (
    "    // Reusable Uint8Array for FFT byte reads (cloud-field spawning).\n"
    "    let spectrumBuf = null;\n"
    "    // \"Aurora ink-in-water\" particle cloud state. Sparse (~20-40 in flight),\n"
    "    // each particle drifts upward, blooms, and dissolves over ~2-3 sec.\n"
    "    // The FFT energy still drives the system - it just expresses itself\n"
    "    // as drifting light instead of a measured curve. Color is a smooth\n"
    "    // function of the spawning band's frequency (NOT ratio-aligned).\n"
    "    const cloudParticles = [];\n"
    "    const CLOUD_BANDS = 24;             // log-frequency analysis bands\n"
    "    let cloudBandEnergy = null;         // Float32Array, EMA per band\n"
    "    let cloudLastFrameTime = 0;\n"
    "    let cloudLastIdleSpawnTime = 0;     // ambient-star pacing\n"
    "    let cloudNextIdleInterval = 6;      // sec between ambient stars\n"
    "    // Kept for back-compat with any stray reader; the cloud field has\n"
    "    // no \"loudest band\" concept - both stay null/0.\n"
    "    let spectrumPeakRatio = null;\n"
    "    let spectrumPeakStrength = 0;\n"
)
assert OLD_STATE in text, "state-declaration block did not match"
text = text.replace(OLD_STATE, NEW_STATE, 1)

# Edit 2: Replace drawSpectrumIdleHint + drawSpectrum
OLD_BLOCK_START = "    // outline \xe2\x80\x94 energy at 5/4 paints in 5/4's color, energy at 3/2\n"
# fix: emdash bytes literal
OLD_BLOCK_START = "    // outline — energy at 5/4 paints in 5/4's color, energy at 3/2\n"
OLD_BLOCK_END   = "    function drawRulerBackdrop(ctx, W, H) {\n"
i_start = text.find(OLD_BLOCK_START)
i_end   = text.find(OLD_BLOCK_END, i_start)
assert i_start != -1 and i_end != -1, "could not locate spectrum-render block"

NEW_BLOCK_LINES = [
    "    // outline - replaced: was a per-segment ratio-colored sawtooth curve off",
    "    // the rail. Now a sparse aurora ink-in-water particle cloud. FFT energy",
    "    // spawns soft, drifting blobs whose hue is a smooth function of frequency",
    "    // (deep violet at the bass end -> amber at the top), drawn additively so",
    "    // overlapping particles brighten and color-mix. No ratios, no labels, no",
    "    // measurement readouts in this mode - the language is generative art.",
    "",
    "    // Maps a frequency in Hz to an aurora-style hue (degrees). Piecewise",
    "    // linear in log2(hz). Anchors: 60 Hz -> 280 deg deep violet, 250 Hz ->",
    "    // 220 deg royal blue, 1 kHz -> 160 deg cyan/teal, 4 kHz -> 60 deg warm",
    "    // yellow, 12 kHz -> 30 deg amber.",
    "    function cloudFreqToHue(hz) {",
    "      const lf = Math.log2(Math.max(20, Math.min(20000, hz)));",
    "      const stops = [",
    "        [5.9070, 280], // ~60 Hz",
    "        [7.9658, 220], // ~250 Hz",
    "        [9.9658, 160], // ~1 kHz",
    "        [11.9658, 60], // ~4 kHz",
    "        [13.5507, 30], // ~12 kHz",
    "      ];",
    "      if (lf <= stops[0][0]) return stops[0][1];",
    "      if (lf >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];",
    "      for (let i = 1; i < stops.length; i++) {",
    "        if (lf <= stops[i][0]) {",
    "          const t = (lf - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);",
    "          return stops[i - 1][1] + t * (stops[i][1] - stops[i - 1][1]);",
    "        }",
    "      }",
    "      return 200;",
    "    }",
    "",
    "    // Build a single particle. hz=0 means \"ambient/idle\" (caller should",
    "    // override hue to a cool wandering tone).",
    "    function makeCloudParticle(x, y, hz, energy, S) {",
    "      return {",
    "        x: x,",
    "        y: y,",
    "        vx: 0,",
    "        // Slow upward drift (canvas Y decreases upward). 7-13 px/sec at S=1.",
    "        vy: -(7 + Math.random() * 6) * S,",
    "        // Sinusoidal horizontal sway - period ~3-6 sec, amplitude ~3-8 px/sec.",
    "        // Reads as suspended ink shifting in slow currents.",
    "        swayPhase: Math.random() * Math.PI * 2,",
    "        swaySpeed: 1.0 + Math.random() * 1.5,",
    "        swayAmp: (3 + Math.random() * 5) * S,",
    "        age: 0,",
    "        life: 2.0 + Math.random() * 1.5,",
    "        hue: hz > 0 ? cloudFreqToHue(hz) : (210 + Math.random() * 50),",
    "        peakSize: (45 + energy * 60) * S,",
    "        energy: energy,",
    "      };",
    "    }",
    "",
    "    // Aurora ink-in-water cloud field. Returns null - there's no peak",
    "    // ratio to surface; the big-label code path sticks to the YIN source",
    "    // and fades out via pitchMix while in spectrum mode.",
    "    function drawSpectrum(ctx, geom, alphaMul) {",
    "      const S = geom.S;",
    "      const rulerX = geom.rulerX;",
    "      const rulerTop = geom.rulerTop;",
    "      const rulerBottom = geom.rulerBottom;",
    "      const rulerHeight = rulerBottom - rulerTop;",
    "      if (rulerHeight <= 0) return null;",
    "",
    "      // Visible spawn / display rect: a small margin off the rail to a",
    "      // small margin off the canvas's left edge.",
    "      const xMax = rulerX - 6 * S;",
    "      const xMin = 6 * S;",
    "      if (xMax <= xMin) return null;",
    "",
    "      // Frame timestep (seconds). Capped at 100 ms so a tab-resume can't",
    "      // launch every particle off-screen on a single integration step.",
    "      const tNow = performance.now();",
    "      const dt = cloudLastFrameTime > 0",
    "        ? Math.min(0.1, (tNow - cloudLastFrameTime) / 1000)",
    "        : 0.016;",
    "      cloudLastFrameTime = tNow;",
    "",
    "      // Same FFT source as the old curve - rawMicAnalyser is the full-band",
    "      // leaf node; falls back to the pitch-band analyser if needed.",
    "      const an = (micProcessing && micProcessing.rawMicAnalyser)",
    "                   ? micProcessing.rawMicAnalyser",
    "                   : analyser;",
    "",
    "      // Pull FFT and accumulate per-band energy. If no analyser yet (cold",
    "      // load), totalEnergy stays 0 and we fall through to the ambient-star",
    "      // path so the canvas still feels alive.",
    "      let totalEnergy = 0;",
    "      const minLf = Math.log2(60);",
    "      const maxLf = Math.log2(12000);",
    "      const lfSpan = maxLf - minLf;",
    "      if (an) {",
    "        const binCount = an.frequencyBinCount;",
    "        if (!spectrumBuf || spectrumBuf.length !== binCount) {",
    "          spectrumBuf = new Uint8Array(binCount);",
    "        }",
    "        try { an.getByteFrequencyData(spectrumBuf); } catch (_) {}",
    "        if (!cloudBandEnergy || cloudBandEnergy.length !== CLOUD_BANDS) {",
    "          cloudBandEnergy = new Float32Array(CLOUD_BANDS);",
    "        }",
    "        const sr = (audioContext && audioContext.sampleRate) || 48000;",
    "        const binHz = sr / (binCount * 2); // sampleRate / fftSize",
    "",
    "        const frameBands = new Float32Array(CLOUD_BANDS);",
    "        for (let i = 1; i < binCount; i++) {",
    "          const v = spectrumBuf[i];",
    "          if (v < 12) continue;          // noise-floor cull",
    "          const hz = i * binHz;",
    "          if (hz < 60 || hz > 12000) continue;",
    "          const lf = Math.log2(hz);",
    "          let bIdx = Math.floor((lf - minLf) / lfSpan * CLOUD_BANDS);",
    "          if (bIdx < 0) bIdx = 0;",
    "          else if (bIdx >= CLOUD_BANDS) bIdx = CLOUD_BANDS - 1;",
    "          const m = v / 255;",
    "          if (m > frameBands[bIdx]) frameBands[bIdx] = m;",
    "        }",
    "",
    "        // EMA: rises instantly to a louder live value, decays at ~0.55/frame",
    "        // when quieter. Held tones keep spawning; silence settles in ~0.5s.",
    "        const decay = 0.55;",
    "        for (let i = 0; i < CLOUD_BANDS; i++) {",
    "          const held = cloudBandEnergy[i] * decay;",
    "          const live = frameBands[i];",
    "          const v = live > held ? live : held;",
    "          cloudBandEnergy[i] = v;",
    "          totalEnergy += v;",
    "        }",
    "      }",
    "",
]

NEW_BLOCK_LINES += [
    "      // Spawn rate scales with total energy. Cap at ~6/sec total - even",
    "      // when very loud, sparse > frantic. Hard particle ceiling at 60.",
    "      const spawnRate = Math.min(6, 0.4 + totalEnergy * 1.6);",
    "      let spawnBudget = spawnRate * dt;",
    "      let attempts = 0;",
    "      while (spawnBudget > 0 && cloudParticles.length < 60 && attempts < 4) {",
    "        attempts++;",
    "        const p = Math.min(1, spawnBudget);",
    "        if (Math.random() > p) break;",
    "        spawnBudget -= 1;",
    "        if (!an || totalEnergy <= 0.05) break;",
    "",
    "        // Pick a band weighted by its energy.",
    "        let pick = Math.random() * totalEnergy;",
    "        let bIdx = 0;",
    "        for (let i = 0; i < CLOUD_BANDS; i++) {",
    "          pick -= cloudBandEnergy[i];",
    "          if (pick <= 0) { bIdx = i; break; }",
    "        }",
    "        const centerLf = minLf + ((bIdx + 0.5 + (Math.random() - 0.5) * 0.5) / CLOUD_BANDS) * lfSpan;",
    "        const hz = Math.pow(2, centerLf);",
    "        const yNorm = (centerLf - minLf) / lfSpan;",
    "        const y = rulerBottom - yNorm * rulerHeight;",
    "        const x = xMin + Math.random() * (xMax - xMin);",
    "        const energy = Math.max(0.25, Math.min(1, cloudBandEnergy[bIdx] * 1.2));",
    "        cloudParticles.push(makeCloudParticle(x, y, hz, energy, S));",
    "      }",
    "",
    "      // Ambient stars: when nothing's coming through, drop one low-energy",
    "      // particle every ~5-9 sec near canvas center. Cool wandering hue,",
    "      // longer lifetime - reads as distant atmosphere, not measurement.",
    "      if (totalEnergy < 0.04) {",
    "        if (cloudLastIdleSpawnTime === 0) {",
    "          cloudLastIdleSpawnTime = tNow;",
    "          cloudNextIdleInterval = 5 + Math.random() * 4;",
    "        } else if ((tNow - cloudLastIdleSpawnTime) / 1000 > cloudNextIdleInterval) {",
    "          cloudLastIdleSpawnTime = tNow;",
    "          cloudNextIdleInterval = 5 + Math.random() * 4;",
    "          const cx = (xMin + xMax) * 0.5 + (Math.random() - 0.5) * (xMax - xMin) * 0.4;",
    "          const cy = (rulerTop + rulerBottom) * 0.5 + (Math.random() - 0.5) * rulerHeight * 0.3;",
    "          const ambient = makeCloudParticle(cx, cy, 0, 0.32, S);",
    "          ambient.life = 3.0 + Math.random() * 1.5;",
    "          cloudParticles.push(ambient);",
    "        }",
    "      } else {",
    "        // Reset idle clock so a noisy moment doesn't immediately fire an",
    "        // ambient star the instant things go quiet again.",
    "        cloudLastIdleSpawnTime = tNow;",
    "      }",
    "",
    "      // Update + cull. Reverse iteration so splice-while-walking is safe.",
    "      for (let i = cloudParticles.length - 1; i >= 0; i--) {",
    "        const p = cloudParticles[i];",
    "        p.age += dt;",
    "        if (p.age >= p.life) { cloudParticles.splice(i, 1); continue; }",
    "        p.x += p.vx * dt + Math.cos(p.swayPhase + p.age * p.swaySpeed) * p.swayAmp * dt;",
    "        p.y += p.vy * dt;",
    "      }",
    "",
    "      if (cloudParticles.length === 0) return null;",
    "",
    "      // Render: additive blending so overlapping clouds brighten and",
    "      // color-mix where they meet. globalAlpha bakes in the mode-cross-",
    "      // fade so the field eases in/out with spectrumMix.",
    "      const a0 = ctx.globalAlpha || 1;",
    "      const oldComp = ctx.globalCompositeOperation;",
    "      ctx.save();",
    "      ctx.globalAlpha = a0 * alphaMul;",
    "      ctx.globalCompositeOperation = 'lighter';",
    "",
    "      for (let i = 0; i < cloudParticles.length; i++) {",
    "        const p = cloudParticles[i];",
    "        const t = p.age / p.life;",
    "        // Bell envelope: sin(pi*t)^0.65 - fast bloom, slow fade. Reads as",
    "        // the swell of a sung note rather than a flicker.",
    "        const env = Math.pow(Math.sin(Math.PI * t), 0.65);",
    "        if (env <= 0.001) continue;",
    "        const r = p.peakSize * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t), 0.5));",
    "        if (r <= 0.5) continue;",
    "        const aCenter = env * p.energy * 0.85;",
    "        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);",
    "        grad.addColorStop(0,    `hsla(${p.hue}, 92%, 65%, ${aCenter})`);",
    "        grad.addColorStop(0.45, `hsla(${p.hue}, 88%, 56%, ${aCenter * 0.45})`);",
    "        grad.addColorStop(1,    `hsla(${p.hue}, 80%, 45%, 0)`);",
    "        ctx.fillStyle = grad;",
    "        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);",
    "      }",
    "",
    "      ctx.globalCompositeOperation = oldComp;",
    "      ctx.restore();",
    "",
    "      spectrumPeakRatio = null;",
    "      spectrumPeakStrength = 0;",
    "      return null;",
    "    }",
    "",
]
NEW_BLOCK = "\n".join(NEW_BLOCK_LINES) + "\n"
text = text[:i_start] + NEW_BLOCK + text[i_end:]

# Edit 3: ladder + EDO alphas
OLD_LADDER = (
    "      // Ratio ladder: 100% in pitch view, ~45% in spectrum view (so it\n"
    "      // still reads as the user's reference frame even with the FFT\n"
    "      // curve dominating the canvas).\n"
    "      const ladderAlpha = 1 - 0.55 * spectrumMix;\n"
    "      // EDO grid: dimmer than the ratio ladder. We fade it to ~25% in\n"
    "      // spectrum mode rather than hiding it entirely so the chromatic\n"
    "      // bones are still visible without competing with the curve.\n"
    "      const edoAlpha = 1 - 0.75 * spectrumMix;\n"
)
NEW_LADDER = (
    "      // Ratio ladder: 100% in pitch view, ~5% in spectrum view (barely\n"
    "      // perceptible - the cloud field is the visual; the ladder is a\n"
    "      // ghost of structure, not a reference frame).\n"
    "      const ladderAlpha = 1 - 0.95 * spectrumMix;\n"
    "      // EDO grid: hidden entirely in spectrum mode. The cloud field\n"
    "      // deliberately strips all measurement scaffolding.\n"
    "      const edoAlpha = pitchMix;\n"
)
assert OLD_LADDER in text, "ladder/edo alpha block did not match"
text = text.replace(OLD_LADDER, NEW_LADDER, 1)

# Edit 4: big nearest-ratio label - pitch-only
OLD_LABEL = (
    "      // Big nearest-ratio label. In pitch mode this is the YIN-derived\n"
    "      // nearestRatio at indicatorOpacity. In spectrum mode it switches\n"
    "      // to the FFT-detected loudest band at an opacity derived from the\n"
    "      // peak's relative strength. The two sources cross-fade through\n"
    "      // pitchMix / spectrumMix so the label doesn't pop on toggle.\n"
    "      let labelRatio, labelOpacity;\n"
    "      if (spectrumMix > 0.5) {\n"
    "        labelRatio = spectrumPeakRatio;\n"
    "        labelOpacity = Math.min(1, spectrumPeakStrength * 4) * spectrumMix;\n"
    "      } else {\n"
    "        labelRatio = nearestRatio;\n"
    "        labelOpacity = indicatorOpacity * pitchMix;\n"
    "      }\n"
)
NEW_LABEL = (
    "      // Big nearest-ratio label. Pitch-mode only - the cloud field\n"
    "      // deliberately surfaces no measurement readout, so the label fades\n"
    "      // out smoothly via pitchMix when crossing into spectrum mode.\n"
    "      const labelRatio = nearestRatio;\n"
    "      const labelOpacity = indicatorOpacity * pitchMix;\n"
)
assert OLD_LABEL in text, "big-label gating block did not match"
text = text.replace(OLD_LABEL, NEW_LABEL, 1)

# Edit 5: stale ladderAlpha comment
OLD_COMMENT = (
    "      // Ratio ladder + Hz/cents labels. Wrapped so we can dim the\n"
    "      // whole ladder when the spectrum curve is in front\n"
    "      // (ladderAlpha = 1 in pitch view, ~0.45 in spectrum view).\n"
)
NEW_COMMENT = (
    "      // Ratio ladder + Hz/cents labels. Wrapped so we can dim the\n"
    "      // whole ladder when the cloud field is in front\n"
    "      // (ladderAlpha = 1 in pitch view, ~0.05 in spectrum view -\n"
    "      // barely-perceptible ghost so the structure isn't visible).\n"
)
assert OLD_COMMENT in text, "stale-comment block did not match"
text = text.replace(OLD_COMMENT, NEW_COMMENT, 1)

# Final integrity
assert text.rstrip().endswith("</html>"), "missing closing </html>"
assert "drawSpectrumIdleHint" not in text, "stale idle hint still present"
assert "spectrumEnergyEMA" not in text, "stale spectrum EMA still present"
assert "cloudFreqToHue" in text and "makeCloudParticle" in text, "new helpers missing"
assert "globalCompositeOperation = 'lighter'" in text, "additive blend missing"

with io.open(SRC_OUT, 'w', encoding='utf-8', newline='') as f:
    f.write(text)
print("OK", len(text), "bytes,", text.count("\n"), "lines, written to", SRC_OUT)
