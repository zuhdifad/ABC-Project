import Phaser from "phaser";
import {
  loadProfiles, saveProfile, hashPin, setCurrent, current,
  setDay, newDay, day, fmtTime, fmtDate, type Profile
} from "./profile";
import { CHARACTERS, charById } from "./characters";
import { audio, syncMuteButtons } from "./audio";

let game: Phaser.Game;
let draft: Profile | null = null;
let selectedId = CHARACTERS[0].id;

const $ = (id: string) => document.getElementById(id)!;

export function initFlow(g: Phaser.Game) {
  game = g;
  buildRoster();
  tickTitleClock();
  window.setInterval(tickTitleClock, 1000);
  show("title");

  // PS1-style: blinking prompt, any key or a tap on the cover starts
  const startFromTitle = () => {
    if (!$("screen-title").classList.contains("on")) return;
    audio.click();
    $("login-msg").textContent = "";
    show("login");
  };
  $("cover-frame").onclick = startFromTitle;
  document.addEventListener("keydown", (e) => {
    if (!$("screen-title").classList.contains("on")) return;
    e.preventDefault();
    startFromTitle();
  });

  ($("login-form") as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const name = ($("f-name") as HTMLInputElement).value.trim();
    const pass = ($("f-pass") as HTMLInputElement).value;
    if (name.length < 2) { fail("login-msg", "Name needs at least 2 letters."); return; }
    if (pass.length < 4) { fail("login-msg", "Password needs at least 4 characters."); return; }
    const existing = loadProfiles()[name];
    const hash = await hashPin(pass);
    if (existing && existing.pinHash !== hash) {
      fail("login-msg", "Wrong password for this name.");
      return;
    }
    audio.click();
    draft = existing ?? { name, pinHash: hash, characterId: CHARACTERS[0].id, money: 0, day: 0, wins: 0 };
    if (!existing) saveProfile(draft);
    selectedId = draft.characterId;
    $("sel-shift").textContent = `SHIFT #${draft.day + 1} · ${fmtDate()}`;
    repaintSelect();
    show("select");
  };

  $("start-game").onclick = () => {
    audio.chime();
    draft!.characterId = selectedId;
    setCurrent(draft);
    saveProfile(draft!);
    setDay(newDay());
    enterCity();
  };

  $("sum-next").onclick = () => {
    audio.click();
    setDay(newDay());
    enterCity();
  };
  $("sum-title").onclick = () => {
    audio.click();
    draft = null;
    setCurrent(null);
    ($("f-pass") as HTMLInputElement).value = "";
    show("title");
  };
}

function tickTitleClock() {
  const now = new Date();
  $("t-clock").textContent = fmtTime(now, true);
  $("t-date").textContent = fmtDate(now);
  $("t-tz").textContent = "🇲🇾 KUALA LUMPUR";
}

export function show(id: string) {
  $("flow").classList.add("on");
  $("hud").classList.remove("on");
  document.body.classList.remove("in-game");
  document.body.classList.toggle("on-title", id === "title");
  document.body.classList.toggle("on-login", id === "login");
  document.querySelectorAll("#flow .screen").forEach(s =>
    s.classList.toggle("on", (s as HTMLElement).dataset.screen === id));
  syncMuteButtons();
}

export function enterCity() {
  $("flow").classList.remove("on");
  $("hud").classList.add("on");
  document.body.classList.remove("on-title");
  document.body.classList.remove("on-login");
  document.body.classList.add("in-game");
  game.scene.start("City");
}

export function toast(msg: string, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  window.clearTimeout((t as any)._h);
  (t as any)._h = window.setTimeout(() => t.classList.remove("on"), ms);
}

/** Objective chip at the top of the HUD (pass null to hide it). */
export function setGoal(text: string | null) {
  const el = $("hud-goal");
  el.textContent = text ?? "";
  el.classList.toggle("on", !!text);
}

/** Movement-style chip above the minimap. */
export function setSpeed(text: string) {
  const el = $("hud-speed");
  if (el.textContent !== text) el.textContent = text;
}

export function clockOut() {
  for (const key of ["City", "Lobby", "Room"]) {
    if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key);
  }
  $("hud").classList.remove("on");
  setGoal(null);
  const ended = current!.day + 1;
  current!.day = ended;
  saveProfile(current!);
  $("sum-day").textContent = String(ended);
  $("sum-time").textContent = fmtTime();
  $("sum-earned").textContent = "$" + day.earned;
  $("sum-money").textContent = "$" + current!.money;
  $("sum-energy").textContent = String(Math.round(day.energy));
  const log = $("sum-log");
  log.innerHTML = "";
  if (day.log.length === 0) {
    log.innerHTML = `<div class="row"><span>A quiet shift… <em>no activities</em></span><b>$0</b></div>`;
  }
  for (const e of day.log) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span><em>${e.at}</em> ${e.label} <em>${e.detail}</em></span><b>${e.money >= 0 ? "+" : ""}$${e.money}</b>`;
    log.appendChild(row);
  }
  audio.chime();
  show("summary");
}

function fail(id: string, msg: string) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove("shake");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("shake");
  audio.deny();
}

function buildRoster() {
  const list = $("roster");
  for (const c of CHARACTERS) {
    const b = document.createElement("button");
    b.className = "roster-item";
    b.innerHTML = `<img src="${c.img}" alt="${c.name}" /><span><b>${c.name}</b><em>${c.role}</em></span>`;
    b.onclick = () => { audio.click(); selectedId = c.id; repaintSelect(); };
    (b as any)._id = c.id;
    list.appendChild(b);
  }
}

function repaintSelect() {
  const c = charById(selectedId);
  const img = $("showcase") as HTMLImageElement;
  img.classList.remove("swap");
  void img.offsetWidth;
  img.src = c.img;
  img.classList.add("swap");
  $("sel-name").textContent = c.name;
  $("sel-role").textContent = c.role;
  document.querySelectorAll(".roster-item").forEach(b =>
    b.classList.toggle("sel", (b as any)._id === selectedId));
}