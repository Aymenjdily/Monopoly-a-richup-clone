"use client";

/**
 * Lobby stage (design/phase-6-ui-rework/variant-D-lobby.png): six podiums, one pawn per
 * seated player, ghost pawns on empty seats. Seat labels/buttons are plain DOM placed from
 * projected 3D anchors (no React roots inside the Canvas). Load with ssr:false.
 */
import { RoundedBox } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";

import { Pawn, useCanvasTexture } from "./pieces";
import { SceneBase, canvasGl } from "./SceneBase";
import { drawGlow, makeCanvas, rr, FONT } from "./textures";
import { INK } from "./theme";

export interface Seat {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isBot: boolean;
  isMe: boolean;
}

export interface LobbyStageProps {
  seats: (Seat | null)[];
  /** host controls (add/remove bots) */
  canManage: boolean;
  busy?: boolean;
  onAddBot: () => void;
  onRemoveBot: (id: string) => void;
}

const SPACING = 2.2;
const CAM = new THREE.Vector3(0, 5.2, 18.4);
const LOOK = new THREE.Vector3(0, 0.75, 0);

export default function LobbyStage(props: LobbyStageProps) {
  const [anchors, setAnchors] = useState<{ x: number; y: number }[]>([]);
  return (
    <div className="relative h-full w-full">
      <Canvas shadows="percentage" gl={canvasGl} camera={{ fov: 30, near: 0.1, far: 120, position: CAM.toArray() }} dpr={[1, 2]}>
        <Rig onAnchors={setAnchors} />
        <SceneBase groundY={-0.42} shadowSize={9} envIntensity={0.6} />
        <Stage />
        {props.seats.map((seat, k) => (
          <Podium key={seat?.id ?? `empty-${k}`} index={k} seat={seat} />
        ))}
      </Canvas>
      {anchors.length === props.seats.length &&
        props.seats.map((seat, k) => (
          <div key={seat?.id ?? `label-${k}`} className="absolute z-10" style={{ left: anchors[k].x, top: anchors[k].y }}>
            <SeatLabel seat={seat} {...props} />
          </div>
        ))}
    </div>
  );
}

/** Label anchor under podium k: front edge of the stage. */
const seatAnchor = (k: number) => new THREE.Vector3((k - 2.5) * SPACING, -0.42, 1.75);

function Rig({ onAnchors }: { onAnchors: (pts: { x: number; y: number }[]) => void }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    const factor = aspect < 1.6 ? Math.min(3, Math.pow(1.6 / aspect, 0.95)) : 1;
    const dir = CAM.clone().sub(LOOK);
    camera.position.copy(LOOK.clone().addScaledVector(dir, factor));
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    const w = size.width;
    const h = size.height;
    onAnchors(
      Array.from({ length: 6 }, (_, k) => {
        const p = seatAnchor(k).project(camera);
        return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
      })
    );
  }, [camera, aspect, size.width, size.height, onAnchors]);
  return null;
}

function Stage() {
  return (
    <group>
      <RoundedBox args={[13.9, 0.34, 3.4]} radius={0.16} smoothness={6} position-y={-0.25} castShadow receiveShadow>
        <meshStandardMaterial color="#4a2c1a" roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[13.96, 0.07, 3.46]} radius={0.03} smoothness={4} position-y={-0.19}>
        <meshStandardMaterial color="#d9a441" roughness={0.3} metalness={0.6} />
      </RoundedBox>
      <RoundedBox args={[13.7, 0.14, 3.2]} radius={0.06} smoothness={6} position-y={-0.07} receiveShadow>
        <meshStandardMaterial color="#1b6147" roughness={0.9} />
      </RoundedBox>
    </group>
  );
}

