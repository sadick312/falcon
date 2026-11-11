// Copies the Quick Inject build into the launcher extension (falcon-launcher/public/falcon/),
// so `vite build` puts it in falcon-launcher/dist. Run via `npm run launcher:build`.
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(__dirname, "..", "dist", "falcon-quickinject.js");
const targetDir = path.join(__dirname, "..", "..", "falcon-launcher", "public", "falcon");

await fs.mkdir(targetDir, { recursive: true });
await fs.copyFile(source, path.join(targetDir, "falcon-quickinject.js"));
console.log(`Copied Falcon build into ${targetDir}`);
