/**
 * Pure rule helpers around ownership/sets/buildings/mortgages. No state mutation here —
 * callers (engine.ts) own state changes. Money math stays integer-only.
 */
import { BOARD } from "./board";
import type { GroupId } from "./board";
import { settingsOf } from "./settings";
import type { GameState, OwnershipEntry, Player } from "./types";

export function groupsOfKind(group: GroupId): "street" | "railroad" | "utility" {
  if (group === "railroad") return "railroad";
  if (group === "utility") return "utility";
  return "street";
}

export function spaceIndicesInGroup(group: GroupId): number[] {
  return BOARD.filter((s) => s.group === group).map((s) => s.index);
}

export function spaceIndicesOfOwner(state: GameState, playerId: string): number[] {
  return Object.entries(state.ownership)
    .filter(([, o]) => o.ownerId === playerId)
    .map(([k]) => Number(k));
}

export function ownsFullSet(state: GameState, playerId: string, group: GroupId): boolean {
  const indices = spaceIndicesInGroup(group);
  return indices.every((i) => state.ownership[i]?.ownerId === playerId);
}

export function ownerOf(state: GameState, spaceIndex: number): OwnershipEntry | undefined {
  return state.ownership[spaceIndex];
}

/** True when the full color set has zero houses on every property and no mortgages. */
export function hasCleanMonopoly(
  state: GameState,
  playerId: string,
  group: GroupId
): boolean {
  if (!ownsFullSet(state, playerId, group)) return false;
  return spaceIndicesInGroup(group).every((i) => {
    const o = state.ownership[i];
    return o && !o.mortgaged && o.houses === 0;
  });
}

export type RentResult =
  | { kind: "none"; reason: "unowned" | "mortgaged" | "self" | "ownerBankrupt" | "ownerInJail" | "not-buyable" }
  | { kind: "rent"; amount: number; ownerId: string };

/**
 * Rent due for landing on spaceIndex with dice total `diceTotal`.
 * Uses current ladder level; monopoly bonus only for bare (no-house) full sets;
 * railroads scale by owner's railroad count; utilities by owned-utilities × dice.
 */
export function rentDue(
  state: GameState,
  spaceIndex: number,
  diceTotal: number,
  opts: { rentMultiplier?: number; utilityMultiplier?: number } = {}
): RentResult {
  const space = BOARD[spaceIndex];
  if (!space || (space.type !== "property" && space.type !== "railroad" && space.type !== "utility")) {
    return { kind: "none", reason: "not-buyable" };
  }
  const entry = state.ownership[spaceIndex];
  if (!entry) return { kind: "none", reason: "unowned" };
  if (entry.mortgaged) return { kind: "none", reason: "mortgaged" };
  const owner: Player | undefined = state.players.find((p) => p.id === entry.ownerId);
  if (!owner || owner.bankrupt) return { kind: "none", reason: "ownerBankrupt" };
  if (owner.inJail && !settingsOf(state).rentInJail) return { kind: "none", reason: "ownerInJail" };

  if (space.type === "property") {
    if (space.group === undefined) return { kind: "none", reason: "not-buyable" };
    const level = entry.houses;
    const ladder = space.rentLadder!;
    let amount = ladder[level];
    if (level === 0 && hasCleanMonopoly(state, entry.ownerId, space.group)) {
      amount *= 2;
    }
    if (opts.rentMultiplier && opts.rentMultiplier > 1) amount *= opts.rentMultiplier;
    return { kind: "rent", amount, ownerId: entry.ownerId };
  }

  if (space.type === "railroad") {
    const count = spaceIndicesOfOwner(state, entry.ownerId).filter(
      (i) => BOARD[i].group === "railroad"
    ).length;
    const owned = Math.min(count, 4);
    let amount = [25, 50, 100, 200][owned - 1];
    if (opts.rentMultiplier && opts.rentMultiplier > 1) amount *= opts.rentMultiplier;
    return { kind: "rent", amount, ownerId: entry.ownerId };
  }

  // utility
  const count = spaceIndicesOfOwner(state, entry.ownerId).filter(
    (i) => BOARD[i].group === "utility"
  ).length;
  const base = opts.utilityMultiplier ?? (count >= 2 ? 10 : 4);
  return { kind: "rent", amount: base * diceTotal, ownerId: entry.ownerId };
}

