import {
  logEvent,
  type GameState,
  type Player,
} from "./types";
import { mulberry32, type Rng } from "./rng";
import { freshDecks } from "./cards";
import { DEFAULT_SETTINGS, settingsOf } from "./settings";

export const MAX_PLAYERS = 6;

/** Deterministic token colors in join order (AGENTS.md decision 6 in section 8). */
export const PLAYER_COLORS = [
  "#e5484d", // red
  "#f5a623", // amber
  "#f7cf3c", // yellow
  "#46a758", // green
  "#0072bb", // blue
  "#a459d1", // violet
];

export interface LobbyPlayerInput {
  id: string;
  name: string;
  isHost?: boolean;
}

export function lobbyState(host: LobbyPlayerInput): GameState {
  const state: GameState = {
    version: 0,
    phase: "lobby",
    players: [makePlayer(host, 0, true)],
    turn: { playerIdx: 0, phase: "preRoll", doublesCount: 0, rolled: false },
    dice: [1, 1],
    decks: { chance: [], chest: [] },
    ownership: {},
    log: [],
    logSeq: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
  return state;
}

function makePlayer(input: LobbyPlayerInput, idx: number, isHost: boolean): Player {
  return {
    id: input.id,
    name: input.name,
    colorToken: PLAYER_COLORS[idx % PLAYER_COLORS.length],
    money: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
    connected: true,
    isHost,
    isBot: false,
    secret: "",
    jailCards: 0,
  };
}

export function joinLobby(state: GameState, player: LobbyPlayerInput): GameState {
  if (state.phase !== "lobby") {
    throw new Error("Game already started.");
  }
  const seats = settingsOf(state).maxPlayers;
  if (state.players.length >= Math.min(seats, MAX_PLAYERS)) {
    throw new Error(`Room is full (${seats} players).`);
  }
  if (state.players.some((p) => p.id === player.id)) {
    throw new Error("Player already in room.");
  }
  const joined = makePlayer(player, state.players.length, false);
  state.players.push(joined);
  state.version += 1;
  logEvent(state, "info", `${player.name} joined the room.`, { actor: player.name });
  return state;
}

const BOT_NAMES = ["Dice Bot", "Rent Bot", "Rail Bot", "Bandit Bot", "Pawn Bot", "Tiny Bot"];

/** Fills an empty seat with a server-driven bot (names/colors stay deterministic). */
export function addBot(state: GameState, botId: string): GameState {
  if (state.phase !== "lobby") {
    throw new Error("Bots can be added only in the lobby.");
  }
  const seats = settingsOf(state).maxPlayers;
  if (state.players.length >= Math.min(seats, MAX_PLAYERS)) {
    throw new Error(`Room is full (${seats} players).`);
  }
  const used = new Set(state.players.map((p) => p.name));
  const pick = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${state.players.length}`;
  const bot = makePlayer({ id: botId, name: pick }, state.players.length, false);
  bot.isBot = true;
  bot.secret = "";
  state.players.push(bot);
  state.version += 1;
  logEvent(state, "info", `${bot.name} joined the room (bot).`, { actor: bot.name });
  return state;
}

/** Removes a player (bots or humans) from the LOBBY only; humans may be the host. */
export function removePlayer(state: GameState, playerId: string): GameState {
  if (state.phase !== "lobby") {
    throw new Error("Cannot remove players after the game started.");
  }
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) throw new Error("Player not in room.");
  const [gone] = state.players.splice(idx, 1);
  if (state.players.length === 0) {
    state.version += 1;
    return state;
  }
  if (gone && gone.isHost) {
    state.players[0].isHost = true;
    logEvent(state, "info", `${state.players[0].name} is the new host.`, {
      actor: state.players[0].name,
    });
  }
  state.version += 1;
  logEvent(state, "info", `${gone?.name ?? "A player"} left the room.`);
  return state;
}

export function leaveLobby(state: GameState, playerId: string): GameState {
  const removed = removePlayer(state, playerId);
  return removed;
}

/** Starts the match: shuffles both decks with the server-seeded RNG and flips phase. */
export function startGame(state: GameState, rng: Rng): GameState {
  if (state.phase !== "lobby") throw new Error("Already started.");
  if (state.players.length < 2) throw new Error("Need at least 2 players.");
  const decks = freshDecks();
  state.decks = {
    chance: shuffled(decks.chance, rng),
    chest: shuffled(decks.chest, rng),
  };
  const settings = settingsOf(state);
  state.settings = settings;
  state.pot = 0;
  for (const p of state.players) p.money = settings.startCash;
  if (settings.randomOrder) state.players = shuffled(state.players, rng);
  state.phase = "playing";
  state.turn = { playerIdx: 0, phase: "preRoll", doublesCount: 0, rolled: false };
  state.version += 1;
  logEvent(state, "info", `${state.players[0].name} started the game. ${state.players.length} players in.`);
  return state;
}

function shuffled<T>(indices: T[], rng: Rng): T[] {
  const arr = [...indices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (0 | (rng.next() * (i + 1))) as number;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { mulberry32 };
