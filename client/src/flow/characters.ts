import type Phaser from "phaser";

/**
 * The commuter roster.
 *
 * Art contract: every character has ONE source portrait in
 * `assets-src/characters/`. `tools/build_characters.py` derives every size
 * used by the game from it, so the lobby art and the tiny street sprite can
 * never drift apart:
 *
 *   chars/<id>.webp        -> selection showcase (1024 px tall)
 *   chars/<id>-sprite.png  -> select-screen figure (128 px tall)
 *   chars/<id>-face.png    -> filmstrip bust tile (220x264)
 *   chars/<id>-pixel.png   -> in-game pixel sprite (100 px tall)
 *
 * Only the in-game sprite is pixel art. The select screen keeps the clean
 * photo cutouts; the transform belongs to the character you walk around.
 *
 * Stats are not decoration: energy sets the shift's starting stamina, focus
 * scales laptop payouts, and coffee need (read off the physique) drives how
 * fast stamina drains and how much a chug restores.
 */
export type Build =
  | "petite" | "slim" | "lean" | "wiry" | "average"
  | "athletic" | "tall" | "solid" | "broad" | "sturdy";

export interface CharStats {
  /** stamina at the start of a shift, and how long the legs last */
  energy: number;
  /** quality of desk work — multiplies every ticket payout */
  focus: number;
  /** caffeine dependency: higher drains faster, but a chug restores more */
  coffee: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  role: string;
  /** one-word personality shown on the select card, e.g. (Meticulous) */
  persona: string;
  /** what the select card plays behind the portrait */
  scene: "office" | "street" | "cafe" | "site";
  /** the personality, in three words */
  tagline: string;
  bio: string;
  quote: string;
  build: Build;
  physique: string;
  coffeeOrder: string;
  perk: { label: string; detail: string };
  stats: CharStats;
  img: string;
  sprite: string;
  face: string;
  /** pixel-art sprite, only ever used inside the game scene */
  pixel: string;
}

const art = (id: string) => ({
  img: `/chars/${id}.webp`,
  sprite: `/chars/${id}-sprite.png`,
  face: `/chars/${id}-face.png`,
  pixel: `/chars/${id}-pixel.png`
});

