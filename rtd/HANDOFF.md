# RTD Presentation — Claude Code Handoff

**Project:** Relative Tempo Derivation — Round 2 pitch deck
**Deployed at:** https://thomaslistens.github.io/RTD
**Repo:** github.com/ThomasListens/RTD
**Goal of the session this doc briefs:** a deployed skeleton with the visual identity locked, the audio engine working against placeholder tracks, and all 12 slides structured. Slide 1 is the one fully-built slide — the canary for whether the identity is right. Slides 2–12 ship as shells.

---

## 1. What this deck is

A live remote pitch for Merry Electronics (Dr. Peter Sung, Taiwan). The presenter, Thomas Meier, is pitching RTD — a methodology that derives an individualized musical tempo from a user's current perception of time. Round 1 built credibility. Round 2 needs to convert interest into a working arrangement, most likely a consulting contract with a licensing option.

The deck is not a conventional slide deck. It is a web presentation where:

- Audio builds cumulatively across slides (HR on 4, gait joins on 5, IAF joins on 6, etc.) — the medium is part of the pitch
- The URL itself is an artifact: a published site demonstrates that the presenter builds things
- It must survive Google Meet "share tab with audio"

The win condition for the deck: at the close, Peter asks "what would working together look like?" The win condition for *this build session* is narrower — the skeleton is deployed, slide 1 renders correctly, navigation and audio plumbing work, and the other 11 slides are clearly stubbed and ready for content.

---

## 2. Deployment

- GitHub Pages from `main`, repo root (no `/docs`).
- Site lives at `/RTD/`, **not** root. **All asset and link references must be relative** (`./audio/…`, `./assets/…`). An absolute path like `/audio/x.mp3` will 404 in production.
- No build step. The repo ships exactly what the browser runs.

---

## 3. Stack

Plain HTML, CSS, and JavaScript. No framework, bundler, or transpiler. Only external dependency is Google Fonts.

File layout:

```
/
├── index.html          # all 12 slides as sections in one page
├── styles.css          # visual identity, layout, typography
├── app.js              # navigation, audio engine, slide state
├── iaf.html            # independent headphones page (slide 6 handoff)
├── audio/              # placeholder loopable tracks + README describing each
├── assets/             # imagery / SVGs (reserved)
└── README.md           # local dev + overview
```

Why plain stack: the visual identity is specific and load-bearing, and a framework will fight the custom work. Plain files also keep the codebase legible for future Claude Code sessions.

---

## 4. Visual identity — LOCKED

Not a draft. Implement exactly. The identity has to stay coherent across all twelve slides.

### 4.1 Colors

```css
:root {
  --paper:    #F4F1EC;  /* warm paper background */
  --ink:      #1A1A1A;  /* charcoal — declarations, statements */
  --ink-blue: #143E63;  /* Prussian blue — geometry, questions, ink */
  --meta:     #6B6860;  /* warm gray — metadata only */
}
```

The ink-blue is blueprint/fountain-pen/denim blue — "working man's blue," not corporate blue. It appears in the elliptical geometry, focus markers, and italic questions: anywhere the deck *asks* rather than *declares*.

### 4.2 Typography

