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

/** Calls the initFalconClient the bundle defined, once. */
export function startFalconClient() {
    const init = window.initFalconClient;

    if (typeof init !== "function") {
        console.error("[Falcon] The bundle did not define initFalconClient.");
        return;
    }

    delete window.initFalconClient;

    // Log in the page console, where the old inline loader's errors appeared.
    try {
        init();
    } catch (err) {
        console.error("[Falcon] initFalconClient failed.", err);
    }
}
