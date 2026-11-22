import type { IsoSolid, Pt } from "./types";

/** Ray-cast point-in-polygon (works for concave outlines too). */
export function pointInPoly(x: number, y: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const RING = 10;

/**
 * Can a body of radius r stand at (x, y)? The body is sampled as a ring of
 * points, which is plenty for a painted floor and costs nothing.
 */
export function circleClear(
  x: number, y: number, r: number,
  floor: readonly Pt[], solids: readonly IsoSolid[]
): boolean {
  if (!pointInPoly(x, y, floor)) return false;
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (!pointInPoly(px, py, floor)) return false;
    for (const s of solids) if (pointInPoly(px, py, s.points)) return false;
  }
  return true;
}

/**
 * Move a body with wall sliding: try the full step, then each axis alone, so
 * walking into a kiosk at an angle slides along it instead of sticking.
 */
export function slideMove(
  x: number, y: number, dx: number, dy: number, r: number,
  floor: readonly Pt[], solids: readonly IsoSolid[]
): Pt {
  if (circleClear(x + dx, y + dy, r, floor, solids)) return [x + dx, y + dy];
  if (dx && circleClear(x + dx, y, r, floor, solids)) return [x + dx, y];
  if (dy && circleClear(x, y + dy, r, floor, solids)) return [x, y + dy];
  return [x, y];
}

/** Axis-aligned rectangle as a polygon — the shorthand every place uses. */
export const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] =>
  [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
