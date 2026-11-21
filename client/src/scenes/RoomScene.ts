import Phaser from "phaser";
import type { Room } from "colyseus.js";
import { current, day, fmtDate, fmtTime, addLog, saveProfile } from "../flow/profile";
import { CHARACTERS, charById, charTextureKey, sizeSprite } from "../flow/characters";
import { audio } from "../flow/audio";
import { toast, setGoal, setSpeed } from "../flow/screens";
import { Walker, WALK_LABEL } from "../flow/walk";
import { openActivity } from "../menu";

const W = 960, H = 600;

const P = {
  wall: 0xf1e9d8, wall2: 0xe8f2ee, floor: 0xe3ebe4, tile: 0xd2ded6,
  navy: 0x16324a, gold: 0xe3b45c, gold2: 0xc9922f, teal: 0x2e8f88,
  cream: 0xf7efe2, glass: 0xcfe8e4, deep: 0x0e2436, green: 0x4fae4e,
  wood: 0xb98a66, red: 0xd6544a
};

const ZONES = [
  { id: "door", x: 104 },
  { id: "friend", x: 252 },
  { id: "seat", x: 470 },
  { id: "coffee", x: 788 }
] as const;
type ZoneId = (typeof ZONES)[number]["id"];

const CHAT = [
  "“Deadline moved to 4pm. Classic.”",
  "“The pantry coffee is strong today.”",
  "“Did you see the LRT was packed?”",
  "“Lunch at the kopitiam downstairs?”",
  "“Boss is walking around… look busy.”"
];

