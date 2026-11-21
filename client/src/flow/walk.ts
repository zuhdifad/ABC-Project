import Phaser from "phaser";

/**
 * Shared on-foot controls for the walkable scenes (street, lobby, room).
 *
 * Two planes:
 *  - "side" (default, interiors): left/right steer, W/↑ is "forward", which is
 *    what a corridor scene wants.
 *  - "top" (the village map): WASD / arrows move on both axes, diagonals are
 *    normalised, and `dir` reports which way the body is pointing so the
 *    sprite can be flipped and animated.
 *
 * In both planes:
 * - hold a direction key: steady walk
 * - tap direction keys repeatedly: brisk walk (the taps stack up and decay)
 * - hold a direction + 1 or / or Shift: run
 */
export type WalkMode = "idle" | "walk" | "brisk" | "run";
export type WalkPlane = "side" | "top";
export type WalkDir = "up" | "down" | "left" | "right";

export interface WalkState {
  vx: number;
  vy: number;
  moving: boolean;
  mode: WalkMode;
  speed: number;
  facing: number;
  /** last facing on the top-down plane */
  dir: WalkDir;
}

const WALK_SPEED = 150;
const RUN_SPEED = 330;

/** keys the page must never steal: arrows scroll, space pages down */
const CAPTURED = "W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,ONE,SLASH";

export class Walker {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private boost = 0;
  private momentum = 0;
  /** direction the character is facing: +1 right, -1 left */
  private facing = 1;
  /** last facing on the top-down plane */
  private dir: WalkDir = "down";
  /** on-screen d-pad, -1..1 per axis */
  private padX = 0;
  private padY = 0;

  constructor(private scene: Phaser.Scene, private plane: WalkPlane = "side") {
    this.keys = scene.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,SLASH,SHIFT") as any;
    // without this, holding an arrow scrolls the page and the canvas stops
    // listening for the key — which reads to the player as "left/right is dead"
    scene.input.keyboard!.addCapture(CAPTURED);

    const tap = (e: KeyboardEvent) => {
      if (e.repeat) return;               // held keys auto-repeat; only real taps count
      this.boost = Math.min(1, this.boost + 0.4);
      this.momentum = Math.min(0.55, this.momentum + 0.32);
    };
    const taps = plane === "top"
      ? ["UP", "W", "DOWN", "S", "LEFT", "A", "RIGHT", "D"]
      : ["UP", "W"];
    for (const key of taps) scene.input.keyboard!.on(`keydown-${key}`, tap);
    setActiveWalker(this);
    scene.events.once("shutdown", () => {
      for (const key of taps) scene.input.keyboard?.off(`keydown-${key}`, tap);
      if (active === this) setActiveWalker(null);
    });
  }

  /** Steer from the on-screen d-pad (touch and mouse). */
  setPad(x: number, y: number) {
    this.padX = Math.max(-1, Math.min(1, x));
    this.padY = Math.max(-1, Math.min(1, y));
    if (this.padX || this.padY) this.boost = Math.min(1, this.boost + 0.04);
  }

  reset() {
    this.boost = 0;
    this.momentum = 0;
    this.padX = 0;
    this.padY = 0;
  }

  read(dt: number): WalkState {
    return this.plane === "top" ? this.readTop(dt) : this.readSide(dt);
  }

  private readSide(dt: number): WalkState {
    const k = this.keys;
    let vx = 0;
    if (k.LEFT?.isDown || k.A?.isDown) { vx -= 1; this.facing = -1; }
    if (k.RIGHT?.isDown || k.D?.isDown) { vx += 1; this.facing = 1; }
    if (vx) this.dir = vx < 0 ? "left" : "right";
    // the d-pad: sides steer, up/down walk forward and back like W / S
    if (!vx && this.padX) { vx = this.padX; this.facing = vx > 0 ? 1 : -1; }
    else if (!vx && this.padY) vx = this.padY < 0 ? this.facing : -this.facing;
    if (!vx) {
      // W / ↑ always means "walk forward" in the direction the character faces
      if (k.UP?.isDown || k.W?.isDown) vx = this.facing;
      else if (k.DOWN?.isDown || k.S?.isDown) vx = -this.facing;
    }

    this.boost = Math.max(0, this.boost - dt * 0.35);
    this.momentum = Math.max(0, this.momentum - dt);

    let moving = vx !== 0;
    if (moving) {
      this.momentum = 0;
    } else if (this.momentum > 0) {
      // a tap leaves a short forward glide, so rapid taps read as a brisk walk
      vx = this.facing;
      moving = true;
    }

    let mode: WalkMode = "idle";
    let speed = 0;
    if (moving) {
      const forwardHeld = !!(k.UP?.isDown || k.W?.isDown);
      const runKey = k.ONE?.isDown || k.SLASH?.isDown || k.SHIFT?.isDown;
      if (runKey && forwardHeld) { mode = "run"; speed = RUN_SPEED; }
      else if (this.boost > 0.28) { mode = "brisk"; speed = WALK_SPEED * (1 + 0.55 * this.boost); }
      else { mode = "walk"; speed = WALK_SPEED * (1 + 0.3 * this.boost); }
    }
    return { vx, vy: 0, moving, mode, speed, facing: this.facing, dir: this.dir };
  }

  private readTop(dt: number): WalkState {
    const k = this.keys;
    let vx = 0, vy = 0;
    if (k.LEFT?.isDown || k.A?.isDown) vx -= 1;
    if (k.RIGHT?.isDown || k.D?.isDown) vx += 1;
    if (k.UP?.isDown || k.W?.isDown) vy -= 1;
    if (k.DOWN?.isDown || k.S?.isDown) vy += 1;
    // the on-screen pad steers through the same axis values as the keys
    vx = Math.max(-1, Math.min(1, vx + this.padX));
    vy = Math.max(-1, Math.min(1, vy + this.padY));

    this.boost = Math.max(0, this.boost - dt * 0.35);
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      if (vx) this.facing = vx > 0 ? 1 : -1;
      this.dir = Math.abs(vy) > Math.abs(vx)
        ? (vy < 0 ? "up" : "down")
        : (vx < 0 ? "left" : "right");
    }

    let mode: WalkMode = "idle";
    let speed = 0;
    if (moving) {
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      const runKey = k.ONE?.isDown || k.SLASH?.isDown || k.SHIFT?.isDown;
      if (runKey) { mode = "run"; speed = RUN_SPEED; }
      else if (this.boost > 0.28) { mode = "brisk"; speed = WALK_SPEED * (1 + 0.55 * this.boost); }
      else { mode = "walk"; speed = WALK_SPEED * (1 + 0.3 * this.boost); }
    }
    return {
      vx, vy, moving, mode, speed, facing: this.facing, dir: this.dir
    };
  }
}

export const WALK_LABEL: Record<WalkMode, string> = {
  idle: "🧍 IDLE",
  walk: "🚶 WALK",
  brisk: "🏃 BRISK WALK",
  run: "💨 RUN"
};

/** The walker of the scene on screen, so the d-pad always steers the right body. */
let active: Walker | null = null;
export function activeWalker(): Walker | null {
  return active;
}
export function setActiveWalker(w: Walker | null) {
  active = w;
}

