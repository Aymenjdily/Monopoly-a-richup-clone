"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Seat } from "@/components/board3d/LobbyStage";
import { hasWebGL } from "@/components/board3d/webgl";
import { MusicToggle } from "@/components/sound/MusicToggle";
import { CodeTiles } from "@/components/ui/CodeTiles";
import { RulesSheet } from "@/components/ui/RulesSheet";
import { SeatList } from "@/components/ui/SeatList";
import { useGameSocket } from "@/hooks/useGameSocket";
import { DEFAULT_SETTINGS, type RoomSettings } from "@/lib/engine/settings";

import GameView from "./GameView";

// Three.js never renders during SSR (AGENTS.md trap 5).
const LobbyStage = dynamic(() => import("@/components/board3d/LobbyStage"), { ssr: false });

interface Identity {
  playerId: string;
  secret: string;
  name: string;
}

export default function LobbyClient({ code }: { code: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Identity | null>(null);
  const [joinName, setJoinName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [webgl, setWebgl] = useState(false);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      setMe(readIdentity(code));
      setWebgl(hasWebGL());
      setWide(window.matchMedia("(min-width: 768px)").matches);
      setJoinName(localStorage.getItem("dd:last-nickname") ?? "");
    });
  }, [code]);

  const socket = useGameSocket(code, me ? { playerId: me.playerId, secret: me.secret } : null);
  const { room, error: socketError } = socket.state;

  useEffect(() => {
    queueMicrotask(() => {
      if (room && room.code !== code) setNotFound(true);
    });
  }, [room, code]);

  if (notFound) return <NotFoundCard code={code} />;
  if (!room) {
    return (
      <main className="relative min-h-screen bg-shader">
        <div className="relative z-10 grid min-h-screen place-items-center text-xl font-black text-[#a89fb5]">
          joining table…
        </div>
      </main>
    );
  }

  const mySeat = me ? room.players.find((p) => p.id === me.playerId) : undefined;
  const seated = Boolean(mySeat);
  const isHost = Boolean(mySeat?.isHost);
  const asHost = isHost;
  const gameStarted = room.status !== "lobby";

  async function addBot() {
    if (!me) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me.playerId, secret: me.secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add bot.");
      // socket broadcast picks the change up automatically
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function removeBot(botId: string) {
    if (!me) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/bot/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me.playerId, secret: me.secret, botId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove bot.");
      // socket broadcast picks the change up automatically
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (gameStarted) {
    return <GameView code={code} socket={socket} myId={mySeat ? me?.playerId ?? null : null} />;
  }

  const host = room.players.find((p) => p.isHost);
  const seats: (Seat | null)[] = Array.from({ length: 6 }, (_, i) => {
    const p = room.players[i];
    return p ? { id: p.id, name: p.name, color: p.colorToken, isHost: p.isHost, isBot: p.isBot, isMe: me?.playerId === p.id } : null;
  });
  const canStart = room.players.length >= 2;

  return (
    <main className="relative h-dvh min-h-[640px] overflow-hidden bg-shader">
      <div className="bg-spotlight" />
      <div className="grain" />

      {webgl && wide ? (
        <div className="absolute inset-x-0 top-[120px] bottom-[150px] sm:inset-0">
          <LobbyStage seats={seats} canManage={asHost} busy={busy} onAddBot={addBot} onRemoveBot={removeBot} />
        </div>
      ) : (
        <SeatList seats={seats} canManage={asHost} busy={busy} onAddBot={addBot} onRemoveBot={removeBot} />
      )}

      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-x-[18px] gap-y-3 px-4 pt-5 sm:px-14 sm:pt-11">
        <button
          onClick={leaveRoom}
          disabled={busy}
          aria-label={seated ? "Leave room" : "Back home"}
          title={seated ? "Leave room (frees your seat)" : "Back home"}
          className="pointer-events-auto grid h-[50px] w-[50px] flex-none place-items-center rounded-[14px] border-[3px] border-ink bg-white text-xl font-black shadow-[0_4px_0_#1f1b2e]"
        >
          ←
        </button>
        <div>
          <h1 className="text-[28px] font-black leading-none tracking-[-0.02em] sm:text-[38px]">Waiting room</h1>
          <p className="mt-1.5 text-sm font-extrabold text-[#a89fb5]">
            {host ? (
              <>
                Hosted by <b className="text-ink">{host.name}</b> ·{" "}
              </>
            ) : null}
            the lobby updates live
          </p>
        </div>
        <div className="flex-1" />
        <div className="pointer-events-auto flex items-center gap-3.5 rounded-[22px] border-[3.5px] border-ink bg-white py-2.5 pl-5 pr-3 shadow-[0_6px_0_#1f1b2e] max-sm:w-full max-sm:pl-3">
          <span className="text-[11px] font-black leading-[1.3] tracking-[0.14em] text-[#a89fb5] max-sm:hidden">
            ROOM
            <br />
            CODE
          </span>
          <CodeTiles value={room.code} size="lg" />
          <button
            onClick={copyInvite}
            className="flex h-[60px] items-center gap-2 whitespace-nowrap rounded-[14px] border-[3px] border-ink bg-mango px-[18px] text-[15px] font-black shadow-[0_4px_0_#1f1b2e] hover:brightness-105 max-sm:px-3"
          >
            {copied ? "✓" : "⧉"}
            <span className="max-sm:hidden">{copied ? "Copied" : "Copy invite"}</span>
          </button>
        </div>
        <MusicToggle active />
        <button
          onClick={() => setRulesOpen(true)}
          className="pointer-events-auto flex h-[60px] items-center gap-2 whitespace-nowrap rounded-[14px] border-[3px] border-ink bg-white px-[18px] text-[15px] font-black shadow-[0_4px_0_#1f1b2e] hover:bg-cream max-sm:h-[50px]"
        >
          ⚙️ Room rules
        </button>
      </header>

      {rulesOpen && (
        <RulesSheet
          settings={room.settings ?? DEFAULT_SETTINGS}
          editable={asHost}
          seated={room.players.length}
          busy={busy}
          onSave={saveRules}
          onClose={() => setRulesOpen(false)}
        />
      )}

      {/* dock */}
      <div className="absolute inset-x-4 bottom-6 z-10 mx-auto max-w-[1080px] sm:bottom-10">
        {(socketError || localError) && (
          <p className="mb-3 text-center text-sm font-bold text-coral">{socketError?.message ?? localError}</p>
        )}
        <div className="flex flex-col items-stretch gap-4 rounded-[26px] border-[3.5px] border-ink bg-white p-4 shadow-[0_8px_0_#1f1b2e,24px_28px_0_rgba(31,27,46,.08)] sm:flex-row sm:items-center sm:gap-[22px] sm:pl-[26px]">
          <div className="flex gap-1.5 max-sm:hidden">
            {seats.map((s, i) => (
              <i key={i} className="h-3 w-[26px] rounded-md border-[2.5px] border-ink" style={{ background: s?.color ?? "#f1eadc" }} />
            ))}
          </div>
          <div className="min-w-0">
            <b className="block text-[19px] font-black">
              {room.players.length} of 6 seats filled
            </b>
            <span className="text-[13px] font-extrabold text-[#a89fb5]">
              {copied ? "Invite link copied — share it!" : "Friends open the site and enter the code — no account needed."}
            </span>
          </div>

          <div className="sm:ml-auto">
            {seated && isHost ? (
              <button
                onClick={start}
                disabled={busy || !canStart}
                className="flex w-full items-center justify-center gap-3.5 whitespace-nowrap rounded-[18px] border-[3.5px] border-ink bg-ink px-[26px] py-[18px] text-lg font-black tracking-[0.02em] text-white sm:text-[22px] shadow-[0_6px_0_rgba(31,27,46,.3)] disabled:opacity-80"
              >
                START THE GAME
                <i className="rounded-full bg-mint px-[11px] py-[5px] text-[13px] not-italic tracking-[0.1em] text-ink">
                  {canStart ? "READY" : "2+ NEEDED"}
                </i>
                <span className="opacity-85">→</span>
              </button>
            ) : seated ? (
              <div className="rounded-[18px] border-[3px] border-dashed border-ink/40 px-6 py-[18px] text-center text-lg font-black text-[#a89fb5]">
                You have a seat — waiting for the host to start…
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && join()}
                  placeholder="Your nickname"
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-[14px] border-[3px] border-ink bg-white px-4 py-3 text-lg font-extrabold placeholder:text-[#c9c2d4] focus:outline-none sm:w-[220px]"
                />
                <button
                  onClick={join}
                  disabled={busy || room.players.length >= 6}
                  className="whitespace-nowrap rounded-[14px] border-[3px] border-ink bg-mint px-6 py-3 text-lg font-black text-ink shadow-[0_5px_0_#1f1b2e] hover:brightness-105 disabled:opacity-60"
                >
                  Take a seat →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );

  function readIdentity(c: string): Identity | null {
    try {
      const raw = localStorage.getItem(`dd:${c}`);
      return raw ? (JSON.parse(raw) as Identity) : null;
    } catch {
      return null;
    }
  }

  async function join() {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName || "Player" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join.");
      localStorage.setItem(
        `dd:${code}`,
        JSON.stringify({ playerId: data.playerId, secret: data.secret, name: joinName })
      );
      localStorage.setItem("dd:last-nickname", joinName);
      setMe({ playerId: data.playerId, secret: data.secret, name: joinName });
      // socket broadcasts capture the change
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  /** ← in the lobby: a seated player frees their seat (host passes on), then goes home. */
  async function leaveRoom() {
    if (!me || !seated) {
      router.push("/");
      return;
    }
    if (!window.confirm("Leave this room? Your seat will be freed.")) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me.playerId, secret: me.secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not leave.");
      try {
        localStorage.removeItem(`dd:${code}`);
      } catch {
        /* ignore */
      }
      router.push("/");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  async function saveRules(next: RoomSettings) {
    if (!me) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me.playerId, secret: me.secret, settings: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the rules.");
      setRulesOpen(false);
      // socket broadcast updates everyone's view (including ours)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!me) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me.playerId, secret: me.secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start.");
      // socket broadcasts capture the change
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
}

function NotFoundCard({ code }: { code: string }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-shader">
      <div className="relative z-10 rounded-[26px] border-[3.5px] border-ink bg-white p-10 text-center [box-shadow:0_9px_0_#1f1b2e,30px_34px_0_rgba(31,27,46,0.10)]">
        <p className="text-2xl font-black">Room {code} not found</p>
        <p className="mt-2 text-sm font-bold text-[#a89fb5]">
          Check the code or ask your host for a fresh one.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-[16px] border-[3.5px] border-ink bg-coral px-6 py-3 text-lg font-black text-white shadow-[0_5px_0_#1f1b2e]"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
