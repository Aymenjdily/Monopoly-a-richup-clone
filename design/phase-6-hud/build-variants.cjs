// Phase 6 HUD design variants (F1–F3) drawn over a real board capture (board-bg.png,
// seeded demo room DEMO42). Run: node build-variants.cjs, then render with headless Edge.
const fs = require("fs");
const path = require("path");

const CSS = `
 * { margin: 0; box-sizing: border-box; }
 :root { --ink:#1f1b2e; --coral:#ff6b81; --mango:#ffc53d; --mint:#7fe3a8; --lilac:#c9b8ff; --cream:#fffaf0; --muted:#a89fb5; }
 html, body { width: 1600px; height: 1000px; overflow: hidden; }
 body { font-family: "Segoe UI", system-ui, sans-serif; color: var(--ink); position: relative;
   background: linear-gradient(180deg, #fff7ea 0%, #ffefd8 100%); }
 .bg { position: absolute; background: url(board-bg.png) no-repeat center/100% 100%;
   -webkit-mask-image: linear-gradient(to right, transparent, #000 9%, #000 91%, transparent), linear-gradient(to bottom, transparent, #000 9%, #000 91%, transparent);
   -webkit-mask-composite: source-in; mask-composite: intersect; }
 .card { background: #fff; border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 5px 0 var(--ink); }
 .h { font: 900 13px "Segoe UI Black", "Segoe UI"; letter-spacing: .14em; color: var(--muted); }
 .dot { width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--ink); flex: none; }
 .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 900; border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 10px; background: #fff; white-space: nowrap; }
 .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 3px solid var(--ink); border-radius: 15px; padding: 11px 18px; font: 900 16px "Segoe UI Black", "Segoe UI"; box-shadow: 0 4px 0 var(--ink); background: #fff; white-space: nowrap; }
 .btn.mint { background: var(--mint); } .btn.coral { background: var(--coral); color: #fff; } .btn.ink { background: var(--ink); color: #fff; box-shadow: 0 4px 0 rgba(31,27,46,.3); }
 .btn.ghost { opacity: .45; }
 .btn.sm { padding: 7px 12px; font-size: 13px; border-radius: 12px; box-shadow: 0 3px 0 var(--ink); }
 .die { width: 38px; height: 38px; border: 3px solid var(--ink); border-radius: 10px; background: #fff; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 5px; box-shadow: 0 3px 0 var(--ink); }
 .die.c { background: var(--coral); } .die i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink); place-self: center; } .die.c i { background: #fff; }

 /* players */
 .pl { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
 .pl .pawn { width: 34px; height: 34px; border-radius: 11px; border: 2.5px solid var(--ink); display: grid; place-items: center; flex: none; }
 .pl .pawn svg { display: block; }
 .pl .nm { font-weight: 900; font-size: 15px; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
 .pl .sub { white-space: nowrap; }
 .pl .nm small { font: 800 12px "Segoe UI"; color: #b6adc4; }
 .pl .sub { font-size: 11.5px; font-weight: 800; color: #8a809b; display: flex; gap: 6px; align-items: center; margin-top: 1px; }
 .pl .cash { margin-left: auto; font: 900 18px "Segoe UI Black", "Segoe UI"; }
 .pl.turn { background: #fff7dc; box-shadow: inset 0 0 0 3px var(--mango); border-radius: 14px; }
 .tag { font-size: 9.5px; font-weight: 900; letter-spacing: .08em; border: 2px solid var(--ink); border-radius: 999px; padding: 0 6px; background: var(--b, #fff); }

 /* history */
 .turnsep { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 900; letter-spacing: .12em; color: var(--muted); margin: 10px 0 4px; }
 .turnsep::after { content: ""; flex: 1; height: 2px; background: #eee5d6; border-radius: 2px; }
 .turnsep .dot { width: 10px; height: 10px; border-width: 2px; }
 .ev { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13.5px; font-weight: 700; color: #4a4258; }
 .ev .ic { width: 30px; height: 30px; border-radius: 9px; border: 2.5px solid var(--ink); display: grid; place-items: center; font-size: 14px; flex: none; background: var(--t, #fff); }
 .ev b { color: var(--ink); font-weight: 900; }
 .ev .amt { margin-left: auto; font: 900 12.5px "Segoe UI Black", "Segoe UI"; border: 2px solid var(--ink); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
 .amt.plus { background: var(--mint); } .amt.minus { background: #ffd0d8; } .amt.pot { background: var(--lilac); }
 .ev.now { background: #fff7dc; border-radius: 12px; padding: 6px 8px; margin: 0 -8px; box-shadow: inset 0 0 0 2.5px var(--mango); }
 .tabs { display: flex; gap: 6px; }
 .tabs b { font-size: 12.5px; font-weight: 900; padding: 5px 11px; border-radius: 999px; border: 2.5px solid transparent; color: #8a809b; }
 .tabs b.on { border-color: var(--ink); background: var(--mango); color: var(--ink); }
 .fade { position: relative; }
 .fade::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 40px; background: linear-gradient(transparent, #fff); pointer-events: none; }
`;

