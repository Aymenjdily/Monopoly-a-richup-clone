# Phase 9 — Visual restyle ("less childish", Linear / shadcn / dev-tool) — variants V1–V3

Status: **design gate open — waiting for a pick. User direction: light mode.** The light candidates are
**V1 light** (`variant-V1L-*`), **V2** (`variant-V2-*`, already light) and **V3 light** (`variant-V3L-*`).
The dark V1 and V3 files are kept for reference only.
Every variant is a real three.js render (not a flat mock) of the same demo game, at 1600×1000:
`variant-Vx-game.png` (the board plus HUD mid-turn) and `variant-Vx-home.png`.
Sources: `board-scene.js` (a themeable board builder) and `build-variants.cjs` (pages and themes).

Unchanged in all three: the game, board layout, cities, flags and neutral-until-owned tiles
(ownership shows as a thin owner-coloured strip), and the F3/G2 information architecture
(players, activity, guide, deed info, turn actions). Only the visual language changes.

## V1 — Linear dark
- Near-black `#08090a`, hairline `#23252a` borders, one indigo accent `#5e6ad2` and a soft indigo glow.
- Type: Inter for UI and JetBrains Mono for numbers. Keyboard hints on buttons (`B`, `D`, `E`, `⌘K`).
- Board: graphite slab with an indigo rim light, dark tiles, a faint grid in the centre, glossy
  pawns, and owner-tinted glowing blocks for buildings.
- HUD: breadcrumb top-left, deed "inspector" card, a right panel with Players plus underline tabs
  (Activity · Guide · Cities · Rules), and a floating command bar.

## V2 — shadcn light
- Zinc and white, 1px `#e4e4e7` borders, a black primary button, a segmented tab control, soft shadows.
- Board: a ceramic-white slab with white tiles, crisp black type and matte pieces. It reads like a product render.
- HUD: a top nav with player badges, a Guide card column on the right, and the buy decision as a
  proper dialog (with overlay).

## V3 — Dev-tool mono
- Dark `#05080b` with a dot grid, a mint `#3ee6c4` accent with glow, and everything in JetBrains Mono.
- Board: a metallic slab with a mint rim, emissive buildings and dice pips, and "dice&deeds▮" on the centre plate.
- HUD: "windows" (`players.ts`, `istanbul.json`), a timestamped `game.log`, and a command line
  ("› buy istanbul ▮  run ↵") in place of buttons.
- This is my read of a dev-tool style like typesafe.ai; there's no reference image for it.

## Light versions (added 2026-09-30)
- **V1 light — Linear:** off-white `#fbfbfc` with hairline `#e6e6ea` borders and the same indigo `#5e6ad2`
  accent. White tiles on a pale slab with a thin indigo rim, and the same HUD with light panels and soft shadows.
- **V3 light — dev-tool:** paper `#f6f8f7` with a teal dot grid, teal `#0d9488` accent, monospace, white
  "windows" and code colours (teal/amber/violet), plus a teal rim on the board.
- **Known mockup limit:** at the far camera the smallest tile labels (country, price) are faint on white.
  The build would enlarge tile metadata and use a heavier weight for light themes.

## If picked
- A plan in `prompts/` covering design tokens (CSS variables in `globals.css`), a restyle of the
  HUD and lobby components, a board theme (materials, lights, tile painter) and a restyle of the
  lobby stage.
- No engine, server or protocol changes. Sound, guide and rules stay as they are.
- Open question: a light/dark toggle (for example V1 and V2 together) would be a scope addition,
  since it isn't in AGENTS.md.

## Mixed versions (added 2026-09-30, after "looks so much white")
All three use the V1-light HUD (white panels, indigo accent, keyboard hints). They differ in where the dark goes:
- **M1 — Graphite board** (`variant-M1-*`): a cool-grey tinted page, the dark graphite board with its indigo rim, and white panels.
- **M2 — Night table** (`variant-M2-*`): a dark navy "table" background with an indigo glow, a bright white board, and white panels floating above.
- **M3 — Two-tone board** (`variant-M3-*`): a tinted page and a board with a dark frame and a dark centre plate, ringed by white tiles. One die is indigo.

## Game-feel versions (added 2026-09-30, after "looks so professional, not game looking")
Same information and layout logic, presented as a game:
- A table background with a vignette, and a framed board with a centre emblem.
- Avatar plates with coin balances, and the property as a card with a rent grid.
- Chunky bevelled buttons (green BUY, gold JOIN / END TURN), a dice tray, and a "Your cash" counter.
- The Outfit display font.

The three versions:
- **G1 — Royal table** (`variant-G1-*`): deep navy with gold trim; ivory tiles on a navy board with a gold rim.
- **G2 — Felt table** (`variant-G2-*`): green felt, a walnut-framed board with a felt centre, cream panels and brass accents.
- **G3 — Daylight** (`variant-G3-*`): a light sky gradient, glossy white panels, and an indigo-framed board with white tiles (the light-mode option).

Known mockup limit: the smallest tile labels are faint at the far camera. The build enlarges them.
