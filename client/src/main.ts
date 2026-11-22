import Phaser from "phaser";
import { RaceScene } from "./scenes/RaceScene";
import { PlaceScene } from "./scenes/PlaceScene";
import { initFlow } from "./flow/screens";
import { initActivity } from "./menu";
import { bindMuteButtons } from "./flow/audio";
import { CHARACTERS, charTextureKey } from "./flow/characters";
import { charWalkKey, ensureWalkAnims, registerWalkSheets } from "./flow/CharSprite";
import { GAME_FONT } from "./flow/theme";

class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    // in-game only ever shows the pixel sprite, never the lobby portrait
    for (const c of CHARACTERS) this.load.image(charTextureKey(c.id), c.pixel);
    // placeholder walk sheets: the static art has no walking frames, so each
    // character ships a generated 4-direction cycle (see tools/build_walk_sheets.py)
    for (const c of CHARACTERS) {
      this.load.image(charWalkKey(c.id), `/rigs/${c.id}-walk.png`);
    }
  }

  create() {
    // painted dioramas are scaled down smoothly; the pixel people stay crisp
    for (const c of CHARACTERS) {
      this.textures.get(charTextureKey(c.id))?.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.textures.get(charWalkKey(c.id))?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    // build every walk/idle clip once, so any place scene can just play them
    registerWalkSheets(CHARACTERS.map(c => c.id));
    ensureWalkAnims(this);
  }
}

function boot() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 600,
    backgroundColor: "#101312",
    // fixed isometric dioramas: the painting is downscaled smoothly, the
    // character sprites keep nearest-neighbour filtering (set in Boot)
    pixelArt: false,
    roundPixels: true,
    // FIT: the whole 960x600 diorama stays visible and scales with the window;
    // the side gutters continue the dark hall so there are no hard bars.
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, PlaceScene, RaceScene]
  });

  initFlow(game);
  initActivity(game);
  bindMuteButtons();

  // Some hosts (IDE preview panels, iframes) only forward key events once
  // something inside the frame has been clicked. The keyboard listens on the
  // window, so this is just a nudge: make the canvas focusable and take focus
  // on a press over the game area.
  const canvas = game.canvas;
  canvas.tabIndex = 0;
  canvas.style.outline = "none";
  canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));

  // dev-only handle, used by the screenshot harness to read the walk state
  if (import.meta.env.DEV) (window as any).__game = game;
}

// Wait for Pricedown so Phaser canvas text renders in the GTA-III face,
// not the fallback (canvas caches the font at draw time).
const fontReady = (document as any).fonts?.load(`20px ${GAME_FONT}`) ?? Promise.resolve();
Promise.race([
  Promise.resolve(fontReady).catch(() => undefined),
  new Promise(r => setTimeout(r, 2500))
]).then(boot);
