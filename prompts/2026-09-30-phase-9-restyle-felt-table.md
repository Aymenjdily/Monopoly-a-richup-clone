# Phase 9 — Restyle to "G2 · Felt table"

Date: 2026-09-30. Design picked by the user: **G2** (`design/phase-9-restyle/variant-G2-game.png`
and `variant-G2-home.png`) after the dark, light, mixed and game-feel rounds.

## Goal

Replace the toy/outline look with the G2 game look across the whole app, with no change to
rules, server or protocol:

- **Table and board:** a green felt table, and a walnut-framed board with a felt centre and cream tiles.
- **Panels:** cream parchment panels with brass accents.
- **HUD:** player plates with avatars and coin balances, the property as a docked card, a dice
  tray dock, and a "Your cash" counter.
- **Buttons and type:** chunky bevelled buttons (green BUY/PLAY, gold JOIN/END TURN/START) and the Outfit font.

## Files inspected

`app/{globals.css,layout.tsx,page.tsx}`, `app/room/[code]/{ui,GameView}.tsx`, `components/hud/*`,
`components/ui/*`, `components/sound/*Toggle.tsx`, `components/board3d/*`, `design/phase-9-restyle/*`.

## Decisions

1. **Tokens** live in `globals.css` (Tailwind v4 `@theme`):
   - Colours: felt, walnut, parchment, row, tip, line, muted, brass, plus buy, gold and neutral button ramps.
   - Shared component classes: `.panel`, `.gbtn` (+ `-buy`, `-gold`, `-neutral`, `-danger`), `.coin`, `.bg-table`.
   - The old token names (`ink`, `cream`, `mango`, `mint`, `coral`, `lilac`) are re-pointed to the
     G2 palette, so untouched utilities stay coherent.
2. **Font:** Outfit via `next/font/google` (500–800) as the app font. Canvas textures read the
   family from the `--font-outfit` CSS variable and re-paint once the font has loaded.
3. **Board theme** (visual only):
   - Walnut slab with a brass rim, and a felt centre plate with dashed brass lines and a cream title.
   - Cream tiles with thin tan outlines instead of thick ink ones.
   - Kept from earlier picks: neutral-until-owned bands, owner tint and landmark art.
   - Pawns lose the ink outline hull.
   - Dice are red and ivory, houses deep green, hotels deep red.
4. **Game HUD layout** follows the G2 mock:
   - Brand and room code top-left, with the player plates beside them.
   - The deed card docked top-left, opened by the pending buy or a tile click (a modal on small screens).
   - The side card on the right (History · Guide · Cities · Rules).
   - Wallet bottom-left and the dock bottom-centre (dice tray, status, Build/Mortgage, primary action).
5. **Lobby** (not in the G2 mock): the same language on the existing layout. Felt background,
   a walnut and brass stage with a felt top, parchment header and dock, and a gold START button.
6. Behaviour, sounds, guide logic, presence and leave are all unchanged. Only markup and classes change.

## Expected files

`app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/room/[code]/{ui,GameView}.tsx`,
`components/hud/{PlayerBar,DeedCard,TurnPill,SideCard,GuidePanel,bits}.tsx`,
`components/ui/{CodeTiles,RulesSheet,SeatList}.tsx`, `components/sound/{SoundToggle,MusicToggle}.tsx`,
`components/board3d/{theme,textures,BoardModel,pieces,SceneBase,LobbyStage,DiceRoll,HomeScene,Tokens}.tsx|ts`.

## Security

UI only. No new data, routes or env vars.

## Acceptance criteria

- [ ] Home and game match the G2 mocks at 1600×1000; the lobby is consistent with them.
- [ ] Every existing flow still works: create, join, bots, rules sheet, start, roll, buy from
      the card, guide actions, build, mortgage, leave, the winner screen and the phone layouts.
- [ ] lint, tsc, vitest and build pass; browser runs have no console errors.

## Implementation notes (post-build)

- **Tiles keep the earlier picks:** landmark art, the neutral band, and owner colour and tint. The
  G2 mock's tiles were simpler, but those were explicit user choices.
- **Decks stay on the board** (brass Chance, cream Community), although the mock centre had none.
- **Lobby:** restyled in the same language (it has no G2 mock). Stage is walnut and brass with a felt top.
- **Phones:** the deed card becomes a modal, the side card a drawer, the wallet is hidden
  (cash shows on your plate), and the lobby uses the seat grid.
- **Lint:** `.kilo/**` (another tool's worktree copy in the repo folder) is ignored by ESLint.
