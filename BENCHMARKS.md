# Benchmarks

Baseline numbers before the Phase 3 optimizations, so every later speed change can be compared against them.
Measured 2026-11-08 on the development PC (Windows 11, Node 24.21.0) at commit 6e918dc.

## How to run

```bash
npm run bench
```

This runs two things and writes JSON files to `mod-source/bench/results/` (not committed):

- **Replay benchmark** (`replay.bench-run.ts`): plays the recorded games in `mod-source/bench/recordings` through
  the real mod offline, 1 warm-up run + 5 timed runs each, and times every step of a tick. It also prints a
  fingerprint of every packet the mod sent; an optimization must not change it.
- **Packet micro-benchmark** (`packets.bench-run.ts`): times the code that runs once per sent or received packet.
  Best of 5 rounds.

**The numbers move a lot between runs on the same PC** (one run of the busy replay today took 1.08 ms per tick,
the next two 0.32 ms). So a speed claim needs several runs, alternating old and new code, and only the best
("best ms/tick") column is worth comparing.

## Replay benchmark: time per game tick (ms)

A tick is 111 ms of real time on the server, so all of the mod's per-tick logic uses well under 1% of it.

| Recording | Ticks | Packet fingerprint | Tick, best | Tick, avg | Tick, p95 | Worst tick |
|---|---:|---|---:|---:|---:|---:|
| sample-base | 540 | `6aca8484bdbe212d` | 0.324 | 0.347 | 0.692 | 5.9 |
| sample-busy | 1081 | `c0427ed3be9988ca` | 0.321 | 0.323 | 0.578 | 4.6 |
| sample-synthetic | 135 | `f815fbedf6756a5e` | 0.267 | 0.269 | 0.661 | 4.4 |

Biggest steps (best ms per tick):

| Step | base | busy | synthetic |
|---|---:|---:|---:|
| `packet.a` handler (whole player update, includes the tick) | 0.335 | 0.332 | 0.281 |
| `AngleFinder.compute` (all calls in one tick) | 0.135 | 0.153 | 0.094 |
| `tick.prepare` | 0.117 | 0.132 | 0.076 |
| `updatePlacementAngles` | 0.085 | 0.106 | 0.049 |
| `AngleFinder` graders | 0.038 | 0.057 | 0.053 |
| `AutoPlacer.preStart` | — | 0.062 | 0.064 |
| `AttackManager` | 0.051 | — | — |
| `DefenseSystem.start` | 0.037 | 0.031 | 0.029 |

AngleFinder is 35–48% of a tick, so it is the first thing to look at in Phase 3. The worst ticks (4–6 ms today,
10–18 ms in other runs) are much slower than the average; they are most likely garbage collection, which
`BENCH_ALLOC=1` can confirm.

## Packet micro-benchmark (µs per call, best of 5 rounds)

| Operation | µs |
|---|---:|
| `CustomEncoder.encode`: move (fast path) | 0.09 |
| `CustomEncoder.encode`: hit + sequence (fast path) | 0.07 |
| `CustomEncoder.encode`: chat (msgpack library) | 0.18 |
| `PacketManager.getPacketSignature` (HMAC-SHA256) | 5.1 |
| `xorPacket`: v1.9.0 mask, 64 bytes | 0.20 |
| `PacketManager.manage`: move de-dup | 0.04–0.17 |
| msgpack decode: 10-player update | 1.2 |
| `LegacyPacketAdapter.adapt`: 10-player update | 0.47 |

Even the slowest (the signature, only on servers that need it) costs about 5 µs, and the mod sends a few packets
per tick, so packet code is not worth optimizing.

Added later (measured while the PC was about 5× slower: the HMAC signature took 28.8 µs instead of 5.1, so divide
by about 5 to compare with the table above):

| Operation | µs on the busy PC | ≈ quiet PC |
|---|---:|---:|
| PacketBatcher: queue + order + hand on a 20-packet tick | 10.9 | ~2 |

## Pathfinder (`pathfinder.bench-run.ts`)

A base-like field of 40 trees and walls between start and goal, 1,900 apart (83×20 cells, 710 blocked); best of
5 rounds, on the same busy PC.

| Step | µs on the busy PC | ≈ quiet PC |
|---|---:|---:|
| `Pathfinder.find`: build the grid (main thread) | 26–98 | ~5–20 |
| A* search, path of 65 cells (in the web worker, off the main thread) | 380 | ~75 |

