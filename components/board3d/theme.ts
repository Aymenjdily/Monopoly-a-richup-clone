/**
 * Visual-only theme for the 3D board (design/phase-5-board/variant-C2-board-v3).
 * Names, prices and rules come from lib/engine/board.ts; this file only adds what the
 * board *looks* like (country flag, icon, pastel band color). Nothing here is game state.
 */
import type { GroupId } from "@/lib/engine/board";

export const INK = "#1f1b2e";
export const PAPER = "#fffaf0";
export const CORAL = "#ff6b81";
export const MANGO = "#ffc53d";
export const LILAC = "#c9b8ff";

/**
 * Every buyable tile starts neutral; once bought, its band/face take the owner's token
 * color. Sets are recognised by their country flag instead of a set color.
 */
export const NEUTRAL_BAND = "#e6ded0";

/** Landmark art per city (space index → emoji), drawn large on the tile face. */
export const CITY_LANDMARK: Record<number, string> = {
  1: "🌋", // Sicily — Etna
  3: "⛪", // Milan — Duomo
  6: "⛩️", // Kyoto — torii
  8: "🏯", // Osaka — castle
  9: "🗼", // Tokyo — tower
  11: "🏝️", // Phuket
  13: "🐘", // Chiang Mai
  14: "🛕", // Bangkok — temple
  16: "💃", // Seville — flamenco
  18: "👑", // Madrid — royal palace
  19: "⚽", // Barcelona
  21: "🏖️", // Antalya
  23: "⛵", // Izmir — harbour
  24: "🕌", // Istanbul
  26: "🌉", // Cologne — Hohenzollern bridge
  27: "🍺", // Munich
  29: "🐻", // Berlin
  31: "🥁", // Salvador
  32: "🎭", // Rio — carnival
  34: "🏙️", // São Paulo
  37: "🌴", // Miami
  39: "🗽", // New York
};

export type FlagCode = "IT" | "JP" | "TH" | "ES" | "TR" | "DE" | "BR" | "US";

export const GROUP_FLAG: Partial<Record<GroupId, FlagCode>> = {
  brown: "IT",
  lightblue: "JP",
  pink: "TH",
  orange: "ES",
  red: "TR",
  yellow: "DE",
  green: "BR",
  darkblue: "US",
};

/** Per-index icons for non-property spaces. */
export const SPACE_ICON: Record<number, string> = {
  4: "💸",
  5: "🚂",
  12: "⚡",
  15: "🚆",
  25: "🚈",
  28: "💧",
  35: "🚄",
  38: "💎",
};

/** Tile face tints per space type. */
export const TYPE_TINT: Record<string, string> = {
  chance: "#fff1c4",
  chest: "#eee8ff",
  tax: "#ffe3e8",
  utility: "#e3f8ec",
  go: "#dcf6e8",
  jail: "#ffe9cf",
  parking: "#ece6ff",
  gotojail: "#ffdbe1",
};
