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
        const objects = [
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
