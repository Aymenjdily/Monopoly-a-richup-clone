# Phase 6 — Game HUD (variant F3)

Date: 2026-09-27. Design picked by the user: **F3** (`design/phase-6-hud/variant-F3-hud.png`).
Replaces the temporary action strip in `app/room/[code]/GameView.tsx`.

## Goal

A DOM HUD around the 3D board, per AGENTS.md decision 11. It has four parts:

- **Player cards** across the top.
- **A tabbed side card**: History, My cities (build, sell, mortgage, unmortgage) and Rules.
- **A property deed card**: opens for the pending buy (Buy/Decline) and when any board tile
  is clicked (read-only details).
- **A compact turn pill** bottom-left: dice, Roll / End turn / Pay fine / Use card, plus
  rules chips (jackpot pot, cash, GO).

The browser still only renders state and sends `game:action`. The server decides.

## Files inspected

- `design/phase-6-hud/*`, `app/room/[code]/GameView.tsx`, `hooks/useGameSocket.ts`
- `lib/engine/{types,money,engine,board,settings}.ts`, `components/board3d/*`

## Decisions

1. History is derived from `state.log` only. "turn" events start groups. `amount` is signed
   (charge negative, credit positive), which gives the +/− pills. Icons come from the event
   kind plus text keywords. Filters: All, Money (entries with an amount), Moves (roll, move,
   jail, turn). The pure helper `components/hud/history.ts` is unit-tested.
2. Deed card data (rent ladder, house cost, mortgage value, set owners) comes from `BOARD`
   plus `state.ownership`. That's display data, not rule computation.
3. My cities lists my holdings with Build / Sell / Mortgage / Unmortgage. Buttons send
   actions, and the server's rejection message is shown as a toast. The client only hides
   buttons that can't apply (for example, no Build on railways).
4. Tile click comes from an R3F `onClick` on the tile meshes. Hovering a tile shows a pointer
   cursor. Pawns and props are not clickable.
5. On small screens the side card becomes a drawer, opened from a "📜" button, and the player
   row scrolls sideways. The desktop layout is exactly F3.
6. Fix the mis-encoded crown in the win log (`ðŸ‘‘` → 👑).

## Expected files

- `components/hud/{PlayerBar,SideCard,HistoryFeed,MyCities,RulesList,DeedCard,TurnPill}.tsx`
- `components/hud/history.ts` plus `history.test.ts`
- `app/room/[code]/GameView.tsx` (the HUD replaces the action strip)
- `components/board3d/{GameScene,BoardModel}.tsx` (`onTileClick`)
- `lib/engine/engine.ts` (crown mojibake), `lib/phases.ts` (phase 6 done), `design/phase-6-hud/README.md`

## Security

- No new data reaches the client. Every action still goes through `game:action` with the
  player's secret, and the server validates it. StrictMode double-send guard kept.

## Acceptance criteria

- [ ] The desktop layout matches F3 at 1600×1000
- [ ] History groups by turn with +/− pills, and the filters work
- [ ] The pending buy opens the deed card; Buy/Decline work; clicking a tile opens its deed
- [ ] My cities can mortgage/unmortgage, and server errors show as a toast
- [ ] lint, tsc, vitest and build pass; a two-tab run has no console errors

## Checks

`npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, plus a browser run.
