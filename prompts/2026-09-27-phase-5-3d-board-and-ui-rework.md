# Phase 5 build — 3D board + home/lobby rework (variant D)

Date: 2026-09-27
Approved by user ("ok go for the build") after the design gate:
- Board: `design/phase-5-board/variant-C2-board-v3.png` (+ `-close.png`), source `variant-C2-board-v3.html`
- Home: `design/phase-6-ui-rework/variant-D-home.png`, Lobby: `variant-D-lobby.png`
- Shared mockup builder: `design/shared/dd-diorama.js`

Supersedes the "post-pick" half of `prompts/2026-09-26-phase-5-3d-board.md`.

## Goal

Ship the 3D board as a real R3F scene, driven only by the sanitized `game:state` the
Phase 4 socket already delivers. It covers tiles, pawns that walk tile-by-tile, dice that
tumble and land on the server's values, houses and hotels, ownership, mortgage and the
active-turn highlight, and a fixed camera with limited orbit. Also rebuild the home and
lobby screens to the approved variant D, which reuses the same 3D pieces. The room route
switches from lobby to board when the game starts.

## Files inspected

- `AGENTS.md` (sections 4, 5, 6, 10, 11), `PHASES.md` phases 5–6, `lib/phases.ts`
- `hooks/useGameSocket.ts`, `hooks/protocol.ts`, `lib/shared/events.ts`
- `lib/engine/{types,board,cards,lobby}.ts`, `lib/game/stateCodec.ts`
- `app/page.tsx`, `app/room/[code]/{page,ui}.tsx`, `app/globals.css`, `app/layout.tsx`
- `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` (ssr:false must be
  called from a Client Component — done that way)
- npm peers: fiber 9.8 (react >=19 <19.4), drei 10.7, three 0.186 → compatible with React 19.2.8

## Decisions and assumptions

1. **Deps**: `three`, `@react-three/fiber@9`, `@react-three/drei@10`, `@types/three`. No zustand yet:
   the socket hook already is the thin state mirror, so adding a store would be a parallel
   source of truth (AGENTS.md section 14).
2. **Route**: `/room/[code]` keeps one socket. It renders the lobby while `status === "lobby"`
   and the game view once playing or finished. No separate `/play` route.
3. **Themed names**: `lib/engine/board.ts` space names become the approved city names
   (Sicily … New York; railroads Trans-Sib, Orient Exp., Eurostar, Shinkansen; utilities
   Power Grid, Water Works). Only the names change. Prices, rents, indices and types stay
   the same. Card texts in `cards.ts` that name streets are updated to match.
   Country codes, icons and pastel palette are **visual only** and live in
   `components/board3d/theme.ts`, not in the engine.
