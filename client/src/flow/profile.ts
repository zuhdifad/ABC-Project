export interface Profile {
  name: string;
  pinHash: string;
  characterId: string;
  money: number;
  day: number;
  wins: number;
}
export interface LogEntry { label: string; detail: string; money: number; at: string; }
export interface DayState {
  startedAt: number;
  energy: number;
  earned: number;
  log: LogEntry[];
  commuteDone: boolean;
  coffeeDone: boolean;
}

const KEY = "mashparty.profiles.v1";

export function loadProfiles(): Record<string, Profile> {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    for (const p of Object.values(all) as Profile[]) {
      if (!p.characterId) p.characterId = "ayu";
    }
    return all;
  } catch { return {}; }
}
export function saveProfile(p: Profile) {
  const all = loadProfiles();
  all[p.name] = p;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode("mash:" + pin);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 2166136261;
  for (const b of data) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  return "fnv:" + h.toString(16);
}

export let current: Profile | null = null;
export function setCurrent(p: Profile | null) { current = p; }

export let day: DayState = newDay();
export function newDay(): DayState {
  // groggy morning energy so the coffee run actually matters
  return {
    startedAt: Date.now(), energy: 70, earned: 0, log: [],
    commuteDone: false, coffeeDone: false
  };
}
export function setDay(d: DayState) {
  day = d;
}

/** The world clock IS the game clock: real local time. */
export function fmtTime(d: Date = new Date(), withSeconds = false): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return withSeconds
    ? `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    : `${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}
export function addLog(label: string, detail: string, money: number) {
  day.log.push({ label, detail, money, at: fmtTime() });
  day.earned += money;
  if (current) current.money += money;
}