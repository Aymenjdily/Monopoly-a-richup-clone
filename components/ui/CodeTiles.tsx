"use client";

/**
 * Room code shown as six mini board tiles (variant D). With `onChange` it is an input:
 * one transparent <input> sits over the tiles, so typing/pasting/IME all work natively.
 */
import { useState } from "react";

const SLOTS = [0, 1, 2, 3, 4, 5];

export function CodeTiles({
  value,
  onChange,
  onEnter,
  size = "md",
}: {
  value: string;
  onChange?: (v: string) => void;
  onEnter?: () => void;
  size?: "md" | "lg";
}) {
  const [focused, setFocused] = useState(false);
  const chars = value.toUpperCase().slice(0, 6).split("");
  const tile = size === "lg" ? "h-[52px] w-[40px] text-[23px] sm:h-[60px] sm:w-[48px] sm:text-[27px]" : "h-[58px] min-w-0 flex-1 text-[25px]";

  return (
    <div className={`relative flex gap-[7px] ${size === "md" ? "flex-1" : ""}`}>
      {SLOTS.map((i) => {
        const ch = chars[i];
        const current = focused && i === Math.min(chars.length, 5);
        return (
          <div
            key={i}
            className={`relative grid place-items-center overflow-hidden rounded-[12px] border-2 font-extrabold ${tile} ${
              current ? "border-brass bg-parchment shadow-[0_0_0_4px_rgba(217,164,65,0.35)]" : "border-line bg-row"
            } ${ch ? "" : "text-muted"}`}
          >
            {ch ?? "·"}
          </div>
        );
      })}
      {onChange && (
        <input
          aria-label="Room code"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="absolute inset-0 w-full cursor-text opacity-0"
        />
      )}
    </div>
  );
}