4. **Player colors**: the server's `PLAYER_COLORS` stay the truth. The board and lobby color
   pawns from `colorToken` (the board mockup's pastel pawns were illustrative).
5. **Animation** (client decoration only; server state is the truth):
   - Pawns walk forward one tile at a time, about 140 ms per step, with a small hop. If the
     move is more than 12 steps or backwards (jail, cards), they jump straight there.
   - The dice tumble for about 750 ms when a new `roll` log event arrives, then settle with
     the server's dice values face-up.
6. **Camera**: perspective fov 27, pose from the v3 mockup, scaled back on narrow aspect
   ratios. drei `OrbitControls` with no pan and clamped polar, azimuth and distance.
7. **Lighting**: key directional light with PCF soft shadows (2048 map), hemisphere fill, a
   RoomEnvironment PMREM at 0.55, neutral tone mapping. All match the mockup.
8. **Tile faces**: tile tops are CanvasTextures drawn on the client (flags, names, price pill
   in the owner's color, mortgage hatch), cached per (index, owner color, mortgaged).
9. **Temporary action strip**: the Phase 6 HUD is still behind its design gate, but manual
   testing (AGENTS.md section 13) needs someone to roll. The game view therefore gets a
   minimal bottom strip, built only from existing tokens:
   - Controls: Roll, Buy, Decline, End turn, Pay fine, Use card, plus whose turn and money.
   - It only calls `sendAction`. It is marked `TEMPORARY – replaced by Phase 6 HUD`.
10. **WebGL missing**: a clear error card is shown instead of the canvas (decision 10).
11. **Home page 3D**: a live board scene, lazy-loaded with `ssr:false` and `frameloop="demand"`,
    so it renders once and costs nothing idle. Below `lg` the scene sits behind the card and is dimmed.
12. **Lobby 3D**: the podium stage in R3F. Seat labels and buttons use drei `<Html>` anchored
    under each podium, so they stay aligned at any size.

## Expected files to create or change

- `package.json` / lock — three, @react-three/fiber, @react-three/drei, @types/three
- `lib/engine/board.ts`, `lib/engine/cards.ts` — themed names (data only)
- `components/board3d/theme.ts` — per-space visuals (country, icon, short name, band color), palette
- `components/board3d/textures.ts` — canvas drawing: flags, tile faces, corners, center, deck tops, pips
- `components/board3d/pieces.tsx` — Pawn, House, Hotel, Die, Deck (shared by board, home, lobby)
- `components/board3d/layout.ts` — tile placement math (pure, unit-tested)
- `components/board3d/BoardModel.tsx` — slab, tiles, center, decks, jail bars, buildings, glow
- `components/board3d/Tokens.tsx` — animated pawns
- `components/board3d/DiceRoll.tsx` — tumbling dice
- `components/board3d/SceneBase.tsx` — lights, environment, shadow ground
- `components/board3d/GameScene.tsx` — Canvas for the live game (camera, orbit), WebGL check
- `components/board3d/HomeScene.tsx` — home hero scene (demo state, dice mid-roll)
- `components/board3d/LobbyStage.tsx` — podium stage with Html seat labels
- `components/board3d/webgl.ts` — capability check
- `app/page.tsx` — variant D home
- `app/room/[code]/ui.tsx` — variant D lobby + switch to game view
- `app/room/[code]/GameView.tsx` — board + temporary action strip
- `app/globals.css` — only what variant D needs (font stack, tile-code utility)
- `components/board3d/layout.test.ts` — placement/path tests
- `lib/phases.ts`, `PHASES.md` — phase 5 status

## Requirements

1. All 40 tiles render from `BOARD` in index order with the approved anatomy. Corners are GO,
   Jail (with 3D bars), Parking and Go To Jail.
2. Ownership, houses (1–4), hotel and mortgage display follow `state.ownership`.
3. One pawn per non-bankrupt player, colored by `colorToken`. Pawns sharing a tile fan out, and
   players in jail stand inside the cell.
4. The current player's tile glows, with an Html "YOUR TURN" or "<name>'s turn" plate.
5. Each new state batches the animations: pawns walk, and dice tumble once per new roll event.
6. The camera and controls stay clamped. There are no action buttons inside the 3D scene.
7. Home: create and join still work exactly as before (same APIs, same localStorage identity).
8. Lobby: code copy, add and remove bot (host only), join a seat when not seated, start (host,
   2+ players), and the waiting states are all kept.
9. The canvas is always `dynamic(..., { ssr:false })` from a client component, and overlays use
   `pointer-events` correctly.

## Security considerations

- The scene reads only the sanitized `ClientGameState`: no secrets, decks or RNG. There are no
  new env vars and no Prisma access from the client. Action strip buttons send `game:action`
  through the existing hook, so the server still validates everything.
- The engine change is limited to display names and card text.

## Acceptance criteria

- [ ] Home, lobby and board visually match the approved PNGs at 1600×1000 (desktop)
- [ ] Two tabs: create → join → add bot → start → roll; pawns walk and dice land on the server values
- [ ] Buying shows the owner pill color; building shows houses (via a test state or play)
- [ ] Restart the server mid-game, reload, and the board restores from the snapshot
- [ ] lint, tsc, vitest and build pass

## Checks to run

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, then the dev server with a
two-tab manual run.

## Manual test steps

1. `npm run dev`, open `/`, check the 3D board renders on the right, create a room.
2. Open the lobby: podiums show; add two bots; the ✕ removes one.
3. A second tab joins by code; both lobbies update live.
4. Host starts: the room switches to the board.
5. Roll: dice tumble, the pawn walks, buy, End turn. Bots take their turns automatically.
6. Stop and restart the server, reload: the board restores at the current version.

## Implementation notes (post-build, 2026-09-27)

Deviations and fixes found during the browser test. The first three are Phase 4 bugs that
only showed up once a real browser connected:

1. `hooks/useGameSocket.ts` connected to `/api/socket` (the boot route) instead of the
   Socket.IO path `/api/socketio`, so browsers never received live state. It now uses `SOCKET_PATH`.
2. The same hook's "late identity" effect depended on the identity *object*, which the
   lobby recreates on every render. That caused an endless `state:request` loop. It now
   depends on `identity.playerId` only.
3. Lobby routes (join, bot, bot/remove, start) saved state without broadcasting, so the
   lobby only looked live because of loop 2. They now call `broadcastGame` after saving.
4. drei `<Html>` was dropped. Its per-element React roots crash on unmount under React 19
   ("synchronously unmount a root", `removeChild`). The turn plate is a canvas sprite, and
   lobby labels are DOM placed from projected 3D anchors.
5. Below 768px the lobby shows the stacked seat grid instead of the podium row. The
   desktop design is unchanged.
6. `shadows="percentage"`: three r186 removed PCFSoftShadowMap.
7. User follow-up (2026-09-27): tiles are **neutral by default**, with no set colors. A bought
   property, railway or utility takes the owner's token color on its band, a soft face tint,
   an inner rim and the 3D tile edge. Sets are recognised by country flag. Each city shows a
   landmark (`CITY_LANDMARK` in `components/board3d/theme.ts`), chosen by the user from
   three options.
8. Fixed mis-encoded dashes (`â€”`) in `lib/engine/engine.ts` log text (from an earlier phase).
