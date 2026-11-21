/**
 * Maple Meadow — the village the day starts in.
 *
 * The layout is painted into a tile grid by code (lawns, street, paths, pond)
 * and then dressed with prop records. A prop's `y` is its base line: it is
 * both where the sprite stands and the depth it sorts at, so walking behind
 * a tree or under the cafe awning occludes correctly.
 *
 * The map is deliberately authored south-first: you spawn in the flowered
 * meadow by the merchant cart, the dirt path winds north between the fences,
 * and the cobbled high street with the cafe, the station and ABC Tower is
 * the destination.
 */
import type Phaser from "phaser";
import { groundCanvas, TILE } from "./tiles";
import { bakeTexture } from "./pixel";
import { PROP_ART, propTextureKey, shadowCanvas, type PropKind } from "./props";

export const SCALE = 3;
export const COLS = 44;
export const ROWS = 34;
export const WORLD_W = COLS * TILE * SCALE;
export const WORLD_H = ROWS * TILE * SCALE;

export type ZoneId = "home" | "cafe" | "station" | "office";

export interface ZoneDef {
  id: ZoneId;
  /** base-line position in tile units */
  x: number;
  y: number;
  /** reach in screen pixels — generous, doors must never be unreachable */
  r: number;
  label: string;
  short: string;
}

export interface PropDef {
  kind: PropKind;
  x: number;
  y: number;
  flip?: boolean;
  /** solid footprint relative to the base line, in tiles: [x0, y0, x1, y1] */
  solid?: [number, number, number, number];
}

export const ZONES: ZoneDef[] = [
  { id: "home", x: 7.5, y: 32.6, r: 110, label: "🏠 Go home — clock out", short: "HOME" },
  { id: "cafe", x: 7.5, y: 9.7, r: 96, label: "☕ Coffee shop", short: "CAFE" },
  { id: "station", x: 19.5, y: 9.7, r: 104, label: "🚉 LRT station", short: "LRT" },
  { id: "office", x: 34.5, y: 11.1, r: 128, label: "🏢 ABC TOWER — clock in", short: "ABC" }
];

/** Walk targets, in tile units. */
export const SPAWN_MEADOW = { x: 21.5, y: 26.4 };
export const SPAWN_OFFICE = { x: 34.5, y: 12.2 };

/** Building footprints, used by the minimap and the collision grid. */
export const BUILDINGS: { x0: number; y0: number; x1: number; y1: number; roof: string }[] = [
  { x0: 3.4, y0: 25.4, x1: 11.6, y1: 31.8, roof: "#8a3129" },
  { x0: 3.5, y0: 2.2, x1: 11.5, y1: 8.7, roof: "#8a3129" },
  { x0: 14.6, y0: 3.0, x1: 24.4, y1: 8.7, roof: "#39635e" },
  { x0: 28.9, y0: 0.2, x1: 40.1, y1: 9.9, roof: "#414850" }
];

const TREE: [number, number, number, number] = [-0.55, -0.55, 0.55, 0.05];
const SHRUB: [number, number, number, number] = [-0.5, -0.5, 0.5, 0.1];
const FENCE: [number, number, number, number] = [-0.55, -0.6, 0.55, 0.6];

function fenceRow(x0: number, x1: number, y: number, gap: number[] = []): PropDef[] {
  const out: PropDef[] = [];
  for (let x = x0; x <= x1; x++) {
    if (gap.includes(x)) continue;
    out.push({ kind: "fence", x: x + 0.5, y, solid: FENCE });
  }
  return out;
}

