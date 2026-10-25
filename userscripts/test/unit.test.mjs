// Pure logic on the fully loaded script: helpers, damage, reload timing, simulator, grid, placement, pathfinder.
import { createRobotics, spawnWorld, serverTick, reporter } from "./harness.mjs";

const T = reporter("unit");
const env = await createRobotics();
await env.connect();
const world = spawnWorld(env);
for (let t = 0; t < 5; t++) serverTick(env, world, t);
const rb = env.rb;
const { s4, s5, roboticsGrid: grid, roboticsSim: sim } = rb;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// --- distance / angle helpers
T.ok(near(s4.getDistance(0, 0, 3, 4), 5), "getDistance 3-4-5");
T.ok(near(s4.getDirection(10, 0, 0, 0), 0) && near(s4.getDirection(0, 10, 0, 0), Math.PI / 2), "getDirection: radians, measured from the second point");
T.ok(near(s4.getAngleDist(0.1, Math.PI * 2 - 0.1), 0.2), "getAngleDist wraps around 2 pi");
T.ok(near(s4.getAngleDist(0, Math.PI), Math.PI), "getAngleDist max is pi");
T.ok(Number.isFinite(s4.getDirection(5, 5, 5, 5)), "getDirection of the same point is finite (atan2(0, 0))");
T.ok(near(rb.sr.normalizeAngle(-0.5), Math.PI * 2 - 0.5) && near(rb.sr.normalizeAngle(7), 7 - Math.PI * 2), "normalizeAngle into [0, 2 pi)");

// --- damage table
T.ok(rb.roboticsWeaponDamage(5, 0) === 45, "polearm base damage 45");
T.ok(near(rb.roboticsWeaponDamage(5, 3), 45 * rb.r.weaponVariants[3].val), "variant multiplier applied");
T.ok(rb.roboticsWeaponDamage(15, 0) === 50 && rb.roboticsWeaponDamage(9, 0) === 25, "ranged weapons use projectile damage");
T.ok(rb.roboticsWeaponDamage(99, 0) === 0 && rb.roboticsWeaponDamage(5, 99) === 45, "unknown weapon = 0, unknown variant = base");
for (const w of s5.weapons) T.ok(Number.isFinite(w.projectile !== undefined ? w.Pdmg : w.dmg) || w.id === 11 || w.id === 14, "weapon " + w.id + " has a finite damage value");

// --- reload timing
{
    const me = rb.Ai;
    const other = rb.Ae.find(p => p !== me);
    const Ap = rb.Ap;
    const saved = { avg: Ap.avg, max: Ap.max };
    Ap.avg = 60; Ap.max = 80;
    rb.fl.reloadTiming = undefined;
    T.ok(rb.roboticsReloadSlack(me) === 30 && rb.roboticsReloadSlack(other) === 80, "reload slack legacy: RTT/2 for you, worst ping for enemies");
    rb.fl.reloadTiming = "exact";
    T.ok(rb.roboticsReloadSlack(me) === 0, "tick-exact at 60 ms: 0");
    Ap.avg = 250;
    T.ok(near(rb.roboticsReloadSlack(me), 2 * rb.fU.tickRate), "tick-exact at 250 ms: two ticks");
    rb.fl.reloadTiming = "falcon";
    T.ok(rb.roboticsReloadSlack(me) === 0, "falcon: 0");
    rb.fl.reloadTiming = undefined;
    Ap.avg = saved.avg; Ap.max = saved.max;
}

// --- movement simulator
{
    const st = sim.state(rb.Ai);
    st.x = 3000; st.y = 3000; st.velX = 0; st.velY = 0; st.skinIndex = 0; st.tailIndex = 0; st.weaponIndex = 5; st.buildIndex = -1;
    const moved = sim.simTick(st, 0);
    T.ok(moved.x > st.x && near(moved.y, st.y, 1e-6), "simTick: walking east moves east only");
    const still = sim.simTick(st, null);
    T.ok(still.x === st.x && still.y === st.y, "simTick: standing still stays");
    const res = sim.simulate(Object.assign(sim.state(rb.Ai), { x: 3000, y: 3000, velX: 0, velY: 0, health: 30, skinIndex: 0 }), [[{ type: "damage", damage: 35 }]], 1);
    T.ok(res.oneTicked, "simulate: 35 damage kills a 30 hp target this tick");
    const edge = sim.simTick(Object.assign({}, st, { x: 10, y: 10, velX: -1, velY: -1 }), null);
    T.ok(edge.x >= st.scale && edge.y >= st.scale, "simTick: clamped inside the map");
}

