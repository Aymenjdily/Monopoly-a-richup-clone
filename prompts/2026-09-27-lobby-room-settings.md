# Lobby room settings (variant E2)

Date: 2026-09-27. Approved by the user: "build the E2 style" (design
`design/phase-6-lobby-settings/variant-E2-lobby.png`). The settings list and the AGENTS.md
change were proposed with the design and taken as approved with it.

## Goal

The host configures the room in the lobby from a "⚙ Room rules" sheet. The sheet sets
money (starting cash, GO salary), five rule toggles and max players. Everyone else sees
the same sheet read-only. Settings are part of the engine state (server-validated,
persisted, broadcast live), lock when the game starts, and change how the engine plays.

## Files inspected

- `lib/engine/{types,engine,lobby,ownershipRules,cards}.ts`, `lib/game/stateCodec.ts`
- `lib/shared/events.ts`, `app/api/rooms/[code]/*`, `app/room/[code]/ui.tsx`
- `design/phase-6-lobby-settings/*`, AGENTS.md sections 2, 8 (decision 9) and 9

## Decisions and assumptions

1. `GameState.settings?: RoomSettings` and `GameState.pot?: number` are both optional, so
   games saved before this change load with defaults (restart safety). All reads go
   through `settingsOf(state)`.
2. **Defaults = standard rules:** $1,500 cash, $200 GO, exact-GO bonus **off** (the
   `GO_SALARY_BONUS` constant was never wired up, so the design README said "on" by mistake),
   jackpot off, rent in jail on (current behaviour), even building on (current behaviour),
   random order off, max players 6.
3. **Starting cash** is applied to every player at `startGame`, so changing it after
   people have joined works.
4. **Exact GO bonus:** landing exactly on GO (by dice or card) pays one extra GO salary.
5. **Jackpot:** taxes, card fees paid to the bank and jail fines go to `pot`. Landing on
   Free Parking collects the whole pot. Buying, building and unmortgaging still go to the bank.
6. **Random order:** at start, players are shuffled with the server-seeded RNG. Colors keep
   their join order.
7. **Max players:** 2–6. It can't go below the number of seated players, and join/addBot
   respect it.
8. Settings can only be changed in the lobby, and only by the host (secret-checked). Each
   change bumps `version` and broadcasts.
9. AGENTS.md is updated: decision 9 now names the defaults as configurable, and a new
   "Room settings" subsection lists these as the only documented house rules.

## Expected files

- `lib/engine/settings.ts` (new) plus `settings.test.ts`
- `lib/engine/{types,engine,lobby,ownershipRules}.ts`
- `lib/game/stateCodec.ts`, `lib/shared/events.ts` (public view carries `settings`)
- `app/api/rooms/[code]/settings/route.ts` (new)
- `components/ui/RulesSheet.tsx` (new), `app/room/[code]/ui.tsx`
- `AGENTS.md`, `design/phase-6-lobby-settings/README.md`

## Security

- The server validates every value against a whitelist. Unknown keys and values outside the
  allowed options are rejected, and a rejected patch never changes state.
- Settings are not secret. Deck order, RNG and player secrets stay stripped as before.

## Acceptance criteria

- [ ] The host opens the sheet, changes values, saves, and the other tab sees them without a reload
- [ ] The non-host sheet is read-only; editing via the API as a non-host returns 403
- [ ] $2,000 start cash → every player starts with $2,000; GO $300 is paid when passing GO
- [ ] Unit tests cover each rule toggle, max players and validation
- [ ] lint, tsc, vitest and build pass

## Checks

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, plus a two-tab browser run.