/** Everything that stands on the ground, in one readable list. */
export const PROPS: PropDef[] = [
  // ---- buildings ----
  { kind: "cottage", x: 7.5, y: 31.8, solid: [-4.1, -6.4, 4.1, 0] },
  { kind: "cafe", x: 7.5, y: 8.7, solid: [-4.1, -6.5, 4.1, 0] },
  { kind: "station", x: 19.5, y: 8.7, solid: [-4.9, -5.7, 4.9, 0] },
  { kind: "tower", x: 34.5, y: 9.9, solid: [-5.6, -9.8, 5.6, 0] },

  // ---- fence along the top of the meadow, with a gate over each path ----
  ...fenceRow(0, 43, 18.2, [6, 7, 20, 21]),
  ...fenceRow(11, 17, 27.3, [13, 14]),

  // ---- meadow trees ----
  { kind: "oak", x: 2.4, y: 18.4, solid: TREE },
  { kind: "oakSmall", x: 4.6, y: 22.6, solid: TREE },
  { kind: "oak", x: 11.4, y: 19.2, solid: TREE },
  { kind: "oakSmall", x: 14.8, y: 17.9, solid: TREE },
  { kind: "oak", x: 18.6, y: 21.4, solid: TREE },
  { kind: "oak", x: 2.6, y: 28.6, solid: TREE },
  { kind: "oakSmall", x: 4.2, y: 24.4, solid: TREE },
  { kind: "oak", x: 12.4, y: 33.2, solid: TREE },
  { kind: "oak", x: 15.6, y: 25.4, solid: TREE },
  { kind: "oakSmall", x: 19.2, y: 29.2, solid: TREE },
  { kind: "oak", x: 30.4, y: 33.2, solid: TREE },
  { kind: "oak", x: 33.4, y: 22.4, solid: TREE },
  { kind: "oakSmall", x: 41.6, y: 22.2, solid: TREE },
  { kind: "oak", x: 42.2, y: 30.4, solid: TREE },
  { kind: "oakSmall", x: 36.4, y: 19.4, solid: TREE },
  { kind: "oak", x: 24.6, y: 33.2, solid: TREE },

  // ---- pine belt on the north and west edges ----
  // the northern pines sit a little south of the bound: their crowns are
  // taller than the top row, and a canopy clipped by the camera edge reads
  // as a stray rectangle floating over the skyline
  { kind: "pine", x: 1.6, y: 5.6, solid: TREE },
  { kind: "pine", x: 12.6, y: 5.4, solid: TREE },
  { kind: "pine", x: 26.2, y: 5.2, solid: TREE },
  { kind: "pine", x: 42.2, y: 5.6, solid: TREE },
  { kind: "pine", x: 0.9, y: 10.6, solid: TREE },
  { kind: "pine", x: 43.1, y: 12.4, solid: TREE },
  { kind: "pine", x: 0.8, y: 21.4, solid: TREE },
  { kind: "pine", x: 43.2, y: 26.4, solid: TREE },
  { kind: "pine", x: 0.9, y: 33.2, solid: TREE },
  { kind: "pine", x: 9.4, y: 33.2, solid: TREE },

  // ---- shrubs and rocks ----
  { kind: "bush", x: 5.6, y: 19.8, solid: SHRUB },
  { kind: "bushBerry", x: 16.2, y: 23.4, solid: SHRUB },
  { kind: "bush", x: 9.6, y: 22.6, solid: SHRUB },
  { kind: "bush", x: 22.6, y: 30.6, solid: SHRUB },
  { kind: "bushBerry", x: 27.4, y: 33.0, solid: SHRUB },
  { kind: "bush", x: 31.4, y: 19.2, solid: SHRUB },
  { kind: "bush", x: 37.6, y: 24.6, solid: SHRUB },
  { kind: "bush", x: 41.0, y: 33.0, solid: SHRUB },
  { kind: "bushBerry", x: 13.0, y: 16.2, solid: SHRUB },
  { kind: "rock", x: 27.2, y: 25.6, solid: [-0.5, -0.4, 0.5, 0.1] },
  { kind: "rock", x: 39.8, y: 32.2, solid: [-0.5, -0.4, 0.5, 0.1] },
  { kind: "rock", x: 25.4, y: 31.8, solid: [-0.5, -0.4, 0.5, 0.1] },
  { kind: "stump", x: 8.2, y: 20.4, solid: SHRUB },
  { kind: "stump", x: 34.6, y: 31.6, solid: SHRUB },

  // ---- street furniture ----
  { kind: "lamp", x: 4.4, y: 16.3 },
  { kind: "lamp", x: 13.2, y: 16.3 },
  { kind: "lamp", x: 24.4, y: 16.3 },
  { kind: "lamp", x: 33.4, y: 16.3 },
  { kind: "lamp", x: 41.4, y: 16.3 },
  { kind: "lamp", x: 29.6, y: 11.9 },
  { kind: "lamp", x: 39.6, y: 11.9 },
  { kind: "bench", x: 31.4, y: 12.6, solid: [-0.6, -0.5, 0.6, 0.1] },
  { kind: "bench", x: 38.2, y: 12.6, solid: [-0.6, -0.5, 0.6, 0.1] },
  { kind: "bench", x: 28.6, y: 24.2, solid: [-0.6, -0.5, 0.6, 0.1] },
  { kind: "planter", x: 3.6, y: 8.8, solid: [-0.6, -0.5, 0.6, 0.05] },
  { kind: "planter", x: 11.4, y: 8.8, solid: [-0.6, -0.5, 0.6, 0.05] },
  { kind: "planter", x: 15.4, y: 8.8, solid: [-0.6, -0.5, 0.6, 0.05] },
  { kind: "planter", x: 23.6, y: 8.8, solid: [-0.6, -0.5, 0.6, 0.05] },
  { kind: "signpost", x: 22.4, y: 17.4, solid: [-0.5, -0.4, 0.5, 0.1] },

  // ---- the merchant cart and its clutter ----
  { kind: "cart", x: 24.2, y: 23.6, solid: [-2.3, -2.2, 2.3, 0] },
  { kind: "crate", x: 26.9, y: 24.4, solid: SHRUB },
  { kind: "crate", x: 27.6, y: 25.4, solid: SHRUB },
  { kind: "barrel", x: 19.7, y: 23.5, solid: SHRUB },
  { kind: "barrel", x: 27.0, y: 26.3, solid: SHRUB },

  // ---- wildflowers in the meadow ----
  { kind: "flowersPink", x: 18.4, y: 25.6 },
  { kind: "flowersWhite", x: 19.6, y: 24.2 },
  { kind: "flowersYellow", x: 22.8, y: 27.4 },
  { kind: "flowersPink", x: 21.4, y: 29.6 },
  { kind: "flowersWhite", x: 23.6, y: 31.4 },
  { kind: "flowersYellow", x: 16.8, y: 31.6 },
  { kind: "flowersPink", x: 13.8, y: 24.6 },
  { kind: "flowersWhite", x: 6.4, y: 26.4 },
  { kind: "flowersYellow", x: 9.4, y: 24.8 },
  { kind: "flowersPink", x: 29.8, y: 20.4 },
  { kind: "flowersWhite", x: 32.6, y: 28.4 },
  { kind: "flowersYellow", x: 35.6, y: 27.6 },
  { kind: "flowersPink", x: 39.4, y: 20.6 },
  { kind: "flowersWhite", x: 15.6, y: 20.4 },
  { kind: "flowersYellow", x: 4.8, y: 31.4 }
];

