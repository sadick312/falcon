# Falcon

A custom client for MooMoo.io: automation (combat, defense, placing, healing) and quality-of-life features,
with 88 settings to fit every play style. It runs as a Chrome extension on sandbox.moomoo.io (v1.9.0) and on
moomodding.io game pages (sandbox.moomodding.io, v1.8.2).
> Client is unpatched for v1.9.0 but not optimized for v1.9.0 combat.

## What's in this repository

| Folder | What it is |
|---|---|
| `mod-source/` | The mod itself (TypeScript). `npm run mod:build` bundles it into `mod-source/dist/bundle.js`. |
| `falcon-launcher/` | The Chrome extension. It puts the mod into game pages and has a small dashboard. Built into `falcon-launcher/dist/`. |
| `public/` | The page and styles that replace the game page (`index.html`, `style.css`). |
| `tools/lint/` | ESLint and Prettier, installed separately (they need TypeScript 6; the build uses 7). |
| `scripts/` | Helper scripts: `npm run dev`, the smoke test, dev stats, the settings doc generator. |
| `docs/` | [How each module works](docs/MODULES.md) and [every menu setting](docs/SETTINGS.md). |
| `userscripts/` | An optional HUD userscript for sandbox.moomodding.io. |

## Setup on Windows (first time)

You need about 10 minutes. All commands go in **Command Prompt** (press the Windows key, type `cmd`, press
Enter).

1. **Install Node.js.** Download the **LTS** version from [nodejs.org](https://nodejs.org) and run the
   installer with the default options. Then close and reopen Command Prompt and check it worked:
   ```bash
   node -v
   ```
   It should print a version like `v24.x.x`.
2. **Get the code.** Either download the repository as a ZIP from GitHub and unzip it, or clone it with Git.
3. **Go to the folder** (change the path to wherever you put it):
   ```bash
   cd C:\Users\YourName\falcon
   ```
4. **Install everything** (only needed once, and again after the dependencies change):
   ```bash
   npm run install:all
   ```
5. **Build everything with one command** (the mod, the Quick Inject file and the extension):
   ```bash
   npm run build
   ```
6. **Load the extension in Chrome.**
   1. Open `chrome://extensions` in the address bar.
   2. Turn on **Developer mode** (top right).
   3. Click **Load unpacked** and choose the `falcon-launcher\dist` folder inside the project.
   4. Falcon's dashboard opens. It should say **Ready**.
7. **Play.** Open [sandbox.moomoo.io](https://sandbox.moomoo.io) or
   [sandbox.moomodding.io](https://sandbox.moomodding.io/?server=1:1). Falcon replaces the page
   automatically. Press **Esc** in game to open the menu; use its search box to find a setting.

## After you change the code

- Run `npm run build` again, then click the reload icon on Falcon in `chrome://extensions` and reload the
  game tab.
- Or run `npm run dev` while you work: it rebuilds the mod and the extension every time you save a file
  (then reload the extension and the game tab). Press Ctrl+C to stop it. It makes a development build (with
  the profiler), so run `npm run build` before sharing the extension.

## Quick Inject (moomodding.io, no extension)

1. Run `npm run inject:build`. It writes `mod-source\dist\falcon-quick-inject.js`.
2. On moomodding.io, open Quick Inject, choose "Bundle Replacement" and paste the whole file.

The file can also be pasted into the DevTools console on a sandbox.moomodding.io game page.

## Commands

| Command | What it does |
|---|---|
| `npm run install:all` | Installs everything, including the lint tools. |
| `npm run build` | Builds the mod, the Quick Inject file and the extension. |
| `npm run dev` | Watches and rebuilds the mod and the extension while you work. |
| `npm test` | Runs the tests (Vitest). |
| `npm run test:smoke` | Builds everything and checks that every output is in place. |
| `npm run typecheck` | Checks the TypeScript types of the mod, its tests and the extension. |
| `npm run lint` / `npm run lint:fix` | Finds (or fixes) common mistakes with ESLint. |
| `npm run format` / `npm run format:check` | Formats the code (or checks it) with Prettier. |
| `npm run docs:settings` | Regenerates [docs/SETTINGS.md](docs/SETTINGS.md) after you change a setting. |
| `npm run bench` | Replays recorded fights and times each step of the mod's tick. |
| `npm run stats` | Builds and writes a size and quality report to `stats/report.html`. |
| `npm run mod:build`, `ext:build`, `inject:build` | Build one part only. |

## Troubleshooting

**`'npm' is not recognized as an internal or external command`**
Node.js isn't installed, or Command Prompt was open before you installed it. Install Node.js (step 1) and
open a new Command Prompt.

**`Missing ...mod-source/dist/bundle.js. Run "npm run mod:build" before "npm run ext:build".`**
The extension was built before the mod. Run `npm run build`, which builds them in the right order.

**The dashboard says "Files missing"**
Same cause: run `npm run build`, then reload Falcon in `chrome://extensions`.

**The game page looks normal, Falcon doesn't load**
Reload the game tab. Falcon only runs on `https://sandbox.moomoo.io` and `https://sandbox.moomodding.io`.
Check that the extension is switched on in `chrome://extensions`.

**A red "Falcon could not start" box appears on the game page**
It says which step failed. Run `npm run build`, reload the extension, then reload the game tab. The
dashboard (click the Falcon icon) shows the same error.

**Stuck on a connection error**
The server may be full, restarting or down. Pick another server in the server list.

**My settings are gone after a reload**
Settings are only kept while **Auto Save Configs** (Configs tab) is on. You can also save named configs
there, or **Export** them to a file and **Import** it later.

**`eslint is not installed yet`**
Run `npm run install:all` once (the lint tools have their own install).

**Errors after pulling new code**
Run `npm run install:all` again, then `npm run build`.

## Documentation

- [docs/MODULES.md](docs/MODULES.md): how Falcon works and what each module does.
- [docs/SETTINGS.md](docs/SETTINGS.md): every menu setting with its default (generated from the code).
- [GOLD_TECH.md](GOLD_TECH.md): why the server's player update order matters for combat.
- [CHANGELOG.md](CHANGELOG.md): what changed.

## Contribution / Code Modification
This specific project is **NOT** opened to community contributions.

## License
This project is licensed under GNU GPLv3.
> For more information about **GNU GPLv3**, click [here](https://choosealicense.com/licenses/gpl-3.0/).
