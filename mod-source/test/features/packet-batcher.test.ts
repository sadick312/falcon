// Feature #52, Packet batching (PacketBatcher): server packets arriving within 0.5 ms of each other are handled together,
// with each player update (which runs a tick) after the packets that came before it, so a tick sees all of its swings, hits and health changes. If a
// real update is late (by the server tick plus a margin that grows with jitter), a fake empty update runs the tick.
// Ping, minimap and leaderboard packets skip the batch.
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

/** Feeds `packets` (type only) into the batcher and returns the order they are handed to the handlers. */
async function batch(types: string[]) {
    game = await startGame();
    const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
    const handled: string[] = [];
    const socket = { readyState: 3, processPacket: (type: string) => handled.push(type) };
    PacketBatcher.init(socket as never);
    for (const type of types) PacketBatcher.add(type as never, [] as never);
    (PacketBatcher as unknown as { flush(): void }).flush();
    return handled;
}

describe("Packet batching", () => {
    it("handles a tick's other packets before its player update", async () => {
        expect(await batch(["a", "K", "O"])).toEqual(["K", "O", "a"]);
    });

    it("keeps each tick's events with its own update when two ticks arrive together (P27)", async () => {
        // A lag burst: tick N's swing (K) and update, then tick N+1's health change (O) and update, in one batch.
        // Tick N used to run after O had already been counted.
        expect(await batch(["K", "a", "O", "a"])).toEqual(["K", "a", "O", "a"]);
    });

    it("still puts packets after the last update before it", async () => {
        expect(await batch(["K", "a", "O", "a", "Q"])).toEqual(["K", "a", "O", "Q", "a"]);
        expect(await batch(["a", "K", "a", "O", "a"])).toEqual(["a", "K", "a", "O", "a"]);
    });

    it("keeps the arrival order when there's no update", async () => {
        expect(await batch(["K", "O", "Q"])).toEqual(["K", "O", "Q"]);
    });

    it("waits longer before a fake tick on a jittery connection", async () => {
        game = await startGame();
        const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
        const threshold = () => (PacketBatcher as unknown as { getFakeUpdateThreshold(): number }).getFakeUpdateThreshold();
        PacketBatcher.tickJitter = 0;
        expect(threshold()).toBe(111 + 5);
        PacketBatcher.tickJitter = 15;
        expect(threshold()).toBe(111 + 30);
        PacketBatcher.tickJitter = 100;
        expect(threshold()).toBe(111 + 40);
    });
});
