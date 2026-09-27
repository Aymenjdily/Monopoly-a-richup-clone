# Phase 5 — 3D board

Date: 2026-09-26
Phase doc: `PHASES.md` Phase 5. Project rules: `AGENTS.md` (section 10 animation rules,
decision 11/12). Builds on Phases 2/4 (engine + sync).

## Goal

Render the 40-tile board from `lib/engine/board.ts` as a R3F scene that reflects live
engine state: tiles, tokens (one per player), tile-by-tile movement animation, 3D dice,
houses/hotels meshes, fixed default camera with limited OrbitControls. Everything derives
from state — no mesh data in engine state (AGENTS.md trap 8).

## Design gate (this phase, round 1)

Three art-direction variants are produced as PNG moodboards in
`design/phase-5-board/` (isometric mockups rendered from generated SVG, same process
as Phase 3). They differ in camera character, materials/palette, tile shape and
token style. **No 3D code until the user picks one.** The chosen PNG becomes the
visual source of truth for the scene (same rule as Phase 3).

- Variant A — "Classic felt": warm wooden rail + felt bed, saturated group colors,
  rectangular tiles, sober camera (~55°).
- Variant B — "Neon club": charcoal board + glowing tile edges, dark center, moody rim light (~70° steep).
- Variant C — "Toon field" (C3 sibling): cream world, chunky rounded tiles with ink
  outlines, playful camera (~40°), pawn tokens match lobby players.

## Files inspected

- `AGENTS.md` section 10 (3D animation rules), decision 11/12; `PHASES.md` Phase 5
- `lib/engine/board.ts` (board data), `lib/engine/types.ts`, `hooks/useGameSocket.ts`
- `design/selected/*` (locked C3 UI, for consistency of variant C)

## Decisions and assumptions

(stated for the post-pick implementation round; design gate runs first)

- `@react-three/fiber` + `@react-three/drei` only, three as transitive dep; versions
  checked against React 19/Next 16 during install.
- Scene components derive exclusively from sanitized `game:state` payloads delivered
  by the Phase 4 socket hook; no second data source.
- Token movement animates step-by-step between adjacent tile centers (duration ~150ms
  per step, queue drained per state change).
- Dice: decorative roll animation (~700ms) with the server's dice pair as result truth.
- Houses/hotels: small meshes per owned property scaled-in via spring; hotel = bigger
  piece; mortgaged = grayed/plank overlay.
- Camera: fixed default isometric per chosen variant; OrbitControls limited in
  polar/azimuth + zoom; no pan.
- WebGL availability check with a clear error screen (AGENTS.md decision 10).
- Canvas is `ssr:false` dynamic import.

## Expected files to create or change (post-pick)

- `app/play/[code]/page.tsx` + `app/play/[code]/PlayClient.tsx` — canvas screen
- `components/board3d/*` (new) — Scene, BoardRing, Tile3d, Token, DiceMesh, Buildings
- `components/board3d/palette.ts` — chosen variant palette (locked PNG values)
- `hooks/useGameBoard.ts` — game:state → board-facing view model (tiles/tokens)
- `package.json` — three, @react-three/fiber, @react-three/drei
- `lib/phases.ts`, `PHASES.md` statuses

## Requirements list (post-pick)

1. Tiles laid out per board index order in a ring; group colors + name labels (readable
   at typical zoom), GO/Jail/Parking/GoToJail special-cased per chosen art direction
2. Tokens mildly offset when several share a tile; ownership/rent renders via buildings
3. `game:state` vN → batch animation: tokens step, dice roll once per state change
4. Camera/OrbitControls: default per variant; polar angle clamped; zoom clamped
5. All action buttons remain in the 2D overlay (HUD in Phase 6)

## Security considerations

- Scene consumes only the sanitized state already broadcast (no decks/secrets); no new
  env vars; nothing persisted.

## Acceptance criteria (post-pick)

- [ ] `/play/[code]` shows the live board for a started room, tokens animate
- [ ] Same sanitized promise again tested (no secret/deck strings in state)
- [ ] Checks: lint, tsc, vitest, build, manual two-tab animation check

## Checks to run (this turn)

Design gate only: three PNGs + README in `design/phase-5-board/`, presented to the user.