export const CHARACTERS: CharacterDef[] = [
  {
    id: "aaron",
    name: "Aaron",
    persona: "Composed",
    scene: "office",
    role: "Compliance Executive",
    tagline: "The Unbothered Achiever",
    bio: "Jacket buttoned, reply already drafted, never once seen running for the LRT. Aaron reads the whole memo before answering and somehow still leaves at 5:01. The calm in every group chat.",
    quote: "“It's fine. I already filed it yesterday.”",
    build: "lean",
    physique: "Lean · long stride",
    coffeeOrder: "Kopi O kosong, no sugar",
    perk: { label: "Unshakeable", detail: "Stamina drains slowly under pressure" },
    stats: { energy: 74, focus: 82, coffee: 46 },
    ...art("aaron")
  },
  {
    id: "aldi",
    name: "Aldi",
    persona: "Sociable",
    scene: "street",
    role: "Client Relations",
    tagline: "The Office Sunshine",
    bio: "Greets the guard, the cleaner and the CEO by name. Aldi runs on goodwill and teh tarik, closes deals by being liked, and forgets his laptop charger every single Monday.",
    quote: "“Morning! You look like you need a kopi.”",
    build: "slim",
    physique: "Slim · light on his feet",
    coffeeOrder: "Teh tarik, extra froth",
    perk: { label: "Everybody's Friend", detail: "Chats restore more stamina" },
    stats: { energy: 86, focus: 62, coffee: 58 },
    ...art("aldi")
  },
  {
    id: "ayu",
    name: "Ayu",
    persona: "Meticulous",
    scene: "office",
    role: "Finance Analyst",
    tagline: "The Quiet Fixer",
    bio: "Ayu spots the missing sen before the auditors do. Speaks little, fixes everything, and keeps a spare calculator in the drawer for the intern who always forgets one.",
    quote: "“The numbers don't match. Give me ten minutes.”",
    build: "petite",
    physique: "Petite · precise steps",
    coffeeOrder: "Flat white, one shot",
    perk: { label: "Balanced Books", detail: "Desk work pays a steady bonus" },
    stats: { energy: 70, focus: 88, coffee: 54 },
    ...art("ayu")
  },
  {
    id: "clara",
    name: "Clara",
    persona: "Spirited",
    scene: "cafe",
    role: "Marketing Executive",
    tagline: "The Morning Spark",
    bio: "Arrives with three ideas and a pastry for the team. Clara talks fast, walks faster, and has already pitched the campaign to the Grab driver by the time she reaches the lobby.",
    quote: "“Okay okay okay — hear me out first.”",
    build: "slim",
    physique: "Slim · restless energy",
    coffeeOrder: "Iced latte, double shot",
    perk: { label: "Fast Talker", detail: "Brisk-walk momentum builds quicker" },
    stats: { energy: 90, focus: 66, coffee: 78 },
    ...art("clara")
  },
  {
    id: "elvin",
    name: "Elvin",
    persona: "Analytical",
    scene: "office",
    role: "Data Analyst",
    tagline: "The Spreadsheet Whisperer",
    bio: "Elvin dreams in pivot tables. One eyebrow raised at your formula, a dry joke delivered so quietly you laugh two seconds late, and a chart that ends the argument.",
    quote: "“That's not a trend. That's one bad Tuesday.”",
    build: "average",
    physique: "Average · measured pace",
    coffeeOrder: "Long black, no milk",
    perk: { label: "Deep Focus", detail: "Highest laptop payout per ticket" },
    stats: { energy: 64, focus: 94, coffee: 72 },
    ...art("elvin")
  },
  {
    id: "george",
    name: "George",
    persona: "Steadfast",
    scene: "office",
    role: "Operations Director",
    tagline: "The Old Guard",
    bio: "Twenty-two years in the tower, three CEOs, one unchanged blue tie. George remembers when Maple Street was a car park and signs off anything sensible before lunch.",
    quote: "“Slow is smooth. Smooth is on time.”",
    build: "sturdy",
    physique: "Sturdy · unhurried gait",
    coffeeOrder: "Kopi C, thick cup",
    perk: { label: "Institutional Memory", detail: "Wins pay a veteran's premium" },
    stats: { energy: 58, focus: 90, coffee: 88 },
    ...art("george")
  },
  {
    id: "hannah",
    name: "Hannah",
    persona: "Poised",
    scene: "office",
    role: "Sales Lead",
    tagline: "The Cool Closer",
    bio: "Powder-blue suit, heels that click like a metronome. Hannah never raises her voice and never loses a negotiation. The lift mirrors are her warm-up room.",
    quote: "“Let's not call it a discount. Call it a partnership.”",
    build: "tall",
    physique: "Tall & lean · longest stride",
    coffeeOrder: "Espresso, standing at the bar",
    perk: { label: "Closer's Stride", detail: "Fastest walk on Maple Street" },
    stats: { energy: 80, focus: 84, coffee: 50 },
    ...art("hannah")
  },
  {
    id: "haziq",
    name: "Haziq",
    persona: "Restless",
    scene: "street",
    role: "Junior Developer",
    tagline: "The Last-Minute Hero",
    bio: "Sprints through the gantry at 08:59:58, sneakers squeaking on the marble. Haziq ships the fix at midnight and sleeps through the standup that praises him.",
    quote: "“It works on my machine. And now on yours.”",
    build: "wiry",
    physique: "Wiry · built for sprinting",
    coffeeOrder: "Cold brew, largest size",
    perk: { label: "Sprint Finish", detail: "Running costs less stamina" },
    stats: { energy: 92, focus: 58, coffee: 84 },
    ...art("haziq")
  },
  {
    id: "hiro",
    name: "Hiro",
    persona: "Considerate",
    scene: "cafe",
    role: "HR Partner",
    tagline: "The Pantry Philosopher",
    bio: "Knows everyone's birthday and everyone's leave balance. Hiro keeps biscuits in his desk drawer and gives advice that sounds like a fortune cookie until it saves your week.",
    quote: "“Take the leave. The email will survive.”",
    build: "solid",
    physique: "Solid · steady and grounded",
    coffeeOrder: "Cappuccino, extra foam",
    perk: { label: "Pantry Diplomat", detail: "Coffee chugs restore extra stamina" },
    stats: { energy: 72, focus: 70, coffee: 62 },
    ...art("hiro")
  },
  {
    id: "koshei",
    name: "Koshei",
    persona: "Smooth",
    scene: "cafe",
    role: "Business Development",
    tagline: "The Smooth Operator",
    bio: "Collar open, one hand in the pocket, a shortcut for every process. Koshei knows which lift is fastest and which manager approves things on a Friday afternoon.",
    quote: "“There's the official way. Then there's Tuesday.”",
    build: "athletic",
    physique: "Athletic · easy confidence",
    coffeeOrder: "Americano, to go",
    perk: { label: "Shortcut Artist", detail: "Lowest caffeine dependency" },
    stats: { energy: 84, focus: 68, coffee: 40 },
    ...art("koshei")
  },
  {
    id: "lisa",
    name: "Lisa",
    persona: "Empathetic",
    scene: "office",
    role: "Project Coordinator",
    tagline: "The Checklist Queen",
    bio: "Colour-coded calendar, three pens, zero missed deadlines. Lisa sends the reminder before you know you needed one and smiles the whole time she chases you.",
    quote: "“Gentle reminder — it was due yesterday.”",
    build: "petite",
    physique: "Petite · quick, tidy steps",
    coffeeOrder: "Mocha, whipped cream",
    perk: { label: "Everything On Time", detail: "Desk work never wastes stamina" },
    stats: { energy: 76, focus: 92, coffee: 66 },
    ...art("lisa")
  },
  {
    id: "salim",
    name: "Salim",
    persona: "Resourceful",
    scene: "site",
    role: "Risk & Compliance",
    tagline: "The Steady Hand",
    bio: "Broad shoulders, short sentences, reading glasses permanently on. Salim is the reason nothing catches fire — and the last person to mention it.",
    quote: "“Show me the worst case. Then we talk.”",
    build: "broad",
    physique: "Broad · heavy, deliberate steps",
    coffeeOrder: "Kopi O kaw, twice a morning",
    perk: { label: "Load Bearing", detail: "Keeps working on low stamina" },
    stats: { energy: 68, focus: 86, coffee: 56 },
    ...art("salim")
  },
  {
    id: "zuhdi",
    name: "Zuhdi",
    persona: "Ambitious",
    scene: "cafe",
    role: "Creative Designer",
    tagline: "The Idea Guy",
    bio: "Curls, sneakers, hands in pockets, a sketchbook nobody is allowed to see yet. Zuhdi redraws the deck at 2am because the kerning was 'emotionally wrong'.",
    quote: "“What if the whole thing was… yellow?”",
    build: "lean",
    physique: "Lean · loose, bouncy walk",
    coffeeOrder: "Kopi susu, three sachets",
    perk: { label: "Second Wind", detail: "Brisk walking recovers stamina" },
    stats: { energy: 88, focus: 60, coffee: 74 },
    ...art("zuhdi")
  }
];