// --- grid
{
    const live = rb.Ac.filter(o => o.active);
    const cx = 7000, cy = 7000, rad = 600;
    const brute = live.filter(o => Math.hypot(o.x - cx, o.y - cy) <= rad);
    const viaGrid = grid.near(cx, cy, rad, []).filter(o => o.active && Math.hypot(o.x - cx, o.y - cy) <= rad);
    T.ok(brute.length > 10 && brute.length === viaGrid.length && brute.every(o => viaGrid.includes(o)), "grid.near finds exactly what a full scan finds (" + brute.length + ")");
    const o = live[0];
    grid.remove(o);
    T.ok(!grid.near(o.x, o.y, 5, []).includes(o) && grid.bySid.get(o.sid) !== o, "grid.remove drops cell and sid");
    grid.insert(o);
    T.ok(grid.near(o.x, o.y, 5, []).includes(o) && grid.bySid.get(o.sid) === o, "grid.insert puts it back");
    let dup = 0;
    for (const list of grid.cells.values()) dup += list.length - new Set(list).size;
    T.ok(dup === 0, "no object twice in a cell");
}

// --- placement angles
{
    const A = rb.roboticsAngles;
    T.ok(near(A.freeArc(3000, 3000, [], []), Math.PI * 2), "freeArc: open field = full circle");
    const merged = A.merge([0.5, 1, 0.8, 1.5, 3, 4]);
    T.ok(merged.length === 2 && near(merged[0][1], 1.5), "merge overlapping arcs");
    const sub = A.subtract([[0, Math.PI * 2]], [[1, 2]]);
    T.ok(sub.length === 2 && near(sub[0][1], 1) && near(sub[1][0], 2), "subtract a blocked arc");
    const samples = A.sample([[0, 1], [2, 2.5]], 30);
    T.ok(samples.length > 0 && samples.every(a => a >= 0 && a <= 2.5), "sample stays inside the free arcs");
}

// --- pathfinder
{
    const enemy = rb.Ad[0];
    rb.AQ = enemy;
    const res = rb.sN.calc({ x: 0, y: 0 }, false, "follow");
    T.ok(Array.isArray(res.paths), "pathfinder returns a path list");
    if (res.paths.length >= 2) {
        const cells = rb.sN.cells;
        const n = rb.em.gridSize;
        const cp = rb.em.scale / n;
        const blocked = res.paths.some(p => cells[Math.round((p.y - rb.sN.originY) / cp) * n + Math.round((p.x - rb.sN.originX) / cp)] === 1);
        T.ok(!blocked, "path never steps on a blocked cell");
        const dir = rb.sN.step(res.paths);
        T.ok(Number.isFinite(dir), "step() gives a direction");
    }
}

// --- hit chance and target weakness
{
    const e = rb.Ad[0];
    const h = rb.roboticsHitChance(e, 5);
    T.ok(h >= 0.05 && h <= 1, "hit chance in [0.05, 1]");
    T.ok(rb.roboticsHitChance(e, 999) === 0, "unknown weapon: 0 hit chance");
    const w100 = rb.roboticsTargetWeakness({ health: 100, skinIndex: 0 });
    const w40 = rb.roboticsTargetWeakness({ health: 40, skinIndex: 0 });
    T.ok(w40 > w100 && Number.isFinite(rb.roboticsTargetWeakness({})), "weakness: lower health is weaker; missing fields are fine");
}

// --- B9: who hit you, when the damage float differs in the last bits
{
    const e = rb.Ad[0];
    Object.assign(e, { attacked: true, weaponIndex: 5, primaryVariant: 1, skinIndex: 7, tailIndex: 0 });
    rb.Ai.skinIndex = 0;
    const variant = rb.r.weaponVariants[1].val;
    let modelled = 45;
    modelled *= 1 * 1.5 * 1 * variant;
    const fromHealth = 100 - (100 - 45 * variant * 1.5);
    T.ok(modelled !== fromHealth || true, "setup: damage " + modelled + " vs health difference " + fromHealth);
    const savedAk = rb.Ak;
    rb.Ak = [e];
    T.ok(rb.eD(fromHealth).includes(e) && rb.eD(modelled + 0.004).includes(e), "attacker found despite float rounding (B9)");
    T.ok(!rb.eD(modelled + 1).includes(e), "a different damage is still not matched");
    rb.Ak = savedAk;
    e.attacked = false;
}

T.ok(env.failures().length === 0, "no handler failures: " + env.failures().slice(0, 2).join(" | "));
T.done();
