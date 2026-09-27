/**
 * The single sanctioned boundary between the engine state and the Prisma `state` JSON
 * column. JSON.stringify converts numeric object keys to strings, so numeric ownership
 * keys must be remapped on load (AGENTS.md trap 8 / AGENTS.md section 8 decision 4).
 */
import { settingsOf } from "@/lib/engine/settings";
import type { GameState, OwnershipEntry } from "@/lib/engine/types";

type JsonSafeState = Omit<GameState, "ownership"> & {
  ownership: Record<string, OwnershipEntry>;
};

/** GameState → JSON-safe object (numeric keys become strings — that is fine on the way in). */
export function serializeState(state: GameState): JsonSafeState {
  return {
    ...state,
    ownership: Object.fromEntries(
      Object.entries(state.ownership).map(([k, v]) => [String(k), v])
    ),
  } as JsonSafeState;
}

/** Parsed DB JSON → GameState with numeric ownership keys restored. */
export function deserializeState(raw: unknown): GameState {
  const data = raw as JsonSafeState;
  if (!data || typeof data !== "object" || !Array.isArray((data as { players?: unknown }).players)) {
    throw new Error("Stored game state is malformed.");
  }
  const ownership: Record<number, OwnershipEntry> = {};
  for (const [key, value] of Object.entries(data.ownership ?? {})) {
    const idx = Number(key);
    if (!Number.isInteger(idx)) throw new Error(`Bad ownership key: ${key}`);
    ownership[idx] = value;
  }
  const players = (data.players as GameState["players"]).map((p) => ({
    ...p,
    secret: String(p.secret ?? ""),
  }));
  const { ownership: _omit, ...rest } = data;
  void _omit;
  return {
    ...(rest as unknown as GameState),
    players,
    ownership,
    pending: data.pending as GameState["pending"],
  };
}

/** Full state minus everything the browser must never see (AGENTS.md section 6). */
export function sanitizedClientState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, secret: "" })),
    decks: { chance: [], chest: [] },
  };
}

/** Public room view for GET /api/rooms/[code] — strictly non-gameplay fields. */
export function publicRoomView(code: string, state: GameState) {
  return {
    code,
    status: state.phase === "lobby" ? "lobby" : state.phase,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      colorToken: p.colorToken,
      isHost: p.isHost,
      isBot: p.isBot,
      connected: p.connected,
      bankrupt: p.bankrupt,
      money: p.money,
    })),
    settings: settingsOf(state),
  };
}
