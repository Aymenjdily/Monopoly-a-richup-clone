// Shared Dice & Deeds diorama builder (design mockups only). Classic script so it loads from file://.
// Extracted from phase-5-board/variant-C2-board-v3.html (rev 3). Usage: DD.build({ THREE, RoundedBoxGeometry, scene, renderer, opts }).
window.DD = { build({ THREE, RoundedBoxGeometry, scene, renderer, opts = {} }) {
const INK = "#1f1b2e", PAPER = "#fffaf0";
const ANISO = renderer.capabilities.getMaxAnisotropy();
// ───────── helpers ─────────
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o });
function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  return t;
}
function rr(ctx, x, y, w, h, r, fill, stroke, lw = 5) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function fitLines(ctx, text, maxW, maxLines, size, weight = 900) {
  for (let s = size; s >= 16; s -= 2) {
    ctx.font = `${weight} ${s}px "Segoe UI Black", "Segoe UI"`;
    const words = text.split(" "), lines = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width <= maxW) cur = t; else { if (cur) lines.push(cur); cur = w; }
    }
    lines.push(cur);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size: s };
  }
  return { lines: [text], size: 16 };
}
function textBlock(ctx, text, cx, top, maxW, size, align = "center", maxLines = 2, color = INK) {
  const f = fitLines(ctx, text, maxW, maxLines, size);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top";
  f.lines.forEach((l, i) => ctx.fillText(l, cx, top + i * f.size * 1.02));
  return f.lines.length * f.size * 1.02;
}
function pill(ctx, text, cx, cy, bg, align = "center", size = 30, color = INK) {
  ctx.font = `900 ${size}px "Segoe UI Black", "Segoe UI"`;
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.45;
  const x = align === "center" ? cx - w / 2 : align === "right" ? cx - w : cx;
  rr(ctx, x, cy - h / 2, w, h, h / 2, bg, INK, 5);
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, cy + 2);
}

// flags (canvas, Windows has no flag emoji)
function drawFlag(ctx, code, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 9); ctx.clip();
  const sx = w / 30, sy = h / 20;
  const R = (fx, fy, fw, fh, c) => { ctx.fillStyle = c; ctx.fillRect(x + fx * sx, y + fy * sy, fw * sx + .5, fh * sy + .5); };
  const Cc = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + cx * sx, y + cy * sy, r * sy, 0, Math.PI * 2); ctx.fill(); };
  switch (code) {
    case "IT": R(0,0,10,20,"#009246"); R(10,0,10,20,"#fff"); R(20,0,10,20,"#ce2b37"); break;
    case "JP": R(0,0,30,20,"#fff"); Cc(15,10,5.6,"#bc002d"); break;
    case "TH": R(0,0,30,20,"#a51931"); R(0,3.3,30,13.4,"#f4f5f8"); R(0,6.7,30,6.6,"#2d2a4a"); break;
    case "ES": R(0,0,30,20,"#aa151b"); R(0,5,30,10,"#f1bf00"); break;
    case "TR": {
      R(0,0,30,20,"#e30a17"); Cc(12,10,5,"#fff"); Cc(13.3,10,4,"#e30a17");
      ctx.fillStyle = "#fff"; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 1.1 : 2.6) * sy;
        ctx.lineTo(x + 19.6 * sx + Math.cos(a) * r, y + 10 * sy + Math.sin(a) * r); }
      ctx.fill(); break; }
    case "DE": R(0,0,30,6.7,"#111"); R(0,6.7,30,6.6,"#dd0000"); R(0,13.3,30,6.7,"#ffce00"); break;
    case "BR": R(0,0,30,20,"#009c3b"); ctx.fillStyle = "#ffdf00"; ctx.beginPath();
      ctx.moveTo(x+15*sx,y+2.5*sy); ctx.lineTo(x+27*sx,y+10*sy); ctx.lineTo(x+15*sx,y+17.5*sy); ctx.lineTo(x+3*sx,y+10*sy); ctx.fill();
      Cc(15,10,4.4,"#002776"); break;
    case "US": R(0,0,30,20,"#fff"); for (let k = 0; k < 7; k += 2) R(0,k*2.86,30,2.86,"#b22234"); R(0,0,13,11.4,"#3c3b6e");
      [[3,3],[6.5,3],[10,3],[4.7,6],[8.3,6],[3,9],[6.5,9],[10,9]].forEach(([a,b]) => Cc(a,b,.8,"#fff")); break;
  }
  ctx.restore();
  rr(ctx, x, y, w, h, 9, null, INK, 5);
}

