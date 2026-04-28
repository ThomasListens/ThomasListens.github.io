# RTD — Build Slides 4, 5, 6 Implementation

**Project:** Relative Tempo Derivation presentation deck
**Repo:** thomaslistens.github.io/RTD
**Scope of this session:** Implement slides 4 (heart), 5 (gait), and 6 (IAF) with their content, composition, schematic, and audio integration.
**Prerequisites:** The skeleton from the previous session is deployed. Visual identity and audio engine are in place. This session adds content to three of the build slides.

---

## 0. Pre-flight fixes to the existing deck

Before building new slides, fix these issues in the current `index.html`:

### 0.1 Slide 1 ellipses

The ellipses on slide 1 (`data-slide-index="1"`) are currently filled and positioned incorrectly. Replace the SVG block with:

```html
<svg class="slide-ellipse" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="orbit orbit-outer"
           cx="800" cy="650" rx="920" ry="380"
           fill="none"
           stroke="var(--ink-blue)" stroke-opacity="0.28" stroke-width="0.8"
           vector-effect="non-scaling-stroke" />
  <ellipse class="orbit orbit-inner"
           cx="800" cy="650" rx="720" ry="280"
           fill="none"
           stroke="var(--ink-blue)" stroke-opacity="0.7" stroke-width="1.2"
           vector-effect="non-scaling-stroke" />
  <g class="dot-wrap dot-wrap-left">
    <circle class="dot dot-left" cx="137" cy="650" r="5" fill="var(--ink-blue)" opacity="0.9" />
  </g>
  <g class="dot-wrap dot-wrap-right">
    <circle class="dot dot-right" cx="1463" cy="650" r="5" fill="var(--ink-blue)" opacity="0.9" />
  </g>
</svg>
```

**Key fixes:** all ellipses use `fill="none"` (stroked, not filled — this is a deck-wide rule); ellipses are positioned with `cy="650"` so the curve arches from the bottom of the slide; foci dots are at the actual mathematical focus positions (137 and 1463) on the focus axis.

### 0.2 Apply the same fix to slide 2's echo ellipses

Slide 2 (`data-slide-index="2"`) currently echoes slide 1's geometry. Apply the same `fill="none"`, `cy="650"`, and corrected foci positions to its `orbit-trace` ellipses and echo dots. The outer trace is `rx="920" ry="380"`, inner trace is `rx="720" ry="280"`, dots at (137, 650) and (1463, 650).

### 0.3 Verify CSS rule

Add to `styles.css` if not already present:

```css
.slide-ellipse ellipse { fill: none; }
```

This is a backstop — even if any future slide forgets to set `fill="none"` explicitly, the CSS prevents the filled-blob mistake.

### 0.4 Acknowledge the 13-slide count

The blank opener at slide-index 0 makes this a 13-slide deck. Update slide numbering metadata accordingly (already correct in current code: `02 / 13` through `13 / 13`). Document in `README.md` that slide 0 is intentionally blank — a "silence before the deck begins" state for screen-share preparation.

---

## 1. Slide 4 — Heart Rate

**Section:** iii. the build
**Slide number metadata:** `05 / 13`
**Audio state:** `{ hr_pulse: 0.7 }`

### 1.1 Composition (three vertical zones)

```
┌─────────────────────────────────────────┐
│  iii. the build              05 / 13    │  ← top metadata
│                                         │
│         It starts with a pulse.         │  ← ZONE 1: declaration (charcoal, ~22% from top)
│                                         │
│         ╱─────────────╲                 │
│        │  ❤ + waveform │                │  ← ZONE 2: visual (centered, ~36–62% vertical)
│         ╲─────────────╱                 │
│                                         │
│              a 1 of 1.                  │  ← ZONE 3: personal payoff (italic ink-blue, ~78% from top)
│                                         │
│  thomaslistens.github.io/rtd     ...    │  ← bottom metadata
└─────────────────────────────────────────┘
```

### 1.2 Content

**Top declaration** (Zone 1):

```html
<p class="declaration">It starts with a pulse.</p>
```

CSS:
- `font-family: var(--font-body)` (EB Garamond)
- `font-size: clamp(22px, 2.6vw, 32px)`
- `font-weight: 400`
- `color: var(--ink)` (charcoal)
- `text-align: center`

**Center visual** (Zone 2):

