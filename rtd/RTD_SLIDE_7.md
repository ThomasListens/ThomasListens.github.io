# RTD — Slide 7 Implementation

**Project:** Relative Tempo Derivation presentation deck
**Repo:** thomaslistens.github.io/RTD
**Scope of this session:** Implement slide 7 — the bloom-and-collapse slide that opens the RTD framework into possibility, then resolves into the deck's pivot question.

---

## 1. What this slide does

Slide 7 is structurally different from slides 4-6. Where 4-6 each introduced one biomarker calmly, slide 7 *performs* the openness it's claiming. It blooms (revealing three pillars of extension) and then collapses into the deck's seed question, which returns from slide 1 to pivot the deck toward the demo.

Three pillars, revealed in sequence, each more conceptually expansive than the last:
1. **Future biomarkers** — the framework accepts more inputs (breath, HRV, valence)
2. **Current context** — the framework attends to situation (time, location, schedule, environment)
3. **User adaptability** — the framework shapes to the user's goals (focus, rest, recovery)

After the three pillars are visible, they collapse and the slide resolves into the question first asked on slide 1: *What does your time sound like?* — now in italic ink-blue, identical typographic treatment to its first appearance. The deck has come full circle and the demo is the answer.

---

## 2. Slide metadata

- `data-slide-index="7"`
- `data-section="iii. the build"`
- Slide number metadata: `08 / 13`
- Audio state: `{ ambient_bed: 0.4 }`

---

## 3. Five keypress states

This slide is a single slide that progresses through 5 internal states via keypresses (space / right-arrow). The audience sees one slide; the presenter advances through micro-beats.

**State 0 — Pristine.** Slide loads in this state. Only the opening line is visible at the top. Three column areas are present in the DOM but their contents are at opacity 0.

**State 1 — Column 1 reveals.** "future biomarkers" column fades in. Items within the column fade in sequentially over ~600ms total (heading first, then items at ~120ms intervals).

**State 2 — Column 2 reveals.** "current context" column fades in alongside column 1. Same internal sequencing.

**State 3 — Column 3 reveals.** "user adaptability" column fades in alongside columns 1 and 2. The slide is now in its bloomed state.

**State 4 — Collapse.** All three columns fade out in reverse sequential order (column 3 first, then column 2, then column 1) over ~800ms total. As the columns fade, the closing question fades in at the bottom-center of the slide. The opening line at the top remains visible throughout.

**State 5 — Advance.** Pressing space again from state 4 advances to slide 8. The internal state of slide 7 is preserved if the user navigates back.

### 3.1 State management

Add to `app.js`:

```js
const SLIDE_7_INDEX = 7; // adjust if numbering changes
const SLIDE_7_MAX_STATE = 4; // states 0 through 4

const slide7State = {
  current: 0,
};

function advanceSlide7() {
  if (slide7State.current < SLIDE_7_MAX_STATE) {
    slide7State.current++;
    applySlide7State();
    return true; // handled internally; do not advance to next slide
  }
  return false; // advance to next slide
}

function regressSlide7() {
  if (slide7State.current > 0) {
    slide7State.current--;
    applySlide7State();
    return true;
  }
  return false; // go back to previous slide
}

function applySlide7State() {
  const slide = document.querySelector('[data-slide-index="7"]');
  if (!slide) return;
  slide.dataset.bloomState = String(slide7State.current);
}

function resetSlide7() {
  slide7State.current = 0;
  applySlide7State();
}
```

Hook this into the existing keyboard navigation. When the deck is on slide 7 and the user presses space/right, call `advanceSlide7()` — if it returns `true`, do NOT advance to the next slide; the internal state was updated. If it returns `false`, advance normally. Same logic for left-arrow / regress.

When the user navigates *to* slide 7 from outside (jumping via hash, or arrowing in from slide 8), call `resetSlide7()` to start at state 0. When navigating *away* from slide 7, no special cleanup needed.

CSS will use the `data-bloom-state` attribute to control opacity per state.

---

## 4. HTML structure

Replace the existing slide 7 placeholder:

