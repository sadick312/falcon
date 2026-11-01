// Feature #14, Attack Manager: runs every combat module each tick, starts one of the attacks they queued, and plays its
// (up to 2) steps on consecutive ticks. Modules are replaced with stubs here so only the manager is tested.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

async function setUp(weapons = [5]) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: weapons[0] });
    game.spawn({ sid: 2, x: 1100, y: 1000 });
    game.setLoadout(weapons, [0, 3, 6, 15]);
    game.update();

    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: AttackQueuePool } = await import("@core/mod/combat/core/AttackQueuePool");
    return { AttackManager, AttackQueuePool };
}

type Manager = Awaited<ReturnType<typeof setUp>>;

/** A stand-in module that queues `queue` on the ticks listed in `when` (counted from 1 per main() call). */
function stubModule(queue: unknown, when: number[]) {
    let calls = 0;
    return {
        init() { },
        update() { },
        run() {
            calls++;
            if (when.includes(calls)) (stubModule.manager!.AttackManager.addAttackQueue as (q: unknown) => void)(queue);
        }
    };
}
stubModule.manager = undefined as Manager | undefined;

function makeQueue(m: Manager, reasons: [string, string | null], grade = 0) {
    const queue = m.AttackQueuePool.createAttackQueue();
    queue.sequence[0].reason = reasons[0];
    queue.sequence[0].dontUse = false;
    queue.sequence[1].reason = reasons[1] ?? "";
    queue.sequence[1].dontUse = reasons[1] === null;
    queue.grade = grade;
    return queue;
}

/** Runs AttackManager.main() `ticks` times with only the given modules; returns the action reason per tick. */
function runTicks(m: Manager, modules: unknown[], ticks: number) {
    const original = m.AttackManager.modules;
    m.AttackManager.modules = modules as typeof original;
    const seen: (string | undefined)[] = [];
    try {
        for (let i = 0; i < ticks; i++) {
            m.AttackManager.main();
            seen.push(m.AttackManager.currentAttackAction?.reason);
        }
    } finally {
        m.AttackManager.modules = original;
    }
    return seen;
}

describe("Attack Manager", () => {
    it("plays a queued 2-step attack on two consecutive ticks, then is free again", async () => {
        const m = await setUp();
        stubModule.manager = m;
        const combo = makeQueue(m, ["first", "second"]);
        expect(runTicks(m, [stubModule(combo, [1])], 4)).toEqual(["first", "second", undefined, undefined]);
    });

    it("skips a step marked dontUse (a 1-step attack takes one tick)", async () => {
        const m = await setUp();
        stubModule.manager = m;
        const single = makeQueue(m, ["only", null]);
        expect(runTicks(m, [stubModule(single, [1])], 3)).toEqual(["only", undefined, undefined]);
    });

    it("reports isAttacking() while a step is still to come", async () => {
        const m = await setUp();
        stubModule.manager = m;
        const combo = makeQueue(m, ["first", "second"]);
        const original = m.AttackManager.modules;
        m.AttackManager.modules = [stubModule(combo, [1])] as typeof original;
        try {
            m.AttackManager.main();
            expect(m.AttackManager.isAttacking()).toBe(true);
            m.AttackManager.main();
            expect(m.AttackManager.isAttacking()).toBe(false);
        } finally {
            m.AttackManager.modules = original;
        }
    });

    it("today starts the first queued attack, whatever the grades (possible issue P8)", async () => {
        const m = await setUp();
        stubModule.manager = m;
        const low = makeQueue(m, ["low grade, queued first", null], 1);
        const high = makeQueue(m, ["high grade, queued second", null], Infinity);
        expect(runTicks(m, [stubModule(low, [1]), stubModule(high, [1])], 1)).toEqual(["low grade, queued first"]);
    });

    it("prepares a bull hit with the bull helmet, or the soldier helmet for daggers", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        const { WEAPON_ID_MAP } = await import("@constants/items");

        let m = await setUp([WEAPON_ID_MAP.POLEARM]);
        let queue = m.AttackQueuePool.createAttackQueue();
        m.AttackManager.prepareBullHitSequence(queue.sequence, "test");
        expect([queue.sequence[0].wpnId, queue.sequence[0].skinData[0], queue.sequence[0].aimType, queue.sequence[1].dontUse])
            .toEqual([WEAPON_ID_MAP.POLEARM, STORE_HAT_MAP.BULL_HELMET, "nearest", true]);
        game!.done();

        m = await setUp([WEAPON_ID_MAP.DAGGERS]);
        queue = m.AttackQueuePool.createAttackQueue();
        m.AttackManager.prepareBullHitSequence(queue.sequence);
        expect([queue.sequence[0].skinData[0], queue.sequence[0].reason]).toEqual([STORE_HAT_MAP.SOLDIER_HELMET, "autoBullHit"]);
    });
});
