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
    // in-game only ever shows the derived street sprite, never the 1024px portrait
    for (const c of CHARACTERS) this.load.image(charTextureKey(c.id), c.sprite);
  }
}

function boot() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 600,
    backgroundColor: "#eaf4f1",
    // FIT: the whole 960x600 scene stays visible and scales with the window;
    // the side gutters are painted to continue the scene's colour bands.
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, CityScene, LobbyScene, RoomScene, RaceScene]
  });

  initFlow(game);
  initActivity(game);
  bindMuteButtons();
}

// Wait for Pricedown so Phaser canvas text renders in the GTA-III face,
// not the fallback (canvas caches the font at draw time).
const fontReady = (document as any).fonts?.load(`20px ${GAME_FONT}`) ?? Promise.resolve();
Promise.race([
  Promise.resolve(fontReady).catch(() => undefined),
  new Promise(r => setTimeout(r, 2500))
]).then(boot);