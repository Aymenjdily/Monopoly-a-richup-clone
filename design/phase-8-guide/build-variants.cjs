// In-game guide (advisor) design variants G1–G3, injected into the approved F3 HUD mockup.
// Run: node build-variants.cjs, then render with headless Edge (1600×1000).
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../phase-6-hud/variant-F3-hud.html"), "utf8")
  .replace("url(board-bg.png)", "url(../phase-6-hud/board-bg.png)");
const at = (needle) => {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error("marker not found: " + needle.slice(0, 50));
  return i;
};
const iSide = at('<div class="card" style="position:absolute;right:24px;top:110px');
const iDeed = at('<div style="position:absolute;left:470px;top:250px;width:380px">');
const iPill = at('<div class="card" style="position:absolute;left:24px;bottom:24px');
const iChips = at('<div style="position:absolute;left:24px;bottom:112px');
const head = src.slice(0, iSide);
const side = src.slice(iSide, iDeed);
const deed = src.slice(iDeed, iPill);
const pill = src.slice(iPill, iChips);
const tail = src.slice(iChips);

const CSS = `
 .coach { position:absolute; background:#fff; border:3px solid var(--ink); border-radius:22px; box-shadow:0 6px 0 var(--ink), 18px 22px 0 rgba(31,27,46,.08); }
 .mascot { width:46px; height:46px; border-radius:15px; border:3px solid var(--ink); background:var(--mango); display:grid; place-items:center; font-size:24px; flex:none; box-shadow:0 3px 0 var(--ink); }
 .why { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:5px; }
 .why li { display:flex; gap:8px; align-items:flex-start; font-size:13px; font-weight:700; color:#4a4258; }
 .why li b { color:var(--ink); }
 .ok, .no, .warn { flex:none; width:18px; height:18px; border-radius:6px; border:2px solid var(--ink); display:grid; place-items:center; font-size:10px; font-weight:900; margin-top:1px; }
 .ok { background:var(--mint); } .no { background:#ffd0d8; } .warn { background:#ffe3a3; }
 .gsec { font-size:11px; font-weight:900; letter-spacing:.14em; color:var(--muted); margin:12px 0 6px; display:flex; align-items:center; gap:8px; }
 .gsec::after { content:""; flex:1; height:2px; background:#eee5d6; border-radius:2px; }
 .gcard { border:2.5px solid var(--ink); border-radius:16px; padding:10px 12px; background:#fffaf0; }
 .gcard.now { background:#fff7dc; box-shadow:inset 0 0 0 2.5px var(--mango); border-color:var(--ink); }
 .gcard h4 { font:900 15px "Segoe UI Black","Segoe UI"; display:flex; align-items:center; gap:8px; }
 .gcard p { font-size:12.5px; font-weight:700; color:#6f6580; margin-top:3px; }
 .tag2 { font-size:10px; font-weight:900; letter-spacing:.08em; border:2px solid var(--ink); border-radius:999px; padding:0 7px; margin-left:auto; }
 .pin { position:absolute; display:flex; align-items:center; gap:6px; background:#fff; border:2.5px solid var(--ink); border-radius:999px; padding:4px 10px; font-size:12px; font-weight:900; box-shadow:0 3px 0 var(--ink); white-space:nowrap; }
 .pin::after { content:""; position:absolute; left:18px; bottom:-9px; border:6px solid transparent; border-top-color:var(--ink); }
 .ring { position:absolute; border:3px dashed var(--coral); border-radius:14px; }
 .toggle { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:900; border:2.5px solid var(--ink); border-radius:999px; padding:2px 4px 2px 9px; background:#fff; }
 .toggle i { width:30px; height:18px; border-radius:999px; border:2px solid var(--ink); background:var(--mint); position:relative; font-style:normal; }
 .toggle i::after { content:""; position:absolute; top:1px; left:13px; width:12px; height:12px; border-radius:50%; background:#fff; border:2px solid var(--ink); }
`;
const page = (title, body) => head.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace("</style>", CSS + "</style>") + body + tail;

// ── G1: coach bubble — one tip at a time, next to your turn controls ─────────────
const g1 = page("Variant G1 — Guide coach bubble", side + deed + pill + `
<div class="coach" style="left:24px;bottom:152px;width:432px;padding:14px 16px">
  <div style="display:flex;gap:12px;align-items:center">
    <div class="mascot">🎓</div>
    <div><div class="h">YOUR COACH · TIP 1 OF 3</div><div style="font:900 18px 'Segoe UI Black'">Buy Istanbul — it's a good deal</div></div>
    <span class="toggle" style="margin-left:auto">Hints<i></i></span>
  </div>
  <ul class="why">
    <li><span class="ok">✓</span><span>Starts your <b>Turkey</b> set — Antalya &amp; Izmir are still unowned or cheap to trade for later.</span></li>
    <li><span class="ok">✓</span><span>Red cities get landed on often (players leaving jail pass them).</span></li>
    <li><span class="ok">✓</span><span>You keep <b>$1,000</b> — well above a safe $300 reserve.</span></li>
  </ul>
  <div style="display:flex;gap:8px;margin-top:12px">
    <span class="btn mint sm" style="flex:1">Buy Istanbul · $240</span><span class="btn sm">Why these tips?</span><span class="btn sm">Next tip ›</span>
  </div>
</div>`);

