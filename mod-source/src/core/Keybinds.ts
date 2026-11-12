import readStoredJSON from "@utils/storage/readStoredJSON";

/**
 * Every rebindable key in one place. Bindings are KeyboardEvent.code values ("KeyR", "Space",
 * "ShiftLeft"), optionally prefixed with "Shift+", or mouse buttons ("Mouse0" = left click).
 * An empty string means "unbound" (the action is disabled).
 *
 * - "press" actions fire once on keydown (or mouse release).
 * - "hold" actions are active while the key is held (checked every tick).
 *
 * Movement (WASD / arrows) and hotbar slots (1-9) stay fixed, like in the normal game.
 */
export type KeybindMode = "press" | "hold";

export interface KeybindAction {
    id: string;
    label: string;
    category: "Combat" | "Placement" | "Utility";
    description: string;
    mode: KeybindMode;
    defaultKey: string;
}

export const KEYBIND_ACTIONS: KeybindAction[] = [
    { id: "tankSpam", label: "Toggle Attacking (Tank Gear)", category: "Combat", mode: "press", defaultKey: "Mouse0", description: "Starts/stops attacking with Tank Gear and the best weapon." },
    { id: "bullSpam", label: "Bull Spam", category: "Combat", mode: "hold", defaultKey: "Space", description: "Hold to attack with Bull Helmet and your primary." },
    { id: "autoInsta", label: "Insta Now (ATOS)", category: "Combat", mode: "press", defaultKey: "KeyR", description: "Arms an insta-kill on the nearest enemy as soon as it can land (expires after ~3 s; press again to cancel)." },
    { id: "oneTickMode", label: "One Tick: Active/Passive", category: "Combat", mode: "press", defaultKey: "KeyT", description: "Switches Dynamic One Tick between active and passive (needs Dynamic One Tick on)." },
    { id: "override", label: "Override Automation", category: "Combat", mode: "hold", defaultKey: "ShiftLeft", description: "Hold to pause auto-push, auto-movement and auto-break aiming; with Tank attacking, uses your primary." },
    { id: "eat", label: "Eat", category: "Placement", mode: "hold", defaultKey: "KeyQ", description: "Hold to eat your food item." },
    { id: "placeTrap", label: "Place Trap / Slot 5", category: "Placement", mode: "hold", defaultKey: "KeyF", description: "Hold to place the item in your 5th slot (usually Pit Trap)." },
    { id: "placeSpike", label: "Place Spike", category: "Placement", mode: "hold", defaultKey: "KeyV", description: "Hold to place your spike." },
    { id: "place7th", label: "Place 7th Slot Item", category: "Placement", mode: "hold", defaultKey: "KeyH", description: "Hold to place your 7th slot item (set in Utility > Auto Upgrade)." },
    { id: "placeSpawnPads", label: "Place 4 Spawn Pads", category: "Placement", mode: "hold", defaultKey: "KeyK", description: "Hold to place spawn pads around you." },
    { id: "autoMill", label: "Toggle Auto Mill", category: "Placement", mode: "press", defaultKey: "KeyZ", description: "Starts/stops automatically placing windmills behind you." },
    { id: "autoGather", label: "Toggle Auto Gather", category: "Utility", mode: "press", defaultKey: "KeyE", description: "The game's auto-gather/auto-hit toggle." },
    { id: "resetZoom", label: "Reset Zoom", category: "Utility", mode: "press", defaultKey: "Equal", description: "Back to the default View Distance (125%)." },
    { id: "zoomOut", label: "Zoom Out (See More)", category: "Utility", mode: "press", defaultKey: "Minus", description: "Raises View Distance by 5% (up to 250%). Saved." },
    { id: "zoomIn", label: "Zoom In (See Less)", category: "Utility", mode: "press", defaultKey: "Shift+Equal", description: "Lowers View Distance by 5% (down to 75%). Saved." },
    { id: "reloadSprites", label: "Reload Item Sprites", category: "Utility", mode: "press", defaultKey: "Shift+KeyZ", description: "Redraws item icons if they look wrong." },
    { id: "chat", label: "Chat", category: "Utility", mode: "press", defaultKey: "Enter", description: "Open/send chat." },
    { id: "replayPause", label: "Pause Packet Replay", category: "Utility", mode: "press", defaultKey: "KeyP", description: "Pauses/resumes the packet replayer." },
];

