# Robotics test harness

Node tests for `../robotics-kusoi.user.js`. They need no browser. Each test loads the whole userscript in a `vm` context with a mocked page (DOM, 2D canvas, WebSocket, localStorage, clock and timers) and the real `msgpack-lite`. The tests then drive it through a fake game socket. The script file on disk is never modified; the harness adds `window.__rb` (access to internals) to the source it loads.

```bash
npm install
npm test
```

| File | What it checks |
|---|---|
| `unit.test.mjs` | helpers, damage table, reload timing, movement simulator, grid, placement angles, pathfinder, hit chance, attacker matching |
| `limiter.test.mjs` | per-second and per-tick limits under random load, heal reserve, priorities, whole sequences, newest-only aim; both host profiles |
| `scheduler.test.mjs` | `fU` timing, isolation, no double runs, runs while dead, resets, missed-tick catch-up |
| `replay.test.mjs` | spawn, fight, death, respawn, reconnect, server switch ×4; no failures, nothing grows, heap stays flat |
| `fuzz.test.mjs` | 3000 random/malformed packets (`FUZZ_SEED`, `FUZZ_ROUNDS`); nothing escapes, state stays sane, a normal game works afterwards |

Other commands:

```bash
npm run bench
```
Seeded replay: about 900 objects, 8 enemies, 300 ticks, 6 frames per tick. Prints tick and frame avg/p95. `ROBOTICS_SCRIPT=path/to/other.user.js npm run bench` benchmarks another copy.

```bash
node compare.mjs old.user.js
```
Plays the same seeded game on both copies with most toggles on and diffs every packet sent. Use it to prove a refactor changes nothing.

```bash
npm run lint
```
ESLint on the script.
