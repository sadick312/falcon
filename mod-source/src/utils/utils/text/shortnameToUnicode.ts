import shortnames from "./emojiShortnames.json";

/**
 * Same output as emojione.shortnameToUnicode (emojione@4.5.0, ascii smileys off), without the
 * 640 KB library. emojiShortnames.json lists emojione's shortnames in its match order; names
 * mapped to "" are ones emojione matches but leaves as typed.
 */
const table = shortnames as Record<string, string>;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// emojione skips text inside these tags; the alternation order matches its regShortNames.
const pattern = new RegExp(
    "<object[^>]*>.*?<\\/object>|<span[^>]*>.*?<\\/span>|<(?:object|embed|svg|img|div|span|p|a)[^>]*>|("
    + Object.keys(table).map(escapeRegExp).join("|") + ")",
    "gi"
);

export default function shortnameToUnicode(text: string): string {
    return text.replace(pattern, (match) => table[match] || match);
}
