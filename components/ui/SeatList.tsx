/** Plain DOM seat grid: used on narrow screens and when WebGL is missing (lobby stays usable). */
import type { LobbyStageProps } from "@/components/board3d/LobbyStage";

export function SeatList({ seats, canManage, busy, onAddBot, onRemoveBot }: LobbyStageProps) {
  return (
    <div className="absolute inset-x-4 top-[190px] z-0 mx-auto grid max-w-[860px] grid-cols-2 gap-2.5 sm:top-[200px] sm:gap-3.5">
      {seats.map((s, i) =>
        s ? (
          <div key={s.id} className="flex items-center gap-2 rounded-[16px] border-[3px] border-ink bg-white px-3 py-2.5 text-[15px] font-extrabold sm:px-[18px] sm:py-[14px] sm:text-[19px] shadow-[0_4px_0_#1f1b2e]">
            <span className="h-4 w-4 flex-none rounded-full border-[3px] border-ink" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            {s.isMe && <span className="flex-none text-[#b6adc4] max-sm:hidden">(you)</span>}
            {s.isHost && <span className="flex-none whitespace-nowrap rounded-full border-[2.5px] border-ink bg-mango px-2 py-0.5 text-[10px] font-black sm:px-3 sm:py-1 sm:text-[11px]">HOST ★</span>}
            {s.isBot && <span className="flex-none rounded-full border-[2.5px] border-ink bg-lilac px-2 py-0.5 text-[10px] font-black sm:px-3 sm:py-1 sm:text-[11px]">BOT</span>}
            {s.isBot && canManage && (
              <button onClick={() => onRemoveBot(s.id)} disabled={busy} className="flex-none rounded-full border-[2.5px] border-ink bg-coral px-2.5 text-sm font-black text-white">
                ✕
              </button>
            )}
          </div>
        ) : (
          <div key={`empty-${i}`} className="grid place-items-center rounded-[16px] border-[3px] border-dashed border-ink/60 bg-cream px-[18px] py-[14px] font-extrabold text-[#b6adc4]">
            {canManage ? (
              <button onClick={onAddBot} disabled={busy} className="text-coral hover:text-ink">
                ＋ Add bot
              </button>
            ) : (
              "Open seat"
            )}
          </div>
        )
      )}
    </div>
  );
}
