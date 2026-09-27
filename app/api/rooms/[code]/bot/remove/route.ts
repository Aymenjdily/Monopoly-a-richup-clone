import { NextResponse } from "next/server";

import { withRoomLock } from "@/lib/server/botRuntime";

import { broadcastGame } from "@/lib/server/gameService";
import { prisma } from "@/lib/prisma";
import { deserializeState, serializeState } from "@/lib/game/stateCodec";
import { removePlayer } from "@/lib/engine/lobby";

export const runtime = "nodejs";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  try {
    const body = (await request.json()) as {
      playerId?: unknown;
      secret?: unknown;
      botId?: unknown;
    };
    if (
      typeof body?.playerId !== "string" ||
      typeof body?.secret !== "string" ||
      typeof body?.botId !== "string"
    ) {
      return NextResponse.json({ error: "playerId, secret and botId are required" }, { status: 400 });
    }

    const game = await prisma.game.findUnique({ where: { code: normalized } });
    if (!game) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    const state = deserializeState(game.state);

    const host = state.players.find((p) => p.id === body.playerId);
    if (!host || host.secret !== body.secret || !host.isHost) {
      return NextResponse.json({ error: "Only the host can remove bots" }, { status: 403 });
    }
    const bot = state.players.find((p) => p.id === body.botId);
    if (!bot?.isBot) {
      return NextResponse.json({ error: "That seat is not a bot" }, { status: 400 });
    }

    try {
      removePlayer(state, body.botId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot remove bot.";
      const conflict = message.includes("after the game started");
      return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
    }

    await prisma.game.update({
      where: { id: game.id },
      data: { state: serializeState(state) as unknown as object, version: state.version },
    });
    broadcastGame(game.code, state);
    return NextResponse.json({ removed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove bot.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to remove bot" }, { status: 500 });
  }
}

/** Lobby writes are read-modify-write on one JSON row: serialize them per room (AGENTS.md trap 11). */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return withRoomLock(code.toUpperCase(), () => handlePOST(request, ctx));
}
