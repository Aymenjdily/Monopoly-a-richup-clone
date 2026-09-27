/**
 * In-game guide (AGENTS.md section 2: "In-game guide"). PURE advice, no rule enforcement:
 * reads only public state (no decks, secrets, RNG), never mutates, and the server still
 * validates every action. The browser may run it on the state it already has.
 */
import { BOARD, type GroupId } from "./board";
import { rentDue, spaceIndicesInGroup, unmortgageCost } from "./ownershipRules";
import { settingsOf } from "./settings";
import { JAIL_FINE, type GameState, type Player } from "./types";

/** Cash the guide tries to keep on hand for surprise rents. */
export const RESERVE = 300;

export type AdviceTone = "great" | "good" | "info" | "warn" | "bad";
export type AdviceActionType = "buy" | "decline" | "roll" | "endTurn" | "build" | "mortgage" | "unmortgage" | "payJailFine" | "useJailCard";

export interface AdviceAction {
  type: AdviceActionType;
  spaceIndex?: number;
  label: string;
  primary?: boolean;
}

export interface AdviceItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  tag?: { label: string; tone: AdviceTone };
  actions?: AdviceAction[];
}

export interface Advice {
  /** true when it's the viewer's turn and there's a "do now" item worth flagging */
  urgent: boolean;
  now: AdviceItem[];
  upgrade: AdviceItem[];
  watch: AdviceItem[];
  tips: string[];
}

/** The subset of state the advisor reads (the sanitized client state satisfies it). */
export type AdvisorState = Pick<GameState, "phase" | "players" | "turn" | "ownership" | "pending" | "settings"> & {
  /** only each entry's kind is read (to count turns for tips) */
  log: { kind: string }[];
};

export interface AdvisorOptions {
  /** Human name for a set (e.g. "Turkey"); defaults to the group id. */
  groupLabel?: (group: GroupId) => string;
}

const money = (n: number) => `$${Math.abs(n).toLocaleString("en-US")}`;
const STREET_GROUPS: GroupId[] = ["brown", "lightblue", "pink", "orange", "red", "yellow", "green", "darkblue"];
/** Probability of rolling `total` with two dice. */
export const rollOdds = (total: number) => (total < 2 || total > 12 ? 0 : (6 - Math.abs(total - 7)) / 36);

export function advise(input: AdvisorState, meId: string | null, opts: AdvisorOptions = {}): Advice {
  const state = input as GameState; // rentDue takes GameState; advisor only reads public fields
  const label = opts.groupLabel ?? ((g: GroupId) => g);
  const empty: Advice = { urgent: false, now: [], upgrade: [], watch: [], tips: [] };
  const me = state.players.find((p) => p.id === meId);
  if (!me) return empty;
  if (state.phase !== "playing") return empty;
  if (me.bankrupt) {
    return { ...empty, now: [{ id: "out", icon: "🏳️", title: "You're out of this game", detail: "You can keep watching the others play it out." }] };
  }

  const current = state.players[state.turn.playerIdx];
  const myTurn = current?.id === me.id;
  const now: AdviceItem[] = [];
  const upgrade = upgradeAdvice(state, me, label, myTurn);
  const watch = watchAdvice(state, me);

  if (!myTurn) {
    now.push({ id: "wait", icon: "⏳", title: `Waiting for ${current?.name ?? "the next player"}`, detail: "Plan your next move — building and mortgaging happen on your turn." });
  } else if (state.pending?.type === "buy") {
    now.push(buyAdvice(state, me, state.pending.spaceIndex, state.pending.price, label));
  } else if (state.turn.phase === "preRoll" && me.inJail) {
    now.push(jailAdvice(state, me));
  } else if (state.turn.phase === "preRoll") {
    const again = state.turn.doublesCount > 0;
    now.push({
      id: "roll",
      icon: "🎲",
      title: again ? "Doubles — roll again!" : "Roll the dice",
      detail: again ? "Doubles give you another roll (three in a row sends you to jail)." : "Your turn starts with a roll.",
      actions: [{ type: "roll", label: "Roll dice", primary: true }],
    });
  } else if (state.turn.phase === "awaitingAction" && !state.pending) {
    const canBuild = upgrade.some((u) => u.actions?.some((a) => a.type === "build" || a.type === "unmortgage"));
    now.push({
      id: "end",
      icon: "✅",
      title: canBuild ? "Build, then end your turn" : "End your turn",
      detail: canBuild ? "You can afford an upgrade below before passing the dice." : "Nothing else worth doing right now.",
      actions: [{ type: "endTurn", label: "End turn", primary: !canBuild }],
    });
  }

  const cash = cashAdvice(state, me, label, myTurn);
  if (cash) now.push(cash);

  return {
    urgent: myTurn && now.some((n) => n.actions?.length),
    now,
    upgrade,
    watch,
    tips: tipsFor(state, me),
  };
}

