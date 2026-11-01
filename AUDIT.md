# Falcon feature audit

Feature-by-feature audit for MooMoo.io **v1.8.2** (sandbox.moomodding.io). Started 1 Nov 2026 on branch `review/stability`.

**Status values:** `not checked` → `checked` (read, no problems) → `fixed` (problems found and fixed) → `tested` (fixed or checked, with tests added that pass).

"Earlier work" lists checks done before this audit. They count as starting points, not as a full audit.

## Setup facts

| Item | State |
|---|---|
| Vitest | Already installed at the repo root (`vitest`, `jsdom`). `npm test` runs every test in `mod-source/test`. Nothing to add in `mod-source` itself |
| Build | `npm run build` (root) builds the mod, the Quick Inject file and the extension. `cd mod-source && npm run build` and `cd falcon-launcher && npm run build` also work |
| Backend | **There is no `backend/` folder.** It was removed in an earlier commit ("Bundle mod into extension and remove local backend"), so Step 2's backend checks don't apply |
| 1.8.2 support | Already in place: plain msgpack + fixed token, `LegacyPacketAdapter` for the two changed packets, the optional 1.8.2 cipher, a workaround for the site's WebSocket wrapper. Step 0.5 re-checks all of it |
| 1.8.2 client script | A copy of the real game files (`assets/index-8f264913.js`, `hackfix.js`, `modLoader.js`), downloaded from sandbox.moomodding.io/1.8.2 on 31 Oct 2026 |
| Game address | sandbox.moomodding.io. Game servers: s1.moomodding.io, s2.moomodding.io, singaporemoomoddingserver.onrender.com |

## Step 0.5: 1.8.2 compatibility

| Check | Status | Notes |
|---|---|---|
| Packet names, IDs and data layout | tested | All 36 server packets and 17 client packets compared. `Z` clash and `B` fixed (rows 1-2) |
| msgpack encoding, token, optional cipher | checked | Same as 1.8.2: `[type, [args]]`, token `cf:cf_token_moomodding`, optional cipher matches the client's code |
| Items, weapons, hats, accessories (IDs and stats) | tested | All IDs and stats identical. Building prerequisites fixed (row 3) |
| Game constants (map size, speeds, tick rate, scales) | checked | All identical (row 7) |
| DOM elements and globals the mod reads from the game page | checked | None from the game. Falcon replaces the page and only reads its own HTML |
| One file for version-specific values (`constants/gameVersion.ts`) | fixed | [gameVersion.ts](mod-source/src/utils/constants/gameVersion.ts) (row 4) |
| Version check with a console warning at startup | tested | [GameVersionCheck.ts](mod-source/src/core/utils/GameVersionCheck.ts) (row 5) |
| Packet encode/decode tests with sample 1.8.2 packets | tested | Already covered, so no duplicates added: sent packets decode to the 1.8.2 client's values and 1.8.2 player/animal layouts are converted (`packets.test.ts`); the cipher matches the client's code (`legacy-cipher.test.ts`); plus the new `Z` and `B` tests |

## Step 1: features

### Combat modules (`core/mod/combat/modules`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 1 | Velocity Hits | VelocityAttacker.ts | tested | Toggle test. P1 fixed |
| 2 | Knockback Hits | AutoAttacker.ts | tested | Toggle test. P1 fixed |
| 3 | Knockback Instakills | AutoInstakiller.ts | tested | Toggle test; duplicated blocks noted. Fixed: own-weapon guessing, Monkey Tail on projectiles |
| 4 | Apple Insta / Shame Grind | AppleInstakiller.ts | tested | Toggle test. P2 fixed |
| 5 | Spike Tick | SpikeTicker.ts | tested | Toggle test. Fixed: stale trigger |
| 6 | Dynamic One Tick | OneTicker.ts | tested | Toggle test. P1 fixed; possible issue P3 |
| 7 | Projectile Sync | ProjectileSyncer.ts | tested | Toggle test |
| 8 | Melee Sync | AutoMeleeSyncer.ts | not checked | Toggle test |
| 9 | Auto Push Strikes | AutoPushStriker.ts, push-strikes/ (Bullspam, Predictive, ShameStrike, PushStrikeMethod) | not checked | Toggle test |
| 10 | Turret Bullet Assist | TurretAPAssister.ts | not checked | Toggle test |
| 11 | Turret Gear Knockback | TurretGearKnockbacker.ts | not checked | Toggle test; duplicate of #12 noted |
| 12 | Barbarian Knockback | BarbarianKnockbacker.ts | not checked | Toggle test |
| 13 | Anti Bull | AntiBuller.ts | not checked | Toggle test |

