# Merge review/stability into full-review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 findings of the 14 Nov code review of `full-review`: bring in `review/stability`'s two newer commits
(`184fd56` Aim Assist reappearing-enemy lead, `263cee9` no preplacement after death) with the Aim Assist lead conflict
resolved, and clear Walk To Targets' "gave up" list on a new session.

**Architecture:** One `git merge` of `review/stability` into `full-review`, with the single expected conflict in
`predictHit` resolved by keeping both rules (100 px jump guard first, then the one-tick delay). Then one small
reset hook in `ObjectBreaker`, called from `ModManager.resetSession`.

**Tech Stack:** TypeScript, Vitest (jsdom), npm scripts in the repo root.

**Spec:** The review findings 1–3 (this session, "What this change does: the full-review branch adds 8 fixes…"),
restated here: (1) `predictHit` on `full-review` lacks `184fd56`'s jump guard and the one-tick delay multiplies the
bad speed; (2) `263cee9` is missing and untested next to the Phase 5 `AutoPlacer.preStart` skip; (3)
`ObjectBreaker.walkGivenUp` is never cleared on reconnect.

## Global Constraints

- Work only in the worktree `C:\Users\sarip\falcon-new\falcon-full-review` on branch `full-review`; never switch the
  shared `C:\Users\sarip\falcon-new\falcon-main` folder's branch. Never stash.
- Push to remote `fork` only (`git push fork full-review`); never open PRs to `origin`.
- Never change packet formats, encoder output or the `ModManager.main` update order.
- Every behaviour change keeps default play identical (Aim Assist and Walk To Targets are off by default).
- Run vitest from the repo root (`npx vitest run …`), never from `mod-source`.
- After all tasks: `npm run typecheck`, `npm run lint`, `npm run inject:build`, `npm run ext:build`,
  `npm run check:dead`, `npx vitest run` must all pass; replay fingerprints `packets` must stay
  `6aca8484bdbe212d`, `c0427ed3be9988ca`, `f815fbedf6756a5e`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Update `PROGRESS.md` in the
  same commit as each change.

## Review Focus

- Enemy back in view **and** one-tick delay together: the lead must be zero (aim at the enemy), not a jump × 2 —
  pinned in Task 1.
- Enemy walking normally (≤100 px a tick) with the delay: the existing "meets the enemy within 5 px" delay tests must
  still pass — kept in Task 1.
- Dying with a preplacement waiting while Auto Place is off and no enemy is trapped (Phase 5 skip path): nothing
  is sent — `263cee9`'s `preplace-after-death.test.ts` must pass after the merge, Task 1.
- Reconnecting to another server right after Walk To Targets gave up on a building id: that id is walked to again —
  pinned in Task 2.
- Respawn on the same server (not a reconnect): the list is **not** required to clear; no test, leave as is.

---

### Task 1: Merge review/stability and resolve the predictHit conflict

**Files:**
- Modify (merge): `mod-source/src/core/mod/combat/modules/AimAssist.ts` (`predictHit`, ~lines 75–102),
  `mod-source/src/core/mod/combat/placing/modules/AutoPlacer.ts`, `mod-source/src/core/socket/events/core/PlayerUpdateEvent.ts`,
  `mod-source/src/utils/constants/world.ts` (from `184fd56`/`263cee9`, taken as they are)
- Test: `mod-source/test/features/aim-assist.test.ts`, `mod-source/test/features/preplace-after-death.test.ts` (comes with the merge)
- Modify: `PROGRESS.md` (Phase 3 fix 5 note + "Merged review/stability" line)

**Interfaces:**
- Consumes: `MAX_WALK_PER_TICK` exported from `@constants/world` (value 100, added by `184fd56`).
- Produces: `predictHit(from, target, speed, out = {x:0,y:0}, delayMs = 0): Point` — same signature as on `full-review`.

- [ ] **Step 1: Check the worktree is clean and on full-review**

Run: `git -C C:/Users/sarip/falcon-new/falcon-full-review status -sb`
Expected: `## full-review...fork/full-review` and no changed files.

- [ ] **Step 2: Merge**

Run: `git merge --no-ff review/stability -m "Merge review/stability (184fd56 Aim Assist reappear lead, 263cee9 no preplacement after death)"`
Expected: a conflict in `AimAssist.ts` only (and possibly `aim-assist.test.ts`). Any other conflicted file: stop and ask.

- [ ] **Step 3: Resolve `predictHit`**

