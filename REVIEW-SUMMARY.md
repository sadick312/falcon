# Full review: final summary (Phase 6)

Branch `full-review` (made from `review/stability` at `814870f`, 13 Nov 2026), on the fork only. Finished 14 Nov 2026.
How Falcon works is in [UNDERSTANDING.md](UNDERSTANDING.md); the step-by-step log is in [PROGRESS.md](PROGRESS.md).

## 1. Before and after

| Check | Start (Phase 2 baseline) | End (Phase 6) |
|---|---|---|
| `npm run typecheck` | pass | pass |
| `npm run lint` | pass | pass |
| `npm run inject:build` | pass, 698 KB | pass, 702 KB |
| `npm run ext:build`, `npm run test:smoke` | pass | pass |
| `npm run docs:settings` | pass | pass (new settings listed) |
| `npm run check:dead` | **fail** (3 unused exports) | pass |
| Tests (`npx vitest run` from the repo root) | 133 files, 1081 passed, 1 skipped | 142 files, 1121 passed, 1 skipped |
| Coverage (branches / lines) | 77.3% / 86.5% | 77.3% / 86.9% |
| Replay fingerprints: sent packets | `6aca8484…`, `c0427ed3…`, `f815fbed…` | **the same** |
| Replay benchmark, time per tick | 1.1–1.2 ms (busy PC) | 0.24–0.40 ms (quieter PC); Phase 5 measured ~20% less on the busy and synthetic replays in alternating rounds |
| Quick Inject file starts | not checked | checked offline by a new test (`quick-inject-boot.test.ts`) |

With every new setting left at its default, Falcon sends exactly the same packets in the recorded fights as before.
The one recorded-fight change is that Falcon calls its building-spot search less often (Phase 5).

One test is flaky and was already flaky on `review/stability`: the TaskScheduler timing test in
`socket-paths.test.ts` sometimes sees a task run a few ms early when the PC is busy. Once, with the PC busy, two
`jitter-safe-timing.test.ts` tests also hit the 30 s time limit; they passed alone and on the next full run. If a
test fails, re-run it on its own before worrying.

## 2. What changed (all on `full-review`)

**Fixes (Phase 3)** — default play is unchanged except fix 1, which puts back how Auto Grind worked before 8 Nov:
1. Auto Grind no longer crashes every tick before you have a secondary weapon.
2. `check:dead` passes again (3 exports in `updateUpgrades.ts`).
3. Aim Assist: J's new target now stays.
4. Lead Falcon's Ranged Shots leads for the attack's weapon (musket), not the held one.
5. The ranged lead counts the tick before the shot leaves.
6. The Blood Wings heal check looks at the swing really sent (Aim Assist), not the raw mouse.
7. Walk To Targets gives up on a building it can't get closer to (~1 s) and tries the next one.
8. Reload HUD shows a weapon you aren't holding as paused (grey).

**New settings (Phase 4)** — all off, or the classic value, by default:
- Utility > Packet Management > **Tick-Based Shot Window**: bow-insta detection counts server ticks, not 444 ms.
- Combat > Combat Modules > **Sync Hits Use Enemy Health**: Velocity Hits and Projectile Sync use the enemy's current
  health and Soldier Helmet instead of a fixed 100.
- Visual > Camera > **View Distance** (75–250%, default 100) and **Limit Wheel Zoom** (off).

**Speed (Phase 5)**: Auto Place's spot search is skipped while Auto Place is off and no enemy is trapped.

**Tests (Phases 2 and 6)**: 13 tests for the least-tested parts (Auto Break, Turret Manager, Auto Push, Auto Grind),
a test with each fix and each new setting, and the Quick Inject boot check.

## 3. Not done

- **Nothing has been tried in a real game yet.** Live tests from here hit the site's limit of about 2 connections
  per IP (error 4001), and Playwright's "Singleplayer" joins the live public server. Use the checklist below.
