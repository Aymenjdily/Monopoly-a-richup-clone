# Phase 3 — Rooms + persistence

Date: 2026-09-26
Phase doc: `PHASES.md` Phase 3. Project rules: `AGENTS.md`. Builds on Phase 1–2 engine.

## Goal

Room lifecycle over Prisma: create a room (6-char code), join by code and nickname,
host launches the game, state round-trips safely through the JSON column (restart
safety). Server-only secrets handling. The UI screens are produced through the design
gate — three PNG variants (home + lobby) rendered from static mockups; UI pixel work
waits for the user's pick per section 8 of PHASES.md.

## Files inspected

- `AGENTS.md` (decisions 4–6, 9, traps 7/8/9), `PHASES.md` Phase 3 + design gate
- `prisma/schema.prisma` (single Game table), `lib/prisma.ts`, `lib/engine/engine.ts`

## Decisions and assumptions

- Room ops (join/leave/start) are engine-state mutations that bypass the action interface,
  because `applyAction` is the per-turn rule interface; lobby math stays pure in
  `lib/engine/lobby.ts` (version bump owned by the room service).
- `createState` gains a `phase` option ("lobby" default with no players vs "playing").
  Keep Phase 1–2 behavior intact via a wrapper.
- Join codes use an unambiguous alphabet (no 0/O/I/L/1) with DB collision retry.
- player secrets: node crypto random hex, 32 chars, generated server-side only, never
  broadcast; every public view strips them (plus decks).
- JSON roundtrip trap: JSON.stringify turns numeric ownership keys into strings —
  `stateCodec.ts` (pure) does serialize → deserialize remapping, the ONLY sanctioned
  boundary between `state` column and engine state.
- All endpoints run on the Node runtime using the pg driver adapter.
- No sockets yet (Phase 4). Routes are the transport for Phase 3 manual tests.

## Expected files to create or change

- `lib/engine/lobby.ts` (new) — lobby state, join/leave/start as pure functions
- `lib/game/stateCodec.ts` (new) — serialize/deserialize/public room view
- `lib/server/secrets.ts` (new) — node-crypto secret + player-id generators
- `app/api/rooms/route.ts` (POST create), `app/api/rooms/[code]/route.ts` (GET view),
  `app/api/rooms/[code]/join/route.ts` (POST), `app/api/rooms/[code]/start/route.ts` (POST)
- `lib/engine/lobby.test.ts`, `lib/game/stateCodec.test.ts`
- `design/phase-3-screens/variant-{A,B,C}-{home,lobby}.html` + `scripts/shoot-designs.ps1`
  → PNGs into the same folder (design gate deliverables)
- `lib/phases.ts` statuses

## Requirements list

1. POST /api/rooms {name} → 201 { code, gameId, playerId, secret }
2. POST /api/rooms/[code]/join {name} → 200 { playerId, secret } | 404 | 409 full/started
3. POST /api/rooms/[code]/start {playerId, secret} → 200 (host only, ≥2 players) | 403
4. GET /api/rooms/[code] → public room view (no secrets, no decks)
5. Restart safety: all reads from Postgres each request; server holds no state in memory
6. Status transitions written to Game.status on start
7. Version bump on every committed room mutation

## Security considerations

- Secrets come from node crypto, stored in the engine state JSON, stripped in every GET
- `lib/prisma.ts` is server-only; client cannot reach these routes' internals
- No new env vars (AGENTS.md section 12 unchanged)

## Acceptance criteria

- [ ] Lobby: join until 6/join efter start fails (409), host pass on leave, colors in join order
- [ ] State survives 2× JSON roundtrip with ownership keyed numerically
- [ ] GET room view exposes zero secrets/decks (property-level diff test)
- [ ] Routes compile; create→join→start verified live against real DB when `.env` is filled
- [ ] Design gate: 3 coherent PNG variants (home + lobby each) delivered with README

## Checks to run

1. `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`
2. Dev server + curl the routes (result depends on real DATABASE_URL — report honestly)

## Manual test steps

- Create → join (second nickname) → start → join again must fail; restart `npm run dev`
  between steps and fetch the room again (load from DB).
- Open the variant PNGs and pick one for the UI implementation.
