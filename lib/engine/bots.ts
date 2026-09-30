/**
 * Bot decision support (AGENTS.md decision 13). PURE — no timers, no IO, no network.
 * `botOptions` lists the legal moves for the acting bot; `botChooseRules` is the rule-based
 * brain. The server may ask an external model to pick among the same options
 * (lib/server/botBrain.ts) — either way only these engine-generated actions are ever applied.
 */
import { buyAdvice } from "./advisor";
import { BOARD, type GroupId } from "./board";
import { canBuild, spaceIndicesInGroup, unmortgageCost } from "./ownershipRules";
import { JAIL_FINE } from "./types";
import type { GameAction, GameState, Player } from "./types";

export type BotStyle = "cautious" | "balanced" | "aggressive";
export const BOT_STYLES: readonly BotStyle[] = ["cautious", "balanced", "aggressive"];

/** Cash each personality tries to keep after spending. */
export const BOT_RESERVE: Record<BotStyle, number> = { cautious: 350, balanced: 150, aggressive: 50 };
/** Balanced reserve (kept as a named export for existing callers/tests). */
export const BOT_BUY_RESERVE = BOT_RESERVE.balanced;

export const BOT_STYLE_BRIEF: Record<BotStyle, string> = {
  cautious: `Cautious banker: still buys cities and railroads, but only when at least $${BOT_RESERVE.cautious} cash is left afterwards; skips utilities; builds only when that reserve is kept. Always buys a city that completes a set.`,
  balanced: `Balanced player: buys most properties as long as about $${BOT_RESERVE.balanced} cash is left afterwards, and builds on full sets when that reserve is kept.`,
  aggressive: `Aggressive tycoon: buys almost everything it can afford, builds as fast as possible, and is happy with as little as $${BOT_RESERVE.aggressive} cash.`,
};

export interface BotOption {
  /** stable id, safe to use as a model's choice key */
  id: string;
  action: GameAction;
  /** short human/model-readable description including the key facts */
  label: string;
}

const STREETS: GroupId[] = ["brown", "lightblue", "pink", "orange", "red", "yellow", "green", "darkblue"];
const styleOf = (p: Player): BotStyle => (BOT_STYLES.includes(p.botStyle as BotStyle) ? (p.botStyle as BotStyle) : "balanced");
const money = (n: number) => `$${n}`;

function actingBot(state: GameState): Player | null {
  if (state.phase !== "playing") return null;
  const p = state.players[state.turn.playerIdx];
  return p && p.isBot && !p.bankrupt ? p : null;
}

/** Best next house per full set the bot owns (the engine's canBuild decides legality). */
function buildTargets(state: GameState, me: Player): { idx: number; cost: number; from: number; to: number }[] {
  const out: { idx: number; cost: number; from: number; to: number }[] = [];
  for (const group of STREETS) {
    const members = spaceIndicesInGroup(group);
    if (!members.every((i) => state.ownership[i]?.ownerId === me.id)) continue;
    let best: { idx: number; cost: number; from: number; to: number } | null = null;
    for (const i of members) {
      if (!canBuild(state, me.id, i).ok) continue;
      const h = state.ownership[i].houses;
      const ladder = BOARD[i].rentLadder!;
      const cand = { idx: i, cost: BOARD[i].houseCost ?? 0, from: ladder[h], to: ladder[h + 1] };
      if (!best || cand.to - cand.from > best.to - best.from) best = cand;
    }
    if (best) out.push(best);
  }
  return out;
}

/** Mortgaged cities inside a fully-owned set that the bot could afford to unmortgage. */
function unmortgageTargets(state: GameState, me: Player): { idx: number; cost: number }[] {
  const out: { idx: number; cost: number }[] = [];
  for (const group of STREETS) {
    const members = spaceIndicesInGroup(group);
    if (!members.every((i) => state.ownership[i]?.ownerId === me.id)) continue;
    for (const i of members) {
      if (!state.ownership[i].mortgaged) continue;
      const cost = unmortgageCost(i);
      if (me.money >= cost) out.push({ idx: i, cost });
    }
  }
  return out;
}

