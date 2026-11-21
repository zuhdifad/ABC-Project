import Phaser from "phaser";
import type { Room } from "colyseus.js";
import { THEMES, GOAL, BAR_X, BAR_W, type Lane, type GameTheme } from "../games/registry";
import { GAME_FONT } from "../flow/theme";
import { audio } from "../flow/audio";
import { charTextureKey, sizeSprite } from "../flow/characters";

const W = 960;
const H = 600;

/**
 * Shared race renderer for ALL mini-games.
 * Networking, lanes, countdown, podium live here;
 * each game's look comes from its GameTheme in games/registry.ts.
 */
export class RaceScene extends Phaser.Scene {
  private room!: Room;
  private theme!: GameTheme;
  private lanes = new Map<string, Lane>();
  private phaseText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private results?: Phaser.GameObjects.Container;
  private onExit?: (result?: { rank: number; progress: number }) => void;
  private exited = false;
  private lastResult?: { rank: number; progress: number };

  constructor() { super("Race"); }

  init(data: { room: Room; onExit?: (result?: { rank: number; progress: number }) => void }) {
    this.room = data.room;
    this.onExit = data.onExit;
    this.exited = false;
    this.lastResult = undefined;
    this.lanes.clear();
    this.results = undefined;
  }

  create() {
    this.room.onLeave(() => this.exitOnce());
    this.events.once("shutdown", () => {
      if ((this.room as any).connection?.isOpen) this.room.leave();
    });

    // Right after join, room.state may still hold schema defaults
    // (gameType "coffee", empty players). Wait for the first server
    // patch so the correct theme/title is used for every game.
    const state: any = this.room.state;
    if (state.players.size > 0) {
      this.build();
    } else {
      this.room.onStateChange.once(() => this.build());
    }
  }

  private build() {
    const state: any = this.room.state;
    this.theme = THEMES[state.gameType] ?? THEMES.coffee;
    document.body.classList.add("scene-race");
    document.body.classList.remove("scene-city", "scene-office", "scene-room");

    // header sits below the top edge so it never crowds the HUD
    this.add.text(24, 62, this.theme.title,
      { fontFamily: GAME_FONT, fontSize: "30px", color: "#16324a" });
    this.add.text(24, 98, this.theme.subtitle,
      { fontSize: "15px", color: "#6b7f8c" });
    this.add.text(W - 24, 64, `Room: ${this.room.roomId}`,
      { fontFamily: GAME_FONT, fontSize: "20px", color: "#c9922f" }).setOrigin(1, 0);
    this.add.text(W - 24, 92, "share this code with friends",
      { fontSize: "12px", color: "#6b7f8c" }).setOrigin(1, 0);

    this.theme.decorate(this);

    this.timerText = this.add.text(W - 24, 116, "", { fontFamily: GAME_FONT, fontSize: "24px", color: "#16324a" }).setOrigin(1, 0);
    this.phaseText = this.add.text(W / 2, 145, "", { fontFamily: GAME_FONT, fontSize: "38px", color: "#2e8f88" }).setOrigin(0.5);
    this.hint = this.add.text(W / 2, H - 70, "Mash SPACE / any key — or tap the screen rapidly!",
      { fontSize: "16px", color: "#6b7f8c" }).setOrigin(0.5);

    this.startButton = this.add.text(W / 2, H - 108, "▶  START RACE", {
      fontFamily: GAME_FONT, fontSize: "26px", color: "#f7e3b4",
      backgroundColor: "#16324a", padding: { x: 24, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.startButton.on("pointerdown", () => this.room.send("start"));

    state.players.onAdd((player: any, sid: string) => this.addLane(sid, player));
    state.players.onRemove((_p: any, sid: string) => this.removeLane(sid));

    state.listen("phase", (phase: string) => this.onPhase(phase), true);
    state.listen("countdown", (n: number) => {
      if (state.phase === "countdown" && n > 0) {
        audio.beep();
        this.phaseText.setText(String(n)).setFontSize(48).setScale(1.6);
        this.tweens.add({ targets: this.phaseText, scale: 1, duration: 400 });
      }
    });

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (!e.repeat) this.sendTap();
    });
    this.input.on("pointerdown", () => this.sendTap());
  }

  private addLane(sid: string, player: any) {
    const y = 175 + this.lanes.size * 60;
    const isSelf = sid === this.room.sessionId;

    const nameText = this.add.text(24, y - 10, player.name + (isSelf ? " (you)" : ""),
      { fontFamily: GAME_FONT, fontSize: "18px", color: isSelf ? "#14615c" : "#4a5b68" });
    const avatar = sizeSprite(
      this.add.image(0, 0, charTextureKey(player.characterId)), 54
    ).setOrigin(0.5, 1);
    this.add.rectangle(BAR_X, y + 16, BAR_W, 12, 0xe2ded2).setOrigin(0, 0.5);
    const barFill = this.add.rectangle(BAR_X, y + 16, 0, 12, isSelf ? 0x2e8f88 : 0xa9d9d4).setOrigin(0, 0.5);
    const pctText = this.add.text(BAR_X + BAR_W + 16, y + 16, "0%",
      { fontFamily: GAME_FONT, fontSize: "16px", color: "#6b7f8c" }).setOrigin(0, 0.5);
    const rankText = this.add.text(24, y + 12, "", { fontFamily: GAME_FONT, fontSize: "16px", color: "#c9922f" });

    const lane: Lane = {
      sid, baseY: y, nameText, avatar, barFill, pctText, rankText,
      display: 0, lastProgress: 0, lastAdvance: 0
    };
    this.theme.setupLane(this, lane);
    this.lanes.set(sid, lane);
  }

  private removeLane(sid: string) {
    const lane = this.lanes.get(sid);
    if (!lane) return;
    [lane.nameText, lane.avatar, lane.barFill, lane.pctText, lane.rankText, lane.extra]
      .forEach(o => o?.destroy());
    this.lanes.delete(sid);
  }

  private sendTap() {
    if ((this.room.state as any)?.phase !== "playing") return;
    this.room.send("tap");
    audio.tap();
    const mine = this.lanes.get(this.room.sessionId);
    if (mine) {
      /* tween around the fitted scale — a raw `scale: 1.3` would undo sizeSprite() */
      const base = (mine.avatar.getData("baseScale") as number) || mine.avatar.scaleX;
      this.tweens.add({
        targets: mine.avatar, scaleX: base * 1.3, scaleY: base * 1.3,
        duration: 60, yoyo: true
      });
    }
  }

  private onPhase(phase: string) {
    if (phase === "lobby") {
      this.results?.destroy();
      this.results = undefined;
      this.phaseText.setText("Waiting for host to start…").setFontSize(24);
    } else if (phase === "playing") {
      audio.go();
      this.phaseText.setText("GO!").setFontSize(56);
      this.time.delayedCall(700, () => this.phaseText.setText(""));
    } else if (phase === "finished") {
      const me: any = (this.room.state as any).players.get(this.room.sessionId);
      this.lastResult = me ? { rank: me.rank, progress: me.progress } : undefined;
      if (me?.rank === 1) audio.win(); else audio.lose();
      this.phaseText.setText("");
      this.showResults();
    }
  }

  private exitOnce() {
    if (this.exited) return;
    this.exited = true;
    this.onExit?.(this.lastResult);
  }

  private showResults() {
    const state: any = this.room.state;
    const players = Array.from(state.players.values() as any[])
      .sort((a: any, b: any) => a.rank - b.rank);
    const medals = ["🥇", "🥈", "🥉"];
    const winner: any = players[0];

    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.92));
    c.add(this.add.text(W / 2, 130, `🏆 ${winner?.name ?? "?"} wins!`,
      { fontFamily: GAME_FONT, fontSize: "38px", color: "#16324a" }).setOrigin(0.5));

