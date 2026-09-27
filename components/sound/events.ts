/**
 * Engine log entry → sound effect. Pure (unit-tested). Rolls, steps and the turn chime are
 * triggered elsewhere (dice/pawn animations, turn change), so they map to null here.
 */
import type { ClientGameState } from "@/lib/shared/events";

import type { SfxName } from "./sfx";

type LogEntry = ClientGameState["log"][number];

export function soundForEvent(e: LogEntry, me: string | null): SfxName | null {
  const t = e.text;
  if (e.kind === "turn" || e.kind === "roll") return null;
  if (/wins the game/.test(t)) return "win";
  if (/BANKRUPT/.test(t)) return "bankrupt";
  if (/jackpot/i.test(t)) return "go";
  if (/ buys /.test(t)) return "buy";
  if (/ builds /.test(t)) return "build";
  if (/unmortgage|mortgage/i.test(t)) return "mortgage";
  const rent = /^(.+?) pays \$\d+ rent to (.+?) for /.exec(t);
  if (rent) {
    if (me && rent[2] === me) return "rentGet";
    if (me && rent[1] === me) return "rentPay";
    return "coin";
  }
  if (/draws (Chance|Community Chest)|Get Out of Jail card/.test(t)) return "card";
  if (/passes GO|lands exactly on GO/.test(t)) return "go";
  if (e.kind === "jail" && /sent to Jail|goes to jail/i.test(t)) return "jail";
  if (e.kind === "jail" && /fine/.test(t)) return "coin";
  if (/Tax$/.test(t)) return "tax";
  if (/sells? .*(house|hotel|building)/i.test(t)) return "coin";
  return null;
}

/**
 * Sounds for a batch of new log entries: drop nulls and immediate repeats, cap the batch so
 * a burst of bot actions doesn't turn into noise.
 */
export function soundsForBatch(entries: LogEntry[], me: string | null, cap = 4): SfxName[] {
  const out: SfxName[] = [];
  for (const e of entries) {
    const s = soundForEvent(e, me);
    if (s && out[out.length - 1] !== s) out.push(s);
  }
  return out.slice(0, cap);
}
