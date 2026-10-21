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

    async function registerCspBypassRule() {
        const RULE_ID = 9999;

        const rule: chrome.declarativeNetRequest.Rule = {
            id: RULE_ID,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                responseHeaders: [
                    {
                        header: "content-security-policy",
                        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                    }
                ]
            },
            condition: {
                requestDomains: GAME_HOSTS,
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME
                ]
            }
        };

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [RULE_ID],
            addRules: [rule]
        });
    }

    chrome.runtime.onStartup.addListener(() => {
        registerCspBypassRule().catch(console.error);
    });

    async function fetchAsset(path: string) {
        const response = await fetch(chrome.runtime.getURL(`mod/${path}`));

        if (!response.ok)
            throw new Error(`failed to load bundled asset ${path}`);

        return response.text();
    }

    chrome.runtime.onInstalled.addListener((details) => {
        registerCspBypassRule().catch(console.error);

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

        Promise.all([
            fetchAsset("index.html"),
            fetchAsset("style.css"),
            fetchAsset("bundle.js")
        ]).then(([htmlContent, cssContent, jsContent]) => {
            chrome.scripting.executeScript({
                target: { tabId: details.tabId, frameIds: [details.frameId] },
                injectImmediately: true,
                world: "MAIN",
                func: injectDynamicLoader,
                args: [htmlContent, cssContent, jsContent]
            });
        }).catch(console.error);
    });

    function injectDynamicLoader(htmlContent: string, cssContent: string, jsContent: string) {
        (window as any).oldHTML = document.documentElement.innerHTML;
        document.documentElement.innerHTML = htmlContent;

        const styleElement = document.createElement("style");
        styleElement.innerHTML = cssContent;
        document.head.appendChild(styleElement);

        const turnstile = document.createElement("script");
        turnstile.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        document.head.appendChild(turnstile);

        turnstile.onload = async () => {
            const runtimeScript = document.createElement("script");
            runtimeScript.innerText = jsContent;
            document.head.appendChild(runtimeScript);

            if (typeof (window as any).initFalconClient === "function") {
                (window as any).initFalconClient();
                delete (window as any).initFalconClient;
                runtimeScript.remove();
                return;
            }

            let interval = setInterval(() => {
                if (typeof (window as any).initFalconClient === "function") {
                    clearInterval(interval);
                    (window as any).initFalconClient();
                    delete (window as any).initFalconClient;
                    runtimeScript.remove();
                }
            }, 500);
        };
    }
})();