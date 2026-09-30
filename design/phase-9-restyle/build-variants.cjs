// Phase 9 restyle — variants V1 (Linear dark), V2 (shadcn light), V3 (dev-tool mono).
// Each variant = game screen + home screen, rendered with real three.js at 1600×1000.
// Run: node build-variants.cjs, then render with headless Edge (swiftshader).
const fs = require("fs");
const path = require("path");

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

// ── shared tile / centre painters (run in the page; tokens differ per theme) ────
const PAINTERS = String.raw`
const FLAG = {
  IT: [["v", "#009246", "#f4f4f5", "#ce2b37"]], JP: [["jp"]], TH: [["h5", "#a51931", "#f4f5f8", "#2d2a4a", "#f4f5f8", "#a51931"]],
  ES: [["h3", "#aa151b", "#f1bf00", "#aa151b"]], TR: [["tr"]], DE: [["h3", "#111", "#dd0000", "#ffce00"]], BR: [["br"]], US: [["us"]],
};
function flag(ctx, code, x, y, w, h, K) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.clip();
  const [spec] = FLAG[code]; const kind = spec[0];
  if (kind === "v") spec.slice(1).forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + (i * w) / 3, y, w / 3 + 1, h); });
  else if (kind === "h3") { const hs = [0.25, 0.5, 0.25]; let yy = y; spec.slice(1).forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, yy, w, h * hs[i] + 1); yy += h * hs[i]; }); }
  else if (kind === "h5") { const hs = [1, 1, 2, 1, 1]; let yy = y; spec.slice(1).forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, yy, w, (h * hs[i]) / 6 + 1); yy += (h * hs[i]) / 6; }); }
  else if (kind === "jp") { ctx.fillStyle = "#f4f4f5"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#bc002d"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.28, 0, 7); ctx.fill(); }
  else if (kind === "tr") { ctx.fillStyle = "#e30a17"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + w * 0.4, y + h / 2, h * 0.25, 0, 7); ctx.fill(); ctx.fillStyle = "#e30a17"; ctx.beginPath(); ctx.arc(x + w * 0.45, y + h / 2, h * 0.2, 0, 7); ctx.fill(); }
  else if (kind === "br") { ctx.fillStyle = "#009c3b"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#ffdf00"; ctx.beginPath(); ctx.moveTo(x + w / 2, y + h * 0.12); ctx.lineTo(x + w * 0.9, y + h / 2); ctx.lineTo(x + w / 2, y + h * 0.88); ctx.lineTo(x + w * 0.1, y + h / 2); ctx.fill(); ctx.fillStyle = "#002776"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.2, 0, 7); ctx.fill(); }
  else if (kind === "us") { for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? "#f4f4f5" : "#b22234"; ctx.fillRect(x, y + (i * h) / 7, w, h / 7 + 1); } ctx.fillStyle = "#3c3b6e"; ctx.fillRect(x, y, w * 0.45, h * 0.55); }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = K.line; ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.stroke();
}
function wrap(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW || !text.includes(" ")) return [text];
  const words = text.split(" "); const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}
function makeTile(K) {
  return function (ctx, w, h, info, { rr, fit }) {
    const { t, P, owner, mortgaged, active, country } = info;
    rr(ctx, 3, 3, w - 6, h - 6, K.radius, K.bg, active ? K.accent : K.line, active ? 7 : 3);
    const side = P.side, vert = side === "left" || side === "right";
    const text = (s, x, y, size, weight, color, font, align = "left", ls = 0) => {
      ctx.font = weight + " " + size + "px " + font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
      ctx.letterSpacing = ls + "px"; ctx.fillText(s, x, y); ctx.letterSpacing = "0px";
    };
    if (side === "corner") {
      const big = { go: "GO", jail: "JAIL", parking: "FREE", gotojail: "GO TO" }[t.k];
      const second = { go: "", jail: "", parking: "PARKING", gotojail: "JAIL" }[t.k];
      const sub = { go: "collect $200  ←", jail: "just visiting", parking: "take a breath", gotojail: "do not pass go" }[t.k];
      text(big, w / 2, second ? h * 0.42 : h * 0.56, second ? 64 : 120, 700, K.text, K.font, "center", K.tight);
      if (second) text(second, w / 2, h * 0.6, 64, 700, K.text, K.font, "center", K.tight);
      text(sub.toUpperCase(), w / 2, h * 0.82, 22, 500, K.muted, K.mono, "center", 3);
      if (t.k === "go") { ctx.fillStyle = K.accent; ctx.fillRect(w * 0.25, h * 0.68, w * 0.5, 5); }
      return;
    }
    // owner accent on the outer edge
    if (owner) {
      ctx.fillStyle = owner;
      if (side === "bottom") rr(ctx, 16, h - 22, w - 32, 9, 5, owner);
      if (side === "top") rr(ctx, 16, 13, w - 32, 9, 5, owner);
      if (side === "left") rr(ctx, 13, 16, 9, h - 32, 5, owner);
      if (side === "right") rr(ctx, w - 22, 16, 9, h - 32, 5, owner);
    }
    if (mortgaged) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(6, 6, w - 12, h - 12, K.radius); ctx.clip();
      ctx.strokeStyle = K.hatch; ctx.lineWidth = 6;
      for (let k = -h; k < w + h; k += 26) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - h, h); ctx.stroke(); }
      ctx.restore();
    }
    const label = { city: (country || "").toUpperCase(), rail: "RAILWAY", util: "UTILITY", tax: "TAX", chance: "CHANCE", chest: "COMMUNITY" }[t.k];
    const name = { chance: "Chance", chest: "Chest" }[t.k] ?? t.n;
    const priceTxt = mortgaged ? "MORTGAGED" : t.k === "tax" ? "−$" + t.p : t.p ? "$" + t.p : "";
    const priceColor = mortgaged ? K.danger : owner ?? K.muted;
    const pad = vert ? (side === "left" ? 40 : 34) : 26;
    const x0 = vert && side === "right" ? 40 : pad;
    const topPad = side === "top" ? 40 : 30;
    // label + flag
    text(label, x0, topPad + 20, 21, 500, K.muted, K.mono, "left", 3);
    if (t.c) flag(ctx, t.c, (vert ? w - 90 : w - 70) - (side === "right" ? 0 : 0), topPad - 2, 44, 29, K);
    // glyph for specials
    if (t.k === "chance" || t.k === "chest") {
      text(t.k === "chance" ? "?" : "◆", vert ? w - 80 : w / 2, vert ? h * 0.72 : h * 0.62, vert ? 110 : 150, 600, K.accent, K.font, "center");
    }
    // name
    ctx.font = "700 44px " + K.font; ctx.letterSpacing = K.tight + "px";
    const maxW = (vert ? w * 0.62 : w) - pad * 2;
    let size = 44; while (ctx.measureText(name).width > maxW * 1.9 && size > 26) { size -= 2; ctx.font = "700 " + size + "px " + K.font; }
    const lines = wrap(ctx, name, maxW);
    if (lines.some((l) => ctx.measureText(l).width > maxW)) { size = Math.max(26, size - 8); ctx.font = "700 " + size + "px " + K.font; }
    ctx.letterSpacing = "0px";
    const nameY = vert ? topPad + 20 + 60 : (t.k === "chance" || t.k === "chest" ? topPad + 90 : topPad + 20 + 72);
    lines.forEach((l, i) => text(l, x0, nameY + i * size * 1.08, size, 700, K.text, K.font, "left", K.tight));
    // price
    if (priceTxt) text(priceTxt, x0, (side === "bottom" ? h - 44 : side === "top" ? h - 30 : h - 34), mortgaged ? 22 : 30, 500, priceColor, K.mono, "left", mortgaged ? 2 : 0);
  };
}
`;

// ── page shell ─────────────────────────────────────────────────────────────────
function page({ title, css, body, theme, lights, camera, shift = 0, groundOpacity = 0.3 }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>${FONTS}
<style>
 * { margin: 0; box-sizing: border-box; }
 html, body { width: 1600px; height: 1000px; overflow: hidden; }
 canvas { position: absolute; inset: 0; }
 .ui { position: absolute; inset: 0; z-index: 2; }
 ${css}
</style>
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
<script src="board-scene.js"></script>
</head><body>
<div class="ui">${body}</div>
<script type="module">
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
${PAINTERS}
await Promise.all(["700 44px Inter", "600 44px Inter", "700 64px Inter", "500 22px 'JetBrains Mono'", "700 64px 'JetBrains Mono'"].map((f) => document.fonts.load(f)));
const theme = ${theme};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(1600, 1000);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.insertBefore(renderer.domElement, document.body.firstChild);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
${lights}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: "#000", opacity: ${groundOpacity} }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; ground.receiveShadow = true; scene.add(ground);
RS.build({ THREE, RoundedBoxGeometry, renderer, scene, theme });
const cam = new THREE.PerspectiveCamera(${camera.fov}, 1.6, 0.1, 100);
cam.position.set(${camera.pos}); cam.lookAt(${camera.look});
${shift ? `cam.setViewOffset(1600, 1000, ${shift}, 0, 1600, 1000);` : ""}
renderer.render(scene, cam);
</script></body></html>`;
}

const keyLight = (color, intensity, pos) => `const key = new THREE.DirectionalLight("${color}", ${intensity}); key.position.set(${pos}); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);`;

// ── V1 · Linear dark ──────────────────────────────────────────────────────────
const V1 = {
  theme: `{
    slab: "#0c0d0f", slabRough: 0.35, slabMetal: 0.3, tileSide: "#1b1c20", tileRough: 0.8, bars: "#9aa0ab",
    edgeGlow: "#5e6ad2", activeGlow: "rgba(94,106,210,0.9)", ring: "#8b93ff", pipGlow: false,
    dieA: ["#f4f4f5", "#0c0d0f"], dieB: ["#1f2024", "#e8e8ea"],
    tile: makeTile({ bg: "#141518", line: "#26282d", text: "#e6e7ea", muted: "#6f747f", accent: "#8b93ff", danger: "#eb5757", hatch: "rgba(255,255,255,0.05)", font: "Inter", mono: "'JetBrains Mono'", radius: 18, tight: -1 }),
    center: (ctx, w, h) => {
      ctx.fillStyle = "#0e0f11"; ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 40); ctx.fill();
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.42, 900); g.addColorStop(0, "rgba(94,106,210,0.28)"); g.addColorStop(1, "rgba(94,106,210,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 2;
      for (let x = 128; x < w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, h - 16); ctx.stroke(); }
      for (let y = 128; y < h; y += 128) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w - 16, y); ctx.stroke(); }
      ctx.textAlign = "center"; ctx.fillStyle = "#e6e7ea"; ctx.font = "600 150px Inter"; ctx.letterSpacing = "-6px"; ctx.fillText("Dice & Deeds", w / 2, h * 0.47); ctx.letterSpacing = "12px";
      ctx.font = "500 34px 'JetBrains Mono'"; ctx.fillStyle = "#6f747f"; ctx.fillText("GO AROUND THE WORLD", w / 2, h * 0.47 + 90); ctx.letterSpacing = "0px";
    },
    building: (THREE, c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.2, emissive: c, emissiveIntensity: 0.18 }),
    pawn: (THREE, c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }),
  }`,
  lights: `scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight("#9aa2ff", "#050507", 0.55));
