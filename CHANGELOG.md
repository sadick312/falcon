# Changelog

What changed in Falcon, newest first. Each entry names the commit(s) for the details.

## Unreleased (branch combat-defense-ping, Step 3: defense)

### Added (off by default, under Defense > Auto Healing)
- **Ping-Aware Defense**: at a round trip over one tick, enemy weapons count as a threat one tick earlier, so the
  hat or food reaches the server in time.
- **Don't Top Up Small Losses**: when nothing can hit you, doesn't eat for less than one food's worth of health.

## Unreleased (branch combat-defense-ping, Step 2: ping)

### Added (off by default)
- **Smoothed Tick Clock** (Utility > Packet Management): times preplacements from a smoothed estimate of the server's
  tick, so one late tick doesn't make the next preplacement late too.
- **Ping Details** (Visual > Debugging Visuals): the ping line also shows the stable ping, jitter and tick jitter.

### Changed (no effect on play)
- One shared `Timing` helper now works out every ping-based timing (preplacement, packet budget, sent equips, own
  shame) with the same formulas as before (`cd6bdff`). Replays unchanged.

## Unreleased (branch review/stability, Phase 3B part 3: aim)

### Added (off by default)
- **Aim Assist** (Combat): when you hit by hand (mouse tank spam, or E auto-gather with "Aim With Mouse While
  Gathering"), the swing turns to an enemy inside a cone around your mouse: never wider than 60°, never behind you,
  never teammates or dead players. Pick Nearest, Lowest Health or Closest To Mouse; Max Distance slider. L locks on,
  J switches target. Melee aims at the centre; musket, crossbow and bow lead a moving enemy (where it will be when
  the shot arrives). Markers show the target and the aimed point.
- **Lead Falcon's Ranged Shots** (under Aim Assist): Falcon's own shots at the nearest enemy lead too. Off = as before.

## Unreleased (branch review/stability, panic-eat fix)

### Added (off by default)
- **Resync Predicted Speed** (Defense): Falcon's guess of where you'll be next tick now starts from where you really
  are, with your real speed, every tick. Before, it was only put back on your real position on ticks that also
  carried your hat/weapon details, and its speed never: after one predicted spike bounce it stayed stuck "hitting"
  that spike, so Auto Heal ate right after hits (+1 shame each time) for damage that never came.
- Measured on the sample replays (`heal-report.bench-run.ts`), off → on:

  | Replay | Ticks predicting a spike hit | Ticks Auto Heal ate | Food used |
  |---|---|---|---|
  | sample-base | 540 → 204 | 42 → 29 | 126 → 87 |
  | sample-busy | 1075 → 4 | 70 → 59 | 210 → 177 |
  | sample-synthetic | 129 → 0 | 11 → 5 | 33 → 15 |

  With it off, every replay fingerprint is unchanged.

## Unreleased (branch review/stability, Phase 3B part 2: breaker)

### Added to Auto Object Breaker (all off / 0 by default, so it breaks exactly as before)
- **Closest First**: with several enemy buildings in reach, spikes first, then the closest, then the lowest health.
- **Detection Range** (0–300): looks that much farther than your weapon's reach. It still only swings at buildings
  in real reach (weapon range + building size).
- **Walk To Targets**: walks to the nearest building in Detection Range. Only while you aren't moving yourself,
  Shift isn't held and no enemy player is within 300. Safe Walk still applies.
- **Show Range**: draws your reach (white) and Detection Range (yellow), and rings the building being hit (red) or
  walked to (yellow).
- With Combat Debug Log on, the breaker logs its target, distance, reach, health and reload.
- Unchanged: the trap you're stuck in still comes first (Auto Break), the Great Hammer + Tank Gear choice, and your
  own and your tribe's buildings are still ignored.

## Unreleased (branch review/stability, Phase 3B part 1: reload)

### Added (off by default)
- **Reload HUD** (under Visual → Reload Bars): a panel on the left of the screen with your primary and secondary
  reload and the nearest enemy's, plus the server ticks left until each is ready. A "?" after an enemy weapon means
  Falcon is only guessing it.
- **Combat Debug Log** (Configs tab): writes each swing (who, weapon, reload time) and how many ticks its reload
  took to the browser console (F12). For testing only.

### Checked, not changed
- Gold, diamond and ruby weapons reload exactly like plain ones (in 1.8.2 they only add damage); a new test proves it.
  Reload already starts from the server's swing packets and counts Samurai Armor, so nothing there needed fixing.

## Unreleased (branch review/stability, Anti Bull, shame and the original look)

### Changed
- The menu and the ping line look like the original Falcon again: no settings search box in the menu header, no
  reset buttons next to changed settings, no keyboard-focus outline, and the ping line is back to
  `Ping | FPS | BWin` (the stable ping, jitter and tick jitter are still measured, just not shown).
- **Anti Bull** keeps working at 4+ shame (new sub-option "Keep On at High Shame", on by default) and drops its
  old Spike Gear decision whenever it stands down. **Accurate Enemy Shame** is on by default, so the Shame
  Counter, Shame Grind and Shame Strike count only food-sized heals. A config saved before keeps its own
  choices. (c24f5ad)

### Measured, not changed
- Why we get shamed so much: in the replays every eat happened in the same tick as a hit (+1 shame), because our
  predicted next position runs into a spike almost every tick. The predicted speed carries over from the last
  prediction instead of being reset to our real movement (76 units a tick predicted, about 1 real). Not fixed yet.

## Unreleased (branch review/stability, defense brief and Part 3)

Every new behaviour is a menu setting that is off (or "Manual") by default, so Falcon plays exactly as before until
you turn it on. Replay fingerprints are unchanged by every commit here.

### Added
- **Shame-Safe Healing** (Defense > Auto Healing): at 7 shame, Auto Heal doesn't eat within 120 ms of a hit (in
  1.8.2 that food reaches 8 shame, locks eating for 30 s and doesn't heal); it eats the next tick. (2645aa9)
- **Accurate Enemy Shame** (Combat): an enemy's heal counts toward their shame only when it looks like food (20+,
  or 16+ to full health), not healing pads or regen. (2645aa9)
