import readJson from "@utils/storage/readJson";
import shortnameToUnicode from "@utils/text/shortnameToUnicode";
import { describe, expect, it, vi } from "vitest";

describe("shortnameToUnicode", () => {
    it("converts known shortnames and leaves everything else alone", () => {
        expect(shortnameToUnicode(":smile: hi :thumbsup:")).toBe("😄 hi 👍");
        expect(shortnameToUnicode(":not_an_emoji: and plain text")).toBe(":not_an_emoji: and plain text");
        expect(shortnameToUnicode("")).toBe("");
    });

    it("is case-sensitive and skips text inside the tags emojione skipped", () => {
        expect(shortnameToUnicode(":SMILE:")).toBe(":SMILE:");
        expect(shortnameToUnicode("<span>:smile:</span>")).toBe("<span>:smile:</span>");
    });
});

describe("readJson", () => {
    it("returns the parsed value", () => {
        localStorage.setItem("k", JSON.stringify({ a: 1 }));
        expect(readJson("k", {})).toEqual({ a: 1 });
    });

    it("falls back for missing, empty and corrupt values", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        expect(readJson("missing", "fb")).toBe("fb");
        localStorage.setItem("empty", "");
        expect(readJson("empty", "fb")).toBe("fb");
        localStorage.setItem("bad", "{oops");
        expect(readJson("bad", "fb")).toBe("fb");
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("falls back when storage itself throws", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        expect(readJson("k", 42)).toBe(42);
    });
});