A composed SVG with two layers — the heart in charcoal, the waveform in ink-blue passing through it. The waveform should be a simplified PQRST pulse, repeating across the visual width.

```html
<div class="hero-visual hero-visual--heart" aria-hidden="true">
  <svg viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg">
    <!-- Heart, sketched anatomical-suggestive, charcoal -->
    <g class="heart-figure" transform="translate(310, 30)" stroke="var(--ink)" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">
      <path d="M 90 30
               C 75 8, 38 4, 22 28
               C 6 52, 18 90, 48 118
               C 70 138, 90 158, 100 178
               C 113 158, 144 132, 165 108
               C 190 80, 195 46, 178 26
               C 162 6, 128 8, 110 30
               C 105 38, 100 44, 100 44
               C 100 44, 95 38, 90 30 Z" />
      <!-- Subtle interior anatomical hatching -->
      <path d="M 55 65 Q 73 73 90 78" opacity="0.35" />
      <path d="M 115 78 Q 138 82 155 73" opacity="0.35" />
      <path d="M 80 105 Q 102 114 124 105" opacity="0.35" />
    </g>
    <!-- Waveform passing through, ink-blue -->
    <path class="cardiac-wave" d="M 0 130 L 220 130 L 245 130 L 258 122 L 270 138 L 282 92 L 294 168 L 306 130 L 320 130 L 540 130 L 560 122 L 572 138 L 584 92 L 596 168 L 608 130 L 622 130 L 800 130"
          stroke="var(--ink-blue)" stroke-width="1.4" fill="none" vector-effect="non-scaling-stroke" opacity="0.9" />
  </svg>
</div>
```

CSS for the hero visual container:
- `display: flex; justify-content: center;`
- SVG width: `clamp(380px, 50vw, 560px)`
- Note: the heart drawing in this code is a draft — when you implement, the heart should be redrawn to look more anatomically convincing (the current path is a starting point, but feet on slide 5 had similar issues; if visually awkward, redraw using better reference paths)

**Bottom personal payoff** (Zone 3):

```html
<p class="payoff">a 1 of 1.</p>
```

CSS:
- `font-family: var(--font-body)`
- `font-style: italic`
- `font-weight: 400`
- `font-size: clamp(22px, 2.6vw, 32px)`
- `color: var(--ink-blue)` (Prussian)
- `text-align: center`

### 1.3 Ellipse for slide 4

The slide 4 ellipse is positioned to *frame* the central visual rather than dominate. Single primary ellipse, no ghost outer:

```html
<svg class="slide-ellipse" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="800" cy="450" rx="720" ry="380" fill="none" stroke="var(--ink-blue)" stroke-width="0.8" vector-effect="non-scaling-stroke" opacity="0.18" />
</svg>
```

This is intentionally quieter than slide 1's foreground ellipse — a held context shape, not a focal element.

### 1.4 Audio behavior

When slide 4 becomes active, the audio engine transitions to `{ hr_pulse: 0.7 }`. The `hr_pulse` track should loop cleanly at ~70 BPM (or whatever the placeholder is). When advancing to slide 5, the engine will fade hr_pulse to 0.5 and bring gait_layer in at 0.7.

### 1.5 Optional animation (Phase 2 — implement only if straightforward)

If time permits, animate the cardiac wave to traverse left-to-right in sync with hr_pulse audio. A simple `<path>` with `stroke-dasharray` animation, or an SVG `<animate>` element, can make the pulse appear to *travel*. Keep this subtle — the wave moves across the visual once per beat, then resets. If implementation is non-trivial, skip and leave for a polish pass.

### 1.6 No schematic on slide 4

Slide 4 does NOT have the ratio schematic at the bottom. The schematic appears for the first time on slide 5 — when there are actually two terms to relate. Slide 4 establishes "the one"; slide 5 introduces what it relates to.

---

## 2. Slide 5 — Gait

**Section:** iii. the build
**Slide number metadata:** `06 / 13`
**Audio state:** `{ hr_pulse: 0.5, gait_layer: 0.7 }`

### 2.1 Composition (three vertical zones, evolved from slide 4)

```
┌─────────────────────────────────────────┐
│  iii. the build              06 / 13    │
│                                         │
│            You set the pace.            │  ← ZONE 1: personal claim (italic ink-blue, ~22% from top)
│                                         │
│         👣 stride visualization         │  ← ZONE 2: visual (centered, ~33–62%)
│                                         │
│          ↟  2  :  1  ❤                  │  ← ZONE 3: schematic (mono, centered, ~76%)
│           stride : pulse                │
│                                         │
│  thomaslistens.github.io/rtd     ...    │
└─────────────────────────────────────────┘
```

