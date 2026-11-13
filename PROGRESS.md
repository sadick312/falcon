# Falcon full review: progress

Branch `full-review` (from `review/stability` at `814870f`). Push to `fork` only.

## Current task
Phase 2: adding tests for core logic with the least test coverage.

## Done
- Phase 1: read history, docs and code; wrote UNDERSTANDING.md (no code changes).
- Phase 2 baseline measured (below).

## Baseline (Phase 2, 13 Nov 2026, commit 814870f code, Windows 11, Node 24.22.1)

Every command run in the `full-review` folder from the repo root.

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass, 0 problems |
| `npm run inject:build` | pass, `falcon-quick-inject.js` 698 KB (727,422 bytes) |
| `npm run ext:build` | pass |
| `npm run test:smoke` | pass |
| `npm run docs:settings` | pass, `docs/SETTINGS.md` unchanged |
| `npm run check:dead` | **fails**: 3 exports only `core/events/updateUpgrades.ts` uses (`MANUAL_PICK`, `AutoUpgradeChoice`, `chooseAutoUpgrade`). Already fixed on branch `test-fix-optimize` (`7326a21`), not merged here |
| `npx vitest run` | pass: 133 files, 1081 tests passed, 1 skipped (opt-in soak), 151 s |
| Golden replays (`test/replay.test.ts`) | pass: sample-base, sample-busy, sample-synthetic, determinism |
| Coverage (`--coverage`, `mod-source/src`) | lines 86.5%, branches 77.3%, functions 90.1% |
| `npm run bench` | pass |

Replay benchmark, run alone (`--no-file-parallelism`), 2 runs, 5 timed runs each:

| Replay | Ticks | Sent packets | Fingerprint | Average tick (ms) | p95 (ms) |
|---|---:|---:|---|---:|---:|
| sample-base | 540 | 1618 | `6aca8484bdbe212d` | 1.16–1.19 | 2.45 |
| sample-busy | 1081 | 2884 | `c0427ed3be9988ca` | 1.08–1.19 | 2.16–2.38 |
| sample-synthetic | 135 | 372 | `f815fbedf6756a5e` | 1.21–1.22 | 2.91–3.02 |

These times are about 2× the 13 Nov Step 6 numbers in BENCHMARKS.md (0.49–0.89 ms) for the same code: other
sessions were using the PC. Compare speed only against runs made the same way at the same time. The fingerprints
are the part that must never change. Each replay also logs 3 harmless errors from the offline page
(`'action-bar-item-16' cannot be found`), same before.

Packet micro-benchmark (µs per call): encode move 0.62, encode hit 0.61, encode chat 1.35, HMAC signature 41.6,
xor mask 1.43, move de-dup 0.31, msgpack decode 10 players 6.69, LegacyPacketAdapter 2.92, PacketBatcher 20-packet
tick 7.84. Pathfinder: grid build 131 µs, worker A* 599 µs.

Least-tested core files (uncovered branches): AutoBreaker 56 (64% of branches), Player.ts 49 (44%), AutoPusher 31
(69%), ObjectManager 24, AutoGrinder 24 (62%), TurretManager 15 (63%).

## Next up
- Phase 2: tests for the least-tested core logic above.
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