// ───────── data (index order = lib/engine/board.ts) ─────────
const G = { brown:"#c98b5e", lightblue:"#8fd3f5", pink:"#ff9cc6", orange:"#ffab5e", red:"#ff6f6f",
            yellow:"#ffd23e", green:"#5fd99a", darkblue:"#7a9dff" };
const T = [
  { k:"go" }, { k:"city", g:"brown", c:"IT", n:"Sicily", p:60 }, { k:"chest" },
  { k:"city", g:"brown", c:"IT", n:"Milan", p:60 }, { k:"tax", i:"💸", n:"Income Tax", p:200 },
  { k:"rail", i:"🚂", n:"Trans-Sib", p:200 }, { k:"city", g:"lightblue", c:"JP", n:"Kyoto", p:100 },
  { k:"chance" }, { k:"city", g:"lightblue", c:"JP", n:"Osaka", p:100 },
  { k:"city", g:"lightblue", c:"JP", n:"Tokyo", p:120 }, { k:"jail" },
  { k:"city", g:"pink", c:"TH", n:"Phuket", p:140 }, { k:"util", i:"⚡", n:"Power Grid", p:150 },
  { k:"city", g:"pink", c:"TH", n:"Chiang Mai", p:140 }, { k:"city", g:"pink", c:"TH", n:"Bangkok", p:160 },
  { k:"rail", i:"🚆", n:"Orient Exp.", p:200 }, { k:"city", g:"orange", c:"ES", n:"Seville", p:180 },
  { k:"chest" }, { k:"city", g:"orange", c:"ES", n:"Madrid", p:180 },
  { k:"city", g:"orange", c:"ES", n:"Barcelona", p:200 }, { k:"parking" },
  { k:"city", g:"red", c:"TR", n:"Antalya", p:220 }, { k:"chance" },
  { k:"city", g:"red", c:"TR", n:"Izmir", p:220 }, { k:"city", g:"red", c:"TR", n:"Istanbul", p:240 },
  { k:"rail", i:"🚈", n:"Eurostar", p:200 }, { k:"city", g:"yellow", c:"DE", n:"Cologne", p:260 },
  { k:"city", g:"yellow", c:"DE", n:"Munich", p:260 }, { k:"util", i:"💧", n:"Water Works", p:150 },
  { k:"city", g:"yellow", c:"DE", n:"Berlin", p:280 }, { k:"gotojail" },
  { k:"city", g:"green", c:"BR", n:"Salvador", p:300 }, { k:"city", g:"green", c:"BR", n:"Rio", p:300 },
  { k:"chest" }, { k:"city", g:"green", c:"BR", n:"São Paulo", p:320 },
  { k:"rail", i:"🚄", n:"Shinkansen", p:200 }, { k:"chance" },
  { k:"city", g:"darkblue", c:"US", n:"Miami", p:350 }, { k:"tax", i:"💎", n:"Luxury Tax", p:100 },
  { k:"city", g:"darkblue", c:"US", n:"New York", p:400 },
];
const PLAYERS = { sasha:{ name:"Sasha", color:"#ff6b81" }, juno:{ name:"Juno", color:"#ffc53d" },
                  marek:{ name:"Marek", color:"#5fd99a" }, lina:{ name:"Lina", color:"#b9a4ff" } };
const OWN = { 1:"marek", 3:"marek", 6:"juno", 8:"juno", 9:"juno", 12:"sasha", 15:"juno",
              16:"sasha", 18:"sasha", 19:"sasha", 21:"lina", 25:"marek", 37:"lina" };
const HOUSES = { 6:2, 8:2, 9:1, 16:4, 18:4, 19:5 };
const MORTGAGED = { 37:true };
const ACTIVE = 24;
const PAWNS = opts.pawns || [["sasha", 24], ["juno", 5], ["marek", 5], ["lina", "jail"]];

