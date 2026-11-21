import Phaser from "phaser";
import { pulseSprite } from "../flow/characters";

/**
 * GAME REGISTRY (client side)
 * ---------------------------
 * This is the "space" for future mini-games.
 * To add a new game:
 *   1. Add a GameTheme object below and register it in THEMES.
 *   2. Add a matching config entry in server/src/games/registry.ts.
 * The menu button, race lane rendering and results all pick it up automatically.
 * The shared RaceScene handles networking, bars, countdown and podium.
 */

export const GOAL = 100;
export const BAR_X = 300;
export const BAR_W = 560;

export interface Lane {
  sid: string;
  baseY: number;
  nameText: Phaser.GameObjects.Text;
  avatar: Phaser.GameObjects.Image;
  barFill: Phaser.GameObjects.Rectangle;
  pctText: Phaser.GameObjects.Text;
  rankText: Phaser.GameObjects.Text;
  /** smoothed progress 0..100 for rendering */
  display: number;
  lastProgress: number;
  lastAdvance: number;
  /** theme-specific objects (e.g. the coffee mug) */
  extra?: Phaser.GameObjects.Graphics;
}

export interface GameTheme {
  menuLabel: string;
  menuDesc: string;
  title: string;
  subtitle: string;
  /** one-time scene decoration (track endpoints, props, ...) */
  decorate(scene: Phaser.Scene): void;
  /** theme-specific setup for a player lane */
  setupLane(scene: Phaser.Scene, lane: Lane): void;
  /** per-frame theme rendering (avatar, props) */
  updateLane(lane: Lane, player: any, time: number): void;
}

/* ------------------------------------------------------------------ */
/* ☕ Coffee Chug — first to finish drinking wins                      */
/* ------------------------------------------------------------------ */
const CoffeeTheme: GameTheme = {
  menuLabel: "☕ Coffee Chug",
  menuDesc: "First to finish the coffee wins",
  title: "☕ COFFEE CHUG",
  subtitle: "Mash to drink your coffee before everyone else!",

  decorate() { /* no extra props */ },

  setupLane(scene, lane) {
    lane.avatar.setPosition(165, lane.baseY - 6);
    lane.extra = scene.add.graphics();
  },

  updateLane(lane, player, time) {
    if (player.finished) pulseSprite(lane.avatar, 1 + Math.sin(time / 120) * 0.06);
    const g = lane.extra!;
    const x = 210, y = lane.baseY;
    const level = 42 * (1 - lane.display / GOAL);
    g.clear();
    g.fillStyle(0xf7efe2);
    g.fillRect(x + 2, y - 21, 32, 42);
    g.fillStyle(0x6f4e37);
    g.fillRect(x + 3, y + 21 - level, 30, level);
    g.lineStyle(3, 0x16324a);
    g.strokeRect(x, y - 24, 36, 48);
    g.strokeCircle(x + 42, y, 8);
  }
};

/* ------------------------------------------------------------------ */
/* 🏃 Station Dash — first to reach the office wins                    */
/* ------------------------------------------------------------------ */
const WalkTheme: GameTheme = {
  menuLabel: "🏃 Station Dash",
  menuDesc: "First to reach the office wins",
  title: "🏃 STATION DASH",
  subtitle: "Mash to run from the station to the office!",

  decorate(scene) {
    scene.add.text(BAR_X - 45, 120, "🚉", { fontSize: "36px" }).setOrigin(0.5);
    scene.add.text(BAR_X + BAR_W + 45, 120, "🏢", { fontSize: "36px" }).setOrigin(0.5);
  },

  setupLane(_scene, lane) {
    lane.avatar.setPosition(BAR_X, lane.baseY - 6);
  },

  updateLane(lane, player, time) {
    const running = time - lane.lastAdvance < 300 && !player.finished;
    lane.avatar.x = BAR_X + BAR_W * (lane.display / GOAL);
    lane.avatar.y = lane.baseY - 6 + (running ? Math.sin(time / 70) * 3 : 0);
    lane.avatar.rotation = running ? 0.12 : 0;
    if (player.finished) pulseSprite(lane.avatar, 1 + Math.sin(time / 120) * 0.06);
  }
};

/* ------------------------------------------------------------------ */
/* Register new games here (key must match server GAMES key)           */
/* ------------------------------------------------------------------ */
export const THEMES: Record<string, GameTheme> = {
  coffee: CoffeeTheme,
  walk: WalkTheme
};