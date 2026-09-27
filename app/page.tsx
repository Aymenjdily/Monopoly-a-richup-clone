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
    <main className="relative min-h-screen overflow-hidden bg-shader">
      {/* 3D board: right-hand hero on desktop, dimmed backdrop on small screens */}
      {scene && (
        <div className={`absolute inset-0 ${scene === "backdrop" ? "opacity-35" : ""}`}>
          <HomeScene key={scene} layout={scene} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,246,230,.97)_0%,rgba(255,246,230,.9)_30%,rgba(255,246,230,0)_50%)] max-lg:bg-[rgba(255,246,230,.55)]" />
      <div className="grain" />

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-center px-4 py-10 sm:px-10 lg:w-[656px] lg:pl-24 lg:pr-0">
        <div className="pointer-events-auto mx-auto w-full max-w-[500px] lg:mx-0 lg:max-w-[560px]">
          <div className="inline-flex items-center gap-[9px] rounded-full bg-ink px-[15px] py-2 text-xs font-black tracking-[0.16em] text-white">
            <i className="h-2 w-2 rounded-full bg-mint shadow-[0_0_0_3px_rgba(127,227,168,.3)]" />
            MULTIPLAYER · 2–6 PLAYERS · FREE
          </div>
          <h1 className="logo-3d mt-5 text-[72px] leading-[0.9] sm:text-[96px] lg:text-[116px]">
            Dice <em className="not-italic text-coral">&amp;</em>
            <br />
            Deeds
          </h1>
          <p className="mb-[30px] mt-[26px] max-w-[500px] text-lg font-bold leading-[1.45] text-[#6f6580] sm:text-[21px]">
            The property board game, <b className="text-ink">in real 3D</b>. Roll, buy, build — and bankrupt your
            friends, live in the browser.
          </p>

          <div className="w-full max-w-[500px] rounded-[26px] border-[3.5px] border-ink bg-white px-5 pb-6 pt-[26px] shadow-[0_8px_0_#1f1b2e,24px_30px_0_rgba(31,27,46,.08)] sm:px-7">
            <label htmlFor="nick" className="mb-[9px] block text-xs font-black tracking-[0.12em] text-[#a89fb5]">
              YOUR NICKNAME
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="nick"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && createRoom()}
                placeholder="Pick a name"
                maxLength={20}
                className="min-w-0 flex-1 rounded-[14px] border-[3px] border-ink bg-white px-4 py-[13px] text-[19px] font-extrabold shadow-[inset_2px_3px_0_rgba(31,27,46,0.06)] placeholder:text-[#c9c2d4] focus:outline-none"
              />
              <button
                disabled={busy}
                onClick={createRoom}
                className="flex items-center justify-between gap-3.5 whitespace-nowrap rounded-[16px] border-[3.5px] border-ink bg-coral px-5 py-3.5 text-[19px] font-black text-white shadow-[0_5px_0_#1f1b2e] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_2px_0_#1f1b2e] disabled:opacity-60"
              >
                Create room <span>→</span>
              </button>
            </div>

            <div className="mb-4 mt-5 flex items-center gap-3 text-xs font-black tracking-[0.14em] text-[#c9c2d4]">
              <span className="h-[2.5px] flex-1 rounded bg-[#eee5d6]" />
              OR JOIN WITH A CODE
              <span className="h-[2.5px] flex-1 rounded bg-[#eee5d6]" />
            </div>
            <div className="flex gap-3">
              <CodeTiles value={code} onChange={setCode} onEnter={joinRoom} />
              <button
                disabled={busy}
                onClick={joinRoom}
                className="flex items-center gap-3.5 whitespace-nowrap rounded-[16px] border-[3.5px] border-ink bg-ink px-5 py-3.5 text-[19px] font-black text-white shadow-[0_5px_0_rgba(31,27,46,.3)] hover:brightness-125 disabled:opacity-60"
              >
                Join <span>→</span>
              </button>
            </div>
            {error && <p className="mt-4 text-sm font-bold text-coral">{error}</p>}
            <p className="mt-4 text-center text-[13px] font-extrabold text-[#a89fb5]">
              No account needed — your seat is saved on this device.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Feature icon="🎲" tint="#ffd23e">Real-time rooms</Feature>
            <Feature icon="🏙️" tint="#8fd3f5">Full rules</Feature>
            <Feature icon="🤖" tint="#c9b8ff">Bots fill seats</Feature>
          </div>
        </div>
      </div>

      {scene === "hero" && (
        <div className="absolute bottom-[34px] right-10 z-10 flex items-center gap-2.5 rounded-full bg-ink/85 px-4 py-[9px] text-xs font-black tracking-[0.14em] text-white">
          <b className="h-[9px] w-[9px] rounded-full bg-coral shadow-[0_0_0_3px_rgba(255,107,129,.35)]" />
          LIVE 3D BOARD
        </div>
      )}
    </main>
  );
}

function Feature({ icon, tint, children }: { icon: string; tint: string; children: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border-[2.5px] border-ink bg-white py-1.5 pl-[7px] pr-[13px] text-[13.5px] font-extrabold text-[#4a4258] shadow-[0_3px_0_#1f1b2e]">
      <i className="grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-ink text-sm not-italic" style={{ background: tint }}>
        {icon}
      </i>
      {children}
    </div>
  );
}
