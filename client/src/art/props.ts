/**
 * Village props, drawn once at native pixel resolution.
 *
 * Buildings are "2.5D" like a farm-life RPG: the footprint is the front of
 * the building, the roof leans back, and the sprite stands on its base line.
 * Everything is drawn from the shared palette and outlined with one dark
 * pixel so props read against the lawn.
 */
import { makeCanvas, mulberry32, outlineCanvas, Pen, type CanvasPair } from "./pixel";
import { P } from "./palette";

export type PropKind =
  | "oak" | "oakSmall" | "pine" | "bush" | "bushBerry" | "rock" | "stump"
  | "fence" | "lamp" | "bench" | "planter" | "signpost" | "crate" | "barrel"
  | "flowersPink" | "flowersYellow" | "flowersWhite" | "cart"
  | "cottage" | "cafe" | "station" | "tower";

function pen(w: number, h: number): { c: CanvasPair; p: Pen } {
  const c = makeCanvas(w, h);
  return { c, p: new Pen(c.ctx, w, h) };
}

/* ------------------------------------------------------------------ *
 * shared details
 * ------------------------------------------------------------------ */

function windowBox(
  p: Pen, x: number, y: number, w: number, h: number,
  frame = P.cream, glass = P.glass, shine = P.glassLight
) {
  p.rect(x - 2, y - 2, w + 4, h + 4, frame);
  p.rect(x, y, w, h, glass);
  p.rect(x, y, w, Math.max(2, h / 3 | 0), shine);
  p.vline(x + (w >> 1), y, h, frame);
  p.hline(x, y + (h >> 1), w, frame);
  p.rect(x - 3, y + h + 2, w + 6, 2, P.creamDark);
}

function awning(
  p: Pen, x: number, y: number, w: number, h: number,
  a: string, b: string
) {
  for (let i = 0; i < w; i += 8) {
    const color = (i / 8) % 2 === 0 ? a : b;
    p.rect(x + i, y, Math.min(8, w - i), h, color);
    p.rect(x + i + 1, y + h, Math.min(6, w - i), 1, color);
    p.rect(x + i + 2, y + h + 1, Math.min(4, w - i), 1, color);
  }
  p.hline(x, y - 1, w, P.creamShade);
}

/* ------------------------------------------------------------------ *
 * nature
 * ------------------------------------------------------------------ */

function oak(seed: number, small = false): HTMLCanvasElement {
  const s = small ? 0.78 : 1;
  const w = Math.round(48 * s), h = Math.round(64 * s);
  const { c, p } = pen(w, h);
  const rnd = mulberry32(seed);
  const cx = w >> 1;

  // trunk + roots
  const tw = Math.max(4, Math.round(7 * s));
  p.rect(cx - (tw >> 1), Math.round(38 * s), tw, Math.round(22 * s), P.trunk);
  p.rect(cx - (tw >> 1), Math.round(38 * s), 2, Math.round(22 * s), P.trunkLight);
  p.rect(cx + (tw >> 1) - 2, Math.round(38 * s), 2, Math.round(22 * s), P.trunkDark);
  p.rect(cx - 8, h - 8, 5, 3, P.trunkDark);
  p.rect(cx + 3, h - 8, 5, 3, P.trunkDark);

  const cy = Math.round(30 * s);
  // layered canopy: deep shadow, body, sun-lit clumps
  p.disc(cx, cy, Math.round(20 * s), P.leafDeep);
  p.disc(cx - 13, cy + 2, Math.round(11 * s), P.leafDeep);
  p.disc(cx + 13, cy + 2, Math.round(11 * s), P.leafDeep);
  p.disc(cx, cy - 2, Math.round(17 * s), P.leaf[1]);
  p.disc(cx - 12, cy, Math.round(10 * s), P.leaf[1]);
  p.disc(cx + 12, cy, Math.round(10 * s), P.leaf[1]);
  p.disc(cx, cy - Math.round(14 * s), Math.round(11 * s), P.leaf[2]);
  p.disc(cx - 7, cy - 8, Math.round(8 * s), P.leaf[3]);
  p.disc(cx + 7, cy - 5, Math.round(7 * s), P.leaf[3]);
  p.disc(cx - 1, cy - 16, Math.round(6 * s), P.leafHigh);

  // leaf clusters along the underside keep the rim from looking like a circle
  for (let i = 0; i < 9; i++) {
    p.disc(
      cx - 16 + rnd() * 32,
      cy + 8 + rnd() * 8,
      2 + Math.round(rnd() * 2),
      rnd() < 0.5 ? P.leafShade : P.leafDark
    );
  }
  for (let i = 0; i < 14; i++) {
    p.px(
      cx - 14 + Math.floor(rnd() * 28),
      Math.round(6 * s) + Math.floor(rnd() * 24 * s),
      rnd() < 0.5 ? P.leafHigh : P.leafGlow
    );
  }
  return outlineCanvas(cv(c), P.outline);
}

