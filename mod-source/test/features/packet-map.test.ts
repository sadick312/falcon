// Feature #58, Packet names and types (PacketMap): the one-letter packet ids for both directions (checked against
// 1.8.2 in Step 0.5), Falcon's own log-only packets, and the typed argument lists the handlers use.
import { describe, expect, it } from "vitest";
import PacketMap, { clientToServerArr, knownServerPackets, serverToClientArr } from "@root/utils/socket/PacketMap";

describe("Packet names", () => {
    it("never uses one id for two packets in the same direction", () => {
        expect(new Set(clientToServerArr).size).toBe(clientToServerArr.length);
        expect(new Set(serverToClientArr).size).toBe(serverToClientArr.length);
    });

    it("keeps Falcon's own packets apart from the game's", () => {
        const game = new Set<string>(Object.values(PacketMap.SERVER_TO_CLIENT));
        for (const id of Object.values(PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT)) {
            expect(game.has(id), id).toBe(false);
            expect(knownServerPackets.has(id)).toBe(true);
        }
    });

    it("leaves io-init out of the cipher's packet list", () => {
        expect(serverToClientArr).not.toContain("io-init");
        expect(knownServerPackets.has("io-init")).toBe(true);
    });
});