function podiumTop(color: string | undefined, n: number) {
  return makeCanvas(512, 512, (ctx, w, h) => {
    if (!color) {
      rr(ctx, 10, 10, w - 20, h - 20, 70, "rgba(253,243,214,.16)");
      ctx.setLineDash([34, 22]);
      rr(ctx, 26, 26, w - 52, h - 52, 58, null, "rgba(253,243,214,.6)", 8);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(253,243,214,.55)";
      ctx.fillRect(w / 2 - 12, h / 2 - 70, 24, 140);
      ctx.fillRect(w / 2 - 70, h / 2 - 12, 140, 24);
      return;
    }
    rr(ctx, 10, 10, w - 20, h - 20, 70, "#fdf9ef", "#cdbd96", 8);
    rr(ctx, 40, h - 128, w - 80, 86, 30, color, "#cdbd96", 6);
    ctx.font = `900 70px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`P${n}`, w / 2, h - 84);
    ctx.fillStyle = "rgba(31,27,46,.07)";
    ctx.beginPath();
    ctx.ellipse(w / 2, 200, 150, 110, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function Podium({ index, seat }: { index: number; seat: Seat | null }) {
  const x = (index - 2.5) * SPACING;
  const empty = !seat;
  const top = useCanvasTexture(() => podiumTop(seat?.color, index + 1), `podium-${index}-${seat?.color ?? "empty"}`);
  const glow = useCanvasTexture(() => drawGlow(256, 256), "glow-sq");

  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[1.6, 0.46, 1.6]} radius={0.12} smoothness={4} position-y={0.23} castShadow={!empty} receiveShadow>
        {empty ? (
          <meshStandardMaterial color="#2a7d5d" roughness={0.9} transparent opacity={0.7} />
        ) : (
          <meshStandardMaterial color="#4a2c1a" roughness={0.5} />
        )}
      </RoundedBox>
      {seat && (
        <RoundedBox args={[1.66, 0.08, 1.66]} radius={0.04} smoothness={4} position-y={0.2}>
          <meshStandardMaterial color={seat.color} roughness={0.35} />
        </RoundedBox>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.462}>
        <planeGeometry args={[1.46, 1.46]} />
        <meshStandardMaterial map={top} transparent roughness={0.8} />
      </mesh>

      {seat ? (
        <group position={[0, 0.46, -0.08]} rotation-y={0.4} scale={2.1}>
          <Pawn color={seat.color} />
          {seat.isBot && (
            <group position={[0, 0.69, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.012, 0.012, 0.15, 10]} />
                <meshStandardMaterial color={INK} />
              </mesh>
              <mesh position-y={0.09}>
                <sphereGeometry args={[0.036, 20, 14]} />
                <meshStandardMaterial color="#7fe3a8" emissive="#3fdc8a" emissiveIntensity={0.7} />
              </mesh>
            </group>
          )}
        </group>
      ) : (
        <Pawn color="#fff" ghost position={[0, 0.46, -0.08]} scale={2.1} />
      )}

      {seat?.isMe && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
          <planeGeometry args={[3.4, 3.4]} />
          <meshBasicMaterial map={glow} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}

    </group>
  );
}

function SeatLabel({ seat, canManage, busy, onAddBot, onRemoveBot }: { seat: Seat | null } & LobbyStageProps) {
  return (
    <div className="flex -translate-x-1/2 flex-col items-center gap-[7px] pt-5">
      {seat ? (
        <>
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-line bg-parchment px-[15px] py-[7px] text-lg font-extrabold shadow-chip">
            <span className="h-3 w-3 rounded-full border-[1.5px] border-line" style={{ background: seat.color }} />
            {seat.name}
            {seat.isMe && <span className="text-[15px] font-extrabold text-muted">(you)</span>}
          </div>
          <div className="flex gap-1.5">
            {seat.isHost && <Badge className="bg-brass">HOST ★</Badge>}
            {seat.isBot && <Badge className="bg-lilac">BOT</Badge>}
            {seat.isBot && canManage && (
              <button
                onClick={() => onRemoveBot(seat.id)}
                disabled={busy}
                title="Remove bot"
                className="rounded-full border-[1.5px] border-line bg-coral px-2.5 py-0.5 text-[10.5px] font-extrabold text-white disabled:opacity-60"
              >
                ✕
              </button>
            )}
          </div>
        </>
      ) : canManage ? (
        <>
          <button
            onClick={onAddBot}
            disabled={busy}
            className="whitespace-nowrap rounded-full border-2 border-dashed border-line bg-row px-4 py-[7px] text-[15px] font-extrabold hover:bg-parchment disabled:opacity-60"
          >
            <b className="text-coral">＋</b> Add bot
          </button>
          <small className="whitespace-nowrap text-xs font-semibold text-on-table-muted">or invite a friend</small>
        </>
      ) : (
        <small className="whitespace-nowrap rounded-full border-2 border-dashed border-line/60 px-4 py-[7px] text-[14px] font-bold text-on-table-muted">
          Open seat
        </small>
      )}
    </div>
  );
}

function Badge({ children, className }: { children: string; className: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full border-[1.5px] border-line px-[9px] py-[3px] text-[10.5px] font-extrabold tracking-[0.1em] ${className}`}>
      {children}
    </span>
  );
}