### Combat core and placing (`core/mod/combat`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 14 | Attack Manager (picks one attack per tick) | core/AttackManager.ts, core/AttackQueuePool.ts | not checked | |
| 15 | Combat Controller / Select Best Weapon | core/CombatController.ts | not checked | |
| 16 | Auto Push (+ pathfinding) | core/AutoPusher.ts, services/pathfinding/Pathfinder.ts, Pathfinder.worker.js | not checked | Pathfinder race fixed + tested; extra path requests every tick still open |
| 17 | Placement System | core/PlacementSystem.ts | not checked | |
| 18 | Auto Place / Preplacements | placing/modules/AutoPlacer.ts | not checked | |
| 19 | Replacements | placing/modules/AutoReplacer.ts | not checked | |
| 20 | Auto Grind | placing/modules/AutoGrinder.ts | not checked | |
| 21 | Auto Mill | placing/modules/AutoMiller.ts | not checked | |
| 22 | Angle Finder | placing/AngleFinder.ts, Angle.ts, AngleGrader.ts | not checked | Perf session optimizing it |
| 23 | Graders | placing/grader-modules/Grader.ts, SpikeGrader.ts, TrapGrader.ts | not checked | Perf session optimizing it |
| 24 | Placer helpers | placing/utils/Placer.ts, PlacerUtils.ts | not checked | |
| 25 | Combat helpers | utils/CombatUtils.ts, utils/CombatModule.ts | not checked | |

### Defense (`core/mod/defense`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 26 | Defense System (threat scan) | DefenseSystem.ts | not checked | Most complex code |
| 27 | Auto Heal | defense-modules/AutoHealer.ts, utils/HealerUtils.ts | not checked | Food values tested |
| 28 | Hat System | defense-modules/HatSystem.ts | not checked | |
| 29 | Safe Walk | defense-modules/MovementManager.ts, utils/MovementUtils.ts | not checked | Friction maths tested |
| 30 | Auto Break | modules/AutoBreaker.ts, utils/BreakerUtils.ts | not checked | |
| 31 | Object Breaker / Pit-Spike Breaker | modules/ObjectBreaker.ts, utils/ObjectUtils.ts | not checked | |
| 32 | Defensive Knockback | modules/DefensiveKnockbacker.ts | not checked | |
| 33 | Turret Manager | modules/TurretManager.ts | not checked | |
| 34 | Defense helpers | utils/DefenseUtils.ts, utils/DefenseModule.ts | not checked | |

### Simulation and mod utilities (`core/mod`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 35 | Movement / knockback simulation | simulation/MovementPhysicsSimulator.ts, SimulationStates.ts | not checked | |
| 36 | Auto Buy | utils/AutoBuyer.ts | not checked | |
| 37 | Ping tracking | utils/PingTracker.ts | not checked | |
| 38 | Game event tracking | utils/GameEventTracker.ts | not checked | |
| 39 | Module base class | utils/ModModule.ts | not checked | 10 modules don't use it |

### Game state managers (`core/logic`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 40 | Objects + spatial grid | ObjectManager.ts | not checked | Duplicate-add and removeAll fixes earlier |
| 41 | Nearby-object lists per tick | ObjectPool.ts | not checked | |
| 42 | Predicted placements | PotentialObjectManager.ts | not checked | |
| 43 | Projectiles | ProjectileManager.ts | not checked | 7% covered |
| 44 | Damage text | TextManager.ts | not checked | |
| 45 | Players (list, combat, placement, state) | players/PlayerManager.ts, PlayerEntityHandler.ts, core/PlayerCombatManager.ts, PlayerPlacementManager.ts, PlayerStateManager.ts | not checked | Ghost-player fix earlier. Own weapons fixed in #3. To check: `updatePrimary` guesses a great hammer for dagger/stick users, then the next line always overwrites it with a musket (variant stays gold) |
| 46 | Entities (player, AI, projectile classes) | constants/Player.ts, Ai.ts, Projectile.ts, SimulationProjectile.ts, utils/constants/Entity.ts, EntityHandler.ts, aiTypes.ts | not checked | |

