// Feature #53, Packet budget (PacketTracker): counts the packets we sent in the last second against "Packet Budget
// Limit" (default 110/s). Each tick it reserves room for one attack, aim, hat, move, weapon switch and a full heal
// (3 packets per food: select, use, re-select; apples need 5 for 100 health), and placements only get what's left now
// and over the next "Packet Budget Strictness" ticks (default 2). Reservations are freed once a step is done.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => {
    vi.useRealTimers();
    game?.done();
});

async function tracker() {
    game = await startGame();
    const { default: PacketTracker } = await import("@core/utils/PacketTracker");
    PacketTracker.init();
    PacketTracker.allocate();
    return PacketTracker;
}

describe("Packet budget", () => {
    it("gives nothing before it's started", async () => {
        // Client.connect starts it in every mode now, replays included (P28), so check a freshly loaded module.
        vi.resetModules();
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");
        expect(PacketTracker.request("PLACE", 4)).toBe(0);
        PacketTracker.init();
        PacketTracker.allocate();
        expect(PacketTracker.request("PLACE", 4)).toBe(4);
    });

    it("grants placements while there's room, fewer as the second fills up", async () => {
        const PacketTracker = await tracker();
        expect(PacketTracker.request("PLACE", 4)).toBe(4);
        for (let i = 0; i < 70; i++) PacketTracker.add();
        expect(PacketTracker.getCurrent()).toBe(70);
        const granted = PacketTracker.request("PLACE", 4);
        expect(granted).toBeLessThan(4);
        for (let i = 0; i < 40; i++) PacketTracker.add();
        expect(PacketTracker.request("PLACE", 4)).toBe(0);
    });

    it("reserves room for a full heal with the food we hold", async () => {
        const PacketTracker = await tracker();
        PacketTracker.adjustFoodAllocation(0); // apples heal 20: 5 for a full heal
        expect(PacketTracker.TOTAL_FOOD).toBe(5);
        PacketTracker.adjustFoodAllocation(1); // cookies heal 40: 3
        expect(PacketTracker.TOTAL_FOOD).toBe(3);
    });

    it("gives a freed reservation back, and ignores frees that would overdraw it or aren't a positive amount", async () => {
        // 59 packets this second leave room for 3 placements two ticks ahead (110 - 59 - 14 reserved - 2 x 14 = 9).
        const PacketTracker = await tracker();
        for (let i = 0; i < 59; i++) PacketTracker.add();
        expect(PacketTracker.request("PLACE", 10)).toBe(3);

        // Two of the three food reservations (2 x 3 packets) done: 6 more packets of room, 2 more placements.
        PacketTracker.free("FOOD", 2);
        expect(PacketTracker.request("PLACE", 10)).toBe(5);

        // Only 3 food packets are left reserved, so freeing 6 more would overdraw it: ignored.
        PacketTracker.free("FOOD", 2);
        expect(PacketTracker.request("PLACE", 10)).toBe(5);
        PacketTracker.free("FOOD", 0);
        PacketTracker.free("FOOD", -1);
        expect(PacketTracker.request("PLACE", 10)).toBe(5);

        // "ALL" frees whatever is left of it.
        PacketTracker.free("FOOD", "ALL");
        expect(PacketTracker.request("PLACE", 10)).toBe(6);
    });

    it("counts, frees and allocates nothing before it's started", async () => {
        vi.resetModules();
        const { default: PacketTracker } = await import("@core/utils/PacketTracker");
        for (let i = 0; i < 10; i++) PacketTracker.add();
        PacketTracker.free("FOOD", "ALL");
        PacketTracker.allocate();
        expect(PacketTracker.getCurrent()).toBe(0);
        PacketTracker.init();
        expect(PacketTracker.getCurrent()).toBe(0);
    });

    it("stops recording at 500 packets in one second, then records again once the oldest is a second old", async () => {
        vi.useFakeTimers({ toFake: ["performance"] });
        const PacketTracker = await tracker();
        for (let i = 0; i < 600; i++) PacketTracker.add();
        expect(PacketTracker.getCurrent()).toBe(500);
        vi.advanceTimersByTime(1001);
        PacketTracker.add();
        expect(PacketTracker.getCurrent()).toBe(1);
    });

    it("forgets packets older than a second", async () => {
        vi.useFakeTimers({ toFake: ["performance"] });
        const PacketTracker = await tracker();
        for (let i = 0; i < 50; i++) PacketTracker.add();
        expect(PacketTracker.getCurrent()).toBe(50);
        vi.advanceTimersByTime(1001);
        expect(PacketTracker.getCurrent()).toBe(0);
    });
});
