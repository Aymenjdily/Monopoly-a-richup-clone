"use client";

/**
 * Plays sounds for game events the client hasn't seen yet. The first snapshot (page load,
 * reconnect) is silent — only changes after it make noise. Dice and pawn steps are played
 * by their animations; this hook covers log events and the "your turn" chime.
 */
import { useEffect, useRef } from "react";

import type { ClientGameState } from "@/lib/shared/events";

import { soundsForBatch } from "./events";
import { playSfx } from "./sfx";

/** Roughly how long a roll's pawn walk takes before its consequences should sound. */
const AFTER_WALK_MS = 750;
const STAGGER_MS = 220;

export function useGameSounds(state: ClientGameState | undefined, myId: string | null): void {
  const lastSeq = useRef<number | null>(null);
  const wasMyTurn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!state) return;
    const seqOf = (i: number) => state.log[i]?.id ?? i;
    const latest = state.log.length ? seqOf(state.log.length - 1) : 0;
    const me = state.players.find((p) => p.id === myId)?.name ?? null;
    const myTurn = state.phase === "playing" && state.players[state.turn.playerIdx]?.id === myId;

    if (lastSeq.current === null) {
      // first snapshot: remember where we are, stay quiet
      lastSeq.current = latest;
      wasMyTurn.current = myTurn;
      return;
    }

    const fresh = state.log.filter((e, i) => (e.id ?? i) > (lastSeq.current ?? 0));
    lastSeq.current = Math.max(lastSeq.current, latest);
    const rolled = fresh.some((e) => e.kind === "roll");
    const base = rolled ? AFTER_WALK_MS : 0;
    soundsForBatch(fresh, me).forEach((name, k) => playSfx(name, base + k * STAGGER_MS));

    if (myTurn && wasMyTurn.current === false) playSfx("turn", base + 200);
    wasMyTurn.current = myTurn;
  }, [state, myId]);
}
