import { BOARD } from "./board";
import { CARDS, freshDecks, JAIL_CARD_IDS } from "./cards";
import { charge, credit } from "./money";
import {
  canBuild,
  canSellBuilding,
  rentDue,
  spaceIndicesOfOwner,
} from "./ownershipRules";
import { passHost } from "./lobby";
import { settingsOf } from "./settings";
import { logEvent, JAIL_FINE, JAIL_TILE, MAX_DOUBLES, MAX_JAIL_TURNS } from "./types";
import type {
  ApplyResult,
  BoardSpace,
  GameState,
  OwnershipEntry,
  Player,
} from "./types";
import { rollDice, type Rng } from "./rng";

export interface EngineInput {
  state: GameState;
  /** Caller identity — must match the currently acting player. */
  playerId: string;
  action: { type: string } & Record<string, unknown>;
  /** Injected RNG. Only the server creates it; the engine is otherwise deterministic. */
  rng: Rng;
}

const clone = <T>(value: T): T => structuredClone(value) as T;

/**
 * Processes one action against the engine state and returns a NEW state plus log events.
 * Rejected actions (ok: false) return the input state unchanged.
 * Pure: same (state, action, rng) always yields the same (state, events).
 */
export function applyAction(input: EngineInput): ApplyResult {
  const state = clone(input.state);
  const { action, rng, playerId } = input;

  const reject = (error: string): ApplyResult => ({
    ok: false,
    state: input.state,
    events: [],
    error,
  });

  if (state.phase !== "playing") {
    return reject(`Game is not playing (phase: ${state.phase}).`);
  }
  if (state.players.length < 2) {
    return reject("Not enough players.");
  }
  // Leaving is allowed at any time, not only on your turn (forfeit).
  if (action.type === "leaveRoom") {
    const leaverIdx = state.players.findIndex((p) => p.id === playerId);
    const leaver = state.players[leaverIdx];
    if (!leaver) return reject("You are not in this game.");
    if (leaver.bankrupt) return reject("You are already out of this game.");
    const wasTheirTurn = state.turn.playerIdx === leaverIdx;
    logEvent(state, "info", `${leaver.name} left the game (forfeit).`, { actor: leaver.name });
    leaver.connected = false;
    goBankrupt(state, leaver, "bank");
    if (leaver.isHost) passHost(state, leaverIdx);
    if (state.phase === "playing" && wasTheirTurn) nextPlayer(state);
    return accept(state);
  }

  const actor = state.players[state.turn.playerIdx];
  if (!actor) return reject("Turn points to a missing player.");
  if (actor.bankrupt) return reject("Current player is bankrupt.");
  if (actor.id !== playerId) {
    return reject(`Not ${playerId}'s turn (it is ${actor.id}'s).`);
  }

  // Ensure decks exist (lazy init keeps createState lean).
  if (state.decks.chance.length === 0 && state.decks.chest.length === 0) {
    const decks = freshDecks();
    state.decks = {
      chance: shuffled(state, decks.chance),
      chest: shuffled(state, decks.chest),
    };
  }

  switch (action.type) {
    case "roll":
      return doRoll(state, rng);
    case "endTurn":
      return doEndTurn(state);
    case "buy":
      return doBuy(state);
    case "decline":
      return doDecline(state);
    case "build":
      return doBuild(state, actor, spaceIndexArg(action));
    case "sellBuilding":
      return doSellBuilding(state, actor, spaceIndexArg(action));
    case "mortgage":
      return doMortgage(state, actor, spaceIndexArg(action));
    case "unmortgage":
      return doUnmortgage(state, actor, spaceIndexArg(action));
    case "payJailFine":
      return doPayJailFine(state, actor);
    case "useJailCard":
      return doUseJailCard(state, actor);
    default:
      return reject(`Unknown action type: ${String(action.type)}`);
  }
}

function spaceIndexArg(action: { type: string } & Record<string, unknown>): number {
  const raw = action["spaceIndex"];
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0
    ? raw
    : -1;
}

/** Fisher–Yates over a copy, using the seeded RNG (deck order is a server secret). */
function shuffled(state: GameState, indices: number[]): number[] {
  const arr = [...indices];
  const rng = mulberryFromState(state);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberryFromState(state: GameState): Rng {
  // Derive a stable seed from the log sequence + ownership size: deterministic because
  // logSeq strictly increases between deck inits.
  // (Only used once per game, at first action, to seed deck order.)
  return mulberry32(state.logSeq * 7919 + state.players.length + state.players.length * 31 + 104729);
}

// Duplicated minimal mulberry core to avoid importing engine-only rng into cards; kept in sync.
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}

