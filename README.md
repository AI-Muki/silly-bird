# Silly Bird

Silly Bird is a polished Flappy Bird-style arcade game built with React, TypeScript, Vite, and a custom canvas game loop. Guide the bird through the pipe gaps, beat your best score, and save your name to the local top-five leaderboard.

## Features

- Click, tap, or press **Space** to flap
- Smooth gravity, jump physics, moving pipes, and collision detection
- Score tracking with a personal best saved in the browser
- Local top-five leaderboard with player names
- Responsive game surface for desktop and mobile
- Restart flow after game over
- GitHub Actions CI/CD with typechecking, production builds, and GitHub Pages deployment

## Controls

| Action | Control |
| --- | --- |
| Flap | Click, tap, or **Space** |
| Start | Click **Start sprint** or use **Space** |
| Restart | Click **Fly again** or use **Space** after game over |

## Run locally

Requirements: Node.js 24 and pnpm.

```bash
pnpm install
pnpm --filter @workspace/flappy-bird run dev
```

The Replit workflow provides `PORT` and `BASE_PATH` automatically. To run Vite directly:

```bash
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/flappy-bird run dev
```

Open the local URL printed by Vite.

## Quality checks

```bash
pnpm --filter @workspace/flappy-bird run typecheck
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/flappy-bird run build
```

## CI/CD

The workflow in `.github/workflows/ci-cd.yml` runs on pull requests and pushes to `main`. It installs the locked dependencies, runs the workspace typecheck, builds the game, and uploads the production bundle.

Every successful push to `main` also deploys the built game to GitHub Pages. Enable Pages for the repository with **GitHub Actions** as the source if it is not already enabled.

## Project structure

```text
artifacts/flappy-bird/
├── src/App.tsx       # Game loop, controls, scoring, and leaderboard
├── src/index.css     # Visual system and responsive layout
└── vite.config.ts    # Vite configuration
```