```html
<section class="slide slide-bloom" data-slide-index="7" data-section="iii. the build" data-bloom-state="0">
  <svg class="slide-ellipse" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="800" cy="450" rx="720" ry="380" fill="none" stroke="var(--ink-blue)" stroke-width="0.8" vector-effect="non-scaling-stroke" opacity="0.18" />
  </svg>

  <div class="slide-meta slide-meta-top">
    <span>iii. the build</span>
    <span>08 / 13</span>
  </div>

  <div class="slide-body slide-body-bloom">
    <p class="bloom-opening">The body keeps many clocks. So does the day.</p>

    <div class="bloom-columns">
      <!-- Column 1: future biomarkers -->
      <div class="bloom-column" data-column="1">
        <div class="bloom-heading">future biomarkers</div>
        <ul class="bloom-list">
          <li class="bloom-item" data-item="1">
            <span class="bloom-glyph">α</span>
            <span class="bloom-num">10</span>
            <span class="bloom-label">alpha</span>
          </li>
          <li class="bloom-item" data-item="2">
            <span class="bloom-glyph">↟</span>
            <span class="bloom-num">2</span>
            <span class="bloom-label">stride</span>
          </li>
          <li class="bloom-item" data-item="3">
            <span class="bloom-glyph">♥</span>
            <span class="bloom-num">1</span>
            <span class="bloom-label">pulse</span>
          </li>
          <li class="bloom-item" data-item="4">
            <span class="bloom-glyph">◯</span>
            <span class="bloom-num">¼</span>
            <span class="bloom-label">breath</span>
          </li>
          <li class="bloom-item bloom-item-future" data-item="5">
            <span class="bloom-glyph">+</span>
            <span class="bloom-label">HRV</span>
          </li>
          <li class="bloom-item bloom-item-future" data-item="6">
            <span class="bloom-glyph">+</span>
            <span class="bloom-label">valence</span>
          </li>
        </ul>
      </div>

      <!-- Column 2: current context -->
      <div class="bloom-column" data-column="2">
        <div class="bloom-heading">current context</div>
        <ul class="bloom-list">
          <li class="bloom-item" data-item="1">
            <span class="bloom-label">time of day</span>
          </li>
          <li class="bloom-item" data-item="2">
            <span class="bloom-label">location</span>
          </li>
          <li class="bloom-item" data-item="3">
            <span class="bloom-label">schedule</span>
          </li>
          <li class="bloom-item" data-item="4">
            <span class="bloom-label">environment</span>
          </li>
          <li class="bloom-item bloom-item-future" data-item="5">
            <span class="bloom-label">intangibles</span>
          </li>
        </ul>
      </div>

      <!-- Column 3: user adaptability -->
      <div class="bloom-column" data-column="3">
        <div class="bloom-heading">user adaptability</div>
        <ul class="bloom-list">
          <li class="bloom-item" data-item="1">
            <span class="bloom-label">focus</span>
          </li>
          <li class="bloom-item" data-item="2">
            <span class="bloom-label">rest</span>
          </li>
          <li class="bloom-item" data-item="3">
            <span class="bloom-label">recovery</span>
          </li>
          <li class="bloom-item" data-item="4">
            <span class="bloom-label">performance</span>
          </li>
          <li class="bloom-item bloom-item-meta" data-item="5">
            <span class="bloom-label-meta">ratios shift to serve</span>
          </li>
        </ul>
      </div>
    </div>

    <p class="bloom-closing">What does your time sound like?</p>
  </div>

  <div class="slide-meta slide-meta-bottom">
    <span>thomaslistens.github.io/rtd</span>
    <span>thomas meier · 2026</span>
  </div>
</section>
```

### 4.1 Notes on column contents

- **Future biomarkers column:** the first three items (alpha, stride, pulse) echo what the audience just saw on slides 4-6. Breath joins as the next ratio (¼ — one breath per four beats). HRV and valence appear as `+` items (no numeric ratio) — they're directional, not yet quantified. The asymmetry is intentional and honest.
- **Current context column:** four contextual variables. The fifth, "intangibles," is deliberately abstract — it gestures at what RTD might attend to that we don't yet have words for.
- **User adaptability column:** four goals (focus, rest, recovery, performance) plus a fifth meta-line "ratios shift to serve." This last item is rendered differently (italic, smaller) — it's a *commentary* on the column, not another list item.

---

