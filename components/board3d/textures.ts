/**
 * Canvas painters for the board (client-only: uses `document`). Ported from the approved
 * C2 rev 3 board design. Pure drawing — callers wrap the
 * canvases in THREE.CanvasTexture and cache them.
 */
import type { BoardSpace } from "@/lib/engine/types";

import { GAP, PX, type TilePlace } from "./layout";
import { BRASS_DARK, CITY_LANDMARK, CORAL, FELT, GROUP_FLAG, INK, LILAC, LINE, MANGO, NEUTRAL_BAND, PAPER, SPACE_ICON, TYPE_TINT, type FlagCode } from "./theme";

const FALLBACK_FONT = '"Segoe UI", system-ui, sans-serif';
/** Canvas font stack. Resolved from the app font (next/font sets --font-outfit) on first use. */
export let FONT = FALLBACK_FONT;

// Textures painted before the web font loads would keep the fallback face, so painters
// subscribe to an epoch that bumps once the font is ready and repaint.
let fontEpoch = 0;
let fontStarted = false;
const fontSubs = new Set<() => void>();
function startFont() {
  if (fontStarted || typeof document === "undefined") return;
  fontStarted = true;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim();
  if (!family) return;
  FONT = `${family}, ${FALLBACK_FONT}`;
  Promise.all([700, 800].map((w) => document.fonts.load(`${w} 40px ${family}`)))
    .catch(() => undefined)
    .then(() => {
      fontEpoch += 1;
      fontSubs.forEach((fn) => fn());
    });
}
export function subscribeFont(cb: () => void): () => void {
  fontSubs.add(cb);
  startFont();
  return () => fontSubs.delete(cb);
}
export const getFontEpoch = () => fontEpoch;
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  startFont();
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, w, h);
  return c;
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string | null, stroke?: string | null, lw = 5) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function setSpacing(ctx: Ctx, px: number) {
  // letterSpacing is widely supported; guard for older engines.
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function fitLines(ctx: Ctx, text: string, maxW: number, maxLines: number, size: number) {
  for (let s = size; s >= 16; s -= 2) {
    ctx.font = `900 ${s}px ${FONT}`;
    const lines: string[] = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const t = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(t).width <= maxW) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    lines.push(cur);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size: s };
  }
  return { lines: [text], size: 16 };
}

function textBlock(ctx: Ctx, text: string, x: number, top: number, maxW: number, size: number, align: CanvasTextAlign = "center", maxLines = 2) {
  const f = fitLines(ctx, text, maxW, maxLines, size);
  ctx.fillStyle = INK;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  f.lines.forEach((l, i) => ctx.fillText(l, x, top + i * f.size * 1.02));
}