function doRoll(state: GameState, rng: Rng): ApplyResult {
  if (state.turn.phase !== "preRoll") {
    return {
      ok: false,
      state,
      events: [],
      error: "Cannot roll now (waiting for an action choice).",
    };
  }
  if (state.pending) {
    return {
      ok: false,
      state,
      events: [],
      error: "Resolve the pending decision first.",
    };
  }
  const player = state.players[state.turn.playerIdx];
  const roll = rollDice(rng);
  state.dice = [roll.die1, roll.die2];

  if (player.inJail) {
    if (!roll.isDoubles) {
      player.jailTurns += 1;
      if (player.jailTurns >= MAX_JAIL_TURNS) {
        // 3rd failed attempt: pay the fine, then move by the roll.
        player.inJail = false;
        player.jailTurns = 0;
        feedPot(
          state,
          charge(state, player.id, JAIL_FINE, `${player.name} pays $${JAIL_FINE} jail fine (3rd failed attempt)`, {
            actor: player.name,
            kind: "jail",
          })
        );
        advance(state, player, roll.total);
        logEvent(
          state,
          "roll",
          `${player.name} rolled ${roll.die1}+${roll.die2} in jail — pays fine, moves to ${spaceName(player.position)}.`,
          { actor: player.name }
        );
        const outcome = resolveTile(state, player);
        return finishResolve(state, { endTurn: outcome.turnEnded });
      }
      logEvent(
        state,
        "roll",
        `${player.name} rolled ${roll.die1}+${roll.die2} in jail — no doubles (attempt ${player.jailTurns}/${MAX_JAIL_TURNS}). Turn passes.`,
        { actor: player.name }
      );
      nextPlayer(state);
      return accept(state);
    }
    // Doubles from jail: leave jail, move normally, no bonus re-roll for those doubles.
    player.inJail = false;
    player.jailTurns = 0;
    logEvent(
      state,
      "roll",
      `${player.name} rolled doubles ${roll.die1}+${roll.die2} and leaves jail!`,
      { actor: player.name }
    );
    advance(state, player, roll.total);
    const outcome = resolveTile(state, player);
    return finishResolve(state, { endTurn: outcome.turnEnded, forceAwait: true });
  }

  // Regular (not in jail) roll.
  logEvent(
    state,
    "roll",
    `${player.name} rolled ${roll.die1}+${roll.die2}${roll.isDoubles ? " (doubles)" : ""}`,
    { actor: player.name, amount: roll.total }
  );

  if (roll.isDoubles) {
    state.turn.doublesCount += 1;
    if (state.turn.doublesCount >= MAX_DOUBLES) {
      // 3 doubles in a row â†’ straight to jail, no move.
      sendToJail(state, player, "Three doubles in a row — speeding!");
      nextPlayer(state);
      return accept(state);
    }
  } else {
    state.turn.doublesCount = 0;
  }

  advance(state, player, roll.total);
  const outcome = resolveTile(state, player);
  if (player.inJail) {
    // Landed on Go To Jail (or card sent them): turn ends immediately.
    nextPlayer(state);
    return accept(state);
  }
  if (player.bankrupt) {
    // Debt liquidation failed → bankruptcy; turn moves on.
    nextPlayer(state);
    return accept(state);
  }
  return finishResolve(state, {
    endTurn: outcome.turnEnded,
    // Doubles grant an immediate re-roll unless a decision is pending.
    allowReRoll: roll.isDoubles && !outcome.turnEnded,
  });
}

/** Sets the final turn phase after a tile/card resolution. */
function finishResolve(
  state: GameState,
  opts: { endTurn: boolean; forceAwait?: boolean; allowReRoll?: boolean }
): ApplyResult {
  if (opts.endTurn) {
    nextPlayer(state);
    return accept(state);
  }
  if (state.pending) {
    state.turn.phase = "awaitingAction";
    return accept(state);
  }
  if (opts.allowReRoll && !opts.forceAwait) {
    state.turn.phase = "preRoll"; // doubles re-roll
    return accept(state);
  }
  state.turn.phase = "awaitingAction";
  return accept(state);
}