// ───────── geometry ─────────
const C = 1.6, S = 1.0, W = 2 * C + 9 * S, H = W / 2, GAP = 0.07;
const BOARD_TOP = 0, TILE_T = 0.12;
function place(i) {
  if (i === 0)  return { x: H - C / 2, z: H - C / 2, w: C, d: C, side: "corner" };
  if (i === 10) return { x: -H + C / 2, z: H - C / 2, w: C, d: C, side: "corner" };
  if (i === 20) return { x: -H + C / 2, z: -H + C / 2, w: C, d: C, side: "corner" };
  if (i === 30) return { x: H - C / 2, z: -H + C / 2, w: C, d: C, side: "corner" };
  if (i < 10) return { x: H - C - (i - 0.5) * S, z: H - C / 2, w: S, d: C, side: "bottom" };
  if (i < 20) return { x: -H + C / 2, z: H - C - (i - 10.5) * S, w: C, d: S, side: "left" };
  if (i < 30) return { x: -H + C + (i - 20.5) * S, z: -H + C / 2, w: S, d: C, side: "top" };
  return { x: H - C / 2, z: -H + C + (i - 30.5) * S, w: C, d: S, side: "right" };
}

// ───────── board slab ─────────
const slab = mesh(new RoundedBoxGeometry(W + 0.7, 0.42, W + 0.7, 6, 0.2), std("#2a2440", { roughness: 0.5 }));
slab.position.y = -0.36; scene.add(slab);
const stripe = mesh(new RoundedBoxGeometry(W + 0.76, 0.09, W + 0.76, 6, 0.2), std("#ff6b81", { roughness: 0.4 }));
stripe.position.y = -0.24; scene.add(stripe);
const top = mesh(new RoundedBoxGeometry(W + 0.5, 0.16, W + 0.5, 6, 0.1), std("#fff6e4", { roughness: 0.8 }));
top.position.y = -0.08; scene.add(top);