/**
 * Even-build check: can `playerId` build 1 house on `spaceIndex`?
 * Requires full clean (non-mortgaged) street set, no hotel on that tile, and even build
 * (houses across group max-min diff... enforced as: houses[target] <= min of others).
 * An already-hotel tile cannot build. House supply is not tracked in v1.
 */
export function canBuild(
  state: GameState,
  playerId: string,
  spaceIndex: number
): { ok: boolean; error?: string } {
  const space = BOARD[spaceIndex];
  if (!space || space.type !== "property" || !space.group) {
    return { ok: false, error: "No buildable property there." };
  }
  const entry = state.ownership[spaceIndex];
  if (!entry || entry.ownerId !== playerId) return { ok: false, error: "You don't own this property." };
  if (entry.houses >= 5) return { ok: false, error: "Already has a hotel." };
  if (!ownsFullSet(state, playerId, space.group)) {
    return { ok: false, error: "You need the full color set to build." };
  }
  const indices = spaceIndicesInGroup(space.group);
  if (indices.some((i) => state.ownership[i]?.mortgaged)) {
    return { ok: false, error: "Cannot build while one of the set is mortgaged." };
  }
  const otherHouses = indices
    .filter((i) => i !== spaceIndex)
    .map((i) => state.ownership[i]?.houses ?? 0);
  const minOthers = Math.min(...otherHouses);
  if (settingsOf(state).evenBuilding && entry.houses > minOthers) {
    return { ok: false, error: "Even-build rule: build the cheaper side first." };
  }
  if ((space.houseCost ?? 0) > (state.players.find((p) => p.id === playerId)?.money ?? 0)) {
    return { ok: false, error: "Not enough cash for a house." };
  }
  return { ok: true };
}

/**
 * Even-build check in reverse: can the owner remove one house from spaceIndex?
 * Hotels can be sold back (5 → 4). Cannot sell while a debt is owed — engine enforces.
 */
export function canSellBuilding(
  state: GameState,
  playerId: string,
  spaceIndex: number
): { ok: boolean; error?: string } {
  const space = BOARD[spaceIndex];
  if (!space || space.type !== "property" || !space.group) {
    return { ok: false, error: "No building there." };
  }
  const entry = state.ownership[spaceIndex];
  if (!entry || entry.ownerId !== playerId) return { ok: false, error: "You don't own this property." };
  if (entry.houses <= 0) return { ok: false, error: "No buildings to sell." };
  const indices = spaceIndicesInGroup(space.group);
  const otherHouses = indices
    .filter((i) => i !== spaceIndex)
    .map((i) => state.ownership[i]?.houses ?? 0);
  const maxOthers = Math.max(...otherHouses);
  if (settingsOf(state).evenBuilding && entry.houses - 1 < maxOthers - 0 && entry.houses - 1 < maxOthers) {
    // after selling, this tile would be below the group max by more than 0 → uneven
    if (entry.houses - 1 + 1 < maxOthers) {
      return { ok: false, error: "Even-build rule: sell from the tallest side first." };
    }
  }
  return { ok: true };
}

/** Immediate liquidation value of one property (half price if bare, plus buildings at 50%). */
export function liquidationValue(state: GameState, spaceIndex: number): number {
  const space = BOARD[spaceIndex];
  const entry = state.ownership[spaceIndex];
  if (!space || !entry) return 0;
  const buildingRefund = space.type === "property" ? Math.floor((entry.houses * (space.houseCost ?? 0)) / 2) : 0;
  const mortgage = space.mortgageValue ?? Math.round((space.price ?? 0) / 2);
  return buildingRefund + mortgage;
}

/** Total cash a player could raise right now: buildings (50%) + mortgage values. */
export function totalLiquidationValue(state: GameState, playerId: string): number {
  return spaceIndicesOfOwner(state, playerId).reduce(
    (sum, i) => sum + liquidationValue(state, i),
    0
  );
}