## 5. CSS

Add to `styles.css`:

```css
/* === SLIDE 7: BLOOM === */

.slide-bloom .slide-body-bloom {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0;
}

/* Opening line — always visible, top */
.bloom-opening {
  position: absolute;
  top: 18%;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  font-family: var(--font-body);
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 400;
  color: var(--ink);
}

/* Columns container — middle of slide */
.bloom-columns {
  position: absolute;
  top: 32%;
  left: 8%;
  right: 8%;
  bottom: 32%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6%;
}

.bloom-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  opacity: 0;
  transition: opacity 600ms ease-out;
}

.bloom-heading {
  font-family: var(--font-meta);
  font-size: clamp(10px, 1vw, 12px);
  letter-spacing: 0.18em;
  color: var(--meta);
  text-transform: lowercase;
  border-bottom: 0.5px solid var(--meta);
  padding-bottom: 8px;
  opacity: 0.75;
}

.bloom-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bloom-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: var(--font-body);
  font-size: clamp(15px, 1.5vw, 19px);
  color: var(--ink);
  opacity: 0;
  transition: opacity 400ms ease-out;
  transition-delay: 0ms;
}

.bloom-item .bloom-glyph {
  font-family: var(--font-body);
  color: var(--ink-blue);
  min-width: 1.3em;
  display: inline-block;
}

.bloom-item .bloom-num {
  font-family: var(--font-meta);
  color: var(--meta);
  font-size: 0.85em;
  min-width: 1.6em;
}

.bloom-item .bloom-label {
  font-family: var(--font-body);
  color: var(--ink);
}

.bloom-item-future {
  opacity: 0;
}

.bloom-item-future .bloom-glyph {
  color: var(--meta);
  opacity: 0.7;
}

.bloom-item-future .bloom-label {
  color: var(--meta);
  font-style: italic;
}

.bloom-item-meta .bloom-label-meta {
  font-style: italic;
  color: var(--meta);
  font-size: 0.85em;
  margin-top: 6px;
  display: inline-block;
}

/* Closing question — only visible in state 4 */
.bloom-closing {
  position: absolute;
  bottom: 18%;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  font-family: var(--font-body);
  font-style: italic;
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 400;
  color: var(--ink-blue);
  opacity: 0;
  transition: opacity 800ms ease-in;
}

/* === STATE-DRIVEN VISIBILITY === */

/* State 0: only opening visible */
.slide-bloom[data-bloom-state="0"] .bloom-column,
.slide-bloom[data-bloom-state="0"] .bloom-closing {
  opacity: 0;
}

/* State 1: column 1 visible */
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] {
  opacity: 1;
}
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item {
  opacity: 1;
}
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item[data-item="1"] { transition-delay: 0ms; }
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item[data-item="2"] { transition-delay: 120ms; }
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item[data-item="3"] { transition-delay: 240ms; }
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item[data-item="4"] { transition-delay: 360ms; }
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item[data-item="5"] { transition-delay: 480ms; }
.slide-bloom[data-bloom-state="1"] .bloom-column[data-column="1"] .bloom-item[data-item="6"] { transition-delay: 600ms; }

/* State 2: columns 1 and 2 visible */
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="1"],
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] {
  opacity: 1;
}
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="1"] .bloom-item,
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] .bloom-item {
  opacity: 1;
}
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] .bloom-item[data-item="1"] { transition-delay: 0ms; }
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] .bloom-item[data-item="2"] { transition-delay: 120ms; }
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] .bloom-item[data-item="3"] { transition-delay: 240ms; }
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] .bloom-item[data-item="4"] { transition-delay: 360ms; }
.slide-bloom[data-bloom-state="2"] .bloom-column[data-column="2"] .bloom-item[data-item="5"] { transition-delay: 480ms; }

/* State 3: all columns visible */
.slide-bloom[data-bloom-state="3"] .bloom-column {
  opacity: 1;
}
.slide-bloom[data-bloom-state="3"] .bloom-item {
  opacity: 1;
}
.slide-bloom[data-bloom-state="3"] .bloom-column[data-column="3"] .bloom-item[data-item="1"] { transition-delay: 0ms; }
.slide-bloom[data-bloom-state="3"] .bloom-column[data-column="3"] .bloom-item[data-item="2"] { transition-delay: 120ms; }
.slide-bloom[data-bloom-state="3"] .bloom-column[data-column="3"] .bloom-item[data-item="3"] { transition-delay: 240ms; }
.slide-bloom[data-bloom-state="3"] .bloom-column[data-column="3"] .bloom-item[data-item="4"] { transition-delay: 360ms; }
.slide-bloom[data-bloom-state="3"] .bloom-column[data-column="3"] .bloom-item[data-item="5"] { transition-delay: 480ms; }

/* State 4: collapse — columns fade out in reverse, closing fades in */
.slide-bloom[data-bloom-state="4"] .bloom-column[data-column="3"] {
  opacity: 0;
  transition: opacity 400ms ease-in;
  transition-delay: 0ms;
}
.slide-bloom[data-bloom-state="4"] .bloom-column[data-column="2"] {
  opacity: 0;
  transition: opacity 400ms ease-in;
  transition-delay: 200ms;
}
.slide-bloom[data-bloom-state="4"] .bloom-column[data-column="1"] {
  opacity: 0;
  transition: opacity 400ms ease-in;
  transition-delay: 400ms;
}
.slide-bloom[data-bloom-state="4"] .bloom-closing {
  opacity: 1;
  transition-delay: 700ms;
}
```