function pill(ctx: Ctx, text: string, cx: number, cy: number, bg: string, align: "center" | "right" = "center", size = 33, color = INK) {
  ctx.font = `900 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 0.9;
  const h = size * 1.45;
  const x = align === "center" ? cx - w / 2 : cx - w;
  rr(ctx, x, cy - h / 2, w, h, h / 2, bg, LINE, 3);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, cy + 2);
}

export function drawFlag(ctx: Ctx, code: FlagCode, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.clip();
  const sx = w / 30;
  const sy = h / 20;
  const R = (fx: number, fy: number, fw: number, fh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + fx * sx, y + fy * sy, fw * sx + 0.5, fh * sy + 0.5);
  };
  const C = (cx: number, cy: number, r: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + cx * sx, y + cy * sy, r * sy, 0, Math.PI * 2);
    ctx.fill();
  };
  switch (code) {
    case "IT":
      R(0, 0, 10, 20, "#009246"); R(10, 0, 10, 20, "#fff"); R(20, 0, 10, 20, "#ce2b37");
      break;
    case "JP":
      R(0, 0, 30, 20, "#fff"); C(15, 10, 5.6, "#bc002d");
      break;
    case "TH":
      R(0, 0, 30, 20, "#a51931"); R(0, 3.3, 30, 13.4, "#f4f5f8"); R(0, 6.7, 30, 6.6, "#2d2a4a");
      break;
    case "ES":
      R(0, 0, 30, 20, "#aa151b"); R(0, 5, 30, 10, "#f1bf00");
      break;
    case "TR": {
      R(0, 0, 30, 20, "#e30a17"); C(12, 10, 5, "#fff"); C(13.3, 10, 4, "#e30a17");
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = (k % 2 ? 1.1 : 2.6) * sy;
        ctx.lineTo(x + 19.6 * sx + Math.cos(a) * r, y + 10 * sy + Math.sin(a) * r);
      }
      ctx.fill();
      break;
    }
    case "DE":
      R(0, 0, 30, 6.7, "#111"); R(0, 6.7, 30, 6.6, "#dd0000"); R(0, 13.3, 30, 6.7, "#ffce00");
      break;
    case "BR":
      R(0, 0, 30, 20, "#009c3b");
      ctx.fillStyle = "#ffdf00";
      ctx.beginPath();
      ctx.moveTo(x + 15 * sx, y + 2.5 * sy); ctx.lineTo(x + 27 * sx, y + 10 * sy);
      ctx.lineTo(x + 15 * sx, y + 17.5 * sy); ctx.lineTo(x + 3 * sx, y + 10 * sy);
      ctx.fill();
      C(15, 10, 4.4, "#002776");
      break;
    case "US":
      R(0, 0, 30, 20, "#fff");
      for (let k = 0; k < 7; k += 2) R(0, k * 2.86, 30, 2.86, "#b22234");
      R(0, 0, 13, 11.4, "#3c3b6e");
      for (const [a, b] of [[3, 3], [6.5, 3], [10, 3], [4.7, 6], [8.3, 6], [3, 9], [6.5, 9], [10, 9]]) C(a, b, 0.8, "#fff");
      break;
  }
  ctx.restore();
  rr(ctx, x, y, w, h, 9, null, LINE, 3);
}

function drawChanceMark(ctx: Ctx, x: number, y: number, size: number, fill = CORAL) {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = BRASS_DARK;
  ctx.lineJoin = "round";
  ctx.strokeText("?", x, y);
  ctx.fillStyle = fill;
  ctx.fillText("?", x, y);
}

function drawEmoji(ctx: Ctx, glyph: string, x: number, y: number, size: number, align: CanvasTextAlign = "left", baseline: CanvasTextBaseline = "top") {
  ctx.font = `${size}px ${EMOJI}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = INK;
  ctx.fillText(glyph, x, y);
}

function sub(ctx: Ctx, text: string, x: number, y: number, size: number, align: CanvasTextAlign) {
  ctx.font = `900 ${size}px ${FONT}`;
  setSpacing(ctx, 3);
  ctx.fillStyle = "#7c6a52";
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  setSpacing(ctx, 0);
}

export interface TileLook {
  ownerColor?: string;
  mortgaged?: boolean;
}