### Core, networking and events (`core`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 47 | Tick loop | ModManager.ts | not checked | Spawn guards earlier |
| 48 | Connection and client state | Client.ts, utils/CaptchaManager.ts, utils/ProtocolLoader.ts, utils/constants/Endpoints.ts | not checked | |
| 49 | Socket (decode, cipher, dispatch) | socket/Socket.ts, CustomEncoder.ts, FakeSocket.ts, utils/PacketManager.ts | not checked | WebSocket wrapper fix + cipher tests |
| 50 | 1.8.2 packet conversion | socket/LegacyPacketAdapter.ts | not checked | Tested |
| 51 | Packet handlers | socket/SocketListener.ts, socket/events/ (6 events + MessageHandler) | not checked | Alliance guard + handler probe |
| 52 | Packet batching per tick | utils/PacketBatcher.ts | not checked | |
| 53 | Packet budget | utils/PacketTracker.ts | not checked | |
| 54 | Chat commands (`!help`, `!plog`, ...) | utils/ChatCommands.ts | not checked | |
| 55 | Packet recorder (`!plog`) | services/packet-recorder/PacketRecorder.ts | not checked | Tests exist |
| 56 | Packet replayer | PacketReplayer.ts | not checked | |
| 57 | UI events (clan menu, items, notifications, values, upgrades) | events/updateClanMenu.ts, updateItems.ts, updateNotifications.ts, updatePlayerValue.ts, updateUpgrades.ts | not checked | |
| 58 | Packet names and types | utils/socket/PacketMap.ts | not checked | |

### Menu and settings (`core/menu`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 59 | Menu, settings save/load, favorites | Menu.ts, icons.ts, menuStyle.ts, misc/Stack.ts | not checked | Settings versioning + tests |
| 60 | Saved configs | utils/drawConfigUI.ts, drawSavedConfigs.ts | not checked | Tests exist |
| 61 | Menu controls (toggle, slider, select, number, group, paragraph, label, body) | utils/draw*.ts (8 files) | not checked | Paragraph container bug fixed |
| 62 | Chat log | utils/drawChatLog.ts | not checked | |

### Game UI and services

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 63 | Startup and page setup | index.ts, ui/Loader.ts, ui/DisclaimerDisplay.ts, ui/data/AllTemporaryObjects.ts | not checked | |
| 64 | Input (keys, mouse, chat box) | ui/Hook.ts | not checked | |
| 65 | Server browser | ui/ServerBrowser.ts, services/network/Http.ts | not checked | |
| 66 | Connection error screens | ui/ConnectionError.ts | not checked | |
| 67 | Sub-millisecond timers | services/event-timer/TaskScheduler.ts | not checked | |
| 68 | Profiler (dev builds only) | services/profiler/Profiler.ts | not checked | |
| 69 | Script config | utils/utils/config/ScriptConfig.ts | not checked | |

### Rendering (`rendering`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 70 | Render loop, camera, resize, sprite cache | RendererSystem.ts, RendererUtils.ts, RenderingConfig.ts, core/CameraManager.ts, WindowResizer.ts, SpriteCache.ts | not checked | |
| 71 | World drawing (players, AIs, objects, projectiles, names, text, chats, background, water, borders) | utils/core/ (11 files) | not checked | renderNames 0% covered |
| 72 | Building drawing | utils/items/ (5 files) | not checked | |
| 73 | Mod overlays (placements, paths, one-tick line, minimap, grid, building health, breaker visuals) | utils/mod/ (10 files) | not checked | |

### Shared helpers (`utils`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 74 | Game data | utils/constants/items.ts, store.ts, GameObject.ts, PlayerInitType.ts | not checked | Compared with 1.8.2 earlier |
| 75 | Geometry and angles | utils/utils/geometry/ (8), angle/ (5), utils/types/geometry/Vec2.ts | not checked | Mostly tested |
| 76 | Small helpers (math, random, storage, DOM, emoji text) | utils/utils/math/, random/, storage/, dom/, text/ | not checked | Mostly tested |

### Launcher (`falcon-launcher`)

