import { describe, expect, it } from "vitest";

describe("PlayerManager", () => {
    it("drops a removed player from the visible list too", async () => {
        const { default: Player } = await import("@entities/Player");
        const { default: PlayerManager } = await import("@core/logic/players/PlayerManager");

        const player = new Player("leaver", 42);
        PlayerManager.add(player);
        PlayerManager.players.visible.add(player);

        PlayerManager.remove(player);

        expect(PlayerManager.get(42)).toBeUndefined();
        expect(PlayerManager.players.visible.has(42)).toBe(false);
    });
});

describe("ObjectManager", () => {
    it("ignores a resent object instead of adding it to its chunk twice", async () => {
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");

        ObjectManager.add(9001, 5000, 5000, 0, 50, 0, 6, true);
        ObjectManager.add(9001, 5000, 5000, 0, 50, 0, 6, true);

        const nearby = ObjectManager.getObjects(5000, 5000).filter(obj => obj.sid === 9001);
        expect(nearby).toHaveLength(1);
    });

    it("marks objects inactive when their owner's objects are cleared", async () => {
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");

        ObjectManager.add(9002, 6000, 6000, 0, 50, 0, 6, true, 77);
        const obj = ObjectManager.getObject(9002)!;

        ObjectManager.removeAll(77);

        expect(obj.active).toBe(false);
        expect(ObjectManager.getObject(9002)).toBeUndefined();
    });
});
