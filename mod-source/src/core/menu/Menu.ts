import drawNumberInput from "@menu/utils/drawNumberInput";
import getElem from "@utils/dom/getElem";
import { profileEnd, profileStart } from "@services/profiler/Profiler";
import readJson from "@utils/storage/readJson";
import "./menuStyle";
import Stack from "./misc/Stack";
import drawChatLog, { appendChatLog } from "./utils/drawChatLog";
import drawConfigUI from "./utils/drawConfigUI";
import drawMenuGroup from "./utils/drawMenuGroup";
import drawMenuParagraph from "./utils/drawMenuParagraph";
import drawMenuSelect from "./utils/drawMenuSelect";
import drawMenuSlider from "./utils/drawMenuSlider";
import drawMenuToggle from "./utils/drawMenuToggle";
import drawSavedConfigs from "./utils/drawSavedConfigs";
import { makeKeyboardClickable } from "./utils/keyboard";
import { IMenuItem } from "./types";
import { SETTINGS_VERSION, SETTINGS_VERSION_KEY, migrateSettings, isValidSettingValue } from "./settingsVersion";
import { ChatLog } from "./ChatLog";
import { menuTabs } from "./content/tabs";
import { menuContent } from "./content";

// Re-exported so existing imports from "@menu/Menu" keep working.
export type { IMenuItem, SavedConfigs } from "./types";
export { SETTINGS_VERSION } from "./settingsVersion";
export { ChatLog } from "./ChatLog";
export { menuContent } from "./content";

export default class Menu {
    static chatLogs: ChatLog[] = [new ChatLog("Loaded Falcon Mod")];

    /** Adds a line to the console tab's chat log (see appendChatLog). */
    static addChatLog(log: ChatLog) {
        appendChatLog(Menu, log);
    }

    static tabHolder: HTMLDivElement;
    static contentElement: HTMLDivElement;
    static menuElement: HTMLDivElement;

    static forwardButton: HTMLDivElement;
    static backwardButton: HTMLDivElement;
    static utilsTitle: HTMLDivElement;

    static backwardStack: Stack<IMenuItem> = new Stack();
    static forwardStack: Stack<IMenuItem> = new Stack();

    /** The first item of what's shown; undefined when that's empty (e.g. Favorites with nothing favorited). */
    static currentItem: IMenuItem | undefined;

    /**
     * The current value of a setting: true/false for toggles, the chosen option's value for selects, a number or
     * numeric string for sliders and number inputs. Loosely typed because every module reads its own settings
     * through this; a test checks that every id passed here exists (test/menu/setting-ids.test.ts).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static getValue(id: string): any {
        return this.itemMap[id]?.status;
    }

    static setValue(id: string, val: boolean) {
        const item = this.itemMap[id];
        if (!item) {
            console.warn(`[Falcon] Menu.setValue: there is no setting called "${id}".`);
            return;
        }

        if (typeof item.status === "boolean") {
            item.status = val;
            if (typeof item.update === "function") item.update();
        }

        this.saveSettings();
    }

    /** Applies saved settings (the stored ones by default). Returns how many values were used and skipped. */
    static async loadSettings(customSettings?: Record<string, unknown>) {
        const saved = customSettings ?? readJson<Record<string, unknown>>("falcon-settings", {});
        const data = migrateSettings(saved);
        let applied = 0;
        let skipped = 0;

        for (const id in data) {
            if (id === SETTINGS_VERSION_KEY) continue;

            // Own keys only: `in` would also match inherited names such as "__proto__".
            const item = Object.hasOwn(this.itemMap, id) ? this.itemMap[id] : undefined;
            if (!item) {
                skipped++;
                continue;
            }

            // A value that no longer fits its setting (e.g. a toggle that became a slider) keeps the default.
            if (isValidSettingValue(item, data[id])) {
                item.status = data[id];
                applied++;
            } else {
                skipped++;
            }
        }

        return { applied, skipped };
    }

    /** Loads a saved config or an imported file, saves it as the current settings and redraws the menu. */
    static async applySettings(settings: Record<string, unknown>) {
        const result = await this.loadSettings(settings);
        this.saveSettings();
        this.rerender();
        return result;
    }

