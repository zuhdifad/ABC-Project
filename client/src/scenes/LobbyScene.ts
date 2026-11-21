import Phaser from "phaser";
import { current, day, fmtDate, fmtTime } from "../flow/profile";
import { CHARACTERS, charById, charTextureKey, sizeSprite } from "../flow/characters";
import { audio } from "../flow/audio";
import { toast, setGoal, setSpeed } from "../flow/screens";
import { Walker, WALK_LABEL } from "../flow/walk";

const W = 960, H = 600;

const P = {
  wall: 0xf3ebdb, wall2: 0xe6f0eb, floor: 0xf7f2e6, grout: 0xe4dbc9,
  navy: 0x16324a, gold: 0xe3b45c, gold2: 0xc9922f, teal: 0x2e8f88,
  glass: 0xcfe8e4, sky: 0xa8d8d2, deep: 0x0e2436, green: 0x4fae4e,
  trunk: 0x8d6b4a, pot: 0xb98a66, carpet: 0xd9e4de
};

const ZONES = [
  { id: "exit", x: 140 },
  { id: "room", x: 848 }
] as const;

export class LobbyScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private baseY = 470;
  private walker!: Walker;
  private near: "exit" | "room" | null = null;
  private facing = 1;
  private lastClock = "";
  private roomLabel = "YOUR ROOM";

  constructor() { super("Lobby"); }

  create() {
    if (!current) return;
    this.near = null;
    this.baseY = 470;
    this.facing = 1;
    this.lastClock = "";
    document.body.classList.add("scene-office");
    document.body.classList.remove("scene-city", "scene-race", "scene-room");

    const role = charById(current.characterId).role;
    this.roomLabel = role.toUpperCase();
    if (day.stage === "commute") day.stage = "office";

    this.buildWorld();

    this.player = sizeSprite(
      this.add.image(150, this.baseY, charTextureKey(current.characterId)), 66
    ).setOrigin(0.5, 1).setDepth(10);

    this.walker = new Walker(this);
    this.input.keyboard!.on("keydown-E", () => this.enter());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.target = { x: Phaser.Math.Clamp(p.worldX, 40, W - 40), y: Phaser.Math.Clamp(p.worldY, 430, 540) };
    });

    document.getElementById("hud-action")!.onclick = () => this.enter();
    document.getElementById("hud")!.classList.add("on");
    setGoal(`GOAL · Find your room — ${this.roomLabel}`);
    toast("You're inside ABC Tower. Walk right to your department room.", 3200);

    this.cameras.main.fadeIn(220, 8, 28, 36);
    this.updateHud();
  }

  private target: { x: number; y: number } | null = null;

  /* ------------------------------------------------------------------ */

  private buildWorld() {
    const g = this.add.graphics();

    /* ceiling + wall */
    g.fillStyle(0xfdfaf2, 1); g.fillRect(0, 0, W, 58);
    g.fillStyle(0xe7dcc4, 1); g.fillRect(0, 54, W, 5);
    for (const lx of [180, 480, 790]) {
      g.fillStyle(0xfff6d8, 1); g.fillRect(lx - 46, 14, 92, 10);
      g.fillStyle(0xe9dfc2, 1); g.fillRect(lx - 52, 24, 104, 3);
    }
    g.fillStyle(P.wall, 1); g.fillRect(0, 58, W, 300);
    g.fillStyle(P.wall2, 1); g.fillRect(0, 318, W, 40);
    g.fillStyle(P.gold, 1); g.fillRect(0, 314, W, 4);
    g.fillStyle(P.gold2, 0.5); g.fillRect(0, 304, W, 2);

    /* floor */
    g.fillStyle(P.floor, 1); g.fillRect(0, 358, W, H - 358);
    g.fillStyle(P.grout, 1);
    for (let x = -60; x < W + 120; x += 120) g.fillRect(x, 358, 3, H - 358);
    for (const y of [400, 462, 536]) g.fillRect(0, y, W, 3);
    g.fillStyle(P.carpet, 0.9); g.fillRect(250, 470, 460, 92);
    g.fillStyle(P.gold2, 0.55);
    g.fillRect(250, 470, 460, 3); g.fillRect(250, 559, 460, 3);

    /* exit to the street (left) */
    g.fillStyle(P.navy, 1); g.fillRect(66, 118, 148, 246);
    g.fillStyle(P.sky, 1); g.fillRect(74, 126, 132, 210);
    g.fillStyle(0xd9f0ec, 0.9); g.fillRect(74, 126, 132, 90);
    g.fillStyle(0x9fbdc7, 0.9);
    for (let i = 0; i < 5; i++) g.fillRect(80 + i * 26, 170 - (i % 3) * 18, 16, 60 + (i % 3) * 18);
    g.fillStyle(0xf0e6d2, 1); g.fillRect(74, 300, 132, 36);
    g.fillStyle(P.navy, 0.55); g.fillRect(138, 126, 4, 210);
    g.fillStyle(P.gold, 1); g.fillRect(60, 108, 160, 10);
    this.plaque(140, 92, "EXIT →", P.teal);
    // potted plant by the door
    this.plant(g, 236, 344);

    /* reception desk (centre) — its own layer so the receptionist stands behind it */
    const desk = this.add.graphics().setDepth(2);
    desk.fillStyle(P.navy, 1); desk.fillRect(356, 236, 268, 122);
    desk.fillStyle(P.gold, 1); desk.fillRect(356, 230, 268, 8);
    desk.fillStyle(P.teal, 1); desk.fillRect(368, 268, 244, 78);
    desk.fillStyle(P.gold2, 0.9); desk.fillRect(368, 340, 244, 6);
    desk.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 3; i++) desk.fillRect(392 + i * 78, 288, 52, 6);
    desk.fillStyle(0x2b3b45, 1); desk.fillRect(582, 246, 32, 22);
    desk.fillStyle(0x9fe6dd, 1); desk.fillRect(585, 249, 26, 15);
    this.plaque(490, 210, "ABC PROJECT · RECEPTION", P.navy);

    /* elevators (right of the desk) */
    g.fillStyle(0xcdd6d6, 1); g.fillRect(660, 120, 108, 194);
    g.fillStyle(0x9fb0b2, 1); g.fillRect(668, 128, 44, 178); g.fillRect(716, 128, 44, 178);
    g.fillStyle(P.gold, 1); g.fillRect(660, 116, 108, 6);
    g.fillStyle(P.navy, 1); g.fillRect(712, 214, 2, 178);
    g.fillStyle(0xfff2b0, 1); g.fillCircle(678, 104, 5);

    /* department corridor (far right) */
    g.fillStyle(0xdad2bf, 1); g.fillRect(792, 112, 128, 246);
    g.fillStyle(0x8fa3a3, 1); g.fillRect(802, 122, 108, 236);
    g.fillStyle(P.gold, 1); g.fillRect(796, 118, 120, 12);
    g.fillStyle(P.navy, 1); g.fillRect(832, 170, 56, 188);
    g.fillStyle(P.glass, 1); g.fillRect(840, 182, 40, 74);
    g.fillStyle(P.gold, 1); g.fillRect(856, 262, 8, 8);
    this.plaque(856, 146, "→ " + this.roomLabel, P.gold2);

    /* wall clock + plants */
    g.fillStyle(0xffffff, 1); g.fillCircle(300, 150, 22);
    g.lineStyle(3, P.navy, 1); g.strokeCircle(300, 150, 22);
    g.lineStyle(3, P.navy, 1); g.lineBetween(300, 150, 300, 136);
    g.lineBetween(300, 150, 310, 156);
    this.plant(g, 318, 344);
    this.plant(g, 916, 344);

    /* receptionist + a colleague crossing the lobby */
    sizeSprite(this.add.image(490, 352, charTextureKey(this.otherCharacter(0))), 60)
      .setOrigin(0.5, 1).setDepth(1);
    sizeSprite(this.add.image(690, 404, charTextureKey(this.otherCharacter(1))), 56)
      .setOrigin(0.5, 1).setDepth(1).setAlpha(0.95);
  }

  private otherCharacter(i: number) {
    const others = CHARACTERS.filter(c => c.id !== current?.characterId);
    return (others[i % others.length] ?? CHARACTERS[0]).id;
  }

  private plant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(P.pot, 1); g.fillRect(x - 16, y, 32, 26);
    g.fillStyle(P.green, 1); g.fillCircle(x - 9, y - 6, 14);
    g.fillStyle(0x6fc95e, 1); g.fillCircle(x + 9, y - 10, 15);
    g.fillStyle(0x3f8a45, 1); g.fillCircle(x, y - 24, 12);
    g.fillStyle(0x8d6b4a, 1); g.fillRect(x - 2, y - 20, 4, 22);
  }

  private plaque(x: number, y: number, text: string, bg: number) {
    this.add.text(x, y, text, {
      fontFamily: '"Pricedown", "Trebuchet MS", sans-serif',
      fontSize: "13px", color: "#ffffff",
      backgroundColor: "#" + bg.toString(16).padStart(6, "0"),
      padding: { x: 8, y: 3 }
    }).setOrigin(0.5).setDepth(5);
  }

  /* ------------------------------------------------------------------ */

  private enter() {
    if (!this.near || !current) return;
    audio.click();
    if (this.near === "exit") { this.go("City"); return; }
    this.go("Room");
  }

  private go(key: string) {
    this.target = null;
    this.walker.reset();
    setSpeed(WALK_LABEL.idle);
    document.getElementById("hud-action")!.classList.remove("on");
    this.cameras.main.fadeOut(180, 8, 28, 36);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(key));
  }

  update(time: number, delta: number) {
    if (!current) return;
    const dt = delta / 1000;

    const walk = this.walker.read(dt);
    let vx = walk.vx, vy = walk.vy, mode = walk.mode, speed = walk.speed;

    if (walk.moving) this.target = null;
    else if (this.target) {
      const dx = this.target.x - this.player.x, dy = this.target.y - this.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) this.target = null;
      else { vx = dx / dist; vy = dy / dist; speed = 170; mode = "walk"; }
    }

    const moving = !!(vx || vy);
    if (moving) {
      const len = Math.hypot(vx, vy) || 1;
      this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * speed * dt, 40, W - 40);
      this.baseY = Phaser.Math.Clamp(this.baseY + (vy / len) * speed * dt, 430, 540);
      if (vx) this.facing = vx > 0 ? 1 : -1;
    }
    this.player.setFlipX(this.facing < 0);
    const bob = mode === "run" ? 45 : mode === "brisk" ? 58 : 70;
    this.player.y = this.baseY + (moving ? Math.sin(time / bob) * 1.4 : 0);
    setSpeed(WALK_LABEL[mode]);

    this.near = ZONES.find(z => Math.abs(z.x - this.player.x) < 52)?.id ?? null;
    const action = document.getElementById("hud-action")!;
    if (this.near) {
      action.textContent = this.near === "exit" ? "← Back to Maple Street  (E)" : `→ Enter ${this.roomLabel}  (E)`;
      action.classList.add("on");
    } else action.classList.remove("on");

    this.updateHud();
  }

  private updateHud() {
    const clock = fmtTime(new Date(), true);
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      document.getElementById("hud-clock")!.textContent = clock;
    }
    document.getElementById("hud-money")!.textContent = "$" + String(current!.money).padStart(8, "0");
    document.getElementById("hud-energy")!.textContent = "♥ " + Math.round(day.energy);
    document.getElementById("hud-left")!.textContent = `${fmtDate()} · ABC TOWER · LOBBY`;
  }
}
