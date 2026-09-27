/**
 * Pure board geometry (world units, y up, board centered at the origin, GO at +x/+z).
 * Kept free of three.js so it can be unit-tested.
 */
export const CORNER = 1.6;
export const SIDE = 1.0;
export const BOARD_W = 2 * CORNER + 9 * SIDE;
export const HALF = BOARD_W / 2;
export const GAP = 0.07;
export const TILE_T = 0.12;
/** Canvas pixels per world unit for tile textures. */
export const PX = 256;

export type Side = "corner" | "bottom" | "left" | "top" | "right";

export interface TilePlace {
  x: number;
  z: number;
  /** footprint along x */
  w: number;
  /** footprint along z */
  d: number;
  side: Side;
}

export function place(i: number): TilePlace {
  if (i === 0) return { x: HALF - CORNER / 2, z: HALF - CORNER / 2, w: CORNER, d: CORNER, side: "corner" };
  if (i === 10) return { x: -HALF + CORNER / 2, z: HALF - CORNER / 2, w: CORNER, d: CORNER, side: "corner" };
  if (i === 20) return { x: -HALF + CORNER / 2, z: -HALF + CORNER / 2, w: CORNER, d: CORNER, side: "corner" };
  if (i === 30) return { x: HALF - CORNER / 2, z: -HALF + CORNER / 2, w: CORNER, d: CORNER, side: "corner" };
  if (i < 10) return { x: HALF - CORNER - (i - 0.5) * SIDE, z: HALF - CORNER / 2, w: SIDE, d: CORNER, side: "bottom" };
  if (i < 20) return { x: -HALF + CORNER / 2, z: HALF - CORNER - (i - 10.5) * SIDE, w: CORNER, d: SIDE, side: "left" };
  if (i < 30) return { x: -HALF + CORNER + (i - 20.5) * SIDE, z: -HALF + CORNER / 2, w: SIDE, d: CORNER, side: "top" };
  return { x: HALF - CORNER / 2, z: -HALF + CORNER + (i - 30.5) * SIDE, w: CORNER, d: SIDE, side: "right" };
}

/** Where pawns stand on a tile (slightly toward the outer edge so names stay readable). */
export function pawnAnchor(i: number): { x: number; z: number } {
  const p = place(i);
  if (p.side === "bottom") return { x: p.x, z: p.z + 0.18 };
  if (p.side === "top") return { x: p.x, z: p.z - 0.05 };
  return { x: p.x, z: p.z };
}

/** Pawn position inside the jail cell (the cell sits toward the board center). */
export function jailCellAnchor(): { x: number; z: number } {
  const p = place(10);
  return { x: p.x + (p.w - GAP) / 2 - (22 + 114) / PX, z: p.z - (p.d - GAP) / 2 + (22 + 104) / PX };
}

/** Fan-out offsets for several pawns on one tile. */
export function fanOffset(k: number, n: number): [number, number] {
  const table: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-0.2, 0.05], [0.2, -0.05]],
    3: [[-0.2, -0.15], [0.2, -0.15], [0, 0.2]],
    4: [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]],
    5: [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2], [0, 0]],
    6: [[-0.24, -0.22], [0, -0.22], [0.24, -0.22], [-0.24, 0.2], [0, 0.2], [0.24, 0.2]],
  };
  return (table[Math.min(Math.max(n, 1), 6)] ?? table[1])[k] ?? [0, 0];
}

/** Max forward distance still animated tile-by-tile; farther/backward moves jump. */
export const MAX_WALK = 12;

/**
 * Tiles a pawn visits going from `from` to `to`. Forward moves up to MAX_WALK steps walk
 * (exclusive of `from`, inclusive of `to`); anything else is a direct jump.
 */
export function walkPath(from: number, to: number): number[] {
  if (from === to) return [];
  const steps = (to - from + 40) % 40;
  if (steps > MAX_WALK) return [to];
  return Array.from({ length: steps }, (_, k) => (from + k + 1) % 40);
}

/** Center of the band (where buildings sit) on the center-facing edge of a tile. */
export function bandCenter(i: number): { x: number; z: number; horizontal: boolean } {
  const p = place(i);
  const inset = 47 / PX + 0.035;
  if (p.side === "bottom") return { x: p.x, z: p.z - p.d / 2 + inset, horizontal: true };
  if (p.side === "top") return { x: p.x, z: p.z + p.d / 2 - inset, horizontal: true };
  if (p.side === "left") return { x: p.x + p.w / 2 - inset, z: p.z, horizontal: false };
  return { x: p.x - p.w / 2 + inset, z: p.z, horizontal: false };
}
