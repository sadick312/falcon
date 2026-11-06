// Versioning and validation of saved settings ("falcon-settings" and saved configs).
import { IMenuItem } from "./types";

/**
 * Format version of saved settings ("falcon-settings" and each saved config), stored under SETTINGS_VERSION_KEY.
 * When a setting's id or kind of value changes, bump this and add a step to SETTINGS_MIGRATIONS.
 */
export const SETTINGS_VERSION = 1;
export const SETTINGS_VERSION_KEY = "__version";

/** SETTINGS_MIGRATIONS[n] upgrades settings saved at version n to version n + 1, in place. */
const SETTINGS_MIGRATIONS: Record<number, (data: Record<string, unknown>) => void> = {
    // Version 0: saved before versioning existed. Same ids and kinds of values as version 1.
    0: () => { }
};

/** A copy of saved settings upgraded to SETTINGS_VERSION, without the version key. Non-objects become {}. */
export function migrateSettings(saved: unknown): Record<string, unknown> {
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

    const data: Record<string, unknown> = { ...saved };
    const savedVersion = data[SETTINGS_VERSION_KEY];
    delete data[SETTINGS_VERSION_KEY];

    // Settings from a newer Falcon load as they are: unknown ids and misfitting values are skipped anyway.
    let version = typeof savedVersion === "number" ? savedVersion : 0;
    for (; version < SETTINGS_VERSION; version++) SETTINGS_MIGRATIONS[version]?.(data);

    return data;
}

/**
 * Whether a saved value is one the menu itself could have stored for this setting. Sliders and number inputs
 * hold a number until edited, then the input's text; selects hold an option's value or its text.
 */
export function isValidSettingValue(item: IMenuItem, value: unknown) {
    switch (item.type) {
        case "toggle":
            return typeof value === "boolean";
        case "slider":
        case "number":
            return (typeof value === "number" || typeof value === "string") && value !== "" && Number.isFinite(Number(value));
        case "select":
            return item.options?.some(option => String(option.value) === String(value)) ?? false;
        default:
            return true;
    }
}
