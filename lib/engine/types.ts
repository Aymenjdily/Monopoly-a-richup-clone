import type { GroupId } from "./board";
import type { Rng } from "./rng";
import type { RoomSettings } from "./settings";

export type SpaceType =
  | "go"
  | "property"
  | "railroad"
  | "utility"
  | "chance"
  | "chest"
  | "tax"
  | "jail"
  | "parking"
  | "gotojail";

export interface BoardSpaceEffect {
  kind: "go" | "incomeTax" | "luxuryTax" | "goToJail" | "jail" | "parking";
  amount?: number;
}

export interface BoardSpace {
  index: number;
  name: string;
  type: SpaceType;
  group?: GroupId;
  price?: number;
  rentLadder?: [number, number, number, number, number, number];
  houseCost?: number;
  mortgageValue?: number;
  effect?: BoardSpaceEffect;
}

export interface Player {
  id: string;
  name: string;
  colorToken: string;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
  /** Server-side secret used to authenticate actions; never sent to any client. */
  secret: string;
  /** Get-out-of-jail cards held (deck machinery arrives in Phase 2, count is authoritative state). */
  jailCards: number;
}

export type TurnPhase = "preRoll" | "awaitingAction" | "done";

export interface TurnState {
  playerIdx: number;
  phase: TurnPhase;
  doublesCount: number;
  rolled: boolean;
}

export type LogEventKind =
  | "roll"
  | "move"
  | "money"
  | "tax"
  | "jail"
  | "turn"
  | "info"
  | "error";

export interface LogEvent {
  id: number;
  kind: LogEventKind;
  actor?: string;
  amount?: number;
  text: string;
}

export type GameAction =
  | { type: "roll" }
  | { type: "endTurn" }
  | { type: "buy" }
  | { type: "decline" }
  | { type: "build"; spaceIndex: number }
  | { type: "sellBuilding"; spaceIndex: number }
  | { type: "mortgage"; spaceIndex: number }
  | { type: "unmortgage"; spaceIndex: number }
  | { type: "payJailFine" }
  | { type: "useJailCard" };

export type ActionUnion = GameAction | { type: string } & Record<string, unknown>;

export interface ApplyResult {
  ok: boolean;
  state: GameState;
  events: LogEvent[];
  error?: string;
}

/** The single engine entry point signature (implemented in engine.ts). */
export type ApplyFn = (input: {
  state: GameState;
  playerId: string;
  action: ActionUnion;
  rng: Rng;
}) => ApplyResult;

/** Everything a deed records. Keys are space indices for properties/railroads/utilities. */
export interface OwnershipEntry {
  ownerId: string;
  houses: number; // 0..4, 5 = hotel
  mortgaged: boolean;
}

/** A drawn card's resolution data (kept transient; decks in state are index arrays). */
export interface PendingBuy {
  type: "buy";
  spaceIndex: number;
  price: number;
}

export interface PendingDebt {
  type: "debt";
  playerIdx: number;
  creditorId: string; // player id or "bank"
  amountDue: number;
  reason: string;
}

export type Pending = PendingBuy | PendingDebt;

export interface GameState {
  version: number;
  phase: "lobby" | "playing" | "finished";
  winner?: string;
  players: Player[];
  turn: TurnState;
  dice: [number, number];
  /** Deck order is a server secret: number[] of card indices (see cards.ts). */
  decks: { chance: number[]; chest: number[] };
  ownership: Record<number, OwnershipEntry>;
  log: LogEvent[];
  logSeq: number;
  /** The current decision the acting player must make, if any. */
  pending?: Pending;
  /** Host-chosen room rules; absent on games saved before settings existed (read via settingsOf). */
  settings?: RoomSettings;
  /** Free Parking jackpot pot (only used when settings.parkingJackpot). */
  pot?: number;
}

export const START_MONEY = 1500;
export const GO_SALARY = 200;
export const GO_SALARY_BONUS = 200; // extra when landing exactly on GO (AGENTS.md decision 9 family)
export const JAIL_TILE = 10;
export const JAIL_FINE = 50;
export const MAX_DOUBLES = 3;
export const MAX_JAIL_TURNS = 3;
export const LOG_CAP = 200;

export function createState(
  names: { id: string; name: string; colorToken: string }[]
): GameState {
  return {
    version: 0,
    phase: "playing",
    players: names.map((n, i) => ({
      id: n.id,
      name: n.name,
      colorToken: n.colorToken,
      money: START_MONEY,
      position: 0,
      inJail: false,
      jailTurns: 0,
      bankrupt: false,
      connected: true,
      isHost: i === 0,
      isBot: false,
      secret: `secret-${n.id}`,
      jailCards: 0,
    })),
    turn: { playerIdx: 0, phase: "preRoll", doublesCount: 0, rolled: false },
    dice: [1, 1],
    decks: { chance: [], chest: [] },
    ownership: {},
    log: [],
    logSeq: 0,
  };
}

export function logEvent(
  state: GameState,
  kind: LogEventKind,
  text: string,
  extra?: { actor?: string; amount?: number }
): void {
  const id = state.logSeq + 1;
  state.logSeq = id;
  state.log.push({ id, kind, text, ...extra });
  if (state.log.length > LOG_CAP) {
    state.log.splice(0, state.log.length - LOG_CAP);
  }
}
