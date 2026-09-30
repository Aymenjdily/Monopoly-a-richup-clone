"use client";

/** Lighting + environment shared by every scene (values from the approved v3 mockup). */
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function SceneBase({ groundY = -0.62, shadowSize = 10, envIntensity = 0.55 }: { groundY?: number; shadowSize?: number; envIntensity?: number }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const scene = get().scene;
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, get, envIntensity]);

  return (
    <>
      <hemisphereLight args={["#fff4dc", "#2f6f55", 0.85]} />
      <directionalLight
        color="#fff1dc"
        intensity={2.4}
        position={[-7, 15, 7]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-shadowSize, shadowSize, shadowSize, -shadowSize, 1, 40]} />
      </directionalLight>
      <directionalLight color="#ffd98a" intensity={0.7} position={[8, 6, -8]} />
      <mesh rotation-x={-Math.PI / 2} position-y={groundY} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial color="#04170f" opacity={0.42} transparent />
      </mesh>
    </>
  );
}

/** Canvas props shared by every scene. */
export const canvasGl = {
  antialias: true,
  alpha: true,
  toneMapping: THREE.NeutralToneMapping,
  outputColorSpace: THREE.SRGBColorSpace,
} as const;
