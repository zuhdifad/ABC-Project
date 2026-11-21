"""Remove the baked-in 'PRESS START BUTTON' caption from the wide (16:9) cover art.

Strategy: mask near-white glyph pixels (+dilate to eat the black outline), then a
harmonic (Laplace) fill of the masked area so the band blends into the street like
natural depth-of-field, and finally a light gaussian pass inside the mask.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets-src" / "cover-wide.jpg"
DST = ROOT / "client" / "public" / "cover.jpg"

BAND = (0.630, 0.716)
XSPAN = (0.26, 0.74)
WHITE = 205
DILATE = 11
ITERS = 400


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape

    x0, x1 = int(w * XSPAN[0]), int(w * XSPAN[1])
    y0, y1 = int(h * BAND[0]), int(h * BAND[1])

    reg = a[y0:y1, x0:x1]
    mask = (reg[:, :, 0] > WHITE) & (reg[:, :, 1] > WHITE) & (reg[:, :, 2] > WHITE)

    d = mask.copy()
    for _ in range(DILATE):
        m = d.copy()
        m[1:, :] |= d[:-1, :]
        m[:-1, :] |= d[1:, :]
        m[:, 1:] |= d[:, :-1]
        m[:, :-1] |= d[:, 1:]
        d = m

    out = reg.copy()
    sel = d[..., None]
    for _ in range(ITERS):
        avg = (
            np.roll(out, 1, axis=0) + np.roll(out, -1, axis=0) +
            np.roll(out, 1, axis=1) + np.roll(out, -1, axis=1)
        ) / 4.0
        out = np.where(sel, avg, out)

    blur = np.asarray(
        Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.4))
    ).astype(np.float32)
    out = np.where(sel, blur, out)

    a[y0:y1, x0:x1] = out
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(DST, quality=94, optimize=True)
    print("saved", DST, "size", (w, h), "masked px", int(d.sum()))


if __name__ == "__main__":
    main()
