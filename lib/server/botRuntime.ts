import "@/lib/server/serverOnly";

import { prisma } from "@/lib/prisma";
import { persistGameState } from "./gameService";
import { applyAction } from "@/lib/engine/engine";
import { botChoose } from "@/lib/engine/bots";
import { deserializeState } from "@/lib/game/stateCodec";
import { mulberry32, type Rng } from "@/lib/engine/rng";
import type { GameAction, GameState } from "@/lib/engine/types";

/**
 * Memory-only bot turn scheduler (AGENTS.md decision 13). NEVER part of engine state.
 * Every snapshot read re-kicks the chain if it is a bot's turn, so a server restart
 * self-heals from the DB.
 */
const scheduled = new Set<string>();
const lastActedVersion = new Map<string, number>();

/** Serialize room read-modify-write cycles (AGENTS.md trap 11). */
const roomLocks = new Map<string, Promise<unknown>>();

export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const prev = roomLocks.get(code) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  roomLocks.set(code, next);
  try {
    return await next;
  } finally {
    if (roomLocks.get(code) === next) roomLocks.delete(code);
  }
}

function seedFor(gameId: string, logSeq: number): number {
  let h = 2166136261;
  for (const c of gameId) h = (h * 16777619) ^ c.charCodeAt(0);
  return (h ^ logSeq) >>> 0;
}

function rngFor(state: GameState & { __gameId?: string }, gameId: string): Rng {
  return mulberry32(seedFor(gameId, state.logSeq + state.version));
}

/** Idempotent: one pending setTimeout per game at a time. */
export function scheduleBotTurn(code: string, delay = 800): void {
  if (scheduled.has(code)) return;
  scheduled.add(code);
  const timer = setTimeout(() => {
    scheduled.delete(code);
    void runBotTurn(code);
  }, delay);
  // keep the process from being held open purely by a pending bot move in dev
  timer.unref?.();
}

async function runBotTurn(code: string): Promise<void> {
  await withRoomLock(code, async () => {
    let game;
    try {
      game = await prisma.game.findUnique({ where: { code } });
    } catch {
      return;
    }
    if (!game || game.status !== "playing") return;

    const state = deserializeState(game.state);
    const actor = state.players[state.turn.playerIdx];
    if (!actor?.isBot || actor.bankrupt) return;

    // Never act twice on the same engine version (protects against tight retry loops).
    const last = lastActedVersion.get(code) ?? -1;
    if (last === game.version) return;
    lastActedVersion.set(code, game.version);

    const action: GameAction | null = botChoose(state);
    if (!action) return;

    const result = applyAction({
      state,
      playerId: actor.id,
      action,
      rng: rngFor(state, game.id),
    });
    if (!result.ok) return; // state stays authoritative; next snapshot read can retry later

    await persistGameState(game.id, game.code, result.state);
    scheduleBotTurn(code, 1000);
  });
}

/** Called after a confirmed human action too (Phase 4 will move this to the socket layer). */
export function kickIfBotTurn(code: string, state: GameState, gameId: string): void {
  const actor = state.players[state.turn.playerIdx];
  if (actor?.isBot && !actor.bankrupt && state.phase === "playing") {
    scheduleBotTurn(code, 800);
  }
  void gameId;
}
