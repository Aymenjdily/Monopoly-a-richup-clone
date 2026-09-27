import "@/lib/server/serverOnly";

import type { Server as IOServer } from "socket.io";

/**
 * globalThis-cached reference to the process-wide Socket.IO server (AGENTS.md trap 2/3).
 * Dev hot reloads must never re-create the IO server or every save drops connections.
 */
interface Glock {
  __socketIo?: IOServer;
  __socketIoInitAt?: number;
}

const g = globalThis as typeof globalThis & Glock;

export function setIoServer(io: IOServer): void {
  g.__socketIo = io;
  g.__socketIoInitAt = Date.now();
}

export function getIoServer(): IOServer | undefined {
  return g.__socketIo;
}
