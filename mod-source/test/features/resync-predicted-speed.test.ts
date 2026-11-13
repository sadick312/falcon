// "Resync Predicted Speed" (default off). Each tick our predicted state (next_state) is put back on our real position,
// but its speed was kept from the last prediction. A simulated spike bounce then carried over into every tick after
// it: we "hit a spike" every tick in the prediction, and Auto Heal ate right after hits (+1 shame each time).
// With the toggle on, the predicted speed is reset to our real movement each tick.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, ME, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

const ENEMY = 2;

/** We stand still 20 units clear of an enemy spike, with a leftover predicted speed of 1 towards it. */
async function standNextToSpike(enable: string[]) {
    const { LIST_ID_MAP, getItem } = await import("@constants/items");
    game = await startGame({ enable });
    game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
    game.spawn({ sid: ENEMY, x: 4000, y: 4000 });
    game.setLoadout([5], [0, 3, 6, 10, 15]);
    const spikeX = 1000 + 35 + getItem(LIST_ID_MAP.SPIKES).scale + 20;
    game.addObjects([{ sid: 700, x: spikeX, y: 1000, itemId: LIST_ID_MAP.SPIKES, owner: ENEMY }]);
    game.update();
    game.update();

    const player = game.Client.player;
    // What a simulated bounce leaves behind (MovementPhysicsSimulator adds 1.5 on a spike hit).
    player.next_state.velX = 1;
    player.next_state.velY = 0;
    game.update();
    return player;
}

describe("Resync Predicted Speed", () => {
    it("off (classic): a leftover predicted speed carries into the next tick and predicts a spike hit we won't take", async () => {
        const player = await standNextToSpike([]);
        expect(player.next_state.spikeDamages).toBeGreaterThan(0);
    });

    it("on: the predicted speed follows our real movement (standing still), so no spike hit is predicted", async () => {
        const player = await standNextToSpike(["resyncPredictedSpeed"]);
        expect(player.next_state.spikeDamages).toBe(0);
        expect(Math.abs(player.next_state.x - player.real_position.x)).toBeLessThan(5);
    });

    // A tick whose update carries our position but not our attributes (hat, weapon...): the classic code only put
    // next_state back on our real position when attributes came in, so the prediction stayed frozen by the spike.
    async function positionsOnlyTick(enable: string[]) {
        const player = await standNextToSpike(enable);
        player.next_state.x += 20; // where the last prediction left it: touching the spike
        player.next_state.velX = 0;
        vi.advanceTimersByTime(1000 / 9);
        game!.handlers.a([ME, 1000, 1000, 0, ENEMY, 4000, 4000, 0], [], []);
        return player;
    }

    it("off (classic): on a tick without our attributes the prediction stays frozen where it was", async () => {
        const player = await positionsOnlyTick([]);
        // Simulated from the frozen spot: it touches the spike and bounces, far from where we really are.
        expect(Math.abs(player.next_state.x - player.real_position.x)).toBeGreaterThan(10);
    });

    it("on: a tick without our attributes still puts the prediction back on our real position", async () => {
        const player = await positionsOnlyTick(["resyncPredictedSpeed"]);
        expect(Math.abs(player.next_state.x - player.real_position.x)).toBeLessThan(5);
        expect(player.next_state.spikeDamages).toBe(0);
    });

    it("on: a real walk keeps its speed in the prediction", async () => {
        game = await startGame({ enable: ["resyncPredictedSpeed"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: ENEMY, x: 4000, y: 4000 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        game.update([{ sid: ME, x: 1020, y: 1000 }]);
        const player = game.Client.player;
        expect(player.next_state.x).toBeGreaterThan(player.real_position.x);
    });

    it("on: a teleport (over 100 in one tick) counts as standing still, not as a huge speed", async () => {
        game = await startGame({ enable: ["resyncPredictedSpeed"] });
        game.spawn({ sid: ME, x: 1000, y: 1000, weaponIndex: 5 });
        game.spawn({ sid: ENEMY, x: 4000, y: 4000 });
        game.setLoadout([5], [0, 3, 6, 10, 15]);
        game.update();
        game.update([{ sid: ME, x: 1500, y: 1000 }]);
        const player = game.Client.player;
        expect(Math.abs(player.next_state.x - player.real_position.x)).toBeLessThan(5);
    });
});
