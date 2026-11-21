import Phaser from "phaser";
import type { Room } from "colyseus.js";
import { client } from "./net";
import { THEMES } from "./games/registry";
import { audio } from "./flow/audio";

let game: Phaser.Game;
let pending: ((room: Room) => void) | null = null;
let pendingCancel: (() => void) | null = null;
let activityName = "Player";
let activityChar = "ayu";

const $ = (id: string) => document.getElementById(id)!;

export function initActivity(g: Phaser.Game) {
  game = g;
  $("act-create").onclick = () => {
    audio.click();
    const type = ($("activity") as HTMLElement).dataset.game as string;
    run(() => client.create("race", { gameType: type, name: activityName, characterId: activityChar }));
  };
  $("act-join").onclick = () => {
    audio.click();
    const code = ($("act-code") as HTMLInputElement).value.trim();
    if (!code) { $("act-status").textContent = "Enter a room code"; return; }
    run(() => client.joinById(code, { name: activityName, characterId: activityChar }));
  };
  $("act-cancel").onclick = () => { audio.click(); closeActivity(true); };
}

export function openActivity(
  gameType: string,
  name: string,
  characterId: string,
  onRoom: (room: Room) => void,
  onCancel?: () => void
) {
  const theme = THEMES[gameType] ?? THEMES.coffee;
  const panel = $("activity") as HTMLElement;
  panel.dataset.game = gameType;
  activityName = name;
  activityChar = characterId;
  $("act-title").textContent = theme.menuLabel;
  $("act-desc").textContent = theme.menuDesc + " — winner takes the purse.";
  $("act-status").textContent = "";
  ($("act-code") as HTMLInputElement).value = "";
  pending = onRoom;
  pendingCancel = onCancel ?? null;
  panel.classList.add("on");
}

export function closeActivity(runCancel = false) {
  $("activity").classList.remove("on");
  pending = null;
  const cancel = pendingCancel;
  pendingCancel = null;
  if (runCancel) cancel?.();
}

async function run(fn: () => Promise<Room>) {
  $("act-status").textContent = "Connecting…";
  try {
    const room = await fn();
    const cb = pending;
    closeActivity(false);
    cb?.(room);
  } catch (e: any) {
    $("act-status").textContent = e?.message || "Could not connect to server";
    audio.deny();
  }
}