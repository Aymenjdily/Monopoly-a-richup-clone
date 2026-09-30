// Restyle mockups: themeable 3D board (classic script so it loads from file://).
// RS.build({ THREE, RoundedBoxGeometry, renderer, scene, theme }) builds the demo game board.
window.RS = (function () {
  const C = 1.6, S = 1.0, W = 2 * C + 9 * S, H = W / 2, GAP = 0.06, PX = 256;

  const T = [
    { k: "go" }, { k: "city", c: "IT", n: "Sicily", p: 60 }, { k: "chest" }, { k: "city", c: "IT", n: "Milan", p: 60 },
    { k: "tax", n: "Income Tax", p: 200 }, { k: "rail", n: "Trans-Sib", p: 200 }, { k: "city", c: "JP", n: "Kyoto", p: 100 },
    { k: "chance" }, { k: "city", c: "JP", n: "Osaka", p: 100 }, { k: "city", c: "JP", n: "Tokyo", p: 120 }, { k: "jail" },
    { k: "city", c: "TH", n: "Phuket", p: 140 }, { k: "util", n: "Power Grid", p: 150 }, { k: "city", c: "TH", n: "Chiang Mai", p: 140 },
    { k: "city", c: "TH", n: "Bangkok", p: 160 }, { k: "rail", n: "Orient Exp.", p: 200 }, { k: "city", c: "ES", n: "Seville", p: 180 },
    { k: "chest" }, { k: "city", c: "ES", n: "Madrid", p: 180 }, { k: "city", c: "ES", n: "Barcelona", p: 200 }, { k: "parking" },
    { k: "city", c: "TR", n: "Antalya", p: 220 }, { k: "chance" }, { k: "city", c: "TR", n: "Izmir", p: 220 }, { k: "city", c: "TR", n: "Istanbul", p: 240 },
    { k: "rail", n: "Eurostar", p: 200 }, { k: "city", c: "DE", n: "Cologne", p: 260 }, { k: "city", c: "DE", n: "Munich", p: 260 },
    { k: "util", n: "Water Works", p: 150 }, { k: "city", c: "DE", n: "Berlin", p: 280 }, { k: "gotojail" },
    { k: "city", c: "BR", n: "Salvador", p: 300 }, { k: "city", c: "BR", n: "Rio", p: 300 }, { k: "chest" }, { k: "city", c: "BR", n: "São Paulo", p: 320 },
    { k: "rail", n: "Shinkansen", p: 200 }, { k: "chance" }, { k: "city", c: "US", n: "Miami", p: 350 }, { k: "tax", n: "Luxury Tax", p: 100 },
    { k: "city", c: "US", n: "New York", p: 400 },
  ];
  const COUNTRY = { IT: "Italy", JP: "Japan", TH: "Thailand", ES: "Spain", TR: "Turkey", DE: "Germany", BR: "Brazil", US: "USA" };
  // engine PLAYER_COLORS (Radix-like): red, amber, yellow, green
  const PLAYERS = { sasha: "#e5484d", juno: "#f5a623", bot: "#f7cf3c", marek: "#46a758" };
  const OWN = { 1: "marek", 3: "marek", 6: "juno", 8: "juno", 9: "juno", 12: "sasha", 15: "juno", 16: "sasha", 18: "sasha", 19: "sasha", 21: "bot", 25: "marek", 37: "bot" };
  const HOUSES = { 6: 2, 8: 2, 9: 1, 16: 3, 18: 3, 19: 5 };
  const MORTGAGED = { 37: true };
  const ACTIVE = 24;
  const PAWNS = [["sasha", 24], ["juno", 0], ["marek", 18], ["bot", "jail"]];

  function place(i) {
    if (i === 0) return { x: H - C / 2, z: H - C / 2, w: C, d: C, side: "corner" };
    if (i === 10) return { x: -H + C / 2, z: H - C / 2, w: C, d: C, side: "corner" };
    if (i === 20) return { x: -H + C / 2, z: -H + C / 2, w: C, d: C, side: "corner" };
    if (i === 30) return { x: H - C / 2, z: -H + C / 2, w: C, d: C, side: "corner" };
    if (i < 10) return { x: H - C - (i - 0.5) * S, z: H - C / 2, w: S, d: C, side: "bottom" };
    if (i < 20) return { x: -H + C / 2, z: H - C - (i - 10.5) * S, w: C, d: S, side: "left" };
    if (i < 30) return { x: -H + C + (i - 20.5) * S, z: -H + C / 2, w: S, d: C, side: "top" };
    return { x: H - C / 2, z: -H + C + (i - 30.5) * S, w: C, d: S, side: "right" };
  }

  function build({ THREE, RoundedBoxGeometry, renderer, scene, theme }) {
    const th = theme;
    const ANISO = renderer.capabilities.getMaxAnisotropy();
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });
    const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
    const tex = (w, h, draw) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
    };
    const rr = (ctx, x, y, w, h, r, fill, stroke, lw = 2) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    const fit = (ctx, text, maxW, size, weight, font) => {
      let s = size;
      do { ctx.font = `${weight} ${s}px ${font}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 14);
    };

    // ── slab ──
    const slab = mesh(new RoundedBoxGeometry(W + 0.6, 0.36, W + 0.6, 6, 0.16), std(th.slab, { roughness: th.slabRough ?? 0.5, metalness: th.slabMetal ?? 0.1 }));
    slab.position.y = -0.2; scene.add(slab);
    if (th.edgeGlow) {
      // thin rim light: a hairline peeking out under the slab edge
      const ring = new THREE.Mesh(new RoundedBoxGeometry(W + 0.63, 0.025, W + 0.63, 6, 0.17), new THREE.MeshBasicMaterial({ color: th.edgeGlow, toneMapped: false }));
      ring.position.y = -0.36; scene.add(ring);
    }
    // centre plate
    const CEN = W - 2 * C - 0.08;
    const cen = mesh(new THREE.PlaneGeometry(CEN, CEN), std("#fff", { map: tex(2048, 2048, (ctx, w, h) => th.center(ctx, w, h, rr)), transparent: true, roughness: 0.9 }), false);
    cen.rotation.x = -Math.PI / 2; cen.position.y = 0.002; scene.add(cen);

    // ── tiles ──
    for (let i = 0; i < 40; i++) {
      const P = place(i), t = T[i];
      const lift = i === ACTIVE ? 0.05 : 0;
      const body = mesh(new RoundedBoxGeometry(P.w - GAP, 0.08, P.d - GAP, 3, 0.03), std(th.tileSide, { roughness: 0.6 }));
      body.position.set(P.x, 0.04 + lift, P.z); scene.add(body);
      const cw = Math.round((P.w - GAP) * PX), ch = Math.round((P.d - GAP) * PX);
      const owner = OWN[i] ? PLAYERS[OWN[i]] : null;
      const face = mesh(new THREE.PlaneGeometry(P.w - GAP, P.d - GAP), std("#fff", {
        map: tex(cw, ch, (ctx, w, h) => th.tile(ctx, w, h, { t, P, owner, mortgaged: MORTGAGED[i], active: i === ACTIVE, country: t.c && COUNTRY[t.c] }, { rr, fit })),
        transparent: true, roughness: th.tileRough ?? 0.75,
      }), false);
      face.rotation.x = -Math.PI / 2; face.position.set(P.x, 0.082 + lift, P.z); scene.add(face);
      if (i === ACTIVE && th.activeGlow) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(P.w + 0.5, P.d + 0.5), new THREE.MeshBasicMaterial({
          map: tex(256, 384, (ctx, w, hh) => { const gr = ctx.createRadialGradient(w / 2, hh / 2, 10, w / 2, hh / 2, 180); gr.addColorStop(0, th.activeGlow); gr.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, hh); }),
          transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
        }));
        g.rotation.x = -Math.PI / 2; g.position.set(P.x, 0.004, P.z); scene.add(g);
      }
    }

    // ── buildings: minimal blocks ──
    const inset = 0.2;
    for (const [k, n] of Object.entries(HOUSES)) {
      const i = +k, P = place(i), owner = PLAYERS[OWN[i]];
      const bc = P.side === "bottom" ? [P.x, P.z - P.d / 2 + inset] : P.side === "top" ? [P.x, P.z + P.d / 2 - inset] : P.side === "left" ? [P.x + P.w / 2 - inset, P.z] : [P.x - P.w / 2 + inset, P.z];
      const horiz = P.side === "bottom" || P.side === "top";
      const mat = th.building(THREE, owner);
      if (n === 5) {
        const b = mesh(new RoundedBoxGeometry(0.42, 0.34, 0.2, 2, 0.03), mat); b.position.set(bc[0], 0.08 + 0.17, bc[1]); if (!horiz) b.rotation.y = Math.PI / 2; scene.add(b);
        continue;
      }
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * 0.2;
        const b = mesh(new RoundedBoxGeometry(0.14, 0.16, 0.14, 2, 0.025), mat);
        b.position.set(bc[0] + (horiz ? off : 0), 0.08 + 0.08, bc[1] + (horiz ? 0 : off)); scene.add(b);
      }
    }

    // ── pawns ──
    const prof = [[0, 0], [0.22, 0], [0.23, 0.04], [0.16, 0.09], [0.11, 0.16], [0.085, 0.34], [0.12, 0.37], [0.12, 0.4], [0.07, 0.42], [0, 0.42]].map(([r, y]) => new THREE.Vector2(r, y));
    const pawnGeo = new THREE.LatheGeometry(prof, 48), headGeo = new THREE.SphereGeometry(0.12, 32, 20);
    const by = {};
    PAWNS.forEach(([id, w]) => (by[w] = by[w] || []).push(id));
    for (const [w, ids] of Object.entries(by)) {
      let cx, cz, lift = 0;
      if (w === "jail") { const P = place(10); cx = P.x + 0.25; cz = P.z - 0.25; }
      else { const P = place(+w); cx = P.x; cz = P.z + (P.side === "bottom" ? 0.2 : 0); if (+w === ACTIVE) lift = 0.05; }
      ids.forEach((id, k) => {
        const g = new THREE.Group(), m = th.pawn(THREE, PLAYERS[id]);
        g.add(mesh(pawnGeo, m)); const hd = mesh(headGeo, m); hd.position.y = 0.52; g.add(hd);
        g.position.set(cx + (k - (ids.length - 1) / 2) * 0.36, 0.083 + lift, cz); g.scale.setScalar(1.05);
        scene.add(g);
        if (+w === ACTIVE && th.ring) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: th.ring, toneMapped: false }));
          ring.rotation.x = Math.PI / 2; ring.position.set(g.position.x, 0.09 + lift, cz); scene.add(ring);
        }
      });
    }
    // jail bars (thin)
    { const P = place(10), x0 = P.x - 0.02, z0 = P.z - 0.62, cell = 0.6, m = std(th.bars, { metalness: 0.6, roughness: 0.3 });
      for (let k = 0; k <= 6; k++) for (const [bx, bz] of [[x0 + (k / 6) * cell, z0 + cell], [x0 + cell, z0 + (k / 6) * cell]]) {
        const b = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 8), m); b.position.set(bx, 0.28, bz); scene.add(b); } }

    // ── dice ──
    const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] };
    const die = (body, pip, faces, x, z, ry) => {
      const s = 0.55, g = new THREE.Group();
      g.add(mesh(new RoundedBoxGeometry(s, s, s, 5, 0.09), new THREE.MeshPhysicalMaterial({ color: body, roughness: 0.3, clearcoat: 0.6 })));
      const pg = new THREE.CircleGeometry(0.045, 24), pm = new THREE.MeshStandardMaterial({ color: pip, roughness: 0.4, emissive: th.pipGlow ? pip : "#000", emissiveIntensity: th.pipGlow ? 0.8 : 0 });
      [[0, 1, 0], [0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, -1, 0]].forEach((d, fi) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...d));
        PIPS[faces[fi]].forEach(([a, b]) => { const p = new THREE.Mesh(pg, pm); p.position.set(a * 0.14, b * 0.14, s / 2 + 0.002).applyQuaternion(q); p.quaternion.copy(q); g.add(p); });
      });
      g.position.set(x, s / 2, z); g.rotation.y = ry; scene.add(g);
    };
    die(th.dieA[0], th.dieA[1], [4, 2, 6, 5, 1, 3], -0.45, 1.6, 0.4);
    die(th.dieB[0], th.dieB[1], [3, 5, 1, 2, 6, 4], 0.4, 1.45, -0.25);
  }

  return { build, place, W };
})();
