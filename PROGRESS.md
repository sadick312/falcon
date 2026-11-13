# Falcon full review: progress

Branch `full-review` (from `review/stability` at `814870f`). Push to `fork` only.

## Current task
Phase 1 done. Waiting for your OK before Phase 2 (test baseline).

## Done
- Phase 1: read history, docs and code; wrote UNDERSTANDING.md (no code changes).

## Next up
- Phase 2: build, typecheck, lint, vitest (from the repo root), bench, docs:settings, golden replays; save the
  baseline here; add tests for untested core logic.
- Phase 3 candidates (open review bugs, UNDERSTANDING.md section 6): Aim Assist J switch reverts, Lead Falcon's
  Ranged Shots uses the held weapon, ranged lead misses one tick, WingsUtils raw mouse aim in tank spam, Walk To
  Targets never gives up, Reload HUD countdown for an unheld weapon.

## Decisions
- `full-review` lives in its own worktree (`../falcon-full-review`) so the shared `falcon-main` folder stays on
  `review/stability` for other sessions.

## Tried, didn't work
- (none yet)

## Known issues
- See UNDERSTANDING.md sections 4, 6 and 7.
