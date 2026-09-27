"use client";

/** Speaker button + volume slider (preferences remembered per device). */
import { useEffect, useState } from "react";

import { getSoundPrefs, playSfx, setSoundPrefs, subscribeSoundPrefs, unlockAudio, type SoundPrefs } from "./sfx";

export function SoundToggle() {
  const [prefs, setPrefs] = useState<SoundPrefs>({ muted: false, volume: 0.7 });
  useEffect(() => {
    queueMicrotask(() => setPrefs(getSoundPrefs()));
    return subscribeSoundPrefs(setPrefs);
  }, []);

  const off = prefs.muted || prefs.volume === 0;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full border-[3px] border-ink bg-white py-1 pl-1 pr-3 shadow-[0_3px_0_#1f1b2e]">
      <button
        aria-label={off ? "Unmute sounds" : "Mute sounds"}
        aria-pressed={!off}
        onClick={() => {
          unlockAudio();
          setSoundPrefs({ muted: !prefs.muted, volume: prefs.volume === 0 ? 0.7 : prefs.volume });
          if (prefs.muted) playSfx("click");
        }}
        className={`grid h-8 w-8 place-items-center rounded-full text-base ${off ? "bg-[#efe6d6]" : "bg-mint"}`}
      >
        {off ? "🔇" : "🔊"}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((prefs.muted ? 0 : prefs.volume) * 100)}
        aria-label="Sound volume"
        onChange={(e) => {
          const v = Number(e.target.value) / 100;
          setSoundPrefs({ volume: v, muted: v === 0 });
        }}
        onPointerUp={() => playSfx("coin")}
        className="h-1.5 w-20 cursor-pointer accent-[#ff6b81] max-sm:w-14"
      />
    </div>
  );
}
