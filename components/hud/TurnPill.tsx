"use client";

/** Bottom-left turn pill (F3): dice, whose turn, the turn's primary actions, rule chips. */
import type { ReactNode } from "react";

import { BOARD } from "@/lib/engine/board";
import { settingsOf } from "@/lib/engine/settings";
import { JAIL_FINE } from "@/lib/engine/types";
import type { ClientGameState } from "@/lib/shared/events";

import { DieFace } from "./bits";
import { formatMoney } from "./history";

export function TurnPill({
  state,
  myId,
  busy,
  send,
  onReviewBuy,
  onManage,
}: {
  state: ClientGameState;
  myId: string | null;
  busy: boolean;
  send: (action: { type: string }) => void;
  onReviewBuy: () => void;
  onManage: () => void;
}) {
  const s = settingsOf(state);
  const current = state.players[state.turn.playerIdx];
  const me = state.players.find((p) => p.id === myId);
  const myTurn = state.phase === "playing" && Boolean(me) && current?.id === me?.id;
  const turnNo = state.log.filter((e) => e.kind === "turn").length;
  const [a, b] = state.dice;
  const pendingBuy = myTurn && state.pending?.type === "buy" ? state.pending : undefined;

  const btn = "whitespace-nowrap rounded-[12px] border-[2.5px] border-ink px-3 py-[7px] text-[13px] font-black shadow-[0_3px_0_#1f1b2e] active:translate-y-[2px] active:shadow-[0_1px_0_#1f1b2e] disabled:opacity-45";
  const actions: ReactNode[] = [];
  if (myTurn && me) {
    if (pendingBuy) {
      actions.push(
        <button key="review" className={`${btn} bg-mint`} onClick={onReviewBuy}>
          🏷️ {BOARD[pendingBuy.spaceIndex]?.name} · {formatMoney(pendingBuy.price)}
        </button>
      );
    } else if (state.turn.phase === "preRoll") {
      if (me.inJail) {
        actions.push(
          <button key="fine" disabled={busy || me.money < JAIL_FINE} className={`${btn} bg-mango`} onClick={() => send({ type: "payJailFine" })}>
            Pay {formatMoney(JAIL_FINE)}
          </button>
        );
        if (me.jailCards > 0)
          actions.push(
            <button key="card" disabled={busy} className={`${btn} bg-lilac`} onClick={() => send({ type: "useJailCard" })}>
              🎟️ Use card
            </button>
          );
      }
      actions.push(
        <button key="roll" disabled={busy} className={`${btn} bg-coral text-white`} onClick={() => send({ type: "roll" })}>
          🎲 Roll dice
        </button>
      );
    } else if (!state.pending) {
      actions.push(
        <button key="end" disabled={busy} className={`${btn} bg-ink text-white`} onClick={() => send({ type: "endTurn" })}>
          End turn
        </button>
      );
    }
  }
  if (me && !me.bankrupt && state.phase === "playing") {
    actions.push(
      <button key="manage" className={`${btn} bg-white`} onClick={onManage}>
        🏗️ Build · 🏦 Mortgage
      </button>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1.5">
        {s.parkingJackpot && (
          <span className="rounded-full border-[2.5px] border-ink bg-lilac px-2.5 py-0.5 text-xs font-black">🅿️ Jackpot {formatMoney(state.pot ?? 0)}</span>
        )}
        <span className="rounded-full border-[2.5px] border-ink bg-white px-2.5 py-0.5 text-xs font-black">
          💵 {formatMoney(s.startCash)} · GO {formatMoney(s.goSalary)}
        </span>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-3 rounded-[22px] border-[3px] border-ink bg-white px-3.5 py-2.5 shadow-[0_5px_0_#1f1b2e]">
        <div className="flex gap-1.5">
          <DieFace value={a} coral />
          <DieFace value={b} />
        </div>
        <div className="min-w-0">
          <div className="whitespace-nowrap text-base font-black">
            {state.phase === "finished" ? "Game over" : myTurn ? `Your turn · ${a + b}` : `${current?.name ?? "…"} is playing`}
          </div>
          <div className="text-xs font-extrabold text-[#8a809b]">Turn {Math.max(1, turnNo)}</div>
        </div>
        {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
