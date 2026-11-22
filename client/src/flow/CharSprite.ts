import Phaser from "phaser";
import { charById } from "./characters";
import type { WalkDir, WalkMode } from "./walk";

/**
 * Sprite-sheet walking animation for the isometric places.
 *
 * The character art we were given is a single static pose — it has no walking
 * frames — so the animation is driven by a generated placeholder sheet per
 * character (see tools/build_walk_sheets.py). The sheet layout is the contract:
 *
 *   4 rows  (down / up / left / right)  x  6 columns
 *   columns: [idle0, idle1, walk0, walk1, walk2, walk3]
 *
 * This module owns nothing about WHERE a body may stand or HOW fast it moves —
 * it only turns a movement vector into the right clip at the right rate. When a
 * hand-animated sheet in the same layout is dropped over the placeholder file,
 * every clip here picks it up with no code change: that is the swap-in path.
 */

export const SHEET_COLS = 6;
export const SHEET_ROWS: WalkDir[] = ["down", "up", "left", "right"];
export const FRAME_W = 64;   // 16 art px x SCALE 4
export const FRAME_H = 96;   // 24 art px x SCALE 4

const IDLE_FPS = 2.2;
const WALK_FPS = 7.5;

/** texture key a character's walk sheet is loaded under */
export function charWalkKey(id?: string): string {
  return `walk_${charById(id).id}`;
}

const frameIndex = (dir: WalkDir, col: number): number =>
  SHEET_ROWS.indexOf(dir) * SHEET_COLS + col;

/** ids that have a generated sheet; set once from the roster at boot */
let ALL_CHAR_IDS: string[] = [];
export function registerWalkSheets(ids: string[]): void {
  ALL_CHAR_IDS = ids;
}

/**
 * Build the idle + walk clips for one loaded sheet. Idempotent: a texture only
 * ever gets its animations once, so re-entering a scene never duplicates them.
 */
export function ensureWalkAnims(scene: Phaser.Scene): void {
  const key = charWalkKey;
  for (const c of ALL_CHAR_IDS) {
    const tex = key(c);
    if (scene.anims.exists(`${tex}_down_idle`) || !scene.textures.exists(tex)) continue;
    for (const dir of SHEET_ROWS) {
      scene.anims.create({
        key: `${tex}_${dir}_idle`,
        frames: [frameIndex(dir, 0), frameIndex(dir, 1)].map((i) => ({ key: tex, frame: i })),
        frameRate: IDLE_FPS,
        repeat: -1
      });
      scene.anims.create({
        key: `${tex}_${dir}_walk`,
        frames: [2, 3, 4, 5].map((col) => ({ key: tex, frame: frameIndex(dir, col) })),
        frameRate: WALK_FPS,
        repeat: -1
      });
    }
  }
}

/**
 * One animated body. Wrap it around a Phaser sprite and feed it the movement
 * state every frame; it keeps the clip stable so direction changes never
 * flicker, and scales the stride to how fast the character is actually going.
 */
export class CharSprite {
  private playing: string | null = null;
  /** held so a mid-stride stop settles into idle without a snap-back */
  private lastDir: WalkDir = "down";
  private id: string;

  constructor(readonly sprite: Phaser.GameObjects.Sprite, id: string) {
    this.id = id;
    // start on the idle clip so the very first frame is not a blank sheet cell
    this.sprite.anims.play(`${charWalkKey(id)}_down_idle`, true);
  }

  /**
   * @param dir   the dominant facing from the walker
   * @param moving whether a step is being taken this frame
   * @param mode  idle / walk / brisk / run — drives the stride rate
   */
  setState(dir: WalkDir, moving: boolean, mode: WalkMode): void {
    // only re-aim the body when it is actually going somewhere, so releasing
    // the keys keeps the last facing instead of snapping back to "down"
    if (moving) this.lastDir = dir;
    const use = this.lastDir;
    const clip = `${charWalkKey(this.id)}_${use}_${moving ? "walk" : "idle"}`;

    if (clip !== this.playing) {
      this.playing = clip;
      this.sprite.anims.play(clip, true);
    }
    // animation speed tracks movement speed; idle keeps its calm breathing
    const rate = mode === "run" ? 1.7 : mode === "brisk" ? 1.32 : 1;
    this.sprite.anims.timeScale = moving ? rate : 1;
  }

  /** point the sheet at a character (used when a shared sprite changes body) */
  setCharacter(id: string): void {
    this.id = id;
    this.playing = null;
  }
}
