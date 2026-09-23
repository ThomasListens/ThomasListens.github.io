# Close Your Eyes — project brief (mirror)

This is a mirror of `B:\My Journal\close_your_eyes_bootstrap\PROJECT_BRIEF.md` kept in the OneDrive-synced Tuner folder for easy sharing with agents that don't have B:\ mounted.

---

**One-line pitch:** Thomas's music paired with real-time navigation through volumetric human-anatomy scans. His audio *is* the camera path.

## Who Thomas is

Working musician. Microtonal harmony singer. IG creator. Also builds his own tools (Tuner web app, My Pen handwriting engine, Cutting Room Floor daily-reel pipeline). Test device is Pixel 7. Technically fluent, strong aesthetic opinions, hates lo-fi-as-excuse-for-low-effort — "Nintendo makes a lot with very little" is the standard.

## What Close Your Eyes is

Volumetric anatomy datasets (ESRF Human Organ Atlas, CC-BY-4.0, hierarchical phase-contrast tomography) rendered as a landscape. Thomas's music drives navigation — camera position, orientation, zoom, cross-section angle, volume-rendering params — all responding to musical features (harmony, dynamics, tempo, timbre).

Thomas's exact words: *"I need to use audio render to drive motion and exploration through the dataset."* The music IS the camera path.

**Title tension:** "Close Your Eyes" delivered through the most detailed visual you can be shown. Either they close their eyes and the music guides through what they just saw, or they keep them open and the anatomy becomes visible while the music unfolds. Both readings are the piece.

**Priority:** utmost. Insular to his music practice and its promotion. Not for CRF, not for Dyad. Own workspace, own posture, likely own distribution channel.

## Aesthetic direction (non-negotiable)

- **Reference:** the Neuroglancer viewer on the ESRF site. Smooth volume raycast, real-time cross-sections, high-fidelity detail.
- **Yokota standard:** patience as devotion, presence over spectacle, meditative long-form. Inhabit-and-stay.
- **Nintendo-slick:** every effect earns its keep. Fewer effects that do more.
- **Not lo-fi.** Resourceful high-craft within constraints.
- **Music as the driver, always.** Audio decides. No autonomous "cool camera moves."

## Data

**Source:** ESRF Human Organ Atlas — https://human-organ-atlas.esrf.fr

**Starter dataset:** right eye of LADAF-2024-38 (female, 77) at 16.936 µm (~1.9 GB).
- Dataset page: https://human-organ-atlas.esrf.fr/datasets/2378104896
- `datafileIds=2378104898` (data ZIP), `datafileIds=2378104906` (metadata JSON)

**Full donor pool:** 4 eyes across 2 donors — LADAF-2024-38 (F, 77) L+R; LADAF-2024-39 (M, 82) L+R.

**Format:** JP2 (JPEG 2000) image stacks. Codec = `glymur` or `imagecodecs` (NOT `pillow-jpls` — that's JPEG-LS). Volume ~6400 × 6000 × 6200 voxels at full res.

**Streaming path** (Neuroglancer uses this):
```
gs://ucl-hip-ct-35a68e99feaae8932b1d44da0358940b/LADAF-2024-38/eye-right/4.234um_complete-organ_bm18.ome.zarr/
```
Anonymous via `pip install zarr ome-zarr gcsfs`.

**Download URL scheme:**
```
https://ids.esrf.fr/ids/getData?sessionId=<TOKEN>&datafileIds=<ID>
```
Session token expires; refresh from Chrome DevTools → Network → filter `getData`.

## Current state (2026-08-04)

**Blocked on:** Windows hypervisor virt disabled (`HYPERVISOR_VIRT_DISABLED`). BIOS virt is on; Windows-layer feature is off. Fix: `_virt_fix.bat` in this same folder → UAC Yes → reboot.

**Nothing downloaded yet.** `B:\Close Your Eyes\` doesn't exist.

**Staged:** bootstrap scripts, download script, JP2 audit, streaming audit, and full HANDOFF.md at `B:\My Journal\close_your_eyes_bootstrap\`.

## Next actions

1. Fix virt (run `_virt_fix.bat`, reboot).
2. Confirm sandbox works.
3. Bootstrap → download → JP2 audit → streaming audit.
4. Decide streaming vs local vs both from measured numbers.
5. First render prototype: load dataset, orbit camera, cross-section angle driven by a sine on a fixed audio track. Prove the loop.
6. Design the music → visual-param mapping.

## Standing rules

- **Insular** — tooling here does NOT feed Cutting Room Floor.
- **Art direction over pixel count** — no effects to cover for anything.
- **Yokota + Nintendo standard** — cut spectacle; if the piece isn't worse, stay cut.
- **Test on live** for anything shipped (Tuner precedent).

## Related projects

- **Tuner** (this repo) — microtonal tuner. Companion.
- **RTD** — biologically-derived tempo. Same core move: body as source, not subject.
- **Cutting Room Floor** — daily reels. Opposite posture. Don't mix.
- **My Pen** — handwriting engine. Feeds CRF, not this.
- **Resonating String of Earth** — sustained-string project. Sibling in ambition, separate.

---

*Mirror kept for portability. Canonical version at `B:\My Journal\close_your_eyes_bootstrap\PROJECT_BRIEF.md`. If Thomas contradicts anything here, trust him and update both files.*