const PLAYERS = [
  { n: "Sasha", c: "#e5484d", cash: "$1,240", sub: "4 cities · 1 hotel", you: true, turn: true },
  { n: "Juno", c: "#f5a623", cash: "$860", sub: "4 cities · 5 houses" },
  { n: "Dice Bot", c: "#f7cf3c", cash: "$1,020", sub: "2 cities · 1 mortgaged", bot: true, jail: true },
  { n: "Marek", c: "#46a758", cash: "$430", sub: "4 cities" },
];
const pawn = (c) => `<div class="pawn" style="background:${c}"><svg width="16" height="20" viewBox="0 0 16 20"><circle cx="8" cy="5" r="3.6" fill="#fff" stroke="#1f1b2e" stroke-width="1.8"/><path d="M4.5 18 C5 13 6.3 11 6.5 9 L9.5 9 C9.7 11 11 13 11.5 18 Z" fill="#fff" stroke="#1f1b2e" stroke-width="1.8" stroke-linejoin="round"/><rect x="2.5" y="16.6" width="11" height="2.6" rx="1.3" fill="#fff" stroke="#1f1b2e" stroke-width="1.6"/></svg></div>`;
const playerRow = (p) => `
  <div class="pl ${p.turn ? "turn" : ""}">${pawn(p.c)}
    <div><div class="nm">${p.n}${p.you ? " <small>(you)</small>" : ""}${p.bot ? ' <span class="tag" style="--b:#c9b8ff">BOT</span>' : ""}${p.jail ? ' <span class="tag" style="--b:#ffab5e">IN JAIL</span>' : ""}</div>
    <div class="sub">${p.sub}</div></div>
    <div class="cash">${p.cash}</div></div>`;

const sep = (label, c) => `<div class="turnsep"><span class="dot" style="background:${c}"></span>${label}</div>`;
const ev = (icon, tint, html, amt = "", cls = "") => `<div class="ev ${cls}"><div class="ic" style="--t:${tint}">${icon}</div><div>${html}</div>${amt}</div>`;
const plus = (t) => `<span class="amt plus">${t}</span>`;
const minus = (t) => `<span class="amt minus">${t}</span>`;
const potA = (t) => `<span class="amt pot">${t}</span>`;
const HISTORY = [
  sep("TURN 15 · SASHA · NOW", "#e5484d"),
  ev("🎲", "#fff1c4", "<b>Sasha</b> rolled 4 + 3 → <b>Istanbul</b>", "", ""),
  ev("🕌", "#fffaf0", "<b>Istanbul</b> is for sale", `<span class="amt" style="background:#fff">$240</span>`, "now"),
  sep("TURN 14 · MAREK", "#46a758"),
  ev("🎲", "#fff1c4", "<b>Marek</b> rolled 2 + 2 (doubles) → <b>Madrid</b>"),
  ev("💸", "#ffe3e8", "<b>Marek</b> paid <b>Sasha</b> rent for Madrid", plus("+$180")),
  sep("TURN 13 · DICE BOT", "#f7cf3c"),
  ev("🚔", "#ffdbe1", "<b>Dice Bot</b> went to jail"),
  sep("TURN 12 · JUNO", "#f5a623"),
  ev("🃏", "#eee8ff", "<b>Juno</b> drew Chance: <i>Advance to GO</i>"),
  ev("➡️", "#dcf6e8", "<b>Juno</b> passed GO", plus("+$200")),
  ev("🏠", "#e3f8ec", "<b>Juno</b> built a house on <b>Osaka</b>", minus("−$50")),
  ev("🅿️", "#ece6ff", "Income Tax went to the jackpot", potA("pot $350")),
].join("");

