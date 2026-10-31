import { prepareGamePage, showLoadError, startFalconClient } from "./gameLoader";

(function () {
    // Game pages Falcon replaces. Keep in sync with content_scripts in manifest.json and the
    // profiles in mod-source/src/utils/constants/Endpoints.ts.
    const GAME_HOSTS = ["sandbox.moomoo.io", "sandbox.moomodding.io"];

    function isGamePage(url: string) {
        try {
            return GAME_HOSTS.includes(new URL(url).hostname);
        } catch {
            return false;
        }
    }

    // Earlier versions stripped the game pages' CSP header with dynamic rule 9999. Neither game host sends
    // one, and the bundle is now injected as a file (exempt from page CSP), so the rule only needs removing.
    // Chrome keeps dynamic rules across extension updates, so clear it explicitly.
    const LEGACY_CSP_RULE_ID = 9999;

    function removeLegacyCspRule() {
        chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [LEGACY_CSP_RULE_ID] }).catch(console.error);
    }

    // Bundled files load from the extension itself, so this only trips if something is badly wrong.
    const ASSET_TIMEOUT_MS = 10e3;

    async function fetchAsset(path: string) {
        let response: Response;

        try {
            response = await fetch(chrome.runtime.getURL(`mod/${path}`), { signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) });
        } catch (err) {
            const timedOut = err instanceof DOMException && err.name === "TimeoutError";
            throw new Error(timedOut ? `Reading mod/${path} took longer than ${ASSET_TIMEOUT_MS / 1000}s.` : `Could not read mod/${path}: ${String(err)}`, { cause: err });
        }

        if (!response.ok)
            throw new Error(`mod/${path} is missing from the extension (HTTP ${response.status}). Run "npm run build" and reload the extension.`);

        return response.text();
    }

    /** Logs the error in the extension's console and shows it on the game page. */
    function reportLoadError(target: chrome.scripting.InjectionTarget, step: string, err: unknown) {
        const message = `${step}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[Falcon] ${message}`);

        chrome.scripting.executeScript({ target, world: "MAIN", func: showLoadError, args: [message] })
            // The tab may have closed or navigated away; nothing more to do then.
            .catch(() => { });
    }

    chrome.runtime.onInstalled.addListener((details) => {
        removeLegacyCspRule();

        if (details.reason === "install") {
            chrome.tabs.create({
                url: chrome.runtime.getURL("index.html")
            });
        }
    });

    chrome.action.onClicked.addListener(() => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("index.html")
        });
    });

    chrome.webNavigation.onCommitted.addListener((details) => {
        if (!isGamePage(details.url)) return;
        if (details.frameId !== 0) return;

        // documentIds pins every step to this page load, so a navigation in between can't receive half of it.
        const target = { tabId: details.tabId, documentIds: [details.documentId] };

        // Each step is named, so an error says which one failed.
        let step = "Reading the page files";

        Promise.all([
            fetchAsset("index.html"),
            fetchAsset("style.css")
        ]).then(async ([htmlContent, cssContent]) => {
            // Same order as before: replace the page, wait for Turnstile, then run the bundle and start it.
            step = "Replacing the game page";
            await chrome.scripting.executeScript({
                target,
                injectImmediately: true,
                world: "MAIN",
                func: prepareGamePage,
                args: [htmlContent, cssContent, true]
            });

            step = "Running the mod bundle";
            await chrome.scripting.executeScript({
                target,
                injectImmediately: true,
                world: "MAIN",
                files: ["mod/bundle.js"]
            });

            step = "Starting the client";
            const [started] = await chrome.scripting.executeScript({
                target,
                injectImmediately: true,
                world: "MAIN",
                func: startFalconClient
            });

            if (started?.result) throw new Error(started.result);
        }).catch((err) => reportLoadError(target, step, err));
    });
})();
