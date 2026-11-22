import Phaser from "phaser";
import type { Room } from "colyseus.js";
import { current, day, fmtDate, fmtTime, addLog, saveProfile } from "../flow/profile";
import { charById } from "../flow/characters";
import { CharSprite, charWalkKey } from "../flow/CharSprite";
import { audio } from "../flow/audio";
import { clockOut, toast, setGoal, setSpeed } from "../flow/screens";
import { keys } from "../flow/keys";
import { Walker, WALK_LABEL, type WalkDir, type WalkMode } from "../flow/walk";
import { openActivity } from "../menu";
import { IsoStage } from "../iso/IsoStage";
import { WalkGrid } from "../iso/path";
import { KL_SENTRAL } from "../iso/places";
import type { IsoNpc, IsoPlace, IsoPortal, Pt } from "../iso/types";

/**
 * The isometric fixed-view scene.
 *
 * One scene renders every place: hand it a place id and it paints the diorama,
 * walks the character over the floor mask, stops at solids, sorts the player
 * behind occluders and runs the portals. Adding a place = adding a config in
 * iso/places.ts, not another scene.
 */
export class PlaceScene extends Phaser.Scene {
  private placeId = "kl-sentral";
  private returnAt: Pt | null = null;
  private place!: IsoPlace;
  private stage!: IsoStage;
  private grid!: WalkGrid;

  private player!: Phaser.GameObjects.Sprite;
  private char!: CharSprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private ring!: Phaser.GameObjects.Ellipse;
  private walker!: Walker;

  /** feet position, in image pixels */
  private at: Pt = [0, 0];
  /** waypoints left to walk, and who to tell when the last one is reached */
  private path: Pt[] = [];
  private goal: Pt | null = null;
  private onArrive?: () => void;
  private stuck = 0;
  private nearPortal: IsoPortal | null = null;
  private nearNpc: IsoNpc | null = null;
  private lastClock = "";
  private offAction?: () => void;
  private leaving = false;

  private static readonly RADIUS = 16;
  /** close enough to talk to a colleague */
  private static readonly REACH = 92;

  constructor() { super("Place"); }

  init(data?: { placeId?: string; at?: Pt }) {
    this.placeId = data?.placeId ?? "kl-sentral";
    this.returnAt = data?.at ?? null;
  }

  preload() {
    const p = PLACES[this.placeId] ?? KL_SENTRAL;
    if (!this.textures.exists(p.texture)) this.load.image(p.texture, p.image);
  }