// ── G2: a "Guide" tab — everything the coach thinks, sorted by priority ──────────
const guideTab = `
<div class="card" style="position:absolute;right:24px;top:110px;bottom:24px;width:360px;padding:14px 18px;display:flex;flex-direction:column">
  <div class="tabs"><b>📜 History</b><b class="on">💡 Guide</b><b>🏙️ Cities</b><b>⚙️</b></div>
  <div style="flex:1;overflow:hidden">
    <div class="gsec">DO NOW</div>
    <div class="gcard now">
      <h4>🏷️ Buy Istanbul <span class="tag2" style="background:var(--mint)">GOOD BUY</span></h4>
      <p>Starts your Turkey set · you keep $1,000.</p>
      <div style="display:flex;gap:8px;margin-top:8px"><span class="btn mint sm" style="flex:1">Buy · $240</span><span class="btn sm">Skip</span></div>
    </div>
    <div class="gsec">UPGRADE NEXT</div>
    <div class="gcard">
      <h4>🏗️ Build on Spain <span class="tag2" style="background:var(--lilac)">BEST VALUE</span></h4>
      <p>You own the whole set. 3 houses each = $900 — Madrid's rent jumps from $14 to <b style="color:#1f1b2e">$550</b>.</p>
      <div style="display:flex;gap:8px;margin-top:8px"><span class="btn sm">Build 1 house · $100</span></div>
    </div>
    <div class="gsec">WATCH OUT</div>
    <div class="gcard" style="background:#fff">
      <h4>⚠️ Juno's hotel on Barcelona</h4>
      <p>$1,000 rent if you roll a 7 next turn (1 in 6). Keep cash or mortgage-ready cities.</p>
    </div>
    <div class="gsec">GOOD TO KNOW</div>
    <p style="font-size:12.5px;font-weight:700;color:#6f6580">💡 3 houses is the sweet spot — the biggest rent jump per dollar.</p>
  </div>
</div>`;
const pillReview = pill.replace('<span class="btn ink ghost sm" style="margin-left:6px">End turn</span>', '<span class="btn mint sm" style="margin-left:6px">🏷️ Istanbul · $240</span>');
const g2 = page("Variant G2 — Guide tab", guideTab + pillReview);

// ── G3: inline — verdicts on the deed card, pins on the board, a tip line ────────
const verdict = `
    <div style="background:#dcf6e8;border-bottom:3px solid #1f1b2e;padding:9px 18px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">👍</span>
      <div><div style="font:900 14px 'Segoe UI Black'">Good buy</div><div style="font-size:12px;font-weight:700;color:#4a4258">Starts your Turkey set · you keep $1,000</div></div>
      <span class="toggle" style="margin-left:auto">Hints<i></i></span>
    </div>`;
const deedWithVerdict = deed.replace(/(<div style="background:#e6ded0;border-bottom:3px solid #1f1b2e;[\s\S]*?<\/svg><\/div>\n    <\/div>)/, (m) => m + verdict); // fn, so "$1,000" isn't read as a backreference
const g3 = page("Variant G3 — Inline hints", side + deedWithVerdict + pill.replace("<div><div style=\"font:900 16px 'Segoe UI Black'\">Your turn · 7</div><div style=\"font-size:12px;font-weight:800;color:#8a809b\">Turn 15</div></div>",
  "<div><div style=\"font:900 16px 'Segoe UI Black'\">Your turn · 7</div><div style=\"font-size:12px;font-weight:800;color:#8a809b\">💡 Next: build 3 houses on Spain</div></div>") + `
<div class="ring" style="left:328px;top:236px;width:92px;height:58px"></div>
<div class="pin" style="left:300px;top:196px"><span>⚠️</span>Juno's hotel · $1,000</div>
<div class="ring" style="left:312px;top:340px;width:92px;height:56px;border-color:#46a758"></div>
<div class="pin" style="left:280px;top:402px;background:#dcf6e8"><span>⬆️</span>Build here · $100</div>`);

for (const [f, html] of [["variant-G1-guide.html", g1], ["variant-G2-guide.html", g2], ["variant-G3-guide.html", g3]]) {
  fs.writeFileSync(path.join(__dirname, f), html);
  console.log("wrote", f);
}