export function charById(id?: string): CharacterDef {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}

export function charIndex(id?: string): number {
  const i = CHARACTERS.findIndex(c => c.id === id);
  return i < 0 ? 0 : i;
}

/** texture keys: the tiny street sprite, and the big showcase portrait */
export function charTextureKey(id?: string): string {
  return `char_${charById(id).id}`;
}
export function charPortraitKey(id?: string): string {
  return `portrait_${charById(id).id}`;
}

/* ------------------------------------------------------------------ *
 * Stats -> gameplay. One place, so the select screen can preview the
 * exact numbers the shift will actually run on.
 * ------------------------------------------------------------------ */

const PACE: Record<Build, number> = {
  petite: 0.97, slim: 1.02, lean: 1.05, wiry: 1.08, average: 1,
  athletic: 1.06, tall: 1.1, solid: 0.96, broad: 0.94, sturdy: 0.93
};

export interface CharMods {
  startEnergy: number;
  focusMult: number;
  drainMult: number;
  coffeeBoost: number;
  paceMult: number;
  chatBoost: number;
  workCost: number;
  workBonus: number;
  winBonus: number;
  /** how fast tap-to-brisk momentum stacks */
  briskGain: number;
  /** stamina cost of running, relative to walking */
  runDrain: number;
  /** stamina recovered per second of brisk walking */
  briskRegen: number;
}

export function charMods(id?: string): CharMods {
  const c = charById(id);
  const { energy, focus, coffee } = c.stats;
  const perk = c.perk.label;
  return {
    startEnergy: Math.round(46 + energy * 0.44),
    focusMult: +(0.75 + focus / 200).toFixed(3),
    drainMult: +((0.65 + coffee / 100) * (perk === "Unshakeable" ? 0.8 : 1)).toFixed(3),
    coffeeBoost: Math.round((10 + coffee * 0.16) * (perk === "Pantry Diplomat" ? 1.25 : 1)),
    paceMult: PACE[c.build],
    chatBoost: perk === "Everybody's Friend" ? 6 : 3,
    workCost: perk === "Everything On Time" ? 6 : perk === "Load Bearing" ? 7 : 8,
    workBonus: perk === "Balanced Books" ? 6 : 0,
    winBonus: perk === "Institutional Memory" ? 15 : 0,
    briskGain: perk === "Fast Talker" ? 1.35 : 1,
    runDrain: perk === "Sprint Finish" ? 0.6 : 1,
    briskRegen: perk === "Second Wind" ? 1.6 : 0
  };
}

/** stamina floor for desk work — Salim keeps going when others stop */
export function workFloor(id?: string): number {
  return charById(id).perk.label === "Load Bearing" ? 6 : 12;
}

/**
 * Size a street sprite from the derived art, keeping the portrait's real
 * proportions (no squashed commuters).
 */
export function sizeSprite(
  img: Phaser.GameObjects.Image, height: number
): Phaser.GameObjects.Image {
  const src = img.texture.getSourceImage() as { width: number; height: number };
  const ratio = src?.width && src?.height ? src.width / src.height : 0.66;
  img.setDisplaySize(Math.round(height * ratio), height);
  /* remember the fitted scale so tweens can pulse around it instead of resetting it */
  img.setData("baseScale", img.scaleX);
  return img;
}

/** pulse a sized sprite around its fitted scale (setScale would undo sizeSprite) */
export function pulseSprite(img: Phaser.GameObjects.Image, factor: number): void {
  const base = (img.getData("baseScale") as number) || 1;
  img.setScale(base * factor);
}

/* ------------------------------------------------------------------ *
 * 0-100 stat -> 5 star rating, for the select board. One mapping for
 * every meter so the bars in the reference art stay comparable.
 * ------------------------------------------------------------------ */
export function starRating(value: number): number {
  if (value >= 85) return 5;
  if (value >= 70) return 4;
  if (value >= 55) return 3;
  if (value >= 40) return 2;
  return 1;
}