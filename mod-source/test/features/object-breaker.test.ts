// Feature #31, Object Breaker / Pit-Spike Breaker (ObjectBreaker, ObjectUtils): with "Object Breaker" on, hits enemy
// spikes (first), traps, boost pads and teleporters within reach of the best breaking weapon, in tank gear, aiming
// between two targets when one swing reaches both. When the best weapon is reloading and the primary can break the
// target alone, it hits with the primary instead (not a polearm, except on Poison Spikes at 4+ shame). The pit-spike
// part clears our own buildings next to a trapped enemy so a spike can be placed there.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;
const GREAT_HAMMER = 10;
const TANK_GEAR = 40;

interface Scenario {
    enable?: boolean;
    owner?: number;
    itemId?: "SPIKES" | "POISON_SPIKES";
    health?: number;
    hammerReloading?: boolean;
    shame?: number;
}

/** A building 90 below us; returns what we held and aimed at on the checked tick. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["walkBreaker"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 10, 15]);
    game.addObjects([{ sid: 700, x: 1000, y: 1090, itemId: LIST_ID_MAP[s.itemId ?? "SPIKES"], owner: s.owner ?? 2 }]);
    game.update();

    const { default: ObjectManager } = await import("@core/logic/ObjectManager");
    const { default: ObjectBreaker } = await import("@core/mod/defense/modules/ObjectBreaker");
    const target = ObjectManager.getObject(700)!;
    if (s.health !== undefined) target.health = s.health;
    const player = game.Client.player;
    if (s.hammerReloading) player.reloads[GREAT_HAMMER] = 0.5;
    player.shameCount = s.shame ?? 0;

    const before = game.sent.length;
    game.update();
    const sent = game.sent.slice(before);
    return {
        held: sent.filter(p => p.type === "z" && p.args[1] === true).map(p => p.args[0]),
        tank: sent.some(p => p.type === "c" && p.args[1] === TANK_GEAR),
        aim: ObjectBreaker.aimAngle
    };
}

describe("Object Breaker", () => {
    it("hits an enemy spike in reach with the great hammer in tank gear", async () => {
        const { held, tank, aim } = await play();
        expect(held).toContain(GREAT_HAMMER);
        expect(tank).toBe(true);
        expect(Math.sin(aim)).toBeGreaterThan(0.99);
    });

    it("leaves our own buildings alone, and does nothing when off", async () => {
        expect((await play({ owner: ME })).tank).toBe(false);
        expect((await play({ enable: false })).tank).toBe(false);
    });

    it("waits for the hammer rather than hitting a spike with the polearm", async () => {
        const { held } = await play({ hammerReloading: true, health: 20 });
        expect(held).not.toContain(POLEARM);
    });

    it("hits Poison Spikes with the polearm while the hammer reloads, at 4+ shame", async () => {
        // The target copy never got the object's id, so this Poison Spikes rule never applied.
        const { held } = await play({ itemId: "POISON_SPIKES", hammerReloading: true, health: 20, shame: 4 });
        expect(held).toContain(POLEARM);
    });
});

describe("Pit-Spike Breaker", () => {
    /**
     * The enemy is caught in our pit trap 90 to our right; our wall sits next to the trap, down-right of us (out of the
     * swing arc toward the trap). Returns where we aimed and what we held on the checked tick.
     */
    async function pitSpike(s: { enable?: boolean; trapped?: boolean; ourSpike?: boolean; wallAt?: { x: number; y: number } } = {}) {
        const { LIST_ID_MAP } = await import("@constants/items");
        const enable = s.enable === false ? ["walkBreaker"] : ["walkBreaker", "objectBreaker:pit_spike"];
        game = await startGame({ enable });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: 2, x: s.trapped === false ? 1300 : 1090, y: 1000 });
        game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 10, 15]);
        const wall = s.wallAt ?? { x: 1020, y: 1085 };
        const objects: { sid: number; x: number; y: number; itemId: number; owner: number }[] = [
            { sid: 700, x: 1090, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME },
            { sid: 701, x: wall.x, y: wall.y, itemId: LIST_ID_MAP.WOOD_WALL, owner: ME }
        ];
        if (s.ourSpike) objects.push({ sid: 702, x: 1090, y: 920, itemId: LIST_ID_MAP.SPIKES, owner: ME });
        game.addObjects(objects);
        game.update();

        const { default: ObjectBreaker } = await import("@core/mod/defense/modules/ObjectBreaker");
        ObjectBreaker.aimAngle = 99;
        const before = game.sent.length;
        game.update();
        const sent = game.sent.slice(before);
        return { aim: ObjectBreaker.aimAngle, hit: sent.some(p => p.type === "F" && p.args[0] === 1) };
    }

    it("breaks our own building next to a trapped enemy's trap, to make room for a spike", async () => {
        const { aim } = await pitSpike();
        expect(aim).toBeCloseTo(Math.atan2(85, 20), 1);
    });

    it("does nothing when the toggle is off or the enemy isn't trapped", async () => {
        expect((await pitSpike({ enable: false })).aim).toBe(99);
        expect((await pitSpike({ trapped: false })).aim).toBe(99);
    });

    it("leaves it alone when one of our spikes already sits by the trap", async () => {
        expect((await pitSpike({ ourSpike: true })).aim).toBe(99);
    });

    it("skips a building in the same swing arc as the trap (hitting it would hit the trap too)", async () => {
        expect((await pitSpike({ wallAt: { x: 1060, y: 1080 } })).aim).toBe(99);
    });

    it("skips a building we're standing against", async () => {
        expect((await pitSpike({ wallAt: { x: 1010, y: 1070 } })).aim).toBe(99);
    });
});

