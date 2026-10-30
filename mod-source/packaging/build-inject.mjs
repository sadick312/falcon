// Builds dist/falcon-quick-inject.js: one script with the mod bundle, index.html and style.css inlined,
// for moomodding.io's Quick Inject box ("Bundle Replacement") or pasting into the game page's console.
// Run "npm run build" first; this only packages dist/bundle.js.
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
// The extension's page-side loader steps; Node 24 strips the TypeScript types on import.
import { prepareGamePage, startFalconClient } from "../../falcon-launcher/src/gameLoader.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const bundlePath = path.join(root, "dist", "bundle.js");
const htmlPath = path.join(root, "..", "public", "index.html");
const cssPath = path.join(root, "..", "public", "style.css");
const outPath = path.join(root, "dist", "falcon-quick-inject.js");

// Uses the same prepareGamePage/startFalconClient as the extension, without Turnstile (moomodding.io has
// no captcha) and with the bundle run as an inline script. Works before or after DOMContentLoaded.
const template = `/* Falcon Quick Inject build. Paste into moomodding.io > Quick Inject ("Bundle Replacement"),
   or run it in the console of a sandbox.moomodding.io game page. */
(function () {
    "use strict";
    if (window.__falconLoaded) return;
    window.__falconLoaded = true;

    var html = __HTML__;
    var css = __CSS__;
    var js = __JS__;

    var prepareGamePage = __PREPARE__;
    var startFalconClient = __START__;

    function boot() {
        // Without Turnstile this finishes synchronously; the returned promise is already resolved.
        prepareGamePage(html, css, false);

        var runtime = document.createElement("script");
        runtime.textContent = js;
        document.head.appendChild(runtime);
        runtime.remove();

        startFalconClient();
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
    // Loader functions first, so a placeholder-like string inside the bundle can't be replaced.
    const output = template
        .replace("__PREPARE__", () => prepareGamePage.toString())
        .replace("__START__", () => startFalconClient.toString())
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
