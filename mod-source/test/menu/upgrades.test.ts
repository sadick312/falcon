// The upgrade picker offers what the v1.8.2 game offers: a building only once you own the one it upgrades.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let items: typeof import("@constants/items").default;
let LIST_ID_MAP: typeof import("@constants/items").LIST_ID_MAP;
let Client: typeof import("@core/Client").default;
let updateUpgrades: typeof import("@core/events/updateUpgrades").default;

beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => { });
    await import("@core/socket/SocketListener");
    ({ default: items, LIST_ID_MAP } = await import("@constants/items"));
    const { default: Menu } = await import("@menu/Menu");
    await Menu.init();
    Client = (await import("@core/Client")).default;
    updateUpgrades = (await import("@core/events/updateUpgrades")).default;

    // The hotbar elements the picker copies its icons from (Loader.prepareUI builds them in the game).
    const actionBar = document.getElementById("action-bar")!;
    for (let i = 0; i < items.weapons.length + items.list.length; i++) {
        const item = document.createElement("div");
        item.id = `action-bar-item-${i}`;
        actionBar.appendChild(item);
    }

    Client.mode = "replay";
    await Client.connect();
}, 30_000);

/** Upgrade ids shown for this age: weapons by id, buildings by weapons.length + item id. */
function offered(age: number, ownedItems: number[], privateServer = false) {
    const player = { items: ownedItems, weapons: [0], upgradePoints: 0, upgrAge: 0 };
    Client.player = player as never;
    Client.socket.isPrivateServer = privateServer;
    updateUpgrades(1, age);
    return [...document.querySelectorAll("#upgrade-holder > [id^='upgrade-item-']")].map(e => Number(e.id.replace("upgrade-item-", "")));
}

const building = (id: number) => items.weapons.length + id;

beforeEach(() => {
    vi.spyOn(Client.socket, "sendMsg").mockImplementation(() => { });
});

describe("building prerequisites", () => {
    it("are the same item ids as in the v1.8.2 client", () => {
        const pre = Object.fromEntries(items.list.filter(item => item.pre !== undefined).map(item => [item.name, item.pre]));
        expect(pre).toEqual({
            "castle wall": LIST_ID_MAP.STONE_WALL,
            "poison spikes": LIST_ID_MAP.GREATER_SPIKES,
            "spinning spikes": LIST_ID_MAP.GREATER_SPIKES,
            "faster windmill": LIST_ID_MAP.WINDMILL,
            "power mill": LIST_ID_MAP.FASTER_WINDMILL
        });
    });

    it("hide castle wall until you own stone wall", () => {
        const age = items.list[LIST_ID_MAP.CASTLE_WALL].age!;
        expect(offered(age, [0, 3, 6, 10])).not.toContain(building(LIST_ID_MAP.CASTLE_WALL));
        expect(offered(age, [0, 4, 6, 10])).toContain(building(LIST_ID_MAP.CASTLE_WALL));
    });

    it("hide poison and spinning spikes until you own greater spikes", () => {
        const age = items.list[LIST_ID_MAP.POISON_SPIKES].age!;
        const withoutGreater = offered(age, [0, 3, 6, 10]);
        expect(withoutGreater).not.toContain(building(LIST_ID_MAP.POISON_SPIKES));
        expect(withoutGreater).not.toContain(building(LIST_ID_MAP.SPINNING_SPIKES));

        const withGreater = offered(age, [0, 3, 7, 10]);
        expect(withGreater).toContain(building(LIST_ID_MAP.POISON_SPIKES));
        expect(withGreater).toContain(building(LIST_ID_MAP.SPINNING_SPIKES));
    });

    it("still offer buildings without a prerequisite", () => {
        const age = items.list[LIST_ID_MAP.STONE_WALL].age!;
        expect(offered(age, [0, 3, 6, 10])).toContain(building(LIST_ID_MAP.STONE_WALL));
    });

    it("are not checked on a local private server, as for weapons", () => {
        const age = items.list[LIST_ID_MAP.CASTLE_WALL].age!;
        expect(offered(age, [0, 3, 6, 10], true)).toContain(building(LIST_ID_MAP.CASTLE_WALL));
    });
});

describe("Auto Upgrade weapon path", () => {
    /** The upgrade Auto Upgrade sends at `age` while holding `weapons`, with the given "Weapon Path". */
    async function picked(age: number, weapons: number[], path: string) {
        const { default: Menu } = await import("@menu/Menu");
        Menu.itemMap.autoUpgrade.status = true;
        Menu.itemMap.upgradePath.status = path;
        const sent: unknown[][] = [];
        vi.spyOn(Client.socket, "sendMsg").mockImplementation((...args: unknown[]) => { sent.push(args); });
        Client.player = { items: [0, 3, 6, 10], weapons, upgradePoints: 0, upgrAge: 0 } as never;
        Client.socket.isPrivateServer = false;
        updateUpgrades(1, age);
        Menu.itemMap.autoUpgrade.status = false;
        return sent.map(args => args[1]);
    }

    it("goes polearm, hunting bow, crossbow, musket with Polearm + Musket", async () => {
        expect(await picked(2, [0], "polearmMusket")).toEqual([5]);
        expect(await picked(6, [5], "polearmMusket")).toEqual([9]);
        expect(await picked(8, [5, 9], "polearmMusket")).toEqual([12]);
        expect(await picked(9, [5, 12], "polearmMusket")).toEqual([15]);
    });

    it("leaves the default choices alone on the Default path", async () => {
        expect(await picked(2, [0], "default")).not.toContain(5);
    });
});
