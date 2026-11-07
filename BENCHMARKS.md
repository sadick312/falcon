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

## Not measured here: drawing

The renderer (canvas drawing every frame) can't be timed in Node; it needs a real browser. To measure it, open the
game in Chrome, press F12 → Performance → record ~10 seconds of play, and look at the time per frame and which
functions take the most of it.
