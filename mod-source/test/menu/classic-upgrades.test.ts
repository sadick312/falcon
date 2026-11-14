// Classic Upgrades (1.6.9 style): any age 8 weapon, then any age 9 weapon. The sandbox server checks only a weapon's
// age, not its pre (UPGRADES.md, section 9), so the planner sends exactly one weapon at age 8 and one at age 9.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let Menu: typeof import("@menu/Menu").default;
let Client: typeof import("@core/Client").default;
let updateUpgrades: typeof import("@core/events/updateUpgrades").default;
let classic: typeof import("@core/events/classicUpgrades");
let sent: number[];

const KATANA = 4, GREAT_AXE = 2, CROSSBOW = 12, REPEATER = 13, MUSKET = 15, POLEARM = 5, GREAT_HAMMER = 10;

beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => { });
    await import("@core/socket/SocketListener");
    const { default: items } = await import("@constants/items");
    Menu = (await import("@menu/Menu")).default;
    await Menu.init();
    Client = (await import("@core/Client")).default;
    updateUpgrades = (await import("@core/events/updateUpgrades")).default;
    classic = await import("@core/events/classicUpgrades");
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

const DEFAULTS: Record<string, unknown> = { autoUpgrade: false, classicUpgrades: false, classicPreset: -1, classicAutoPick: false };
const set = (values: Record<string, unknown>) => { for (const [id, v] of Object.entries(values)) Menu.itemMap[id]!.status = v as never; };

beforeEach(() => {
    set(DEFAULTS);
    sent = [];
    vi.spyOn(Client.socket, "sendMsg").mockImplementation(((type: string, id: number) => { if (type === "H") sent.push(id); }) as never);
});

afterEach(() => vi.restoreAllMocks());

/** An upgrade point for `age`, holding `weapons`; returns the weapon ids shown in the bar. */
function offer(age: number, weapons: number[]) {
    Client.player = { items: [0, 3, 6, 10], weapons, upgradePoints: 1, upgrAge: age } as never;
    Client.socket.isPrivateServer = false;
    updateUpgrades(1, age);
    return [...document.querySelectorAll("#upgrade-holder > [id^='upgrade-item-']")].map(e => Number(e.id.replace("upgrade-item-", ""))).filter(id => id < 16);
}

const buttons = () => [...document.querySelectorAll<HTMLElement>("#upgrade-holder .classic-combo")];

/** The weapons after the server accepts `id` (a primary replaces the primary, a secondary the secondary). */
function hold(weapons: number[], id: number) {
    const next = [...weapons];
    next[id <= 8 ? 0 : 1] = id;
    return next;
}

describe("combo table, from the weapon data", () => {
    it("has every age 8 x age 9 weapon pair, once", () => {
        const values = classic.CLASSIC_COMBOS.map(c => c.value);
        expect(values.sort((a, b) => a - b)).toEqual([213, 215, 413, 415, 1213, 1215]);
        expect(new Set(values).size).toBe(values.length);
        expect(classic.comboFromValue(415)?.label).toBe("Katana + Musket");
        expect(classic.comboFromValue(1215)?.label).toBe("Keep Primary + Musket (via Crossbow)");
    });

    it("rejects None and unknown values", () => {
        expect(classic.comboFromValue(-1)).toBeUndefined();
        expect(classic.comboFromValue(999)).toBeUndefined();
        expect(classic.comboFromValue(NaN)).toBeUndefined();
    });

    it("plans one weapon per age, never one already owned", () => {
        const picks = [KATANA, MUSKET];
        expect(classic.planClassicPick(picks, 7, [POLEARM])).toBeUndefined();
        expect(classic.planClassicPick(picks, 8, [POLEARM])).toBe(KATANA);
        expect(classic.planClassicPick(picks, 9, [KATANA])).toBe(MUSKET);
        expect(classic.planClassicPick(picks, 8, [KATANA])).toBeUndefined();
        expect(classic.planClassicPick(picks, 10, [KATANA, MUSKET])).toBeUndefined();
    });

    it("shows at age 9 only the combos whose age 8 weapon you own", () => {
        expect(classic.combosAt(9, [KATANA, GREAT_HAMMER]).map(c => c.value).sort()).toEqual([413, 415]);
        expect(classic.combosAt(9, [POLEARM, GREAT_HAMMER])).toEqual([]);
        expect(classic.combosAt(8, [POLEARM, GREAT_HAMMER])).toHaveLength(6);
    });
});

describe("Classic Upgrades off (default)", () => {
    it("is the normal 1.8.2 bar: no katana without the short sword, no buttons, nothing sent", () => {
        set({ classicPreset: 415, classicAutoPick: true });
        expect(offer(8, [POLEARM, GREAT_HAMMER])).toEqual([]);
        expect(buttons()).toEqual([]);
        expect(sent).toEqual([]);
    });
});

describe("Classic Upgrades on", () => {
    beforeEach(() => {
        set({ classicUpgrades: true });
        offer(2, [0]); // a new life: forgets a combo clicked in an earlier test
        sent = [];
    });

    it("shows every age 8 / 9 weapon, pre or not", () => {
        expect(offer(8, [POLEARM, GREAT_HAMMER]).sort((a, b) => a - b)).toEqual([GREAT_AXE, KATANA, CROSSBOW]);
        expect(offer(9, [KATANA, GREAT_HAMMER]).sort((a, b) => a - b)).toEqual([REPEATER, MUSKET]);
        expect(sent).toEqual([]);
    });

    it("leaves other ages alone", () => {
        offer(6, [POLEARM]);
        expect(buttons()).toEqual([]);
    });

    it("Auto Pick Favourite sends each combo in order: age 8 weapon, then age 9 weapon", () => {
        set({ classicAutoPick: true });
        for (const combo of classic.CLASSIC_COMBOS) {
            sent = [];
            set({ classicPreset: combo.value });
            const start = [POLEARM, GREAT_HAMMER];
            offer(7, start);
            offer(8, start);
            offer(9, hold(start, sent[0]!));
            expect(sent, combo.label).toEqual([...combo.picks]);
        }
    });

    it("sends nothing for an unknown Favourite (old or edited config)", () => {
        set({ classicAutoPick: true, classicPreset: 999 });
        offer(8, [POLEARM, GREAT_HAMMER]);
        expect(sent).toEqual([]);
    });

    it("a clicked button sends the age 8 weapon now and the age 9 weapon at age 9", () => {
        offer(8, [POLEARM, GREAT_HAMMER]);
        const katanaMusket = buttons().find(b => b.textContent === "Katana + Musket")!;
        katanaMusket.click();
        expect(sent).toEqual([KATANA]);
        offer(9, [KATANA, GREAT_HAMMER]);
        expect(sent).toEqual([KATANA, MUSKET]);
    });

    it("forgets a clicked combo after death (back to age 2)", () => {
        offer(8, [POLEARM, GREAT_HAMMER]);
        buttons().find(b => b.textContent === "Katana + Musket")!.click();
        offer(2, [0]);
        sent = [];
        offer(9, [KATANA, GREAT_HAMMER]);
        expect(sent).toEqual([]);
    });
});
