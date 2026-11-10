# Falcon V1.0.0

A high performance, stable, low-latency custom client for MooMoo.io. 
Built from the ground up, the client offers high-level automation features as well as QoL improvements. 
With over 50+ toggles, the client offers customization for all play styles.
> Client is unpatched for v1.9.0 but not optimized for v1.9.0 combat.

## Quick Inject (sandbox.moomodding.io, MooMoo 1.8.2)
This fork also runs on **sandbox.moomodding.io** (MooMoo.io 1.8.2) through its Quick Inject /
Paste & Play feature. The protocol is picked automatically from the website you're on.

1. Install [Node.js](https://nodejs.org) (LTS), then open a terminal in this folder.
2. `npm install` (first time only)
3. `npm run quickinject`
4. Open `mod-source/dist/falcon-quickinject.js` in Notepad, select all, copy.
5. Paste it into Quick Inject on sandbox.moomodding.io. If you can pick a mode, choose
   **bundle replacement** (in "hook" mode the normal game is disconnected but keeps running).

Useful extras:
- `npm test --workspace=mod-source` runs the unit tests.
- `FALCON_DEBUG_BUILD=1` before the build gives a readable (unminified) bundle for bug reports.
- Typing `localStorage.setItem("falcon-debug-api", "1")` in the browser console enables the
  read-only `window.falconDebug` object (ping, hat, weapon, brain state) after a reload.
- Keys can be changed in the menu (Esc) under **Keybinds**; Ping Compensation and Artificial Ping
  are under **Utility > Packet Management**.

## Installation
Below are the instructions to download a local copy of the client.

### Prerequisites
- Node.js
- NPM
- Terminal
- Working Keyboard
- 3 Micro Braincells

### Quick Inject (sandbox.moomodding.io, MooMoo 1.8.2)
This fork also runs on **sandbox.moomodding.io** (MooMoo.io 1.8.2) through its Quick Inject /
Paste & Play feature. The protocol is picked automatically from the website you're on.

1. Install [Node.js](https://nodejs.org) (LTS), then open a terminal in this folder.
2. `npm install` (first time only)
3. `npm run quickinject`
4. Open `mod-source/dist/falcon-quickinject.js` in Notepad, select all, copy.
5. Paste it into Quick Inject on sandbox.moomodding.io. If you can pick a mode, choose
   **bundle replacement** (in "hook" mode the normal game is disconnected but keeps running).

Useful extras:
- `npm test --workspace=mod-source` runs the unit tests.
- `FALCON_DEBUG_BUILD=1` before the build gives a readable (unminified) bundle for bug reports.
- Typing `localStorage.setItem("falcon-debug-api", "1")` in the browser console enables the
  read-only `window.falconDebug` object (ping, hat, weapon, brain state) after a reload.
- Keys can be changed in the menu (Esc) under **Keybinds**; Ping Compensation and Artificial Ping
  are under **Utility > Packet Management**.

## Installation Instructions
1. Fork / Clone the entire repo
2. Run ```npm install``` to install all dependencies
3. Run ```npm run ext:build``` to build dev extension build.
4. Load the generated dist directory into chrome extensions.
5. Run ```npm run mod:watch``` or ```npm run mod:build``` to actually bundle and build the mod code.
6. Run ```npm run dev:start``` to start the local backend that the dev extension requires.

## Contribution / Code Modification
This specific project is **NOT** opened to community contributions.

## License
This project is licensed under GNU GPLv3.
> For more information about **GNU GPLv3**, click [here](https://choosealicense.com/licenses/gpl-3.0/).