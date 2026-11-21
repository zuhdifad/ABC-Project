/**
 * The on-screen d-pad.
 *
 * Phones and trackpads have no arrow keys, so the HUD carries a four-way pad.
 * It feeds the same axis vector into the active `Walker`, which means every
 * walkable scene (village, lobby, room) gets thumb control for free and the
 * keyboard keeps working exactly as before. Bind once — the buttons are
 * re-pointed at whichever walker is alive, so scene changes need no rebinding.
 */
import { activeWalker } from "./walk";

const DIRS = ["up", "left", "right", "down"] as const;
let bound = false;

export function bindTouchPad() {
  if (bound) return;
  const pad = document.getElementById("dpad");
  if (!pad) return;
  bound = true;

  const held = new Set<string>();
  const apply = () => {
    const x = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const y = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    activeWalker()?.setPad(x, y);
  };
  const clear = () => {
    held.clear();
    pad.querySelectorAll("button.on").forEach(b => b.classList.remove("on"));
    apply();
  };

  for (const dir of DIRS) {
    const el = pad.querySelector<HTMLButtonElement>(`[data-dir="${dir}"]`);
    if (!el) continue;
    el.onpointerdown = (e) => {
      e.preventDefault();
      // capture, so sliding a finger off the button still delivers the release
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      el.classList.add("on");
      held.add(dir);
      apply();
    };
    const release = () => {
      el.classList.remove("on");
      held.delete(dir);
      apply();
    };
    el.onpointerup = release;
    el.onpointercancel = release;
    el.onlostpointercapture = release;
    el.oncontextmenu = (e) => e.preventDefault();
  }

  // a tab switch mid-press must not leave the character walking forever
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clear(); });
}
