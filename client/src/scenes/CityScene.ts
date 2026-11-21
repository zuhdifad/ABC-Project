import Phaser from "phaser";
import { current, day, fmtTime, fmtDate } from "../flow/profile";
import { charTextureKey, sizeSprite } from "../flow/characters";
import { audio } from "../flow/audio";
import { clockOut, toast, setGoal, setSpeed } from "../flow/screens";
import { Walker, WALK_LABEL } from "../flow/walk";
import { TILE } from "../art/tiles";
import { propTextureKey, type PropKind } from "../art/props";
import {
  buildWorld, blockedAt, drawMinimap, PROPS, ZONES, SCALE, WORLD_W, WORLD_H,
  SPAWN_MEADOW, SPAWN_OFFICE, type World, type ZoneDef
} from "../art/map";

const PLAYER_H = 100;
/** props that get a soft ground shadow (buildings, trunks, carts) */
const SHADOWED = new Set<PropKind>([
  "cottage", "cafe", "station", "tower", "cart", "oak", "oakSmall", "pine",
  "bush", "bushBerry", "bench", "planter", "rock", "stump", "crate", "barrel"
]);

/**
 * Maple Meadow, top-down.
 *
 * The village is a 44 x 34 tile pixel map (one ground texture, one sprite per
 * prop) with the camera riding the player. Everything that used to be a flat
 * side-scroll band is now a place: a flowered meadow with a merchant cart, a
 * fenced path north, a cobbled high street and ABC Tower at the top.
 */
