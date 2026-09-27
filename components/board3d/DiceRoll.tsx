"use client";

/**
 * Dice between the decks. A new roll (new `rollKey`) plays a short tumble that always
 * settles on the server's values — the animation is decoration, never the result.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { playSfx } from "@/components/sound/sfx";

import { DIE_SIZE, Die, faceUpEuler } from "./pieces";

const ROLL_MS = 750;
const REST: [number, number][] = [[-0.55, 1.35], [0.45, 1.2]];
const YAW = [0.5, -0.3];

export function DiceRoll({ dice, rollKey }: { dice: [number, number]; rollKey: string | number | null }) {
  const die0 = useRef<THREE.Group>(null);
  const die1 = useRef<THREE.Group>(null);
  const anim = useRef<{ t0: number; spins: THREE.Vector3[] } | null>(null);
  const first = useRef(true);
  const [a, b] = dice;

  useEffect(() => {
    const targets = [faceUpEuler(a, YAW[0]), faceUpEuler(b, YAW[1])];
    [die0, die1].forEach((r, i) => {
      if (!r.current) return;
      r.current.userData.target = targets[i];
    });
    if (first.current) {
      first.current = false;
      [die0, die1].forEach((r, i) => {
        if (!r.current) return;
        r.current.rotation.copy(targets[i]);
        r.current.position.set(REST[i][0], DIE_SIZE / 2 + 0.002, REST[i][1]);
      });
      return;
    }
    // deterministic-looking but varied spins, derived from the roll key
    const seed = String(rollKey ?? "").split("").reduce((s, c) => s + c.charCodeAt(0), a * 7 + b);
    playSfx("dice");
    anim.current = {
      t0: performance.now(),
      spins: [0, 1].map((i) => new THREE.Vector3(3 + ((seed + i) % 3), 2 + ((seed >> 1) % 2), 2 + ((seed + 2 * i) % 3)).multiplyScalar(Math.PI)),
    };
  }, [a, b, rollKey]);

  useFrame(() => {
    const st = anim.current;
    if (!st) return;
    const k = Math.min(1, (performance.now() - st.t0) / ROLL_MS);
    const e = 1 - Math.pow(1 - k, 3);
    [die0, die1].forEach((r, i) => {
      const g = r.current;
      if (!g) return;
      const target: THREE.Euler = g.userData.target;
      const spin = st.spins[i];
      g.rotation.set(target.x + (1 - e) * spin.x, target.y + (1 - e) * spin.y, target.z + (1 - e) * spin.z);
      const [rx, rz] = REST[i];
      g.position.set(rx - (1 - e) * (1.6 - i * 0.5), DIE_SIZE / 2 + 0.002 + Math.sin(Math.PI * Math.min(1, k * 1.25)) * 1.4 * (1 - k * 0.6), rz + (1 - e) * 1.4);
    });
    if (k >= 1) anim.current = null;
  });

  return (
    <group>
      <Die ref={die0} color="#ff6b81" pip="#ffffff" />
      <Die ref={die1} color="#fffaf0" pip="#1f1b2e" />
    </group>
  );
}