  create() {
    const place = PLACES[this.placeId] ?? KL_SENTRAL;
    trace("place create " + place.id);
    this.place = place;
    this.nearPortal = null;
    this.nearNpc = null;
    this.path = [];
    this.goal = null;
    this.onArrive = undefined;
    this.stuck = 0;
    this.leaving = false;
    this.lastClock = "";

    document.body.classList.add("scene-station");
    document.body.classList.remove("scene-race");

    // dark hall behind the painting, so the diorama's cut corners blend in
    this.add.graphics()
      .fillGradientStyle(0x383b34, 0x383b34, 0x08090a, 0x08090a, 1)
      .fillRect(0, 0, this.scale.width, this.scale.height);

    this.stage = new IsoStage(this, place);
    this.grid = WalkGrid.of(place, PlaceScene.RADIUS);
    this.buildProps(place);

    const spawn = this.returnAt && this.stage.clear(this.returnAt[0], this.returnAt[1], PlaceScene.RADIUS)
      ? this.returnAt
      : place.spawn;
    this.at = [spawn[0], spawn[1]];

    const [sx, sy] = this.stage.toScreen(this.at[0], this.at[1]);
    this.shadow = this.add.ellipse(sx, sy, 48, 16, 0x000000, 0.34).setDepth(8);
    // a quiet gold ring reads as "this one is you" on a busy painted floor
    this.ring = this.add.ellipse(sx, sy, 58, 20).setStrokeStyle(2, 0xe3b45c, 0.7).setDepth(9);
    // the animated body: a generated walk cycle, feet anchored to the floor
    const pid = current?.characterId ?? "ayu";
    this.player = this.add.sprite(sx, sy, charWalkKey(pid))
      .setOrigin(0.5, 1).setDisplaySize(49, 74);
    this.char = new CharSprite(this.player, pid);
    this.sortDepth(this.player, this.at[1]);

    this.walker = new Walker(this, "top");
    this.offAction = keys.onPress("action", () => this.interact());
    this.events.once("shutdown", () => this.offAction?.());

    // click the floor to walk there; clicks on people are their own action
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.input.hitTestPointer(p).length) return;
      const [wx, wy] = this.stage.toWorld(p.worldX, p.worldY);
      this.goTo(wx, wy);
    });

    document.getElementById("hud-action")!.onclick = () => this.interact();
    document.getElementById("hud")!.classList.add("on");
    setGoal(day.coffeeDone
      ? "GOAL · Tap in at the LRT gates →"
      : "GOAL · Walk the hall · click a commuter to start a Coffee Chug");
    toast("WASD / arrows or click the floor · tap to brisk-walk · hold 1 or / to run", 3600);

    if (import.meta.env.DEV) {
      this.bindDebug();
      // dev handle for the verification harness
      (window as any).__iso = {
        at: () => [Math.round(this.at[0]), Math.round(this.at[1])],
        clear: (x: number, y: number) => this.stage.clear(x, y, PlaceScene.RADIUS),
        place: () => this.place.id,
        go: (x: number, y: number) => this.goTo(x, y),
        path: () => this.path.map(([x, y]) => [Math.round(x), Math.round(y)]),
        challenge: () => {
          const npc = (this.place.npcs ?? [])[0];
          if (npc) this.challenge(npc);
        }
      };
    }

    this.cameras.main.fadeIn(240, 8, 10, 10);
    this.updateHud();
    this.syncPlayer();
  }

  /* ------------------------------------------------------------------ */

  private buildProps(place: IsoPlace) {
    for (const npc of place.npcs ?? []) {
      const [sx, sy] = this.stage.toScreen(npc.x, npc.y);
      // colleagues are animated too, but they stand: play their idle clip
      const body = this.add.sprite(sx, sy, charWalkKey(npc.characterId))
        .setOrigin(0.5, 1).setDisplaySize(44, 66)
        .setInteractive({ useHandCursor: true });
      this.sortDepth(body, npc.y);
      body.play(`${charWalkKey(npc.characterId)}_down_idle`, true);
      body.on("pointerover", () => body.setTint(0xfff0c4));
      body.on("pointerout", () => body.clearTint());
      body.on("pointerdown", () => this.challenge(npc));
      this.add.text(sx, sy - 78, npc.plaque, {
        fontFamily: '"Pricedown", "Trebuchet MS", sans-serif',
        fontSize: "12px", color: "#ffffff",
        backgroundColor: "#a8352c", padding: { x: 7, y: 3 }
      }).setOrigin(0.5).setDepth(12).setAlpha(0.95);
    }

    // the goal marker: the colleague first, the gates once the chug is done
    const npc = place.npcs?.[0];
    const mark = day.coffeeDone || !npc ? [1112, 300] : [npc.x, npc.y - 118];
    const [gx, gy] = this.stage.toScreen(mark[0], mark[1]);
    const arrow = this.add.triangle(gx, gy, 0, 20, 16, 0, 32, 20, 0xe3b45c).setDepth(12);
    this.tweens.add({ targets: arrow, y: gy - 14, duration: 620, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }

  /* ------------------------------------------------------------------ */

  /**
   * Depth from the ground-contact row: a body lower on the painted floor (a
   * larger image-space y) is nearer the camera, so it draws in front. Keeping
   * every character in one y-mapped band is what makes the layering consistent
   * between the player and the colleagues; foreground props still ride above
   * via the stage's occluder slices.
   */
  private sortDepth(obj: Phaser.GameObjects.Sprite, feetY: number) {
    const t = Math.max(0, Math.min(1, feetY / this.place.height));
    obj.setDepth(10 + t * 18);
  }


  /* ------------------------------------------------------------------ */

  private bindDebug() {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Backquote") return;
      this.stage.toggleDebug(this.place.portals);
    };
    window.addEventListener("keydown", onKey);
    this.events.once("shutdown", () => window.removeEventListener("keydown", onKey));
  }

  private near<T extends { x: number; y: number; r: number }>(list: T[]): T | null {
    let best: T | null = null;
    let bestD = Infinity;
    for (const item of list) {
      const d = Math.hypot(item.x - this.at[0], item.y - this.at[1]);
      if (d <= item.r && d < bestD) { best = item; bestD = d; }
    }
    return best;
  }

  private interact() {
    if (!current || this.leaving) return;
    if (this.nearNpc) { this.challenge(this.nearNpc); return; }
    const portal = this.nearPortal;
    if (!portal) return;
    if (portal.kind === "exit") {
      audio.click();
      this.leaving = true;
      clockOut();
      return;
    }
    audio.click();
    toast("Your travel card isn't loaded yet — the Kelana Jaya platform opens next.");
  }

  /** Clicking a colleague asks them to compete: this is what starts the chug. */
  private challenge(npc: IsoNpc) {
    if (!current || this.leaving) return;
    const name = charById(npc.characterId).name;
    const d = Math.hypot(npc.x - this.at[0], npc.y - this.at[1]);
    if (d > PlaceScene.REACH) {
      audio.click();
      const queued = this.goTo(npc.x + 52, npc.y + 4, () => {
        const close = Math.hypot(npc.x - this.at[0], npc.y - this.at[1]);
        if (close <= PlaceScene.REACH) this.challenge(npc);
        else toast(`Can't get to ${name} from there — walk around the other side.`);
      });
      toast(queued ? `Walking over to ${name}…` : `No clear way to ${name} from here.`);
      return;
    }
    audio.click();
    toast(`${name}: “Loser buys lunch. Let's chug! ☕”`, 3000);
    this.openChug();
  }

  /* ---------------- walking ---------------- */

  /** Route the feet to a point in image space; the callback fires on arrival. */
  private goTo(x: number, y: number, onArrive?: () => void): boolean {
    const pts = this.grid.find(this.at, [x, y]);
    if (!pts.length) { this.clearPath(); return false; }
    this.path = pts;
    this.goal = pts[pts.length - 1];
    this.onArrive = onArrive;
    this.stuck = 0;
    return true;
  }

  /** A prop clipped the line: ask for a fresh route, once. */
  private repath() {
    if (!this.goal) return this.clearPath();
    const pts = this.grid.find(this.at, this.goal);
    if (!pts.length) return this.clearPath();
    this.path = pts;
    this.stuck = 1;
  }

  private clearPath() {
    this.path = [];
    this.goal = null;
    this.onArrive = undefined;
  }

  private arrive() {
    const cb = this.onArrive;
    this.clearPath();
    cb?.();
  }

  /** The waypoint to steer at now, firing the arrival callback at the end. */
  private nextWaypoint(): Pt | null {
    while (this.path.length &&
           Math.hypot(this.path[0][0] - this.at[0], this.path[0][1] - this.at[1]) < 8) {
      this.path.shift();
    }
    if (!this.path.length && this.goal) this.arrive();
    return this.path[0] ?? null;
  }

  private openChug() {
    trace("openChug");
    this.scene.pause();
    openActivity("coffee", current!.name, current!.characterId,
      (room: Room) => this.launchRace(room),
      () => this.scene.resume());
  }

  private launchRace(room: Room) {
    trace("launchRace");
    const at: Pt = [this.at[0], this.at[1]];
    document.getElementById("hud")!.classList.remove("on");
    document.getElementById("hud-action")!.classList.remove("on");
    this.scene.start("Race", {
      room,
      onExit: (result?: { rank: number; progress: number }) => {
        trace("race exit " + JSON.stringify(result ?? null));
        this.applyChug(result);
        this.scene.stop("Race");
        this.scene.start("Place", { placeId: this.place.id, at });
      }
    });
    trace("race queued");
  }

  private applyChug(result?: { rank: number; progress: number }) {
    if (!current) return;
    if (!result) { addLog("☕ Coffee Chug", "left early", 0); saveProfile(current); return; }
    const money = result.rank === 1 ? 40 : 15;
    day.energy = Math.min(100, day.energy + 15);
    day.coffeeDone = true;
    if (result.rank === 1) current.wins++;
    addLog("☕ Coffee Chug", `rank #${result.rank} · +15 energy`, money);
    saveProfile(current);
    setGoal("GOAL · Tap in at the LRT gates →");
    toast(result.rank === 1 ? "🏆 Won $40! Now tap in at the gates." : "Earned $15. Now tap in at the gates.");
  }

  /* ------------------------------------------------------------------ */

  private syncPlayer() {
    const [sx, sy] = this.stage.toScreen(this.at[0], this.at[1]);
    this.player.setPosition(sx, sy);
    this.sortDepth(this.player, this.at[1]);
    this.shadow.setPosition(sx, sy - 2);
    this.ring.setPosition(sx, sy - 1);
    this.stage.updateOccluders(this.at[1]);
  }

  /** the animation row a movement vector should play: the dominant axis */
  private dirFrom(dx: number, dy: number): WalkDir {
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "up" : "down";
    return dx < 0 ? "left" : "right";
  }

  update(time: number, delta: number) {
    if (!current) return;
    const dt = Math.min(delta, 50) / 1000;

    const walk = this.walker.read(dt);
    let dx = walk.vx, dy = walk.vy;
    let mode: WalkMode = walk.mode;
    let speed = walk.speed;

    if (walk.moving) {
      // the hands took over: drop the click route
      this.clearPath();
    } else {
      const wp = this.nextWaypoint();
      if (wp) {
        const tx = wp[0] - this.at[0];
        const ty = wp[1] - this.at[1];
        const dist = Math.hypot(tx, ty) || 1;
        dx = tx / dist; dy = ty / dist; speed = 168; mode = "walk";
      }
    }

    const moving = !!(dx || dy);
    if (moving) {
      // walker speeds are in screen px/s; the painting is larger than the canvas
      let step = (speed / this.stage.scale) * dt * 0.9;
      if (this.path.length) {
        // never step past the waypoint we are aiming at
        const left = Math.hypot(this.path[0][0] - this.at[0], this.path[0][1] - this.at[1]);
        step = Math.min(step, left);
      }
      const [nx, ny] = this.stage.move(this.at[0], this.at[1], dx * step, dy * step, PlaceScene.RADIUS);
      if (nx === this.at[0] && ny === this.at[1]) {
        // a prop is in the way: ask for a detour once, then give up
        if (this.path.length) {
          if (this.stuck++ === 0) this.repath();
          else this.clearPath();
        }
      } else {
        this.at = [nx, ny];
        this.stuck = 0;
      }
    }

    // the body: pick the row from where it is actually heading (keys or click
    // route alike) and let the sprite sheet carry the stride — no manual bob
    this.char.setState(this.dirFrom(dx, dy), moving, mode);
    this.syncPlayer();
    setSpeed(WALK_LABEL[moving ? mode : "idle"]);

    this.nearPortal = this.near(this.place.portals);
    this.nearNpc = this.near((this.place.npcs ?? []).map(n => ({ ...n, r: 76 })));

    const action = document.getElementById("hud-action")!;
    const label = this.nearNpc
      ? `☕ Challenge ${charById(this.nearNpc.characterId).name} to a Chug  (E)`
      : this.nearPortal?.label;
    if (label) { action.textContent = label + "  (E)"; action.classList.add("on"); }
    else action.classList.remove("on");

    this.updateHud();
    this.drawMinimap();
  }

  private updateHud() {
    const clock = fmtTime(new Date(), true);
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      document.getElementById("hud-clock")!.textContent = clock;
    }
    document.getElementById("hud-money")!.textContent = "$" + String(current!.money).padStart(8, "0");
    document.getElementById("hud-energy")!.textContent = "♥ " + Math.round(day.energy);
    document.getElementById("hud-left")!.textContent = `${fmtDate()} · ${this.place.title}`;
  }

  private drawMinimap() {
    const c = document.getElementById("minimap") as HTMLCanvasElement | null;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const s = Math.min((c.width - 18) / this.place.width, (c.height - 18) / this.place.height);
    const ox = (c.width - this.place.width * s) / 2;
    const oy = (c.height - this.place.height * s) / 2;

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(20, 46, 44, .72)";
    ctx.beginPath();
    this.place.floor.forEach(([x, y], i) => {
      const px = ox + x * s, py = oy + y * s;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(227, 180, 92, .8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (const portal of this.place.portals) {
      ctx.fillStyle = portal.kind === "exit" ? "#d6544a" : "#e3b45c";
      ctx.fillRect(ox + portal.x * s - 2, oy + portal.y * s - 2, 5, 5);
    }

    ctx.fillStyle = "#f7e3b4";
    ctx.beginPath();
    ctx.arc(ox + this.at[0] * s, oy + this.at[1] * s, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0e2436";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

const PLACES: Record<string, IsoPlace> = {
  "kl-sentral": KL_SENTRAL
};

/** dev breadcrumb trail for the scene-transition harness */
function trace(msg: string) {
  if (!import.meta.env.DEV) return;
  const w = window as any;
  (w.__isoLog ??= []).push(`${Math.round(performance.now())} ${msg}`);
  console.log("[iso]", msg);
}
