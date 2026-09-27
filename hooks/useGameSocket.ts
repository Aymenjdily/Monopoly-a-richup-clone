"use client";

/**
 * StrictMode-safe game socket (AGENTS.md traps 4): the Socket.IO client is a module
 * singleton per room code; effects only (re)subscribe listeners. Connect happens once;
 * socket.io's built-in reconnect handles drops, and `state:request` refreshes us.
 */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import {
  SOCKET_PATH,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type RoomPublicView,
  type ClientGameState,
} from "@/lib/shared/events";
import { SOCKET_ATTACH_URL } from "./protocol";

export interface GameSocketState {
  connected: boolean;
  room: RoomPublicView | null;
  game: { code: string; version: number; state: ClientGameState } | null;
  error: { code: string; message: string; kind: string } | null;
}

export interface GameSocketApi {
  state: GameSocketState;
  sendAction: (
    action: { type: string } & Record<string, unknown>,
    onDone?: (ok: boolean, version?: number, error?: string) => void
  ) => void;
}

const store = (() => {
  const g = globalThis as typeof globalThis & {
    __gameSocketStore?: Map<string, GameSocketEntry>;
  };
  return (g.__gameSocketStore ??= new Map());
})();

interface GameSocketEntry {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  listeners: Set<(s: GameSocketEntry) => void>;
  state: GameSocketState;
  joinedCode: string | null;
  joinedRegistration?: boolean;
}

function entryFor(code: string): GameSocketEntry {
  let entry = store.get(code);
  if (!entry) {
    entry = {
      // Socket.IO lives on SOCKET_PATH; SOCKET_ATTACH_URL is only the HTTP route that boots it.
      socket: io({ path: SOCKET_PATH, autoConnect: false, transports: ["websocket", "polling"] }),
      listeners: new Set(),
      state: { connected: false, room: null, game: null, error: null },
      joinedCode: null,
    };
    store.set(code, entry);
  }
  return entry;
}

export function useGameSocket(
  code: string,
  identity: { playerId: string; secret: string } | null
): GameSocketApi {
  const [state, setState] = useState<GameSocketState>(
    () => ({ connected: false, room: null, game: null, error: null })
  );
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    const entry = entryFor(code);

    if (!entry.joinedRegistration) {
      entry.joinedRegistration = true;

      entry.socket.on("connect", () => {
        apply(entry, { connected: true });
        const id = identityRef.current;
        entry.socket.emit("room:join", { code, identity: id ? { playerId: id.playerId, secret: id.secret } : undefined }, (ok, error) => {
          if (ok) {
            entry.joinedCode = code;
            apply(entry, { error: null });
          } else {
            apply(entry, { error: { code, message: error ?? "join failed", kind: "auth" } });
          }
        });
      });

      entry.socket.on("disconnect", () => apply(entry, { connected: false }));
      entry.socket.on("room:state", (payload) => apply(entry, { room: payload.view }));
      entry.socket.on("game:state", (payload) => apply(entry, { game: { code: payload.code, version: payload.version, state: payload.state } }));
      entry.socket.on("game:error", (payload) => apply(entry, { error: payload }));
    }

    if (!entry.socket.connected) {
      entry.socket.connect();
      // Attach the Socket.IO server (first request bootstraps it in dev/HMR).
      fetch(SOCKET_ATTACH_URL, { method: "GET" }).catch(() => undefined);
    } else if (entry.joinedCode === code) {
      const id = identityRef.current;
      entry.socket.emit("room:join", { code, identity: id ? { playerId: id.playerId, secret: id.secret } : undefined }, () => {});
    }

    const listener = (e: GameSocketEntry) => setState(e.state);
    entry.listeners.add(listener);
    setState(entry.state);

    return () => {
      entry.listeners.delete(listener);
    };
  }, [code]);

  // Late identity (lobby join resolves after mount): refresh our snapshot.
  useEffect(() => {
    if (!identity?.playerId) return;
    const entry = entryFor(code);
    if (entry.socket.connected && entry.joinedCode === code) {
      entry.socket.emit("state:request", { code });
    }
  // Only a *new* identity should trigger a refresh — the object itself is recreated every render.
  }, [identity?.playerId, code]);

  return {
    state,
    sendAction: (action, onDone) => {
      const entry = entryFor(code);
      if (!entry.socket.connected) {
        onDone?.(false, undefined, "offline");
        return;
      }
      const id = identityRef.current;
      entry.socket.emit(
        "game:action",
        { code, playerId: id?.playerId ?? "", secret: id?.secret ?? "", action },
        (result) => onDone?.(result.ok, result.version, result.error)
      );
    },
  };
}

function apply(entry: GameSocketEntry, patch: Partial<GameSocketState>) {
  entry.state = { ...entry.state, ...patch };
  entry.listeners.forEach((fn) => fn(entry));
}