- **Body:** EB Garamond (Google Fonts). Classical revival, book-weight, pen-made.
- **Metadata:** IBM Plex Mono (Google Fonts). Instrument-scale, calibrated.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
:root {
  --font-body: 'EB Garamond', Garamond, 'Adobe Garamond Pro', Baskerville, Georgia, serif;
  --font-meta: 'IBM Plex Mono', 'Courier New', Courier, monospace;
}
```

Rules:

- Body scales with the viewport. Reference size is 32px in a 1600×900 design frame; use `clamp()` or viewport units so it stays proportional fullscreen.
- **Italic is reserved for questions and "ink" moments** — things being asked. Roman for assertions.
- Metadata: Plex Mono 400, 11–13px, `letter-spacing: 0.12em`, **lowercase**.
- **All text is sentence case.** Never ALL CAPS. Exceptions: unit abbreviations (Hz, BPM) and initialisms (RTD).
- **Two weights only** in the body: 400 and (rarely) 500. No bold.

### 4.3 Layout grid

Every slide is 16:9. Reference frame is 1600×900; scale to whatever viewport is available.

Interior margins: 72px horizontal, 40px vertical at the reference frame; scale proportionally.

Three horizontal tiers:

1. Top metadata — section name (left), slide number (right).
2. Content body — flexible.
3. Bottom metadata — URL (left), attribution (right).

Example top/bottom rows:

- Top-left `i. the question` · top-right `01 / 12`
- Bottom-left `thomaslistens.github.io/rtd` · bottom-right `thomas meier · 2026`

### 4.4 Elliptical motif — LOCKED

Every slide has an **SVG elliptical composition** as part of its visual grammar. Position, scale, and rotation vary per slide — the ellipse is the lever each slide uses to speak — but it is always present.

- Rendered as SVG behind content.
- Stroke: `var(--ink-blue)`, `stroke-width: 1` to `1.2`, always with `vector-effect="non-scaling-stroke"`.
- Primary ellipse opacity 0.6–0.8. Optional ghost ellipse opacity 0.2–0.3.
- Foci may be rendered as small filled `<circle>` elements (r=4 or 5) when the foci carry meaning. On slide 1 they do — they mark the "start and end" between which the question lives.
- The ellipse is never decorative. For stub slides in this session, a default centered ellipse is fine; content slides will refine it later.

### 4.5 Slide 1 reference — the canary

Slide 1 ships production-complete. If slide 1 is right, the identity is right. Match this exactly:

```html
<section class="slide" data-slide-index="0" data-section="i. the question">
  <svg class="slide-ellipse" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="800" cy="650" rx="720" ry="280" fill="none" stroke="var(--ink-blue)" stroke-width="1.2" vector-effect="non-scaling-stroke" opacity="0.7" />
    <ellipse cx="800" cy="650" rx="920" ry="380" fill="none" stroke="var(--ink-blue)" stroke-width="0.8" vector-effect="non-scaling-stroke" opacity="0.28" />
    <circle cx="137" cy="650" r="5" fill="var(--ink-blue)" opacity="0.9" />
    <circle cx="1463" cy="650" r="5" fill="var(--ink-blue)" opacity="0.9" />
  </svg>

  <div class="slide-meta slide-meta-top">
    <span>i. the question</span>
    <span>01 / 12</span>
  </div>

  <div class="slide-body">
    <div class="statement">
      <p>Time is everything.</p>
      <p>It sounds different for everyone.</p>
    </div>
    <p class="question">What does your time sound like?</p>
  </div>

  <div class="slide-meta slide-meta-bottom">
    <span>thomaslistens.github.io/rtd</span>
    <span>thomas meier · 2026</span>
  </div>
</section>
```

Load-bearing positions:

- Statement block top edge ~22% from the top of the slide.
- Question center **aligned with viewBox y=650** (72.2% from top) — on the focus axis of the ellipse. This alignment is the point of the slide; do not drift it.
- Question: italic, ink-blue, **same font-size as the statement** (not larger), centered horizontally.
- Statement: charcoal ink, roman, left-aligned to the 72px interior margin.

"Right" means proportionally correct at any viewport size — not pixel-exact, since the layout scales.

---

## 5. Slide template

All 12 slides share chrome: paper background, ellipse layer, metadata tiers.

```html
<section class="slide" data-slide-index="N" data-section="iii. the build">
  <svg class="slide-ellipse" ...>...</svg>
  <div class="slide-meta slide-meta-top">...</div>
  <div class="slide-body"><!-- slide-specific --></div>
  <div class="slide-meta slide-meta-bottom">...</div>
