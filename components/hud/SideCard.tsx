"use client";

/** Right-hand tabbed card (F3 + G2): History · Guide · My cities · Rules. */
import { Fragment, useMemo, useState } from "react";

import { CITY_LANDMARK, SPACE_ICON } from "@/components/board3d/theme";
import { BOARD } from "@/lib/engine/board";
import { settingsOf } from "@/lib/engine/settings";
import type { ClientGameState } from "@/lib/shared/events";

import { AmountPill, SET_NAME } from "./bits";
import { GuidePanel, useAdvice } from "./GuidePanel";
import { buildHistory, filterHistory, formatMoney, type HistoryFilter } from "./history";

export type SideTab = "history" | "guide" | "cities" | "rules";
type Send = (action: { type: string; spaceIndex?: number }) => void;

export function SideCard({
  state,
  myId,
  code,
  tab,
  onTab,
  busy,
  send,
  onOpenDeed,
  onLeave,
}: {
  state: ClientGameState;
  myId: string | null;
  code: string;
  tab: SideTab;
  onTab: (t: SideTab) => void;
  busy: boolean;
  send: Send;
  onOpenDeed: (index: number) => void;
  /** Forfeit and leave (shown in the Rules tab for seated, still-playing players). */
  onLeave?: () => void;
}) {
  const advice = useAdvice(state, myId);
  // label shown, accessible name (G2: "📜 History · 💡 Guide · 🏙️ Cities · ⚙️")
  const TABS: [SideTab, string, string][] = [
    ["history", "📜 History", "History"],
    ["guide", "💡 Guide", "Guide"],
    ["cities", "🏙️ Cities", "My cities"],
    ["rules", "⚙️", "Rules"],
  ];
  return (
    <div className="panel pointer-events-auto flex h-full flex-col overflow-hidden">
      <div className="flex gap-1.5 border-b-2 border-line p-3" role="tablist">
        {TABS.map(([t, label, name]) => (
          <button
            key={t}
            role="tab"
            aria-label={name}
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            className={`relative whitespace-nowrap rounded-xl px-2 py-2 text-[13px] font-bold ${t === "rules" ? "px-3" : "flex-1"} ${tab === t ? "bg-brass text-[#2a1c00] shadow-[0_3px_0_#8a6420]" : "text-muted hover:text-ink"}`}
          >
            {label}
            {t === "guide" && advice.urgent && tab !== "guide" && (
              <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-line bg-brass" />
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 [scrollbar-width:thin]">
        {tab === "history" && <HistoryFeed state={state} myId={myId} />}
        {tab === "guide" && <GuidePanel advice={advice} busy={busy} send={send} />}
        {tab === "cities" && <MyCities state={state} myId={myId} busy={busy} send={send} onOpenDeed={onOpenDeed} />}
        {tab === "rules" && <RulesList state={state} code={code} onLeave={onLeave} />}
      </div>
    </div>
  );
}

function HistoryFeed({ state, myId }: { state: ClientGameState; myId: string | null }) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const me = state.players.find((p) => p.id === myId)?.name ?? null;
  const jackpot = settingsOf(state).parkingJackpot;
  const groups = useMemo(() => filterHistory(buildHistory(state.log, me, jackpot), filter), [state.log, me, jackpot, filter]);
  const colorOf = (name?: string) => state.players.find((p) => p.name === name)?.colorToken ?? "#cdbd96";
  const current = state.players[state.turn.playerIdx]?.name;
  const names = state.players.map((p) => p.name).sort((a, b) => b.length - a.length);

  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-1 bg-parchment pb-1 pt-2">
        {(["all", "money", "moves"] as HistoryFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold capitalize ${filter === f ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {groups.length === 0 && <p className="py-6 text-center text-sm font-bold text-muted">Nothing here yet.</p>}
      {groups.map((g, gi) => (
        <Fragment key={g.key}>
          <div className="mb-1 mt-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.12em] text-muted after:h-0.5 after:flex-1 after:rounded after:bg-line-soft">
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-line" style={{ background: colorOf(g.actor) }} />
            {g.turn === 0 ? "SETUP" : `TURN ${g.turn} · ${(g.actor ?? "").toUpperCase()}${gi === 0 && g.actor === current && state.phase === "playing" ? " · NOW" : ""}`}
          </div>
          {g.items.map((it, ii) => {
            const live = gi === 0 && ii === g.items.length - 1 && state.pending?.type === "buy" && it.icon === "🏷️";
            return (
              <div
                key={it.key}
                className={`my-1 flex items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-[13.5px] font-medium text-ink ${live ? "bg-tip shadow-[inset_0_0_0_2px_#d9a441]" : "bg-row"}`}
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-chip text-base">
                  {it.icon}
                </span>
                <span className="min-w-0">{emphasize(it.text, names)}</span>
                {it.amount !== undefined && it.tone && <AmountPill amount={it.amount} tone={it.tone} />}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** Bold player names inside a log line. */
function emphasize(text: string, names: string[]) {
  if (names.length === 0) return text;
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((part, i) => (names.includes(part) ? <b key={i} className="font-extrabold text-ink">{part}</b> : part));
}

function MyCities({ state, myId, busy, send, onOpenDeed }: { state: ClientGameState; myId: string | null; busy: boolean; send: Send; onOpenDeed: (i: number) => void }) {
  const mine = BOARD.filter((s) => state.ownership[s.index]?.ownerId === myId);
  if (!myId) return <p className="py-6 text-center text-sm font-bold text-muted">You are watching this game.</p>;
  if (mine.length === 0) return <p className="py-6 text-center text-sm font-bold text-muted">No cities yet — land on one and buy it.</p>;
  const small = "rounded-[10px] border-[1.5px] border-line bg-parchment px-2 py-1 text-[11.5px] font-extrabold shadow-chip disabled:opacity-40";
  return (
    <div className="pt-2">
      {mine.map((s) => {
        const own = state.ownership[s.index];
        return (
          <div key={s.index} className="border-b-2 border-dashed border-line-soft py-2.5 last:border-b-0">
            <button onClick={() => onOpenDeed(s.index)} className="flex w-full items-center gap-2.5 text-left">
              <span className="text-2xl leading-none">{CITY_LANDMARK[s.index] ?? SPACE_ICON[s.index] ?? "🏷️"}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-extrabold">{s.name}</b>
                <span className="text-xs font-bold text-muted">
                  {s.group ? SET_NAME[s.group] : ""}
                  {own.houses >= 5 ? " · hotel" : own.houses > 0 ? ` · ${own.houses} house${own.houses > 1 ? "s" : ""}` : ""}
                  {own.mortgaged ? " · mortgaged" : ""}
                </span>
              </span>
            </button>
            <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
              {s.type === "property" && !own.mortgaged && own.houses < 5 && (
                <button disabled={busy} className={small} onClick={() => send({ type: "build", spaceIndex: s.index })}>
                  🏗️ Build {s.houseCost ? formatMoney(s.houseCost) : ""}
                </button>
              )}
              {own.houses > 0 && (
                <button disabled={busy} className={small} onClick={() => send({ type: "sellBuilding", spaceIndex: s.index })}>
                  Sell {own.houses >= 5 ? "hotel" : "house"}
                </button>
              )}
              {own.mortgaged ? (
                <button disabled={busy} className={small} onClick={() => send({ type: "unmortgage", spaceIndex: s.index })}>
                  🏦 Unmortgage
                </button>
              ) : (
                own.houses === 0 && (
                  <button disabled={busy} className={small} onClick={() => send({ type: "mortgage", spaceIndex: s.index })}>
                    🏦 Mortgage +{formatMoney(s.mortgageValue ?? 0)}
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RulesList({ state, code, onLeave }: { state: ClientGameState; code: string; onLeave?: () => void }) {
  const s = settingsOf(state);
  const rows: [string, string][] = [
    ["Room code", code],
    ["Starting cash", formatMoney(s.startCash)],
    ["Passing GO pays", formatMoney(s.goSalary)],
    ["Exact GO bonus", s.exactGoBonus ? "On" : "Off"],
    ["Free Parking jackpot", s.parkingJackpot ? `On · pot ${formatMoney(state.pot ?? 0)}` : "Off"],
    ["Rent while in jail", s.rentInJail ? "On" : "Off"],
    ["Even building", s.evenBuilding ? "On" : "Off"],
    ["Random turn order", s.randomOrder ? "On" : "Off"],
    ["Max players", String(s.maxPlayers)],
  ];
  return (
    <div className="pt-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b-2 border-dashed border-line-soft py-2 text-sm font-extrabold text-muted last:border-b-0">
          <span>{k}</span>
          <b className="font-extrabold text-ink">{v}</b>
        </div>
      ))}
      <p className="mt-3 text-xs font-bold text-muted">Rules were set by the host in the lobby and are locked for this game.</p>
      {onLeave && (
        <button
          onClick={onLeave}
          className="mt-5 w-full rounded-[14px] border-2 border-line bg-parchment py-2.5 text-sm font-extrabold text-coral shadow-chip hover:bg-[#fff0f2]"
        >
          🚪 Leave game (forfeit)
        </button>
      )}
    </div>
  );
}
