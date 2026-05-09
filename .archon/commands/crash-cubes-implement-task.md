---
description: Implement the planned Hop and Fill task and record the result.
argument-hint: (reads workflow artifacts)
---

# Hop and Fill Implement Task

**Workflow ID**: $WORKFLOW_ID
**Request**: $ARGUMENTS

## Phase 1: Load

Read:
- `$ARTIFACTS_DIR/plan.md`
- `$ARTIFACTS_DIR/repo-snapshot.md`
- files named in the plan

Check git status before editing. Do not revert or overwrite unrelated user
changes. If a file already contains changes outside the planned scope, preserve
them and work around them.

## Phase 2: Implement

Implement the plan using existing project style:
- React components belong under `src/components` or `src/pages`.
- Gameplay/domain behavior belongs under `src/game`.
- Yandex integration belongs behind `src/sdk/yandex.ts`.
- Tests should live close to game/domain code when possible.
- Use existing dependencies and UI primitives before adding new ones.

Keep the change scoped. Do not create commits, push, or open a PR.

## Phase 3: Local Checks

Run targeted checks that make sense for the changed files. The workflow will run
the full deterministic validation after this node, so focus here on catching
obvious issues quickly.

## Phase 4: Artifact

Write `$ARTIFACTS_DIR/implementation.md` with:
- Files changed
- What was implemented
- Tests/checks run in this node
- Any deviations from the plan
- Any follow-up items that remain out of scope

### CHECKPOINT
- [ ] Code changes are complete for the planned slice
- [ ] `$ARTIFACTS_DIR/implementation.md` exists
- [ ] No commits, pushes, or PRs were created
