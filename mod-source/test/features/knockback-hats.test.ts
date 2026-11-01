// Features #11 Turret Gear Knockback (TurretGearKnockbacker) and #12 Barbarian Knockback (BarbarianKnockbacker): put on
// a hat whose knockback (turret bullet / barbarian armor reflecting a hit) would push the enemy through 3+ spikes,
// kill them or pit-trap them. The movement simulator is tested on its own (feature #35); here its result is stubbed so
// the modules' own conditions are what's tested.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

type SimResult = { spikesHit: number; oneTicked: boolean; pitTrapped: boolean };
const PUSHED_INTO_SPIKES: SimResult = { spikesHit: 3, oneTicked: false, pitTrapped: false };
const NOTHING: SimResult = { spikesHit: 0, oneTicked: false, pitTrapped: false };

interface Scenario {
    toggle: "turretGearKB" | "barbKnockback";
    enable?: boolean;
    enemyX?: number;
    enemyWeapon?: number;
    enemyHat?: number;
    trapped?: boolean;
    /** Something blocking the line between us and the enemy. */
    blocked?: boolean;
    sim?: SimResult;
}

/**
 * Plays ticks after the enemy swings (sid 2, polearm reload ~7 ticks), running the module once per tick with the
 * simulator stubbed. Returns the ticks it queued its hat on.
 */
async function play(module: "TurretGearKnockbacker" | "BarbarianKnockbacker", s: Scenario) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : [s.toggle] });
    const enemyX = s.enemyX ?? 1100;
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: enemyX, y: 1000, weaponIndex: s.enemyWeapon ?? 5, skinIndex: s.enemyHat ?? 0 });
    game.setLoadout([5], [0, 3, 6, 15]);
    const objects = [];
    if (s.trapped) objects.push({ sid: 600, x: enemyX, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: ME });
    // A tree halfway between us and the enemy.
    if (s.blocked) objects.push({ sid: 800, x: (1000 + enemyX) / 2, y: 1000, scale: 60, type: 0 });
    game.addObjects(objects);
    game.update();
    game.handlers.K(2, true, s.enemyWeapon ?? 5);

    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const { default: MovementPhysicsSimulator } = await import("@simulation/MovementPhysicsSimulator");
    const { default: Module } = module === "TurretGearKnockbacker"
        ? await import("@combat-modules/TurretGearKnockbacker")
        : await import("@combat-modules/BarbarianKnockbacker");
    const instance = new Module();
    instance.init();

    const fired: number[] = [];
    for (let i = 0; i < 10; i++) {
        game.update();
        // In close range the enemy can nearly always spike us, and both modules then hold back on purpose.
        DefenseSystem.canPlaceOnMe = false;
        const queued = vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(() => { });
        vi.spyOn(AttackManager, "isAttacking").mockReturnValue(false);
        vi.spyOn(MovementPhysicsSimulator, "simulate").mockReturnValue((s.sim ?? PUSHED_INTO_SPIKES) as never);
        instance.run();
        if (queued.mock.calls.length) fired.push(game.tick);
        queued.mockRestore();
        vi.mocked(AttackManager.isAttacking).mockRestore();
        vi.mocked(MovementPhysicsSimulator.simulate).mockRestore();
    }
    return fired;
}

describe("Barbarian Knockback", () => {
    const barb = (s: Partial<Scenario> = {}) => play("BarbarianKnockbacker", { toggle: "barbKnockback", ...s });

    it("puts on barbarian armor on the tick the enemy's weapon finishes reloading (their next swing)", async () => {
        // The swing was before tick 2; a polearm reloads in ~7 ticks, reaching full on tick 9.
        expect(await barb()).toEqual([9]);
    });

    it("does nothing when the reflected knockback wouldn't do enough", async () => {
        expect(await barb({ sim: NOTHING })).toEqual([]);
    });

    it("ignores enemies holding a ranged weapon", async () => {
        const { WEAPON_ID_MAP } = await import("@constants/items");
        expect(await barb({ enemyWeapon: WEAPON_ID_MAP.MUSKET })).toEqual([]);
    });

    it("ignores trapped enemies and enemies out of their weapon's range", async () => {
        expect(await barb({ trapped: true })).toEqual([]);
        expect(await barb({ enemyX: 1300 })).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect(await barb({ enable: false })).toEqual([]);
    });
});

describe("Turret Gear Knockback", () => {
    const turret = (s: Partial<Scenario> = {}) => play("TurretGearKnockbacker", { toggle: "turretGearKB", ...s });

    it("does nothing when the knockback wouldn't do enough", async () => {
        expect(await turret({ blocked: true, sim: NOTHING })).toEqual([]);
    });

    it("skips EMP Helmets, trapped enemies, enemies beyond 700, and the toggle off", async () => {
        const { STORE_HAT_MAP } = await import("@constants/store");
        expect(await turret({ blocked: true, enemyHat: STORE_HAT_MAP.EMP_HELMET })).toEqual([]);
        expect(await turret({ blocked: true, trapped: true })).toEqual([]);
        expect(await turret({ blocked: true, enemyX: 1800 })).toEqual([]);
        expect(await turret({ blocked: true, enable: false })).toEqual([]);
    });

    it("today only fires when the line to the enemy is blocked (possible issue P5)", async () => {
        // canTurretHit() is "nothing blocks the line"; the module returns when it's true, i.e. when the bullet could
        // actually reach the enemy. See AUDIT.md P5.
        expect((await turret({ blocked: false })).length).toBe(0);
        expect((await turret({ blocked: true })).length).toBeGreaterThan(0);
    });
});
