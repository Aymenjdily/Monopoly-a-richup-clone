# Phase 0 — Scaffold

Date: 2026-09-26
Phase doc: `PHASES.md` Phase 0. Project rules: `AGENTS.md`.

## Goal

Create the runnable empty shell of the project: a Next.js (App Router) + TypeScript +
Tailwind + ESLint app that boots with `npm run dev`, with Prisma wired to the single
`Game` model from AGENTS.md section 9, and the `prompts/` + `design/` folders that the
workflow depends on. Nothing game-related beyond the stub home page.

## Files inspected

- `AGENTS.md` — product, stack, decisions, traps, checks
- `PHASES.md` — phase order and design gate
- Workspace contains no other files (empty project, Node 24, npm 11 verified)

## Decisions and assumptions

- Scaffold with `create-next-app` non-interactive, then prune its extras, rather than
  hand-rolling every config file — best version fidelity, least drift.
- No Git in this folder yet; I will not run `git init` unless asked.
- `.env` is created from `.env.example` locally; user must fill real Neon URLs before
  `prisma migrate` can succeed. I will verify migrate only if the user provides URLs,
  otherwise report startable-but-needs-DATABASE_URL.
- Dev guides assumed accurate at current versions; I will re-check the installed
  versions' docs in `node_modules` after install (AGENTS.md section 5).
- Pin Prisma + Next; no other runtime deps in this phase. Vitest arrives in Phase 1;
  Socket.IO and R3F in their phases. Do not add them now (scope rule).

## Expected files to create or change

- `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
  `postcss.config.mjs`, `app/` (stub page + layout), `globals.css`
- `prisma/schema.prisma` — `Game` model exactly as AGENTS.md section 9 (`directUrl` on
  datasource), `prisma/generated` client output not committed by default output path
- `lib/prisma.ts` — shared server-side PrismaClient singleton (globalThis guard,
  dev hot-reload safe)
- `.env` (gitignored, local only), `.env.example`, `.gitignore`
- `prompts/`, `design/` (with `.gitkeep`), `app/page.tsx` stub pointing to PHASES.md order
- `npm` scripts: `build`, `dev`, `lint`; leave test/vitest for Phase 1

## Requirements list

1. Next.js App Router + TS + Tailwind (v4) + ESLint, non-interactive scaffold
2. Prisma schema with the single `Game` model; `directUrl` set; client generated
3. `lib/prisma.ts` singleton, no client-component imports of it
4. Stub home page states: title, link/outlined list of phases 0–7, note that game screens
   come in later phases
5. Placeholder markers for Phase 1+ folders (`lib/engine/`, `lib/shared/`,
   `components/`, `store/`) via `.gitkeep` so structure roots exist but stay empty
6. No game logic, no sockets, no 3D, no Vitest — out of phase scope

## Security considerations

- `.env` never committed; `.env.example` holds placeholder values only, no real URLs
- `lib/prisma.ts` is server-only (`import "server-only"`), so bundlers error if a client
  component ever imports it
- No `NEXT_PUBLIC_*` vars in this phase beyond the doc'd `NEXT_PUBLIC_APP_URL`

## Acceptance criteria

- [ ] `npm run dev` serves the stub page at `/` without errors
- [ ] `npm run lint` passes, `npx tsc --noEmit` passes
- [ ] `npm run build` completes
- [ ] `npx prisma generate` succeeds; `prisma migrate` ready (needs real DATABASE_URL
      from user — otherwise noted in report)
- [ ] `prompts/` and `design/` exist

## Checks to run

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run build`
4. `npx prisma generate`
5. `npm run dev` + fetch `/` (verify 200 + stub marker)

## Manual test steps

1. Open `http://localhost:3000` — stub page shows project name and phase list.
2. (after filling `.env` with Neon URLs) `npx prisma migrate dev --name init` creates
   the Game table; report output if run.
