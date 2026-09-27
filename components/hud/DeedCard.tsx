"use client";

/**
 * Property deed card (F3). Opens for the pending buy (Buy / Decline) or when a tile is
 * clicked (details only). All numbers come from the BOARD config + ownership — display
 * data only; the server still decides every action.
 */
import { useEffect } from "react";

import { CITY_LANDMARK, GROUP_FLAG, SPACE_ICON } from "@/components/board3d/theme";
import { BOARD } from "@/lib/engine/board";
import type { ClientGameState } from "@/lib/shared/events";

import { Flag, SET_NAME } from "./bits";
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

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center p-3" role="dialog" aria-modal="true" aria-label={`${space.name} deed`}>
      <button aria-label="Close" className="absolute inset-0 cursor-default bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-[380px] overflow-hidden rounded-[26px] border-[3px] border-ink bg-white shadow-[0_8px_0_#1f1b2e,22px_26px_0_rgba(31,27,46,.12)]">
        <div className="flex items-center gap-3 border-b-[3px] border-ink px-[18px] py-3.5" style={{ background: owner && !own?.mortgaged ? `${owner.colorToken}33` : "#e6ded0" }}>
          <div className="text-[44px] leading-none">{art}</div>
          <div className="min-w-0">
            <div className="text-[12px] font-black tracking-[0.14em] text-[#6f6580]">{status}</div>
            <div className="truncate text-[30px] font-black leading-none">{space.name}</div>
          </div>
          <div className="ml-auto flex flex-none items-center gap-2">
            {flag && <Flag code={flag} />}
            {!canDecide && (
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-[10px] border-[2.5px] border-ink bg-white font-black shadow-[0_2px_0_#1f1b2e]">
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="px-[18px] pb-4 pt-3">
          {rows.length > 0 ? (
            rows.map(([label, v], i) => (
              <div key={label} className={`flex justify-between border-b-2 border-dashed border-[#eee5d6] py-[5px] text-sm font-extrabold ${i === 0 ? "text-ink" : "text-[#6f6580]"}`}>
                <span>{label}</span>
                <b className="text-ink">{typeof v === "number" ? formatMoney(v) : v}</b>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm font-bold text-[#6f6580]">{space.effect?.amount ? `Pay ${formatMoney(space.effect.amount)} when you land here.` : "A special space — nothing to buy here."}</p>
          )}
          {buyable && (
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs font-extrabold text-[#8a809b]">
              {space.houseCost ? <span>House {formatMoney(space.houseCost)} each</span> : <span>Price {formatMoney(price)}</span>}
              {space.mortgageValue ? <span>Mortgage {formatMoney(space.mortgageValue)}</span> : null}
              {setMates.length > 0 && <span className="w-full truncate pt-1">{setMates.join(" · ")}</span>}
            </div>
          )}
          {canDecide && me && (
            <>
              <div className="mt-3.5 flex gap-2.5">
                <button
                  onClick={onBuy}
                  disabled={busy || me.money < price}
                  className="flex-1 rounded-[15px] border-[3px] border-ink bg-mint py-[11px] text-base font-black shadow-[0_4px_0_#1f1b2e] active:translate-y-[2px] active:shadow-[0_2px_0_#1f1b2e] disabled:opacity-50"
                >
                  Buy · {formatMoney(price)}
                </button>
                <button
                  onClick={onDecline}
                  disabled={busy}
                  className="rounded-[15px] border-[3px] border-ink bg-white px-[18px] py-[11px] text-base font-black shadow-[0_4px_0_#1f1b2e] disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
              <div className="mt-2.5 text-center text-xs font-extrabold text-[#8a809b]">
                {me.money >= price
                  ? `You have ${formatMoney(me.money)} · after buying ${formatMoney(me.money - price)}`
                  : `You have ${formatMoney(me.money)} — not enough to buy`}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
