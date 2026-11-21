/**
 * GAME REGISTRY (server side)
 * ---------------------------
 * This is the "space" for future mini-games.
 * To add a new game:
 *   1. Add an entry here (tuning: tapStep + roundSeconds).
 *   2. Add a matching theme in client/src/games/registry.ts.
 * The RaceRoom engine (lobby, countdown, tap validation, ranking) is shared.
 */

export interface GameConfig {
  /** progress added per valid tap (goal is 100) */
  tapStep: number;
  /** max round duration in seconds */
  roundSeconds: number;
}

export const GAMES: Record<string, GameConfig> = {
  // ☕ Race to finish drinking coffee — short, frantic chug
  coffee: { tapStep: 2, roundSeconds: 30 },
  // 🏃 Race to walk from the station to the office — longer sprint
  walk: { tapStep: 1.25, roundSeconds: 45 }
};