const STORAGE_KEY = "falcon-keybinds";

export default class Keybinds {
    private static bindings: Record<string, string> = {};
    /** True while the menu waits for the user to press a new key; actions must not fire then. */
    static isCapturing = false;

    static load() {
        const saved = readStoredJSON<Record<string, string>>(STORAGE_KEY, {});
        for (const action of KEYBIND_ACTIONS) {
            this.bindings[action.id] = typeof saved[action.id] === "string" ? saved[action.id] : action.defaultKey;
        }
    }

    static save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
        } catch (error) {
            console.warn("[Falcon] Could not save keybinds.", error);
        }
    }

    static get(id: string) {
        return this.bindings[id] ?? "";
    }

    static set(id: string, binding: string) {
        this.bindings[id] = binding;
        this.save();
    }

    static resetAll() {
        for (const action of KEYBIND_ACTIONS) this.bindings[action.id] = action.defaultKey;
        this.save();
    }

    /** Ids of other actions bound to the same key (so the menu can warn about conflicts). */
    static conflictsWith(id: string) {
        const binding = this.get(id);
        if (!binding) return [];
        return KEYBIND_ACTIONS.filter(a => a.id !== id && this.get(a.id) === binding).map(a => a.id);
    }

    /** Builds a binding string from a keyboard event ("Shift+KeyZ" when Shift is held with another key). */
    static fromKeyEvent(event: KeyboardEvent) {
        const isShiftKey = event.code === "ShiftLeft" || event.code === "ShiftRight";
        return event.shiftKey && !isShiftKey ? `Shift+${event.code}` : event.code;
    }

    /** Does this keydown trigger the "press" action `id`? */
    static matches(event: KeyboardEvent, id: string) {
        if (this.isCapturing) return false;
        const binding = this.get(id);
        if (!binding || binding.startsWith("Mouse")) return false;

        if (binding.startsWith("Shift+")) return event.shiftKey && event.code === binding.slice(6);
        if (event.code !== binding) return false;

        // Shift + key belongs to the "Shift+" action when one exists (Shift+= zooms in, it must not
        // also reset the zoom on "="). Without such an action, plain keys still work with Shift held.
        return !(event.shiftKey && this.hasPressBinding(`Shift+${event.code}`));
    }

    private static hasPressBinding(binding: string) {
        for (const action of KEYBIND_ACTIONS) {
            if (action.mode === "press" && this.bindings[action.id] === binding) return true;
        }
        return false;
    }

    /** Does this mouse event's button trigger action `id`? */
    static matchesMouse(event: MouseEvent, id: string) {
        if (this.isCapturing) return false;
        return this.get(id) === `Mouse${event.button}`;
    }

    /** Is the "hold" action `id` currently held? `keys` is Input.keys (KeyboardEvent.code -> down). */
    static isHeld(id: string, keys: Record<string | number, boolean>) {
        if (this.isCapturing) return false;
        const binding = this.get(id);
        if (!binding || binding.startsWith("Mouse")) return false;
        if (binding.startsWith("Shift+")) return !!(keys["ShiftLeft"] || keys["ShiftRight"]) && !!keys[binding.slice(6)];
        return !!keys[binding];
    }

    /** Human-readable name for a binding, e.g. "Shift + Z", "Left Click", "Space". */
    static describe(binding: string) {
        if (!binding) return "None";
        const names: Record<string, string> = { Mouse0: "Left Click", Mouse1: "Middle Click", Mouse2: "Right Click", Equal: "=", Minus: "-", ShiftLeft: "Left Shift", ShiftRight: "Right Shift", ControlLeft: "Left Ctrl", AltLeft: "Left Alt", Backquote: "`" };
        return binding.split("+").map(part => names[part] ?? part.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Arrow/, "Arrow ")).join(" + ");
    }
}

Keybinds.load();
