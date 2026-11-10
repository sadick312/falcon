// Startup check: which game version the replaced page ran, and the console message about it.
import { checkGameVersion, readGameVersion } from "@core/utils/GameVersionCheck";
import { describe, expect, it, vi } from "vitest";

/** The two version markers as they appear in sandbox.moomodding.io's v1.8.2 page (saved 31 Oct 2026). */
const PAGE_182 = `<head><base href="/1.8.2/"><script>fields.app_version = '1.8.2';</script></head>`;

describe("readGameVersion", () => {
    it("reads the version from the page's <base href>", () => {
        expect(readGameVersion(PAGE_182)).toBe("1.8.2");
        expect(readGameVersion(`<base href='/1.9.3/'>`)).toBe("1.9.3");
    });

    it("falls back to app_version when there is no <base>", () => {
        expect(readGameVersion(`<script>fields.app_version = '1.8.4';</script>`)).toBe("1.8.4");
    });

    it("recognises the site's current page by its /assets/bundle.js script (checked to be 1.8.2)", () => {
        // As served by sandbox.moomodding.io on 10 Nov 2026 (/1.8.2/ redirects here).
        const current = `<head><base href="/"></head><body><script src="/assets/bundle.js?v=1794217302"></script></body>`;
        expect(readGameVersion(current)).toBe("1.8.2");
        expect(readGameVersion(`<script src="/assets/bundle.js"></script>`)).toBe("1.8.2");
        // Other bundles, or the name only in text, don't count.
        expect(readGameVersion(`<script src="/assets/bundle.jsx"></script>`)).toBeNull();
        expect(readGameVersion(`<script src="/js/other/assets/bundle.js"></script>`)).toBeNull();
        expect(readGameVersion(`<p>/assets/bundle.js</p>`)).toBeNull();
    });

    it("prefers an explicit version over the bundle script", () => {
        expect(readGameVersion(`<base href="/1.9.0/"><script src="/assets/bundle.js"></script>`)).toBe("1.9.0");
    });

    it("returns null for a page without either marker", () => {
        expect(readGameVersion("<html><body>Loading...</body></html>")).toBeNull();
        expect(readGameVersion(`<base href="/assets/">`)).toBeNull();
    });
});

describe("checkGameVersion", () => {
    it("says the version is supported on a v1.8.2 page", () => {
        const info = vi.spyOn(console, "info").mockImplementation(() => { });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
        expect(checkGameVersion(PAGE_182, "moomodding")).toBe("1.8.2");
        expect(info).toHaveBeenCalledWith(expect.stringContaining("v1.8.2 (supported)"));
        expect(warn).not.toHaveBeenCalled();
    });

    it("warns clearly when the page runs another version", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
        expect(checkGameVersion(`<base href="/1.9.0/">`, "moomodding")).toBe("1.9.0");
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/runs MooMoo\.io v1\.9\.0, but Falcon supports v1\.8\.2/));
    });

    it("warns when the version can't be read", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
        expect(checkGameVersion(undefined, "moomodding")).toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Could not read the game version"));
    });

    it("stays quiet on the official sandbox, which always runs its current version", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
        const info = vi.spyOn(console, "info").mockImplementation(() => { });
        expect(checkGameVersion(`<base href="/1.8.2/">`, "moomoo-sandbox")).toBeNull();
        expect(warn).not.toHaveBeenCalled();
        expect(info).not.toHaveBeenCalled();
    });
});
