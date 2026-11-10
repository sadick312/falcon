// Part 3D, Auto Upgrade: it took the only option, or cookie / pit trap / greater spikes / the 7th Slot choice, and
// otherwise did nothing, so the points of ages 2, 6, 8 and 9 (mostly weapons) were left unspent. Now each of those
// ages has a Menu choice (default Manual, as before), and "Spend Every Point" (default off) takes something offered
// when the choice isn't offered, when only buildings are offered, or after a wait at a Manual age.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Menu = typeof import("@menu/Menu").default;
let Menu: Menu;
let Client: typeof import("@core/Client").default;
let updateUpgrades: typeof import("@core/events/updateUpgrades").default;
let sent: number[];

const W = 16; // upgrade id of a building: 16 + item id
const COOKIE = W + 1;
const GREATER_SPIKES_ITEM = 7;
const POISON_SPIKES = W + 8;

beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => { });
    await import("@core/socket/SocketListener");
    const { default: items } = await import("@constants/items");
    Menu = (await import("@menu/Menu")).default;
    await Menu.init();
    Client = (await import("@core/Client")).default;
    updateUpgrades = (await import("@core/events/updateUpgrades")).default;
    const actionBar = document.getElementById("action-bar")!;
    for (let i = 0; i < items.weapons.length + items.list.length; i++) {
        const item = document.createElement("div");
        item.id = `action-bar-item-${i}`;
        actionBar.appendChild(item);
    }
    Client.mode = "replay";
    await import("@core/Connection");
    await Client.connect();
}, 30_000);

const DEFAULTS: Record<string, unknown> = { autoUpgrade: true, upgradeSpendAll: false, upgradeAge2: -1, upgradeAge6: -1, upgradeAge8: -1, upgradeAge9: -1, upgradeManualWait: 10 };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    for (const [id, value] of Object.entries(DEFAULTS)) Menu.itemMap[id]!.status = value as never;
    sent = [];
    vi.spyOn(Client.socket, "sendMsg").mockImplementation(((type: string, id: number) => { if (type === "H") sent.push(id); }) as never);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

/** An upgrade point arrives for `age`, with our weapons and buildings. */
function offer(age: number, weapons: number[] = [0], ownedItems: number[] = [0, 3, 6, 10], points = 1) {
    const player = { items: ownedItems, weapons, upgradePoints: points, upgrAge: age };
    Client.player = player as never;
    Client.socket.isPrivateServer = false;
    updateUpgrades(points, age);
    return player;
}

const set = (values: Record<string, unknown>) => { for (const [id, v] of Object.entries(values)) Menu.itemMap[id]!.status = v as never; };

describe("Auto Upgrade, defaults (as before)", () => {
    it("takes cookie at age 3 and leaves the age 2 weapon to you", () => {
        offer(3);
        expect(sent).toEqual([COOKIE]);
        sent.length = 0;
        offer(2);
        vi.advanceTimersByTime(60_000);
        expect(sent).toEqual([]);
    });

    it("leaves age 9's buildings unpicked (the unspent points from the live test)", () => {
        offer(9, [5], [0, 3, GREATER_SPIKES_ITEM, 10]);
        vi.advanceTimersByTime(60_000);
        expect(sent).toEqual([]);
    });
});

describe("Auto Upgrade, age choices", () => {
    it("takes the age 2 weapon you chose", () => {
        set({ upgradeAge2: 5 });
        offer(2);
        expect(sent).toEqual([5]);
    });

    it("the polearm + musket path: polearm, hunting bow, crossbow, musket", () => {
        set({ upgradeAge2: 5, upgradeAge6: 9, upgradeAge8: 12, upgradeAge9: 15 });
        offer(2);
        offer(6, [5]);
        offer(8, [5, 9]);
        offer(9, [5, 12]);
        expect(sent).toEqual([5, 9, 12, 15]);
    });

    it("cookie / pit trap / greater spikes still come first, as before", () => {
        set({ upgradeAge2: 5 });
        offer(3);
        expect(sent).toEqual([COOKIE]);
    });
});

describe("Spend Every Point", () => {
    beforeEach(() => set({ upgradeSpendAll: true }));

    it("picks a building at an age that offers only buildings", () => {
        offer(9, [5], [0, 3, GREATER_SPIKES_ITEM, 10]);
        expect(sent).toEqual([POISON_SPIKES]);
    });

    it("replaces a choice that isn't offered (no crossbow for the musket) with the first offered, buildings first", () => {
        set({ upgradeAge9: 15 });
        offer(9, [5], [0, 3, GREATER_SPIKES_ITEM, 10]);
        expect(sent).toEqual([POISON_SPIKES]);
    });

    it("at a Manual weapon age, waits for your pick, then picks", () => {
        offer(6, [5]);
        vi.advanceTimersByTime(9_999);
        expect(sent).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(sent).toEqual([9]); // the first offered: hunting bow
    });

    it("doesn't pick if you picked by hand in the meantime", () => {
        const player = offer(6, [5]);
        vi.advanceTimersByTime(4_000);
        player.upgradePoints = 0;
        updateUpgrades(0, 6); // your pick used the point
        vi.advanceTimersByTime(20_000);
        expect(sent).toEqual([]);
    });

    it("uses the wait you set", () => {
        set({ upgradeManualWait: 3 });
        offer(6, [5]);
        vi.advanceTimersByTime(3_000);
        expect(sent).toEqual([9]);
    });

    it("does nothing when Auto Upgrade is off", () => {
        set({ autoUpgrade: false });
        offer(9, [5], [0, 3, GREATER_SPIKES_ITEM, 10]);
        offer(6, [5]);
        vi.advanceTimersByTime(60_000);
        expect(sent).toEqual([]);
    });
});