| # | Feature | File(s) | Status | Earlier work |
|---|---|---|---|---|
| 77 | Background worker (injects the mod) | src/background.ts, manifest.json | not checked | Host access limited to https |
| 78 | Page loader (shared with Quick Inject) | src/gameLoader.ts, mod-source/packaging/build-inject.mjs | not checked | |
| 79 | Content script | src/remove.js | not checked | |

## 1.8.2 differences

Compared on 1 Nov 2026 against the saved 1.8.2 client: `sandbox.moomodding.io/1.8.2/assets/index-8f264913.js` (sha256 starts `1649c73c68f22cc4`), plus `hackfix.js` and `docs/versions.txt`. Method: the client's packet handler for each letter, every `send` call, its item/store tables and its game config object, evaluated and compared value by value with Falcon's.

### Needs a code change (all fixed on 1 Nov 2026, see the progress log)

| # | What changed | Where in the mod | How to fix | Changes behaviour? |
|---|---|---|---|---|
| 1 | **Packet `Z` means two things.** In 1.8.2, `Z` is the server-restart countdown: `[seconds]`. Falcon also uses `Z` for its own placement-marker packet (5 values: x, y, angle, item, type), which only exists in replays, and its live handler is the marker one. A real restart warning would draw a broken marker at x = seconds, and the countdown would never show | [PacketMap.ts:32](mod-source/src/utils/socket/PacketMap.ts:32), [SocketListener.ts:486](mod-source/src/core/socket/SocketListener.ts:486), [PlacementSystem.ts:166](mod-source/src/core/mod/combat/core/PlacementSystem.ts:166) | Give Falcon's marker packet its own name that the game never uses (for example `falcon:marker`). In the replayer, still read old recordings' 5-value `Z` as a marker. Add a `Z` handler that shows "Server restarting in m:ss" | Fixes a wrong marker; adds the countdown notice |
| 2 | **Packet `B` (disconnect with a reason) has no handler.** 1.8.2 sends `B [reason]` before closing, and its client closes and shows the reason. Falcon ignores `B`, so you only see "No reason provided (code 1005)" | [SocketListener.ts](mod-source/src/core/socket/SocketListener.ts), [Socket.ts onClose](mod-source/src/core/socket/Socket.ts) | Handle `B`: remember the reason, close the socket, and show the reason on the disconnected screen | Shows the server's reason instead of a generic one |
| 3 | **Building upgrades skip their prerequisite.** The game stores each building's prerequisite as "N items back" (castle wall: 1 back = stone wall) and turns it into a real item ID when it loads. Its upgrade menu then only offers a building if you own the one before it. Falcon keeps the raw "N back" values, never converts them, and its upgrade menu doesn't check buildings at all, so it can offer, say, castle wall without stone wall (weapons are checked correctly) | [items.ts](mod-source/src/utils/constants/items.ts) (`pre` on list items), [updateUpgrades.ts:36](mod-source/src/core/events/updateUpgrades.ts:36) | Convert `pre` to an item ID once at load, the same way the game does, and apply the same check to buildings in the upgrade menu (local private servers keep skipping the check, as for weapons) | **Yes**: the upgrade menu will offer fewer choices, matching the real game |
| 4 | Version-specific values are spread over several files | [Endpoints.ts](mod-source/src/utils/constants/Endpoints.ts) (version, token, hosts), [PacketMap.ts](mod-source/src/utils/socket/PacketMap.ts) (1.8.2 packet lists, cipher mode), [LegacyPacketAdapter.ts](mod-source/src/core/socket/LegacyPacketAdapter.ts) (layouts), [scriptConfiguration.json](mod-source/src/utils/utils/config/scriptConfiguration.json) (constants) | New `constants/gameVersion.ts` holding the supported version, the 1.8.2 packet lists and strides, the cipher mode and the token. The other files import from it | No |
| 5 | No version check | (none) | At startup, before Falcon replaces the page, read the game's version from the page (`<base href="/1.8.2/">`) and log a clear console warning if it isn't 1.8.2 | No (warning only) |

### Possible issues: please decide

| # | What I found | Why I'm not sure |
|---|---|---|
| 6 | Falcon pings the server every **1 s**; the 1.8.2 client pings every **2.5 s** ([SocketListener.ts:165](mod-source/src/core/socket/SocketListener.ts:165)) | Falcon pings faster on purpose, to show a live ping. It only matters if moomodding's server limits pings; I have no sign that it does. Suggest leaving it |

