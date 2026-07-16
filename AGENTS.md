# AGENTS.md

## Project Snapshot

Tile Turf is a browser game built with React 19, TanStack Start/Router, Vite, Tailwind CSS v4, and Pixi.js v8.

The main game lives in `src/components/IsoGrid.tsx`. It currently owns the Pixi application, tile ownership, player and bot entities, bot AI, hazards, pickups, minimap, HUD overlays, level progression, pause state, and tutorial state.

Gameplay model:

- The board is an 8x8 isometric grid.
- The player and bots jump between neighboring tiles and paint tiles with their skin color.
- Round points are banked by collecting chests; current painted tiles are shown separately in the HUD.
- Hazards and pickups include bombs, boots, and rotating arrows.
- Levels scale bot count and bot speed.
- Progress is stored in `localStorage` with `iso_unlocked_level`.

## Commands

Use Bun for this repo because `bun.lock` is present.

- Install dependencies: `bun install`
- Start dev server: `bun run dev`
- Production build: `bun run build`
- Yandex Games build: `bun run build:yandex`
- Yandex Games archive package: `bun run package:yandex`
- Test/static type gate: `bun run test`
- Lint: `bun run lint`
- Format: `bun run format`

Notes:

- `bun run build` may regenerate `src/routeTree.gen.ts`; do not edit that file manually.
- Route changes belong under `src/routes/*`. Review `src/routeTree.gen.ts` after `bun run build` and keep only generated TanStack Router output.
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already wires TanStack Start, React, Tailwind, aliases, and Cloudflare build behavior. Do not add duplicate Vite plugins there.
- The current source tree uses CRLF line endings in many files, while Prettier reports LF expectations. If asked to fix lint, do it as a deliberate formatting pass and expect a large mechanical diff.

## Local Agent Workflow

- `AGENTS.md` is the shared root instruction source for local agents.
- Keep `.agents/skills/archon` and `.claude/skills/archon` mirrored unless a provider-specific difference is documented inline.
- `.archon/commands`, `.archon/workflows`, `.archon/scripts`, and tracked `.archon/state/plan-status.yaml` are repo workflow files that should stay aligned with this guidance.
- Runtime logs and attempts under `.archon/state/autonomous-runs/` are generated local state and should stay ignored.
- Tokens, private keys, and platform credentials belong in ignored env files such as `.env`, `.env.local`, or `.archon/.env`, or in user/global Archon configuration. Do not put secrets in tracked commands, workflows, docs, or generated route files.

## Working Rules

- Before changing gameplay, read `src/components/IsoGrid.tsx` around the relevant system instead of assuming separations that do not exist yet.
- Keep per-frame and high-frequency values out of React state. Prefer Pixi objects, refs, local variables in the Pixi effect, and throttled React updates for HUD-only state.
- When adding timers, intervals, pointer listeners, keyboard listeners, or Pixi display objects, add matching cleanup in the existing teardown path.
- Avoid adding more unrelated responsibilities to `IsoGrid.tsx`. For non-trivial changes, extract pure helpers or small modules for game constants, grid math, entities, AI, scoring, or test hooks.
- Preserve mobile behavior: touch joystick, pinch zoom, safe-area insets, DPR cap, and coarse-pointer handling.
- Preserve accessibility for DOM HUD controls with labels and unique button names.
- Optimize image assets before adding more large PNGs. The current source assets are already about 6.7 MB.
- Do not use `Math.random()` directly in new deterministic test paths. Wrap randomness if a feature needs reproducible automated testing.

## Verification

For documentation-only changes, `git diff` review is usually enough.

For gameplay, UI, or rendering changes:

1. Run `bun run build`.
2. Run `bun run lint` unless the task explicitly avoids the existing CRLF formatting issue.
3. Smoke test locally in a browser:
   - open the level menu
   - start a level
   - move with keyboard
   - move with touch/pointer controls when relevant
   - pause and resume
   - collect or observe at least one item/hazard when the change touches gameplay
   - verify console errors

There is no dedicated automated game test suite yet. If you add one, prefer deterministic hooks such as `window.render_game_to_text()` and `window.advanceTime(ms)` so movement, timers, hazards, and win states can be asserted without real-time flakiness.

## Known Issues

- The first client render can produce a React hydration mismatch when `IsoGrid` reads tutorial state from `localStorage` during initial state setup. Treat SSR/client-only state carefully when changing menus, tutorial, or saved progression.
- `IsoGrid.tsx` is large and mixes game loop, rendering, UI, AI, scoring, and persistence. Refactor only around the feature being changed, and keep behavior covered by a browser smoke test.
- The landing copy in `src/routes/index.tsx` still says "Click any tile to paint it", but the current game is movement-based. Update it when touching the shell UI.

## Recommended Skills

Minimum useful skill set for future agents working on this game:

- `pixi-js` - Pixi v8 rendering, sprite lifecycle, batching, texture handling, mobile performance.
  Install candidate: `npx skills add https://github.com/mindrally/skills --skill pixi-js`
- `develop-web-game` - Iterative web game workflow with Playwright-driven action bursts, screenshots, and deterministic time stepping.
  Install candidate: `npx skills add https://github.com/openai/skills --skill develop-web-game`
- `frontend-design` - HUD, menus, tutorial overlays, responsive game UI, and visual polish.
- `react-vite-best-practices` - React/Vite performance, assets, code splitting, and build hygiene.
  Install candidate: `npx skills add https://github.com/asyrafhussin/agent-skills --skill react-vite-best-practices`
- `playwright` or local browser testing skills - Local browser smoke tests, screenshots, console checks, and interaction debugging.
  Install candidate: `npx skills add https://github.com/openai/skills --skill playwright`

Optional, use when the task fits:

- `vite` - Vite configuration, build output, SSR build behavior, and plugin decisions.
  Install candidate: `npx skills add https://github.com/antfu/skills --skill vite`
- `tanstack-router-best-practices` - Route structure, generated route tree rules, route context, and route typing.
  Install candidate: `npx skills add https://github.com/deckardger/tanstack-agent-skills --skill tanstack-router-best-practices`
- `imagegen` - New bitmap assets, sprites, backgrounds, icons, and visual variants when code-native assets are not enough.

## Ruflo / ToolSearch

Some inherited instructions mention Ruflo MCP tools such as `memory_store`, `memory_search`, `hooks_route`, `swarm_init`, and `agent_spawn`. Use them only when those tools are actually present in the active tool list. If they are not available, continue with the local repo, shell, browser, and installed skills.