function doEndTurn(state: GameState): ApplyResult {
  if (state.turn.phase !== "awaitingAction") {
    return {
      ok: false,
      state,
      events: [],
      error: "Cannot end turn now.",
    };
  }
  if (state.pending) {
    return {
      ok: false,
      state,
      events: [],
      error: "Resolve the pending decision before ending the turn.",
    };
  }
  if (state.turn.doublesCount > 0) {
    return {
      ok: false,
      state,
      events: [],
      error: "Doubles: you must roll again.",
    };
  }
  nextPlayer(state);
  return accept(state);
}

function doBuy(state: GameState): ApplyResult {
  if (state.turn.phase !== "awaitingAction" || state.pending?.type !== "buy") {
    return { ok: false, state, events: [], error: "Nothing to buy right now." };
  }
  const pending = state.pending;
  const player = state.players[state.turn.playerIdx];
  if (player.money < pending.price) {
    return { ok: false, state, events: [], error: "Not enough cash to buy." };
  }
  charge(state, player.id, pending.price, `${player.name} buys ${spaceName(pending.spaceIndex)} for $${pending.price}`, {
    actor: player.name,
  });
  state.ownership[pending.spaceIndex] = { ownerId: player.id, houses: 0, mortgaged: false };
  state.pending = undefined;
  // Bought with a doubles streak still owed → re-roll continues.
  state.turn.phase = state.turn.doublesCount > 0 ? "preRoll" : "awaitingAction";
  return accept(state);
}

function doDecline(state: GameState): ApplyResult {
  if (state.turn.phase !== "awaitingAction" || state.pending?.type !== "buy") {
    return { ok: false, state, events: [], error: "Nothing to decline right now." };
  }
  logEvent(state, "info", `${state.players[state.turn.playerIdx].name} declines to buy ${spaceName(state.pending.spaceIndex)}.`, {
    actor: state.players[state.turn.playerIdx].name,
  });
  state.pending = undefined;
  if (state.turn.doublesCount > 0) {
    // Doubles bought/declined: the bonus re-roll stands.
    state.turn.phase = "preRoll";
    return accept(state);
  }
  nextPlayer(state);
  return accept(state);
}

function doBuild(state: GameState, actor: Player, spaceIndex: number): ApplyResult {
  if (notTheirAsset(state, actor, spaceIndex)) {
    return { ok: false, state, events: [], error: "Invalid build request." };
  }
  if (state.pending?.type === "debt") {
    return { ok: false, state, events: [], error: "Cannot build while in debt." };
  }
  const check = canBuildPublic(state, actor.id, spaceIndex);
  if (!check.ok) return { ok: false, state, events: [], error: check.error };
  const space = BOARD[spaceIndex];
  const cost = space.houseCost!;
  charge(state, actor.id, cost, `${actor.name} builds on ${space.name} for $${cost}`, { actor: actor.name });
  state.ownership[spaceIndex].houses += 1;
  return accept(state);
}

function doSellBuilding(state: GameState, actor: Player, spaceIndex: number): ApplyResult {
  if (notTheirAsset(state, actor, spaceIndex)) {
    return { ok: false, state, events: [], error: "Invalid sell request." };
  }
  const check = canSellBuildingPublic(state, actor.id, spaceIndex);
  if (!check.ok) return { ok: false, state, events: [], error: check.error };
  const space = BOARD[spaceIndex];
  const refund = Math.floor(space.houseCost! / 2);
  credit(state, actor.id, refund, `${actor.name} sells a building on ${space.name} for $${refund}`, { actor: actor.name });
  state.ownership[spaceIndex].houses -= 1;
  return accept(state);
}

function doMortgage(state: GameState, actor: Player, spaceIndex: number): ApplyResult {
  if (notTheirAsset(state, actor, spaceIndex)) {
    return { ok: false, state, events: [], error: "Invalid mortgage request." };
  }
  const entry = state.ownership[spaceIndex];
  if (entry.mortgaged) {
    return { ok: false, state, events: [], error: "Already mortgaged." };
  }
  if (entry.houses > 0) {
    return { ok: false, state, events: [], error: "Sell all buildings in the group before mortgaging." };
  }
  const value = BOARD[spaceIndex].mortgageValue ?? 0;
  entry.mortgaged = true;
  credit(state, actor.id, value, `${actor.name} mortgages ${spaceName(spaceIndex)} for $${value}`, { actor: actor.name });
  return accept(state);
}