### Checked, no change needed

| # | What | Result |
|---|---|---|
| 7 | Game constants | Map size 14400, snow line 2400, player speed 0.0016, friction 0.993, hit/gather/shield angles, gather wiggle, 9 ticks/s (111 ms), weapon variants (gold/diamond/ruby XP and multipliers), river width 724, water current 0.0011, snow speed 0.75: all identical. The shield angle only differs in the 16th decimal place (rounding) |
| 8 | Items, weapons, hats, accessories | Same 14 groups, 6 projectiles, 16 weapons, 23 items, 46 hats, 21 accessories, same IDs, order and stats. Falcon's extra fields (ranged weapon damage, windmill spin 0) are its own additions |
| 9 | Player updates (`a`) and animals (`I`) | 13 and 7 values per entry in 1.8.2, converted by `LegacyPacketAdapter`, as before |
| 10 | Spawn (`D`) | Same 10 values: id, sid, name, x, y, dir, health, max health, scale, skin colour |
| 11 | All other server packets | Same number and order of values for `A C E G H J K L M N O P Q R S T U V X Y g 1-9 0` |
| 12 | Client packets | Same IDs and values as the 1.8.2 client: join `M` {name, moofoll, skin}, move `9`, aim `D`, hit `F`, select `z`, upgrade `H`, auto-gather `K`, store `c` (Falcon's true/false = the client's 1/0), chat `6` (30-character limit kept), clan packets, ping `0`. Falcon never sends the newer-only `T R A V` |
| 13 | Free cosmetics (1.8.2 unlocks every hat at spawn) | The 1.8.2 client marks a hat as owned from the server's `5` store packet; Falcon reads `5` the same way |
| 14 | Packets Falcon knows that 1.8.2 never sends (`W` boss info, `F` player stats, Falcon's own `p` and `t`) | Never arrive on 1.8.2, so they're harmless. `p` and `t` don't clash with any 1.8.2 packet |
| 15 | Page elements and globals | Falcon only reads its own HTML. It shares the game's `moo_name` / `moo_skin` localStorage keys, and works around the site's `window.WebSocket` wrapper |

## Progress log

### Step 0.5c: 1.8.2 fixes (1 Nov 2026)

| Row | Result | Commit | Tests added |
|---|---|---|---|
| 1. `Z` clash | Falcon's marker packet renamed to `falcon:marker`. `Z` now shows "Server restarting in m:ss". Old recordings still replay their markers | `2c79092`, `c80b784` | `server-notices.test.ts` (3, 2 fail on the old code), recorder test for old and new `Z` (fails on the old code) |
| 2. `B` reason | Reason saved as soon as it arrives, socket closed, reason shown on the disconnected or connection-error screen | `6d9a922` | `disconnect-reason.test.ts` (3, 2 fail on the old code) |
| 3. Building prerequisites | `pre` converted to item IDs the way the game does (castle wall 4, poison and spinning spikes 7, faster windmill 10, power mill 11). The upgrade picker and Auto Upgrade check them | `dd7423c` | `upgrades.test.ts` (5, 3 fail on the old code) |
| 4. One version file | `utils/constants/gameVersion.ts`. Endpoints, PacketMap, PacketManager, Socket and LegacyPacketAdapter read from it | `8ecfd6b` | None needed: replay fingerprints unchanged on all 3 recordings, and the cipher test still matches the client |
| 5. Version check | Console message at startup: supported, different version, or unreadable. Only on sandbox.moomodding.io | `9888ca2` | `game-version.test.ts` (7). It also reads 1.8.2 from the real saved page |

After these: `npm run build` OK, `npm test` 114 passed (1 opt-in test skipped), `npm run lint` 0 errors, `npm run typecheck` clean.

### Step 1: features

Possible issues waiting for a decision are listed under "Possible issues (Step 1)" below.

| # | Feature | What it does | Problems found | Fixed | Optimized | Tests added | Result |
|---|---|---|---|---|---|---|---|
| 1 | Velocity Hits | If an enemy stands next to a spike owned by us or another player, and a bull-helmet polearm hit plus that spike would deal 100 or more, it queues a bull hit | Fake ticks make it ignore the update-order check (P1) | P1: waits for a real tick | No. The loop is short and stops at the first spike; its other checks are one-line comparisons | `features/velocity-hits.test.ts` (8): 100-damage threshold, toggle, spike owner, update order, Monkey Tail, range. Plus `test/helpers/game.ts`, a scripted-game helper for feature tests | tested |
| 2 | Knockback Hits | Simulates a bull-helmet polearm hit and its knockback for one tick. If that would kill (spike damage on top of the hit reaching full health; the simulation assumes the enemy heals), pit-trap the enemy, or push them through 3+ spikes, it queues the hit | Fake ticks: with no update order it always assumes the knockback lands next tick (P1) | P1: waits for a real tick | No. It reuses its simulation actions; nothing is allocated per tick | `features/knockback-hits.test.ts` (5), checked from the packets sent in real ticks: switch to polearm, bull helmet, aim at the enemy, hit, and again after reload; nothing without a spike, with a spike too far, with the toggle off, or out of range | tested |
| 3 | Knockback Instakills | A two-hit combo: bull helmet + primary, then turret gear + secondary (reversed against a great hammer or a Spike Gear target). Fires when the simulated combo pushes the enemy into a spike, kills or pit-traps them | **(a)** Falcon guessed *our own* secondary like an enemy's (a musket) until we had held it once, though UPDATE_ITEMS tells it exactly. Combos switched to a weapon we don't own (great hammer → "switch to musket"), and the guess code kept marking our musket reloaded, so it planned combos with an unloaded musket. **(b)** The reversed combo applied the Monkey Tail damage cut to a projectile secondary. Fake ticks (P1) | (a) `PlayerCombatManager.update` uses `player.weapons` for us and keeps guessing only for others. (b) Passes `hasProjectile`, as the normal combo does | No. Reuses its simulation actions | `features/knockback-instakills.test.ts` (8): normal and both reversed combos, no repeat while the musket reloads, our real great hammer, no spike / no secondary / toggle off, the Monkey Tail damage estimate. 4 fail on the old code | fixed + tested |

| 4 | Apple Insta / Shame Grind | Apple Insta: while spike placements are graded, it marks a spike next to a trapped enemy when our great hammer can break the trap in one hit (292 with tank gear, so only an already-damaged trap). Then: tank gear + hammer on the trap, bull helmet + primary, and the spike goes where the trap was. Shame Grind: **not implemented**. It's greyed out in the menu and no code reads it | The code requires the **Replacements** toggle; the menu says it needs **Preplacements**, and the marks it uses only survive on preplacement spikes (P2). Found while testing: 8 toggles (Auto Place among them) had no starting value, so `Menu.setValue()` skipped them and the toggle tests left them out | Toggle defaults set to `false` (no behaviour change; commit `26c2f90`). P2: now checks Preplacements | No. It only builds its attack callback when it actually attacks | `features/apple-insta.test.ts` (10): marking (one-hit trap, too much trap health, no hammer, enemy not trapped, low-damage primary setting), the combo's weapons, hats and aim, waiting for the intent, and the 3 toggles it needs today | tested |

| 5 | Spike Tick | While spike placements are graded, it marks a spike next to a trapped enemy if our primary is reloaded and can reach them. When AutoReplacer places such a spike (after a trap breaks), it sets a flag, and on the next tick Spike Tick does a bull-helmet hit | The flag was only cleared by the hit itself. If Spike Tick couldn't run on that tick (toggle off, Monkey Tail, already attacking), the flag stayed set, and it fired a stray bull hit whenever it next could. Spikes are marked even with the toggle off, so turning Spike Tick on later hit at once (confirmed in a test). Note: it reuses Apple Insta's "Allow Low Damage Primaries" setting | The flag is used up on every check, so a missed chance is dropped | No | `features/spike-tick.test.ts` (8): marking (trapped, range, low-damage primary setting), hitting on the next tick, nothing without a flag, the missed-chance case (fails on the old code), Monkey Tail | fixed + tested |

| 6 | Dynamic One Tick | Lands a turret-gear bullet and a bull-helmet hit on the same tick with a diamond polearm or ruby katana (25 + 53.1 × 1.5 = 104.65), from 195–265 units while moving in. Holds back against Soldier Helmet (×0.75, unless "Ignore Hats") and EMP Helmet (no turret damage). T toggles "Active" tap mode, which walks you to ~214 units with booster/tank/soldier hats; it turns itself off without a polearm | Fake ticks (P1, fixed). `willStayInSoldier`'s second reload check can never be true (P3) | P1 | No. It allocates two small step objects only when a one tick is possible | `features/one-tick.test.ts` (6): turret then bull, stone polearm too weak, toggle off, Soldier Helmet with and without "Ignore Hats", EMP Helmet, Monkey Tail | tested |

| 7 | Projectile Sync | Bull-helmet hit timed with projectiles (turret bullets, arrows, musket shots) predicted to hit the enemy next tick, when our hit plus those reaches 100. The prediction comes from ProjectileManager's simulation | None found. Note: like the other hit modules it uses a fixed 100 instead of the enemy's health, and doesn't count the enemy's hat | - | No. One short loop | `features/projectile-sync.test.ts` (6), with real ADD_PROJECTILE packets: musket bullet → hit on the tick it arrives, arrow too weak, no projectile, toggle off, out of range, Monkey Tail | tested |

**Behaviour change in #3 (a):** the replay fingerprints changed for `sample-base` and `sample-busy` (`test/fixtures/replay-fingerprints.json` updated). In those recordings the server never shows us holding the musket, so the old code thought it was always reloaded and kept attempting combos (161 musket switches, 123 bull helmets on sample-busy). The new code: 1 and 18. In a real game the old behaviour only lasted until we held our secondary once, but every combo it planned in that window used an unloaded weapon.

## Possible issues (Step 1)

P1 and P2: fixed as suggested on 1 Nov 2026 (commits `c0b125e`, and the P2 commit after it); see the Result column.

| # | Where | What I found | Why I'm asking | Result |
|---|---|---|---|---|
| P1 | VelocityAttacker, AutoAttacker, AutoInstakiller, AutoMeleeSyncer, OneTicker, SpikeGrader, DefenseSystem, AutoBreaker, DefensiveKnockbacker, MovementPhysicsSimulator (all read `PlayerStateManager.placementMap`) | The "who updates first on the server" order (gold tech) comes from the last real player update. Falcon's fake ticks, sent when a real one is late, carry no positions, so the order is empty and every comparison is false. Each module then guesses differently: Velocity Hits attacks even when the enemy really updates first (confirmed in a test). `ModManager` already skips these checks on fake ticks | The safe fix (skip order-based decisions when the order is unknown, as ModManager does) changes when these modules fire on laggy connections. Alternative: keep the previous real tick's order through a fake tick | **Fixed** (`c0b125e`): `PlayerStateManager.updatesBefore()` returns null when the order is unknown. Attacks wait for a real tick, Melee Sync skips that enemy, SpikeGrader leaves the spike-tick hit out, AutoBreaker assumes the enemy's knockback lands first, and DefenseSystem / the simulator keep their (safe) results, now explicit. `features/fake-ticks.test.ts` (3) |
| P2 | [AppleInstakiller.ts:48](mod-source/src/core/mod/combat/modules/AppleInstakiller.ts:48) | Apple Insta only runs with **Replacements** on. Its menu text says it needs **Preplacements**, and the spike marks it relies on only survive on preplacement spikes ([SpikeGrader.ts](mod-source/src/core/mod/combat/placing/grader-modules/SpikeGrader.ts) clears them on replacement spikes next to a trapped enemy). So it looks like the check should be `preplacer`, and today it silently does nothing with Preplacements on and Replacements off | Changing the check changes when Apple Insta runs. The other option is to keep the code and fix the menu text instead | **Fixed**: checks Preplacements now. Both toggles are on by default, so default setups are unchanged (replay fingerprints too). New test: runs with Preplacements on and Replacements off (fails on the old code) |
| P3 | [OneTicker.ts:116-117](mod-source/src/core/mod/combat/modules/OneTicker.ts:116) `willStayInSoldier` | `if (reload + tick < 1) return true; if (reload + 2 * tick < 1) return true;`: the second line can never be true when the first wasn't, so it does nothing. It probably meant something else, e.g. "the enemy can't swing within the next two ticks" (`reload + 2 * tick >= 1` → false) | Removing it changes nothing. Guessing what it was meant to do would change when One Tick holds back against a soldier-to-tank switch. I suggest removing it unless you know the intent | Waiting |
