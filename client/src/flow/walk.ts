import Phaser from "phaser";

/**
 * Shared on-foot controls for the walkable scenes (street, lobby, room).
 *
 * - hold a direction key: steady walk
 * - tap the forward key repeatedly: brisk walk (the taps stack up and decay)
 * - hold the forward key + 1 or /: run
 */
export type WalkMode = "idle" | "walk" | "brisk" | "run";

export interface WalkState {
  vx: number;
  vy: number;
  moving: boolean;
  mode: WalkMode;
  speed: number;
  facing: number;
}

const WALK_SPEED = 150;
const RUN_SPEED = 330;

export class Walker {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private boost = 0;
  private momentum = 0;
  /** direction the character is facing: +1 right, -1 left */
  private facing = 1;

  constructor(private scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,SLASH,SHIFT") as any;

    const tap = (e: KeyboardEvent) => {
      if (e.repeat) return;               // held keys auto-repeat; only real taps count
      this.boost = Math.min(1, this.boost + 0.4);
      this.momentum = Math.min(0.55, this.momentum + 0.32);
    };
    scene.input.keyboard!.on("keydown-UP", tap);
    scene.input.keyboard!.on("keydown-W", tap);
    scene.events.once("shutdown", () => {
      scene.input.keyboard?.off("keydown-UP", tap);
      scene.input.keyboard?.off("keydown-W", tap);
    });
  }

  reset() { this.boost = 0; this.momentum = 0; }

  read(dt: number): WalkState {
    const k = this.keys;
    let vx = 0;
    if (k.LEFT?.isDown || k.A?.isDown) { vx -= 1; this.facing = -1; }
    if (k.RIGHT?.isDown || k.D?.isDown) { vx += 1; this.facing = 1; }
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
    return { vx, vy: 0, moving, mode, speed, facing: this.facing };
  }
}

export const WALK_LABEL: Record<WalkMode, string> = {
  idle: "🧍 IDLE",
  walk: "🚶 WALK",
  brisk: "🏃 BRISK WALK",
  run: "💨 RUN"
};