function pine(seed: number): HTMLCanvasElement {
  const { c, p } = pen(38, 70);
  const rnd = mulberry32(seed);
  const cx = 19;
  p.rect(cx - 3, 52, 6, 16, P.trunk);
  p.rect(cx - 3, 52, 2, 16, P.trunkLight);
  p.rect(cx - 8, 66, 16, 3, P.trunkDark);

  const tiers: [number, number, number][] = [[18, 3, 34], [26, 17, 40], [36, 32, 48]];
  for (const [half, top, bottom] of tiers) {
    p.tri(cx, top, cx - half, bottom, cx + half, bottom, P.pine[1]);
    p.tri(cx, top, cx - half, bottom, cx - half + 7, bottom, P.pine[2]);
    p.tri(cx, top + 2, cx - half + 4, bottom, cx - half + 10, bottom, P.pine[2]);
    p.tri(cx, top + 1, cx + 5, bottom, cx + half, bottom, P.pineDark);
    p.hline(cx - half + 2, bottom - 1, half * 2 - 4, P.pineDark);
  }
  for (let i = 0; i < 8; i++) {
    p.px(cx - 14 + Math.floor(rnd() * 28), 8 + Math.floor(rnd() * 34), P.leafHigh);
  }
  return outlineCanvas(cv(c), P.outline);
}

function bush(seed: number, berries = false): HTMLCanvasElement {
  const { c, p } = pen(30, 24);
  const rnd = mulberry32(seed);
  p.disc(15, 14, 12, P.leafDark);
  p.disc(8, 16, 8, P.leafDark);
  p.disc(22, 16, 8, P.leafDark);
  p.disc(15, 12, 10, P.leaf[1]);
  p.disc(9, 14, 6, P.leaf[1]);
  p.disc(21, 14, 6, P.leaf[1]);
  p.disc(11, 9, 7, P.leaf[2]);
  p.disc(19, 10, 6, P.leaf[3]);
  p.disc(15, 7, 4, P.leafHigh);
  for (let i = 0; i < 6; i++) {
    p.disc(5 + rnd() * 20, 16 + rnd() * 4, 2, rnd() < 0.5 ? P.leafShade : P.leaf[1]);
  }
  if (berries) {
    for (let i = 0; i < 3; i++) {
      p.disc(7 + rnd() * 16, 10 + rnd() * 7, 1, P.pinkDark);
      p.px(7 + Math.floor(rnd() * 16), 10 + Math.floor(rnd() * 7), P.pink);
    }
  }
  return outlineCanvas(cv(c), P.outline);
}

function rock(): HTMLCanvasElement {
  const { c, p } = pen(22, 16);
  p.ellipse(11, 11, 10, 5, P.stoneDark);
  p.ellipse(11, 9, 8, 6, P.stone);
  p.ellipse(9, 7, 5, 3, P.stoneLight);
  p.px(15, 11, P.stoneDark); p.px(16, 10, P.stoneDark);
  return outlineCanvas(cv(c), P.outline);
}

