// Cloudflare Turnstile, which Falcon itself adds on sandbox.moomoo.io for the captcha; removing it could stop the
// captcha from loading.
const KEEP_SCRIPT_HOST = "challenges.cloudflare.com";

function isKeptScript(node) {
    try {
        return new URL(node.src).hostname === KEEP_SCRIPT_HOST;
    } catch {
        return false;
    }
}

const observer = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        mutation.addedNodes.forEach((node) => {
            if (node.nodeName === "SCRIPT" && !isKeptScript(node) && (node.src || node.textContent.toLowerCase().includes("frvr"))) {
                window.loadedScript = true;
                node.parentNode.removeChild(node);
            }
        });
    }
});

// Only added nodes matter; attribute and text changes produced records the callback ignored.
// Not disconnected on DOMContentLoaded: the game page adds scripts after that, and this still removes them.
observer.observe(document, {
    childList: true,
    subtree: true
});