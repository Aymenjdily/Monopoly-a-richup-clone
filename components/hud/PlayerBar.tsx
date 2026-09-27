import { BOARD } from "@/lib/engine/board";
import type { ClientGameState } from "@/lib/shared/events";

import { PawnBadge, Tag } from "./bits";
import { formatMoney } from "./history";

/** "4 cities · 1 hotel" style summary of what a player owns. */
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

export function PlayerBar({ state, myId }: { state: ClientGameState; myId: string | null }) {
  return (
    <div className="pointer-events-auto flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none]">
      {state.players.map((p, i) => {
        const turn = state.phase === "playing" && i === state.turn.playerIdx;
        return (
          <div
            key={p.id}
            className={`min-w-[230px] max-w-[300px] flex-1 rounded-[18px] border-[3px] border-ink bg-white p-1 shadow-[0_5px_0_#1f1b2e] ${p.bankrupt ? "opacity-50" : ""}`}
          >
            <div className={`flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 ${turn ? "bg-[#fff7dc] shadow-[inset_0_0_0_3px_#ffc53d]" : ""}`}>
              <PawnBadge color={p.colorToken} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-black">
                  <span className={`truncate ${p.bankrupt ? "line-through" : ""}`}>{p.name}</span>
                  {p.id === myId && <small className="text-xs font-extrabold text-[#b6adc4]">(you)</small>}
                </div>
                <div className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-extrabold text-[#8a809b]">
                  {p.isBot && <Tag className="bg-lilac text-ink">BOT</Tag>}
                  {p.inJail && <Tag className="bg-[#ffab5e] text-ink">IN JAIL</Tag>}
                  {!p.connected && !p.isBot && <Tag className="bg-[#efe6d6] text-ink">AWAY</Tag>}
                  {p.bankrupt && <Tag className="bg-coral text-white">OUT</Tag>}
                  <span className="truncate">{holdings(state, p.id)}</span>
                </div>
              </div>
              <div className="ml-auto text-lg font-black">{formatMoney(p.money)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