/* ------------------------------------------------------------------ *
 * ground
 * ------------------------------------------------------------------ */

export function buildField(): string[][] {
  const field: string[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ".")
  );

  const rect = (x0: number, y0: number, w: number, h: number, ch: string) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        field[y][x] = ch;
      }
    }
  };

  // worn patches of darker lawn, so the meadow is not one flat green
  for (const [px, py, pw, ph] of [
    [3, 20, 4, 3], [16, 18, 3, 3], [9, 26, 3, 2], [27, 28, 4, 3],
    [37, 18, 3, 2], [14, 30, 2, 3], [6, 30, 2, 2]
  ]) rect(px, py, pw, ph, ",");

  // the high street, then each shopfront's forecourt
  rect(0, 13, COLS, 3, "c");
  rect(3, 9, 9, 4, "c");
  rect(14, 9, 11, 4, "c");
  rect(27, 9, 17, 4, "c");

  // dirt: home path north, meadow cross path, cart spur
  rect(7, 16, 1, 17, "p");
  rect(7, 16, 14, 1, "p");
  rect(21, 16, 1, 10, "p");
  rect(6, 31, 3, 2, "p");
  rect(12, 28, 5, 3, "g");   // vegetable plot, planted row by row

  // pond: sand ring, then water inset
  rect(26, 25, 15, 8, "s");
  rect(27, 26, 13, 6, "w");

  return field;
}