---

## 6. Audio behavior

On entering slide 7 (any state), the audio engine transitions to `{ ambient_bed: 0.4 }`. This is a quiet, sustained background that holds the slide's contemplative quality. The ambient bed continues unchanged across all 5 internal states — the audio doesn't react to the visual bloom; the bloom is silent and the closing question is silent.

When advancing from state 4 to slide 8, the engine transitions to `{}` (silence). Slide 8 (demo frame) opens in silence to mark the pivot.

---

## 7. Interaction details

- **Forward navigation on slide 7:** space, right arrow, or page-down all advance the bloom state. Once at state 4, the same key advances to slide 8.
- **Backward navigation on slide 7:** left arrow or page-up regresses the bloom state. Once at state 0, the same key navigates to slide 6.
- **Jumping to slide 7 via hash or number key:** always start at state 0.
- **Returning to slide 7 from later in the deck:** start at state 0 (do not preserve previous state).
- **The bloom states are NOT separate URLs.** The URL hash for slide 7 is just `#7`, regardless of internal state. State is ephemeral.

---

## 8. Acceptance criteria

- [ ] Slide 7 loads at state 0 with only the opening line visible at top: *The body keeps many clocks. So does the day.*
- [ ] Pressing space once reveals column 1 (future biomarkers), with items fading in sequentially over ~600ms
- [ ] Pressing space again reveals column 2 (current context), without affecting column 1
- [ ] Pressing space again reveals column 3 (user adaptability)
- [ ] Pressing space again triggers collapse: column 3 fades first, then column 2, then column 1, while *What does your time sound like?* fades in at the bottom in italic ink-blue
- [ ] Pressing space from collapsed state advances to slide 8
- [ ] Backward navigation works in reverse, regressing through bloom states before going back to slide 6
- [ ] Audio: ambient_bed at 0.4 throughout slide 7, regardless of state
- [ ] The opening line at the top remains visible across all 5 states
- [ ] The closing question is rendered identically to slide 1's question (same font, size, color, italic) — verify by visual comparison
- [ ] No layout shift between states — the columns don't push each other around as they appear; the grid is established before any column has visible content

---

## 9. Notes for the builder

- The CSS is verbose because each state's transitions are explicit. This is intentional — the alternative (a dynamic JS-driven animation system) introduces complexity that isn't needed for 5 fixed states.
- The `bloom-item-future` and `bloom-item-meta` classes mark items that need slightly different visual treatment (lighter color, italic). Verify these read as *secondary* to the primary list items without disappearing entirely.
- The opening line is in roman EB Garamond (charcoal), the closing line is in italic EB Garamond (ink-blue). This is deliberate — they share a structural position but speak in different registers. The shift from declaration to inquiry is part of what the slide does.
- If the columns feel cramped at smaller viewports, the CSS gap and padding can be tuned, but do not change the three-column grid structure.

---

*End of slide 7 implementation document.*
