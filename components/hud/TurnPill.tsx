"use client";

/**
 * Bottom dock + wallet (G2): dice tray, what's happening, Build / Mortgage shortcuts and the
 * turn's primary action. Buttons only send actions — the server decides.
 */
import type { ReactNode } from "react";

import { BOARD } from "@/lib/engine/board";
import { settingsOf } from "@/lib/engine/settings";
import { JAIL_FINE } from "@/lib/engine/types";
import type { ClientGameState } from "@/lib/shared/events";

import { Coins, DiceTray } from "./bits";
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
  const current = state.players[state.turn.playerIdx];
  const me = state.players.find((p) => p.id === myId);
  const myTurn = state.phase === "playing" && Boolean(me) && current?.id === me?.id;
  const turnNo = Math.max(1, state.log.filter((e) => e.kind === "turn").length);
  const [a, b] = state.dice;
  const pendingBuy = myTurn && state.pending?.type === "buy" ? state.pending : undefined;
  const here = current ? BOARD[current.inJail ? 10 : current.position]?.name : undefined;

  let title = state.phase === "finished" ? "Game over" : myTurn ? "Your turn" : `${current?.name ?? "…"} is playing`;
  let sub = `Turn ${turnNo}`;
  const actions: ReactNode[] = [];

  if (myTurn && me) {
    if (pendingBuy) {
      title = `You rolled ${a + b}`;
      sub = `${BOARD[pendingBuy.spaceIndex]?.name} · buy or pass`;
      actions.push(
        <button key="review" className="gbtn gbtn-buy" onClick={onReviewBuy}>
          BUY <Coins amount={pendingBuy.price} />
        </button>
      );
    } else if (state.turn.phase === "preRoll") {
      sub = me.inJail ? "In jail — pay, use a card, or roll doubles" : state.turn.doublesCount > 0 ? "Doubles — roll again" : `Turn ${turnNo} · roll the dice`;
      if (me.inJail) {
        actions.push(
          <button key="fine" disabled={busy || me.money < JAIL_FINE} className="gbtn" onClick={() => send({ type: "payJailFine" })}>
            PAY {formatMoney(JAIL_FINE)}
          </button>
        );
        if (me.jailCards > 0)
          actions.push(
            <button key="card" disabled={busy} className="gbtn" onClick={() => send({ type: "useJailCard" })}>
              🎟️ CARD
            </button>
          );
      }
      actions.push(
        <button key="roll" disabled={busy} className="gbtn gbtn-gold" onClick={() => send({ type: "roll" })}>
          🎲 ROLL
        </button>
      );
    } else if (!state.pending) {
      title = `You rolled ${a + b}`;
      sub = `${here ?? ""} · build or end your turn`;
      actions.push(
        <button key="end" disabled={busy} className="gbtn gbtn-gold" onClick={() => send({ type: "endTurn" })}>
          END TURN
        </button>
      );
    }
  } else if (state.phase === "playing" && current) {
    sub = `Turn ${turnNo} · on ${here ?? "the board"}`;
  }

  const canManage = Boolean(me && !me.bankrupt && state.phase === "playing");
  const round =
    "flex h-14 w-[62px] flex-col items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#fffaf0,#eadcbd)] text-xl shadow-[0_4px_0_#c4b08a,inset_0_1.5px_0_rgba(255,255,255,0.4)] active:translate-y-0.5";

  return (
    <div className="panel pointer-events-auto flex max-w-full flex-wrap items-center gap-3.5 rounded-[26px] px-3.5 py-3">
      <DiceTray dice={state.dice} />
      <div className="min-w-0">
        <b className="block whitespace-nowrap text-[17px] font-extrabold">{title}</b>
        <span className="block max-w-[260px] truncate text-[12.5px] font-semibold text-muted">{sub}</span>
      </div>
      {canManage && (
        <>
          <button className={round} onClick={onManage} aria-label="Build">
            🏗️<small className="-mt-0.5 text-[10px] font-bold tracking-[0.04em]">Build</small>
          </button>
          <button className={round} onClick={onManage} aria-label="Mortgage">
            🏦<small className="-mt-0.5 text-[10px] font-bold tracking-[0.04em]">Mortgage</small>
          </button>
        </>
      )}
      {actions.length > 0 && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

/** "Your cash" counter, bottom-left, plus the table rules as small chips above it. */
export function Wallet({ state, myId }: { state: ClientGameState; myId: string | null }) {
  const s = settingsOf(state);
  const me = state.players.find((p) => p.id === myId);
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1.5">
        {s.parkingJackpot && (
          <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-line bg-parchment px-2.5 py-0.5 text-xs font-bold shadow-chip">
            🅿️ Jackpot <Coins amount={state.pot ?? 0} />
          </span>
        )}
        <span className="rounded-full border-[1.5px] border-line bg-parchment px-2.5 py-0.5 text-xs font-bold shadow-chip">
          GO pays {formatMoney(s.goSalary)}
        </span>
      </div>
      {me && (
        <div className="panel px-[18px] py-3">
          <small className="block text-[10.5px] font-extrabold tracking-[0.14em] text-muted">YOUR CASH</small>
          <Coins amount={me.money} className="text-[30px] font-extrabold tracking-[-0.02em]" />
        </div>
      )}
    </div>
  );
}
