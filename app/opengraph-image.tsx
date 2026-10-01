import { ImageResponse } from "next/og";

import { BrandMark } from "./brandMark";

export const alt = "Dice & Deeds — a real-time multiplayer property board game with a 3D board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview card (Discord, WhatsApp, X…) in the G2 felt-table style. */
export default function OpengraphImage() {
  return new ImageResponse(<ShareCard />, size);
}

/** Shared by the room invite card, which swaps the feature chips for the join code. */
export function ShareCard({ code }: { code?: string }) {
  const chips = code ? null : ["3D board", "2–6 players", "Play with bots"];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        background: "radial-gradient(circle at 40% 46%, #2f9a70, #17563f 62%, #0d3526 100%)",
        border: "18px solid #4a2c1a",
      }}
    >
      <BrandMark size={260} />
      <div style={{ display: "flex", flexDirection: "column", color: "#fdf3d6" }}>
        <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>Dice &amp; Deeds</div>
        <div style={{ marginTop: 18, fontSize: 30, letterSpacing: 8, color: "#cfe6d8" }}>{code ? "YOU'RE INVITED · JOIN ROOM" : "GO AROUND THE WORLD"}</div>
        {code ? (
          <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
            {code.split("").map((ch, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 74,
                  height: 90,
                  borderRadius: 16,
                  background: "#fdf8ec",
                  boxShadow: "0 6px 0 #dcc9a0",
                  color: "#2a2118",
                  fontSize: 56,
                  fontWeight: 800,
                }}
              >
                {ch}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
            {chips!.map((t) => (
              <div key={t} style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: "#fdf8ec", color: "#2a2118", fontSize: 26, fontWeight: 700 }}>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
