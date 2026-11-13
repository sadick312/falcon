/**
 * Settings export / import / reset (Menu > Configs). No DOM here, so it can be unit tested.
 *
 * Export text looks like: {"falcon":1,"settings":{...},"keybinds":{...}}
 * Import accepts that, or a plain {"settingId": value} object (an old saved config).
 * Only known settings with a sensible value are applied; everything else is skipped and counted,
 * so a broken or old text can never put the menu in a bad state.
 */
export interface SettingSchema {
    /** The default value (from the menu definition). */
    def: unknown;
    /** For dropdowns: the allowed values, as strings. */
    options?: string[];
}

export interface ImportResult {
    settings: Record<string, unknown>;
    keybinds: Record<string, string> | null;
    applied: number;
    skipped: number;
}

export const EXPORT_VERSION = 1;

/** Is `value` OK for a setting with this schema? */
export function isValidValue(schema: SettingSchema, value: unknown) {
    if (typeof schema.def === "boolean") return typeof value === "boolean";
    if (typeof value !== "string" && typeof value !== "number") return false;
    if (typeof value === "number" && !isFinite(value)) return false;
    if (schema.options) return schema.options.includes(String(value));
    return true;
}

export function exportSettingsText(settings: Record<string, unknown>, keybinds: Record<string, string>) {
    return JSON.stringify({ falcon: EXPORT_VERSION, settings, keybinds });
}

/** Throws an Error with a short, readable message when the text can't be used at all. */
export function parseSettingsText(text: string, schema: Record<string, SettingSchema>, keybindIds: readonly string[]): ImportResult {
    let data: unknown;
    try {
        data = JSON.parse(text.trim());
    } catch {
        throw new Error("That text isn't valid settings (paste the whole exported text).");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("That text isn't valid settings.");
    }

    const wrapped = (data as { falcon?: unknown }).falcon !== undefined;
    const rawSettings = wrapped ? (data as { settings?: unknown }).settings : data;
    const rawKeybinds = wrapped ? (data as { keybinds?: unknown }).keybinds : undefined;

    const result: ImportResult = { settings: {}, keybinds: null, applied: 0, skipped: 0 };

    if (rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)) {
        for (const [id, value] of Object.entries(rawSettings)) {
            const entry = schema[id];
            if (entry && isValidValue(entry, value)) {
                result.settings[id] = value;
                result.applied++;
            } else {
                result.skipped++;
            }
        }
    }

    if (rawKeybinds && typeof rawKeybinds === "object" && !Array.isArray(rawKeybinds)) {
        const keybinds: Record<string, string> = {};
        for (const [id, key] of Object.entries(rawKeybinds)) {
            if (keybindIds.includes(id) && typeof key === "string" && key.length <= 40) {
                keybinds[id] = key;
                result.applied++;
            } else {
                result.skipped++;
            }
        }
        result.keybinds = keybinds;
    }

    if (result.applied === 0) throw new Error("No Falcon settings found in that text.");
    return result;
}
