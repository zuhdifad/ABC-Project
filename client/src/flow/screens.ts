import Phaser from "phaser";
import {
  loadProfiles, saveProfile, hashPin, setCurrent, current,
  setDay, newDay, day, fmtTime, fmtDate, type Profile
} from "./profile";
import { CHARACTERS, charIndex, charMods, starRating } from "./characters";
import { audio, syncMuteButtons } from "./audio";
import { bindTouchPad } from "./touchpad";

let game: Phaser.Game;
let draft: Profile | null = null;
/** which worker the arcade board has highlighted */
let selIndex = 0;
/** cards on the board; the highlighted one sits second from the left */
const SLOTS = 4;
const HIGHLIGHT = 1;

const $ = (id: string) => document.getElementById(id)!;

export function initFlow(g: Phaser.Game) {
  game = g;
  bindTouchPad();
  buildCarousel();
  renderSelect();
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

  // board navigation: arrows / A-D browse, Enter confirms, Esc backs out
  document.addEventListener("keydown", (e) => {
    if (!$("screen-select").classList.contains("on")) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") {
      e.preventDefault(); stepSelect(-1);
    } else if (k === "ArrowRight" || k === "d" || k === "D") {
      e.preventDefault(); stepSelect(1);
    } else if (k === "Enter" || k === " ") {
      e.preventDefault(); confirmSelect();
    } else if (k === "Escape" || k === "Backspace") {
      e.preventDefault();
      audio.deny();
      show("login");
    }
  });

  $("sel-prev").onclick = () => stepSelect(-1);
  $("sel-next").onclick = () => stepSelect(1);
  $("start-game").onclick = () => confirmSelect();

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
    selIndex = charIndex(draft.characterId);
    $("sel-shift").textContent = `SHIFT #${draft.day + 1} · ${fmtDate()}`;
    renderSelect();
    show("select");
  };

  $("sum-next").onclick = () => {
    audio.click();
    startShift();
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

interface Slot {
  el: HTMLButtonElement;
  art: HTMLImageElement;
  chibi: HTMLImageElement;
  name: HTMLElement;
  persona: HTMLElement;
}
let slots: Slot[] = [];

function buildCarousel() {
  const track = $("sel-cards");
  track.innerHTML = "";
  slots = [];
  for (let i = 0; i < SLOTS; i++) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sel-slot";
    el.innerHTML = `
      <div class="sel-frame">
        <span class="sel-ribbon">SELECTED</span>
        <img class="sel-art" alt="" />
        <div class="sel-tag"><b></b><em></em></div>
      </div>
      <div class="sel-podium"><img class="sel-chibi" alt="" /><i class="sel-pod"></i></div>`;
    el.onclick = () => {
      const id = el.dataset.id;
      if (!id) return;
      if (id === CHARACTERS[selIndex].id) confirmSelect();
      else selectById(id);
    };
    track.appendChild(el);
    slots.push({
      el,
      art: el.querySelector(".sel-art") as HTMLImageElement,
      chibi: el.querySelector(".sel-chibi") as HTMLImageElement,
      name: el.querySelector(".sel-tag b") as HTMLElement,
      persona: el.querySelector(".sel-tag em") as HTMLElement
    });
  }
}

function selectById(id: string) {
  const i = charIndex(id);
  if (i === selIndex) return;
  selIndex = i;
  audio.click();
  renderSelect();
}

function stepSelect(dir: number) {
  selIndex = (selIndex + dir + CHARACTERS.length) % CHARACTERS.length;
  audio.click();
  renderSelect();
}

/** Repaint the four cards as a window over the whole roster, wrap-around. */
function renderSelect() {
  slots.forEach((s, i) => {
    const c = CHARACTERS[(selIndex + i - HIGHLIGHT + CHARACTERS.length) % CHARACTERS.length];
    const on = i === HIGHLIGHT;
    s.el.className = `sel-slot sc-${c.scene}` + (on ? " on" : "");
    s.el.dataset.id = c.id;
    if (s.art.getAttribute("src") !== c.face) s.art.src = c.face;
    s.art.alt = c.name;
    if (s.chibi.getAttribute("src") !== c.sprite) s.chibi.src = c.sprite;
    s.name.textContent = c.name.toUpperCase();
    s.persona.textContent = `(${c.persona})`;
  });
  paintInfo();
}

function meter(label: string, value: number): string {
  const n = starRating(value);
  let stars = "";
  for (let i = 0; i < 5; i++) stars += `<b class="${i < n ? "on" : ""}">★</b>`;
  return `<div class="sel-meter"><span>${label}</span><i>${stars}</i></div>`;
}

function paintInfo() {
  const c = CHARACTERS[selIndex];
  ($("sel-thumb") as HTMLImageElement).src = c.face;
  $("sel-name").textContent = c.name.toUpperCase();
  $("sel-role").textContent = c.role.toUpperCase();
  $("sel-persona").textContent = `(${c.persona})`;
  $("sel-meters").innerHTML =
    meter("ENERGY", c.stats.energy) +
    meter("FOCUS", c.stats.focus) +
    meter("COFFEE NEED", c.stats.coffee);
  $("sel-phys").textContent = c.physique;
  $("sel-spec").textContent = `${c.perk.label} — ${c.perk.detail}`;
  const info = $("sel-info");
  info.classList.remove("swap");
  void info.offsetWidth;
  info.classList.add("swap");
}

function confirmSelect() {
  if (!draft) return;
  audio.chime();
  draft.characterId = CHARACTERS[selIndex].id;
  setCurrent(draft);
  saveProfile(draft);
  startShift();
}

/** Fresh day, but the stamina you start with is the worker's own. */
function startShift() {
  setDay(newDay());
  day.energy = charMods(current?.characterId).startEnergy;
  enterCity();
}