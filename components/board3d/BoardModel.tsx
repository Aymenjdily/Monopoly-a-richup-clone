"use client";

/**
 * The static-ish board: slab, 40 tiles, center artwork, decks, jail bars, buildings and
 * the active-tile glow. Everything derives from props (sanitized state) — nothing here is
 * stored in engine state (AGENTS.md trap 8).
 */
import { RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useMemo, type ReactNode } from "react";
import * as THREE from "three";

import { BOARD } from "@/lib/engine/board";
import type { OwnershipEntry } from "@/lib/engine/types";

import { BOARD_W, CORNER, GAP, PX, TILE_T, bandCenter, place } from "./layout";
import { Deck, Hotel, House, useCanvasTexture } from "./pieces";
import { drawCenter, drawGlow, drawTile, mixColor } from "./textures";
import { INK } from "./theme";

/** How much the active tile (and pawns on it) rises. */
export const ACTIVE_LIFT = 0.08;

export interface BoardModelProps {
  ownership: Record<number, OwnershipEntry>;
  /** playerId → token color */
  colors: Record<string, string>;
  /** tile index of the player whose turn it is (glows), or null */
  activeTile: number | null;
  showDecks?: boolean;
  /** Click on a tile (ignored after an orbit drag). */
  onTileClick?: (index: number) => void;
}

export const BoardModel = memo(function BoardModel({ ownership, colors, activeTile, showDecks = true, onTileClick }: BoardModelProps) {
  return (
    <group>
      <Slab />
      <Center />
      {BOARD.map((space) => {
        const own = ownership[space.index];
        return (
          <Tile
            key={space.index}
            index={space.index}
            ownerColor={own ? colors[own.ownerId] : undefined}
            mortgaged={Boolean(own?.mortgaged)}
            active={space.index === activeTile}
            onSelect={onTileClick}
          />
        );
      })}
      <JailBars />
      <Buildings ownership={ownership} activeTile={activeTile} />
      {showDecks && (
        <>
          <Deck kind="chance" position={[-2.55, 0, 1.55]} rotation-y={0.3} />
          <Deck kind="chest" position={[2.55, 0, 1.55]} rotation-y={-0.3} />
        </>
      )}
    </group>
  );
});

function Slab() {
  return (
    <group>
      <RoundedBox args={[BOARD_W + 0.7, 0.42, BOARD_W + 0.7]} radius={0.2} smoothness={6} position-y={-0.36} castShadow receiveShadow>
        <meshStandardMaterial color="#2a2440" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[BOARD_W + 0.76, 0.09, BOARD_W + 0.76]} radius={0.04} smoothness={4} position-y={-0.24}>
        <meshStandardMaterial color="#ff6b81" roughness={0.4} />
      </RoundedBox>
      <RoundedBox args={[BOARD_W + 0.5, 0.16, BOARD_W + 0.5]} radius={0.07} smoothness={6} position-y={-0.08} receiveShadow>
        <meshStandardMaterial color="#fff6e4" roughness={0.8} />
      </RoundedBox>
    </group>
  );
}

function Center() {
  const tex = useCanvasTexture(drawCenter, "center");
  const size = BOARD_W - 2 * CORNER - 0.1;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.4} roughness={0.9} />
    </mesh>
  );
}

const Tile = memo(function Tile({ index, ownerColor, mortgaged, active, onSelect }: { index: number; ownerColor?: string; mortgaged: boolean; active: boolean; onSelect?: (index: number) => void }) {
  const P = place(index);
  const tex = useCanvasTexture(
    () => drawTile(BOARD[index], P, { ownerColor, mortgaged }),
    `tile-${index}-${ownerColor ?? "-"}-${mortgaged ? 1 : 0}`
  );
  const lift = active ? ACTIVE_LIFT : 0;
  return (
    <group
      position={[P.x, lift, P.z]}
      onClick={
        onSelect &&
        ((e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return; // that was an orbit drag, not a click
          e.stopPropagation();
          onSelect(index);
        })
      }
      onPointerOver={onSelect && ((e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; })}
      onPointerOut={onSelect && (() => { document.body.style.cursor = ""; })}
    >
      <RoundedBox args={[P.w - GAP, TILE_T, P.d - GAP]} radius={0.045} smoothness={3} position-y={TILE_T / 2} castShadow receiveShadow>
        {/* the slab edge picks up the owner's color too, so ownership reads from any angle */}
        <meshStandardMaterial color={ownerColor ? mixColor(ownerColor, "#e9dcc3", 0.55) : "#e9dcc3"} roughness={0.7} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position-y={TILE_T + 0.003} receiveShadow>
        <planeGeometry args={[P.w - GAP, P.d - GAP]} />
        <meshStandardMaterial map={tex} transparent alphaTest={0.4} roughness={0.85} />
      </mesh>
      {active && <ActiveGlow w={P.w} d={P.d} lift={lift} />}
    </group>
  );
});

function ActiveGlow({ w, d, lift }: { w: number; d: number; lift: number }) {
  const tex = useCanvasTexture(() => drawGlow(), "glow");
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.004 - lift}>
      <planeGeometry args={[w + 0.7, d + 0.9]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const barMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.35, metalness: 0.2 });
const barGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.46, 10);

function JailBars() {
  const bars = useMemo(() => {
    const P = place(10);
    const cell = 228 / PX;
    const x0 = P.x + (P.w - GAP) / 2 - (22 + 228) / PX;
    const z0 = P.z - (P.d - GAP) / 2 + 22 / PX;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 7; k++) {
      const f = k / 7;
      pts.push([x0 + f * cell, z0 + cell], [x0, z0 + f * cell]);
    }
    return { pts, x0, z0, cell };
  }, []);
  const bh = 0.46;
  const y = TILE_T + bh / 2;
  return (
    <group>
      {bars.pts.map(([x, z], i) => (
        <mesh key={i} geometry={barGeo} material={barMat} position={[x, y, z]} castShadow />
      ))}
      <mesh material={barMat} position={[bars.x0 + bars.cell / 2, TILE_T + bh, bars.z0 + bars.cell]} castShadow>
        <boxGeometry args={[bars.cell, 0.05, 0.05]} />
      </mesh>
      <mesh material={barMat} position={[bars.x0, TILE_T + bh, bars.z0 + bars.cell / 2]} castShadow>
        <boxGeometry args={[0.05, 0.05, bars.cell]} />
      </mesh>
    </group>
  );
}

function Buildings({ ownership, activeTile }: { ownership: Record<number, OwnershipEntry>; activeTile: number | null }) {
  const items: ReactNode[] = [];
  for (const [key, own] of Object.entries(ownership)) {
    const idx = Number(key);
    if (!own.houses) continue;
    const bc = bandCenter(idx);
    const y = TILE_T + (idx === activeTile ? ACTIVE_LIFT : 0);
    const rotY = bc.horizontal ? 0 : Math.PI / 2;
    if (own.houses >= 5) {
      items.push(<Hotel key={`h-${idx}`} position={[bc.x, y, bc.z]} rotation-y={rotY} />);
      continue;
    }
    const step = 0.215;
    const start = (-(own.houses - 1) * step) / 2;
    for (let k = 0; k < own.houses; k++) {
      const off = start + k * step;
      items.push(
        <House
          key={`${idx}-${k}`}
          position={[bc.x + (bc.horizontal ? off : 0), y, bc.z + (bc.horizontal ? 0 : off)]}
          rotation-y={rotY}
        />
      );
    }
  }
  return <group>{items}</group>;
}