</section>
```

All slides are in the DOM at all times. Visibility is controlled by toggling `.slide.active`. Transition: 600–800ms opacity crossfade.

---

## 6. Audio architecture

The most critical technical piece. State-based multi-track engine with crossfade transitions tied to slide changes.

### 6.1 Concept

Each slide declares a target audio **state**: a map of track IDs to volumes. On slide change, the engine crossfades all tracks toward the target over ~800ms. Tracks absent from the new state fade to 0. This gives cross-slide continuity: tracks that persist keep playing (at possibly new volumes); new tracks fade in; retired tracks fade out.

Do not implement per-slide audio as independent file triggers — that breaks continuity and is the wrong architecture.

### 6.2 API

```js
const AudioEngine = {
  tracks: {},              // { trackId: HTMLAudioElement }
  currentVolumes: {},      // { trackId: 0..1 }
  muted: false,
  masterVolume: 0.8,

  async loadTracks(manifest) { /* preload, loop=true, volume=0 */ },
  async transitionTo(nextState, fadeDurationMs = 800) {
    // crossfade; play any track reaching volume > 0; pause tracks that settle at 0
  },
  toggleMute() { /* ... */ },
  setMasterVolume(v) { /* 0..1 */ },
  resume() { /* first user gesture */ },
};
```

### 6.3 Slide audio declarations

```js
const SLIDES = [
  { index: 0,  section: 'i. the question',     audio: {} },
  { index: 1,  section: 'ii. the method',      audio: { sustained_tone: 0.3 } },
  { index: 2,  section: 'ii. the method',      audio: { sustained_tone: 0.3 } },
  { index: 3,  section: 'iii. the build',      audio: { hr_pulse: 0.7 } },
  { index: 4,  section: 'iii. the build',      audio: { hr_pulse: 0.5, gait_layer: 0.7 } },
  { index: 5,  section: 'iii. the build',      audio: { hr_pulse: 0.4, gait_layer: 0.5, iaf_shimmer: 0.6 } },
  { index: 6,  section: 'iii. the build',      audio: { ambient_bed: 0.4 } },
  { index: 7,  section: 'iv. the demo',        audio: {} },
  { index: 8,  section: 'iv. the demo',        audio: {} },   // demo-driven, handled later
  { index: 9,  section: 'v. what comes next',  audio: { ambient_bed: 0.3 } },
  { index: 10, section: 'v. what comes next',  audio: {} },
  { index: 11, section: 'vi. close',           audio: {} },
];
```

Volumes are starting points — final levels get tuned when the real audio is rendered.

### 6.4 Placeholder audio

Commit real audio files, even if trivial, so the engine plumbing is verifiable. When the final content replaces these files later, `app.js` should not need to change.

Concrete recipe: a short Python script using `numpy` + `wave` can emit all five WAVs in one run, then convert to MP3 with ffmpeg (or just ship WAV if file size is fine — 2–4s loops are tiny).

Tracks:

- `sustained_tone` — quiet 110 Hz sine
- `hr_pulse` — soft thud every ~0.86s (70 BPM placeholder)
- `gait_layer` — soft tick in a 2:3 ratio to HR
- `iaf_shimmer` — quiet filtered noise, high register
- `ambient_bed` — soft drone

Each file has an entry in `audio/README.md` documenting tempo / loop length / intent, so the later sonification pass has context.

### 6.5 Browser audio notes

- Browsers require a user gesture before audio plays. On the first `keydown` or `click`, call `AudioEngine.resume()`. If slide 1 has silence anyway, this is invisible.
- Do **not** auto-pause on tab blur. During a Google Meet screen-share the tab often loses focus (the presenter clicks their own window, opens notes, etc.); stopping audio mid-pitch would be worse than the cost of audio playing unnoticed.
- Target Chrome. That's what Meet prefers and what the presenter will use.

### 6.6 Headphones-moment page (slide 6)

Slide 6 renders a button: **"Listen in your headphones →"**. Clicking opens `iaf.html` in a new tab — a minimal, identity-consistent listening page with a large play/pause. The audience listens on their own chain, uncompressed.

`iaf.html` does **not** share the main audio engine. Keep it independent. For this session it's a functional shell with placeholder audio and correct styling; the real IAF sonification is a later pass.

---

## 7. Navigation

Keyboard (listen on `window`):

- `→` / `Space` / `PageDown` → next
- `←` / `PageUp` → previous
- `Home` / `End` → first / last
- `1`–`9`, `0` → jump to slides 1–10
- `M` → mute toggle
- `F` → fullscreen toggle
- `Esc` → exit fullscreen

URL hash syncs with the active slide (`#N`). Loading with a hash jumps there; refreshing preserves position.

Transition: 600–800ms opacity crossfade. Nothing fancier.

Progress bar: 3px tall, full viewport width, pinned to the very bottom, `var(--ink-blue)`, fills `(slideIndex + 1) / totalSlides`. Visually quiet. No chrome around it.

No other visible navigation UI. The slide number in the top-right metadata is the only other indicator. This is a presenting deck, not a browsing one.

---

## 8. Slide inventory

