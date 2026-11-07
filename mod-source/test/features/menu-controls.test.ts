// Features #61 Menu controls (toggle, slider, select, number, group, paragraph, label, body) and #62 Chat log
// (drawChatLog): a toggle click flips its setting, saves it and runs its update hook; the chat log shows the last 500
// entries as text, adding one row at a time while the console tab is open.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, startGame } from "../helpers/game";

let game: Game | undefined;
afterEach(() => game?.done());

describe("Menu controls", () => {
    it("flip and save a toggle on click", async () => {
        game = await startGame({ enable: ["autoSaveSettings"] });
        const { default: Menu, menuContent } = await import("@menu/Menu");
        const item = menuContent.combat.find(i => i.type === "toggle" && i.id)!;
        const container = document.createElement("div");
        Menu.renderItems([item], container);
        const before = !!item.status;
        container.querySelector<HTMLElement>(".menuToggle .menuToggle")!.click();
        expect(Menu.getValue(item.id)).toBe(!before);
        expect(JSON.parse(localStorage.getItem("falcon-settings")!)[item.id]).toBe(!before);
    });
});

describe("Chat log", () => {
    it("keeps the last 500 entries, as text", async () => {
        game = await startGame();
        const { default: Menu, ChatLog } = await import("@menu/Menu");
        const { addChatLog } = await import("@menu/utils/drawChatLog");
        Menu.chatLogs.length = 0;
        for (let i = 0; i < 510; i++) addChatLog(new ChatLog(`<b>${i}</b>`));
        expect(Menu.chatLogs.length).toBe(500);
        expect(Menu.chatLogs[0].msg).toBe("<b>10</b>");
    });
});

type Item = import("@menu/Menu").IMenuItem;

/** Renders one setting into a fresh container (as the menu does) and returns both. */
async function render(type: "select" | "slider" | "number", pick?: (item: Item) => boolean) {
    game = await startGame({ enable: ["autoSaveSettings"] });
    const { default: Menu } = await import("@menu/Menu");
    const item = Object.values(Menu.itemMap).find(i => i.type === type && i.id && (pick?.(i) ?? true))!;
    const container = document.createElement("div");
    Menu.renderItems([item], container);
    return { Menu, item, container };
}

const saved = () => JSON.parse(localStorage.getItem("falcon-settings") ?? "{}");

describe("Menu controls: select", () => {
    it("lists its options with the current one selected", async () => {
        const { item, container } = await render("select");
        const select = container.querySelector<HTMLSelectElement>("select.menuSelector")!;
        expect([...select.options].map(o => o.value)).toEqual(item.options!.map(o => String(o.value)));
        expect(select.value).toBe(String(item.status));
        expect(select.getAttribute("aria-label")).toBe(item.label);
    });

    it("saves a new choice", async () => {
        const { Menu, item, container } = await render("select");
        const select = container.querySelector<HTMLSelectElement>("select.menuSelector")!;
        const other = [...select.options].find(o => o.value !== select.value)!;
        select.value = other.value;
        select.dispatchEvent(new Event("change"));
        expect(String(Menu.getValue(item.id))).toBe(other.value);
        expect(String(saved()[item.id])).toBe(other.value);
    });
});

describe("Menu controls: slider", () => {
    it("uses the setting's range and shows its value", async () => {
        const { item, container } = await render("slider", i => typeof i.max === "number");
        const slider = container.querySelector<HTMLInputElement>("input.menuSlider")!;
        expect(slider.type).toBe("range");
        expect(slider.max).toBe(String(item.max));
        if (typeof item.min === "number") expect(slider.min).toBe(String(item.min));
        expect(slider.value).toBe(String(item.status));
    });

    it("saves and shows a new value as it moves", async () => {
        const { Menu, item, container } = await render("slider", i => typeof i.max === "number");
        const slider = container.querySelector<HTMLInputElement>("input.menuSlider")!;
        const display = slider.nextElementSibling as HTMLElement;
        slider.value = String(item.max);
        slider.dispatchEvent(new Event("input"));
        expect(Menu.getValue(item.id)).toBe(String(item.max));
        expect(display.innerText).toBe(String(item.max));
        expect(saved()[item.id]).toBe(String(item.max));
    });
});

describe("Menu controls: number box", () => {
    it("updates its setting as you type", async () => {
        const { Menu, item, container } = await render("number");
        const input = container.querySelector<HTMLInputElement>("input.menuNumberInput")!;
        expect(input.value).toBe(String(item.status));
        input.value = "7";
        input.dispatchEvent(new Event("input"));
        expect(Menu.getValue(item.id)).toBe("7");
    });

    it("doesn't save player numbers (Sync With, Follow), which change every game", async () => {
        const { Menu, item, container } = await render("number", i => !!i.neverSave);
        const input = container.querySelector<HTMLInputElement>("input.menuNumberInput")!;
        input.value = "12";
        input.dispatchEvent(new Event("input"));
        expect(Menu.getValue(item.id)).toBe("12");
        expect(saved()[item.id]).toBeUndefined();
    });

    it("keeps Enter in the box instead of letting it reach the game", async () => {
        const { container } = await render("number");
        const input = container.querySelector<HTMLInputElement>("input.menuNumberInput")!;
        document.body.appendChild(container);
        const enter = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
        let reachedDocument = false;
        const listener = () => { reachedDocument = true; };
        document.addEventListener("keydown", listener);
        input.dispatchEvent(enter);
        document.removeEventListener("keydown", listener);
        container.remove();
        expect(reachedDocument).toBe(false);
    });
});

