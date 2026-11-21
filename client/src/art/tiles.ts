/**
 * Ground tiles for the village.
 *
 * A tile is 16 native pixels and is drawn straight into one big canvas, so
 * the whole walkable ground is a single texture instead of thousands of
 * sprites. Tiles are authored by character:
 *
 *   .  grass        ,  dark grass      p  dirt path
 *   c  cobble       w  water           s  sand shore
 *   g  planted vegetable rows
 */
import { makeCanvas, mulberry32, tileSeed, Pen } from "./pixel";
import { P } from "./palette";

export const TILE = 16;

const GRASS = new Set([".", ","]);

function grassTile(p: Pen, ox: number, oy: number, x: number, y: number, dark: boolean) {
  const rnd = mulberry32(tileSeed(x, y, dark ? 7 : 3));
  p.rect(ox, oy, TILE, TILE, dark ? P.grassPatch : P.grass[Math.floor(rnd() * P.grass.length)]);

  // blade tufts: short vertical strokes, never touching the tile seam
  const tufts = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < tufts; i++) {
    const tx = ox + 2 + Math.floor(rnd() * 12);
    const ty = oy + 3 + Math.floor(rnd() * 10);
    const h = 1 + Math.floor(rnd() * 2);
    p.vline(tx, ty, h, rnd() < 0.5 ? P.tuft : P.grassDark);
    p.px(tx + 1, ty + h, P.tuftLight);
  }

  // speckle so large lawns never look like flat fill
  for (let i = 0; i < 4; i++) {
    p.px(ox + Math.floor(rnd() * TILE), oy + Math.floor(rnd() * TILE),
      rnd() < 0.55 ? P.grassShade : P.grassLight);
  }
}

function pathTile(p: Pen, ox: number, oy: number, x: number, y: number) {
  const rnd = mulberry32(tileSeed(x, y, 11));
  p.rect(ox, oy, TILE, TILE, P.path);
  for (let i = 0; i < 10; i++) {
    p.px(ox + Math.floor(rnd() * TILE), oy + Math.floor(rnd() * TILE),
      rnd() < 0.5 ? P.pathShade : P.pathLight);
  }
  for (let i = 0; i < 3; i++) {
    const sx = ox + 2 + Math.floor(rnd() * 11);
    const sy = oy + 2 + Math.floor(rnd() * 11);
    p.rect(sx, sy, 2, 1, P.pathDark);
  }
}

function cobbleTile(p: Pen, ox: number, oy: number, x: number, y: number) {
  const rnd = mulberry32(tileSeed(x, y, 17));
  p.rect(ox, oy, TILE, TILE, P.mortar);
  // two staggered rows of setts
  const rows: [number, number, number, number][] = [
    [0, 0, 8, 7], [8, 0, 8, 7], [0, 8, 4, 7], [4, 8, 8, 7], [12, 8, 4, 7]
  ];
  for (const [sx, sy, sw, sh] of rows) {
    const shade = [P.cobble, P.cobbleLight, P.cobble][Math.floor(rnd() * 3)];
    p.rect(ox + sx + 1, oy + sy + 1, sw - 2, sh - 2, shade);
    p.hline(ox + sx + 1, oy + sy + 1, sw - 2, P.cobbleLight);
    p.hline(ox + sx + 1, oy + sy + sh - 2, sw - 2, P.cobbleDark);
  }
}

function waterTile(p: Pen, ox: number, oy: number, x: number, y: number) {
  const rnd = mulberry32(tileSeed(x, y, 23));
  p.rect(ox, oy, TILE, TILE, P.water);
  p.hline(ox, oy, TILE, P.waterDeep);
  p.rect(ox, oy + 6, TILE, 2, P.waterDeep);
  for (let i = 0; i < 3; i++) {
    const wx = ox + Math.floor(rnd() * 10);
    const wy = oy + 3 + Math.floor(rnd() * 10);
    p.hline(wx, wy, 3 + Math.floor(rnd() * 4), rnd() < 0.6 ? P.waterLight : P.waterDeep);
  }
  if (rnd() < 0.35) p.px(ox + Math.floor(rnd() * TILE), oy + Math.floor(rnd() * TILE), P.foam);
}

