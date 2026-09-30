import { BOARD } from "@/lib/engine/board";
import type { ClientGameState } from "@/lib/shared/events";

import { Avatar, Coins, Tag } from "./bits";

/** "4 cities · 1 hotel" style summary of what a player owns (shown as the plate's tooltip). */
function holdings(state: ClientGameState, playerId: string): string {
  let cities = 0, other = 0, houses = 0, hotels = 0, mortgaged = 0;
  for (const [idx, own] of Object.entries(state.ownership)) {
    if (own.ownerId !== playerId) continue;
    if (BOARD[Number(idx)]?.type === "property") cities++;
    else other++;
    if (own.houses >= 5) hotels++;
    else houses += own.houses;
    if (own.mortgaged) mortgaged++;
  }
  const parts: string[] = [];
  if (cities) parts.push(`${cities} ${cities === 1 ? "city" : "cities"}`);
  if (other) parts.push(`${other} other`);
  if (hotels) parts.push(`${hotels} hotel${hotels > 1 ? "s" : ""}`);
  if (houses) parts.push(`${houses} house${houses > 1 ? "s" : ""}`);
  if (mortgaged) parts.push(`${mortgaged} mortgaged`);
  return parts.join(" · ") || "no properties yet";
}

/** Player plates (G2): avatar, name, coin balance; the active one is enlarged with a brass ring. */
export function PlayerBar({ state, myId }: { state: ClientGameState; myId: string | null }) {
  return (
    <div className="pointer-events-auto flex items-center gap-2.5 overflow-x-auto px-2 py-2 [scrollbar-width:none] lg:justify-center">
      {state.players.map((p, i) => {
        const turn = state.phase === "playing" && i === state.turn.playerIdx;
        const me = p.id === myId;
        return (
          <div
            key={p.id}
            title={`${p.name} — ${holdings(state, p.id)}`}
            className={`flex flex-none items-center gap-2.5 rounded-full border-2 bg-parchment py-1.5 pl-1.5 pr-3.5 shadow-soft transition-transform ${
              turn ? "scale-[1.06] border-brass shadow-[0_0_0_4px_rgba(217,164,65,0.35),0_6px_16px_rgba(0,0,0,0.3)]" : "border-line"
            } ${p.bankrupt ? "opacity-50" : ""}`}
          >
            <Avatar color={p.colorToken} name={p.name} bot={p.isBot} />
            <div className="leading-tight">
              <b className={`block max-w-[110px] truncate text-sm font-bold ${p.bankrupt ? "line-through" : ""}`}>
                {p.name}
                {me && <span className="font-semibold text-muted"> · you</span>}
              </b>
              <Coins amount={p.money} className="text-[15px] font-extrabold" />
            </div>
            {turn && <Tag className="bg-brass text-[#2a1c00]">{me ? "YOUR TURN" : "PLAYING"}</Tag>}
            {p.inJail && <Tag className="bg-chip text-ink">JAIL</Tag>}
            {!p.connected && !p.isBot && !p.bankrupt && <Tag className="bg-chip text-ink">AWAY</Tag>}
            {p.bankrupt && <Tag className="bg-coral text-white">OUT</Tag>}
          </div>
        );
      })}
    </div>
  );
}