// center artwork
const CEN = W - 2 * C - 0.1;
const cenTex = canvasTex(2048, 2048, (ctx, w, h) => {
  rr(ctx, 12, 12, w - 24, h - 24, 90, "#fff3dc", null);
  ctx.fillStyle = "rgba(31,27,46,.09)";
  for (let y = 60; y < h - 40; y += 56) for (let x = 60; x < w - 40; x += 56) { ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
  ctx.setLineDash([34, 26]); rr(ctx, 40, 40, w - 80, h - 80, 70, null, "rgba(31,27,46,.22)", 8); ctx.setLineDash([]);
  // soft spotlight behind logo
  const g = ctx.createRadialGradient(w / 2, 720, 40, w / 2, 720, 780);
  g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.font = '900 300px \"Segoe UI Black\", \"Segoe UI\"'; ctx.letterSpacing = "-14px";
  const line = (txt, y, dx) => {
    ctx.lineWidth = 34; ctx.strokeStyle = INK; ctx.lineJoin = "round";
    ctx.fillStyle = INK; ctx.fillText(txt, w / 2 + dx, y + 22);           // hard drop shadow
    ctx.fillStyle = "#fff"; ctx.strokeText(txt, w / 2 + dx, y); ctx.fillText(txt, w / 2 + dx, y);
  };
  line("Dice", 640, -120); line("Deeds", 930, 0);
  ctx.font = '900 300px \"Segoe UI Black\", \"Segoe UI\"';
  ctx.lineWidth = 34; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.fillText("&", w / 2 + 400, 662);
  ctx.fillStyle = "#ff6b81"; ctx.strokeText("&", w / 2 + 400, 640); ctx.fillText("&", w / 2 + 400, 640);
  ctx.letterSpacing = "18px"; ctx.font = '900 58px \"Segoe UI Black\", \"Segoe UI\"'; ctx.fillStyle = "#a89fb5";
  ctx.fillText("GO AROUND THE WORLD", w / 2 + 9, 1070);
});
const cen = mesh(new THREE.PlaneGeometry(CEN, CEN), std("#ffffff", { map: cenTex, roughness: 0.9, transparent: true, alphaTest: 0.4 }), { cast: false });
cen.rotation.x = -Math.PI / 2; cen.position.y = 0.001; scene.add(cen);

// ───────── tile textures ─────────
const PX = 256;
function tileTexture(i, P, t) {
  const cw = Math.round((P.w - GAP) * PX), ch = Math.round((P.d - GAP) * PX);
  return canvasTex(cw, ch, (ctx, w, h) => {
    const owner = OWN[i] && PLAYERS[OWN[i]];
    const tint = { chance:"#fff1c4", chest:"#eee8ff", tax:"#ffe3e8", util:"#e3f8ec", go:"#dcf6e8",
                   jail:"#ffe9cf", parking:"#ece6ff", gotojail:"#ffdbe1" }[t.k] || PAPER;
    rr(ctx, 5, 5, w - 10, h - 10, 26, tint, INK, 10);
    if (MORTGAGED[i]) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 22); ctx.clip();
      ctx.strokeStyle = "rgba(31,27,46,.12)"; ctx.lineWidth = 12;
      for (let k = -h; k < w + h; k += 34) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - h, h); ctx.stroke(); }
      ctx.restore();
    }
    const side = P.side, vert = side === "left" || side === "right";
    const priceTxt = MORTGAGED[i] ? "MORTGAGED" : t.p ? `$${t.p}` : "";
    const pillBg = MORTGAGED[i] ? "#fff" : owner ? owner.color : "#fff";
    const pillCol = MORTGAGED[i] ? "#ff4f6a" : INK;
    const pillSize = MORTGAGED[i] ? 22 : 33;

    if (side === "corner") return drawCorner(ctx, w, h, t);

    // band on the center-facing edge
    const band = side === "bottom" ? [18, 18, w - 36, 58] : side === "top" ? [18, h - 76, w - 36, 58]
      : side === "left" ? [w - 76, 18, 58, h - 36] : [18, 18, 58, h - 36];
    if (t.k === "city") rr(ctx, ...band, 16, G[t.g], INK, 6);
    if (t.k === "rail") {
      rr(ctx, ...band, 16, "#c9b8ff", INK, 6);
      ctx.fillStyle = INK;
      if (!vert) { for (let x = band[0] + 16; x < band[0] + band[2] - 10; x += 22) ctx.fillRect(x, band[1] + 10, 7, band[3] - 20);
        ctx.fillRect(band[0] + 8, band[1] + 16, band[2] - 16, 5); ctx.fillRect(band[0] + 8, band[1] + band[3] - 21, band[2] - 16, 5); }
      else { for (let y = band[1] + 16; y < band[1] + band[3] - 10; y += 22) ctx.fillRect(band[0] + 10, y, band[2] - 20, 7);
        ctx.fillRect(band[0] + 16, band[1] + 8, 5, band[3] - 16); ctx.fillRect(band[0] + band[2] - 21, band[1] + 8, 5, band[3] - 16); }
    }
    const lead = (x, y, big = false) => {
      if (t.k === "city") drawFlag(ctx, t.c, x, y, 78, 52);
      else { ctx.font = `${big ? 74 : 54}px "Segoe UI Emoji"`; ctx.textAlign = "left"; ctx.textBaseline = "top";
        if (t.k === "chance") { ctx.font = `900 ${big ? 104 : 70}px "Segoe UI Black", "Segoe UI"`; ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.lineJoin = "round";
          ctx.strokeText("?", x + 10, y - 14); ctx.fillStyle = "#ff6b81"; ctx.fillText("?", x + 10, y - 14); }
        else ctx.fillText({ chest:"🎁", tax:t.i, util:t.i, rail:t.i }[t.k], x, y); }
    };
    const name = { chance:"Chance", chest:"Community Chest" }[t.k] || t.n;
    const sub = t.k === "tax" ? `PAY $${t.p}` : "";

    if (!vert) {
      const y0 = side === "bottom" ? 102 : 30;
      const plain = t.k === "chance" || t.k === "chest" || t.k === "tax";
      if (t.k === "city") lead(w / 2 - 39, y0);
      else { ctx.save(); ctx.translate(w / 2 - (t.k === "chance" ? 38 : 37), y0 - 6); lead(0, 0, true); ctx.restore(); }
      const nameTop = y0 + (t.k === "city" ? 74 : 96);
      textBlock(ctx, name, w / 2, nameTop, w - 26, 48);
      if (sub) { ctx.font = '900 25px \"Segoe UI Black\", \"Segoe UI\"'; ctx.letterSpacing = "3px"; ctx.fillStyle = "#7d7390"; ctx.textAlign = "center";
        ctx.fillText(sub, w / 2, nameTop + 104); ctx.letterSpacing = "0px"; }
      if (!plain) pill(ctx, priceTxt, w / 2, side === "bottom" ? h - 50 : h - 124, pillBg, "center", pillSize, pillCol);
    } else {
      const l = side === "left" ? 26 : 96, r = side === "left" ? w - 96 : w - 26;
      if (t.k === "city" || t.k === "rail" || t.k === "util") {
        lead(l, 26);
        pill(ctx, priceTxt, r, 52, pillBg, "right", pillSize, pillCol);
        textBlock(ctx, name, l, 98, r - l, 48, "left", 2);
      } else {
        lead(l - 4, h / 2 - 40, true);
        textBlock(ctx, name, l + 100, sub ? 44 : h / 2 - 44, r - l - 100, 42, "left", 2);
        if (sub) { ctx.font = '900 24px \"Segoe UI Black\", \"Segoe UI\"'; ctx.letterSpacing = "3px"; ctx.fillStyle = "#7d7390"; ctx.textAlign = "left";
          ctx.fillText(sub, l + 100, 186); ctx.letterSpacing = "0px"; }
      }
    }
  });
}
function drawCorner(ctx, w, h, t) {
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const title = (txt, y, size) => { ctx.font = `900 ${size}px "Segoe UI Black", "Segoe UI"`; ctx.fillStyle = INK; ctx.fillText(txt, w / 2, y); };
  const sub = (txt, y) => { ctx.font = '900 26px \"Segoe UI Black\", \"Segoe UI\"'; ctx.letterSpacing = "4px"; ctx.fillStyle = "#7d7390"; ctx.fillText(txt, w / 2, y); ctx.letterSpacing = "0px"; };
  if (t.k === "go") {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const arrow = (col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      ctx.moveTo(w - 50, 110); ctx.lineTo(110, 110); ctx.moveTo(160, 55); ctx.lineTo(100, 110); ctx.lineTo(160, 165); ctx.stroke(); };
    arrow(INK, 50); arrow("#ff6b81", 28);
    ctx.font = '900 150px \"Segoe UI Black\", \"Segoe UI\"'; ctx.fillStyle = INK; ctx.fillText("GO", w / 2 + 6, 318);
    ctx.fillStyle = "#fff"; ctx.lineWidth = 10; ctx.strokeStyle = INK;
    sub("COLLECT $200", 372);
  } else if (t.k === "jail") {
    // cell lives toward the board center (top-right of this corner)
    rr(ctx, w - 250, 22, 228, 228, 22, "#ffab5e", INK, 7);
    ctx.fillStyle = "rgba(31,27,46,.18)"; ctx.fillRect(w - 244, 190, 216, 50);
    ctx.font = '900 30px \"Segoe UI Black\", \"Segoe UI\"'; ctx.letterSpacing = "4px"; ctx.fillStyle = INK; ctx.fillText("IN JAIL", w - 134, 228); ctx.letterSpacing = "0px";
    ctx.font = '64px "Segoe UI Emoji"'; ctx.textAlign = "left"; ctx.fillText("🔒", 30, 110);
    ctx.textAlign = "center"; sub("JUST VISITING", h - 34);
  } else if (t.k === "parking") {
    ctx.font = '150px "Segoe UI Emoji"'; ctx.fillText("🚗", w / 2, 210);
    title("FREE", 300, 62); title("PARKING", 364, 62);
  } else {
    ctx.font = '150px "Segoe UI Emoji"'; ctx.fillText("👮", w / 2, 210);
    title("GO TO", 300, 62); title("JAIL", 364, 62);
  }
}

