"use client";

/** "🎵 Music" on/off pill for the lobby (remembered per device). Also drives the loop. */
import { useEffect, useState } from "react";

import { isMusicOn, setLobbyMusicActive, setMusicOn, subscribeMusic } from "./music";

export function MusicToggle({ active }: { active: boolean }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    queueMicrotask(() => setOn(isMusicOn()));
    return subscribeMusic(setOn);
  }, []);

  // play while this lobby is showing; fade out on game start / leaving the page
  useEffect(() => {
    setLobbyMusicActive(active);
    return () => setLobbyMusicActive(false);
  }, [active]);

  return (
    <button
      onClick={() => setMusicOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn lobby music off" : "Turn lobby music on"}
      className="pointer-events-auto flex h-[60px] items-center gap-2 whitespace-nowrap rounded-[14px] border-[3px] border-ink bg-white px-[16px] text-[15px] font-black shadow-[0_4px_0_#1f1b2e] hover:bg-cream max-sm:h-[50px] max-sm:px-3"
    >
      <span className={`grid h-7 w-7 place-items-center rounded-full border-[2.5px] border-ink text-sm ${on ? "bg-mint" : "bg-[#efe6d6]"}`}>
        {on ? "🎵" : "🔇"}
      </span>
      <span className="max-sm:hidden">Music {on ? "on" : "off"}</span>
    </button>
  );
}
