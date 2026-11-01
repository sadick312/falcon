// Feature #2, Knockback Hits (AutoAttacker): a bull-helmet hit when the simulated hit plus its knockback would
// kill the enemy (spike damage on top of the hit reaching their full health), pit-trap them, or push them
// through 3+ spikes. Checked from the packets the mod sends during real ticks.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const BULL_HELMET = 7;

interface Scenario {
    enable?: boolean;
    spikeX?: number | null;
    enemyX?: number;
}

/** Plays 4 ticks and returns the packets that equipped the bull helmet, plus the aim sent with them. */
async function play(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.enable === false ? [] : ["attackFactoringKB:hits"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: s.enemyX ?? 1100, y: 1000 });
    game.setLoadout([5], [0, 3, 6, 10]);
    if (s.spikeX !== null) game.addObjects([{ sid: 500, x: s.spikeX ?? 1180, y: 1000, itemId: LIST_ID_MAP.GREATER_SPIKES, owner: ME }]);
    for (let i = 0; i < 4; i++) game.update();

    const bull = game.sent.filter(p => p.type === "c" && p.args[0] === false && p.args[1] === BULL_HELMET);
    const aims = game.sent.filter(p => p.type === "D" && bull.some(b => b.tick === p.tick));
    const hits = game.sent.filter(p => p.type === "K" && bull.some(b => b.tick === p.tick));
    return { bull, aims, hits };
}

describe("Knockback Hits", () => {
    it("bull-hits an enemy whose knockback would push them into a greater spike for a kill", async () => {
        const { bull, aims, hits } = await play();
        expect(bull.map(b => b.tick)).toEqual([1, 3]); // again once the polearm has reloaded
        expect(hits.length).toBe(2);
        for (const aim of aims) expect(aim.args[0]).toBeCloseTo(0, 5); // straight at the enemy (+x)
    });

    it("does nothing without a spike to push the enemy into", async () => {
        expect((await play({ spikeX: null })).bull).toEqual([]);
    });

    it("does nothing when the spike is too far behind the enemy", async () => {
        expect((await play({ spikeX: 1400 })).bull).toEqual([]);
    });

    it("does nothing when the toggle is off", async () => {
        expect((await play({ enable: false })).bull).toEqual([]);
    });

    it("needs the enemy within polearm range", async () => {
        expect((await play({ enemyX: 1300, spikeX: 1380 })).bull).toEqual([]);
    });
});
