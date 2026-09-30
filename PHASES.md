# PHASES.md

Build order for this project. **AGENTS.md comes first** — it defines the product, the
boundaries, and the workflow that applies inside every phase below. This file only adds
the sequence and one extra rule: the design gate.

Each phase becomes exactly one implementation prompt file in `prompts/`
(`YYYY-MM-DD-phase-N-<name>.md`), reviewed and approved before any code. No phase starts
until the previous phase is done and its checks have real output.

---

## The design gate (applies before every UI phase)

Before building any phase that produces user-facing visuals, you must present design
variants for me to pick from. You do not design freely by default.

1. Build **2–4 static design variants** for the screens of the phase (as plain HTML +
   Tailwind mockups, no app code).
2. Render each variant to a **PNG** (headless browser screenshot script) and save to
   `design/phase-N-<name>/variant-A.png`, `variant-B.png`, … with a short `README.md`
   naming what differs between variants.
3. **Stop. Present the PNGs. I pick one before any implementation starts.**
4. The picked PNG becomes the reference image. Per AGENTS.md section 4, it is the source
   of truth, reproduced exactly.

Rule: **no pixel of app UI is written while its phase design is still unpicked.**
Non-UI phases (engine, persistence, sockets) have no design gate.

---

## Phase 0 — Scaffold

- **Goal**: runnable empty shell — Next.js App Router + TS + Tailwind, ESLint, Prisma
  wired with the `Game` model from AGENTS.md section 9, `prompts/` and `design/` folders.
- **Deliverables**: `npm run dev` serves a stub home page; `npx prisma migrate dev` works
  against `.env` `DATABASE_URL`; lint + tsc pass.
- **Depends on**: nothing.
- **Design gate**: no (nothing visual to review yet — stub page only).

## Phase 1 — Engine core

- **Goal**: pure engine per AGENTS.md section 6 — board config (40 spaces), state types,
  money helpers, seeded RNG, roll + movement + tile resolution skeleton.
- **Deliverables**: `lib/engine/board.ts`, `lib/engine/types.ts`, first rule code +
  Vitest suite (movement, Go salary, dice doubling).
- **Depends on**: Phase 0.
- **Design gate**: no.

## Phase 2 — Full rules

- **Goal**: complete rule set from AGENTS.md section 2 — buy/decline, rent, sets, houses,
  hotels, mortgage, decks, tax, jail, bankruptcy, win detection.
- **Deliverables**: finished `lib/engine/`; Vitest covering buy/rent, build rules, jail,
  bankruptcy, doubling (AGENTS.md section 13 requirement).
- **Depends on**: Phase 1.
- **Design gate**: no.

## Phase 3 — Rooms + persistence

- **Goal**: room create/join/start via server routes over Prisma; join codes; host rules;
  restart safety (state loads from Postgres, never memory-only).
- **Depends on**: Phase 2.
- **Design gate**: **yes — lobby + home screen design variants first.**

## Phase 4 — Real-time sync

- **Goal**: Socket.IO on the Next HTTP server, typed events in `lib/shared/events.ts`,
  per-player filtered views, versioned sync, action queue, reconnect (AGENTS.md section 10).
- **Depends on**: Phase 3.
- **Design gauge**: no (protocol only; tested with two headless socket clients).

## Phase 5 — 3D board

- **Goal**: R3F scene — board from `BoardSpace[]`, tokens, tile-by-tile movement
  animation, 3D dice, houses/hotels meshes, fixed camera + limited OrbitControls.
- **Depends on**: Phase 2 (can run parallel to Phase 4 offline against recorded states).
- **Design gate**: **yes — board look & feel variants (camera angle, materials, tile
  styling) first.**

## Phase 6 — Game HUD

- **Goal**: DOM overlays per AGENTS.md section 8 decision 11 — player list, action
  buttons, game log, property card modal, WebGL-missing error screen.
- **Depends on**: Phase 4, Phase 5.
- **Design gate**: **yes — HUD layout variants (panel positions, action bar style,
  modal card design) first.**

## Phase 7 — Full loop + polish

- **Goal**: playable start to finish; reconnect and restart-safety verified in-browser;
  responsive behavior; game-over screen.
- **Depends on**: all above.
- **Design gate**: only if new screens appear (game-over → yes).
- **Checks**: the full manual test list in AGENTS.md section 13 item 5, with real output.

---

## Phase status

Track here. Update after each shipped phase.

| Phase | Status | Prompt file | Picked design |
| ----- | ------ | ----------- | ------------- |
| 0 Scaffold | done | [prompts/2026-09-26-phase-0-scaffold.md](prompts/2026-09-26-phase-0-scaffold.md) | — |
| 1 Engine core | done | [prompts/2026-09-26-phase-1-engine-core.md](prompts/2026-09-26-phase-1-engine-core.md) | — |
| 2 Full rules | done | [prompts/2026-09-26-phase-2-full-rules.md](prompts/2026-09-26-phase-2-full-rules.md) | — |
| 3 Rooms + persistence | done — UI live vs Neon | [prompts/2026-09-26-phase-3-rooms-persistence.md](prompts/2026-09-26-phase-3-rooms-persistence.md) | C3 (replaced by D, then G2; removed) |
| 3.5 Bot players | done | [prompts/2026-09-26-phase-3-5-bot-players.md](prompts/2026-09-26-phase-3-5-bot-players.md) | — |
| 4 Real-time sync | done | [prompts/2026-09-26-phase-4-realtime-sync.md](prompts/2026-09-26-phase-4-realtime-sync.md) | — |
| 5 3D board + home/lobby rework | done | [prompts/2026-09-27-phase-5-3d-board-and-ui-rework.md](prompts/2026-09-27-phase-5-3d-board-and-ui-rework.md) | C2 rev 3 board, D home/lobby |
| Lobby room settings | done | [prompts/2026-09-27-lobby-room-settings.md](prompts/2026-09-27-lobby-room-settings.md) | E2 rules sheet |
| 6 Game HUD | done | [prompts/2026-09-27-phase-6-game-hud.md](prompts/2026-09-27-phase-6-game-hud.md) | F3 |
| Sound effects + lobby music | done | [prompts/2026-09-27-sound-effects.md](prompts/2026-09-27-sound-effects.md), [prompts/2026-09-27-lobby-music.md](prompts/2026-09-27-lobby-music.md) | — |
| 7 Presence, leave, locks | done | [prompts/2026-09-27-phase-7-presence-leave-locks.md](prompts/2026-09-27-phase-7-presence-leave-locks.md) | — |
| 8 In-game guide | done | [prompts/2026-09-27-phase-8-guide.md](prompts/2026-09-27-phase-8-guide.md) | G2 guide tab |
| 9 Restyle: felt table | done | [prompts/2026-09-30-phase-9-restyle-felt-table.md](prompts/2026-09-30-phase-9-restyle-felt-table.md) | G2 felt table |
| 10 Jev bots + personalities | done | [prompts/2026-09-30-phase-10-jev-bots.md](prompts/2026-09-30-phase-10-jev-bots.md) | — |
| Roll pacing | done | [prompts/2026-09-30-roll-pacing.md](prompts/2026-09-30-roll-pacing.md) | — |
