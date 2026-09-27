// Generates the lobby room-settings design variants (E1–E3) from the approved
// variant-D lobby mockup. Run: node build-variants.cjs, then render with headless Edge.
const fs = require("fs");
const path = require("path");

const base = fs.readFileSync(path.join(__dirname, "../phase-6-ui-rework/variant-D-lobby.html"), "utf8")
  .replace('<script src="../shared/dd-diorama.js"></script>', '<script src="../shared/dd-diorama.js"></script>');

// ── shared control styles (same language as the lobby: ink outlines, hard shadows) ──
const CSS = `
 .sec { font-size: 11px; font-weight: 900; letter-spacing: .14em; color: var(--muted); margin: 0 0 9px; display: flex; align-items: center; gap: 8px; }
 .sec::after { content: ""; flex: 1; height: 2.5px; border-radius: 2px; background: #eee5d6; }
 .seg { display: flex; gap: 6px; }
 .seg b { flex: 1; text-align: center; font-size: 15px; font-weight: 900; padding: 9px 0; border: 2.5px solid var(--ink); border-radius: 12px; background: #fff; box-shadow: 0 3px 0 var(--ink); }
 .seg b.on { background: var(--mango); }
 .seg b.def::after { content: " ★"; font-size: 10px; }
 .row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 2px dashed #efe6d6; }
 .row:last-child { border-bottom: 0; }
 .row .ic { width: 34px; height: 34px; flex: none; border: 2.5px solid var(--ink); border-radius: 10px; display: grid; place-items: center; font-size: 17px; background: var(--c, #fff); }
 .row .tx { flex: 1; min-width: 0; }
 .row .tx b { display: block; font-size: 15px; font-weight: 900; }
 .row .tx span { font-size: 12px; font-weight: 700; color: #8a809b; }
 .tog { width: 50px; height: 28px; flex: none; border: 2.5px solid var(--ink); border-radius: 999px; background: #efe6d6; position: relative; }
 .tog::after { content: ""; position: absolute; top: 2px; left: 2px; width: 19px; height: 19px; border-radius: 50%; background: #fff; border: 2.5px solid var(--ink); }
 .tog.on { background: var(--mint); }
 .tog.on::after { left: 24px; }
 .step { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 900; }
 .step i { font-style: normal; width: 30px; height: 30px; border: 2.5px solid var(--ink); border-radius: 9px; display: grid; place-items: center; background: #fff; box-shadow: 0 2px 0 var(--ink); }
 .lock { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 900; letter-spacing: .1em; background: var(--lilac); border: 2.5px solid var(--ink); border-radius: 999px; padding: 3px 10px; }
 .rules-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 900; background: #fff; border: 2.5px solid var(--ink); border-radius: 999px; padding: 4px 11px; box-shadow: 0 2px 0 var(--ink); white-space: nowrap; }
`;

const moneyBlock = `
  <div class="sec">STARTING CASH</div>
  <div class="seg"><b>$1,000</b><b class="on def">$1,500</b><b>$2,000</b><b>$2,500</b></div>
  <div class="sec" style="margin-top:16px">PASSING GO PAYS</div>
  <div class="seg"><b>$100</b><b class="on def">$200</b><b>$300</b></div>`;

const rulesRows = `
  <div class="row"><div class="ic" style="--c:#dcf6e8">🎯</div><div class="tx"><b>Exact GO bonus</b><span>Land exactly on GO: collect double</span></div><div class="tog on"></div></div>
  <div class="row"><div class="ic" style="--c:#ece6ff">🅿️</div><div class="tx"><b>Free Parking jackpot</b><span>Taxes & fees pile up in the middle</span></div><div class="tog"></div></div>
  <div class="row"><div class="ic" style="--c:#ffe9cf">🔒</div><div class="tx"><b>Rent while in jail</b><span>Jailed owners still collect rent</span></div><div class="tog on"></div></div>
  <div class="row"><div class="ic" style="--c:#e3f8ec">🏠</div><div class="tx"><b>Even building</b><span>Build evenly across a country set</span></div><div class="tog on"></div></div>
  <div class="row"><div class="ic" style="--c:#fff1c4">🎲</div><div class="tx"><b>Random turn order</b><span>Shuffle who goes first at start</span></div><div class="tog"></div></div>`;