- **Exact Threat Reload** (Defense > Auto Healing): an enemy weapon counts as a threat for the next tick only when
  fully reloaded, not from 90% (a polearm was counted a tick early). (67d62e4)
- **Break Traps From Any Angle** (Utility > Auto Break): while trapped, the swing is turned to hit as many enemy
  spikes and traps at once as possible, never fewer than the usual aim. (ddca101)
- **EMP-Aware Instas** (Combat): Musket Insta and Knockback Instakills leave out the turret bullet against an EMP
  Helmet, so they don't fire an insta that can't kill. (e965dfd)
- **Insta Uses Enemy Health** (Combat > Knockback Instakills): also fires when the two hits reach the enemy's
  current health (it used to need spikes, a pit trap or 100+ in one tick). (e965dfd)
- **Auto Upgrade: Age 2 / 6 / 8 / 9 Pick** (default Manual) and **Spend Every Point**: no upgrade point is left
  unspent (2 were at age 10 in the live test). (ce5dd6b)
- `bench/angle-finder-calls.bench-run.ts`: Angle Finder calls per tick by who they're for. (b9e61b9)

### Measured, not changed
- Instas' damage numbers match 1.8.2; coverage of AttackManager, AutoInstakiller and PredictiveMethod was already
  above 80% of branches.
- Angle Finder: about 20% of tick CPU, 3.7-7.6 calls per tick; skipping far enemies (~2% of a tick) or reusing last
  tick's result (0% of calls qualify) wouldn't pay off, and an angle grid would change the results. Unchanged.
- Pathfinder: already transfers its grid without copying (~1.7 KB per request, rare); PacketBatcher's 0.5 ms wait
  (0.6% of a core) stays, a timer would add latency.

## Unreleased (branch review/stability, dead-code cleanup)

Nothing a player does in a fight changes: replay fingerprints are unchanged by every commit here.

### Fixed
- Menu on/off switches were invisible with a Windows contrast theme (Chrome's forced colors painted the switch
  and its knob the same grey); they keep their own colours now. (9473852)
