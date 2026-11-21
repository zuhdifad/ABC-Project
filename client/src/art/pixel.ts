/**
 * Hard-edged drawing helpers for the pixel-art map.
 *
 * Everything here works on an integer pixel grid: rects, bresenham lines,
 * scanline discs/triangles and a one-pixel silhouette outline. No canvas
 * smoothing, no sub-pixel coordinates — a pixel is a square, always.
 */
import type Phaser from "phaser";

export interface CanvasPair {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function makeCanvas(w: number, h: number): CanvasPair {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx };
}

/** Deterministic tiny PRNG — the same seed always draws the same tree. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-tile seed, so grass at (3,7) looks the same on every load. */
export function tileSeed(x: number, y: number, salt = 1): number {
  return (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
}

export class Pen {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly w: number,
    readonly h: number
  ) {}

  px(x: number, y: number, color: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    const x0 = Math.round(x), y0 = Math.round(y);
    const x1 = Math.min(this.w, x0 + Math.round(w));
    const y1 = Math.min(this.h, y0 + Math.round(h));
    if (x1 <= x0 || y1 <= y0) return;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  hline(x: number, y: number, len: number, color: string): void {
    this.rect(x, y, len, 1, color);
  }

  vline(x: number, y: number, len: number, color: string): void {
    this.rect(x, y, 1, len, color);
  }

  /** Solid disc, rasterised a scanline at a time so the rim stays stepped. */
  disc(cx: number, cy: number, r: number, color: string): void {
    this.ellipse(cx, cy, r, r, color);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    this.ctx.fillStyle = color;
    const cx0 = Math.round(cx), cy0 = Math.round(cy);
    const rxi = Math.max(1, Math.round(rx)), ryi = Math.max(1, Math.round(ry));
    for (let dy = -ryi; dy <= ryi; dy++) {
      const k = 1 - (dy * dy) / (ryi * ryi);
      if (k <= 0) continue;
      const half = Math.floor(rxi * Math.sqrt(k));
      if (half < 0) continue;
      this.ctx.fillRect(cx0 - half, cy0 + dy, half * 2 + 1, 1);
    }
  }

  ring(cx: number, cy: number, r: number, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    this.ctx.fillStyle = color;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Scanline triangle fill (used for roofs, pines, canopy wedges). */
  tri(
    x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
    color: string
  ): void {
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edge = (ax: number, ay: number, bx: number, by: number) => {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      };
      edge(x0, y0, x1, y1);
      edge(x1, y1, x2, y2);
      edge(x2, y2, x0, y0);
      if (xs.length < 2) continue;
      const a = Math.ceil(Math.min(...xs));
      const b = Math.floor(Math.max(...xs));
      if (b >= a) this.rect(a, y, b - a + 1, 1, color);
    }
  }
}

/**
 * One-pixel dark rim around whatever has been drawn.
 *
 * Pixel art silhouettes read against busy grass because of this line; the
 * outline grows outwards instead of eating the art, so a 42 px wide sprite
 * stays 42 px of art and gains a border.
 */
export function outlineCanvas(cv: HTMLCanvasElement, color = "#2a2117"): HTMLCanvasElement {
  const ctx = cv.getContext("2d")!;
  const w = cv.width, h = cv.height;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  out.data.set(src.data);
  const d = src.data, o = out.data;
  const rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 40) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        o[i] = rgb[0]; o[i + 1] = rgb[1]; o[i + 2] = rgb[2]; o[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return cv;
}

/** Register a canvas as a Phaser texture once; scenes can restart freely. */
export function bakeTexture(
  scene: Phaser.Scene, key: string, cv: HTMLCanvasElement
): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv);
  return key;
}
