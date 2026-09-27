/**
 * Integer-only money helpers (AGENTS.md trap 10). No floating point, ever.
 * They mutate the player record in place and log the movement.
 */
import { logEvent, type GameState, type LogEventKind } from "./types";

interface MoneyOptions {
  actor?: string;
  /** Kind used for the log entry; defaults to "money". */
  kind?: LogEventKind;
}

export function charge(
  state: GameState,
  playerId: string,
  amount: number,
  reason: string,
  options: MoneyOptions = {}
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  const clamped = Math.max(0, Math.min(Math.round(amount), player.money));
  player.money -= clamped;
  logEvent(state, options.kind ?? "money", reason, {
    actor: options.actor ?? player.name,
    amount: -clamped,
  });
  return clamped;
}

export function credit(
  state: GameState,
  playerId: string,
  amount: number,
  reason: string,
  options: MoneyOptions = {}
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  const clamped = Math.max(0, Math.round(amount));
  player.money += clamped;
  logEvent(state, options.kind ?? "money", reason, {
    actor: options.actor ?? player.name,
    amount: clamped,
  });
  return clamped;
}
