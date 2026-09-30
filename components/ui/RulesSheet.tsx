"use client";

/**
 * "Room rules" sheet (design/phase-6-lobby-settings/variant-E2-lobby.png).
 * The host edits a local draft and saves; everyone else sees the live values read-only.
 * The server validates every value — this component only offers the whitelisted options.
 */
import { useEffect, useState, type ReactNode } from "react";

import {
  DEFAULT_SETTINGS,
  GO_SALARY_OPTIONS,
  MAX_SEATS,
  MIN_PLAYERS,
  START_CASH_OPTIONS,
  type RoomSettings,
} from "@/lib/engine/settings";

type ToggleKey = "exactGoBonus" | "parkingJackpot" | "rentInJail" | "evenBuilding" | "randomOrder";

const TOGGLES: { key: ToggleKey; icon: string; tint: string; title: string; hint: string }[] = [
  { key: "exactGoBonus", icon: "🎯", tint: "#dcf6e8", title: "Exact GO bonus", hint: "Land exactly on GO: collect double" },
  { key: "parkingJackpot", icon: "🅿️", tint: "#ece6ff", title: "Free Parking jackpot", hint: "Taxes & fees pile up in the middle" },
  { key: "rentInJail", icon: "🔒", tint: "#ffe9cf", title: "Rent while in jail", hint: "Jailed owners still collect rent" },
  { key: "evenBuilding", icon: "🏠", tint: "#e3f8ec", title: "Even building", hint: "Build evenly across a country set" },
  { key: "randomOrder", icon: "🎲", tint: "#fff1c4", title: "Random turn order", hint: "Shuffle who goes first at start" },
];

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function RulesSheet({
  settings,
  editable,
  seated,
  busy,
  onSave,
  onClose,
}: {
  settings: RoomSettings;
  editable: boolean;
  /** players already seated — max players can't go below this */
  seated: number;
  busy: boolean;
  onSave: (next: RoomSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoomSettings>(settings);
  // Non-hosts always mirror the live values.
  useEffect(() => {
    if (!editable) queueMicrotask(() => setDraft(settings));
  }, [settings, editable]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof RoomSettings>(k: K, v: RoomSettings[K]) => editable && setDraft((d) => ({ ...d, [k]: v }));
  const minSeats = Math.max(MIN_PLAYERS, seated);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Room rules">
      <button aria-label="Close" className="absolute inset-0 cursor-default bg-black/50" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-[820px] overflow-y-auto rounded-[28px] border-2 border-line bg-parchment px-5 pb-6 pt-6 shadow-panel sm:px-[30px]">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-extrabold sm:text-[28px]">⚙️ Room rules</h2>
          <span className="text-sm font-extrabold text-muted max-sm:hidden">
            {editable ? "everyone in the lobby sees changes live" : "only the host can change these"}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-[42px] w-[42px] flex-none place-items-center rounded-[12px] border-2 border-line text-lg font-extrabold shadow-chip"
          >
            ✕
          </button>
        </div>

        <div className="mt-[18px] grid gap-[30px] md:grid-cols-[1fr_1.25fr]">
          <div>
            <Section>STARTING CASH</Section>
            <Segmented options={START_CASH_OPTIONS} value={draft.startCash} def={DEFAULT_SETTINGS.startCash} disabled={!editable} onPick={(v) => set("startCash", v)} />
            <Section className="mt-4">PASSING GO PAYS</Section>
            <Segmented options={GO_SALARY_OPTIONS} value={draft.goSalary} def={DEFAULT_SETTINGS.goSalary} disabled={!editable} onPick={(v) => set("goSalary", v)} />
            <Section className="mt-4">SEATS</Section>
            <Row icon="👥" tint="#ffdbe1" title="Max players" hint="Seats open in the lobby">
              <div className="flex items-center gap-2 text-lg font-extrabold">
                <StepBtn disabled={!editable || draft.maxPlayers <= minSeats} onClick={() => set("maxPlayers", draft.maxPlayers - 1)}>−</StepBtn>
                <span className="w-4 text-center">{draft.maxPlayers}</span>
                <StepBtn disabled={!editable || draft.maxPlayers >= MAX_SEATS} onClick={() => set("maxPlayers", draft.maxPlayers + 1)}>+</StepBtn>
              </div>
            </Row>
          </div>
          <div>
            <Section>RULES</Section>
            {TOGGLES.map((t) => (
              <Row key={t.key} icon={t.icon} tint={t.tint} title={t.title} hint={t.hint}>
                <Toggle on={draft[t.key]} disabled={!editable} label={t.title} onChange={(v) => set(t.key, v)} />
              </Row>
            ))}
          </div>
        </div>

        {editable && (
          <div className="mt-[18px] flex items-center gap-3 border-t-[2.5px] border-line-soft pt-4">
            <button onClick={() => setDraft({ ...DEFAULT_SETTINGS, maxPlayers: Math.max(DEFAULT_SETTINGS.maxPlayers, seated) })} className="text-sm font-extrabold text-muted hover:text-ink">
              ↺ Reset to standard
            </button>
            <button
              onClick={() => onSave(draft)}
              disabled={busy || !dirty}
              className="gbtn gbtn-gold ml-auto"
            >
              Save rules
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`mb-[9px] flex items-center gap-2 text-[11px] font-extrabold tracking-[0.14em] text-muted after:h-[2.5px] after:flex-1 after:rounded after:bg-line-soft ${className}`}>
      {children}
    </div>
  );
}

function Segmented({ options, value, def, disabled, onPick }: { options: readonly number[]; value: number; def: number; disabled: boolean; onPick: (v: number) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={o === value}
          disabled={disabled}
          onClick={() => onPick(o)}
          className={`flex-1 rounded-[12px] border-[1.5px] border-line py-[9px] text-[15px] font-extrabold shadow-chip disabled:cursor-default ${o === value ? "bg-brass" : "bg-parchment"}`}
        >
          {money(o)}
          {o === def && <span className="text-[10px]"> ★</span>}
        </button>
      ))}
    </div>
  );
}

function Row({ icon, tint, title, hint, children }: { icon: string; tint: string; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-dashed border-line-soft py-[9px] last:border-b-0">
      <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border-[1.5px] border-line text-[17px]" style={{ background: tint }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[15px] font-extrabold">{title}</b>
        <span className="text-xs font-bold text-muted">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, disabled, label, onChange }: { on: boolean; disabled: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-[50px] flex-none rounded-full border-[1.5px] border-line transition-colors disabled:cursor-default ${on ? "bg-mint" : "bg-chip"}`}
    >
      <span className={`absolute top-[2px] h-[19px] w-[19px] rounded-full border-[1.5px] border-line bg-parchment transition-[left] ${on ? "left-[24px]" : "left-[2px]"}`} />
    </button>
  );
}

function StepBtn({ children, disabled, onClick }: { children: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="grid h-[30px] w-[30px] place-items-center rounded-[9px] border-[1.5px] border-line bg-parchment shadow-chip disabled:opacity-40"
    >
      {children}
    </button>
  );
}
