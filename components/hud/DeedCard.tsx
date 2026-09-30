"use client";

/**
 * Property deed card (G2): docked on desktop, a modal on small screens. Opens for the pending buy (Buy / Decline) or when a tile is
 * clicked (details only). All numbers come from the BOARD config + ownership — display
 * data only; the server still decides every action.
 */
import { useEffect } from "react";

import { CITY_LANDMARK, GROUP_FLAG, SPACE_ICON } from "@/components/board3d/theme";
import { buyAdvice } from "@/lib/engine/advisor";
import { BOARD } from "@/lib/engine/board";
import type { ClientGameState } from "@/lib/shared/events";

import { Coins, Flag, SET_NAME } from "./bits";
import { formatMoney } from "./history";

export function DeedCard({
  index,
  state,
  myId,
  busy,
  onBuy,
  onDecline,
  onClose,
}: {
  index: number;
  state: ClientGameState;
  myId: string | null;
  busy: boolean;
  onBuy: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const space = BOARD[index];
  if (!space) return null;
  const buyable = space.type === "property" || space.type === "railroad" || space.type === "utility";
  const own = state.ownership[index];
  const owner = own ? state.players.find((p) => p.id === own.ownerId) : undefined;
  const me = state.players.find((p) => p.id === myId);
  const current = state.players[state.turn.playerIdx];
  const canDecide = Boolean(me && current?.id === me.id && state.pending?.type === "buy" && state.pending.spaceIndex === index);
  const price = space.price ?? 0;
  const set = space.group ? SET_NAME[space.group] : undefined;
  const flag = space.group ? GROUP_FLAG[space.group] : undefined;
  const art = CITY_LANDMARK[index] ?? SPACE_ICON[index] ?? "🏷️";

  const status = !buyable
    ? "BOARD SPACE"
    : own?.mortgaged
      ? `MORTGAGED · ${owner?.name ?? ""}`
      : owner
        ? `OWNED BY ${owner.id === myId ? "YOU" : owner.name.toUpperCase()}`
        : `FOR SALE${set ? ` · ${set.toUpperCase()}` : ""}`;

  const rows: [string, number | string][] = [];
  if (space.type === "property" && space.rentLadder) {
    const l = space.rentLadder;
    rows.push(["Rent", l[0]], [`With full ${set ?? ""} set`, l[0] * 2], ["With 1 house", l[1]], ["With 2 houses", l[2]], ["With 3 houses", l[3]], ["With 4 houses", l[4]], ["With a hotel", l[5]]);
  } else if (space.type === "railroad") {
    rows.push(["Own 1 railway", 25], ["Own 2 railways", 50], ["Own 3 railways", 100], ["Own 4 railways", 200]);
  } else if (space.type === "utility") {
    rows.push(["Own 1 utility", "4× dice"], ["Own both", "10× dice"]);
  }
  const setMates = space.group
    ? BOARD.filter((s) => s.group === space.group && s.index !== index).map((s) => {
        const o = state.ownership[s.index];
        const who = o ? state.players.find((p) => p.id === o.ownerId) : undefined;
        return `${s.name}: ${who ? (who.id === myId ? "you" : who.name) : "for sale"}`;
      })
    : [];

  // rent grid cells (short labels, as on the G2 card)
  const SHORT: Record<string, string> = {
    Rent: "RENT", "With 1 house": "1 HOUSE", "With 2 houses": "2 HOUSES", "With 3 houses": "3 HOUSES", "With 4 houses": "4 HOUSES", "With a hotel": "HOTEL",
    "Own 1 railway": "1 RAILWAY", "Own 2 railways": "2 RAILWAYS", "Own 3 railways": "3 RAILWAYS", "Own 4 railways": "ALL 4", "Own 1 utility": "1 UTILITY", "Own both": "BOTH",
  };
  const cells = rows.filter(([label]) => label !== "With 4 houses").map(([label, v]) => [SHORT[label] ?? "FULL SET", v] as const);
  const tip = canDecide && me ? buyAdvice(state as never, me as never, index, price, (g) => SET_NAME[g] ?? g) : null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center p-3 lg:static lg:z-auto lg:block lg:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={`${space.name} deed`}
    >
      <button aria-label="Close" className="absolute inset-0 cursor-default bg-black/40 lg:hidden" onClick={onClose} />
      <div className="panel relative w-full max-w-[340px] overflow-hidden lg:max-w-none">
        <div className="flex items-center gap-3 border-b-2 border-line p-3.5" style={{ background: owner && !own?.mortgaged ? `${owner.colorToken}26` : "var(--row)" }}>
          <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-chip text-[32px] leading-none shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]">{art}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10.5px] font-bold tracking-[0.12em] text-muted">{status}</div>
            <div className="truncate text-2xl font-extrabold leading-tight tracking-[-0.02em]">{space.name}</div>
          </div>
          {flag && <Flag code={flag} w={34} />}
          {!canDecide && (
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-chip text-sm font-extrabold shadow-chip">
              ✕
            </button>
          )}
        </div>

        {cells.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-2.5">
            {cells.map(([label, v]) => (
              <div key={label} className="rounded-xl bg-row px-1 py-1.5 text-center">
                <span className="block text-[10px] font-bold tracking-[0.06em] text-muted">{label}</span>
                <b className="text-[15px] font-extrabold">{typeof v === "number" ? formatMoney(v) : v}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3.5 pt-3 text-sm font-semibold text-muted">
            {space.effect?.amount ? `Pay ${formatMoney(space.effect.amount)} when you land here.` : "A special space — nothing to buy here."}
          </p>
        )}

        {buyable && (
          <div className="flex flex-wrap gap-x-3 px-3.5 pt-2 text-[11.5px] font-semibold text-muted">
            <span>Price {formatMoney(price)}</span>
            {space.houseCost ? <span>House {formatMoney(space.houseCost)}</span> : null}
            {space.rentLadder ? <span>4 houses {formatMoney(space.rentLadder[4])}</span> : null}
            {space.mortgageValue ? <span>Mortgage {formatMoney(space.mortgageValue)}</span> : null}
            {setMates.length > 0 && <span className="w-full truncate">{setMates.join(" · ")}</span>}
          </div>
        )}

        {tip && (
          <div className="mx-3.5 mt-2.5 rounded-xl bg-tip px-2.5 py-2 text-[12.5px] font-semibold">
            💡 <b className="font-extrabold">{tip.tag?.label ? tip.tag.label.charAt(0) + tip.tag.label.slice(1).toLowerCase() : "Tip"}</b> — {tip.detail}
          </div>
        )}

        {canDecide && me ? (
          <div className="flex gap-2.5 px-3.5 pb-[18px] pt-3">
            <button onClick={onBuy} disabled={busy || me.money < price} className="gbtn gbtn-buy flex-1">
              BUY <Coins amount={price} />
            </button>
            <button onClick={onDecline} disabled={busy} className="gbtn">
              PASS
            </button>
          </div>
        ) : (
          <div className="pb-3.5" />
        )}
      </div>
    </div>
  );
}
