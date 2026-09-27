import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { lobbyState } from "@/lib/engine/lobby";
import { serializeState } from "@/lib/game/stateCodec";
import { newPlayerId, newSecret } from "@/lib/server/secrets";

export const runtime = "nodejs";

// Unambiguous join-code alphabet: no 0/O, 1/I/L.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function POST(request: Request) {
  let name = "Host";
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body?.name === "string" && body.name.trim().length > 0) {
      name = body.name.trim().slice(0, 20);
    }
  } catch {
    // empty body is fine; nickname optional
  }

  const hostId = newPlayerId();
  const hostSecret = newSecret();
  const state = lobbyState({ id: hostId, name });
  state.players[0].secret = hostSecret;

  const code = await generateRoomCode();
  try {
    const game = await prisma.game.create({
      data: {
        code,
        status: "lobby",
        state: serializeState(state) as unknown as object,
        version: 0,
      },
    });
    return NextResponse.json(
      { code, gameId: game.id, playerId: hostId, secret: hostSecret },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function generateRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = Array.from(
      { length: 6 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    ).join("");
    const exists = await prisma.game.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Could not allocate a room code.");
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to create room.";
  if (message.includes("DATABASE_URL is not set")) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
}
