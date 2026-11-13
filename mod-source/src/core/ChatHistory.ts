/**
 * Messages you sent, for Up/Down arrows in the chat box (like a terminal).
 * Up = older message, Down = newer; going past the newest gives back what you were typing.
 * Kept in memory only (cleared on page reload).
 */
export default class ChatHistory {
    static readonly MAX = 30;

    private entries: string[] = [];
    /** entries.length = "not browsing" (the line you're typing). */
    private index = 0;
    private draft = "";

    add(message: string) {
        const text = message.trim();
        if (text && this.entries[this.entries.length - 1] !== text) {
            this.entries.push(text);
            if (this.entries.length > ChatHistory.MAX) this.entries.shift();
        }
        this.resetBrowsing();
    }

    /** Call when the chat box opens. */
    resetBrowsing() {
        this.index = this.entries.length;
        this.draft = "";
    }

    /** Arrow Up: returns the text to show, or null if there's nothing older. */
    older(current: string): string | null {
        if (this.index === 0) return null;
        if (this.index === this.entries.length) this.draft = current;
        this.index--;
        return this.entries[this.index];
    }

    /** Arrow Down: returns the text to show, or null if already at the line being typed. */
    newer(): string | null {
        if (this.index >= this.entries.length) return null;
        this.index++;
        return this.index === this.entries.length ? this.draft : this.entries[this.index];
    }

    get size() {
        return this.entries.length;
    }
}

/** Quick chat: at most one message per this many ms, so mashing a key can't spam the server. */
export const QUICK_CHAT_COOLDOWN_MS = 1000;

export function canQuickChat(now: number, lastSent: number) {
    return now - lastSent >= QUICK_CHAT_COOLDOWN_MS;
}