// ───────── tiles ─────────
const TILE_Y = BOARD_TOP + TILE_T / 2;
for (let i = 0; i < 40; i++) {
  const P = place(i), t = T[i];
  const lift = i === ACTIVE ? 0.08 : 0;
  const body = mesh(new RoundedBoxGeometry(P.w - GAP, TILE_T, P.d - GAP, 3, 0.045), std("#e9dcc3", { roughness: 0.7 }));
  body.position.set(P.x, TILE_Y + lift, P.z); scene.add(body);
  const face = mesh(new THREE.PlaneGeometry(P.w - GAP, P.d - GAP),
    std("#ffffff", { map: tileTexture(i, P, t), transparent: true, alphaTest: 0.4, roughness: 0.85 }), { cast: false });
  face.rotation.x = -Math.PI / 2; face.position.set(P.x, BOARD_TOP + TILE_T + 0.003 + lift, P.z); scene.add(face);
  if (i === ACTIVE) {
    const glowTex = canvasTex(256, 384, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 190);
      g.addColorStop(0, "rgba(255,197,61,1)"); g.addColorStop(.55, "rgba(255,197,61,.85)"); g.addColorStop(1, "rgba(255,197,61,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(P.w + 0.7, P.d + 0.9),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(P.x, 0.004, P.z); scene.add(glow);
  }
}

// 3D jail bars around the cell
{
  const P = place(10), cell = 228 / PX, x0 = P.x + (P.w - GAP) / 2 - (22 + 228) / PX, z0 = P.z - (P.d - GAP) / 2 + 22 / PX;
  const barMat = std(INK, { roughness: 0.35, metalness: 0.2 }), bh = 0.46, y = BOARD_TOP + TILE_T + bh / 2;
  const barGeo = new THREE.CylinderGeometry(0.018, 0.018, bh, 10);
  for (let k = 0; k <= 7; k++) {
    const f = k / 7;
    for (const [bx, bz] of [[x0 + f * cell, z0 + cell], [x0, z0 + f * cell]]) {
      const b = mesh(barGeo, barMat); b.position.set(bx, y, bz); scene.add(b);
    }
  }
  const railGeoX = new THREE.BoxGeometry(cell, 0.05, 0.05), railGeoZ = new THREE.BoxGeometry(0.05, 0.05, cell);
  const r1 = mesh(railGeoX, barMat); r1.position.set(x0 + cell / 2, BOARD_TOP + TILE_T + bh, z0 + cell); scene.add(r1);
  const r2 = mesh(railGeoZ, barMat); r2.position.set(x0, BOARD_TOP + TILE_T + bh, z0 + cell / 2); scene.add(r2);
}

// ───────── houses & hotels ─────────
const roofShape = new THREE.Shape(); roofShape.moveTo(-0.13, 0); roofShape.lineTo(0.13, 0); roofShape.lineTo(0, 0.12); roofShape.closePath();
const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.2, bevelEnabled: false }); roofGeo.translate(0, 0, -0.1);
const houseGeo = new RoundedBoxGeometry(0.2, 0.16, 0.2, 2, 0.02);
const houseMat = std("#3fbf7f", { roughness: 0.4 }), roofMat = std("#2e9c64", { roughness: 0.4 });
const hotelGeo = new RoundedBoxGeometry(0.46, 0.26, 0.26, 2, 0.03), hotelMat = std("#ff6b81", { roughness: 0.35 });
const hotelRoofMat = std("#d9435b", { roughness: 0.4 });
for (const [idx, n] of Object.entries(HOUSES)) {
  const P = place(+idx), y = BOARD_TOP + TILE_T;
  const inset = 47 / PX + 0.035;
  const bc = P.side === "bottom" ? [P.x, P.z - P.d / 2 + inset] : P.side === "top" ? [P.x, P.z + P.d / 2 - inset]
    : P.side === "left" ? [P.x + P.w / 2 - inset, P.z] : [P.x - P.w / 2 + inset, P.z];
  const horiz = P.side === "bottom" || P.side === "top";
  if (n === 5) {
    const g = new THREE.Group();
    const b = mesh(hotelGeo, hotelMat); b.position.y = 0.13; g.add(b);
    const r = mesh(roofGeo, hotelRoofMat); r.scale.set(1.9, 1.1, 1.3); r.position.y = 0.26; g.add(r);
    g.position.set(bc[0], y, bc[1]); if (!horiz) g.rotation.y = Math.PI / 2; scene.add(g);
    continue;
  }
  const step = 0.215, start = -(n - 1) * step / 2;
  for (let k = 0; k < n; k++) {
    const g = new THREE.Group();
    const b = mesh(houseGeo, houseMat); b.position.y = 0.08; g.add(b);
    const r = mesh(roofGeo, roofMat); r.position.y = 0.16; g.add(r);
    const off = start + k * step;
    g.position.set(bc[0] + (horiz ? off : 0), y, bc[1] + (horiz ? 0 : off));
    if (!horiz) g.rotation.y = Math.PI / 2;
    scene.add(g);
  }
}