/** Every legal move for the bot whose turn it is ([] when it is not a bot's turn). */
export function botOptions(state: GameState): BotOption[] {
  const me = actingBot(state);
  if (!me) return [];

  if (state.turn.phase === "preRoll") {
    const opts: BotOption[] = [];
    if (me.inJail) {
      if (me.jailCards > 0) opts.push({ id: "use_card", action: { type: "useJailCard" }, label: "Use the Get Out of Jail card (free) and then roll." });
      if (me.money >= JAIL_FINE) opts.push({ id: "pay_fine", action: { type: "payJailFine" }, label: `Pay the ${money(JAIL_FINE)} fine to leave jail and then roll.` });
      opts.push({ id: "roll", action: { type: "roll" }, label: "Stay in jail and roll for doubles (safe from rents while inside)." });
      return opts;
    }
    return [{ id: "roll", action: { type: "roll" }, label: "Roll the dice." }];
  }

  if (state.turn.phase === "awaitingAction") {
    const pending = state.pending;
    if (pending?.type === "buy") {
      const opts: BotOption[] = [];
      if (me.money >= pending.price) {
        const tip = buyAdvice(state, me, pending.spaceIndex, pending.price, (g) => g);
        opts.push({ id: "buy", action: { type: "buy" }, label: `Buy ${BOARD[pending.spaceIndex].name} for ${money(pending.price)}, cash left ${money(me.money - pending.price)}. ${tip.tag?.label ?? ""}: ${tip.detail}` });
      }
      opts.push({ id: "pass", action: { type: "decline" }, label: `Do not buy ${BOARD[pending.spaceIndex].name}; keep ${money(me.money)} cash.` });
      return opts;
    }
    if (pending) return []; // debts settle automatically in the engine

    const opts: BotOption[] = [];
    for (const t of buildTargets(state, me)) {
      const h = state.ownership[t.idx].houses;
      opts.push({
        id: `build_${t.idx}`,
        action: { type: "build", spaceIndex: t.idx },
        label: `Build ${h === 4 ? "a hotel" : `house ${h + 1}`} on ${BOARD[t.idx].name} for ${money(t.cost)}: rent ${money(t.from)} -> ${money(t.to)}, cash left ${money(me.money - t.cost)}.`,
      });
    }
    for (const t of unmortgageTargets(state, me)) {
      opts.push({
        id: `unmortgage_${t.idx}`,
        action: { type: "unmortgage", spaceIndex: t.idx },
        label: `Unmortgage ${BOARD[t.idx].name} for ${money(t.cost)} (needed to build on that set), cash left ${money(me.money - t.cost)}.`,
      });
    }
    opts.push({ id: "end_turn", action: { type: "endTurn" }, label: `End the turn, keeping ${money(me.money)} cash.` });
    return opts;
  }
  return [];
}

/** Rule-based pick among `botOptions` (deterministic; also the fallback for the model brain). */
export function botChooseRules(state: GameState, options: BotOption[] = botOptions(state)): BotOption | null {
  const me = actingBot(state);
  if (!me || options.length === 0) return null;
  const style = styleOf(me);
  const reserve = BOT_RESERVE[style];
  const find = (id: string) => options.find((o) => o.id === id);

  if (state.turn.phase === "preRoll") {
    if (me.inJail) {
      if (find("use_card")) return find("use_card")!;
      const rivalHouses = Object.values(state.ownership).reduce((n, o) => n + (o.ownerId !== me.id ? o.houses : 0), 0);
      const stay = style === "cautious" ? rivalHouses >= 3 : style === "balanced" ? rivalHouses >= 8 : false;
      const afford = style === "aggressive" ? me.money >= JAIL_FINE : me.money >= JAIL_FINE * 2;
      if (!stay && afford && find("pay_fine")) return find("pay_fine")!;
    }
    return find("roll") ?? options[0];
  }

  const pending = state.pending;
  if (pending?.type === "buy") {
    const buy = find("buy");
    if (!buy) return find("pass") ?? options[0];
    const space = BOARD[pending.spaceIndex];
    const others = space.group ? spaceIndicesInGroup(space.group).filter((i) => i !== pending.spaceIndex) : [];
    const completes = space.type === "property" && others.length > 0 && others.every((i) => state.ownership[i]?.ownerId === me.id);
    if (completes) return buy; // a full set is always worth it
    if (style === "cautious" && space.type === "utility") return find("pass") ?? buy;
    return me.money - pending.price >= reserve ? buy : (find("pass") ?? buy);
  }

  // management: best rent-per-dollar build that keeps the reserve, else unmortgage, else end
  let best: { opt: BotOption; score: number } | null = null;
  for (const t of buildTargets(state, me)) {
    const opt = find(`build_${t.idx}`);
    if (!opt || me.money - t.cost < reserve) continue;
    const score = (t.to - t.from) / Math.max(1, t.cost);
    if (!best || score > best.score) best = { opt, score };
  }
  if (best) return best.opt;
  for (const t of unmortgageTargets(state, me)) {
    const opt = find(`unmortgage_${t.idx}`);
    if (opt && me.money - t.cost >= reserve) return opt;
  }
  return find("end_turn") ?? options[0];
}

/** Rule-based action for the acting bot, or null when it is not a bot's turn. */
export function botChoose(state: GameState): GameAction | null {
  return botChooseRules(state)?.action ?? null;
}
