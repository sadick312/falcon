# Changelog

What changed in Falcon, newest first. Each entry names the commit(s) for the details.

## Unreleased (branch improve/phased)

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