// ───────── pawns ─────────
const pawnProfile = [[0,0],[0.23,0],[0.245,0.03],[0.235,0.075],[0.17,0.1],[0.13,0.14],[0.1,0.26],[0.085,0.34],
  [0.14,0.36],[0.145,0.395],[0.09,0.415],[0.07,0.44],[0,0.44]].map(([r, y]) => new THREE.Vector2(r, y));
const pawnGeo = new THREE.LatheGeometry(pawnProfile, 40);
const headGeo = new THREE.SphereGeometry(0.125, 32, 20);
const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
function pawn(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 });
  const body = mesh(pawnGeo, mat); g.add(body);
  const head = mesh(headGeo, mat); head.position.y = 0.54; g.add(head);
  const ob = new THREE.Mesh(pawnGeo, outlineMat); ob.scale.set(1.09, 1.03, 1.09); ob.position.y = -0.006; g.add(ob);
  const oh = new THREE.Mesh(headGeo, outlineMat); oh.scale.setScalar(1.12); oh.position.y = 0.54; g.add(oh);
  g.scale.setScalar(1.05);
  return g;
}
const byTile = {};
PAWNS.forEach(([id, where]) => (byTile[where] = byTile[where] || []).push(id));
const OFFS = { 1: [[0, 0]], 2: [[-0.2, 0.05], [0.2, -0.05]], 3: [[-0.2, -0.15], [0.2, -0.15], [0, 0.2]], 4: [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] };
for (const [where, ids] of Object.entries(byTile)) {
  let cx, cz, lift = 0;
  if (where === "jail") { const P = place(10); cx = P.x + (P.w - GAP) / 2 - (22 + 114) / PX; cz = P.z - (P.d - GAP) / 2 + (22 + 104) / PX; }
  else {
    const P = place(+where); cx = P.x; cz = P.z;
    if (P.side === "bottom") cz += 0.18; if (P.side === "top") cz -= 0.05;
    if (+where === ACTIVE) lift = 0.08;
  }
  ids.forEach((id, k) => {
    const [ox, oz] = OFFS[ids.length][k];
    const p = pawn(PLAYERS[id].color);
    p.position.set(cx + ox, BOARD_TOP + TILE_T + lift, cz + oz);
    scene.add(p);
    if (+where === ACTIVE) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 12, 48),
        new THREE.MeshStandardMaterial({ color: "#ffc53d", emissive: "#ffb300", emissiveIntensity: 0.9 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(p.position.x, p.position.y + 0.02, p.position.z); scene.add(ring);
      const plateTex = canvasTex(620, 150, (ctx, w, h) => {
        rr(ctx, 8, 8, w - 16, h - 34, 58, INK, null);
        rr(ctx, 8, 0, w - 16, h - 40, 58, "#fff", INK, 8);
        ctx.font = '900 56px \"Segoe UI Black\", \"Segoe UI\"'; ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText("Sasha", 54, 56);
        rr(ctx, 250, 22, 322, 68, 34, "#ffc53d", INK, 7);
        ctx.font = '900 32px "Segoe UI Black"'; ctx.letterSpacing = "4px"; ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.fillText("YOUR TURN", 413, 58);
      });
      const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: plateTex, depthTest: false, toneMapped: false }));
      plate.scale.set(1.65, 0.4, 1); plate.position.set(p.position.x, p.position.y + 1.08, p.position.z); plate.renderOrder = 10;
      scene.add(plate);
    }
  });
}

