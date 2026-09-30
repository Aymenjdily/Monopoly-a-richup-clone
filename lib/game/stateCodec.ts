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
  const log = Array.isArray(data.log) ? data.log.map((e) => ({ ...e, text: repairText(e.text) })) : data.log;
  return {
    ...(rest as unknown as GameState),
    players,
    ownership,
    log,
    pending: data.pending as GameState["pending"],
  };
}

/**
 * Games saved before an encoding fix have UTF-8 dashes/emoji stored as mis-decoded text
 * (an em dash showed up as three Latin-1/cp1252 characters). Repair them on load.
 */
// Built from char codes on purpose: literal mojibake in source is how this bug started.
const chars = (...codes: number[]) => String.fromCodePoint(...codes);
const MOJIBAKE: [string, string][] = [
  [chars(0xe2, 0x20ac, 0x201d), chars(0x2014)], // em dash
  [chars(0xe2, 0x20ac, 0x201c), chars(0x2013)], // en dash
  [chars(0xf0, 0x178, 0x2018, 0x2018), chars(0x1f451)], // crown
];
const SUSPECT = [chars(0xe2), chars(0xf0)];
export function repairText(text: string): string {
  if (typeof text !== "string" || !SUSPECT.some((c) => text.includes(c))) return text;
  return MOJIBAKE.reduce((t, [bad, good]) => t.split(bad).join(good), text);
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
      botStyle: p.botStyle,
      connected: p.connected,
      bankrupt: p.bankrupt,
      money: p.money,
    })),
    settings: settingsOf(state),
  };
}
