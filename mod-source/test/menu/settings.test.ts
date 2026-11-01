// Settings, favorites and saved configs, through Menu and the real config UI.
import Menu, { menuContent, SETTINGS_VERSION } from "@menu/Menu";
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
        await expect(Menu.loadSettings()).resolves.toEqual({ applied: 0, skipped: 0 });
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

describe("settings versioning", () => {
    const SLIDER = "autoPlaceRange";
    const SELECT = "attackInPush:dagger_method";

    it("saves the format version with the settings", async () => {
        reset();
        Menu.setValue("autoSaveSettings", true);
        await Menu.saveSettings();
        expect(JSON.parse(localStorage.getItem(SETTINGS)!).__version).toBe(SETTINGS_VERSION);
    });

    it("loads settings saved before versioning existed", async () => {
        reset();
        localStorage.setItem(SETTINGS, JSON.stringify({ [TOGGLE]: false, [SLIDER]: "650" }));
        await Menu.loadSettings();
        expect(Menu.getValue(TOGGLE)).toBe(false);
        expect(Menu.getValue(SLIDER)).toBe("650");
    });

    it("keeps the default when a saved value doesn't fit its setting", async () => {
        reset();
        localStorage.setItem(SETTINGS, JSON.stringify({
            __version: SETTINGS_VERSION,
            [TOGGLE]: "yes",
            [SLIDER]: "far",
            [SELECT]: 99
        }));
        await Menu.loadSettings();
        expect(Menu.getValue(TOGGLE)).toBe(initial[TOGGLE]);
        expect(Menu.getValue(SLIDER)).toBe(initial[SLIDER]);
        expect(Menu.getValue(SELECT)).toBe(initial[SELECT]);
    });

    it("accepts every value the menu itself stores: defaults, slider text and select option text", async () => {
        reset();
        const option = Menu.itemMap[SELECT].options![1].value;
        await Menu.loadSettings({ ...Menu.collectSettings(), [SLIDER]: "500", [SELECT]: String(option) });
        expect(Menu.getValue(SLIDER)).toBe("500");
        expect(String(Menu.getValue(SELECT))).toBe(String(option));

        // Round trip of all defaults: nothing a fresh menu saves may be rejected when loaded back.
        reset();
        const defaults = Menu.collectSettings();
        for (const item of Object.values(Menu.itemMap)) item.status = undefined;
        await Menu.loadSettings(defaults);
        for (const [id, value] of Object.entries(defaults)) {
            if (id !== "__version" && value !== undefined) expect([id, Menu.getValue(id)]).toEqual([id, value]);
        }
    });

    it("ignores saved data that isn't an object", async () => {
        reset();
        localStorage.setItem(SETTINGS, "[1, 2, 3]");
        await Menu.loadSettings();
        expect(snapshotStatuses()).toEqual(initial);
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
