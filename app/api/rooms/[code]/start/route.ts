import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";

import { withRoomLock } from "@/lib/server/botRuntime";

import { broadcastGame } from "@/lib/server/gameService";
import { prisma } from "@/lib/prisma";
import { deserializeState, serializeState } from "@/lib/game/stateCodec";
import { startGame } from "@/lib/engine/lobby";
import { mulberry32 } from "@/lib/engine/rng";
import { scheduleBotTurn } from "@/lib/server/botRuntime";

export const runtime = "nodejs";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  try {
    const body = (await request.json()) as { playerId?: unknown; secret?: unknown };
    if (typeof body?.playerId !== "string" || typeof body?.secret !== "string") {
      return NextResponse.json({ error: "playerId and secret are required" }, { status: 400 });
    }

    const game = await prisma.game.findUnique({ where: { code: normalized } });
    if (!game) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    const state = deserializeState(game.state);
    const host = state.players.find((p) => p.id === body.playerId);
    if (!host || host.secret !== body.secret) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (!host.isHost) {
      return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
    }

    // Seed the deck RNG from crypto randomness; the engine stays deterministic given a seed.
    const seed = randomInt(0, 0xffffffff) >>> 0;
    let newState;
    try {
      newState = startGame(state, mulberry32(seed));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Start failed.";
      const conflict = message.includes("2 players");
      return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
    }

    await prisma.game.update({
      where: { id: game.id },
      data: {
        status: "playing",
        state: serializeState(newState) as unknown as object,
        version: newState.version,
      },
    });
    // Every client in the room switches from lobby to board on this broadcast.
    broadcastGame(game.code, newState);
    // If the first player is a bot, its turn kicks in after a beat.
    scheduleBotTurn(game.code, 1200);
    return NextResponse.json({ started: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Start failed.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to start room" }, { status: 500 });
  }
}

/** Lobby writes are read-modify-write on one JSON row: serialize them per room (AGENTS.md trap 11). */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return withRoomLock(code.toUpperCase(), () => handlePOST(request, ctx));
}