const dice = `<div style="display:flex;gap:6px"><div class="die c"><i style="grid-area:1/1"></i><i style="grid-area:1/3"></i><i style="grid-area:3/1"></i><i style="grid-area:3/3"></i></div><div class="die"><i style="grid-area:1/1"></i><i style="grid-area:2/2"></i><i style="grid-area:3/3"></i></div></div>`;
const rulesChips = `<span class="chip" style="background:#ece6ff">🅿️ Jackpot $350</span><span class="chip">💵 $1,500 · GO $200</span>`;

/** box = [left, top, width] of the feathered board capture (keeps the 16:10 ratio). */
function page(title, body, box) {
  const [l, t, w] = box;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}\n .bg { left:${l}px; top:${t}px; width:${w}px; height:${w * 0.625}px; }</style></head><body><div class="bg"></div>${body}</body></html>`;
}

// ── F1: side rails ──────────────────────────────────────────────────────────────
const f1 = page("Variant F1 — HUD side rails", `
<div class="card" style="position:absolute;left:24px;top:24px;width:318px;padding:14px 12px 10px">
  <div class="h" style="padding:0 6px 8px;display:flex;align-items:center">PLAYERS <span class="chip" style="margin-left:auto;letter-spacing:.1em">ROOM 7GH6J9</span></div>
  ${PLAYERS.map(playerRow).join("")}
</div>
<div class="card" style="position:absolute;left:24px;top:418px;width:318px;padding:14px 16px">
  <div class="h" style="margin-bottom:10px">TABLE</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">${rulesChips}<span class="chip">⚙️ Rules</span></div>
</div>
<div class="card" style="position:absolute;right:24px;top:24px;bottom:24px;width:382px;padding:16px 18px;display:flex;flex-direction:column">
  <div style="display:flex;align-items:center;gap:10px"><div style="font:900 20px 'Segoe UI Black'">📜 History</div>
    <div class="tabs" style="margin-left:auto"><b class="on">All</b><b>Money</b><b>Moves</b></div></div>
  <div class="fade" style="flex:1;overflow:hidden;margin-top:6px">${HISTORY}</div>
</div>
<div class="card" style="position:absolute;left:366px;right:430px;bottom:24px;padding:12px 14px;display:flex;align-items:center;gap:14px;border-radius:24px">
  ${dice}
  <div><div style="font:900 17px 'Segoe UI Black'">Your turn · 7</div><div style="font-size:12.5px;font-weight:800;color:#8a809b">Istanbul is for sale</div></div>
  <div style="margin-left:auto;display:flex;gap:8px"><span class="btn mint">Buy · $240</span><span class="btn">Decline</span><span class="btn ink ghost">End turn</span></div>
</div>
<div style="position:absolute;left:366px;right:430px;bottom:112px;display:flex;justify-content:center;gap:8px">
  <span class="btn sm">🏗️ Build</span><span class="btn sm">🏦 Mortgage</span><span class="btn sm">🃏 Jail card</span>
</div>`, [210, 60, 1100]);

// ── F2: top players + bottom console ───────────────────────────────────────────
const f2 = page("Variant F2 — HUD bottom console", `
<div style="position:absolute;left:24px;right:24px;top:20px;display:flex;gap:12px;align-items:stretch">
  ${PLAYERS.map((p) => `<div class="card" style="flex:1;padding:4px 6px;border-radius:18px">${playerRow(p)}</div>`).join("")}
  <div class="card" style="padding:10px 14px;display:flex;flex-direction:column;justify-content:center;gap:6px;border-radius:18px">${rulesChips}</div>
</div>
<div class="card" style="position:absolute;left:24px;right:24px;bottom:22px;height:236px;display:grid;grid-template-columns:1fr 1.15fr;border-radius:26px;overflow:hidden">
  <div style="padding:18px 22px;border-right:3px dashed #eee5d6;display:flex;flex-direction:column">
    <div class="h">YOUR TURN · TURN 15</div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:12px">${dice}
      <div><div style="font:900 22px 'Segoe UI Black'">Istanbul · $240</div><div style="font-size:13px;font-weight:800;color:#8a809b">Turkey set · you own 0 of 3 · rent from $20</div></div></div>
    <div style="display:flex;gap:10px;margin-top:auto"><span class="btn mint" style="flex:1">Buy Istanbul · $240</span><span class="btn">Decline</span><span class="btn ink ghost">End turn</span></div>
    <div style="display:flex;gap:8px;margin-top:12px"><span class="btn sm">🏗️ Build</span><span class="btn sm">🏦 Mortgage</span><span class="btn sm">🃏 Jail card</span><span class="btn sm" style="margin-left:auto">⚙️ Rules</span></div>
  </div>
  <div style="padding:14px 22px;display:flex;flex-direction:column;min-height:0">
    <div style="display:flex;align-items:center"><div style="font:900 17px 'Segoe UI Black'">📜 History</div><div class="tabs" style="margin-left:auto"><b class="on">All</b><b>Money</b><b>Moves</b></div></div>
    <div class="fade" style="flex:1;overflow:hidden">${HISTORY}</div>
  </div>