function sandTile(p: Pen, ox: number, oy: number, x: number, y: number) {
  const rnd = mulberry32(tileSeed(x, y, 29));
  p.rect(ox, oy, TILE, TILE, P.sand);
  for (let i = 0; i < 8; i++) {
    p.px(ox + Math.floor(rnd() * TILE), oy + Math.floor(rnd() * TILE),
      rnd() < 0.5 ? P.sandDark : P.sandLight);
  }
}

/**
 * A planted bed. The two plant lines sit at fixed heights inside the tile so
 * they line up into continuous rows across the plot, while the plants
 * themselves are jittered — a tended garden, not a printed pattern.
 */
function cropTile(p: Pen, ox: number, oy: number, x: number, y: number) {
  const rnd = mulberry32(tileSeed(x, y, 37));
  p.rect(ox, oy, TILE, TILE, P.soil);
  for (let i = 0; i < 16; i++) {
    p.px(ox + Math.floor(rnd() * TILE), oy + Math.floor(rnd() * TILE),
      rnd() < 0.55 ? P.soilDark : P.soilLight);
  }
  for (const ry of [3, 11]) {
    // the furrow under each row: shadow line, lit crest above it
    p.hline(ox, oy + ry + 3, TILE, P.soilDark);
    p.hline(ox, oy + ry + 2, TILE, P.soilLight);
    for (let k = 0; k < 2; k++) {
      const gx = ox + 2 + k * 8 + Math.floor(rnd() * 4);
      const gy = oy + ry + Math.floor(rnd() * 2);
      const big = rnd() < 0.5;
      p.disc(gx, gy, big ? 3 : 2, P.leaf[2]);
      p.disc(gx - 1, gy - 1, big ? 2 : 1, P.leaf[3]);
      p.px(gx + 1, gy - 1, P.leafHigh);
      p.px(gx, gy + 1, P.leaf[1]);
    }
  }
}

function drawTile(p: Pen, field: string[][], x: number, y: number) {
  const ox = x * TILE, oy = y * TILE;
  const ch = field[y][x];
  switch (ch) {
    case ",": grassTile(p, ox, oy, x, y, true); break;
    case "p": pathTile(p, ox, oy, x, y); break;
    case "c": cobbleTile(p, ox, oy, x, y); break;
    case "w": waterTile(p, ox, oy, x, y); break;
    case "s": sandTile(p, ox, oy, x, y); break;
    case "g": cropTile(p, ox, oy, x, y); break;
    default: grassTile(p, ox, oy, x, y, false);
  }
}

/** Darker rim where a hard tile (path, cobble, shore) meets lawn. */
function edgePass(p: Pen, field: string[][], cols: number, rows: number) {
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= cols || y >= rows ? "." : field[y][x];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = field[y][x];
      if (GRASS.has(ch)) continue;
      const ox = x * TILE, oy = y * TILE;
      const up = at(x, y - 1), down = at(x, y + 1);
      const left = at(x - 1, y), right = at(x + 1, y);

      if (ch === "w") {
        // foam only where water meets its sand ring
        if (up === "s") p.hline(ox, oy, TILE, P.foam);
        if (down === "s") p.hline(ox, oy + TILE - 1, TILE, P.foam);
        if (left === "s") p.vline(ox, oy, TILE, P.foam);
        if (right === "s") p.vline(ox + TILE - 1, oy, TILE, P.foam);
        continue;
      }

      const rim = ch === "c" ? P.cobbleDark : ch === "s" ? P.sandDark : ch === "g" ? P.soilDark : P.pathDark;
      if (GRASS.has(up)) p.hline(ox, oy, TILE, rim);
      if (GRASS.has(down)) p.hline(ox, oy + TILE - 1, TILE, rim);
      if (GRASS.has(left)) p.vline(ox, oy, TILE, rim);
      if (GRASS.has(right)) p.vline(ox + TILE - 1, oy, TILE, rim);
    }
  }
}

/** Paint the entire ground into one canvas at native (16 px tile) resolution. */
export function groundCanvas(field: string[][]): HTMLCanvasElement {
  const rows = field.length;
  const cols = field[0].length;
  const { cv, ctx } = makeCanvas(cols * TILE, rows * TILE);
  const p = new Pen(ctx, cv.width, cv.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) drawTile(p, field, x, y);
  }
  edgePass(p, field, cols, rows);
  return cv;
}
