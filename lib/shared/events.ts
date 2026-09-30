import type { RoomSettings } from "@/lib/engine/settings";
import type { GameState, LogEvent } from "@/lib/engine/types";

/**
 * Shared Socket.IO event contract (AGENTS.md section 10) — imported by both the server
 * and client code so drift fails the build, not a live game.
 */

export interface RoomIdentity {
  playerId: string;
  secret: string;
  name?: string;
}

export type ClientToServerEvents = {
  /** Join the Socket.IO channel for a room; server validates identity or opens viewer. */
  "room:join": (payload: { code: string; identity?: RoomIdentity }, ack: (ok: boolean, error?: string) => void) => void;
  /** Request the current snapshot (reconnect or late-join). */
  "state:request": (payload: { code: string }) => void;
  /** Submit one game action; a rejected action never mutates state. */
  "game:action": (
    payload: { code: string; playerId: string; secret: string; action: { type: string } & Record<string, unknown> },
    ack: (result: { ok: boolean; version?: number; error?: string }) => void
  ) => void;
};

export type ServerToClientEvents = {
  /** Full public room view (lobby). */
  "room:state": (payload: { code: string; view: RoomPublicView }) => void;
  /** Sanitized engine state after each committed action (stale detection via version). */
  "game:state": (payload: { code: string; version: number; state: ClientGameState }) => void;
  /** Rejected action / error; carries a stable short code plus a human message. */
  "game:error": (payload: { code: string; message: string; kind: "auth" | "reject" | "not-found" | "server" }) => void;
};

/** Mirrors stateCodec.publicRoomView — kept in lock-step by tests. */
export interface RoomPublicView {
  code: string;
  status: string;
  players: {
    id: string;
    name: string;
    colorToken: string;
    isHost: boolean;
    isBot: boolean;
    botStyle?: "cautious" | "balanced" | "aggressive";
    connected: boolean;
    bankrupt: boolean;
    money: number;
  }[];
  /** Host-chosen room rules (read-only for everyone else). */
  settings: RoomSettings;
}

/** Engine state as delivered to clients (secrets + decks stripped by stateCodec). */
export type ClientGameState = Omit<GameState, "log"> & {
  log: (Omit<LogEvent, "id"> & { id?: number })[];
};

export const SOCKET_PATH = "/api/socketio";

/** Channel name per game room. */
export function roomChannel(code: string): string {
  return `game:${code.toUpperCase()}`;
}
