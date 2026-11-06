// Feature #10, Turret Bullet Assist (TurretAPAssister): puts on turret gear (without attacking) to add turret
// bullets to an enemy stuck in a trap against a spike and taking damage, 150-300 units away, when a one tick
// would also be possible.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const TURRET_GEAR = 53;

interface Scenario {
    enable?: boolean;
    variant?: number;
    trapped?: boolean;
    hurt?: boolean;
    enemyHat?: number;
}

/** The enemy stands in our trap against our spike, 230 units away; we hold a diamond polearm. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["turretBulletAssistOnAP"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5, weaponVariant: s.variant ?? 2 });
    game.spawn({ sid: 2, x: 1230, y: 1000, skinIndex: s.enemyHat ?? 0 });
    game.setLoadout([5], [0, 3, 6, 15]);
    const objects = [{ sid: 700, x: 1300, y: 1000, itemId: LIST_ID_MAP.SPIKES as number, owner: ME }];
    if (s.trapped !== false) objects.push({ sid: 600, x: 1230, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME });
    game.addObjects(objects);
    game.update();
    game.update();
    if (s.hurt !== false) game.setHealth(2, 80);
    game.update();

    const turret = game.sent.filter(p => p.type === "c" && p.args[1] === TURRET_GEAR).map(p => p.tick);
    const hitsOnTurretTicks = game.sent.filter(p => p.type === "K" && turret.includes(p.tick));
    return { turret, hitsOnTurretTicks };
}

describe("Turret Bullet Assist", () => {
    it("puts on turret gear, without attacking, for a hurt enemy pit-spiked in our trap", async () => {
        const { turret, hitsOnTurretTicks } = await play();
        expect(turret).toEqual([3]);
        expect(hitsOnTurretTicks).toEqual([]);
    });

    it("waits while the enemy isn't taking damage", async () => {
        expect((await play({ hurt: false })).turret).toEqual([]);
    });

    it("needs the enemy to be trapped", async () => {
        expect((await play({ trapped: false })).turret).toEqual([]);
    });

    it("skips an enemy in an EMP Helmet, which stops turret bullets", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        expect((await play({ enemyHat: STORE_HAT_MAP.EMP_HELMET })).turret).toEqual([]);
    });

    it("only runs when a one tick would also be possible (a stone polearm is too weak)", async () => {
        expect((await play({ variant: 0 })).turret).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect((await play({ enable: false })).turret).toEqual([]);
    });
});
