"use client";

/** 3D / Flat camera switch (same pill look as SoundToggle). */
import type { BoardView } from "@/components/board3d/viewPref";

export function ViewToggle({ view, onChange }: { view: BoardView; onChange: (v: BoardView) => void }) {
  const opt = (v: BoardView, label: string) => (
    <button
      aria-pressed={view === v}
      onClick={() => view !== v && onChange(v)}
      className={`h-8 rounded-full px-3 text-sm font-extrabold ${view === v ? "bg-mint text-ink" : "text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Board view" className="pointer-events-auto flex items-center gap-0.5 rounded-full border-2 border-line bg-parchment p-1 shadow-chip">
      {opt("3d", "🎲 3D")}
      {opt("flat", "▦ Flat")}
    </div>
  );
}
