// npm run test:smoke: builds the mod, the Quick Inject file and the extension, then checks that every output
// exists and fits together. Pass --no-build to only check outputs that are already built.
import { spawnSync } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const modDist = join(root, "mod-source", "dist");
const extDist = join(root, "falcon-launcher", "dist");

if (!process.argv.includes("--no-build")) {
    console.log("Building everything (npm run build)...");
    const build = spawnSync("npm run build", { cwd: root, shell: true, stdio: "inherit" });
    if (build.status !== 0) {
        console.error("\nThe build failed; see the errors above.");
        process.exit(1);
    }
}

const failures = [];

function check(name, test) {
    let problem;
    try {
        problem = test();
    } catch (err) {
        problem = err instanceof Error ? err.message : String(err);
    }
    console.log(`${problem ? "FAIL" : " ok "}  ${name}${problem ? `: ${problem}` : ""}`);
    if (problem) failures.push(name);
}

/** Problem text if the file is missing or smaller than minBytes, else undefined. */
function fileProblem(path, minBytes = 1) {
    if (!existsSync(path)) return `${path} is missing`;
    const size = statSync(path).size;
    if (size < minBytes) return `${path} is only ${size} bytes`;
    return undefined;
}

const bundlePath = join(modDist, "bundle.js");
const injectPath = join(modDist, "falcon-quick-inject.js");

console.log("\nChecking build outputs:");

check("mod bundle exists", () => fileProblem(bundlePath, 100_000));
check("mod bundle defines initFalconClient", () =>
    readFileSync(bundlePath, "utf8").includes("initFalconClient") ? undefined : "initFalconClient not found");
check("mod source map exists", () => fileProblem(`${bundlePath}.map`));

check("Quick Inject file exists", () => fileProblem(injectPath, 100_000));
check("Quick Inject file is valid JavaScript", () => {
    const result = spawnSync(process.execPath, ["--check", injectPath], { encoding: "utf8" });
    return result.status === 0 ? undefined : result.stderr.trim().split("\n")[0];
});

const manifestPath = join(extDist, "manifest.json");
let manifest = null;
check("extension manifest is valid MV3 JSON", () => {
    const problem = fileProblem(manifestPath);
    if (problem) return problem;
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return manifest.manifest_version === 3 ? undefined : `manifest_version is ${manifest.manifest_version}`;
});

check("every file the manifest points to exists", () => {
    if (!manifest) return "no manifest";
    const files = [
        manifest.background?.service_worker,
        ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? [])
    ].filter(Boolean);
    const missing = files.filter((file) => !existsSync(join(extDist, file)));
    return missing.length ? `missing ${missing.join(", ")}` : undefined;
});

check("extension dashboard exists", () => fileProblem(join(extDist, "index.html")));

for (const file of ["bundle.js", "index.html", "style.css"]) {
    check(`extension contains mod/${file}`, () => fileProblem(join(extDist, "mod", file)));
}

check("extension's mod bundle is the one just built", () => {
    const copied = join(extDist, "mod", "bundle.js");
    if (!existsSync(copied) || !existsSync(bundlePath)) return "a bundle is missing";
    return readFileSync(copied).equals(readFileSync(bundlePath)) ? undefined : "run npm run build again (ext:build copies it)";
});

if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll build outputs are in place.");