// ── buy ─────────────────────────────────────────────────────────────────────────
export function buyAdvice(state: GameState, me: Player, idx: number, price: number, label: (g: GroupId) => string): AdviceItem {
  const space = BOARD[idx];
  const after = me.money - price;
  const name = space.name;
  const base = { id: `buy-${idx}`, icon: "🏷️", title: `Buy ${name}?` };
  const buyBtn = (primary: boolean): AdviceAction[] => [
    { type: "buy", label: `Buy · ${money(price)}`, primary },
    { type: "decline", label: "Skip", primary: !primary },
  ];

  if (after < 0) {
    return { ...base, detail: `It costs ${money(price)} and you have ${money(me.money)}.`, tag: { label: "CAN'T AFFORD", tone: "bad" }, actions: [{ type: "decline", label: "Skip", primary: true }] };
  }
  const keep = `you keep ${money(after)}`;

  if (space.type === "railroad") {
    const mine = BOARD.filter((s) => s.type === "railroad" && state.ownership[s.index]?.ownerId === me.id).length;
    const ok = after >= RESERVE;
    return { ...base, detail: `Railways pay $25 → $200 as you collect them — this would be your ${ordinal(mine + 1)} · ${keep}.`, tag: ok ? { label: "GOOD BUY", tone: "good" } : { label: "RISKY", tone: "warn" }, actions: buyBtn(ok) };
  }
  if (space.type === "utility") {
    return { ...base, detail: `Utilities pay 4–10× the dice — low value · ${keep}.`, tag: { label: "OPTIONAL", tone: "info" }, actions: buyBtn(after >= RESERVE * 2) };
  }

  const group = space.group as GroupId;
  const set = label(group);
  const members = spaceIndicesInGroup(group);
  const others = members.filter((i) => i !== idx);
  const mine = others.filter((i) => state.ownership[i]?.ownerId === me.id).length;
  const rivalIds = [...new Set(others.map((i) => state.ownership[i]?.ownerId).filter((o): o is string => Boolean(o) && o !== me.id))];

  if (mine === others.length) {
    return { ...base, detail: `Completes your ${set} set — you can build houses next · ${keep}.`, tag: { label: "MUST BUY", tone: "great" }, actions: buyBtn(true) };
  }
  if (rivalIds.length === 1 && others.every((i) => state.ownership[i]?.ownerId === rivalIds[0])) {
    const rival = state.players.find((p) => p.id === rivalIds[0])?.name ?? "A rival";
    return { ...base, detail: `${rival} owns the rest of ${set} — buying it stops them building · ${keep}.`, tag: { label: "BLOCK", tone: "great" }, actions: buyBtn(true) };
  }
  if (after < RESERVE) {
    return { ...base, detail: `You'd drop to ${money(after)} — below a safe ${money(RESERVE)} for surprise rents.`, tag: { label: "RISKY", tone: "warn" }, actions: buyBtn(false) };
  }
  if (rivalIds.length > 0) {
    const rival = state.players.find((p) => p.id === rivalIds[0])?.name ?? "a rival";
    return { ...base, detail: `Hard to complete — ${rival} already has part of ${set} · ${keep}.`, tag: { label: "OPTIONAL", tone: "info" }, actions: buyBtn(false) };
  }
  const hot = group === "orange" || group === "red" ? " Orange and red get landed on most." : "";
  return {
    ...base,
    detail: `${mine === 0 ? `Starts your ${set} set` : `Your ${ordinal(mine + 1)} of ${members.length} in ${set}`} · ${keep}.${hot}`,
    tag: { label: "GOOD BUY", tone: "good" },
    actions: buyBtn(true),
  };
}

// ── jail ────────────────────────────────────────────────────────────────────────
function jailAdvice(state: GameState, me: Player): AdviceItem {
  const danger = Object.values(state.ownership).reduce((n, o) => n + (o.ownerId !== me.id ? o.houses : 0), 0);
  if (me.jailCards > 0) {
    return { id: "jail", icon: "🎟️", title: "Use your Get Out of Jail card", detail: "It's free — keep your cash.", actions: [{ type: "useJailCard", label: "Use card", primary: true }, { type: "roll", label: "Roll for doubles" }] };
  }
  if (danger >= 6) {
    return { id: "jail", icon: "🔒", title: "Stay in jail — it's safer", detail: `Rivals have ${danger} houses on the board. Rolling for doubles keeps you off their rents for up to 3 turns.`, tag: { label: "SAFER", tone: "good" }, actions: [{ type: "roll", label: "Roll for doubles", primary: true }] };
  }
  if (me.money >= JAIL_FINE + RESERVE) {
    return { id: "jail", icon: "🔓", title: `Pay ${money(JAIL_FINE)} and get moving`, detail: "Early in the game you want to be out buying cities.", tag: { label: "RECOMMENDED", tone: "good" }, actions: [{ type: "payJailFine", label: `Pay ${money(JAIL_FINE)}`, primary: true }, { type: "roll", label: "Roll for doubles" }] };
  }
  return { id: "jail", icon: "🔒", title: "Roll for doubles", detail: "Cash is tight — try your luck before paying the fine.", actions: [{ type: "roll", label: "Roll for doubles", primary: true }] };
}

