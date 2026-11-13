// WingsUtils.willHitPlayer ("will this swing heal us with Blood Wings") must look where the swing really goes. In tank
// spam with Aim Assist on, the swing is turned to the assist's target, but it used the raw mouse direction.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;

/** Mouse at 0 rad. Enemy 2: far (400) at -15 deg, inside the cone. Enemy 3: close (90) at +60 deg, outside it. */
async function tankSpamSwing(enable: string[]) {
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: POLEARM });
    game.setLoadout([POLEARM], [0, 3, 6, 10, 15]);
    const deg = Math.PI / 180;
    game.spawn({ sid: 2, x: 1000 + 400 * Math.cos(-15 * deg), y: 1000 + 400 * Math.sin(-15 * deg), weaponIndex: POLEARM });
    game.spawn({ sid: 3, x: 1000 + 90 * Math.cos(60 * deg), y: 1000 + 90 * Math.sin(60 * deg), weaponIndex: POLEARM });
    game.update();
    game.update();

    const { Input } = await import("@ui/Input");
    vi.spyOn(Input, "getAttackDir").mockReturnValue(0);
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    const { default: WingsUtils } = await import("@core/mod/defense/utils/WingsUtils");
    const { default: ModManager } = await import("@core/ModManager");
    CombatController.tankSpam = true;
    CombatController.attackState.confirm = true;
    game.Client.weaponIndex = POLEARM;
    game.Client.player.reloads[POLEARM] = 1;
    try {
        return { hits: WingsUtils.willHitPlayer(), sent: ModManager.getAttackDir(true) };
    } finally {
        CombatController.tankSpam = false;
        CombatController.attackState.confirm = false;
    }
}

describe("WingsUtils.willHitPlayer: the real swing direction", () => {
    it("Aim Assist off: the swing goes at the mouse and reaches the close enemy (as before)", async () => {
        const { hits, sent } = await tankSpamSwing([]);
        expect(sent).toBe(0);
        expect(hits).toBe(true);
    });

    it("Aim Assist on: the swing turns to the far enemy, so it won't hit (and won't heal)", async () => {
        const { hits, sent } = await tankSpamSwing(["aimAssist"]);
        expect(sent).toBeCloseTo(-15 * Math.PI / 180);
        expect(hits).toBe(false);
    });
});