- The Packet Replayer printed the whole brain state to the console on every tick, flooding it. (50ac6b4)

### Changed
- One helper, `reloadedByNextTick`, for "reloaded after one more server tick", used by One Tick and the
  object-break check instead of the sum written out by hand (One Tick's soldier check keeps its own form: it
  differs for a weapon with no reload data yet). (40fe050, 6f77cc0, e8d4492)
- Angle Finder uses the shared `normalizeAngle`. (dd133a6)
- Eight exports only their own file used are no longer exported, and a commented-out packet cost is gone.
  (5e212ee, 760c9bf, 4140049)

### Added
- `npm run check:dead`: builds the mod and reports files nothing uses, exports nothing else uses and menu settings
  nothing reads (knip can't run on this PC). (8470751)
- Tests for low-coverage combat code: the packet budget's frees and caps (68% -> 87% branches), each spike-grading
  rule (58% -> 78%), and the great-hammer push into our trap with each condition that stops it (64% -> 84%).
  (675e17c)
- The TaskScheduler timing test no longer fails on a busy PC (still checks a task never runs early). (ad0d7e6)

### Measured, not changed
- Dead code: no unused files, npm packages, settings or features (e.g. no empty webhook sender) were found;
  the bundle shrank by 83 bytes from the removals.
- Speed: a one-distance-per-object version of the object-break check behaved identically but showed no clear
  gain while other test runs were loading the PC, so it was not kept.

## Unreleased (branch review/stability, Part 1 and the ping/lag brief)

Every new behaviour is a menu toggle that is off by default, so Falcon plays exactly as before until you turn it
on. Replay fingerprints are unchanged by every commit here.

### Added
- **Trust Seen Weapons** (Combat > Combat Modules, off): keeps an enemy's seen hunting bow or crossbow, and its
  reload, instead of assuming a loaded musket whenever they hold their primary; guesses a katana, not a polearm,
  for a seen short sword. (a005a54)
- **Send Movement Instantly** (Utility > Packet Management, off): a movement key is sent at once instead of with
  the next server tick, about 55 ms sooner on average (22-91 ms depending on ping), within the packet budget and
  after Safe Walk. (d95f956)
- **Jitter-Safe Timing** (Utility > Packet Management, off): when the ping jumps around, leaves room for it in the
  three timings that use ping (preplacements, the "was that heal food" check, the packet budget). (a622ff9)
- The ping display shows the current ping, the stable ping and the ping jitter; the old "Jitter" is now "Tick
  jitter" (how unevenly server ticks arrive). (bcbfa6d)
- Measuring tools: `bench/aim-report.bench-run.ts` (would each melee attack hit, and why not), `bench/long-ticks
  .bench-run.ts` (slowest ticks, cold and warm), `bench/analysis/instant-move-latency.mjs`. (8b56b3e, 1471dda,
  d95f956)
- Tests: reload timing for every weapon with and without Samurai Armor (Falcon acts on the exact tick a weapon is
  ready), socket and server-browser gaps, PacketBatcher's fake ticks and jitter, the artificial ping setting.
  (a005a54, 3f64bb5, 24ca846, 568bff3)

### Fixed
- sandbox.moomodding.io's new game page (/assets/bundle.js since early November) printed "Could not read the game
  version" on every start; it is now recognised as 1.8.2 (checked: same packets, items, hats and timings). (d12a520)
- With Falcon pasted into the F12 console on the new page, the vanilla game kept its own connection open; it is
  now closed the first time it sends (within 2.5 s). (a6b99cb)
- Ping: a late reply after a stall was timed against the newer ping (e.g. 200 ms after a 5.2 s stall), pings
  out while the tab was hidden and stalls over 2 s counted as ping, and a reconnect kept the old server's ping
  for ~3 s. (bcbfa6d)

### Measured, not changed
- 1.8.2 timings (reloads, Bull Helmet, Turret Gear, Samurai Armor, damage) all match Falcon's values.
- Aim: the server hits within 69 deg either side of the aim, so aim error almost never causes a miss; leading
  the target gains nothing measurable. No angle wraparound bug exists.
- Drawing: matching the measured tick interval would cut drawn lag ~22% but make motion up to 50% less even on
  jittery Wi-Fi; no extrapolation cap is better in every lag spike. Unchanged.
- Tick time: no tick over 16.7 ms in any sample (median 0.3-0.9 ms); nothing beat the 10% noise rule.

## Unreleased (branch review/stability, Parts 1-3)

Everything after the "groups A-D" entry below. Replay fingerprints (sent packets and game state) are unchanged
by every commit here except where an entry says otherwise.

### Added
- **Musket Insta: "Katana + musket"** sub-toggle (off by default): the combo also runs with the katana as the
  first hit, with the katana's own damage (40) and reach (118). (1dca09e)
- Tests for the Hat System: one per rule of the classic hat/accessory priority table plus overlaps, the store
  packet timing, the bull helmet cycle and combos, and its callers (Combat Controller, One Tick, health updates).
  (35f88c4, 4a52a8d, 923d5ac)
- Property tests (fast-check, ~300 random inputs each) for the packet encoder, masks, signatures, move de-dup and
  the chat filter. (5ab99d2)
- Physics tests (river current, swimming, knockback, map edge) and an Angle Finder test at the map corner.
  (6000db6, 64e9796)
- The replay test also fingerprints the whole game state after every tick, not only sent packets. (6e918dc)
- Benchmarks: per-packet code, PacketBatcher, the Pathfinder, an opt-in 10-minute soak test with heap snapshots
  (memory stays flat), and per-step drawing times in the development profiler. Results in BENCHMARKS.md.
  (af246d5, b800597, e9788f8, 788fc66, 019ae50, 3f918fa, ecfcee5, 5a7d706)
- `mod-source/bench/analysis/lag-spike-sim.mjs`: how our own player and the camera are drawn through lag spikes.
  (9c0ecae)

### Changed
- Spike grading measures our own next step at snow and water speed, not always plain-ground speed. (97e2a14)
- Code structure: about a dozen import cycles are gone (renderer, socket handlers, menu drawers, attack modules,
  Client and the UI, PacketReplayer, Player and the physics), the per-tick state lives in `core/TickState.ts`,
  and the attack modules are created on first use. Nothing a player sees changes. (3d7927f, 0c98f7d, 8229d54,
  954e1b1, 388781e, b25dbf6, 105cc8a, 59bca7c, 04bce39, f0cdf55, e2db1b8, db528d8, 15a23d0)
- A packet added without a handler (or a handler dropped by mistake) is now a compile error. (0fba5d0)
- The player radius, bull damage and river width have one home in `constants/world.ts`. (2c1f1cc)
- TypeScript's `noUncheckedIndexedAccess` is on for the whole mod (1,180 places fixed): a missing list entry
  can no longer slip through as `undefined` unnoticed. (5393648, 2116a23, bdacc88, 28daa07, 13767db, 35905d2,
  ba049e6, f5e4e8a, ba0d2f6)
- Unused exports and a dead profiler helper removed. (9d1cf56)
- README: which branch to download, and the Quick Inject file size.

### Fixed
- The katana-spike check (Auto Breaker) ignored buildings in the way: the blocked angles were worked out but
  never used. (2726e06, 5ee645c)
- The Hat System's "bull ticks owed" and "standing still" counters were never reset, so after a respawn or
  reconnect the bull helmet could go on with no shame. (e5d1836)

### Performance (Part 3, Group A)
- Angle Finder: an enemy's second call (spots that touch us) reuses the first call's pass over the nearby
  objects (80b487a), and is skipped when the enemy is too far for any spot to touch us: enemy placement
  prediction 13-19% faster. The angle trace in the replay test was re-recorded because fewer calls are traced;
  packets and state are unchanged. (ad5ada0)
- Grader: whether each nearby spike or trap counts for each enemy is worked out once per call instead of once
  per angle, and the per-enemy Maps are arrays: grading 7-17% faster. (0add1db)
- Distance and direction math written out in the Angle Finder's and Grader's hot loops: 43% fewer allocations
  per tick (106 -> 60 KB in the busy replay). (172c5ca)

### Measured, not changed (Part 3)
- Pathfinder worker: a request costs 2-3 us of main-thread time and already transfers its grid both ways, and
  requests are rare (one per Auto Push route). Incremental grid updates would cost more than they save. Its heap
  sorts a new node from the wrong position, but on 561 test maps every path was exactly as short as with the
  fix, so it was left for a separate decision.
- PacketBatcher's 0.5 ms wait: ~0.6% of one core. In Chrome, `setTimeout` waits ~5 ms instead; only
  `scheduler.postTask` matches the 0.5 ms, and it isn't in every browser.
- On-screen smoothing (1.7x extrapolation, 170 ms slide): during a lag spike our player stands still for
  150 ms (3 updates stuck) or 483 ms (6), and a player who turns during the spike is drawn up to 67-89 units past
  where they are. A higher cap shortens the freeze but overshoots more; a lower one does the opposite.
- Menu: the select, slider and number controls and the config screen were already tested (86-100% of lines),
  and the setting-id test catches a mistyped `Menu.getValue` name (checked by planting one).

## Unreleased (branch review/stability, groups A-D)

### Added
- **Shame Grind** works (it was greyed out and never built). While the enemy is trapped it fakes Apple Insta with
  bull hits so they eat too fast and gain shame, then lets Apple Insta finish once they're shamed, stop eating
  right after hits, or after 12 fakes. Off by default. (fe8cbb7)
- Falcon stops the vanilla 1.8.2 game when it runs underneath (pasted into the console, an old cached site loader,
  a hook mod): closes its connection, stops its drawing, and gives F12 back. (9f5725b)
- README: step-by-step Quick Inject and console instructions, Reconnect, and a troubleshooting section for the F12
  console with what each Falcon message means.
- `mod-source/bench/analysis/`: the smoothing and batch-wait measurements behind Group C. (a7c71a2)

### Changed
- **Reconnect** connects to the same server again in the page instead of reloading it, so it also works when
  Falcon was pasted into the console. (55bd182)
- Defense System: two decisions that used a coin flip now follow fixed rules. Pattern Recognition leaves out 1
  spike-tick threat on even ticks and 2 on odd ones; a spike that can be placed on us counts while our shame is
  0-2. (742b9f2)
- Safe Walk counts 1.8.2's snow and water slowdowns and the river current, so in the snow and the river it stops
  only when a spike is really in reach. Plain ground is unchanged. (eaef9eb)
- Auto Grind asks the packet budget before placing; with room it places exactly as before. (f72da0d)

### Fixed
- Connecting again without a page reload kept the old server's players, buildings, projectiles, animals,
  alliances and queued actions, and the new socket got no packet handlers at all. Everything is reset now and the
  old socket is retired quietly. (1c58924)
- The river current and the flipper hat ignored platforms: 1.8.2 skips water rules for a player on a platform
  (`zIndex`). (f7e336e)
- The late-hit check (pattern recognition while trapped) could count an enemy's damage and knockback twice.
  (665c1a2)
- `PlacementSystem.place` couldn't say "building limit full", so hotkeys and Auto Place counted refused
  placements toward the 4-per-tick cap and drew markers for them. It now returns placed / full / not owned. The
  1.8.2 limits match Falcon's (99, or 299 for mills, boost pads and teleporters); moomodding.io's own per-group caps
  aren't public. (8b5fa5d)

- Hit trees and rocks were counted as building hits (they have endless health), adding packet-log noise. (b0a55ab)
- The "most active server" button never hid when its region had no server left. (bd1dfd0)
- Packet Replayer: "Open Logs Folder" and "Clear All Logs" left a loading screen up for good; they now say where
  the logs are (Downloads) and clear the in-memory log.

### Tests
- About 195 new tests (477 -> 673): the socket's disconnect, handshake, reconnect and odd-packet paths, every
  SocketListener handler, the server browser, the page loader, the menu's select / slider / number controls and the
  config screen (with a save-and-reload round trip of every control), a stricter setting-id check, and branch
  tests for AttackManager, Auto Place, Push Strikes (Predictive), Object Breaker, Knockback Instakills and Spike
  Grader. Every fix above has a test that fails on the old code. (3bef003, 59ca5da, 4b1e345, 70f50c7, 3c5a806,
  adf4e13)

### Measured, not changed (Group C)
- On-screen smoothing: no rubber-banding for straight movement; 0.7 units in total when a player stops during a
  lag spike. Matching the tick interval would cut ~7 units of lag but make motion ~50% less even on jittery Wi-Fi.
- Angle Finder: about 2 ungraded calls per visible enemy per tick plus our own graded one; a merged, grid-based
  redesign is estimated at 5-8% of a tick, under the 10% noise line.
- PacketBatcher's 0.5 ms wait costs about 0.6% of one core; every alternative waits longer.

## Earlier unreleased work (branch improve/phased)

### Fixed
- The mod no longer runs on the death screen. While you were dead, PacketBatcher kept faking a server tick
  about 9 times a second and every module ran for the dead player. (536fbd8)
- A projectile whose id the server reused while the old one still looked active was dropped, so defense could
  miss an incoming arrow or turret shot. (95ea940)
- Placement markers grew by one per placement forever with Render Placements off, and floating texts and
  markers grew while the tab was hidden. Both are now capped. (cbead59)
- The packet recorder crashed with RangeError on a very large object packet. (d901198)
- Loading a saved config now redraws the menu and keeps the config as your current settings; deleting a
  config no longer also loads it. (f462da9)
- Attack modules forget their per-life flags when you respawn. (c76edd2)
- `Menu.setValue` warns instead of crashing on an unknown setting. (8e3f9ef)

### Added
- Menu: a settings search, a reset-to-default button on changed settings, Export and Import of settings
  files, and full keyboard use (Tab, Enter, Space, visible focus). (f462da9)
- Extension dashboard: a status badge (ready, files missing, last load failed with the reason), a first-time
  setup guide, troubleshooting tips, and light and dark themes. (f5f5d9e)
- A visible error box on the game page when Falcon can't start, naming the step that failed. (b265721)
- `npm run dev` watches the mod and the extension together. (c9dd204)
- `npm run lint`, `lint:fix`, `format`, `format:check`, `install:all` and `test:smoke`. (dc99072, fc8d7e7)
- Docs: this changelog, [docs/MODULES.md](docs/MODULES.md) and a generated
  [docs/SETTINGS.md](docs/SETTINGS.md) (`npm run docs:settings`).

### Changed
- `Menu.ts` (139 KB) split into the menu code (23 KB), one settings file per tab, icons and types. (bb8887a)
- All attack modules share one documented interface: init, update, run, reset. (c76edd2)
- No `any` types left; ESLint now rejects new ones. Shared magic numbers have names in
  `utils/constants/world.ts`. Tests are typechecked too. (f47cc9e, eafa30d, 825b9c3)
- The extension dashboard loads no fonts from Google. (94f488a)
- `npm audit` in the lint tools: 11 moderate findings fixed by pinning minimatch 11. (269a2c8)
- CI lints, typechecks, builds all three parts with the smoke test, runs the tests and checks that
  docs/SETTINGS.md is up to date.

### Performance
- Per-tick work roughly halved by the replay-benchmark work (profiler, `npm run bench`, fewer allocations,
  cheaper graders); the bundle is written as UTF-8 (28 KB smaller). The replay test proves combat decisions
  are identical. (95bf4b1 to aa12068)

## Earlier work (branches review/stability and pr/codebase-review-fixes)

- Stability: strict TypeScript checks, https-only host access for the extension, saved settings with a
  version number, tests that every toggle can be flipped mid-fight, pathfinder replies matched to their
  requests, PacketRecorder bookkeeping fixes. (e45e7e5 to 32a3dfe)
- moomodding.io v1.8.2 support, a Quick Inject build, spawn-time crash fixes and the first Vitest tests.
  (abbd710 and earlier)
- Code review fixes, dead-code removal and the dev stats tooling (`npm run stats`). (524546c, 5f8e74d)
- Packet budget and dedupe fixes, less lag on jittery connections, chat command improvements. (2026-10-23)
- The mod is bundled into the extension; the local backend was removed. (23a6277)
- Baseline import of Falcon. (27d8ee0)
