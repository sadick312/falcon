# Falcon: performance pass and Test Mode

## 1. What was wrong

Ranked by impact. File links point at the fixed code.

1. **Ghost animals blocked shots.** `ais.all` keeps every animal Falcon has ever seen, and animals that left view stay
   at their last position. The projectile line-of-sight check ([DefenseUtils.ts](../mod-source/src/core/mod/defense/utils/DefenseUtils.ts))
   counted those as blockers, so Falcon could decide a bow or musket shot was blocked by an animal that wasn't there.
2. **Turret logic sorted a shared list in place.** [TurretManager.ts](../mod-source/src/core/mod/defense/modules/TurretManager.ts) ran
   `ais.all.sort(...)` for every turret shot and every nearby player. That list keeps per-entity indexes for O(1) removal,
   so sorting it corrupts them. It also built and sorted a filtered copy of the player list each time.
3. **Object loop repeated per-player work for every object.** `ModManager.updateObjects` refetched both weapons, both object
   damages and my aim direction for every (object, player) pair, every tick. This was the biggest per-tick cost near bases.
4. **Activity list rewrote the DOM every tick.** It cleared `innerHTML`, then appended with `+=` once per entry (the browser re-parses
   the whole list each time), even when nothing changed and even with "Show Activity" off.
5. **The camera interpolated hidden animals every frame**, which costs more the longer you play.
6. **No way to measure any of this in game**: no ms-per-tick readout, no repeatable test.

Not fixed in this pass, because they need live numbers first (Test Mode now produces them):
- **Turret targeting comparison looks inverted.** When an animal is closer to the turret than the closest enemy, the code
  still picks the enemy (`closestEnemyDistance >= closestAiDistance ? closestEnemy : closestAI`). I kept the existing behavior
  and only removed the cost. Check it against a real turret before changing it.
- **Heal timing, insta and spike-sync tuning**: no tuning without before/after kill and DPS numbers from Test Mode.
- **`createDefaultState()` allocates a fresh brain-state object every tick.** The replay recorder may keep those
  objects, so reusing one could corrupt replays. Left as is.

## 2. Patch notes