function stump(): HTMLCanvasElement {
  const { c, p } = pen(22, 16);
  p.rect(4, 6, 14, 9, P.trunk);
  p.rect(4, 6, 3, 9, P.trunkLight);
  p.rect(15, 6, 3, 9, P.trunkDark);
  p.ellipse(11, 6, 7, 3, P.woodLight);
  p.ellipse(11, 6, 4, 2, P.woodHigh);
  p.px(11, 6, P.wood);
  return outlineCanvas(cv(c), P.outline);
}

function flowers(color: string, dark: string): HTMLCanvasElement {
  const { c, p } = pen(14, 12);
  p.vline(4, 7, 4, P.grassDark);
  p.vline(9, 6, 5, P.grassDark);
  p.disc(4, 5, 2, color); p.px(4, 5, dark);
  p.disc(9, 4, 2, color); p.px(9, 4, dark);
  p.px(5, 9, P.grassLight); p.px(8, 9, P.grassLight);
  return outlineCanvas(cv(c), P.outline);
}


/* ------------------------------------------------------------------ *
 * street furniture
 * ------------------------------------------------------------------ */

function fence(): HTMLCanvasElement {
  const { c, p } = pen(16, 22);
  p.rect(0, 8, 16, 3, P.woodLight);
  p.hline(0, 8, 16, P.woodHigh);
  p.rect(0, 14, 16, 3, P.wood);
  p.hline(0, 14, 16, P.woodLight);
  p.rect(2, 3, 5, 18, P.wood);
  p.rect(2, 3, 2, 18, P.woodLight);
  p.rect(5, 3, 1, 18, P.woodDark);
  p.rect(2, 2, 5, 2, P.woodHigh);
  return outlineCanvas(cv(c), P.outline);
}

function lamp(): HTMLCanvasElement {
  const { c, p } = pen(14, 50);
  p.rect(5, 44, 5, 4, P.metalDark);
  p.rect(6, 14, 3, 31, P.metal);
  p.rect(6, 14, 1, 31, P.metalLight);
  p.rect(3, 40, 9, 2, P.metalDark);
  p.rect(4, 8, 7, 8, P.goldDark);
  p.rect(5, 9, 5, 6, P.goldLight);
  p.rect(5, 10, 2, 4, P.gold);
  p.rect(3, 6, 9, 2, P.metalDark);
  p.hline(4, 5, 7, P.metal);
  p.px(7, 4, P.metalDark);
  return outlineCanvas(cv(c), P.outline);
}

function bench(): HTMLCanvasElement {
  const { c, p } = pen(36, 20);
  p.rect(2, 3, 32, 4, P.woodLight);
  p.hline(2, 3, 32, P.woodHigh);
  p.hline(2, 6, 32, P.woodDark);
  p.rect(1, 10, 34, 4, P.wood);
  p.hline(1, 10, 34, P.woodHigh);
  p.hline(1, 13, 34, P.woodDark);
  p.rect(5, 14, 3, 6, P.metalDark);
  p.rect(28, 14, 3, 6, P.metalDark);
  p.rect(4, 2, 2, 12, P.metalDark);
  p.rect(30, 2, 2, 12, P.metalDark);
  return outlineCanvas(cv(c), P.outline);
}

function planter(): HTMLCanvasElement {
  const { c, p } = pen(30, 24);
  p.rect(2, 13, 26, 10, P.wood);
  p.rect(2, 13, 26, 2, P.woodHigh);
  p.rect(3, 20, 24, 2, P.woodDark);
  p.rect(4, 11, 22, 3, P.woodDark);
  p.disc(8, 9, 5, P.leaf[1]);
  p.disc(15, 7, 6, P.leaf[2]);
  p.disc(22, 9, 5, P.leaf[1]);
  p.disc(11, 5, 4, P.leaf[3]);
  p.disc(19, 6, 4, P.leafHigh);
  p.px(6, 6, P.pink); p.px(14, 3, P.yellow); p.px(24, 7, P.blossom);
  p.px(17, 10, P.pink); p.px(9, 11, P.yellow);
  return outlineCanvas(cv(c), P.outline);
}