// ───────── dice ─────────
const PIPS = { 1:[[0,0]], 2:[[-1,-1],[1,1]], 3:[[-1,-1],[0,0],[1,1]], 4:[[-1,-1],[-1,1],[1,-1],[1,1]],
               5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]], 6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]] };
function die(color, pipColor, faces, pos, rotY) {
  const s = 0.62, g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(s, s, s, 5, 0.11), new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 0.8 })));
  const pipGeo = new THREE.CircleGeometry(0.052, 24), pipMat = new THREE.MeshStandardMaterial({ color: pipColor, roughness: 0.5 });
  // faces: [+y, +z, +x, -z, -x, -y]
  const dirs = [[0,1,0],[0,0,1],[1,0,0],[0,0,-1],[-1,0,0],[0,-1,0]];
  dirs.forEach((d, fi) => {
    const n = new THREE.Vector3(...d);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    PIPS[faces[fi]].forEach(([a, b]) => {
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set(a * 0.16, b * 0.16, s / 2 + 0.002).applyQuaternion(q);
      pip.quaternion.copy(q); g.add(pip);
    });
  });
  g.position.set(pos[0], s / 2 + 0.002, pos[1]); g.rotation.y = rotY;
  scene.add(g);
  return g;
}
if (opts.props !== false) die("#ff6b81", "#ffffff", [4, 2, 6, 5, 1, 3], [-0.55, 1.35], 0.5);
if (opts.props !== false) die("#fffaf0", INK, [3, 5, 1, 2, 6, 4], [0.45, 1.2], -0.3);

