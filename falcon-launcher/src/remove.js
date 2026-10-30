const observer = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        mutation.addedNodes.forEach((node) => {
            if (node.nodeName === "SCRIPT" && (node.src || node.textContent.toLowerCase().includes("frvr"))) {
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