function signpost(): HTMLCanvasElement {
  const { c, p } = pen(28, 30);
  p.rect(12, 8, 4, 21, P.wood);
  p.rect(12, 8, 1, 21, P.woodLight);
  p.rect(10, 27, 8, 2, P.woodDark);
  p.rect(2, 6, 18, 7, P.woodLight);
  p.tri(20, 6, 26, 9, 20, 13, P.woodLight);
  p.hline(4, 8, 13, P.cream);
  p.hline(4, 10, 9, P.creamShade);
  p.rect(6, 15, 18, 6, P.woodLight);
  p.tri(6, 15, 1, 18, 6, 21, P.woodLight);
  p.hline(8, 17, 13, P.cream);
  return outlineCanvas(cv(c), P.outline);
}

function crate(): HTMLCanvasElement {
  const { c, p } = pen(18, 16);
  p.rect(1, 3, 16, 12, P.wood);
  p.rect(1, 3, 16, 2, P.woodLight);
  p.rect(1, 13, 16, 2, P.woodDark);
  p.vline(4, 5, 8, P.woodLight);
  p.vline(13, 5, 8, P.woodLight);
  p.line(4, 5, 13, 12, P.woodDark);
  p.line(13, 5, 4, 12, P.woodDark);
  return outlineCanvas(cv(c), P.outline);
}

function barrel(): HTMLCanvasElement {
  const { c, p } = pen(16, 20);
  p.rect(3, 2, 10, 16, P.wood);
  p.rect(3, 2, 3, 16, P.woodLight);
  p.rect(11, 2, 2, 16, P.woodDark);
  p.hline(2, 5, 12, P.metal);
  p.hline(2, 14, 12, P.metal);
  p.rect(3, 1, 10, 2, P.woodHigh);
  return outlineCanvas(cv(c), P.outline);
}

/** The travelling merchant's cart — the centrepiece of the meadow. */
function cart(): HTMLCanvasElement {
  const { c, p } = pen(72, 60);
  const cx = 36;

  // bed
  p.rect(6, 32, 58, 4, P.woodDark);
  p.rect(6, 26, 58, 8, P.wood);
  p.rect(6, 26, 58, 2, P.woodHigh);
  p.rect(6, 36, 58, 4, P.woodDark);
  p.rect(6, 40, 58, 3, P.roofRedDark);
  // canopy posts (drawn first, the cloth caps them)
  p.rect(10, 12, 3, 18, P.woodDark);
  p.rect(57, 12, 3, 18, P.woodDark);

  // plum cloth: hand-authored vault profile, crown catching the light
  const vault: [number, string][] = [
    [11, P.canopyLight], [15, P.canopyLight], [18, P.canopyLight], [21, P.canopy],
    [23, P.canopy], [25, P.canopy], [26, P.canopy], [27, P.canopy], [28, P.canopy],
    [29, P.canopy], [30, P.canopy], [30, P.canopy], [30, P.canopyDark]
  ];
  vault.forEach(([half, color], i) => {
    p.rect(cx - half, i, half * 2, 1, color);
  });
  // seam folds, so the cloth reads as panels rather than a solid dome
  for (let i = 0; i < vault.length; i++) {
    const half = vault[i][0];
    for (const seam of [-24, -12, 0, 12, 24]) {
      if (Math.abs(seam) <= half - 2) p.px(cx + seam, i, P.canopyDark);
    }
  }
  // underside rim, then a cream scalloped valance
  p.rect(cx - 30, 13, 60, 3, P.canopyDark);
  p.hline(cx - 30, 13, 60, P.canopy);
  for (let i = 0; i < 10; i++) {
    p.rect(cx - 30 + i * 6, 16, 6, 2, P.cream);
    p.rect(cx - 29 + i * 6, 18, 4, 1, P.creamShade);
  }
  // goods on the bed
  p.rect(13, 21, 11, 6, P.woodLight);
  p.rect(13, 21, 11, 1, P.woodHigh);
  p.vline(18, 22, 4, P.woodDark);
  p.rect(45, 20, 12, 7, P.wood);
  p.rect(45, 22, 12, 2, P.metal);
  p.rect(46, 20, 10, 1, P.woodHigh);
  p.disc(34, 25, 3, P.yellow);
  p.disc(39, 25, 3, P.pink);
  p.disc(36, 22, 3, P.leaf[2]);
  // wheels
  for (const wx of [18, 55]) {
    p.disc(wx, 46, 10, P.woodDark);
    p.disc(wx, 46, 8, P.wood);
    p.disc(wx, 46, 6, P.woodDark);
    p.disc(wx, 46, 4, P.woodLight);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      p.line(wx, 46, wx + Math.cos(ang) * 8, 46 + Math.sin(ang) * 8, P.wood);
    }
    p.disc(wx, 46, 2, P.woodHigh);
  }
  // draught pole
  p.rect(0, 34, 7, 3, P.wood);
  p.rect(0, 34, 7, 1, P.woodLight);
  return outlineCanvas(cv(c), P.outline);
}

