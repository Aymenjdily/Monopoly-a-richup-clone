import { NextResponse } from "next/server";

import { leaveLobby } from "@/lib/engine/lobby";
import { deserializeState, serializeState } from "@/lib/game/stateCodec";
import { prisma } from "@/lib/prisma";
import { withRoomLock } from "@/lib/server/botRuntime";
import { broadcastGame } from "@/lib/server/gameService";

export const runtime = "nodejs";

/**
 * Leave the lobby: frees the seat (host passes to the next human). In a started game,
 * leaving is the `leaveRoom` game action (a forfeit) instead — see lib/engine/engine.ts.
 */
async function handlePOST(request: Request, { params }: { params: Promise<{ code: string }> }) {
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
    const me = state.players.find((p) => p.id === body.playerId);
    if (!me || me.secret !== body.secret) {
      return NextResponse.json({ error: "Not your seat" }, { status: 403 });
    }
    if (state.phase !== "lobby") {
      return NextResponse.json({ error: "The game has started — leave from the game screen." }, { status: 409 });
    }
    leaveLobby(state, me.id);
    await prisma.game.update({
      where: { id: game.id },
      data: { state: serializeState(state) as unknown as object, version: state.version },
    });
    broadcastGame(game.code, state);
    return NextResponse.json({ left: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to leave.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to leave the room" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return withRoomLock(code.toUpperCase(), () => handlePOST(request, ctx));
}