function doUnmortgage(state: GameState, actor: Player, spaceIndex: number): ApplyResult {
  if (notTheirAsset(state, actor, spaceIndex)) {
    return { ok: false, state, events: [], error: "Invalid unmortgage request." };
  }
  const entry = state.ownership[spaceIndex];
  if (!entry.mortgaged) return { ok: false, state, events: [], error: "Not mortgaged." };
  const mortgage = BOARD[spaceIndex].mortgageValue ?? 0;
  const fee = Math.ceil(mortgage * 0.1);
  const cost = mortgage + fee;
  if (actor.money < cost) {
    return { ok: false, state, events: [], error: "Not enough cash to unmortgage." };
  }
  charge(state, actor.id, cost, `${actor.name} unmortgages ${spaceName(spaceIndex)} for $${cost}`, { actor: actor.name });
  entry.mortgaged = false;
  return accept(state);
}

function doPayJailFine(state: GameState, actor: Player): ApplyResult {
  if (!actor.inJail) return { ok: false, state, events: [], error: "You are not in jail." };
  if (state.turn.phase !== "preRoll") {
    return { ok: false, state, events: [], error: "Pay the fine before rolling." };
  }
  if (actor.money < JAIL_FINE) {
    return { ok: false, state, events: [], error: "Not enough cash for the fine." };
  }
  feedPot(
    state,
    charge(state, actor.id, JAIL_FINE, `${actor.name} pays $${JAIL_FINE} to leave jail`, {
      actor: actor.name,
      kind: "jail",
    })
  );
  actor.inJail = false;
  actor.jailTurns = 0;
  logEvent(state, "jail", `${actor.name} pays the fine and is free to roll.`, { actor: actor.name });
  return accept(state);
}

function doUseJailCard(state: GameState, actor: Player): ApplyResult {
  if (!actor.inJail) return { ok: false, state, events: [], error: "You are not in jail." };
  if (state.turn.phase !== "preRoll") {
    return { ok: false, state, events: [], error: "Use the card before rolling." };
  }
  if (actor.jailCards < 1) {
    return { ok: false, state, events: [], error: "No Get Out of Jail card." };
  }
  actor.jailCards -= 1;
  actor.inJail = false;
  actor.jailTurns = 0;
  returnJailCardToDeck(state);
  logEvent(state, "jail", `${actor.name} uses a Get Out of Jail card.`, { actor: actor.name });
  return accept(state);
}

function notTheirAsset(state: GameState, actor: Player, spaceIndex: number): boolean {
  if (spaceIndex < 0 || !BOARD[spaceIndex]) return true;
  const entry = state.ownership[spaceIndex];
  return !entry || entry.ownerId !== actor.id;
}

// OwnershipRules passthroughs kept local so engine stays the mutation owner.
function canBuildPublic(state: GameState, playerId: string, spaceIndex: number) {
  return canBuild(state, playerId, spaceIndex);
}
function canSellBuildingPublic(state: GameState, playerId: string, spaceIndex: number) {
  return canSellBuilding(state, playerId, spaceIndex);
}

/** Draws the top card of the given deck and recycles it to the bottom (unless held). */
function drawCard(state: GameState, deck: "chance" | "chest"): number {
  const pile = state.decks[deck];
  const id = pile.shift()!;
  if (!JAIL_CARD_IDS.includes(id)) {
    pile.push(id);
  }
  return id;
}

/** Moves the player step-by-step; grants salary each time they pass or land on GO. */
function advance(state: GameState, player: Player, steps: number): void {
  for (let i = 0; i < steps; i++) {
    player.position = (player.position + 1) % 40;
    if (player.position === 0) {
      const salary = settingsOf(state).goSalary;
      credit(state, player.id, salary, `${player.name} passes GO and collects $${salary}`, {
        actor: player.name,
      });
    }
  }
}

/**
 * Resolves everything that happens from standing on the player's tile:
 * properties/rent, tax, decks, jail tile semantics.
 * Returns whether the turn must end immediately (Go To Jail etc.).
 */