Keep `184fd56`'s guard and the delay. The function body must read, in order: `dx`/`dy` from
`real_position - last_position`; `moving = !target.trap && Math.abs(dx) <= MAX_WALK_PER_TICK && Math.abs(dy) <= MAX_WALK_PER_TICK`;
`vx = moving ? dx / tick : 0` (same for `vy`); early return of `real_position` when `!(speed > 0)` or both speeds are 0;
then the existing `startX/startY = real_position + v * delayMs` and the 4 flight rounds unchanged. Keep both import
lines (`MAX_WALK_PER_TICK` from `@constants/world`, `ScriptConfig`). In the test file keep every test from both sides.

- [ ] **Step 4: Add the combined test** in the `ranged prediction` describe of `aim-assist.test.ts`

```ts
it("an enemy back in view with the one-tick delay: still no lead", () => {
    expect(predictHit({ x: 0, y: 0 }, enemy(1, 500, 0, 100, { x: 500, y: -400 }), 3.6, undefined, TICK)).toEqual({ x: 500, y: 0 });
});
```

- [ ] **Step 5: Run the Aim Assist, preplacement and replay tests**

Run: `npx vitest run mod-source/test/features/aim-assist.test.ts mod-source/test/features/preplace-after-death.test.ts mod-source/test/replay.test.ts`
Expected: all pass. If `replay.test.ts` fails only on `angles`/`angleComputes`, the merge changed Angle Finder calls:
stop and ask (it must not, since `263cee9` doesn't touch `preStart`). A `packets` mismatch is a failure.

- [ ] **Step 6: Finish the merge commit**

```bash
git add mod-source PROGRESS.md
git commit --no-edit
```

`PROGRESS.md`: under Phase 3 fix 5 add "Since the merge of `184fd56`, a jump of over 100 px in one tick (enemy back in
view) gives no lead, delay or not."; under Done add "Merged review/stability (`184fd56`, `263cee9`)".

### Task 2: Clear Walk To Targets' give-up list on a new session

**Files:**
- Modify: `mod-source/src/core/mod/defense/modules/ObjectBreaker.ts` (next to `walkGivenUp`, ~line 123)
- Modify: `mod-source/src/core/ModManager.ts` (`resetSession`, ~line 67)
- Test: `mod-source/test/features/object-breaker.test.ts` (Walk To Targets describe)
- Modify: `PROGRESS.md` (Phase 3 fix 7 note)

**Interfaces:**
- Consumes: Task 1 done (merged tree).
- Produces: `ObjectBreaker.resetSession(): void` — clears `walkGivenUp` and sets `walkProgress.sid = -1`.

- [ ] **Step 1: Write the failing test** after "Walk To Targets gives up on a building it can't get closer to…"

```ts
it("Walk To Targets forgets the buildings it gave up on when a new session starts (reconnect)", async () => {
    const { ObjectBreaker } = await run({ enable: ["walkBreaker:walkToTarget"], detectRange: 200, objects: farSpike });
    for (let i = 0; i < 15; i++) game!.update();
    expect(ObjectBreaker.farTarget).toBeNull(); // gave up on 701, the only building
    const { default: ModManager } = await import("@core/ModManager");
    ModManager.resetSession();
    game!.update();
    expect(ObjectBreaker.farTarget?.sid).toBe(701);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run mod-source/test/features/object-breaker.test.ts -t "forgets the buildings"`
Expected: FAIL — `farTarget` is still `null` after `resetSession()`.

- [ ] **Step 3: Implement `static resetSession(): void` in `ObjectBreaker.ts`** and call `ObjectBreaker.resetSession()`
at the end of `ModManager.resetSession()` (ModManager already imports ObjectBreaker). No change to the per-tick path.

- [ ] **Step 4: Run the Object Breaker tests**

Run: `npx vitest run mod-source/test/features/object-breaker.test.ts`
Expected: all pass (22 tests).

- [ ] **Step 5: Full checks**

Run each from the repo root: `npm run typecheck`, `npm run lint`, `npm run inject:build`, `npm run ext:build`,
`npm run check:dead`, `npx vitest run`.
Expected: all exit 0; vitest shows 0 failed (the TaskScheduler timing test and the `jitter-safe-timing` preplacement
tests are known to flake under load: re-run alone before treating them as failures).

- [ ] **Step 6: Commit and push**

```bash
git add mod-source/src/core/mod/defense/modules/ObjectBreaker.ts mod-source/src/core/ModManager.ts mod-source/test/features/object-breaker.test.ts PROGRESS.md
git commit -m "Walk To Targets: forget the buildings it gave up on when a new session starts

Building ids from the last server could match buildings on the new one
and be skipped for up to 10 s after a reconnect.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push fork full-review
```

`PROGRESS.md`: under Phase 3 fix 7 add "The list is cleared when a new session starts (reconnect)."
