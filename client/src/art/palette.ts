/**
 * One palette for the whole village.
 *
 * Every prop, tile and HUD chip that belongs to the pixel-art map pulls its
 * colour from here. Keeping the ramp names (dark / base / light) instead of
 * literal hex in the drawing code is what stops a 40-prop map from drifting
 * into forty slightly different greens.
 */
export const P = {
  ink: "#241c14",
  outline: "#2a2117",
  shadow: "rgba(28, 40, 20, 0.26)",
  shadowDeep: "rgba(20, 30, 16, 0.34)",

  grass: ["#6fae4a", "#77b64e", "#80be53"],
  grassPatch: "#5e9c40",
  grassDark: "#4c8734",
  grassShade: "#59943c",
  grassLight: "#93cf66",
  grassGlow: "#a9dd78",
  tuft: "#58923a",
  tuftLight: "#a4d875",

  path: "#c3a071",
  pathDark: "#a5825a",
  pathShade: "#b28d61",
  pathLight: "#d7ba8d",

  soil: "#7d5a3c",
  soilDark: "#5e4128",
  soilLight: "#96714b",

  cobble: "#b5ab98",
  cobbleDark: "#938a78",
  cobbleLight: "#cbc2ae",
  mortar: "#8a8171",

  waterDeep: "#326d8d",
  water: "#4787a7",
  waterLight: "#6fb0c6",
  foam: "#cbe9ef",
  sand: "#d8bf8f",
  sandDark: "#bda276",
  sandLight: "#e8d3a8",

  wood: "#7a4b2b",
  woodDark: "#54331d",
  woodShade: "#653d23",
  woodLight: "#a0673a",
  woodHigh: "#c08a52",

  cream: "#f2e6c8",
  creamDark: "#dccfae",
  creamShade: "#cbbb95",
  plaster: "#efe0bd",

  roofRed: "#b5473a",
  roofRedDark: "#8a3129",
  roofRedLight: "#d06350",
  roofTeal: "#4f827b",
  roofTealDark: "#39635e",
  roofTealLight: "#6ba19a",
  roofSlate: "#59616b",
  roofSlateDark: "#414850",

  glass: "#9fd3cf",
  glassDark: "#5e9a97",
  glassLight: "#d6efe8",
  glassNight: "#2f5b63",

  gold: "#e8b75c",
  goldDark: "#bd8b35",
  goldLight: "#f6dc9b",

  pink: "#ef8cb2",
  pinkDark: "#cf6d92",
  yellow: "#f2d05a",
  yellowDark: "#cdaa3e",
  blossom: "#f7eef0",
  violet: "#9a7ac2",
  canopy: "#8a3358",
  canopyDark: "#632340",
  canopyLight: "#a8476c",

  leaf: ["#3f7d34", "#4e9440", "#61ab4b", "#7cc95c"],
  leafDark: "#2f6a2c",
  leafDeep: "#255a27",
  leafShade: "#3a7530",
  leafHigh: "#8fd76a",
  leafGlow: "#b3e884",

  pine: ["#2f6a4a", "#3b7d56", "#498f61"],
  pineDark: "#26573d",

  trunk: "#6b4a2e",
  trunkDark: "#4a3220",
  trunkLight: "#8a6440",

  stone: "#a9a294",
  stoneDark: "#8a8375",
  stoneLight: "#c8c2b3",

  metal: "#4a4f52",
  metalDark: "#33383a",
  metalLight: "#6e7477"
} as const;
