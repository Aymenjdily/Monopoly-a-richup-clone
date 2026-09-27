"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { hasWebGL } from "@/components/board3d/webgl";
import { DeedCard } from "@/components/hud/DeedCard";
import { PlayerBar } from "@/components/hud/PlayerBar";
import { SideCard, type SideTab } from "@/components/hud/SideCard";
import { TurnPill } from "@/components/hud/TurnPill";
import { playSfx } from "@/components/sound/sfx";
import { SoundToggle } from "@/components/sound/SoundToggle";
import { useGameSounds } from "@/components/sound/useGameSounds";
import type { GameSocketApi } from "@/hooks/useGameSocket";

// Three.js never renders during SSR (AGENTS.md trap 5).
const GameScene = dynamic(() => import("@/components/board3d/GameScene"), { ssr: false });

/** Side card width + margins; the camera slides the board left by about half of it on desktop. */
const DESKTOP_SHIFT = 170;

/**
 * Live game: full-screen 3D board + the Phase 6 HUD (design/phase-6-hud/variant-F3-hud.png).
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
    return <main className="grid h-dvh place-items-center bg-shader text-xl font-black text-[#a89fb5]">loading the board…</main>;
  }
  const meNow = state.players.find((p) => p.id === myId);
  const canLeave = Boolean(meNow && !meNow.bankrupt && state.phase === "playing");
  const winner = state.phase === "finished" ? state.players.find((p) => p.id === state.winner) : undefined;

  return (
    <main
      className="relative h-dvh overflow-hidden bg-shader"
      onPointerDownCapture={(e) => {
        if ((e.target as HTMLElement).closest("button")) playSfx("click");
      }}
    >
      <div className="absolute inset-0">
        <GameScene state={state} myId={myId} onTileClick={openDeed} viewShiftX={wide ? DESKTOP_SHIFT : 0} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute right-6 top-6 max-lg:right-3 max-lg:top-auto max-lg:bottom-[150px]">
          <SoundToggle />
        </div>
        <div className="absolute left-6 right-6 top-5 max-sm:left-3 max-sm:right-3 max-sm:top-3 lg:right-[410px]">
          <PlayerBar state={state} myId={myId} />
        </div>

        {wide ? (
          <div className="absolute bottom-6 right-6 top-[110px] w-[360px]">
            <SideCard state={state} myId={myId} code={code} tab={tab} onTab={setTab} busy={busy} send={send} onOpenDeed={openDeed} onLeave={canLeave ? leaveGame : undefined} />
          </div>
        ) : (
          <button
            onClick={() => setDrawer(true)}
            className="pointer-events-auto absolute right-3 top-[92px] rounded-full border-[3px] border-ink bg-white px-3.5 py-1.5 text-sm font-black shadow-[0_3px_0_#1f1b2e]"
          >
            📜 History
          </button>
        )}

        <div className="absolute bottom-6 left-6 max-sm:bottom-3 max-sm:left-3 max-sm:right-3">
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
          <button aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
          <div className="relative h-full w-[92vw] max-w-[380px] p-3">
            <SideCard state={state} myId={myId} code={code} tab={tab} onTab={setTab} busy={busy} send={send} onOpenDeed={openDeed} onLeave={canLeave ? leaveGame : undefined} />
          </div>
        </div>
      )}

      {deed !== null && (
        <DeedCard
          index={deed}
          state={state}
          myId={myId}
          busy={busy}
          onBuy={() => send({ type: "buy" }, () => setDeed(null))}
          onDecline={() => send({ type: "decline" }, () => setDeed(null))}
          onClose={() => setDeed(null)}
        />
      )}

      {toast && (
        <div role="status" className="absolute left-1/2 top-[100px] z-50 -translate-x-1/2 rounded-full border-[3px] border-ink bg-coral px-5 py-2 text-sm font-black text-white shadow-[0_4px_0_#1f1b2e]">
          {toast}
        </div>
      )}

      {winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-[420px] rounded-[26px] border-[3.5px] border-ink bg-white p-8 text-center card-shadow">
            <div className="text-6xl">👑</div>
            <p className="mt-3 text-3xl font-black">{winner.id === myId ? "You win!" : `${winner.name} wins!`}</p>
            <p className="mt-2 text-sm font-bold text-[#6f6580]">Last player standing with {`$${winner.money.toLocaleString("en-US")}`}.</p>
            <Link href="/" className="mt-6 inline-block rounded-[16px] border-[3.5px] border-ink bg-coral px-6 py-3 text-lg font-black text-white shadow-[0_5px_0_#1f1b2e]">
              Play again
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function NoWebGL() {
  return (
    <main className="grid h-dvh place-items-center bg-shader p-6">
      <div className="max-w-[460px] rounded-[26px] border-[3.5px] border-ink bg-white p-8 text-center card-shadow">
        <p className="text-2xl font-black">This browser can’t show the 3D board</p>
        <p className="mt-3 text-sm font-bold text-[#6f6580]">
          Dice &amp; Deeds needs WebGL. Try a recent Chrome, Edge, Firefox or Safari, or enable hardware
          acceleration in your browser settings.
        </p>
      </div>
    </main>
  );
}
