import { circleClear } from "./geometry";
import type { IsoPlace, Pt } from "./types";

/**
 * Walk grid + A* for one place.
 *
 * Steering straight at a click walks you into the wheelchair. The same floor
 * and solid polygons that answer "can a body stand here" are baked into a
 * coarse grid once, and this answers "give me waypoints from here to there",
 * so a click routes around props instead of grinding against them.
 */
const CELL = 16;
const CACHE = new Map<string, WalkGrid>();

export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  private ok: Uint8Array;

  constructor(readonly place: IsoPlace, readonly radius: number) {
    this.cols = Math.ceil(place.width / CELL);
    this.rows = Math.ceil(place.height / CELL);
    this.ok = new Uint8Array(this.cols * this.rows);
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const [x, y] = this.center(gx, gy);
        this.ok[gy * this.cols + gx] =
          circleClear(x, y, radius, place.floor, place.solids) ? 1 : 0;
      }
    }
  }

  /** One grid per place + body size; the ground never moves. */
  static of(place: IsoPlace, radius: number): WalkGrid {
    const key = place.id + ":" + radius;
    let grid = CACHE.get(key);
    if (!grid) {
      grid = new WalkGrid(place, radius);
      CACHE.set(key, grid);
    }
    return grid;
  }

  /* ------------------------------------------------------------------ */

  private center(gx: number, gy: number): Pt {
    return [gx * CELL + CELL / 2, gy * CELL + CELL / 2];
  }

  private walkable(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return false;
    return this.ok[gy * this.cols + gx] === 1;
  }

  /** Closest walkable cell centre, searching outwards in rings. */
  private snap(p: Pt, maxCells: number): Pt | null {
    const gx0 = Math.floor(p[0] / CELL);
    const gy0 = Math.floor(p[1] / CELL);
    for (let r = 0; r <= maxCells; r++) {
      let best: Pt | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const gx = gx0 + dx;
          const gy = gy0 + dy;
          if (!this.walkable(gx, gy)) continue;
          const c = this.center(gx, gy);
          const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
          if (d < bestD) { best = c; bestD = d; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Can a body slide from a to b without touching a prop? */
  private los(a: Pt, b: Pt): boolean {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    // 3px steps: a chord must not slip between two samples and clip a corner
    const steps = Math.ceil(Math.hypot(dx, dy) / 3);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      if (!circleClear(a[0] + dx * t, a[1] + dy * t, this.radius, this.place.floor, this.place.solids)) {
        return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------------------ */

  /**
   * Waypoints from `from` to `to` (the start is not repeated in the result).
   * An empty array means "nowhere to stand near there, or walled off".
   * A click onto a prop lands on the nearest bit of floor within ~80px;
   * a click into the black cut-out of the painting is simply ignored.
   */
  find(from: Pt, to: Pt): Pt[] {
    // a click on a prop walks to the closest floor next to it
    const goal = this.snap(to, 5);
    if (!goal) return [];
    if (this.los(from, goal)) return [goal];

    const start = this.snap(from, 2);
    if (!start) return [];

    const sgx = Math.floor(start[0] / CELL);
    const sgy = Math.floor(start[1] / CELL);
    const ggx = Math.floor(goal[0] / CELL);
    const ggy = Math.floor(goal[1] / CELL);

    // The grid is coarser than the body, so a cell-to-cell hop can still clip a
    // corner. Every hop of the chosen route is checked and blocked cells are
    // re-routed; three passes is plenty for a static painting.
    const blocked = new Set<number>();
    for (let pass = 0; pass < 3; pass++) {
      const cells = this.astar(sgx, sgy, ggx, ggy, blocked);
      if (!cells.length) return [];

      let bad = -1;
      for (let i = 1; i < cells.length; i++) {
        const a = this.center(cells[i - 1][0], cells[i - 1][1]);
        const b = this.center(cells[i][0], cells[i][1]);
        if (!this.los(a, b)) { bad = i; break; }
      }
      if (bad >= 0) {
        blocked.add(cells[bad][1] * this.cols + cells[bad][0]);
        continue;
      }

      // cells -> points, with the exact goal appended when the last leg allows it
      const pts: Pt[] = cells.slice(1).map(([gx, gy]) => this.center(gx, gy));
      const tail = pts.length ? pts[pts.length - 1] : start;
      if (this.los(tail, goal)) pts.push(goal);
      else if (!pts.length) return [];

      const out = this.smooth(start, pts);
      // the feet stand off the cell centre: make sure the first leg still walks
      if (out.length && !this.los(from, out[0])) out.unshift(start);
      return out;
    }
    return [];
  }

  private astar(
    sgx: number,
    sgy: number,
    ggx: number,
    ggy: number,
    blocked: Set<number>
  ): Array<[number, number]> {
    const { cols } = this;
    const n = cols * this.rows;
    const start = sgy * cols + sgx;
    const goal = ggy * cols + ggx;
    if (!this.walkable(ggx, ggy) || blocked.has(goal)) return [];

    const g = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const seen = new Uint8Array(n);
    const heap = new MinHeap();
    const h = (i: number) => {
      const dx = Math.abs((i % cols) - ggx);
      const dy = Math.abs(Math.floor(i / cols) - ggy);
      return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
    };

    g[start] = 0;
    heap.push(start, h(start));
    const DIRS: Array<[number, number, number]> = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]
    ];

    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) break;
      if (seen[cur]) continue;
      seen[cur] = 1;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        // no cutting diagonal corners between two props
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
        const ni = ny * cols + nx;
        if (seen[ni] || blocked.has(ni)) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          from[ni] = cur;
          heap.push(ni, ng + h(ni));
        }
      }
    }

    if (!seen[goal] && g[goal] === Infinity) return [];
    const out: Array<[number, number]> = [];
    for (let i = goal; i !== -1; i = from[i]) {
      out.push([i % cols, Math.floor(i / cols)]);
      if (i === start) break;
    }
    return out.reverse();
  }

  /** Drop every waypoint that a straight walk from the previous one can skip. */
  private smooth(start: Pt, pts: Pt[]): Pt[] {
    const out: Pt[] = [];
    let anchor = start;
    let i = 0;
    while (i < pts.length) {
      const next = this.farthest(anchor, pts, i);
      out.push(pts[next]);
      anchor = pts[next];
      i = next + 1;
    }
    return out;
  }

  /**
   * Last point of `pts` (from index `from`) the walker can reach in a straight
   * line. Binary search keeps a long route cheap: one check when the whole
   * stretch is clear, ~log n when a prop interrupts it.
   */
  private farthest(anchor: Pt, pts: Pt[], from: number): number {
    const last = pts.length - 1;
    if (from === last || this.los(anchor, pts[last])) return last;
    let lo = from;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.los(anchor, pts[mid])) lo = mid; else hi = mid;
    }
    return lo;
  }
}

/** Tiny binary heap keyed by f-score; the grid is small but A* runs on every click. */
class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];

  get size(): number { return this.ids.length; }

  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    const id = this.ids[a]; this.ids[a] = this.ids[b]; this.ids[b] = id;
    const k = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = k;
  }
}
