import Phaser from "phaser";
import { current, day, fmtTime, fmtDate } from "../flow/profile";
import { charTextureKey } from "../flow/characters";
import { audio } from "../flow/audio";
import { clockOut, toast, setGoal, setSpeed } from "../flow/screens";
import { Walker, WALK_LABEL } from "../flow/walk";

const W = 960, H = 600;
const DOORS = [
  { id: "home", x: 140, r: 62, emoji: "🏠", label: "🏠 Go home — clock out" },
  { id: "cafe", x: 360, r: 60, emoji: "☕", label: "☕ Coffee shop" },
  { id: "station", x: 580, r: 60, emoji: "🚉", label: "🚉 LRT station" },
  { id: "office", x: 800, r: 105, emoji: "🏢", label: "🏢 ABC Tower — clock in" }
];

// palette lifted from the cover art
const C = {
  skyTop: 0xd9f0ec, skyLow: 0xa8d8d2,
  tower: 0x9fbdc7, towerLight: 0xc4dcdd, glass: 0xcfe8e4, glassLine: 0x9dc2be,
  navy: 0x16324a, gold: 0xe3b45c, gold2: 0xc9922f,
  cream: 0xf6efe0, cream2: 0xf7e6cd, walk: 0xf0e6d2, tile: 0xe3d6bd,
  curb: 0xcfc3ab, road: 0x93a3a3, roadLine: 0xf4f6f3, lower: 0xe6dfcd,
  green: 0x4fae4e, green2: 0x6fc95e, trunk: 0x8d6b4a,
  red: 0xd6544a, orange: 0xf0954a, teal: 0x2e8f88
};

