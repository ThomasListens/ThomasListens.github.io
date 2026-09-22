"""Rebuild the billboard handwriting from the .mypen sources.

    py tools/build-handwriting.py            # both pieces
    py tools/build-handwriting.py constant   # one

WHY THIS EXISTS.  The originals were 960x178 at 67-78 kbps, which is the worst
case a codec can be handed: thin cream strokes on black.  Every stroke carried
mosquito ringing and the interiors mottled.  Measured before changing anything,
so the fix aims at the real fault:

    the framing   the ink already filled 99% x 98% of the strip - there is NO
                  legibility to win by cropping.  Composition unchanged.
    the slot      .title-slot is 60px and .billboard-hand is max-width 320, so
                  the video displays at 320x60 = 5.333:1.  1280x240 is that
                  aspect exactly and covers 4x DPR; the bytes go to bitrate.
    the encode    THE ACTUAL FAULT.  Rebuilt clean and encoded properly.

** STROKE WIDTH IS NOT THE PEN'S NOMINAL WIDTH. **  The English piece is
written with 'sketch' - Krita's CURVE engine, which paints hairlines - and the
Mandarin with 'bristle', a stamped tip.  Drawing both as a solid ribbon at w/2
(which is what the lyric-video builder does) came out measurably too heavy, by
distance transform on the ink:

        piece      old render   ribbon at w/2   over
        English      1.12%          2.12%       1.9x
        Mandarin     2.25%          2.92%       1.3x
                    (median stroke half-width, % of frame height)

and Thomas saw it at once: "your pen is a little too smudgy?  Especially on the
English?  the lines are colliding looking squished".  WIDTH below is the
correction, picked by looking at a ladder at BOTH full size and 320x60 - not by
matching the old number, because the old render is also what he called low
fidelity.  English opens up the cursive; Mandarin keeps the brush's body.

** THE TIMELINE IS REPRODUCED, NOT REINVENTED. **  index.html's
HANDWRITING[].nextAt is measured against these renders, so the write and the
clearing have to land where they did or the two-piece cycle collides.  Measured
off the old files at 6 fps (ink coverage, whole frame and left third):

    bb-constant   writes 0 -> 6.2   left third clear 9.8   all gone 14.0  (15.07s)
    bb-mandarin   writes 0 -> 5.0   left third clear 7.3   all gone 11.0  (11.70s)

The departure is his pen's own 'age' with departOrder 'rolling': every mark
carries its own clock, offset by when IT was written, so the line clears in the
order and rhythm it was written.  LINGER/SINK below reproduce the curves above,
and the build prints what it achieved so a drift is visible rather than assumed.
"""
import json, math, os, subprocess, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "assets", "video", "web")
POST = os.path.join(REPO, "assets", "images", "web")
TOOTH_PNG = "B:/My Pen/app/brushes/paper-tooth.png"
SCRATCH = os.environ.get("TMP") or os.environ.get("TEMP") or HERE

W, H, FPS, SS = 1280, 240, 30, 3
INK = (239, 230, 212)          # the lyric videos' cream, on this dark page
TINT = (232, 220, 190)         # PRESETS.age - ink tints as it dries
TINT_MAX, DRY_HOLD, GAMMA = 0.22, 0.28, 1.7
# ⚠ THE TOOTH IS A FIXED 512 px TILE, so how coarse it reads depends on the
#   STROKE WIDTH it lands on.  The lyric videos run 0.40 on ~22 px strokes;
#   these strips have 6-12 px strokes, so the same value EATS them.  Scaled
#   down to match the lyric videos' relative grain, and overridable.
INK_TOOTH = float(os.environ.get("INK_TOOTH", "0.18"))
CAST = float(os.environ.get("CAST", "0.20"))   # the cast the ink throws
BANDS = 26                     # equal COUNTS of ink, never equal time

PIECES = {
    "bb-constant": dict(
        src="B:/My Pen/The only constant v5.mypen",
        write=6.20, linger=7.50, sink=0.50, dur=15.07, width=0.62),
    "bb-mandarin": dict(
        src="B:/My Pen/\u6211\u4e0d\u5f97\u4e0d\u4f5c\u66f2.mypen",
        write=5.00, linger=5.70, sink=0.45, dur=11.70, width=0.85),
}

# his lib.mjs shapePause, as the lyric builder ports it
PAUSE = dict(keep=250, soft=700, softScale=0.6, longScale=0.12, cap=900)
NATURAL = 0.5


def shape_pause(gap, tighten=1.0):
    t = max(0.0, min(1.0, tighten))
    soft = PAUSE["keep"] + (min(gap, PAUSE["soft"]) - PAUSE["keep"]) * PAUSE["softScale"]
    if gap <= PAUSE["keep"]:
        shaped = gap
    elif gap <= PAUSE["soft"]:
        shaped = soft
    else:
        shaped = min(PAUSE["cap"], soft + (gap - PAUSE["soft"]) * PAUSE["longScale"])
    if t <= NATURAL:
        return gap + (shaped - gap) * (t / NATURAL)
    return shaped * (1 - (t - NATURAL) / (1 - NATURAL))


