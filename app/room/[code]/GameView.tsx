"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { hasWebGL } from "@/components/board3d/webgl";
import { DeedCard } from "@/components/hud/DeedCard";
import { PlayerBar } from "@/components/hud/PlayerBar";
import { SideCard, type SideTab } from "@/components/hud/SideCard";
import { TurnPill, Wallet } from "@/components/hud/TurnPill";
import { playSfx } from "@/components/sound/sfx";
import { SoundToggle } from "@/components/sound/SoundToggle";
import { useGameSounds } from "@/components/sound/useGameSounds";
import type { GameSocketApi } from "@/hooks/useGameSocket";

// Three.js never renders during SSR (AGENTS.md trap 5).
const GameScene = dynamic(() => import("@/components/board3d/GameScene"), { ssr: false });

/** Side card width + margins; the camera slides the board left by about half of it on desktop. */
const DESKTOP_SHIFT = 150;

/**
 * Live game: full-screen 3D board + HUD, styled as G2 "felt table" (design/phase-9-restyle/variant-G2-game.png).
 * The browser only sends actions; the server validates and broadcasts (AGENTS.md section 6).
 */
export default function GameView({ code, socket, myId }: { code: string; socket: GameSocketApi; myId: string | null }) {
  const router = useRouter();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [wide, setWide] = useState(true);
  const [deed, setDeed] = useState<number | null>(null);
  const [tab, setTab] = useState<SideTab>("history");
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inFlight = useRef(false);
  const seenPending = useRef<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const pick = () => setWide(mq.matches);
    queueMicrotask(() => {
      setWebgl(hasWebGL());
      pick();
    });
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, []);

  const game = socket.state.game;
  const state = game?.state;
  useGameSounds(state, myId);

  // A new buy decision for me opens its deed card once (closing it keeps it closed).
  const pendingKey =
    state && state.pending?.type === "buy" && state.players[state.turn.playerIdx]?.id === myId
      ? `${game?.version}:${state.pending.spaceIndex}`
      : null;
  const pendingIndex = state?.pending?.type === "buy" ? state.pending.spaceIndex : null;
  useEffect(() => {
    if (pendingKey && pendingKey.split(":")[1] !== seenPending.current?.split(":")[1]) {
      queueMicrotask(() => setDeed(pendingIndex));
    }
    seenPending.current = pendingKey;
  }, [pendingKey, pendingIndex]);

  useEffect(() => {
    if (!toast) return;
    playSfx("error");
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const send = useCallback(
    (action: { type: string } & Record<string, unknown>, after?: () => void) => {
      // one click → exactly one game:action, even under StrictMode (AGENTS.md trap 4)
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      socket.sendAction(action, (ok, _v, error) => {
        inFlight.current = false;
        setBusy(false);
        if (!ok) setToast(error ?? "That move isn't allowed right now.");
        else after?.();
      });
    },
    [socket]
  );
  const openDeed = useCallback((i: number) => setDeed(i), []);
  const leaveGame = useCallback(() => {
    if (!window.confirm("Leave this game? You'll forfeit: your cities go back to the bank.")) return;
    send({ type: "leaveRoom" }, () => {
      try {
        localStorage.removeItem(`dd:${code}`);
      } catch {
        /* ignore */
      }
      router.push("/");
    });
  }, [send, code, router]);

  if (webgl === false) return <NoWebGL />;
  if (!game || !state || webgl === null) {
    return <main className="grid h-dvh place-items-center bg-table text-xl font-extrabold text-on-table-muted">Setting the table…</main>;
  }
  const meNow = state.players.find((p) => p.id === myId);
  const canLeave = Boolean(meNow && !meNow.bankrupt && state.phase === "playing");
  const winner = state.phase === "finished" ? state.players.find((p) => p.id === state.winner) : undefined;

  const side = (
    <SideCard state={state} myId={myId} code={code} tab={tab} onTab={setTab} busy={busy} send={send} onOpenDeed={openDeed} onLeave={canLeave ? leaveGame : undefined} />
  );

  return (
    <main
      className="relative h-dvh overflow-hidden bg-table"
      onPointerDownCapture={(e) => {
        if ((e.target as HTMLElement).closest("button")) playSfx("click");
      }}
    >
      <div className="absolute inset-0">
        <GameScene state={state} myId={myId} onTileClick={openDeed} viewShiftX={wide ? DESKTOP_SHIFT : 0} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* brand + room code */}
        <div className="absolute left-6 top-5 flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.02em] text-on-table max-lg:hidden">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[linear-gradient(135deg,#d9a441,#b8862f)] text-lg shadow-[0_3px_0_#8a6420,inset_0_1px_0_rgba(255,255,255,0.5)]">🎲</span>
          Dice &amp; Deeds
          <span className="rounded-full border-[1.5px] border-line bg-chip px-2.5 py-1 font-mono text-[13px] font-bold tracking-[0.18em] text-ink">{code}</span>
        </div>

        {/* player plates */}
        <div className="absolute left-2 right-2 top-2 lg:left-[300px] lg:right-[400px] lg:top-2.5">
          <PlayerBar state={state} myId={myId} />
        </div>

        {/* property card: docked on desktop (DeedCard turns into a modal on small screens) */}
        {deed !== null && (
          <div className="absolute left-6 top-24 w-[300px]">
            <DeedCard
              index={deed}
              state={state}
              myId={myId}
              busy={busy}
              onBuy={() => send({ type: "buy" }, () => setDeed(null))}
              onDecline={() => send({ type: "decline" }, () => setDeed(null))}
              onClose={() => setDeed(null)}
            />
          </div>
        )}

        {wide ? (
          <>
            <div className="absolute right-6 top-5">
              <SoundToggle />
            </div>
            <div className="absolute bottom-6 right-6 top-[84px] w-[350px]">{side}</div>
            <div className="absolute bottom-6 left-6">
              <Wallet state={state} myId={myId} />
            </div>
          </>
        ) : (
          <div className="absolute right-2 top-[76px] flex flex-col items-end gap-2">
            <button onClick={() => setDrawer(true)} className="gbtn gbtn-sm pointer-events-auto">
              📜 History
            </button>
            <SoundToggle />
          </div>
        )}

        <div className="absolute bottom-3 left-2 right-2 flex justify-center lg:bottom-6 lg:left-[200px] lg:right-[400px]">
          <TurnPill
            state={state}
            myId={myId}
            busy={busy}
            send={send}
            onReviewBuy={() => pendingIndex !== null && setDeed(pendingIndex)}
            onManage={() => {
              setTab("cities");
              if (!wide) setDrawer(true);
            }}
          />
        </div>
      </div>

      {!wide && drawer && (
        <div className="fixed inset-0 z-30 flex justify-end">
          <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="relative h-full w-[92vw] max-w-[380px] p-3">{side}</div>
        </div>
      )}

      {toast && (
        <div role="status" className="absolute left-1/2 top-[92px] z-50 -translate-x-1/2 rounded-full bg-coral px-5 py-2 text-sm font-extrabold text-white shadow-soft">
          {toast}
        </div>
      )}

      {winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="panel w-full max-w-[420px] p-8 text-center">
            <div className="text-6xl">👑</div>
            <p className="mt-3 text-3xl font-extrabold">{winner.id === myId ? "You win!" : `${winner.name} wins!`}</p>
            <p className="mt-2 text-sm font-semibold text-muted">Last player standing with {`$${winner.money.toLocaleString("en-US")}`}.</p>
            <Link href="/" className="gbtn gbtn-gold mt-6">
              PLAY AGAIN
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function NoWebGL() {
  return (
    <main className="grid h-dvh place-items-center bg-table p-6">
      <div className="panel max-w-[460px] p-8 text-center">
        <p className="text-2xl font-extrabold">This browser can’t show the 3D board</p>
        <p className="mt-3 text-sm font-semibold text-muted">
          Dice &amp; Deeds needs WebGL. Try a recent Chrome, Edge, Firefox or Safari, or enable hardware
          acceleration in your browser settings.
        </p>
      </div>
    </main>
  );
}
