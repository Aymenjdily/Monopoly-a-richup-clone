# Phase 1 — Engine core

Date: 2026-09-26
Phase doc: `PHASES.md` Phase 1. Project rules: `AGENTS.md`.

## Goal

Build the pure game engine core: the typed 40-space board config, engine state types,
seeded RNG, integer money helpers, and the first slice of rule code — dice roll, legal
turn flow (preRoll/doubles/jail), tile-by-tile movement, and tile resolution for
non-property tiles (GO salary, tax, Go To Jail, Just Visiting, Free Parking, the four
"wasted" spaces). Property/rent/decks/building stay for Phase 2. Everything is pure
TypeScript, deterministic given the same RNG input, Vitest-covered.

## Files inspected

- `AGENTS.md` (sections 2, 6, 8, 9, 13) — server-authoritative engine, state shape, board config spec
- `PHASES.md` (Phase 1)
- `app/page.tsx`, `lib/phases.ts` — stub page consuming phase registry
- `package.json` / `tsconfig.json` — current scripts, no test runner yet

## Decisions and assumptions

- Engine lives in `lib/engine/` with no framework imports; exports pure functions.
- Board values follow classic Monopoly numbers; released AGENTS.md decision 9: start 1500,
  Go salary 200; jail fine 50 (classic standard).
- `doubles` grant a re-roll immediately in Phase 1 (the full turn-flow state machine evolves in Phase 2).
- RNG = mulberry32 over a number seed, threaded explicitly through applyAction inputs; the
  engine never calls `Math.random()`.
- Log events capped (ring buffer style, drop oldest) to keep state lean for the JSON column.
- Board is a frozen const array: `satisfies`-checked so bad configs fail typecheck.
- Tests mock RNG deterministically (no randomness in tests); for money: integers only.

## Expected files to create or change

- `lib/engine/types.ts` — state (phase, players, turn, dice, log), removal of irrelevant types
- `lib/engine/board.ts` — the 40 spaces config (names, groups, prices, rents, houseCost, mortgageValue, effects)
- `lib/engine/rng.ts` — mulberry32 + seeded dice pair helper
- `lib/engine/engine.ts` — `processAction(state, action, rng): { state, events }` for
  `roll` / `endTurn` — movement + non-property tile resolution + turn cycling
- `lib/engine/money.ts` — integer charge/credit helpers
- `vitest.config.ts`, `package.json` (add `test: vitest run`)
- `lib/engine/engine.test.ts`, `lib/engine/board.test.ts`, `lib/engine/money.test.ts`
- `app/page.tsx` (phase list updates: Phase 1 → done)

## Requirements list

1. Types: `GameState`, `Player`, `TurnState`, `LogEvent`, `GameAction`, `Rng`,
   `processAction` signature — exported from `lib/engine/types.ts`
2. Board: 40 spaces, index 0 is GO, classic layout per AGENTS.md section 9; every space: name, type, optional group/price/rent ladder/houseCost/mortgageValue/effects
3. `roll`: only legal when `turn.phase === "preRoll"` and current turn is on the caller;
   doubles re-roll (3rd doubles → jail); roll ends in `resolved`/`awaitingAction` per tile
4. Movement is tile-by-tile with Go salary when passing tile index 0 exactly once per pass
5. GO landing: +salary +pass bonus (docs rule: landing on GO pays salary+bonus; passing pays salary only)
6. Tax tiles charge fixed amounts into the log; Go To Jail moves to tile 10, resets doubles, flips inJail
7. endTurn advances to next non-bankrupt player — placeholder until Phase 2 bankruptcy
8. Rejected/illegal actions return `{ ok: false, error }` and cannot mutate state
9. Deterministic: same (state, action, rng) → same (state, events) every time

## Security considerations

- No player secret/identity logic yet (Phase 3/4); engine never touches DB/sockets
- Rule code is pure; server later becomes the only caller that seeds RNG (browser can't)

## Acceptance criteria

- [ ] Board has 40 spaces with correct classic layout (spot checks: tile 10 = Jail, tile 20 = Free Parking, tile 4/38 = tax)
- [ ] Legal roll → tile-by-tile movement with correct Go salary; doubles re-roll; 3rd doubles jail
- [ ] Illegal action (out-of-turn roll) rejected without state change
- [ ] Vitest suite covers: movement & Go salary, doubling flow, taxes, Go To Jail, turn cycling

## Checks to run

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npx vitest run`
4. `npm run build`

## Manual test steps

- `npx vitest run --coverage` (optional visual) or simply review the test list summary output.
- No manual browser test for this phase (no UI layer).
