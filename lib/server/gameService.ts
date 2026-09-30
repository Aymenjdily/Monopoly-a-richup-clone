import "@/lib/server/serverOnly";

import { prisma } from "@/lib/prisma";
import { deserializeState, sanitizedClientState, serializeState, publicRoomView } from "@/lib/game/stateCodec";
import { applyAction } from "@/lib/engine/engine";
import { setPresence } from "@/lib/engine/lobby";
import type { GameAction, GameState } from "@/lib/engine/types";
import type { RoomPublicView } from "@/lib/shared/events";
import { roomChannel } from "@/lib/shared/events";
import { getIoServer } from "@/lib/server/socketRef";
import { withRoomLock } from "@/lib/server/botRuntime";

/**
 * Shared action pipeline for every mutating path (HTTP route, socket handler, bot
 * runtime): one lock per room, one applyAction, one persist, one broadcast.
 */

export interface ActionResult {
  ok: boolean;
  status: "ok" | "auth" | "reject" | "not-found" | "server";
  version?: number;
  error?: string;
}

export function broadcastGame(code: string, state: GameState): void {
  const io = getIoServer();
  if (!io) return;
  io.to(roomChannel(code)).emit("game:state", {
    code,
    version: state.version,
    state: sanitizedClientState(state),
  });
  io.to(roomChannel(code)).emit("room:state", {
    code,
    view: publicRoomView(code, state) as RoomPublicView,
  });
}

export async function loadGameState(code: string) {
  const game = await prisma.game.findUnique({ where: { code: code.toUpperCase() } });
  if (!game) return null;
  const state = deserializeState(game.state);
  return { game, state } as const;
}

export async function persistGameState(gameId: string, code: string, state: GameState): Promise<void> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: state.phase,
      state: serializeState(state) as unknown as object,
      version: state.version,
    },
  });
  broadcastGame(code, state);
}

export async function processGameAction(
  code: string,
  playerId: string,
  secret: string,
  action: { type: string } & Record<string, unknown>
): Promise<ActionResult> {
  return withRoomLock(code.toUpperCase(), () =>
    runActionTransaction(code.toUpperCase(), playerId, secret, action as unknown as GameAction)
  );
}

async function runActionTransaction(
  code: string,
  playerId: string,
  secret: string,
  action: { type: string } & Record<string, unknown>
): Promise<ActionResult> {
  try {
    const loaded = await loadGameState(code);
    if (!loaded) return { ok: false, status: "not-found", error: "Room not found" };
    const actor = loaded.state.players.find((p) => p.id === playerId);
    if (!actor || actor.isBot || actor.secret !== secret) {
      return { ok: false, status: "auth", error: "Not authorized" };
    }

    const rng = mulberry32((cryptoRandomSeed() ^ (loaded.state.logSeq + 7919)) >>> 0);
    const result = applyAction({
      state: loaded.state,
      playerId,
      action: action as unknown as GameAction,
      rng,
    });
    if (!result.ok) {
      return { ok: false, status: "reject", error: result.error ?? "Rejected action" };
    }

    await persistGameState(loaded.game.id, code, result.state);
    return { ok: true, status: "ok", version: result.state.version };
  } catch (error) {
    return {
      ok: false,
      status: "server",
      error: error instanceof Error ? error.message : "Action failed",
    };
  }
}

import { mulberry32 } from "@/lib/engine/rng";
import { randomInt } from "node:crypto";

function cryptoRandomSeed(): number {
  return randomInt(0, 0xffffffff);
}

/**
 * Presence change from the socket layer (AGENTS.md decision 6): marks a player connected /
 * away and hands the host role on when the host leaves. Serialized with every other write.
 */
export async function updatePresence(code: string, playerId: string, connected: boolean): Promise<void> {
  const normalized = code.toUpperCase();
  await withRoomLock(normalized, async () => {
    try {
      const loaded = await loadGameState(normalized);
      if (!loaded) return;
      if (setPresence(loaded.state, playerId, connected)) {
        await persistGameState(loaded.game.id, normalized, loaded.state);
      }
    } catch {
      // presence is best-effort; never crash the socket server over it
    }
  });
}
