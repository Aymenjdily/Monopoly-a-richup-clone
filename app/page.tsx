"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CodeTiles } from "@/components/ui/CodeTiles";
import { hasWebGL } from "@/components/board3d/webgl";

// Three.js never renders during SSR (AGENTS.md trap 5).
const HomeScene = dynamic(() => import("@/components/board3d/HomeScene"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<"hero" | "backdrop" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const webgl = hasWebGL();
    const pick = () => webgl && setScene(mq.matches ? "hero" : "backdrop");
    queueMicrotask(() => {
      setName((n) => n || (localStorage.getItem("dd:last-nickname") ?? ""));
      pick();
    });
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, []);

  const saveIdentity = (roomCode: string, playerId: string, secret: string) => {
    localStorage.setItem(`dd:${roomCode}`, JSON.stringify({ playerId, secret, name }));
    localStorage.setItem("dd:last-nickname", name);
  };

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the room.");
      saveIdentity(data.code, data.playerId, data.secret);
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  async function joinRoom() {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError("Room codes are 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${clean}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Player" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join.");
      saveIdentity(clean, data.playerId, data.secret);
      router.push(`/room/${clean}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-table">
      {/* 3D board: right-hand hero on desktop, dimmed backdrop on small screens */}
      {scene && (
        <div className={`absolute inset-0 ${scene === "backdrop" ? "opacity-30" : ""}`}>
          <HomeScene key={scene} layout={scene} />
        </div>
      )}

      <div className="pointer-events-none absolute left-6 top-5 z-10 flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.02em] text-on-table">
        <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[linear-gradient(135deg,#d9a441,#b8862f)] text-lg shadow-[0_3px_0_#8a6420,inset_0_1px_0_rgba(255,255,255,0.5)]">🎲</span>
        Dice &amp; Deeds
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-center px-4 py-20 sm:px-10 lg:w-[660px] lg:pl-24 lg:pr-0">
        <div className="pointer-events-auto mx-auto w-full max-w-[480px] lg:mx-0 lg:max-w-[540px]">
          <span className="inline-block rounded-full border-[1.5px] border-line bg-chip px-3 py-1 font-mono text-[12px] font-bold tracking-[0.1em] text-ink">
            ● 2–6 PLAYERS · FREE · NO ACCOUNT
          </span>
          <h1 className="logo-3d mt-5 text-[64px] leading-[0.95] sm:text-[84px] lg:text-[96px]">
            Dice <em className="not-italic text-brass">&amp;</em>
            <br />
            Deeds
          </h1>
          <p className="mb-7 mt-5 max-w-[460px] text-[17px] font-medium text-on-table-muted sm:text-[19px]">
            Roll, buy cities around the world, build — and bankrupt your friends on a real 3D board.
          </p>

          <div className="panel w-full max-w-[480px] p-[18px]">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                id="nick"
                aria-label="Nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && createRoom()}
                placeholder="Your nickname"
                maxLength={20}
                className="h-[52px] min-w-0 flex-1 rounded-[14px] border-2 border-line bg-row px-4 text-[17px] font-bold placeholder:text-muted/60 focus:border-brass focus:outline-none"
              />
              <button disabled={busy} onClick={createRoom} className="gbtn gbtn-buy h-[52px]">
                Create room ▶
              </button>
            </div>

            <div className="my-3.5 flex items-center gap-2.5 text-[11px] font-extrabold tracking-[0.14em] text-muted before:h-0.5 before:flex-1 before:rounded before:bg-line after:h-0.5 after:flex-1 after:rounded after:bg-line">
              OR JOIN A ROOM
            </div>
            <div className="flex items-center gap-2.5">
              <CodeTiles value={code} onChange={setCode} onEnter={joinRoom} />
              <button disabled={busy} onClick={joinRoom} className="gbtn gbtn-gold h-[54px]">
                Join
              </button>
            </div>
            {error && <p className="mt-3 text-sm font-bold text-coral">{error}</p>}
            <p className="mt-3.5 text-center text-[12.5px] font-semibold text-muted">Your seat is saved on this device.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