    players.forEach((p: any, i: number) => {
      c.add(this.add.text(W / 2, 190 + i * 34,
        `${medals[i] ?? "▪"}  #${p.rank}  ${p.name} — ${Math.floor(p.progress)}%`,
        { fontFamily: GAME_FONT, fontSize: "21px", color: "#16324a" }).setOrigin(0.5));
    });

    const btnY = 220 + players.length * 34;
    if (state.hostId === this.room.sessionId) {
      const again = this.add.text(W / 2 - 110, btnY, "🔄 Play Again", {
        fontFamily: GAME_FONT, fontSize: "22px", color: "#f7e3b4", backgroundColor: "#16324a", padding: { x: 18, y: 8 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      again.on("pointerdown", () => this.room.send("restart"));
      c.add(again);
    }
    const leave = this.add.text(W / 2 + 110, btnY, "🚪 Leave", {
      fontFamily: GAME_FONT, fontSize: "22px", color: "#14615c", backgroundColor: "#e3f1ee", padding: { x: 18, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    leave.on("pointerdown", () => { this.room.leave(); });
    c.add(leave);
    this.results = c;
  }

  update(time: number, delta: number) {
    // build() may not have run yet (waiting for the first state patch)
    if (!this.startButton) return;
    const state: any = this.room.state;
    if (!state) return;

    this.startButton.setVisible(state.phase === "lobby" && state.hostId === this.room.sessionId);
    this.hint.setVisible(state.phase === "playing");
    this.timerText.setText(state.phase === "playing" ? `⏱ ${state.timeLeft}s` : "");

    this.lanes.forEach(lane => {
      const p: any = state.players.get(lane.sid);
      if (!p) return;

      // reset detection after a restart
      if (p.progress < lane.lastProgress) lane.lastProgress = p.progress;
      if (p.progress > lane.lastProgress) {
        lane.lastProgress = p.progress;
        lane.lastAdvance = time;
      }
      lane.display += (p.progress - lane.display) * Math.min(1, delta / 120);
      const ratio = lane.display / GOAL;

      lane.barFill.width = BAR_W * ratio;
      lane.pctText.setText(`${Math.floor(lane.display)}%`);
      lane.rankText.setText(p.finished && p.rank > 0 ? `🏁 #${p.rank}` : "");

      this.theme.updateLane(lane, p, time);
    });
  }
}