// Feature #50, 1.8.2 packet conversion (LegacyPacketAdapter): 1.8.2 sends every visible player as one flat 13-value
// entry per tick (sid, x, y, dir in radians, then 9 attributes) and every animal as 7 values; the handlers expect
// 1.9.0's layout: positions with dir × 100, only the attributes that changed, and the sids that left view. The
// split, animals, respawns and malformed data are covered in test/socket/packets.test.ts.
import { describe, expect, it } from "vitest";
import LegacyPacketAdapter from "@core/socket/LegacyPacketAdapter";
import PacketMap from "@root/utils/socket/PacketMap";

const S2C = PacketMap.SERVER_TO_CLIENT;
const attrs = (n: number) => Array.from({ length: 9 }, (_, i) => n + i);
const player = (sid: number, a: number[]) => [sid, 100, 200, 0, ...a];

describe("1.8.2 packet conversion", () => {
    it("sends a player's full attributes again when they come back into view", () => {
        const adapter = new LegacyPacketAdapter();
        adapter.adapt(S2C.UPDATE_PLAYERS, [[...player(1, attrs(0)), ...player(2, attrs(10))]]);
        adapter.adapt(S2C.UPDATE_PLAYERS, [player(1, attrs(0))]);
        // Player 2 is back with the same attributes; the handler forgot them when they left view.
        const back = adapter.adapt(S2C.UPDATE_PLAYERS, [[...player(1, attrs(0)), ...player(2, attrs(10))]]);
        expect(back![1]).toEqual([2, ...attrs(10)]);
        expect(back![2]).toEqual([]);
    });

    it("sends only the players whose attributes changed", () => {
        const adapter = new LegacyPacketAdapter();
        adapter.adapt(S2C.UPDATE_PLAYERS, [[...player(1, attrs(0)), ...player(2, attrs(10))]]);
        const changed = attrs(10);
        changed[5] = 99; // e.g. a new hat
        const next = adapter.adapt(S2C.UPDATE_PLAYERS, [[...player(1, attrs(0)), ...player(2, changed)]]);
        expect(next![1]).toEqual([2, ...changed]);
    });

    it("ignores a trailing partial entry", () => {
        const adapter = new LegacyPacketAdapter();
        const out = adapter.adapt(S2C.UPDATE_PLAYERS, [[...player(1, attrs(0)), 7, 8]]);
        expect(out![0]).toEqual([1, 100, 200, 0]);
    });
});
