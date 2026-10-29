# Falcon on moomodding.io: v1.8.2 and v1.6.9

Checked against the live site on 2026-10-29:
`sandbox.moomodding.io/1.6.9/bundle.js`, `/1.8.2/assets/index-*.js`, and both versions' `hackfix.js`.

## 1. Patch notes

### Version support
- **Version detection** (`mod-source/src/utils/constants/GameVersion.ts`). On load Falcon logs, for example:
  `[Falcon] Client version 1.6.9 (from <base href>), using the v1.6.9 profile, v1.8.2 wire protocol.`
  Sources, most reliable first: the page's `<base href="/1.6.9/">`, a `/<ver>/bundle.js|hackfix.js` path,
  the `moo_version` cookie, and the `__mooHackfixActive_169` flag.
- **One profile per version** (`VERSION_PROFILES`): wire protocol, whether hackfix rewrites packets,
  the page bundle's own packet codes, and `unsupportedFeatures` (menu id → reason).
- **Unknown versions** (1.7.x, 1.8.0, 1.8.1 are also on the launcher) fall back to the v1.8.2 profile. The menu marks them
  "unverified" instead of crashing.
- **Menu header** shows the detected client version under the Falcon version.
- **Feature gating**: any id listed in a profile's `unsupportedFeatures` is switched off and locked, and the reason
  replaces its description. This also covers saved configs, and `Menu.setValue` can't turn a locked feature back on.
  Both lists are empty right now, because no Falcon feature depends on anything that differs between v1.6.9 and v1.8.2 (see §3).

### Fixes
- **Quick Inject was broken on both versions.** Quick Inject's "Bundle Replacement" blocks only `bundle.js`, so
  `hackfix.js` still runs, and it replaces `window.WebSocket` with a function that returns a plain native socket.
  `class Socket extends WebSocket` then got that plain object as `this`, with none of Socket's methods. Verified live:
  a subclass method was `undefined` on both versions.
- **v1.6.9 would have rewritten Falcon's packets.** The v1.6.9 hackfix also patches `WebSocket.prototype.send` to rename
  1.6.9 codes to server codes. Falcon already sends server codes, so MOVE `"9"` became `"N"` (leave clan),
  SEND_CHAT `"6"` became `"H"` (upgrade) and STORE `"c"` became `"F"` (hit).
  → Fix: `core/socket/NativeWebSocket.ts`. When the page's WebSocket is patched, Falcon's socket extends a
  clean `WebSocket` from a hidden same-origin iframe. Verified live on both versions: the subclass keeps its methods
  and the server answers `io-init`, `A`, and `0` to a ping.
