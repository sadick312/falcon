/**
 * Parses a JSON value from localStorage. Returns `fallback` when the key is missing, storage can't be
 * read, or the value isn't valid JSON, so one corrupt entry can't stop the menu from loading.
 */
export default function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch (err) {
        console.warn(`[Falcon] Ignoring unreadable localStorage value '${key}'.`, err);
        return fallback;
    }
}