export class CityScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private baseY = 400;
  private target: { x: number; y: number } | null = null;
  private walker!: Walker;
  private train!: Phaser.GameObjects.Container;
  private clouds: Phaser.GameObjects.Ellipse[] = [];
  private near: (typeof DOORS)[number] | null = null;
  private lastClock = "";
  private facing = 1;

  constructor() { super("City"); }

  create() {
    if (!current) return;
    this.target = null;
    this.near = null;
    this.clouds = [];
    this.baseY = 400;
    this.lastClock = "";
    this.facing = 1;
    document.body.classList.add("scene-city");
    document.body.classList.remove("scene-race", "scene-office", "scene-room");

    const commuting = day.stage === "commute";

    const g = this.add.graphics();

    /* ---------- sky ---------- */
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyLow, C.skyLow, 1);
    g.fillRect(0, 0, W, 260);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(180, 42, 22);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(206, 50, 26);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(236, 42, 20);

    /* ---------- distant KL skyline (baseline 170) ---------- */
    g.fillStyle(C.towerLight, 0.85);
    for (let i = 0; i < 14; i++) {
      const bw = 42 + (i % 3) * 14;
      const bh = 58 + ((i * 37) % 78);
      g.fillRect(i * 72 - 10, 170 - bh, bw, bh);
    }
    g.fillStyle(C.tower, 0.5);
    for (let i = 0; i < 14; i++) {
      const bw = 42 + (i % 3) * 14;
      const bh = 58 + ((i * 37) % 78);
      for (let wy = 170 - bh + 12; wy < 162; wy += 16) g.fillRect(i * 72 - 4, wy, bw - 8, 4);
    }

    // Merdeka 118
    g.fillStyle(0x6f97a8, 0.95);
    g.fillTriangle(540, 38, 522, 170, 578, 170);
    g.fillRect(545, 24, 6, 18);
    // Petronas Twin Towers (stepped shafts + spires + skybridge)
    for (const tx of [186, 242]) {
      g.fillStyle(0x6f97a8, 0.98);
      g.fillRect(tx, 72, 22, 98);
      g.fillRect(tx + 4, 52, 14, 22);
      g.fillTriangle(tx + 11, 28, tx + 3, 52, tx + 19, 52);
      g.fillRect(tx + 10, 14, 2, 16);
      g.fillStyle(0xcfe4e4, 0.85);
      for (let y = 80; y < 164; y += 9) g.fillRect(tx + 2, y, 18, 2);
      g.fillStyle(0x8fb4c0, 0.9);
      for (let y = 76; y < 168; y += 9) g.fillRect(tx + 8, y, 6, 3);
    }
    g.fillStyle(0x5f8b9d, 1); g.fillRect(208, 118, 34, 5);
    // KL Tower (shaft, bulb, crown ring, antenna)
    g.fillStyle(0x6f97a8, 0.98);
    g.fillRect(788, 118, 12, 52);
    g.fillCircle(794, 108, 17);
    g.fillRect(784, 96, 20, 5);
    g.fillRect(792, 52, 3, 46);
    g.fillStyle(0xcfe4e4, 0.8); g.fillRect(778, 106, 32, 3);
    // Exchange 106 crown
    g.fillStyle(0x6f97a8, 0.9);
    g.fillTriangle(654, 48, 636, 170, 672, 170);

    /* ---------- elevated LRT viaduct ---------- */
    g.fillStyle(0xd9d2c2, 1);
    for (const px of [70, 230, 390, 550, 710, 870]) g.fillRect(px, 194, 24, 60);
    g.fillStyle(0xcfc7b6, 1); g.fillRect(0, 170, W, 24);
    g.fillStyle(0xbdb5a3, 1); g.fillRect(0, 170, W, 4);
    g.fillStyle(0xa89f8d, 1); g.fillRect(0, 188, W, 3);

    /* ---------- low shophouses (tops under the viaduct) ---------- */
    this.drawHome(g, DOORS[0].x);
    this.drawCafe(g, DOORS[1].x);
    this.drawStation(g, DOORS[2].x);

    /* ---------- street ---------- */
    g.fillStyle(C.walk, 1); g.fillRect(0, 342, W, 100);
    g.fillStyle(C.tile, 1);
    for (let x = 0; x < W; x += 56) g.fillRect(x, 342, 2, 100);
    for (let y = 360; y < 440; y += 34) g.fillRect(0, y, W, 1);
    g.fillStyle(C.curb, 1); g.fillRect(0, 440, W, 10);
    g.fillStyle(C.road, 1); g.fillRect(0, 450, W, 106);
    g.fillStyle(C.roadLine, 0.9);
    for (let x = 12; x < W; x += 84) g.fillRect(x, 498, 44, 5);
    // zebra crossing by the station
    g.fillStyle(C.roadLine, 0.85);
    for (let i = 0; i < 6; i++) g.fillRect(500 + i * 16, 456, 9, 94);
    g.fillStyle(C.lower, 1); g.fillRect(0, 556, W, 44);

    /* ---------- greenery & street props ---------- */
    for (const px of [60, 300, 468, 668, 924]) this.palm(g, px);
    for (const lx of [204, 470, 636]) {
      g.fillStyle(C.teal, 1); g.fillRect(lx - 2, 252, 4, 92);
      g.fillStyle(C.gold, 1); g.fillCircle(lx, 250, 7);
      g.fillStyle(C.gold, 0.2); g.fillCircle(lx, 250, 20);
    }
    // satay stall on the lower walk
    g.fillStyle(0xf7efe2, 1); g.fillRect(830, 566, 90, 30);
    g.fillStyle(C.orange, 1); g.fillRect(820, 552, 110, 10);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 5; i++) g.fillRect(824 + i * 22, 552, 10, 10);
    // planters with flowers
    for (const fx of [92, 420, 932]) {
      g.fillStyle(0xb98a66, 1); g.fillRect(fx - 22, 574, 44, 18);
      g.fillStyle(C.green, 1); g.fillCircle(fx - 10, 570, 9);
      g.fillStyle(C.green2, 1); g.fillCircle(fx + 8, 568, 10);
      g.fillStyle(0xf29ec4, 1);
      g.fillCircle(fx - 14, 562, 3); g.fillCircle(fx + 4, 558, 3); g.fillCircle(fx + 14, 566, 3);
    }

    /* ---------- office tower (own layer, in front of the rail) ---------- */
    const og = this.add.graphics().setDepth(4);
    this.drawOffice(og, DOORS[3].x);

    /* ---------- signs ---------- */
    this.sign(140, 262, "HOME", C.navy);
    this.sign(360, 262, "COFFEE SHOP", C.red);
    this.sign(580, 262, "LRT STATION", C.teal);
    this.sign(800, 262, "ABC TOWER", C.gold2);

    this.train = this.makeTrain();
    this.clouds = [
      this.add.ellipse(420, 28, 96, 24, 0xffffff, 0.7),
      this.add.ellipse(700, 52, 120, 26, 0xffffff, 0.6),
      this.add.ellipse(60, 64, 80, 20, 0xffffff, 0.5)
    ];

    this.player = this.add.image(commuting ? 140 : 800, this.baseY, charTextureKey(current.characterId))
      .setOrigin(0.5, 1).setDisplaySize(44, 66).setDepth(10);

    // the morning objective: a bouncing marker over the tower entrance
    if (commuting) {
      const arrow = this.add.triangle(DOORS[3].x, 246, 0, 22, 18, 0, 36, 22, C.gold).setDepth(6);
      this.tweens.add({ targets: arrow, y: 262, duration: 650, yoyo: true, repeat: -1, ease: "sine.inOut" });
      this.add.text(DOORS[3].x, 222, "CLOCK IN", {
        fontFamily: '"Pricedown", "Trebuchet MS", sans-serif', fontSize: "13px",
        color: "#16324a", backgroundColor: "#f7e3b4", padding: { x: 7, y: 2 }
      }).setOrigin(0.5).setDepth(6);
    }

    this.walker = new Walker(this);
    this.input.keyboard!.on("keydown-E", () => this.enter());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.target = {
        x: Phaser.Math.Clamp(p.worldX, 30, W - 30),
        y: Phaser.Math.Clamp(p.worldY, 352, 432)
      };
    });

    document.getElementById("hud-action")!.onclick = () => this.enter();
    document.getElementById("hud")!.classList.add("on");
    setGoal(commuting ? "GOAL · Walk to ABC TOWER →" : "GOAL · Clock out at home 🏠");
    toast(commuting
      ? "Hold W / ↑ to walk · tap it to brisk-walk · hold 1 or / to run to the tower."
      : "Back on Maple Street — the tower is right, home is left.",
      3400);
    this.cameras.main.fadeIn(200, 8, 28, 36);
    this.updateHud(true);
  }

  /* ------------------------------------------------------------------ */

  private drawHome(g: Phaser.GameObjects.Graphics, x: number) {
    const bx = x - 100;
    g.fillStyle(C.cream, 1); g.fillRect(bx, 246, 200, 96);
    g.fillStyle(0x8a4d3f, 1); g.fillRect(bx, 246, 200, 6);
    // signboard band
    g.fillStyle(C.navy, 1); g.fillRect(bx + 26, 252, 148, 22);
    g.fillStyle(C.gold, 1); g.fillRect(bx + 26, 252, 148, 2);
    // green-striped awning
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 ? 0xffffff : C.green, 1);
      g.fillRect(bx + 18 + i * 24, 278, 24, 12);
    }
    g.fillStyle(0x6b4a2f, 1); g.fillRect(x - 24, 296, 48, 46);
    g.fillStyle(C.glass, 1); g.fillRect(x - 16, 304, 32, 28);
    g.fillStyle(C.glass, 1); g.fillRect(bx + 24, 300, 34, 26);
    g.fillStyle(C.glass, 1); g.fillRect(bx + 142, 300, 34, 26);
  }

  private drawCafe(g: Phaser.GameObjects.Graphics, x: number) {
    const bx = x - 100;
    g.fillStyle(C.cream2, 1); g.fillRect(bx, 246, 200, 96);
    g.fillStyle(0x4e7d5b, 1); g.fillRect(bx, 246, 200, 6);
    g.fillStyle(C.red, 1); g.fillRect(bx + 26, 252, 148, 22);
    g.fillStyle(0xffffff, 1); g.fillRect(bx + 26, 252, 148, 2);
    // red/white awning
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 ? 0xffffff : C.red, 1);
      g.fillRect(bx + 18 + i * 24, 278, 24, 12);
    }
    g.fillStyle(0x6b5138, 1); g.fillRect(x - 24, 296, 48, 46);
    g.fillStyle(C.glass, 1); g.fillRect(x - 16, 304, 32, 28);
    // tables on the walk
    g.fillStyle(0xffffff, 1);
    g.fillCircle(bx + 32, 392, 13); g.fillCircle(bx + 168, 392, 13);
    g.fillStyle(0x9c7b5f, 1); g.fillRect(bx + 30, 400, 4, 18); g.fillRect(bx + 166, 400, 4, 18);
    g.fillStyle(C.red, 1); g.fillCircle(bx + 32, 388, 4); g.fillCircle(bx + 168, 388, 4);
  }

  private drawStation(g: Phaser.GameObjects.Graphics, x: number) {
    const bx = x - 100;
    g.fillStyle(0xe8f4f2, 1); g.fillRect(bx, 246, 200, 96);
    g.fillStyle(C.teal, 1); g.fillRect(bx + 26, 252, 148, 22);
    g.fillStyle(0xffffff, 1); g.fillRect(bx + 26, 252, 148, 2);
    g.fillStyle(C.glass, 1); g.fillRect(bx + 24, 280, 152, 16);
    g.lineStyle(2, 0x8fb3b1, 1); g.strokeRect(bx + 24, 280, 152, 16);
    g.fillStyle(0x2b3038, 1); g.fillRect(x - 24, 300, 48, 42);
    g.fillStyle(C.gold, 1); g.fillRect(x - 24, 296, 48, 4);
  }

  private drawOffice(g: Phaser.GameObjects.Graphics, x: number) {
    const bx = x - 90;
    g.fillStyle(C.glass, 1); g.fillRect(bx, 62, 180, 280);
    g.fillStyle(C.glassLine, 1);
    for (let wy = 70; wy < 336; wy += 16) g.fillRect(bx, wy, 180, 2);
    for (let wx = bx + 20; wx < bx + 180; wx += 28) g.fillRect(wx, 62, 2, 280);
    g.fillStyle(0xffffff, 0.55);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 4; c++) {
      if ((r + c) % 3 === 0) g.fillRect(bx + 8 + c * 42, 74 + r * 24, 30, 13);
    }
    // gold entrance
    g.fillStyle(C.gold, 1); g.fillRect(x - 34, 288, 68, 54);
    g.fillStyle(C.navy, 1); g.fillRect(x - 26, 294, 52, 48);
    g.fillStyle(C.gold, 1); g.fillRect(x - 2, 294, 4, 48);
  }

  private sign(x: number, y: number, text: string, color: number) {
    this.add.text(x, y, text, {
      fontFamily: '"Pricedown", "Trebuchet MS", sans-serif',
      fontSize: "12px", color: "#ffffff",
      backgroundColor: "#" + color.toString(16).padStart(6, "0"),
      padding: { x: 6, y: 2 }
    }).setOrigin(0.5).setDepth(5);
  }

  private palm(g: Phaser.GameObjects.Graphics, x: number) {
    g.fillStyle(C.trunk, 1);
    g.fillRect(x - 3, 296, 6, 50);
    g.fillStyle(C.green, 1);
    g.fillTriangle(x, 296, x - 34, 282, x - 8, 292);
    g.fillTriangle(x, 296, x + 34, 282, x + 8, 292);
    g.fillStyle(C.green2, 1);
    g.fillTriangle(x, 294, x - 24, 264, x - 2, 288);
    g.fillTriangle(x, 294, x + 24, 264, x + 2, 288);
    g.fillStyle(0x3f8a45, 1);
    g.fillTriangle(x, 292, x - 5, 258, x + 7, 286);
    g.fillStyle(0x8d6b4a, 1); g.fillCircle(x, 296, 4);
  }

  private makeTrain() {
    const body = this.add.rectangle(0, 0, 150, 28, 0xf4f6f5).setStrokeStyle(2, 0xa9b3b3);
    const stripe = this.add.rectangle(0, 4, 150, 6, C.red);
    const stripe2 = this.add.rectangle(0, 10, 150, 3, 0x3d6e8f);
    const win = this.add.rectangle(0, -4, 118, 10, 0x3d6e8f);
    const lights = this.add.rectangle(62, 2, 12, 8, 0xfff2b0);
    const cab = this.add.rectangle(-70, 0, 10, 24, C.navy);
    const c = this.add.container(W + 180, 156, [body, stripe, stripe2, win, lights, cab]).setDepth(3);
    return c;
  }

  /* ------------------------------------------------------------------ */

  private enter() {
    if (!this.near || !current) return;
    const id = this.near.id;
    if (id === "office") { audio.click(); this.go("Lobby"); return; }
    if (id === "home") {
      if (day.stage === "commute") {
        audio.deny();
        toast("You haven't clocked in yet — ABC Tower is to the right.");
        return;
      }
      audio.click();
      clockOut();
      return;
    }
    audio.deny();
    if (id === "cafe") toast("The office pantry has free coffee — keep walking.");
    else if (id === "station") toast("No LRT today. The tower is a short walk to the right.");
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
      else { vx = dx / dist; vy = dy / dist; speed = 175; mode = "walk"; }
    }

    const moving = !!(vx || vy);
    if (moving) {
      const len = Math.hypot(vx, vy) || 1;
      this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * speed * dt, 30, W - 30);
      this.baseY = Phaser.Math.Clamp(this.baseY + (vy / len) * speed * dt, 352, 432);
      if (vx) this.facing = vx > 0 ? 1 : -1;
    }
    this.player.setFlipX(this.facing < 0);
    const bob = mode === "run" ? 45 : mode === "brisk" ? 58 : 70;
    this.player.y = this.baseY + (moving ? Math.sin(time / bob) * 1.5 : 0);
    setSpeed(WALK_LABEL[mode]);

    // LRT glides past
    this.train.x -= 42 * dt;
    if (this.train.x < -200) this.train.x = W + 200;
    for (const cl of this.clouds) {
      cl.x += 5 * dt;
      if (cl.x > W + 80) cl.x = -80;
    }

    this.near = DOORS.find(d => Math.abs(d.x - this.player.x) < d.r) ?? null;
    const action = document.getElementById("hud-action")!;
    if (this.near) { action.textContent = this.nearLabel() + "  (E)"; action.classList.add("on"); }
    else action.classList.remove("on");

    this.updateHud(false);
    this.drawMinimap();
  }

  private nearLabel(): string {
    const d = this.near!;
    if (d.id === "office") return day.stage === "commute" ? "🏢 Clock in at ABC TOWER" : "🏢 Back into ABC TOWER";
    if (d.id === "home") return day.stage === "commute" ? "🏠 Home — clock in first" : "🏠 Go home — clock out";
    return d.label;
  }

  private updateHud(force: boolean) {
    // real-time world clock drives the HUD
    const clock = fmtTime(new Date(), true);
    if (force || clock !== this.lastClock) {
      this.lastClock = clock;
      document.getElementById("hud-clock")!.textContent = clock;
    }
    document.getElementById("hud-money")!.textContent = "$" + String(current!.money).padStart(8, "0");
    document.getElementById("hud-energy")!.textContent = "♥ " + Math.round(day.energy);
    document.getElementById("hud-left")!.textContent = `${fmtDate()} · MAPLE STREET`;
  }

  private drawMinimap() {
    const c = document.getElementById("minimap") as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#cfe0dc";
    ctx.fillRect(8, 22, c.width - 16, 6);
    const colors: Record<string, string> = { home: "#c9922f", cafe: "#d6544a", station: "#2e8f88", office: "#16324a" };
    for (const d of DOORS) {
      ctx.fillStyle = colors[d.id];
      ctx.fillRect(8 + (d.x / W) * (c.width - 16) - 2, 16, 5, 14);
    }
    ctx.fillStyle = "#e3b45c";
    ctx.beginPath();
    ctx.arc(8 + (this.player.x / W) * (c.width - 16), 25, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#16324a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
