/** Iso fixed-view framework: every place is a painted diorama + a walk mask. */
export type Pt = [number, number];

export interface IsoSolid {
  /** handy when the debug overlay labels what you are looking at */
  name?: string;
  points: Pt[];
}

/** A piece of the art that must cover the player when they walk behind it. */
export interface IsoOccluder {
  points: Pt[];
  /** feet above this image-space line are "behind" the thing */
  baseY: number;
}

export interface IsoPortal {
  id: string;
  /** centre, in image pixels */
  x: number;
  y: number;
  /** interaction radius, in image pixels */
  r: number;
  label: string;
  kind: "exit" | "gate" | "coffee";
}

export interface IsoNpc {
  id: string;
  /** roster id from flow/characters */
  characterId: string;
  x: number;
  y: number;
  plaque: string;
}

/**
 * One painted isometric place.
 *
 * The art is never re-projected: the image is the world. Everything that the
 * player can touch is authored in image pixels, so a new place needs nothing
 * but a picture and a handful of polygons.
 */
export interface IsoPlace {
  id: string;
  title: string;
  /** public URL of the art */
  image: string;
  /** texture key the scene loads it under */
  texture: string;
  width: number;
  height: number;
  /** where feet are allowed, image pixels */
  floor: Pt[];
  solids: IsoSolid[];
  occluders?: IsoOccluder[];
  spawn: Pt;
  portals: IsoPortal[];
  npcs?: IsoNpc[];
}