/* ------------------------------------------------------------------ *
 * buildings
 * ------------------------------------------------------------------ */

function cottage(): HTMLCanvasElement {
  const { c, p } = pen(132, 104);
  // roof
  p.tri(66, 4, 2, 48, 130, 48, P.roofRedDark);
  p.tri(66, 8, 8, 46, 124, 46, P.roofRed);
  for (let y = 16; y < 46; y += 6) p.hline(10 + (y >> 2), y, 112 - (y >> 1), P.roofRedDark);
  p.hline(24, 32, 84, P.roofRedLight);
  p.hline(40, 22, 52, P.roofRedLight);
  // chimney
  p.rect(96, 12, 14, 26, P.stone);
  p.rect(96, 12, 14, 3, P.stoneLight);
  p.rect(94, 10, 18, 4, P.stoneDark);
  p.hline(99, 20, 8, P.stoneDark);
  p.hline(99, 26, 8, P.stoneDark);
  // wall
  p.rect(8, 48, 116, 52, P.cream);
  p.rect(8, 48, 116, 3, P.creamShade);
  p.rect(8, 96, 116, 4, P.creamDark);
  p.vline(8, 48, 52, P.creamDark);
  p.vline(123, 48, 52, P.creamDark);
  // windows
  windowBox(p, 22, 62, 24, 20);
  windowBox(p, 92, 62, 24, 20);
  // door + stoop
  p.rect(54, 66, 28, 34, P.woodDark);
  p.rect(57, 69, 22, 31, P.wood);
  p.rect(57, 69, 22, 2, P.woodLight);
  p.vline(63, 74, 24, P.woodShade);
  p.vline(72, 74, 24, P.woodShade);
  p.disc(75, 86, 1, P.gold);
  p.rect(48, 98, 40, 5, P.stone);
  p.hline(48, 98, 40, P.stoneLight);
  // striped porch awning
  awning(p, 50, 56, 36, 8, P.roofTeal, P.cream);
  p.hline(48, 55, 40, P.woodDark);
  // window boxes
  p.rect(20, 84, 28, 5, P.wood);
  p.rect(90, 84, 28, 5, P.wood);
  for (let i = 0; i < 5; i++) {
    p.disc(22 + i * 6, 82, 2, i % 2 ? P.leaf[2] : P.leaf[1]);
    p.px(22 + i * 6, 80, i % 2 ? P.pink : P.yellow);
  }
  return outlineCanvas(cv(c), P.outline);
}