describe("Menu controls: every select, slider and number box saves and loads", () => {
    it("changes each one through its control, reloads the menu, and gets the same value back (player numbers reset)", async () => {
        game = await startGame({ enable: ["autoSaveSettings"] });
        const { default: Menu } = await import("@menu/Menu");
        const items = Object.values(Menu.itemMap).filter(i => i.id && (i.type === "select" || i.type === "slider" || i.type === "number"));
        const defaults = Object.fromEntries(items.map(i => [i.id, String(i.status)]));
        expect(items.length).toBeGreaterThan(5);

        const expected: Record<string, string> = {};
        for (const item of items) {
            const container = document.createElement("div");
            Menu.renderItems([item], container);
            const select = container.querySelector<HTMLSelectElement>("select.menuSelector");
            const input = container.querySelector<HTMLInputElement>("input.menuSlider, input.menuNumberInput");
            if (select) {
                const other = [...select.options].find(o => o.value !== select.value) ?? select.options[0];
                select.value = other.value;
                select.dispatchEvent(new Event("change"));
                expected[item.id] = item.neverSave ? defaults[item.id] : other.value;
            } else if (input) {
                const value = typeof item.max === "number" ? String(item.max) : typeof item.min === "number" ? String(item.min) : "3";
                input.value = value;
                input.dispatchEvent(new Event("input"));
                expected[item.id] = item.neverSave ? defaults[item.id] : value;
            }
        }

        const stored = localStorage.getItem("falcon-settings");
        vi.resetModules();
        localStorage.setItem("falcon-settings", stored!);
        const { default: Reloaded } = await import("@menu/Menu");
        await Reloaded.init();

        const back = Object.fromEntries(Object.keys(expected).map(id => [id, String(Reloaded.getValue(id))]));
        const diff = Object.keys(expected).filter(id => back[id] !== expected[id]).map(id => `${id}: set ${expected[id]} got ${back[id]}`);
        expect(diff).toEqual([]);
    });
});

describe("Config screen", () => {
    async function configScreen() {
        game = await startGame({ enable: ["autoSaveSettings"] });
        const { default: Menu, menuContent } = await import("@menu/Menu");
        Menu.renderItems(menuContent.configs);
        const root = Menu.contentElement;
        const button = (label: string) => [...root.querySelectorAll<HTMLElement>(".menuConfigUIButton")].find(b => b.textContent === label)!;
        return { Menu, root, button, nameInput: root.querySelector<HTMLInputElement>(".menuConfigUIInput")! };
    }

    it("Save stores the current settings under the typed name, and does nothing without a name", async () => {
        const { Menu, button, nameInput } = await configScreen();
        button("Save").click();
        expect(localStorage.getItem("falcon-configs")).toBeNull();

        nameInput.value = "my fights";
        button("Save").click();
        const configs = JSON.parse(localStorage.getItem("falcon-configs")!);
        expect(Object.keys(configs)).toEqual(["my fights"]);
        expect(configs["my fights"]).toEqual(Menu.collectSettings());
    });

    it("Export downloads falcon-settings.json and says so", async () => {
        const { root, button } = await configScreen();
        const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => { });
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });
        button("Export").click();
        expect(create).toHaveBeenCalledTimes(1);
        expect(click).toHaveBeenCalledTimes(1);
        expect(root.querySelector(".menuConfigUIStatus")!.textContent).toMatch(/falcon-settings\.json/);
    });

    it("Import applies a settings file and reports what it did, or why it couldn't", async () => {
        const { Menu, root } = await configScreen();
        const fileInput = root.querySelector<HTMLInputElement>('input[type="file"]')!;
        const choose = async (content: string) => {
            const file = new File([content], "settings.json", { type: "application/json" });
            Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
            await (fileInput.onchange as unknown as () => Promise<void>)();
            return Menu.contentElement.querySelector(".menuConfigUIStatus")!.textContent;
        };

        const id = Object.values(Menu.itemMap).find(i => i.type === "toggle" && i.id && i.id !== "autoSaveSettings")!.id;
        const target = !Menu.getValue(id);
        expect(await choose(JSON.stringify({ [id]: target, notASetting: 1 }))).toMatch(/^Imported 1 setting, skipped 1/);
        expect(Menu.getValue(id)).toBe(target);

        expect(await choose("{oops")).toMatch(/isn't JSON/);
        expect(await choose("[1, 2]")).toMatch(/expected an object/);
    });
});