export interface World {
  field: string[][];
  blocked: boolean[][];
  groundKey: string;
  shadowKey: string;
}

export function buildWorld(scene: Phaser.Scene): World {
  const field = buildField();
  let groundKey = "px_ground";
  if (!scene.textures.exists(groundKey)) {
    groundKey = bakeTexture(scene, groundKey, groundCanvas(field));
  }
  for (const kind of Object.keys(PROP_ART) as PropKind[]) {
    const key = propTextureKey(kind);
    if (!scene.textures.exists(key)) bakeTexture(scene, key, PROP_ART[kind]());
  }
  let shadowKey = "px_shadow";
  if (!scene.textures.exists(shadowKey)) {
    shadowKey = bakeTexture(scene, shadowKey, shadowCanvas());
  }

  const blocked: boolean[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => false)
  );
  // water is not walkable; the sand ring is
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (field[y][x] === "w") blocked[y][x] = true;
  }
  for (const prop of PROPS) {
    if (!prop.solid) continue;
    const [dx0, dy0, dx1, dy1] = prop.solid;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const cx = tx + 0.5, cy = ty + 0.5;
        if (cx >= prop.x + dx0 && cx <= prop.x + dx1 &&
            cy >= prop.y + dy0 && cy <= prop.y + dy1) blocked[ty][tx] = true;
      }
    }
  }
  return { field, blocked, groundKey, shadowKey };
}

/** Tile lookup from a screen-pixel position. */
export function blockedAt(world: World, px: number, py: number): boolean {
  const tx = Math.floor(px / (TILE * SCALE));
  const ty = Math.floor(py / (TILE * SCALE));
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return world.blocked[ty][tx];
}

/* ------------------------------------------------------------------ *
 * minimap
 * ------------------------------------------------------------------ */

const MINI_COLORS: Record<string, string> = {
  ".": "#6fae4a",
  ",": "#5e9c40",
  p: "#c3a071",
  c: "#b5ab98",
  w: "#4787a7",
  s: "#d8bf8f"
};

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  world: World,
  player: { x: number; y: number },
  view: { x: number; y: number; w: number; h: number }
) {
  const pad = 4;
  const aw = w - pad * 2, ah = h - pad * 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#3f3322";
  ctx.fillRect(0, 0, w, h);

  const sx = aw / COLS, sy = ah / ROWS;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = MINI_COLORS[world.field[y][x]] ?? "#6fae4a";
      ctx.fillRect(pad + x * sx, pad + y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  for (const b of BUILDINGS) {
    ctx.fillStyle = b.roof;
    ctx.fillRect(pad + b.x0 * sx, pad + b.y0 * sy,
      Math.max(2, (b.x1 - b.x0) * sx), Math.max(2, (b.y1 - b.y0) * sy));
  }
  for (const z of ZONES) {
    ctx.fillStyle = "#f6dc9b";
    ctx.fillRect(pad + z.x * sx - 1.5, pad + z.y * sy - 1.5, 3, 3);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + (view.x / WORLD_W) * aw, pad + (view.y / WORLD_H) * ah,
    (view.w / WORLD_W) * aw, (view.h / WORLD_H) * ah);

  ctx.fillStyle = "#fff8e2";
  const px = pad + (player.x / WORLD_W) * aw;
  const py = pad + (player.y / WORLD_H) * ah;
  ctx.fillRect(px - 2, py - 2, 4, 4);
  ctx.fillStyle = "#241c14";
  ctx.fillRect(px - 1, py - 1, 2, 2);
}
