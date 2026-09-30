"use client";

/**
 * 💡 Guide tab (design G2). Renders the pure advisor's output;
 * buttons go through the same send() as the rest of the HUD — the server decides.
 */
import { useMemo } from "react";

import { advise, type Advice, type AdviceItem, type AdviceTone } from "@/lib/engine/advisor";
import type { GroupId } from "@/lib/engine/board";
import type { ClientGameState } from "@/lib/shared/events";

import { SET_NAME } from "./bits";

const TONE: Record<AdviceTone, string> = {
  great: "bg-mint",
  good: "bg-mint",
  info: "bg-lilac",
  warn: "bg-brass",
  bad: "bg-[#ffe0e0] text-[#b02a2a]",
};

type Send = (action: { type: string; spaceIndex?: number }) => void;

export function useAdvice(state: ClientGameState, myId: string | null): Advice {
  return useMemo(
    () => advise(state, myId, { groupLabel: (g: GroupId) => SET_NAME[g] ?? g }),
    [state, myId]
  );
}

export function GuidePanel({ advice, busy, send }: { advice: Advice; busy: boolean; send: Send }) {
  const sections: [string, AdviceItem[], string][] = [
    ["DO NOW", advice.now, "now"],
    ["UPGRADE NEXT", advice.upgrade, "upgrade"],
    ["WATCH OUT", advice.watch, "watch"],
  ];
  return (
    <div className="pb-2">
      {sections.map(([title, items, kind]) =>
        items.length === 0 && kind !== "watch" ? null : (
          <section key={kind}>
            <Heading>{title}</Heading>
            {items.length === 0 ? (
              <p className="text-[12.5px] font-bold text-muted">✅ All clear — no big rents within one roll.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it, i) => (
                  <Card key={it.id} item={it} highlight={kind === "now" && i === 0 && Boolean(it.actions?.length)} muted={kind === "watch"} busy={busy} send={send} />
                ))}
              </div>
            )}
          </section>
        )
      )}
      {advice.tips.length > 0 && (
        <section>
          <Heading>GOOD TO KNOW</Heading>
          {advice.tips.map((t) => (
            <p key={t} className="mb-1 text-[12.5px] font-bold text-muted">
              💡 {t}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.14em] text-muted after:h-0.5 after:flex-1 after:rounded after:bg-line-soft">
      {children}
    </div>
  );
}

function Card({ item, highlight, muted, busy, send }: { item: AdviceItem; highlight: boolean; muted: boolean; busy: boolean; send: Send }) {
  return (
    <div
      className={`rounded-2xl border-[1.5px] border-line px-3 py-2.5 ${
        highlight ? "bg-tip shadow-[inset_0_0_0_2.5px_#d9a441]" : muted ? "bg-parchment" : "bg-row"
      }`}
    >
      <h4 className="flex items-center gap-2 text-[15px] font-extrabold">
        <span>{item.icon}</span>
        <span className="min-w-0">{item.title}</span>
        {item.tag && (
          <span className={`ml-auto flex-none whitespace-nowrap rounded-full border-[1.5px] border-line px-[7px] text-[10px] font-extrabold tracking-[0.08em] ${TONE[item.tag.tone]}`}>
            {item.tag.label}
          </span>
        )}
      </h4>
      <p className="mt-0.5 text-[12.5px] font-bold text-muted">{item.detail}</p>
      {item.actions && item.actions.length > 0 && (
        <div className="mt-2 flex gap-2">
          {item.actions.map((a) => (
            <button
              key={`${a.type}-${a.spaceIndex ?? ""}`}
              disabled={busy}
              onClick={() => send(a.spaceIndex !== undefined ? { type: a.type, spaceIndex: a.spaceIndex } : { type: a.type })}
              className={`gbtn gbtn-sm ${a.primary ? "gbtn-buy flex-1" : ""}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