// ── upgrades ────────────────────────────────────────────────────────────────────
function upgradeAdvice(state: GameState, me: Player, label: (g: GroupId) => string, myTurn: boolean): AdviceItem[] {
  const even = settingsOf(state).evenBuilding;
  const items: (AdviceItem & { score: number })[] = [];
  const suffix = myTurn ? "" : " (on your turn)";

  for (const group of STREET_GROUPS) {
    const members = spaceIndicesInGroup(group);
    if (!members.every((i) => state.ownership[i]?.ownerId === me.id)) continue;
    const mortgaged = members.filter((i) => state.ownership[i].mortgaged);
    if (mortgaged.length) {
      for (const i of mortgaged) {
        const cost = unmortgageCost(i);
        const ok = me.money - cost >= RESERVE;
        items.push({
          id: `unmort-${i}`, icon: "🏦", title: `Unmortgage ${BOARD[i].name}`,
          detail: ok ? `${money(cost)} — you need the whole ${label(group)} set clear to build.` : `${money(cost)} — save up ${money(cost + RESERVE - me.money)} more.`,
          tag: ok ? { label: "UNLOCKS BUILDING", tone: "good" } : undefined,
          actions: ok ? [{ type: "unmortgage", spaceIndex: i, label: `Unmortgage · ${money(cost)}${suffix}` }] : undefined,
          score: ok ? 1 : 0,
        });
      }
      continue;
    }
    const houses = members.map((i) => state.ownership[i].houses);
    const min = Math.min(...houses);
    const candidates = members.filter((i) => state.ownership[i].houses < 5 && (!even || state.ownership[i].houses === min));
    let best: { i: number; gain: number; from: number; to: number } | null = null;
    for (const i of candidates) {
      const h = state.ownership[i].houses;
      const ladder = BOARD[i].rentLadder!;
      const from = rentDue(state, i, 7).kind === "rent" ? (rentDue(state, i, 7) as { amount: number }).amount : ladder[h];
      const to = ladder[h + 1];
      if (!best || to - from > best.gain) best = { i, gain: to - from, from, to };
    }
    if (!best) continue;
    const cost = BOARD[best.i].houseCost ?? 0;
    const h = state.ownership[best.i].houses;
    const ok = me.money - cost >= RESERVE;
    const what = h === 4 ? "a hotel" : `house ${h + 1}`;
    items.push({
      id: `build-${best.i}`, icon: "🏗️", title: `Build on ${label(group)}`,
      detail: `${what[0].toUpperCase()}${what.slice(1)} on ${BOARD[best.i].name}: rent ${money(best.from)} → ${money(best.to)}${h + 1 === 3 ? " (3 houses is the sweet spot)" : ""}.${ok ? "" : ` Save up ${money(cost + RESERVE - me.money)} more first.`}`,
      actions: ok ? [{ type: "build", spaceIndex: best.i, label: `Build · ${money(cost)}${suffix}` }] : undefined,
      score: ok ? best.gain / Math.max(1, cost) : -1,
    });
  }

  items.sort((a, b) => b.score - a.score);
  const top = items.slice(0, 2);
  const firstBuild = top.find((t) => t.id.startsWith("build") && t.actions);
  if (firstBuild) firstBuild.tag = { label: "BEST VALUE", tone: "great" };

  if (top.length === 0) {
    // no full set yet: point at the nearest completable one
    let near: { group: GroupId; missing: number[] } | null = null;
    for (const group of STREET_GROUPS) {
      const members = spaceIndicesInGroup(group);
      const mine = members.filter((i) => state.ownership[i]?.ownerId === me.id);
      const blocked = members.some((i) => state.ownership[i] && state.ownership[i].ownerId !== me.id);
      if (!mine.length || blocked) continue;
      const missing = members.filter((i) => !state.ownership[i]);
      if (!near || missing.length < near.missing.length) near = { group, missing };
    }
    if (near) {
      top.push({
        id: `goal-${near.group}`, icon: "🎯", title: `${near.missing.length} ${near.missing.length === 1 ? "city" : "cities"} away from ${label(near.group)}`,
        detail: `Buy ${near.missing.map((i) => BOARD[i].name).join(" and ")} when you land there — a full set lets you build.`, score: 0,
      });
    } else {
      top.push({ id: "goal-none", icon: "🎯", title: "Collect a full set to build", detail: "Houses only go on a complete country set. Buy cities in one country to get there.", score: 0 });
    }
  }
  return top.map(({ score: _s, ...rest }) => {
    void _s;
    return rest;
  });
}