function resolveTile(state: GameState, player: Player): { turnEnded: boolean } {
  const space: BoardSpace | undefined = BOARD[player.position];
  if (!space) return { turnEnded: false };
  switch (space.type) {
    case "tax": {
      const amount = space.effect?.amount ?? 0;
      if (amount > 0) {
        payOrDebt(state, player, amount, `${player.name} pays $${amount} ${space.name}`, "bank");
      }
      return { turnEnded: false };
    }
    case "gotojail": {
      sendToJail(state, player, `Landed on ${space.name}`);
      return { turnEnded: true };
    }
    case "property":
    case "railroad":
    case "utility": {
      const rent = rentDue(state, player.position, diceTotal(state));
      // Owners never pay rent to themselves.
      if (rent.kind === "rent" && rent.ownerId !== player.id) {
        payOrDebt(
          state,
          player,
          rent.amount,
          `${player.name} pays $${rent.amount} rent to ${ownerName(state, rent.ownerId)} for ${space.name}`,
          rent.ownerId
        );
      } else if (rent.kind === "none" && rent.reason === "unowned" && space.price) {
        state.pending = { type: "buy", spaceIndex: player.position, price: space.price };
        logEvent(state, "info", `${player.name} may buy ${space.name} for $${space.price}.`, {
          actor: player.name,
        });
      }
      return { turnEnded: false };
    }
    case "chance":
    case "chest": {
      return resolveCard(state, player, space.type);
    }
    case "go": {
      const s = settingsOf(state);
      if (s.exactGoBonus) {
        credit(state, player.id, s.goSalary, `${player.name} lands exactly on GO: bonus $${s.goSalary}!`, { actor: player.name });
      }
      return { turnEnded: false };
    }
    case "parking": {
      const pot = state.pot ?? 0;
      if (settingsOf(state).parkingJackpot && pot > 0) {
        state.pot = 0;
        credit(state, player.id, pot, `${player.name} hits the Free Parking jackpot: $${pot}!`, { actor: player.name });
      }
      return { turnEnded: false };
    }
    case "jail":
      return { turnEnded: false };
  }
}

/**
 * Charges `amount` from `player`; if the player cannot cover it, creates a pending debt.
 * The turn does NOT auto-advance on shortfall — the player must liquidate or go bankrupt
 * (a later action finalizes that). Returns nothing; the charge may be partial (clamp).
 */
function payOrDebt(
  state: GameState,
  player: Player,
  amount: number,
  reason: string,
  creditorId: string
): void {
  const paid = charge(state, player.id, amount, reason, { actor: player.name });
  if (creditorId === "bank") feedPot(state, paid);
  if (paid >= amount) {
    if (creditorId !== "bank") {
      credit(state, creditorId, paid, `${ownerName(state, creditorId)} collects.`, { actor: ownerName(state, creditorId) });
    }
    return;
  }
  // The partial payment goes straight to the creditor player (bank keeps it).
  if (creditorId !== "bank" && paid > 0) {
    credit(state, creditorId, paid, `${ownerName(state, creditorId)} collects the partial payment.`, { actor: player.name });
  }
  // Shortfall: settle via automatic liquidation (sell buildings, then mortgage).
  // AGENTS.md section 10: asset processing is automatic server-side.
  settleDebt(state, player, amount - paid, reason, creditorId);
}

/** Free Parking jackpot: bank-bound fees (taxes, card fees, jail fines) go to the pot. */
function feedPot(state: GameState, amount: number): void {
  if (amount > 0 && settingsOf(state).parkingJackpot) state.pot = (state.pot ?? 0) + amount;
}

