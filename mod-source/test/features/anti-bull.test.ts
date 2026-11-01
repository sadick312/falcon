// Feature #13, Anti Bull (AntiBuller): when the nearest enemy's attack primary has just reloaded (their bull hit is
// likely), it raises `consider`, and HatSystem puts on Spike Gear + Corrupt X Wings. Once wearing both and hit, it
// counter-attacks with a bull hit if that plus the reflected damage would finish the enemy.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    enable?: boolean;
    ourWeapon?: number;
    secondEnemy?: boolean;
}

/** The enemy swings before tick 2; its polearm finishes reloading on tick 9. Returns the ticks `consider` was up. */
async function considerTicks(s: Scenario = {}) {
    game = await startGame({ enable: s.enable === false ? [] : ["antiBull"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: s.ourWeapon ?? 5 });
    game.spawn({ sid: 2, x: 1100, y: 1000, weaponIndex: 5 });
    if (s.secondEnemy) game.spawn({ sid: 3, x: 1000, y: 1100, weaponIndex: 5 });
    game.setLoadout([s.ourWeapon ?? 5], [0, 3, 6, 15]);
    game.update();
    game.handlers.K(2, true, 5);

    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const ticks: number[] = [];
    for (let i = 0; i < 10; i++) {
        game.update();
        if (AttackManager.antiBuller.consider) ticks.push(game.tick);
    }
    return ticks;
}

describe("Anti Bull: putting on Spike Gear + Corrupt X Wings", () => {
    it("asks for them on the tick the enemy's polearm finishes reloading", async () => {
        expect(await considerTicks()).toEqual([9]);
    });

    it("does nothing when the toggle is off", async () => {
        expect(await considerTicks({ enable: false })).toEqual([]);
    });

    it("only with an attack primary of our own to answer with", async () => {
        const { WEAPON_ID_MAP } = await import("@constants/items");
        expect(await considerTicks({ ourWeapon: WEAPON_ID_MAP.TOOL_HAMMER })).toEqual([]);
    });

    it("not when the nearby enemies' hits add up to 100 anyway (the hats wouldn't save us)", async () => {
        expect(await considerTicks({ secondEnemy: true })).toEqual([]);
    });
});

describe("Anti Bull: the counter hit", () => {
    async function counter(opts: { wearing?: boolean; ourHealth?: number } = {}) {
        const { STORE_ACCESSORY_MAP, STORE_HAT_MAP } = await import("@constants/store");
        game = await startGame({ enable: ["antiBull"] });
        const wearing = opts.wearing ?? true;
        game.spawn({
            sid: ME, x: 1000, y: 1000, weaponIndex: 5,
            skinIndex: wearing ? STORE_HAT_MAP.SPIKE_GEAR : 0,
            tailIndex: wearing ? STORE_ACCESSORY_MAP.CORRUPT_X_WINGS : 0
        });
        game.spawn({ sid: 2, x: 1100, y: 1000, weaponIndex: 5 });
        game.setLoadout([5], [0, 3, 6, 15]);
        game.update();
        game.update();
        // The enemy hit us (we lost a polearm hit's worth) and took reflected damage.
        game.setHealth(ME, opts.ourHealth ?? 55);
        game.setHealth(2, 70);

        const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.antiBuller.run();
        return queued.mock.calls.map(([queue]) => queue.sequence[0].reason);
    }

    it("bull-hits back after taking a hit in Spike Gear + Corrupt X Wings", async () => {
        expect(await counter()).toEqual(["pAB"]);
    });

    it("not without both items on", async () => {
        expect(await counter({ wearing: false })).toEqual([]);
    });

    it("not when we weren't actually hit for a polearm's damage", async () => {
        expect(await counter({ ourHealth: 90 })).toEqual([]);
    });
});
