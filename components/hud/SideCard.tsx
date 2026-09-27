"use client";

/** Right-hand tabbed card (F3): History · My cities · Rules. */
import { Fragment, useMemo, useState } from "react";

import { CITY_LANDMARK, SPACE_ICON } from "@/components/board3d/theme";
import { BOARD } from "@/lib/engine/board";
import { settingsOf } from "@/lib/engine/settings";
import type { ClientGameState } from "@/lib/shared/events";

import { AmountPill, SET_NAME } from "./bits";
import { buildHistory, filterHistory, formatMoney, type HistoryFilter } from "./history";

export type SideTab = "history" | "cities" | "rules";
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
  const TABS: [SideTab, string][] = [
    ["history", "📜 History"],
    ["cities", "🏙️ My cities"],
    ["rules", "⚙️ Rules"],
  ];
  return (
    <div className="pointer-events-auto flex h-full flex-col rounded-[20px] border-[3px] border-ink bg-white px-[18px] py-3.5 shadow-[0_5px_0_#1f1b2e]">
      <div className="flex gap-1.5" role="tablist">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            className={`whitespace-nowrap rounded-full border-[2.5px] px-3 py-[5px] text-[12.5px] font-black ${tab === t ? "border-ink bg-mango text-ink" : "border-transparent text-[#8a809b] hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {tab === "history" && <HistoryFeed state={state} myId={myId} />}
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
  const colorOf = (name?: string) => state.players.find((p) => p.name === name)?.colorToken ?? "#e6ded0";
  const current = state.players[state.turn.playerIdx]?.name;
  const names = state.players.map((p) => p.name).sort((a, b) => b.length - a.length);

  return (
    <div>
      <div className="sticky top-0 z-10 flex gap-1 bg-white pb-1 pt-2">
        {(["all", "money", "moves"] as HistoryFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-black capitalize ${filter === f ? "bg-ink text-white" : "text-[#8a809b] hover:text-ink"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {groups.length === 0 && <p className="py-6 text-center text-sm font-bold text-[#a89fb5]">Nothing here yet.</p>}
      {groups.map((g, gi) => (
        <Fragment key={g.key}>
          <div className="mb-1 mt-2.5 flex items-center gap-2 text-[11px] font-black tracking-[0.12em] text-[#a89fb5] after:h-0.5 after:flex-1 after:rounded after:bg-[#eee5d6]">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-ink" style={{ background: colorOf(g.actor) }} />
            {g.turn === 0 ? "SETUP" : `TURN ${g.turn} · ${(g.actor ?? "").toUpperCase()}${gi === 0 && g.actor === current && state.phase === "playing" ? " · NOW" : ""}`}
          </div>
          {g.items.map((it, ii) => {
            const live = gi === 0 && ii === g.items.length - 1 && state.pending?.type === "buy" && it.icon === "🏷️";
            return (
              <div
                key={it.key}
                className={`flex items-center gap-2.5 py-1.5 text-[13.5px] font-bold text-[#4a4258] ${live ? "-mx-2 rounded-xl bg-[#fff7dc] px-2 shadow-[inset_0_0_0_2.5px_#ffc53d]" : ""}`}
              >
                <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] border-[2.5px] border-ink text-sm" style={{ background: it.tint }}>
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
  return text.split(re).map((part, i) => (names.includes(part) ? <b key={i} className="font-black text-ink">{part}</b> : part));
}

function MyCities({ state, myId, busy, send, onOpenDeed }: { state: ClientGameState; myId: string | null; busy: boolean; send: Send; onOpenDeed: (i: number) => void }) {
  const mine = BOARD.filter((s) => state.ownership[s.index]?.ownerId === myId);
  if (!myId) return <p className="py-6 text-center text-sm font-bold text-[#a89fb5]">You are watching this game.</p>;
  if (mine.length === 0) return <p className="py-6 text-center text-sm font-bold text-[#a89fb5]">No cities yet — land on one and buy it.</p>;
  const small = "rounded-[10px] border-[2.5px] border-ink bg-white px-2 py-1 text-[11.5px] font-black shadow-[0_2px_0_#1f1b2e] disabled:opacity-40";
  return (
    <div className="pt-2">
      {mine.map((s) => {
        const own = state.ownership[s.index];
        return (
          <div key={s.index} className="border-b-2 border-dashed border-[#efe6d6] py-2.5 last:border-b-0">
            <button onClick={() => onOpenDeed(s.index)} className="flex w-full items-center gap-2.5 text-left">
              <span className="text-2xl leading-none">{CITY_LANDMARK[s.index] ?? SPACE_ICON[s.index] ?? "🏷️"}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-black">{s.name}</b>
                <span className="text-xs font-bold text-[#8a809b]">
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
        <div key={k} className="flex justify-between border-b-2 border-dashed border-[#efe6d6] py-2 text-sm font-extrabold text-[#6f6580] last:border-b-0">
          <span>{k}</span>
          <b className="font-black text-ink">{v}</b>
        </div>
      ))}
      <p className="mt-3 text-xs font-bold text-[#a89fb5]">Rules were set by the host in the lobby and are locked for this game.</p>
      {onLeave && (
        <button
          onClick={onLeave}
          className="mt-5 w-full rounded-[14px] border-[3px] border-ink bg-white py-2.5 text-sm font-black text-coral shadow-[0_3px_0_#1f1b2e] hover:bg-[#fff0f2]"
        >
          🚪 Leave game (forfeit)
        </button>
      )}
    </div>
  );
}