    /** Draws the current view again with the latest values. */
    static rerender() {
        if (!this.contentElement) return;
        this.renderItems(this.oldItems);
    }

    /** Every saveable setting's value, plus the format version, as stored in "falcon-settings" and saved configs. */
    static collectSettings() {
        const settings: Record<string, unknown> = { [SETTINGS_VERSION_KEY]: SETTINGS_VERSION };

        for (const item of Object.values(this.itemMap)) {
            if (item.neverSave) continue;
            if (item.type === "paragraph") continue;
            settings[item.id] = item.status;
        }

        return settings;
    }

    static loadFavorites() {
        const allFavorites = readJson<unknown>("falcon-favorites", null);
        if (!Array.isArray(allFavorites)) return;

        for (const item of Object.values(this.itemMap)) {
            if (allFavorites.includes(item.id)) {
                item.isFavorited = true;
            }
        }
    }

    static saveFavorites() {
        const allFavorites: string[] = [];

        for (const item of Object.values(this.itemMap)) {
            if (!item.isFavorited) continue;
            allFavorites.push(item.id);
        }

        localStorage.setItem("falcon-favorites", JSON.stringify(allFavorites));
    }

    static async saveSettings() {
        if (!Menu.getValue("autoSaveSettings")) {
            localStorage.removeItem("falcon-settings");
            return;
        }

        localStorage.setItem("falcon-settings", JSON.stringify(this.collectSettings()));
    }

    static itemMap: Record<string, IMenuItem> = {};

    static buildItemMap(items?: IMenuItem[]) {
        if (!items) items = Object.values(menuContent).flat() as IMenuItem[];

        for (const item of items) {
            this.itemMap[item.id] = item;
            if (item.settings) this.buildItemMap(item.settings);
        }
    }