export class CityScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private walker!: Walker;
  private world!: World;
  private base = { x: 0, y: 0 };
  private target: { x: number; y: number } | null = null;
  private near: ZoneDef | null = null;
  private facing = 1;
  private lastClock = "";
  private lastMini = 0;
  /** seconds a tap target has been unable to make progress */
  private stuck = 0;

  constructor() { super("City"); }

  create() {
    if (!current) return;
    this.target = null;
    this.near = null;
    this.facing = 1;
    this.lastClock = "";
    this.lastMini = 0;
    document.body.classList.add("scene-city");
    document.body.classList.remove("scene-race", "scene-office", "scene-room");

    const commuting = day.stage === "commute";
    const spawn = commuting ? SPAWN_MEADOW : SPAWN_OFFICE;
    this.base = { x: spawn.x * TILE * SCALE, y: spawn.y * TILE * SCALE };

    this.world = buildWorld(this);

    /* ---------- ground: one baked pixel texture ---------- */
    this.add.image(0, 0, this.world.groundKey)
      .setOrigin(0, 0).setScale(SCALE).setDepth(-1000);

    /* ---------- props, depth-sorted by their base line ---------- */
    for (const prop of PROPS) {
      const x = prop.x * TILE * SCALE;
      const y = prop.y * TILE * SCALE;
      const key = propTextureKey(prop.kind);
      const img = this.add.image(x, y, key)
        .setOrigin(0.5, 1).setScale(SCALE).setDepth(y);
      if (prop.flip) img.setFlipX(true);

      if (SHADOWED.has(prop.kind)) {
        const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const w = Math.min(src.width * SCALE * 0.72, 420);
        this.add.image(x, y - 2, this.world.shadowKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(w, Math.max(12, w * 0.28))
          .setDepth(y - 2)
          .setAlpha(prop.kind === "cottage" || prop.kind === "cafe" ? 0.75 : 0.9);
      }
    }

    /* ---------- pilot ---------- */
    this.shadow = this.add.image(this.base.x, this.base.y - 2, this.world.shadowKey)
      .setOrigin(0.5, 0.5).setDisplaySize(48, 15).setDepth(this.base.y - 2);
    this.player = sizeSprite(
      this.add.image(this.base.x, this.base.y, charTextureKey(current.characterId)), PLAYER_H
    ).setOrigin(0.5, 1).setDepth(this.base.y);

    /* ---------- camera rides the meadow ---------- */
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player, true, 0.16, 0.16, 0, 52);
    cam.setRoundPixels(true);
    cam.fadeIn(240, 18, 34, 20);

    /* ---------- ambient: pond sparkle ---------- */
    for (let i = 0; i < 7; i++) {
      const sx = (27.6 + (i * 1.62) % 12) * TILE * SCALE;
      const sy = (26.6 + ((i * 2.1) % 5.2)) * TILE * SCALE;
      const spark = this.add.rectangle(sx, sy, 2, 2, 0xd9f0f4, 0.85).setDepth(-900);
      this.tweens.add({
        targets: spark, alpha: { from: 0.1, to: 0.9 },
        duration: 900 + i * 180, yoyo: true, repeat: -1, delay: i * 220
      });
    }

    /* ---------- input ---------- */
    this.walker = new Walker(this, "top");
    this.input.keyboard!.on("keydown-E", () => this.enter());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.target = {
        x: Phaser.Math.Clamp(p.worldX, 8, WORLD_W - 8),
        y: Phaser.Math.Clamp(p.worldY, 8, WORLD_H - 8)
      };
    });

    document.getElementById("hud-action")!.onclick = () => this.enter();
    document.getElementById("hud")!.classList.add("on");
    setGoal(commuting ? "GOAL · Walk north to ABC TOWER" : "GOAL · Clock out at home 🏠");
    toast(commuting
      ? "WASD / arrows to walk · tap to hurry · hold Shift to run · E at a door."
      : "Back in Maple Meadow — home is south, ABC Tower is north.",
      3600);
    this.updateHud(true);
    this.drawMini(0);
  }

  /* ------------------------------------------------------------------ */

  private enter() {
    if (!this.near || !current) return;
    const id = this.near.id;
    if (id === "office") { audio.click(); this.go("Lobby"); return; }
    if (id === "home") {
      if (day.stage === "commute") {
        audio.deny();
        toast("You haven't clocked in yet — ABC Tower is north.");
        return;
      }
      audio.click();
      clockOut();
      return;
    }
    audio.deny();
    if (id === "cafe") toast("The office pantry has free coffee — keep walking north.");
    else if (id === "station") toast("No LRT today. ABC Tower is a short walk north.");
  }

  private go(key: string) {
    this.target = null;
    this.walker.reset();
    setSpeed(WALK_LABEL.idle);
    document.getElementById("hud-action")!.classList.remove("on");
    this.cameras.main.fadeOut(180, 18, 34, 20);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(key));
  }

  private nearLabel(z: ZoneDef): string {
    if (z.id === "office") {
      return day.stage === "commute" ? "🏢 Clock in" : "🏢 Enter the tower";
    }
    if (z.id === "home") {
      return day.stage === "commute" ? "🏠 Clock in first" : "🏠 Clock out";
    }
    return z.label;
  }

  update(time: number, delta: number) {
    if (!current) return;
    const dt = delta / 1000;

    const walk = this.walker.read(dt);
    let vx = walk.vx, vy = walk.vy, mode = walk.mode, speed = walk.speed;
    let moving = walk.moving;

    // click-to-walk, the phone-friendly fallback
    if (moving) this.target = null;
    else if (this.target) {
      const dx = this.target.x - this.base.x;
      const dy = this.target.y - this.base.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 5) this.target = null;
      else { vx = dx / dist; vy = dy / dist; speed = 168; mode = "walk"; moving = true; }
    }

    if (moving) {
      // axis-separated: brushing a wall slides along it instead of stopping dead
      const nx = Phaser.Math.Clamp(this.base.x + vx * speed * dt, 10, WORLD_W - 10);
      const ny = Phaser.Math.Clamp(this.base.y + vy * speed * dt, 10, WORLD_H - 10);
      const wasX = this.base.x, wasY = this.base.y;
      if (!blockedAt(this.world, nx, this.base.y)) this.base.x = nx;
      if (!blockedAt(this.world, this.base.x, ny)) this.base.y = ny;
      if (vx) this.facing = vx > 0 ? 1 : -1;
      else if (walk.dir === "left") this.facing = -1;
      else if (walk.dir === "right") this.facing = 1;

      // a tap that cannot get where it wanted gives up instead of grinding
      // against a wall — the player can then just tap somewhere else
      if (this.target) {
        const moved = this.base.x !== wasX || this.base.y !== wasY;
        this.stuck = moved ? 0 : this.stuck + dt;
        if (this.stuck > 0.35) { this.target = null; this.stuck = 0; }
      }
    } else this.stuck = 0;

    // a two-frame step bob: feet stay planted, the body lifts
    const rate = mode === "run" ? 70 : mode === "brisk" ? 95 : 138;
    const lift = moving ? Math.abs(Math.sin(time / rate)) * (mode === "run" ? 3.4 : 2.2) : 0;
    this.player.setFlipX(this.facing < 0);
    this.player.setPosition(this.base.x, this.base.y - lift);
    this.player.setDepth(this.base.y);

    this.shadow.setPosition(this.base.x, this.base.y - 3);
    this.shadow.setDisplaySize(48 - lift * 2, 15 - lift * 0.8);
    this.shadow.setDepth(this.base.y - 2);

    setSpeed(WALK_LABEL[mode]);

    // proximity doors
    let best: ZoneDef | null = null;
    let bestD = Infinity;
    for (const z of ZONES) {
      const d = Phaser.Math.Distance.Between(
        this.base.x, this.base.y, z.x * TILE * SCALE, z.y * TILE * SCALE
      );
      if (d < z.r && d < bestD) { best = z; bestD = d; }
    }
    this.near = best;
    const action = document.getElementById("hud-action")!;
    if (best) {
      action.textContent = this.nearLabel(best) + "  (E)";
      action.classList.add("on");
    } else action.classList.remove("on");

    this.updateHud(false);
    if (time - this.lastMini > 110) this.drawMini(time);
  }

  private updateHud(force: boolean) {
    const clock = fmtTime(new Date(), true);
    if (force || clock !== this.lastClock) {
      this.lastClock = clock;
      document.getElementById("hud-clock")!.textContent = clock;
    }
    document.getElementById("hud-money")!.textContent = "$" + String(current!.money).padStart(8, "0");
    document.getElementById("hud-energy")!.textContent = "♥ " + Math.round(day.energy);
    document.getElementById("hud-left")!.textContent = `${fmtDate()} · MAPLE MEADOW`;
  }

  private drawMini(time: number) {
    const c = document.getElementById("minimap") as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    this.lastMini = time;
    const cam = this.cameras.main;
    drawMinimap(ctx, c.width, c.height, this.world,
      { x: this.base.x, y: this.base.y },
      { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height });
  }
}
