# Stack Mode — Architecture & Logic

Reference doc for adding multi-take harmony recording + multi-pane video export to the Tuner web app. Self-contained — read this and [index.html](index.html) and you have the full picture.

---

## Goal

Add a "Stack mode" that lets the user record up to 6–8 layered takes (camera + mic per take), monitoring previously committed layers as they overdub, and exporting one Instagram-ready video that arranges each take as its own pane in a layout sized to the take count.

Primary use case: harmony videos for Instagram Reels (9:16) and Feed (4:5).

Secondary use cases (Phase 5, scoped separately): overdub over an imported audio file (no panel for the imported layer) and overdub over an imported video clip (imported clip gets a panel or backdrop). The architecture below accommodates both as small extensions once the primary case is solid.

---

## Constraints — DO NOT CHANGE

These are load-bearing. Several represent prior debugging that took real effort.

1. **MediaRecorder mime hierarchy.** [`pickRecorderMime()`](index.html#L4325) at [index.html:4325](index.html#L4325). H.264 Baseline @ L3.0 + AAC-LC is pinned first because it's the broadly-safe combo for IG. Stack-mode takes use this same selector; the final composite encodes to the same profile. Don't touch the candidate list.

2. **FFmpeg.wasm version + core.** 0.11.x with `@ffmpeg/core-st` (single-threaded) at [index.html:4267](index.html#L4267). Do NOT upgrade to 0.12.x and do NOT switch to multi-threaded core. Single-threaded is required because the page isn't cross-origin-isolated and SharedArrayBuffer is unavailable. The 0.11.x API style (`createFFmpeg`, `FS('writeFile')`, `ffmpeg.run(...args)`) is what the rest of the code expects.

3. **FFmpeg exit-code defensive check.** 0.11.x's `ffmpeg.run()` sometimes throws `Program terminated with exit(0)` on subsequent runs. The pattern at [index.html:4298–4312](index.html#L4298) checks `FS('stat', 'output.mp4')` to distinguish real failure from spurious throw. Mirror this in `compositeSession()`.

4. **Audio path branching (processed vs raw).** [index.html:4379–4400](index.html#L4379). When voice FX or drone is on, recorder pulls from `micProcessing.dest`; otherwise raw mic track. Both paths exist to avoid rhythmic clicks when AudioContext and MediaRecorder share a track. Stack-mode capture follows the same logic — do not introduce a new audio path.

5. **AudioContext mic track cloning.** [index.html:3991–4001](index.html#L3991). The AudioContext gets a clone of the mic track; original goes to MediaRecorder. Don't simplify by sharing one track between them — Chrome makes audible clicks when both consume the same MediaStreamTrack.

6. **Browser-paced 30fps canvas capture.** [index.html:4366–4376](index.html#L4366). `canvas.captureStream(30)` was chosen over `captureStream(0)` + manual `requestFrame` because the latter made every main-thread stall a video clock stall, and the muxer popped on each realignment. Stack mode reuses this pattern (see "Capture per take" below).

7. **Single-file deploy.** [index.html](index.html) is the deliverable. ~6,130 lines today. Don't split into separate JS files unless explicitly green-lit. Revisit only if the file crosses ~8,000 lines.

8. **Camera stream lifecycle.** Once acquired in [`setupCamera()`](index.html#L4065) at [index.html:4065](index.html#L4065), the camera stream stays alive across record start/stop. Stack mode keeps it alive across all takes in a session — never re-request `getUserMedia` between takes. Re-request only on flip-camera or session exit.

9. **No emojis in code or UI.** Project convention.

10. **Final composite encoder params must match today's single-take output.** See "Encoder parameters" below. The IG-validated profile is hard-won; do not change unless re-validated against IG end-to-end.

---

## User flow (primary harmony case)

1. User taps Stack-mode toggle near the existing record button.
2. **First-time only:** "set this once" pill points at the sync-offset slider with a hint to use the built-in sync test. After that, the slider is hidden behind a long-press on a take chip.
3. User taps record. Camera + mic capture take 1 (no monitor playback — nothing committed yet).
4. User taps stop. Take 1 audio plays back. Pill: `[keep] [redo]`.
5. User taps keep. A "1" chip appears in the take rail.
6. User taps record. Take 1 audio plays in headphones starting at session t=0; camera + mic capture take 2.
7. Stop → mix-so-far (takes 1 + 2 audio) plays back as review. `[keep] [redo]`.
8. Repeat to N takes. Default soft cap = 6; 7–8 available with a render-time warning.
9. User taps **done** → opens export sheet with format toggle (Reel 9:16 / Feed 4:5) and an estimated render time.
10. Composite runs. Progress overlay reuses [`showRemuxIndicator`](index.html#L4228). Output blob delivered to the same save/share path as today's single-take export.

**Redo is last-take-only and pre-commit.** Once the user moves to the next take, prior takes are baked in. (Decision rationale below.)

---

## Existing systems Stack mode integrates with

### Audio graph
- Single shared `AudioContext` from [`getAudioContext()`](index.html#L2218) at [index.html:2218](index.html#L2218). All Stack-mode audio (take buffers, monitor mix, etc.) MUST share this context.
- Mic chain built by [`buildMicProcessing()`](index.html#L3649) at [index.html:3649](index.html#L3649); outputs to `micProcessing.dest` (a `MediaStreamAudioDestinationNode`).
- Mic source attached via [`attachMicSource()`](index.html#L3947) at [index.html:3947](index.html#L3947).
- Master output gain at [index.html:1843](index.html#L1843) ([`setMasterOutputLevelDb`](index.html#L1843)).
- LUFS-M + peak metering loop at [`startMeterLoop`](index.html#L2261) / [`updateMeterDisplay`](index.html#L2299) ([index.html:2261](index.html#L2261)). Reuse for input-peak feedback during Stack record.
- Tanpura uses OfflineAudioContext → AudioBuffer → AudioBufferSourceNode at [`renderTanpuraBuffer`](index.html#L5018). Stack take playback uses the same shape.

### Video / camera
- [`setupCamera(facingMode)`](index.html#L4065) at [index.html:4065](index.html#L4065): `getUserMedia({ video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })`. Audio is intentionally separate.
- Camera frames render to `rulerCanvas` via [`drawCameraBackground`](index.html#L2557) and [`drawCameraOnto`](index.html#L2542) inside the main [`draw()`](index.html#L2653) rAF loop.
- Tuner overlay (ratios, ruler, brackets) draws on top of the camera in the same `draw()` loop.

### Recording today (single-take)
- [`startRecording()`](index.html#L4344) at [index.html:4344](index.html#L4344) captures `rulerCanvas.captureStream(30)` (camera + tuner overlay baked in) plus an audio track selected by the processed-vs-raw branch.
- MediaRecorder bitrates: `videoBitsPerSecond: 8_000_000`, `audioBitsPerSecond: 128_000` ([index.html:4427](index.html#L4427)).
- After stop: blob is remuxed via [`remuxToFastStartMP4()`](index.html#L4275) at [index.html:4275](index.html#L4275) — `-c copy -movflags +faststart`, no re-encode. This is the IG-safety pass.

### FFmpeg.wasm
- Lazily loaded via [`loadFFmpeg()`](index.html#L4243) at [index.html:4243](index.html#L4243). Cached in `_ffmpegPromise` for reuse.
- API is 0.11.x: `createFFmpeg()`, `FS('writeFile' / 'readFile' / 'unlink')`, `ffmpeg.run(...args)`, `ffmpeg.setProgress(cb)`.
- See [`remuxToFastStartMP4()`](index.html#L4275) for the canonical invocation pattern (write inputs, run, defensive stat, read output, unlink).

### UI patterns
- Record-mode controls live in slim strips at the bottom (drone+verb FX strip, level slider, LUFS readout). Stack-mode UI must fit this language.
- Long-press hidden settings: [`setupTitleLongPress`](index.html#L5324) at [index.html:5324](index.html#L5324). Settings hide toggle: [`toggleSettingsHidden`](index.html#L5310) at [index.html:5310](index.html#L5310). Reuse the long-press pattern for surfacing the sync-offset slider after first-run.
- LocalStorage persistence: [`saveSession`](index.html#L5399) / [`loadSession`](index.html#L5452) at [index.html:5399](index.html#L5399). Sync offset and last-used format persist via this path.
- Indicator pill: [`showRemuxIndicator`](index.html#L4228) / [`hideRemuxIndicator`](index.html#L4235) at [index.html:4228](index.html#L4228). Reuse for composite progress.

---

## Data model

```js
session = {
  active: false,             // true while in stack mode
  takes: [],                 // array of Take, in record order
  maxTakes: 6,               // soft cap; user can override to 8 with warning
  syncOffsetMs: 80,          // user-tuned, persisted to localStorage
  format: 'reel',            // 'reel' (9:16) | 'feed' (4:5)
};

take = {
  id: 'take-{n}',
  blob: Blob,                // MediaRecorder output (MP4 H.264 baseline preferred)
  mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  durationMs: number,
  audioBuffer: AudioBuffer,  // decoded audio for monitor playback (lazy on commit)
  level: 1.0,                // per-take mix-bus level, default unity
};
```

**Persistence:**
- `session.syncOffsetMs` and `session.format` persist via existing `saveSession`/`loadSession`.
- `session.takes` is in-memory only. Closing the tab discards them. (IndexedDB persistence is a Phase-2 nicety, deferred.)

---

## Recording pipeline

### Capture per take

We need clean per-take footage (no tuner overlay) so panes composite cleanly.

**Use a hidden offscreen canvas** (`stackCanvas`, e.g. 1080×1920 or 1920×1080 depending on camera orientation) that draws ONLY the camera frame each tick — reuse [`drawCameraOnto`](index.html#L2542). Capture this canvas at 30fps via `captureStream(30)`.

Reasoning (do not skip): recording the raw `cameraStream` directly was considered and rejected because it loses the browser-paced 30fps muxer pacing pattern documented at [index.html:4366–4376](index.html#L4366). Using a clean offscreen canvas preserves that pattern while giving us overlay-free frames.

The clean canvas is drawn in the same rAF loop as `rulerCanvas` (cheap — it's a single drawImage per frame).

**Audio track selection:** unchanged from today's logic at [index.html:4379–4400](index.html#L4379). Processed path when voice FX or drone is on; raw path otherwise.

**Mime + bitrates:** identical to today (`pickRecorderMime`, 8 Mbps video, 128 kbps audio).

**MediaRecorder lifecycle:** one fresh `MediaRecorder` instance per take. Started fresh on each record press, stopped on stop press. Blob saved to `pendingTake` (not yet committed).

### Monitor playback during overdub

When user taps record on take N (N ≥ 2):

1. For each committed take 1..N-1, build an `AudioBufferSourceNode` from `take.audioBuffer`. Wrap each in its own `GainNode` set to `take.level`.
2. Sum through a `monitorMixGain` GainNode → `audioContext.destination`. **Headphone monitor only — NOT into `micProcessing.dest`.** Only the live mic should be captured for the new take.
3. Schedule all source `start(t0)` and the new MediaRecorder `start()` at the same `t0 = audioContext.currentTime + 0.05` so all sources lock to the same clock with a tiny lead-in.
4. On stop: stop and discard all source nodes. Decode the just-recorded blob's audio to `AudioBuffer` lazily on commit (deferred until needed for review or next take's monitor).

### Per-take review

After stop on take N:
- Decode the new (uncommitted) blob's audio to `AudioBuffer` — if not already.
- Sum buffers for committed takes 1..N-1 plus the pending take N, played through `monitorMixGain` to destination. No mic input.
- Display `[keep] [redo]` pill near record button.
- `redo` → discard pending blob and audio buffer; back to pre-record state for take N.
- `keep` → push the pending take onto `session.takes`, update take rail.

---

## Latency compensation

### Why

When user records take 2 while monitoring take 1, the audio they hear is delayed by the device's *output* latency, and the audio they record is delayed by the *input* latency. Net round-trip is 50–200ms depending on device + headphones + browser. Without compensation, take 2 lands behind take 1 in the final mix and the harmony goes flammy. Compounds across stacks.

### Mechanism

Single per-device value: `syncOffsetMs`. Applied at composite time to BOTH the audio AND video of takes 2..N — shifting them earlier by `syncOffsetMs`. Take 1 is the time anchor.

In FFmpeg this is done via `trim` + `setpts` for video and `atrim` + `asetpts` for audio:

```
[1:v]trim=start={SYNC_OFFSET_MS}ms,setpts=PTS-STARTPTS,scale=PANE_W:PANE_H[v1];
[1:a]atrim=start={SYNC_OFFSET_MS}ms,asetpts=PTS-STARTPTS,volume={level}[a1];
```

This drops the first `syncOffsetMs` of the take's video and audio and resets their PTS to zero, putting them in sync with take 1.

**Why both audio AND video:** the user's mouth in take 2 is also lagged. If we shift only audio, lips will be slightly behind voice in the multi-pane composite. Shift both for consistency.

### Persistence and test mechanic

`syncOffsetMs` persists to localStorage via `saveSession`/`loadSession`. Default 80ms. Range 0–300ms.

**Phase 1:** ship the slider only, with a pill that reads "If your harmonies sound late, drag right. If early, drag left." User tunes once for their device + headphones combo and forgets.

**Phase 4: built-in sync test** (deferred):
1. Record 3 metronome-cued claps (no playback) — throwaway take 1.
2. Record take 2 with throwaway take 1 playing back, prompting user to clap on the same beats.
3. Auto-detect offset from clap onset times in take 2 vs metronome times. Set `syncOffsetMs`.
4. Discard throwaway session.

Onset detection: simple amplitude-threshold peak-pick on the recorded audio buffer should be sufficient for clap-on-quiet-background.

---

## Final composite (FFmpeg)

### Layouts by take count

Pane sizes are chosen so each take fills its slot at native resolution. Source camera is 1920×1080 ideal — we always have headroom to scale down.

| N | Reel (9:16, 1080×1920) | Feed (4:5, 1080×1350) |
| --- | --- | --- |
| 1 | full-bleed 1080×1920 | full-bleed 1080×1350 |
| 2 | 2×1 vertical: each 1080×960 | 2×1 vertical: each 1080×675 |
| 3 | top hero 1080×640 + bottom 2×(540×1280) | 1×3 vertical: each 1080×450 |
| 4 | 2×2: each 540×960 | 2×2: each 540×675 |
| 5–6 | 2×3: each 540×640 | 2×3: each 540×450 |
| 7–8 | 2×4: each 540×480 | 2×4: each 540×337 |

Layouts auto-selected. No user picker. (Decision rationale below.)

### Filter graph (template)

For N takes, with `OFF` = `session.syncOffsetMs`:

```
# Video lane — take 0 is anchor; takes 1..N-1 trim+resync
[0:v]scale=PW0:PH0,setpts=PTS-STARTPTS[v0];
[i:v]trim=start={OFF}ms,setpts=PTS-STARTPTS,scale=PWi:PHi[vi];   for i in 1..N-1
[v0][v1]...[v{N-1}] xstack=inputs=N:layout={LAYOUT_SPEC}[vout];

# Audio lane — same trim pattern, then mix and limit
[0:a]volume={take[0].level},asetpts=PTS-STARTPTS[a0];
[i:a]atrim=start={OFF}ms,asetpts=PTS-STARTPTS,volume={take[i].level}[ai];   for i in 1..N-1
[a0][a1]...[a{N-1}] amix=inputs=N:duration=longest:dropout_transition=0[amix];
[amix] alimiter=limit=0.891:attack=5:release=50 [aout]
```

`xstack`'s `layout` parameter is `x_y|x_y|...` — build the string from the layout table per N + format.

**`amix duration=longest`:** final clip length matches the longest take. Shorter takes go silent at the end. This is intentional — usually all takes are nearly the same length and the longest is the canonical session length.

**`alimiter limit=0.891`** ≈ −1 dBFS ceiling. Attack 5ms, release 50ms = transparent peak limiting. **No `loudnorm`. No `dynaudnorm`.** This is the only automatic gain stage in the pipeline; preserves dynamics by design.

### Encoder parameters (must match today's output)

```
-c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p
-b:v 8M -maxrate 8M -bufsize 16M
-c:a aac -profile:a aac_low -b:a 128k -ar 48000
-movflags +faststart
-r 30
```

This matches the H.264 Baseline @ L3.0 + AAC-LC profile that today's MediaRecorder output produces and that's been validated against IG. Do not change unless re-validated end-to-end.

### Composite invocation pattern

```js
async function compositeSession(session) {
  const { ffmpeg, fetchFile } = await loadFFmpeg();
  showRemuxIndicator('Compositing... (preparing)');

  for (let i = 0; i < session.takes.length; i++) {
    ffmpeg.FS('writeFile', `take${i}.mp4`, await fetchFile(session.takes[i].blob));
  }

  const { layoutSpec, paneSizes } = pickLayout(session.takes.length, session.format);
  const filterComplex = buildFilterComplex(session, layoutSpec, paneSizes);

  ffmpeg.setProgress(({ ratio }) => {
    if (typeof ratio === 'number' && isFinite(ratio)) {
      showRemuxIndicator(`Compositing... ${Math.round(ratio * 100)}%`);
    }
  });

  const args = [
    ...session.takes.flatMap((_, i) => ['-i', `take${i}.mp4`]),
    '-filter_complex', filterComplex,
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0',
    '-pix_fmt', 'yuv420p',
    '-b:v', '8M', '-maxrate', '8M', '-bufsize', '16M',
    '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '128k', '-ar', '48000',
    '-movflags', '+faststart',
    '-r', '30',
    'output.mp4'
  ];

  try {
    await ffmpeg.run(...args);
  } catch (e) {
    let outputExists = false;
    try { ffmpeg.FS('stat', 'output.mp4'); outputExists = true; } catch (_) {}
    if (!outputExists) {
      throw new Error('Composite failed: ' + (e && e.message ? e.message : String(e)));
    }
    // exit(0)-but-output-written: clean success, fall through.
  }

  const data = ffmpeg.FS('readFile', 'output.mp4');
  for (let i = 0; i < session.takes.length; i++) {
    try { ffmpeg.FS('unlink', `take${i}.mp4`); } catch (_) {}
  }
  try { ffmpeg.FS('unlink', 'output.mp4'); } catch (_) {}

  return new Blob([data.buffer], { type: 'video/mp4' });
}
```

The defensive `FS('stat')` check mirrors [index.html:4304](index.html#L4304) — required because 0.11.x throws spuriously.

---

## UI integration

All new UI lives near the existing record-mode bottom strips. No new persistent surface above the ruler. Existing tools (drone, voice FX, level slider, LUFS readout, ruler) remain available DURING Stack-mode recording — user explicitly wants all tools usable while stacking.

### Stack-mode toggle
Small chip in the existing chip row. Off by default. When on: take rail appears, record button enters stack-aware mode (each press appends a take rather than starting a single-take recording).

### Take rail
Row of small numbered dots/chips just above the record button row, mirror-balancing the LUFS readout on the right. Each chip = one committed take. Empty/dim chips for upcoming slots. Long-press a chip:
- (Phase 4) reveals per-take level slider.
- (Phase 2+) reveals sync-offset slider when on the most recently committed take.

### Keep/redo pill
Transient pill near the record button, appears immediately after stop, dismissed by tapping `keep`, `redo`, or starting the next record. Same visual language as the existing record-mode pills.

### Sync-offset slider
Hidden by default. Surfaced via long-press (above) OR through the existing settings panel ([`toggleSettingsHidden`](index.html#L5310)). On first Stack-mode entry, a "set this once" hint pill points at the slider — auto-dismisses after first interaction or after 10s.

### Format toggle
"Reel / Feed" toggle in the export sheet at end-of-session. Defaults to last-used format from localStorage; first-run default is `reel`.

### Done / export trigger
A "done" affordance appears once `session.takes.length >= 2`. Tapping it opens the export sheet (format toggle + render-time estimate + composite trigger).

---

## Audio levels policy

Three stages, each doing one job:

1. **Per-take capture: unity gain.**
   - No auto-gain on capture. Mic hits MediaRecorder at the level produced by the existing chain (raw or processed per [index.html:4379–4400](index.html#L4379)).
   - The existing LUFS-M / peak meter ([index.html:2261](index.html#L2261)) is the user's clip-watching tool during record.
   - Per-take `level` defaults to 1.0; only surfaced via long-press; only used at composite mix.

2. **Mix bus: straight sum.**
   - No normalization (no `loudnorm`, no `dynaudnorm`). Four voices in unison sum to ~+6 dBFS — that's expected musical compression coming *from the arrangement*, not from automation flattening each take.
   - `amix` with default weighting plus per-take `volume={level}` only.

3. **Master limiter on final composite only.**
   - `alimiter limit=0.891 attack=5 release=50` — −1 dBFS ceiling, transparent.
   - Strictly to prevent IG-side clipping. NOT to massage tone.
   - Only automatic gain stage in the entire pipeline.

Net effect: dynamics survive, take-to-take volume relationships are real, file doesn't clip. Musicality preserved.

---

## Performance constraints (Pixel 7, outdoor heat)

The composite is the expensive step. Single-threaded WASM H.264 encoding 6 takes × 60s on a Pixel 7 will be slow and at risk of thermal throttling (especially outdoors in summer).

Mitigations baked into Phase 3:

- **Pane-size scaling at filter time.** Sources are scaled DOWN to pane resolution (e.g. 540×640 for a 2×3 grid) BEFORE `xstack`, not after. This is the main perf lever. The filter graph above already does this.
- **Single-threaded core retained.** `@ffmpeg/core-st`. SAB unavailable; multi-threaded crashes. See Constraint 2.
- **Default cap 6 takes.** 7–8 available with a render-time-warning confirmation.
- **Real progress UI.** `ffmpeg.setProgress(...)` callback piped to `showRemuxIndicator`.
- **Pre-warn pill.** Before `ffmpeg.run()`, show "This will take ~Xs — keep screen on" with a rough estimate. (Estimate heuristic: ~1.5× total source duration for 4 takes at 540×960; tune with measurement.)
- **No re-render of intermediate state.** Per-take review is audio-only. Full composite runs exactly once, at end-of-session.

**Things to NOT try as optimizations** (already considered, rejected):
- Multi-threaded core — requires SharedArrayBuffer; not available without cross-origin isolation.
- WebCodecs-based encoding — would be faster but is significant parallel infrastructure work; out of scope.
- Persisting takes between app sessions — out of scope for Phase 1; in-memory only.

---

## Build phases

Land in this order. Each phase is independently shippable.

### Phase 1: Take capture (no monitor, no compositor)
- Stack-mode toggle in the chip row.
- `session` state model + module-level state.
- Hidden offscreen `stackCanvas` that draws clean camera frames each rAF tick.
- Per-take MediaRecorder using `stackCanvas.captureStream(30)` + the same audio-track selection as today.
- Take rail UI (numbered chips, dim placeholders).
- Keep/redo pill (no audio review yet — just visual confirmation that a take exists).
- Camera stream stays alive across takes (no `setupCamera()` calls between takes).

**Goal:** user can record up to 6 takes back-to-back with mic + camera; we hold 6 blobs in memory. No monitor playback yet, no composite yet.

### Phase 2: Monitor playback + sync offset
- On take commit: lazily decode blob audio to `AudioBuffer` (use `audioContext.decodeAudioData`).
- During record N (N≥2): build source nodes + monitor mix gain → `ctx.destination`; schedule alongside MediaRecorder off `ctx.currentTime + 0.05`.
- Per-take review playback (mix-so-far audio, no mic).
- Sync offset slider (default 80ms, range 0–300ms), persisted via existing `saveSession`/`loadSession`.
- Slider hidden behind long-press on take chip; first-run hint pill.

**Goal:** user can record harmonies and hear what they're stacking against. Tunes the sync slider once, persists.

### Phase 3: Compositor
- `compositeSession()` next to [`remuxToFastStartMP4`](index.html#L4275).
- `pickLayout(N, format)` returning `layoutSpec` + per-pane sizes.
- `buildFilterComplex(session, layoutSpec, paneSizes)` — string build from the template.
- Encoder args identical to spec above.
- Progress via `setProgress` → `showRemuxIndicator`.
- Pre-warn pill with render-time estimate.
- Output blob delivered to the same save/share path as today's single-take export (find the save path in current `startRecording` stop handler at [index.html:4463+](index.html#L4463) and reuse).

**Goal:** end-of-session export produces a valid 1080×1920 MP4 ready for IG.

### Phase 4: Polish
- Format toggle (Reel / Feed) in the export sheet.
- Per-take level long-press control.
- Built-in sync test (auto-detect offset).
- Cap-7-8 confirmation flow with longer render-time warning.

### Phase 5: Imported media (separate scope)
- Drag-in audio file → first session layer, no panel.
- Drag-in video file → first session layer, optional panel or backdrop.

---

## Decisions log (with rationale)

When an edge case surfaces, use this to judge whether the original logic still holds.

- **Per-take review = mix-so-far audio, not solo.**
  *Why:* user is judging harmony, not the take in isolation. Audio-only mixing is cheap.
  *Alternative considered:* solo new take. Rejected.

- **Redo = last-take-only, mid-session, pre-commit.**
  *Why:* per-take redo at any time would require keeping each take individually re-renderable inside the composite, which adds significant complexity for unclear value.
  *User confirmed:* "once I commit then it's baked in. I'm okay with that."
  *Alternative considered:* per-take redo at any time. Deferred indefinitely.

- **Layout = auto-selected by N.**
  *Why:* the user can only judge the right arrangement after seeing the takes; pre-picking risks framing for a layout that doesn't end up reading well.
  *User confirmed:* "auto select layout depending on N is the right move. keeping it simple here is going to be best."
  *Alternative considered:* user picker before record. Rejected.

- **Format = 9:16 default, 4:5 toggle.**
  *Why:* Reels gets the most reach for harmony videos and gives the most vertical real estate for stacked panes. Feed (4:5) is one extra layout column — near-trivial.
  *Alternative considered:* 9:16 only. Rejected — user wanted optionality.

- **Latency comp = slider (Phase 1), auto-detect (Phase 4).**
  *Why:* slider is 10 minutes of work and the user tunes once per device + headphones. Real loopback calibration is ~half a day and sometimes flaky.
  *Alternative considered:* skip compensation. Rejected — overdubs would always feel late.

- **Take capture = clean offscreen canvas, NOT raw cameraStream.**
  *Why:* preserves the browser-paced 30fps muxer pacing pattern documented at [index.html:4366–4376](index.html#L4366).
  *Alternative considered:* raw cameraStream → MediaRecorder. Rejected.

- **Audio: no normalization, master limiter only.**
  *Why:* normalization removes musicality. The arrangement's natural dynamics matter.
  *User confirmed:* "as long as the final limiting is solid I know we'll be okay, but we might want to have a streamlined approach here as well. but we also don't want to normalize, since that might remove musicality."
  *Alternative considered:* per-take loudnorm. Rejected.

- **Tuner overlay NOT in final composite.**
  *Why:* clean panes only; tuner is a recording-time aid.
  *User confirmed indirectly via:* "as long as it's clear and organized and everyone can see each part, that's what matters most to me."

- **Existing tools available DURING Stack mode.**
  *User confirmed:* "yes we need to think about conveniently use all the tools."
  *Implementation:* drone, voice FX, level slider, LUFS, ruler all remain. Take rail and keep/redo pill add to existing strips, not replace them.

- **Single-file deployment preserved.**
  *Why:* current deploy works; splitting is a separate decision.
  *Trigger to revisit:* file crosses ~8,000 lines.

---

## Open questions

None blocking Phase 1. To verify during Phase 3 dev:

- Does `xstack` perform acceptably on Pixel 7 for N=6 at the spec'd pane sizes? Bench during Phase 3. If too slow, fallback option is sequential `overlay` filters (more filter calls but lighter peak memory).
- Does `ffmpeg.setProgress` fire reliably during `xstack` on 0.11.x? If not, fall back to a synthetic progress bar (elapsed / estimated).
- Do mixed-duration takes confuse the muxer? Test with takes of differing lengths. If yes, force CFR upstream of xstack via `fps=30` filter on each input.

---

## Quick reference — file:line index of integration points

| Concern | Location |
| --- | --- |
| AudioContext getter | [index.html:2218](index.html#L2218) |
| LUFS / peak meter loop | [index.html:2261](index.html#L2261) |
| Mic processing chain | [index.html:3649](index.html#L3649) |
| Mic source attach | [index.html:3947](index.html#L3947) |
| AudioContext mic-clone pattern | [index.html:3991](index.html#L3991) |
| Camera setup | [index.html:4065](index.html#L4065) |
| Flip camera | [index.html:4091](index.html#L4091) |
| Indicator pill | [index.html:4228](index.html#L4228) |
| FFmpeg load | [index.html:4243](index.html#L4243) |
| FFmpeg core-st path | [index.html:4267](index.html#L4267) |
| Remux fast-start | [index.html:4275](index.html#L4275) |
| Defensive exit-code check | [index.html:4298](index.html#L4298) |
| Recorder mime selector | [index.html:4325](index.html#L4325) |
| startRecording (single-take) | [index.html:4344](index.html#L4344) |
| Audio path branching | [index.html:4379](index.html#L4379) |
| MediaRecorder bitrates | [index.html:4427](index.html#L4427) |
| Hidden settings toggle | [index.html:5310](index.html#L5310) |
| Long-press pattern | [index.html:5324](index.html#L5324) |
| saveSession / loadSession | [index.html:5399](index.html#L5399) |
| Tanpura buffer rendering | [index.html:5018](index.html#L5018) |
