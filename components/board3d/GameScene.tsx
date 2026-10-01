"use client";

/**
 * Live game board. Must be loaded with next/dynamic { ssr: false } (AGENTS.md trap 5).
 * Reads only the sanitized ClientGameState from the socket hook.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";

import type { ClientGameState } from "@/lib/shared/events";

import { BoardModel } from "./BoardModel";
import { DiceRoll } from "./DiceRoll";
import { SceneBase, canvasGl } from "./SceneBase";
import { Tokens, type TokenPlayer } from "./Tokens";
import type { BoardView } from "./viewPref";

const TARGET = new THREE.Vector3(0.1, -0.9, 0.35);
const CAM = new THREE.Vector3(2.3, 21.2, 17.4);
const BASE_DIST = CAM.distanceTo(TARGET);

export default function GameScene({
  state,
  myId,
  onTileClick,
  viewShiftX = 0,
  view = "3d",
}: {
  state: ClientGameState;
  myId: string | null;
  onTileClick?: (index: number) => void;
  /** Pixels to slide the board left so a right-side HUD panel doesn't cover it. */
  viewShiftX?: number;
  /** Camera mode: angled 3D (default) or top-down flat. */
  view?: BoardView;
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
      <CameraRig shiftX={viewShiftX} view={view} />
      <BoardModel ownership={state.ownership} colors={colors} activeTile={activeTile} onTileClick={onTileClick} />
      <Tokens players={tokens} activePlayerId={active?.id ?? null} activeTile={activeTile} myId={myId} />
      <DiceRoll dice={state.dice} rollKey={rollKey} />
    </Canvas>
  );
}

/** Camera pose per view: today's angled 3D view, or straight down over the board centre. */
const POSES: Record<BoardView, { target: THREE.Vector3; dir: THREE.Vector3; dist: number }> = {
  "3d": { target: TARGET, dir: CAM.clone().sub(TARGET).normalize(), dist: BASE_DIST },
  // tiny +z tilt keeps "up" stable so the GO side stays at the bottom of the screen
  flat: { target: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0.0005).normalize(), dist: 28 },
};
const EASE_S = 0.45;

/**
 * Fixed default view, pulled back on narrow screens; orbit limited, no pan (AGENTS.md section 10).
 * Flat locks rotation (zoom only). Switching views eases the camera — decoration only.
 */
function CameraRig({ shiftX, view }: { shiftX: number; view: BoardView }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const anim = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3 } | null>(null);
  const placed = useRef(false);
  // pulled back a bit more when a side panel narrows the visible area
  const factor = (aspect < 1.5 ? Math.min(2.6, Math.pow(1.5 / aspect, 0.9)) : 1) * (shiftX > 0 ? 1.2 : 1);
  const flat = view === "flat";

  useEffect(() => {
    const pose = POSES[view];
    const toPos = pose.target.clone().addScaledVector(pose.dir, pose.dist * factor);
    if (!placed.current) {
      placed.current = true;
      camera.position.copy(toPos);
      camera.lookAt(pose.target);
      controls.current?.target.copy(pose.target);
      controls.current?.update();
      return;
    }
    const fromTarget = controls.current?.target.clone() ?? pose.target.clone();
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget, toPos, toTarget: pose.target.clone() };
    if (controls.current) controls.current.enabled = false;
  }, [camera, factor, view]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / EASE_S);
    const k = a.t * a.t * (3 - 2 * a.t); // smoothstep
    const target = a.fromTarget.clone().lerp(a.toTarget, k);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    camera.lookAt(target);
    if (a.t < 1) return;
    anim.current = null;
    const c = controls.current;
    if (c) {
      c.target.copy(a.toTarget);
      c.enabled = true;
      c.update();
    }
  });

  // Straight down from far away, the felt and the frame 1 mm below it z-fight; a farther
  // near plane restores depth precision (the closest mesh stays >10 units from the camera).
  const get = useThree((s) => s.get);
  useEffect(() => {
    const cam = get().camera as THREE.PerspectiveCamera;
    cam.near = flat ? 5 : 0.1;
    cam.updateProjectionMatrix();
  }, [get, flat]);

  // Off-center framing: render as if the canvas were wider, so the board sits left of a side panel.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (shiftX > 0) cam.setViewOffset(size.width, size.height, shiftX, 0, size.width, size.height);
    else cam.clearViewOffset();
  }, [camera, shiftX, size.width, size.height]);

  return (
    <OrbitControls
      ref={controls}
      target={POSES[view].target}
      enablePan={false}
      enableRotate={!flat}
      enableDamping
      minPolarAngle={flat ? 0 : 0.25}
      maxPolarAngle={flat ? 0.01 : 1.1}
      minAzimuthAngle={flat ? 0 : -0.9}
      maxAzimuthAngle={flat ? 0 : 1.1}
      minDistance={(flat ? 16 : 14) * factor}
      maxDistance={(flat ? 34 : 36) * factor}
    />
  );
}
