// Inputs a modded server (or a broken packet) can send: unknown weapon/hat/item/animal ids, missing lists,
// "set value" packets for non-stats, reused player ids. The game must keep running and drawing (B14-B19).
import { createRobotics, spawnWorld, serverTick, reporter } from "./harness.mjs";

const T = reporter("robustness");
const env = await createRobotics({ storage: { hudReloads: "true", hudDanger: "true" } });
const rb = env.rb;
await env.connect();
const world = spawnWorld(env, { enemies: 3 });
let t = 0;
const play = n => { for (let i = 0; i < n; i++) { serverTick(env, world, t++); env.frame(); } };
play(5);
const fails = () => env.failures().length;

// B14: an enemy holding a weapon and wearing a hat the script doesn't know.
{
    const f0 = fails();
    const e = world.enemies[0];
    const flat = [1, world.me.x, world.me.y, 0, -1, 5, 2, null, 0, 6, 0, 0, 0, e.sid, e.x, e.y, 0, 77, 42, 9, null, 0, 999, 888, 0, 0];
    for (let i = 0; i < 5; i++) { env.clock.t += 111; env.server("a", [flat]); env.frame(); }
    const p = rb.Ae.find(x => x.sid === e.sid);
    T.ok(fails() === f0, "unknown weapon / variant / hat / held item: no failures, frames keep drawing");
    T.ok(rb.s5.weapons[p.weaponIndex] && p.skinIndex === 0 && p.tailIndex === 0 && p.buildIndex === -1, "unknown ids stored as the previous weapon, no hat, nothing held");
    env.server("K", [e.sid, 1, 42]);
    T.ok(fails() === f0, "gather animation with an unknown weapon is ignored (B14)");
    play(3);
}
// B15: your weapon and item lists.
{
    const f0 = fails();
    const before = rb.Ai.weapons.slice();
    env.server("V", [[99], true]);
    T.ok(rb.Ai.weapons.join() === before.join(), "unknown primary: weapon list kept");
    env.server("V", [[5, 99], true]);
    T.ok(rb.Ai.weapons.join() === "5", "unknown secondary dropped");
    env.server("V", [[5, 10], true]);
    env.server("V", [5, false]);
    T.ok(Array.isArray(rb.Ai.items), "item list must stay a list");
    env.server("O", [1, 40]);
    play(3);
    T.ok(fails() === f0, "no failures (B15)");
}
// B16: buildings and animals of unknown types.
{
    const f0 = fails();
    const n = rb.Ac.length;
    env.server("H", [[90001, world.me.x + 100, world.me.y, 0, 50, null, 250, 2]]);
    T.ok(rb.Ac.length === n, "unknown building type not added");
    env.server("I", [[500, 99, world.me.x + 200, world.me.y, 0, 100, 0]]);
    play(3);
    T.ok(fails() === f0, "unknown animal type ignored, frames keep drawing (B16)");
}
// B17: missing lists.
{
    const f0 = fails();
    env.server("G", [null]);
    env.server("A", [null]);
    env.server("4", [null]);
    play(3);
    T.ok(fails() === f0, "leaderboard / clans / alliance packets without lists are ignored (B17)");
}
// B18: "set player value" only for numeric stats.
{
    const items = rb.Ai.items;
    env.server("N", ["items", 5]);
    env.server("N", ["x2", "hello"]);
    env.server("N", ["__proto__", 1]);
    env.server("N", ["points", 1234]);
    T.ok(rb.Ai.items === items && Number.isFinite(rb.Ai.x2) && rb.Ai.points === 1234, "only numeric stats are set (B18)");
}
// B19: a player reusing the sid of one whose "left" packet never came.
{
    env.server("D", [["ghost", 50, "ghost", 7100, 7000, 0, 100, 100, 35, 0], false]);
    env.server("D", [["newcomer", 50, "newcomer", 7150, 7000, 0, 100, 100, 35, 0], false]);
    const withSid = rb.Ae.filter(p => p.sid === 50);
    T.ok(withSid.length === 1 && withSid[0].id === "newcomer", "one player per sid; the newer one wins (B19)");
    // Your own player re-added under a new id (e.g. after respawn) must still move.
    env.server("D", [["me-again", 1, "me", world.me.x, world.me.y, 0, 100, 100, 35, 0], true]);
    play(3);
    T.ok(rb.Ae.filter(p => p.sid === 1).length === 1 && Number.isFinite(rb.Ai.x2) && rb.Ai.visible, "you are updated after being re-added");
}
T.ok(env.failures().length === 0, "no handler failures overall: " + env.failures().slice(0, 2).join(" | "));
T.done();
