"""Remove the baked-in 'PRESS START BUTTON' band from the cover art.

Strategy: mask near-white glyph pixels (+dilate to eat the black outline),
then harmonic (Laplace) fill of the masked areas so the band blends into the
surrounding street like natural depth-of-field, then a light gaussian pass.
"""
from PIL import Image, ImageFilter
import numpy as np

SRC = "/Users/user/Library/Application Support/Qoder/SharedClientCache/cache/images/5be6e77a/ABC Project cover-7e198c01.jpg"
DST = "/Users/user/Documents/ABC/client/public/cover.jpg"

img = Image.open(SRC).convert("RGB")
a = np.asarray(img).astype(np.float32)
H, W, _ = a.shape

x0, x1 = int(W * 0.24), int(W * 0.76)
y0, y1 = int(H * 0.624), int(H * 0.707)

reg = a[y0:y1, x0:x1]
# near-white glyph fill
mask = (reg[:, :, 0] > 200) & (reg[:, :, 1] > 200) & (reg[:, :, 2] > 200)
# dilate to swallow the heavy black outline and antialiasing
d = mask.copy()
for _ in range(9):
    m = d.copy()
    m[1:, :] |= d[:-1, :]
    m[:-1, :] |= d[1:, :]
    m[:, 1:] |= d[:, :-1]
    m[:, :-1] |= d[:, 1:]
    d = m

out = reg.copy()
sel = d[..., None]

# harmonic fill: masked pixels converge to the average of their neighbours,
# clean pixels stay pinned -> a smooth, streak-free blur patch
for _ in range(400):
    avg = (
        np.roll(out, 1, axis=0) + np.roll(out, -1, axis=0) +
        np.roll(out, 1, axis=1) + np.roll(out, -1, axis=1)
    ) / 4.0
    out = np.where(sel, avg, out)

# gentle gaussian inside the mask only, to hide the pixel-level seams
blur = np.asarray(
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
).astype(np.float32)
out = np.where(sel, blur, out)

a[y0:y1, x0:x1] = out
res = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
res.save(DST, quality=93, optimize=True)
print("saved", DST, res.size)
