"use client";

/**
 * 💡 Guide tab (design/phase-8-guide/variant-G2-guide.png). Renders the pure advisor's output;
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
  warn: "bg-mango",
  bad: "bg-[#ffd0d8]",
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
              <p className="text-[12.5px] font-bold text-[#6f6580]">✅ All clear — no big rents within one roll.</p>
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
            <p key={t} className="mb-1 text-[12.5px] font-bold text-[#6f6580]">
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
    <div className="mb-1.5 mt-3 flex items-center gap-2 text-[11px] font-black tracking-[0.14em] text-[#a89fb5] after:h-0.5 after:flex-1 after:rounded after:bg-[#eee5d6]">
      {children}
    </div>
  );
}

function Card({ item, highlight, muted, busy, send }: { item: AdviceItem; highlight: boolean; muted: boolean; busy: boolean; send: Send }) {
  return (
    <div
      className={`rounded-2xl border-[2.5px] border-ink px-3 py-2.5 ${
        highlight ? "bg-[#fff7dc] shadow-[inset_0_0_0_2.5px_#ffc53d]" : muted ? "bg-white" : "bg-[#fffaf0]"
      }`}
    >
      <h4 className="flex items-center gap-2 text-[15px] font-black">
        <span>{item.icon}</span>
        <span className="min-w-0">{item.title}</span>
        {item.tag && (
          <span className={`ml-auto flex-none whitespace-nowrap rounded-full border-2 border-ink px-[7px] text-[10px] font-black tracking-[0.08em] ${TONE[item.tag.tone]}`}>
            {item.tag.label}
          </span>
        )}
      </h4>
      <p className="mt-0.5 text-[12.5px] font-bold text-[#6f6580]">{item.detail}</p>
      {item.actions && item.actions.length > 0 && (
        <div className="mt-2 flex gap-2">
          {item.actions.map((a) => (
            <button
              key={`${a.type}-${a.spaceIndex ?? ""}`}
              disabled={busy}
              onClick={() => send(a.spaceIndex !== undefined ? { type: a.type, spaceIndex: a.spaceIndex } : { type: a.type })}
              className={`whitespace-nowrap rounded-xl border-[2.5px] border-ink px-3 py-1.5 text-[13px] font-black shadow-[0_3px_0_#1f1b2e] active:translate-y-0.5 active:shadow-[0_1px_0_#1f1b2e] disabled:opacity-50 ${
                a.primary ? "flex-1 bg-mint" : "bg-white"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