export class RoomScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private baseY = 480;
  private walker!: Walker;
  private near: ZoneId | null = null;
  private facing = 1;
  private seated = false;
  private target: { x: number; y: number } | null = null;
  private lastClock = "";
  private lastWorkAt = 0;
  private friendId = "danial";
  private friendSprite!: Phaser.GameObjects.Image;
  private chugTarget = false;

  constructor() { super("Room"); }

  create() {
    if (!current) return;
    this.near = null;
    this.target = null;
    this.baseY = 480;
    this.facing = 1;
    this.seated = false;
    this.lastClock = "";
    this.lastWorkAt = 0;
    this.chugTarget = false;
    document.body.classList.add("scene-room");
    document.body.classList.remove("scene-city", "scene-office", "scene-race");

    if (day.stage === "office") day.stage = "room";

    this.friendId = (CHARACTERS.find(c => c.id !== current!.characterId) ?? CHARACTERS[0]).id;
    this.buildWorld();

    this.player = sizeSprite(
      this.add.image(150, this.baseY, charTextureKey(current.characterId)), 66
    ).setOrigin(0.5, 1).setDepth(10);

    this.walker = new Walker(this);
    this.input.keyboard!.on("keydown-E", () => this.interact());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.seated) return;
      // clicks on the coworker are their own action (challenge to a chug)
      if (this.friendSprite.getBounds().contains(p.worldX, p.worldY)) return;
      this.target = { x: Phaser.Math.Clamp(p.worldX, 50, W - 50), y: Phaser.Math.Clamp(p.worldY, 440, 545) };
    });

    document.getElementById("hud-action")!.onclick = () => this.interact();
    document.getElementById("hud")!.classList.add("on");
    setGoal("GOAL · Walk to your desk and sit down");
    toast("Your desk is in the middle. Click a colleague to challenge them to a coffee chug.", 3800);

    this.cameras.main.fadeIn(220, 8, 28, 36);
    this.updateHud();
  }

  /* ------------------------------------------------------------------ */

  private buildWorld() {
    const role = charById(current!.characterId).role;
    const g = this.add.graphics();

    /* ceiling + wall */
    g.fillStyle(0xfdfaf2, 1); g.fillRect(0, 0, W, 56);
    g.fillStyle(0xe7dcc4, 1); g.fillRect(0, 52, W, 5);
    for (const lx of [220, 520, 780]) {
      g.fillStyle(0xfff6d8, 1); g.fillRect(lx - 44, 13, 88, 10);
      g.fillStyle(0xe9dfc2, 1); g.fillRect(lx - 50, 23, 100, 3);
    }
    g.fillStyle(P.wall, 1); g.fillRect(0, 58, W, 300);
    g.fillStyle(P.wall2, 1); g.fillRect(0, 322, W, 36);
    g.fillStyle(P.gold, 1); g.fillRect(0, 318, W, 4);

    /* floor */
    g.fillStyle(P.floor, 1); g.fillRect(0, 358, W, H - 358);
    g.fillStyle(P.tile, 1);
    for (let x = -40; x < W + 100; x += 110) g.fillRect(x, 358, 3, H - 358);
    for (const y of [398, 460, 532]) g.fillRect(0, y, W, 3);

    /* window with a KL view */
    g.fillStyle(P.navy, 1); g.fillRect(600, 92, 320, 214);
    g.fillStyle(0xd9f0ec, 1); g.fillRect(608, 100, 304, 166);
    g.fillStyle(0xa8d8d2, 1); g.fillRect(608, 190, 304, 76);
    g.fillStyle(0x6f97a8, 1);
    for (let i = 0; i < 9; i++) {
      const bx = 616 + i * 34, bh = 40 + ((i * 29) % 70);
      g.fillRect(bx, 266 - bh, 22, bh);
    }
    g.fillTriangle(700, 150, 690, 212, 712, 212);
    g.fillRect(728, 176, 8, 36); g.fillCircle(732, 170, 9); g.fillRect(730, 148, 3, 22);
    g.fillStyle(P.gold, 1); g.fillRect(600, 84, 320, 10); g.fillRect(600, 298, 320, 8);
    g.fillStyle(P.navy, 0.7); g.fillRect(756, 100, 4, 200);

    /* wall clock */
    g.fillStyle(0xffffff, 1); g.fillCircle(330, 140, 24);
    g.lineStyle(3, P.navy, 1); g.strokeCircle(330, 140, 24);
    g.lineStyle(3, P.navy, 1); g.lineBetween(330, 140, 330, 124); g.lineBetween(330, 140, 342, 148);

    /* left door back to the lobby */
    g.fillStyle(P.navy, 1); g.fillRect(56, 140, 96, 216);
    g.fillStyle(P.glass, 1); g.fillRect(66, 152, 76, 110);
    g.fillStyle(P.gold, 1); g.fillRect(50, 132, 108, 10);
    g.fillStyle(P.gold, 1); g.fillRect(140, 268, 6, 12);
    this.plaque(104, 116, "← LOBBY", P.teal);

    /* coworker — click them to challenge a coffee chug */
    this.friendSprite = sizeSprite(
      this.add.image(252, 360, charTextureKey(this.friendId)), 62
    ).setOrigin(0.5, 1).setDepth(4)
      .setInteractive({ useHandCursor: true });
    this.friendSprite.on("pointerover", () => this.friendSprite.setTint(0xfff3cf));
    this.friendSprite.on("pointerout", () => this.friendSprite.clearTint());
    this.friendSprite.on("pointerdown", () => this.challenge());
    this.plaque(252, 272, charById(this.friendId).name.toUpperCase(), P.navy);
    const chugHint = this.add.text(252, 246, "☕ CLICK TO CHUG", {
      fontFamily: '"Pricedown", "Trebuchet MS", sans-serif',
      fontSize: "12px", color: "#ffffff",
      backgroundColor: "#d6544a", padding: { x: 7, y: 2 }
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: chugHint, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 })

    /* your desk */
    g.fillStyle(0x8d6b4a, 1); g.fillRect(404, 392, 8, 62); g.fillRect(556, 392, 8, 62);
    g.fillStyle(P.cream, 1); g.fillRect(388, 352, 184, 44);
    g.fillStyle(P.gold2, 1); g.fillRect(388, 392, 184, 5);
    // laptop
    g.fillStyle(0x2b3b45, 1); g.fillRect(486, 312, 62, 40);
    g.fillStyle(0x9fe6dd, 1); g.fillRect(490, 316, 54, 32);
    g.fillStyle(0xcfd8d8, 1); g.fillRect(478, 352, 78, 6);
    // mug + papers
    g.fillStyle(0xffffff, 1); g.fillRect(414, 336, 18, 16);
    g.fillStyle(0x6f4e37, 1); g.fillRect(414, 336, 18, 4);
    g.fillStyle(0xffffff, 1); g.fillRect(540, 344, 26, 8);
    // chair
    g.fillStyle(P.teal, 1); g.fillRect(448, 396, 46, 54);
    g.fillStyle(0x237671, 1); g.fillRect(448, 396, 46, 8);
    g.fillStyle(0x2b3b45, 1); g.fillRect(468, 448, 6, 18); g.fillRect(454, 466, 34, 5);
    this.plaque(470, 296, "YOUR DESK", P.gold2);

    /* pantry counter + coffee machine */
    g.fillStyle(P.cream, 1); g.fillRect(704, 344, 200, 52);
    g.fillStyle(P.gold2, 1); g.fillRect(704, 392, 200, 5);
    g.fillStyle(0x8d6b4a, 1); g.fillRect(712, 396, 8, 58); g.fillRect(888, 396, 8, 58);
    g.fillStyle(P.navy, 1); g.fillRect(760, 282, 62, 64);
    g.fillStyle(0x9fe6dd, 1); g.fillRect(768, 290, 46, 14);
    g.fillStyle(P.red, 1); g.fillRect(772, 312, 10, 10); g.fillRect(788, 312, 10, 10);
    g.fillStyle(0xffffff, 1); g.fillRect(768, 330, 20, 12);
    g.fillStyle(0x6f4e37, 1); g.fillRect(768, 330, 20, 3);
    g.fillStyle(0xffffff, 0.65);
    g.fillCircle(778, 268, 5); g.fillCircle(790, 258, 4); g.fillCircle(802, 266, 5);
    // shelf of mugs
    g.fillStyle(P.wood, 1); g.fillRect(840, 300, 56, 4);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0xffffff, 1); g.fillRect(844 + i * 18, 286, 12, 14);
      g.fillStyle(P.teal, 0.8); g.fillRect(844 + i * 18, 286, 12, 4);
    }
    this.plaque(804, 364, "PANTRY · FREE COFFEE", P.red);

    /* plants */
    this.plant(g, 336, 344);
    this.plant(g, 930, 344);
  }

  private plant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(P.wood, 1); g.fillRect(x - 16, y, 32, 26);
    g.fillStyle(P.green, 1); g.fillCircle(x - 9, y - 6, 14);
    g.fillStyle(0x6fc95e, 1); g.fillCircle(x + 9, y - 10, 15);
    g.fillStyle(0x3f8a45, 1); g.fillCircle(x, y - 24, 12);
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

  private sit() {
    this.seated = true;
    this.player.x = 470;
    this.baseY = 470;
    this.player.y = this.baseY;
    sizeSprite(this.player, 60);
    if (day.stage === "room") day.stage = "seated";
    audio.chime();
    setGoal("GOAL · Coffee · laptop · chat — clock out at home when done");
    toast("Shift started. Press E to work on the laptop — or walk to stand up.", 4200);
    this.updateHud();
  }

  private stand() {
    this.seated = false;
    sizeSprite(this.player, 66);
    this.baseY = 480;
  }

  private interact() {
    if (!this.near || !current) return;
    switch (this.near) {
      case "door":
        audio.click();
        this.go("Lobby");
        return;
      case "seat":
        audio.click();
        if (!this.seated) this.sit();
        else this.work();
        return;
      case "coffee":
        audio.click();
        this.openCoffee();
        return;
      case "friend":
        this.chat();
        return;
    }
  }

  private work() {
    const now = this.time.now;
    if (now - this.lastWorkAt < 6000) { toast("The laptop needs a second to reload."); return; }
    if (day.energy < 12) { audio.deny(); toast("Too drained to work. Get a coffee first."); return; }
    this.lastWorkAt = now;
    day.energy = Math.max(0, day.energy - 8);
    addLog("💻 Laptop", "cleared a ticket", 25);
    saveProfile(current!);
    audio.chime();
    toast("💻 +$25 — one ticket closed.");
    this.updateHud();
  }

  private chat() {
    const line = CHAT[Math.floor(Math.random() * CHAT.length)];
    audio.click();
    day.energy = Math.min(100, day.energy + 3);
    addLog("💬 Chat", `with ${charById(this.friendId).name}`, 0);
    saveProfile(current!);
    toast(`${charById(this.friendId).name}: ${line}`);
    this.updateHud();
  }

  /** Clicking a colleague asks them to compete — this is what starts the chug. */
  private challenge() {
    if (!current) return;
    const name = charById(this.friendId).name;
    if (this.seated) this.stand();
    if (Math.abs(this.player.x - 252) > 60) {
      this.chugTarget = true;
      this.target = { x: 252, y: this.baseY };
      audio.click();
      toast(`Walking over to ${name}…`);
      return;
    }
    this.chugTarget = false;
    audio.click();
    toast(`${name}: “Loser buys lunch. Let's chug! ☕”`, 3000);
    this.openCoffee();
  }

  private openCoffee() {
    this.scene.pause();
    openActivity("coffee", current!.name, current!.characterId,
      (room: Room) => this.launchRace(room),
      () => this.scene.resume());
  }

  private launchRace(room: Room) {
    document.getElementById("hud")!.classList.remove("on");
    document.getElementById("hud-action")!.classList.remove("on");
    this.scene.start("Race", {
      room,
      onExit: (result?: { rank: number; progress: number }) => {
        this.applyCoffee(result);
        this.scene.stop("Race");
        this.scene.start("Room");
      }
    });
  }

  private applyCoffee(result?: { rank: number; progress: number }) {
    if (!current) return;
    if (!result) { addLog("☕ Coffee Chug", "left early", 0); saveProfile(current); return; }
    const money = result.rank === 1 ? 40 : 15;
    day.energy = Math.min(100, day.energy + 15);
    day.coffeeDone = true;
    if (result.rank === 1) current.wins++;
    addLog("☕ Coffee Chug", `rank #${result.rank} · +15 energy`, money);
    saveProfile(current);
    toast(result.rank === 1 ? "🏆 Won $40! Back at your desk." : "Earned $15. Back at your desk.");
  }

  private go(key: string) {
    this.target = null;
    this.chugTarget = false;
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
    if (this.seated && walk.moving) this.stand();

    let vx = walk.vx, vy = walk.vy, mode = walk.mode, speed = walk.speed;
    if (walk.moving) this.target = null;
    else if (this.target && !this.seated) {
      const dx = this.target.x - this.player.x, dy = this.target.y - this.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) this.target = null;
      else { vx = dx / dist; vy = dy / dist; speed = 170; mode = "walk"; }
    }

    const moving = !!(vx || vy) && !this.seated;
    if (moving) {
      const len = Math.hypot(vx, vy) || 1;
      this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * speed * dt, 50, W - 50);
      this.baseY = Phaser.Math.Clamp(this.baseY + (vy / len) * speed * dt, 440, 545);
      if (vx) this.facing = vx > 0 ? 1 : -1;
    }
    this.player.setFlipX(this.facing < 0);
    const bob = mode === "run" ? 45 : mode === "brisk" ? 58 : 70;
    this.player.y = this.baseY + (moving ? Math.sin(time / bob) * 1.4 : 0);
    setSpeed(this.seated ? "🪑 SEATED" : WALK_LABEL[mode]);

    // arriving at the colleague after a click-challenge opens the chug
    if (this.chugTarget && Math.abs(this.player.x - 252) < 52) {
      this.chugTarget = false;
      this.challenge();
      return;
    }

    this.near = ZONES.find(z => Math.abs(z.x - this.player.x) < 46)?.id ?? null;
    const action = document.getElementById("hud-action")!;
    if (this.near) {
      action.textContent = this.label(this.near);
      action.classList.add("on");
    } else action.classList.remove("on");

    this.updateHud();
  }

  private label(id: ZoneId): string {
    switch (id) {
      case "door": return "← Back to the lobby  (E)";
      case "seat": return this.seated ? "💻 Work on the laptop  (E)" : "🪑 Sit at your desk  (E)";
      case "coffee": return "☕ Coffee machine — start a Chug  (E)";
      case "friend": return `💬 Chat with ${charById(this.friendId).name}  (E) · ☕ click them to Chug`;
    }
  }

  private updateHud() {
    const clock = fmtTime(new Date(), true);
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      document.getElementById("hud-clock")!.textContent = clock;
    }
    document.getElementById("hud-money")!.textContent = "$" + String(current!.money).padStart(8, "0");
    document.getElementById("hud-energy")!.textContent = "♥ " + Math.round(day.energy);
    document.getElementById("hud-left")!.textContent =
      `${fmtDate()} · ABC TOWER · ${charById(current!.characterId).role.toUpperCase()}`;
  }
}
