# Relative Tempo Derivation (RTD) — Round 2 Deck

Static web presentation for the Merry Electronics Round 2 pitch.

## Stack

- Plain HTML, CSS, and JavaScript
- No framework, no build step, no bundler
- Google Fonts only external dependency

## Project structure

- `index.html`: all 12 slides in one page
- `styles.css`: visual identity, grid, typography, transitions
- `app.js`: keyboard navigation, hash sync, progress bar, audio engine
- `iaf.html`: independent headphones listening page for slide 6 handoff
- `audio/`: placeholder loopable audio tracks used by the state-based engine
- `assets/`: reserved for future imagery and SVG assets

## Local development

Open `index.html` directly in a browser, or use a lightweight static server.

PowerShell example:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Navigation controls

- Next: `ArrowRight`, `Space`, `PageDown`
- Previous: `ArrowLeft`, `PageUp`
- First slide: `Home`
- Last slide: `End`
- Jump: keys `1-9`, `0` (slides 1-10)
- Mute: `M`
- Fullscreen: `F`
- Exit fullscreen: `Esc`

## Audio architecture

Each slide declares a target audio state (`track -> volume`). On slide change, `AudioEngine.transitionTo()` crossfades all tracks over 800ms.

- Tracks present in both states continue seamlessly
- New tracks fade in
- Missing tracks fade to zero and pause

This keeps audio cumulative and continuous across the deck.

## Deployment

Configured for GitHub Pages from repository root. All references are relative so the deck works under `/RTD/` path:

- `https://thomaslistens.github.io/RTD`