const seatsRow = `
  <div class="row"><div class="ic" style="--c:#ffdbe1">👥</div><div class="tx"><b>Max players</b><span>Seats open in the lobby</span></div><div class="step"><i>−</i>6<i>+</i></div></div>`;

function variant(name, { css = "", body, vw = 1600, camZ = 18.4, dockCss = "" }) {
  let html = base.replace("</style>", CSS + css + dockCss + "\n</style>");
  html = html.replace("<title>Variant D — Lobby (pawn podiums)</title>", `<title>${name}</title>`);
  html = html.replace('  <div class="dock">', body + '\n  <div class="dock">');
  html = html
    .replace("renderer.setSize(1600, 1000);", `renderer.setSize(${vw}, 1000);`)
    .replace("new THREE.PerspectiveCamera(30, 1.6, 0.1, 100);", `new THREE.PerspectiveCamera(30, ${vw} / 1000, 0.1, 100);`)
    .replace("cam.position.set(0, 5.2, 18.4);", `cam.position.set(0, 5.2, ${camZ});`)
    .replace("x: (p.x + 1) / 2 * 1600", `x: (p.x + 1) / 2 * ${vw}`);
  return html;
}

// E1 — sidebar: stage on the left, rules panel on the right
const e1 = variant("Variant E1 — Lobby rules sidebar", {
  vw: 1110,
  camZ: 26,
  css: `
 .side { position: absolute; right: 44px; top: 170px; width: 430px; background: #fff; border: 3.5px solid var(--ink); border-radius: 26px;
   box-shadow: 0 8px 0 var(--ink), 20px 24px 0 rgba(31,27,46,.08); padding: 20px 24px 14px; }
 .side h2 { font: 900 22px "Segoe UI Black", "Segoe UI"; display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
 .side h2 .lock { margin-left: auto; }`,
  dockCss: `
 .dock { left: 44px !important; transform: none !important; width: 1020px !important; }
 .start { white-space: nowrap; }`,
  body: `
  <div class="side">
    <h2>⚙️ Room rules <span class="lock">HOST ONLY</span></h2>
    ${moneyBlock}
    <div class="sec" style="margin-top:16px">RULES</div>
    ${rulesRows}
    ${seatsRow}
  </div>`,
});

// E2 — sheet: "Room rules" button in the header opens a centered sheet; dock shows a summary
const e2 = variant("Variant E2 — Lobby rules sheet", {
  css: `
 .dim { position: absolute; inset: 0; background: rgba(31,27,46,.38); z-index: 5; }
 .sheet { position: absolute; z-index: 6; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 820px; background: #fff; border: 3.5px solid var(--ink);
   border-radius: 28px; box-shadow: 0 9px 0 var(--ink), 30px 34px 0 rgba(31,27,46,.12); padding: 26px 30px 24px; }
 .sheet h2 { font: 900 28px "Segoe UI Black", "Segoe UI"; display: flex; align-items: center; gap: 12px; }
 .sheet h2 small { font: 800 14px "Segoe UI"; color: var(--muted); }
 .sheet .x { margin-left: auto; width: 42px; height: 42px; border: 3px solid var(--ink); border-radius: 12px; display: grid; place-items: center; font-size: 18px; box-shadow: 0 3px 0 var(--ink); }
 .cols { display: grid; grid-template-columns: 1fr 1.25fr; gap: 30px; margin-top: 18px; }
 .foot { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 2.5px solid #eee5d6; }
 .foot .reset { font-size: 14px; font-weight: 900; color: var(--muted); }
 .foot .save { margin-left: auto; background: var(--ink); color: #fff; border-radius: 16px; padding: 13px 24px; font: 900 17px "Segoe UI Black", "Segoe UI"; box-shadow: 0 5px 0 rgba(31,27,46,.3); }
 .rulesbtn { height: 60px; padding: 0 18px; border: 3px solid var(--ink); border-radius: 14px; background: #fff; font-size: 15px; font-weight: 900; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 0 var(--ink); }`,
  body: `
  <div class="dim"></div>
  <div class="sheet">
    <h2>⚙️ Room rules <small>everyone in the lobby sees changes live</small><span class="x">✕</span></h2>
    <div class="cols">
      <div>${moneyBlock}
        <div class="sec" style="margin-top:16px">SEATS</div>
        ${seatsRow}
      </div>
      <div><div class="sec">RULES</div>${rulesRows}</div>
    </div>
    <div class="foot"><span class="reset">↺ Reset to standard</span><span class="save">Save rules</span></div>
  </div>`,
});