function cafe(): HTMLCanvasElement {
  const { c, p } = pen(132, 104);
  p.tri(66, 8, 6, 46, 126, 46, P.roofRedDark);
  p.tri(66, 12, 12, 44, 120, 44, P.roofRed);
  for (let y = 18; y < 44; y += 5) p.hline(14 + (y >> 2), y, 104 - (y >> 1), P.roofRedDark);
  p.hline(26, 30, 80, P.roofRedLight);
  // wall
  p.rect(8, 46, 116, 54, P.plaster);
  p.rect(8, 46, 116, 3, P.creamShade);
  p.rect(8, 96, 116, 4, P.creamDark);
  // big shopfront window
  p.rect(14, 56, 54, 36, P.woodDark);
  p.rect(17, 59, 48, 30, P.glass);
  p.rect(17, 59, 48, 9, P.glassLight);
  p.vline(41, 59, 30, P.cream);
  p.hline(17, 73, 48, P.cream);
  p.rect(20, 62, 12, 5, P.glassLight);
  p.rect(48, 62, 10, 4, P.glassLight);
  // door
  p.rect(80, 62, 30, 38, P.woodDark);
  p.rect(83, 65, 24, 35, P.wood);
  p.rect(86, 68, 18, 18, P.glass);
  p.rect(86, 68, 18, 4, P.glassLight);
  p.disc(102, 92, 1, P.gold);
  p.rect(78, 98, 34, 4, P.stone);
  // striped cafe awning
  awning(p, 10, 48, 114, 9, P.roofRed, P.cream);
  p.hline(8, 47, 118, P.woodDark);
  // gold shop plaque
  p.rect(84, 50, 24, 7, P.goldDark);
  p.rect(86, 51, 20, 5, P.gold);
  p.hline(89, 53, 14, P.cream);
  // chimney
  p.rect(24, 10, 12, 22, P.stone);
  p.rect(22, 8, 16, 4, P.stoneDark);
  // window boxes
  p.rect(14, 92, 54, 4, P.wood);
  for (let i = 0; i < 9; i++) p.px(17 + i * 6, 90, i % 2 ? P.pink : P.yellow);
  return outlineCanvas(cv(c), P.outline);
}

function station(): HTMLCanvasElement {
  const { c, p } = pen(156, 98);
  // glass canopy roof
  p.rect(6, 8, 144, 22, P.roofTealDark);
  p.rect(8, 10, 140, 18, P.glass);
  for (let x = 12; x < 148; x += 10) p.vline(x, 10, 18, P.roofTeal);
  p.hline(8, 18, 140, P.roofTealLight);
  p.rect(4, 6, 148, 5, P.roofTealDark);
  p.hline(6, 6, 144, P.roofTealLight);
  // wall + platform
  p.rect(12, 30, 132, 62, P.cream);
  p.rect(12, 30, 132, 4, P.creamShade);
  p.rect(12, 88, 132, 6, P.creamDark);
  // sign band
  p.rect(30, 34, 96, 12, P.roofTealDark);
  p.rect(32, 36, 92, 8, P.roofTeal);
  p.hline(40, 39, 24, P.cream);
  p.hline(70, 39, 30, P.cream);
  p.hline(106, 39, 14, P.goldLight);
  // clock face
  p.disc(140, 40, 9, P.cream);
  p.ring(140, 40, 9, P.goldDark);
  p.line(140, 40, 140, 34, P.ink);
  p.line(140, 40, 145, 42, P.ink);
  // ticket windows
  p.rect(22, 54, 26, 20, P.glassDark);
  p.rect(24, 56, 22, 16, P.glass);
  p.rect(24, 56, 22, 4, P.glassLight);
  p.rect(56, 54, 26, 20, P.glassDark);
  p.rect(58, 56, 22, 16, P.glass);
  p.rect(58, 56, 22, 4, P.glassLight);
  // entrance
  p.rect(96, 50, 40, 44, P.roofTealDark);
  p.rect(99, 53, 34, 41, P.glass);
  p.rect(99, 53, 34, 7, P.glassLight);
  p.vline(116, 53, 41, P.roofTealDark);
  p.rect(99, 60, 17, 34, P.glassDark);
  p.rect(116, 60, 17, 34, P.glassDark);
  p.hline(100, 62, 15, P.glassLight);
  p.hline(117, 62, 15, P.glassLight);
  // platform edge
  p.rect(6, 92, 144, 6, P.cobble);
  p.hline(6, 92, 144, P.cobbleLight);
  for (let x = 10; x < 148; x += 12) p.rect(x, 94, 6, 2, P.cobbleDark);
  return outlineCanvas(cv(c), P.outline);
}

