import { rect } from "./geometry";
import type { IsoPlace } from "./types";

/**
 * KL Sentral — the station hall the day starts in.
 *
 * All coordinates are pixels of the 1344x756 painting. The floor outline hugs
 * the visible tiles; every kiosk, gate, column and bystander the player should
 * bump into is a solid on top of it. Press ` in dev to see the mask, then nudge
 * the numbers here — this file is the whole level.
 */
export const KL_SENTRAL: IsoPlace = {
  id: "kl-sentral",
  title: "KL SENTRAL",
  image: "/places/kl-sentral.jpg",
  texture: "place:kl-sentral",
  width: 1344,
  height: 756,

  // walkable tiles, clockwise from the left-hand shop front
  floor: [
    [70, 232], [400, 212], [810, 212], [870, 250], [1005, 250],
    [1015, 312], [1235, 312], [1325, 378], [1288, 415],
    [625, 742], [320, 748], [280, 425], [0, 556], [0, 312]
  ],

  solids: [
    // the black void between the shop and the foreground plinth
    { name: "void", points: [[0, 296], [255, 395], [0, 552]] },
    // the plinth itself (bottom-left foreground wall)
    { name: "plinth", points: rect(0, 380, 300, 756) },
    // ticket gates and their glass wing
    { name: "gates", points: rect(1000, 90, 1240, 322) },
    // departure info totem
    { name: "info", points: rect(1222, 260, 1274, 350) },
    // fare machines
    { name: "machines", points: rect(1240, 290, 1338, 408) },
    // bin + luggage trolleys
    { name: "bin", points: rect(1192, 330, 1238, 382) },
    { name: "trolleys", points: rect(1136, 380, 1252, 464) },
    // the hanging sign's post
    { name: "sign post", points: rect(838, 258, 870, 312) },
    // the commuter you can challenge (drawn by the game; see npcs below)
    { name: "commuter", points: rect(1034, 428, 1084, 470) }
  ],

  /**
   * Prop slices that should paint over the player (see IsoStage).
   * This hall is wide open in front of the camera: the only foreground mass is
   * the plinth, which is solid, so nothing needs to occlude the player here.
   * A future place with a counter or a pillar in front of the walkway adds
   * `{ points: [...], baseY }` entries here.
   */
  occluders: [],

  spawn: [660, 600],

  portals: [
    {
      id: "exit", kind: "exit", x: 190, y: 262, r: 74,
      label: "🚪 Leave the station — end the shift"
    },
    {
      id: "gates", kind: "gate", x: 1112, y: 344, r: 88,
      label: "🎫 Tap in at the LRT gates"
    }
  ],

  npcs: [
    {
      id: "commuter", characterId: "danial",
      x: 1058, y: 468,
      plaque: "DANIAL · ☕ CLICK TO CHUG"
    }
  ]
};
