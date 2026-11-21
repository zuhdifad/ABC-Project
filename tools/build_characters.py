#!/usr/bin/env python3
"""
Character art pipeline — drop a big portrait in, get every game size out.

Drop zone : assets-src/characters/<Name>-char.{jpeg,jpg,png,webp}
            (any flat-backdrop full-body portrait; the filename becomes the id)

Outputs   : client/public/chars/<id>.webp         big showcase art (1024 px tall)
            client/public/chars/<id>-sprite.png   select-screen figure (128 px tall)
            client/public/chars/<id>-face.png     filmstrip bust tile (220x264)
            client/public/chars/<id>-pixel.png    in-game pixel sprite (100 px tall)
            client/public/chars/index.json        id -> sizes, for tooling

Only `-pixel.png` is transformed. The lobby art (webp / sprite / face) stays
the clean photo cutout it has always been — the pixel transform happens to the
character you actually walk around with, not to the character you pick.

The pixel sprite is the cutout shrunk onto a hard grid, snapped to a small
adaptive palette (no dithering), alpha binarised (no soft edges) and scaled
back up with nearest neighbours — the same transform for every character.

The flat studio backdrop is flood-filled away from the borders only, so white
shirts *inside* the silhouette survive. Edges are de-fringed against the
backdrop colour so no grey halo follows the character into the street scene.

Run:  python3 tools/build_characters.py
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-src", "characters")
OUT = os.path.join(ROOT, "client", "public", "chars")

BIG_H = 1024
SPRITE_H = 128
FACE_W, FACE_H = 220, 264

# Pixel-art grid for the in-game sprite, in art pixels. One grid cell becomes
# an integer block of PNG pixels, so the runtime never resamples it.
PIXEL_GRID, PIXEL_SCALE, PIXEL_COLORS = 48, 2, 26
PIXEL_GAIN = 1.35                     # chibi widening: photoreal people are too
                                      # narrow to read as a 100 px game sprite
PIXEL_H = PIXEL_GRID * PIXEL_SCALE
OUTLINE = (24, 18, 15)                # one-pixel silhouette border
ALPHA_CUT = 100                       # alpha below this is not a pixel at all

BG_TOL = 72          # colour distance still considered backdrop / floor shadow
BG_CHROMA = 14       # backdrop is neutral grey; clothing and skin are not
EDGE_LO, EDGE_HI = 18.0, 92.0   # soft-edge alpha ramp


def runs(mask_row):
    """[start, end) intervals of True pixels in one boolean row."""
    d = np.diff(np.concatenate(([0], mask_row.view(np.int8), [0])))
    starts = np.flatnonzero(d == 1)
    ends = np.flatnonzero(d == -1)
    return list(zip(starts.tolist(), ends.tolist()))


def border_connected(mask):
    """Keep only the backdrop regions that touch an image border (scanline union-find)."""
    h, w = mask.shape
    parent = []

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    rows = []
    prev = []
    for y in range(h):
        cur = []
        for s, e in runs(mask[y]):
            idx = len(parent)
            parent.append(idx)
            cur.append((s, e, idx))
        # link overlapping runs of the previous row
        i = j = 0
        while i < len(prev) and j < len(cur):
            ps, pe, pi = prev[i]
            cs, ce, ci = cur[j]
            if ps < ce and cs < pe:
                union(pi, ci)
            if pe < ce:
                i += 1
            else:
                j += 1
        rows.append(cur)
        prev = cur

    seeds = set()
    for y, row in enumerate(rows):
        for s, e, idx in row:
            if y == 0 or y == h - 1 or s == 0 or e == w:
                seeds.add(find(idx))
    out = np.zeros_like(mask)
    for y, row in enumerate(rows):
        for s, e, idx in row:
            if find(idx) in seeds:
                out[y, s:e] = True
    return out


def dilate(mask, n=1):
    out = mask.copy()
    for _ in range(n):
        p = np.pad(out, 1, mode="constant", constant_values=False)
        out = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] |
               p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:] | out)
    return out


def cutout(im):
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                             rgb[:, 0:6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dist = np.abs(rgb - bg).max(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)

    # the studio backdrop AND its soft floor shadow are neutral grey
    backdrop = border_connected((dist < BG_TOL) & (chroma < BG_CHROMA))
    alpha = np.where(backdrop, 0.0, 1.0)

    # soft, de-fringed edge: only the pixels hugging the backdrop get a ramp
    edge = (~backdrop) & dilate(backdrop, 2)
    ramp = np.clip((dist - EDGE_LO) / (EDGE_HI - EDGE_LO), 0.0, 1.0)
    # neutral pixels must clear the whole shadow range before they count as art
    neutral = np.clip((dist - BG_TOL) / 30.0, 0.0, 1.0)
    ramp = np.where(chroma < BG_CHROMA, np.minimum(ramp, neutral), ramp)
    alpha = np.where(edge, np.minimum(alpha, ramp), alpha)

    a3 = alpha[..., None]
    safe = np.maximum(a3, 0.35)
    rgb = np.clip((rgb - (1 - a3) * bg) / safe, 0, 255)
    rgb = np.where(a3 > 0.02, rgb, 255)

    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    # a hair of blur on the alpha only, so the cutout is not stair-stepped
    r, g, b, a = img.split()
    img = Image.merge("RGBA", (r, g, b, a.filter(ImageFilter.GaussianBlur(0.6))))

    box = img.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if box:
        pad = 6
        box = (max(0, box[0] - pad), max(0, box[1] - pad),
               min(w, box[2] + pad), min(h, box[3] + pad))
        img = img.crop(box)
    return img


def bust(img):
    """Head-and-shoulders tile for the filmstrip, centred on the head."""
    w, h = img.size
    a = np.asarray(img.getchannel("A"))
    head = a[: max(1, int(h * 0.22))] > 40
    cols = np.flatnonzero(head.any(axis=0))
    cx = int(cols.mean()) if cols.size else w // 2
    crop_h = int(h * 0.34)
    crop_w = int(crop_h * FACE_W / FACE_H)
    left = int(np.clip(cx - crop_w / 2, 0, max(0, w - crop_w)))
    tile = img.crop((left, 0, min(w, left + crop_w), min(h, crop_h)))
    return tile.resize((FACE_W, FACE_H), Image.LANCZOS)


def pixel_grid(art, grid_h, colors, width_gain=1.0):
    """Resample a cutout onto a hard pixel grid with a cut-down palette.

    The resize is premultiplied, so the transparent backdrop cannot drag a
    grey fringe into the suit. Alpha is then binarised: a pixel either exists
    or it does not, which is the whole point of the look.
    """
    box = art.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if box:
        art = art.crop(box)
    w = max(1, round(art.width * grid_h / art.height * width_gain))
    small = art.convert("RGBa").resize((w, grid_h), Image.LANCZOS).convert("RGBA")
    r, g, b, a = small.split()
    a = a.point(lambda v: 255 if v >= ALPHA_CUT else 0)
    q = Image.merge("RGB", (r, g, b)).quantize(
        colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    return Image.merge("RGBA", (*q.split(), a))


def outline(grid):
    """One art pixel of dark border around the silhouette, grown outwards."""
    mask = np.asarray(grid.getchannel("A")) > 0
    ring = np.pad(dilate(mask, 1) & ~mask, 1, mode="constant", constant_values=False)
    out = Image.new("RGBA", (grid.width + 2, grid.height + 2), (0, 0, 0, 0))
    out.paste(grid, (1, 1))
    layer = np.zeros((ring.shape[0], ring.shape[1], 4), dtype=np.uint8)
    layer[ring] = (*OUTLINE, 255)
    out.alpha_composite(Image.fromarray(layer, "RGBA"))
    return out


def scale_to_height(img, height):
    w = max(1, round(img.width * height / img.height))
    return img.resize((w, height), Image.LANCZOS)


def pixel_art(art, grid_h, scale, colors, width_gain=1.0):
    """Portrait -> outlined pixel grid -> nearest-neighbour blocks."""
    grid = outline(pixel_grid(art, grid_h, colors, width_gain))
    return grid.resize((grid.width * scale, grid.height * scale), Image.NEAREST)


def slug(name):
    s = re.sub(r"-char$", "", name, flags=re.I)
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"missing drop zone: {SRC}")
    os.makedirs(OUT, exist_ok=True)
    files = [f for f in sorted(os.listdir(SRC))
             if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
    only = [a.lower() for a in sys.argv[1:]]
    if only:
        files = [f for f in files if slug(os.path.splitext(f)[0]) in only]
    if not files:
        sys.exit(f"no art in {SRC}")
    index = {}
    idx_path = os.path.join(OUT, "index.json")
    if only and os.path.exists(idx_path):
        with open(idx_path) as fh:
            index = json.load(fh)
    for f in files:
        cid = slug(os.path.splitext(f)[0])
        art = cutout(Image.open(os.path.join(SRC, f)))
        big = scale_to_height(art, BIG_H)
        sprite = scale_to_height(art, SPRITE_H)
        face = bust(art)
        pixel = pixel_art(art, PIXEL_GRID, PIXEL_SCALE, PIXEL_COLORS, PIXEL_GAIN)
        big.save(os.path.join(OUT, f"{cid}.webp"), "WEBP", quality=90, method=6)
        sprite.save(os.path.join(OUT, f"{cid}-sprite.png"), "PNG", optimize=True)
        face.save(os.path.join(OUT, f"{cid}-face.png"), "PNG", optimize=True)
        pixel.save(os.path.join(OUT, f"{cid}-pixel.png"), "PNG", optimize=True)
        index[cid] = {"big": [big.width, big.height],
                      "sprite": [sprite.width, sprite.height],
                      "face": [FACE_W, FACE_H],
                      "pixel": [pixel.width, pixel.height],
                      "grid": PIXEL_GRID}
        print(f"{cid:10s} big {big.width}x{big.height}  "
              f"sprite {sprite.width}x{sprite.height}  "
              f"pixel {pixel.width}x{pixel.height}")
    with open(os.path.join(OUT, "index.json"), "w") as fh:
        json.dump(index, fh, indent=2)
    print(f"\n{len(files)} characters -> {OUT}")


if __name__ == "__main__":
    main()