Note the rhetorical inversion from slide 4: the personal voice is now AT THE TOP. The deck has earned the right to lead with intimacy by this slide.

### 2.2 Content

**Top personal claim** (Zone 1):

```html
<p class="personal-top">You set the pace.</p>
```

CSS:
- `font-family: var(--font-body)`
- `font-style: italic`
- `font-weight: 400`
- `font-size: clamp(22px, 2.6vw, 32px)`
- `color: var(--ink-blue)`
- `text-align: center`

**Center visual** (Zone 2):

Two footprints in sketched-anatomical style, with small step markers below indicating cadence.

```html
<div class="hero-visual hero-visual--gait" aria-hidden="true">
  <svg viewBox="0 0 800 280" xmlns="http://www.w3.org/2000/svg">
    <!-- Left foot, slightly back-left -->
    <g class="foot foot-left" transform="translate(220, 60)" stroke="var(--ink)" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">
      <!--
        IMPORTANT: the placeholder foot path below is functional but visually awkward.
        When implementing, redraw the foot using a better anatomical reference. Aim for:
        - heel pad at top (rounded, wider than midfoot)
        - midfoot/arch in the middle
        - ball/forefoot widening near the bottom
        - toe articulations at the very bottom
        A photograph of a footprint or a free anatomical illustration is good reference.
        The current path is a starting point only — if it looks like a Rorschach blot,
        redraw it.
      -->
      <path d="M 30 10 C 18 12, 10 20, 10 35 C 10 55, 14 90, 22 120 C 28 145, 38 162, 52 162 C 66 162, 72 145, 72 122 C 72 100, 68 80, 64 60 C 60 40, 54 22, 44 14 C 40 11, 35 10, 30 10 Z" />
    </g>
    <!-- Right foot, slightly forward-right -->
    <g class="foot foot-right" transform="translate(420, 30)" stroke="var(--ink)" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">
      <path d="M 50 10 C 62 12, 70 20, 70 35 C 70 55, 66 90, 58 120 C 52 145, 42 162, 28 162 C 14 162, 8 145, 8 122 C 8 100, 12 80, 16 60 C 20 40, 26 22, 36 14 C 40 11, 45 10, 50 10 Z" />
    </g>
    <!-- Stride direction line: dashed, ink-blue -->
    <line x1="230" y1="240" x2="490" y2="240" stroke="var(--ink-blue)" stroke-width="0.8" vector-effect="non-scaling-stroke" opacity="0.4" stroke-dasharray="2,4" />
    <!-- Step markers along the line -->
    <circle cx="262" cy="240" r="2.5" fill="var(--ink-blue)" opacity="0.55" />
    <circle cx="458" cy="240" r="2.5" fill="var(--ink-blue)" opacity="0.55" />
  </svg>
</div>
```

**Bottom schematic** (Zone 3):

The schematic appears for the first time. Render as a typographic ratio expression with glyphs in ink-blue, numbers and colons in charcoal:

```html
<div class="schematic">
  <div class="schematic-ratio">
    <span class="glyph glyph-stride">↟</span>
    <span class="num">2</span>
    <span class="colon">:</span>
    <span class="num">1</span>
    <span class="glyph glyph-heart">♥</span>
  </div>
  <div class="schematic-legend">stride : pulse</div>
</div>
```

CSS:
```css
.schematic {
  position: absolute;
  top: 76%;
  left: 0;
  right: 0;
  text-align: center;
}
.schematic-ratio {
  font-family: var(--font-meta);
  font-size: clamp(16px, 1.6vw, 20px);
  letter-spacing: 0.1em;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 14px;
}
.schematic-ratio .glyph {
  color: var(--ink-blue);
}
.schematic-ratio .num {
  color: var(--meta);
}
.schematic-ratio .colon {
  color: var(--meta);
  font-size: 1.2em;
  font-weight: 300;
}
.schematic-legend {
  font-family: var(--font-meta);
  font-size: clamp(9px, 0.9vw, 11px);
  color: var(--meta);
  letter-spacing: 0.14em;
  margin-top: 12px;
}
```

### 2.3 Ellipse for slide 5

