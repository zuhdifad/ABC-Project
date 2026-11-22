#!/usr/bin/env python3
"""
Walk-cycle sprite sheets — clearly-identified PLACEHOLDER animation art.

The supplied character art is a single static pose: it has NO walking frames.
Rather than pretend it does, this tool draws a real, limb-alternating walk
cycle for every character in their own colours (palette lifted from the pixel
sprite), packed into a sprite sheet the engine can play frame by frame.

These are temporary assets with a permanent contract: when a hand-animated
sheet in the same layout arrives it is a drop-in file replacement — nothing in
the game code changes.

Sheet layout (row-major, 6 frames across x 4 directions down):
    row 0  DOWN  (front, facing camera)
    row 1  UP    (back, walking away)
    row 2  LEFT  (profile)
    row 3  RIGHT (profile)
  columns: [idle0, idle1, walk0, walk1, walk2, walk3]

Each frame is a 16 x 24 art-pixel cell drawn at SCALE for crisp nearest edges.
A manifest json records frame size, the ground-contact row and the palette so
the runtime can anchor feet to the floor and reuse the colours elsewhere.

Input  : client/public/chars/<id>-pixel.png
Output : client/public/rigs/<id>-walk.png   transparent walk sheet
         client/public/rigs/<id>-walk.json  frame geometry + palette

Run:  python3 tools/build_walk_sheets.py
      python3 tools/build_walk_sheets.py aaron ayu
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "client", "public", "chars")
OUT = os.path.join(ROOT, "client", "public", "rigs")

GW, GH = 16, 24          # art-pixel cell: a whole character fits inside
SCALE = 4                # art px -> sheet px; keeps the pixel grid hard
COLS = ["idle0", "idle1", "walk0", "walk1", "walk2", "walk3"]
ROWS = ["down", "up", "left", "right"]
BLOCK = 2                # source -pixel.png is stored at 2x per art pixel


# --------------------------------------------------------------------------
# palette
# --------------------------------------------------------------------------
def is_skin(rgb):
    r, g, b = (int(v) for v in rgb[:3])
    return r > 90 and r > b + 25 and g > b + 8 and abs(r - g) < 95


def extract_palette(cid):
    """Lift hair / skin / shirt / pants / shoe colours off the static sprite."""
    im = Image.open(os.path.join(SRC, f"{cid}-pixel.png")).convert("RGBA")
    a = np.asarray(im)[::BLOCK, ::BLOCK]
    alpha = a[:, :, 3] > 100
    h, w = alpha.shape

    def median(rowslice, colslice, pred=lambda c: True):
        pts = [a[y, x, :3] for y in rowslice for x in colslice
               if alpha[y, x] and pred(a[y, x, :3])]
        if not pts:
            return None
        return tuple(int(v) for v in np.median(pts, axis=0))

    ys = np.flatnonzero(alpha.sum(axis=1) > 0)
    top, bottom = int(ys[0]), int(ys[-1])
    xs = np.flatnonzero(alpha.sum(axis=0) > 0)
    mid = (int(xs[0]) + int(xs[-1])) // 2
    body = range(int(xs[0]), int(xs[-1]) + 1)

    skin = median(range(top, top + 6), body, is_skin) or (210, 165, 130)
    hair = median(range(top, top + 3), body, lambda c: not is_skin(c)) or (45, 32, 26)
    shirt = median(range(top + 8, top + 15), body, lambda c: not is_skin(c)) or (70, 80, 100)
    pants = median(range(top + 16, bottom - 2), body, lambda c: not is_skin(c)) or (40, 44, 58)
    shoes = median(range(bottom - 2, bottom + 1), body, lambda c: not is_skin(c)) or (28, 24, 22)

    shade = lambda c, f: tuple(max(0, min(255, int(v * f))) for v in c)
    return {
        "skin": skin, "hair": hair,
        "shirt": shirt, "shirt_dk": shade(shirt, 0.78),
        "pants": pants, "pants_dk": shade(pants, 0.72),
        "shoe": shoes, "outline": (26, 20, 18),
    }


# --------------------------------------------------------------------------
# tiny pixel canvas
# --------------------------------------------------------------------------
class Cell:
    def __init__(self, pal):
        self.buf = np.zeros((GH, GW, 4), dtype=np.uint8)
        self.pal = pal

    def px(self, x, y, rgb):
        if 0 <= x < GW and 0 <= y < GH:
            self.buf[y, x] = (*rgb, 255)

    def rect(self, x, y, w, h, rgb):
        for j in range(h):
            for i in range(w):
                self.px(x + i, y + j, rgb)

    def limb(self, x, y, length, width, rgb):
        """a vertical limb that can be lifted (shorter) or planted."""
        self.rect(x, y, width, max(1, length), rgb)


# --------------------------------------------------------------------------
# the figure
# --------------------------------------------------------------------------
# base skeleton, front view, standing (art pixels, y from the head top)
HEAD_Y, HEAD_H = 1, 6
TORSO_Y, TORSO_H = 7, 7
LEG_Y, LEG_H = 14, 8      # hips to the ground
ARM_Y = 7


def draw_figure(pal, view, phase, walking):
    """Render one frame. phase 0..1 drives the stride; feet touch at extremes."""
    c = Cell(pal)
    bob = 0
    if walking:
        # two bobs per cycle: hip rises on the passing pose, drops at contact
        bob = int(round(-1 * math.cos(phase * 4 * math.pi)))
    else:
        bob = 0 if phase < 0.5 else 0  # idle handled by caller

    s = math.sin(phase * 2 * math.pi)          # stride wave
    swing = s                                  # -1..1

    cx = GW // 2
    head_top = HEAD_Y + bob
    torso_top = TORSO_Y + bob
    hip_y = LEG_Y + bob

    if view in ("down", "up"):
        # ---- facing / away from camera: legs alternate forward (lift) ----
        liftL = int(max(0, s) * 2)
        liftR = int(max(0, -s) * 2)
        spread = 2 if walking else 1
        # torso
        c.rect(cx - 3, torso_top, 6, TORSO_H, pal["shirt"])
        c.rect(cx - 3, torso_top, 1, TORSO_H, pal["shirt_dk"])
        c.rect(cx + 2, torso_top, 1, TORSO_H, pal["shirt_dk"])
        # head
        c.rect(cx - 3, head_top, 6, HEAD_H, pal["skin"])
        c.rect(cx - 3, head_top, 6, 3, pal["hair"])            # hair cap
        if view == "down":
            c.px(cx - 2, head_top + 4, pal["outline"])          # eyes
            c.px(cx + 1, head_top + 4, pal["outline"])
        else:
            c.rect(cx - 3, head_top, 6, 5, pal["hair"])         # back of head
        # arms swing opposite the legs
        aL = int(max(0, -s) * 2); aR = int(max(0, s) * 2)
        c.rect(cx - 4, ARM_Y + bob + aL, 1, 6, pal["shirt"])
        c.rect(cx + 3, ARM_Y + bob + aR, 1, 6, pal["shirt"])
        c.px(cx - 4, ARM_Y + bob + aL + 6, pal["skin"])
        c.px(cx + 3, ARM_Y + bob + aR + 6, pal["skin"])
        # legs: planted leg full length, lifted leg shorter + foot
        c.rect(cx - 1 - spread, hip_y, 2, LEG_H - liftL, pal["pants"])
        c.rect(cx - 1 - spread, hip_y + LEG_H - liftL, 2, 1, pal["shoe"])
        c.rect(cx + spread - 1, hip_y, 2, LEG_H - liftR, pal["pants"])
        c.rect(cx + spread - 1, hip_y + LEG_H - liftR, 2, 1, pal["shoe"])

    else:
        # ---- profile: legs swing fore/aft along x, one arm forward ----
        dirx = 1 if view == "right" else -1
        lead = int(round(s * 2)) * dirx         # forward foot offset
        trail = -lead
        # torso (slightly narrower in profile)
        c.rect(cx - 2, torso_top, 4, TORSO_H, pal["shirt"])
        c.rect(cx - 2 + (1 if dirx > 0 else 2), torso_top, 1, TORSO_H, pal["shirt_dk"])
        # head with a face on the leading side
        c.rect(cx - 2, head_top, 5, HEAD_H, pal["skin"])
        c.rect(cx - 2, head_top, 5, 3, pal["hair"])
        c.rect(cx - 2 - dirx if dirx < 0 else cx + 2, head_top, 1, 4, pal["hair"])
        c.px(cx + dirx, head_top + 4, pal["outline"])           # eye
        # back arm then body then front arm
        c.rect(cx - 3, ARM_Y + bob - trail, 1, 6, pal["shirt_dk"])
        c.rect(cx + 2, ARM_Y + bob + lead, 1, 6, pal["shirt"])
        c.px(cx + 2, ARM_Y + bob + lead + 6, pal["skin"])
        # legs: the two feet step fore and aft, contact at the extremes
        c.rect(cx - 1 + trail, hip_y, 2, LEG_H, pal["pants_dk"])
        c.rect(cx - 1 + trail, hip_y + LEG_H, 2, 1, pal["shoe"])
        c.rect(cx - 1 + lead, hip_y, 2, LEG_H - int(max(0, abs(lead)) // 2), pal["pants"])
        c.rect(cx - 1 + lead, hip_y + LEG_H, 2, 1, pal["shoe"])
    return c


def idle_frame(pal, view, breathe):
    """Quiet two-frame idle: the chest rises, nothing steps."""
    c = Cell(pal)
    cx = GW // 2
    lift = 1 if breathe else 0
    if view in ("down", "up"):
        c.rect(cx - 3, TORSO_Y - lift, 6, TORSO_H, pal["shirt"])
        c.rect(cx - 3, HEAD_Y - lift, 6, HEAD_H, pal["skin"])
        c.rect(cx - 3, HEAD_Y - lift, 6, 3, pal["hair"])
        if view == "down":
            c.px(cx - 2, HEAD_Y - lift + 4, pal["outline"])
            c.px(cx + 1, HEAD_Y - lift + 4, pal["outline"])
        else:
            c.rect(cx - 3, HEAD_Y - lift, 6, 5, pal["hair"])
        c.rect(cx - 4, ARM_Y - lift, 1, 6, pal["shirt"])
        c.rect(cx + 3, ARM_Y - lift, 1, 6, pal["shirt"])
        c.rect(cx - 2, LEG_Y, 2, LEG_H, pal["pants"])
        c.rect(cx + 1, LEG_Y, 2, LEG_H, pal["pants"])
        c.rect(cx - 2, LEG_Y + LEG_H, 2, 1, pal["shoe"])
        c.rect(cx + 1, LEG_Y + LEG_H, 2, 1, pal["shoe"])
    else:
        dirx = 1 if view == "right" else -1
        c.rect(cx - 2, TORSO_Y - lift, 4, TORSO_H, pal["shirt"])
        c.rect(cx - 2, HEAD_Y - lift, 5, HEAD_H, pal["skin"])
        c.rect(cx - 2, HEAD_Y - lift, 5, 3, pal["hair"])
        c.px(cx + dirx, HEAD_Y - lift + 4, pal["outline"])
        c.rect(cx - 3, ARM_Y - lift, 1, 6, pal["shirt_dk"])
        c.rect(cx + 2, ARM_Y - lift, 1, 6, pal["shirt"])
        c.rect(cx - 1, LEG_Y, 2, LEG_H, pal["pants"])
        c.rect(cx + 1, LEG_Y, 2, LEG_H, pal["pants_dk"])
        c.rect(cx - 1, LEG_Y + LEG_H, 2, 1, pal["shoe"])
        c.rect(cx + 1, LEG_Y + LEG_H, 2, 1, pal["shoe"])
    return c


def render_cell(c):
    img = Image.fromarray(c.buf, "RGBA")
    return img.resize((GW * SCALE, GH * SCALE), Image.NEAREST)


def build(cid):
    src = os.path.join(SRC, f"{cid}-pixel.png")
    if not os.path.exists(src):
        return None
    pal = extract_palette(cid)
    sheet = Image.new("RGBA", (GW * SCALE * len(COLS), GH * SCALE * len(ROWS)),
                      (0, 0, 0, 0))
    for r, view in enumerate(ROWS):
        for col_i, col in enumerate(COLS):
            if col.startswith("idle"):
                cell = idle_frame(pal, view, col == "idle1")
            else:
                phase = (int(col[-1]) + 0.0) / 4.0
                cell = draw_figure(pal, view, phase, walking=True)
            sheet.paste(render_cell(cell), (col_i * GW * SCALE, r * GH * SCALE))

    doc = {
        "id": cid,
        "placeholder": True,
        "frameWidth": GW * SCALE, "frameHeight": GH * SCALE,
        "cols": COLS, "rows": ROWS,
        "groundRow": GH - 1,                 # art row the feet stand on
        "anchorX": GW // 2,
        "palette": pal,
    }
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, f"{cid}-walk.png"))
    with open(os.path.join(OUT, f"{cid}-walk.json"), "w") as fh:
        json.dump(doc, fh)
    return doc


def main():
    ids = [a.lower() for a in sys.argv[1:]]
    if not ids:
        ids = sorted(f[:-10] for f in os.listdir(SRC) if f.endswith("-pixel.png"))
    ok = 0
    for cid in ids:
        doc = build(cid)
        if doc:
            ok += 1
            print(f"{cid:10s} sheet {doc['frameWidth']*6}x{doc['frameHeight']*4}  [placeholder]")
    print(f"\n{ok} walk sheets -> {OUT}")


if __name__ == "__main__":
    main()
