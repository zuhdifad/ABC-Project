import { Room, Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { GAMES } from "../games/registry";

const GOAL = 100;
const MAX_TAPS_PER_SEC = 18;
const MAX_PLAYERS = 6;
const COUNTDOWN_SECONDS = 3;

class Player extends Schema {
  @type("string") name = "";
  @type("string") characterId = "ayu";
  @type("number") progress = 0;
  @type("boolean") finished = false;
  @type("number") rank = 0;
}

class RaceState extends Schema {
  @type("string") gameType = "coffee";
  @type("string") phase = "lobby"; // lobby | countdown | playing | finished
  @type("string") hostId = "";
  @type("number") countdown = 0;
  @type("number") timeLeft = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
}

/**
 * Shared authoritative race engine for ALL mini-games.
 * Clients only send "tap" — the server counts, rate-limits and ranks.
 */
export class RaceRoom extends Room<RaceState> {
  maxClients = MAX_PLAYERS;
  private tapLog = new Map<string, number[]>();
  private finishCount = 0;
  private countdownTimer?: { clear(): void };
  private roundTimer?: { clear(): void };

  onCreate(options: any) {
    this.setState(new RaceState());
    this.state.gameType = GAMES[options.gameType] ? options.gameType : "coffee";
    this.state.timeLeft = this.cfg.roundSeconds;

    this.onMessage("tap", (client) => this.handleTap(client));
    this.onMessage("start", (client) => {
      if (client.sessionId === this.state.hostId && this.state.phase === "lobby") {
        this.startCountdown();
      }
    });
    this.onMessage("restart", (client) => {
      if (client.sessionId === this.state.hostId && this.state.phase === "finished") {
        this.resetRound();
      }
    });
  }

  private get cfg() {
    return GAMES[this.state.gameType];
  }

  onJoin(client: Client, options: any) {
    if (this.state.phase !== "lobby") throw new Error("Race already in progress");
    const player = new Player();
    player.name = String(options.name || "Player").trim().slice(0, 16) || "Player";
    player.characterId = String(options.characterId || "ayu").trim().slice(0, 24) || "ayu";
    this.state.players.set(client.sessionId, player);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.tapLog.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) {
      this.state.hostId = this.state.players.keys().next().value ?? "";
    }
    if (this.state.players.size === 0) this.disconnect();
  }

  private handleTap(client: Client) {
    if (this.state.phase !== "playing") return;
    const player = this.state.players.get(client.sessionId);
    if (!player || player.finished) return;

    // anti-cheat: sliding 1s window, reject superhuman tap rates
    const now = Date.now();
    const taps = (this.tapLog.get(client.sessionId) ?? []).filter(t => now - t < 1000);
    if (taps.length >= MAX_TAPS_PER_SEC) return;
    taps.push(now);
    this.tapLog.set(client.sessionId, taps);

    player.progress = Math.min(GOAL, player.progress + this.cfg.tapStep);
    if (player.progress >= GOAL) {
      player.finished = true;
      player.rank = ++this.finishCount;
      const allDone = Array.from(this.state.players.values()).every(p => p.finished);
      if (allDone) this.endRound();
    }
  }

  private startCountdown() {
    this.state.phase = "countdown";
    this.state.countdown = COUNTDOWN_SECONDS;
    this.countdownTimer = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        this.countdownTimer?.clear();
        this.beginPlay();
      }
    }, 1000);
  }

  private beginPlay() {
    this.state.phase = "playing";
    this.state.timeLeft = this.cfg.roundSeconds;
    this.roundTimer = this.clock.setInterval(() => {
      this.state.timeLeft--;
      if (this.state.timeLeft <= 0) this.endRound();
    }, 1000);
  }

  private endRound() {
    this.countdownTimer?.clear();
    this.roundTimer?.clear();
    const unfinished = Array.from(this.state.players.values())
      .filter(p => !p.finished)
      .sort((a, b) => b.progress - a.progress);
    for (const p of unfinished) {
      p.finished = true;
      p.rank = ++this.finishCount;
    }
    this.state.phase = "finished";
  }

  private resetRound() {
    this.finishCount = 0;
    this.tapLog.clear();
    this.state.players.forEach(p => {
      p.progress = 0;
      p.finished = false;
      p.rank = 0;
    });
    this.state.countdown = 0;
    this.state.timeLeft = this.cfg.roundSeconds;
    this.state.phase = "lobby";
  }
}