- Features that need a teammate or two enemies were never seen live: Melee Sync, Projectile Sync, Spike Tick,
  One Tick, Auto Push, Replacements.
- Couldn't verify (no 1.8.2 server code): with ping above ~111 ms a shot may leave two ticks later, not one (fix 5
  uses one); moomodding's exact building limit; whether hats cost gold on moomodding.
- Combat changes could only be checked with unit tests: the sample replays have no melee fights and there are no
  real fight recordings (`.fpl`) on this PC. Saving a few real fights (die with Configs > Download Local Copy on,
  or type `!plog`) would let later work measure hits and misses.
- Left as they were on purpose: P26 and P27 (your earlier decision); the Defense System's own-hat choices (classic
  hat system); Auto Save Configs stays off by default (turn it on yourself to keep settings after a reload).
- `auto-improve` has work this branch doesn't (Keybinds tab, debug panel, Katana + Musket upgrade builds, more
  ping work). Bringing any of it over is your decision.
- Auto Break's katana-spike path still has no test (it needs an enemy spike-bounce setup).

## 4. In-game checklist

Load Falcon (section 5), join `sandbox.moomodding.io`, press **Esc** for the menu. Tick each line when it works.

**Default play (nothing turned on)**
- [ ] Falcon loads; the F12 console shows no red `[Falcon]` errors.
- [ ] Healing, hats, Auto Break in a trap, and auto-upgrades behave as before.
- [ ] The view is the normal size after joining; `=` resets the zoom as before; the wheel zooms as before.

**Fixes**
- [ ] 1. Before age 6, turn on Utility > Auto Grinding: it places and hits buildings, no red errors in F12.
- [ ] 3. Aim Assist on, two enemies in the cone, tank spam, press **J**: the yellow ring moves and stays.
- [ ] 4–5. Aim Assist + Lead Falcon's Ranged Shots + Musket Insta: the musket bullet meets a sideways-running enemy.
- [ ] 7. Detection Range 200 + Walk To Targets, an enemy spike behind a wall: Falcon tries ~1 s, then walks to
      another building (F12 with Combat Debug Log on shows `gaveUp`).
- [ ] 8. Reload HUD on: hit with the primary, switch weapon: the primary's row turns grey and its number stops.

**New settings**
- [ ] View Distance 150, press `=`: you see 1.5× more. Limit Wheel Zoom on: the wheel stops at 75% and 250%.
- [ ] Sync Hits Use Enemy Health on: Velocity Hits bull-hits a hurt enemy (~80 health) into your normal spike.
- [ ] Tick-Based Shot Window on, Artificial Ping on: Falcon still reacts to an enemy's crossbow insta.

Phase 3B steps (Reload HUD, breaker options, Aim Assist) are in [docs/PHASE-3B-TESTING.md](docs/PHASE-3B-TESTING.md).

## 5. Build and load on Windows

One-time setup is in [README.md](README.md) (install Node.js LTS, get the code, `npm run install:all`). This branch is
`full-review`: download it the same way, picking `full-review` instead of `review/stability`.

Each time, in **Command Prompt** inside the project folder:

1. Build the Quick Inject file:
   ```bash
   npm run inject:build
   ```
2. Optional check that everything still passes (takes a few minutes):
   ```bash
   npx vitest run
   ```
3. Open `mod-source\dist\falcon-quick-inject.js` in Notepad, press Ctrl+A, then Ctrl+C.
4. On moomodding.io open **Quick Inject**, choose **Bundle Replacement**, paste with Ctrl+V and start the game. Or, on
   an open `sandbox.moomodding.io` game page, press F12 > Console, paste and press Enter (type `allow pasting` first
   if Chrome asks).
5. For the Chrome extension instead: `npm run build`, then reload Falcon in `chrome://extensions`.

To keep your settings after a page reload, turn on Configs > **Auto Save Configs**.
