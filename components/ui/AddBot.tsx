"use client";

/** "Add bot" control for an empty lobby seat: one click opens the personality choice. */
import { useState } from "react";

import { BOT_STYLES, type BotStyle } from "@/lib/engine/bots";

export const BOT_STYLE_LABEL: Record<BotStyle, string> = { cautious: "Cautious", balanced: "Balanced", aggressive: "Aggressive" };
const HINT: Record<BotStyle, string> = {
  cautious: "Protects its cash and buys carefully",
  balanced: "Buys good cities and builds when it can afford to",
  aggressive: "Buys almost everything and builds fast",
};
const TONE: Record<BotStyle, string> = { cautious: "bg-row", balanced: "bg-brass", aggressive: "bg-coral text-white" };

interface AddBotProps {
  busy?: boolean;
  onAdd: (style: BotStyle) => void;
  /** classes of the closed "＋ Add bot" button (each seat layout has its own look) */
  buttonClassName: string;
  /** layout of the three choices */
  choicesClassName: string;
}

export function AddBot({ busy, onAdd, buttonClassName, choicesClassName }: AddBotProps) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} disabled={busy} className={buttonClassName}>
        <b className="text-coral">＋</b> Add bot
      </button>
    );
  }
  return (
    <div className={choicesClassName} role="group" aria-label="Bot personality">
      {BOT_STYLES.map((style) => (
        <button
          key={style}
          title={HINT[style]}
          disabled={busy}
          onClick={() => {
            setOpen(false);
            onAdd(style);
          }}
          className={`whitespace-nowrap rounded-full border-2 border-line px-3 py-1 text-[13px] font-extrabold shadow-chip hover:brightness-105 disabled:opacity-60 ${TONE[style]}`}
        >
          {BOT_STYLE_LABEL[style]}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="text-xs font-bold text-muted underline">
        cancel
      </button>
    </div>
  );
}
