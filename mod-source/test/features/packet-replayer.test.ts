// Feature #56, Packet replayer (PacketReplayer): plays a recorded .fpl log (the last 15 s) back through Falcon's own
// packet handlers with a FakeSocket, so the mod's decisions can be watched tick by tick (pause, step with the arrow
// keys, seek, x0.125-x1 speed) next to the brain state recorded at the time.
import { encode } from "@msgpack/msgpack";
import { afterEach, describe, expect, it } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

function bytesOf(...packets: [number, string, unknown][]) {
    const chunks: number[] = [];
    for (const [timestamp, type, data] of packets) {
        const head = new DataView(new ArrayBuffer(12));
        head.setFloat64(0, timestamp, true);
        const body = encode([type, data]);
        head.setInt32(8, body.length, true);
        chunks.push(...new Uint8Array(head.buffer), ...body, 0, 0, 0, 0);
    }
    return new Uint8Array(chunks).buffer;
}

describe("Packet replayer", () => {
    it("refuses a file that isn't a usable log instead of throwing", async () => {
        game = await startGame();
        const { default: PacketReplayer } = await import("@core/PacketReplayer");
        const { default: Client } = await import("@core/Client");
        Client.mode = "normal";
        // Empty, random bytes, and a log with only untimed (permanent) packets: start() used to throw on all three,
        // leaving the loading screen up.
        expect(PacketReplayer.start(new ArrayBuffer(0))).toBe(false);
        expect(PacketReplayer.start(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]).buffer)).toBe(false);
        expect(PacketReplayer.start(bytesOf([0, "C", [1]]))).toBe(false);
        expect(Client.mode).toBe("normal");
    });

    it("starts the packet budget in a replay, so placements can show (P28)", async () => {
        // Replay mode used to skip PacketTracker.init(), so every placement request was refused: replays (and the
        // benchmark) never showed Falcon's placements.
        game = await startGame();
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");
        const { default: Client } = await import("@core/Client");
        Client.mode = "replay";
        await import("@core/Connection");
        await Client.connect();
        expect(PacketTracker.request("PLACE", 4)).toBe(4);
    });
});
