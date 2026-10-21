import { crx } from "@crxjs/vite-plugin";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { defineConfig, type Plugin } from "vite";
import manifest from "./manifest.json";

// Files the background worker injects into the game page, copied into dist/mod/.
const modAssets: Record<string, string> = {
    "mod/bundle.js": resolve(__dirname, "../mod-source/dist/bundle.js"),
    "mod/index.html": resolve(__dirname, "../public/index.html"),
    "mod/style.css": resolve(__dirname, "../public/style.css")
};

function copyModAssets(): Plugin {
    return {
        name: "copy-mod-assets",
        generateBundle() {
            for (const [fileName, source] of Object.entries(modAssets)) {
                if (!existsSync(source))
                    this.error(`Missing ${source}. Run "npm run mod:build" before "npm run ext:build".`);

                this.emitFile({ type: "asset", fileName, source: readFileSync(source) });
            }
        }
    };
}

export default defineConfig({
    plugins: [
        crx({
            manifest
        }),
        copyModAssets()
    ],
    server: {
        port: 5173,
        strictPort: true,
        cors: {
            origin: /chrome-extension:\/\//,
        },
        hmr: {
            port: 5173,
        },
    },
    build: {
        rollupOptions: {
            input: {
                dashboard: resolve(__dirname, "index.html")
            }
        }
    },
    legacy: {
        skipWebSocketTokenCheck: true,
    },
})
