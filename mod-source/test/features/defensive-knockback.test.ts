// Feature #32, Defensive Knockback (DefensiveKnockbacker): while we're in a pit trap and our momentum is carrying us
// into an enemy spike next tick, hits the nearest (untrapped) enemy in reach: attacking slows us down (hitSlow), so we
// stop short of the spike. It wears turret gear for the hit when the turret is ready, else soldier helmet. "Require
// Turret" (on by default) only does it with turret gear owned and ready.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const TURRET_GEAR = 53;
const SOLDIER = 6;

interface Scenario {
    requireTurret?: boolean;
    ownTurret?: boolean;
    spike?: boolean;
}

/** We slide right (10 per tick) inside an enemy trap toward an enemy spike; returns the queued hit's hat, if any. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: ["defensiveKB"], settings: { defKBRequireTurret: s.requireTurret ?? true } });
    game.spawn({ sid: ME, x: 980, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 1000, y: 1120, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const objects = [{ sid: 600, x: 995, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP, owner: 2 }];
    if (s.spike !== false) objects.push({ sid: 700, x: 1090, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: 2 });
    game.addObjects(objects);
    game.update();
    game.update([{ sid: ME, x: 990, y: 1000 }]);

    const player = game.Client.player;
    if (s.ownTurret === false) delete player.skins[TURRET_GEAR];
    else player.skins[TURRET_GEAR] = true;

    const { default: AttackManager } = await import("@core/mod/combat/core/AttackManager");
    const hats: number[] = [];
    vi.spyOn(AttackManager, "addAttackQueue").mockImplementation(action => {
        if (action.sequence[0].reason === "defKB") hats.push(action.sequence[0].skinData[0]);
    });
    game.update([{ sid: ME, x: 1000, y: 1000 }]);
    return hats;
}

describe("Defensive Knockback", () => {
    it("hits the enemy in turret gear to stop short of the spike", async () => {
        expect(await play()).toEqual([TURRET_GEAR]);
    });

    it("does nothing without a spike ahead, or without turret gear when it's required", async () => {
        expect(await play({ spike: false })).toEqual([]);
        expect(await play({ ownTurret: false })).toEqual([]);
    });

    it("uses soldier helmet when turret gear isn't required and we don't own it", async () => {
        // It asked for turret gear whenever the turret had reloaded, owned or not.
        expect(await play({ requireTurret: false, ownTurret: false })).toEqual([SOLDIER]);
    });
});