| # | Section | Purpose | Audio state |
|---|---------|---------|-------------|
| 01 | i. the question | Opening — Mandarin spoken, English on screen | silence |
| 02 | ii. the method | RTD method named | sustained_tone 0.3 |
| 03 | ii. the method | RTD defined (the one sentence) | sustained_tone 0.3 |
| 04 | iii. the build | Heart rate — first biomarker, first pulse | hr_pulse 0.7 |
| 05 | iii. the build | Gait — first ratio relationship | hr_pulse 0.5 + gait_layer 0.7 |
| 06 | iii. the build | IAF — individualization + headphones handoff | hr_pulse 0.4 + gait_layer 0.5 + iaf_shimmer 0.6 |
| 07 | iii. the build | Other biomarkers & context | ambient_bed 0.4 |
| 08 | iv. the demo | Demo frame (what the demo is and isn't) | silence |
| 09 | iv. the demo | Live demo | demo-driven (placeholder) |
| 10 | v. what comes next | Product categories that become buildable | ambient_bed 0.3 |
| 11 | v. what comes next | Roadmap | silence |
| 12 | vi. close | Partnership frame | silence |

For every non-slide-1 slide in this session: a centered `<p class="placeholder">Slide N — [purpose]</p>` inside `.slide-body`, styled subtly (meta-gray, italic, serif). Clear seam for future content.

---

## 9. Build order

1. **Scaffold.** Create `index.html`, `styles.css`, `app.js`, `README.md`, `iaf.html`, `audio/`, `assets/`. Set up Google Fonts, CSS custom properties, base reset, viewport meta.
2. **CSS foundation.** Color variables, typography, slide grid, metadata tiers, ellipse layer, fullscreen styles.
3. **Slide 1 production-ready.** Match §4.5 exactly. Verify colors, ellipse position, focus circles, question alignment with the focus axis, EB Garamond loaded, Plex Mono lowercase with letter-spacing. The canary — do not proceed until slide 1 is proportionally right.
4. **Template extraction.** Reusable chrome. Confirm slide 1 still renders.
5. **Slides 2–12 shells.** Correct section name + number, default ellipse, placeholder body text.
6. **Navigation.** Keyboard, active-slide state, opacity crossfade, hash sync, progress bar.
7. **Audio engine** per §6. Include a dev-mode console log of state transitions.
8. **Placeholder audio.** Generate the five tracks per §6.4. Commit real files. Verify engine crossfades between slides.
9. **`iaf.html`.** Minimal styled shell with a play/pause button and placeholder audio.
10. **Deploy.** Push `main`; confirm the site loads at `thomaslistens.github.io/RTD`.

Screen-share verification in Google Meet is a user task — flag that this is the last step the user needs to do, and what they should look for (smooth transitions, no audio pops, keyboard nav, hash sync).

---

## 10. Constraints

**Must:**

- Work offline after initial load (Google Fonts aside)
- Render consistently in current Chrome, Firefox, Safari
- Survive Google Meet "share tab with audio"
- Load in under 3s on a typical connection
- No tracking, analytics, or external requests beyond Google Fonts
- Use relative paths everywhere

**Must not:**

- Use a framework, bundler, or build step
- Use browser storage (localStorage, sessionStorage, IndexedDB) — unnecessary here
- Implement dark mode — paper-only
- Implement mobile responsiveness beyond basic viewport scaling
- Add visible navigation UI beyond the thin progress bar

**Out of scope for this session** (later passes):

- Real content for slides 2–12
- Real sonification audio
- The slide 9 interactive RTD demo
- Presenter speaker notes
- PDF export

---

## 11. Verification

When the session is done, all of these should be true:

- [ ] Site deployed and loading at `https://thomaslistens.github.io/RTD`
- [ ] Slide 1 matches §4.5 proportionally
- [ ] All 12 slides present, keyboard-navigable, with correct section names and numbers
- [ ] Ellipse on every slide (default centered on 2–12 is fine)
- [ ] EB Garamond (body) and IBM Plex Mono (metadata) render correctly
- [ ] Colors match exactly: `#F4F1EC` / `#1A1A1A` / `#143E63` / `#6B6860`
- [ ] Keyboard controls work: arrows/space, Home/End, 1–9/0, M, F, Esc
- [ ] URL hash syncs with slide index; reload preserves position
- [ ] Progress bar updates on slide change
- [ ] Audio engine loads placeholder tracks and crossfades between slide states
- [ ] Global mute works
- [ ] `iaf.html` loads independently with its own play/pause and placeholder audio
- [ ] README documents local dev and the codebase

---

## 12. Notes for the builder

- **Hold the visual identity strictly.** Don't substitute colors, fonts, or spacing because "it looks similar." This deck's coherence is the pitch.
- **Hold the audio architecture strictly.** State-based with crossfade. Not per-slide triggers.
- **Leave obvious seams.** Every stub slide should announce itself so content can be added without archaeology later.
- **Comments explain WHY, not WHAT**, and only where the reason isn't obvious from the code (e.g. the y=650 question alignment is load-bearing — that merits a short comment; a for-loop over slides does not).
- **Ask only when the spec is genuinely ambiguous.** For local implementation choices (which `clamp()` values, how to structure the engine's internal promise chain, etc.) use your judgment. For spec decisions that change behavior the presenter will see on stage, ask.
