let ctx: AudioContext | null = null;
let muted = localStorage.getItem("mashparty.muted") === "1";

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function blip(freq: number, dur = 0.08, type: OscillatorType = "square", gain = 0.05, when = 0) {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}

export const audio = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    localStorage.setItem("mashparty.muted", muted ? "1" : "0");
    return muted;
  },
  click() { blip(520, 0.06, "triangle", 0.05); },
  tap() { blip(300 + Math.random() * 120, 0.05, "square", 0.035); },
  beep() { blip(660, 0.12, "square", 0.06); },
  go() { blip(880, 0.2, "square", 0.07); },
  win() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, "triangle", 0.07, i * 0.12)); },
  lose() { [392, 330, 262].forEach((f, i) => blip(f, 0.18, "triangle", 0.06, i * 0.14)); },
  chime() { [784, 988].forEach((f, i) => blip(f, 0.22, "sine", 0.07, i * 0.15)); },
  deny() { blip(160, 0.18, "sawtooth", 0.06); }
};

export function syncMuteButtons() {
  document.querySelectorAll("[data-mute]").forEach(b => {
    b.textContent = muted ? "🔇" : "🔊";
    b.setAttribute("aria-label", muted ? "Unmute" : "Mute");
  });
}
export function bindMuteButtons() {
  document.querySelectorAll("[data-mute]").forEach(b =>
    b.addEventListener("click", () => { audio.toggle(); syncMuteButtons(); }));
  syncMuteButtons();
}