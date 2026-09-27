import { NextResponse } from "next/server";

import { processGameAction } from "@/lib/server/gameService";
import { ensureSocketServer } from "@/lib/server/socketServer";

export const runtime = "nodejs";

/**
 * Interim HTTP transport for game actions (Socket.IO is now primary — AGENTS.md
 * section 10). Both hit the same processGameAction pipeline; bots too.
 */
export async function POST(
  request: Request & { socket?: unknown },
  { params }: { params: Promise<{ code: string }> }
) {
  ensureSocketServer(request as never);
  const { code } = await params;
  const normalized = code.toUpperCase();

  try {
    const body = (await request.json()) as {
      playerId?: unknown;
      secret?: unknown;
      action?: { type?: unknown };
    };
    if (
      typeof body?.playerId !== "string" ||
      typeof body?.secret !== "string" ||
      typeof body?.action?.type !== "string"
    ) {
      return NextResponse.json(
        { error: "playerId, secret and action.type are required" },
        { status: 400 }
      );
    }
    const result = await processGameAction(normalized, body.playerId, body.secret, body.action as { type: string });
    if (!result.ok) {
      const status = result.status === "auth" ? 403 : result.status === "not-found" ? 404 : 400;
      return NextResponse.json({ error: result.error ?? "Rejected" }, { status });
    }
    return NextResponse.json({ version: result.version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    if (message.includes("DATABASE_URL is not set")) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
