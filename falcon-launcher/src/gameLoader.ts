// The page-side loader steps, shared by the extension (background.ts passes these to
// chrome.scripting.executeScript) and the Quick Inject build (mod-source/packaging/build-inject.mjs
// embeds their source). Both serialize the functions, so they must not use anything outside their own body.

/**
 * Replaces the page with Falcon's HTML and CSS. With `loadTurnstile`, also loads Cloudflare Turnstile and
 * resolves once it has loaded or failed to; without it, resolves straight away.
 */
export function prepareGamePage(htmlContent: string, cssContent: string, loadTurnstile: boolean) {
    window.oldHTML = document.documentElement.innerHTML;
    document.documentElement.innerHTML = htmlContent;

    const styleElement = document.createElement("style");
    styleElement.textContent = cssContent;
    document.head.appendChild(styleElement);

    if (!loadTurnstile) return Promise.resolve();

    return new Promise<void>((resolve) => {
        const turnstile = document.createElement("script");
        turnstile.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        turnstile.onload = () => resolve();
        // Still start the client if Turnstile is blocked or down; the captcha step then reports its own error.
        turnstile.onerror = () => {
            console.warn("[Falcon] Could not load Cloudflare Turnstile; starting without it.");
            resolve();
        };
        document.head.appendChild(turnstile);
        // Neither event fires if the request stalls; don't leave the page blank forever.
        setTimeout(resolve, 15e3);
    });
}

/** Calls the initFalconClient the bundle defined, once. Returns an error message if it could not start, else null. */
export function startFalconClient(): string | null {
    const init = window.initFalconClient;

    if (typeof init !== "function") {
        console.error("[Falcon] The bundle did not define initFalconClient.");
        return "The mod bundle did not load correctly (initFalconClient is missing).";
    }

    delete window.initFalconClient;

    // Log in the page console, where the old inline loader's errors appeared.
    try {
        init();
        return null;
    } catch (err) {
        console.error("[Falcon] initFalconClient failed.", err);
        return `The client crashed while starting: ${err instanceof Error ? err.message : String(err)}`;
    }
}

/**
 * Shows a load error on top of the page, so a failed start isn't just a blank screen.
 * Used by the extension only; like the functions above, it must not use anything outside its own body.
 */
export function showLoadError(message: string) {
    const box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;inset:auto 16px 16px 16px;z-index:2147483647;padding:14px 16px;" +
        "border-radius:8px;background:#2b1d1d;color:#ffe9e9;border:1px solid #ff6b6b;" +
        "font:14px/1.45 system-ui,sans-serif;white-space:pre-wrap;box-shadow:0 4px 18px rgba(0,0,0,.4)";

    const title = document.createElement("strong");
    title.textContent = "Falcon could not start";

    const text = document.createElement("div");
    text.textContent = `${message}

Reload the page to try again. If it keeps happening, rebuild with "npm run build" and reload the extension in chrome://extensions.`;

    box.append(title, text);
    (document.body ?? document.documentElement).appendChild(box);
}
