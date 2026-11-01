// Feature #15, Combat Controller: what we hold and when we swing each tick, after the attack modules: reloading a
// weapon (it only reloads while held), Select Best Weapon, and Space for manual bull hits.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const POLEARM = 5;
const GREAT_HAMMER = 10;
const BULL_HELMET = 7;

interface Scenario {
    enable?: string[];
    weapons?: number[];
    holding?: number;
    before?: (g: Game) => void | Promise<void>;
}

/** Plays 3 ticks (enemy far away) and returns the weapons we switched to. */
async function play(s: Scenario = {}) {
    const weapons = s.weapons ?? [POLEARM, GREAT_HAMMER];
    game = await startGame({ enable: s.enable ?? ["selectBestWeapon"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: s.holding ?? weapons[0] });
    game.spawn({ sid: 2, x: 3000, y: 3000 });
    game.setLoadout(weapons, [0, 3, 6, 15]);
    game.update();
    await s.before?.(game);
    const start = game.sent.length;
    for (let i = 0; i < 3; i++) game.update();
    return game.sent.slice(start).filter(p => p.type === "z").map(p => p.args[0]);
}

describe("Combat Controller: weapon choice", () => {
    it("holds the great hammer next to a polearm when Select Best Weapon is on", async () => {
        expect(await play()).toContain(GREAT_HAMMER);
    });

    it("holds the primary when there's no great hammer", async () => {
        expect(await play({ weapons: [POLEARM, 15], holding: 15 })).toContain(POLEARM);
    });

    it("doesn't resend a switch for the weapon we already hold", async () => {
        expect(await play({ holding: GREAT_HAMMER })).toEqual([]);
    });

    it("switches to a weapon that is reloading, since weapons only reload while held", async () => {
        // We swung the hammer (the server's gather animation resets its reload), and hold the polearm.
        const switches = await play({ holding: POLEARM, enable: [], before: (g) => g.handlers.K(ME, true, GREAT_HAMMER) });
        expect(switches[0]).toBe(GREAT_HAMMER);
    });

    it("leaves the weapon alone when Select Best Weapon is off and nothing is reloading", async () => {
        expect(await play({ enable: [] })).toEqual([]);
    });
});

describe("Combat Controller: Space (manual bull hits)", () => {
    it("holding Space switches to the primary and hits with the bull helmet", async () => {
        game = await startGame();
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: GREAT_HAMMER });
        game.spawn({ sid: 2, x: 3000, y: 3000 });
        game.setLoadout([POLEARM, GREAT_HAMMER], [0, 3, 6, 15]);
        game.update();

        // Imported after startGame, which reloads every module.
        const { Input } = await import("@ui/Hook");
        Input.keys["Space"] = true;
        try {
            game.update();
        } finally {
            Input.keys["Space"] = false;
        }

        const tick = game.tick;
        const sent = game.sent.filter(p => p.tick === tick);
        expect(sent.find(p => p.type === "z")?.args[0]).toBe(POLEARM);
        expect(sent.some(p => p.type === "c" && p.args[1] === BULL_HELMET)).toBe(true);
    });
});
