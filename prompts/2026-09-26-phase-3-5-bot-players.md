# Phase 3.5 — Bot players

Date: 2026-09-26 (extends Phase 3)
Phase doc: `PHASES.md` row 3.5. Project rules: `AGENTS.md` (decision 13 — added this phase).

## Goal

The host can fill empty lobby seats with bot players; bots then play their turns
automatically, server-side, so games with bots progress (including all-bot rooms and
human + bot mixes). No new DB tables, no client-visible secrets.

## Files inspected

- `AGENTS.md` (updated scope + decision 13), `PHASES.md`
- `lib/engine/lobby.ts`, `types.ts`, `engine.ts`, `lib/game/stateCodec.ts`
- `app/api/rooms/[code]/...` routes, `app/room/[code]/ui.tsx`

## Decisions and assumptions

- `Player.isBot: boolean` added to engine state (false for humans; set at add time).
- Pure bot policy in `lib/engine/bots.ts` (`botChoose(state) → GameAction | null`):
  roll in preRoll; use jail card first, else pay fine when money ≥ 100, else roll
  from jail; buy pending when cash ≥ price + 150 reserve, else decline; endTurn
  otherwise; bots never build/sell/mortgage (automatic liquidation covers debts).
- Turn driving is a memory-only scheduler in `lib/server/botRuntime.ts`: on room start
  and on every snapshot read (`GET /api/rooms/[code]`), if the current player is a bot
  and not already scheduled, a `setTimeout` applies its chosen action through
  `applyAction` and persists the state, then chains to the next bot (if any). Human
  turns break the chain (their actions kick it via future Phase 4 events, or the next
  snapshot read re-kicks it). Restart-safe by construction: nothing but the DB holds
  authoritative state.
- Tight-loop guard: per-game "last acted version" in module memory — a bot never acts on
  the same version twice.
- RNG for bot calls: seeded per game from a code hash + logSeq (clients never see it).
- Bots pick names from a fixed pool (`Bot Dice`, `Bot Rent`, …), color-assigned in join order.
- Add/remove bot: `POST /api/rooms/[code]/bot` and `POST /api/rooms/[code]/bot/remove`
  (host-only, lobby-only). Lobby UI: empty seat gains a "+ Add bot" dashed affordance
  for the host; bot chips show a BOT tag and a ✕ kick button (host only).
- No sockets yet (Phase 4): chain re-kicks on snapshot reads, which is enough for
  server-progress correctness; UI liveness is fine via existing 2.5s polling.

## Expected files to create or change

- `lib/engine/types.ts` — Player.isBot
- `lib/engine/lobby.ts` — addBot / removePlayer
- `lib/engine/bots.ts` (new) + `lib/engine/bots.test.ts`
- `lib/server/botRuntime.ts` (new)
- `app/api/rooms/[code]/bot/route.ts`, `app/api/rooms/[code]/bot/remove/route.ts`
- `app/api/rooms/[code]/start/route.ts` — kick scheduling after start
- `app/api/rooms/[code]/route.ts` — re-kick hook + isBot in view
- `lib/game/stateCodec.ts` — publicRoomView isBot
- `app/room/[code]/ui.tsx` — BOT tag, add/remove affordances
- `lib/phases.ts`, `PHASES.md` status

## Requirements list

1. Host-only bot add/remove, only in lobby phase, room cap 6 still enforced
2. Bots excluded from "invite" semantics but count as players for the 2-to-start gate
3. Bot turns progress automatically after start; consecutive bot turns chain; a bot
   never mutates the same engine version twice
4. Snapshot reads re-kick stalled bot turns (server restart safe)
5. Public view exposes isBot but not secrets/decks
6. Rejected bot actions never persist anything

## Security considerations

- Bots carry no client secrets (secret stays "")
- Scheduler state lives in module memory keyed by game id; engine state remains the only
  source of truth (sockets arrive in Phase 4 and will not change this).

## Acceptance criteria

- [ ] Lobby: host adds/kicks bots until room full; non-host attempts rejected 403
- [ ] All-bot room started: turns progress ≥ N rounds without human input (engine-visible in tests)
- [ ] botChoose: buy/decline reserve rule, jail card → fine → roll ordering, endTurn
- [ ] Rejected bot action leaves state byte-identical
- [ ] UI: BOT tag + host-only remove; "+ Add bot" only on empty seats for host

## Checks to run

1. `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`
2. Dev: create room, add 2 bots, start (from UI) → poll GET a few times → game version
   increases without any human action (log tail shows bot turns)

## Manual test steps

- Browser: home → create → add bot twice → start → observe players chips changinig money
  on subsequent GETs (or via GET curl loop).
