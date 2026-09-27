// NOTE: no "server-only" import — the pages/api initializer lives in Next's
// Pages Router module system and treats it as client-marked. This module is only
// ever imported from API routes/handlers (run server-side only).
import { Server } from "socket.io";
import { randomInt } from "node:crypto";
import type { Server as HttpServer } from "node:http";

import { prisma } from "@/lib/prisma";
import { SOCKET_PATH, roomChannel } from "@/lib/shared/events";
import type { ClientToServerEvents, ServerToClientEvents, RoomIdentity } from "@/lib/shared/events";
import { getIoServer, setIoServer } from "@/lib/server/socketRef";
import { deserializeState, sanitizedClientState, publicRoomView } from "@/lib/game/stateCodec";
import { processGameAction, updatePresence } from "@/lib/server/gameService";
import { scheduleBotTurn } from "@/lib/server/botRuntime";

interface SocketLike {
  join: (room: string) => void;
  emit: <E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) => void;
}

interface LoadedRoom {
  code: string;
  status: string;
  view: ReturnType<typeof publicRoomView>;
  state: ReturnType<typeof deserializeState>;
}

async function readRoom(code: string): Promise<LoadedRoom | null> {
  try {
    const game = await prisma.game.findUnique({ where: { code } });
    if (!game) return null;
    const state = deserializeState(game.state);
    return { code: game.code, status: game.status, view: publicRoomView(game.code, state), state };
  } catch {
    return null;
  }
}

/**
 * Attach Socket.IO to the Next.js HTTP server (AGENTS.md trap 2). globalThis guard
 * (trap 3) survives dev hot reloads; a repeated attach is a cheap no-op.
 */
export function ensureSocketServer(
  res: { socket?: { server?: HttpServer } } & Record<string, unknown>
): void {
  if (getIoServer()) return;
  const httpServer = res.socket?.server;
  if (!httpServer) return;

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: SOCKET_PATH,
    addTrailingSlash: false,
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.on("room:join", async (payload, ack) => {
      const code = (payload?.code ?? "").toUpperCase();
      if (!code) {
        ack?.(false, "code required");
        return;
      }
      const room = await readRoom(code);
      if (!room) {
        ack?.(false, "Room not found");
        return;
      }
      if (payload.identity && ! identityValid(room, payload.identity)) {
        ack?.(false, "Not authorized for that seat");
        return;
      }
      socket.join(roomChannel(code));
      emitSnapshot(socket, room);
      ack?.(true);
      if (payload.identity) {
        // presence: this socket now speaks for that seat
        socket.data.seat = { code, playerId: payload.identity.playerId };
        cancelAway(code, payload.identity.playerId);
        void updatePresence(code, payload.identity.playerId, true);
      }
    });

    socket.on("disconnect", () => {
      const seat = socket.data.seat as { code: string; playerId: string } | undefined;
      if (!seat) return;
      // grace period: a page reload reconnects within a second or two, so don't flap the host
      cancelAway(seat.code, seat.playerId);
      const timer = setTimeout(async () => {
        awayTimers.delete(awayKey(seat.code, seat.playerId));
        const others = await io.in(roomChannel(seat.code)).fetchSockets();
        const stillHere = others.some((s) => (s.data.seat as { playerId?: string } | undefined)?.playerId === seat.playerId);
        if (!stillHere) void updatePresence(seat.code, seat.playerId, false);
      }, AWAY_GRACE_MS);
      timer.unref?.();
      awayTimers.set(awayKey(seat.code, seat.playerId), timer);
    });

    socket.on("state:request", async ({ code }) => {
      const room = await readRoom((code ?? "").toUpperCase());
      if (!room) {
        socket.emit("game:error", { code, message: "Room not found", kind: "not-found" });
        return;
      }
      emitSnapshot(socket, room);
      if (room.status === "playing") scheduleBotTurn(code, 900);
    });

    socket.on("game:action", async (payload, ack) => {
      const code = (payload.code ?? "").toUpperCase();
      const result = await processGameAction(code, payload.playerId, payload.secret, payload.action);
      if (!result.ok) {
        ack?.({ ok: false, error: result.error });
        socket.emit("game:error", {
          code,
          message: result.error ?? "Rejected action",
          kind: result.status === "auth" ? "auth" : result.status === "not-found" ? "not-found" : "reject",
        });
        return;
      }
      ack?.({ ok: true, version: result.version });
      const room = await readRoom(code);
      if (room) {
        emitSnapshot(socket, room);
        // The acting player's socket may be a bot turn next; kick the chain.
        if (room.status === "playing") scheduleBotTurn(code, 900);
      }
    });
  });

  setIoServer(io);
}

/** Memory-only presence timers (like bot timers: never part of engine state). */
const AWAY_GRACE_MS = 4000;
const awayTimers = new Map<string, ReturnType<typeof setTimeout>>();
const awayKey = (code: string, playerId: string) => `${code}:${playerId}`;
function cancelAway(code: string, playerId: string): void {
  const t = awayTimers.get(awayKey(code, playerId));
  if (t) clearTimeout(t);
  awayTimers.delete(awayKey(code, playerId));
}

function identityValid(room: LoadedRoom, identity: RoomIdentity): boolean {
  const player = room.state.players.find((p) => p.id === identity.playerId);
  return Boolean(player && player.secret === identity.secret);
}

function emitSnapshot(socket: SocketLike, room: LoadedRoom): void {
  socket.emit("room:state", { code: room.code, view: room.view });
  socket.emit("game:state", {
    code: room.code,
    version: room.state.version,
    state: sanitizedClientState(room.state),
  });
}

// Re-exported thin wrappers used by routes/tests (crypto-backed).
export function cryptoSeed(): number {
  return randomInt(0, 0xffffffff);
}
export { mulberry32 as rngForDev } from "@/lib/engine/rng";