### Fixes
- Line of sight ignores animals that are out of view.
- Turret threat check no longer sorts `ais.all` in place, and ignores hidden animals.
- Chat commands starting with `\` reach the server unchanged (already in the version-support commit; Test Mode depends on it).

### Optimizations
- `updateObjects`: weapon data, object damage and aim are computed once per player per tick, not once per (object, player) pair.
- Turret target: one linear scan per turret shot, shared by all players, with no arrays allocated.
- Activity list: built as one string and written only when it changes.
- Camera: hidden animals are skipped. They snap into place when they reappear, as before.
- Perf counters use fixed-size ring buffers (no allocation), and the panel's DOM is written at most twice a second.

### New
- **Performance panel** (Visual tab → "Performance Panel", or **F8**): FPS, ping, ms per tick (avg/max), ms per frame
  (avg/max), and objects nearby. It is saved like every other toggle, which needs Configs → "Auto Save Configs" on (off by default).
- **Test Mode** (new **Testing** tab): automated runs against the sandbox practice bot. See §5.

## 3. Changed code

| File | What |
|---|---|
| [core/mod/testing/TestMode.ts](../mod-source/src/core/mod/testing/TestMode.ts) | Test runner, scenarios, `TEST_CONFIG` (every delay and limit lives here) |
| [core/menu/utils/drawTestMode.ts](../mod-source/src/core/menu/utils/drawTestMode.ts) | Testing tab UI: checkboxes, Start/Stop, progress bar, results table, Copy |
| [core/mod/utils/PerfMonitor.ts](../mod-source/src/core/mod/utils/PerfMonitor.ts) | Tick/frame timing, panel, `PERF_CONFIG` |
| [core/ModManager.ts](../mod-source/src/core/ModManager.ts) | Test Mode aim/attack hook, tick timing, `updateObjects` and activity-list optimizations |
| [rendering/RendererSystem.ts](../mod-source/src/rendering/RendererSystem.ts) | Frame timing |
| [ui/Hook.ts](../mod-source/src/ui/Hook.ts) | F8 (panel) and F9 (stop Test Mode) |
| TurretManager, DefenseUtils, CameraManager | Fixes listed above |

## 4. Before vs after

I couldn't run the full build inside the live page: Chrome blocks a public page from loading a script from localhost.
So the table below counts work per tick (O = objects near you, P = visible players, A = animals seen, T = turrets firing that tick).
These counts follow exactly from the code. For real timings, run Test Mode's Performance test before and after
(check out the previous commit for "before").

| Hot spot | Before (per tick) | After (per tick) | Example: O=150, P=6 |
|---|---|---|---|
| `updateObjects` weapon fetches | up to 4·O·P | up to 4·P | 3600 → 24 |
| `updateObjects` aim reads | 2·O | 2 | 300 → 2 |
| Turret target search | T·P × (sort A + filter/sort P, 2 arrays) | T × one scan of A+P, 0 arrays | 6 sorts + 12 arrays → 1 scan per shot |
| Activity list DOM writes | 1 + k writes, O(k²) parsing | 0 if unchanged, else 1 | 9 writes → 0 or 1 |
| Camera lerp (per frame) | P + A (all animals ever seen) | P + visible animals | grows over a session → stays flat |

| Spike grader placement sim (per candidate angle) | new `GameObject` each time | reused from a pool | 0.067 → 0.009 µs, no garbage (offline benchmark, 200k runs) |

### Second pass
- **Pooled placement objects.** The spike grader simulates every candidate angle with a "place" action, and each one used to
  build a new `GameObject`. They now come from a small pool in `MovementPhysicsSimulator` (one slot per place action in a
  simulation, rebuilt only if the item changes). Each call is tiny either way; the gain is less garbage collection during fights.
- **Per-section tick timing.** `ModManager.main` is timed in 7 parts (prepare, defense scan, objects, attack, defense response,
  placement, finish). The performance panel shows the 3 slowest, and Test Mode's Performance result names the slowest one.
  The rest of the tick code already reuses its buffers (simulation results, weapon fetches, object pools), so the next
  optimization should go wherever this breakdown points in a real fight.

| Live measurement (fill in from Test Mode → Performance) | v1.8.2 before | v1.8.2 after |
|---|---|---|
| FPS, Falcon modules on, in your base | | |
| ms per tick, avg / max | | |
| ms per frame, avg / max | | |

### Offline check of Test Mode
I ran Test Mode against a fake sandbox (a bot that obeys `\b` commands 150 ms after they're sent) on a simulated clock:
- A full run finished all 15 steps with 70 commands, and no two commands were less than 1.5 s apart.
- Stop during the kill test ended with `\c a`, left no bot or structures, and cleared the aim override.
- The run caught and fixed two measuring bugs: reaction times included the 1.5 s command wait, and the building test
  started its clock while the old bot was already next to you.

The numbers in that run come from the fake world, not the game. Only the sequencing was being tested.

## 5. Test Mode, step by step

1. Build with `npm run inject:build`, then on moomodding.io choose **v1.8.2** → **Quick Inject** → **Bundle Replacement**, paste
   `mod-source/dist/falcon-quick-inject.js`, and enter the game.
2. Stand still in an open area (for the performance test, run it once in the open and once in your base).
3. Open the menu (**Esc**) → **Testing** tab. Tick the tests you want; your selection is saved.
4. Press **Start**. Test Mode never starts on its own. It types the bot commands for you, one every 1.5 s, and waits for each
   to take effect (bot appears, hat or weapon changes) before the next. Don't type in chat while it runs.
5. Watch the progress bar and the current test name. Results appear in the table as each test finishes.
6. **Stop** (or **F9**) ends the run at any point and sends `\c a`. Dying also stops it.
7. **Copy results** copies the table as tab-separated text, ready to paste into Discord or a spreadsheet.
8. **Compare versions:** each *full* run is saved for the client version it ran on. Switch the launcher to the other
   version (v1.8.2 ↔ v1.6.9), inject again and run the same tests. The **Version comparison** table under the results then
   shows both side by side, and Copy results includes it. A stopped run is not saved, so it can't replace a good one.
   Both versions live on sandbox.moomodding.io, so they share the same saved data.

| Test | What it does | What it records |
|---|---|---|
| DPS | `\b hl on`, hits the bot for 10 s with each of your weapons | damage, DPS, hits (marked as a lower bound if the bot died) |
| Time to kill | `\b hl off`, bot hat 0 and 6 (Soldier), each weapon | seconds from first hit to kill, hits |
| Weapon tier | `\v 0`–`\v 3` on your primary, then a kill | TTK per tier, which shows whether `\v` changes damage or only looks |
| Defense reaction | bot gets katana ruby + bull, polearm ruby, great hammer; `\b t` | which hat Falcon switches to and after how many ms |
| Building reaction | `\b d`, `\c`, then spawns a fresh bot next to you | ms until Falcon's first placement, objects placed; `\c` after |
| Performance | 6 s with Falcon's combat/defense modules off, 6 s on | FPS, ms per tick, ms per frame, ping, objects nearby |

What the bot can't test: it's a dummy and never attacks. So survival time and heal timing under fire need a
`\f <friend> -u` duel; the Defense test only measures how Falcon reacts to a threatening loadout. Weapon IDs 0–15 can only be
tested for *your* side with the two weapons you own. Upgrade to other weapons and run again to cover more of them.

All delays and lists (bot name, command gap, durations, hats, tiers, loadouts) are in `TEST_CONFIG` at the top of `TestMode.ts`.

## 6. Play-test results (real build, local server)

The real Quick Inject build was played in the browser against `mod-source/test/mock-server.mjs`, a local server that speaks
moomodding.io's v1.8.2 packets and runs a practice bot for the `\b`, `\c` and `\v` commands. It found and fixed:

1. **Falcon didn't start at all** ("Class extends value undefined"). The Test Mode commit changed the order modules load in,
   so `AutoPlacer` loaded before the `Placer` class it extends. Fixed by moving the `PlacementTypes` constants into
   `placing/utils/PlacementTypes.ts`, a file with no imports, so nothing has to import `Placer.ts` just for constants.
   Every build since `6da0810` had this bug; earlier ones didn't.
2. **Test Mode measured the wrong weapon.** Falcon's own logic picks the great hammer (with polearm + hammer, "select best weapon"),
   and a left click on the canvas turns on hammer spam. Test Mode now locks the weapon under test while it attacks, and pauses
   hammer spam for the run, restoring it afterwards.
3. **DPS read about 4× too low when the bot heals.** Damage was sampled once per tick, so a hit and a heal in the same tick
   cancelled out. Damage is now counted from every health packet.
4. **"frame 0.00 ms" when no frames were drawn** (hidden tab). The Performance test now says no frames were drawn.

Live results after the fixes (mock server values, not real sandbox numbers):

| Test | v1.8.2 | v1.6.9 |
|---|---|---|
| Time to kill, polearm, bot hat 0 / Soldier | 3 hits / 3 hits | 3 hits / 3 hits |
| Time to kill, great hammer, bot hat 0 / Soldier | 10 hits / 14 hits | 10 hits / 14 hits |
| DPS great hammer, bot healing | 210 dmg, 21 hits | 220 dmg, 22 hits |
| Version detected, menu header, spawn, chat commands, F8 panel, cleanup `\c a` | OK | OK |

### Testing offline yourself
1. `npm run inject:build`
2. `npm run mock --workspace=mod-source`
3. Open `http://localhost:8780/?v=1.8.2` (or `?v=1.6.9`). Press **Multiplayer**, then **Join Server** *without* picking a server;
   that connects to the local server. Then type `\b Target` in chat or use the Testing tab.

The test page sets `localStorage["falcon-dev-profile"] = "moomodding"`. That key only works on localhost pages, and makes
Falcon use its moomodding.io settings there.

## 7. Feature ideas

1. **Performance panel**: added.
2. **Test Mode**: added.
3. **Duel recorder**: during `\f` matches, log damage taken, heals and hat swaps per tick. This is the missing half of the
   defense test, and the data is already flowing through `ModManager.brainState`.
4. **Config A/B in Test Mode**: run the same scenario list on two saved configs and show both columns side by side.
5. **Turret target overlay**: draw which entity each turret is predicted to shoot. This would settle the open turret question above in one look.
