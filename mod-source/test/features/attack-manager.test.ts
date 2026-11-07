// Feature #14, Attack Manager: runs every combat module each tick, starts one of the attacks they queued, and plays its
// (up to 2) steps on consecutive ticks. Modules are replaced with stubs here so only the manager is tested.
import { afterEach, describe, expect, it, vi } from "vitest";
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

    it("starts the queued attack with the highest grade (P8: it used to take the first queued)", async () => {
        const m = await setUp();
        stubModule.manager = m;
        const low = makeQueue(m, ["low grade, queued first", null], 1);
        const high = makeQueue(m, ["high grade, queued second", null], Infinity);
        expect(runTicks(m, [stubModule(low, [1]), stubModule(high, [1])], 1)).toEqual(["high grade, queued second"]);
    });

    it("breaks a tie in grade by module order", async () => {
        const m = await setUp();
        stubModule.manager = m;
        const first = makeQueue(m, ["first module", null], 2);
        const second = makeQueue(m, ["second module", null], 2);
        expect(runTicks(m, [stubModule(first, [1]), stubModule(second, [1])], 1)).toEqual(["first module"]);
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

describe("Attack Manager: is the pushed enemy on the spike?", () => {
    async function pushing(spikeX: number | null, autoPushing = true) {
        const m = await setUp();
        const { LIST_ID_MAP } = await import("@constants/items");
        const { default: AutoPusher } = await import("@core/mod/combat/core/AutoPusher");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        if (spikeX !== null) game!.addObjects([{ sid: 700, x: spikeX, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ME }]);
        AutoPusher.autoPushing = autoPushing;
        AutoPusher.theSpike = spikeX === null ? undefined as never : ObjectManager.getObject(700)!;
        try {
            return m.AttackManager.checkForAutoPushingStatus();
        } finally {
            AutoPusher.autoPushing = false;
        }
    }

    it("yes when Auto Push is on and the enemy touches its spike", async () => {
        expect(await pushing(1150)).toBe(true);
    });

    it("no when the enemy is away from the spike, there's no spike, or Auto Push is off", async () => {
        expect(await pushing(1400)).toBe(false);
        expect(await pushing(null)).toBe(false);
        expect(await pushing(1150, false)).toBe(false);
    });
});

describe("Attack Manager: what Auto Place is about to do to a trapped enemy", () => {
    /** The enemy (sid 2, at 1100) is trapped; returns the intents after one AttackManager tick with no modules. */
    async function intents(opts: { trapped?: boolean; preplace?: { id: number; x: number; appleInsta?: boolean }; replace?: { id: number; x: number; appleInsta?: boolean } | "none" }) {
        const m = await setUp();
        const { LIST_ID_MAP } = await import("@constants/items");
        const { default: ModManager } = await import("@core/ModManager");
        const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
        const { default: Angle } = await import("@placing/Angle");
        game!.addObjects([{ sid: 710, x: 1100, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
        const enemy = ModManager.enemyData.nearest!;
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        enemy.trap = opts.trapped === false ? undefined : ObjectManager.getObject(710)!;

        const queue = PlacementSystem.AutoPlacer.potentialPreplacements;
        queue.count = 0;
        if (opts.preplace) {
            const item = queue.placements[queue.count++];
            item.id = opts.preplace.id;
            item.x = opts.preplace.x;
            item.y = 1000;
            item.appleInsta = !!opts.preplace.appleInsta;
        }
        const replacements = opts.replace === undefined || opts.replace === "none" ? undefined : [Object.assign(new Angle(opts.replace.x, 1000, 50, 0, opts.replace.id), { appleInsta: !!opts.replace.appleInsta })];
        vi.spyOn(PlacementSystem.AutoReplacer, "execute").mockReturnValue(replacements);

        runTicks(m, [], 1);
        return { ...m.AttackManager.placeIntent };
    }

    it("nothing while the enemy isn't trapped", async () => {
        expect(await intents({ trapped: false, preplace: { id: 15, x: 1100 } })).toEqual({ retrap: false, appleInstaIntent: false });
    });

    it("a re-trap when a preplaced trap lands on the enemy", async () => {
        expect(await intents({ preplace: { id: 15, x: 1100 } })).toEqual({ retrap: true, appleInstaIntent: false });
    });

    it("an Apple Insta when a marked preplaced spike lands on the enemy", async () => {
        expect(await intents({ preplace: { id: 6, x: 1100, appleInsta: true } })).toEqual({ retrap: false, appleInstaIntent: true });
        expect(await intents({ preplace: { id: 6, x: 1100 } })).toEqual({ retrap: false, appleInstaIntent: false });
    });

    it("ignores placements that don't reach the enemy", async () => {
        expect(await intents({ preplace: { id: 15, x: 1300 }, replace: { id: 15, x: 1300 } })).toEqual({ retrap: false, appleInstaIntent: false });
    });

    it("also looks at replacements: a trap re-traps, a marked spike is an Apple Insta", async () => {
        expect(await intents({ replace: { id: 15, x: 1100 } })).toEqual({ retrap: true, appleInstaIntent: false });
        expect(await intents({ replace: { id: 6, x: 1100, appleInsta: true } })).toEqual({ retrap: false, appleInstaIntent: true });
    });
});
