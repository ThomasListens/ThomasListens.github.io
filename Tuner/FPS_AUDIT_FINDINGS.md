# Tuner FPS audit — stated vs. actual

**Scope:** static read of `Tuner/index.html`. No exports recorded.

## The slider

`recFpsSlider` (line 2436): `min=1 max=60 step=1 value=30`. Read into `recFps` via `applyRecFps()` (4951), clamped to `[1, 60]`, persisted to `localStorage`.

## Two recording paths, two stories

### 1. Per-take recording (the main path) — fps is honoured

`canvas.captureStream(recFps)` at line **8203**. User's value flows through directly. `MediaRecorder` (8287) is constructed without an explicit frameRate, so it inherits the stream's pacing. The draw loop is throttled by `RECORD_DRAW_INTERVAL_MS = Math.floor(1000 / recFps)` (4950, 4958) so the rAF tick rate matches.

**Verdict:** the user-selected fps is wired to the encoder. No hardcoded override on this path.

### 2. Stacked-reel composite (bake-down export) — fps is overridden

Line 7803:

```js
const COMPOSITE_OUTPUT_FPS = n <= 3 ? 30 : (n <= 5 ? 20 : 15);
const videoStream = canvas.captureStream(COMPOSITE_OUTPUT_FPS);
```

The user's `recFps` is **ignored entirely** on this path. Output fps is a function of stack depth, full stop. A user who records all takes at 14 fps and then bakes down a 4-cell composite gets a 20 fps MP4 — a stated-vs-actual mismatch by design, with no UI surfaces the override.

The faststart remux (7251) is `-c copy`, so it preserves whatever fps the recorder emitted. It is not a source of drift.

## Likely source of 14 stated / 12.056 actual

If the doc's number came from a **per-take** recording: the code passes 14 to `captureStream(14)`, but Chromium's captureStream is a *target*, not a contract. At low fps with a busy main thread, the actual emitted frameRate routinely lands below the request. The throttle uses `Math.floor(1000/14) = 71 ms` (ideal: 71.43 ms), which slightly *over*-permits draws, so the leak isn't the draw gate — it's captureStream pacing under load. Nothing in the code forces 12.056 specifically; that's a browser-side artifact.

If the doc's number came from a **stacked-reel export**: there's no path from 14 to 12.056 in the override table (30/20/15). The discrepancy there would be 14 stated → 20 actual (or 15/30), which is bigger and structural.

## Fixes

**Path 2 (real bug):** either expose the composite-fps override in the UI ("Composite reduces to N fps at stack depth ≥4 for stability"), or pass `recFps` through and let the stack-depth table act as a *ceiling* rather than an unconditional override: `const COMPOSITE_OUTPUT_FPS = Math.min(recFps, n <= 3 ? 60 : (n <= 5 ? 20 : 15));`

**Path 1 (cosmetic):** if the slider label needs to reflect reality, query `videoTrack.getSettings().frameRate` after `captureStream()` and display that alongside the requested value. The diagnostic at line 8222 already reads it — just surface it.

Sources: [Tuner/index.html](computer://C:\Users\meier\OneDrive\Documents\GitHub\ThomasListens.github.io\Tuner\index.html)
