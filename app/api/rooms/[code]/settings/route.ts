import { NextResponse } from "next/server";

import { withRoomLock } from "@/lib/server/botRuntime";

import { broadcastGame } from "@/lib/server/gameService";
import { prisma } from "@/lib/prisma";
import { deserializeState, serializeState } from "@/lib/game/stateCodec";
import { parseSettingsPatch, updateSettings } from "@/lib/engine/settings";

export const runtime = "nodejs";

/** Host-only room rules update (lobby phase). A rejected patch never mutates state. */
async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  try {
    const body = (await request.json()) as { playerId?: unknown; secret?: unknown; settings?: unknown };
    if (typeof body?.playerId !== "string" || typeof body?.secret !== "string") {
      return NextResponse.json({ error: "playerId and secret are required" }, { status: 400 });
    }
    const parsed = parseSettingsPatch(body.settings);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const game = await prisma.game.findUnique({ where: { code: normalized } });
    if (!game) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    const state = deserializeState(game.state);

    const host = state.players.find((p) => p.id === body.playerId);
    if (!host || host.secret !== body.secret || !host.isHost) {
      return NextResponse.json({ error: "Only the host can change the room rules" }, { status: 403 });
    }

    try {
      updateSettings(state, parsed.patch);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot update settings.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    await prisma.game.update({
      where: { id: game.id },
      data: { state: serializeState(state) as unknown as object, version: state.version },
    });
    broadcastGame(game.code, state);
    return NextResponse.json({ settings: state.settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

/** Lobby writes are read-modify-write on one JSON row: serialize them per room (AGENTS.md trap 11). */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return withRoomLock(code.toUpperCase(), () => handlePOST(request, ctx));
}
