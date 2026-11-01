// Feature #4, Apple Insta (AppleInstakiller): while spike placements are graded, marks a spike next to a trapped
// enemy as an "apple insta" when our great hammer can break the trap in one hit; the attack is then tank gear +
// hammer on the trap, followed by bull helmet + primary, with the spike placed where the trap was.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    enable?: string[];
    weapons?: number[];
    trapHealth?: number;
    inTrap?: boolean;
    settings?: Record<string, unknown>;
    /** Variant of both weapons (default 2, diamond). */
    variant?: number;
}

const ALL = ["appleInsta", "autoPlacing", "preplacer"];

/** Enemy standing in our pit trap, 90 units away. */
async function setUp(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable ?? ALL, settings: s.settings });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: (s.weapons ?? [5, 10])[0] });
    game.spawn({ sid: 2, x: 1090, y: 1000 });
    game.setLoadout(s.weapons ?? [5, 10], [0, 3, 6, 15]);
    if (s.inTrap !== false) game.addObjects([{ sid: 600, x: 1090, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME }]);
    // Hold both weapons once so their variants are known (a weapon we haven't held yet counts as stone).
    const [primary, secondary] = s.weapons ?? [5, 10];
    const variant = s.variant ?? 2;
    game.update([{ sid: ME, weaponIndex: secondary, weaponVariant: variant }]);
    game.update([{ sid: ME, weaponIndex: primary, weaponVariant: variant }]);

    const { default: ModManager } = await import("@core/ModManager");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const enemy = ModManager.enemyData.nearest!;
    if (enemy.trap) enemy.trap.health = s.trapHealth ?? 250;
    return { enemy, AttackManager, LIST_ID_MAP };
}

/** Runs the grading step on one spike angle; returns whether it was marked and its grade change. */
async function marks(s: Scenario = {}) {
    const { enemy, AttackManager, LIST_ID_MAP } = await setUp(s);
    const angle = { grade: 0, id: LIST_ID_MAP.SPIKES, appleInsta: false };
    AttackManager.appleInstakiller.process(angle as never, enemy);
    return angle.appleInsta;
}

describe("Apple Insta: marking a spike", () => {
    it("marks it when the great hammer (292 with tank gear) can break the trap in one hit", async () => {
        expect(await marks()).toBe(true);
    });

    it("doesn't when the trap has more health than one hammer hit", async () => {
        expect(await marks({ trapHealth: 300 })).toBe(false);
    });

    it("doesn't with a stone great hammer, which can't break a 250-health trap in one hit", async () => {
        expect(await marks({ variant: 0 })).toBe(false);
        expect(await marks({ variant: 0, trapHealth: 240 })).toBe(true);
    });

    it("doesn't without a great hammer", async () => {
        expect(await marks({ weapons: [5, 15] })).toBe(false);
    });

    it("doesn't when the enemy isn't trapped", async () => {
        expect(await marks({ inTrap: false })).toBe(false);
    });

    it("needs 'Allow Low Damage Primaries' for daggers", async () => {
        expect(await marks({ weapons: [7, 10] })).toBe(false);
        expect(await marks({ weapons: [7, 10], settings: { appleAllowsLowDamagePri: true } })).toBe(true);
    });
});

describe("Apple Insta: the attack", () => {
    it("runs with Preplacements on and Replacements off, as the menu describes", async () => {
        const { AttackManager } = await setUp({ enable: ["appleInsta", "autoPlacing", "preplacer"] });
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.placeIntent.appleInstaIntent = true;
        AttackManager.appleInstakiller.run();
        expect(queued).toHaveBeenCalledTimes(1);
    });

    it("queues tank gear + hammer, then bull helmet + polearm, once a marked spike is going to be placed", async () => {
        const { AttackManager } = await setUp();
        const { STORE_HAT_MAP } = await import("@constants/store");
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.placeIntent.appleInstaIntent = true;
        AttackManager.appleInstakiller.run();

        expect(queued).toHaveBeenCalledTimes(1);
        const [first, second] = queued.mock.calls[0][0].sequence;
        expect([first.wpnId, first.skinData[0], first.aimType]).toEqual([10, STORE_HAT_MAP.TANK_GEAR, "enemy-trap"]);
        expect([second.wpnId, second.skinData[0]]).toEqual([5, STORE_HAT_MAP.BULL_HELMET]);
    });

    it("waits until a marked spike is going to be placed", async () => {
        const { AttackManager } = await setUp();
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.placeIntent.appleInstaIntent = false;
        AttackManager.appleInstakiller.run();
        expect(queued).not.toHaveBeenCalled();
    });

    it.each([
        ["Apple Insta", ["autoPlacing", "preplacer"]],
        ["Auto Place", ["appleInsta", "preplacer"]],
        ["Preplacements", ["appleInsta", "autoPlacing"]]
    ])("does nothing with %s off", async (_label, enable) => {
        const { AttackManager } = await setUp({ enable });
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        AttackManager.placeIntent.appleInstaIntent = true;
        AttackManager.appleInstakiller.run();
        expect(queued).not.toHaveBeenCalled();
    });
});
