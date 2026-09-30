"use client";

/**
 * Shared 3D pieces (board, home hero, lobby stage). Geometry and materials follow the
 * approved mockup design/phase-5-board/variant-C2-board-v3.html.
 */
import { RoundedBox } from "@react-three/drei";
import { useThree, type ThreeElements } from "@react-three/fiber";
import { forwardRef, useEffect, useMemo, useSyncExternalStore } from "react";
import * as THREE from "three";

import { drawDeckTop, getFontEpoch, subscribeFont } from "./textures";

/** Build a CanvasTexture once per `key`, dispose when it changes/unmounts. */
export function useCanvasTexture(make: () => HTMLCanvasElement, key: string): THREE.CanvasTexture {
  const gl = useThree((s) => s.gl);
  // repaint once the web font is ready (first paint may use the fallback face)
  const fontEpoch = useSyncExternalStore(subscribeFont, getFontEpoch, () => 0);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(make());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = gl.capabilities.getMaxAnisotropy();
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything `make` reads
  }, [key, gl, fontEpoch]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// ── pawn ───────────────────────────────────────────────────────────────────────
const PAWN_PROFILE = [
  [0, 0], [0.23, 0], [0.245, 0.03], [0.235, 0.075], [0.17, 0.1], [0.13, 0.14], [0.1, 0.26],
  [0.085, 0.34], [0.14, 0.36], [0.145, 0.395], [0.09, 0.415], [0.07, 0.44], [0, 0.44],
].map(([r, y]) => new THREE.Vector2(r, y));
const pawnGeo = new THREE.LatheGeometry(PAWN_PROFILE, 40);
const headGeo = new THREE.SphereGeometry(0.125, 32, 20);

export const PAWN_HEIGHT = 0.68;

export const Pawn = forwardRef<THREE.Group, { color: string; ghost?: boolean } & ThreeElements["group"]>(
  function Pawn({ color, ghost = false, ...props }, ref) {
    const mat = useMemo(
      () =>
        ghost
          ? new THREE.MeshStandardMaterial({ color: "#d9cfe8", transparent: true, opacity: 0.22, depthWrite: false })
          : new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }),
      [color, ghost]
    );
    useEffect(() => () => mat.dispose(), [mat]);
    return (
      <group ref={ref} {...props}>
        <group scale={1.05}>
          <mesh geometry={pawnGeo} material={mat} castShadow={!ghost} receiveShadow />
          <mesh geometry={headGeo} material={mat} position-y={0.54} castShadow={!ghost} />
        </group>
      </group>
    );
  }
);

// ── houses & hotel ─────────────────────────────────────────────────────────────
const roofGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.13, 0);
  s.lineTo(0.13, 0);
  s.lineTo(0, 0.12);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
  g.translate(0, 0, -0.1);
  return g;
})();
const houseMat = new THREE.MeshStandardMaterial({ color: "#2f9a62", roughness: 0.4 });
const houseRoofMat = new THREE.MeshStandardMaterial({ color: "#1f7a4b", roughness: 0.4 });
const hotelMat = new THREE.MeshStandardMaterial({ color: "#c0392b", roughness: 0.35 });
const hotelRoofMat = new THREE.MeshStandardMaterial({ color: "#962d22", roughness: 0.4 });

export function House(props: ThreeElements["group"]) {
  return (
    <group {...props}>
      <RoundedBox args={[0.2, 0.16, 0.2]} radius={0.02} smoothness={2} position-y={0.08} material={houseMat} castShadow receiveShadow />
      <mesh geometry={roofGeo} material={houseRoofMat} position-y={0.16} castShadow />
    </group>
  );
}

export function Hotel(props: ThreeElements["group"]) {
  return (
    <group {...props}>
      <RoundedBox args={[0.46, 0.26, 0.26]} radius={0.03} smoothness={2} position-y={0.13} material={hotelMat} castShadow receiveShadow />
      <mesh geometry={roofGeo} material={hotelRoofMat} scale={[1.9, 1.1, 1.3]} position-y={0.26} castShadow />
    </group>
  );
}

// ── dice ───────────────────────────────────────────────────────────────────────
export const DIE_SIZE = 0.62;
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};
/** Fixed face layout: value → outward normal (opposite faces sum to 7). */
const FACES: [number, THREE.Vector3][] = [
  [1, new THREE.Vector3(0, 1, 0)],
  [6, new THREE.Vector3(0, -1, 0)],
  [2, new THREE.Vector3(0, 0, 1)],
  [5, new THREE.Vector3(0, 0, -1)],
  [3, new THREE.Vector3(1, 0, 0)],
  [4, new THREE.Vector3(-1, 0, 0)],
];
/** Rotation that puts `value` face-up. */
export function faceUpEuler(value: number, yaw = 0): THREE.Euler {
  const base: Record<number, [number, number, number]> = {
    1: [0, 0, 0],
    6: [Math.PI, 0, 0],
    2: [-Math.PI / 2, 0, 0],
    5: [Math.PI / 2, 0, 0],
    3: [0, 0, Math.PI / 2],
    4: [0, 0, -Math.PI / 2],
  };
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(base[value] ?? base[1])));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  return new THREE.Euler().setFromQuaternion(q);
}

const pipGeo = new THREE.CircleGeometry(0.052, 24);

export const Die = forwardRef<THREE.Group, { color: string; pip: string } & ThreeElements["group"]>(
  function Die({ color, pip, ...props }, ref) {
    const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 0.8 }), [color]);
    const pipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: pip, roughness: 0.5 }), [pip]);
    useEffect(() => () => { bodyMat.dispose(); pipMat.dispose(); }, [bodyMat, pipMat]);
    const pips = useMemo(() => {
      const out: { key: string; pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
      for (const [value, n] of FACES) {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        PIPS[value].forEach(([a, b], k) => {
          out.push({ key: `${value}-${k}`, pos: new THREE.Vector3(a * 0.16, b * 0.16, DIE_SIZE / 2 + 0.002).applyQuaternion(q), quat: q });
        });
      }
      return out;
    }, []);
    return (
      <group ref={ref} {...props}>
        <RoundedBox args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} radius={0.11} smoothness={5} material={bodyMat} castShadow receiveShadow />
        {pips.map((p) => (
          <mesh key={p.key} geometry={pipGeo} material={pipMat} position={p.pos} quaternion={p.quat} />
        ))}
      </group>
    );
  }
);

// ── card decks ─────────────────────────────────────────────────────────────────
export function Deck({ kind, ...props }: { kind: "chance" | "chest" } & ThreeElements["group"]) {
  const tex = useCanvasTexture(() => drawDeckTop(kind), `deck-${kind}`);
  const w = 2.0;
  const d = 1.3;
  return (
    <group {...props}>
      {[0, 1, 2, 3, 4].map((k) => (
        <RoundedBox
          key={k}
          args={[w, 0.045, d]}
          radius={0.02}
          smoothness={2}
          position={[(k % 2) * 0.015, 0.025 + k * 0.047, (k % 3) * 0.01]}
          rotation-y={(k - 2) * 0.012}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={k % 2 ? "#fffaf0" : "#efe4cf"} roughness={0.8} />
        </RoundedBox>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0.024]} position={[0, 0.025 + 4 * 0.047 + 0.024, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex} transparent alphaTest={0.4} roughness={0.7} />
      </mesh>
    </group>
  );
}
