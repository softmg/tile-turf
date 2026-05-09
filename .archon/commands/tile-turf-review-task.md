---
description: Review the Hop and Fill implementation after validation passes.
argument-hint: (reads workflow artifacts)
---

# Hop and Fill Review Task

**Workflow ID**: $WORKFLOW_ID
**Request**: $ARGUMENTS

This is a review node. Do not edit files unless the change is a trivial
documentation/artifact correction. Review the code diff and artifacts.

## Phase 1: Load

Read:
- `$ARTIFACTS_DIR/plan.md`
- `$ARTIFACTS_DIR/implementation.md`
- `$ARTIFACTS_DIR/final-validation/status.env`
- final validation logs if any command failed

Inspect:
- `git diff --stat`
- `git diff`
- relevant tests

## Phase 2: Review Criteria

Check for:
- behavior that contradicts the plan
- progression/save regressions
- Yandex SDK calls that can crash outside the platform
- Pixi lifecycle or asset-loading timing issues
- React state bugs and stale closures
- mobile layout regressions
- missing or weak tests for changed domain behavior
- unnecessary broad refactors

## Phase 3: Artifact

Write `$ARTIFACTS_DIR/review.md` with:
- Verdict: pass, pass-with-notes, or needs-follow-up
- Findings ordered by severity with file paths
- Validation status
- Residual risks and suggested next steps

## Phase 4: Report

Return a short review verdict and the artifact path.

### CHECKPOINT
- [ ] `$ARTIFACTS_DIR/review.md` exists
- [ ] Review covers diff, tests, and platform/gameplay risks
