# Remaining Plan

## 1. Make `bun run lint` usable as a gate

- Run a deliberate formatting pass for repo-wide CRLF/Prettier issues.
- Expect a large mechanical diff.
- Re-run `bun run lint` after formatting and verify no non-formatting errors remain.

## 2. Continue splitting `IsoGrid.tsx`

`src/components/IsoGrid.tsx` is still large, even after extracting constants and pure helpers.

Next extraction targets:

- Pixi application lifecycle and asset loading.
- Input systems: keyboard, pointer drag joystick, pinch zoom.
- HUD and modal UI components.
- Bot AI.
- Minimap rendering.
- Pickup and hazard systems.

Keep each extraction behavior-preserving and smoke test after each meaningful step.

## 3. Maintain agent and generated-route setup

- Keep `AGENTS.md`, `.agents/`, `.archon/`, and `.claude/` in sync when the local agent workflow changes.
- Keep secrets out of repo files; use ignored env files for tokens and private keys.
- Treat `src/routeTree.gen.ts` as generated output from `bun run build` and review it before committing.

## 4. Add automated game tests

The game now exposes deterministic hooks:

- `window.render_game_to_text()`
- `window.advanceTime(ms)`

Use them to add focused tests for:

- Fresh storage hydration.
- Pause freezing game time, bomb timers, arrow timers, boost, and stun.
- Chest banking and owner clearing.
- Bomb exact-tile stun and owner clearing.
- Arrow line painting.
- Basic bot deterministic movement with seeded RNG.
