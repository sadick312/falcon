// Breaker brief Part D: Auto Break in made-up game states (stuck or not, weapon combos, enemy near, trap gone,
// death, a late tick). These pin the classic behaviour; they don't change it.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const KATANA = 4;
const POLEARM = 5;
const DAGGERS = 7;
const GREAT_HAMMER = 10;
const HIT = "F";

interface Setup {
    weapons: number[];
    trapAt?: number; // distance from us; default 0 (we stand on it)
    enemyAt?: { x: number; y: number };
    spikeAt?: { x: number; y: number };
}

async function setup(s: Setup) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: ["autoBreak"] });
    game.spawn({ sid: ME, x: 1000 + (s.trapAt ?? 0), y: 1000, weaponIndex: s.weapons[0] ?? POLEARM });
    game.spawn({ sid: 2, x: s.enemyAt?.x ?? 2400, y: s.enemyAt?.y ?? 1000, weaponIndex: POLEARM });
    game.setLoadout(s.weapons, [0, 3, 6, 15]);
    const objects = [{ sid: 600, x: 1000, y: 1000, itemId: LIST_ID_MAP.PIT_TRAP as number, owner: 2 }];
    if (s.spikeAt) objects.push({ sid: 700, x: s.spikeAt.x, y: s.spikeAt.y, itemId: LIST_ID_MAP.SPIKES, owner: 2 });
    game.addObjects(objects);
    const { default: AutoBreaker } = await import("@core/mod/defense/modules/AutoBreaker");
    const { default: CombatController } = await import("@core/mod/combat/core/CombatController");
    return { AutoBreaker, CombatController, g: game };
}

const hitsSince = (g: Game, from: number) => g.sent.slice(from).filter(p => p.type === HIT).length;

describe("stuck or not", () => {
    it("standing on an enemy trap: breaks it", async () => {
        const { AutoBreaker, g } = await setup({ weapons: [POLEARM, GREAT_HAMMER] });
        g.update();
        expect(AutoBreaker.status().state).toBe("breaking");
    });

    it("100 px away from a trap: not stuck, does nothing", async () => {
        const { AutoBreaker, CombatController, g } = await setup({ weapons: [POLEARM, GREAT_HAMMER], trapAt: 100 });
        g.update();
        expect(AutoBreaker.status().state).toBe("idle");
        expect(CombatController.currentMode).not.toBe("autobreak");
    });
});

describe("weapon combos", () => {
    for (const [name, weapons, expected] of [
        ["polearm + great hammer", [POLEARM, GREAT_HAMMER], "great hammer"],
        ["katana + great hammer", [KATANA, GREAT_HAMMER], "great hammer"],
        ["daggers + great hammer", [DAGGERS, GREAT_HAMMER], "great hammer"],
        ["katana only", [KATANA], "katana"],
        ["polearm only", [POLEARM], "polearm"]
    ] as const) {
        it(`${name}: breaks with the ${expected}`, async () => {
            const { AutoBreaker, g } = await setup({ weapons: [...weapons] });
            g.update();
            expect(AutoBreaker.status().weapon).toBe(expected);
        });
    }
});

describe("trap and spikes", () => {
    it("trap with an enemy spike next to us: goes for the spike", async () => {
        const { AutoBreaker, g } = await setup({ weapons: [POLEARM, GREAT_HAMMER], spikeAt: { x: 1000, y: 1085 } });
        g.update();
        expect(AutoBreaker.status().target).toBe("spikes");
    });
});

describe("enemy nearby", () => {
    it("a ready enemy polearm could one-shot us and we touch a spike: holds Soldier Helmet instead of Tank Gear", async () => {
        const { AutoBreaker, g } = await setup({
            weapons: [POLEARM, GREAT_HAMMER],
            enemyAt: { x: 1150, y: 1000 },
            spikeAt: { x: 1000, y: 1075 }
        });
        g.update();
        g.update();
        expect(AutoBreaker.status().state).toBe("holding soldier (one-shot risk)");
    });
});

describe("mid-break events", () => {
    it("the trap disappears (someone else broke it): stops at once, no more swings", async () => {
        const { AutoBreaker, g } = await setup({ weapons: [POLEARM, GREAT_HAMMER] });
        g.update();
        g.handlers.Q(600);
        const before = g.sent.length;
        g.update();
        expect(AutoBreaker.status().state).toBe("idle");
        expect(hitsSince(g, before)).toBe(0);
    });

    it("we die while breaking: no swing is sent", async () => {
        const { g } = await setup({ weapons: [POLEARM, GREAT_HAMMER] });
        g.update();
        g.setHealth(ME, 0);
        const before = g.sent.length;
        g.update();
        expect(hitsSince(g, before)).toBe(0);
    });

    it("a late tick (fake tick, high ping) right after a swing doesn't swing again", async () => {
        const { g } = await setup({ weapons: [POLEARM, GREAT_HAMMER] });
        g.update();
        const before = g.sent.length;
        g.handlers.K(ME, false, GREAT_HAMMER); // the server confirms the swing: the hammer reloads
        g.handlers.a([], [], []); // PacketBatcher's stand-in for a late update
        g.update();
        expect(hitsSince(g, before)).toBe(0);
    });
});
