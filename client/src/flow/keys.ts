/**
 * The game's keyboard — one listener for the whole app.
 *
 * Phaser's KeyboardPlugin only hears keys when its canvas has focus, which
 * breaks the moment the game is embedded (IDE preview, iframe, devtools) or
 * something else on the page steals focus. This module listens on `window`
 * instead, tracks physical `event.code` values and hands every walkable scene
 * the same logical state, so WASD and the arrow keys behave identically in the
 * city, the lobby, the room and the race.
 *
 * Keys are only consumed while a walkable scene claims them; everywhere else
 * (login form, character board) the browser keeps its normal behaviour.
 */
export type GameKey = "left" | "right" | "up" | "down" | "run" | "action";

/** physical key -> what the game calls it. Both layouts, all the time. */
const BINDINGS: Record<string, GameKey> = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ShiftLeft: "run", ShiftRight: "run", Digit1: "run", Slash: "run",
  KeyE: "action"
};

/** the ones that would otherwise scroll the page */
const SCROLLS = new Set<GameKey>(["left", "right", "up", "down"]);

const held = new Set<string>();
const down = new Set<GameKey>();
const press = new Map<GameKey, Set<() => void>>();
const anyPress = new Set<() => void>();
let claims = 0;

const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
};

/** two keys can share one game key, so recompute instead of toggling blindly */
function sync() {
  down.clear();
  for (const code of held) {
    const k = BINDINGS[code];
    if (k) down.add(k);
  }
}

function fire(k: GameKey) {
  press.get(k)?.forEach(fn => fn());
  anyPress.forEach(fn => fn());
}

function onDown(e: KeyboardEvent) {
  const k = BINDINGS[e.code];
  if (!k) return;
  if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
  // a scene is running: keep arrows from scrolling the page under the canvas
  if (claims && SCROLLS.has(k)) e.preventDefault();
  const fresh = !held.has(e.code);
  held.add(e.code);
  sync();
  if (fresh && !e.repeat) fire(k);
}

function onUp(e: KeyboardEvent) {
  if (!held.delete(e.code)) return;
  sync();
}

function reset() {
  held.clear();
  sync();
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", onDown, { passive: false });
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });
}

export const keys = {
  /** is this direction held down right now */
  isDown(k: GameKey): boolean {
    return down.has(k);
  },

  /** called once per fresh press (auto-repeat ignored). Returns an unsubscribe. */
  onPress(k: GameKey, fn: () => void): () => void {
    let set = press.get(k);
    if (!set) press.set(k, set = new Set());
    set.add(fn);
    return () => set!.delete(fn);
  },

  /** any fresh press — the mash-race wants the whole keyboard */
  onAnyPress(fn: () => void): () => void {
    anyPress.add(fn);
    return () => anyPress.delete(fn);
  },

  /**
   * A walkable scene is alive: swallow arrow scrolling until the returned
   * release is called. Claims are counted, so overlapping scenes are safe.
   */
  claim(): () => void {
    claims++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      claims = Math.max(0, claims - 1);
      reset();
    };
  },

  reset
};
