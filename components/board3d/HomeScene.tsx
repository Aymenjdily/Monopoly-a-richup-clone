"use client";

/**
 * Home hero (design/phase-6-ui-rework/variant-D-home.png): the real board with a demo
 * position, dice caught mid-roll. Static — renders on demand only. Load with ssr:false.
 */
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { PLAYER_COLORS } from "@/lib/engine/lobby";
import type { OwnershipEntry } from "@/lib/engine/types";

import { BoardModel } from "./BoardModel";
import { Die } from "./pieces";
import { SceneBase, canvasGl } from "./SceneBase";
import { Tokens, type TokenPlayer } from "./Tokens";

const DEMO_PLAYERS: TokenPlayer[] = [
  { id: "a", name: "Sasha", color: PLAYER_COLORS[0], position: 24, inJail: false, bankrupt: false },
  { id: "b", name: "Juno", color: PLAYER_COLORS[1], position: 5, inJail: false, bankrupt: false },
  { id: "c", name: "Marek", color: PLAYER_COLORS[3], position: 5, inJail: false, bankrupt: false },
  { id: "d", name: "Lina", color: PLAYER_COLORS[5], position: 10, inJail: true, bankrupt: false },
];
const COLORS = Object.fromEntries(DEMO_PLAYERS.map((p) => [p.id, p.color]));
const own = (ownerId: string, houses = 0, mortgaged = false): OwnershipEntry => ({ ownerId, houses, mortgaged });
const DEMO_OWNERSHIP: Record<number, OwnershipEntry> = {
  1: own("c"), 3: own("c"), 6: own("b", 2), 8: own("b", 2), 9: own("b", 1), 12: own("a"), 15: own("b"),
  16: own("a", 4), 18: own("a", 4), 19: own("a", 5), 21: own("d"), 25: own("c"), 37: own("d", 0, true),
};

export type HomeSceneLayout = "hero" | "backdrop";

const VIEWS: Record<HomeSceneLayout, { pos: [number, number, number]; look: [number, number, number] }> = {
  // board on the right, UI on the left (desktop reference)
  hero: { pos: [-1.0, 10.8, 15.2], look: [-4.3, -0.6, 1.2] },
  // centered, farther — sits behind the card on small screens
  backdrop: { pos: [1.5, 24, 20], look: [0, -0.5, 0.5] },
};

export default function HomeScene({ layout = "hero" }: { layout?: HomeSceneLayout }) {
  return (
    <Canvas shadows="percentage" gl={canvasGl} frameloop="demand" camera={{ fov: 30, near: 0.1, far: 120, position: VIEWS[layout].pos }} dpr={[1, 2]}>
      <LookAt target={VIEWS[layout].look} pos={VIEWS[layout].pos} />
      <SceneBase />
      <BoardModel ownership={DEMO_OWNERSHIP} colors={COLORS} activeTile={24} />
      <Tokens players={DEMO_PLAYERS} activePlayerId="a" activeTile={24} myId="a" />
      <Die color="#ff6b81" pip="#ffffff" position={[-0.6, 2.1, 3.2]} rotation={[0.55, 0.7, 0.35]} />
      <Die color="#fffaf0" pip="#1f1b2e" position={[0.9, 1.35, 2.6]} rotation={[-0.4, -0.5, 0.8]} />
    </Canvas>
  );
}

function LookAt({ target, pos }: { target: [number, number, number]; pos: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    camera.position.set(...pos);
    camera.lookAt(new THREE.Vector3(...target));
    invalidate();
  }, [camera, invalidate, target, pos]);
  return null;
}
