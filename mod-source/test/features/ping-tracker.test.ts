// Feature #37, Ping tracking (PingTracker): keeps the last 5 pings; the "stable" ping is their median, so one Wi-Fi
// spike doesn't move it (Auto Place's preplacement timing and the packet budget use it).
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Ping tracking", () => {
    it("uses the median of the last 5 pings, so one spike doesn't move it", async () => {
        game = await startGame();
        const { default: PingTracker } = await import("@core/mod/utils/PingTracker");
        for (const ping of [50, 52, 400, 51, 49]) PingTracker.update(ping);
        expect(PingTracker.getCurrentPing()).toBe(49);
        expect(PingTracker.getStablePing()).toBe(51);
        // Only the last 5 count.
        for (const ping of [100, 100, 100]) PingTracker.update(ping);
        expect(PingTracker.getStablePing()).toBe(100);
    });
});
