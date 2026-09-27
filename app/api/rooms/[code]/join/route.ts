import { NextResponse } from "next/server";

import { broadcastGame } from "@/lib/server/gameService";
import { prisma } from "@/lib/prisma";
import { deserializeState, serializeState } from "@/lib/game/stateCodec";
import { joinLobby } from "@/lib/engine/lobby";
import { newPlayerId, newSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  let name = "Player";
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body?.name === "string" && body.name.trim().length > 0) {
      name = body.name.trim().slice(0, 20);
    }
  } catch {
    // empty body ok
  }

  try {
    const game = await prisma.game.findUnique({ where: { code: normalized } });
    if (!game) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    const state = deserializeState(game.state);
    const playerId = newPlayerId();
    const secret = newSecret();
    try {
      joinLobby(state, { id: playerId, name });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Join failed.";
      const isFull = message.includes("full");
      return NextResponse.json(
        { error: message },
        { status: isFull || message.includes("already started") ? 409 : 400 }
      );
    }
    state.players[state.players.length - 1].secret = secret;
    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { state: serializeState(state) as unknown as object, version: state.version },
    });
    void updated;
    // Live lobby: everyone in the room channel sees the new seat.
    broadcastGame(game.code, state);
    return NextResponse.json({ playerId, secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Join failed.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