/** Top face of one tile, drawn in world orientation (canvas top = -z, away from the camera). */
export function drawTile(space: BoardSpace, P: TilePlace, look: TileLook): HTMLCanvasElement {
  const cw = Math.round((P.w - GAP) * PX);
  const ch = Math.round((P.d - GAP) * PX);
  return makeCanvas(cw, ch, (ctx, w, h) => {
    // Buyable tiles are neutral until someone owns them, then take the owner's color.
    const owner = look.ownerColor;
    const buyable = space.type === "property" || space.type === "railroad" || space.type === "utility";
    const base = buyable ? PAPER : TYPE_TINT[space.type] ?? PAPER;
    rr(ctx, 5, 5, w - 10, h - 10, 26, owner ? mix(owner, PAPER, 0.16) : base, LINE, 5);
    if (owner) rr(ctx, 16, 16, w - 32, h - 32, 18, null, mix(owner, PAPER, 0.55), 6);
    if (look.mortgaged) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(8, 8, w - 16, h - 16, 22);
      ctx.clip();
      ctx.strokeStyle = "rgba(42,33,24,.12)";
      ctx.lineWidth = 12;
      for (let k = -h; k < w + h; k += 34) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k - h, h);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (P.side === "corner") {
      drawCorner(ctx, w, h, space);
      return;
    }

    const side = P.side;
    const vert = side === "left" || side === "right";
    const kind = space.type;
    const priceTxt = look.mortgaged ? "MORTGAGED" : space.price ? `$${space.price}` : "";
    const pillBg = look.mortgaged ? "#fff" : owner ?? "#fff";
    const pillCol = look.mortgaged ? CORAL : pillTextColor(pillBg);
    const pillSize = look.mortgaged ? 22 : 33;

    // Band on the center-facing edge: neutral by default, owner's color once bought.
    const band: [number, number, number, number] =
      side === "bottom" ? [18, 18, w - 36, 58]
      : side === "top" ? [18, h - 76, w - 36, 58]
      : side === "left" ? [w - 76, 18, 58, h - 36]
      : [18, 18, 58, h - 36];
    if (kind === "property" || kind === "utility") rr(ctx, ...band, 16, owner ?? NEUTRAL_BAND, LINE, 3);
    if (kind === "railroad") drawTrack(ctx, band, vert, owner ?? NEUTRAL_BAND);

    const flag = space.group ? GROUP_FLAG[space.group] : undefined;
    const art = CITY_LANDMARK[space.index] ?? SPACE_ICON[space.index];
    const name = kind === "chest" ? "Community Chest" : space.name;
    const taxSub = kind === "tax" && space.effect?.amount ? `PAY $${space.effect.amount}` : "";
    const plain = kind === "chance" || kind === "chest" || kind === "tax";

    const bigArt = (x: number, y: number, size: number, align: CanvasTextAlign) => {
      if (kind === "chance") drawChanceMark(ctx, align === "center" ? x - size * 0.28 : x, y - size * 0.12, size * 1.2);
      else drawEmoji(ctx, kind === "chest" ? "🎁" : art ?? "•", x, y, size, align);
    };
    // flag (cities) + price pill on one row
    const footer = (cx: number, cy: number, alignRight = false) => {
      if (plain) return;
      if (flag) {
        ctx.font = `900 ${pillSize}px ${FONT}`;
        const pw = ctx.measureText(priceTxt).width + pillSize * 0.9;
        const total = 58 + 12 + pw;
        const x0 = alignRight ? cx - total : cx - total / 2;
        drawFlag(ctx, flag, x0, cy - 19, 58, 38);
        pill(ctx, priceTxt, x0 + 70 + pw, cy, pillBg, "right", pillSize, pillCol);
      } else {
        pill(ctx, priceTxt, cx, cy, pillBg, alignRight ? "right" : "center", pillSize, pillCol);
      }
    };

    if (!vert) {
      // bottom row reads band → art → name → footer; top row mirrors so the band faces the center
      const artTop = side === "bottom" ? 92 : 96;
      bigArt(w / 2, artTop, 96, "center");
      const nameTop = artTop + 108;
      textBlock(ctx, name, w / 2, nameTop, w - 26, 44);
      if (taxSub) sub(ctx, taxSub, w / 2, nameTop + 124, 25, "center");
      footer(w / 2, side === "bottom" ? h - 50 : 50);
    } else {
      const l = side === "left" ? 26 : 96;
      const r = side === "left" ? w - 96 : w - 26;
      bigArt(l - 4, h / 2 - 56, 106, "left");
      const tx = l + 116;
      textBlock(ctx, name, tx, plain ? (taxSub ? 44 : h / 2 - 44) : 34, r - tx, 42, "left", 2);
      if (taxSub) sub(ctx, taxSub, tx, 206, 24, "left");
      footer(r, h - 50, true);
    }
  });
}