function tower(): HTMLCanvasElement {
  const { c, p } = pen(180, 156);
  // shaft
  p.rect(10, 6, 160, 140, P.roofSlateDark);
  p.rect(10, 6, 160, 6, P.goldDark);
  p.hline(10, 6, 160, P.goldLight);
  p.rect(10, 140, 160, 6, P.roofSlateDark);
  // glass bays
  for (let x = 14; x < 164; x += 14) {
    p.rect(x, 16, 10, 104, P.glassDark);
    p.rect(x, 16, 10, 3, P.glass);
    for (let y = 22; y < 114; y += 12) {
      const lit = ((x * 7 + y) % 5) === 0;
      p.rect(x, y, 10, 7, lit ? P.goldLight : P.glass);
      p.rect(x, y + 7, 10, 1, P.glassDark);
      p.vline(x + 4, y, 7, lit ? P.gold : P.glassLight);
    }
  }
  // corner piers
  p.rect(8, 6, 6, 140, P.roofSlateDark);
  p.rect(166, 6, 6, 140, P.roofSlateDark);
  p.vline(8, 6, 140, P.roofSlate);
  p.vline(171, 6, 140, P.roofSlate);
  // crown + antenna
  p.rect(14, 2, 152, 6, P.gold);
  p.hline(14, 2, 152, P.goldLight);
  p.rect(88, 0, 4, 3, P.goldLight);
  // entrance canopy
  p.rect(48, 96, 84, 10, P.goldDark);
  p.rect(50, 98, 80, 6, P.gold);
  p.hline(50, 98, 80, P.goldLight);
  for (let x = 54; x < 128; x += 12) p.px(x, 101, P.cream);
  // doors
  p.rect(56, 108, 68, 44, P.goldDark);
  p.rect(60, 112, 60, 40, P.roofSlateDark);
  p.rect(63, 115, 26, 37, P.glassNight);
  p.rect(96, 115, 22, 37, P.glassNight);
  p.vline(90, 112, 40, P.gold);
  p.vline(93, 115, 37, P.gold);
  p.rect(63, 115, 26, 3, P.glass);
  p.rect(96, 115, 22, 3, P.glass);
  p.rect(62, 152, 64, 4, P.cobble);
  p.hline(62, 152, 64, P.cobbleLight);
  return outlineCanvas(cv(c), P.outline);
}

/* ------------------------------------------------------------------ *
 * registry
 * ------------------------------------------------------------------ */

function cv(c: CanvasPair): HTMLCanvasElement {
  return c.cv;
}

export const PROP_ART: Record<PropKind, () => HTMLCanvasElement> = {
  oak: () => oak(11),
  oakSmall: () => oak(29, true),
  pine: () => pine(41),
  bush: () => bush(53),
  bushBerry: () => bush(61, true),
  rock,
  stump,
  fence,
  lamp,
  bench,
  planter,
  signpost,
  crate,
  barrel,
  flowersPink: () => flowers(P.pink, P.pinkDark),
  flowersYellow: () => flowers(P.yellow, P.yellowDark),
  flowersWhite: () => flowers(P.blossom, P.creamShade),
  cart,
  cottage,
  cafe,
  station,
  tower
};

export function propTextureKey(kind: PropKind): string {
  return `px_${kind}`;
}

/** A hard-edged ellipse used as a ground shadow under props and the player. */
export function shadowCanvas(): HTMLCanvasElement {
  const { c, p } = pen(64, 20);
  p.ellipse(32, 10, 30, 8, "rgba(24,34,18,0.30)");
  p.ellipse(32, 10, 24, 6, "rgba(24,34,18,0.22)");
  return c.cv;
}