Same default contextual ellipse as slide 4. The schematic and visual carry the slide; the ellipse is held context.

```html
<svg class="slide-ellipse" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="800" cy="450" rx="720" ry="380" fill="none" stroke="var(--ink-blue)" stroke-width="0.8" vector-effect="non-scaling-stroke" opacity="0.18" />
</svg>
```

### 2.4 Audio behavior

On slide entry: hr_pulse fades from 0.7 to 0.5, gait_layer fades in to 0.7. The placeholder gait_layer should loop at a 2:1 ratio to hr_pulse (i.e., if hr_pulse is 70 BPM = 0.86s period, gait_layer is 140 SPM = 0.43s period). The audience hears the ratio.

---

## 3. Slide 6 — IAF (Individual Alpha Frequency)

**Section:** iii. the build
**Slide number metadata:** `07 / 13`
**Audio state:** `{ hr_pulse: 0.4, gait_layer: 0.5, iaf_shimmer: 0.6 }`

### 3.1 Composition (three vertical zones plus invitation)

```
┌─────────────────────────────────────────┐
│  iii. the build              07 / 13    │
│                                         │
│   Your perspective makes a difference.  │  ← ZONE 1: opening claim (italic ink-blue, ~18%)
│                                         │
│       🎧 head + 2 EEG waveforms         │  ← ZONE 2: visual (centered, ~30–58%)
│                                         │
│   Tempo from your perception of time.   │  ← ZONE 3a: bridge (charcoal, ~64%)
│                                         │
│      α  10 : ↟ 2 : 1 ❤                  │  ← ZONE 3b: schematic (mono, ~74%)
│      alpha : stride : pulse             │
│                                         │
│      [ Listen in your headphones → ]    │  ← INVITATION: separated, ~88%
│                                         │
│  thomaslistens.github.io/rtd     ...    │
└─────────────────────────────────────────┘
```

Slide 6 has more elements than 4 or 5 because IAF is the slide that does the most conceptual work in the build sequence. Layout is tighter; spacing must still feel composed, not cramped.

### 3.2 Content

**Top personal claim** (Zone 1):

```html
<p class="personal-top">Your perspective makes a difference.</p>
```

