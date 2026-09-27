# Home + lobby rework — variant D ("Toy diorama")

Status: **design gate open — waiting for a pick.** The locked C3 screens in
`design/selected/` (and the current `app/page.tsx` / `app/room/[code]/ui.tsx`) stay the
source of truth until then.

Goal: bring home and lobby into the same world as board rev 3
(`design/phase-5-board/variant-C2-board-v3.png`), so all three screens share one 3D look.
Palette and type are unchanged: ink, coral, mango, mint and lilac; Segoe UI Black; ink outlines;
hard shadows.

Shared 3D code: `design/shared/dd-diorama.js`. The board, pawn, dice and deck builders are
extracted from rev 3 and loaded as a classic script, so the mockups open from `file://`.
three.js r170 comes from a CDN for the mockups only.

## Home — `variant-D-home.html/png`
- Full-bleed live 3D board on the right, with dice caught mid-roll. A cream fade on the left keeps the UI calm.
- Logo in the same style as the board centre: white letters with an ink outline and a hard drop shadow. The "&" is coral.
- One compact play card:
  - Nickname and **Create room** on the same row.
  - Join-by-code as six mini tiles, each with a colour band like the board tiles.
- Feature chips replace the old bullet list.
- Same actions and copy as today: create, join and the reconnect note. No new features.

## Lobby — `variant-D-lobby.html/png`
- Seats are tile-shaped podiums on a stage slab, built like the board (ink base, coral stripe, cream top).
- Each player's glossy pawn uses their real `PLAYER_COLORS` token from `lib/engine/lobby.ts`.
- Bots get an antenna. "You" gets a mango glow on the floor.
- Empty seats show a ghost pawn and a dashed podium, with **+ Add bot** (host) / "or invite a friend".
- Name plates are DOM elements positioned from the 3D projection: HOST ★, BOT and ✕ (remove bot) badges.
- The header holds the room code as six mini tiles, plus a **Copy invite** button.
- The bottom dock has a seat meter, the status line and **START THE GAME · READY**.
  The non-host and not-seated states keep today's wording in this dock.
