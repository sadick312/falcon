// Group C3 analysis: CPU cost of PacketBatcher's 0.5 ms wait (MessageChannel re-posting until no packet arrived for
// 0.5 ms). Run: node mod-source/bench/analysis/batch-poll-cost.mjs
// PacketBatcher's wait: after a packet, post to a MessageChannel and re-post until 0.5 ms passed without a new packet.
// Measures, per batch, how many polls that takes and how long the loop keeps the thread busy, then scales it to the
// game's packet rate (one batch per server tick, ~9/s, plus a few extra bursts).
import { performance } from "node:perf_hooks";

const WINDOW = 0.5;
const BATCHES = 2000;
const ch = new MessageChannel();
let polls = 0, last = 0, done;

ch.port1.onmessage = () => {
    polls++;
    if (performance.now() - last >= WINDOW) done();
    else ch.port2.postMessage(null);
};

const pollCounts = [];
const busy = [];
for (let i = 0; i < BATCHES; i++) {
    polls = 0;
    const start = performance.now();
    last = start;
    await new Promise(res => { done = res; ch.port2.postMessage(null); });
    busy.push(performance.now() - start);
    pollCounts.push(polls);
}
ch.port1.close();

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const perSecond = 12; // ~9 ticks plus a few extra bursts (ping, leaderboard)
console.log(`polls per batch: avg ${avg(pollCounts).toFixed(1)}, median ${med(pollCounts)}`);
console.log(`busy per batch: avg ${avg(busy).toFixed(3)} ms, median ${med(busy).toFixed(3)} ms`);
console.log(`at ${perSecond} batches/s: ${(avg(busy) * perSecond).toFixed(2)} ms of every 1000 ms = ${(avg(busy) * perSecond / 10).toFixed(2)}% of one core`);
