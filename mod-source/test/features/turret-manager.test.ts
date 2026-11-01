// Feature #33, Turret Manager (TurretManager): predicts enemy turret shots. Each turret's counter starts when we first
// see it and fires every 20 ticks (1.8.2: shootRate 2200 ms, shootRange 700). On a shot, we count a turret threat when
// we're within 700 of an enemy turret (the Defense System adds 25 per threat and avoids EMP / picks soldier); for other
// players, only when they're the turret's closest target and within one tick of bullet travel.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

/** Runs `ticks` ticks with a turret at (1000 + dx, 1000); returns the ticks (1-based) on which we had a turret threat. */
async function threats(s: { dx?: number; owner?: number; ticks?: number } = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects([{ sid: 800, x: 1000 + (s.dx ?? 500), y: 1000, itemId: LIST_ID_MAP.TURRET, owner: s.owner ?? 2 }]);

    const { default: ModManager } = await import("@core/ModManager");
    const hits: number[] = [];
    for (let i = 1; i <= (s.ticks ?? 45); i++) {
        game.update();
        if (ModManager.brainState.totalDamage >= 25) hits.push(i);
    }
    return hits;
}

describe("Turret Manager", () => {
    it("expects an enemy turret within 700 to fire every 20 ticks", async () => {
        const hits = await threats();
        expect(hits.length).toBe(2);
        expect(hits[1] - hits[0]).toBe(20);
    });

    it("ignores our own turrets and turrets out of range", async () => {
        expect(await threats({ owner: ME })).toEqual([]);
        expect(await threats({ dx: 750 })).toEqual([]);
    });

    it("today keeps its own 20-tick count even after seeing the turret actually fire (possible issue P20)", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 4000, y: 4000 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.addObjects([{ sid: 800, x: 1500, y: 1000, itemId: LIST_ID_MAP.TURRET, owner: 2 }]);
        const { default: ModManager } = await import("@core/ModManager");
        const hits: number[] = [];
        for (let i = 1; i <= 45; i++) {
            // The turret really fires on tick 8 (ADD_PROJECTILE from the turret's spot, turret bullet speed 1.5).
            if (i === 8) game.handlers.X(1500, 1000, Math.PI, 700, 1.5, 1, 1, 9000);
            game.update();
            if (ModManager.brainState.totalDamage >= 25) hits.push(i);
        }
        // The next real shot is due on tick 28; Falcon still expects it on its own schedule.
        expect(hits).not.toContain(28);
    });

    it("today picks the player as a turret's target even when an animal is closer (possible issue P19)", async () => {
        const { LIST_ID_MAP } = await import("@constants/items");
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: 2, x: 1600, y: 1000 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        // Our turret; the enemy is 100 from it.
        game.addObjects([{ sid: 800, x: 1500, y: 1000, itemId: LIST_ID_MAP.TURRET, owner: ME }]);
        game.update();

        const { ais } = await import("@entities/Ai");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");
        const { default: TurretManager } = await import("@core/mod/defense/modules/TurretManager");
        const enemy = PlayerManager.get(2)!;
        // An animal 50 from the turret: closer than the enemy.
        const animal = { real_position: { x: 1450, y: 1000 } };
        (ais.all as unknown[]).push(animal);
        try {
            enemy.turretThreats = 0;
            (TurretManager as unknown as { updatePlayer(p: unknown, t: unknown): void }).updatePlayer(enemy, ObjectManager.getObject(800));
        } finally {
            (ais.all as unknown[]).splice((ais.all as unknown[]).indexOf(animal), 1);
        }
        expect(enemy.turretThreats).toBe(1);
    });
});