Both are small next to a 111 ms tick, and the search doesn't block the game at all.

## Phase 3 results

Each change is measured with alternating old/new runs (old, new, old, new...), comparing the median of the
new/old ratios, because single runs on this PC vary by 2× or more. A change is kept only if it saves about 5% or
more and every fingerprint (packets, angles, game state) stays identical.

| Change | Result | Kept? |
|---|---|---|
| AngleFinder: the second call per enemy (without preplace) reuses the first call's pass over nearby objects (80b487a) | Tick: base −8%, busy −9%, synthetic no change. `updatePlacementAngles`: base/busy 18–26% faster. Garbage per tick 165 KB → 124 KB (busy). | Yes |
| Grader: per-enemy numbers in an array instead of `Map` (avoids boxing decimals) | busy −2%, synthetic +5%, base within noise | No, reverted |

**Slow ticks are not garbage collection.** During a whole replay there were 0–1 GC pauses (3–4 ms at most),
while the slowest ticks took 17–24 ms. Those come from the JIT compiling freshly loaded code (each benchmark run
loads the mod again) or from the PC being busy, so cutting allocations would not remove them.

**Where a tick goes now** (busy replay, sampled CPU self time, profiler on): `computeAngles` 10%, `updateObjects`
9%, `Grader.prepare` 8%, `isInLineOfSight` 7%, `computeInterval` 6%, and a long tail. None of these has an
obvious large saving left; each has already been tuned (candidate lists, cached aims, cheap tests first).

## Soak test (memory over 10 minutes)

```bash
BENCH_SOAK=1 npm run bench -- soak
```

Plays about 10 minutes of game in one session and measures memory after a forced garbage collection every game
minute. **steady** loops the synthetic fight (3 players, 49 buildings); **churn** plays the busy real recording 5
times in a row (players and buildings come and go).

| Run | Ticks | Heap at minute 2 | Heap at minute 9 | Growth |
|---|---:|---:|---:|---:|
| steady | 5361 | 82.28 MB | 82.59 MB | +0.3 MB |
| churn | 5401 | 101.50 MB | 101.71 MB | +0.2 MB |

Flat: no leak. Player and building counts stay the same throughout. The soak test also writes a heap snapshot
after minute 2 and at the end (`results/soak-<run>-start/end.heapsnapshot`, which Chrome DevTools > Memory > Load
opens) and compares the live objects per type: the only type that grew was plain `Object`, by 6 (of about
33,000) in both runs. (A first run showed about 1 MB per minute,
which turned out to be the test harness: Vitest's spies remember every call, and the replay kept every sent packet.
The soak test now clears the spies, and the replay hashes sent packets as they go; the packet fingerprints are
unchanged.)

## Drawing (renderer)

Measured in a real browser: a development build (`npm run build:dev`, profiler on with the `falcon-profiler`
localStorage key set to "1") on a local page, replaying `sample-busy.fpl` with the Packet Replayer, at a steady 60
frames per second. Development builds time each drawing step; the profiler overlay shows them as `draw.*`.

| Step | ms per frame (median of 8 one-second averages) |
|---|---:|
| `draw.update` (camera, entity smoothing; in a replay also the replayed ticks) | 0.32 |
| `draw.background` (background, river, grid) | 0.07 |
| `draw.world` (buildings, trees, players, animals, projectiles) | 1.64 |
| `draw.health+placements+border+tint` | 0.04 |
| `draw.overlays+names+text` | 0.30 |
| `draw.minimap` | 0.01 |
| **whole frame** | **2.38** |

Within the world step, buildings and trees take most of the time, then players; preparing the visible list,
projectiles and animals cost almost nothing.

A frame uses about 2.4 ms of the 16.7 ms it has at 60 fps (the GPU's own time not counted). What the plan suggested
is already in place: only objects on screen are drawn (a bounds query plus `isOnScreen`), buildings and resources
are cached sprites, the volcano is drawn from pre-rendered canvases, the grid and minimap cost 0.01–0.07 ms, and
the menu is HTML that is only rebuilt when something changes. What is left is the canvas drawing calls
themselves; changing those risks a slightly different picture, and 5% of a frame is about 0.1 ms, which the browser
pane can't measure reliably. So the renderer was left unchanged.

To check it yourself in the real game: open it in Chrome, F12 > Performance, record ~10 seconds of play, and look at
the time per frame.
