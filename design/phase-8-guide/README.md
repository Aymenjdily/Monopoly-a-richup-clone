# In-game guide (advisor) — variants G1–G3

Status: **PICKED: G2 (Guide tab)** — built 2026-09-27 (`lib/engine/advisor.ts`, `components/hud/GuidePanel.tsx`).
The variants are injected into the approved F3 HUD mockup by `build-variants.cjs` and rendered at 1600×1000.

## What the guide advises (same brain in every variant)
- **Buy or skip:** does the city start or complete a set you're building, how often players land
  there, and whether you keep a safe cash reserve after buying.
- **Upgrade:** which of your full sets to build on next. 3 houses is the best rent per dollar;
  the guide says how much it costs and what the rent becomes.
- **Watch out:** big rents (opponents' hotels and houses) within reach of your next roll, with the
  chance of hitting them.
- **Money trouble:** which city to mortgage first (the one that breaks no set), and when to
  unmortgage to build again.
- **Jail:** pay early in the game; stay in late game when the board is full of hotels.
- **Next step:** "roll", "end your turn", "resolve the buy first".
- A **Hints on/off** toggle for experienced players, remembered per device.

## Variants
- **G1 — Coach bubble:** one tip at a time next to your turn controls, with reasons (✓ / ✗),
  a one-click action, "Next tip" and a Hints toggle. It's the friendliest for beginners, but it
  takes board space while visible.
- **G2 — Guide tab:** a 💡 Guide tab in the side card with *Do now*, *Upgrade next*, *Watch out*
  and *Good to know*, each with an action button. It gives the full picture without covering the
  board, but you have to open the tab.
- **G3 — Inline hints:** verdicts where the decision happens ("👍 Good buy" on the deed card),
  pins on the board ("⚠ Juno's hotel · $1,000", "⬆ Build here") and a "Next:" line in the turn
  pill. It's the least extra UI and advice appears exactly in context, but only one line of "why".

## Decisions needed
1. **Scope.** AGENTS.md doesn't list a guide or advisor. It needs adding to the v1 scope.
2. **Where advice is computed.** AGENTS.md says the browser never computes *rules*. Advice isn't a
   rule (the server still validates every action), and it only uses public state, so the
   proposal is:
   - a pure `lib/engine/advisor.ts`, unit-tested and deterministic, alongside the existing
     `bots.ts` strategy code;
   - the client runs it on the state it already has.

   The alternative is for the server to compute advice per player and send it. That's more
   traffic and needs per-player socket messages, for no security gain, since there are no
   secrets involved.
