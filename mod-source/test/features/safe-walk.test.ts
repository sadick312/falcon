// Feature #29, Safe Walk (MovementManager, MovementUtils): sends our movement direction (only when it changes), taken
// from the current one-tick, tap mode, Auto Push, or our keys. With "Safe Walk" on, it stops us (direction null) when
// the next tick's movement, projected with booster-hat speed, would run into an enemy spike, a cactus, a boost pad or
// a teleporter. Shift turns it off.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

interface Scenario {
    safeWalk?: boolean;
    spikeOwner?: number;
    shift?: boolean;
}

/** We walk right (direction 0) toward a spike 90 to our right; returns the movement packets sent on that tick. */
async function walk(s: Scenario = {}) {
    const { LIST_ID_MAP } = await import("@constants/items");
    game = await startGame({ enable: s.safeWalk === false ? [] : ["safeWalk"] });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: 2, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    game.addObjects([{ sid: 700, x: 1090, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: s.spikeOwner ?? 2 }]);
    game.update();

    const { Input } = await import("@ui/Input");
    Input.keys["ShiftLeft"] = !!s.shift;
    game.Client.lastMoveDir = 0;
    const before = game.sent.length;
    try {
        game.update();
    } finally {
        Input.keys["ShiftLeft"] = false;
    }
    return moves(before);
}

function moves(from: number) {
    return game!.sent.slice(from).filter(p => p.type === "9").map(p => p.args[0]);
}

describe("Safe Walk", () => {
    it("stops us before we walk into an enemy spike", async () => {
        expect(await walk()).toEqual([null]);
    });

    it("lets us walk into our own spike, or with Safe Walk off, or while holding Shift", async () => {
        expect(await walk({ spikeOwner: ME })).toEqual([0]);
        expect(await walk({ safeWalk: false })).toEqual([0]);
        expect(await walk({ shift: true })).toEqual([0]);
    });

    it("sends the direction only when it changes", async () => {
        await walk({ safeWalk: false });
        const before = game!.sent.length;
        game!.update();
        expect(moves(before)).toEqual([]);
    });

    it("sends the direction again after we respawn", async () => {
        // 1.8.2 clears the server's moveDir when a player spawns (resetMoveDir). We used to skip resending the same
        // direction, so after a respawn with the key still held we stood still.
        await walk({ safeWalk: false });
        game!.spawn({ sid: ME, x: 2000, y: 2000, weaponIndex: 5 });
        const before = game!.sent.length;
        game!.update();
        expect(moves(before)).toEqual([0]);
    });
});
