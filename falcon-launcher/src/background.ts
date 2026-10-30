import { prepareGamePage, startFalconClient } from "./gameLoader";

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

    async function fetchAsset(path: string) {
        const response = await fetch(chrome.runtime.getURL(`mod/${path}`));

        if (!response.ok)
            throw new Error(`failed to load bundled asset ${path}`);

        return response.text();
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

        Promise.all([
            fetchAsset("index.html"),
            fetchAsset("style.css")
        ]).then(async ([htmlContent, cssContent]) => {
            // Same order as before: replace the page, wait for Turnstile, then run the bundle and start it.
            await chrome.scripting.executeScript({
                target,
                injectImmediately: true,
                world: "MAIN",
                func: prepareGamePage,
                args: [htmlContent, cssContent, true]
            });

            await chrome.scripting.executeScript({
                target,
                injectImmediately: true,
                world: "MAIN",
                files: ["mod/bundle.js"]
            });

            await chrome.scripting.executeScript({
                target,
                injectImmediately: true,
                world: "MAIN",
                func: startFalconClient
            });
        }).catch(console.error);
    });
})();
