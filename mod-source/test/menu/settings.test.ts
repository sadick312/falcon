// Settings, favorites and saved configs, through Menu and the real config UI.
import Menu, { menuContent } from "@menu/Menu";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SETTINGS = "falcon-settings";
const FAVORITES = "falcon-favorites";
const CONFIGS = "falcon-configs";

/** A saveable toggle that starts true, so changes are easy to see. */
const TOGGLE = "renderNames";

function snapshotStatuses() {
    return Object.fromEntries(Object.entries(Menu.itemMap).map(([id, item]) => [id, item.status]));
}

/** Statuses right after Menu.init(); Menu keeps state between tests, so each test starts from these. */
let initial: Record<string, unknown>;

beforeAll(async () => {
    await Menu.init();
    initial = snapshotStatuses();
});

function reset() {
    for (const [id, status] of Object.entries(initial)) Menu.itemMap[id].status = status;
}

describe("settings", () => {
    it("saves every saveable item when auto-save is on, and loads them back", async () => {
        reset();
        Menu.setValue("autoSaveSettings", true);
        Menu.itemMap[TOGGLE].status = false;
        await Menu.saveSettings();

        const saved = JSON.parse(localStorage.getItem(SETTINGS)!);
        expect(saved[TOGGLE]).toBe(false);
        expect(saved.autoSaveSettings).toBe(true);

        Menu.itemMap[TOGGLE].status = true;
        await Menu.loadSettings();
        expect(Menu.getValue(TOGGLE)).toBe(false);
    });

    it("removes saved settings when auto-save is off", async () => {
        reset();
        localStorage.setItem(SETTINGS, "{}");
        Menu.itemMap.autoSaveSettings.status = false;
        await Menu.saveSettings();
        expect(localStorage.getItem(SETTINGS)).toBeNull();
    });

    it("survives corrupted settings and keeps the current values", async () => {
        reset();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        localStorage.setItem(SETTINGS, "{not json");
        await expect(Menu.loadSettings()).resolves.toBe(true);
        expect(snapshotStatuses()).toEqual(initial);
        expect(warn).toHaveBeenCalled();
    });

    it("ignores unknown ids and inherited names like __proto__", async () => {
        reset();
        localStorage.setItem(SETTINGS, `{"__proto__": {"polluted": true}, "noSuchItem": 1, "${TOGGLE}": false}`);
        await Menu.loadSettings();
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Menu.itemMap.noSuchItem).toBeUndefined();
        expect(Menu.getValue(TOGGLE)).toBe(false);
    });
});

describe("favorites", () => {
    it("saves and restores favorited items", () => {
        reset();
        for (const item of Object.values(Menu.itemMap)) item.isFavorited = false;
        Menu.itemMap[TOGGLE].isFavorited = true;
        Menu.saveFavorites();
        expect(JSON.parse(localStorage.getItem(FAVORITES)!)).toEqual([TOGGLE]);

        Menu.itemMap[TOGGLE].isFavorited = false;
        Menu.loadFavorites();
        expect(Menu.itemMap[TOGGLE].isFavorited).toBe(true);
    });

    it("ignores corrupted or non-array favorites", () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        for (const value of ["{oops", "{\"a\":1}", "42"]) {
            localStorage.setItem(FAVORITES, value);
            expect(() => Menu.loadFavorites()).not.toThrow();
        }
    });
});

describe("saved configs (config tab UI)", () => {
    function openConfigTab() {
        Menu.renderItems(menuContent.configs);
        return Menu.contentElement;
    }

    function saveConfig(name: string) {
        const tab = openConfigTab();
        const input = tab.querySelector<HTMLInputElement>(".menuConfigUIInput")!;
        input.value = name;
        tab.querySelector<HTMLElement>(".menuConfigUIButton")!.click();
    }

    const configRows = () => [...Menu.contentElement.querySelectorAll<HTMLElement>(".menuConfigToggle")];

    it("exports the current statuses under a name and lists it", () => {
        reset();
        Menu.itemMap[TOGGLE].status = false;
        saveConfig("pvp");

        const configs = JSON.parse(localStorage.getItem(CONFIGS)!);
        expect(configs.pvp[TOGGLE]).toBe(false);
        expect(configRows().map((row) => row.textContent)).toEqual([expect.stringContaining("Load 'pvp' Config")]);
    });

    it("imports a saved config when its row is clicked", () => {
        reset();
        Menu.itemMap[TOGGLE].status = false;
        saveConfig("off");
        Menu.itemMap[TOGGLE].status = true;

        configRows()[0].click();
        expect(Menu.getValue(TOGGLE)).toBe(false);
    });

    it("shows a config name as text, not HTML", () => {
        saveConfig("<img src=x onerror=alert(1)>");
        expect(Menu.contentElement.querySelector("img")).toBeNull();
    });

    it("renders the config tab even when the stored configs are corrupted", () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        localStorage.setItem(CONFIGS, "{oops");
        expect(() => openConfigTab()).not.toThrow();
        expect(configRows()).toHaveLength(0);
    });
});
