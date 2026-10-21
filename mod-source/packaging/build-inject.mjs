// Builds dist/falcon-quick-inject.js: one script with the mod bundle, index.html and style.css inlined,
// for moomodding.io's Quick Inject box ("Bundle Replacement") or pasting into the game page's console.
// Run "npm run build" first; this only packages dist/bundle.js.
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const bundlePath = path.join(root, "dist", "bundle.js");
const htmlPath = path.join(root, "..", "public", "index.html");
const cssPath = path.join(root, "..", "public", "style.css");
const outPath = path.join(root, "dist", "falcon-quick-inject.js");

// Same steps as injectDynamicLoader in falcon-launcher/src/background.ts, minus the Turnstile script:
// moomodding.io has no captcha. Works whether it runs before or after DOMContentLoaded.
const template = `/* Falcon Quick Inject build. Paste into moomodding.io > Quick Inject ("Bundle Replacement"),
   or run it in the console of a sandbox.moomodding.io game page. */
(function () {
    "use strict";
    if (window.__falconLoaded) return;
    window.__falconLoaded = true;

    var html = __HTML__;
    var css = __CSS__;
    var js = __JS__;

    function boot() {
        window.oldHTML = document.documentElement.innerHTML;
        document.documentElement.innerHTML = html;

        var style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);

        var runtime = document.createElement("script");
        runtime.textContent = js;
        document.head.appendChild(runtime);
        runtime.remove();

        var init = window.initFalconClient;
        if (typeof init !== "function") {
            console.error("[Falcon] The bundle did not define initFalconClient.");
            return;
        }

        delete window.initFalconClient;
        init();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
`;

async function readRequired(file, hint) {
    try {
        return await fs.readFile(file, "utf8");
    } catch {
        throw new Error(`Missing ${file}. ${hint}`);
    }
}

async function run() {
    const [js, html, css] = await Promise.all([
        readRequired(bundlePath, `Run "npm run mod:build" first.`),
        readRequired(htmlPath, ""),
        readRequired(cssPath, "")
    ]);

    // Function replacers so "$" sequences in the inlined sources are not treated as patterns.
    const output = template
        .replace("__HTML__", () => JSON.stringify(html))
        .replace("__CSS__", () => JSON.stringify(css))
        .replace("__JS__", () => JSON.stringify(js));

    await fs.writeFile(outPath, output);
    console.log(`Built ${path.relative(process.cwd(), outPath)} (${(output.length / 1024).toFixed(0)} KB).`);
}

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