/** Blend `a` into `b` by `t` (0 → b, 1 → a). Hex colors only. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace("#", ""), 16);
  const pb = parseInt(b.replace("#", ""), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * t + ((pb >> s) & 255) * (1 - t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
export { mix as mixColor };

function pillTextColor(bg: string): string {
  // Dark owner colors (blue, violet, red) need white text on the price pill.
  const m = /^#?([0-9a-f]{6})$/i.exec(bg);
  if (!m) return INK;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.55 ? "#fff" : INK;
}

function drawTrack(ctx: Ctx, band: [number, number, number, number], vert: boolean, color: string) {
  const [bx, by, bw, bh] = band;
  rr(ctx, bx, by, bw, bh, 16, color, LINE, 3);
  ctx.fillStyle = INK;
  if (!vert) {
    for (let x = bx + 16; x < bx + bw - 10; x += 22) ctx.fillRect(x, by + 10, 7, bh - 20);
    ctx.fillRect(bx + 8, by + 16, bw - 16, 5);
    ctx.fillRect(bx + 8, by + bh - 21, bw - 16, 5);
  } else {
    for (let y = by + 16; y < by + bh - 10; y += 22) ctx.fillRect(bx + 10, y, bw - 20, 7);
    ctx.fillRect(bx + 16, by + 8, 5, bh - 16);
    ctx.fillRect(bx + bw - 21, by + 8, 5, bh - 16);
  }
}

function drawCorner(ctx: Ctx, w: number, h: number, space: BoardSpace) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const title = (txt: string, y: number, size: number) => {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.fillText(txt, w / 2, y);
  };
  if (space.type === "go") {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const arrow = (col: string, lw: number) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(w - 50, 110); ctx.lineTo(110, 110);
      ctx.moveTo(160, 55); ctx.lineTo(100, 110); ctx.lineTo(160, 165);
      ctx.stroke();
    };
    arrow(BRASS_DARK, 40);
    arrow(MANGO, 26);
    title("GO", 318, 150);
    sub(ctx, "COLLECT $200", w / 2, 372, 26, "center");
  } else if (space.type === "jail") {
    rr(ctx, w - 250, 22, 228, 228, 22, "#e9c98a", LINE, 4);
    ctx.fillStyle = "rgba(42,33,24,.16)";
    ctx.fillRect(w - 244, 190, 216, 50);
    ctx.font = `900 30px ${FONT}`;
    setSpacing(ctx, 4);
    ctx.fillStyle = INK;
    ctx.fillText("IN JAIL", w - 134, 228);
    setSpacing(ctx, 0);
    drawEmoji(ctx, "🔒", 30, 110, 64, "left", "alphabetic");
    sub(ctx, "JUST VISITING", w / 2, h - 34, 26, "center");
  } else if (space.type === "parking") {
    drawEmoji(ctx, "🚗", w / 2, 210, 150, "center", "alphabetic");
    title("FREE", 300, 62);
    title("PARKING", 364, 62);
  } else {
    drawEmoji(ctx, "👮", w / 2, 210, 150, "center", "alphabetic");
    title("GO TO", 300, 62);
    title("JAIL", 364, 62);
  }
}

/** Board center: felt plate, dashed brass lines, cream title (G2). */
export function drawCenter(): HTMLCanvasElement {
  return makeCanvas(2048, 2048, (ctx, w, h) => {
    rr(ctx, 8, 8, w - 16, h - 16, 48, FELT);
    const g = ctx.createRadialGradient(w / 2, h * 0.44, 40, w / 2, h * 0.44, 900);
    g.addColorStop(0, "rgba(120,230,170,0.3)");
    g.addColorStop(1, "rgba(120,230,170,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    rr(ctx, 60, 60, w - 120, h - 120, 36, null, "rgba(253,243,214,0.45)", 6);
    ctx.setLineDash([4, 22]);
    ctx.lineCap = "round";
    rr(ctx, 96, 96, w - 192, h - 192, 28, null, "rgba(253,243,214,0.45)", 8);
    ctx.setLineDash([]);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `800 190px ${FONT}`;
    setSpacing(ctx, -6);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillText("Dice & Deeds", w / 2, 640 + 12);
    ctx.fillStyle = "#fdf3d6";
    ctx.fillText("Dice & Deeds", w / 2, 640);
    setSpacing(ctx, 14);
    ctx.font = `700 40px ${FONT}`;
    ctx.fillStyle = "#a8d9c0";
    ctx.fillText("GO AROUND THE WORLD", w / 2 + 7, 740);
    setSpacing(ctx, 0);
  });
}

/** Top card of a Chance / Community Chest deck. */
export function drawDeckTop(kind: "chance" | "chest"): HTMLCanvasElement {
  return makeCanvas(620, 404, (ctx, w, h) => {
    rr(ctx, 6, 6, w - 12, h - 12, 40, kind === "chance" ? MANGO : LILAC, BRASS_DARK, 6);
    rr(ctx, 30, 30, w - 60, h - 60, 26, null, "rgba(42,33,24,.22)", 4);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (kind === "chance") {
      ctx.font = `900 180px ${FONT}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = BRASS_DARK;
      ctx.lineJoin = "round";
      ctx.strokeText("?", w / 2, 250);
      ctx.fillStyle = "#fff";
      ctx.fillText("?", w / 2, 250);
    } else {
      drawEmoji(ctx, "🎁", w / 2, 240, 150, "center", "alphabetic");
    }
    ctx.font = `900 50px ${FONT}`;
    setSpacing(ctx, 8);
    ctx.fillStyle = INK;
    ctx.fillText(kind === "chance" ? "CHANCE" : "COMMUNITY", w / 2 + 4, 340);
    setSpacing(ctx, 0);
  });
}

/** Soft radial glow (active tile, "you" podium). */
export function drawGlow(w = 256, h = 384): HTMLCanvasElement {
  return makeCanvas(w, h, (ctx) => {
    const r = Math.max(w, h) / 2;
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r);
    g.addColorStop(0, "rgba(255,220,130,1)");
    g.addColorStop(0.55, "rgba(255,220,130,.8)");
    g.addColorStop(1, "rgba(255,220,130,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
