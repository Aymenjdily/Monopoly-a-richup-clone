# Phase 8 — In-game guide (variant G2: "Guide" tab)

Date: 2026-09-27. Design picked by the user: **G2** (`design/phase-8-guide/variant-G2-guide.png`).
The scope addition and the proposed computation approach (a pure engine advisor running on the
public client state) were presented with the design and accepted with the pick.

## Goal

A 💡 Guide tab in the game side card that tells the player what to do and why, in four
sections, each with a one-click action where it makes sense:

- **Do now:** buy or skip (with a verdict), roll, end turn, jail choice, raise cash.
- **Upgrade next:** where to build or unmortgage, with the cost and the rent before and after.
- **Watch out:** big opponent rents within one roll, with odds.
- **Good to know:** one or two context tips.

## Files inspected

`lib/engine/{ownershipRules,bots,board,types,settings}.ts`, `components/hud/{SideCard,history}.ts(x)`,
`app/room/[code]/GameView.tsx`, `design/phase-8-guide/*`, AGENTS.md sections 2 and 6.

## Decisions

1. **The advisor is `lib/engine/advisor.ts`:** pure, deterministic, unit-tested, next to
   `bots.ts`. It reuses `rentDue`/set helpers. It reads only public state (no decks, secrets or
   RNG) and never mutates. The client runs it on the state it already has. It's advice, not
   rule enforcement: the server still validates every action. AGENTS.md is updated to say so.
2. **Buy verdicts:**
   - "Must buy" when it completes a set.
   - "Block" when an opponent owns the rest of the set.
   - "Good buy" when it starts or extends a set and you keep a reserve.
   - "Good buy" for railways when you keep a reserve.
   - "Optional" for utilities.
   - "Risky" when cash after buying falls under the reserve.
   - "Can't afford" when you don't have the price.

   The reserve is $300 (money is always integers).
3. **Upgrades:**
   - Full, unmortgaged sets only. The next house goes on the tile the even-building rule allows
     (any tile if the rule is off).
   - Suggestions are ranked by rent gain per dollar, and 3 houses is called out as the sweet spot.
   - Only affordable while keeping the reserve; otherwise shown as "save up $X".
   - Unmortgaging a city that belongs to a full set is suggested when affordable.
   - With no full set, the nearest set is shown ("1 city away from Japan").
4. **Watch out:**
   - Every roll total 2–12 from your position (not in jail) is checked against the
     opponent-owned, rent-earning tile it lands on, weighted by that total's probability.
   - The top 2 by rent are shown, if the rent is at least $100 or 25% of your cash.
   - A warning appears when you couldn't cover the worst case.
5. **Jail:** pay early (few buildings on the board); stay late (6 or more opponent houses or
   hotels in play), and use a card if you have one.
6. **UI:**
   - The tabs become "📜 History · 💡 Guide · 🏙️ Cities · ⚙️" as in G2.
   - A mango dot appears on Guide when there's a "Do now" item on your turn.
   - Action buttons reuse the HUD `send()` path (StrictMode-safe, errors shown as a toast).

## Expected files

- `lib/engine/advisor.ts` and `advisor.test.ts` (new)
- `components/hud/GuidePanel.tsx` (new), `components/hud/SideCard.tsx`
- `AGENTS.md` (scope and boundary note), `lib/phases.ts` (phase 8), `design/phase-8-guide/README.md` (picked)

## Security

- The advisor reads only the sanitized client state. There's no new server surface or data,
  and actions still go through `game:action` with the secret.

## Acceptance criteria

- [ ] The Guide tab matches G2 at 1600×1000, and its sections update live each turn.
- [ ] Unit tests cover every buy verdict, the build target plus even-building, the danger odds,
      jail advice and the next step.
- [ ] One-click actions work in a real game (buy from the Guide, build from the Guide).
- [ ] lint, tsc, vitest and build pass; a browser run has no console errors.
