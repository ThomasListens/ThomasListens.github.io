# Composite FPS — architecture, the one-rate constraint, and per-layer ticking

A design note building on `FPS_AUDIT_FINDINGS.md`. Investigation + design only; no feature code here.

## 1. How the composite actually renders

`exportStackedReel` (index.html ~7314–8120) builds the reel like this:

1. For each take in `harmonyStack`, it creates a hidden `<video>` element pointed at that take's recorded MP4 blob (7580–7596). One video element per layer.
2. It computes a grid layout (`getStackCells`, 7374) — N cells, each a rectangle on one offscreen canvas.
3. It opens **one** capture stream on **one** canvas: `canvas.captureStream(COMPOSITE_OUTPUT_FPS)` (7804), feeds it to **one** `MediaRecorder` (7818), and mixes all layers' audio through a Web Audio graph into the same recorder.
4. It plays every `<video>` and runs a single `requestAnimationFrame` loop, `drawFrame` (7954–8048). Each tick: paint the whole canvas black (`fillRect(0,0,W,H)`, 7962–7963), then loop over the cells and `drawImage` each layer's *current* video frame into its rectangle (contain-fit, 7965–8021). The loop is throttled to the master rate via `FRAME_INTERVAL_MS = 1000 / COMPOSITE_OUTPUT_FPS` (7950).

So: many source videos, one compositing canvas, one encoder, one output rate.

## 2. Why per-layer frame rate can't live in one file

A single encoded video has exactly one frame rate for the entire frame. There is no container concept of "this rectangle updates at 7 fps while that one updates at 30." The composite is a single canvas captured by a single stream — every region shares the one master clock. This is a hard constraint of the pipeline (and of MP4/WebM generally), confirmed by the single-canvas/single-recorder structure above.

## 3. The achievable version of Thomas's dream — and good news

The dream ("each layer keeps its own rate") is reachable *as a visual result*, because per-layer cadence is **already preserved implicitly** by the current design. Each source `<video>` plays its own MP4 at that MP4's own recorded rate. `drawImage` only ever paints whatever frame the decoder is currently presenting. A layer recorded at 7.5 fps presents a new frame every ~133 ms, so across a 30 fps master output it repeats for ~4 master frames, then ticks — visibly 7.5 fps inside a 30 fps file. The code comment at 7764–7773 describes exactly this, and it is the right mental model for the feature.

This means the simplest route to the dream needs no new draw code at all:

- Record each layer at the rate you want for it (set the fps slider before each take).
- Keep the composite master rate **high** (≥ the fastest layer's rate). The hardcoded tier already keeps it at 30/20/15 — *high relative to a stop-motion layer*. Lowering the composite to a low recFps would destroy this, not help it.

The single caveat: if a layer's source rate exceeds the master rate, that layer is down-sampled to the master (a 30 fps layer in a 15 fps composite shows every other frame). For stop-motion layers (low rates) this never bites.

### When you want *deterministic, explicit* per-layer ticks

Relying on the source decoder's presentation timing gives slight phase jitter — a 12.056 fps source doesn't divide 30 cleanly, so ticks land 2–3 master frames apart irregularly. For clean, chosen, jitter-free ticking (and to set a display rate independent of the recorded rate), add explicit per-cell redraw-gating.

**What's missing today:** the take object (`harmonyStack.push`, 8656–8671) stores `audioBuffer, videoBlob, durationSec, gain, bakeDownDelayMs` — but **not the fps the take was recorded at**. `recFps` is a single global holding only the *last* take's value, so per-layer rate is unrecoverable at export time. Step one is to capture `recFps` into each take at push time (e.g. `srcFps: recFps`).

**Draw-loop change:** the loop is already a per-cell `for` loop, which is the easy part. The change has two pieces:

- Track `lastTickMs[i]` per cell. Redraw cell `i` only when `nowMs - lastTickMs[i] >= 1000 / displayFps[i]`.
- Stop clearing the whole canvas every frame. The current global `fillRect(0,0,W,H)` (7962) wipes every cell each master tick, so a non-redrawn cell would go black. Instead, clear *per cell* (fill only that cell's rect black, then `drawImage`) so un-ticked cells retain their pixels from the previous master frame.

That's a localized, moderate change — no architectural rewrite. Master rate stays high (30); each cell's `displayFps[i]` gates its own redraw. A layer's tick rate becomes fully under control and exact.

## 4. The straightforward bug fix (separate from the feature)

The audit flagged line 7803 hardcoding `30/20/15` and ignoring user fps. The minimal "respect the slider" change is:

```js
const TIER_CEIL = n <= 3 ? 30 : (n <= 5 ? 20 : 15);
const COMPOSITE_OUTPUT_FPS = Math.max(15, Math.min(recFps, TIER_CEIL));
```

**But the tier exists for two real reasons** (documented at 7775–7797), and a fix must preserve both:

- **Mobile perf ceiling.** At 4+ layers, N `drawImage` calls + capture sampling + 1080×1920 H.264 encode saturate Pixel-class SoCs at 30 fps; the source videos fall behind real-time and `drawImage` paints stale pixels, drifting video behind audio. The 20/15 tiers cut per-second work to keep sync. So the tier must remain a **ceiling**.
- **A 15 fps floor.** Below ~15 fps, `captureStream` on a 1080×1920 canvas emits too few unique frames and the muxer produces `video_dur < audio_dur` → the "stretched/frozen/misaligned" symptom. So the fix must clamp **up** to 15.

Net: respecting the slider means using it as the *request*, capped by the stack-depth ceiling and floored at 15 — not blindly handing `recFps` to `captureStream`. And note this global fix does **not** deliver per-layer rates; it only changes the single master rate. The dream feature (section 3) is the separate, more interesting path.

Sources: [Tuner/index.html](computer://C:\Users\meier\OneDrive\Documents\GitHub\ThomasListens.github.io\Tuner\index.html), [FPS_AUDIT_FINDINGS.md](computer://C:\Users\meier\OneDrive\Documents\GitHub\ThomasListens.github.io\Tuner\FPS_AUDIT_FINDINGS.md)
