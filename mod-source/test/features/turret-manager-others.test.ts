// Turret Manager (TurretManager), other players' side: when a turret's 20-tick counter fires, a nearby enemy gets a
// turret threat only if it is the turret's closest target (players in EMP Helmet and the turret owner's team don't
// count, an animal that is closer takes the shot) and within one tick of bullet travel (1.5 × 111 = 166.5).
// Projectile Sync reads this count (25 damage per threat).
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;
const EMP_HELMET = 22;
const COW = 0;

interface Scenario {
    /** Enemy's distance from our turret at (1000, 1000), along x. */
    enemyDx?: number;
    enemySkin?: number;
    /** A cow this far from the turret (along y), or none. */
    cowDy?: number;
}

/** Our turret at (1000, 1000), the enemy next to it; returns the enemy's turret threats on each of 25 ticks. */
async function enemyThreats(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1300, weaponIndex: 5 });
    game.spawn({ sid: ENEMY, x: 1000 + (s.enemyDx ?? 100), y: 1000, weaponIndex: 5, skinIndex: s.enemySkin ?? 0 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects([{ sid: 800, x: 1000, y: 1000, itemId: LIST_ID_MAP.TURRET, owner: ME }]);
    if (s.cowDy !== undefined) game.handlers.I([7, COW, 1000, 1000 + s.cowDy, 0, 400, 0, 0], []);

    const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
    const counts: number[] = [];
    for (let i = 1; i <= 25; i++) {
        game.update();
        counts.push(PlayerManager.get(ENEMY)!.turretThreats);
    }
    return counts;
}

const shots = (counts: number[]) => counts.filter(c => c > 0).length;

describe("Turret Manager: threats to other players", () => {
    it("counts one threat on the enemy when our turret fires and it is the closest target in bullet reach", async () => {
        const counts = await enemyThreats();
        expect(shots(counts)).toBe(1);
        expect(Math.max(...counts)).toBe(1);
    });

    it("no threat when the enemy is farther than one tick of bullet travel", async () => {
        expect(shots(await enemyThreats({ enemyDx: 200 }))).toBe(0);
    });

    it("no threat for an enemy in EMP Helmet", async () => {
        expect(shots(await enemyThreats({ enemySkin: EMP_HELMET }))).toBe(0);
    });

    it("an animal closer to the turret takes the shot; a farther one doesn't", async () => {
        expect(shots(await enemyThreats({ cowDy: 50 }))).toBe(0);
        expect(shots(await enemyThreats({ cowDy: 400 }))).toBe(1);
    });
});
