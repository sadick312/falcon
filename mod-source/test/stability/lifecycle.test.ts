// State that must not leak or go stale: lists only the renderer cleans up, reused projectile ids, and what runs
// while we're dead.
import { describe, expect, it, vi } from "vitest";

describe("lists the renderer cleans up", () => {
    it("caps floating texts, dropping the oldest, so a hidden tab can't grow the map", async () => {
        const { default: TextManager } = await import("@core/logic/TextManager");
        TextManager.texts.clear();

        for (let i = 0; i < TextManager.MAX_TEXTS + 50; i++) TextManager.add(0, 0, i, 0);

        expect(TextManager.texts.size).toBeLessThanOrEqual(TextManager.MAX_TEXTS);
        // Random ids can collide, which replaces a text instead of adding one, so only check the newest survived.
        expect([...TextManager.texts.values()].some(text => text.text === TextManager.MAX_TEXTS + 49)).toBe(true);
    });

    it("reuses the oldest placement marker once 256 are active", async () => {
        const { default: Client } = await import("@core/Client");
        const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
        Client.markers.length = 0;

        // Nothing renders in this test, so no marker ever becomes inactive (like Render Placements being off).
        for (let i = 0; i < 1000; i++) PlacementSystem.addMarkerRaw(i, i, 0, 15, 0);

        expect(Client.markers).toHaveLength(256);
        expect(Client.markers.some(marker => marker.x === 999)).toBe(true);
    });

    it("still reuses an inactive marker before anything else", async () => {
        const { default: Client } = await import("@core/Client");
        const { default: PlacementSystem } = await import("@core/mod/combat/core/PlacementSystem");
        Client.markers.length = 0;

        PlacementSystem.addMarkerRaw(1, 1, 0, 15, 0);
        PlacementSystem.addMarkerRaw(2, 2, 0, 15, 0);
        Client.markers[0].active = false;
        PlacementSystem.addMarkerRaw(3, 3, 0, 15, 0);

        expect(Client.markers.map(marker => marker.x)).toEqual([3, 2]);
    });
});

describe("ProjectileManager", () => {
    it("tracks a new projectile that reuses the sid of one we still think is flying", async () => {
        const { default: ProjectileManager } = await import("@core/logic/ProjectileManager");

        ProjectileManager.add(1000, 1000, 0, 500, 1.6, 0, 1, 77);
        ProjectileManager.add(5000, 6000, Math.PI, 700, 2.5, 1, 1, 77);

        const simProj = ProjectileManager.simulationProjectiles.get(77)!;
        const proj = ProjectileManager.projectiles.get(77)!;
        expect([simProj.x, simProj.y, simProj.range, simProj.indx]).toEqual([5000, 6000, 700, 1]);
        expect([proj.x, proj.y, proj.range, proj.indx]).toEqual([5000, 6000, 700, 1]);
        expect(simProj.active && proj.active).toBe(true);
    });
});

describe("Menu.setValue", () => {
    it("warns instead of throwing for a setting that doesn't exist", async () => {
        const { default: Menu } = await import("@menu/Menu");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });

        expect(() => Menu.setValue("noSuchSetting", true)).not.toThrow();
        expect(warn).toHaveBeenCalledOnce();
    });
});

describe("while we're dead", () => {
    async function spawnedPlayer() {
        const { default: Player } = await import("@entities/Player");
        const { default: Client } = await import("@core/Client");
        Client.player = new Player("me", 1);
        return Client;
    }

    it("skips the mod tick", async () => {
        const Client = await spawnedPlayer();
        const { default: ModManager } = await import("@core/ModManager");
        const { default: ObjectManager } = await import("@core/logic/ObjectManager");
        const populate = vi.spyOn(ObjectManager.pool, "populate").mockImplementation(() => { });

        Client.isAlive = false;
        ModManager.main();
        expect(populate).not.toHaveBeenCalled();
    });

    it("doesn't fake missing server ticks", async () => {
        const Client = await spawnedPlayer();
        const { default: PacketBatcher } = await import("@core/utils/PacketBatcher");
        const batcher = PacketBatcher as unknown as { armWatchdog(): void; watchdogTimer: number | null };

        vi.useFakeTimers();
        try {
            Client.isAlive = false;
            batcher.armWatchdog();
            expect(batcher.watchdogTimer).toBeNull();

            Client.isAlive = true;
            batcher.armWatchdog();
            expect(batcher.watchdogTimer).not.toBeNull();
        } finally {
            vi.clearAllTimers();
            vi.useRealTimers();
            batcher.watchdogTimer = null;
        }
    });
});