${keyLight("#ffffff", 2.1, "-6, 14, 8")}
const rim = new THREE.DirectionalLight("#5e6ad2", 1.4); rim.position.set(9, 4, -9); scene.add(rim);`,
  css: `
 body { background: radial-gradient(900px 600px at 42% 38%, rgba(94,106,210,0.16), transparent 70%), radial-gradient(700px 500px at 90% 0%, rgba(94,106,210,0.08), transparent 70%), #08090a; color: #e6e7ea; font: 400 13px/1.45 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
 .mono { font-family: 'JetBrains Mono', monospace; }
 .muted { color: #8a8f98; } .dim { color: #62666d; }
 .panel { position: absolute; background: rgba(15,16,17,0.86); border: 1px solid #23252a; border-radius: 12px; box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px rgba(0,0,0,0.5); backdrop-filter: blur(12px); }
 .crumbs { position: absolute; left: 24px; top: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px; }
 .logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#8b93ff,#5e6ad2); box-shadow: 0 0 0 1px rgba(255,255,255,0.15) inset; }
 .chip { border: 1px solid #2a2c31; border-radius: 6px; padding: 1px 7px; background: #141518; font-size: 12px; }
 .row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; }
 .row.on { background: #1a1b1f; box-shadow: inset 2px 0 0 #8b93ff; }
 .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
 .pill { font-size: 11px; color: #a4a8b0; border: 1px solid #2a2c31; border-radius: 999px; padding: 0 7px; }
 .tabs { display: flex; gap: 18px; border-bottom: 1px solid #23252a; padding: 0 14px; font-size: 13px; color: #8a8f98; }
 .tabs b { font-weight: 500; padding: 10px 0; } .tabs b.on { color: #e6e7ea; box-shadow: inset 0 -2px 0 #8b93ff; }
 .ev { display: flex; gap: 10px; align-items: flex-start; padding: 7px 14px; font-size: 13px; color: #b4b8bf; }
 .ev i { width: 18px; height: 18px; border-radius: 5px; border: 1px solid #2a2c31; background: #141518; flex: none; margin-top: 1px; display: grid; place-items: center; font-style: normal; font-size: 10px; color: #8a8f98; }
 .ev b { color: #e6e7ea; font-weight: 500; }
 .amt { margin-left: auto; font: 500 12px 'JetBrains Mono', monospace; }
 .grp { padding: 12px 14px 4px; font-size: 11px; color: #62666d; letter-spacing: .04em; text-transform: uppercase; }
 .btn { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 8px; font-weight: 500; font-size: 13px; border: 1px solid #2a2c31; background: #17181b; color: #e6e7ea; }
 .btn.primary { background: #5e6ad2; border-color: #6c78e6; box-shadow: 0 0 0 1px rgba(255,255,255,0.08) inset, 0 6px 20px rgba(94,106,210,0.35); }
 .btn.ghost { background: transparent; color: #8a8f98; }
 kbd { font: 500 11px 'JetBrains Mono', monospace; color: #8a8f98; border: 1px solid #33353b; border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; background: #111214; }
 .primary kbd { color: #dfe2ff; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.08); }
 .die { width: 26px; height: 26px; border-radius: 6px; background: #f4f4f5; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 4px; }
 .die i { width: 4px; height: 4px; border-radius: 50%; background: #0c0d0f; place-self: center; }
 .kv { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #23252a; font-size: 12.5px; color: #8a8f98; }
 .kv b { font: 500 12.5px 'JetBrains Mono', monospace; color: #e6e7ea; }
`,
};
const dice = (cls = "die") => `<div style="display:flex;gap:6px"><div class="${cls}"><i style="grid-area:1/1"></i><i style="grid-area:1/3"></i><i style="grid-area:3/1"></i><i style="grid-area:3/3"></i></div><div class="${cls}"><i style="grid-area:1/1"></i><i style="grid-area:2/2"></i><i style="grid-area:3/3"></i></div></div>`;
const PLAYERS = [["Sasha", "#e5484d", "$1,240", "4 cities · hotel", true, ""], ["Juno", "#f5a623", "$860", "4 cities · 5 houses", false, ""], ["Dice Bot", "#f7cf3c", "$1,020", "2 cities", false, "Bot · In jail"], ["Marek", "#46a758", "$430", "4 cities", false, ""]];

const v1Game = page({
  title: "V1 — Linear dark · game", css: V1.css, theme: V1.theme, lights: V1.lights, shift: 175, groundOpacity: 0.5,
  camera: { fov: 27, pos: "2.8, 25.2, 20.9", look: "0.1, -0.9, 0.3" },
  body: `
<div class="crumbs"><div class="logo"></div><b style="font-weight:600">Dice &amp; Deeds</b><span class="dim">/</span><span class="muted">Rooms</span><span class="dim">/</span><span class="chip mono">7GH6J9</span><span class="dim">/</span><span class="muted">Turn 15</span></div>
<div class="panel" style="left:24px;top:64px;width:300px;padding:14px">
  <div style="display:flex;align-items:center;gap:8px"><span class="mono dim" style="font-size:11px;letter-spacing:.08em">FOR SALE · TURKEY</span><span class="pill" style="margin-left:auto;color:#4cb782;border-color:#1f3a2c">Good buy</span></div>
  <div style="font:600 22px Inter;letter-spacing:-.02em;margin:6px 0 8px">Istanbul</div>
  <div class="kv"><span>Rent</span><b>$20</b></div><div class="kv"><span>With set</span><b>$40</b></div><div class="kv"><span>1 · 2 · 3 houses</span><b>$100 · $300 · $750</b></div><div class="kv"><span>4 houses · hotel</span><b>$925 · $1,100</b></div><div class="kv" style="border:0"><span>House cost</span><b>$150</b></div>
  <div style="margin-top:10px;padding:10px;border:1px solid #23252a;border-radius:8px;background:#0f1012;font-size:12.5px;color:#a4a8b0"><span style="color:#8b93ff">◆ Guide</span> — starts your Turkey set and you keep $1,000.</div>
</div>
<div class="panel" style="right:24px;top:16px;bottom:16px;width:360px;display:flex;flex-direction:column">
  <div style="padding:14px 14px 6px;display:flex;align-items:center"><b style="font-weight:600">Players</b><span class="dim" style="margin-left:6px">4</span><span class="chip mono" style="margin-left:auto">$1,500 · GO $200</span></div>
  <div style="padding:0 8px 8px">${PLAYERS.map(([n, c, m, s, on, tag]) => `<div class="row ${on ? "on" : ""}"><span class="dot" style="background:${c};box-shadow:0 0 0 3px ${c}22"></span><div><div style="font-weight:500">${n}${on ? ' <span class="dim">· you</span>' : ""}</div><div class="dim" style="font-size:12px">${s}</div></div>${tag ? `<span class="pill">${tag}</span>` : ""}<span class="mono" style="margin-left:auto;font-weight:500">${m}</span></div>`).join("")}</div>
  <div class="tabs"><b class="on">Activity</b><b>Guide</b><b>Cities</b><b>Rules</b></div>
  <div style="flex:1;overflow:hidden">
    <div class="grp">Turn 15 · Sasha</div>
    <div class="ev"><i>⚄</i><div><b>Sasha</b> rolled 4 + 3 → <b>Istanbul</b></div></div>
    <div class="ev"><i>◇</i><div><b>Istanbul</b> is for sale</div><span class="amt muted">$240</span></div>
    <div class="grp">Turn 14 · Marek</div>
    <div class="ev"><i>⚄</i><div><b>Marek</b> rolled 2 + 2 (doubles) → <b>Madrid</b></div></div>
    <div class="ev"><i>↗</i><div><b>Marek</b> paid you rent for Madrid</div><span class="amt" style="color:#4cb782">+$180</span></div>
    <div class="grp">Turn 13 · Dice Bot</div>
    <div class="ev"><i>▣</i><div><b>Dice Bot</b> went to jail</div></div>
    <div class="grp">Turn 12 · Juno</div>
    <div class="ev"><i>→</i><div><b>Juno</b> passed GO</div><span class="amt" style="color:#4cb782">+$200</span></div>
    <div class="ev"><i>⌂</i><div><b>Juno</b> built a house on <b>Osaka</b></div><span class="amt" style="color:#eb5757">−$50</span></div>
  </div>
</div>
<div class="panel" style="left:50%;transform:translateX(calc(-50% - 175px));bottom:24px;padding:10px 10px 10px 14px;display:flex;align-items:center;gap:14px">
  ${dice()}<div><div style="font-weight:600">Your turn</div><div class="dim" style="font-size:12px">Rolled 7 · Istanbul</div></div>
  <div style="width:1px;height:28px;background:#23252a"></div>
  <span class="btn primary">Buy Istanbul · $240 <kbd>B</kbd></span><span class="btn">Decline <kbd>D</kbd></span><span class="btn ghost">End turn <kbd>E</kbd></span>
  <span class="btn ghost" style="padding:0 8px"><kbd>⌘</kbd><kbd>K</kbd></span>
</div>`,
});

const v1Home = page({
  title: "V1 — Linear dark · home", css: V1.css + `
 h1 { font: 600 76px/1 Inter; letter-spacing: -0.045em; background: linear-gradient(180deg,#f7f8f8 30%,#8a8f98); -webkit-background-clip: text; color: transparent; }
 .input { height: 40px; border: 1px solid #2a2c31; background: #0f1012; border-radius: 8px; display: flex; align-items: center; padding: 0 12px; color: #62666d; }
 .code { width: 40px; height: 44px; border: 1px solid #2a2c31; background: #0f1012; border-radius: 8px; display: grid; place-items: center; font: 500 18px 'JetBrains Mono'; color: #e6e7ea; }`,
  theme: V1.theme, lights: V1.lights, groundOpacity: 0.5,
  camera: { fov: 30, pos: "-1.4, 14.2, 19.2", look: "-5.6, -0.6, 1.4" },
  body: `
<div class="crumbs"><div class="logo"></div><b style="font-weight:600">Dice &amp; Deeds</b></div>
<div style="position:absolute;left:96px;top:190px;width:520px">
  <span class="chip" style="display:inline-flex;gap:8px;align-items:center;padding:3px 10px;border-radius:999px"><span class="dot" style="background:#4cb782;width:7px;height:7px;box-shadow:0 0 0 3px #4cb78233"></span><span class="muted">Multiplayer · 2–6 players · free</span></span>
  <h1 style="margin-top:22px">The property game,<br>rebuilt in 3D.</h1>
  <p class="muted" style="font-size:17px;margin:20px 0 34px;max-width:440px">Create a room, share a six-letter code, and play a full match in real time — no account needed.</p>
  <div class="panel" style="position:relative;padding:16px;width:460px">
    <div class="dim" style="font-size:12px;margin-bottom:6px">Nickname</div>
    <div style="display:flex;gap:8px"><div class="input" style="flex:1">Sasha</div><span class="btn primary" style="height:40px">Create room <kbd>↵</kbd></span></div>
    <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:#62666d;font-size:12px"><span style="flex:1;height:1px;background:#23252a"></span>or join with a code<span style="flex:1;height:1px;background:#23252a"></span></div>
    <div style="display:flex;gap:6px;align-items:center"><div class="code">X</div><div class="code">4</div><div class="code">K</div><div class="code" style="border-color:#5e6ad2;box-shadow:0 0 0 3px rgba(94,106,210,.25)"></div><div class="code"></div><div class="code"></div><span class="btn" style="height:44px;margin-left:auto">Join</span></div>
  </div>
  <div style="display:flex;gap:26px;margin-top:30px;font-size:13px" class="muted"><span>● Real-time rooms</span><span>● Full rules</span><span>● Bots fill seats</span></div>
</div>`,
});

// ── V2 · shadcn light ─────────────────────────────────────────────────────────
const V2 = {
  theme: `{
    slab: "#e4e4e7", slabRough: 0.5, slabMetal: 0, tileSide: "#e9e9ec", tileRough: 0.7, bars: "#27272a",
    edgeGlow: null, activeGlow: "rgba(24,24,27,0.18)", ring: "#18181b", pipGlow: false,
    dieA: ["#18181b", "#fafafa"], dieB: ["#ffffff", "#18181b"],
    tile: makeTile({ bg: "#ffffff", line: "#e4e4e7", text: "#09090b", muted: "#52525b", accent: "#18181b", danger: "#dc2626", hatch: "rgba(9,9,11,0.06)", font: "Inter", mono: "'JetBrains Mono'", radius: 16, tight: -1 }),
    center: (ctx, w, h) => {
      ctx.fillStyle = "#fafafa"; ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 40); ctx.fill();
      ctx.strokeStyle = "rgba(9,9,11,0.06)"; ctx.lineWidth = 2;
      for (let x = 128; x < w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, h - 16); ctx.stroke(); }
      for (let y = 128; y < h; y += 128) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w - 16, y); ctx.stroke(); }
      ctx.textAlign = "center"; ctx.fillStyle = "#09090b"; ctx.font = "700 150px Inter"; ctx.letterSpacing = "-7px"; ctx.fillText("Dice & Deeds", w / 2, h * 0.47); ctx.letterSpacing = "12px";
      ctx.font = "500 34px 'JetBrains Mono'"; ctx.fillStyle = "#a1a1aa"; ctx.fillText("GO AROUND THE WORLD", w / 2, h * 0.47 + 90); ctx.letterSpacing = "0px";
    },
    building: (THREE, c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }),
    pawn: (THREE, c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.4 }),
  }`,
  lights: `scene.environmentIntensity = 0.45;
scene.add(new THREE.HemisphereLight("#ffffff", "#d4d4d8", 0.75));
${keyLight("#ffffff", 1.9, "-6, 15, 7")}`,
  css: `
 body { background: #fafafa; color: #09090b; font: 400 14px/1.45 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
 .mono { font-family: 'JetBrains Mono', monospace; }
 .muted { color: #71717a; }
 .card { position: absolute; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
 .nav { position: absolute; left: 0; right: 0; top: 0; height: 60px; border-bottom: 1px solid #e4e4e7; background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; gap: 12px; padding: 0 24px; }
 .badge { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 500; }
 .badge.solid { background: #18181b; color: #fafafa; border-color: #18181b; }
 .badge.soft { background: #f4f4f5; border-color: transparent; }
 .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 8px; font-weight: 500; font-size: 14px; border: 1px solid #e4e4e7; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
 .btn.primary { background: #18181b; color: #fafafa; border-color: #18181b; }
 .btn.ghost { border-color: transparent; box-shadow: none; }
 .tabs { display: flex; background: #f4f4f5; border-radius: 8px; padding: 3px; gap: 2px; font-size: 13px; font-weight: 500; color: #71717a; }
 .tabs b { flex: 1; text-align: center; padding: 5px 0; border-radius: 6px; font-weight: 500; } .tabs b.on { background: #fff; color: #09090b; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
 .av { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #e4e4e7; }
 .sep { width: 1px; height: 24px; background: #e4e4e7; }
 .item { border: 1px solid #e4e4e7; border-radius: 10px; padding: 12px; }
 .item h4 { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
 .item p { font-size: 13px; color: #71717a; margin-top: 4px; }
 .lbl { font-size: 12px; font-weight: 500; color: #71717a; margin: 16px 0 8px; }
 .die { width: 30px; height: 30px; border-radius: 7px; background: #18181b; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 5px; }
 .die i { width: 5px; height: 5px; border-radius: 50%; background: #fafafa; place-self: center; }
 .overlay { position: absolute; inset: 0; background: rgba(9,9,11,0.28); }
 .kv { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f4f4f5; font-size: 13.5px; color: #71717a; }
 .kv b { font: 500 13.5px 'JetBrains Mono', monospace; color: #09090b; }
`,
};
const v2Game = page({
  title: "V2 — shadcn light · game", css: V2.css, theme: V2.theme, lights: V2.lights, shift: 185, groundOpacity: 0.12,
  camera: { fov: 27, pos: "2.8, 25.2, 20.9", look: "0.1, -0.9, 0.3" },
  body: `
<div class="nav">
  <b style="font-weight:700;letter-spacing:-.02em;font-size:15px">Dice &amp; Deeds</b><span class="badge mono">7GH6J9</span><div class="sep"></div>
  ${PLAYERS.map(([n, c, m, , on, tag]) => `<span class="badge ${on ? "solid" : ""}" style="padding:4px 10px"><span style="width:8px;height:8px;border-radius:50%;background:${c}"></span>${n}<span class="mono" style="opacity:.7">${m}</span>${tag ? `<span style="opacity:.6">· ${tag.split(" · ")[1] ?? tag}</span>` : ""}</span>`).join("")}
  <span style="margin-left:auto" class="badge soft">Jackpot $350</span><span class="btn ghost">Rules</span><span class="btn">Leave</span>
</div>
<div class="card" style="right:24px;top:84px;bottom:24px;width:370px;padding:14px">
  <div class="tabs"><b>History</b><b class="on">Guide</b><b>Cities</b></div>
  <div class="lbl">Do now</div>
  <div class="item" style="border-color:#18181b"><h4>Buy Istanbul <span class="badge solid" style="margin-left:auto">Good buy</span></h4><p>Starts your Turkey set · you keep $1,000.</p><div style="display:flex;gap:8px;margin-top:10px"><span class="btn primary" style="flex:1">Buy · $240</span><span class="btn">Skip</span></div></div>
  <div class="lbl">Upgrade next</div>
  <div class="item"><h4>Build on Spain <span class="badge" style="margin-left:auto">Best value</span></h4><p>Hotel on Barcelona already · 4th house on Madrid: rent $750 → $925.</p><div style="margin-top:10px"><span class="btn">Build · $100</span></div></div>
  <div class="lbl">Watch out</div>
  <div class="item"><h4>Juno's houses on Osaka</h4><p>$90 if you roll 8 (1 in 7). You can cover it.</p></div>
</div>
<div class="overlay" style="right:418px;top:61px"></div>
<div class="card" style="left:380px;top:250px;width:420px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,0.15)">
  <div style="display:flex;align-items:center;gap:10px"><div><div style="font:600 18px Inter">Buy Istanbul?</div><div class="muted" style="font-size:13.5px">Turkey · you own 0 of 3 · the bank sells it for $240.</div></div></div>
  <div style="margin:14px 0 6px">
    <div class="kv"><span>Rent</span><b>$20</b></div><div class="kv"><span>With the full set</span><b>$40</b></div><div class="kv"><span>1 · 2 · 3 houses</span><b>$100 · $300 · $750</b></div><div class="kv"><span>4 houses · hotel</span><b>$925 · $1,100</b></div><div class="kv" style="border:0"><span>House cost · mortgage</span><b>$150 · $120</b></div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><span class="btn">Decline</span><span class="btn primary">Buy for $240</span></div>
</div>
<div class="card" style="left:24px;bottom:24px;padding:10px 12px;display:flex;align-items:center;gap:12px">
  ${dice()}<div><div style="font-weight:600">Your turn</div><div class="muted" style="font-size:12.5px">Rolled 7 · turn 15</div></div><div class="sep"></div><span class="btn" style="opacity:.5">End turn</span><span class="btn">Build</span><span class="btn">Mortgage</span>
</div>`,
});
const v2Home = page({
  title: "V2 — shadcn light · home", css: V2.css + `
 h1 { font: 700 72px/1 Inter; letter-spacing: -0.05em; }
 .input { height: 40px; border: 1px solid #e4e4e7; border-radius: 8px; display: flex; align-items: center; padding: 0 12px; color: #09090b; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
 .code { width: 40px; height: 44px; border: 1px solid #e4e4e7; border-radius: 8px; display: grid; place-items: center; font: 500 18px 'JetBrains Mono'; background: #fff; }`,
  theme: V2.theme, lights: V2.lights, groundOpacity: 0.12,
  camera: { fov: 30, pos: "-1.4, 14.2, 19.2", look: "-5.6, -0.6, 1.4" },
  body: `
<div class="nav" style="background:rgba(250,250,250,.7)"><b style="font-weight:700;letter-spacing:-.02em;font-size:15px">Dice &amp; Deeds</b><span class="badge soft" style="margin-left:6px">v1</span><span style="margin-left:auto" class="btn ghost">How to play</span></div>
<div style="position:absolute;left:96px;top:180px;width:520px">
  <span class="badge" style="border-radius:999px;padding:3px 10px"><span style="width:7px;height:7px;border-radius:50%;background:#16a34a"></span>Multiplayer · 2–6 players · free</span>
  <h1 style="margin-top:22px">The property game,<br>rebuilt in 3D.</h1>
  <p class="muted" style="font-size:17px;margin:20px 0 34px;max-width:440px">Create a room, share a six-letter code, and play a full match in real time — no account needed.</p>
  <div class="card" style="position:relative;padding:18px;width:460px;box-shadow:0 10px 30px rgba(0,0,0,0.06)">
    <div style="font-size:14px;font-weight:500;margin-bottom:8px">Nickname</div>
    <div style="display:flex;gap:8px"><div class="input" style="flex:1">Sasha</div><span class="btn primary" style="height:40px">Create room</span></div>
    <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:#a1a1aa;font-size:12px"><span style="flex:1;height:1px;background:#e4e4e7"></span>OR JOIN WITH A CODE<span style="flex:1;height:1px;background:#e4e4e7"></span></div>
    <div style="display:flex;gap:6px;align-items:center"><div class="code">X</div><div class="code">4</div><div class="code">K</div><div class="code" style="border-color:#18181b;box-shadow:0 0 0 3px rgba(24,24,27,.1)"></div><div class="code"></div><div class="code"></div><span class="btn" style="height:44px;margin-left:auto">Join</span></div>
  </div>
</div>`,
});

// ── V3 · dev-tool mono ────────────────────────────────────────────────────────
const V3 = {
  theme: `{
    slab: "#070b10", slabRough: 0.25, slabMetal: 0.5, tileSide: "#0f1a22", tileRough: 0.5, bars: "#3ee6c4",
    edgeGlow: "#3ee6c4", activeGlow: "rgba(62,230,196,0.9)", ring: "#3ee6c4", pipGlow: true,
    dieA: ["#0f1a22", "#3ee6c4"], dieB: ["#d7fff4", "#070b10"],
    tile: makeTile({ bg: "#0b1219", line: "#1c2c38", text: "#d7fff4", muted: "#5d7a82", accent: "#3ee6c4", danger: "#ff6b6b", hatch: "rgba(62,230,196,0.06)", font: "'JetBrains Mono'", mono: "'JetBrains Mono'", radius: 10, tight: -2 }),
    center: (ctx, w, h) => {
      ctx.fillStyle = "#081018"; ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 24); ctx.fill();
      ctx.fillStyle = "rgba(62,230,196,0.12)";
      for (let y = 48; y < h - 20; y += 48) for (let x = 48; x < w - 20; x += 48) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
      const g = ctx.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.45, 800); g.addColorStop(0, "rgba(62,230,196,0.16)"); g.addColorStop(1, "rgba(62,230,196,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center"; ctx.fillStyle = "#d7fff4"; ctx.font = "700 150px 'JetBrains Mono'"; ctx.letterSpacing = "-8px"; ctx.fillText("dice&deeds", w / 2, h * 0.47);
      ctx.fillStyle = "#3ee6c4"; ctx.fillRect(w / 2 + 470, h * 0.47 - 110, 60, 120); ctx.letterSpacing = "2px";
      ctx.font = "500 36px 'JetBrains Mono'"; ctx.fillStyle = "#5d7a82"; ctx.fillText("// go around the world", w / 2, h * 0.47 + 90); ctx.letterSpacing = "0px";
    },
    building: (THREE, c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.2, emissive: c, emissiveIntensity: 0.45 }),
    pawn: (THREE, c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, metalness: 0.2, clearcoat: 1, emissive: c, emissiveIntensity: 0.25 }),
  }`,
  lights: `scene.environmentIntensity = 0.3;
scene.add(new THREE.HemisphereLight("#6ff7dd", "#030507", 0.45));
${keyLight("#e8fffa", 1.8, "-6, 14, 8")}
const rim = new THREE.DirectionalLight("#3ee6c4", 1.6); rim.position.set(8, 5, -10); scene.add(rim);`,
  css: `
 body { background: radial-gradient(800px 500px at 20% 0%, rgba(62,230,196,0.12), transparent 70%), radial-gradient(900px 600px at 55% 60%, rgba(56,132,255,0.08), transparent 70%), #05080b; color: #d7fff4; font: 400 13px/1.5 'JetBrains Mono', monospace; }
 body::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgba(62,230,196,0.12) 1px, transparent 1px); background-size: 22px 22px; z-index: 0; }
 .muted { color: #5d7a82; } .acc { color: #3ee6c4; } .red { color: #ff6b6b; }
 .win { position: absolute; background: rgba(8,14,19,0.78); border: 1px solid #16323a; border-radius: 10px; backdrop-filter: blur(14px); box-shadow: 0 0 0 1px rgba(62,230,196,0.04) inset, 0 20px 60px rgba(0,0,0,0.5); }
 .bar { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-bottom: 1px solid #16323a; color: #5d7a82; font-size: 12px; }
 .bar i { width: 9px; height: 9px; border-radius: 50%; background: #1c2c38; display: inline-block; }
 .tab { padding: 0 10px; height: 34px; display: inline-flex; align-items: center; border-right: 1px solid #16323a; } .tab.on { color: #d7fff4; box-shadow: inset 0 -2px 0 #3ee6c4; }
 .ln { display: flex; gap: 10px; padding: 3px 14px; font-size: 12.5px; white-space: nowrap; }
 .ln .t { color: #3a525a; } .ln .w { color: #8fb3ba; width: 62px; }
 .btn { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 7px; border: 1px solid #1c3a42; background: #0b1219; color: #d7fff4; font: 500 12.5px 'JetBrains Mono'; }
 .btn.primary { background: #3ee6c4; color: #03201a; border-color: #6ff7dd; box-shadow: 0 0 24px rgba(62,230,196,0.35); }
 kbd { font: 500 11px 'JetBrains Mono'; border: 1px solid #1c3a42; border-radius: 4px; padding: 0 5px; color: #5d7a82; }
 .primary kbd { color: #03201a; border-color: rgba(3,32,26,0.4); }
 .die { width: 26px; height: 26px; border-radius: 6px; background: #0f1a22; border: 1px solid #3ee6c4; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 4px; box-shadow: 0 0 10px rgba(62,230,196,.3); }
 .die i { width: 4px; height: 4px; border-radius: 50%; background: #3ee6c4; place-self: center; }
 .k { color: #8fb3ba; } .s { color: #f5c46b; } .n { color: #b392f0; }
`,
};
const v3Game = page({
  title: "V3 — dev-tool mono · game", css: V3.css, theme: V3.theme, lights: V3.lights, shift: 60, groundOpacity: 0.55,
  camera: { fov: 27, pos: "3.0, 28.2, 23.4", look: "0.1, -0.9, 0.3" },
  body: `
<div class="win" style="left:24px;top:24px;width:318px">
  <div class="bar"><i></i><i></i><i></i><span style="margin-left:8px">players.ts</span><span style="margin-left:auto" class="acc">room 7GH6J9</span></div>
  <div style="padding:8px 0">${PLAYERS.map(([n, c, m, s, on, tag]) => `<div class="ln" style="padding:6px 14px;${on ? "background:rgba(62,230,196,0.06);box-shadow:inset 2px 0 0 #3ee6c4" : ""}"><span style="color:${on ? "#3ee6c4" : "#3a525a"}">${on ? "▸" : " "}</span><span style="width:9px;height:9px;border-radius:2px;background:${c};margin-top:5px;box-shadow:0 0 8px ${c}88"></span><span style="width:78px">${n.toLowerCase().replace(" ", "_")}</span><span class="muted" style="width:118px;overflow:hidden;text-overflow:ellipsis">${tag ? tag.toLowerCase() : s}</span><span style="margin-left:auto">${m}</span></div>`).join("")}</div>
  <div style="border-top:1px solid #16323a;padding:8px 14px;font-size:12px" class="muted">rules: <span class="s">"$1,500 · go $200 · jackpot $350"</span></div>
</div>
<div class="win" style="left:24px;top:292px;width:318px;padding-bottom:10px">
  <div class="bar"><span>istanbul.json</span><span style="margin-left:auto;color:#3ee6c4">● for sale</span></div>
  <pre style="padding:10px 14px;font:12.5px/1.6 'JetBrains Mono';white-space:pre">{
  <span class="k">"set"</span>: <span class="s">"turkey"</span>, <span class="k">"owned"</span>: <span class="n">0</span>/<span class="n">3</span>,
  <span class="k">"price"</span>: <span class="n">240</span>,
  <span class="k">"rent"</span>: [<span class="n">20</span>, <span class="n">100</span>, <span class="n">300</span>, <span class="n">750</span>, <span class="n">925</span>, <span class="n">1100</span>],
  <span class="k">"house"</span>: <span class="n">150</span>, <span class="k">"mortgage"</span>: <span class="n">120</span>
}</pre>
  <div style="margin:0 14px;padding:8px 10px;border:1px solid #16323a;border-radius:7px;font-size:12px"><span class="acc">// guide:</span> buy — starts turkey, keeps $1,000</div>
</div>
<div class="win" style="right:24px;top:24px;bottom:24px;width:388px">
  <div class="bar" style="padding:0"><span class="tab on">game.log</span><span class="tab">guide</span><span class="tab">cities</span><span style="margin-left:auto;padding-right:12px">turn 15</span></div>
  <div style="padding:8px 0">
    <div class="ln"><span class="t">15:02</span><span class="w">sasha</span><span>roll <span class="acc">4+3</span> → istanbul</span></div>
    <div class="ln"><span class="t">15:02</span><span class="w">bank</span><span>offer istanbul <span class="s">$240</span></span></div>
    <div class="ln" style="opacity:.55"><span class="t">15:01</span><span class="w">marek</span><span>roll 2+2 doubles → madrid</span></div>
    <div class="ln" style="opacity:.55"><span class="t">15:01</span><span class="w">marek</span><span>rent madrid → sasha</span><span class="acc" style="margin-left:auto">+$180</span></div>
    <div class="ln" style="opacity:.55"><span class="t">15:00</span><span class="w">dice_bot</span><span>jail ← go to jail</span></div>
    <div class="ln" style="opacity:.55"><span class="t">14:59</span><span class="w">juno</span><span>pass go</span><span class="acc" style="margin-left:auto">+$200</span></div>
    <div class="ln" style="opacity:.55"><span class="t">14:59</span><span class="w">juno</span><span>build osaka (house 2)</span><span class="red" style="margin-left:auto">−$50</span></div>
    <div class="ln" style="opacity:.55"><span class="t">14:58</span><span class="w">lina</span><span>tax income → pot</span><span style="margin-left:auto;color:#b392f0">pot $350</span></div>
  </div>
</div>
<div class="win" style="left:366px;right:436px;bottom:24px;display:flex;align-items:center;gap:12px;padding:10px 12px">
  ${dice()}<span class="acc">›</span><span>buy istanbul</span><span style="width:8px;height:16px;background:#3ee6c4;display:inline-block"></span>
  <span style="margin-left:auto" class="btn primary">run <kbd>↵</kbd></span><span class="btn">decline <kbd>D</kbd></span><span class="btn" style="opacity:.5">end <kbd>E</kbd></span>
</div>`,
});
const v3Home = page({
  title: "V3 — dev-tool mono · home", css: V3.css + `
 h1 { font: 700 70px/1.02 'JetBrains Mono'; letter-spacing: -0.06em; }
 .inp { height: 40px; border: 1px solid #1c3a42; background: #081018; border-radius: 7px; display: flex; align-items: center; padding: 0 12px; }
 .code { width: 40px; height: 44px; border: 1px solid #1c3a42; background: #081018; border-radius: 7px; display: grid; place-items: center; font: 700 18px 'JetBrains Mono'; }`,
  theme: V3.theme, lights: V3.lights, groundOpacity: 0.55,
  camera: { fov: 30, pos: "-1.4, 14.2, 19.2", look: "-5.6, -0.6, 1.4" },
  body: `
<div style="position:absolute;left:24px;top:22px;display:flex;align-items:center;gap:10px"><span style="width:18px;height:18px;border-radius:4px;background:#3ee6c4;box-shadow:0 0 16px rgba(62,230,196,.5)"></span><b>dice&amp;deeds</b><span class="muted">v1.0</span></div>
<div style="position:absolute;left:96px;top:170px;width:560px;z-index:1">
  <span class="muted">// multiplayer · 2–6 players · free</span>
  <h1 style="margin-top:18px">roll. buy.<br>build<span class="acc">_</span></h1>
  <p class="muted" style="font-size:15px;margin:22px 0 30px;max-width:460px">A real-time property game on a 3D board. Server-authoritative rules, six-letter room codes, no account.</p>
  <div class="win" style="position:relative;width:470px">
    <div class="bar"><i></i><i></i><i></i><span style="margin-left:8px">new-room.sh</span></div>
    <div style="padding:14px">
      <div class="muted" style="font-size:12px;margin-bottom:6px">--nickname</div>
      <div style="display:flex;gap:8px"><div class="inp" style="flex:1"><span class="acc">›</span>&nbsp;sasha</div><span class="btn primary" style="height:40px">create <kbd>↵</kbd></span></div>
      <div class="muted" style="font-size:12px;margin:16px 0 6px">--join</div>
      <div style="display:flex;gap:6px;align-items:center"><div class="code">X</div><div class="code">4</div><div class="code">K</div><div class="code" style="border-color:#3ee6c4;box-shadow:0 0 12px rgba(62,230,196,.3)"></div><div class="code"></div><div class="code"></div><span class="btn" style="height:44px;margin-left:auto">join</span></div>
    </div>
  </div>
</div>`,
});

const out = { "V1-game": v1Game, "V1-home": v1Home, "V2-game": v2Game, "V2-home": v2Home, "V3-game": v3Game, "V3-home": v3Home };
for (const [k, html] of Object.entries(out)) {
  fs.writeFileSync(path.join(__dirname, `variant-${k}.html`), html);
  console.log("wrote", `variant-${k}.html`);
}

// ── Light versions of V1 and V3 (user: "should be light mode") ────────────────
// Swap the theme / lights / css blocks wholesale, then map the few inline dark colours in the bodies.
function lighten(html, from, to, map) {
  let s = html.split(from.theme).join("@@THEME@@").split(from.lights).join("@@LIGHTS@@").split(from.css).join("@@CSS@@");
  for (const [a, b] of map) s = s.split(a).join(b);
  return s.split("@@THEME@@").join(to.theme).split("@@LIGHTS@@").join(to.lights).split("@@CSS@@").join(to.css);
}

const L1 = {
  theme: `{
    slab: "#e9ebf1", slabRough: 0.5, slabMetal: 0.05, tileSide: "#dfe2ea", tileRough: 0.75, bars: "#3b3f4a",
    edgeGlow: "#5e6ad2", activeGlow: "rgba(94,106,210,0.35)", ring: "#5e6ad2", pipGlow: false,
    dieA: ["#16171b", "#ffffff"], dieB: ["#ffffff", "#16171b"],
    tile: makeTile({ bg: "#ffffff", line: "#e3e5eb", text: "#16171b", muted: "#55595f", accent: "#5e6ad2", danger: "#d93838", hatch: "rgba(22,23,27,0.05)", font: "Inter", mono: "'JetBrains Mono'", radius: 18, tight: -1 }),
    center: (ctx, w, h) => {
      ctx.fillStyle = "#f8f9fb"; ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 40); ctx.fill();
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 40, w / 2, h * 0.42, 900); g.addColorStop(0, "rgba(94,106,210,0.12)"); g.addColorStop(1, "rgba(94,106,210,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(22,23,27,0.05)"; ctx.lineWidth = 2;
      for (let x = 128; x < w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, h - 16); ctx.stroke(); }
      for (let y = 128; y < h; y += 128) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w - 16, y); ctx.stroke(); }
      ctx.textAlign = "center"; ctx.fillStyle = "#16171b"; ctx.font = "600 150px Inter"; ctx.letterSpacing = "-6px"; ctx.fillText("Dice & Deeds", w / 2, h * 0.47); ctx.letterSpacing = "12px";
      ctx.font = "500 34px 'JetBrains Mono'"; ctx.fillStyle = "#8a8f98"; ctx.fillText("GO AROUND THE WORLD", w / 2, h * 0.47 + 90); ctx.letterSpacing = "0px";
    },
    building: (THREE, c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1 }),
    pawn: (THREE, c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 }),
  }`,
  lights: `scene.environmentIntensity = 0.5;
scene.add(new THREE.HemisphereLight("#ffffff", "#dfe3f0", 0.8));
${keyLight("#ffffff", 2.0, "-6, 14, 8")}
const rim = new THREE.DirectionalLight("#8b93ff", 0.5); rim.position.set(9, 4, -9); scene.add(rim);`,
  css: `
 body { background: radial-gradient(900px 600px at 42% 38%, rgba(94,106,210,0.08), transparent 70%), #fbfbfc; color: #16171b; font: 400 13px/1.45 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
 .mono { font-family: 'JetBrains Mono', monospace; }
 .muted { color: #6b6f76; } .dim { color: #9a9ea6; }
 .panel { position: absolute; background: rgba(255,255,255,0.92); border: 1px solid #e6e6ea; border-radius: 12px; box-shadow: 0 1px 2px rgba(16,18,27,0.04), 0 12px 32px rgba(16,18,27,0.08); backdrop-filter: blur(12px); }
 .crumbs { position: absolute; left: 24px; top: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px; }
 .logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#8b93ff,#5e6ad2); box-shadow: 0 1px 2px rgba(94,106,210,0.4); }
 .chip { border: 1px solid #e6e6ea; border-radius: 6px; padding: 1px 7px; background: #f7f7f9; font-size: 12px; }
 .row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; }
 .row.on { background: #f3f4fa; box-shadow: inset 2px 0 0 #5e6ad2; }
 .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
 .pill { font-size: 11px; color: #5c6068; border: 1px solid #e6e6ea; border-radius: 999px; padding: 0 7px; background: #fff; }
 .tabs { display: flex; gap: 18px; border-bottom: 1px solid #e6e6ea; padding: 0 14px; font-size: 13px; color: #6b6f76; }
 .tabs b { font-weight: 500; padding: 10px 0; } .tabs b.on { color: #16171b; box-shadow: inset 0 -2px 0 #5e6ad2; }
 .ev { display: flex; gap: 10px; align-items: flex-start; padding: 7px 14px; font-size: 13px; color: #3c3f46; }
 .ev i { width: 18px; height: 18px; border-radius: 5px; border: 1px solid #e6e6ea; background: #f7f7f9; flex: none; margin-top: 1px; display: grid; place-items: center; font-style: normal; font-size: 10px; color: #8a8f98; }
 .ev b { color: #16171b; font-weight: 500; }
 .amt { margin-left: auto; font: 500 12px 'JetBrains Mono', monospace; }
 .grp { padding: 12px 14px 4px; font-size: 11px; color: #9a9ea6; letter-spacing: .04em; text-transform: uppercase; }
 .btn { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 8px; font-weight: 500; font-size: 13px; border: 1px solid #e3e4e8; background: #fff; color: #16171b; box-shadow: 0 1px 2px rgba(16,18,27,0.05); }
 .btn.primary { background: #5e6ad2; border-color: #5e6ad2; color: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 14px rgba(94,106,210,0.3); }
 .btn.ghost { background: transparent; box-shadow: none; color: #6b6f76; }
 kbd { font: 500 11px 'JetBrains Mono', monospace; color: #6b6f76; border: 1px solid #dcdde2; border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; background: #f7f7f9; }
 .primary kbd { color: #fff; border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.14); }
 .die { width: 26px; height: 26px; border-radius: 6px; background: #16171b; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 4px; }
 .die i { width: 4px; height: 4px; border-radius: 50%; background: #fff; place-self: center; }
 .kv { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ececf0; font-size: 12.5px; color: #6b6f76; }
 .kv b { font: 500 12.5px 'JetBrains Mono', monospace; color: #16171b; }
`,
};
const L1_MAP = [
  ["#23252a", "#e6e6ea"], ["#0f1012", "#ffffff"], ["#1f3a2c", "#bfe5cf"], ["#4cb782", "#16804d"], ["#a4a8b0", "#5c6068"],
  ["#8b93ff", "#5e6ad2"], ["#eb5757", "#d93838"], ["#e6e7ea", "#16171b"], ["#f7f8f8 30%,#8a8f98", "#16171b 40%,#6b6f76"],
  ["#2a2c31", "#e3e4e8"], ["#62666d", "#9a9ea6"],
];

const L3 = {
  theme: `{
    slab: "#e6ecea", slabRough: 0.45, slabMetal: 0.05, tileSide: "#d9e2e0", tileRough: 0.6, bars: "#0d9488",
    edgeGlow: "#14b8a6", activeGlow: "rgba(20,184,166,0.35)", ring: "#0d9488", pipGlow: false,
    dieA: ["#0b1f1c", "#5eead4"], dieB: ["#ffffff", "#0b1f1c"],
    tile: makeTile({ bg: "#ffffff", line: "#d9e3e1", text: "#0b1f1c", muted: "#3f5e59", accent: "#0d9488", danger: "#dc2626", hatch: "rgba(13,148,136,0.07)", font: "'JetBrains Mono'", mono: "'JetBrains Mono'", radius: 10, tight: -2 }),
    center: (ctx, w, h) => {
      ctx.fillStyle = "#f7faf9"; ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 24); ctx.fill();
      ctx.fillStyle = "rgba(13,148,136,0.16)";
      for (let y = 48; y < h - 20; y += 48) for (let x = 48; x < w - 20; x += 48) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
      ctx.textAlign = "center"; ctx.fillStyle = "#0b1f1c"; ctx.font = "700 150px 'JetBrains Mono'"; ctx.letterSpacing = "-8px"; ctx.fillText("dice&deeds", w / 2, h * 0.47);
      ctx.fillStyle = "#0d9488"; ctx.fillRect(w / 2 + 470, h * 0.47 - 110, 60, 120); ctx.letterSpacing = "2px";
      ctx.font = "500 36px 'JetBrains Mono'"; ctx.fillStyle = "#6a8480"; ctx.fillText("// go around the world", w / 2, h * 0.47 + 90); ctx.letterSpacing = "0px";
    },
    building: (THREE, c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.1 }),
    pawn: (THREE, c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, metalness: 0.05, clearcoat: 1 }),
  }`,
  lights: `scene.environmentIntensity = 0.5;
scene.add(new THREE.HemisphereLight("#ffffff", "#d7e6e3", 0.8));
${keyLight("#ffffff", 2.0, "-6, 14, 8")}
const rim = new THREE.DirectionalLight("#5eead4", 0.5); rim.position.set(8, 5, -10); scene.add(rim);`,
  css: `
 body { background: radial-gradient(800px 500px at 20% 0%, rgba(20,184,166,0.08), transparent 70%), #f6f8f7; color: #0b1f1c; font: 400 13px/1.5 'JetBrains Mono', monospace; }
 body::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgba(13,148,136,0.16) 1px, transparent 1px); background-size: 22px 22px; z-index: 0; }
 .muted { color: #5b7571; } .acc { color: #0d9488; } .red { color: #dc2626; }
 .win { position: absolute; background: rgba(255,255,255,0.92); border: 1px solid #dbe5e3; border-radius: 10px; backdrop-filter: blur(14px); box-shadow: 0 1px 2px rgba(11,31,28,0.05), 0 14px 36px rgba(11,31,28,0.08); }
 .bar { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-bottom: 1px solid #dbe5e3; color: #5b7571; font-size: 12px; background: #fbfcfc; border-radius: 10px 10px 0 0; }
 .bar i { width: 9px; height: 9px; border-radius: 50%; background: #dbe5e3; display: inline-block; }
 .tab { padding: 0 10px; height: 34px; display: inline-flex; align-items: center; border-right: 1px solid #dbe5e3; } .tab.on { color: #0b1f1c; box-shadow: inset 0 -2px 0 #0d9488; background: #fff; }
 .ln { display: flex; gap: 10px; padding: 3px 14px; font-size: 12.5px; white-space: nowrap; }
 .ln .t { color: #9fb3af; } .ln .w { color: #355b56; width: 62px; }
 .btn { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 7px; border: 1px solid #cfdcd9; background: #fff; color: #0b1f1c; font: 500 12.5px 'JetBrains Mono'; box-shadow: 0 1px 2px rgba(11,31,28,0.05); }
 .btn.primary { background: #0d9488; color: #fff; border-color: #0d9488; box-shadow: 0 4px 14px rgba(13,148,136,0.3); }
 kbd { font: 500 11px 'JetBrains Mono'; border: 1px solid #cfdcd9; border-radius: 4px; padding: 0 5px; color: #5b7571; }
 .primary kbd { color: #fff; border-color: rgba(255,255,255,0.45); }
 .die { width: 26px; height: 26px; border-radius: 6px; background: #0b1f1c; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 4px; }
 .die i { width: 4px; height: 4px; border-radius: 50%; background: #5eead4; place-self: center; }
 .k { color: #0f766e; } .s { color: #b45309; } .n { color: #7c3aed; }
`,
};
const L3_MAP = [
  ["#3ee6c4", "#0d9488"], ["rgba(62,230,196", "rgba(13,148,136"], ["#16323a", "#dbe5e3"], ["#3a525a", "#9fb3af"], ["#b392f0", "#7c3aed"],
  ["#1c2c38", "#dbe5e3"], ["#081018", "#ffffff"], ["#5d7a82", "#5b7571"], ["#d7fff4", "#0b1f1c"], ["#8fb3ba", "#355b56"],
  ["#ff6b6b", "#dc2626"], ["#f5c46b", "#b45309"], ["#1c3a42", "#cfdcd9"], ["#0b1219", "#ffffff"], ["#03201a", "#ffffff"], ["#6ff7dd", "#0d9488"],
];

const soften = (html, from) => html.split(`opacity: ${from} }));`).join("opacity: 0.14 }));");
const lightOut = {
  "V1L-game": soften(lighten(v1Game, V1, L1, L1_MAP), "0.5").replace("V1 — Linear dark", "V1 light — Linear"),
  "V1L-home": soften(lighten(v1Home, V1, L1, L1_MAP), "0.5").replace("V1 — Linear dark", "V1 light — Linear"),
  "V3L-game": soften(lighten(v3Game, V3, L3, L3_MAP), "0.55").replace("V3 — dev-tool mono", "V3 light — dev-tool"),
  "V3L-home": soften(lighten(v3Home, V3, L3, L3_MAP), "0.55").replace("V3 — dev-tool mono", "V3 light — dev-tool"),
};
for (const [k, html] of Object.entries(lightOut)) {
  if (html.includes("@@")) throw new Error("placeholder left in " + k);
  fs.writeFileSync(path.join(__dirname, `variant-${k}.html`), html);
  console.log("wrote", `variant-${k}.html`);
}

// ── Mixed light/dark versions (user: "so much white — mix things, professional game UI") ──
// All use the V1-light HUD chrome (white panels, indigo accent); they differ in where the dark goes.
const must = (s, a, b) => { if (!s.includes(a)) throw new Error("mix: missing " + a.slice(0, 50)); return s.split(a).join(b); };
const L1_BODY_BG = "background: radial-gradient(900px 600px at 42% 38%, rgba(94,106,210,0.08), transparent 70%), #fbfbfc;";
const TINTED_BG = "background: radial-gradient(1000px 700px at 40% 40%, rgba(255,255,255,0.9), transparent 70%), linear-gradient(180deg, #e9ecf3 0%, #d5dae6 100%);";
const NIGHT_BG = "background: radial-gradient(1000px 700px at 40% 42%, rgba(94,106,210,0.35), transparent 70%), linear-gradient(180deg, #171a26 0%, #0d0f17 100%);";

// M1 — graphite board on a tinted light page
const M1 = { theme: V1.theme, lights: V1.lights, css: must(L1.css, L1_BODY_BG, TINTED_BG) };

// M2 — dark table, white board, white panels; text that sits directly on the table turns light
const M2 = {
  theme: L1.theme, lights: L1.lights,
  css: must(L1.css, L1_BODY_BG, NIGHT_BG) + `
 .crumbs { color: #e6e7ea; } .crumbs .muted { color: #a4a8b0; } .crumbs .dim { color: #5c6170; }
 .crumbs .chip { background: #1d2030; border-color: #2c3042; color: #e6e7ea; }
 .ui > div > p.muted, .ui > div > div.muted { color: #a4a8b0; }
 .ui > div > span.chip { background: #1d2030; border-color: #2c3042; } .ui > div > span.chip .muted { color: #c9ccd6; }
 .panel { box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px rgba(0,0,0,0.45); }
`,
};
const M2_MAP = L1_MAP.filter(([a]) => !a.startsWith("#f7f8f8 30%")); // keep the light hero gradient on the dark table

// M3 — two-tone board: dark frame + dark centre plate, white tile ring, tinted light page
let m3Theme = L1.theme;
m3Theme = must(m3Theme, 'slab: "#e9ebf1", slabRough: 0.5, slabMetal: 0.05', 'slab: "#1b1e2b", slabRough: 0.35, slabMetal: 0.25');
m3Theme = must(m3Theme, 'dieA: ["#16171b", "#ffffff"]', 'dieA: ["#5e6ad2", "#ffffff"]');
m3Theme = must(m3Theme, 'ctx.fillStyle = "#f8f9fb"; ctx.beginPath()', 'ctx.fillStyle = "#171a26"; ctx.beginPath()');
m3Theme = must(m3Theme, 'g.addColorStop(0, "rgba(94,106,210,0.12)")', 'g.addColorStop(0, "rgba(94,106,210,0.38)")');
m3Theme = must(m3Theme, 'ctx.strokeStyle = "rgba(22,23,27,0.05)"', 'ctx.strokeStyle = "rgba(255,255,255,0.05)"');
m3Theme = must(m3Theme, 'ctx.fillStyle = "#16171b"; ctx.font = "600 150px Inter"', 'ctx.fillStyle = "#f4f5f8"; ctx.font = "600 150px Inter"');
const M3 = { theme: m3Theme, lights: L1.lights, css: must(L1.css, L1_BODY_BG, TINTED_BG) };

const shadow = (html, from, to) => html.split(`opacity: ${from} }));`).join(`opacity: ${to} }));`);
const mixOut = {
  "M1-game": shadow(lighten(v1Game, V1, M1, L1_MAP), "0.5", "0.32"), "M1-home": shadow(lighten(v1Home, V1, M1, L1_MAP), "0.5", "0.32"),
  "M2-game": lighten(v1Game, V1, M2, M2_MAP), "M2-home": lighten(v1Home, V1, M2, M2_MAP),
  "M3-game": shadow(lighten(v1Game, V1, M3, L1_MAP), "0.5", "0.3"), "M3-home": shadow(lighten(v1Home, V1, M3, L1_MAP), "0.5", "0.3"),
};
for (const [k, html] of Object.entries(mixOut)) {
  if (html.includes("@@")) throw new Error("placeholder left in " + k);
  fs.writeFileSync(path.join(__dirname, `variant-${k}.html`), html.replace("V1 — Linear dark", k.slice(0, 2) + " — mixed"));
  console.log("wrote", `variant-${k}.html`);
}

// ── Game-feel versions G1–G3 (user: "looks so professional, not game looking") ─────────
// Same information as before, but presented as a game: table background, framed board,
// chunky bevelled buttons, coins, avatar plates, the property as a card.
const gTheme = (o) => `{
    slab: "${o.slab}", slabRough: 0.35, slabMetal: ${o.metal ?? 0.2}, tileSide: "${o.tileSide}", tileRough: 0.7, bars: "${o.bars}",
    edgeGlow: "${o.rim}", activeGlow: "${o.glow}", ring: "${o.rim}", pipGlow: false,
    dieA: ${JSON.stringify(o.dieA)}, dieB: ${JSON.stringify(o.dieB)},
    tile: makeTile({ bg: "${o.tile}", line: "${o.line}", text: "${o.text}", muted: "${o.muted}", accent: "${o.accent}", danger: "#d93838", hatch: "rgba(0,0,0,0.06)", font: "Outfit", mono: "Outfit", radius: 20, tight: -1 }),
    center: (ctx, w, h) => {
      ctx.fillStyle = "${o.center}"; ctx.beginPath(); ctx.roundRect(8, 8, w - 16, h - 16, 48); ctx.fill();
      const g = ctx.createRadialGradient(w / 2, h * 0.44, 40, w / 2, h * 0.44, 900); g.addColorStop(0, "${o.centerGlow}"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 6; ctx.strokeStyle = "${o.centerLine}"; ctx.beginPath(); ctx.roundRect(60, 60, w - 120, h - 120, 36); ctx.stroke();
      ctx.setLineDash([4, 22]); ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.roundRect(96, 96, w - 192, h - 192, 28); ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = "center"; ctx.font = "800 190px Outfit"; ctx.letterSpacing = "-6px";
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText("Dice & Deeds", w / 2, h * 0.47 + 12);
      ctx.fillStyle = "${o.title}"; ctx.fillText("Dice & Deeds", w / 2, h * 0.47); ctx.letterSpacing = "14px";
      ctx.font = "700 40px Outfit"; ctx.fillStyle = "${o.sub}"; ctx.fillText("GO AROUND THE WORLD", w / 2, h * 0.47 + 100); ctx.letterSpacing = "0px";
    },
    building: (THREE, c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.1 }),
    pawn: (THREE, c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 }),
  }`;
const gLights = (hemiSky, hemiGround, rim) => `scene.environmentIntensity = 0.5;
scene.add(new THREE.HemisphereLight("${hemiSky}", "${hemiGround}", 0.8));
${keyLight("#fff6e8", 2.1, "-6, 14, 8")}
const rim = new THREE.DirectionalLight("${rim}", 0.9); rim.position.set(9, 5, -9); scene.add(rim);`;

const G_CSS = (v) => `
 :root { ${Object.entries(v).map(([k, x]) => `--${k}: ${x};`).join(" ")} }
 body { background: var(--bg); color: var(--text); font: 500 14px/1.4 Outfit, Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
 .ui::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 120% at 50% 45%, transparent 60%, var(--vignette) 100%); z-index: -1; }
 .glass { position: absolute; background: var(--panel); border: 2px solid var(--edge); border-radius: 20px; box-shadow: var(--shadow); backdrop-filter: blur(10px); }
 .muted { color: var(--muted); }
 .coin { display: inline-block; width: 1em; height: 1em; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff3b0, #f5c451 45%, #c9962b 100%); box-shadow: 0 0 0 1.5px #a9781c inset, 0 1px 0 rgba(0,0,0,.25); vertical-align: -0.12em; margin-right: .3em; }
 .brand { position: absolute; left: 24px; top: 20px; display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 20px; letter-spacing: -.02em; color: var(--on-table); }
 .gem { width: 34px; height: 34px; border-radius: 11px; background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: 0 3px 0 var(--accent3), inset 0 1px 0 rgba(255,255,255,.5); display: grid; place-items: center; font-size: 18px; }
 .code { font: 700 13px 'JetBrains Mono', monospace; letter-spacing: .18em; padding: 4px 10px; border-radius: 999px; background: var(--chip); color: var(--on-chip); border: 1.5px solid var(--edge); }
 .plates { position: absolute; left: 300px; right: 400px; top: 16px; display: flex; gap: 10px; justify-content: center; }
 .plate { display: flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; border-radius: 999px; background: var(--panel); border: 2px solid var(--edge); box-shadow: var(--shadow-sm); }
 .plate.on { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft), var(--shadow-sm); transform: scale(1.06); }
 .av { width: 40px; height: 40px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 45%), var(--c); border: 2.5px solid #fff; box-shadow: 0 2px 0 rgba(0,0,0,.25); display: grid; place-items: center; font-weight: 800; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.35); }
 .plate b { display: block; font-weight: 700; font-size: 14px; line-height: 1.1; }
 .plate .cash { font-weight: 800; font-size: 15px; }
 .tag { font-size: 10px; font-weight: 800; letter-spacing: .08em; padding: 2px 7px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); }
 .tag.dim { background: var(--chip); color: var(--on-chip); }
 .gbtn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 50px; padding: 0 22px; border-radius: 16px; font: 800 17px Outfit; letter-spacing: .05em; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.3);
   background: linear-gradient(180deg, var(--b1), var(--b2)); box-shadow: 0 5px 0 var(--b3), 0 12px 22px rgba(0,0,0,.28), inset 0 1.5px 0 rgba(255,255,255,.45); }
 .gbtn.buy { --b1: #5fe08a; --b2: #27b35a; --b3: #178043; }
 .gbtn.gold { --b1: #ffdf7a; --b2: #f0b429; --b3: #b57f12; color: #3d2a00; text-shadow: 0 1px 0 rgba(255,255,255,.5); }
 .gbtn.pass { --b1: var(--n1); --b2: var(--n2); --b3: var(--n3); color: var(--n-ink); text-shadow: none; }
 .gbtn.off { filter: saturate(.3) brightness(.95); opacity: .6; }
 .rbtn { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 62px; height: 56px; border-radius: 16px; font-size: 20px; background: linear-gradient(180deg, var(--n1), var(--n2)); box-shadow: 0 4px 0 var(--n3), inset 0 1.5px 0 rgba(255,255,255,.4); color: var(--n-ink); }
 .rbtn small { font-size: 10px; font-weight: 700; letter-spacing: .04em; margin-top: -2px; }
 .deed { left: 24px; top: 96px; width: 300px; overflow: hidden; }
 .deed-top { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--deed-top); border-bottom: 2px solid var(--edge); }
 .lm { width: 56px; height: 56px; border-radius: 16px; background: var(--chip); display: grid; place-items: center; font-size: 32px; box-shadow: inset 0 -3px 0 rgba(0,0,0,.12); }
 .deed h3 { font-weight: 800; font-size: 24px; letter-spacing: -.02em; line-height: 1; }
 .deed small { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; color: var(--muted); white-space: nowrap; display: block; margin-bottom: 4px; }
 .rents { padding: 10px 14px 4px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
 .rent { border-radius: 12px; background: var(--row); padding: 6px 4px; text-align: center; }
 .rent span { display: block; font-size: 10px; font-weight: 700; letter-spacing: .06em; color: var(--muted); }
 .rent b { font-weight: 800; font-size: 15px; }
 .tip { margin: 8px 14px; padding: 8px 10px; border-radius: 12px; background: var(--tip); font-size: 12.5px; font-weight: 600; }
 .deed-btns { display: flex; gap: 10px; padding: 8px 14px 18px; }
 .side { right: 24px; top: 84px; bottom: 24px; width: 350px; display: flex; flex-direction: column; overflow: hidden; }
 .side-tabs { display: flex; gap: 6px; padding: 12px; border-bottom: 2px solid var(--edge); }
 .side-tabs span { flex: 1; text-align: center; padding: 8px 0; border-radius: 12px; font-weight: 700; font-size: 13px; color: var(--muted); }
 .side-tabs span.on { background: var(--accent); color: var(--accent-ink); box-shadow: 0 3px 0 var(--accent3); }
 .turnhdr { padding: 12px 16px 4px; font-size: 11px; font-weight: 800; letter-spacing: .12em; color: var(--muted); display: flex; align-items: center; gap: 8px; }
 .turnhdr i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
 .evt { display: flex; align-items: center; gap: 10px; margin: 4px 12px; padding: 8px 10px; border-radius: 14px; background: var(--row); font-size: 13.5px; }
 .evt .ic { width: 32px; height: 32px; border-radius: 10px; background: var(--chip); display: grid; place-items: center; font-size: 16px; flex: none; }
 .evt b { font-weight: 700; }
 .amt { margin-left: auto; font-weight: 800; font-size: 13px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
 .amt.plus { background: #d8f7e3; color: #12713a; } .amt.minus { background: #ffe0e0; color: #b02a2a; } .amt.flat { background: var(--chip); color: var(--on-chip); }
 .dock { left: 50%; transform: translateX(calc(-50% - 150px)); bottom: 22px; padding: 12px 14px; display: flex; align-items: center; gap: 14px; border-radius: 26px; }
 .tray { display: flex; gap: 8px; padding: 8px 10px; border-radius: 16px; background: var(--tray); box-shadow: inset 0 3px 8px rgba(0,0,0,.35); }
 .d { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(180deg,#fff,#e9e9f2); box-shadow: 0 3px 0 #b9bbcc; display: grid; grid-template: repeat(3,1fr)/repeat(3,1fr); padding: 7px; }
 .d i { width: 7px; height: 7px; border-radius: 50%; background: #1d2140; place-self: center; }
 .dock-info b { display: block; font-weight: 800; font-size: 17px; } .dock-info span { font-size: 12.5px; color: var(--muted); font-weight: 600; }
 .wallet { left: 24px; bottom: 22px; padding: 12px 18px; }
 .wallet small { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; color: var(--muted); display: block; }
 .wallet b { font-weight: 800; font-size: 30px; letter-spacing: -.02em; }
 .hero { position: absolute; left: 96px; top: 150px; width: 540px; color: var(--on-table); }
 .hero h1 { font: 800 96px/0.95 Outfit; letter-spacing: -.04em; text-shadow: 0 6px 0 var(--title-shadow); }
 .hero h1 em { font-style: normal; color: var(--accent); }
 .hero p { font-size: 19px; font-weight: 500; margin: 22px 0 28px; max-width: 460px; color: var(--on-table-muted); }
 .start { position: relative; width: 480px; padding: 18px; }
 .field { height: 52px; border-radius: 14px; background: var(--row); border: 2px solid var(--edge); display: flex; align-items: center; padding: 0 16px; font-weight: 700; font-size: 17px; }
 .cbox { width: 46px; height: 54px; border-radius: 12px; background: var(--row); border: 2px solid var(--edge); display: grid; place-items: center; font: 800 22px Outfit; }
 .or { display: flex; align-items: center; gap: 10px; margin: 16px 0 12px; font-size: 11px; font-weight: 800; letter-spacing: .14em; color: var(--muted); }
 .or::before, .or::after { content: ""; flex: 1; height: 2px; background: var(--edge); border-radius: 2px; }
`;

const gDice = `<div class="tray"><div class="d"><i style="grid-area:1/1"></i><i style="grid-area:1/3"></i><i style="grid-area:3/1"></i><i style="grid-area:3/3"></i></div><div class="d"><i style="grid-area:1/1"></i><i style="grid-area:2/2"></i><i style="grid-area:3/3"></i></div></div>`;
const G_GAME = `
<div class="brand"><span class="gem">🎲</span>Dice &amp; Deeds<span class="code">7GH6J9</span></div>
<div class="plates">
  <div class="plate on"><div class="av" style="--c:#e5484d">S</div><div><b>Sasha</b><span class="cash"><i class="coin"></i>1,240</span></div><span class="tag">YOUR TURN</span></div>
  <div class="plate"><div class="av" style="--c:#f5a623">J</div><div><b>Juno</b><span class="cash"><i class="coin"></i>860</span></div></div>
  <div class="plate"><div class="av" style="--c:#e0b400">🤖</div><div><b>Dice Bot</b><span class="cash"><i class="coin"></i>1,020</span></div><span class="tag dim">JAIL</span></div>
  <div class="plate"><div class="av" style="--c:#46a758">M</div><div><b>Marek</b><span class="cash"><i class="coin"></i>430</span></div></div>
</div>
<div class="glass deed">
  <div class="deed-top"><div class="lm">🕌</div><div><small>TURKEY · FOR SALE</small><h3>Istanbul</h3></div><span class="amt flat" style="font-size:16px"><i class="coin"></i>240</span></div>
  <div class="rents">
    <div class="rent"><span>RENT</span><b>$20</b></div><div class="rent"><span>FULL SET</span><b>$40</b></div><div class="rent"><span>1 HOUSE</span><b>$100</b></div>
    <div class="rent"><span>2 HOUSES</span><b>$300</b></div><div class="rent"><span>3 HOUSES</span><b>$750</b></div><div class="rent"><span>HOTEL</span><b>$1,100</b></div>
  </div>
  <div class="tip">💡 <b>Good buy</b> — starts your Turkey set, you keep $1,000.</div>
  <div class="deed-btns"><span class="gbtn buy" style="flex:1">BUY <i class="coin" style="margin:0 0 0 4px"></i>240</span><span class="gbtn pass">PASS</span></div>
</div>
<div class="glass side">
  <div class="side-tabs"><span class="on">📜 History</span><span>💡 Guide</span><span>🏙️ Cities</span></div>
  <div class="turnhdr"><i style="--c:#e5484d"></i>TURN 15 · SASHA · NOW</div>
  <div class="evt"><div class="ic">🎲</div><div><b>Sasha</b> rolled 4 + 3</div><span class="amt flat">7</span></div>
  <div class="evt"><div class="ic">🕌</div><div>Landed on <b>Istanbul</b></div><span class="amt flat"><i class="coin"></i>240</span></div>
  <div class="turnhdr"><i style="--c:#46a758"></i>TURN 14 · MAREK</div>
  <div class="evt"><div class="ic">💸</div><div><b>Marek</b> paid you rent · Madrid</div><span class="amt plus">+$180</span></div>
  <div class="turnhdr"><i style="--c:#e0b400"></i>TURN 13 · DICE BOT</div>
  <div class="evt"><div class="ic">🚔</div><div><b>Dice Bot</b> went to jail</div></div>
  <div class="turnhdr"><i style="--c:#f5a623"></i>TURN 12 · JUNO</div>
  <div class="evt"><div class="ic">➡️</div><div><b>Juno</b> passed GO</div><span class="amt plus">+$200</span></div>
  <div class="evt"><div class="ic">🏠</div><div><b>Juno</b> built on Osaka</div><span class="amt minus">−$50</span></div>
</div>
<div class="glass wallet"><small>YOUR CASH</small><b><i class="coin"></i>1,240</b></div>
<div class="glass dock">
  ${gDice}<div class="dock-info"><b>You rolled 7</b><span>Istanbul · decide to buy or pass</span></div>
  <span class="rbtn">🏗️<small>Build</small></span><span class="rbtn">🏦<small>Mortgage</small></span>
  <span class="gbtn gold off">END TURN</span>
</div>`;
const G_HOME = `
<div class="brand"><span class="gem">🎲</span>Dice &amp; Deeds</div>
<div class="hero">
  <span class="code" style="letter-spacing:.1em">● 2–6 PLAYERS · FREE · NO ACCOUNT</span>
  <h1 style="margin-top:20px">Dice <em>&amp;</em><br>Deeds</h1>
  <p>Roll, buy cities around the world, build — and bankrupt your friends on a real 3D board.</p>
  <div class="glass start" style="color:var(--text)">
    <div style="display:flex;gap:10px"><div class="field" style="flex:1">Sasha</div><span class="gbtn buy" style="height:52px">PLAY ▶</span></div>
    <div class="or">OR JOIN A ROOM</div>
    <div style="display:flex;gap:7px;align-items:center"><div class="cbox">X</div><div class="cbox">4</div><div class="cbox">K</div><div class="cbox" style="border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)"></div><div class="cbox"></div><div class="cbox"></div><span class="gbtn gold" style="height:54px;margin-left:auto">JOIN</span></div>
  </div>
</div>`;

const GAMES = {
  G1: {
    name: "G1 — Royal table",
    vars: { bg: "radial-gradient(1100px 760px at 40% 46%, rgba(70,92,220,.45), transparent 70%), linear-gradient(180deg,#151b40,#090c1e)", vignette: "rgba(0,0,0,.55)",
      panel: "rgba(22,28,66,.88)", edge: "rgba(245,196,81,.32)", text: "#f3f4ff", muted: "#9aa3d4", "on-table": "#f3f4ff", "on-table-muted": "#b9c0ea",
      accent: "#f5c451", accent2: "#e09a1b", accent3: "#a9781c", "accent-ink": "#3d2a00", "accent-soft": "rgba(245,196,81,.25)",
      chip: "rgba(255,255,255,.1)", "on-chip": "#f3f4ff", row: "rgba(255,255,255,.06)", tip: "rgba(245,196,81,.14)", "deed-top": "rgba(255,255,255,.06)", tray: "rgba(0,0,0,.35)",
      n1: "#3a4488", n2: "#2a3270", n3: "#1a2050", "n-ink": "#e9ebff", shadow: "0 18px 50px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)", "shadow-sm": "0 6px 18px rgba(0,0,0,.4)", "title-shadow": "rgba(0,0,0,.35)" },
    theme: gTheme({ slab: "#0f1430", tileSide: "#d9d2bd", bars: "#f5c451", rim: "#f5c451", glow: "rgba(245,196,81,0.55)", dieA: ["#f5c451", "#3d2a00"], dieB: ["#fbf8ef", "#1a1d33"],
      tile: "#fbf8ef", line: "#e2dac3", text: "#1a1d33", muted: "#5f6276", accent: "#c9962b", center: "#141a44", centerGlow: "rgba(90,110,255,0.45)", centerLine: "rgba(245,196,81,0.5)", title: "#f5c451", sub: "#aab2ee" }),
    lights: gLights("#dfe4ff", "#0b0e24", "#f5c451"), ground: 0.5,
  },
  G2: {
    name: "G2 — Felt table",
    vars: { bg: "radial-gradient(1100px 760px at 40% 46%, #2f9a70, #17563f 62%, #0d3526 100%)", vignette: "rgba(0,0,0,.45)",
      panel: "rgba(253,248,236,.96)", edge: "#dcc9a0", text: "#2a2118", muted: "#7c6a52", "on-table": "#fdf3d6", "on-table-muted": "#cfe6d8",
      accent: "#d9a441", accent2: "#b8862f", accent3: "#8a6420", "accent-ink": "#2a1c00", "accent-soft": "rgba(217,164,65,.35)",
      chip: "#f1e6cc", "on-chip": "#2a2118", row: "#f5ecd7", tip: "#fbefc9", "deed-top": "#f5ecd7", tray: "#14503b",
      n1: "#fffaf0", n2: "#eadcbd", n3: "#c4b08a", "n-ink": "#2a2118", shadow: "0 16px 40px rgba(0,0,0,.4), inset 0 1px 0 #fff", "shadow-sm": "0 6px 16px rgba(0,0,0,.3)", "title-shadow": "rgba(0,0,0,.3)" },
    theme: gTheme({ slab: "#4a2c1a", metal: 0.05, tileSide: "#dfd3b8", bars: "#d9a441", rim: "#d9a441", glow: "rgba(255,220,130,0.55)", dieA: ["#c0392b", "#ffffff"], dieB: ["#fdf9ef", "#2a2118"],
      tile: "#fdf9ef", line: "#e4d8bb", text: "#2a2118", muted: "#6e5d46", accent: "#b8862f", center: "#1b6147", centerGlow: "rgba(120,230,170,0.3)", centerLine: "rgba(253,243,214,0.45)", title: "#fdf3d6", sub: "#a8d9c0" }),
    lights: gLights("#fff4dc", "#0e3526", "#ffd98a"), ground: 0.45,
  },
  G3: {
    name: "G3 — Daylight",
    vars: { bg: "radial-gradient(900px 600px at 40% 40%, rgba(255,255,255,.85), transparent 70%), linear-gradient(180deg,#c9dcff 0%,#e3ddff 55%,#ffe3ef 100%)", vignette: "rgba(90,84,224,.12)",
      panel: "rgba(255,255,255,.94)", edge: "#e4e3fb", text: "#1d2140", muted: "#6d7299", "on-table": "#1d2140", "on-table-muted": "#4b5080",
      accent: "#6c5ce7", accent2: "#8f7bff", accent3: "#4a3cc0", "accent-ink": "#ffffff", "accent-soft": "rgba(108,92,231,.22)",
      chip: "#eeecff", "on-chip": "#2b2a63", row: "#f4f3ff", tip: "#fff4cf", "deed-top": "#f4f3ff", tray: "#d9d6f7",
      n1: "#ffffff", n2: "#ebeafb", n3: "#c4c1ea", "n-ink": "#1d2140", shadow: "0 14px 36px rgba(76,70,201,.2), inset 0 1px 0 #fff", "shadow-sm": "0 6px 16px rgba(76,70,201,.18)", "title-shadow": "rgba(108,92,231,.25)" },
    theme: gTheme({ slab: "#4b46c9", metal: 0.1, tileSide: "#d8d6f2", bars: "#4b46c9", rim: "#a29bff", glow: "rgba(108,92,231,0.45)", dieA: ["#ff6b6b", "#ffffff"], dieB: ["#ffffff", "#1d2140"],
      tile: "#ffffff", line: "#e4e3fb", text: "#1d2140", muted: "#5c6190", accent: "#6c5ce7", center: "#5a54e0", centerGlow: "rgba(255,255,255,0.3)", centerLine: "rgba(255,255,255,0.4)", title: "#ffffff", sub: "#d6d3ff" }),
    lights: gLights("#ffffff", "#cfd3ff", "#ffffff"), ground: 0.22,
  },
};
for (const [id, g] of Object.entries(GAMES)) {
  const make = (kind, body, camera, shift) => page({ title: `${g.name} · ${kind}`, css: G_CSS(g.vars), body, theme: g.theme, lights: g.lights, camera, shift, groundOpacity: g.ground })
    .replace("family=Inter:wght@400;500;600;700", "family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700")
    .replace('await Promise.all(["700 44px Inter",', 'await Promise.all(["700 44px Outfit", "800 190px Outfit", "700 44px Inter",');
  fs.writeFileSync(path.join(__dirname, `variant-${id}-game.html`), make("game", G_GAME, { fov: 27, pos: "2.8, 25.6, 21.2", look: "0.1, -0.9, 0.1" }, 150));
  fs.writeFileSync(path.join(__dirname, `variant-${id}-home.html`), make("home", G_HOME, { fov: 30, pos: "-1.4, 14.2, 19.2", look: "-5.6, -0.6, 1.4" }, 0));
  console.log("wrote", id);
}