// Phase 3B part 2: Closest First, Detection Range and Walk To Targets (all off / 0 by default).
describe("Object Breaker: Closest First, Detection Range, Walk To Targets", () => {
    interface Setup {
        enable?: string[];
        detectRange?: number;
        objects: { sid: number; x: number; y: number; item: "SPIKES" | "BOOST_PAD" }[];
        enemyAt?: { x: number; y: number };
        movingByHand?: boolean;
    }

    async function run(s: Setup) {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame({
            enable: ["walkBreaker", ...(s.enable ?? [])],
            settings: { "walkBreaker:detectRange": s.detectRange ?? 0 }
        });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
        game.spawn({ sid: 2, x: s.enemyAt?.x ?? 4000, y: s.enemyAt?.y ?? 4000 });
        game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 10, 15]);
        game.addObjects(s.objects.map(o => ({ sid: o.sid, x: o.x, y: o.y, itemId: LIST_ID_MAP[o.item], owner: 2 })));
        game.update();
        if (s.movingByHand) game.Client.lastMoveDir = 0;

        const { default: ObjectBreaker } = await import("@core/mod/defense/modules/ObjectBreaker");
        const before = game.sent.length;
        game.update();
        const sent = game.sent.slice(before);
        return {
            ObjectBreaker,
            aim: ObjectBreaker.aimAngle,
            moves: sent.filter(p => p.type === "9").map(p => p.args[0]),
            // A direction is sent once, when it changes; the first tick may already have sent it.
            allMoves: game.sent.filter(p => p.type === "9" && typeof p.args[0] === "number").map(p => p.args[0])
        };
    }

    // Two boost pads in reach on opposite sides (one swing can't hit both): 701 below at 95, 702 above at 80.
    const twoPads: Setup["objects"] = [
        { sid: 701, x: 1000, y: 1095, item: "BOOST_PAD" },
        { sid: 702, x: 1000, y: 920, item: "BOOST_PAD" }
    ];

    it("classic order (default): the first stored building, even when another is closer", async () => {
        const { aim } = await run({ objects: twoPads });
        expect(Math.sin(aim)).toBeGreaterThan(0.99); // down, at 701
    });

    it("Closest First: the closest building", async () => {
        const { aim } = await run({ enable: ["walkBreaker:closestFirst"], objects: twoPads });
        expect(Math.sin(aim)).toBeLessThan(-0.99); // up, at 702
    });

    it("Closest First keeps spikes before closer non-spikes", async () => {
        const { aim } = await run({
            enable: ["walkBreaker:closestFirst"],
            objects: [{ sid: 701, x: 1000, y: 1100, item: "SPIKES" }, { sid: 702, x: 1000, y: 920, item: "BOOST_PAD" }]
        });
        expect(Math.sin(aim)).toBeGreaterThan(0.99); // the spike below
    });

    it("Closest First orders by distance, then by lowest health", async () => {
        const { default: ObjectBreaker } = await import("@core/mod/defense/modules/ObjectBreaker");
        const from = { x: 0, y: 0 };
        const obj = (x: number, health: number, dmg = 0) => ({ x, y: 0, health, dmg }) as never;
        expect(ObjectBreaker.compareClosestFirst(obj(50, 100), obj(80, 10), from)).toBeLessThan(0);
        expect(ObjectBreaker.compareClosestFirst(obj(50, 100), obj(50, 10), from)).toBeGreaterThan(0);
        expect(ObjectBreaker.compareClosestFirst(obj(90, 100, 20), obj(50, 10), from)).toBeLessThan(0);
    });

    // A spike 250 to the right: out of the hammer's reach (74 + 49), inside reach + 200.
    const farSpike: Setup["objects"] = [{ sid: 701, x: 1250, y: 1000, item: "SPIKES" }];

    it("Detection Range 0 (default): a far spike isn't seen, nothing moves", async () => {
        const { ObjectBreaker, allMoves } = await run({ enable: ["walkBreaker:walkToTarget"], objects: farSpike });
        expect(ObjectBreaker.farTarget).toBeNull();
        expect(allMoves).toEqual([]);
    });

    it("Detection Range: sees the far spike, but without Walk To Targets doesn't move or swing", async () => {
        const { ObjectBreaker, allMoves } = await run({ detectRange: 200, objects: farSpike });
        expect(ObjectBreaker.farTarget?.sid).toBe(701);
        expect(ObjectBreaker.walkDir).toBeNull();
        expect(ObjectBreaker.currentTarget).toBeNull();
        expect(allMoves).toEqual([]);
    });

    it("Detection Range: a far spike comes before a nearer boost pad (spikes first, like Closest First)", async () => {
        // Pad 200 to the left, spike 250 to the right: both out of reach, both seen with +200.
        const { ObjectBreaker } = await run({
            detectRange: 200,
            objects: [{ sid: 701, x: 1250, y: 1000, item: "SPIKES" }, { sid: 702, x: 800, y: 1000, item: "BOOST_PAD" }]
        });
        expect(ObjectBreaker.farTarget?.sid).toBe(701);
    });

    it("Walk To Targets: walks towards the far spike", async () => {
        const { ObjectBreaker, allMoves } = await run({ enable: ["walkBreaker:walkToTarget"], detectRange: 200, objects: farSpike });
        expect(ObjectBreaker.walkDir).toBeCloseTo(0, 5);
        expect(allMoves.length).toBeGreaterThan(0);
        expect(Math.cos(allMoves.at(-1) as number)).toBeGreaterThan(0.99);
    });

    it("Walk To Targets stands down while we move by hand or an enemy is near", async () => {
        const byHand = await run({ enable: ["walkBreaker:walkToTarget"], detectRange: 200, objects: farSpike, movingByHand: true });
        expect(byHand.ObjectBreaker.walkDir).toBeNull();
        const enemyNear = await run({
            enable: ["walkBreaker:walkToTarget"], detectRange: 200, objects: farSpike, enemyAt: { x: 1000, y: 1200 }
        });
        expect(enemyNear.ObjectBreaker.walkDir).toBeNull();
    });

    it("Walk To Targets gives up on a building it can't get closer to, and walks to the next one", async () => {
        // A spike to the right and a pad to the left, both out of reach; we never move (as if a wall were in the way).
        const { ObjectBreaker } = await run({
            enable: ["walkBreaker:walkToTarget"], detectRange: 200,
            objects: [{ sid: 701, x: 1250, y: 1000, item: "SPIKES" }, { sid: 702, x: 800, y: 1000, item: "BOOST_PAD" }]
        });
        expect(ObjectBreaker.farTarget?.sid).toBe(701);
        const targets: (number | undefined)[] = [];
        for (let i = 0; i < 15; i++) {
            game!.update();
            targets.push(ObjectBreaker.farTarget?.sid);
        }
        // About a second (9 ticks) without getting closer: the spike is skipped and the pad is next.
        expect(targets.slice(0, 7).every(sid => sid === 701)).toBe(true);
        expect(targets.at(-1)).toBe(702);
        expect(Math.cos(ObjectBreaker.walkDir!)).toBeLessThan(-0.99);
    });

    it("Walk To Targets forgets the buildings it gave up on when a new session starts (reconnect)", async () => {
        const { ObjectBreaker } = await run({ enable: ["walkBreaker:walkToTarget"], detectRange: 200, objects: farSpike });
        for (let i = 0; i < 15; i++) game!.update();
        expect(ObjectBreaker.farTarget).toBeNull(); // gave up on 701, the only building
        const { default: ModManager } = await import("@core/ModManager");
        ModManager.resetSession();
        game!.update();
        expect(ObjectBreaker.farTarget?.sid).toBe(701);
    });

    it("Walk To Targets keeps going while it gets closer", async () => {
        const { ObjectBreaker } = await run({ enable: ["walkBreaker:walkToTarget"], detectRange: 200, objects: farSpike });
        for (let x = 1005; x <= 1060; x += 5) {
            game!.update([{ sid: ME, x }]);
            expect(ObjectBreaker.farTarget?.sid).toBe(701);
            expect(ObjectBreaker.walkDir).toBeCloseTo(0, 5);
        }
    });

    it("all new options are off / 0 by default", async () => {
        const { vi } = await import("vitest");
        vi.resetModules();
        const { defenseSettings } = await import("@menu/content/defense");
        type Item = { id: string; status?: unknown; settings?: Item[] };
        const find = (items: Item[], id: string): Item | undefined =>
            items.map(i => i.id === id ? i : find(i.settings ?? [], id)).find(Boolean);
        for (const id of ["walkBreaker:closestFirst", "walkBreaker:walkToTarget", "walkBreaker:showRange"]) {
            expect(find(defenseSettings as Item[], id)?.status).toBe(false);
        }
        expect(find(defenseSettings as Item[], "walkBreaker:detectRange")?.status).toBe(0);
    });
});
