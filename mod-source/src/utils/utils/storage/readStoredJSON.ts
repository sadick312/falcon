/** Reads JSON from localStorage; returns the fallback if it's missing or damaged (never throws). */
export default function readStoredJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return (JSON.parse(raw) as T) ?? fallback;
    } catch (error) {
        console.warn(`[Falcon] Saved data "${key}" was unreadable; using defaults.`, error);
        return fallback;
    }
}
