// Feature #20, Auto Grind (AutoGrinder): farms weapon XP by placing buildings next to us (turrets if the 7th slot is a
// turret) and hitting them with tank gear, until the primary and secondary reach their target variants ("Primary
// Limit", default diamond; "Secondary Limit", default gold); then it turns itself off.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;
const GREAT_HAMMER = 10;
const TURRET = 17;
const TANK_GEAR = 40;

interface Scenario {
    enable?: boolean;
    primaryVariant?: number;
    secondaryVariant?: number;
    /** Hold the hammer once before grinding (default true). */
    heldSecondary?: boolean;
}

/**
 * One tick of grinding; returns what was placed, the weapon held, and whether tank gear went on. Auto Grind is switched on
 * only after we have held the weapons, so it knows their real variants (a weapon never held counts as stone).
 */
async function grind(s: Scenario = {}) {
    game = await startGame();
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM, weaponVariant: s.primaryVariant ?? 0 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    // Food, wall, spikes, windmill, pit trap, turret (the 7th slot).
    game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 10, 15, TURRET]);
    // The weapon Falcon last selected; in a game the upgrade to a polearm sets this (PacketManager.manage).
    game.Client.weaponIndex = POLEARM;
    game.update();
    // We held the hammer once, at the given variant.
    if (s.heldSecondary !== false)
        game.update([{ sid: ME, weaponIndex: GREAT_HAMMER, weaponVariant: s.secondaryVariant ?? 0 }]);
    game.update([{ sid: ME, weaponIndex: POLEARM, weaponVariant: s.primaryVariant ?? 0 }]);

    game.Menu.itemMap.autoGrind.status = s.enable !== false;
    const { Input } = await import("@ui/Hook");
    vi.spyOn(Input, "getAttackDir").mockReturnValue(0);
    const before = game.sent.length;
    game.update();
    const sent = game.sent.slice(before);
    return {
        placed: sent.filter(p => p.type === "z" && p.args[1] === false).map(p => p.args[0]),
        held: sent.filter(p => p.type === "z" && p.args[1] === true).map(p => p.args[0]),
        tank: sent.some(p => p.type === "c" && p.args[1] === TANK_GEAR),
        stillOn: game.Menu.getValue("autoGrind")
    };
}

describe("Auto Grind", () => {
    it("places turrets around the aim (once per tick) and hits with the hammer in tank gear", async () => {
        const { placed, held, tank } = await grind();
        // It ran twice per tick before (from CombatController and PlacementSystem), placing each turret twice.
        expect(placed).toEqual([TURRET, TURRET, TURRET]);
        expect(held).toContain(GREAT_HAMMER);
        expect(tank).toBe(true);
    });

    it("turns itself off once both weapons reached their targets", async () => {
        const { placed, stillOn } = await grind({ primaryVariant: 2, secondaryVariant: 1 });
        expect(stillOn).toBe(false);
        expect(placed).toEqual([]);
    });

    it("keeps going while one weapon is still short of its target", async () => {
        const { stillOn } = await grind({ primaryVariant: 2, secondaryVariant: 0 });
        expect(stillOn).toBe(true);
    });

    it("keeps going when the secondary was never held (counts as stone, not diamond: P11)", async () => {
        const { stillOn, placed } = await grind({ primaryVariant: 2, heldSecondary: false });
        expect(stillOn).toBe(true);
        expect(placed).toEqual([TURRET, TURRET, TURRET]);
    });

    it("does nothing when off", async () => {
        const { placed, tank } = await grind({ enable: false });
        expect(placed).toEqual([]);
        expect(tank).toBe(false);
    });
});
