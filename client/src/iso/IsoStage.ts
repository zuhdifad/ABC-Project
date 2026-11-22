import Phaser from "phaser";
import { circleClear, slideMove } from "./geometry";
import type { IsoPlace, Pt } from "./types";

/**
 * Renders one painted isometric place and owns its walk mask.
 *
 * The image is the world: no tile projection, no camera. The stage only knows
 * how to turn image pixels into screen pixels, which parts of the floor accept
 * a body, and which slices of the art should cover the player.
 */
export class IsoStage {
  readonly scale: number;
  readonly ox: number;
  readonly oy: number;

  private occluders: Array<{ img: Phaser.GameObjects.Image; baseY: number }> = [];
  private debug?: Phaser.GameObjects.Graphics;
  private debugOn = false;

  constructor(private scene: Phaser.Scene, readonly place: IsoPlace) {
    const { width: sw, height: sh } = scene.scale;
    this.scale = Math.min(sw / place.width, sh / place.height);
    this.ox = Math.round((sw - place.width * this.scale) / 2);
    this.oy = Math.round((sh - place.height * this.scale) / 2);

    scene.add.image(this.ox, this.oy, place.texture)
      .setOrigin(0).setScale(this.scale).setDepth(0);

    for (const o of place.occluders ?? []) {
      // a second copy of the painting, clipped to the prop: it sits above the
      // player so walking behind the thing looks right
      const img = scene.add.image(this.ox, this.oy, place.texture)
        .setOrigin(0).setScale(this.scale).setDepth(30).setVisible(false);
      const shape = scene.add.graphics().setVisible(false);
      shape.fillStyle(0xffffff, 1).fillPoints(
        o.points.map(([x, y]) => new Phaser.Geom.Point(this.ox + x * this.scale, this.oy + y * this.scale)),
        true
      );
      img.setMask(shape.createGeometryMask());
      this.occluders.push({ img, baseY: o.baseY });
    }
  }

  /* ---------------- coordinates ---------------- */

  toScreen(x: number, y: number): Pt {
    return [this.ox + x * this.scale, this.oy + y * this.scale];
  }

  toWorld(sx: number, sy: number): Pt {
    return [(sx - this.ox) / this.scale, (sy - this.oy) / this.scale];
  }

  /* ---------------- collision ---------------- */

  clear(x: number, y: number, r: number): boolean {
    return circleClear(x, y, r, this.place.floor, this.place.solids);
  }

  move(x: number, y: number, dx: number, dy: number, r: number): Pt {
    return slideMove(x, y, dx, dy, r, this.place.floor, this.place.solids);
  }

  /** Show/hide the slices that live in front of the player. */
  updateOccluders(feetY: number) {
    for (const o of this.occluders) o.img.setVisible(feetY < o.baseY);
  }

  /* ---------------- authoring aid ---------------- */

  /** Backquote in dev: floor, solids and portals drawn on top of the art. */
  toggleDebug(portals: Array<{ x: number; y: number; r: number }> = []) {
    if (!this.debug) {
      const g = this.scene.add.graphics().setDepth(50);
      this.debug = g;

      const poly = (pts: Pt[], color: number, width: number, alpha = 1) => {
        g.lineStyle(width, color, alpha);
        g.beginPath();
        pts.forEach(([x, y], i) => {
          const [sx, sy] = this.toScreen(x, y);
          if (i === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
        });
        g.closePath();
        g.strokePath();
      };

      poly(this.place.floor, 0x35e0c8, 2);
      for (const s of this.place.solids) poly(s.points, 0xff4d4d, 2, 0.9);
      for (const p of portals) {
        const [sx, sy] = this.toScreen(p.x, p.y);
        g.lineStyle(2, 0xffd166, 0.9).strokeCircle(sx, sy, p.r * this.scale);
      }
    }
    this.debugOn = !this.debugOn;
    this.debug.setVisible(this.debugOn);
  }
}