</div>`, [225, 70, 1150]);

// ── F3: deed card decision + tabbed side card ──────────────────────────────────
const trFlag = `<svg viewBox="0 0 30 20" width="42" height="28" style="border:2.5px solid #1f1b2e;border-radius:5px;display:block"><rect width="30" height="20" fill="#e30a17"/><circle cx="12" cy="10" r="5" fill="#fff"/><circle cx="13.3" cy="10" r="4" fill="#e30a17"/><polygon points="18.2,10 21.6,8.8 19.5,11.8 19.5,8.2 21.6,11.2" fill="#fff"/></svg>`;
const rent = (l, v, hl = false) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:2px dashed #eee5d6;font-size:14px;font-weight:800;${hl ? "color:#1f1b2e" : "color:#6f6580"}"><span>${l}</span><b>${v}</b></div>`;
const f3 = page("Variant F3 — HUD deed card", `
<div style="position:absolute;left:24px;top:22px;display:flex;gap:10px">
  ${PLAYERS.map((p) => `<div class="card" style="padding:2px 4px;border-radius:18px;width:296px">${playerRow(p)}</div>`).join("")}
</div>
<div class="card" style="position:absolute;right:24px;top:110px;bottom:24px;width:360px;padding:14px 18px;display:flex;flex-direction:column">
  <div class="tabs"><b class="on">📜 History</b><b>🏙️ My cities</b><b>⚙️ Rules</b></div>
  <div class="fade" style="flex:1;overflow:hidden;margin-top:4px">${HISTORY}</div>
</div>
<div style="position:absolute;left:470px;top:250px;width:380px">
  <div class="card" style="border-radius:26px;padding:0;overflow:hidden;box-shadow:0 8px 0 #1f1b2e, 22px 26px 0 rgba(31,27,46,.12)">
    <div style="background:#e6ded0;border-bottom:3px solid #1f1b2e;padding:14px 18px;display:flex;align-items:center;gap:12px">
      <div style="font-size:44px;line-height:1">🕌</div>
      <div><div class="h" style="color:#6f6580">FOR SALE · TURKEY</div><div style="font:900 30px 'Segoe UI Black';line-height:1">Istanbul</div></div>
      <div style="margin-left:auto">${trFlag}</div>
    </div>
    <div style="padding:12px 18px 16px">
      ${rent("Rent", "$20", true)}${rent("With full Turkey set", "$40")}${rent("With 1 house", "$100")}${rent("With 2 houses", "$300")}${rent("With 3 houses", "$750")}${rent("With 4 houses", "$925")}${rent("With a hotel", "$1,100")}
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;font-weight:800;color:#8a809b"><span>House $150 each</span><span>Mortgage $120</span><span>Antalya: Dice Bot</span></div>
      <div style="display:flex;gap:10px;margin-top:14px"><span class="btn mint" style="flex:1">Buy · $240</span><span class="btn">Decline</span></div>
      <div style="text-align:center;font-size:12px;font-weight:800;color:#8a809b;margin-top:10px">You have $1,240 · after buying $1,000</div>
    </div>
  </div>
</div>
<div class="card" style="position:absolute;left:24px;bottom:24px;padding:10px 14px;display:flex;align-items:center;gap:12px;border-radius:22px">
  ${dice}<div><div style="font:900 16px 'Segoe UI Black'">Your turn · 7</div><div style="font-size:12px;font-weight:800;color:#8a809b">Turn 15</div></div>
  <span class="btn ink ghost sm" style="margin-left:6px">End turn</span><span class="btn sm">🏗️ Build</span><span class="btn sm">🏦 Mortgage</span>
</div>
<div style="position:absolute;left:24px;bottom:112px;display:flex;gap:6px">${rulesChips}</div>`, [40, 120, 1300]);

for (const [f, html] of [["variant-F1-hud.html", f1], ["variant-F2-hud.html", f2], ["variant-F3-hud.html", f3]]) {
  fs.writeFileSync(path.join(__dirname, f), html);
  console.log("wrote", f);
}
