# Falcon

A custom client for MooMoo.io: automation (combat, defense, placing, healing) and quality-of-life features,
with about 90 settings to fit every play style. It runs as a Chrome extension on sandbox.moomoo.io (v1.9.0) and on
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

Use this if you don't want to install the extension. It only works on moomodding.io.

1. **Build the file** (after steps 1-4 of the setup above):
   ```bash
   npm run inject:build
   ```
   It writes `mod-source\dist\falcon-quick-inject.js` (about 660 KB).
2. **Copy all of it.** Open the file in Notepad (right-click > Open with > Notepad), press **Ctrl+A** to select
   everything, then **Ctrl+C** to copy it.
3. **Paste it into Quick Inject.** On moomodding.io, open the **Quick Inject** box, choose
   **Bundle Replacement**, paste with **Ctrl+V**, and start the game. moomodding.io runs it in place of the
   normal game.
4. **Or paste it into the console** of an open game page: on a sandbox.moomodding.io game page press **F12**,
   click the **Console** tab, paste, and press **Enter**. If Chrome says pasting is blocked, type
   `allow pasting` in the console first and press Enter.

Either way Falcon replaces the page. If the normal game was already running underneath (the console way),
Falcon stops it: it closes the game's own connection and stops its drawing, and the console shows
`[Falcon] Stopped the vanilla game underneath Falcon`.

Pasting the file a second time on the same page does nothing; reload the page to start over.

**Disconnected?** Click **Reconnect**. It connects to the same server again without reloading the page, so it
also works after pasting into the console (a page reload would remove Falcon until you paste it again).

## Commands

| Command | What it does |
|---|---|
| `npm run install:all` | Installs everything, including the lint tools. |
| `npm run build` | Builds the mod, the Quick Inject file and the extension. |
| `npm run dev` | Watches and rebuilds the mod and the extension while you work. |
| `npm test` (or `npx vitest run`) | Runs all the tests (Vitest). |
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

**Disconnected, or "Server handshake failed"**
Click **Reconnect** on the screen that appears. If it keeps failing, the server may be down or restarting;
try another server from the server list (Multiplayer).

**`eslint is not installed yet`**
Run `npm run install:all` once (the lint tools have their own install).

**Errors after pulling new code**
Run `npm run install:all` again, then `npm run build`.

## Troubleshooting with the F12 console

Most problems leave a message in Chrome's console, and it's the quickest way to see what went wrong.

1. On the game page, press **F12** (or **Ctrl+Shift+I**). A panel opens.
2. Click the **Console** tab.
3. To see only Falcon's messages, type `Falcon` in the **Filter** box at the top of the console.
4. Red lines are errors, yellow lines are warnings.

What the common messages mean:

| Message | What it means | What to do |
|---|---|---|
| `[Falcon] Game version v1.8.2 (supported).` | All good: Falcon recognised the game. | Nothing. |
| `[Falcon] This page runs MooMoo.io v..., but Falcon supports v...` | The site updated its game. | Falcon may misbehave; check for a newer Falcon. |
| `[Falcon] Stopped the vanilla game underneath Falcon ...` | The normal game was running too; Falcon switched it off. | Nothing. |
| `[Falcon] socket-open: ...` | The game server didn't answer. | Click Reconnect, or pick another server. |
| `[Falcon] handshake: No init packet from the server within 10s.` | Connected, but the server never started the game. | Click Reconnect, or pick another server. |
| `[Falcon] server-list: ...` | The server list couldn't be loaded. | Check your internet, then press Refresh in the server list. |
| `[Falcon] Ignoring unknown packet '...'` | The server sent something Falcon doesn't use. | Harmless. |
| `[Falcon] Handler for packet '...' failed.` | A bug in Falcon while reading a server message. | Copy the red text (right-click > Copy) and report it. |
| `[Falcon] initFalconClient failed.` or a red "Falcon could not start" box | Falcon crashed while starting. | Run `npm run build`, reload, and report the red text if it stays. |

To share an error: right-click the red line > **Copy**, or right-click in the console > **Save as...** to save
the whole log to a file.

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
