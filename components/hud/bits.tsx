/** Small shared HUD pieces: flag, pawn badge, die face, amount pill, set names. */
import type { GroupId } from "@/lib/engine/board";
import type { FlagCode } from "@/components/board3d/theme";

import { formatMoney, type AmountTone } from "./history";

export const SET_NAME: Partial<Record<GroupId, string>> = {
  brown: "Italy",
  lightblue: "Japan",
  pink: "Thailand",
  orange: "Spain",
  red: "Turkey",
  yellow: "Germany",
  green: "Brazil",
  darkblue: "USA",
  railroad: "Railways",
  utility: "Utilities",
};

const FLAGS: Record<FlagCode, string> = {
  IT: `<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/>`,
  JP: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.6" fill="#bc002d"/>`,
  TH: `<rect width="30" height="20" fill="#a51931"/><rect y="3.3" width="30" height="13.4" fill="#f4f5f8"/><rect y="6.7" width="30" height="6.6" fill="#2d2a4a"/>`,
  ES: `<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>`,
  TR: `<rect width="30" height="20" fill="#e30a17"/><circle cx="12" cy="10" r="5" fill="#fff"/><circle cx="13.3" cy="10" r="4" fill="#e30a17"/><polygon points="18.2,10 21.6,8.8 19.5,11.8 19.5,8.2 21.6,11.2" fill="#fff"/>`,
  DE: `<rect width="30" height="6.7" fill="#111"/><rect y="6.7" width="30" height="6.6" fill="#dd0000"/><rect y="13.3" width="30" height="6.7" fill="#ffce00"/>`,
  BR: `<rect width="30" height="20" fill="#009c3b"/><polygon points="15,2.5 27,10 15,17.5 3,10" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/>`,
  US: `<rect width="30" height="20" fill="#fff"/><rect y="0" width="30" height="2.86" fill="#b22234"/><rect y="5.72" width="30" height="2.86" fill="#b22234"/><rect y="11.44" width="30" height="2.86" fill="#b22234"/><rect y="17.16" width="30" height="2.86" fill="#b22234"/><rect width="13" height="11.4" fill="#3c3b6e"/>`,
};

export function Flag({ code, w = 42 }: { code: FlagCode; w?: number }) {
  return (
    <svg
      viewBox="0 0 30 20"
      width={w}
      height={(w * 2) / 3}
      className="block rounded-[5px] border-[2.5px] border-ink"
      dangerouslySetInnerHTML={{ __html: FLAGS[code] }}
    />
  );
}

export function PawnBadge({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-[11px] border-[2.5px] border-ink" style={{ background: color, width: size, height: size }}>
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
        <circle cx="8" cy="5" r="3.6" fill="#fff" stroke="#1f1b2e" strokeWidth="1.8" />
        <path d="M4.5 18 C5 13 6.3 11 6.5 9 L9.5 9 C9.7 11 11 13 11.5 18 Z" fill="#fff" stroke="#1f1b2e" strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="2.5" y="16.6" width="11" height="2.6" rx="1.3" fill="#fff" stroke="#1f1b2e" strokeWidth="1.6" />
      </svg>
    </span>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};

export function DieFace({ value, coral = false }: { value: number; coral?: boolean }) {
  return (
    <span
      className={`grid h-[38px] w-[38px] grid-cols-3 grid-rows-3 rounded-[10px] border-[3px] border-ink p-[5px] shadow-[0_3px_0_#1f1b2e] ${coral ? "bg-coral" : "bg-white"}`}
      aria-label={`die ${value}`}
    >
      {(PIPS[value] ?? []).map(([r, c], i) => (
        <i key={i} className={`h-1.5 w-1.5 place-self-center rounded-full ${coral ? "bg-white" : "bg-ink"}`} style={{ gridArea: `${r}/${c}` }} />
      ))}
    </span>
  );
}

const TONE: Record<AmountTone, string> = {
  plus: "bg-mint",
  minus: "bg-[#ffd0d8]",
  neutral: "bg-white",
  pot: "bg-lilac",
};

export function AmountPill({ amount, tone }: { amount: number; tone: AmountTone }) {
  const label = tone === "pot" ? `pot +$${Math.abs(amount)}` : tone === "plus" ? `+${formatMoney(amount)}` : formatMoney(amount);
  return (
    <span className={`ml-auto flex-none whitespace-nowrap rounded-full border-2 border-ink px-2 py-px text-[12.5px] font-black ${TONE[tone]}`}>{label}</span>
  );
}

export function Tag({ children, className }: { children: string; className: string }) {
  return <span className={`rounded-full border-2 border-ink px-1.5 text-[9.5px] font-black tracking-[0.08em] ${className}`}>{children}</span>;
}
