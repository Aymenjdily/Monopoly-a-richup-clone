# Phase 2 — Full rules

Date: 2026-09-26
Phase doc: `PHASES.md` Phase 2. Project rules: `AGENTS.md`. Builds on Phase 1 engine core.

## Goal

Complete the rule set from AGENTS.md section 2 inside the pure engine: property purchase
(buy vs decline), rent for properties/railroads/utilities, color-set bonuses, houses and
hotels (even-build rule), mortgage/un-mortgage, Chance and Community Chest decks, jail
player choices (pay fine / use card), debt handling with automatic asset liquidation to
creditors, bankruptcy, and win detection (last solvent player). Everything stays pure
TypeScript, deterministic, Vitest-covered. No sockets, no DB, no UI in this phase.

## Files inspected

- `AGENTS.md` (sections 2, 6, 8, 9, 10 action list)
- `PHASES.md` Phase 2
- `lib/engine/engine.ts`, `types.ts`, `board.ts`, `rng.ts`, `money.ts`, `engine.test.ts`

## Decisions and assumptions

- Actions implemented now: `buy`, `decline`, `build`, `sellBuilding`, `mortgage`,
  `unmortgage`, `payJailFine`, `useJailCard` (+ existing `roll`, `endTurn`).
  No auctions/trading (out of scope by decision 7).
- Declining a buyable simply ends the turn (no auction — v1 scope cut).
- Chance/Chest decks: fixed 16-card definitions each; deck order = shuffled index arrays
  in state, drawn from the front and recycled to the back (Get Out of Jail card is
  removed from circulation until used, same card returns to its deck bottom on use).
- "Advance/collect/move back" cards resolve via the same tile-resolution machinery; a card
  that sends you to Jail ends the turn.
- Jail entry by card/Go To Jail zeroes `doublesCount` and ends the turn; card-holders may
  `useJailCard` or `payJailFine` ($50) during `preRoll`, then roll normally.
- Rent: classic ladders; railroad 25/50/100/200 × owned; utility ×4 (one) / ×10 (both)
  of the dice that triggered landing. Monopoly (full color set) doubles base rent; house
  ladder values apply once houses exist. Rent never charges more than the debtor's cash —
  the shortfall becomes `pending.debt` (see below) and only then bankruptcy machinery runs.
- Debt flow: when a charge would exceed cash → `pending = { type: "debt", creditorId,
  amountDue, playerIdx }`; turn phase = `awaitingAction`. The player must mortgage/sell
  buildings (via normal actions) until cash ≥ amountDue, then the same charge is applied
  and turn proceeds. If cash can never cover the debt (nothing left to liquidate:
  liquidation ceiling reached), bankruptcy executes: buildings removed, properties torn
  down + mortgaged value credited, everything transfers to the creditor (or returns to
  bank/unowned when the creditor is the bank), player marked `bankrupt`, turn advances.
  Auto-liquidation order: sell houses on any owned property (cheapest first), then
  mortgage properties in buy order.
- Even-build rule enforced for build AND sell (same color group ± 1 house); hotels come
  from the 5th house; house supply is NOT tracked (no bank stock mechanic in v1 —
  documented simplification).
- Un-mortgage costs mortgageValue + 10% (rounded up), requires positive cash after payment.
- Win check after every bankruptcy: if exactly one solvent player remains → phase
  "finished", winner set. Also finishing conditions for future: none other in v1.
- `endTurn` remains valid in `awaitingAction` only when no `pending` debt exists.

## Expected files to create or change

- `lib/engine/types.ts` — add `Ownership`, `Decks`, `CardDrawn`, `pending`, extended
  `GameAction` union; extend `GameState` with `ownership`, `decks`, `pending`
- `lib/engine/board.ts` — unchanged values; export group membership helper
- `lib/engine/cards.ts` (new) — 16 Chance + 16 Community Chest definitions
- `lib/engine/ownershipRules.ts` (new) — rent computation, set detection, build/sell
  legality, liquidation value helpers
- `lib/engine/engine.ts` — wire the new actions + card resolution + debt/bankruptcy/winner
- `lib/engine/engine.test.ts` + new `cards.test.ts`, `ownershipRules.test.ts`
- `lib/phases.ts` + `app/page.tsx` statuses (Phase 2 → done)

## Requirements list

1. `buy` only when `pending.type === "buy"` and funds allow; deduct price, set ownership, log
2. `decline`/`endTurn` after resolve without purchase or debt: turn advances
3. Rent charged on landing on owned+unmortgaged space owned by another solvent player;
   owners collect their own tiles rent-free; mortgaged tiles collect nothing
4. Railroad/utility rent formulas; monopoly bonus for bare full sets
5. `build`/`sellBuilding`: legality via even build + full set + no mortgage in group;
   houseCost charged/refunded at half; correct ladder including hotel level
6. `mortgage`/`unmortgage`: immediate cash, no rent while mortgaged, unmortgage = 110%
7. Chance/Chest: draw from front, recycle drawn (except Jail card held), advance/collect/
   move-back/back-3 effects re-resolve landing effects; closest-player draw order is deterministic
8. Jail: `payJailFine` (needs $50, not 3rd-failed path), `useJailCard` (consumes one),
   both then roll normally in the same turn phase
9. `pending.debt` blocks other actions except mortgage/sellBuilding; bank debt uses
   `creditorId: "bank"`
10. Bankruptcy transfers assets to a player creditor (mortgage state preserved); bank
    creditor path returns properties to unowned; buildings removed
11. Win: single remaining solvent player → `phase: "finished"`, `winner` set, log entry
12. Rejections never mutate state (assert via `expect(result.state).toEqual(before)`)

## Security considerations

- Unchanged Phase 1: pure code, no IO, RNG injected. Deck order lives in state that only
  the server will ever hold; per-player filtering comes later (Phase 4) with explicit tests.

## Acceptance criteria

- [ ] Two-player game: land on unowned → `pending buy` → `buy` charges + owns; `decline` ends turn
- [ ] Landing on an owned property charges correct rent (ladder, monopoly, railroad counts, utility dice)
- [ ] Building works only with full set + even build; hotel at 5; sell refunds 50% reversed order
- [ ] Mortgage grants half price; unmortgaging costs exactly price/2 × 1.1 rounded up... (integer rule: ceil(0.55 × price) → implemented via `mortgageValue + ceil(mortgageValue/10)`)
- [ ] Chance "move back"/"advance" cards re-resolve target tile effects (rent on advance)
- [ ] Jail card count only changes via draw/use; pay fine path never leaves jail Turns incremented
- [ ] Debt: player with 0 cash after landing on rent → pending debt; mortgage enough → charge completes; cannot mortgage → bankruptcy transfer verified
- [ ] Winner declared when others gone bankrupt; finished phase blocks all actions
- [ ] All new actions reject cleanly out of turn/phase (state unchanged)

## Checks to run

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npx vitest run` (all existing 23 + new suites)
4. `npm run build`

## Manual test steps

- Review Vitest summary; no manual browser test (no UI yet).
