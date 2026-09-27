"use client";

/**
 * Live game board. Must be loaded with next/dynamic { ssr: false } (AGENTS.md trap 5).
 * Reads only the sanitized ClientGameState from the socket hook.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";

import type { ClientGameState } from "@/lib/shared/events";

import { BoardModel } from "./BoardModel";
import { DiceRoll } from "./DiceRoll";
import { SceneBase, canvasGl } from "./SceneBase";
import { Tokens, type TokenPlayer } from "./Tokens";

const TARGET = new THREE.Vector3(0.1, -0.9, 0.35);
const CAM = new THREE.Vector3(2.3, 21.2, 17.4);
const BASE_DIST = CAM.distanceTo(TARGET);

export default function GameScene({
  state,
  myId,
  onTileClick,
  viewShiftX = 0,
}: {
  state: ClientGameState;
  myId: string | null;
  onTileClick?: (index: number) => void;
  /** Pixels to slide the board left so a right-side HUD panel doesn't cover it. */
  viewShiftX?: number;
}) {
  const colors = useMemo(() => Object.fromEntries(state.players.map((p) => [p.id, p.colorToken])), [state.players]);
  const active = state.phase === "playing" ? state.players[state.turn.playerIdx] : undefined;
  const activeTile = active && !active.bankrupt ? (active.inJail ? 10 : active.position) : null;
  const tokens: TokenPlayer[] = useMemo(
    () => state.players.map((p) => ({ id: p.id, name: p.name, color: p.colorToken, position: p.position, inJail: p.inJail, bankrupt: p.bankrupt })),
    [state.players]
  );
  const rollKey = useMemo(() => {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const e = state.log[i];
      if (e.kind === "roll") return e.id ?? `${i}-${e.text}`;
    }
    return null;
  }, [state.log]);

  return (
    <Canvas shadows="percentage" gl={canvasGl} camera={{ fov: 27, near: 0.1, far: 120, position: CAM.toArray() }} dpr={[1, 2]}>
      <SceneBase />
      <CameraRig shiftX={viewShiftX} />
      <BoardModel ownership={state.ownership} colors={colors} activeTile={activeTile} onTileClick={onTileClick} />
      <Tokens players={tokens} activePlayerId={active?.id ?? null} activeTile={activeTile} myId={myId} />
      <DiceRoll dice={state.dice} rollKey={rollKey} />
    </Canvas>
  );
}

/** Fixed default view, pulled back on narrow screens; orbit limited, no pan (AGENTS.md section 10). */
function CameraRig({ shiftX }: { shiftX: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  // pulled back a bit more when a side panel narrows the visible area
  const factor = (aspect < 1.5 ? Math.min(2.6, Math.pow(1.5 / aspect, 0.9)) : 1) * (shiftX > 0 ? 1.2 : 1);

  useEffect(() => {
    const dir = CAM.clone().sub(TARGET).normalize();
    camera.position.copy(TARGET.clone().addScaledVector(dir, BASE_DIST * factor));
    camera.lookAt(TARGET);
    controls.current?.update();
  }, [camera, factor]);

  // Off-center framing: render as if the canvas were wider, so the board sits left of a side panel.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (shiftX > 0) cam.setViewOffset(size.width, size.height, shiftX, 0, size.width, size.height);
    else cam.clearViewOffset();
  }, [camera, shiftX, size.width, size.height]);

  return (
    <OrbitControls
      ref={controls}
      target={TARGET}
      enablePan={false}
      enableDamping
      minPolarAngle={0.25}
      maxPolarAngle={1.1}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={1.1}
      minDistance={14 * factor}
      maxDistance={36 * factor}
    />
  );
}
