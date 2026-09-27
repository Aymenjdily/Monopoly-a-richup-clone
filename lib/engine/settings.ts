/**
 * Room settings — the only documented house rules (AGENTS.md "Room settings").
 * Chosen by the host in the lobby, validated here, locked once the game starts.
 */
import { logEvent, type GameState } from "./types";

export interface RoomSettings {
  /** Cash every player starts with (applied at startGame). */
  startCash: number;
  /** Paid each time a player passes or lands on GO. */
  goSalary: number;
  /** Landing exactly on GO pays one extra GO salary. */
  exactGoBonus: boolean;
  /** Taxes, bank card fees and jail fines feed a pot collected on Free Parking. */
  parkingJackpot: boolean;
  /** Jailed owners still collect rent. */
  rentInJail: boolean;
  /** Houses must be built and sold evenly across a set. */
  evenBuilding: boolean;
  /** Shuffle the seat order with the server RNG when the game starts. */
  randomOrder: boolean;
  /** Seats open in the lobby (2–6). */
  maxPlayers: number;
}

/** Standard rules (AGENTS.md decision 9). */
export const DEFAULT_SETTINGS: RoomSettings = {
  startCash: 1500,
  goSalary: 200,
  exactGoBonus: false,
  parkingJackpot: false,
  rentInJail: true,
  evenBuilding: true,
  randomOrder: false,
  maxPlayers: 6,
};

export const START_CASH_OPTIONS = [1000, 1500, 2000, 2500] as const;
export const GO_SALARY_OPTIONS = [100, 200, 300] as const;
export const MIN_PLAYERS = 2;
export const MAX_SEATS = 6;

const BOOLEAN_KEYS = ["exactGoBonus", "parkingJackpot", "rentInJail", "evenBuilding", "randomOrder"] as const;

/** Effective settings; games saved before settings existed get the defaults. */
export function settingsOf(state: Pick<GameState, "settings">): RoomSettings {
  return { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) };
}

/** Whitelist validation of a client-sent patch. Unknown keys or values are rejected. */
export function parseSettingsPatch(raw: unknown): { ok: true; patch: Partial<RoomSettings> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "settings must be an object" };
  const patch: Partial<RoomSettings> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === "startCash") {
      if (!START_CASH_OPTIONS.includes(value as (typeof START_CASH_OPTIONS)[number])) return { ok: false, error: "Invalid starting cash." };
      patch.startCash = value as number;
    } else if (key === "goSalary") {
      if (!GO_SALARY_OPTIONS.includes(value as (typeof GO_SALARY_OPTIONS)[number])) return { ok: false, error: "Invalid GO salary." };
      patch.goSalary = value as number;
    } else if (key === "maxPlayers") {
      if (!Number.isInteger(value) || (value as number) < MIN_PLAYERS || (value as number) > MAX_SEATS) {
        return { ok: false, error: `Max players must be ${MIN_PLAYERS}–${MAX_SEATS}.` };
      }
      patch.maxPlayers = value as number;
    } else if ((BOOLEAN_KEYS as readonly string[]).includes(key)) {
      if (typeof value !== "boolean") return { ok: false, error: `${key} must be true or false.` };
      patch[key as (typeof BOOLEAN_KEYS)[number]] = value;
    } else {
      return { ok: false, error: `Unknown setting: ${key}` };
    }
  }
  return { ok: true, patch };
}

/** Applies a validated patch in the lobby. Throws on rule violations (caller maps to 4xx). */
export function updateSettings(state: GameState, patch: Partial<RoomSettings>): GameState {
  if (state.phase !== "lobby") throw new Error("Settings are locked once the game starts.");
  const next = { ...settingsOf(state), ...patch };
  if (next.maxPlayers < state.players.length) {
    throw new Error(`Max players can't be below the ${state.players.length} seated players.`);
  }
  state.settings = next;
  state.version += 1;
  logEvent(state, "info", "Room rules updated.");
  return state;
}
