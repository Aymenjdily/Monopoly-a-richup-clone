/** Plain DOM seat grid: used on narrow screens and when WebGL is missing (lobby stays usable). */
import type { LobbyStageProps } from "@/components/board3d/LobbyStage";

import { AddBot, BOT_STYLE_LABEL } from "./AddBot";

export function SeatList({ seats, canManage, busy, onAddBot, onRemoveBot }: LobbyStageProps) {
  return (
    <div className="absolute inset-x-4 top-[256px] z-0 mx-auto grid max-w-[860px] grid-cols-2 gap-2.5 sm:top-[200px] sm:gap-3.5">
      {seats.map((s, i) =>
        s ? (
          <div key={s.id} className="flex items-center gap-2 rounded-[16px] border-2 border-line bg-parchment px-3 py-2.5 text-[15px] font-extrabold sm:px-[18px] sm:py-[14px] sm:text-[19px] shadow-chip">
            <span className="h-4 w-4 flex-none rounded-full border-2 border-line" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {s.isMe && <span className="flex-none text-muted max-sm:hidden">(you)</span>}
            {s.isHost && <span className="flex-none whitespace-nowrap rounded-full border-[1.5px] border-line bg-brass px-2 py-0.5 text-[10px] font-extrabold sm:px-3 sm:py-1 sm:text-[11px]">HOST ★</span>}
            {s.isBot && <span className="flex-none rounded-full border-[1.5px] border-line bg-lilac px-2 py-0.5 text-[10px] font-extrabold sm:px-3 sm:py-1 sm:text-[11px]">{s.botStyle ? `${BOT_STYLE_LABEL[s.botStyle].toUpperCase()} BOT` : "BOT"}</span>}
            {s.isBot && canManage && (
              <button onClick={() => onRemoveBot(s.id)} disabled={busy} className="flex-none rounded-full border-[1.5px] border-line bg-coral px-2.5 text-sm font-extrabold text-white">
                ✕
              </button>
            )}
          </div>
        ) : (
          <div key={`empty-${i}`} className="grid place-items-center rounded-[16px] border-2 border-dashed border-line bg-row px-[18px] py-[14px] font-extrabold text-muted">
            {canManage ? (
              <AddBot busy={busy} onAdd={onAddBot} buttonClassName="hover:text-ink" choicesClassName="flex flex-wrap items-center justify-center gap-1.5" />
            ) : (
              "Open seat"
            )}
          </div>
        )
      )}
    </div>
  );
}