def load(path, write_s):
    """strokes with their pen rhythm kept, the whole write scaled to write_s"""
    d = json.load(open(path, encoding="utf-8"))
    st = [dict(pts=[dict(p) for p in s["pts"]]) for s in d["strokes"] if len(s["pts"]) > 1]
    t0 = st[0]["pts"][0]["t"]
    for s in st:
        for p in s["pts"]:
            p["t"] -= t0
    shift = 0.0
    for i in range(1, len(st)):
        prev_end = st[i - 1]["pts"][-1]["t"]
        gap = st[i]["pts"][0]["t"] - shift - prev_end
        if gap > 0:
            shift += gap - shape_pause(gap)
        if shift > 0:
            for p in st[i]["pts"]:
                p["t"] -= shift
    span = max(p["t"] for s in st for p in s["pts"])
    k = (write_s * 1000.0) / span
    for s in st:
        for p in s["pts"]:
            p["t"] *= k
    return st


def paper_tooth():
    a = Image.open(TOOTH_PNG).split()[-1]
    tile = Image.new("L", (W, H))
    for y in range(0, H, a.size[1]):
        for x in range(0, W, a.size[0]):
            tile.paste(a, (x, y))
    t = np.asarray(tile, np.float32) / 255.0
    return t / max(t.mean(), 1e-6)          # mean 1.0 -> level-neutral


