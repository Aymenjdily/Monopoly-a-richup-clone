"use client";

/**
 * Player pawns. Positions come from the sanitized server state; the walk between two
 * confirmed states is client-side decoration only (AGENTS.md section 10).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ACTIVE_LIFT } from "./BoardModel";
import { TILE_T, fanOffset, jailCellAnchor, pawnAnchor, walkPath } from "./layout";
import { playSfx } from "@/components/sound/sfx";

import { Pawn, useCanvasTexture } from "./pieces";
import { FONT, makeCanvas, rr } from "./textures";
import { INK, MANGO } from "./theme";

export interface TokenPlayer {
  id: string;
  name: string;
  color: string;
  position: number;
  inJail: boolean;
  bankrupt: boolean;
}

const STEP_MS = 140;
const JUMP_MS = 480;

export function Tokens({ players, activePlayerId, activeTile, myId }: { players: TokenPlayer[]; activePlayerId: string | null; activeTile: number | null; myId: string | null }) {
  const placed = useMemo(() => {
    const groups = new Map<string, TokenPlayer[]>();
    for (const p of players) {
      if (p.bankrupt) continue;
      const where = p.inJail ? "jail" : String(p.position);
      groups.set(where, [...(groups.get(where) ?? []), p]);
    }
    const out: { p: TokenPlayer; final: [number, number, number] }[] = [];
    for (const [where, list] of groups) {
      const a = where === "jail" ? jailCellAnchor() : pawnAnchor(Number(where));
      const lift = where !== "jail" && Number(where) === activeTile ? ACTIVE_LIFT : 0;
      list.forEach((p, k) => {
        const [ox, oz] = where === "jail" ? fanOffset(k, list.length).map((v) => v * 0.6) : fanOffset(k, list.length);
        out.push({ p, final: [a.x + ox, TILE_T + lift, a.z + oz] });
      });
    }
    return out;
  }, [players, activeTile]);

  return (
    <group>
      {placed.map(({ p, final }) => (
        <AnimatedPawn
          key={p.id}
          color={p.color}
          tile={p.position}
          inJail={p.inJail}
          final={final}
          plate={p.id === activePlayerId ? (p.id === myId ? "You" : p.name) : null}
          isMe={p.id === myId}
        />
      ))}
    </group>
  );
}

interface Segment {
  to: THREE.Vector3;
  ms: number;
  hop: number;
}

function AnimatedPawn({ color, tile, inJail, final, plate, isMe }: { color: string; tile: number; inJail: boolean; final: [number, number, number]; plate: string | null; isMe: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const shown = useRef<{ tile: number; inJail: boolean } | null>(null);
  const queue = useRef<Segment[]>([]);
  const seg = useRef<{ from: THREE.Vector3; s: Segment; t0: number } | null>(null);

  const [fx, fy, fz] = final;
  useEffect(() => {
    const target = new THREE.Vector3(fx, fy, fz);
    const g = ref.current;
    if (!g) return;
    const prev = shown.current;
    shown.current = { tile, inJail };
    if (!prev) {
      g.position.copy(target);
      return;
    }
    if (prev.tile === tile && prev.inJail === inJail && g.position.distanceTo(target) < 1e-3 && !seg.current) return;
    const steps: Segment[] = [];
    if (prev.inJail !== inJail || prev.tile === tile) {
      // sent to / released from jail, or only the fan-out changed
      steps.push({ to: target, ms: prev.tile === tile && prev.inJail === inJail ? 220 : JUMP_MS, hop: prev.tile === tile && prev.inJail === inJail ? 0.05 : 1.1 });
    } else {
      const path = walkPath(prev.tile, tile);
      const jump = path.length === 1 && (tile - prev.tile + 40) % 40 !== 1;
      path.forEach((t, k) => {
        const last = k === path.length - 1;
        const a = pawnAnchor(t);
        steps.push({
          to: last ? target : new THREE.Vector3(a.x, fy, a.z),
          ms: jump ? JUMP_MS : STEP_MS,
          hop: jump ? 1.1 : 0.22,
        });
      });
    }
    queue.current = steps;
    seg.current = null;
  }, [tile, inJail, fx, fy, fz]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const now = performance.now();
    if (!seg.current) {
      const next = queue.current.shift();
      if (!next) return;
      seg.current = { from: g.position.clone(), s: next, t0: now };
      // one soft knock per tile (and one for a jump); pure fan-out shuffles stay silent
      if (next.hop > 0.1) playSfx("step");
    }
    const { from, s, t0 } = seg.current;
    const k = Math.min(1, (now - t0) / s.ms);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    g.position.lerpVectors(from, s.to, e);
    g.position.y += Math.sin(Math.PI * k) * s.hop;
    if (k >= 1) seg.current = null;
  });

  return (
    <group ref={ref}>
      <Pawn color={color} />
      {plate && <TurnPlate name={plate} isMe={isMe} />}
    </group>
  );
}

/** Camera-facing name plate drawn on a canvas (no DOM roots inside the Canvas). */
function TurnPlate({ name, isMe }: { name: string; isMe: boolean }) {
  const tag = isMe ? "YOUR TURN" : "PLAYING";
  const tex = useCanvasTexture(
    () =>
      makeCanvas(620, 150, (ctx, w, h) => {
        rr(ctx, 8, 8, w - 16, h - 34, 58, INK);
        rr(ctx, 8, 0, w - 16, h - 40, 58, "#fff", INK, 8);
        ctx.font = `900 52px ${FONT}`;
        ctx.fillStyle = INK;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const label = name.length > 9 ? name.slice(0, 8) + "…" : name;
        ctx.fillText(label, 50, 56);
        rr(ctx, 300, 22, 272, 68, 34, MANGO, INK, 7);
        ctx.font = `900 30px ${FONT}`;
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.fillText(tag, 436, 58);
      }),
    `plate-${name}-${tag}`
  );
  return (
    <sprite position={[0, 1.08, 0]} scale={[1.65, 0.4, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} toneMapped={false} />
    </sprite>
  );
}