function resolveCard(state: GameState, player: Player, deck: "chance" | "chest"): { turnEnded: boolean } {
  const cardId = drawCard(state, deck);
  const card = CARDS[cardId] ?? CARDS.find((c) => c.id === cardId)!;
  logEvent(state, "info", `${player.name} draws ${deck === "chance" ? "Chance" : "Community Chest"}: "${card.text}"`, { actor: player.name });
  const effect = card.effect;
  switch (effect.kind) {
    case "money": {
      if (effect.amount >= 0) {
        credit(state, player.id, effect.amount, `${player.name} collects $${effect.amount}.`, { actor: player.name });
      } else {
        payOrDebt(state, player, -effect.amount, `${player.name} pays $${-effect.amount}: ${card.text}`, "bank");
      }
      return { turnEnded: false };
    }
    case "moveTo": {
      const forward = (effect.target - player.position + 40) % 40;
      if (forward > 0) {
        advance(state, player, forward);
      }
      return resolveTile(state, player);
    }
    case "moveBack": {
      player.position = (player.position - effect.steps + 40) % 40;
      return resolveTile(state, player);
    }
    case "advanceToNearest": {
      const candidates =
        effect.group === "railroad"
          ? [5, 15, 25, 35]
          : [12, 28];
      let target = candidates[0];
      let bestDistance = (target - player.position + 40) % 40;
      if (bestDistance === 0) bestDistance = 40; // standing on it → full loop forward
      for (const c of candidates) {
        const distance = (c - player.position + 40) % 40;
        if (distance > 0 && distance < bestDistance) {
          target = c;
          bestDistance = distance;
        }
      }
      advance(state, player, bestDistance);
      const rent = rentDue(state, player.position, diceTotal(state));
      if (rent.kind === "rent" && rent.ownerId !== player.id) {
        // Nearest railroad: double rent. Nearest utility: flat 10× dice roll.
        const amount = effect.group === "railroad" ? rent.amount * 2 : 10 * diceTotal(state);
        payOrDebt(
          state,
          player,
          amount,
          `${player.name} pays $${amount} to ${ownerName(state, rent.ownerId)} (${card.text})`,
          rent.ownerId
        );
      }
      return { turnEnded: false };
    }
    case "jailCard": {
      player.jailCards += 1;
      logEvent(state, "info", `${player.name} keeps a Get Out of Jail card.`, { actor: player.name });
      return { turnEnded: false };
    }
    case "goToJail": {
      sendToJail(state, player, card.text);
      return { turnEnded: true };
    }
    case "collectFromEachPlayer": {
      for (const other of state.players) {
        if (other.id === player.id || other.bankrupt) continue;
        const got = charge(state, other.id, effect.amount, `${other.name} pays $${effect.amount} to ${player.name}`, { actor: other.name });
        credit(state, player.id, got, `${player.name} collects $${got} from ${other.name}.`, { actor: player.name });
      }
      return { turnEnded: false };
    }
    case "payEachPlayer": {
      for (const other of state.players) {
        if (other.id === player.id || other.bankrupt) continue;
        payOrDebt(state, player, effect.amount, `${player.name} pays $${effect.amount} to ${other.name}`, other.id);
      }
      return { turnEnded: false };
    }
    case "repairs": {
      let houses = 0;
      let hotels = 0;
      for (const idx of spaceIndicesOfOwner(state, player.id)) {
        const entry = state.ownership[idx];
        if (entry.houses === 5) hotels += 1;
        else houses += entry.houses;
      }
      const total = houses * effect.perHouse + hotels * effect.perHotel;
      if (total > 0) {
        payOrDebt(state, player, total, `${player.name} pays $${total} for repairs (${houses} houses, ${hotels} hotels).`, "bank");
      }
      return { turnEnded: false };
    }
  }
}

/** The Jail card leaves its deck while held; it returns to that deck when used. */
function returnJailCardToDeck(state: GameState): void {
  const chanceId = JAIL_CARD_IDS[0];
  const chestId = JAIL_CARD_IDS[1];
  if (!state.decks.chance.includes(chanceId)) state.decks.chance.push(chanceId);
  else if (!state.decks.chest.includes(chestId)) state.decks.chest.push(chestId);
}

function sendToJail(state: GameState, player: Player, reason: string): boolean {
  if (player.inJail) return false;
  player.position = JAIL_TILE;
  player.inJail = true;
  player.jailTurns = 0;
  state.turn.doublesCount = 0;
  logEvent(state, "jail", `${player.name} was sent to Jail. ${reason}`, { actor: player.name });
  return true;
}

function settleDebt(
  state: GameState,
  player: Player,
  remainingDue: number,
  reason: string,
  creditorId: string
): void {
  while (player.money < remainingDue) {
    const target = nextLiquidationTarget(state, player);
    if (target === undefined) break;
    if (state.ownership[target].houses > 0) {
      const refund = Math.floor((BOARD[target].houseCost ?? 0) / 2);
      state.ownership[target].houses -= 1;
      credit(state, player.id, refund, `${player.name} auto-sells a building on ${spaceName(target)} for $${refund}`, { actor: player.name });
    } else {
      const value = BOARD[target].mortgageValue ?? 0;
      state.ownership[target].mortgaged = true;
      credit(state, player.id, value, `${player.name} auto-mortgages ${spaceName(target)} for $${value}`, { actor: player.name });
    }
  }
  if (player.money >= remainingDue) {
    charge(state, player.id, remainingDue, `${reason} (debt settled after liquidation)`, { actor: player.name });
    if (creditorId !== "bank") {
      credit(state, creditorId, remainingDue, `${ownerName(state, creditorId)} collects.`, { actor: ownerName(state, creditorId) });
    }
    return;
  }
  goBankrupt(state, player, creditorId);
}