// ───────── card decks ─────────
function deck(x, z, rot, bg, label, glyph) {
  const g = new THREE.Group(), w = 2.0, d = 1.3;
  for (let k = 0; k < 5; k++) {
    const c = mesh(new RoundedBoxGeometry(w, 0.045, d, 2, 0.02), std(k % 2 ? "#fffaf0" : "#efe4cf", { roughness: 0.8 }));
    c.position.set((k % 2) * 0.015, 0.025 + k * 0.047, (k % 3) * 0.01); c.rotation.y = (k - 2) * 0.012; g.add(c);
  }
  const tex = canvasTex(620, 404, (ctx, W2, H2) => {
    rr(ctx, 6, 6, W2 - 12, H2 - 12, 40, bg, INK, 10);
    rr(ctx, 30, 30, W2 - 60, H2 - 60, 26, null, "rgba(31,27,46,.25)", 5);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (glyph === "?") { ctx.font = '900 180px \"Segoe UI Black\", \"Segoe UI\"'; ctx.lineWidth = 18; ctx.strokeStyle = INK; ctx.lineJoin = "round";
      ctx.strokeText("?", W2 / 2, 250); ctx.fillStyle = "#fff"; ctx.fillText("?", W2 / 2, 250); }
    else { ctx.font = '150px "Segoe UI Emoji"'; ctx.fillText(glyph, W2 / 2, 240); }
    ctx.font = '900 50px \"Segoe UI Black\", \"Segoe UI\"'; ctx.letterSpacing = "8px"; ctx.fillStyle = INK; ctx.fillText(label, W2 / 2 + 4, 340);
  });
  const topCard = mesh(new THREE.PlaneGeometry(w, d), std("#fff", { map: tex, transparent: true, alphaTest: 0.4, roughness: 0.7 }), { cast: false });
  topCard.rotation.x = -Math.PI / 2; topCard.position.set(0.015 * 0, 0.025 + 4 * 0.047 + 0.024, 0); topCard.rotation.z = (2) * 0.012;
  g.add(topCard);
  g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
}
if (opts.props !== false) deck(-2.55, 1.55, 0.3, "#ffd23e", "CHANCE", "?");
if (opts.props !== false) deck(2.55, 1.55, -0.3, "#c9b8ff", "COMMUNITY", "🎁");

return { pawn, die, deck, place, W, std, mesh, canvasTex, rr };
} };
