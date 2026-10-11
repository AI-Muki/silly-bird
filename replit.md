# Silly Bird

A responsive Flappy Bird-style arcade game with click, tap, Space controls, scoring, and a local top-five leaderboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/flappy-bird/src/App.tsx` — canvas game loop, controls, scoring, collision detection, and leaderboard persistence
- `artifacts/flappy-bird/src/index.css` — game visual system, overlays, responsive layout, and motion
- `.github/workflows/ci-cd.yml` — GitHub Actions typecheck, build, artifact upload, and Pages deployment

## Architecture decisions

- The game runs entirely in the browser with a `requestAnimationFrame` loop, so gameplay stays immediate and does not need a backend.
- Canvas renders the moving world while React owns accessible overlays, score state, controls, and leaderboard forms.
- Best scores and leaderboard entries use `localStorage`, keeping the game playable without account setup.
- The static Vite build is deployable to GitHub Pages through the repository workflow.

## Product

- Play with click, tap, or Space
- Navigate moving pipe gaps with gravity-based flight
- Track current and personal-best scores
- Save a name to a local top-five leaderboard
- Restart quickly after game over

## User preferences

- The user requested click and Space controls and a leaderboard after losing.

## Gotchas

- The frontend Vite config requires `PORT` and `BASE_PATH` when run outside the managed Replit workflow.
- GitHub Pages builds use the repository name as the Vite base path.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
