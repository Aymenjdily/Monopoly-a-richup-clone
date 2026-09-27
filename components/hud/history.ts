/**
 * Turns the engine log (already in the sanitized client state) into the History feed:
 * grouped by turn, newest turn first, with an icon, a tint and a signed amount per event.
 * Pure — unit-tested in history.test.ts.
 */
import type { ClientGameState } from "@/lib/shared/events";

type LogEntry = ClientGameState["log"][number];

export type AmountTone = "plus" | "minus" | "neutral" | "pot";

export interface HistoryItem {
  key: string;
  icon: string;
  tint: string;
  text: string;
  /** Amount to show, already sign-adjusted for the viewer; undefined = no pill. */
  amount?: number;
  tone?: AmountTone;
  moves: boolean;
}

export interface HistoryGroup {
  key: string;
  /** 1-based turn number; 0 = before the first turn (setup). */
  turn: number;
  actor?: string;
  items: HistoryItem[];
}

export type HistoryFilter = "all" | "money" | "moves";

const ICONS: [RegExp, string, string][] = [
  [/wins the game/, "👑", "#fff1c4"],
  [/BANKRUPT/, "💀", "#ffdbe1"],
  [/jackpot/i, "🅿️", "#ece6ff"],
  [/may buy/, "🏷️", "#fffaf0"],
  [/declines to buy/, "🙅", "#f1eadc"],
  [/ buys /, "🏙️", "#e3f8ec"],
  [/ builds /, "🏠", "#e3f8ec"],
  [/sells? .*(house|hotel|building)/i, "🏚️", "#f1eadc"],
  [/mortgage/i, "🏦", "#e6ded0"],
  [/ rent /, "💸", "#ffe3e8"],
  [/Tax/, "🧾", "#ffe3e8"],
  [/draws (Chance|Community Chest)/, "🃏", "#eee8ff"],
  [/Get Out of Jail/, "🎟️", "#eee8ff"],
  [/passes GO|lands exactly on GO/, "➡️", "#dcf6e8"],
  [/joined the room|started the game|new host|left the room|Room rules/, "👋", "#fffaf0"],
];

function iconFor(e: LogEntry): [string, string] {
  for (const [re, icon, tint] of ICONS) if (re.test(e.text)) return [icon, tint];
  if (e.kind === "roll") return ["🎲", "#fff1c4"];
  if (e.kind === "jail") return ["🚔", "#ffdbe1"];
  if (e.kind === "move") return ["➡️", "#dcf6e8"];
  if (e.kind === "money" || e.kind === "tax") return ["💵", "#e3f8ec"];
  return ["•", "#f1eadc"];
}

const isBankFee = (text: string) => /Tax$|jail fine|to leave jail|pays \$\d+: /.test(text);
const isCollect = (e: LogEntry) => /collects( the partial payment)?\.$/.test(e.text) && (e.amount ?? 0) > 0;

/**
 * @param me name of the viewing player (for +/− on transfers), or null for spectators
 * @param jackpot whether bank fees feed the Free Parking pot (room setting)
 */
export function buildHistory(log: LogEntry[], me: string | null, jackpot: boolean): HistoryGroup[] {
  const groups: HistoryGroup[] = [{ key: "setup", turn: 0, items: [] }];
  let turn = 0;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    const key = String(e.id ?? `i${i}`);
    if (e.kind === "turn") {
      turn += 1;
      groups.push({ key: `t${key}`, turn, actor: e.actor, items: [] });
      continue;
    }
    if (isCollect(e)) continue; // folded into the payment right before it
    const group = groups[groups.length - 1];
    const [icon, tint] = iconFor(e);
    const item: HistoryItem = {
      key,
      icon,
      tint,
      text: e.text.replace(/\.$/, ""),
      moves: e.kind === "roll" || e.kind === "move" || e.kind === "jail",
    };
    // Only money-moving events get a pill (roll events carry the dice total in amount).
    const moneyKind = e.kind === "money" || e.kind === "tax" || e.kind === "jail";
    if (moneyKind && typeof e.amount === "number" && e.amount !== 0) {
      const next = log[i + 1];
      const transferTo = next && isCollect(next) && next.amount === -e.amount ? next.actor : undefined;
      if (transferTo) {
        // payer → receiver: sign from the viewer's side, neutral for bystanders
        const abs = Math.abs(e.amount);
        if (me && me === transferTo) Object.assign(item, { amount: abs, tone: "plus" });
        else if (me && me === e.actor) Object.assign(item, { amount: -abs, tone: "minus" });
        else Object.assign(item, { amount: abs, tone: "neutral" });
      } else if (e.amount < 0 && jackpot && isBankFee(e.text)) {
        Object.assign(item, { amount: -e.amount, tone: "pot" });
      } else {
        Object.assign(item, { amount: e.amount, tone: e.amount > 0 ? "plus" : "minus" });
      }
    }
    group.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0 || g.turn > 0).reverse();
}

export function filterHistory(groups: HistoryGroup[], filter: HistoryFilter): HistoryGroup[] {
  if (filter === "all") return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => (filter === "money" ? it.amount !== undefined : it.moves)) }))
    .filter((g) => g.items.length > 0);
}

export const formatMoney = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US")}`;