def build(name, cfg):
    st = load(cfg["src"], cfg["write"])
    xs = [q["x"] for s in st for q in s["pts"]]
    ys = [q["y"] for s in st for q in s["pts"]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    sc = min(W * 0.96 / (x1 - x0), H * 0.94 / (y1 - y0))
    ox = (W - (x1 - x0) * sc) / 2 - x0 * sc
    oy = (H - (y1 - y0) * sc) / 2 - y0 * sc

    # every sample in written order, then BANDS of equal ink count
    samples = [(si, j, q) for si, s in enumerate(st) for j, q in enumerate(s["pts"])]
    samples.sort(key=lambda z: z[2]["t"])
    per = max(1, len(samples) // BANDS)
    band_of = [min(BANDS - 1, n // per) for n in range(len(samples))]
    # each band departs LINGER after ITS OWN last mark - his 'rolling' age
    band_last = [0.0] * BANDS
    for n, (_, _, q) in enumerate(samples):
        b = band_of[n]
        band_last[b] = max(band_last[b], q["t"] / 1000.0)
    dep0 = [band_last[b] + cfg["linger"] for b in range(BANDS)]

    tooth = paper_tooth()
    inkimg = np.ones((H, W, 3), np.float32) * np.array(INK, np.float32)
    inkimg *= (1.0 - INK_TOOTH + INK_TOOTH * tooth)[..., None]
    inkimg = np.clip(inkimg, 0, 255)

    frames = int(round(cfg["dur"] * FPS))
    # ⚠ NOT inside the repo: it is OneDrive-synced, which both uploads 450
    #   throwaway PNGs and holds a lock that makes rmdir fail.
    d = os.path.join(SCRATCH, "_frames_%s" % name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))

    # cumulative band masks - each sample is drawn ONCE, not once per frame
    masks = [Image.new("L", (W * SS, H * SS), 0) for _ in range(BANDS)]
    draws = [ImageDraw.Draw(m) for m in masks]
    prev_pt = {}
    cursor = 0
    wf = cfg["width"]
    curve = []
    left = []

    for fi in range(frames):
        t = fi / FPS
        ms = t * 1000.0
        while cursor < len(samples) and samples[cursor][2]["t"] <= ms:
            si, j, q = samples[cursor]
            bi = band_of[cursor]
            dl = draws[bi]
            x = (ox + q["x"] * sc) * SS
            y = (oy + q["y"] * sc) * SS
            r = max(0.5, q["w"] * wf * sc * SS / 2.0)
            dl.ellipse([x - r, y - r, x + r, y + r], fill=255)
            pv = prev_pt.get(si)
            # join only to the sample immediately before it in the SAME stroke;
            # across a band boundary the join is drawn into BOTH bands, or the
            # departure would open a gap the writing never had.
            if pv is not None and pv[2] == j - 1:
                px, py, _, pr, pb = pv
                dx, dy = x - px, y - py
                ln = math.hypot(dx, dy)
                if ln > 1e-6:
                    ux, uy = -dy / ln, dx / ln
                    poly = [(px + ux * pr, py + uy * pr), (x + ux * r, y + uy * r),
                            (x - ux * r, y - uy * r), (px - ux * pr, py - uy * pr)]
                    dl.polygon(poly, fill=255)
                    if pb != bi:
                        draws[pb].polygon(poly, fill=255)
            prev_pt[si] = (x, y, j, r, bi)
            cursor += 1

        # the departure: bands still whole are ONE mask; only the two or three
        # mid-sink need their own, so this stays cheap
        whole, parts = [], []
        for b in range(BANDS):
            u = (t - dep0[b]) / max(cfg["sink"], 1e-6)
            if u <= 0.0:
                whole.append(b)
            elif u >= 1.0:
                continue
            elif u < DRY_HOLD:
                parts.append((b, 1.0, (u / DRY_HOLD) * TINT_MAX))
            else:
                g = (u - DRY_HOLD) / (1.0 - DRY_HOLD)
                parts.append((b, max(0.0, 1.0 - g ** (1.0 / GAMMA)), TINT_MAX))

        layers = []
        if whole:
            acc = np.asarray(masks[whole[0]], np.uint8)
            for b in whole[1:]:
                acc = np.maximum(acc, np.asarray(masks[b], np.uint8))
            layers.append((Image.fromarray(acc).resize((W, H), Image.LANCZOS), 0.0))
        for b, al, tint in parts:
            lay = masks[b].resize((W, H), Image.LANCZOS)
            if al < 1.0:
                lay = lay.point(lambda v, _a=al: int(v * _a))
            layers.append((lay, tint))

        rgba = np.zeros((H, W, 4), np.float32)
        if layers:
            union = np.zeros((H, W), np.float32)
            for lay, _ in layers:
                union = np.maximum(union, np.asarray(lay, np.float32))
            # the cast the ink throws on the page - UNDER the ink, never over
            if CAST > 0:
                c = np.asarray(Image.fromarray(union.astype(np.uint8))
                               .filter(ImageFilter.GaussianBlur(13)), np.float32) / 255.0
                rgba[..., :3] = np.array([120, 110, 92], np.float32)
                rgba[..., 3] = np.clip(c * CAST, 0, 1)
            for lay, tint in layers:
                a = np.asarray(lay, np.float32)[..., None] / 255.0
                col = inkimg * (1.0 - tint) + np.array(TINT, np.float32) * tint
                oa = rgba[..., 3:4]
                na = a + oa * (1.0 - a)
                rgba[..., :3] = np.where(
                    na > 1e-6,
                    (col * a + rgba[..., :3] * oa * (1.0 - a)) / np.maximum(na, 1e-6),
                    rgba[..., :3])
                rgba[..., 3:4] = na
        al8 = rgba[..., 3]
        curve.append(float((al8 > 0.16).mean() * 100))
        left.append(float((al8[:, :W // 3] > 0.16).mean() * 100))
        arr = np.concatenate([np.clip(rgba[..., :3], 0, 255),
                              np.clip(rgba[..., 3:4] * 255.0, 0, 255)], axis=2)
        Image.fromarray(arr.astype(np.uint8), "RGBA").save(
            os.path.join(d, "f%04d.png" % fi))
        if fi % 90 == 0:
            print("    %s  %4d/%d" % (name, fi, frames), flush=True)

    # encode: VP9 WITH ALPHA for the stack, H.264 on black for Safari
    mp4 = os.path.join(OUT, name + ".mp4")
    webm = os.path.join(OUT, name + ".webm")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS),
                    "-i", os.path.join(d, "f%04d.png"),
                    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                    "-crf", "26", "-b:v", "0", "-auto-alt-ref", "0",
                    "-row-mt", "1", "-an", webm], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi",
                    "-i", "color=c=black:s=%dx%d:r=%d" % (W, H, FPS),
                    "-framerate", str(FPS), "-i", os.path.join(d, "f%04d.png"),
                    "-filter_complex", "[0:v][1:v]overlay=shortest=1[v]",
                    "-map", "[v]", "-c:v", "libx264", "-preset", "slow",
                    "-crf", "19", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", "-an", mp4], check=True)
    # the reduced-motion poster: the line at its fullest
    pk = int(np.argmax(curve))
    Image.open(os.path.join(d, "f%04d.png" % pk)).convert("RGB").save(
        os.path.join(POST, name + ".webp"), quality=88, method=6)

    lp = max(left) if left else 0.0
    clear = next((i for i in range(pk, len(left)) if left[i] < 0.05 * lp), -1)
    gone = next((i for i in range(pk, len(curve)) if curve[i] < 0.02), -1)
    print("  %-12s %d frames  peak ink %.2f%% at %.2fs   left third clear %.2fs"
          "   all gone %.2fs" % (name, frames, max(curve), pk / FPS,
                                 clear / FPS if clear > 0 else -1,
                                 gone / FPS if gone > 0 else -1))
    print("               -> nextAt should be about %.1f"
          % ((clear / FPS - 0.4) if clear > 0 else -1))
    try:
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
        os.rmdir(d)
    except OSError as e:
        print("  (could not clear %s: %s - harmless)" % (d, e))
    return curve, left


if __name__ == "__main__":
    want = sys.argv[1:] or list(PIECES)
    for nm in list(PIECES):
        if any(w in nm for w in want):
            build(nm, PIECES[nm])
