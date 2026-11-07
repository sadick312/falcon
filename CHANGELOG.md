# Changelog

What changed in Falcon, newest first. Each entry names the commit(s) for the details.

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
