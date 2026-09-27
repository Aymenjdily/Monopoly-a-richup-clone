import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { deserializeState, publicRoomView } from "@/lib/game/stateCodec";
import { scheduleBotTurn } from "@/lib/server/botRuntime";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.toUpperCase();
  try {
    const game = await prisma.game.findUnique({ where: { code: normalized } });
    if (!game) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    const state = deserializeState(game.state);
    // Restart safety: a stalled bot turn self-heals on any snapshot read.
    if (game.status === "playing") scheduleBotTurn(game.code, 900);
    return NextResponse.json(publicRoomView(game.code, state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load room.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load room" }, { status: 500 });
  }
}