/** Picks the next asset to liquidate: cheapest-house tile first, then unmortgaged deeds. */
function nextLiquidationTarget(state: GameState, player: Player): number | undefined {
  const owned = spaceIndicesOfOwner(state, player.id);
  const withHouses = owned
    .filter((i) => state.ownership[i].houses > 0)
    .sort((a, b) => (BOARD[a].houseCost ?? 0) - (BOARD[b].houseCost ?? 0));
  if (withHouses.length > 0) return withHouses[0];
  const unmortgaged = owned
    .filter((i) => !state.ownership[i].mortgaged)
    .sort((a, b) => a - b);
  if (unmortgaged.length > 0) return unmortgaged[0];
  return undefined;
}

function goBankrupt(state: GameState, player: Player, creditorId: string): void {
  logEvent(state, "info", `${player.name} is BANKRUPT. Assets ${creditorId === "bank" ? "return to the bank." : `transfer to ${ownerName(state, creditorId)}.`}`, { actor: player.name });
  // Last cash goes to the creditor (bank keeps whatever remains on its own books).
  if (creditorId !== "bank" && player.money > 0) {
    credit(state, creditorId, player.money, `${ownerName(state, creditorId)} collects the remaining $${player.money}.`, { actor: player.name });
  }
  // Buildings vanish (simplification: no refund at bankruptcy); deeds transfer as-is
  // with existing mortgage flags, or return to market when the bank is the creditor.
  const owned = spaceIndicesOfOwner(state, player.id);
  for (const idx of owned) {
    const entry = state.ownership[idx];
    entry.houses = 0;
    if (creditorId === "bank") {
      delete state.ownership[idx]; // back to market
    } else {
      state.ownership[idx] = {
        ownerId: creditorId,
        houses: 0,
        mortgaged: entry.mortgaged,
      } satisfies OwnershipEntry;
    }
  }
  player.money = 0;
  player.bankrupt = true;
  player.inJail = false;
  player.jailTurns = 0;
  player.jailCards = 0;
  state.pending = undefined;
  checkWinner(state);
}

export function checkWinner(state: GameState): void {
  const solvent = state.players.filter((p) => !p.bankrupt);
  if (solvent.length === 1 && state.phase === "playing") {
    state.phase = "finished";
    state.winner = solvent[0].id;
    logEvent(state, "info", `👑 ${solvent[0].name} wins the game!`, { actor: solvent[0].name });
  }
}

function ownerName(state: GameState, playerId: string): string {
  if (playerId === "bank") return "the bank";
  return state.players.find((p) => p.id === playerId)?.name ?? playerId;
}

function nextPlayer(state: GameState): void {
  // Advance to the next non-bankrupt player (or stay with self when everyone else is out).
  const count = state.players.length;
  let idx = state.turn.playerIdx;
  for (let attempt = 0; attempt < count; attempt++) {
    idx = (idx + 1) % count;
    if (!state.players[idx].bankrupt) break;
  }
  state.turn = { playerIdx: idx, phase: "preRoll", doublesCount: 0, rolled: false };
  logEvent(state, "turn", `— ${state.players[idx].name}'s turn —`, { actor: state.players[idx].name });
}

function accept(state: GameState): ApplyResult {
  state.version += 1;
  return { ok: true, state, events: state.log.slice(-5) };
}

function spaceName(index: number): string {
  return BOARD[index]?.name ?? `#${index}`;
}

function diceTotal(state: GameState): number {
  return state.dice[0] + state.dice[1];
}

/** Helper shared with tests: count how many of a group a player owns. */
export function countGroupOwnership(state: GameState, playerId: string, group: string): number {
  return (
    spaceIndicesOfOwner(state, playerId).filter((i) => BOARD[i].group === group).length
  );
}


