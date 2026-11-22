#!/usr/bin/env python3
"""
Erase the bystanders baked into a painted place.

The station plate was delivered with five commuters painted onto the floor and
in front of the counters. The game draws its OWN animated characters, so the
baked people must go — but the floor and the walls behind them have to come back
looking like they were never covered.

Method: for each hole, slide a patch of the still-intact art over it and keep the
translation whose ring of known pixels best matches the ring around the hole.
The floor is a repeating isometric tile lattice and the walls run horizontally,
so the shift that continues the pattern around the boundary also continues it
through the middle — the diamond motifs and the counter line up instead of being
blurred into mush. A short feather hides the seam.

Run:  python3 tools/clean_place_npcs.py            (writes in place, keeps a .orig)
      python3 tools/clean_place_npcs.py --dry      (preview only, no overwrite)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLACE = os.path.join(ROOT, "client", "public", "places", "kl-sentral.jpg")

# the bystanders to remove, in image pixels (x1, y1, x2, y2)
HOLES = [
    ("lrt counter person", (250, 146, 300, 222)),
    ("escalator person",   (704, 108, 762, 206)),
    ("wheelchair pair",    (318, 338, 430, 464)),
    ("suitcase woman",     (944, 272, 1024, 402)),
    ("traveller",          (548, 400, 650, 566)),
]

# surfaces a hole must NOT be filled from: the foreground plinth, the black cut
# corners, the ticket hardware and the escalator machinery. Without this the
# cheapest ring match for the wheelchair was the beige plinth wall.
NO_SOURCE = [
    (0, 360, 300, 756),      # foreground plinth (bottom-left)
    (0, 288, 262, 566),      # the black void left of the plinth
    (1000, 90, 1240, 322),   # ticket gates
    (1240, 290, 1338, 410),  # fare machines
    (1222, 260, 1276, 352),  # info totem
    (1190, 330, 1240, 384),  # bin
    (1134, 380, 1254, 466),  # luggage trolleys
    (150, 168, 212, 224),    # the dark bin by the LRT counter
    (556, 0, 764, 118),      # escalator machinery at the top
    (836, 256, 872, 314),    # hanging sign post
]

MARGIN = 16        # ring width of known pixels used to score a shift
SEARCH = 320       # how far left/right a candidate patch may come from
STEP = 2           # candidate shift granularity (px)


def score_shift(arr, hole, dx, dy, mask, blocked):
    """SSD between the ring around the hole and the same ring shifted by (dx,dy).

    A candidate is rejected unless the patch it would copy — the hole interior
    AND its ring, translated — sits entirely on still-intact art. Without that
    rule the cheapest shift is often the person itself nudged a few pixels,
    which scores perfectly on the ring and pastes the bystander right back.
    """
    x1, y1, x2, y2 = hole
    # outer band = hole grown by MARGIN, minus the hole itself
    ox1, oy1, ox2, oy2 = x1 - MARGIN, y1 - MARGIN, x2 + MARGIN, y2 + MARGIN
    if ox1 < 0 or oy1 < 0 or ox2 >= arr.shape[1] or oy2 >= arr.shape[0]:
        return None
    sx1, sy1 = ox1 + dx, oy1 + dy
    if sx1 < 0 or sy1 < 0 or sx1 + (ox2 - ox1) > arr.shape[1] or sy1 + (oy2 - oy1) > arr.shape[0]:
        return None
    sh, sw = oy2 - oy1, ox2 - ox1
    srcband = blocked[sy1:sy1 + sh, sx1:sx1 + sw] | mask[sy1:sy1 + sh, sx1:sx1 + sw]
    # the whole source band must be clean, not just enough of the ring
    if srcband.any():
        return None
    dest = arr[oy1:oy2, ox1:ox2]
    srcpx = arr[sy1:sy1 + sh, sx1:sx1 + sw]
    known = ~mask[oy1:oy2, ox1:ox2]
    if known.sum() < 32:
        return None
    d = (dest.astype(np.int32) - srcpx.astype(np.int32))
    return (d * d).sum(axis=2)[known].mean()


def fill_hole(arr, hole, mask, blocked):
    x1, y1, x2, y2 = hole

    def sweep(dy_lo, dy_hi, dy_step, dx_step):
        best, best_v = None, None
        for dy in range(dy_lo, dy_hi + 1, dy_step):
            for dx in range(-SEARCH, SEARCH + 1, dx_step):
                if dx == 0 and dy == 0:
                    continue
                s = score_shift(arr, hole, dx, dy, mask, blocked)
                if s is not None and (best is None or s < best):
                    best, best_v = s, (dx, dy)
        return best, best_v

    # first try a same-row neighbour (best pattern continuity); only if every
    # horizontal donor is blocked do we reach up/down the floor for a patch
    best, best_v = sweep(-STEP, STEP, STEP, STEP)
    if best_v is None:
        best, best_v = sweep(-240, 240, 3, 4)
    if best_v is None:
        return None
    dx, dy = best_v
    arr[y1:y2, x1:x2] = arr[y1 + dy:y2 + dy, x1 + dx:x2 + dx]
    return best_v


def feather(arr, hole, radius=2):
    """soften the hard rectangle seam with a tiny blur on the border only"""
    x1, y1, x2, y2 = hole
    sub = arr[max(0, y1 - radius):y2 + radius, max(0, x1 - radius):x2 + radius]
    img = Image.fromarray(sub).filter(ImageFilter.GaussianBlur(radius))
    blurred = np.asarray(img)
    border = np.zeros(sub.shape[:2], dtype=bool)
    border[:radius] = border[-radius:] = True
    border[:, :radius] = border[:, -radius:] = True
    sub[border] = blurred[border]
    arr[max(0, y1 - radius):y2 + radius, max(0, x1 - radius):x2 + radius] = sub


def main():
    dry = "--dry" in sys.argv
    im = Image.open(PLACE).convert("RGB")
    arr = np.asarray(im).copy()
    mask = np.zeros(arr.shape[:2], dtype=bool)
    for _, (x1, y1, x2, y2) in HOLES:
        mask[y1:y2, x1:x2] = True
    blocked = np.zeros(arr.shape[:2], dtype=bool)
    for (x1, y1, x2, y2) in NO_SOURCE:
        blocked[y1:y2, x1:x2] = True

    for name, hole in HOLES:
        v = fill_hole(arr, hole, mask, blocked)
        feather(arr, hole)
        print(f"  {name:20s} shift {v}")

    out = Image.fromarray(arr)
    if dry:
        out.save(os.path.join(ROOT, "client", "public", "places", "kl-sentral-clean.png"))
        print("preview -> kl-sentral-clean.png (source untouched)")
        return
    orig = PLACE + ".orig"
    if not os.path.exists(orig):
        os.replace(PLACE, orig)          # keep the delivered plate once
    else:
        os.remove(PLACE)
    out.save(orig if False else PLACE, quality=95, subsampling=0)
    print(f"erased {len(HOLES)} bystanders -> {PLACE} (original kept as .orig)")


if __name__ == "__main__":
    main()
