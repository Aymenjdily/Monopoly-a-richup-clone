# Design variants — Phase 5 (3D board)

Status: **design gate open — no pick yet.** Rendered at 1600×1000 with headless Edge.

- **A — Classic felt**: `variant-A-board.html/png`
- **B — Neon club**: `variant-B-board.html/png`
- **C — Toon field**: `variant-C-board.html/png`
- **C2 — Toon field, extruded, flag cities (rev 1)**: `variant-C2-board.html/png` (superseded)
- **C2 rev 2**: `variant-C2-board-v2.html/png` (CSS 3D; superseded)
- **C2 rev 3 — Toy diorama**: `variant-C2-board-v3.png` (default camera) + `variant-C2-board-v3-close.png` (close-up), source `variant-C2-board-v3.html` (current candidate)

## C2 rev 2 — what changed vs rev 1

- Geometry fixed: 9 tiles per side between four 128px corners (no overlapping corner, no
  row overrun); tile order matches `lib/engine/board.ts` index order.
- Real depth: board slab and tiles are extrusions (ink rim with coral pinstripe), and houses
  are boxes with pitched roofs. The hotel is a coral block, the dice are cubes and the card
  decks are stacks.
- Pawns are camera-facing and stand upright on the tiles. When several pawns share a tile
  they fan out. The active player's tile has a mango glow and a "YOUR TURN" plate.
- Flags drawn as SVG (Windows has no flag emoji — rev 1 showed "TR", "JP" text).
- Tile anatomy: color band on the center-facing edge (houses sit on it), flag, city name
  (auto-fit), and a price pill. The pill takes the owner's color once the tile is owned.
  Mortgaged = hatched face + "MORTGAGED" pill.
- Railroads get a lilac track band; Chance, Chest, Tax and Utility tiles are tinted with an icon.
- Corners: GO (mint, big return arrow), Jail (bars cell + "just visiting" rim), Free
  Parking (lilac), Go To Jail (coral).
- Camera: rotateX 42°, rotateZ −8°, text upright to the default seat on all sides.
- Palette and type follow the locked C3 UI (`design/selected/`).

## C2 rev 3 — Toy diorama (real three.js render)

- Rendered with actual three.js (r170, CDN, mockup only), so the PNG shows exactly what the
  R3F scene can produce: soft shadows (PCF soft), RoomEnvironment reflections, neutral tone mapping.
- Board = rounded slab (ink base, coral pinstripe, cream top); tiles = rounded blocks with
  canvas-texture tops (same anatomy as rev 2, flags drawn on canvas).
- Glossy clearcoat lathe pawns with an ink outline hull; green houses with prism roofs,
  coral hotel; rounded dice with real pips; stacked card decks; 3D jail bars around the cell.
- Active tile is lifted with a mango glow, a ring under the pawn and a Sasha / YOUR TURN sprite.
- Camera: perspective fov 27, 3/4 view from the GO side; close-up shot via `?shot=close`.