- **Sandbox commands** that start with `\` (`\b`, `\c`, `\f`) now skip the chat profanity rewrite, like `/` commands already
  did. Without this, the filter could insert `\0` into a bot's name and break the command.

### Not changed in this pass
The "weak sides" list in the request was left as the template placeholder: *slow spike-sync reaction, bad heal timing,
weak insta-kill, FPS drops, messy UI*. Those are combat-tuning changes that can only be judged by running the test plan
below on the live server. Send your measured results, or your actual list, and they get fixed one at a time.

## 2. Version config tables

### What each client version means for Falcon

| | v1.9.0 (sandbox.moomoo.io) | v1.8.2 (moomodding.io) | v1.6.9 (moomodding.io) |
|---|---|---|---|
| Page bundle | protocol module + mixKey | `/1.8.2/assets/index-*.js` (Vite module) | `/1.6.9/bundle.js` (webpack) |
| Detected from | hostname | `<base href="/1.8.2/">` | `<base href="/1.6.9/">` |
| Server | moomoo.io | `s1`/`s2.moomodding.io` (shared) | same server as v1.8.2 |
| Wire protocol | v1.9.0, encrypted | v1.8.2, plain msgpack | **v1.8.2** (hackfix translates for the old bundle) |
| Layout conversion | none | `LegacyPacketAdapter` | `LegacyPacketAdapter` |
| hackfix replaces `window.WebSocket` | – | yes | yes |
| hackfix rewrites `send()` | – | no | **yes** |
| Weapons 0–15, tiers 0–3 | same | same | same |
| Hats, accessories, items | same | same | same (only difference: v1.8.2 data adds `sandboxLimit: 299` for mill, booster and teleporter) |

Weapon IDs checked in both bundles: 0 tool hammer, 1 hand axe, 2 great axe, 3 short sword, 4 katana, 5 polearm, 6 bat,
7 daggers, 8 stick, 9 hunting bow, 10 great hammer, 11 wooden shield, 12 crossbow, 13 repeater crossbow,
14 mc grabby, 15 musket.

### Packet codes: server (what Falcon uses) vs the v1.6.9 page bundle

Falcon never sends v1.6.9 codes. This table is here so you can read the 1.6.9 bundle and its mods.

| Client → server | Server code | 1.6.9 bundle | | Server → client | Server code | 1.6.9 bundle |
|---|---|---|---|---|---|---|
| JOIN_GAME | `M` | `sp` | | SET_INIT_DATA | `A` | `id` |
| SEND_AIM | `D` | `2` | | DISCONNECT | `B` | `d` |
| MOVE | `9` | `33` | | SET_UP_GAME | `C` | `1` |
| RESET_MOVEMENT_DIR | `e` | `rmd` | | ADD_PLAYER | `D` | `2` |
| SEND_HIT | `F` | `c` | | REMOVE_PLAYER | `E` | `4` |
| SELECT_TO_BUILD | `z` | `5` | | UPDATE_PLAYERS | `a` | `33` |
| SEND_UPGRADE | `H` | `6` | | UPDATE_LEADERBOARD | `G` | `5` |
| AUTO_GATHER | `K` | `7` | | LOAD_GAME_OBJECT | `H` | `6` |
| CREATE_CLAN | `L` | `8` | | LOAD_AI | `I` | `a` |
| LEAVE_CLAN | `N` | `9` | | ANIMATE_AI | `J` | `aa` |
| JOIN_CLAN | `b` | `10` | | GATHER_ANIMATION | `K` | `7` |
| JOIN_REQUEST | `P` | `11` | | WIGGLE_GAME_OBJECT | `L` | `8` |
| KICK_FROM_CLAN | `Q` | `12` | | SHOOT_TURRET | `M` | `sp` |
| STORE | `c` | `13c` | | UPDATE_PLAYER_VALUE | `N` | `9` |
| SEND_CHAT | `6` | `ch` | | UPDATE_HEALTH | `O` | `h` |
| PING_MAP | `S` | `14` | | KILL_PLAYER | `P` | `11` |
| PING_SOCKET | `0` | `pp` | | KILL_OBJECT / OBJECTS | `Q` / `R` | `12` / `13` |
| | | | | ITEM_COUNTS / AGE / UPGRADES / ITEMS | `S` `T` `U` `V` | `14` `15` `16` `17` |
| | | | | ADD / REMOVE_PROJECTILE | `X` / `Y` | `18` / `19` |
| | | | | ALLIANCE add/delete/notify/team/players | `g` `1` `2` `3` `4` | `ac` `ad` `an` `st` `sa` |
| | | | | STORE_ITEMS / CHAT / MINIMAP / TEXT / PING_MAP / PONG | `5` `6` `7` `8` `9` `0` | `us` `ch` `mm` `t` `p` `pp` |

Packet layouts are the same in both versions. A player is 13 values: `sid, x, y, dir(rad), buildIndex, weaponIndex,
weaponVariant, team, isLeader, skinIndex, tailIndex, iconIndex, zIndex`. An AI is 7 values:
`sid, index, x, y, dir, health, nameIndex`. A game object is 8 values.

## 3. How to re-check a version yourself

Do this whenever moomodding.io updates a client (the launcher shows each version's date).

1. **Pick the version.** Choose it in the launcher, or set the cookie on moomodding.io:
   `document.cookie = "moo_version=1.6.9; path=/; domain=.moomodding.io"`. Then open `https://sandbox.moomodding.io/?server=1:1`.
2. **Find the bundle.** In DevTools → Elements, look for `<base href="/X.Y.Z/">` and the bundle `<script>`. Fetch it from the console:
   `t = await (await fetch('/1.6.9/bundle.js')).text()`. For v1.8.2, use the `./assets/index-*.js` path relative to the base.
3. **Packet handlers (server → client).** Search for `"io-init"`. Next to the `onmessage` there is an object literal like
   `{ id: …, d: …, 1: …, 2: …, 33: … }`. Its keys are the codes this bundle receives.
4. **Sent packets (client → server).** Run `[...new Set([...t.matchAll(/\.send\(\s*"([^"]+)"/g)].map(m => m[1]))]` and
   read each call's context to see what it is (e.g. `send("33", dir)` is move).
5. **Player layout.** Open the handler for the player update code (`33` / `a`) and count `e[n + k]` up to the
   `n += 13` stride. Do the same for the AI handler (`t += 7`).
6. **Item, hat and weapon arrays.** Search for `name: "tool hammer"` (weapons), `name: "Shame!"` (hats) and
   `name: "apple"` (items). Compare `id`, `dmg`, `speed`, `reload`, `req` and `health` with
   `mod-source/src/utils/constants/items.ts` and `store.ts`.
