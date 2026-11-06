// Feature #27, Auto Heal (AutoHealer, HealerUtils): when the Defense System's total says we'd die this tick, it uses
// EMP helmet (if only turret damage is lethal), soldier helmet (if 0.75× the damage is survivable; 1.8.2's soldier
// helmet has dmgMult .75), or eats food to full health right away. Otherwise it heals to full once we haven't been
// hit for a tick (healing right after a hit adds shame). Apple heals 20, cookie 40, cheese 30.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const SOLDIER = 6;

interface Scenario {
    health: number;
    enemyNear?: boolean;
    ownSoldier?: boolean;
    forceSoldier?: boolean;
    /** Ticks between the health change and the checked tick. */
    wait?: number;
}

/** Returns how many apples we ate on the checked tick, and the hat the Defense System asked for. */
async function play(s: Scenario) {
    game = await startGame({ enable: ["autoHeal", "defensiveHatSwitching"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: s.enemyNear ? 1090 : 4000, y: 1000, weaponIndex: 5 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.update();

    const player = game.Client.player;
    if (s.ownSoldier) player.skins[SOLDIER] = true;
    else delete player.skins[SOLDIER];
    game.setHealth(ME, s.health);
    for (let i = 0; i < (s.wait ?? 0); i++) game.update();

    const { default: DefenseSystem } = await import("@core/mod/defense/DefenseSystem");
    const { default: ModManager } = await import("@core/ModManager");
    if (s.forceSoldier) DefenseSystem.forceSoldierTicks = 1;
    const before = game.sent.length;
    game.update();
    const eaten = game.sent.slice(before).filter(p => p.type === "z" && p.args[0] === 0 && p.args[1] === false).length;
    return { eaten, response: ModManager.brainState.healingResponse };
}

describe("Auto Heal", () => {
    it("heals to full once we haven't been hit for a tick", async () => {
        // 60 health, apples heal 20: 2 apples.
        expect((await play({ health: 60, wait: 2 })).eaten).toBe(2);
    });

    it("waits a tick after being hit when the damage isn't lethal", async () => {
        expect((await play({ health: 60 })).eaten).toBe(0);
    });

    it("eats right away when the next hits could kill", async () => {
        // An enemy polearm next to us (bull helmet) that could also place a spike on us: 115. No soldier helmet.
        const { eaten } = await play({ health: 50, enemyNear: true });
        expect(eaten).toBe(3);
    });

    it("uses soldier helmet instead when 0.75× the damage is survivable", async () => {
        const { eaten, response } = await play({ health: 95, enemyNear: true, ownSoldier: true });
        expect(response).toBe("0shame soldier anti");
        expect(eaten).toBe(0);
    });

    it("still heals when soldier helmet is forced but we don't own it", async () => {
        // The Hat System can't put on a hat we don't own, so counting on its 0.75× would leave us unhealed.
        const { eaten } = await play({ health: 95, enemyNear: true, forceSoldier: true });
        expect(eaten).toBeGreaterThan(0);
        const owned = await play({ health: 95, enemyNear: true, forceSoldier: true, ownSoldier: true });
        expect(owned.response).toBe("instant soldier + no heal");
    });
});
