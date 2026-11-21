import Phaser from "phaser";
import { RaceScene } from "./scenes/RaceScene";
import { CityScene } from "./scenes/CityScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { RoomScene } from "./scenes/RoomScene";
import { initFlow } from "./flow/screens";
import { initActivity } from "./menu";
import { bindMuteButtons } from "./flow/audio";
import { CHARACTERS, charTextureKey } from "./flow/characters";
import { GAME_FONT } from "./flow/theme";

class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    // in-game only ever shows the pixel sprite, never the lobby portrait
    for (const c of CHARACTERS) this.load.image(charTextureKey(c.id), c.pixel);
  }
}

function boot() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 600,
    backgroundColor: "#6fae4a",
    // the whole village is baked pixel art: nearest-neighbour filtering and
    // whole-pixel camera positions, or the 16 px tiles shimmer while walking
    pixelArt: true,
    roundPixels: true,
    // FIT: the whole 960x600 scene stays visible and scales with the window;
    // the side gutters are painted to continue the scene's colour bands.
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, CityScene, LobbyScene, RoomScene, RaceScene]
  });

  initFlow(game);
  initActivity(game);
  bindMuteButtons();

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