7. **What hackfix does.** Fetch `/<ver>/hackfix.js` and search for `prototype.send`, `window.WebSocket =` and
   `SERVER_TO_CLIENT`. If a new version translates packets, set `hackfixTranslatesPackets: true` in its profile.
   Falcon's clean socket bypasses it either way.
8. **The server.** Connect a clean socket (`wss://s1.moomodding.io/?token=cf%3Acf_token_moomodding`), send `["0", []]`
   with msgpack, and check that you get `io-init`, `A`, and `0` back. If you get other codes, the server changed and
   the wire protocol needs a new entry.

To add a version, add it to `ClientVersion` and `VERSION_PROFILES`. Then list any menu ids that can't work on it under
`unsupportedFeatures` with a one-line reason.

## 4. Test plan (run on both versions)

Setup for every row: launcher → version → Quick Inject → Bundle Replacement → paste `mod-source/dist/falcon-quick-inject.js`
(build it with `npm run inject:build`). Enter the game, then type `\b Dummy` and `\b t`. Turn on Falcon's packet counter
(`renderPacketCounter`) and an FPS overlay. Use `\c b` between rows.

"Verified" means it was checked live in this pass. "Not run" means it still needs your in-game run.

| # | Test | Bot setup | Expected Falcon behavior | Measure | v1.8.2 | v1.6.9 |
|---|---|---|---|---|---|---|
| 0 | Load + detect | none | Console logs the client version; menu header shows `Game client vX` | log line correct | Verified: detection + clean socket + server handshake | Verified: detection + clean socket + server handshake |
| 1 | Basic packets | none | Walk, aim, hit a tree, place a wall, buy and equip Bull Helmet from the store | no clan leave, no stray upgrade or hit; resources go up | Not run | Not run (this was the old v1.6.9 breakage) |
| 2 | Sandbox commands | `\b Dummy`, `\b w 4`, `\b v 3` | Commands reach the server unchanged | bot spawns with a ruby katana | Not run | Not run |
| 3 | Auto heal | `\b w 4`, `\b v 3`, `\b hl off`; stand in the bot's range | Heal fires on the tick after damage, never overheals | lowest HP, time from hit to heal (ms), food used | Not run | Not run |
| 4 | Insta-kill / one-tick | `\b w 5`, `\b h 6` (soldier), `\b hl on` | Insta lands when the bot has no shield | TTK (s), hits per kill, success out of 10 | Not run | Not run |
| 5 | Anti-bull | `\b h 7` (bull), `\b w 4`, `\b v 3` | Falcon swaps to Soldier Helmet (6) when the bull swing is predicted | damage taken per swing, survival time | Not run | Not run |
| 6 | Spike sync / spike tick | `\b t`, `\b w 2` | Spike placed and hit synced on a trapped bot | ms from trap to spike, kills out of 10 | Not run | Not run |
| 7 | Auto place / replace | `\b w 10` (great hammer), `\b hl on` | Trap or spike replaced the same tick it breaks | gap between break and re-place (ticks) | Not run | Not run |
| 8 | Turret gear / emp | `\b h 22` (emp) vs your Turret Gear (53) | Turret switch skipped against emp | wasted turret shots | Not run | Not run |
| 9 | FPS under load | place 100+ objects, `\b t` | No frame spikes, no growth in memory over 5 min | avg/min FPS, heap after 5 min | Not run | Not run |
| 10 | Duel | `\f <friend> -u 5 3000` | Full match without desync or disconnect | rounds won, disconnects | Not run | Not run |

Run each combat row on both versions and compare the numbers. Both versions share the same server and the same item
data, so a difference between them points at the client side (the hackfix, or a page global). It is not a combat logic difference.

## 5. Known risks and what to check

- **Clean iframe blocked.** If `[Falcon] The page patched WebSocket and no clean copy was found` shows in the console,
  the page stopped same-origin iframes from working (CSP or a hackfix change). Packets may then be rewritten on v1.6.9.
  Check `document.querySelector('iframe[aria-hidden]')` and the page CSP.
- **Server branches on version.** The `moo_version` cookie is sent to `s1.moomodding.io`. If the server ever changes
  behavior per version (the launcher changelog mentions per-version hat fixes), compare test 1 on both versions first.
- **New client versions.** Unknown versions run on the v1.8.2 profile and show "unverified" in the menu. Re-check them with §3.
- **`auth_challenge` packets.** The server sends one after `A`. Falcon logs it and drops it (as before). If joins start
  failing, this is the first thing to look at.
- **Custom `Z` packet.** Falcon's `ADD_PLACEMENT_MARKER` custom packet reuses `Z`, which is `SERVER_RESTARTING` on the real
  server. This was already the case before this change.
- **Extension path.** The Chrome extension removes the page's scripts, so hackfix usually never runs there. The clean
  socket is only used when the page's WebSocket is patched, so the extension path is unchanged.