// ── money trouble ───────────────────────────────────────────────────────────────
function cashAdvice(state: GameState, me: Player, label: (g: GroupId) => string, myTurn: boolean): AdviceItem | null {
  if (me.money >= RESERVE / 3) return null;
  const inFullSet = (i: number) => {
    const g = BOARD[i].group;
    return Boolean(g && BOARD[i].type === "property" && spaceIndicesInGroup(g).every((j) => state.ownership[j]?.ownerId === me.id));
  };
  const options = Object.entries(state.ownership)
    .map(([k, o]) => ({ i: Number(k), o }))
    .filter(({ o }) => o.ownerId === me.id && !o.mortgaged && o.houses === 0)
    .sort((a, b) => Number(inFullSet(a.i)) - Number(inFullSet(b.i)) || (BOARD[a.i].mortgageValue ?? 0) - (BOARD[b.i].mortgageValue ?? 0));
  const pick = options[0];
  if (!pick) return null;
  const g = BOARD[pick.i].group;
  return {
    id: `cash-${pick.i}`, icon: "💸", title: "Low on cash — raise some",
    detail: `Mortgage ${BOARD[pick.i].name} for ${money(BOARD[pick.i].mortgageValue ?? 0)}${g && BOARD[pick.i].type === "property" && !inFullSet(pick.i) ? ` (it doesn't break a ${label(g)} set)` : ""}.`,
    tag: { label: "LOW CASH", tone: "warn" },
    actions: myTurn ? [{ type: "mortgage", spaceIndex: pick.i, label: `Mortgage · +${money(BOARD[pick.i].mortgageValue ?? 0)}` }] : undefined,
  };
}

// ── dangers within one roll ─────────────────────────────────────────────────────
export function watchAdvice(state: GameState, me: Player): AdviceItem[] {
  if (me.inJail) return [];
  const hits: { idx: number; total: number; rent: number; odds: number; owner: string; houses: number }[] = [];
  for (let total = 2; total <= 12; total++) {
    const idx = (me.position + total) % 40;
    const own = state.ownership[idx];
    if (!own || own.ownerId === me.id || own.mortgaged) continue;
    const due = rentDue(state, idx, total);
    if (due.kind !== "rent") continue;
    hits.push({ idx, total, rent: due.amount, odds: rollOdds(total), owner: state.players.find((p) => p.id === own.ownerId)?.name ?? "A rival", houses: own.houses });
  }
  const big = hits.filter((h) => h.rent >= 100 || h.rent >= me.money * 0.25).sort((a, b) => b.rent - a.rent).slice(0, 2);
  return big.map((h) => {
    const what = h.houses >= 5 ? "hotel" : h.houses > 0 ? `${h.houses} house${h.houses > 1 ? "s" : ""}` : BOARD[h.idx].type === "property" ? "full set" : BOARD[h.idx].type;
    const cant = h.rent > me.money;
    return {
      id: `watch-${h.idx}`, icon: "⚠️", title: `${h.owner}'s ${what} on ${BOARD[h.idx].name}`,
      detail: `${money(h.rent)} rent if you roll ${h.total} (1 in ${Math.round(1 / h.odds)}).${cant ? " You couldn't cover it — keep a city ready to mortgage." : ""}`,
      tag: cant ? { label: "CAN'T COVER", tone: "bad" } : undefined,
    };
  });
}

// ── tips ────────────────────────────────────────────────────────────────────────
function tipsFor(state: GameState, me: Player): string[] {
  const anyHouses = Object.values(state.ownership).some((o) => o.houses > 0);
  const pool = [
    anyHouses ? "3 houses is the sweet spot — the biggest rent jump per dollar." : "Houses only go on full sets — and 3 houses is the sweet spot.",
    "Orange and red cities get landed on most (players leaving jail pass them).",
    "Railways: owning all 4 pays $200 per landing.",
    `Keep about ${money(RESERVE)} for surprise rents.`,
    "Mortgage cities outside your sets first — never break a set you're building on.",
  ];
  const turn = state.log.filter((e) => e.kind === "turn").length + me.position;
  return [pool[turn % pool.length], pool[(turn + 2) % pool.length]];
}

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