// E3 — rule tiles: every setting is a mini board tile in a row above the stage
const tile = (band, icon, label, value, extra = "") =>
  `<div class="rt"><i style="background:${band}"></i><div class="ri">${icon}</div><b>${label}</b><div class="rv">${value}</div>${extra}</div>`;
const e3 = variant("Variant E3 — Lobby rule tiles", {
  camZ: 19.2,
  css: `
 .tiles { position: absolute; left: 56px; right: 56px; top: 164px; display: flex; gap: 12px; align-items: stretch; }
 .rt { flex: 1; position: relative; background: #fffaf0; border: 3px solid var(--ink); border-radius: 16px; padding: 22px 10px 10px; text-align: center;
   box-shadow: 0 5px 0 var(--ink), 0 9px 0 #e2d6bf; }
 .rt > i { position: absolute; left: 7px; right: 7px; top: 7px; height: 9px; border-radius: 6px; border: 2px solid var(--ink); }
 .rt .ri { font-size: 26px; line-height: 1; margin-top: 4px; }
 .rt b { display: block; font-size: 11px; font-weight: 900; letter-spacing: .12em; color: var(--muted); margin-top: 6px; }
 .rt .rv { margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; font: 900 19px "Segoe UI Black", "Segoe UI"; }
 .rt .rv s { text-decoration: none; width: 24px; height: 24px; border: 2.5px solid var(--ink); border-radius: 8px; display: grid; place-items: center; font-size: 13px; background: #fff; }
 .rt .tog { margin: 0 auto; }
 .rt.hl { background: #fff; box-shadow: 0 5px 0 var(--ink), 0 0 0 5px rgba(255,197,61,.5); }
 .tiles .hint { position: absolute; right: 0; top: -30px; }`,
  body: `
  <div class="tiles">
    <span class="lock hint">HOST ONLY · CLICK A TILE</span>
    ${tile("#5fd99a", "💵", "START CASH", "<s>◀</s>$1,500<s>▶</s>", "")}
    ${tile("#ffd23e", "➡️", "PASS GO", "<s>◀</s>$200<s>▶</s>")}
    ${tile("#8fd3f5", "🎯", "EXACT GO ×2", '<div class="tog on"></div>')}
    ${tile("#c9b8ff", "🅿️", "PARKING JACKPOT", '<div class="tog"></div>')}
    ${tile("#ffab5e", "🔒", "RENT IN JAIL", '<div class="tog on"></div>')}
    ${tile("#ff9cc6", "🏠", "EVEN BUILD", '<div class="tog on"></div>')}
    ${tile("#ff6f6f", "🎲", "RANDOM ORDER", '<div class="tog"></div>')}
    ${tile("#7a9dff", "👥", "MAX PLAYERS", "<s>−</s>6<s>+</s>")}
  </div>`,
});

// E2's header gets the "Room rules" button next to the code box
const e2html = e2.replace('<div class="copy">⧉ Copy invite</div>\n    </div>', '<div class="copy">⧉ Copy invite</div>\n    </div>\n    <div class="rulesbtn">⚙️ Room rules</div>');

for (const [file, html] of [["variant-E1-lobby.html", e1], ["variant-E2-lobby.html", e2html], ["variant-E3-lobby.html", e3]]) {
  fs.writeFileSync(path.join(__dirname, file), html);
  console.log("wrote", file);
}