    static async init() {
        const menuElement = this.menuElement = document.createElement("div");
        menuElement.id = "scriptMenu";
        document.body.appendChild(menuElement);

        menuElement.style.display = "none";

        const headerElement = document.createElement("div");
        headerElement.id = "headerElement";
        headerElement.classList.add("bunPadding");
        menuElement.appendChild(headerElement);

        headerElement.innerHTML = `
            <svg viewBox="0 0 512 512" style="pointer-events: none; margin-left: 10px;" width="45" height="45">
                <path fill="var(--generic-white)" d="M0 0c5.3.3 7.8 3.3 11.3 6.9.8.8.8.8 1.7 1.7 4 4.1 4 4.1 4 6.4.6.2 1.1.4 1.7.6 3.4 2.1 5.4 5.1 7.6 8.3.5.7 1 1.3 1.5 2 3.5 4.9 6.7 10 9.6 15.3 2.4 4.1 5 7.9 7.6 11.8 0-6.3 0-12.5 0-19 .7 0 1.3 0 2 0 .1.5.1 1.1.2 1.6C48.9 47.4 55.3 59 63 68c.7 1 1.5 1.9 2.3 2.9 1.5 2.2 1.5 2.2 3.7 3.1-1.1-8.4-2.7-16.6-4.5-24.9-4.7-22-4.7-22-4.5-32.1 3.2 1.6 4.2 5 5.7 8.2.7 1.5 1.4 2.9 2.2 4.4.4.7.7 1.5 1.1 2.2 1 2 2 4 3 6 .6 1.2 1.2 2.3 1.8 3.6.8 1.6.8 1.6 1.6 3.1 1.3 2.7 2.4 5.4 3.5 8.2 2.1 5.5 4.8 10.6 7.6 15.8 3.2 6 6.2 11.9 8.6 18.3 1.3 3.3 3.1 6.2 4.9 9.2 1-2.9 1.1-4.6 1.1-7.6 0-.9 0-1.8 0-2.8 0-1.5 0-1.5 0-3 0-1 0-2 0-3.1 0-3.3 0-6.5 0-9.8 0-2.2 0-4.4 0-6.6 0-5.4 0-10.8 0-16.2 3.1 2.8 4.7 5 6 8.9.3 1 .7 1.9 1 2.9s.7 2.1 1 3.1c.5 1.6.5 1.6 1.1 3.2 3.6 11.4 5.8 22.8 7.7 34.5.1.8.3 1.5.4 2.3.2 1.4.5 2.8.7 4.3.8 4.7 1.8 8.5 4.1 12.6 3.1 1.1 3.1 1.1 6 1 2.8-14.7 5.5-30 3-45 1 0 2 0 3 0 4.7 19.2 8.3 38 8.5 57.8.1 6.4 1.2 9.8 5.7 14.5.6.6 1.2 1.1 1.8 1.7.1-.7.1-1.4.2-2.1 1.6-12.7 5.5-25.3 9.7-37.6 1 0 2 0 3 0 .9 6.8 1.2 13.5 1.2 20.4 0 1.6 0 1.6 0 3.2 0 7.5-.5 14.9-1.6 22.3-.9 6.8-.9 11.5 3.4 17.2 3.6-9.6 7.3-19.1 11-29 1 0 2 0 3 0 .7 10.7-.9 20.9-2.7 31.5-1.8 10.6-1.8 10.6 1.7 20.4 1 1.5 1 1.5 1.9 3.1 4.2-4.6 6.5-9.9 9.1-15.4.4-.9.9-1.9 1.3-2.8 2.1-4.5 4.1-9 5.5-13.7 1 0 2 0 3 0-.2 8.6-1.6 16.8-3.3 25.1-.3 1.5-.3 1.5-.6 3-1.3 6.1-3 11.7-5.4 17.4-.8 2.9-.6 4.6.3 7.5.7 1 1.3 2 2 3 .7-1.1.7-1.1 1.3-2.3 3.9-6.6 7.7-12.9 11.9-18.9.5-.7 1-1.5 1.5-2.3.5-.6 1-1.2 1.5-1.8.7 0 1.3 0 2 0-.4 13-5.6 25.3-12 36.4-1.2 3.3-.8 5.3 0 8.6 5-3.7 8-7.6 11-13 .7.3 1.3.7 2 1-.1.9-.3 1.8-.4 2.7-.2 1.2-.4 2.4-.6 3.6s-.4 2.3-.6 3.6c-.5 3.1-.5 3.1-.4 6.1.7-.6.7-.6 1.4-1.3 21.8-19.2 21.8-19.2 29.6-20.6 0-.7 0-1.3 0-2 1.6-1.3 1.6-1.3 3.8-2.8 1.2-.8 1.2-.8 2.4-1.6.9-.6 1.7-1.2 2.6-1.7.9-.6 1.7-1.2 2.6-1.8 6.2-4.2 12.3-8.2 18.6-12.1.9-.6 1.8-1.2 2.7-1.8 5.3-3.4 10.7-6.6 16.3-9.6 2.3-1.3 4.5-2.6 6.8-3.9.7-.4 1.3-.8 2-1.2 1.3-.8 2.5-1.6 3.8-2.4 3.8-2.3 7.5-4 11.7-5.5 2.3-.9 4.3-2 6.3-3.4 4.2-2.6 8.5-4.8 13-7 15.9-7.8 31.5-16.8 42.9-30.6.5-.6 1.1-1.1 1.6-1.7.7 0 1.3 0 2 0 .4-.8.4-.8.7-1.6 1.6-2.9 3.6-5.4 5.7-8 4.2-5.3 7.9-10.9 11.5-16.6.5-.7.9-1.5 1.4-2.2 12.3-20.4 10.9-44.8 7.4-67.5-.2-1.3-.4-2.6-.6-3.9-1.2-7.2-2.9-13.9-5.4-20.7C401 12 401 12 401 9c2.6.4 3.8.8 5.6 2.7 1.8 2.7 3.6 5.5 5.4 8.3.6.9.6.9 1.1 1.8 11.1 17.7 12.4 33.7 12.7 54.2.1 2.7.4 5.3.7 8 .4 3.5.2 5.8-1.4 9-1.4 3-2.6 6-3.6 9.2-1.7 5.1-3.9 9.9-6.2 14.7-.4.9-.9 1.8-1.3 2.7-6 12.3-12.1 24.7-19.6 36.1-2 3-3.7 6.1-5.5 9.2 4.7-1.4 7.4-4.2 10.6-7.8.8-.9.8-.9 1.6-1.7 5.7-6.1 10.8-12.7 15.9-19.4.7-.8 1.4-1.7 2.1-2.5 2-2.6 3.6-5.3 5.1-8.3.5-1 1-2 1.6-3 .4-.7.8-1.5 1.2-2.2.7 0 1.3 0 2 0 .4-1.1.4-1.1.9-2.2 4.7-11.5 11-25.4 19.1-34.8 1 0 2 0 3 0-2.4 24-9.5 49.4-24 69-1.1 1.7-2.3 3.3-3.4 5-1.2 1.7-2.4 3.3-3.6 5-.6.9-1.3 1.8-1.9 2.7-6.1 8.6-12.9 16.5-20.7 23.6-1.7 2.1-2.5 4.1-3.4 6.7 13.2-8.2 25.4-17.3 37.1-27.6 2.9-2.4 2.9-2.4 4.9-2.4.3-.6.5-1.2.8-1.8 1.4-2.5 2.9-3.9 5.1-5.7.7-.6 1.4-1.2 2.2-1.8.7-.6 1.3-1.1 2-1.7.9-.8 1.9-1.6 2.8-2.4 2.1-1.6 2.1-1.6 5.1-1.6-1.5 7.8-7.2 14.5-12.1 20.6-2.2 2.7-4.2 5.5-6.3 8.3-4.2 5.7-8.8 10.9-13.6 16.1-1 1-1 1-2 2.1-3.5 3.6-7.1 6.8-11 9.9-5.3 4.2-10.2 8.8-15.2 13.4-.8.7-1.5 1.4-2.3 2.2-.7.7-1.4 1.3-2.1 2-.6.6-1.3 1.2-1.9 1.8-1.6 1.5-1.6 1.5-2.5 3.6 13.8-1.9 26-8 37.5-15.7 2.5-1.3 2.5-1.3 6.5-1.3-.5 4.2-2.9 6.3-6 9-.7 0-1.3 0-2 0-.3 1-.7 2-1 3-1.7 1.6-3.5 3.1-5.4 4.6-1 .8-2 1.6-3 2.4-2.6 2-2.6 2-5.6 3-.3 1-.7 2-1 3-10 7.1-22.4 13.1-34 16.9-2.7 1.5-3.6 3.4-5 6.1 1.1-.4 2.2-.8 3.4-1.2 1.5-.5 3-1.1 4.5-1.6.8-.3 1.6-.6 2.4-.8 3.8-1.3 7.6-2.6 11.4-3.8 7.9-2.6 15.6-6 22.9-9.9 3.4-1.7 3.4-1.7 7.4-1.7-4 10.2-19 17.5-28 23-.8.5-1.7 1-2.6 1.6-3.4 2-6.8 3.6-10.5 4.9-.8.3-1.6.5-2.4.8-.8.3-1.7.5-2.5.8-3.4 1.1-6.9 2.3-10.3 3.4-1.3.4-1.3.4-2.7.9-.8.3-1.7.6-2.6.9-.8.3-1.5.5-2.3.8-2.6 1.3-4.2 2.9-6.1 5 9.3-.4 18.1-1.9 27.1-4.1 2.4-.6 4.8-1.1 7.1-1.7 1-.2 2.1-.5 3.1-.7 2.7-.6 2.7-.6 5.7-.6 0 1 0 2 0 3-15.6 8.1-31.6 16-48.7 20.4-3.7 1-6.4 2-9.3 4.6 8.2.3 16.2-.4 24.4-1.3 5.2-.5 10.3-.8 15.6-.7-1 3-1 3-2.7 4-.7.3-1.5.6-2.2.9-.8.3-1.7.7-2.5 1-.9.3-1.8.7-2.8 1-.9.4-1.9.7-2.8 1.1-13.8 5-28 8.2-42.6 9.4-3.8.3-6.9 1-10.4 2.6 13 .1 26-.3 39-1-.3 1-.7 2-1 3-2.5 1-4.9 1.8-7.4 2.5-.8.2-1.5.4-2.3.6-7.1 1.9-14.3 3.2-21.6 4.3-2.7.4-5.1.9-7.7 1.6 1 .6 1 .6 2 1.2 7.4 4.4 7.4 4.4 10.6 6.9 2.2 1.8 4.3 3 6.8 4.3 8.9 4.9 14.7 10.5 20.7 18.6.8 1 1.5 2.1 2.3 3.1 6.4 8.7 10.8 17.3 12.9 27.9 1.6 7.2 5.9 11.6 10.8 16.9 4 4.7 4 4.7 4 7 .7 0 1.3 0 2 0 0 1 0 2 0 3-3.9 1.8-6.9 2.2-11.1 2.2-1 0-2.1 0-3.1 0-2.9-.1-2.9-.1-5.9-1.1 4.7 8.4 10.5 13.3 19.1 17.5 8.1 1.4 13.8-.8 20.5-5.4 3.8-3.3 5.6-6.1 6.4-11.1 0-4.7-.4-9.3-1-14 3 1 3 1 4.6 3.6.8 1.6.8 1.6 1.6 3.2.5 1.1 1 2.1 1.6 3.2 3.4 7.7 3.9 18.3 1.2 26.4-5 10.9-13.2 17.2-24 21.6-13.3 4.7-26.6.9-38.9-5-1-.7-2-1.3-3-2 0-.7 0-1.3 0-2-.6-.3-1.2-.5-1.7-.8-2.4-1.3-4.3-2.8-6.3-4.6-.7-.6-1.3-1.2-2-1.8-4.4-4.3-5.9-8.3-7.6-14.1-.2-.7-.4-1.5-.7-2.3-.6-1.8-1.1-3.7-1.6-5.5-.8.8-1.6 1.6-2.4 2.4-3.7 3.7-6.4 5.8-11.6 5.9-3.3-.1-6-.8-9-2.3.4-.4.8-.8 1.2-1.3 7.2-8 11.4-17.2 11.1-28.2-.8-6.3-2.3-14-6.8-18.8-4.9-3.5-8.5-4.1-14.6-3.8-1.7.3-3.3.6-5 1-1.3 9.7-1.3 9.7 1 19 1 .3 2 .7 3 1 0 1.3 0 2.6 0 4-2.8 1.4-4.9 1.2-8 1-1.4-.6-2.7-1.3-4-2 .4 1 .4 1 .9 2.1.4.9.7 1.8 1.1 2.7.4.9.7 1.8 1.1 2.7.8 2.7.8 2.7.8 5.7-5.3.7-10.6 1.3-16 2 .7 1 1.3 2 2 3 0 1 0 2 0 3 .6.2 1.3.5 1.9.8 4.1 1.7 8.1 3.4 12.1 5.3 1.5.7 1.5.7 3.1 1.4 1.9 1.5 1.9 1.5 2.6 4.2-1.3 6-6 11.4-10.7 15.3-1 0-2 0-3 0 0-.8-.1-1.5-.1-2.3-.1-1-.1-2-.2-3 0-1-.1-2-.1-3-.2-.9-.4-1.7-.6-2.6-1.3-.7-2.6-1.3-4-2 .3 6.9.7 13.9 1 21 3.6.7 7.3 1.3 11 2 0 4 0 4-1.8 5.9-.8.6-1.6 1.2-2.4 1.8-.8.6-1.6 1.2-2.4 1.8-2.6 1.6-4.4 2.2-7.5 2.5-5.3-2-5.3-2-7.1-4.6-1.3-3.5-1.6-7.1-2-10.9-.1-.8-.2-1.5-.3-2.3-.4-3.8-.7-7.5-.6-11.3-3.6 1-3.6 1-5.9 3.6-.2 3.5.3 6.9.9 10.4-3.1-.5-6-1-9-2-2.4 2-2.4 2-2.2 5.6.1 4.2.6 8.2 1.2 12.4-3.3-.6-5.1-1.6-7.6-3.8-.6-.5-1.2-1-1.8-1.5-1.7-1.8-2.7-3.3-3.6-5.7.3-3.3.3-3.3 1-7 .4-2.3.7-4.7 1-7-.3-.3-.7-.7-1-1-.5-3.2-.7-5 0-8 3.9-4.9 9.4-8.3 15-11 1 0 2 0 3 0 1.5-4.3.8-7.7-.8-11.8-4.4-8-17-11.6-25.1-15.2-2.6 4-5.3 7.9-8 12 1.5.9 3 1.8 4.5 2.7 2.5 1.5 2.5 1.5 4.5 3.3.6 3.1.3 4.5-1.4 7.2-.9 1-.9 1-1.9 2-.6.7-1.2 1.3-1.8 2-2 1.8-3.4 2.9-5.9 3.8-1.3-.3-2.6-.7-4-1 .3-3 .7-5.9 1-9-2 .3-4 .7-6 1-.3 3.6-.7 7.3-1 11 1.7-.3 3.5-.7 5.3-1 3.4-.6 6.3-1 9.8-1-.6 3.4-1.5 4.8-4.3 6.9-2.5 2-4.4 3.9-6.3 6.6-.8.8-1.7 1.7-2.5 2.6-4.3 0-6.4-.6-10-3-1.3 2-2.6 4-4 6-1.4-.1-2.9-.2-4.3-.4-.8-.1-1.6-.1-2.4-.2-2.3-.5-2.3-.5-5.3-2.5.1-1 .2-1.9.3-2.9.1-1.3.2-2.5.3-3.8.1-1.3.2-2.5.4-3.8 0-3.4-.3-4.6-2-7.5 0-7.2 2.7-12.4 7-18 5.4-5 5.4-5 9-5-.3-2.3-.7-4.6-1-7-1.2.1-1.2.1-2.4.2-28.4 2.5-56.8 2.7-83.1-10-4.4-2.1-8.8-4.1-13.2-6.2-2.5-1.1-4.9-2.3-7.4-3.4-3.2-1.5-6.6-3.1-9.9-4.6-.9-.4-1.8-.8-2.8-1.3-10.8-4.7-18.2-2.5-28.9 1.7-2.2.8-4.4 1.6-6.6 2.5-1 .4-1.9.7-2.9 1.1-2.8 1-2.8 1-6.1 1.9-.9.3-1.8.7-2.7 1.1-2 6.1-1.1 12.7 0 19-10.8-1.3-20.7-8.1-28-16-3-4.2-3.7-8.2-3.6-13.3 1.1-5.3 4.4-9.4 7.6-13.7 2.3-3.4 2.2-4.5 2-8.5-.2-13.1 2.8-26.7 12-36.5 4.3-4.1 8.6-5.6 14.2-7.3 7.9-2.4 15.6-5 23.3-7.8 2.1-.8 4.2-1.5 6.3-2.2 13.6-5 25.9-10.2 36.2-20.7.7-.6 1.4-1.3 2.1-2 4.3-4.8 4.3-9.9 4.2-16-.7-7.1-4.2-11.2-9.3-16 0-.7 0-1.3 0-2-.8-.4-.8-.4-1.6-.8-2-1-3.9-2.1-5.9-3.3-7.4-4.2-14.8-3.5-22.8-1.4-1.5.4-1.5.4-3 .9-2.7.6-2.7.6-5.2-.1-3.9-.5-5.7 1.4-8.9 3.5-4.6 3.1-8 5.1-13.6 5.1-4-1.9-7.1-4.6-10-8-.5-3.3-.3-4.1 1-7 .7-1.9 1.5-3.7 2.2-5.6.4-1.1.9-2.3 1.4-3.4C49 180.3 50.7 126.4 34.7 77.2c-.6-1.9-1.2-3.9-1.8-5.9-3.6-11.8-9.2-22.7-14.7-33.7-1.1-2.5-2.2-5-3.2-7.6-1.2-2.3-2.5-4.6-3.8-6.8-.4-.6-.7-1.2-1.1-1.9-1.9-3.3-3.9-6.6-6-9.9C1.7 7.7 0 4.5 0 0Z" />
            </svg>
            <div style="pointer-events: none; margin-left: 3px;">
                <div style="font-size: 34px; color: var(--generic-white);">FALCON</div>
                <div style="color: var(--theme-primary); margin-top: -12px;">v1.0.0-pub</div>
            </div>
        `;

        const closeMenuButton = document.createElement("div");
        closeMenuButton.id = "closeMenuButton";
        closeMenuButton.innerHTML = `<i class="material-icons" style="color: var(--theme-secondary); font-size: 20px;">close</i>`;
        closeMenuButton.onclick = () => menuElement.style.display = "none";
        makeKeyboardClickable(closeMenuButton, "Close menu");
        headerElement.appendChild(closeMenuButton);

        const contentHolderElement = document.createElement("div");
        contentHolderElement.id = "contentHolderElement";
        menuElement.appendChild(contentHolderElement);

        const tabHolder = document.createElement("div");
        tabHolder.id = "tabHolder";
        this.tabHolder = tabHolder;
        contentHolderElement.appendChild(tabHolder);

        const contentElement = document.createElement("div");
        contentElement.id = "contentElement";
        this.contentElement = contentElement;
        contentHolderElement.appendChild(contentElement);

        const utilsHolder = document.createElement("div");
        utilsHolder.id = "utilsHolder";
        headerElement.appendChild(utilsHolder);

        const backwardButton = document.createElement("div");
        backwardButton.classList.add("arrowButton");
        backwardButton.innerHTML = `
            <span class="material-icons" style="font-size: inherit; color: inherit;">arrow_back_ios</span>
        `;

        const forwardButton = document.createElement("div");
        forwardButton.classList.add("arrowButton");
        forwardButton.innerHTML = `
            <span class="material-icons" style="font-size: inherit; color: inherit;">arrow_forward_ios</span>
        `;

        const utilsTitle = document.createElement("div");
        utilsTitle.classList.add("utilsTitle");

        this.backwardButton = backwardButton;
        this.forwardButton = forwardButton;
        this.utilsTitle = utilsTitle;

        makeKeyboardClickable(backwardButton, "Back");
        makeKeyboardClickable(forwardButton, "Forward");

        utilsHolder.appendChild(backwardButton);
        utilsHolder.appendChild(forwardButton);
        utilsHolder.appendChild(utilsTitle);

        backwardButton.onclick = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();

            if (!this.backwardStack.isEmpty()) {
                const prev = this.backwardStack.pop()!;
                if (this.currentItem) this.forwardStack.push(this.currentItem);
                this.goToItem(prev);
            }
        };

