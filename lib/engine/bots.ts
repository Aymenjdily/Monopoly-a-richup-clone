/**
 * Bot strategy chooser (AGENTS.md decision 13). PURE — no timers, no IO: the server
 * runtime asks here whenever it is a bot's turn and applies the returned action.
 */
import { JAIL_FINE } from "./types";
import type { GameAction, GameState } from "./types";

/** Bots keep this much cash on hand; below it a pending buy is declined. */
export const BOT_BUY_RESERVE = 150;

export function botChoose(state: GameState): GameAction | null {
  const player = state.players[state.turn.playerIdx];
  if (!player || !player.isBot || player.bankrupt) return null;

  if (state.turn.phase === "preRoll") {
    if (player.inJail) {
      if (player.jailCards > 0) return { type: "useJailCard" };
      if (player.money >= JAIL_FINE * 2) return { type: "payJailFine" };
    }
    return { type: "roll" };
  }

  if (state.turn.phase === "awaitingAction") {
    const pending = state.pending;
    if (pending?.type === "buy") {
      return player.money >= pending.price + BOT_BUY_RESERVE
        ? { type: "buy" }
        : { type: "decline" };
    }
    return { type: "endTurn" };
  }

  return null;
}
