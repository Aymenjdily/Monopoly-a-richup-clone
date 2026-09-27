import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";

import { broadcastGame } from "@/lib/server/gameService";
import { prisma } from "@/lib/prisma";
import { deserializeState, serializeState } from "@/lib/game/stateCodec";
import { addBot } from "@/lib/engine/lobby";

export const runtime = "nodejs";

export async function POST(
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
    if (!game) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    const state = deserializeState(game.state);

    const host = state.players.find((p) => p.id === body.playerId);
    if (!host || host.secret !== body.secret || !host.isHost) {
      return NextResponse.json({ error: "Only the host can add bots" }, { status: 403 });
    }

    try {
      addBot(state, `bot-${randomInt(0x100000000).toString(16)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot add bot.";
      const conflict = message.includes("full") || message.includes("lobby");
      return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
    }

    await prisma.game.update({
      where: { id: game.id },
      data: { state: serializeState(state) as unknown as object, version: state.version },
    });
    broadcastGame(game.code, state);
    const bot = state.players[state.players.length - 1];
    return NextResponse.json({ botId: bot.id, botName: bot.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add bot.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to add bot" }, { status: 500 });
  }
}