        forwardButton.onclick = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();

            if (!this.forwardStack.isEmpty()) {
                const next = this.forwardStack.pop()!;
                if (this.currentItem) this.backwardStack.push(this.currentItem);
                this.goToItem(next);
            }
        };

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                menuElement.style.display =
                    menuElement.style.display === "none" ? "block" : "none";
                if (this.selectedTab === 5) drawChatLog(Menu);
            }
        });

        this.updateUtilsBar(menuTabs[1]?.label);
        this.makeDraggable(menuElement, headerElement);
        this.buildItemMap();

        await this.loadSettings();
        this.loadFavorites();
        this.renderTabs();
    }

    static goToItem(stackItem: IMenuItem, items?: IMenuItem[], parentLabel: string = "", tabIndex: number = 0): boolean {
        if (!items) {
            let i = 0;

            if (this.isInFavoritesTab) {
                getElem(`menuTab:0`).click();
                return true;
            }

            for (const category of Object.values(menuContent)) {
                if (this.goToItem(stackItem, category as IMenuItem[], "", i)) return true;
                i++;
            }

            return false;
        }

        for (const item of items) {
            if (item === stackItem) {
                const title = parentLabel || menuTabs[tabIndex]?.label;
                this.updateUtilsBar(title);
                this.renderItems(items);
                this.currentItem = item;
                return true;
            }

            if (item.settings) {
                if (this.goToItem(stackItem, item.settings, item.type === "group" ? item.label : `${item.label} Settings`, tabIndex)) return true;
            }
        }

        return false;
    }

    static updateUtilsBar(title = "") {
        this.utilsTitle.innerText = title;

        if (this.backwardStack.isEmpty()) {
            this.backwardButton.style.color = "var(--generic-white-3)";
            this.backwardButton.style.pointerEvents = "none";
        } else {
            this.backwardButton.style.color = "var(--generic-white-2)";
            this.backwardButton.style.pointerEvents = "all";
        }

        if (this.forwardStack.isEmpty()) {
            this.forwardButton.style.color = "var(--generic-white-3)";
            this.forwardButton.style.pointerEvents = "none";
        } else {
            this.forwardButton.style.color = "var(--generic-white-2)";
            this.forwardButton.style.pointerEvents = "all";
        }
    }

    private static oldItems: IMenuItem[] = [];

    static renderItems(items: IMenuItem[], contentElement?: HTMLElement, tabIndex?: number, isNested: boolean = false) {
        // Nested calls draw dropdowns inside an outer render; time only the outer one.
        const drawStart = __DEV__ && !isNested ? profileStart() : 0;
        contentElement = contentElement ?? this.contentElement;
        contentElement.innerHTML = "";

        if (this.contentElement === contentElement) {
            for (const item of this.oldItems) item.update = undefined;
            this.oldItems = items; // This will help with the GC
        }

        if (items.length) {
            for (const item of items) {
                if (item.type === "toggle") drawMenuToggle(item, contentElement, isNested, Menu);
                else if (item.type === "select") drawMenuSelect(item, contentElement, Menu);
                else if (item.type === "slider") drawMenuSlider(item, contentElement, Menu);
                else if (item.type === "paragraph") drawMenuParagraph(item, contentElement);
                else if (item.type === "group") drawMenuGroup(item, contentElement, Menu);
                else if (item.type === "number") drawNumberInput(item, contentElement, Menu);
                else if (item.type === "chat-log") drawChatLog(Menu);
                else if (item.type === "config-ui") drawConfigUI(Menu);
                else if (item.type === "saved-configs") drawSavedConfigs(Menu);
            }
        } else {
            const noItemsElem = document.createElement("div");
            noItemsElem.classList.add("noTabTtems");
            noItemsElem.innerHTML = tabIndex === 0 ? "You haven't favorited any toggles just yet." : "There are no items in this tab yet.<br>Please check back in a future update.";
            contentElement.appendChild(noItemsElem);
        }

        if (__DEV__ && !isNested) profileEnd("menu", drawStart);
    }

    static selectedTab = 1;
    static isInFavoritesTab = false;

    static renderTabs() {
        const tabHolder = this.tabHolder;

        for (const [i, tab] of menuTabs.entries()) {

            const tabElem = document.createElement("div");
            tabElem.id = `menuTab:${i}`;
            tabElem.classList.add("menuTab");
            tabElem.innerHTML = `
                ${tab.icon.replace(/REPLACE_WITH_COLOR/g, "var(--generic-white)")}
                ${tab.label}
            `;

            makeKeyboardClickable(tabElem, tab.label, "tab");

            tabElem.onclick = () => {
                // Clicks from code (startup, refreshing favorites) always target the selected
                // tab, so only a switch to another tab needs the old one un-highlighted. (Keyboard clicks are
                // not isTrusted, which this used to check.)
                if (this.selectedTab !== i) {
                    const oldElem = getElem(`menuTab:${this.selectedTab}`);
                    const oldTab = menuTabs[this.selectedTab];

                    oldElem.classList.remove("activeTab");
                    if (oldTab) oldElem.innerHTML = `
                        ${oldTab.icon.replace(/REPLACE_WITH_COLOR/g, "var(--generic-white)")}
                        ${oldTab.label}
                    `;
                    this.selectedTab = i;
                }

                tabElem.classList.add("activeTab");
                tabElem.innerHTML = `
                    ${tab.icon.replace(/REPLACE_WITH_COLOR/g, "var(--theme-primary)")}
                    ${tab.label}
                `;

                const key = tab.label.toLowerCase() as keyof typeof menuContent;

                if (i === 0) {
                    const favoriteItems = [];

                    for (const item of Object.values(this.itemMap)) {
                        if (!item.isFavorited) continue;
                        favoriteItems.push(item);
                    }

                    this.renderItems(favoriteItems, undefined, i);
                    this.isInFavoritesTab = true;
                    this.currentItem = favoriteItems[0];
                } else {
                    this.renderItems(menuContent[key]);
                    this.currentItem = menuContent[key][0];
                    this.isInFavoritesTab = false;
                }

                this.backwardStack.clear();
                this.forwardStack.clear();
                this.updateUtilsBar(tab.label);
            };

            tabHolder.appendChild(tabElem);
        }

        getElem(`menuTab:1`).click();
    }

    static makeDraggable(menu: HTMLElement, handle: HTMLElement) {
        let offsetX = 0;
        let offsetY = 0;
        let isDragging = false;

        handle.addEventListener("mousedown", (e) => {
            isDragging = true;

            menu.style.transform = "none";

            const rect = menu.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            e.preventDefault();

            menu.style.left = `${e.clientX - offsetX}px`;
            menu.style.top = `${e.clientY - offsetY}px`;
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            document.body.style.userSelect = "";
        });
    }
}