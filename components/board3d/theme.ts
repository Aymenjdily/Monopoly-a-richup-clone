/**
 * Visual-only theme for the 3D board (C2 rev 3 board design).
 * Names, prices and rules come from lib/engine/board.ts; this file only adds what the
 * board *looks* like (country flag, icon, pastel band color). Nothing here is game state.
 */
import type { GroupId } from "@/lib/engine/board";

// G2 "felt table" palette.
export const INK = "#2a2118";
export const PAPER = "#fdf9ef";
export const CORAL = "#c0392b";
export const MANGO = "#d9a441";
export const LILAC = "#eadfc3";
/** Thin tan outline used instead of heavy ink strokes. */
export const LINE = "#cdbd96";
export const BRASS_DARK = "#8a6420";
export const FELT = "#1b6147";

/**
 * Every buyable tile starts neutral; once bought, its band/face take the owner's token
 * color. Sets are recognised by their country flag instead of a set color.
 */
export const NEUTRAL_BAND = "#e9dfc6";

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
  chance: "#fbefc9",
  chest: "#f3ead2",
  tax: "#f6e3d6",
  utility: "#eaf0dc",
  go: "#e3efd9",
  jail: "#f3e2c6",
  parking: "#efe8d6",
  gotojail: "#f3dcd2",
};