(Same CSS as slide 5's personal-top: italic, ink-blue, EB Garamond.)

**Center visual** (Zone 2):

A side-profile head wearing headphones, with two EEG-style waves emerging from the head region at different frequencies. **Both waves are blue-family** — primary ink-blue (#143E63) and a secondary blue distinguishable from it. This keeps the deck within its existing palette while showing two distinct frequencies.

For the secondary blue, use `#5C7FA3` — a desaturated, lighter blue that reads clearly as "different" from the Prussian without introducing red.

```html
<div class="hero-visual hero-visual--iaf" aria-hidden="true">
  <svg viewBox="0 0 900 320" xmlns="http://www.w3.org/2000/svg">
    <!-- Side-profile head, sketched, charcoal -->
    <g class="head-figure" transform="translate(360, 30)" stroke="var(--ink)" stroke-width="1.4" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">
      <!--
        PLACEHOLDER PATH — REDRAW BEFORE SHIPPING.
        Target: a simple side-profile of a head facing right, with:
        - cranium curve (top of head)
        - subtle brow / nose / mouth / chin profile (very minimal — anatomical, not cartoon)
        - neck stub at the base
        - hair line indicated minimally or omitted entirely
        Aim for 19th-century anatomical illustration energy. A profile bust.
        Reference: Da Vinci profile sketches, Vesalius head studies.
      -->
      <path d="M 100 20 C 60 25, 30 60, 30 110 C 30 150, 50 180, 80 195 L 80 220 L 95 220 L 100 200 C 130 195, 155 175, 165 145 L 175 130 L 180 115 L 175 100 L 170 85 C 160 50, 135 25, 100 20 Z" />
      <!-- Subtle profile features -->
      <path d="M 165 130 L 170 138 L 165 145" opacity="0.5" /><!-- nose hint -->
      <path d="M 158 165 L 168 165" opacity="0.4" /><!-- mouth hint -->
    </g>
    <!-- Headphones over the head -->
    <g class="headphones" transform="translate(360, 30)" stroke="var(--ink)" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.85">
      <!-- Headband arc -->
      <path d="M 50 35 Q 100 5, 165 30" />
      <!-- Earcup (visible side) -->
      <ellipse cx="50" cy="80" rx="14" ry="22" fill="var(--paper)" />
    </g>
    <!-- Two EEG-style waves emerging to the right of the head -->
    <!-- Wave 1: primary ink-blue, faster oscillation (represents one IAF) -->
    <path class="iaf-wave iaf-wave-1"
          d="M 540 130
             Q 555 110, 570 130 T 600 130 T 630 130 T 660 130 T 690 130 T 720 130 T 750 130 T 780 130 T 810 130 T 840 130"
          stroke="var(--ink-blue)" stroke-width="1.3" fill="none" vector-effect="non-scaling-stroke" opacity="0.85" />
    <!-- Wave 2: secondary blue (#5C7FA3), slower oscillation (represents different IAF) -->
    <path class="iaf-wave iaf-wave-2"
          d="M 540 200
             Q 565 180, 590 200 T 640 200 T 690 200 T 740 200 T 790 200 T 840 200"
          stroke="#5C7FA3" stroke-width="1.3" fill="none" vector-effect="non-scaling-stroke" opacity="0.8" />
    <!-- Optional small labels for the waves -->
    <text x="850" y="135" font-family="var(--font-meta)" font-size="9" fill="var(--meta)" letter-spacing="0.1em">α₁</text>
    <text x="850" y="205" font-family="var(--font-meta)" font-size="9" fill="var(--meta)" letter-spacing="0.1em">α₂</text>
  </svg>
</div>
```

Add to `styles.css`:
```css
:root {
  --ink-blue-2: #5C7FA3;  /* secondary blue, used on slide 6 for the second IAF wave */
}
```

**Bridge sentence** (Zone 3a):

```html
<p class="bridge">Tempo from your perception of time.</p>
```

CSS:
- `font-family: var(--font-body)`
- `font-weight: 400`
- `font-size: clamp(20px, 2.2vw, 28px)`
- `color: var(--ink)` (charcoal — this is a methodological assertion, not a personal claim)
- `text-align: center`

**Schematic** (Zone 3b):

```html
<div class="schematic schematic-three-term">
  <div class="schematic-ratio">
    <span class="glyph glyph-alpha">α</span>
    <span class="num">10</span>
    <span class="colon">:</span>
    <span class="glyph glyph-stride">↟</span>
    <span class="num">2</span>
    <span class="colon">:</span>
    <span class="num">1</span>
    <span class="glyph glyph-heart">♥</span>
  </div>
  <div class="schematic-legend">alpha : stride : pulse</div>
</div>
```

The schematic now has three terms. Reading order is fastest-to-slowest: alpha (~10 Hz) > stride (~2 Hz) > pulse (~1 Hz). This represents the *frequency hierarchy* RTD operates within.

Adjust schematic position to `top: 74%` for slide 6 (slightly higher than slide 5, to make room for the invitation).

**Headphones invitation** (separated):

```html
<a class="headphones-invitation" href="./iaf.html" target="_blank" rel="noopener noreferrer">
  Listen in your headphones <span class="arrow">→</span>
</a>
```

CSS:
```css
.headphones-invitation {
  position: absolute;
  top: 88%;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-body);
  font-style: italic;
  font-size: clamp(14px, 1.4vw, 18px);
  color: var(--ink-blue);
  text-decoration: none;
  border-bottom: 0.5px solid var(--ink-blue);
  padding-bottom: 2px;
  opacity: 0.85;
  transition: opacity 200ms ease;
}
.headphones-invitation:hover {
  opacity: 1;
}
.headphones-invitation .arrow {
  display: inline-block;
  margin-left: 6px;
  transition: transform 200ms ease;
}
.headphones-invitation:hover .arrow {
  transform: translateX(3px);
}
```

The invitation is visually distinct from the main slide composition — quieter, smaller, set apart. It reads as an aside, not a CTA button. The audience can choose to engage with it.

### 3.3 Ellipse for slide 6

Same default contextual ellipse:

```html
<svg class="slide-ellipse" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="800" cy="450" rx="720" ry="380" fill="none" stroke="var(--ink-blue)" stroke-width="0.8" vector-effect="non-scaling-stroke" opacity="0.18" />
</svg>
```

### 3.4 Audio behavior

On slide entry: hr_pulse fades to 0.4, gait_layer fades to 0.5, iaf_shimmer fades in to 0.6. The iaf_shimmer placeholder should be a quiet high-frequency texture (filtered noise, or a bell-like resonance) that gives a sense of *another layer* without competing with the rhythmic pulses underneath.

The compressed Meet audio will struggle with the iaf_shimmer texture — that's expected. The actual experience of IAF sonification happens on the `iaf.html` page, where the audience uses their own headphones uncompressed.

### 3.5 iaf.html page

The `iaf.html` page should be a minimal listening experience consistent with the deck's visual identity:

- Same paper background (#F4F1EC)
- Same EB Garamond / IBM Plex Mono typography
- Centered content: a brief framing sentence ("This is what your alpha frequency might sound like." or similar), a play/pause button, and quiet visual feedback while audio plays
- A back-link or close instruction at the bottom
- The actual IAF audio is a placeholder for now; real content will be authored later

Visual elements on iaf.html should NOT include the elliptical motif — this is a *different surface* from the deck. Treat it as a quiet companion page, not a slide.

---

## 4. Audio engine integration

The slide audio config in `app.js` should now include real values for slides 4–6. Verify the SLIDES array reflects:

```js
const SLIDES = [
  { index: 0,  section: '',                  audio: {} },                                              // blank opener
  { index: 1,  section: 'i. the question',   audio: {} },
  { index: 2,  section: 'ii. the method',    audio: { sustained_tone: 0.3 } },
  { index: 3,  section: 'ii. the method',    audio: { sustained_tone: 0.3 } },
  { index: 4,  section: 'iii. the build',    audio: { hr_pulse: 0.7 } },
  { index: 5,  section: 'iii. the build',    audio: { hr_pulse: 0.5, gait_layer: 0.7 } },
  { index: 6,  section: 'iii. the build',    audio: { hr_pulse: 0.4, gait_layer: 0.5, iaf_shimmer: 0.6 } },
  { index: 7,  section: 'iii. the build',    audio: { ambient_bed: 0.4 } },
  { index: 8,  section: 'iv. the demo',      audio: {} },
  { index: 9,  section: 'iv. the demo',      audio: {} },
  { index: 10, section: 'v. what comes next', audio: { ambient_bed: 0.3 } },
  { index: 11, section: 'v. what comes next', audio: {} },
  { index: 12, section: 'vi. close',         audio: {} },
];
```

---

## 5. Acceptance criteria for this session

- [ ] All pre-flight fixes from §0 are applied; slide 1 ellipses render as outlined arcs (not filled blobs) along the bottom of the slide, foci dots at correct positions
- [ ] Slide 4 renders with: declaration top, heart+waveform centered, "a 1 of 1" italic ink-blue at bottom, no schematic
- [ ] Slide 5 renders with: "You set the pace" italic ink-blue at top, two-foot visual centered, schematic at bottom showing `↟ 2 : 1 ♥`
- [ ] Slide 6 renders with: "Your perspective makes a difference" at top, head-with-headphones-and-two-blue-waves centered, "Tempo from your perception of time" bridge sentence, three-term schematic `α 10 : ↟ 2 : 1 ♥`, separated headphones invitation linking to `iaf.html`
- [ ] Audio engine transitions correctly between slides 3→4→5→6→7, with continuous tracks (hr_pulse) carrying across slide boundaries with volume changes rather than restarts
- [ ] iaf.html page exists, styled consistently with deck, with placeholder audio
- [ ] No new colors introduced beyond `--ink-blue-2: #5C7FA3` (added to root variables)
- [ ] All foot, heart, and head SVG paths are reviewed visually — if any look awkward, redrawn from anatomical reference before shipping
- [ ] Tested in Chrome with screen-share-tab-audio enabled in a Google Meet; audio survives compression acceptably for hr_pulse and gait_layer (iaf_shimmer is expected to degrade — that's why headphones are used)

---

## 6. Notes on what's left for future sessions

- Slide 7 (other biomarkers and context) — content not yet specified
- Slide 8 (demo frame) — content not yet specified
- Slide 9 (live demo) — the actual interactive RTD demo
- Slide 10–12 (implications, roadmap, close) — content not yet specified
- All real (non-placeholder) audio sonifications
- Mandarin text on slide 1 (decision pending: visible on slide vs spoken-only)
- Animations on slides 1, 2, 3 (the fade-and-collapse moves already scaffolded in current HTML)

---

*End of slides 4–6 implementation document.*
