// ==UserScript==
// @name          Robotics kusoi

// @match        *://sandbox.moomodding.io/*
// @grant         none
// @run-at        document-start
// @version       v1.9.0
// @author        Yurio, Oe And Brt3726
// @description   Mod With Try Out Bundle Testing real
// @require       https://cdn.jsdelivr.net/npm/msgpack-lite@0.1.26/dist/msgpack.min.js
// ==/UserScript==

/*
@ScriptFlow
{
  "name": "Robotics (Kusoi version)",
  "match": [
    "*://sandbox.moomodding.io/*"
  ],
  "grant": [
    "none"
  ],
  "version": "v1.9.0",
  "author": "Yurio, Oe And Brt3726 <= all skids btw",
  "description": "Mod With Try Out Bundle Testing real",
  "require": [
    "https://cdn.jsdelivr.net/npm/msgpack-lite@0.1.26/dist/msgpack.min.js"
  ]
}
*/

/* ===========================================================================
   CHANGELOG
   ---------------------------------------------------------------------------
   v1.9.0
   Security
   - Removed the remote song-timing fetch + eval(). It ran a GitHub file
     with full page access on every load; nothing used its result.
   - External sync socket (robotics-ahh.fly.dev) is opt-in: "External Sync"
     toggle in the Others tab, off by default; turning it off closes the
     socket. Removed the server message that made this client send ["H",[69]].
   - ScriptFlow match narrowed to sandbox.moomodding.io (was *.moomoo.io and
     all of *.moomodding.io). Removed the moomoo.io captcha auto-clicker.
   - Chat log escapes player names and chat. A chat message such as
     <img onerror=...> used to run as code in your page.
   Timing: one scheduler
   - fU is now the only scheduler: driven by server ticks, a fixed ring of
     slots (no growing array), fallback ticks when the server is quiet,
     every callback in its own try/catch. Moved onto it: the auto-heal
     interval (had no delay, ~250 runs/s), the ping interval (a new one per
     spawn), the 20 s sync/cleanup, the song loop, per-player shame timers,
     the packet counter, the 69 ms auto-gather lock, the 50 ms insta reset
     and per-projectile timeouts. Removed the 5 s server-list refresh (no
     API on this host), the unused 75 ms heal-spam interval and the unused
     pathfinding Web Worker.
   Packets: one limiter
   - Every packet goes through roboticsLimiter (CONFIG.packets): 69 per
     sliding second, 12 per tick, priorities (heal/spawn > combat > aim/move
     > chat/buy), a heal reserve, newest-only aim/move/ping. Place and heal
     sequences go out whole or not at all; placing leaves 4 packets per tick
     for combat. Removed A1(), which bypassed every limit.
   - Hat/accessory requests are merged per tick and not re-sent while the
     server has not confirmed them.
   Fixes (ids from the audit)
   - C1-C6 crashes when a player/object is gone or a weapon variant is
     unknown (health, damage loop, gather damage, object kill, attacker
     match, breaker target). C7 G key crash. C8 /bye. C9 preplacer angles
     (getDirection, far objects). C10 leaderboard guard.
   - T1-T3 auto-heal: same rules, but runs on your health packet, each tick
     and each frame, uses your own damage threat, and only your own health
     changes reset its timer.
   - T4 ping: one task every 9 ticks, timestamped when actually sent.
   - T5 your weapon counts as reloaded at RTT/2 (was full RTT).
   - T6 threat: melee always counts bull x1.5 (no check of the wrong
     player's hat); poison counted once, not once per enemy.
   - T7 leastDamageThreat accumulates. T8 checkCanInsta uses its own
     weapons. T9 canBeBroken uses the enemy weapon's building damage, and
     your tank gear only if you own it.
   - T10 tick callbacks also run while dead (instas could stay locked after
     death); Z clears pending callbacks instead of resetting the tick.
   - T11 anti0tick typo (soldier in trap). T12 anti bow-insta / projectile
     sync could never run; counters now only undo what they added.
   - T13 Render Direction option works; katana/musket check compares to you.
   - T14 E key: auto gather state stays in sync, and the mod returns to your
     choice when idle. T15 join-request filter; object cleanup skip.
   - R1 no double heals (heals in flight are tracked).
   - M2 death markers pruned. M3 chat log capped (CONFIG.chatLogLimit).
     M5 songs download when first played.
   Found while fixing
   - Per-hit damage (AK.damaged) used oldHealth, which never updates, so
     anti-insta, spike-hit and bull-tick checks saw wrong numbers.
   - Other players' bull drain moved your bull-tick timing.
   - Untouched menu dropdowns now do what they show (hat type, counter
     insta, render direction, safe walk, preplacer, song).
   - Space hit never fired ("Space" vs " "). Song chat crashed with no
     saved song choice.
   Ported from Falcon (each has a menu toggle, off by default, and a key)
   - Smart Anti-Insta (Defensive tab, j): when this tick's predicted damage
     kills you, EMP helmet if blocking the turret part is enough, else
     soldier, else heal. Uses Robotics' threat numbers and hat flags; the old
     instant heal + EMP/soldier guess still runs when the toggle is off.
   - Projectile Sync (Offensive, k): bull hit when arrows/bullets from you
     or teammates (or your turrets about to fire) plus the hit kill.
   - Velocity Hits (Offensive, i): bull hit when the enemy's next position
     touches a spike that hurts them and they update after you.
   - Dynamic One Tick (Offensive, u; t still arms one): simulates both
     players two ticks ahead (Falcon's movement physics simulator) to pick
     toward/stop/away for the turret-gear tick and the bull-hit tick, counts
     spikes the knockback pushes them into, soldier and EMP. Replaces the old
     velocity check and the four unused/unfinished tick modes.
   - Graded Preplace (Offensive, o, needs Preplacer): exact free angles
     against every nearby object and the river, sampled and graded with
     Falcon's spike/trap graders (alignment, spikes and traps near the enemy,
     simulated bounce into spikes / trap / teleporter).
   - Spatial grid (always on): objects bucketed by chunk plus an sid map.
     Nearby objects, trap checks, player collisions and sid lookups use it.
   Found while porting
   - Projectiles were never added (addProjectile was never called), so
     arrows and bullets were not drawn and never counted as incoming damage.
     They are tracked now, with their shooter.
   - The projectile tick update moved x2 twice per tick; and hits are now
     checked along the projectile's path against the player radius.
   Performance (offline benchmark: same seeded packet replay, ~900 objects,
   8 enemies, 1280x720 canvas, 3 runs each, same browser session)
                       tick handler avg / p95     frame avg / p95
     v1.8.5            5.52 / 9.9 ms              17.3 / 44.2 ms
     v1.9.0 Phase 3    4.44 / 7.9 ms              16.9 / 42.2 ms
     v1.9.0 Phase 4    2.08 / 3.6 ms               5.6 / 20.2 ms
   - Distance/direction helpers no longer allocate two objects per call.
   - Rendering draws only objects near the camera (grid) and computes the
     "objects your aim hits" list once per frame instead of once per drawn
     building per layer; the off-screen check now also culls below the screen.
   - Remaining full-object loops use the grid: turret reloads (a turret set),
     spike-tick knockback, knockback prediction, auto push, the projectile
     line check; grid chunks are 300 px (CONFIG.grid.chunk).
   - Pathfinder marks each obstacle's cells once instead of testing every
     obstacle against all 10,000 cells; auto place no longer copies every
     nearby object per call.
   - Hat/accessory lookups use id maps, weapon damage per variant is a table;
     action bar, name widths and the debug marker no longer query the DOM or
     measure text every frame.
   - Removed dead code: duplicate Utils class, duplicate draw helpers, unused
     classes (s1, s2, eh, ei), unused functions and variables, snowflakes,
     starfield, night overlay, server browser, WebGL sprite path, unused menu
     builder methods and helper methods.
   - Fix: spike-tick knockback read the enemy's .weapons list, which is never
     filled in for other players, so it always assumed a tool hammer.
   Falcon port, part 2 (toggles off by default unless noted; keys in CONFIG.keys)
   - Packet Budget Limit / Strictness (Others tab): packets per second and
     how many stay free for heals (3 x strictness + 3). Defaults = CONFIG.
   - Artificial Ping (Others, 0): handles server packets amount/2 ms later.
   - Follow SID (Others): Player Follow follows that player id.
   - Safe Walk also stops at boost pads and teleporters; your team's
     teleporters / boost pads only with "Avoid My Teleporters" / "Avoid Ally
     Boost Pads" (both on by default, as in Falcon).
   - One Tick Ignores Hats (Offensive): Dynamic One Tick counts full damage.
   - Enemy placement potential: where each enemy within 400 px could put a
     spike next tick and whether one would touch you (used by the modules).
   - Menu: settings rows without a checkbox, number fields; typing in a menu
     field no longer fires keybinds or moves you, handled keys don't reach the
     browser (Firefox quick find on / and ').
   - Player state: last tick's reload state, the tick each weapon reloaded,
     the tick of the last gather animation and the last health drop.
   - Attack modules (Offensive tab), at most one per tick, in this order:
     Knockback Instakills (p, + "In Trap"), Apple Insta (-, + "In Trap",
     "Low Damage"), Velocity Hits, Projectile Sync, Melee Sync (=, partner
     SID in its field), Knockback Hits (b), Auto Push Strikes ([, Shame
     Strike / Predictive / Bullspam per weapon, shame threshold), Turret
     Bullet Assist (;), Barbarian Knockback ('), Turret Gear Knockback (]).
     Knockback checks run Falcon's movement simulator on the enemy.
   - Falcon's Turret Gear Knockback only fired when the turret could NOT
     reach the enemy (inverted line check); it now needs a clear line.
   - Defensive tab: Pattern Recognition (Home) ignores some baited spike
     tick threats; Smart Hats (End) soldier only when the enemy's weapon can
     hurt you now; Counter Insta "Falcon" mode + Force Anti Bull: spike gear
     only when the enemy just reloaded, never with 4+ shame or when nearby
     bull hits add up to 100, counter hit only when it kills.
   - Graded Auto Place (Offensive, /, with Auto Placer): the 4 best graded
     non-overlapping spikes/traps per tick while an enemy is within Auto
     Place Range; Angle Finder Level 1-10 (16-70 candidates per item), Two
     Tick Placements. With Auto Replacer on, replacements after a break are
     graded on the angles the broken object covered.
   - Kept Robotics' versions: Spike Tick (Falcon's is the same idea - bull
     hit when a placed spike lands next to a trapped enemy - but hangs off its
     own placement pipeline; Robotics' already does it from its placer and
     adds the turret follow-up) and the breakers (Falcon's AutoBreaker is the
     same idea; Robotics' one is already tied into its hats and reloads).
   - Not ported: Shame Grind and Blood Wings are stubs / disabled in Falcon
     itself, so there is nothing to port.
   - Timing (same benchmark as above, alternating runs): Phase 4 build
     1.99 / 3.4 ms tick; part 2 with its toggles off 1.95 / 3.3 ms; with every
     Falcon toggle on 2.21 / 3.7 ms. Frames stay at ~6.2 ms.
   Other
   - CONFIG block with keybinds, scheduler, packet budget, sync, reload.
   - Status line adds frame and tick handler time (avg/max ms per second)
     and queued packets; written once a second instead of every frame.
   - The render loop survives a failing frame. Removed debug console spam.
   =========================================================================== */

/* ===========================================================================
   CONFIG - edit settings here, not at the call sites.
   Feature on/off switches live in the in-game menu (Esc); they are saved in
   localStorage under the ids shown in the menu code (fu.<id>).
   =========================================================================== */
const CONFIG = {
    version: "v1.9.0",

    /* Keybinds use KeyboardEvent.key, so letters are case sensitive
       ("Z" means Shift+z). Hold keys act every tick while held. */
    keys: {
        menu: "Escape",          // open/close the mod menu
        markMap: "c",            // mark your position on the minimap
        song: "C",               // start/stop song chat (on key release)
        autoGather: "e",         // toggle auto gather
        selectWeapon: "q",       // re-select your current weapon
        heal: "q",               // hold: eat
        trap: "f",               // hold: place traps
        spike: "v",              // hold: place spikes
        stoneOrSapling: "y",     // hold: place item slot 5
        turretType: "h",         // hold: place turret/platform/etc.
        mill: "n",               // hold: place windmills
        autoMill: "z",           // toggle placing mills behind you
        spawnPads: "m",          // toggle placing spawn pads behind you
        lockDir: "x",            // lock your aim direction
        hit: " ",                // hit once with the current weapon
        velocityTick: "t",       // toggle the velocity one tick
        boostTick: ".",          // hold: boost tick
        followPlace: "l",        // hold: follow the selected player and trap them
        pauseAuto: "Shift",      // pause auto push / auto play for 5 seconds
        resetMod: "Z",           // reset stuck combat state
        smartAntiInsta: "j",     // toggle Smart Anti-Insta (Falcon)
        projectileSync: "k",     // toggle Projectile Sync (Falcon)
        velocityHits: "i",       // toggle Velocity Hits (Falcon)
        dynamicOneTick: "u",     // toggle Dynamic One Tick, automatic (Falcon); "t" still arms one
        gradedPreplace: "o",     // toggle Graded Preplace (Falcon)
        knockbackHits: "b",      // toggle Knockback Hits (Falcon)
        knockbackInsta: "p",     // toggle Knockback Instakills (Falcon)
        pushStrikes: "[",        // toggle Auto Push Strikes (Falcon)
        turretGearKB: "]",       // toggle Turret Gear Knockback (Falcon)
        turretAssist: ";",       // toggle Turret Bullet Assist (Falcon)
        barbKB: "'",             // toggle Barbarian Knockback (Falcon)
        appleInsta: "-",         // toggle Apple Insta (Falcon)
        meleeSync: "=",          // toggle Melee Sync (Falcon)
        gradedAutoPlace: "/",    // toggle Graded Auto Place (Falcon)
        artificialPing: "0",     // toggle Artificial Ping (Falcon)
        patternRec: "Home",      // toggle Pattern Recognition (Falcon)
        smartHats: "End",        // toggle Smart Hats (Falcon)
        debugAngles: "g",        // hold: draw free trap angles (debug)
        debugChat: ",",          // debug: send the debug menu's 2nd field as chat
        debugMenu: "\\"          // debug: show the test input menu
    },

    /* One scheduler runs everything that used to be on separate timers.
       It ticks on every server player update ("a" packet, ~111 ms). When no
       update has arrived for fallbackAfter ms (main menu, dead) it runs its own
       ticks at the same rate so respawn and ping still work. */
    tick: {
        rate: 1000 / 9,
        fallbackAfter: 1000,
        slots: 256               // how far ahead tickBase() can schedule
    },

    /* Every packet (mod and game) goes through one limiter.
       perSecond is a sliding 1 s window, perTick a per-tick cap. Healing and
       spawning ignore perTick and may use the reserve; everything else stops
       at perSecond - reserve. Over-budget packets wait for the next tick;
       chat, buying and clan packets are dropped when the queue is full. */
    packets: {
        perSecond: 69,
        perTick: 12,
        reserve: 9,
        placeReserve: 4,         // per-tick room placing leaves free for hits, weapon swaps and hats
        queueLimit: 48
    },

    /* Optional sync server for "Primary Sync" and the green/red names of
       other Robotics users. It only connects while the "External Sync" menu
       toggle (Others tab) is on - off by default. When on it sends, every 20 s:
       {action: "update", data: {sid, name, server, sync, ping, x2, y2}}. */
    sync: {
        url: "wss://robotics-ahh.fly.dev",
        retryMin: 5000,
        retryMax: 60000,
        updateTicks: 180
    },

    /* Spatial grid chunk size for game object lookups. Falcon uses 1440; Robotics
       mostly asks for small areas (150-500 px), where 300 px chunks scan far fewer
       objects. */
    grid: {
        chunk: 300
    },

    /* Rejoin after a disconnect, at most `limit` reloads per `window` ms. */
    reload: {
        key: "robotics_kusoi_reloads",
        limit: 3,
        window: 60000,
        delay: 3000
    },

    /* Frame time / tick handler time readout next to Ping and FPS. */
    perfReadout: true,
    pingEveryTicks: 9,
    chatLogLimit: 200
};

/* Hats / accessories / weapons / animals are loaded from whichever site the
   script runs on, instead of a hardcoded moomoo.io URL. Resolved lazily because
   at document-start the <base href="..."> tag may not be parsed yet. */
let ROBOTICS_IMG_BASE = null;

function roboticsImg(path) {
    if (!ROBOTICS_IMG_BASE) {
        try {
            ROBOTICS_IMG_BASE = new URL("img/", document.baseURI).href;
        } catch (err) {
            ROBOTICS_IMG_BASE = window.location.origin + "/img/";
        }
    }
    return ROBOTICS_IMG_BASE + String(path).replace(/^\/+/, "");
}

/* @run-at document-start is required for the packet hook: the host client does
   `const nativeSend = WebSocket.prototype.send` while it loads, then calls that
   cached reference. A hook installed at document-idle is therefore bypassed.
   This trampoline is installed before the page scripts and forwards to the mod
   once its handler is registered at DOMContentLoaded. */
const ROBOTICS_NATIVE_SEND = (function () {
    try {
        const proto = WebSocket.prototype;
        const nativeSend = proto.send;
        window.__ROBOTICS_SEND_HANDLER = null;
        proto.rsend = nativeSend;
        proto.send = function (data) {
            const handler = window.__ROBOTICS_SEND_HANDLER;
            if (typeof handler === "function") {
                try {
                    return handler.call(this, data);
                } catch (err) {
                    console.warn("[Robotics] send hook failed; forwarding the packet unmodified.", err);
                    return nativeSend.call(this, data);
                }
            }
            return nativeSend.call(this, data);
        };
        return nativeSend;
    } catch (err) {
        console.warn("[Robotics] could not install the early WebSocket hook:", err);
        return null;
    }
})();

/* Run fn and log failures without stopping the caller. The same error is
   logged at most 3 times, then every 200th time, so a per-tick failure
   cannot flood the console. */
const ROBOTICS_ERROR_COUNTS = new Map();
function roboticsSafeCall(fn, label) {
    try {
        return fn();
    } catch (err) {
        const key = label + ":" + (err && err.message);
        const count = (ROBOTICS_ERROR_COUNTS.get(key) || 0) + 1;
        ROBOTICS_ERROR_COUNTS.set(key, count);
        if (count <= 3 || count % 200 === 0) {
            console.warn("[Robotics] " + label + " failed (x" + count + "):", err);
        }
    }
}

function roboticsHasMsgpack() {
    return typeof window.msgpack !== "undefined" &&
        typeof window.msgpack.encode === "function" &&
        typeof window.msgpack.decode === "function";
}

/* Rate-limited reload used by the socket-close handler and the captcha check.
   A connection close may still trigger a rejoin, but a flapping server can no
   longer put the tab into an endless reload loop. */
function roboticsSafeReload(reason) {
    try {
        const now = Date.now();
        let state = { count: 0, first: now };
        try {
            state = JSON.parse(sessionStorage.getItem(CONFIG.reload.key) || "null") || state;
        } catch (err) { /* storage unavailable */ }
        if (!state.first || now - state.first > CONFIG.reload.window) {
            state = { count: 0, first: now };
        }
        if (state.count >= CONFIG.reload.limit) {
            console.warn("[Robotics] reload skipped (" + reason + "): already reloaded " + CONFIG.reload.limit + " times in " + (CONFIG.reload.window / 1000) + "s. Reload manually once the connection is stable.");
            return false;
        }
        state.count++;
        try {
            sessionStorage.setItem(CONFIG.reload.key, JSON.stringify(state));
        } catch (err) { /* storage unavailable */ }
        console.warn("[Robotics] reloading in " + (CONFIG.reload.delay / 1000) + "s (" + reason + ", attempt " + state.count + "/" + CONFIG.reload.limit + ")");
        setTimeout(function () {
            window.location.reload();
        }, CONFIG.reload.delay);
        return true;
    } catch (err) {
        console.warn("[Robotics] reload skipped (" + reason + "):", err);
        return false;
    }
}

function getEl(e) {
    return document.getElementById(e);
}

function removeEl(e) {
    if (e && typeof e.remove === "function") {
        e.remove();
    }
}
/* Everything below touches the page DOM, so it starts once the document has
   been parsed. The WebSocket hook above is already active. */
function roboticsStart() {
let serverID;
(function (e) {
    let s = {};
    function V(r) {
        if (s[r]) {
            return s[r].exports;
        }
        let c = {
            exports: {}
        };
        e[r](c, c.exports, V);
        s[r] = c;
        return c.exports;
    }
    V.s = "_main_script_";
    return V(V.s);
})({
    "config.js": function (e, s) {
        e.exports.maxScreenWidth = 1920;
        e.exports.maxScreenHeight = 1080;
        e.exports.serverUpdateRate = 9;
        e.exports.maxPlayers = 40;
        e.exports.maxPlayersHard = e.exports.maxPlayers + 10;
        e.exports.collisionDepth = 6;
        e.exports.minimapRate = 3000;
        e.exports.colGrid = 10;
        e.exports.clientSendRate = 5;
        e.exports.healthBarWidth = 50;
        e.exports.healthBarPad = 4.5;
        e.exports.iconPadding = 15;
        e.exports.iconPad = 0.9;
        e.exports.deathFadeout = 3000;
        e.exports.crownIconScale = 60;
        e.exports.crownPad = 35;
        e.exports.chatCountdown = 3000;
        e.exports.chatCooldown = 500;
        e.exports.isSandbox = /(sandbox|dev)/i.test(window.location.hostname) ? true : false;
        e.exports.maxAge = 100;
        e.exports.gatherAngle = Math.PI / 2.6;
        e.exports.gatherWiggle = 10;
        e.exports.hitReturnRatio = 0.25;
        e.exports.hitAngle = Math.PI / 2;
        e.exports.playerScale = 35;
        e.exports.playerSpeed = 0.0016;
        e.exports.playerDecel = 0.993;
        e.exports.nameY = 34;
        e.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b", "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3", "#8bc373"];
        e.exports.animalCount = 7;
        e.exports.aiTurnRandom = 0.06;
        e.exports.cowNames = ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"];
        e.exports.shieldAngle = Math.PI / 3;
        e.exports.weaponVariants = [{
            id: 0,
            src: "",
            xp: 0,
            val: 1
        }, {
            id: 1,
            src: "_g",
            xp: 3000,
            val: 1.1
        }, {
            id: 2,
            src: "_d",
            xp: 7000,
            val: 1.18
        }, {
            id: 3,
            src: "_r",
            poison: true,
            xp: 12000,
            val: 1.18
        }];
        e.exports.fetchVariant = function (V) {
            var r = V.weaponXP[V.weaponIndex] || 0;
            for (var c = e.exports.weaponVariants.length - 1; c >= 0; --c) {
                if (r >= e.exports.weaponVariants[c].xp) {
                    return e.exports.weaponVariants[c];
                }
            }
        };
        e.exports.resourceTypes = ["wood", "food", "stone", "points"];
        e.exports.areaCount = 7;
        e.exports.treesPerArea = 9;
        e.exports.bushesPerArea = 3;
        e.exports.totalRocks = 32;
        e.exports.goldOres = 7;
        e.exports.riverWidth = 724;
        e.exports.riverPadding = 114;
        e.exports.waterCurrent = 0.0011;
        e.exports.waveSpeed = 0.0001;
        e.exports.waveMax = 1.3;
        e.exports.treeScales = [150, 160, 165, 175];
        e.exports.bushScales = [80, 85, 95];
        e.exports.rockScales = [80, 85, 90];
        e.exports.snowBiomeTop = 2400;
        e.exports.snowSpeed = 0.75;
        e.exports.maxNameLength = 15;
        e.exports.mapScale = 14400;
        e.exports.mapPingScale = 40;
        e.exports.mapPingTime = 2200;
        e.exports.volcanoScale = 320;
        e.exports.innerVolcanoScale = 100;
        e.exports.volcanoAnimalStrength = 2;
        e.exports.volcanoAnimationDuration = 3200;
        e.exports.volcanoAggressionRadius = 1440;
        e.exports.volcanoAggressionPercentage = 0.2;
        e.exports.volcanoDamagePerSecond = -1;
        e.exports.volcanoLocationX = 13960;
        e.exports.volcanoLocationY = 13960;
    },
    _UIS_client_: function (e, s) {
        e.exports = {
            ads: {
                adCard: getEl("adCard"),
                adContainer: getEl("ad-container"),
                promoImg: getEl("promoImg"),
                promoImageHolder: getEl("promoImgHolder"),
                wideAdCard: getEl("wideAdCard")
            },
            buttons: {
                store: getEl("storeButton"),
                alliance: getEl("allianceButton"),
                chat: getEl("chatButton"),
                enterGame: getEl("enterGame"),
                altchaCheckBox: getEl("altcha_checkbox"),
                partyButton: getEl("partyButton"),
                joinB: getEl("joinPartyButton"),
                settingsButton: getEl("settingsButton"),
                settingsButtonTitle: (function () {
                    const cB = getEl("settingsButton");
                    return cB ? cB.getElementsByTagName("span")[0] : null;
                })()
            },
            resources: {
                food: getEl("foodDisplay"),
                wood: getEl("woodDisplay"),
                stone: getEl("stoneDisplay"),
                score: getEl("scoreDisplay"),
                kill: getEl("killCounter")
            },
            global: {
                menuText: getEl("desktopInstructions"),
                setupCard: getEl("setupCard"),
                guideCard: getEl("guideCard"),
                gameUI: getEl("gameUI"),
                gameName: getEl("gameName"),
                mainMenu: getEl("mainMenu"),
                storeMenu: getEl("storeMenu"),
                nameInput: getEl("nameInput"),
                gameCanvas: getEl("gameCanvas"),
                gameContext: getEl("gameCanvas").getContext("2d"),
                mapDisplay: getEl("mapDisplay"),
                mapContext: getEl("mapDisplay").getContext("2d"),
                shutdownDisplay: getEl("shutdownDisplay"),
                pingDisplay: getEl("pingDisplay"),
                loadingText: getEl("loadingText"),
                diedText: getEl("diedText"),
                ageText: getEl("ageText"),
                ageBarBody: getEl("ageBarBody"),
                allianceMenu: getEl("allianceMenu"),
                allianceManager: getEl("allianceManager"),
                notificationDisplay: getEl("noticationDisplay"),
                leaderboardData: getEl("leaderboardData"),
                actionBar: getEl("actionBar"),
                playMusic: getEl("playMusic"),
                upgradeCounter: getEl("upgradeCounter"),
                chatBox: getEl("chatBox"),
                altcha: getEl("altcha")
            },
            holder: {
                menuCardHolder: getEl("menuCardHolder"),
                itemInfoHolder: getEl("itemInfoHolder"),
                upgradeHolder: getEl("upgradeHolder"),
                allianceHolder: getEl("allianceHolder"),
                skinColorHolder: getEl("skinColorHolder"),
                storeHolder: getEl("storeHolder"),
                chatHolder: getEl("chatHolder")
            },
            server: {
                serverBrowser: getEl("serverBrowser"),
                nativeResolutionOption: getEl("nativeResolution"),
                showPingOption: getEl("showPing")
            }
        };
    },
    _main_script_: function (e, s, V) {
        var r = V("config.js");
        window.config = r;
        var F = V("_UIS_client_");
        var H = F.global.menuText;
        var N = F.global.setupCard;
        var C = F.global.guideCard;
        var K = F.global.gameName;
        var d = F.global.gameUI;
        var k = F.global.mainMenu;
        var Q = F.global.storeMenu;
        var g = F.global.nameInput;
        var p = F.global.gameCanvas;
        var W = F.global.gameContext;
        var t = F.global.mapDisplay;
        var n = F.global.mapContext;
        var z = F.global.shutdownDisplay;
        var x = F.global.pingDisplay;
        var M = F.global.loadingText;
        var Y = F.global.diedText;
        var o = F.global.ageText;
        var G = F.global.ageBarBody;
        var S = F.global.allianceMenu;
        var v = F.global.allianceManager;
        var E = F.global.notificationDisplay;
        var b = F.global.leaderboardData;
        var R = F.global.actionBar;
        var D = F.global.playMusic;
        var Z = F.global.upgradeCounter;
        var O = F.global.chatBox;
        var I = F.global.altcha;
        var a = F.buttons.store;
        var u = F.buttons.alliance;
        var l = F.buttons.chat;
        var B = F.buttons.enterGame;
        var w = F.buttons.altchaCheckBox;
        var L = F.buttons.partyButton;
        var y = F.buttons.joinB;
        var h = F.buttons.settingsButton;
        var P = F.buttons.settingsButtonTitle;
        removeEl(l);
        var q = F.resources.food;
        var U = F.resources.wood;
        var m = F.resources.stone;
        var T = F.resources.score;
        var j = F.resources.kill;
        var J = F.ads.adCard;
        var X = F.ads.adContainer;
        var f0 = F.ads.promoImg;
        var f1 = F.ads.promoImageHolder;
        var f2 = F.ads.wideAdCard;
        var f3 = Object.values(F.ads);
        removeEl(f0);
        removeEl(J);
        removeEl(f2);
        var f4 = F.holder.menuCardHolder;
        var f5 = F.holder.itemInfoHolder;
        var f6 = F.holder.upgradeHolder;
        var f7 = F.holder.allianceHolder;
        var f8 = F.holder.skinColorHolder;
        var f9 = F.holder.storeHolder;
        var ff = F.holder.chatHolder;
        var fA = F.server.serverBrowser;
        var fe = F.server.nativeResolutionOption;
        var fs = F.server.showPingOption;
        var fV = p.getContext("2d");
        function fr(ci) {
            if (!ci) {
                return;
            }
            ci.style.opacity = "0";
            ci.style.transition = "opacity 0.5s ease, transform 0.3s ease";
            ci.style.transform = "scale(1)";
            ci.onmouseover = function () {
                ci.style.opacity = "1";
                ci.style.transform = "scale(1.05)";
            };
            ci.onmouseout = function () {
                ci.style.transform = "scale(1)";
            };
        }
        let fc = document.createElement("link");
        fc.href = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
        fc.rel = "stylesheet";
        document.head.appendChild(fc);
        K.innerHTML = "MooMoo";
        K.style.cssText = "\n        display: \"none\";\n        opacity: 0.85;\n        text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4;\n        font-size: 100px;\n        font-family: 'Lilita One', sans-serif;\n        opacity: 0;\n        transition: opacity 0.5s ease;\n        ";
        if (f1 && f8) {
            f1.appendChild(f8);
            f8.style.cssText = "\n        display: flex;\n        justify-content: center;\n        gap: 10px;\n        align-items: center;\n        flex-wrap: nowrap;\n        padding: 10px;\n        background-color: rgba(0, 0, 0, 0.25);\n        border-radius: 8px;\n        ";
        }
        fr(f1);
        fr(N);
        removeEl(C);
        k.style.cssText = "\n        background: rgba(0, 0, 10, 0.45);\n        backdrop-filter: blur(7px);\n        border-radius: 6px;\n        ";
        g.style.cssText = "\n        width: 350px;\n        height: 50px;\n        ";
        g.placeholder = "Enter Username";
        B.style.cssText = "\n        width: 95px;\n        height: 50px;\n        margin-left: 20px;\n        ";
        B.innerHTML = "Play!";
        f1.style.cssText += "\n        width: auto;\n        display: flex;\n        justify-content: center;\n        align-items: center;\n        background: rgba(0, 0, 0, 0);\n        padding: 20px;\n        border-radius: 10px;\n        box-shadow: 0px 4px 15px rgba(0, 0, 0, 0);\n        ";
        N.style.cssText += "\n        background: rgba(0, 0, 0, 0.45);\n        box-shadow: none;\n        display: flex;\n        width: 450px;\n        height: 50px;\n        border-radius: 10px;\n        margin-bottom: -20px;\n        margin-left: 70px;\n        ";
        K.style.cssText = "\n        opacity: 0.85;\n        text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4;\n        font-size: 170px;\n        margin-bottom: -25px;\n        font-family: 'Lilita One', sans-serif;\n        opacity: 0;\n        ";
        setTimeout(() => {
            // Some menu cards (guideCard in particular) are optional and may be
            // replaced by the host client, so never assume they are present.
            if (K) K.style.opacity = "1";
            if (N) N.style.opacity = "1";
            if (C) C.style.opacity = "1";
            if (f1) f1.style.opacity = "1";
        }, 2000);
        document.getElementById("loadingText").innerHTML = "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <style>\n\n        .progress-container {\n            top: 80%;\n            left: 50%;\n            transform: translate(-50%, -50%) scale(0.5);\n            width: 75%;\n            background-color: gray;\n            border-radius: 25px;\n            overflow: hidden;\n            height: 90px;\n            position: relative;\n        }\n        .progress-bar {\n            width: 0%;\n            margin-top: 5px;\n            margin-left: 5px;\n            height: 80%;\n            background-color: #fff;\n            border-radius: 25px;\n            animation: loading 1.2s linear forwards;\n            position: relative;\n        }\n        @keyframes loading {\n            from { width: 0%; }\n            to { width: 100%; }\n        }\n        .progress-text {\n            position: absolute;\n            top: 50%;\n            font-size: 50px;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            color: black;\n            font-weight: bold;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"progress-container\">\n        <div class=\"progress-bar\">\n            <div class=\"progress-text\" id=\"progressText\">Loading...</div>\n        </div>\n    </div>\n</body>\n</html>\n    ";
        "use strict";
        let fg = document.createElement("link");
        fg.rel = "stylesheet";
        fg.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
        fg.type = "text/css";
        document.body.append(fg);
        window.oncontextmenu = function () {
            return false;
        };
        r.anotherVisual = false;
        let fp = typeof Storage !== "undefined";
        function fW(ci, cC) {
            if (fp) {
                localStorage.setItem(ci, cC);
            }
        }
        function fn(ci) {
            if (fp) {
                return localStorage.getItem(ci);
            }
            return null;
        }
        class fx {
            constructor(ci) {
                this.element = ci;
            }
            add(ci) {
                if (!this.element) {
                    return undefined;
                }
                this.element.innerHTML += ci;
            }
            newLine(ci) {
                let cC = "<br>";
                if (ci > 0) {
                    cC = "";
                    for (let cK = 0; cK < ci; cK++) {
                        cC += "<br>";
                    }
                }
                this.add(cC);
            }
            text(ci) {
                let cC = "<input type = \"text\"";
                if (ci.id) {
                    cC += " id = " + ci.id;
                }
                if (ci.style) {
                    cC += " style = " + ci.style.replaceAll(" ", "");
                }
                if (ci.class) {
                    cC += " class = " + ci.class;
                }
                if (ci.size) {
                    cC += " size = " + ci.size;
                }
                if (ci.maxLength) {
                    cC += " maxLength = " + ci.maxLength;
                }
                if (ci.value) {
                    cC += " value = " + ci.value;
                }
                if (ci.placeHolder) {
                    cC += " placeHolder = " + ci.placeHolder.replaceAll(" ", "&nbsp;");
                }
                cC += ">";
                this.add(cC);
            }
            select(ci) {
                let cC = "<select";
                if (ci.id) {
                    cC += " id = " + ci.id;
                }
                if (ci.style) {
                    cC += " style = " + ci.style.replaceAll(" ", "");
                }
                if (ci.class) {
                    cC += " class = " + ci.class;
                }
                cC += ">";
                for (let cK in ci.option) {
                    cC += "<option value = " + ci.option[cK].id;
                    if (ci.option[cK].selected) {
                        cC += " selected";
                    }
                    cC += ">" + cK + "</option>";
                }
                cC += "</select>";
                this.add(cC);
            }
            button(ci) {
                let cC = "<button";
                if (ci.id) {
                    cC += " id = " + ci.id;
                }
                if (ci.style) {
                    cC += " style = " + ci.style.replaceAll(" ", "");
                }
                if (ci.class) {
                    cC += " class = " + ci.class;
                }
                if (ci.onclick) {
                    cC += " onclick = " + ci.onclick;
                }
                cC += ">";
                if (ci.innerHTML) {
                    cC += ci.innerHTML;
                }
                cC += "</button>";
                this.add(cC);
            }
        }
        ;
        class fM {
            constructor() {
                this.element = null;
                this.action = null;
                this.divElement = null;
                this.startDiv = function (ci, cC) {
                    let cK = document.createElement("div");
                    if (ci.id) {
                        cK.id = ci.id;
                    }
                    if (ci.style) {
                        cK.style = ci.style;
                    }
                    if (ci.class) {
                        cK.className = ci.class;
                    }
                    this.element.appendChild(cK);
                    this.divElement = cK;
                    let cd = new fx(cK);
                    if (typeof cC == "function") {
                        cC(cd);
                    }
                };
                this.addDiv = function (ci, cC) {
                    let cK = document.createElement("div");
                    if (ci.id) {
                        cK.id = ci.id;
                    }
                    if (ci.style) {
                        cK.style = ci.style;
                    }
                    if (ci.class) {
                        cK.className = ci.class;
                    }
                    if (ci.appendID) {
                        getEl(ci.appendID).appendChild(cK);
                    }
                    this.divElement = cK;
                    let cd = new fx(cK);
                    if (typeof cC == "function") {
                        cC(cd);
                    }
                };
            }
            set(ci) {
                this.element = getEl(ci);
                this.action = new fx(this.element);
            }
            resetHTML(ci) {
                if (ci) {
                    this.element.innerHTML = "";
                } else {
                    this.element.innerHTML = "";
                }
            }
            setStyle(ci) {
                this.element.style = ci;
            }
            setCSS(ci) {
                this.action.add("<style>" + ci + "</style>");
            }
        }
        ;
        class fY {
            constructor() {
                this.content = "";
            }
            append(ci) {
                this.content += ci;
            }
            Text(ci, cC = "16px", cK = "white") {
                this.append("<span style=\"font-size: " + cC + "; color: " + cK + ";\">" + ci + "</span>");
            }
            newLine(ci = 1) {
                this.append("<br>".repeat(ci));
            }
            static AppendTo(ci, cC) {
                const cK = document.getElementById(ci);
                if (cK) {
                    const cd = new fY();
                    cC(cd);
                    cK.innerHTML += cd.content;
                }
            }
            static InnerHtml(ci, cC) {
                const cK = document.getElementById(ci);
                if (cK) {
                    const cd = new fY();
                    cC(cd);
                    cK.innerHTML = cd.content;
                }
            }
            TabContent(ci, cC) {
                const cK = new fY();
                cC(cK);
                this.append("\n            <div id=\"" + ci + "\" class=\"tab-content\">\n                " + cK.content + "\n            </div>\n        ");
            }
            static addStyle(ci, cC) {
                let cK = document.getElementById(ci);
                if (!cK) {
                    cK = document.createElement("style");
                    cK.id = ci;
                    document.head.appendChild(cK);
                }
                cK.textContent = cC;
            }
            // cd.option: add a dropdown (fl[id]); cd.input: add a number field (fl[id]);
            // cd.setting: a settings row without the on/off checkbox; cd.defaultOn: on until turned off.
            BoxF(ci, cC, cK, cd = {}) {
                const cS = localStorage.getItem(cK);
                const ck = cS === null ? !!cd.defaultOn : cS === "true";
                const cQ = cd.option ? "<select id=\"" + cK + "-dropdown\" class=\"checkbox-dropdown\">\n            " + Object.entries(cd.options || {}).map(([cp, cW]) => "<option value=\"" + cW.id + "\" " + (cW.selected ? "selected" : "") + ">\n                        " + cp + "\n                    </option>").join("") + "\n        </select>" : "";
                const cX = cd.input ? "<input type=\"number\" id=\"" + cK + "-input\" class=\"checkbox-dropdown\" style=\"width: 90px;\" min=\"" + cd.input.min + "\" max=\"" + cd.input.max + "\" value=\"" + cd.input.value + "\" />" : "";
                const cg = "\n    <div id=\"" + cK + "\" class=\"checkbox-container\">\n        <label class=\"checkbox-label\">\n            <input type=\"checkbox\" " + (ck ? "checked" : "") + " class=\"checkbox-input\"" + (cd.setting ? " style=\"display: none;\"" : "") + " />\n            <span class=\"checkbox-name\">" + ci + "</span>\n            " + cQ + cX + "\n        </label>\n        <p class=\"checkbox-description\">" + cC + "</p>\n    </div>\n    ";
                this.append(cg);
                setTimeout(() => {
                    const cp = document.querySelector("#" + cK + " .checkbox-input");
                    if (cp) {
                        fu[cK] = ck;
                        cp.addEventListener("change", cW => {
                            const ct = cW.target.checked;
                            localStorage.setItem(cK, ct);
                            fu[cK] = ct;
                            if (cK === "externalSync" && !ct) {
                                roboticsSyncOff();
                            }
                        });
                    }
                    if (cd.input) {
                        const cW = document.getElementById(cK + "-input");
                        if (cW) {
                            const ct = localStorage.getItem(cK + "-value");
                            if (ct !== null) {
                                cW.value = ct;
                            }
                            fl[cK] = cW.value;
                            cW.addEventListener("change", () => {
                                localStorage.setItem(cK + "-value", cW.value);
                                fl[cK] = cW.value;
                            });
                            roboticsKeepKeysInField(cW);
                        }
                    }
                    if (cd.option) {
                        const cW = document.getElementById(cK + "-dropdown");
                        if (cW) {
                            roboticsKeepKeysInField(cW);
                            // Start from the option the menu shows as selected, so an
                            // untouched dropdown does what it displays.
                            fl[cK] = cW.value;
                            cW.addEventListener("change", cn => {
                                const cz = cn.target.value;
                                localStorage.setItem(cK + "-selected", cz);
                                fl[cK] = cz;
                            });
                            const ct = localStorage.getItem(cK + "-selected");
                            if (ct) {
                                const cn = cW.querySelector("option[value=\"" + ct + "\"]");
                                if (cn) {
                                    cn.selected = true;
                                    fl[cK] = ct;
                                }
                            }
                        }
                    }
                }, 100);
            }
        }
        let fo = new fM();
        let fS = document.createElement("div");
        fS.id = "menuDiv";
        document.body.appendChild(fS);
        fo.set("menuDiv");
        fo.setStyle("\n            position: absolute;\n            left: 20px;\n            top: 20px;\n            display: none;\n            ");
        fo.resetHTML();
        fo.setCSS("\n        .leaderboardItem {\n    float: left;\n    display: inline-block;\n    font-size: 13px;\n    text-align: center;\n    max-width: max-content;\n    position: relative;\n    left: 50%;\n    transform: translateX(-50%);\n    text-shadow: -1.1px -1.1px 0 #000, 1.1px -1.1px 0 #000, -1.1px 1.1px 0 #000, 1.1px 1.1px 0 #000;\n    font-family: Ubuntu, sans-serif;\n    margin-top: 1.2px;\n}\n\n            .menuClass{\n                color: #fff;\n                font-size: 31px;\n                text-align: left;\n                padding: 10px;\n                padding-top: 7px;\n                padding-bottom: 5px;\n                width: 300px;\n                background-color: rgba(0, 0, 0, 0.25);\n                -webkit-border-radius: 4px;\n                -moz-border-radius: 4px;\n                border-radius: 4px;\n            }\n            .menuC {\n                display: none;\n                font-family: \"Hammersmith One\";\n                font-size: 12px;\n                max-height: 180px;\n                overflow-y: scroll;\n                -webkit-touch-callout: none;\n                -webkit-user-select: none;\n                -khtml-user-select: none;\n                -moz-user-select: none;\n                -ms-user-select: none;\n                user-select: none;\n            }\n            .menuB {\n                text-align: center;\n                background-color: rgb(25, 25, 25);\n                color: #fff;\n                -webkit-border-radius: 4px;\n                -moz-border-radius: 4px;\n                border-radius: 4px;\n                border: 2px solid #000;\n                cursor: pointer;\n            }\n            .menuB:hover {\n                border: 2px solid #fff;\n            }\n            .menuB:active {\n                color: rgb(25, 25, 25);\n                background-color: rgb(200, 200, 200);\n            }\n            .customText {\n                color: #000;\n                -webkit-border-radius: 4px;\n                -moz-border-radius: 4px;\n                border-radius: 4px;\n                border: 2px solid #000;\n            }\n            .customText:focus {\n                background-color: yellow;\n            }\n            .checkB {\n                position: relative;\n                top: 2px;\n                accent-color: #888;\n                cursor: pointer;\n            }\n            .Cselect {\n                -webkit-border-radius: 4px;\n                -moz-border-radius: 4px;\n                border-radius: 4px;\n                background-color: rgb(75, 75, 75);\n                color: #fff;\n                border: 1px solid #000;\n            }\n            #menuChanger {\n                position: absolute;\n                right: 10px;\n                top: 10px;\n                background-color: rgba(0, 0, 0, 0);\n                color: #fff;\n                border: none;\n                cursor: pointer;\n            }\n            #menuChanger:hover {\n                color: #000;\n            }\n            ::-webkit-scrollbar {\n                width: 10px;\n            }\n            ::-webkit-scrollbar-track {\n                opacity: 0;\n            }\n            ::-webkit-scrollbar-thumb {\n                background-color: rgb(25, 25, 25);\n                -webkit-border-radius: 4px;\n                -moz-border-radius: 4px;\n                border-radius: 4px;\n            }\n            ::-webkit-scrollbar-thumb:active {\n                background-color: rgb(230, 230, 230);\n            }\n            ");
        let fv = document.createElement("div");
        fv.id = "modmenus";
        document.body.appendChild(fv);
        fY.addStyle("modmenus-styles", "\n        #modmenus {\n            position: fixed;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            background: rgba(20, 20, 20, 0.95);\n            color: white;\n            border-radius: 20px;\n            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n            font-size: 16px;\n            z-index: 9999;\n            visibility: hidden;\n            opacity: 0;\n            transition: opacity 0.4s ease, transform 0.4s ease, visibility 0.4s;\n            width: 720px;\n            height: 490px;\n            text-align: center;\n            box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.7);\n            overflow: hidden;\n        }\n\n        #modmenus.open {\n            visibility: visible;\n            opacity: 1;\n            transform: translate(-50%, -50%) scale(1);\n        }\n\n        #modmenus.closed {\n            visibility: hidden;\n            opacity: 0;\n            transform: translate(-50%, -50%) scale(0.9);\n        }\n\n        #modmenus-sidebar {\n            position: absolute;\n            top: 0;\n            left: 0;\n            width: 80px;\n            height: 100%;\n            background-color: rgba(34, 34, 34, 0.95);\n            color: white;\n            padding: 15px;\n            box-sizing: border-box;\n            text-align: center;\n            border-radius: 20px 0 0 20px;\n            display: flex;\n            flex-direction: column;\n            align-items: center;\n            gap: 20px;\n            opacity: 0;\n            animation: slideIn 0.5s forwards;\n        }\n\n        #modmenus-sidebar button {\n            width: 55px;\n            height: 55px;\n            background: rgba(68, 68, 68, 0.9);\n            color: white;\n            border: none;\n            border-radius: 50%;\n            cursor: pointer;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            font-size: 20px;\n            transition: transform 0.3s ease, background 0.3s ease;\n        }\n\n        #modmenus-sidebar button:hover {\n            background: rgba(85, 85, 85, 0.9);\n            transform: scale(1.1);\n        }\n\n        #modmenus-sidebar button.active {\n            background: rgba(102, 102, 102, 0.9);\n            font-weight: bold;\n        }\n\n        #modmenus-content {\n            position: absolute;\n            top: 0;\n            left: 80px;\n            width: 640px;\n            height: 100%;\n            padding: 20px;\n            box-sizing: border-box;\n            background-color: rgba(51, 51, 51, 0.95);\n            color: white;\n            text-align: left;\n            overflow-x: auto;\n            oveflow-y: none;\n            animation: fadeInContent 0.4s ease;\n            border-radius: 10px;\n            scrollbar-width: none;\n            scrollbar-width: thin;\n            scrollbar-color: #555 #333;\n        }\n       #modmenus-content::-webkit-scrollbar {\n           height: 8px;\n       }\n\n       #modmenus-content::-webkit-scrollbar-thumb {\n           background: #555;\n           border-radius: 20px;\n       }\n\n       #modmenus-content::-webkit-scrollbar-thumb:hover {\n           background: #666;\n       }\n\n       #modmenus-content::-webkit-scrollbar-track {\n           background: #333;\n           border-radius: 10px;\n       }\n       #modmenus-content::-webkit-scrollbar-button {\n           display: none;\n       }\n        .tab-content {\n            display: none;\n        }\n\n        .tab-content.active {\n            display: block;\n            animation: fadeIn 0.4s ease;\n        }\n\n        .search-bar {\n            display: inline-block;\n            margin-left: 10px;\n        }\n\n        .search-bar input {\n            width: 400px;\n            height: 30px;\n            font-size: 16px;\n            border-radius: 15px;\n            border: 1px solid #444;\n            background-color: #333;\n            color: white;\n            outline: none;\n        }\n\n        .search-bar input:focus {\n            border-color: #555;\n            background-color: #444;\n        }\n\n        @keyframes slideIn {\n            from {\n                opacity: 0;\n                transform: translateX(-100%);\n            }\n            to {\n                opacity: 1;\n                transform: translateX(0);\n            }\n        }\n\n        @keyframes fadeInContent {\n            from {\n                opacity: 0;\n            }\n            to {\n                opacity: 1;\n            }\n        }\n\n        @keyframes fadeIn {\n            from {\n                opacity: 0;\n                transform: translateY(10px);\n            }\n            to {\n                opacity: 1;\n                transform: translateY(0);\n            }\n        }\n    ");
        fY.addStyle("checkbox-styles", "\n    .checkbox-container {\n        display: flex;\n        flex-direction: column;\n        padding: 10px;\n        background-color: rgba(34, 34, 34, 0.85);\n        border-radius: 10px;\n        margin: 10px 0;\n    }\n\n    .checkbox-label {\n        display: flex;\n        align-items: center;\n        gap: 10px;\n    }\n\n    .checkbox-name {\n        font-size: 18px;\n        color: white;\n    }\n\n    .checkbox-description {\n        font-size: 14px;\n        color: rgba(255, 255, 255, 0.7);\n        margin-top: 5px;\n    }\n\n    .checkbox-input {\n        width: 20px;\n        height: 20px;\n        accent-color: #4CAF50;\n    }\n    .checkbox-dropdown {\n    margin-left: 10px;\n    height: 20px;\n    border: 1px solid rgba(255, 255, 255, 0.2);\n    border-radius: 20px;\n    background-color: rgba(51, 51, 51, 0.95);\n    color: white;\n    font-size: 12px;\n    outline: none;\n    transition: border-color 0.3s ease, box-shadow 0.3s ease;\n    width: 170px;\n    text-align: center;\n}\n\n.checkbox-dropdown:hover {\n    border-color: rgba(255, 255, 255, 0.5);\n}\n\n.checkbox-dropdown:focus {\n    border-color: #444;\n    box-shadow: 0 0 5px rgba(68, 68, 68, 0.7);\n}\n\n.checkbox-dropdown option:checked {\n    background-color: #333;\n}\n\n.checkbox-dropdown option {\n    color: white;\n}\n\n");
        fY.InnerHtml("modmenus", ci => {
            ci.append("\n            <div id=\"modmenus-sidebar\">\n                <button class=\"tab-btn\" data-tab=\"offensive\">⚔️</button>\n                <button class=\"tab-btn\" data-tab=\"defensive\">🛡️</button>\n                <button class=\"tab-btn\" data-tab=\"render\">👁️</button>\n                <button class=\"tab-btn\" data-tab=\"robot\">🤖</button>\n                <button class=\"tab-btn\" data-tab=\"keybind\">⌨️</button>\n                <button class=\"tab-btn\" data-tab=\"others\">⚙️</button>\n            </div>\n            <div id=\"modmenus-content\"></div>\n        ");
        });
        fY.InnerHtml("modmenus-content", ci => {
            const cC = cK => {
                cK.append("\n                <div class=\"search-bar\">\n                    <input type=\"text\" placeholder=\"Search...\" class=\"search-input\" />\n                </div>\n            ");
            };
            ci.TabContent("offensive", cK => {
                cK.Text("OFFENSIVE TAB", "20px", "white");
                cC(cK);
                cK.newLine(1);
                cK.BoxF("Auto Placer", "Places Item For you such as spike and Traps", "autoPlace");
                cK.BoxF("Auto Replacer", "Auto Replace Buildings", "autoReplace");
                cK.BoxF("Preplacer", "Advanced Placing Obj", "autoPrePlace", {
                    option: true,
                    options: {
                        "Spike Tick Type": {
                            id: "spike"
                        },
                        "Retrap Type": {
                            id: "retrap",
                            selected: true
                        }
                    }
                });
                cK.BoxF("Graded Auto Place", "Falcon: Auto Placer and Auto Replacer pick their spots with Falcon's angle finder and grader: the 4 best spikes/traps per tick (key /)", "gradedAutoPlace");
                cK.BoxF("Angle Finder Level", "Falcon: candidates per item, 1 (16, fastest) to 10 (70, best)", "angleFinderLevel", {
                    setting: true,
                    input: {
                        min: 1,
                        max: 10,
                        value: 7
                    }
                });
                cK.BoxF("Auto Place Range", "Falcon: Graded Auto Place works while an enemy is this close (100-1200)", "autoPlaceRange", {
                    setting: true,
                    input: {
                        min: 100,
                        max: 1200,
                        value: 400
                    }
                });
                cK.BoxF("Two Tick Placements", "Falcon: Graded Auto Place places every other tick (fewer packets)", "twoTickPlacements");
                cK.BoxF("Auto Push", "Pushes enemies to spike when they in trap", "autoPush");
                cK.BoxF("Reverse Insta", "Always reverse insta", "revInsta");
                cK.BoxF("Spike On Reverse", "Place spike when reverse instaing and close to enemy", "doSpikeOnReverse");
                cK.BoxF("Auto Play", "Pathfinds to nearest enemy", "autoPlay");
                cK.BoxF("Spike Tick", "Spike and hit together when enemy break out of trap", "spikeTick");
                cK.BoxF("KB Tick", "Knocks back enemy into spike", "predictTick");
                cK.BoxF("Slow One Tick", "Select wall when polearm ticking to slow down", "slowOT");
                cK.BoxF("Turret Combat", "Uses turret when spike ticking", "turretCombat");
                cK.BoxF("Projectile Sync", "Falcon: bull hit when your or your team's arrows/turrets already flying at the enemy plus your hit kill (key k)", "projectileSync");
                cK.BoxF("Velocity Hits", "Falcon: bull hit when the enemy is about to slide into a spike and the hit plus the spike kill (key i)", "velocityHits");
                cK.BoxF("Dynamic One Tick", "Falcon: simulates both players 2 ticks ahead and one ticks (turret gear, then bull hit) automatically when it kills. Diamond polearm or ruby katana (key u; t still arms one)", "dynamicOneTick");
                cK.BoxF("Knockback Hits", "Falcon: bull hit when the knockback bounces the enemy into 3+ spikes or kills (key b)", "knockbackHits");
                cK.BoxF("Knockback Instakills", "Falcon: turret gear insta only when the simulated knockback ends on a spike. Needs great hammer (reverse) or a ranged secondary (key p)", "knockbackInsta");
                cK.BoxF("Knockback Insta In Trap", "Falcon: allow Knockback Instakills while you are trapped", "knockbackInstaInTrap");
                cK.BoxF("Auto Push Strikes", "Falcon: hit while Auto Push shoves a trapped enemy into a spike, method per weapon below (key [)", "pushStrikes");
                cK.BoxF("Push Strike: Daggers", "Shame Strike: turret gear + daggers once their shame reaches the threshold", "pushStrikeDagger", {
                    setting: true,
                    option: true,
                    options: {
                        "Shame Strike": {
                            id: "shame",
                            selected: true
                        },
                        Bullspam: {
                            id: "bullspam"
                        },
                        Disabled: {
                            id: "off"
                        }
                    }
                });
                cK.BoxF("Push Strike: Polearm / Katana", "Predictive: learns when the enemy wears tank gear after reloading and hits one tick before", "pushStrikeHighDamage", {
                    setting: true,
                    option: true,
                    options: {
                        Predictive: {
                            id: "predictive",
                            selected: true
                        },
                        Bullspam: {
                            id: "bullspam"
                        },
                        Disabled: {
                            id: "off"
                        }
                    }
                });
                cK.BoxF("Push Strike: Other Weapons", "Bullspam: bull hit whenever reloaded and the enemy is on the spike", "pushStrikeGeneric", {
                    setting: true,
                    option: true,
                    options: {
                        Bullspam: {
                            id: "bullspam",
                            selected: true
                        },
                        Disabled: {
                            id: "off"
                        }
                    }
                });
                cK.BoxF("Shame Strike Threshold", "Enemy shame count needed for a dagger Shame Strike (2-7)", "pushShameThreshold", {
                    setting: true,
                    input: {
                        min: 2,
                        max: 7,
                        value: 4
                    }
                });
                cK.BoxF("Turret Gear Knockback", "Falcon: turret gear when the bullet's knockback bounces the enemy into 3+ spikes or kills (key ])", "turretGearKB");
                cK.BoxF("Turret Bullet Assist", "Falcon: turret gear when a trapped enemy on a spike takes damage, in one tick range (key ;)", "turretAssist");
                cK.BoxF("Barbarian Knockback", "Falcon: barbarian armor when the enemy is about to hit you and the knockback bounces them into spikes (key ')", "barbKB");
                cK.BoxF("Apple Insta", "Falcon: tank gear + great hammer breaks the enemy's trap, then spike + bull hit (key -)", "appleInsta");
                cK.BoxF("Apple Insta In Trap", "Falcon: allow Apple Insta while you are trapped", "appleInstaInTrap");
                cK.BoxF("Apple Insta Low Damage", "Falcon: allow Apple Insta with primaries other than short sword, katana and polearm", "appleInstaLowDamage");
                cK.BoxF("Melee Sync", "Falcon: bull hit together with this player id when both hits kill (key =)", "meleeSync", {
                    input: {
                        min: -1,
                        max: 999,
                        value: -1
                    }
                });
                cK.BoxF("One Tick Ignores Hats", "Falcon: Dynamic One Tick counts full damage even when the enemy wears soldier or EMP helmet", "oneTickIgnoreHats");
                cK.BoxF("Graded Preplace", "Falcon: Preplacer picks its spot with Falcon's angle grader (needs Preplacer on) (key o)", "gradedPreplace");
                cK.newLine(2);
                cK.BoxF("Primary Sync", "Sync with players using this mod with primary (needs External Sync in the Others tab)", "serverSync");
            });
            ci.TabContent("defensive", cK => {
                cK.Text("DEFENSIVE TAB", "20px", "white");
                cC(cK);
                cK.newLine(1);
                cK.BoxF("Auto buy", "Buys hats and accessories automatically", "autoBuy");
                cK.BoxF("Anti 1 tick", "Forces soldier when detects 1 tick", "anti1tick");
                cK.BoxF("Smart Anti-Insta", "Falcon: when a hit would kill you, wear EMP helmet if it blocks enough, else soldier, else heal - no early heal, no shame (key j)", "smartAntiInsta");
                cK.BoxF("Auto Q on sync", "Heals as fast as possible when you may be synced", "autoQonSync");
                cK.BoxF("Hammer breaker", "Use hammer when breaking", "hammerBreakerOptimisation");
                cK.BoxF("Safe Walk", "Avoids spikes", "safeWalk", {
                    option: true,
                    options: {
                        "Move Away": {
                            id: "move",
                            selected: true
                        },
                        Stop: {
                            id: "stop"
                        }
                    }
                });
                cK.BoxF("Avoid My Teleporters", "Falcon: Safe Walk also stops you walking into your team's teleporters (enemy teleporters are always avoided)", "safeWalkAvoidMyTps", {
                    defaultOn: true
                });
                cK.BoxF("Avoid Ally Boost Pads", "Falcon: Safe Walk also stops you walking onto your team's boost pads (enemy boost pads are always avoided)", "safeWalkAvoidAllyPads", {
                    defaultOn: true
                });
                cK.BoxF("Anti Trap", "Places traps or spikes behind you when in trap", "antiTrap");
                cK.BoxF("Extra Anti Spike Tick", "Uses knock back prediction and trap health to soldier or heal too", "safeAntiSpikeTick");
                cK.BoxF("Spike Breaker", "Auto break enemy spikes in range", "breakSpikeSwitch");
                cK.BoxF("Trap Breaker", "Auto break enemy traps even if you are not in them", "breakTrapSwitch");
                cK.BoxF("Obstacle Breaker", "Auto break objects near the trap enemy is in", "breakAroundSwitch");
                cK.BoxF("Turret type Breaker", "Auto break enemy turret/tp/blocked in range", "breakTTBSwitch");
                cK.BoxF("Break All", "Auto break all buildings. Note: disables avoid ur own buildings breaker", "breakAllSwitch");
                cK.BoxF("Counter Insta", "Spike gear and hit when enemy hit you (strongly not recommended). Falcon: spike gear only when the enemy just reloaded, never with 4+ shame or when nearby bull hits add up to 100; counters only when the hit kills", "antiBullType", {
                    option: true,
                    options: {
                        Predict: {
                            id: "abreload"
                        },
                        Always: {
                            id: "abalway",
                            selected: true
                        },
                        Falcon: {
                            id: "abfalcon"
                        }
                    }
                });
                cK.BoxF("Force Anti Bull", "Falcon mode: spike gear whenever the enemy's primary is reloaded, if no enemy spikes are within 150 and nobody can spike you", "forceAntiBull");
                cK.BoxF("Pattern Recognition", "Falcon: ignores some baited spike tick threats (when you leave a trap or could be spiked) so you don't soldier/heal every time and gain shame (key Home)", "patternRec");
                cK.BoxF("Smart Hats", "Falcon: when idle near an enemy, soldier only when their weapon can hurt you now (daggers, polearm reload, traps, turrets), else speed hat (key End)", "smartHats");
            });
            ci.TabContent("render", cK => {
                cK.Text("VISUAL TAB", "20px", "white");
                cC(cK);
                cK.newLine(1);
                cK.BoxF("Smoother Camera", "Makes camera move slower", "CAmera");
                cK.BoxF("Render Direction", "Shows real direction", "renderDir", {
                    option: true,
                    options: {
                        "When Auto Aim": {
                            id: "attackDir"
                        },
                        Always: {
                            id: "showDir",
                            selected: true
                        },
                        "No Dir": {
                            id: "noDir"
                        }
                    }
                });
                cK.BoxF("Render Placers", "Show positions placed", "placeVis");
            });
            ci.TabContent("robot", cK => {
                cK.Text("BOTS TAB", "20px", "white");
                cC(cK);
                cK.newLine(1);
                cK.Text("No bots for you :>");
            });
            ci.TabContent("keybind", cK => {
                cK.Text("KEYBINDS TAB", "20px", "white");
                cC(cK);
                cK.newLine(1);
                cK.Text("z for auto mill, f for trap type, v for spike type, n for mill type, h for turret type, y for stone/sapling");
                cK.newLine(1);
                cK.Text("If auto push or auto play dumb, press shift once to disable for 5 seconds");
                cK.Text("C for song. It is case sensitive so press shift + c or caps + c. Song chat stuff found in others tab");
                cK.newLine(1);
                cK.Text("t arms one (Falcon) one tick, hold '.' (period) for boost tick. Space hits once. All keys can be changed in CONFIG.keys at the top of the script");
                cK.newLine(1);
                cK.Text("Falcon toggles: j k i u o / b p [ ] ; ' - = 0 Home End (see the visual tab for names)");
                cK.newLine(1);
                cK.Text("Falcon features: j Smart Anti-Insta, k Projectile Sync, i Velocity Hits, u Dynamic One Tick, o Graded Preplace, / Graded Auto Place");
                cK.Text("b Knockback Hits, p Knockback Instakills, [ Auto Push Strikes, ] Turret Gear Knockback, ; Turret Bullet Assist, ' Barbarian Knockback, - Apple Insta, = Melee Sync");
                cK.Text("Home Pattern Recognition, End Smart Hats, 0 Artificial Ping");
            });
            ci.TabContent("others", cK => {
                cK.Text("OTHERS TAB", "20px", "white");
                cC(cK);
                cK.newLine(1);
                cK.BoxF("Kill Chat", "Sends message when you kill someone", "killChat");
                cK.BoxF("Weapon Grind", "Auto place turret type item around you", "weaponGrind");
                cK.BoxF("Auto Respawn", "Respawns when you die automatically", "autoRespawn");
                cK.BoxF("Always Flipper", "Equips flipper when in water more", "alwaysFlipper");
                cK.BoxF("Auto Accept", "Adds players into your party asap when they request to join", "autoAccept");
                cK.BoxF("Ping Map", "Pings the map when you press r or click it", "allowPing");
                cK.BoxF("External Sync", "Connects to robotics-ahh.fly.dev for Primary Sync and the green/red names of other Robotics users. Every 20 s it sends your id, name, server, ping and position. Off by default", "externalSync");
                cK.BoxF("Player Follow", "Follows the targetted player around", "playerFollow");
                cK.BoxF("Follow SID", "Falcon: player id to follow with Player Follow (-1 = the targetted player)", "followSid", {
                    setting: true,
                    input: {
                        min: -1,
                        max: 999,
                        value: -1
                    }
                });
                cK.BoxF("Packet Budget Limit", "Falcon: packets per second the mod may send. The server kicks above its limit, so raise it with care", "packetLimit", {
                    setting: true,
                    option: true,
                    options: {
                        "60 / s": {
                            id: "60"
                        },
                        "69 / s": {
                            id: "69",
                            selected: true
                        },
                        "80 / s": {
                            id: "80"
                        },
                        "90 / s": {
                            id: "90"
                        },
                        "100 / s": {
                            id: "100"
                        },
                        "110 / s": {
                            id: "110"
                        }
                    }
                });
                cK.BoxF("Packet Budget Strictness", "Falcon: how many packets per second stay free for heals and placing (2 keeps 9, 3 keeps 12, 4 keeps 15)", "packetStrictness", {
                    setting: true,
                    option: true,
                    options: {
                        "2": {
                            id: "2",
                            selected: true
                        },
                        "3": {
                            id: "3"
                        },
                        "4": {
                            id: "4"
                        }
                    }
                });
                cK.BoxF("Artificial Ping", "Falcon: handles server packets this many ms later, in order (applied as half, like Falcon) (key 0)", "artificialPing", {
                    input: {
                        min: 10,
                        max: 80,
                        value: 35
                    }
                });
                cK.BoxF("Funni Hats :)", "Changes hat changing when not near players", "hatType", {
                    option: true,
                    options: {
                        "Hat loop": {
                            id: "loop"
                        },
                        "Bush gear": {
                            id: "bg",
                            selected: true
                        },
                        "Assassion gear": {
                            id: "ag"
                        }
                    }
                });
                cK.BoxF("Random loop songs", "Loop through songs randomly. If unchecked, play selected song", "songChat", {
                    option: true,
                    options: {
                        "Avicii - The Nights": {
                            id: "0"
                        },
                        "Initial D - Gas Gas Gas": {
                            id: "1"
                        },
                        "Ruth B - Dandelions": {
                            id: "2"
                        },
                        "Sub Urban - Cradles": {
                            id: "3"
                        },
                        "Kord Hell - Scopin": {
                            id: "4"
                        },
                        "The Living Tombstone - My Ordinary Life": {
                            id: "5"
                        },
                        "Ed Sheeran - Shape Of You": {
                            id: "6"
                        },
                        "Powfu - Death Bed": {
                            id: "7"
                        },
                        "Marina - Bubblegum Bitch": {
                            id: "8"
                        },
                        "Nyan Cat!": {
                            id: "9"
                        },
                        "Olly Murs - That Girl": {
                            id: "10"
                        },
                        "Lil Nax X - Industry Baby": {
                            id: "11"
                        },
                        "Rachie - My R": {
                            id: "12"
                        },
                        "OMI - Cheerleader": {
                            id: "13"
                        },
                        "Yung kai - Blue": {
                            id: "14"
                        },
                        "BWO - Sunshine In The Rain": {
                            id: "15"
                        },
                        "Post Malone - Circles": {
                            id: "16"
                        },
                        "Lady Gaga - Poker Face": {
                            id: "17"
                        },
                        "Edward Maya - Stereo Love": {
                            id: "18"
                        },
                        "The Walters - I Love You So": {
                            id: "19"
                        },
                        "Sam Gellaitry - Assumptions": {
                            id: "20"
                        },
                        "The Weekend - Blinding Lights": {
                            id: "21"
                        },
                        "Sia - Cheap Thrills": {
                            id: "22"
                        },
                        "ATC - Around The World": {
                            id: "23"
                        },
                        "Edward Sharpe - Home": {
                            id: "24"
                        },
                        "NCS - MATAFAKA": {
                            id: "25"
                        },
                        "Nae Nae Niga": {
                            id: "26"
                        },
                        "Eminem - Mockingbird": {
                            id: "27"
                        },
                        "Yungatina - 7 Weeks 3 Days": {
                            id: "28"
                        },
                        "ABBA - Gimme Gimme Gimme": {
                            id: "29"
                        },
                        "One Direction - What Makes You Beautiful": {
                            id: "30"
                        },
                        "The Coconut Song": {
                            id: "31"
                        },
                        "The Neighbourhood - Sweater Weather": {
                            id: "32"
                        },
                        "Eminem - Rap God": {
                            id: "33"
                        },
                        "Tung Tung Tung Sahur - Ratatung": {
                            id: "34"
                        },
                        "Quadeca - Candles On Fire": {
                            id: "35"
                        },
                        "Justin Bieber - Stay": {
                            id: "36"
                        },
                        "The Rare Occasions - Notion (Sped Up)": {
                            id: "37"
                        },
                        "Civilian - Close Call": {
                            id: "38"
                        },
                        "Pharmacist - North Memphis": {
                            id: "39"
                        }
                    }
                });
            });
        });
        let fE = document.createElement("div");
        fE.id = "menuChatDiv";
        document.body.appendChild(fE);
        fo.set("menuChatDiv");
        fo.setStyle("\n            position: absolute;\n            display: block;\n            left: 10px;\n            top: 10px;\n            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.65);\n            ");
        fo.resetHTML();
        fo.setCSS("\n            .chDiv{\n                color: #fff;\n                padding: 5px;\n                width: 400px;\n                height: 240px;\n                background-color: rgba(0, 0, 0, 0.35);\n            }\n            .chMainDiv{\n                font-family: \"Ubuntu\";\n                font-size: 12px;\n                max-height: 195px;\n                overflow-y: scroll;\n                -webkit-touch-callout: none;\n                -webkit-user-select: none;\n                -khtml-user-select: none;\n                -moz-user-select: none;\n                -ms-user-select: none;\n                user-select: none;\n            }\n            .chMainBox{\n                position: absolute;\n                left: 5px;\n                bottom: 10px;\n                width: 395px;\n                height: 30px;\n                background-color: rgb(128, 128, 128, 0.35);\n                -webkit-border-radius: 4px;\n                -moz-border-radius: 4px;\n                border-radius: 4px;\n                color: #fff;\n                font-family: \"Ubuntu\";\n                font-size: 12px;\n                border: none;\n                outline: none;\n            }\n            ");
        fo.startDiv({
            id: "mChDiv",
            class: "chDiv"
        }, ci => {
            fo.addDiv({
                id: "mChMain",
                class: "chMainDiv",
                appendID: "mChDiv"
            }, cC => {});
            ci.text({
                id: "mChBox",
                class: "chMainBox",
                placeHolder: "To chat click here or press \"Enter\" key"
            });
        });
        let fb = getEl("mChMain");
        let fR = getEl("mChBox");
        let fD = false;
        let fZ = 0;
        fR.value = "";
        fR.addEventListener("focus", () => {
            fD = true;
        });
        fR.addEventListener("blur", () => {
            fD = false;
        });
        // Typing in a menu field must not move you or fire keybinds.
        function roboticsKeepKeysInField(ci) {
            ci.addEventListener("keydown", cC => cC.stopPropagation());
            ci.addEventListener("keyup", cC => cC.stopPropagation());
        }
        // Player names and chat are text: never let them become HTML in the page.
        function roboticsEscapeHtml(ci) {
            return String(ci).replace(/[&<>"']/g, cC => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            })[cC]);
        }
        function fO(ci, cC, cK, cd) {
            fo.set("menuChatDiv");
            cK = cK || "white";
            ci = ci ? roboticsEscapeHtml(ci) : ci;
            cC = cC ? roboticsEscapeHtml(cC) : cC;
            let ck = new Date();
            let cQ = ck.getMinutes();
            let cg = ck.getHours();
            let cp = cg >= 12 ? "PM" : "AM";
            let cW = "";
            if (!cd) {
                cW += "<span style=\"color: white;\">[" + (cg % 12 + ":" + cQ + " " + cp) + "] </span>";
            }
            if (ci) {
                cW += "" + ci;
            }
            if (cC) {
                cW += (ci ? ": " : !cd ? " " : "") + cC + "\n";
            }
            fo.addDiv({
                id: "menuChDisp" + fZ,
                style: "color: " + cK,
                appendID: "mChMain"
            }, ct => {
                ct.add(cW);
            });
            // Keep the log from growing for the whole session.
            while (fb.childElementCount > CONFIG.chatLogLimit) {
                fb.removeChild(fb.firstChild);
            }
            fb.scrollTop = fb.scrollHeight;
            fZ++;
        }
        function fI() {
            fb.innerHTML = "";
            fZ = 0;
            fO("Script", "Thank You for Using this mod, Have fun!", "#0f0", 1);
        }
        fI();
        document.body.addEventListener("click", ci => {
            if (ci.target.classList.contains("tab-btn")) {
                const cC = ci.target.dataset.tab;
                document.querySelectorAll("#modmenus-sidebar .tab-btn").forEach(cd => {
                    cd.classList.remove("active");
                });
                document.querySelectorAll(".tab-content").forEach(cd => {
                    cd.classList.remove("active");
                });
                ci.target.classList.add("active");
                const cK = document.getElementById(cC);
                if (cK) {
                    cK.classList.add("active");
                }
            }
        });
        document.body.addEventListener("input", ci => {
            if (ci.target && ci.target.classList.contains("search-input")) {
                const cC = ci.target.value.toLowerCase();
                const cK = ci.target.closest(".tab-content");
                if (cK) {
                    const cd = cK.querySelectorAll("span");
                    cd.forEach(ck => {
                        const cQ = ck.textContent.toLowerCase().includes(cC);
                        ck.style.display = cQ ? "" : "none";
                    });
                }
            }
        });
        document.body.addEventListener("input", ci => {
            if (ci.target && ci.target.classList.contains("search-input")) {
                const cC = ci.target.value.toLowerCase();
                const cK = ci.target.closest(".tab-content");
                if (cK) {
                    const cd = cK.querySelectorAll(".checkbox-container");
                    cd.forEach(ck => {
                        const cQ = ck.querySelector(".checkbox-name");
                        if (cQ) {
                            const cg = cQ.textContent.toLowerCase().includes(cC);
                            ck.style.display = cg ? "" : "none";
                        }
                    });
                }
            }
        });
        // If the document was already parsed when this file ran (late injection),
        // DOMContentLoaded never fires again and no tab would be highlighted.
        function fActivateDefaultTab() {
            const ci = document.getElementById("offensive");
            const cC = document.querySelector("#modmenus-sidebar .tab-btn[data-tab=\"offensive\"]");
            if (ci) {
                ci.classList.add("active");
            }
            if (cC) {
                cC.classList.add("active");
            }
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fActivateDefaultTab);
        } else {
            fActivateDefaultTab();
        }
        let fu = {};
        let fl = {};
        let fB = undefined;
        let fL = false;
        // Packets sent in the last second; kept up to date by roboticsLimiter.
        let fy = 0;
        /* The one scheduler. Real ticks come from the server's player update
           ("a" packet, see VZ); when the server is quiet (menu, dead) the render
           loop runs fallback ticks at the same rate via pump(). tickBase()
           callbacks live in a ring of slots, so nothing grows over time, and
           each callback runs in its own try/catch. */
        let fU = {
            tick: 0,
            tickRate: CONFIG.tick.rate,
            tickSpeed: 0,
            lastTick: performance.now(),
            lastRealTick: 0,
            lastFallbackTick: 0,
            slots: Array.from({
                length: CONFIG.tick.slots
            }, () => []),
            tasks: [],
            // Run ci once, cC ticks from now (at least one tick).
            tickBase: function (ci, cC) {
                let cK = Math.floor(cC);
                if (!(cK >= 1)) {
                    cK = 1;
                }
                if (cK >= this.slots.length) {
                    cK = this.slots.length - 1;
                }
                this.slots[(this.tick + cK) % this.slots.length].push(ci);
            },
            // Run ci on every cC-th tick (real or fallback).
            every: function (cC, ci) {
                this.tasks.push({
                    every: cC,
                    fn: ci
                });
            },
            beginTick: function (ci) {
                this.tick++;
                if (ci) {
                    this.lastRealTick = performance.now();
                }
                roboticsLimiter.newTick();
                for (let cC = 0; cC < this.tasks.length; cC++) {
                    if (this.tick % this.tasks[cC].every === 0) {
                        roboticsSafeCall(this.tasks[cC].fn, "scheduled task");
                    }
                }
            },
            runDue: function () {
                let ci = this.tick % this.slots.length;
                let cC = this.slots[ci];
                if (!cC.length) {
                    return;
                }
                this.slots[ci] = [];
                for (let cK = 0; cK < cC.length; cK++) {
                    roboticsSafeCall(cC[cK], "tick callback");
                }
            },
            pump: function (ci) {
                if (ci - this.lastRealTick < CONFIG.tick.fallbackAfter || ci - this.lastFallbackTick < this.tickRate) {
                    return;
                }
                this.lastFallbackTick = ci;
                this.beginTick(false);
                this.runDue();
            },
            clear: function () {
                for (let ci = 0; ci < this.slots.length; ci++) {
                    this.slots[ci] = [];
                }
            }
        };
        /* Packet budget: CONFIG.packets, overridden by the menu's Packet Budget
           Limit (packets per second) and Strictness (packets kept free for
           heals: 3 x strictness + 3, so the default 2 keeps 9). */
        let roboticsBudget = {
            perSecond: CONFIG.packets.perSecond,
            perTick: CONFIG.packets.perTick,
            reserve: CONFIG.packets.reserve
        };
        function roboticsPacketBudget() {
            let ci = parseInt(fl.packetLimit);
            let cC = parseInt(fl.packetStrictness);
            roboticsBudget.perSecond = ci >= 30 && ci <= 120 ? ci : CONFIG.packets.perSecond;
            roboticsBudget.reserve = cC >= 2 && cC <= 4 ? cC * 3 + 3 : CONFIG.packets.reserve;
            return roboticsBudget;
        }
        function roboticsPacketPriority(ci, cC) {
            switch (ci) {
                case "M":
                    return 0;
                case "D":
                case "9":
                case "e":
                case "0":
                    return 2;
                case "6":
                case "S":
                case "P":
                case "L":
                case "N":
                case "b":
                case "Q":
                    return 3;
                case "c":
                    return cC && cC[0] === 1 ? 3 : 1;
                default:
                    return 1;
            }
        }
        /* Packet limiter. Priorities: 0 heal/spawn, 1 combat (hit, weapon,
           place, hat, upgrade), 2 aim/move/ping, 3 chat/buy/clan. A packet is
           sent at once when the budget allows, otherwise it waits for the next
           tick. Aim, move and ping keep only their newest queued copy. run()
           reserves room for a whole sequence (select item, use, re-select
           weapon) so it is never split across ticks. */
        let roboticsLimiter = {
            stamps: new Float64Array(Math.max(CONFIG.packets.perSecond, 120) + 1),
            head: 0,
            count: 0,
            tickCount: 0,
            prepaid: 0,
            dropped: 0,
            queue: [[], [], [], []],
            purge: function (ci) {
                let cC = this.stamps.length;
                while (this.count > 0 && ci - this.stamps[(this.head - this.count + cC) % cC] >= 1000) {
                    this.count--;
                }
            },
            canSend: function (ci, cC) {
                this.purge(performance.now());
                let cK = roboticsPacketBudget();
                if (this.count + ci > (cC === 0 ? cK.perSecond : cK.perSecond - cK.reserve)) {
                    return false;
                }
                return cC === 0 || this.tickCount + ci <= cK.perTick;
            },
            emit: function (ci, cC, cK) {
                ci.nsend(cK);
                this.stamps[this.head] = performance.now();
                this.head = (this.head + 1) % this.stamps.length;
                if (this.count < this.stamps.length) {
                    this.count++;
                }
                this.tickCount++;
                fy = this.count;
                if (cC === "0") {
                    Vk = Date.now();
                }
            },
            send: function (ci, cC, cK, cd) {
                if (this.prepaid > 0) {
                    this.prepaid--;
                    this.emit(ci, cC, cd);
                    return;
                }
                let ck = roboticsPacketPriority(cC, cK);
                if (!this.queue[ck].length && this.canSend(1, ck)) {
                    this.emit(ci, cC, cd);
                    return;
                }
                let cQ = this.queue[ck];
                if (cC === "D" || cC === "9" || cC === "0") {
                    for (let cg = 0; cg < cQ.length; cg++) {
                        if (cQ[cg].type === cC) {
                            cQ[cg].bytes = cd;
                            cQ[cg].tick = fU.tick;
                            return;
                        }
                    }
                }
                if (cQ.length >= CONFIG.packets.queueLimit) {
                    this.dropped++;
                    if (ck === 3) {
                        return;
                    }
                    cQ.shift();
                }
                cQ.push({
                    ws: ci,
                    type: cC,
                    bytes: cd,
                    tick: fU.tick,
                    // A late click lands at the wrong moment; toggles, swaps and releases must still arrive.
                    stale: cC === "F" && cK && cK[0] === 1
                });
            },
            newTick: function () {
                this.tickCount = 0;
                for (let ci = 0; ci < this.queue.length; ci++) {
                    let cC = this.queue[ci];
                    while (cC.length) {
                        let cK = cC[0];
                        if (cK.ws.readyState !== WebSocket.OPEN || cK.stale && fU.tick - cK.tick > 2) {
                            cC.shift();
                            this.dropped++;
                            continue;
                        }
                        if (!this.canSend(1, ci)) {
                            break;
                        }
                        cC.shift();
                        this.emit(cK.ws, cK.type, cK.bytes);
                    }
                }
            },
            // Send a fixed-size packet sequence now if it fits; false if it doesn't.
            run: function (ci, cC, cK) {
                if (!fB || fB.readyState !== WebSocket.OPEN || !this.canSend(ci, cC)) {
                    return false;
                }
                if (cC !== 0 && this.tickCount + ci > roboticsBudget.perTick - CONFIG.packets.placeReserve) {
                    return false;
                }
                this.prepaid = ci;
                try {
                    cK();
                } finally {
                    this.prepaid = 0;
                }
                return true;
            },
            queued: function () {
                return this.queue[0].length + this.queue[1].length + this.queue[2].length + this.queue[3].length;
            }
        };
        let fm = [];
        let fj = false;
        let fJ = {
            last: 0,
            time: 0,
            ltime: 0
        };
        let fX = ["cc", 1, "__proto__"];
        // The page may have cached the original send at load time, so the real
        // interception point is the trampoline installed at document-start.
        WebSocket.prototype.nsend = ROBOTICS_NATIVE_SEND || WebSocket.prototype.send;
        window.__ROBOTICS_SEND_HANDLER = function (ci) {
            // The optional sync socket is not the game socket.
            if (typeof this.url === "string" && this.url.indexOf(CONFIG.sync.url) === 0) {
                return this.nsend(ci);
            }
            if (!fB) {
                fB = this;
                fB.addEventListener("message", function (cC) {
                    // Artificial Ping (Falcon): handle server packets later, in order.
                    if (fu.artificialPing) {
                        setTimeout(A3, (parseInt(fl.artificialPing) || 35) / 2, cC);
                    } else {
                        A3(cC);
                    }
                });
                fB.addEventListener("close", cC => {
                    // Rejoin after a disconnect, but rate-limit the reload so a
                    // flapping server cannot put the tab into an endless loop.
                    roboticsSafeReload("game socket closed");
                });
                fB.addEventListener("error", () => {
                    console.warn("[Robotics] game socket error.");
                });
            }
            if (fB == this) {
                if (!roboticsHasMsgpack()) {
                    console.warn("[Robotics] msgpack is missing; sending packets unmodified.");
                    this.nsend(ci);
                    return;
                }
                fj = false;
                let cC = new Uint8Array(ci);
                let cK;
                try {
                    cK = msgpack.decode(cC);
                } catch (err) {
                    console.warn("[Robotics] could not decode an outgoing packet; sending it unmodified.", err);
                    this.nsend(ci);
                    return;
                }
                let cd = cK[0];
                cC = cK[1];
                if (cd == "6") {
                    let ck = cC[0];
                    if (ck) {
                        e8.forEach(cQ => {
                            let cg = new RegExp(cQ, "g");
                            ck = ck.replace(cg, cp => {
                                return cp[0].toUpperCase() + cp.slice(1);
                            });
                        });
                        cC[0] = ck.slice(0, 30);
                    }
                } else if (cd == "L") {
                    cC[0] = cC[0] + String.fromCharCode(0).repeat(7);
                    cC[0] = cC[0].slice(0, 7);
                } else if (cd == "M") {
                    cC[0].name = cC[0].name == "" ? "unknown" : cC[0].name;
                    cC[0].moofoll = true;
                    cC[0].skin = cC[0].skin == 10 ? "__proto__" : cC[0].skin;
                    fX = [cC[0].name, cC[0].moofoll, cC[0].skin];
                } else if (cd == "D") {
                    if (AW.lastDir == cC[0] || [null, undefined].includes(cC[0])) {
                        fj = true;
                    } else {
                        AW.lastDir = cC[0];
                    }
                } else if (cd == "F") {
                    if (!cC[2]) {
                        fj = true;
                    } else if (![null, undefined].includes(cC[1])) {
                        AW.lastDir = cC[1];
                    }
                } else if (cd == "K") {
                    if (!cC[1]) {
                        fj = true;
                    }
                } else if (cd == "S") {
                    sc.wait = !sc.wait;
                    if (!fu.allowPing) {
                        fj = true;
                    }
                } else if (cd == "9") {
                    if (Ai && cC[1]) {
                        if (Ai.moveDir == cC[0]) {
                            fj = true;
                        } else {
                            Ai.moveDir = cC[0];
                        }
                        if (Ai.moveDir || Ai.moveDir == 0) {
                            Ai.moveTime = Date.now();
                        }
                    } else {
                        fj = true;
                    }
                } else if (cd == "0") {
                    if (!cC[0]) {
                        fj = true;
                    }
                } else if (cd == "P") {
                    if (!cC[2]) {
                        VT.shift();
                    } else {
                        VT = VT.filter(cQ => cQ != cC[0]);
                    }
                } else if (cd == "e") {
                    if (Ai) {
                        Ai.moveDir = undefined;
                    }
                }
                if (!fj) {
                    let cQ;
                    try {
                        cQ = msgpack.encode([cd, cC]);
                    } catch (err) {
                        console.warn("[Robotics] could not encode an outgoing packet; sending it unmodified.", err);
                        cQ = ci;
                    }
                    roboticsLimiter.send(this, cd, cC, cQ);
                }
            } else {
                this.nsend(ci);
            }
        };
        function A0(ci) {
            if (!fB || !roboticsHasMsgpack() || fB.readyState !== WebSocket.OPEN) {
                return;
            }
            try {
                let cC = Array.prototype.slice.call(arguments, 1);
                let cK = msgpack.encode([ci, cC]);
                fB.send(cK);
            } catch (err) {
                console.warn("[Robotics] failed to send packet " + ci + ":", err);
            }
        }
        let A2 = {
            send: A0
        };
        function A3(ci) {
            if (!roboticsHasMsgpack()) {
                return;
            }
            let cC = new Uint8Array(ci.data);
            let cK;
            try {
                cK = msgpack.decode(cC);
            } catch (err) {
                return;
            }
            let cd = cK[0];
            cC = cK[1];
            let ck = {
                A: Vc,
                C: VF,
                D: VH,
                E: VN,
                a: VZ,
                G: Va,
                H: Vu,
                I: Vl,
                J: VB,
                K: Vw,
                L: VL,
                M: Vy,
                N: Vh,
                O: VK,
                P: Vp,
                Q: Vz,
                R: Vx,
                S: VW,
                T: Vt,
                U: Vn,
                V: VP,
                X: Vq,
                Y: VU,
                Z: Vm,
                2: VJ,
                3: VX,
                4: r0,
                5: r1,
                6: r3,
                7: r4,
                8: r5,
                9: rJ,
                0: VQ
            };
            try {
                if (cd == "io-init") {
                    // nothing to do: no cipher on this host
                } else if (cd === "a") {
                    let cg = performance.now();
                    VZ.apply(undefined, cC);
                    roboticsPerf.add(roboticsPerf.tick, performance.now() - cg);
                } else if (ck[cd]) {
                    ck[cd].apply(undefined, cC);
                }
            } catch (err) {
                console.warn("[Robotics] failed to handle server packet " + cd + ":", err);
            }
        }
        /* Timing readout: average and worst frame (render) time and tick
           handler time over the last second, shown after Ping/FPS. */
        let roboticsPerf = {
            frame: {
                sum: 0,
                max: 0,
                n: 0
            },
            tick: {
                sum: 0,
                max: 0,
                n: 0
            },
            text: "",
            lastRoll: 0,
            add: function (ci, cC) {
                ci.sum += cC;
                ci.n++;
                if (cC > ci.max) {
                    ci.max = cC;
                }
            },
            // Returns true once per second, after updating .text.
            roll: function (ci) {
                if (ci - this.lastRoll < 1000) {
                    return false;
                }
                this.lastRoll = ci;
                let cC = cK => cK.n ? (cK.sum / cK.n).toFixed(2) + "/" + cK.max.toFixed(1) : "-";
                this.text = " | frame " + cC(this.frame) + " ms | tick " + cC(this.tick) + " ms (" + this.tick.n + "/s) | queued " + roboticsLimiter.queued();
                this.frame.sum = this.frame.max = this.frame.n = 0;
                this.tick.sum = this.tick.max = this.tick.n = 0;
                return true;
            }
        };
        Math.lerpAngle = function (ci, cC, cK) {
            let cd = Math.abs(cC - ci);
            if (cd > Math.PI) {
                if (ci > cC) {
                    cC += Math.PI * 2;
                } else {
                    ci += Math.PI * 2;
                }
            }
            let ck = cC + (ci - cC) * cK;
            if (ck >= 0 && ck <= Math.PI * 2) {
                return ck;
            }
            return ck % (Math.PI * 2);
        };
        CanvasRenderingContext2D.prototype.roundRect = function (ci, cC, cK, cd, ck) {
            if (cK < ck * 2) {
                ck = cK / 2;
            }
            if (cd < ck * 2) {
                ck = cd / 2;
            }
            if (ck < 0) {
                ck = 0;
            }
            this.beginPath();
            this.moveTo(ci + ck, cC);
            this.arcTo(ci + cK, cC, ci + cK, cC + cd, ck);
            this.arcTo(ci + cK, cC + cd, ci, cC + cd, ck);
            this.arcTo(ci, cC + cd, ci, cC, ck);
            this.arcTo(ci, cC, ci + cK, cC, ck);
            this.closePath();
            return this;
        };
        let A4 = undefined;
        let A5 = undefined;
        var A6 = {
            animationTime: 0,
            land: null,
            lava: null,
            x: r.volcanoLocationX,
            y: r.volcanoLocationY
        };
        let A7 = false;
        let A8 = {
            mex: 0,
            mey: 0
        };
        let AA = [];
        let Ae = [];
        let As = [];
        let AV = [];
        let Ar = [];
        let Ac = [];
        let AF = [];
        let AH = [];
        let AN = [];
        let Ai;
        let AC;
        let AK;
        let Ad = [];
        let Ak = [];
        let AQ = {};
        let Ag = undefined;
        let Ap = {
            min: 0,
            max: 0,
            avg: 0
        };
        let AW = {
            healed: false,
            reloaded: false,
            waitHit: 0,
            autoAim: false,
            revAim: false,
            ageInsta: true,
            reSync: false,
            bullTick: true,
            anti0Tick: 0,
            antiSync: false,
            safePrimary: function (ci) {
                return [0, 8].includes(ci.primaryIndex);
            },
            safeSecondary: function (ci) {
                return [10, 11, 14].includes(ci.secondaryIndex);
            },
            lastDir: 0,
            autoPush: false,
            pushData: {},
            millPlacePos: {
                x: 0,
                y: 0
            },
            antiInsta: false,
            forceStop: false,
            // Heal sent but not yet applied by the server, so two heal paths in one tick don't both eat to full.
            pendingHeal: 0,
            pendingHealAt: 0,
            // Auto gather state the player picked with the auto gather key.
            userGather: false,
            // Tick at which the Shift / reset pause of auto push and auto play ends.
            pauseUntil: 0,
            // Smart Anti-Insta: decided once per tick.
            lethalTick: -1,
            lethalHandled: false
        };
        let At = {};
        function An(ci, cC) {
            return ci.find(cK => cK.id == cC);
        }
        function Az(ci, cC) {
            return ci.find(cK => cK.sid == cC);
        }
        function Ax(ci) {
            return An(Ae, ci);
        }
        function AM(ci) {
            return Az(Ae, ci);
        }
        function AY(ci) {
            return Az(AA, ci);
        }
        /* Spatial grid (ported from Falcon's ObjectManager). Game objects are
           bucketed by chunk (CONFIG.grid.chunk px) and indexed by sid, so finding
           nearby objects scans only the chunks a box touches instead of every
           object, and sid lookups are a Map read. Objects never move; s6.add()
           inserts them and the cleanup task removes them. */
        let roboticsGrid = {
            size: CONFIG.grid.chunk,
            cells: new Map(),
            bySid: new Map(),
            turrets: new Set(),
            key: function (ci, cC) {
                return (ci / this.size | 0) << 16 | cC / this.size & 65535;
            },
            insert: function (ci) {
                this.remove(ci);
                let cC = this.key(ci.x, ci.y);
                let cK = this.cells.get(cC);
                if (!cK) {
                    this.cells.set(cC, cK = []);
                }
                cK.push(ci);
                ci.gridKey = cC;
                if (ci.name == "turret") {
                    this.turrets.add(ci);
                }
                if (ci.sid != null) {
                    this.bySid.set(ci.sid, ci);
                    ci.gridSid = ci.sid;
                }
            },
            remove: function (ci) {
                if (ci.gridKey !== undefined) {
                    let cC = this.cells.get(ci.gridKey);
                    let cK = cC ? cC.indexOf(ci) : -1;
                    if (cK >= 0) {
                        cC[cK] = cC[cC.length - 1];
                        cC.pop();
                    }
                    ci.gridKey = undefined;
                }
                this.turrets.delete(ci);
                if (ci.gridSid !== undefined) {
                    if (this.bySid.get(ci.gridSid) === ci) {
                        this.bySid.delete(ci.gridSid);
                    }
                    ci.gridSid = undefined;
                }
            },
            clear: function () {
                this.cells.clear();
                this.bySid.clear();
                this.turrets.clear();
            },
            // Every object in the chunks the box (x +- r, y +- r) touches. No distance filter.
            near: function (ci, cC, cK, cd) {
                cd = cd || [];
                cd.length = 0;
                let ck = this.size;
                let cQ = (ci - cK) / ck | 0;
                let cg = (ci + cK) / ck | 0;
                let cp = (cC - cK) / ck | 0;
                let cW = (cC + cK) / ck | 0;
                for (let ct = cQ; ct <= cg; ct++) {
                    for (let cn = cp; cn <= cW; cn++) {
                        let cz = this.cells.get(ct << 16 | cn & 65535);
                        if (cz) {
                            for (let cx = 0; cx < cz.length; cx++) {
                                cd.push(cz[cx]);
                            }
                        }
                    }
                }
                return cd;
            }
        };
        // Scratch array for grid lookups whose result is filtered right away.
        let roboticsNearTmp = [];
        function Ao(ci) {
            return roboticsGrid.bySid.get(ci);
        }
        function AG(ci) {
            return roboticsGrid.bySid.get(ci);
        }
        let AS;
        let Av;
        let AE = r.maxScreenWidth;
        let Ab = r.maxScreenHeight;
        let AR = 1;
        let AD;
        let AZ;
        let AO = performance.now();
        let Aa;
        let Au;
        let Al;
        let AB = 0;
        let Aw = 0;
        let AL = 1;
        let Ay = 0;
        let Ah = "#525252";
        let AP = "#3d3f42";
        let Aq = 5.5;
        let AU = true;
        let Am = true;
        let AT = {};
        let Aj = {
            87: [0, -1],
            38: [0, -1],
            83: [0, 1],
            40: [0, 1],
            65: [-1, 0],
            37: [-1, 0],
            68: [1, 0],
            39: [1, 0]
        };
        let AJ = 0;
        let AX = false;
        let e0 = {};
        let e1 = {
            place: 0,
            placeSpawnPads: 0,
            old: {
                x: 0,
                y: 0
            },
            millDist: 99,
            spawnDist: 124
        };
        let e2;
        let e4 = true;
        window.onblur = function () {
            e4 = false;
        };
        window.onfocus = function () {
            e4 = true;
            if (Ai && Ai.alive) {}
        };
        let e5 = [];
        let e6 = [];
        let e7 = [];
        let e8 = ["cunt", "whore", "fuck", "shit", "faggot", "nigger", "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex", "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune", "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];
        class e9 {
            constructor() {
                let ci = Math.abs;
                let cC = Math.cos;
                let cK = Math.sin;
                let cd = Math.pow;
                let ck = Math.sqrt;
                let cQ = Math.atan2;
                let cg = Math.PI;
                let cp = this;
                this.round = function (cW, ct) {
                    return Math.round(cW * ct) / ct;
                };
                this.randInt = function (cW, ct) {
                    return Math.floor(Math.random() * (ct - cW)) + cW;
                };
                this.randFloat = function (cW, ct) {
                    return Math.random() * (ct - cW) + cW;
                };
                this.lerp = function (cW, ct, cn) {
                    return cW + (ct - cW) * cn;
                };
                this.getDistance = function (cW, ct, cn, cz) {
                    return ck((cn -= cW) * cn + (cz -= ct) * cz);
                };
                // Position kinds: 0 = (x, y), 1 = (x1, y1), 2 = (x2, y2), 3 = (x3, y3).
                // Read straight from the objects: these run thousands of times per tick
                // and used to allocate two temporary objects per call.
                const roboticsPx = (co, cG) => cG == 0 ? co.x : cG == 1 ? co.x1 : cG == 2 ? co.x2 : cG == 3 && co.x3;
                const roboticsPy = (co, cG) => cG == 0 ? co.y : cG == 1 ? co.y1 : cG == 2 ? co.y2 : cG == 3 && co.y3;
                this.getDist = function (cW, ct, cn, cz) {
                    let cx = roboticsPx(ct, cz) - roboticsPx(cW, cn);
                    let cM = roboticsPy(ct, cz) - roboticsPy(cW, cn);
                    return ck(cx * cx + cM * cM);
                };
                this.findMiddlePoint = function (cW, ct, cn, cz) {
                    const cx = (co, cG) => {
                        switch (cG) {
                            case 0:
                                return {
                                    x: co.x,
                                    y: co.y
                                };
                            case 1:
                                return {
                                    x: co.x1,
                                    y: co.y1
                                };
                            case 2:
                                return {
                                    x: co.x2,
                                    y: co.y2
                                };
                            case 3:
                                return {
                                    x: co.x3,
                                    y: co.y3
                                };
                            default:
                                throw new Error("Invalid type");
                        }
                    };
                    const cM = cx(cW, cn);
                    const cY = cx(ct, cz);
                    return {
                        x: (cM.x + cY.x) / 2,
                        y: (cM.y + cY.y) / 2
                    };
                };
                this.getDirection = function (cW, ct, cn, cz) {
                    return cQ(ct - cz, cW - cn);
                };
                this.getDirect = function (cW, ct, cn, cz) {
                    return cQ(roboticsPy(cW, cn) - roboticsPy(ct, cz), roboticsPx(cW, cn) - roboticsPx(ct, cz));
                };
                this.getAngleDist = function (cW, ct) {
                    let cn = ci(ct - cW) % (cg * 2);
                    if (cn > cg) {
                        return cg * 2 - cn;
                    } else {
                        return cn;
                    }
                };
                this.sFormat = function (cW) {
                    let ct = [{
                        num: 1000,
                        string: "k"
                    }, {
                        num: 1000000,
                        string: "m"
                    }, {
                        num: 1000000000,
                        string: "b"
                    }, {
                        num: 1000000000000,
                        string: "q"
                    }].reverse();
                    let cn = ct.find(cz => cW >= cz.num);
                    if (!cn) {
                        return cW;
                    }
                    return (cW / cn.num).toFixed(1) + cn.string;
                };
                this.capitalizeFirst = function (cW) {
                    return cW.charAt(0).toUpperCase() + cW.slice(1);
                };
                this.lineInRect = function (cW, ct, cn, cz, cx, cM, cY, co) {
                    let cG = cx;
                    let cS = cY;
                    if (cx > cY) {
                        cG = cY;
                        cS = cx;
                    }
                    if (cS > cn) {
                        cS = cn;
                    }
                    if (cG < cW) {
                        cG = cW;
                    }
                    if (cG > cS) {
                        return false;
                    }
                    let cv = cM;
                    let cE = co;
                    let cb = cY - cx;
                    if (Math.abs(cb) > 1e-7) {
                        let cR = (co - cM) / cb;
                        let cD = cM - cR * cx;
                        cv = cR * cG + cD;
                        cE = cR * cS + cD;
                    }
                    if (cv > cE) {
                        let cZ = cE;
                        cE = cv;
                        cv = cZ;
                    }
                    if (cE > cz) {
                        cE = cz;
                    }
                    if (cv < ct) {
                        cv = ct;
                    }
                    if (cv > cE) {
                        return false;
                    }
                    return true;
                };
                this.containsPoint = function (cW, ct, cn) {
                    let cz = cW.getBoundingClientRect();
                    let cx = cz.left + window.scrollX;
                    let cM = cz.top + window.scrollY;
                    let cY = cz.width;
                    let co = cz.height;
                    let cG = ct > cx && ct < cx + cY;
                    let cS = cn > cM && cn < cM + co;
                    return cG && cS;
                };
                this.mousifyTouchEvent = function (cW) {
                    let ct = cW.changedTouches[0];
                    cW.screenX = ct.screenX;
                    cW.screenY = ct.screenY;
                    cW.clientX = ct.clientX;
                    cW.clientY = ct.clientY;
                    cW.pageX = ct.pageX;
                    cW.pageY = ct.pageY;
                };
                this.hookTouchEvents = function (cW, ct) {
                    let cn = !ct;
                    let cz = false;
                    let cx = false;
                    cW.addEventListener("touchstart", this.checkTrusted(cM), cx);
                    cW.addEventListener("touchmove", this.checkTrusted(cY), cx);
                    cW.addEventListener("touchend", this.checkTrusted(co), cx);
                    cW.addEventListener("touchcancel", this.checkTrusted(co), cx);
                    cW.addEventListener("touchleave", this.checkTrusted(co), cx);
                    function cM(cG) {
                        cp.mousifyTouchEvent(cG);
                        window.setUsingTouch(true);
                        if (cn) {
                            cG.preventDefault();
                            cG.stopPropagation();
                        }
                        if (cW.onmouseover) {
                            cW.onmouseover(cG);
                        }
                        cz = true;
                    }
                    function cY(cG) {
                        cp.mousifyTouchEvent(cG);
                        window.setUsingTouch(true);
                        if (cn) {
                            cG.preventDefault();
                            cG.stopPropagation();
                        }
                        if (cp.containsPoint(cW, cG.pageX, cG.pageY)) {
                            if (!cz) {
                                if (cW.onmouseover) {
                                    cW.onmouseover(cG);
                                }
                                cz = true;
                            }
                        } else if (cz) {
                            if (cW.onmouseout) {
                                cW.onmouseout(cG);
                            }
                            cz = false;
                        }
                    }
                    function co(cG) {
                        cp.mousifyTouchEvent(cG);
                        window.setUsingTouch(true);
                        if (cn) {
                            cG.preventDefault();
                            cG.stopPropagation();
                        }
                        if (cz) {
                            if (cW.onclick) {
                                cW.onclick(cG);
                            }
                            if (cW.onmouseout) {
                                cW.onmouseout(cG);
                            }
                            cz = false;
                        }
                    }
                };
                this.removeAllChildren = function (cW) {
                    while (cW.hasChildNodes()) {
                        cW.removeChild(cW.lastChild);
                    }
                };
                this.generateElement = function (cW) {
                    let ct = document.createElement(cW.tag || "div");
                    function cn(cz, cx) {
                        if (cW[cz]) {
                            ct[cx] = cW[cz];
                        }
                    }
                    cn("text", "textContent");
                    cn("html", "innerHTML");
                    cn("class", "className");
                    for (let cz in cW) {
                        switch (cz) {
                            case "tag":
                            case "text":
                            case "html":
                            case "class":
                            case "style":
                            case "hookTouch":
                            case "parent":
                            case "children":
                                continue;
                            default:
                                break;
                        }
                        ct[cz] = cW[cz];
                    }
                    if (ct.onclick) {
                        ct.onclick = this.checkTrusted(ct.onclick);
                    }
                    if (ct.onmouseover) {
                        ct.onmouseover = this.checkTrusted(ct.onmouseover);
                    }
                    if (ct.onmouseout) {
                        ct.onmouseout = this.checkTrusted(ct.onmouseout);
                    }
                    if (cW.style) {
                        ct.style.cssText = cW.style;
                    }
                    if (cW.hookTouch) {
                        this.hookTouchEvents(ct);
                    }
                    if (cW.parent) {
                        cW.parent.appendChild(ct);
                    }
                    if (cW.children) {
                        for (let cx = 0; cx < cW.children.length; cx++) {
                            ct.appendChild(cW.children[cx]);
                        }
                    }
                    return ct;
                };
                this.checkTrusted = function (cW) {
                    return function (ct) {
                        if (ct && ct instanceof Event && (ct && typeof ct.isTrusted == "boolean" ? ct.isTrusted : true)) {
                            cW(ct);
                        } else {}
                    };
                };
            }
        }
        ;
        class ef {
            constructor() {
                this.init = function (ci, cC, cK, cd, ck, cQ, cg) {
                    this.x = ci;
                    this.y = cC;
                    this.color = cg;
                    this.scale = cK * 3.5;
                    this.weight = 50;
                    this.startScale = this.scale * 1.2;
                    this.maxScale = cK * 1.5;
                    this.minScale = cK * 0.5;
                    this.scaleSpeed = 0.7;
                    this.speed = cd;
                    this.speedMax = cd;
                    this.life = ck;
                    this.maxLife = ck;
                    this.text = cQ;
                    this.movSpeed = cd;
                };
                this.update = function (ci) {
                    if (this.life) {
                        this.life -= ci;
                        if (this.scaleSpeed != -0.35) {
                            this.y -= this.speed * ci;
                        } else {
                            this.y -= this.speed * ci;
                        }
                        this.scale -= 0.8;
                        if (this.scale >= this.maxScale) {
                            this.scale = this.maxScale;
                            this.scaleSpeed *= -0.5;
                            this.speed = this.speed * 0.75;
                        }
                        ;
                        if (this.life <= 0) {
                            this.life = 0;
                        }
                    }
                    ;
                };
                this.render = function (ci, cC, cK) {
                    ci.lineWidth = 10;
                    ci.strokeStyle = AP;
                    ci.fillStyle = this.color;
                    ci.globalAlpha = 1;
                    ci.font = this.scale + "px HammerSmith One";
                    ci.strokeText(this.text, this.x - cC, this.y - cK);
                    ci.fillText(this.text, this.x - cC, this.y - cK);
                    ci.globalAlpha = 1;
                };
            }
        }
        ;
        class eA {
            constructor() {
                this.texts = [];
                this.stack = [];
                this.update = function (ci, cC, cK, cd) {
                    cC.textBaseline = "middle";
                    cC.textAlign = "center";
                    for (let ck = 0; ck < this.texts.length; ++ck) {
                        if (this.texts[ck].life) {
                            this.texts[ck].update(ci);
                            this.texts[ck].render(cC, cK, cd);
                        }
                    }
                };
                this.showText = function (ci, cC, cK, cd, ck, cQ, cg) {
                    let cp;
                    for (let cW = 0; cW < this.texts.length; ++cW) {
                        if (!this.texts[cW].life) {
                            cp = this.texts[cW];
                            break;
                        }
                    }
                    if (!cp) {
                        cp = new ef();
                        this.texts.push(cp);
                    }
                    cp.init(ci, cC, cK, cd, ck, cQ, cg);
                };
            }
        }
        class ee {
            constructor(ci) {
                this.sid = ci;
                this.init = function (cC, cK, cd, ck, cQ, cg, cp) {
                    cg = cg || {};
                    this.sentTo = {};
                    this.gridLocations = [];
                    this.active = true;
                    this.alive = true;
                    this.doUpdate = cg.doUpdate;
                    this.x = cC;
                    this.y = cK;
                    if (r.anotherVisual) {
                        this.dir = cd + Math.PI;
                    } else {
                        this.dir = cd;
                    }
                    this.lastDir = cd;
                    this.xWiggle = 0;
                    this.yWiggle = 0;
                    this.visScale = ck;
                    this.scale = ck;
                    this.type = cQ;
                    this.id = cg.id;
                    this.owner = cp;
                    this.name = cg.name;
                    this.isItem = this.id != undefined;
                    this.group = cg.group;
                    this.maxHealth = cg.health;
                    this.health = this.maxHealth;
                    this.layer = 2;
                    if (this.group != undefined) {
                        this.layer = this.group.layer;
                    } else if (this.type == 0) {
                        this.layer = 3;
                    } else if (this.type == 2) {
                        this.layer = 0;
                    } else if (this.type == 4) {
                        this.layer = -1;
                    }
                    this.colDiv = cg.colDiv || 1;
                    this.blocker = cg.blocker;
                    this.ignoreCollision = cg.ignoreCollision;
                    this.dontGather = cg.dontGather;
                    this.hideFromEnemy = cg.hideFromEnemy;
                    this.friction = cg.friction;
                    this.projDmg = cg.projDmg;
                    this.dmg = cg.dmg;
                    this.pDmg = cg.pDmg;
                    this.pps = cg.pps;
                    this.zIndex = cg.zIndex || 0;
                    this.turnSpeed = cg.turnSpeed;
                    this.req = cg.req;
                    this.trap = cg.trap;
                    this.healCol = cg.healCol;
                    this.teleport = cg.teleport;
                    this.boostSpeed = cg.boostSpeed;
                    this.projectile = cg.projectile;
                    this.shootRange = cg.shootRange;
                    this.shootRate = cg.shootRate;
                    this.reloads = this.shootRate;
                    this.spawnPoint = cg.spawnPoint;
                    this.breakObj = false;
                    this.alpha = cg.alpha || 1;
                    this.maxAlpha = cg.alpha || 1;
                    this.damaged = 0;
                    this.breakTime = 0;
                };
                this.startFadeOut = function () {
                    this.fadingOut = true;
                };
                this.changeHealth = function (cC, cK) {
                    this.health += cC;
                    return this.health <= 0;
                };
                this.getScale = function (cC = 1, cK) {
                    return this.scale * (this.isItem || this.type == 2 || this.type == 3 || this.type == 4 ? 1 : cC * 0.6) * (cK ? 1 : this.colDiv);
                };
                this.visibleToPlayer = function (cC) {
                    return !this.hideFromEnemy || this.owner && (this.owner == cC || this.owner.team && cC.team == this.owner.team);
                };
                this.update = function (cC) {
                    if (this.active) {
                        if (this.xWiggle) {
                            this.xWiggle *= Math.pow(0.99, cC);
                        }
                        if (this.yWiggle) {
                            this.yWiggle *= Math.pow(0.99, cC);
                        }
                        if (this.turnSpeed && this.dmg) {
                            this.dir += this.turnSpeed * cC;
                        }
                    } else if (this.fadingOut) {
                        if (this.alpha > 0) {
                            this.alpha -= cC;
                            if (this.alpha <= 0) {
                                this.alpha = 0;
                                this.alive = false;
                                this.fadingOut = false;
                            }
                        }
                    } else if (this.alive) {
                        this.alpha -= cC / (200 / this.maxAlpha);
                        this.visScale += cC / (this.scale / 2.5);
                        if (this.alpha <= 0) {
                            this.alpha = 0;
                            this.alive = false;
                        }
                    }
                };
                this.isTeamObject = function (cC) {
                    if (this.owner == null) {
                        return true;
                    } else {
                        return this.owner && cC.sid == this.owner.sid || cC.findAllianceBySid(this.owner.sid);
                    }
                };
            }
        }
        class es {
            constructor() {
                this.groups = [{
                    id: 0,
                    name: "food",
                    layer: 0
                }, {
                    id: 1,
                    name: "walls",
                    place: true,
                    limit: 30,
                    layer: 0
                }, {
                    id: 2,
                    name: "spikes",
                    place: true,
                    limit: 15,
                    layer: 0
                }, {
                    id: 3,
                    name: "mill",
                    place: true,
                    limit: 7,
                    layer: 1
                }, {
                    id: 4,
                    name: "mine",
                    place: true,
                    limit: 1,
                    layer: 0
                }, {
                    id: 5,
                    name: "trap",
                    place: true,
                    limit: 6,
                    layer: -1
                }, {
                    id: 6,
                    name: "booster",
                    place: true,
                    limit: 12,
                    layer: -1
                }, {
                    id: 7,
                    name: "turret",
                    place: true,
                    limit: 2,
                    layer: 1
                }, {
                    id: 8,
                    name: "watchtower",
                    place: true,
                    limit: 12,
                    layer: 1
                }, {
                    id: 9,
                    name: "buff",
                    place: true,
                    limit: 4,
                    layer: -1
                }, {
                    id: 10,
                    name: "spawn",
                    place: true,
                    limit: 1,
                    layer: -1
                }, {
                    id: 11,
                    name: "sapling",
                    place: true,
                    limit: 2,
                    layer: 0
                }, {
                    id: 12,
                    name: "blocker",
                    place: true,
                    limit: 3,
                    layer: -1
                }, {
                    id: 13,
                    name: "teleporter",
                    place: true,
                    limit: 2,
                    layer: -1
                }];
                this.projectiles = [{
                    indx: 0,
                    layer: 0,
                    src: "arrow_1",
                    dmg: 25,
                    speed: 1.6,
                    scale: 103,
                    range: 1000
                }, {
                    indx: 1,
                    layer: 1,
                    dmg: 25,
                    speed: 1.5,
                    scale: 20,
                    range: 600
                }, {
                    indx: 0,
                    layer: 0,
                    src: "arrow_1",
                    dmg: 35,
                    speed: 2.5,
                    scale: 103,
                    range: 1200
                }, {
                    indx: 0,
                    layer: 0,
                    src: "arrow_1",
                    dmg: 30,
                    speed: 2,
                    scale: 103,
                    range: 1200
                }, {
                    indx: 1,
                    layer: 1,
                    dmg: 16,
                    scale: 20
                }, {
                    indx: 0,
                    layer: 0,
                    src: "bullet_1",
                    dmg: 50,
                    speed: 3.6,
                    scale: 160,
                    range: 1400
                }];
                this.weapons = [{
                    id: 0,
                    type: 0,
                    name: "tool hammer",
                    desc: "tool for gathering all resources",
                    src: "hammer_1",
                    length: 140,
                    width: 140,
                    xOff: -3,
                    yOff: 18,
                    dmg: 25,
                    range: 65,
                    gather: 1,
                    speed: 300
                }, {
                    id: 1,
                    type: 0,
                    age: 2,
                    name: "hand axe",
                    desc: "gathers resources at a higher rate",
                    src: "axe_1",
                    length: 140,
                    width: 140,
                    xOff: 3,
                    yOff: 24,
                    dmg: 30,
                    spdMult: 1,
                    range: 70,
                    gather: 2,
                    speed: 400
                }, {
                    id: 2,
                    type: 0,
                    age: 8,
                    pre: 1,
                    name: "great axe",
                    desc: "deal more damage and gather more resources",
                    src: "great_axe_1",
                    length: 140,
                    width: 140,
                    xOff: -8,
                    yOff: 25,
                    dmg: 35,
                    spdMult: 1,
                    range: 75,
                    gather: 4,
                    speed: 400
                }, {
                    id: 3,
                    type: 0,
                    age: 2,
                    name: "short sword",
                    desc: "increased attack power but slower move speed",
                    src: "sword_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 46,
                    dmg: 35,
                    spdMult: 0.85,
                    range: 110,
                    gather: 1,
                    speed: 300
                }, {
                    id: 4,
                    type: 0,
                    age: 8,
                    pre: 3,
                    name: "katana",
                    desc: "greater range and damage",
                    src: "samurai_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 59,
                    dmg: 40,
                    spdMult: 0.8,
                    range: 118,
                    gather: 1,
                    speed: 300
                }, {
                    id: 5,
                    type: 0,
                    age: 2,
                    name: "polearm",
                    desc: "long range melee weapon",
                    src: "spear_1",
                    iPad: 1.3,
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 53,
                    dmg: 45,
                    knock: 0.2,
                    spdMult: 0.82,
                    range: 142,
                    gather: 1,
                    speed: 700
                }, {
                    id: 6,
                    type: 0,
                    age: 2,
                    name: "bat",
                    desc: "fast long range melee weapon",
                    src: "bat_1",
                    iPad: 1.3,
                    length: 110,
                    width: 180,
                    xOff: -8,
                    yOff: 53,
                    dmg: 20,
                    knock: 0.7,
                    range: 110,
                    gather: 1,
                    speed: 300
                }, {
                    id: 7,
                    type: 0,
                    age: 2,
                    name: "daggers",
                    desc: "really fast short range weapon",
                    src: "dagger_1",
                    iPad: 0.8,
                    length: 110,
                    width: 110,
                    xOff: 18,
                    yOff: 0,
                    dmg: 20,
                    knock: 0.1,
                    range: 65,
                    gather: 1,
                    hitSlow: 0.1,
                    spdMult: 1.13,
                    speed: 100
                }, {
                    id: 8,
                    type: 0,
                    age: 2,
                    name: "stick",
                    desc: "great for gathering but very weak",
                    src: "stick_1",
                    length: 140,
                    width: 140,
                    xOff: 3,
                    yOff: 24,
                    dmg: 1,
                    spdMult: 1,
                    range: 70,
                    gather: 7,
                    speed: 400
                }, {
                    id: 9,
                    type: 1,
                    age: 6,
                    name: "hunting bow",
                    desc: "bow used for ranged combat and hunting",
                    src: "bow_1",
                    req: ["wood", 4],
                    length: 120,
                    width: 120,
                    xOff: -6,
                    yOff: 0,
                    Pdmg: 25,
                    projectile: 0,
                    spdMult: 0.75,
                    speed: 600
                }, {
                    id: 10,
                    type: 1,
                    age: 6,
                    name: "great hammer",
                    desc: "hammer used for destroying structures",
                    src: "great_hammer_1",
                    length: 140,
                    width: 140,
                    xOff: -9,
                    yOff: 25,
                    dmg: 10,
                    Pdmg: 10,
                    spdMult: 0.88,
                    range: 75,
                    sDmg: 7.5,
                    gather: 1,
                    speed: 400
                }, {
                    id: 11,
                    type: 1,
                    age: 6,
                    name: "wooden shield",
                    desc: "blocks projectiles and reduces melee damage",
                    src: "shield_1",
                    length: 120,
                    width: 120,
                    shield: 0.2,
                    xOff: 6,
                    yOff: 0,
                    Pdmg: 0,
                    spdMult: 0.7
                }, {
                    id: 12,
                    type: 1,
                    age: 8,
                    pre: 9,
                    name: "crossbow",
                    desc: "deals more damage and has greater range",
                    src: "crossbow_1",
                    req: ["wood", 5],
                    aboveHand: true,
                    armS: 0.75,
                    length: 120,
                    width: 120,
                    xOff: -4,
                    yOff: 0,
                    Pdmg: 35,
                    projectile: 2,
                    spdMult: 0.7,
                    speed: 700
                }, {
                    id: 13,
                    type: 1,
                    age: 9,
                    pre: 12,
                    name: "repeater crossbow",
                    desc: "high firerate crossbow with reduced damage",
                    src: "crossbow_2",
                    req: ["wood", 10],
                    aboveHand: true,
                    armS: 0.75,
                    length: 120,
                    width: 120,
                    xOff: -4,
                    yOff: 0,
                    Pdmg: 30,
                    projectile: 3,
                    spdMult: 0.7,
                    speed: 230
                }, {
                    id: 14,
                    type: 1,
                    age: 6,
                    name: "mc grabby",
                    desc: "steals resources from enemies",
                    src: "grab_1",
                    length: 130,
                    width: 210,
                    xOff: -8,
                    yOff: 53,
                    dmg: 0,
                    Pdmg: 0,
                    steal: 250,
                    knock: 0.2,
                    spdMult: 1.05,
                    range: 125,
                    gather: 0,
                    speed: 700
                }, {
                    id: 15,
                    type: 1,
                    age: 9,
                    pre: 12,
                    name: "musket",
                    desc: "slow firerate but high damage and range",
                    src: "musket_1",
                    req: ["stone", 10],
                    aboveHand: true,
                    rec: 0.35,
                    armS: 0.6,
                    hndS: 0.3,
                    hndD: 1.6,
                    length: 205,
                    width: 205,
                    xOff: 25,
                    yOff: 0,
                    Pdmg: 50,
                    projectile: 5,
                    hideProjectile: true,
                    spdMult: 0.6,
                    speed: 1500
                }];
                this.list = [{
                    group: this.groups[0],
                    name: "apple",
                    desc: "restores 20 health when consumed",
                    req: ["food", 10],
                    consume: function (ci) {
                        return ci.changeHealth(20, ci);
                    },
                    scale: 22,
                    holdOffset: 15,
                    healing: 20,
                    itemID: 0,
                    itemAID: 16
                }, {
                    age: 3,
                    group: this.groups[0],
                    name: "cookie",
                    desc: "restores 40 health when consumed",
                    req: ["food", 15],
                    consume: function (ci) {
                        return ci.changeHealth(40, ci);
                    },
                    scale: 27,
                    holdOffset: 15,
                    healing: 40,
                    itemID: 1,
                    itemAID: 17
                }, {
                    age: 7,
                    group: this.groups[0],
                    name: "cheese",
                    desc: "restores 30 health and another 50 over 5 seconds",
                    req: ["food", 25],
                    consume: function (ci) {
                        if (ci.changeHealth(30, ci) || ci.health < 100) {
                            ci.dmgOverTime.dmg = -10;
                            ci.dmgOverTime.doer = ci;
                            ci.dmgOverTime.time = 5;
                            return true;
                        }
                        return false;
                    },
                    scale: 27,
                    holdOffset: 15,
                    healing: 30,
                    itemID: 2,
                    itemAID: 18
                }, {
                    group: this.groups[1],
                    name: "wood wall",
                    desc: "provides protection for your village",
                    req: ["wood", 10],
                    projDmg: true,
                    health: 380,
                    scale: 50,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 3,
                    itemAID: 19
                }, {
                    age: 3,
                    group: this.groups[1],
                    name: "stone wall",
                    desc: "provides improved protection for your village",
                    req: ["stone", 25],
                    health: 900,
                    scale: 50,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 4,
                    itemAID: 20
                }, {
                    age: 7,
                    group: this.groups[1],
                    name: "castle wall",
                    desc: "provides powerful protection for your village",
                    req: ["stone", 35],
                    health: 1500,
                    scale: 52,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 5,
                    itemAID: 21
                }, {
                    group: this.groups[2],
                    name: "spikes",
                    desc: "damages enemies when they touch them",
                    req: ["wood", 20, "stone", 5],
                    health: 400,
                    dmg: 20,
                    scale: 49,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 6,
                    itemAID: 22
                }, {
                    age: 5,
                    group: this.groups[2],
                    name: "greater spikes",
                    desc: "damages enemies when they touch them",
                    req: ["wood", 30, "stone", 10],
                    health: 500,
                    dmg: 35,
                    scale: 52,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 7,
                    itemAID: 23
                }, {
                    age: 9,
                    group: this.groups[2],
                    name: "poison spikes",
                    desc: "poisons enemies when they touch them",
                    req: ["wood", 35, "stone", 15],
                    health: 600,
                    dmg: 30,
                    pDmg: 5,
                    scale: 52,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 8,
                    itemAID: 24
                }, {
                    age: 9,
                    group: this.groups[2],
                    name: "spinning spikes",
                    desc: "damages enemies when they touch them",
                    req: ["wood", 30, "stone", 20],
                    health: 500,
                    dmg: 45,
                    turnSpeed: 0.003,
                    scale: 52,
                    spritePadding: -23,
                    holdOffset: 8,
                    placeOffset: -5,
                    itemID: 9,
                    itemAID: 25
                }, {
                    group: this.groups[3],
                    name: "windmill",
                    desc: "generates gold over time",
                    req: ["wood", 50, "stone", 10],
                    health: 400,
                    pps: 1,
                    turnSpeed: 0.0016,
                    spritePadding: 25,
                    iconLineMult: 12,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: 5,
                    itemID: 10,
                    itemAID: 26
                }, {
                    age: 5,
                    group: this.groups[3],
                    name: "faster windmill",
                    desc: "generates more gold over time",
                    req: ["wood", 60, "stone", 20],
                    health: 500,
                    pps: 1.5,
                    turnSpeed: 0.0025,
                    spritePadding: 25,
                    iconLineMult: 12,
                    scale: 47,
                    holdOffset: 20,
                    placeOffset: 5,
                    itemID: 11,
                    itemAID: 27
                }, {
                    age: 8,
                    group: this.groups[3],
                    name: "power mill",
                    desc: "generates more gold over time",
                    req: ["wood", 100, "stone", 50],
                    health: 800,
                    pps: 2,
                    turnSpeed: 0.005,
                    spritePadding: 25,
                    iconLineMult: 12,
                    scale: 47,
                    holdOffset: 20,
                    placeOffset: 5,
                    itemID: 12,
                    itemAID: 28
                }, {
                    age: 5,
                    group: this.groups[4],
                    type: 2,
                    name: "mine",
                    desc: "allows you to mine stone",
                    req: ["wood", 20, "stone", 100],
                    iconLineMult: 12,
                    scale: 65,
                    holdOffset: 20,
                    placeOffset: 0,
                    itemID: 13,
                    itemAID: 29
                }, {
                    age: 5,
                    group: this.groups[11],
                    type: 0,
                    name: "sapling",
                    desc: "allows you to farm wood",
                    req: ["wood", 150],
                    iconLineMult: 12,
                    colDiv: 0.5,
                    scale: 110,
                    holdOffset: 50,
                    placeOffset: -15,
                    itemID: 14,
                    itemAID: 30
                }, {
                    age: 4,
                    group: this.groups[5],
                    name: "pit trap",
                    desc: "pit that traps enemies if they walk over it",
                    req: ["wood", 30, "stone", 30],
                    trap: true,
                    ignoreCollision: true,
                    hideFromEnemy: true,
                    health: 500,
                    colDiv: 0.2,
                    scale: 50,
                    holdOffset: 20,
                    placeOffset: -5,
                    alpha: 0.6,
                    itemID: 15,
                    itemAID: 31
                }, {
                    age: 4,
                    group: this.groups[6],
                    name: "boost pad",
                    desc: "provides boost when stepped on",
                    req: ["stone", 20, "wood", 5],
                    ignoreCollision: true,
                    boostSpeed: 1.5,
                    health: 150,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 16,
                    itemAID: 32
                }, {
                    age: 7,
                    group: this.groups[7],
                    doUpdate: true,
                    name: "turret",
                    desc: "defensive structure that shoots at enemies",
                    req: ["wood", 200, "stone", 150],
                    health: 800,
                    projectile: 1,
                    shootRange: 700,
                    shootRate: 2200,
                    scale: 43,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 17,
                    itemAID: 33
                }, {
                    age: 7,
                    group: this.groups[8],
                    name: "platform",
                    desc: "platform to shoot over walls and cross over water",
                    req: ["wood", 20],
                    ignoreCollision: true,
                    zIndex: 1,
                    health: 300,
                    scale: 43,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 18,
                    itemAID: 34
                }, {
                    age: 7,
                    group: this.groups[9],
                    name: "healing pad",
                    desc: "standing on it will slowly heal you",
                    req: ["wood", 30, "food", 10],
                    ignoreCollision: true,
                    healCol: 15,
                    health: 400,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 19,
                    itemAID: 35
                }, {
                    age: 9,
                    group: this.groups[10],
                    name: "spawn pad",
                    desc: "you will spawn here when you die but it will dissapear",
                    req: ["wood", 100, "stone", 100],
                    health: 400,
                    ignoreCollision: true,
                    spawnPoint: true,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 20,
                    itemAID: 36
                }, {
                    age: 7,
                    group: this.groups[12],
                    name: "blocker",
                    desc: "blocks building in radius",
                    req: ["wood", 30, "stone", 25],
                    ignoreCollision: true,
                    blocker: 300,
                    health: 400,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 21,
                    itemAID: 37
                }, {
                    age: 7,
                    group: this.groups[13],
                    name: "teleporter",
                    desc: "teleports you to a random point on the map",
                    req: ["wood", 60, "stone", 60],
                    ignoreCollision: true,
                    teleport: true,
                    health: 200,
                    colDiv: 0.7,
                    scale: 45,
                    holdOffset: 20,
                    placeOffset: -5,
                    itemID: 22,
                    itemAID: 38
                }];
                this.checkItem = {
                    index: function (ci, cC) {
                        if ([0, 1, 2].includes(ci)) {
                            return 0;
                        } else if ([3, 4, 5].includes(ci)) {
                            return 1;
                        } else if ([6, 7, 8, 9].includes(ci)) {
                            return 2;
                        } else if ([10, 11, 12].includes(ci)) {
                            return 3;
                        } else if ([13, 14].includes(ci)) {
                            return 5;
                        } else if ([15, 16].includes(ci)) {
                            return 4;
                        } else if ([17, 18, 19, 21, 22].includes(ci)) {
                            if ([13, 14].includes(cC)) {
                                return 6;
                            } else {
                                return 5;
                            }
                        } else if (ci == 20) {
                            if ([13, 14].includes(cC)) {
                                return 7;
                            } else {
                                return 6;
                            }
                        } else {
                            return undefined;
                        }
                    }
                };
                for (let ci = 0; ci < this.list.length; ++ci) {
                    this.list[ci].id = ci;
                    if (this.list[ci].pre) {
                        this.list[ci].pre = ci - this.list[ci].pre;
                    }
                }
                if (typeof window !== "undefined") {
                    function cC(cK) {
                        for (let cd = cK.length - 1; cd > 0; cd--) {
                            const ck = Math.floor(Math.random() * (cd + 1));
                            [cK[cd], cK[ck]] = [cK[ck], cK[cd]];
                        }
                        return cK;
                    }
                }
            }
        }
        class eV {
            constructor(ci, cC, cK, cd) {
                let ck = Math.floor;
                let cQ = Math.abs;
                let cg = Math.cos;
                let cp = Math.sin;
                let cW = Math.pow;
                let ct = Math.sqrt;
                this.ignoreAdd = false;
                this.hitObj = [];
                this.disableObj = function (cz) {
                    cz.active = false;
                    cz.breakTime = Date.now();
                    cz.startFadeOut();
                };
                let cn;
                this.add = function (cz, cx, cM, cY, co, cG, cS, cv, cE) {
                    cn = Ao(cz);
                    if (!cn) {
                        cn = cC.find(cb => !cb.active);
                        if (!cn) {
                            cn = new ci(cz);
                            cC.push(cn);
                        }
                    }
                    if (cv) {
                        cn.sid = cz;
                    }
                    cn.init(cx, cM, cY, co, cG, cS, cE);
                    // Re-bucket: a reused pooled object usually has a new position and sid.
                    roboticsGrid.insert(cn);
                };
                this.disableBySid = function (cz) {
                    let cx = Ao(cz);
                    if (cx) {
                        this.disableObj(cx);
                    }
                };
                this.removeAllItems = function (cz) {
                    cC.filter(cx => cx.active && cx.owner && cx.owner.sid == cz).forEach(cx => this.disableObj(cx));
                };
                this.checkItemLocation = function (cz, cx, cM, cY, co, cG) {
                    let cS = AF.find(cv => cK.getDistance(cz, cx, cv.x, cv.y) < cM + (cv.blocker ? cv.blocker : cv.getScale(cY, cv.isItem)));
                    if (cS) {
                        return false;
                    }
                    if (!cG && co != 18 && cx >= cd.mapScale / 2 - cd.riverWidth / 2 && cx <= cd.mapScale / 2 + cd.riverWidth / 2) {
                        return false;
                    }
                    return true;
                };
                this.preplaceCheck = function (cz, cx, cM, cY, co, cG, cS) {
                    let cv = AF.find(cE => cE.sid != cS.sid && cK.getDistance(cz, cx, cE.x, cE.y) < cM + (cE.blocker ? cE.blocker : cE.getScale(cY, cE.isItem)));
                    if (cv) {
                        return false;
                    }
                    if (!cG && co != 18 && cx >= cd.mapScale / 2 - cd.riverWidth / 2 && cx <= cd.mapScale / 2 + cd.riverWidth / 2) {
                        return false;
                    }
                    return cK.getDistance(cz, cx, cS.x, cS.y) <= cM + cS.scale;
                };
                this.canBeBroken = function (cz) {
                    if (!AX || !cz || !Ad.length) {
                        return;
                    }
                    let cx = Ai.weapons[sV.useHammer(cz) ? 1 : 0];
                    let cM = cx < 9 ? "primary" : "secondary";
                    let cY = Ai[cM + "Variant"];
                    let co = cY != undefined ? cd.weaponVariants[cY].val : 1;
                    let cG = AQ.secondaryIndex != undefined && AQ.primaryIndex != undefined ? AQ.secondaryIndex == 10 && (cz.health > s5.weapons[AQ.primaryIndex].dmg || AQ.primaryIndex == 5) ? AQ.secondaryIndex : AQ.primaryIndex : 10;
                    let cS = cG < 9 ? "primary" : "secondary";
                    let cv = AQ.secondaryIndex != undefined && AQ.primaryIndex != undefined ? AQ[cS + "Variant"] : 3;
                    let cE = (cd.weaponVariants[cv] || cd.weaponVariants[3]).val;
                    let cb = s5.weapons[cx].dmg;
                    let cR = s5.weapons[cG].dmg;
                    // Assume the enemy wears tank gear (worst case); you only get it if you own it.
                    let cD = 3.3;
                    let cO = Ai.skins[40] ? 3.3 : 1;
                    let cZ = 0;
                    if (AQ[cS + "Reloaded"] && this.canHit(AQ, cz, cG, 24)) {
                        cZ += cR * cD * cE * (s5.weapons[cG].sDmg || 1);
                    }
                    if (Ai[cM + "Reloaded"] && (so.right || sV.active && (sV.priority[0].includes(cz) || sV.priority[1].includes(cz) || sV.priority[2].includes(cz)))) {
                        cZ += cb * cO * co * (s5.weapons[cx].sDmg || 1);
                    }
                    if (cz.health <= cZ) {
                        return true;
                    }
                    return false;
                };
                this.hitsToBreak = function (cz, cx) {
                    if (!AX || !cz || !Ad.length || !cx) {
                        return;
                    }
                    let cM = sV.useHammer(cz, cx) ? cx.weapons[1] : cx.weapons[0];
                    let cY = cx[(cM < 9 ? "prima" : "seconda") + "ryVariant"];
                    let co = cY != undefined && cd.weaponVariants[cY] ? cd.weaponVariants[cY].val : 1.18;
                    let cG = s5.weapons[cM].dmg;
                    let cS = cx === Ai && !Ai.skins[40] ? 1 : 3.3;
                    let cv = cG * cS * co * (s5.weapons[cM].sDmg || 1);
                    return Math.ceil(cz.health / cv);
                };
                this.canHit = function (cz, cx, cM, cY = 0) {
                    return cK.getDist(cz, cx, 2, 0) <= s5.weapons[cM].range + cx.scale + cY;
                };
            }
        }
        class er {
            constructor(ci, cC, cK, cd, ck, cQ) {
                this.init = function (cg, cp, cW, ct, cn, cz, cx, cM) {
                    this.active = true;
                    this.tickActive = true;
                    this.indx = cg;
                    this.startX = cp;
                    this.startY = cW;
                    this.x = cp;
                    this.y = cW;
                    this.dir = ct;
                    this.skipMov = true;
                    this.speed = cn;
                    this.dmg = cz;
                    this.scale = cM;
                    this.range = cx;
                    this.x2 = cp;
                    this.y2 = cW;
                    this.r2 = cx;
                    this.skipTick = true;
                    this.owner = undefined;
                };
                this.update = function (cg) {
                    if (this.active) {
                        let cp = this.speed * cg;
                        if (!this.skipMov) {
                            this.x += cp * Math.cos(this.dir);
                            this.y += cp * Math.sin(this.dir);
                            this.range -= cp;
                            At.x = this.x;
                            At.y = this.y;
                            if (this.range <= 0) {
                                this.x += this.range * Math.cos(this.dir);
                                this.y += this.range * Math.sin(this.dir);
                                cp = 1;
                                this.range = 0;
                                this.active = false;
                            }
                        } else {
                            this.skipMov = false;
                        }
                    }
                };
                // Server-tick position (x2, y2) and where it will be after the next tick (x3, y3).
                // skipTick: the tick it spawned on, the server has not moved it yet.
                this.tickUpdate = function (cg) {
                    if (this.tickActive) {
                        let cp = this.speed * cg;
                        if (!this.skipTick) {
                            this.x2 += cp * Math.cos(this.dir);
                            this.y2 += cp * Math.sin(this.dir);
                            this.r2 -= cp;
                            if (this.r2 <= 0) {
                                this.x2 += this.r2 * Math.cos(this.dir);
                                this.y2 += this.r2 * Math.sin(this.dir);
                                this.r2 = 0;
                                this.tickActive = false;
                                return;
                            }
                        } else {
                            this.skipTick = false;
                        }
                        let cW = Math.min(cp, this.r2);
                        this.x3 = this.x2 + cW * Math.cos(this.dir);
                        this.y3 = this.y2 + cW * Math.sin(this.dir);
                        roboticsProjectileThreat(this);
                    }
                };
            }
        }
        ;
        class ec {
            constructor() {
                this.hats = [{
                    id: 45,
                    name: "Shame!",
                    dontSell: true,
                    price: 0,
                    scale: 120,
                    desc: "hacks are for winners"
                }, {
                    id: 51,
                    name: "Moo Cap",
                    price: 0,
                    scale: 120,
                    desc: "coolest mooer around"
                }, {
                    id: 50,
                    name: "Apple Cap",
                    price: 0,
                    scale: 120,
                    desc: "apple farms remembers"
                }, {
                    id: 28,
                    name: "Moo Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 29,
                    name: "Pig Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 30,
                    name: "Fluff Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 36,
                    name: "Pandou Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 37,
                    name: "Bear Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 38,
                    name: "Monkey Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 44,
                    name: "Polar Head",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 35,
                    name: "Fez Hat",
                    price: 0,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 42,
                    name: "Enigma Hat",
                    price: 0,
                    scale: 120,
                    desc: "join the enigma army"
                }, {
                    id: 43,
                    name: "Blitz Hat",
                    price: 0,
                    scale: 120,
                    desc: "hey everybody i'm blitz"
                }, {
                    id: 49,
                    name: "Bob XIII Hat",
                    price: 0,
                    scale: 120,
                    desc: "like and subscribe"
                }, {
                    id: 57,
                    name: "Pumpkin",
                    price: 50,
                    scale: 120,
                    desc: "Spooooky"
                }, {
                    id: 8,
                    name: "Bummle Hat",
                    price: 100,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 2,
                    name: "Straw Hat",
                    price: 500,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 15,
                    name: "Winter Cap",
                    price: 600,
                    scale: 120,
                    desc: "allows you to move at normal speed in snow",
                    coldM: 1
                }, {
                    id: 5,
                    name: "Cowboy Hat",
                    price: 1000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 4,
                    name: "Ranger Hat",
                    price: 2000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 18,
                    name: "Explorer Hat",
                    price: 2000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 31,
                    name: "Flipper Hat",
                    price: 2500,
                    scale: 120,
                    desc: "have more control while in water",
                    watrImm: true
                }, {
                    id: 1,
                    name: "Marksman Cap",
                    price: 3000,
                    scale: 120,
                    desc: "increases arrow speed and range",
                    aMlt: 1.3
                }, {
                    id: 10,
                    name: "Bush Gear",
                    price: 3000,
                    scale: 160,
                    desc: "allows you to disguise yourself as a bush"
                }, {
                    id: 48,
                    name: "Halo",
                    price: 3000,
                    scale: 120,
                    desc: "no effect"
                }, {
                    id: 6,
                    name: "Soldier Helmet",
                    price: 4000,
                    scale: 120,
                    desc: "reduces damage taken but slows movement",
                    spdMult: 0.94,
                    dmgMult: 0.75
                }, {
                    id: 23,
                    name: "Anti Venom Gear",
                    price: 4000,
                    scale: 120,
                    desc: "makes you immune to poison",
                    poisonRes: 1
                }, {
                    id: 13,
                    name: "Medic Gear",
                    price: 5000,
                    scale: 110,
                    desc: "slowly regenerates health over time",
                    healthRegen: 3
                }, {
                    id: 9,
                    name: "Miners Helmet",
                    price: 5000,
                    scale: 120,
                    desc: "earn 1 extra gold per resource",
                    extraGold: 1
                }, {
                    id: 32,
                    name: "Musketeer Hat",
                    price: 5000,
                    scale: 120,
                    desc: "reduces cost of projectiles",
                    projCost: 0.5
                }, {
                    id: 7,
                    name: "Bull Helmet",
                    price: 6000,
                    scale: 120,
                    desc: "increases damage done but drains health",
                    healthRegen: -5,
                    dmgMultO: 1.5,
                    spdMult: 0.96
                }, {
                    id: 22,
                    name: "Emp Helmet",
                    price: 6000,
                    scale: 120,
                    desc: "turrets won't attack but you move slower",
                    antiTurret: 1,
                    spdMult: 0.7
                }, {
                    id: 12,
                    name: "Booster Hat",
                    price: 6000,
                    scale: 120,
                    desc: "increases your movement speed",
                    spdMult: 1.16
                }, {
                    id: 26,
                    name: "Barbarian Armor",
                    price: 8000,
                    scale: 120,
                    desc: "knocks back enemies that attack you",
                    dmgK: 0.6
                }, {
                    id: 21,
                    name: "Plague Mask",
                    price: 10000,
                    scale: 120,
                    desc: "melee attacks deal poison damage",
                    poisonDmg: 5,
                    poisonTime: 6
                }, {
                    id: 46,
                    name: "Bull Mask",
                    price: 10000,
                    scale: 120,
                    desc: "bulls won't target you unless you attack them",
                    bullRepel: 1
                }, {
                    id: 14,
                    name: "Windmill Hat",
                    topSprite: true,
                    price: 10000,
                    scale: 120,
                    desc: "generates points while worn",
                    pps: 1.5
                }, {
                    id: 11,
                    name: "Spike Gear",
                    topSprite: true,
                    price: 10000,
                    scale: 120,
                    desc: "deal damage to players that damage you",
                    dmg: 0.45
                }, {
                    id: 53,
                    name: "Turret Gear",
                    topSprite: true,
                    price: 10000,
                    scale: 120,
                    desc: "you become a walking turret",
                    turret: {
                        proj: 1,
                        range: 700,
                        rate: 2500
                    },
                    spdMult: 0.7
                }, {
                    id: 20,
                    name: "Samurai Armor",
                    price: 12000,
                    scale: 120,
                    desc: "increased attack speed and fire rate",
                    atkSpd: 0.78
                }, {
                    id: 58,
                    name: "Dark Knight",
                    price: 12000,
                    scale: 120,
                    desc: "restores health when you deal damage",
                    healD: 0.4
                }, {
                    id: 27,
                    name: "Scavenger Gear",
                    price: 15000,
                    scale: 120,
                    desc: "earn double points for each kill",
                    kScrM: 2
                }, {
                    id: 40,
                    name: "Tank Gear",
                    price: 15000,
                    scale: 120,
                    desc: "increased damage to buildings but slower movement",
                    spdMult: 0.3,
                    bDmg: 3.3
                }, {
                    id: 52,
                    name: "Thief Gear",
                    price: 15000,
                    scale: 120,
                    desc: "steal half of a players gold when you kill them",
                    goldSteal: 0.5
                }, {
                    id: 55,
                    name: "Bloodthirster",
                    price: 20000,
                    scale: 120,
                    desc: "Restore Health when dealing damage. And increased damage",
                    healD: 0.25,
                    dmgMultO: 1.2
                }, {
                    id: 56,
                    name: "Assassin Gear",
                    price: 20000,
                    scale: 120,
                    desc: "Go invisible when not moving. Can't eat. Increased speed",
                    noEat: true,
                    spdMult: 1.1,
                    invisTimer: 1000
                }];
                this.accessories = [{
                    id: 12,
                    name: "Snowball",
                    price: 1000,
                    scale: 105,
                    xOff: 18,
                    desc: "no effect"
                }, {
                    id: 9,
                    name: "Tree Cape",
                    price: 1000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 10,
                    name: "Stone Cape",
                    price: 1000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 3,
                    name: "Cookie Cape",
                    price: 1500,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 8,
                    name: "Cow Cape",
                    price: 2000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 11,
                    name: "Monkey Tail",
                    price: 2000,
                    scale: 97,
                    xOff: 25,
                    desc: "Super speed but reduced damage",
                    spdMult: 1.35,
                    dmgMultO: 0.2
                }, {
                    id: 17,
                    name: "Apple Basket",
                    price: 3000,
                    scale: 80,
                    xOff: 12,
                    desc: "slowly regenerates health over time",
                    healthRegen: 1
                }, {
                    id: 6,
                    name: "Winter Cape",
                    price: 3000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 4,
                    name: "Skull Cape",
                    price: 4000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 5,
                    name: "Dash Cape",
                    price: 5000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 2,
                    name: "Dragon Cape",
                    price: 6000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 1,
                    name: "Super Cape",
                    price: 8000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 7,
                    name: "Troll Cape",
                    price: 8000,
                    scale: 90,
                    desc: "no effect"
                }, {
                    id: 14,
                    name: "Thorns",
                    price: 10000,
                    scale: 115,
                    xOff: 20,
                    desc: "no effect"
                }, {
                    id: 15,
                    name: "Blockades",
                    price: 10000,
                    scale: 95,
                    xOff: 15,
                    desc: "no effect"
                }, {
                    id: 20,
                    name: "Devils Tail",
                    price: 10000,
                    scale: 95,
                    xOff: 20,
                    desc: "no effect"
                }, {
                    id: 16,
                    name: "Sawblade",
                    price: 12000,
                    scale: 90,
                    spin: true,
                    xOff: 0,
                    desc: "deal damage to players that damage you",
                    dmg: 0.15
                }, {
                    id: 13,
                    name: "Angel Wings",
                    price: 15000,
                    scale: 138,
                    xOff: 22,
                    desc: "slowly regenerates health over time",
                    healthRegen: 3
                }, {
                    id: 19,
                    name: "Shadow Wings",
                    price: 15000,
                    scale: 138,
                    xOff: 22,
                    desc: "increased movement speed",
                    spdMult: 1.1
                }, {
                    id: 18,
                    name: "Blood Wings",
                    price: 20000,
                    scale: 178,
                    xOff: 26,
                    desc: "restores health when you deal damage",
                    healD: 0.2
                }, {
                    id: 21,
                    name: "Corrupt X Wings",
                    price: 20000,
                    scale: 178,
                    xOff: 26,
                    desc: "deal damage to players that damage you",
                    dmg: 0.25
                }];
            }
        }
        ;
        class eF {
            constructor(ci, cC, cK, cd, ck, cQ, cg, cp) {
                this.addProjectile = function (cW, ct, cn, cz, cx, cM, cY) {
                    let co = cQ.projectiles[cM];
                    let cG;
                    for (let cS = 0; cS < cC.length; ++cS) {
                        if (!cC[cS].active) {
                            cG = cC[cS];
                            break;
                        }
                    }
                    if (!cG) {
                        cG = new ci(cK, cd, ck, cQ, cg, cp);
                        cG.sid = cC.length;
                        cC.push(cG);
                    }
                    cG.init(cM, cW, ct, cn, cx, co.dmg, cz, co.scale);
                    cG.layer = cY || co.layer;
                    cG.src = co.src;
                    return cG;
                };
            }
        }
        ;
        class eH {
            constructor(ci, cC, cK, cd, ck, cQ, cg, cp, cW) {
                this.aiTypes = [{
                    id: 0,
                    src: "cow_1",
                    killScore: 150,
                    health: 500,
                    weightM: 0.8,
                    speed: 0.00095,
                    turnSpeed: 0.001,
                    scale: 72,
                    drop: ["food", 50]
                }, {
                    id: 1,
                    src: "pig_1",
                    killScore: 200,
                    health: 800,
                    weightM: 0.6,
                    speed: 0.00085,
                    turnSpeed: 0.001,
                    scale: 72,
                    drop: ["food", 80]
                }, {
                    id: 2,
                    name: "Bull",
                    src: "bull_2",
                    hostile: true,
                    dmg: 20,
                    killScore: 1000,
                    health: 1800,
                    weightM: 0.5,
                    speed: 0.00094,
                    turnSpeed: 0.00074,
                    scale: 78,
                    viewRange: 800,
                    chargePlayer: true,
                    drop: ["food", 100]
                }, {
                    id: 3,
                    name: "Bully",
                    src: "bull_1",
                    hostile: true,
                    dmg: 20,
                    killScore: 2000,
                    health: 2800,
                    weightM: 0.45,
                    speed: 0.001,
                    turnSpeed: 0.0008,
                    scale: 90,
                    viewRange: 900,
                    chargePlayer: true,
                    drop: ["food", 400]
                }, {
                    id: 4,
                    name: "Wolf",
                    src: "wolf_1",
                    hostile: true,
                    dmg: 8,
                    killScore: 500,
                    health: 300,
                    weightM: 0.45,
                    speed: 0.001,
                    turnSpeed: 0.002,
                    scale: 84,
                    viewRange: 800,
                    chargePlayer: true,
                    drop: ["food", 200]
                }, {
                    id: 5,
                    name: "Quack",
                    src: "chicken_1",
                    dmg: 8,
                    killScore: 2000,
                    noTrap: true,
                    health: 300,
                    weightM: 0.2,
                    speed: 0.0018,
                    turnSpeed: 0.006,
                    scale: 70,
                    drop: ["food", 100]
                }, {
                    id: 6,
                    name: "MOOSTAFA",
                    nameScale: 50,
                    src: "enemy",
                    hostile: true,
                    dontRun: true,
                    fixedSpawn: true,
                    spawnDelay: 60000,
                    noTrap: true,
                    colDmg: 100,
                    dmg: 40,
                    killScore: 8000,
                    health: 18000,
                    weightM: 0.4,
                    speed: 0.0007,
                    turnSpeed: 0.01,
                    scale: 80,
                    spriteMlt: 1.8,
                    leapForce: 0.9,
                    viewRange: 1000,
                    hitRange: 210,
                    hitDelay: 1000,
                    chargePlayer: true,
                    drop: ["food", 100]
                }, {
                    id: 7,
                    name: "Treasure",
                    hostile: true,
                    nameScale: 35,
                    src: "crate_1",
                    fixedSpawn: true,
                    spawnDelay: 120000,
                    colDmg: 200,
                    killScore: 5000,
                    health: 20000,
                    weightM: 0.1,
                    speed: 0,
                    turnSpeed: 0,
                    scale: 70,
                    spriteMlt: 1
                }, {
                    id: 8,
                    name: "MOOFIE",
                    src: "wolf_2",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 4,
                    spawnDelay: 30000,
                    noTrap: true,
                    nameScale: 35,
                    dmg: 10,
                    colDmg: 100,
                    killScore: 3000,
                    health: 7000,
                    weightM: 0.45,
                    speed: 0.0015,
                    turnSpeed: 0.002,
                    scale: 90,
                    viewRange: 800,
                    chargePlayer: true,
                    drop: ["food", 1000]
                }, {
                    id: 9,
                    name: "💀MOOFIE",
                    src: "wolf_2",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 50,
                    spawnDelay: 60000,
                    noTrap: true,
                    nameScale: 35,
                    dmg: 12,
                    colDmg: 100,
                    killScore: 3000,
                    health: 9000,
                    weightM: 0.45,
                    speed: 0.0015,
                    turnSpeed: 0.0025,
                    scale: 94,
                    viewRange: 1440,
                    chargePlayer: true,
                    drop: ["food", 3000]
                }, {
                    id: 10,
                    name: "💀Wolf",
                    src: "wolf_1",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 50,
                    spawnDelay: 30000,
                    nameScale: 35,
                    dmg: 10,
                    killScore: 700,
                    health: 500,
                    weightM: 0.45,
                    speed: 0.00115,
                    turnSpeed: 0.0025,
                    scale: 88,
                    viewRange: 1440,
                    chargePlayer: true,
                    drop: ["food", 400]
                }, {
                    id: 11,
                    name: "💀Bully",
                    src: "bull_1",
                    hostile: true,
                    fixedSpawn: true,
                    dontRun: true,
                    hitScare: 50,
                    spawnDelay: 100000,
                    nameScale: 35,
                    dmg: 20,
                    killScore: 5000,
                    health: 5000,
                    weightM: 0.45,
                    speed: 0.0015,
                    turnSpeed: 0.0025,
                    scale: 94,
                    viewRange: 1440,
                    chargePlayer: true,
                    drop: ["food", 800]
                }];
                this.spawn = function (ct, cn, cz, cx) {
                    let cM = ci.find(cY => !cY.active);
                    if (!cM) {
                        cM = new cC(ci.length, ck, cK, cd, cg, cQ, cp, cW);
                        ci.push(cM);
                    }
                    cM.init(ct, cn, cz, cx, this.aiTypes[cx]);
                    return cM;
                };
            }
        }
        ;
        class eN {
            constructor(ci, cC, cK, cd, ck, cQ, cg, cp) {
                this.sid = ci;
                this.isAI = true;
                this.nameIndex = ck.randInt(0, cQ.cowNames.length - 1);
                this.init = function (cn, cz, cx, cM, cY) {
                    this.x = cn;
                    this.y = cz;
                    this.startX = cY.fixedSpawn ? cn : null;
                    this.startY = cY.fixedSpawn ? cz : null;
                    this.xVel = 0;
                    this.yVel = 0;
                    this.zIndex = 0;
                    this.dir = cx;
                    this.dirPlus = 0;
                    this.index = cM;
                    this.src = cY.src;
                    if (cY.name) {
                        this.name = cY.name;
                    }
                    this.weightM = cY.weightM;
                    this.speed = cY.speed;
                    this.killScore = cY.killScore;
                    this.turnSpeed = cY.turnSpeed;
                    this.scale = cY.scale;
                    this.maxHealth = cY.health;
                    this.leapForce = cY.leapForce;
                    this.health = this.maxHealth;
                    this.chargePlayer = cY.chargePlayer;
                    this.viewRange = cY.viewRange;
                    this.drop = cY.drop;
                    this.dmg = cY.dmg;
                    this.hostile = cY.hostile;
                    this.dontRun = cY.dontRun;
                    this.hitRange = cY.hitRange;
                    this.hitDelay = cY.hitDelay;
                    this.hitScare = cY.hitScare;
                    this.spriteMlt = cY.spriteMlt;
                    this.nameScale = cY.nameScale;
                    this.colDmg = cY.colDmg;
                    this.noTrap = cY.noTrap;
                    this.spawnDelay = cY.spawnDelay;
                    this.hitWait = 0;
                    this.waitCount = 1000;
                    this.moveCount = 0;
                    this.targetDir = 0;
                    this.active = true;
                    this.alive = true;
                    this.runFrom = null;
                    this.chargeTarget = null;
                    this.dmgOverTime = {};
                };
                let cW = 0;
                let ct = 0;
                this.animate = function (cn) {
                    if (this.animTime > 0) {
                        this.animTime -= cn;
                        if (this.animTime <= 0) {
                            this.animTime = 0;
                            this.dirPlus = 0;
                            cW = 0;
                            ct = 0;
                        } else if (ct == 0) {
                            cW += cn / (this.animSpeed * cQ.hitReturnRatio);
                            this.dirPlus = ck.lerp(0, this.targetAngle, Math.min(1, cW));
                            if (cW >= 1) {
                                cW = 1;
                                ct = 1;
                            }
                        } else {
                            cW -= cn / (this.animSpeed * (1 - cQ.hitReturnRatio));
                            this.dirPlus = ck.lerp(0, this.targetAngle, Math.max(0, cW));
                        }
                    }
                };
                this.startAnim = function () {
                    this.animTime = this.animSpeed = 600;
                    this.targetAngle = Math.PI * 0.8;
                    cW = 0;
                    ct = 0;
                };
            }
        }
        ;
        class eC {
            constructor(ci, cC, cK, cd) {
                this.x = ci;
                this.y = cC;
                this.alpha = 0;
                this.active = true;
                this.alive = false;
                this.chat = cK;
                this.owner = cd;
            }
        }
        ;
        class eK {
            constructor(ci, cC, cK, cd, ck, cQ, cg, cp, cW) {
                this.x = ci;
                this.y = cC;
                this.lastDir = cK;
                this.dir = cK + Math.PI;
                this.buildIndex = cd;
                this.weaponIndex = ck;
                this.weaponVariant = cQ;
                this.skinColor = cg;
                this.scale = cp;
                this.visScale = 0;
                this.name = cW;
                this.alpha = 1;
                this.active = true;
                this.animate = function (ct) {
                    let cn = s4.getAngleDist(this.lastDir, this.dir);
                    if (cn > 0.01) {
                        this.dir += cn / 20;
                    } else {
                        this.dir = this.lastDir;
                    }
                    if (this.visScale < this.scale) {
                        this.visScale += ct / (this.scale / 2);
                        if (this.visScale >= this.scale) {
                            this.visScale = this.scale;
                        }
                    }
                    this.alpha -= ct / 30000;
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.active = false;
                    }
                };
            }
        }
        ;
        class ed {
            constructor(ci, cC, cK, cd, ck, cQ, cg, cp, cW, ct, cn, cz, cx, cM) {
                this.id = ci;
                this.sid = cC;
                this.tmpScore = 0;
                this.team = null;
                this.latestSkin = 0;
                this.oldSkinIndex = 0;
                this.prevHW;
                this.prevDW;
                this.skinIndex = 0;
                this.latestTail = 0;
                this.oldTailIndex = 0;
                this.tailIndex = 0;
                this.hitTime = 0;
                this.lastHit = 0;
                this.hitTick = 0;
                this.inWater = false;
                this.tails = {
                    0: 1
                };
                this.antiTurretSpam = false;
                for (let cG = 0; cG < cn.length; ++cG) {
                    if (cn[cG].price <= 0) {
                        this.tails[cn[cG].id] = 1;
                    }
                }
                this.skins = {
                    0: 1
                };
                for (let cS = 0; cS < ct.length; ++cS) {
                    if (ct[cS].price <= 0) {
                        this.skins[ct[cS].id] = 1;
                    }
                }
                this.points = 0;
                this.dt = 0;
                this.hidden = false;
                this.itemCounts = {};
                this.isPlayer = true;
                this.pps = 0;
                this.moveDir = undefined;
                this.moveTime = 0;
                this.skinRot = 0;
                this.lastPing = 0;
                this.hitSpike = 0;
                this.iconIndex = 0;
                this.skinColor = 0;
                this.dist2 = 0;
                this.aim2 = 0;
                this.maxSpeed = 1;
                this.chat = {
                    message: null,
                    count: 0
                };
                this.healSpeed = 0;
                this.spawn = function (cv) {
                    this.attacked = false;
                    this.death = false;
                    this.spinDir = 0;
                    this.sync = false;
                    this.antiBull = 0;
                    this.poisonCounter = 0;
                    this.active = true;
                    this.alive = true;
                    this.lockMove = false;
                    this.lockDir = false;
                    this.minimapCounter = 0;
                    this.chatCountdown = 0;
                    this.shameCount = 0;
                    this.shameTimer = 0;
                    this.sentTo = {};
                    this.gathering = 0;
                    this.gatherIndex = 0;
                    this.lastGather = 0;
                    this.shooting = {};
                    this.shootIndex = 9;
                    this.autoGather = 0;
                    this.animTime = 0;
                    this.animSpeed = 0;
                    this.mouseState = 0;
                    this.buildIndex = -1;
                    this.weaponIndex = 0;
                    this.weaponCode = 0;
                    this.weaponVariant = 0;
                    this.primaryIndex = undefined;
                    this.secondaryIndex = undefined;
                    this.dmgOverTime = {};
                    this.noMovTimer = 0;
                    this.maxXP = 300;
                    this.XP = 0;
                    this.age = 1;
                    this.kills = 0;
                    this.upgrAge = 2;
                    this.upgradePoints = 0;
                    this.x = 0;
                    this.y = 0;
                    this.oldXY = {
                        x: 0,
                        y: 0
                    };
                    this.x2 = 0;
                    this.y2 = 0;
                    this.zIndex = 0;
                    this.xVel = 0;
                    this.yVel = 0;
                    this.slowMult = 1;
                    this.dir = 0;
                    this.dirPlus = 0;
                    this.targetDir = 0;
                    this.targetAngle = 0;
                    this.maxHealth = 100;
                    this.health = this.maxHealth;
                    this.oldHealth = this.maxHealth;
                    this.damaged = 0;
                    this.scale = cK.playerScale;
                    this.speed = cK.playerSpeed;
                    this.moveDir = undefined;
                    this.resetResources(cv);
                    this.items = [0, 3, 6, 10];
                    this.weapons = [0];
                    this.shootCount = 0;
                    this.weaponXP = [];
                    this.reloads = {
                        0: 0,
                        1: 0,
                        2: 0,
                        3: 0,
                        4: 0,
                        5: 0,
                        6: 0,
                        7: 0,
                        8: 0,
                        9: 0,
                        10: 0,
                        11: 0,
                        12: 0,
                        13: 0,
                        14: 0,
                        15: 0,
                        53: 0
                    };
                    this.primaryReloaded = true;
                    this.secondaryReloaded = true;
                    this.bowThreat = {
                        9: 0,
                        12: 0,
                        13: 0,
                        15: 0
                    };
                    this.nextTickDmg = {
                        min: 0,
                        max: 0,
                        current: 0
                    };
                    this.next2TickDmg = {
                        min: 0,
                        max: 0,
                        current: 0
                    };
                    this.lastHeal = 0;
                    this.outHealed = false;
                    this.damageThreat = 0;
                    this.mostDamageThreat = 0;
                    this.leastDamageThreat = 0;
                    this.inTrap = false;
                    this.lastTrap = false;
                    this.escaped = false;
                    this.canEmpAnti = false;
                    this.empAnti = false;
                    this.soldierAnti = false;
                    this.bullTick = 0;
                    this.needTick = 0;
                    this.antiTimer = 2;
                };
                this.resetResources = function (cv) {
                    for (let cE = 0; cE < cK.resourceTypes.length; ++cE) {
                        this[cK.resourceTypes[cE]] = cv ? 100 : 0;
                    }
                };
                this.getItemType = function (cv) {
                    let cE = this.items.findIndex(cb => cb == cv);
                    if (cE != -1) {
                        return cE;
                    } else {
                        return cW.checkItem.index(cv, this.items);
                    }
                };
                this.setData = function (cv) {
                    this.id = cv[0];
                    this.sid = cv[1];
                    this.name = cv[2];
                    this.x = cv[3];
                    this.y = cv[4];
                    this.dir = cv[5];
                    this.health = cv[6];
                    this.maxHealth = cv[7];
                    this.scale = cv[8];
                    this.skinColor = cv[9];
                };
                this.update = function (cv) {
                    if (this.active) {
                        let cD = {
                            skin: roboticsHatById.get(this.skinIndex),
                            tail: roboticsTailById.get(this.tailIndex)
                        };
                        let cZ = (this.buildIndex >= 0 ? 0.5 : 1) * (cW.weapons[this.weaponIndex].spdMult || 1) * (cD.skin ? cD.skin.spdMult || 1 : 1) * (cD.tail ? cD.tail.spdMult || 1 : 1) * (this.y <= cK.snowBiomeTop ? cD.skin && cD.skin.coldM ? 1 : cK.snowSpeed : 1) * this.slowMult;
                        this.xVel = (this.x2 - this.oldPos.x2) / cv;
                        this.yVel = (this.y2 - this.oldPos.y2) / cv;
                        if (!this.zIndex && this.y >= cK.mapScale / 2 - cK.riverWidth / 2 && this.y <= cK.mapScale / 2 + cK.riverWidth / 2) {
                            cZ *= cD.skin && cD.skin.watrImm ? 0.75 : 0.33;
                            this.xVel += cD.skin && cD.skin.watrImm ? cK.waterCurrent * 0.4 * cv : cK.waterCurrent * cv;
                        }
                        var cE = this.moveDir != undefined ? Math.cos(this.moveDir) : 0;
                        var cb = this.moveDir != undefined ? Math.sin(this.moveDir) : 0;
                        var cR = Math.hypot(cE, cb);
                        if (cR) {
                            cE /= cR;
                            cb /= cR;
                        }
                        ;
                        if (cE) {
                            this.xVel += cE * this.speed * cZ;
                        }
                        if (cb) {
                            this.yVel += cb * this.speed * cZ;
                        }
                        if (this.xVel) {
                            this.xVel *= Math.pow(cK.playerDecel, cv);
                            if (this.xVel <= 0.01 && this.xVel >= -0.01) {
                                this.xVel = 0;
                            }
                        }
                        if (this.yVel) {
                            this.yVel *= Math.pow(cK.playerDecel, cv);
                            if (this.yVel <= 0.01 && this.yVel >= -0.01) {
                                this.yVel = 0;
                            }
                        }
                        this.xlvel = this.x2 + this.xVel * cv;
                        this.ylvel = this.y2 + this.yVel * cv;
                        roboticsGrid.near(this.xlvel, this.ylvel, 250, roboticsNearTmp).filter(cO => cO.active && !cO.ignoreCollision).forEach(cO => {
                            let cI = this.xlvel - cO.x;
                            let ca = this.ylvel - cO.y;
                            let cu = 35 + (cO.getScale ? cO.getScale() : cO.scale);
                            if (Math.abs(cI) <= cu || Math.abs(ca) <= cu) {
                                let cl = Math.max(0, cu - cd.getDistance(0, 0, cI, ca));
                                if (cl) {
                                    let cB = Math.atan2(ca, cI);
                                    let cw = Math.min(cl, cv);
                                    if (!cO.isTeamObject(this) && cO.dmg > 0 && cO.name.includes("spikes") || cO.type == 1 && cO.y >= 12000) {
                                        cw *= 1.5;
                                    }
                                    this.xlvel += Math.cos(cB) * cw;
                                    this.ylvel += Math.sin(cB) * cw;
                                }
                            }
                        });
                        this.maxSpeed = cZ;
                    }
                };
                let cY = 0;
                let co = 0;
                this.animate = function (cv) {
                    if (this.animTime > 0) {
                        this.animTime -= cv;
                        if (this.animTime <= 0) {
                            this.animTime = 0;
                            this.dirPlus = 0;
                            cY = 0;
                            co = 0;
                        } else if (co == 0) {
                            cY += cv / (this.animSpeed * cK.hitReturnRatio);
                            this.dirPlus = cd.lerp(0, this.targetAngle, Math.min(1, cY));
                            if (cY >= 1) {
                                cY = 1;
                                co = 1;
                            }
                        } else {
                            cY -= cv / (this.animSpeed * (1 - cK.hitReturnRatio));
                            this.dirPlus = cd.lerp(0, this.targetAngle, Math.max(0, cY));
                        }
                    }
                };
                this.startAnim = function (cv, cE) {
                    this.animTime = this.animSpeed = cW.weapons[cE].speed;
                    this.targetAngle = cv ? -cK.hitAngle : -Math.PI;
                    cY = 0;
                    co = 0;
                };
                this.canSee = function (cv) {
                    if (!cv) {
                        return false;
                    }
                    let cE = Math.abs(cv.x - this.x) - cv.scale;
                    let cb = Math.abs(cv.y - this.y) - cv.scale;
                    return cE <= cK.maxScreenWidth / 2 * 1.3 && cb <= cK.maxScreenHeight / 2 * 1.3;
                };
                this.judgeShame = function () {
                    if (this.oldHealth < this.health) {
                        if (this.hitTime) {
                            let cv = Date.now() - this.hitTime;
                            this.hitTime = 0;
                            if (cv < 120) {
                                this.shameCount++;
                            } else {
                                this.shameCount = Math.max(0, this.shameCount - 2);
                            }
                        }
                    } else if (this.oldHealth > this.health) {
                        this.hitTime = Date.now();
                        this.lastHit = Date.now();
                        this.hitTick = fU.tick;
                    }
                };
                // The 30 s shame countdown is derived from shameTimerEnd once per tick (see VZ).
                this.addShameTimer = function () {
                    this.shameCount = 0;
                    this.shameTimer = 30;
                    this.shameTimerEnd = Date.now() + 30000;
                };
                this.updateShameTimer = function () {
                    if (this.shameTimerEnd) {
                        this.shameTimer = Math.max(0, Math.ceil((this.shameTimerEnd - Date.now()) / 1000));
                        if (!this.shameTimer) {
                            this.shameTimerEnd = 0;
                        }
                    }
                };
                this.isTeam = function (cv) {
                    return this == cv || this.team && this.team == cv.team;
                };
                this.findAllianceBySid = function (cv) {
                    if (this.team) {
                        return AV.find(cE => cE === cv);
                    } else {
                        return null;
                    }
                };
                this.checkCanInsta = function (cv) {
                    let cE = 0;
                    if (this.alive && AX) {
                        let cb = {
                            weapon: this.weapons[0],
                            variant: this.primaryVariant,
                            dmg: this.weapons[0] == undefined ? 0 : cW.weapons[this.weapons[0]].dmg
                        };
                        let cR = {
                            weapon: this.weapons[1],
                            variant: this.secondaryVariant,
                            dmg: this.weapons[1] == undefined ? 0 : cW.weapons[this.weapons[1]].Pdmg
                        };
                        let cD = this.skins[7] && !cv ? 1.5 : 1;
                        let cZ = cb.variant != undefined ? cK.weaponVariants[cb.variant].val : 1;
                        if (cb.weapon != undefined && this.primaryReloaded) {
                            cE += cb.dmg * cZ * cD;
                        }
                        if (cR.weapon != undefined && this.secondaryReloaded) {
                            cE += cR.dmg;
                        }
                        if (this.skins[53] && this.reloads[53] <= (this.weapons[1] == 10 ? 0 : fU.tickRate) && AQ.skinIndex != 22) {
                            cE += 25;
                        }
                        cE *= AQ.skinIndex == 6 ? 0.75 : 1;
                        return cE;
                    }
                    return 0;
                };
                this.manageReload = function () {
                    // Last tick's reload state and when each weapon finished reloading
                    // (barbarian knockback, predictive push strikes).
                    this.prevPrimaryReloaded = this.primaryReloaded;
                    this.prevSecondaryReloaded = this.secondaryReloaded;
                    if (this.shooting[53]) {
                        this.shooting[53] = 0;
                        this.reloads[53] = 2500 - fU.tickRate;
                    } else if (this.reloads[53] > 0) {
                        this.reloads[53] = Math.max(0, this.reloads[53] - fU.tickRate);
                    }
                    if (this.gathering || this.shooting[1]) {
                        if (this.gathering) {
                            this.gathering = 0;
                            this.reloads[this.gatherIndex] = cW.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
                            this.attacked = true;
                        }
                        if (this.shooting[1]) {
                            this.shooting[1] = 0;
                            this.reloads[this.shootIndex] = cW.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1);
                            this.attacked = true;
                        }
                    } else {
                        this.attacked = false;
                        if (this.buildIndex < 0) {
                            if (this.reloads[this.weaponIndex] > 0) {
                                this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - fU.tickRate);
                                if (this.primaryReloaded && this.reloads[this.weaponIndex] == 0) {
                                    this.antiBull++;
                                    fU.tickBase(() => {
                                        this.antiBull = 0;
                                    }, 1);
                                }
                            }
                        }
                    }
                    if (this.weaponIndex < 9) {
                        this.primaryReloaded = this.reloads[this.weaponIndex] <= (this.sid == Ai.sid ? Ap.avg / 2 : Ap.max);
                    } else {
                        this.secondaryReloaded = this.reloads[this.weaponIndex] <= (this.sid == Ai.sid ? Ap.avg / 2 : Ap.max);
                    }
                    if (this.primaryReloaded && !this.prevPrimaryReloaded) {
                        this.primaryReloadTick = fU.tick;
                    }
                    if (this.secondaryReloaded && !this.prevSecondaryReloaded) {
                        this.secondaryReloadTick = fU.tick;
                    }
                };
                this.addDamageThreat = function (cv) {
                    this.mostDamageThreat += cv;
                    this.damageThreat += cv * (this.skinIndex == 6 && !sc.isTrue ? 0.75 : 1);
                    this.leastDamageThreat += cv * 0.75;
                };
                this.processDamages = function () {
                    let cv = 0;
                    Ak.forEach(cE => {
                        let cb = {
                            weapon: cE.primaryIndex,
                            variant: cE.primaryVariant,
                            dmg: 0
                        };
                        let cR = {
                            weapon: cE.secondaryIndex,
                            variant: cE.secondaryVariant,
                            dmg: 0
                        };
                        cb.dmg = cb.weapon == undefined ? 45 : cW.weapons[cb.weapon].dmg;
                        cR.dmg = cb.weapon == 0 ? 0 : cR.weapon == undefined ? 50 : cW.weapons[cR.weapon].Pdmg;
                        let cD = cb.variant != undefined && cK.weaponVariants[cb.variant] ? cK.weaponVariants[cb.variant].val : 1.18;
                        let cZ = cR.variant != undefined && cK.weaponVariants[cR.variant] ? [9, 12, 13, 15].includes(cR.weapon) ? 1 : cK.weaponVariants[cR.variant].val : 1.18;
                        // Worst case: an enemy can swap to bull helmet (and off monkey tail)
                        // in the same tick it hits, so melee always counts x1.5.
                        if (cb.weapon == undefined || cE.primaryReloaded) {
                            cb.dmg = cb.dmg * cD * 1.5;
                        } else {
                            cb.dmg = 0;
                        }
                        if (cR.weapon == undefined || cE.secondaryReloaded) {
                            cR.dmg = cR.dmg * cZ * ([10, 14].includes(cR.weapon) ? 1.5 : 1);
                        } else {
                            cR.dmg = 0;
                        }
                        if (cE.reloads[53] == 0) {
                            cR.dmg += 25;
                            // Turret gear shots are blocked by the EMP helmet.
                            this.turretThreat = (this.turretThreat || 0) + 25;
                        }
                        cv += Math.max(cb.dmg, cR.dmg);
                    });
                    // Poison ticks once per tick, not once per nearby enemy.
                    if (this.poisonCounter > 0 && Ak.length) {
                        cv += 5;
                    }
                    this.addDamageThreat(cv);
                };
            }
        }
        ;
        function ek(ci) {
            Ai.reloads[ci] = 0;
            A0("H", ci);
        }
        function eQ(ci, cC) {
            A0("c", 0, ci, cC);
        }
        function eg(ci, cC) {
            A0("c", 1, ci, cC);
        }
        let ep = 0;
        let eW = 0;
        /* Hat (0) and accessory (1) requests are collected and sent once at the
           end of the current task, so several et() calls in one tick cost at
           most one packet each, and a hat already requested is not re-sent
           while the server has not confirmed it yet (up to 2 ticks). */
        let roboticsGear = {
            want: [null, null],
            sent: [{
                id: null,
                tick: -9
            }, {
                id: null,
                tick: -9
            }],
            queued: false
        };
        function roboticsFlushGear() {
            roboticsGear.queued = false;
            if (!Ai) {
                return;
            }
            for (let ci = 0; ci < 2; ci++) {
                let cC = roboticsGear.want[ci];
                roboticsGear.want[ci] = null;
                if (cC === null || (ci ? Ai.latestTail : Ai.latestSkin) == cC) {
                    continue;
                }
                let cK = roboticsGear.sent[ci];
                if (cK.id === cC && fU.tick - cK.tick <= 2) {
                    continue;
                }
                cK.id = cC;
                cK.tick = fU.tick;
                A0("c", 0, cC, ci);
            }
        }
        function roboticsWantGear(ci, cC) {
            roboticsGear.want[cC] = ci;
            if (!roboticsGear.queued) {
                roboticsGear.queued = true;
                queueMicrotask(roboticsFlushGear);
            }
        }
        function et(ci, cC) {
            let cK = Ai.skins[6] ? 6 : 0;
            if (Ai.alive && AX) {
                if (cC == 0) {
                    if (ci == 6) {
                        if (Date.now() - ep > fU.tickRate) {
                            eW = ci;
                            ep = Date.now();
                        }
                    } else {
                        eW = ci;
                        ep = Date.now();
                    }
                    roboticsWantGear(Ai.skins[ci] ? ci : cK, 0);
                } else if (cC == 1) {
                    if (fL && ci != 11 && ci != 0) {
                        roboticsWantGear(0, 1);
                        return;
                    }
                    roboticsWantGear(Ai.tails[ci] ? ci : 0, 1);
                }
            }
        }
        function en(ci, cC) {
            A0("z", ci, cC);
        }
        function ez(ci, cC) {
            if (!cC) {
                Ai.weaponCode = ci;
            }
            A0("z", ci, 1);
        }
        // eM mirrors the server's auto gather state; it flips with every toggle
        // sent. At most one toggle per tick. AW.userGather is what the player
        // asked for with the auto gather key; the mod returns to it when idle.
        let ex = -1;
        let eM = false;
        function eY() {
            if (ex === fU.tick) {
                return;
            }
            ex = fU.tick;
            eM = !eM;
            A0("K", 1, 1);
        }
        function eo() {
            A0("e");
        }
        function eG(ci, cC) {
            A0("F", ci, cC, 1);
        }
        const eS = document.createElement("div");
        eS.id = "tm-menu";
        eS.style.cssText = "\n        position: fixed; top: 50%; left: 50%;\n        transform: translate(-50%, -50%);\n        background: #333; color: white;\n        padding: 20px; border-radius: 12px;\n        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);\n        display: none; z-index: 9999;\n    ";
        eS.innerHTML = "\n        <input type=\"text\" id=\"testInput1\" id=\"input1\" style=\"display: block; margin: 10px 0; padding: 8px; width: 200px;\">\n        <input type=\"text\" id=\"testInput2\" id=\"input2\" style=\"display: block; margin: 10px 0; padding: 8px; width: 200px;\">\n        <input type=\"text\" id=\"testInput3\" id=\"input2\" style=\"display: block; margin: 10px 0; padding: 8px; width: 200px;\">\n        <input type=\"checkbox\" id=\"button1\">1</input>\n        <input type=\"checkbox\" id=\"button2\">2</input>\n    ";
        document.body.appendChild(eS);
        // Place (or eat) item slot ci toward cC. Returns true when the packets went out.
        function ev(ci, cC, cK, cd, ck) {
            try {
                if (ci == undefined) {
                    return false;
                }
                let cQ = s5.list[Ai.items[ci]];
                if (!cQ) {
                    return false;
                }
                if (ci === 0 || (Ai.alive && AX && Ai.itemCounts[cQ.group.id] == undefined ? true : Ai.itemCounts[cQ.group.id] < (r.isSandbox ? ci === 3 || ci === 5 ? 299 : 99 : cQ.group.limit ? cQ.group.limit : 99))) {
                    let cp = roboticsLimiter.run(3, ci === 0 ? 0 : 1, () => {
                        en(Ai.items[ci]);
                        eG(1, cC);
                        ez(Ai.weaponCode, 1);
                    });
                    if (!cp) {
                        return false;
                    }
                    if (fu.placeVis) {
                        if (!cd || !ck) {
                            let cp = Ai.scale + cQ.scale + (cQ.placeOffset || 0);
                            cd = Ai.x2 + cp * Math.cos(cC);
                            ck = Ai.y2 + cp * Math.sin(cC);
                        }
                        let cg = cK ? e6 : e5;
                        cg.push({
                            x: cd,
                            y: ck,
                            name: cQ.name,
                            scale: cQ.scale,
                            dir: cC
                        });
                        fU.tickBase(() => {
                            cg.shift();
                        }, 1);
                    }
                    return true;
                }
            } catch (cW) {}
            return false;
        }
        function eE(ci, cC, cK, cd) {
            try {
                if (ci == undefined) {
                    return;
                }
                let ck = s5.list[Ai.items[ci]];
                if (!cK || !cd) {
                    let cQ = Ai.scale + ck.scale + (ck.placeOffset || 0);
                    cK = Ai.x2 + cQ * Math.cos(cC);
                    cd = Ai.y2 + cQ * Math.sin(cC);
                }
                if (s6.checkItemLocation(cK, cd, ck.scale, 0.6, ck.id, false)) {
                    ev(ci, cC, 0, cK, cd);
                }
            } catch (cg) {}
        }
        // Food items still needed to reach full health, minus heals already sent
        // that the server has not applied yet (AW.pendingHeal).
        function eR() {
            if (Ai.health >= 100 || Ai.skinIndex == 45 || Ai.skinIndex == 56) {
                return 0;
            }
            if (AW.pendingHeal && Date.now() - AW.pendingHealAt > 500) {
                AW.pendingHeal = 0;
            }
            return Math.max(0, Math.ceil((100 - Ai.health - AW.pendingHeal) / s5.list[Ai.items[0]].healing));
        }
        function eD(ci) {
            let cC = Ak.filter(cK => {
                if (cK.attacked && s5.weapons[cK.weaponIndex]) {
                    let cd = cK.weaponIndex;
                    let ck = (cd > 8 ? s5.weapons[cd].Pdmg : s5.weapons[cd].dmg) || 0;
                    let cQ = cK[(cd < 9 ? "prima" : "seconda") + "ryVariant"];
                    ck *= (Ai.skinIndex == 6 ? 0.75 : 1) * (cK.skinIndex == 7 ? 1.5 : 1) * (cK.tailIndex == 11 ? 0.2 : 1) * (r.weaponVariants[cQ] || r.weaponVariants[0]).val;
                    if (ci == ck) {
                        if (Ai.skinIndex != 23) {
                            Ai.poisonCounter = cQ == 3 ? 5 : cK.skinIndex == 21 ? 6 : Ai.poisonCounter;
                        }
                        return true;
                    }
                }
                return false;
            });
            return cC;
        }
        function roboticsHealOnce() {
            if (!ev(0, sZ())) {
                return false;
            }
            AW.pendingHeal += s5.list[Ai.items[0]].healing;
            AW.pendingHealAt = Date.now();
            return true;
        }
        // Heal to full, plus ci extra items.
        function eZ(ci = 0) {
            let cC = eR() + ci;
            for (let cK = 0; cK < cC; cK++) {
                if (!roboticsHealOnce()) {
                    break;
                }
            }
        }
        // Eat up to ci items. Stops once health plus heals already sent reaches
        // full: the server ignores food at full health, so those packets only
        // used up the packet budget.
        function eO(ci) {
            for (let cC = 0; cC < ci; cC++) {
                if (Ai.health + AW.pendingHeal >= 100 || !roboticsHealOnce()) {
                    break;
                }
            }
        }
        let ea = [28, 29, 30, 36, 37, 38, 44];
        let eu = 0;
        function el(ci, cC) {
            if (Ai.inWater) {
                if (cC) {
                    return 31;
                }
                et(31, 0);
            } else if (!fu.hatType || fl.hatType == "ag") {
                if (Ai.y2 <= r.snowBiomeTop) {
                    if (cC) {
                        if (ci && (Ai.moveDir == null || Ai.antiTurretSpam)) {
                            return 22;
                        } else {
                            return 15;
                        }
                    }
                    et(ci && (Ai.moveDir == null || Ai.antiTurretSpam) ? 22 : 15, 0);
                } else {
                    if (cC) {
                        if (ci && (Ai.moveDir == null || Ai.antiTurretSpam)) {
                            return 22;
                        } else {
                            return 12;
                        }
                    }
                    et(ci && (Ai.moveDir == null || Ai.antiTurretSpam) ? 22 : 12, 0);
                }
            } else if (fl.hatType == "bg") {
                if (cC) {
                    return 10;
                }
                et(10, 0);
            } else if (fl.hatType == "loop") {
                eu = eu >= ea.length - 1 ? 0 : eu + 1;
                if (Ai.y2 <= r.snowBiomeTop) {
                    if (cC) {
                        if (ci && (Ai.moveDir == null || Ai.antiTurretSpam)) {
                            return 22;
                        } else {
                            return ea[eu];
                        }
                    }
                    et(ci && (Ai.moveDir == null || Ai.antiTurretSpam) ? 22 : ea[eu], 0);
                } else {
                    if (cC) {
                        if (ci && (Ai.moveDir == null || Ai.antiTurretSpam)) {
                            return 22;
                        } else {
                            return ea[eu];
                        }
                    }
                    et(ci && (Ai.moveDir == null || Ai.antiTurretSpam) ? 22 : ea[eu], 0);
                }
            }
            if (cC) {
                return 0;
            }
        }
        function eB(ci) {
            et(ci && Ai.moveDir == undefined ? 0 : 11, 1);
        }
        const ew = (ci, cC, cK) => {
            if (!cC) {
                return null;
            }
            const cd = Math.PI / 2;
            const ck = Math.PI / 50;
            const cQ = s5.list[Ai.items[ci]];
            let cg = Ai.scale + cQ.scale + (cQ.placeOffset || 0);
            let cp = [];
            let cW = s4.getDirect(cC, Ai, 0, 2);
            sr.calcPreplace(cC, ci);
            if (cK) {
                let ct = s4.getDirect(cK, Ai, 0, 2);
                if (cC.sid != cK.sid) {
                    return sr.closeToAngle(ci, ct, 1);
                } else if (ci == 4) {
                    let cn = AF.filter(cz => cz.dmg && cz.isTeamObject(Ai) && s4.getDist(cz, cK, 0, 0) <= cK.scale + cz.scale + 69).sort((cz, cx) => s4.getDist(cz, cK, 0, 0) - s4.getDist(cx, cK, 0, 0))[0];
                    if (cn) {
                        let cz = null;
                        let cx = Infinity;
                        for (let cM = 0; cM <= cd; cM += ck) {
                            let cY = [(ct + cM) % (Math.PI * 2), (ct - cM + Math.PI * 2) % (Math.PI * 2)];
                            for (let co of cY) {
                                let cG = Ai.x2 + cg * Math.cos(co);
                                let cS = Ai.y2 + cg * Math.sin(co);
                                if (s6.preplaceCheck(cG, cS, cQ.scale, 0.6, cQ.id, false, cC)) {
                                    let cv = s4.getDistance(cG, cS, AQ.x2, AQ.y2);
                                    let cE = s4.getDistance(cG, cS, cn.x, cn.y);
                                    if (cv < 30 && cE < cx) {
                                        cx = cE;
                                        cz = co;
                                    }
                                }
                            }
                        }
                        if (cz !== null) {
                            return cz;
                        }
                    }
                }
            }
            return sr.closeToAngle(ci, cW, 1) || null;
        };
        const eL = () => {
            if (AQ.dist2 > 269 || !fu.autoPrePlace) {
                return;
            }
            // Graded Preplace: one best spot from Falcon's angle grader instead of one per breaking object.
            if (fu.gradedPreplace) {
                let cd = roboticsAngles.findPreplace(fl.autoPrePlace == "spike" ? [2] : [2, 4]);
                if (cd) {
                    Vb(() => {
                        ev(cd.slot, cd.angle, 1);
                    }, 1);
                }
                return;
            }
            const ci = [];
            for (let cd of AF) {
                if (!cd.isItem || s4.getDist(cd, Ai, 0, 2) > 200 || cd.isTeamObject(Ai) && cd.hideFromEnemy && !sV.priority[1].includes(cd)) {
                    continue;
                }
                if (s6.canBeBroken(cd)) {
                    ci.push(cd);
                }
            }
            let cC = ci.sort((ck, cQ) => s4.getDist(ck, AQ, 0, 2) - s4.getDist(cQ, AQ, 0, 2)).slice(0, Math.min(2, ci.length));
            let cK = AQ.inTrap;
            cC.forEach(ck => {
                let cQ = cK && !AW.autoPush && (fl.autoPrePlace == "spike" || ck.sid != cK.sid) ? 2 : 4;
                let cg = ew(cQ, ck, cK);
                if (cg != null) {
                    Vb(() => {
                        ev(cQ, cg, 1);
                    }, 1);
                }
            });
        };
        let ey = [];
        class eP {
            constructor(ci, cC) {
                this.replaced = true;
                this.antiTrapped = false;
                this.info = {};
                this.radObjs = [];
                this.preplaces = [[], []];
                this.testCanPlace = function (cK, cd = -(Math.PI / 2), ck = Math.PI / 2, cQ = Math.PI / 18, cg, cp, cW, ct) {
                    try {
                        let cn = cC.list[Ai.items[cK]];
                        let cz = Ai.scale + cn.scale + (cn.placeOffset || 0);
                        let cx = {
                            attempts: 0,
                            placed: 0
                        };
                        // Spots placed during this call also block later angles (when cW).
                        // Nearby objects are read from AF directly instead of being copied every call.
                        let cM = [];
                        const cX = (cE, cG, cS, co) => ci.getDistance(cG, cS, cE.x, cE.y) < cn.scale + (cE.blocker ? cE.blocker : co);
                        for (let cY = cd; cp ? cY <= ck : cY < ck; cY += cQ) {
                            cx.attempts++;
                            let co = cg + cY;
                            let cG = Ai.x2 + cz * Math.cos(co);
                            let cS = Ai.y2 + cz * Math.sin(co);
                            if (AF.some(cE => cX(cE, cG, cS, cE.getScale(0.6, cE.isItem))) || cM.some(cE => cX(cE, cG, cS, cE.scale))) {
                                continue;
                            }
                            if (cn.id != 18 && cS >= r.mapScale / 2 - r.riverWidth / 2 && cS <= r.mapScale / 2 + r.riverWidth / 2) {
                                continue;
                            }
                            ev(cK, co, 0, cG, cS);
                            cx.placed++;
                            if (cW) {
                                cM.push({
                                    x: cG,
                                    y: cS,
                                    blocker: cn.blocker,
                                    scale: cn.scale
                                });
                            }
                            if (ct == 1) {
                                this.preplaces[0].push({
                                    x: cG,
                                    y: cS,
                                    scale: cn.scale
                                });
                            }
                            if (cx.placed > 0) {
                                if ([1, 2].includes(ct) && cn.dmg) {
                                    if (ci.getDist(AQ, {
                                        x: cG,
                                        y: cS
                                    }, 2, 0) <= 86 && fu.spikeTick) {
                                        sc.canSpikeTick = true;
                                    }
                                }
                                if (ct == 2 && cn.dmg && cx.placed >= 8) {
                                    if (Ai.isLeader) {
                                        A0("Q", Ag.sid);
                                    } else {
                                        A0("N");
                                    }
                                }
                            }
                        }
                    } catch (cE) {}
                };
                this.createObj = function (cK, cd) {
                    let ck = {
                        id: cK.id,
                        dir: cd,
                        scale: cK.scale,
                        colDiv: cK.colDiv,
                        getScale: function (cQ, cg) {
                            return this.scale * (cg ? 1 : this.colDiv);
                        }
                    };
                    ck.x = Ai.x2 + (Ai.scale + ck.scale + (cK.placeOffset || 0)) * Math.cos(ck.dir);
                    ck.y = Ai.y2 + (Ai.scale + ck.scale + (cK.placeOffset || 0)) * Math.sin(ck.dir);
                    return ck;
                };
                this.radCalc = function (obj, direct, item, type) {
                    let preObj = this.createObj(item, direct);
                    let getScale = obj.getScale(0.6, obj.isItem);
                    let dist = s4.getDist(obj, preObj, 0, 0);
                    let scale = getScale + preObj.scale;
                    let angles = [];
                    if (dist < scale) {
                        let calc = Math.acos(dist / scale);
                        let sum = [calc, -calc];
                        for (let i = 0; i < sum.length; i++) {
                            let angle = direct + sum[i];
                            preObj = this.createObj(item, angle);
                            let nears = this.preplaces[1].length ? this.preplaces[1].some(pos => s4.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                            if (nears) {
                                continue;
                            }
                            let renears = this.preplaces[0].length ? this.preplaces[0].some(pos => s4.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                            if (renears) {
                                continue;
                            }
                            let canPlace = s6.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                            if (canPlace) {
                                angles.push(angle);
                                this.preplaces[1].push(preObj);
                            }
                        }
                    } else {
                        if (type) {
                            return [];
                        }
                        preObj = this.createObj(item, direct);
                        let nears = this.preplaces[1].length ? this.preplaces[1].some(pos => s4.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                        if (nears) {
                            return [];
                        }
                        let renears = this.preplaces[0].length ? this.preplaces[0].some(pos => s4.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                        if (renears) {
                            return [];
                        }
                        let canPlace = s6.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                        if (canPlace) {
                            angles.push(direct);
                            this.preplaces[1].push(preObj);
                        }
                    }
                    return angles;
                };
                this.renderPlacementAngles = function (cK) {
                    if (!this.preplaces || !this.preplaces[1] || !Ai) {
                        return;
                    }
                    let cd = Ai.x - AS / 2;
                    let ck = Ai.y - Av / 2;
                    cK.save();
                    cK.strokeStyle = "rgba(220, 220, 220, 0.9)";
                    cK.lineWidth = 2;
                    for (let cQ = 0; cQ < this.preplaces[1].length; cQ++) {
                        let cg = this.preplaces[1][cQ];
                        let cp = cg.x - cd;
                        let cW = cg.y - ck;
                        cK.beginPath();
                        cK.arc(cp, cW, cg.scale, 0, Math.PI * 2);
                        cK.stroke();
                        cK.strokeStyle = "rgba(220, 220, 220, 0.4)";
                        cK.beginPath();
                        cK.moveTo(Ai.x - cd, Ai.y - ck);
                        cK.lineTo(cp, cW);
                        cK.stroke();
                        cK.strokeStyle = "rgba(220, 220, 220, 0.9)";
                    }
                    cK.restore();
                };
                this.debugRenderAngle = function (cK, cd, ck, cQ = "rgba(0, 255, 255, 0.5)") {
                    if (!Ai) {
                        return;
                    }
                    let cg = Ai.x - AS / 2;
                    let cp = Ai.y - Av / 2;
                    let cW = this.createObj(ck, cd);
                    cK.save();
                    cK.strokeStyle = cQ;
                    cK.lineWidth = 1;
                    cK.beginPath();
                    cK.arc(cW.x - cg, cW.y - cp, cW.scale, 0, Math.PI * 2);
                    cK.stroke();
                    cK.restore();
                };
                this.checkSpikeTick = function () {
                    if (!fu.safeAntiSpikeTick || !Ad.length) {
                        return false;
                    }
                    if (AQ.dist2 <= 175) {
                        if ((Ai.escaped || Ai.inTrap && s6.canBeBroken(Ai.inTrap)) && roboticsSpikeTickRespond()) {
                            if (Ai.escaped) {
                                AW.anti0Tick = 2;
                            }
                            let cK = [13, 15].includes(AQ.secondaryIndex) ? 35 : 45;
                            if (![9, 12, 13, 15].includes(AQ.secondaryIndex) || !AQ.secondaryReloaded) {
                                Ai.addDamageThreat(cK);
                            }
                            Ai.chat.count = 223;
                            fU.tickBase(() => {
                                if (![9, 12, 13, 15].includes(AQ.secondaryIndex) || !AQ.secondaryReloaded) {
                                    Ai.addDamageThreat(cK);
                                }
                            }, 1);
                        }
                    }
                    if (AQ.dist2 <= 200) {
                        if (!Ai.inTrap) {
                            if (AQ.primaryReloaded) {
                                let cd = new Set();
                                // How far their primary + secondary could knock you, sampled in 24 steps
                                // away from them. (Enemy weapons are primaryIndex/secondaryIndex; their
                                // .weapons list is never filled in, so this always assumed a tool hammer.)
                                let cQ = Math.atan2(Ai.y2 - AQ.y2, Ai.x2 - AQ.x2);
                                let cO = AQ.primaryIndex === undefined ? 0 : AQ.primaryIndex;
                                let cg = (cC.weapons[cO].knock || 0) * cC.weapons[cO].range + Ai.scale * 2;
                                let cp = ![undefined, 9, 12, 13, 15].includes(AQ.secondaryIndex) ? (cC.weapons[AQ.secondaryIndex].knock || 0) * cC.weapons[AQ.secondaryIndex].range + Ai.scale * 2 : 60;
                                let cz = (cg + cp + 50) / 24;
                                let cI = Math.cos(cQ);
                                let ca = Math.sin(cQ);
                                for (let ck of AF) {
                                    if (ck.dmg && ck.active && !ck.isTeamObject(Ai) || ck.type == 1 && ck.y >= 12000) {
                                        let cS = ck.getScale() + Ai.scale * 1.5;
                                        for (let cM = 1; cM <= 24; cM++) {
                                            if (cz * cM < 40) {
                                                continue;
                                            }
                                            let co = Ai.x2 + cz * cM * cI;
                                            let cG = Ai.y2 + cz * cM * ca;
                                            if ((co - ck.x) * (co - ck.x) + (cG - ck.y) * (cG - ck.y) <= cS * cS) {
                                                cd.add(ck.sid);
                                            }
                                        }
                                    }
                                }
                                A8.mex = Ai.x2 + cz * 24 * cI;
                                A8.mey = Ai.y2 + cz * 24 * ca;
                                if (cd.size && !roboticsSpikeTickRespond()) {
                                    cd.clear();
                                }
                                if (cd.size) {
                                    cd.forEach(cv => {
                                        Ai.addDamageThreat(Ao(cv).dmg || 35);
                                    });
                                }
                                if ([3, 4, 5].includes(AQ.primaryIndex) && cd.size) {
                                    AW.anti0Tick = 1;
                                    Ai.chat.message = "PaS detected by " + AQ.sid + " " + AQ.name;
                                    Ai.chat.count = 112;
                                }
                            }
                        }
                    }
                };
                this.protect = function (cK) {
                    if (!fu.antiTrap) {
                        return;
                    }
                    this.testCanPlace(4, -(Math.PI / 2), Math.PI / 2, Math.PI / 3, cK + Math.PI, true);
                    this.testCanPlace(2, -(Math.PI / 3), Math.PI / 3, Math.PI / 3, cK + Math.PI, true);
                    this.antiTrapped = true;
                };
                this.autoPlace = function (cK, cd, ck, cQ) {
                    if (!Ad.length) {
                        return;
                    }
                    if (!fu.autoPlace) {
                        return;
                    }
                    let cg = function (ct, cn) {
                        if (!cn || !cn.length) {
                            return;
                        }
                        for (let cz of cn) {
                            ev(ct, cz);
                        }
                    };
                    let cp = function (ct) {
                        if (ct == undefined) {
                            return null;
                        }
                        let cn = Ai.items[ct];
                        if (cn == undefined || cn == null) {
                            return null;
                        }
                        return cC.list[cn] || null;
                    };
                    let cW = cp(cd);
                    if (!cW) {
                        return;
                    }
                    if (cK == 0) {
                        let ct = cp(ck);
                        this.radObjs = AF;
                        if (this.radObjs && this.radObjs.length) {
                            for (let cn of this.radObjs) {
                                let cz = ci.getDirect(cn, Ai, 0, 2);
                                let cx = this.radCalc(cn, cz, cW);
                                if (cx && cx.length) {
                                    cg(cd, cx);
                                    continue;
                                }
                                if (ct) {
                                    let cM = this.radCalc(cn, cz, ct);
                                    if (cM && cM.length) {
                                        cg(ck, cM);
                                    }
                                }
                            }
                        } else {
                            for (let cY = 0; cY < Math.PI * 2; cY += Math.PI / 2) {
                                eE(cd, AQ.aim2 + cY);
                            }
                        }
                        return;
                    }
                    if (cK == 1) {
                        this.radObjs = AF.filter(co => {
                            if (!co.isTeamObject || !co.isTeamObject(Ai)) {
                                return false;
                            }
                            let cG = cd == 4 ? co.dmg : co.trap;
                            if (!cG) {
                                return false;
                            }
                            let cS = ci.getDist(co, AQ, 0, 2);
                            return cS < 500;
                        });
                        if (this.radObjs && this.radObjs.length) {
                            let co = cp(cd);
                            if (!co) {
                                return;
                            }
                            for (let cG of this.radObjs) {
                                let cS = ci.getDirect(cG, Ai, 0, 2);
                                let cv = this.radCalc(cG, cS, co, 1);
                                if (cv && cv.length) {
                                    cg(cd, cv);
                                }
                            }
                        }
                        if (cQ) {
                            this.autoPlace(cK, ck, cd, false);
                            return;
                        } else if (cK == 1 && this.preplaces && this.preplaces[1] && this.preplaces[1].length < 1) {
                            this.autoPlace(0, ck, cd);
                        }
                        return;
                    }
                };
                this.autoReplace = function (cK) {
                    if (!Ad.length || AQ.dist2 > 300 || !fu.autoReplace || this.replaced || fu.weaponGrind) {
                        return;
                    }
                    let cd = ci.getDist(cK, Ai, 0, 2);
                    if (cd > 300) {
                        return;
                    }
                    let ck = ci.getDirect(cK, Ai, 0, 2);
                    let cQ = cK.sid;
                    this.replaced = true;
                    if (cK.trap && AQ.dist2 <= 250) {
                        if (Ai.shameCount < 5) {
                            eZ();
                        }
                        et(6, 0);
                    }
                    // Graded Auto Place also grades replacements (Falcon AutoReplacer).
                    if (fu.gradedAutoPlace) {
                        let cg = roboticsSafeCall(() => roboticsAngles.findPlacements([2, 4], Ad.filter(cp => cp.dist2 <= 400), roboticsAngles.levelBudget(), 2, cK), "graded replace") || [];
                        if (cg.length) {
                            cg.forEach(cp => ev(cp.slot, cp.angle));
                            return;
                        }
                    }
                    if (AQ.escaped) {
                        if (cQ == AQ.lastTrap.sid && [4, 5].includes(Ai.weapons[0]) && Ai.primaryReloaded && !AW.autoPush) {
                            return this.testCanPlace(2, AQ.aim2 - Math.PI / 3, AQ.aim2 + Math.PI / 3, Math.PI / 7.5, AQ.aim2, true, true, 1);
                        } else {
                            eE(4, AQ.aim2);
                            eE(4, AQ.aim2 + Math.PI / 12);
                            eE(4, AQ.aim2 - Math.PI / 12);
                            return;
                        }
                    }
                    if (AQ.inTrap && AQ.dist2 <= 150 && ci.getDist(cK, AQ.inTrap, 0, 0) <= 169) {
                        return this.testCanPlace(2, AQ.aim2 - Math.PI / 2, AQ.aim2 + Math.PI / 2, Math.PI / 32, AQ.aim2, true, true, 1);
                    }
                    if (Ai.escaped && cQ == Ai.lastTrap.sid) {
                        return this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 6, ci.randFloat(0, Math.PI * 2), true, false, 1);
                    }
                    this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 3, ck, true, false, 1);
                };
            }
        }
        ;
        class eq {
            constructor() {
                this.active = false;
                this.aim = 0;
                this.priority = [[], [], [], []];
                this.target = null;
            }
            objectsHit(ci) {
                let cC = [];
                AF.forEach(cK => {
                    let cd = s4.getDirect(cK, Ai, 0, 2);
                    if (cK.type == null && s4.getDist(Ai, cK, 2, 0) <= s5.weapons[this.useHammer(cK) ? Ai.weapons[1] : Ai.weapons[0]].range + cK.scale && s4.getAngleDist(cd, ci) <= Math.PI / 2.6) {
                        cC.push(cK);
                    }
                });
                return cC;
            }
            getFilteredPriority() {
                const ci = this.priority.map(cC => cC.filter(cK => cK.active && s4.getDist(cK, Ai, 0, 2) <= s5.weapons[this.useHammer(cK) ? Ai.weapons[1] : Ai.weapons[0]].range + cK.scale));
                return ci;
            }
            calculateAim() {
                const ci = this.getFilteredPriority();
                for (let cC = 0; cC < ci.length; cC++) {
                    const cK = ci[cC];
                    if (cC == 3) {
                        if (Ad.length && AQ.dist2 < 300) {
                            this.active = false;
                            return;
                        }
                    }
                    if (cK.length > 0) {
                        this.processTargets(cK, cC);
                        return;
                    }
                }
                this.active = false;
            }
            processTargets(ci, cC) {
                if (!ci.length) {
                    this.active = false;
                    this.target = null;
                    return;
                }
                let cK = 0;
                const cd = new Set();
                if (ci.length > 1) {
                    let cn = [];
                    for (let cz = 0; cz < ci.length; cz++) {
                        for (let cx = cz + 1; cx < ci.length; cx++) {
                            const cM = cZ => cZ < 0 ? cZ + Math.PI * 2 : cZ;
                            let cY = s4.getDirect(ci[cz], Ai, 0, 2);
                            let co = s4.getDirect(ci[cx], Ai, 0, 2);
                            const cG = cM(cY);
                            const cS = cM(co);
                            let cv = (cG + cS) / 2;
                            let cE = Math.abs(cG - cS);
                            if (cE > Math.PI) {
                                cv += Math.PI;
                            }
                            cv = cv % (Math.PI * 2);
                            if (cv > Math.PI) {
                                cv -= Math.PI * 2;
                            }
                            let cb = cv + (cE > 180) * 180;
                            if (cd.has(cb)) {
                                continue;
                            }
                            cd.add(cb);
                            const cR = this.objectsHit(cb);
                            let cD = 0;
                            cR.forEach(cZ => {
                                if (ci.includes(cZ)) {
                                    cD += 100;
                                }
                                if (cZ.isTeamObject(Ai)) {
                                    if (AQ.inTrap && cZ.sid == AQ.inTrap.sid) {
                                        cD -= cC != 3 ? 50 : -50;
                                    } else if (cZ.dmg || cZ.trap) {
                                        cD -= cC != 3 ? 30 : -50;
                                    } else {
                                        cD -= cC != 3 ? 10 : -50;
                                    }
                                } else if (cZ.dmg) {
                                    cD += 70;
                                } else if (cZ.trap) {
                                    cD += 60;
                                } else {
                                    cD += 50;
                                }
                            });
                            cn.push({
                                aim: cb,
                                reward: cD
                            });
                        }
                    }
                    for (let cZ = 0; cZ < ci.length; cZ++) {
                        const cO = s4.getDirect(ci[cZ], Ai, 0, 2);
                        if (cd.has(cO)) {
                            continue;
                        }
                        cd.add(cO);
                        const cI = this.objectsHit(cO);
                        let ca = 0;
                        cI.forEach(cu => {
                            if (ci.includes(cu)) {
                                ca += 100;
                            }
                            if (cu.isTeamObject(Ai)) {
                                if (AQ.inTrap && cu.sid == AQ.inTrap.sid) {
                                    ca -= cC != 3 ? 50 : -50;
                                } else if (cu.dmg || cu.trap) {
                                    ca -= cC != 3 ? 30 : -50;
                                } else {
                                    ca -= cC != 3 ? 10 : -50;
                                }
                            } else if (cu.dmg) {
                                ca += 70;
                            } else if (cu.trap) {
                                ca += 60;
                            } else {
                                ca += 50;
                            }
                        });
                        cn.push({
                            aim: cO,
                            reward: ca
                        });
                    }
                    this.aim = cn.sort((cu, cl) => cl.reward - cu.reward)[0].aim;
                    this.target = this.objectsHit(this.aim).sort((cu, cl) => s4.getDist(cu, Ai, 0, 2) - s4.getDist(cl, Ai, 0, 2))[0];
                    this.active = true;
                    return;
                }
                let ck = [];
                const cQ = ci[0];
                const cg = s4.getDirect(ci[0], Ai, 0, 2);
                let cp = this.objectsHit(cg);
                let cW = 0;
                cp.forEach(cu => {
                    if (ci.includes(cu)) {
                        cW += 100;
                    }
                    if (cu.isTeamObject(Ai)) {
                        if (AQ.inTrap && cu.sid == AQ.inTrap.sid) {
                            cW -= cC != 3 ? 50 : -50;
                        } else if (cu.dmg || cu.trap) {
                            cW -= cC != 3 ? 30 : -50;
                        } else {
                            cW -= cC != 3 ? 10 : -50;
                        }
                    } else {
                        cW += 60;
                    }
                });
                ck.push({
                    aim: cg,
                    reward: cW
                });
                const ct = [Math.PI / 2.6 / 3, Math.PI / 2.6 / 2, Math.PI / 2.6 - 0.1];
                for (let cu of ct) {
                    const cl = [cg - cu, cg + cu];
                    for (let cB of cl) {
                        let cw = this.objectsHit(cB);
                        let cL = 0;
                        cw.forEach(cy => {
                            if (ci.includes(cy)) {
                                cL += 100;
                            }
                            if (cy.isTeamObject(Ai)) {
                                if (AQ.inTrap && cy.sid == AQ.inTrap.sid) {
                                    cL -= cC != 3 ? 50 : -50;
                                } else if (cy.dmg || cy.trap) {
                                    cL -= cC != 3 ? 30 : -50;
                                } else {
                                    cL -= cC != 3 ? 10 : -50;
                                }
                            } else {
                                cL += 60;
                            }
                        });
                        ck.push({
                            aim: cB,
                            reward: cL
                        });
                    }
                }
                this.aim = ck.sort((cy, ch) => ch.reward - cy.reward)[0].aim;
                this.target = this.objectsHit(this.aim).sort((cy, ch) => s4.getDist(cy, Ai, 0, 2) - s4.getDist(ch, Ai, 0, 2))[0];
                this.active = true;
                return;
            }
            useHammer(ci) {
                if (fu.hammerBreakerOptimisation && Ai.weapons[1] == 10) {
                    if (ci) {
                        if (ci.health > 0 && ci.health <= s5.weapons[Ai.weapons[0]].dmg && s6.canHit(Ai, ci, Ai.weapons[0]) && ![5, 8].includes(Ai.weapons[0])) {
                            return false;
                        }
                    }
                    return true;
                }
                return false;
            }
        }
        class eU {
            constructor() {
                this.tickPlacements = [[], [], [], []];
                this.ranges = [];
                this.preplaceRanges = [];
            }
            closestPossibleAngles(ci, cC) {
                let cK = Ai.items[cC];
                if (cK == undefined) {
                    return;
                }
                let cd = s5.list[cK];
                let ck = Ai.x2;
                let cQ = Ai.y2;
                let cg = ci.x;
                let cp = ci.y;
                let cW = ci.getScale(0.6, ci.isItem) + 0.69;
                let ct = cg - ck;
                let cn = cp - cQ;
                let cz = Math.sqrt(ct * ct + cn * cn);
                let cO = cd.placeOffset || 0;
                // Too far to touch: only the direct angle (getDirect takes objects, getDirection takes numbers).
                if (cz > Ai.scale + cW + cd.scale * 2 + cO) {
                    return [s4.getDirection(cg, cp, ck, cQ)];
                }
                const cx = Ai.scale + cd.scale + cO;
                const cM = cW + cd.scale;
                const cY = (cx * cx - cM * cM + cz * cz) / (cz * 2);
                const co = Math.sqrt(Math.max(0, cx * cx - cY * cY));
                const cG = ck + cY / cz * ct;
                const cS = cQ + cY / cz * cn;
                const cv = cG + co / cz * cn;
                const cE = cS - co / cz * ct;
                const cb = cG - co / cz * cn;
                const cR = cS + co / cz * ct;
                return [s4.getDirection(cv, cE, ck, cQ), s4.getDirection(cb, cR, ck, cQ)];
            }
            normalizeAngle(ci) {
                const cC = Math.PI * 2;
                return (ci % cC + cC) % cC;
            }
            mergeBlocked(ci) {
                const cC = Math.PI * 2;
                let cK = [];
                for (let [ck, cQ] of ci) {
                    ck = this.normalizeAngle(ck);
                    cQ = this.normalizeAngle(cQ);
                    let cg = (cQ - ck + cC) % cC;
                    if (cg < 1e-9) {
                        cK.push([ck, ck]);
                    } else if (ck < cQ) {
                        cK.push([ck, cQ]);
                    } else {
                        cK.push([ck, cC], [0, cQ]);
                    }
                }
                if (!cK.length) {
                    return [];
                }
                cK.sort((cp, cW) => cp[0] - cW[0]);
                let cd = [cK[0].slice()];
                for (let cp = 1; cp < cK.length; cp++) {
                    let [cW, ct] = cK[cp];
                    let cn = cd[cd.length - 1];
                    if (cW <= cn[1] + 1e-9) {
                        cn[1] = Math.max(cn[1], ct);
                    } else {
                        cd.push([cW, ct]);
                    }
                }
                if (cd.length === 1 && cd[0][0] <= 1e-9 && cd[0][1] >= cC - 1e-9) {
                    return [[0, cC]];
                }
                return cd;
            }
            invertArcs(ci) {
                const cC = Math.PI * 2;
                if (ci.length === 0) {
                    return [[0, cC]];
                }
                let cK = [];
                for (let cd = 0; cd < ci.length; cd++) {
                    let [ck, cQ] = ci[cd];
                    let cg = cQ;
                    let cp = cd < ci.length - 1 ? ci[cd + 1][0] : ci[0][0] + cC;
                    if (cp - cg > 1e-9) {
                        cK.push([this.normalizeAngle(cg), this.normalizeAngle(cp)]);
                    }
                }
                return cK;
            }
            angleRanges(ci) {
                const cC = Ai.items[ci];
                if (cC == null) {
                    this.ranges = [];
                    return;
                }
                const cK = s5.list[cC];
                let cd = [];
                const ck = AF.filter(cQ => s4.getDist(cQ, Ai, 0, 2) <= 200);
                for (let cQ of ck) {
                    let cg = this.closestPossibleAngles(cQ, ci);
                    if (!cg || cg.length !== 2) {
                        continue;
                    }
                    let [cp, cW] = cg;
                    const ct = Ai.scale + cK.scale + (cK.placeOffset || 0);
                    const cn = s4.getDirect(cQ, Ai, 0, 2);
                    const cz = cY => {
                        const co = Ai.x2 + ct * Math.cos(cY);
                        const cG = Ai.y2 + ct * Math.sin(cY);
                        return s6.checkItemLocation(co, cG, cK.scale, 0.6, ci, false);
                    };
                    const cx = cz(cp);
                    const cM = cz(cW);
                    if (cx && cM) {
                        cd.push([cp, cW]);
                    } else if (cx || cM) {
                        const cY = cx ? cp : cW;
                        const co = cx ? cW : cp;
                        const cG = (cn - cY + Math.PI * 2) % (Math.PI * 2) < (co - cY + Math.PI * 2) % (Math.PI * 2);
                        if (cG) {
                            cd.push([cY, co]);
                        } else {
                            cd.push([co, cY]);
                        }
                    } else {
                        cd.push([cp, cW]);
                    }
                }
                this.ranges = this.invertArcs(this.mergeBlocked(cd));
            }
            calcPreplace(ci, cC) {
                const cK = Ai.items[cC];
                if (cK == null) {
                    this.preplaceRanges = [];
                    return;
                }
                const cd = s5.list[cK];
                let ck = [];
                const cQ = AF.filter(cz => s4.getDist(cz, Ai, 0, 2) <= 200);
                for (let cz of cQ) {
                    if (cz.sid == ci.sid) {
                        continue;
                    }
                    let cx = this.closestPossibleAngles(cz, cC);
                    if (!cx || cx.length !== 2) {
                        continue;
                    }
                    let [cM, cY] = cx;
                    const co = Ai.scale + cd.scale + (cd.placeOffset || 0);
                    const cG = s4.getDirect(cz, Ai, 0, 2);
                    const cS = cb => {
                        const cR = Ai.x2 + co * Math.cos(cb);
                        const cD = Ai.y2 + co * Math.sin(cb);
                        return s6.preplaceCheck(cR, cD, cd.scale, 0.6, cC, false, ci);
                    };
                    const cv = cS(cM);
                    const cE = cS(cY);
                    if (cv && cE) {
                        ck.push([cM, cY]);
                    } else if (cv || cE) {
                        const cb = cv ? cM : cY;
                        const cR = cv ? cY : cM;
                        const cD = (cG - cb + Math.PI * 2) % (Math.PI * 2) < (cR - cb + Math.PI * 2) % (Math.PI * 2);
                        if (cD) {
                            ck.push([cb, cR]);
                        } else {
                            ck.push([cR, cb]);
                        }
                    } else {
                        ck.push([cM, cY]);
                    }
                }
                let cg = this.invertArcs(this.mergeBlocked(ck));
                let cX = this.closestPossibleAngles(ci, cC);
                // Only an object we can touch has a range of angles to place against.
                if (!cX || cX.length !== 2) {
                    this.preplaceRanges = [];
                    return;
                }
                const [cp, cW] = cX.map(this.normalizeAngle);
                const ct = cZ => {
                    const cO = this.normalizeAngle(cZ);
                    if (cp <= cW) {
                        return cO > cp && cO < cW;
                    } else {
                        return cO > cp || cO < cW;
                    }
                };
                let cn = [];
                for (let [cZ, cO] of cg) {
                    cZ = this.normalizeAngle(cZ);
                    cO = this.normalizeAngle(cO);
                    const cI = ct(cZ);
                    const ca = ct(cO);
                    if (cI && ca) {
                        cn.push([cZ, cO]);
                    } else if (cI || ca) {
                        const cu = cI ? cZ : cp;
                        const cl = ca ? cO : cW;
                        cn.push([cu, cl]);
                    }
                }
                this.preplaceRanges = cn;
            }
            closeToAngle(ci, cC, cK) {
                cC = this.normalizeAngle(cC);
                let cd = null;
                let ck = Infinity;
                for (let [cQ, cg] of cK ? this.preplaceRanges : this.ranges) {
                    if (cQ < cg && cC >= cQ && cC <= cg || cQ > cg && (cC >= cQ || cC <= cg)) {
                        return cC;
                    } else {
                        for (let cp of [cQ, cg]) {
                            let cW = s4.getAngleDist(cp, cC);
                            if (cW < ck) {
                                ck = cW;
                                cd = cp;
                            }
                        }
                    }
                }
                if (cd !== null) {
                    return cd;
                }
            }
        }
        let em = {
            active: false,
            gridSize: 100,
            scale: 1440,
            paths: [],
            attempts: 0,
            finded: false
        };
        class eT {
            constructor() {
                this.grid = [];
                this.foundPath = false;
            }
            init(ci, cC, cK) {
                let cd = {
                    x: 0,
                    y: 0
                };
                let ck = [];
                let cQ = Math.round(Ai.x3) - em.scale / 2;
                let cg = Math.round(Ai.y3) - em.scale / 2;
                let cp = em.scale / em.gridSize;
                let cW = [cp - 10, cp + 10];
                let ct = [Ai.scale, r.mapScale - Ai.scale];
                let cn = cC ? cW[1] : cp;
                // Mark the cells each obstacle covers once, instead of testing every
                // obstacle against every one of the 10,000 cells.
                let cO = em.gridSize;
                let cI = this.blocked && this.blocked.length === cO * cO ? this.blocked.fill(0) : this.blocked = new Uint8Array(cO * cO);
                for (let ca = 0; ca < AF.length; ca++) {
                    let cu = AF[ca];
                    if (!(!cu.isTeamObject(Ai) && (cu.dmg || cu.trap)) && !(!cu.ignoreCollision || cu.name == "teleporter")) {
                        continue;
                    }
                    let cl = cu.getScale(0.6, cu.isItem) + Ai.scale;
                    let cB = Math.max(0, Math.ceil((cu.x - cl - cQ) / cp));
                    let cw = Math.min(cO - 1, Math.floor((cu.x + cl - cQ) / cp));
                    let cL = Math.max(0, Math.ceil((cu.y - cl - cg) / cp));
                    let cy = Math.min(cO - 1, Math.floor((cu.y + cl - cg) / cp));
                    for (let ch = cL; ch <= cy; ch++) {
                        for (let cP = cB; cP <= cw; cP++) {
                            let cq = cQ + cp * cP - cu.x;
                            let cU = cg + cp * ch - cu.y;
                            if (cq * cq + cU * cU <= cl * cl) {
                                cI[ch * cO + cP] = 1;
                            }
                        }
                    }
                }
                this.grid = [];
                for (let cx = 0; cx < em.gridSize; cx++) {
                    this.grid[cx] = [];
                    for (let cM = 0; cM < em.gridSize; cM++) {
                        let cY = {
                            x: cQ + cp * cM,
                            y: cg + cp * cx
                        };
                        if (s4.getDist(cY, Ai, 0, 2) <= Ai.scale) {
                            this.grid[cx][cM] = 0;
                            continue;
                        }
                        if (cK == "auto push") {
                            let co = s4.getDist(cY, {
                                x: AQ.x2 - ci.x,
                                y: AQ.y2 - ci.y
                            }, 0, 0);
                            if (co <= cW[1]) {
                                ck.push({
                                    x: cM,
                                    y: cx,
                                    dist: co
                                });
                                this.grid[cx][cM] = 0;
                                continue;
                            }
                            let cG = s4.getDist(cY, AQ, 0, 2);
                            if (cG < AQ.scale + Ai.scale) {
                                this.grid[cx][cM] = 1;
                                continue;
                            }
                            let cS = cI[cx * cO + cM] === 1;
                            if (cS) {
                                this.grid[cx][cM] = 1;
                            } else {
                                this.grid[cx][cM] = 0;
                            }
                        } else if (cK == "follow") {
                            let cv = s4.getDist(cY, {
                                x: AQ.x2 - ci.x,
                                y: AQ.y2 - ci.y
                            }, 0, 0);
                            if (cv <= cW[1]) {
                                ck.push({
                                    x: cM,
                                    y: cx,
                                    dist: cv
                                });
                                this.grid[cx][cM] = 0;
                                continue;
                            }
                            let cE = cI[cx * cO + cM] === 1;
                            if (cE) {
                                this.grid[cx][cM] = 1;
                            } else {
                                this.grid[cx][cM] = 0;
                            }
                        }
                        if (cY.x < ct[0] || cY.x > ct[1] || cY.y < ct[0] || cY.y > ct[1]) {
                            this.grid[cx][cM] = 1;
                        }
                    }
                }
                this.foundPath = false;
                if (ck.length) {
                    ck.sort((cb, cR) => cb.dist - cR.dist);
                    cd = {
                        x: ck[0].x,
                        y: ck[0].y
                    };
                }
                const cz = {
                    x: Math.round(em.gridSize / 2),
                    y: Math.round(em.gridSize / 2)
                };
                if (this.grid[cz.y][cz.x] === 1) {
                    return {
                        start: null,
                        goal: null
                    };
                }
                if (this.grid[cd.y]?.[cd.x] === 1) {
                    const cb = this.getPaths(cd).filter(cD => cD.x >= 0 && cD.y >= 0 && cD.x < em.gridSize && cD.y < em.gridSize);
                    const cR = cb.find(cD => this.grid[cD.y]?.[cD.x] === 0);
                    if (cR) {
                        cd = cR;
                    } else {
                        return {
                            start: null,
                            goal: null
                        };
                    }
                }
                return {
                    start: cz,
                    goal: cd
                };
            }
            getPaths(ci) {
                return [{
                    x: ci.x + 1,
                    y: ci.y
                }, {
                    x: ci.x + 1,
                    y: ci.y + 1
                }, {
                    x: ci.x,
                    y: ci.y + 1
                }, {
                    x: ci.x - 1,
                    y: ci.y + 1
                }, {
                    x: ci.x - 1,
                    y: ci.y
                }, {
                    x: ci.x - 1,
                    y: ci.y - 1
                }, {
                    x: ci.x,
                    y: ci.y - 1
                }, {
                    x: ci.x + 1,
                    y: ci.y - 1
                }];
            }
            getScore(ci, cC) {
                return Math.abs(ci.x - cC.x) + Math.abs(ci.y - cC.y);
            }
            calc(ci, cC, cK) {
                let cd = this.init(ci, cC, cK);
                if (!cd.start || !cd.goal) {
                    return {
                        paths: [],
                        attempts: 0
                    };
                }
                let ck = cd.start;
                let cQ = cd.goal;
                if (this.grid[ck.y][ck.x] == 1 || this.grid[cQ.y][cQ.x] == 1) {
                    return {
                        paths: [],
                        attempts: 0
                    };
                }
                const cg = [];
                const cp = new Set();
                const cW = new Map();
                const ct = new Map();
                const cn = new Map();
                const cz = ck.x + "," + ck.y;
                cW.set(cz, 0);
                ct.set(cz, this.getScore(ck, cQ));
                cg.push({
                    x: ck.x,
                    y: ck.y,
                    f: ct.get(cz)
                });
                let cx = 0;
                const cM = 3000;
                const cY = Date.now();
                const co = 40;
                while (cg.length > 0 && cx < cM && Date.now() - cY < co) {
                    cx++;
                    let cG = 0;
                    for (let cb = 1; cb < cg.length; cb++) {
                        if (cg[cb].f < cg[cG].f) {
                            cG = cb;
                        }
                    }
                    const cS = cg.splice(cG, 1)[0];
                    const cv = cS.x + "," + cS.y;
                    if (cS.x === cQ.x && cS.y === cQ.y) {
                        const cR = [];
                        let cD = cS;
                        let cZ = cv;
                        while (cZ) {
                            cR.unshift(cD);
                            const ca = cn.get(cZ);
                            if (!ca) {
                                break;
                            }
                            cD = ca;
                            cZ = ca.x + "," + ca.y;
                        }
                        const cO = [];
                        const cI = em.scale / em.gridSize;
                        for (const cu of cR) {
                            cO.push({
                                x: Ai.x2 - em.scale / 2 + cI * cu.x,
                                y: Ai.y2 - em.scale / 2 + cI * cu.y
                            });
                        }
                        return {
                            paths: cO,
                            attempts: cx
                        };
                    }
                    cp.add(cv);
                    const cE = this.getPaths(cS);
                    for (const cl of cE) {
                        if (cl.x < 0 || cl.y < 0 || cl.x >= em.gridSize || cl.y >= em.gridSize) {
                            continue;
                        }
                        if (this.grid[cl.y][cl.x] === 1) {
                            continue;
                        }
                        const cB = cl.x + "," + cl.y;
                        if (cp.has(cB)) {
                            continue;
                        }
                        const cw = cl.x !== cS.x && cl.y !== cS.y;
                        const cL = cw ? 1.414 : 1;
                        const cy = cW.get(cv) + cL;
                        const ch = cW.get(cB);
                        if (ch === undefined || cy < ch) {
                            cn.set(cB, {
                                x: cS.x,
                                y: cS.y
                            });
                            cW.set(cB, cy);
                            const cP = this.getScore(cl, cQ);
                            const cq = cy + cP;
                            ct.set(cB, cq);
                            const cU = cg.some(cm => cm.x === cl.x && cm.y === cl.y);
                            if (!cU) {
                                cg.push({
                                    x: cl.x,
                                    y: cl.y,
                                    f: cq
                                });
                            }
                        }
                    }
                }
                return {
                    paths: [],
                    attempts: cx
                };
            }
        }
        ;
        class eX {
            constructor() {
                this.wait = false;
                this.can = false;
                this.isTrue = false;
                this.nobull = false;
                this.ticking = false;
                this.canSpikeTick = false;
                this.startTick = false;
                this.readyTick = false;
                this.canCounter = false;
                this.revTick = false;
                this.syncHit = false;
                this.changeType = function (ci) {
                    this.wait = false;
                    this.isTrue = true;
                    AW.autoAim = true;
                    if (ci == "rev") {
                        ez(Ai.weapons[1]);
                        et(53, 0);
                        if (!eM) {
                            eY();
                        }
                        fU.tickBase(() => {
                            ez(Ai.weapons[0]);
                            if (AQ.dist2 <= 120 && fu.doSpikeOnReverse) {
                                ev(2, AQ.aim2);
                            }
                            et(7, 0);
                            fU.tickBase(() => {
                                this.isTrue = false;
                                AW.autoAim = false;
                            }, 1);
                        }, 1);
                    } else if (ci == "nobull") {
                        ez(Ai.weapons[0]);
                        et(6, 0);
                        if (!eM) {
                            eY();
                        }
                        fU.tickBase(() => {
                            et(Ai.reloads[53] == 0 && AQ.skinIndex != 22 ? 53 : 6, 0);
                            ez(Ai.weapons[1]);
                            fU.tickBase(() => {
                                this.isTrue = false;
                                AW.autoAim = false;
                            }, 1);
                        }, 1);
                    } else if (ci == "normal") {
                        fU.tickBase(() => {
                            ez(Ai.weapons[0]);
                            et(7, 0);
                            if (!eM) {
                                eY();
                            }
                            fU.tickBase(() => {
                                ez(Ai.weapons[1]);
                                et(Ai.reloads[53] == 0 && AQ.skinIndex != 22 ? 53 : 6, 0);
                                fU.tickBase(() => {
                                    this.isTrue = false;
                                    AW.autoAim = false;
                                }, 1);
                            }, 1);
                        }, 1);
                    } else {
                        fU.tickBase(() => {
                            this.isTrue = false;
                            AW.autoAim = false;
                        }, 1);
                    }
                };
                this.spikeTickType = function (ci) {
                    this.isTrue = true;
                    AW.autoAim = true;
                    ez(Ai.weapons[0]);
                    if (ci == "rev" && Ai.reloads[53] == 0) {
                        et(53, 0);
                        fU.tickBase(() => {
                            et(7, 0);
                            if (!eM) {
                                eY();
                            }
                            fU.tickBase(() => {
                                this.isTrue = false;
                                AW.autoAim = false;
                            }, 1);
                        }, 1);
                    } else {
                        et(7, 0);
                        if (!eM) {
                            eY();
                        }
                        fU.tickBase(() => {
                            if (Ai.reloads[53] == 0 && fu.turretCombat) {
                                et(53, 0);
                                fU.tickBase(() => {
                                    this.isTrue = false;
                                    AW.autoAim = false;
                                }, 1);
                            } else {
                                this.isTrue = false;
                                AW.autoAim = false;
                            }
                        }, 1);
                    }
                };
                this.counterType = function () {
                    this.isTrue = true;
                    AW.autoAim = true;
                    ez(Ai.weapons[0]);
                    et(7, 0);
                    et(21, 1);
                    if (!eM) {
                        eY();
                    }
                    fU.tickBase(() => {
                        if (Ai.reloads[53] == 0 && fu.turretCombat) {
                            ez(Ai.weapons[0]);
                            et(53, 0);
                            et(21, 1);
                            fU.tickBase(() => {
                                this.isTrue = false;
                                AW.autoAim = false;
                            }, 1);
                        } else {
                            this.isTrue = false;
                            AW.autoAim = false;
                        }
                    }, 1);
                };
                this.rangeType = function (ci) {
                    this.isTrue = true;
                    AW.autoAim = true;
                    if (ci == "ageInsta") {
                        AW.ageInsta = false;
                        if (Ai.items[5] == 18) {
                            ss.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, AQ.aim2, true);
                        }
                        A0("9", undefined, 1);
                        et(53, 0);
                        fU.tickBase(() => {
                            ez(Ai.weapons[1]);
                            et(53, 0);
                            if (!eM) {
                                eY();
                            }
                            fU.tickBase(() => {
                                ek(12);
                                ez(Ai.weapons[1]);
                                et(53, 0);
                                fU.tickBase(() => {
                                    ek(15);
                                    ez(Ai.weapons[1]);
                                    et(53, 0);
                                    fU.tickBase(() => {
                                        this.isTrue = false;
                                        AW.autoAim = false;
                                        this.ticking = false;
                                    }, 3);
                                }, 1);
                            }, 1);
                        }, 2);
                    } else {
                        ez(Ai.weapons[1]);
                        if (Ai.reloads[53] == 0 && AQ.dist2 <= 700 && AQ.skinIndex != 22) {
                            et(53, 0);
                        } else {
                            et(20, 0);
                        }
                        if (!eM) {
                            eY();
                        }
                        fU.tickBase(() => {
                            this.isTrue = false;
                            AW.autoAim = false;
                        }, 1);
                    }
                };
                this.musketSync = function () {
                    if (Ai.weapons[1] != 15) {
                        return;
                    }
                    this.isTrue = true;
                    if (Ai.items[5] == 18) {
                        ss.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, AQ.aim3, true);
                    }
                    AW.autoAim = true;
                    et(53, 0);
                    fU.tickBase(() => {
                        ez(Ai.weapons[1]);
                        if (!eM) {
                            eY();
                        }
                        fU.tickBase(() => {
                            this.isTrue = false;
                            AW.autoAim = false;
                        }, 1);
                    }, 1);
                };
                // Hit with the primary this tick in bull helmet (or hat cK), aimed at
                // the enemy (or angle cd). Projectile sync, velocity hits, push strikes...
                this.bullHitType = function (ci, cK, cd) {
                    this.isTrue = true;
                    AW.autoAim = true;
                    AW.customAim = cd;
                    ez(Ai.weapons[0]);
                    et(cK || 7, 0);
                    if (!eM) {
                        eY();
                    }
                    Ai.chat.message = ci;
                    Ai.chat.count = 600;
                    fU.tickBase(() => {
                        this.isTrue = false;
                        AW.autoAim = false;
                        AW.customAim = undefined;
                    }, 1);
                };
                // Falcon knockback insta. Normal: bull + primary, then turret gear +
                // secondary. Reverse (ci): turret gear + secondary, then bull + primary.
                this.knockbackInstaType = function (ci, cK) {
                    this.isTrue = true;
                    AW.autoAim = true;
                    ez(Ai.weapons[ci ? 1 : 0]);
                    et(ci ? 53 : 7, 0);
                    if (!eM) {
                        eY();
                    }
                    Ai.chat.message = cK;
                    Ai.chat.count = 600;
                    fU.tickBase(() => {
                        ez(Ai.weapons[ci ? 0 : 1]);
                        et(ci ? 7 : 53, 0);
                        fU.tickBase(() => {
                            this.isTrue = false;
                            AW.autoAim = false;
                        }, 1);
                    }, 1);
                };
                // One tick in hat ci without attacking (turret gear / barbarian knockback, turret assist).
                this.gearTickType = function (ci, cK) {
                    this.isTrue = true;
                    et(ci, 0);
                    Ai.chat.message = cK;
                    Ai.chat.count = 600;
                    fU.tickBase(() => {
                        this.isTrue = false;
                    }, 1);
                };
                // Falcon apple insta: tank gear + great hammer on the enemy's trap (ci),
                // then a spike toward them with bull + primary once the trap is gone.
                this.appleInstaType = function (ci) {
                    this.isTrue = true;
                    AW.autoAim = true;
                    AW.customAim = Math.atan2(ci.y - Ai.y2, ci.x - Ai.x2);
                    ez(Ai.weapons[1]);
                    et(40, 0);
                    if (!eM) {
                        eY();
                    }
                    Ai.chat.message = "apple insta";
                    Ai.chat.count = 600;
                    fU.tickBase(() => {
                        AW.customAim = undefined;
                        ez(Ai.weapons[0]);
                        if (AQ.sid !== undefined) {
                            ev(2, AQ.aim2);
                        }
                        et(7, 0);
                        fU.tickBase(() => {
                            this.isTrue = false;
                            AW.autoAim = false;
                        }, 1);
                    }, 1);
                };
                // Falcon one tick: tick 1 turret gear (no hit), tick 2 bull + primary hit,
                // moving as roboticsOneTickPlan() decided on each tick.
                this.dynamicOneTickType = function (ci) {
                    this.isTrue = true;
                    this.ticking = true;
                    AW.autoAim = true;
                    et(53, 0);
                    A0("9", ci.firstDir, 1);
                    fU.tickBase(() => {
                        ez(Ai.weapons[0]);
                        et(7, 0);
                        if (!eM) {
                            eY();
                        }
                        A0("9", ci.secondDir, 1);
                        fU.tickBase(() => {
                            this.isTrue = false;
                            this.ticking = false;
                            AW.autoAim = false;
                            A0("9", undefined, 1);
                        }, 1);
                    }, 1);
                };
                this.boostTickType = function () {
                    this.isTrue = true;
                    AW.autoAim = true;
                    A0("9", AQ.aim2, 1);
                    fU.tickBase(() => {
                        if (Ai.weapons[1] == 15) {
                            AW.revAim = true;
                        }
                        ez(Ai.weapons[[9, 12, 13, 15].includes(Ai.weapons[1]) ? 1 : 0]);
                        et(53, 0);
                        if ([9, 12, 13, 15].includes(Ai.weapons[1])) {
                            if (!eM) {
                                eY();
                            }
                        }
                        ev(4, AQ.aim2);
                        fU.tickBase(() => {
                            AW.revAim = false;
                            ez(Ai.weapons[0]);
                            et(7, 0);
                            if (!eM) {
                                eY();
                            }
                            fU.tickBase(() => {
                                this.isTrue = false;
                                AW.autoAim = false;
                                A0("9", undefined, 1);
                                this.goTickThem = false;
                            }, 1);
                        }, 1);
                    }, 1);
                };
                this.gotoGoal = function (ci, cC) {
                    let cK = cQ => cQ * Ai.scale;
                    let cd = {
                        a: ci - cC,
                        b: ci + cC,
                        c: ci - cK(1),
                        d: ci + cK(1),
                        e: ci - cK(2),
                        f: ci + cK(2),
                        g: ci - cK(4),
                        h: ci + cK(4)
                    };
                    let ck = function (cQ, cg) {
                        if (Ai.inWater && cg == 0) {
                            et(31, 0);
                        } else {
                            et(cQ, cg);
                        }
                    };
                    if (Ad.length) {
                        let cQ = AQ.dist2;
                        this.ticking = true;
                        if (cQ >= cd.a && cQ <= cd.b) {
                            ck(0, 0);
                            if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                            }
                            return {
                                dir: undefined,
                                action: 1
                            };
                        } else {
                            if (cQ < cd.a) {
                                if (cQ >= cd.g) {
                                    if (cQ >= cd.e) {
                                        if (cQ >= cd.c) {
                                            ck(40, 0);
                                            ck(0, 1);
                                            if (fu.slowOT) {
                                                if (Ai.buildIndex != Ai.items[1]) {
                                                    en(Ai.items[1]);
                                                }
                                            } else if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                                ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                            }
                                        } else {
                                            ck(22, 0);
                                            ck(0, 1);
                                            if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                                ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        ck(6, 0);
                                        ck(0, 1);
                                        if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                            ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    el(1);
                                    ck(11, 1);
                                    if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                        ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                    }
                                }
                                return {
                                    dir: AQ.aim2 + Math.PI,
                                    action: 0
                                };
                            } else if (cQ > cd.b) {
                                if (cQ <= cd.h) {
                                    if (cQ <= cd.f) {
                                        if (cQ <= cd.d) {
                                            ck(40, 0);
                                            ck(0, 1);
                                            if (fu.slowOT) {
                                                if (Ai.buildIndex != Ai.items[1]) {
                                                    en(Ai.items[1]);
                                                }
                                            } else if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                                ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                            }
                                        } else {
                                            ck(22, 0);
                                            ck(0, 1);
                                            if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                                ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                            }
                                        }
                                    } else {
                                        ck(6, 0);
                                        ck(0, 1);
                                        if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                            ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    el(1);
                                    ck(11, 1);
                                    if (Ai.weaponIndex != Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0] || Ai.buildIndex > -1) {
                                        ez(Ai.weapons[[10, 14].includes(Ai.weapons[1]) ? 1 : 0]);
                                    }
                                }
                                return {
                                    dir: AQ.aim2,
                                    action: 0
                                };
                            }
                            return {
                                dir: undefined,
                                action: 0
                            };
                        }
                    } else {
                        this.ticking = false;
                        return {
                            dir: undefined,
                            action: 0
                        };
                    }
                };
                this.bowMovement = function () {
                    let ci = this.gotoGoal(682, 4);
                    if (ci.action) {
                        if (Ai.reloads[53] == 0 && !this.isTrue) {
                            this.rangeType("ageInsta");
                        } else {
                            A0("9", ci.dir, 1);
                        }
                    } else {
                        A0("9", ci.dir, 1);
                    }
                };
                this.boostTickMovement = function () {
                    this.ticking = true;
                    let ci = Ai.weapons[1] == 9 ? 365 : Ai.weapons[1] == 12 ? 380 : Ai.weapons[1] == 13 ? 390 : Ai.weapons[1] == 15 ? 365 : 370;
                    let cC = Ai.weapons[1] == 9 ? 2 : Ai.weapons[1] == 12 ? 1.5 : Ai.weapons[1] == 13 ? 1.5 : Ai.weapons[1] == 15 ? 2 : 3;
                    let cK = this.gotoGoal(ci, cC);
                    if (cK.action) {
                        if (Ai.reloads[53] == 0 && !this.isTrue) {
                            this.boostTickType();
                        } else {
                            A0("9", cK.dir, 1);
                        }
                    } else {
                        A0("9", cK.dir, 1);
                    }
                };
                this.perfCheck = function (ci, cC) {
                    if (cC.weaponIndex == 11 && s4.getAngleDist(cC.aim2 + Math.PI, cC.d2) <= r.shieldAngle) {
                        return false;
                    }
                    if (![9, 12, 13, 15].includes(Ai.weapons[1])) {
                        return true;
                    }
                    let cK = {
                        x: cC.x2 + Math.cos(cC.aim2 + Math.PI) * 70,
                        y: cC.y2 + Math.sin(cC.aim2 + Math.PI) * 70
                    };
                    if (s4.lineInRect(ci.x2 - ci.scale, ci.y2 - ci.scale, ci.x2 + ci.scale, ci.y2 + ci.scale, cK.x, cK.y, cK.x, cK.y)) {
                        return true;
                    }
                    let cd = AA.find(ck => {
                        if (ck.visible && s4.lineInRect(ck.x2 - ck.scale, ck.y2 - ck.scale, ck.x2 + ck.scale, ck.y2 + ck.scale, cK.x, cK.y, cK.x, cK.y)) {
                            return true;
                        }
                    });
                    if (cd) {
                        return false;
                    }
                    cd = roboticsGrid.near(cK.x, cK.y, 250, roboticsNearTmp).find(ck => {
                        if (!ck.active) {
                            return false;
                        }
                        let cQ = ck.getScale();
                        if (!ck.ignoreCollision && s4.lineInRect(ck.x - cQ, ck.y - cQ, ck.x + cQ, ck.y + cQ, cK.x, cK.y, cK.x, cK.y)) {
                            return true;
                        }
                    });
                    if (cd) {
                        return false;
                    }
                    return true;
                };
            }
        }
        ;
        class s0 {
            constructor(ci) {
                this.items = ci;
            }
            buyNext() {
                for (const [ci, cC] of this.items) {
                    const cK = cC === 0 ? roboticsHatById.get(ci) : roboticsTailById.get(ci);
                    const cd = cC === 0 ? Ai.skins[ci] : Ai.tails[ci];
                    if (!cK || cd) {
                        continue;
                    }
                    if (Ai.points >= cK.price) {
                        A0("c", 1, ci, cC);
                        if (ci == 7 && cC == 0) {
                            AW.reSync = true;
                        }
                        return;
                    }
                    return;
                }
            }
        }
        let s3 = [];
        let s4 = new e9();
        let s5 = new es();
        let s6 = new eV(ee, Ac, s4, r);
        let s7 = new ec();
        let s8 = s7.hats;
        let s9 = s7.accessories;
        let sf = new eF(er, AH, Ae, AA, s6, s5, r, s4);
        let sA = new eH(AA, eN, Ae, s5, null, r, s4);
        let se = new eA();
        let ss = new eP(s4, s5);
        let sV = new eq();
        let sr = new eU();
        let sc = new eX();
        let sF = new s0([[11, 1], [40, 0], [6, 0], [7, 0], [31, 0], [15, 0], [19, 1], [22, 0], [53, 0], [12, 0], [20, 0], [10, 0], [56, 0], [21, 1], [11, 0], [26, 0], [18, 1], [13, 1]]);
        let sN = new eT();
        let si;
        let sC;
        let sK = {};
        let sd = [];
        let sk;
        let sQ = [];

        /* =====================================================================
           Ported from Falcon (v1.9.0 Phase 3). Every feature below has a menu
           toggle (fu.<id>) and a keybind (CONFIG.keys), and works through
           Robotics' own state and actions: Ai/AQ/Ad, hats through et(), hits
           through sc, placing through ev(), packets through the limiter.
           ===================================================================== */
        const roboticsHatById = new Map(s8.map(hat => [hat.id, hat]));
        const roboticsTailById = new Map(s9.map(tail => [tail.id, tail]));
        const ROBOTICS_HITBOX = 63;

        // Damage per weapon and variant, computed once. Ranged weapons ignore the variant.
        const roboticsWeaponDamageTable = s5.weapons.map(weapon => r.weaponVariants.map(variant => weapon.projectile !== undefined ? weapon.Pdmg || 0 : (weapon.dmg || 0) * variant.val));
        function roboticsWeaponDamage(weaponId, variant) {
            const row = roboticsWeaponDamageTable[weaponId];
            if (!row) return 0;
            return row[variant] !== undefined ? row[variant] : row[0];
        }

        function roboticsInCombatRange(a, b, range) {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const total = range + ROBOTICS_HITBOX;
            return dx * dx + dy * dy <= total * total;
        }

        function roboticsToggleSetting(id, label) {
            fu[id] = !fu[id];
            try {
                localStorage.setItem(id, fu[id]);
            } catch (err) { /* storage unavailable */ }
            const box = document.querySelector("#" + id + " .checkbox-input");
            if (box) box.checked = fu[id];
            fO("Toggle", label + ": " + (fu[id] ? "on" : "off"), fu[id] ? "#8ecc51" : "#cc5151", 1);
        }

        /* ---- Movement physics simulator (Falcon MovementPhysicsSimulator) ----
           Predicts where a player will be after a tick: movement, deceleration,
           river current, object collisions, spikes, traps, boost pads and
           knockback. Positions/velocities come from the last server update. */
        let roboticsSim = {
            decel: Math.pow(r.playerDecel, CONFIG.tick.rate),
            objects: [],
            extra: [],
            marks: new Map(),
            marker: 0,

            state(player) {
                return {
                    sid: player.sid,
                    team: player.team,
                    order: player.updateOrder || 0,
                    x: player.x2,
                    y: player.y2,
                    velX: player.vx || 0,
                    velY: player.vy || 0,
                    scale: player.scale,
                    health: player.health,
                    maxHealth: player.maxHealth || 100,
                    skinIndex: player.skinIndex,
                    tailIndex: player.tailIndex,
                    lockMove: false,
                    weaponIndex: player.weaponIndex,
                    buildIndex: player.buildIndex,
                    slowMult: 1,
                    spikeDamages: 0
                };
            },

            newResult() {
                return { spikesHit: 0, oneTicked: false, trapped: false, trap: undefined, pitTrapped: false, teleported: false, totalDamage: 0, x: 0, y: 0 };
            },

            isTeam(victim, obj) {
                if (!obj.owner) return false;
                if (obj.owner.sid === victim.sid) return true;
                const owner = AM(obj.owner.sid);
                return !!(owner && victim.team && owner.team === victim.team);
            },

            isCactus(obj) {
                return obj.type == 1 && obj.y >= r.mapScale - r.snowBiomeTop;
            },

            damage(victim, amount, result) {
                const dealt = amount * (victim.skinIndex == 6 ? 0.75 : 1);
                victim.health -= dealt;
                result.totalDamage += dealt;
            },

            collide(victim, obj, tMlt, result) {
                const isEnemy = !this.isTeam(victim, obj);
                const isCactus = this.isCactus(obj);
                const isDangerous = isCactus || obj.dmg && isEnemy;
                const isMe = victim.sid === Ai.sid;
                const padding = isMe && isDangerous ? 1 : !isMe && (obj.trap || isDangerous) ? 0.5 : 0;
                const objScale = obj.getScale ? obj.getScale() : obj.scale;
                const totalScale = victim.scale + objScale;
                const reach = totalScale + padding;
                const dx = victim.x - obj.x;
                const dy = victim.y - obj.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > reach * reach) return;

                const dist = Math.sqrt(distSq) || 1;
                const ux = dx / dist;
                const uy = dy / dist;
                const alreadyHit = this.marks.get(obj.sid) === this.marker;

                if (!obj.ignoreCollision) {
                    victim.x = obj.x + totalScale * ux;
                    victim.y = obj.y + totalScale * uy;
                    victim.velX *= 0.75;
                    victim.velY *= 0.75;
                    if (!alreadyHit && (isEnemy && obj.dmg || isCactus)) {
                        this.damage(victim, obj.dmg || 35, result);
                        victim.velX += 1.5 * ux;
                        victim.velY += 1.5 * uy;
                        victim.spikeDamages += obj.dmg || 35;
                        result.spikesHit++;
                    }
                } else if (isEnemy && obj.trap) {
                    victim.lockMove = true;
                    result.trapped = true;
                    result.trap = obj;
                } else if (obj.teleport) {
                    result.teleported = true;
                } else if (obj.boostSpeed) {
                    const mag = tMlt * obj.boostSpeed;
                    victim.velX += mag * Math.cos(obj.dir);
                    victim.velY += mag * Math.sin(obj.dir);
                }
                this.marks.set(obj.sid, this.marker);
            },

            move(victim, moveDir, dt, spikeHitsBefore, result) {
                if (victim.slowMult < 1) victim.slowMult = Math.min(1, victim.slowMult + 0.0888);
                if (victim.lockMove) {
                    victim.velX = 0;
                    victim.velY = 0;
                    if (spikeHitsBefore !== result.spikesHit) result.pitTrapped = true;
                    return;
                }
                result.trapped = false;
                result.pitTrapped = false;
                result.trap = undefined;

                const weapon = s5.weapons[victim.weaponIndex];
                const skin = roboticsHatById.get(victim.skinIndex);
                const tail = roboticsTailById.get(victim.tailIndex);
                const onRiver = victim.y >= r.mapScale / 2 - r.riverWidth / 2 && victim.y <= r.mapScale / 2 + r.riverWidth / 2;
                let speedMult = (victim.buildIndex >= 0 ? 0.5 : 1) * (weapon && weapon.spdMult || 1) * (skin && skin.spdMult || 1) * (tail && tail.spdMult || 1) * victim.slowMult;

                if (onRiver) {
                    if (skin && skin.watrImm) {
                        speedMult *= 0.75;
                        victim.velX += r.waterCurrent * 0.4 * dt;
                    } else {
                        speedMult *= 0.33;
                        victim.velX += r.waterCurrent * dt;
                    }
                }
                if (typeof moveDir !== "number") return;

                const snowMult = victim.y <= r.snowBiomeTop ? (skin && skin.coldM ? skin.coldM : r.snowSpeed) : 1;
                const mag = r.playerSpeed * speedMult * snowMult * dt;
                victim.velX += Math.cos(moveDir) * mag;
                victim.velY += Math.sin(moveDir) * mag;
            },

            postTick(victim) {
                if (victim.velX) {
                    victim.velX *= this.decel;
                    if (Math.abs(victim.velX) <= 0.01) victim.velX = 0;
                }
                if (victim.velY) {
                    victim.velY *= this.decel;
                    if (Math.abs(victim.velY) <= 0.01) victim.velY = 0;
                }
                victim.x = Math.min(r.mapScale - victim.scale, Math.max(victim.scale, victim.x));
                victim.y = Math.min(r.mapScale - victim.scale, Math.max(victim.scale, victim.y));
            },

            // Players later in the server's update order push the victim apart.
            playerCollisions(victim) {
                if (victim.sid === Ai.sid) return;
                for (let i = 0; i < Ae.length; i++) {
                    const other = Ae[i];
                    if (!other.visible || other.sid === victim.sid || !((other.updateOrder || 0) > victim.order)) continue;
                    const dx = victim.x - other.x2;
                    const dy = victim.y - other.y2;
                    if (Math.abs(dx) > 70 || Math.abs(dy) > 70) continue;
                    const distSq = dx * dx + dy * dy;
                    if (distSq >= 4900 || distSq === 0) continue;
                    const factor = 0.5 * (70 / Math.sqrt(distSq) - 1);
                    victim.x += dx * factor;
                    victim.y += dy * factor;
                }
            },

            step(victim, dt, result, ignoreSid) {
                const depth = Math.min(4, Math.max(1, Math.round(Math.hypot(victim.velX * dt, victim.velY * dt) / 40)));
                const tMlt = 1 / depth;
                for (let i = 0; i < depth; i++) {
                    if (victim.velX) victim.x += victim.velX * tMlt * dt;
                    if (victim.velY) victim.y += victim.velY * tMlt * dt;
                    for (let j = 0; j < this.objects.length; j++) {
                        const obj = this.objects[j];
                        if (obj.active && obj.sid !== ignoreSid) this.collide(victim, obj, tMlt, result);
                    }
                    for (let j = 0; j < this.extra.length; j++) {
                        this.collide(victim, this.extra[j], tMlt, result);
                    }
                }
                this.playerCollisions(victim);
            },

            // One tick of movement in direction moveDir (null = standing still). Returns a new state.
            simTick(oldState, moveDir) {
                const dt = fU.tickRate;
                const victim = Object.assign({}, oldState);
                const result = this.newResult();
                roboticsGrid.near(victim.x, victim.y, 400, this.objects);
                this.extra.length = 0;
                this.marker++;
                this.move(victim, moveDir, dt, 0, result);
                victim.lockMove = false;
                this.step(victim, dt, result, -1);
                this.postTick(victim);
                return victim;
            },

            /* Simulate `ticks` ticks of a victim that is not steering, applying
               actions[tick] at the start of each tick: {type: "knockback", pos,
               knockPower}, {type: "place", x, y, id, ownerSid} or {type:
               "damage", damage}. Mutates the victim state. */
            simulate(victim, actions, ticks, ignoreSid) {
                const result = this.newResult();
                if (ticks <= 0) return result;
                const dt = fU.tickRate;
                roboticsGrid.near(victim.x, victim.y, 400, this.objects);
                this.extra.length = 0;
                let spikeHits = 0;

                for (let tick = 0; tick < ticks; tick++) {
                    victim.health = victim.maxHealth;
                    const queue = actions[tick] || [];
                    for (let i = 0; i < queue.length; i++) {
                        const action = queue[i];
                        if (action.dontUse) continue;
                        if (action.type === "knockback") {
                            const dx = victim.x - action.pos.x;
                            const dy = victim.y - action.pos.y;
                            const dist = Math.hypot(dx, dy) || 1;
                            victim.velX += dx / dist * action.knockPower;
                            victim.velY += dy / dist * action.knockPower;
                            if (action.damage) this.damage(victim, action.damage, result);
                        } else if (action.type === "place") {
                            const item = s5.list[action.id];
                            this.extra.push({
                                x: action.x, y: action.y, scale: item.scale, dir: 0, sid: -1, active: true,
                                type: item.type, dmg: item.dmg, trap: item.trap, teleport: item.teleport,
                                boostSpeed: item.boostSpeed, ignoreCollision: item.ignoreCollision,
                                owner: { sid: action.ownerSid }
                            });
                        } else if (action.type === "damage") {
                            this.damage(victim, action.damage, result);
                        }
                    }
                    result.pitTrapped = false;
                    this.move(victim, null, dt, spikeHits, result);
                    victim.lockMove = false;
                    spikeHits = result.spikesHit;
                    this.marker++;
                    this.step(victim, dt, result, ignoreSid === undefined ? -1 : ignoreSid);
                    if (victim.health <= 0 || result.teleported) {
                        if (victim.health <= 0) result.oneTicked = true;
                        break;
                    }
                    victim.skinIndex = 6;
                    this.postTick(victim);
                }
                result.x = victim.x;
                result.y = victim.y;
                return result;
            }
        };

        /* ---- Smart anti-insta (Falcon AutoHealer decision order) ----
           When this tick's predicted damage would kill you: wear the EMP helmet
           if the turret part it blocks is enough, otherwise soldier if 25% less
           is enough, otherwise heal. A hat that saves you means no early heal,
           so no shame. Non-lethal healing stays with Robotics' auto-heal. */
        function roboticsLethalDecision() {
            if (!fu.smartAntiInsta || !Ai || !AX) return false;
            if (AW.lethalTick === fU.tick) return AW.lethalHandled;
            AW.lethalTick = fU.tick;
            AW.lethalHandled = false;

            const damage = Ai.mostDamageThreat;
            if (Ai.health - damage > 0) return false;
            AW.lethalHandled = true;

            const soldierForced = AW.anti0Tick > 0 || AW.forceStop;
            if (soldierForced || sc.isTrue) {
                // The hat is already decided (forced soldier, or our own attack sequence).
                if (!(soldierForced && Ai.health - damage * 0.75 > 0)) eZ();
                return true;
            }

            const empBlocks = Ai.turretThreat || 0;
            const canEmp = !Ai.inTrap && !Ai.escaped && !Ai.hitSpike;
            if (canEmp && empBlocks > 0 && Ai.health - damage + empBlocks > 0 && Ai.skins[22]) {
                Ai.empAnti = true;
                Ai.soldierAnti = false;
                Ai.chat.message = "smart anti: emp";
                Ai.chat.count = 334;
                return true;
            }
            if (Ai.health - damage * 0.75 > 0 && Ai.skins[6]) {
                Ai.soldierAnti = true;
                Ai.empAnti = false;
                Ai.chat.message = "smart anti: soldier";
                Ai.chat.count = 334;
                return true;
            }
            eZ();
            return true;
        }

        // The anti-insta heal from a damage event: Falcon's order when on, the old instant heal when off.
        function roboticsAntiInstaHeal() {
            if (fu.smartAntiInsta) {
                roboticsLethalDecision();
            } else {
                eZ();
            }
        }

        /* ---- Bull hit triggers (Falcon ProjectileSyncer + VelocityAttacker) ---- */
        function roboticsPrimaryReady() {
            const weapon = Ai.weapons[0];
            return weapon !== undefined && !(Ai.reloads[weapon] > 0);
        }

        function roboticsCanBullHit() {
            return Ad.length && AQ.sid !== undefined && !sc.isTrue && !sV.active && Ai.tailIndex != 11 && Ai.skins[7] && AW.anti0Tick <= 0 && !AW.forceStop;
        }

        // Friendly turrets about to fire within range of the target.
        function roboticsReadyTurretsNear(target) {
            let count = 0;
            for (const obj of roboticsGrid.turrets) {
                if (!obj.active || !obj.owner || !obj.isTeamObject(Ai)) continue;
                if (!(obj.reloads <= fU.tickRate)) continue;
                if (s4.getDistance(obj.x, obj.y, target.x2, target.y2) <= 700) count++;
            }
            return count;
        }

        /* Who a projectile hits during the next tick (its path x2,y2 -> x3,y3
           passing within a player's radius, as the server checks it). Hits on
           you add to your damage threat; hits on an enemy by you or a teammate
           add to that enemy's projDamage for projectile sync. */
        function roboticsProjectileThreat(projectile) {
            const ax = projectile.x2;
            const ay = projectile.y2;
            const dx = projectile.x3 - ax;
            const dy = projectile.y3 - ay;
            const lengthSq = dx * dx + dy * dy || 1;
            const owner = projectile.owner;
            const friendly = owner && Ai && owner.isTeam(Ai);
            for (let i = 0; i < Ae.length; i++) {
                const player = Ae[i];
                if (!player.visible || player === owner || owner && owner.isTeam(player)) continue;
                if (player !== Ai && !friendly) continue;
                const t = Math.max(0, Math.min(1, ((player.x2 - ax) * dx + (player.y2 - ay) * dy) / lengthSq));
                const px = ax + dx * t - player.x2;
                const py = ay + dy * t - player.y2;
                if (px * px + py * py > player.scale * player.scale) continue;
                if (player === Ai) {
                    Ai.addDamageThreat(projectile.dmg);
                } else {
                    player.projDamage = (player.projDamage || 0) + projectile.dmg;
                }
            }
        }

        /* Projectile sync: arrows/bullets from you or teammates that hit the
           enemy next tick (AQ.projDamage, see the projectile tickUpdate) plus
           friendly turrets about to fire, plus your bull hit, kill. */
        function roboticsProjectileSync() {
            if (!fu.projectileSync || !roboticsCanBullHit() || !roboticsPrimaryReady()) return false;
            const weapon = Ai.weapons[0];
            if (!roboticsInCombatRange({ x: Ai.x2, y: Ai.y2 }, { x: AQ.x2, y: AQ.y2 }, s5.weapons[weapon].range)) return false;
            const incoming = (AQ.projDamage || 0) + 25 * roboticsReadyTurretsNear(AQ);
            if (incoming <= 0) return false;
            if (roboticsWeaponDamage(weapon, Ai.primaryVariant) * 1.5 + incoming < 100) return false;
            sc.bullHitType("projectile sync");
            return true;
        }

        /* Velocity hit: the enemy's next position touches a spike that hurts
           them, and they update after you this tick, so your bull hit plus the
           spike kill. */
        function roboticsVelocityHit() {
            if (!fu.velocityHits || !roboticsCanBullHit() || !roboticsPrimaryReady() || AQ.inTrap) return false;
            const weapon = Ai.weapons[0];
            if (![3, 4, 5].includes(weapon)) return false;
            if (!((AQ.updateOrder || 0) > (Ai.updateOrder || 0))) return false;
            if (!roboticsInCombatRange({ x: Ai.x2, y: Ai.y2 }, { x: AQ.x2, y: AQ.y2 }, s5.weapons[weapon].range)) return false;

            let damage = roboticsWeaponDamage(weapon, Ai.primaryVariant) * 1.5;
            const nextX = isFinite(AQ.x3) ? AQ.x3 : AQ.x2;
            const nextY = isFinite(AQ.y3) ? AQ.y3 : AQ.y2;
            const victim = roboticsSim.state(AQ);
            const nearby = roboticsGrid.near(nextX, nextY, 120, roboticsNearTmp);
            for (let i = 0; i < nearby.length; i++) {
                const obj = nearby[i];
                if (!obj.active || !obj.dmg || roboticsSim.isTeam(victim, obj)) continue;
                if (s4.getDistance(nextX, nextY, obj.x, obj.y) > obj.scale + 34) continue;
                damage += obj.dmg || 35;
                break;
            }
            if (damage < 100) return false;
            sc.bullHitType("velocity hit");
            return true;
        }

        /* ---- Dynamic one tick (Falcon OneTicker) ----
           Needs a diamond+ polearm or ruby+ katana, turret gear and primary
           reloaded, 195-265 px to the enemy and a clear line for the turret.
           Simulates both players two ticks ahead and picks how to move on each
           tick (toward / stop / away) so tick 1's turret shot and tick 2's bull
           hit both land; adds spikes the knockback would push them into and
           only fires when the total kills. */
        function roboticsTurretLineClear(target) {
            for (let i = 0; i < AF.length; i++) {
                const obj = AF[i];
                if (obj.ignoreCollision || !(obj.layer >= 1)) continue;
                const s = obj.getScale();
                if (s4.lineInRect(obj.x - s, obj.y - s, obj.x + s, obj.y + s, Ai.x2, Ai.y2, target.x2, target.y2)) return false;
            }
            return true;
        }

        function roboticsOneTickPlan() {
            if (!Ad.length || AQ.sid === undefined || sc.isTrue || sV.active || Ai.inTrap || Ai.tailIndex == 11 || !Ai.skins[53] || !Ai.skins[7]) return null;
            const weapon = Ai.weapons[0];
            const variant = Ai.primaryVariant || 0;
            if (!(weapon == 5 && variant >= 2) && !(weapon == 4 && variant >= 3)) return null;
            if (Ai.reloads[weapon] > 0 || Ai.reloads[53] > fU.tickRate) return null;

            const dist = s4.getDistance(Ai.x2, Ai.y2, AQ.x2, AQ.y2);
            if (dist < 195 || dist > 265 || !roboticsTurretLineClear(AQ)) return null;

            const moves = [0, null, Math.PI];
            const minDistSq = 204 * 204;
            const enemyAngle = AQ.aim2;
            const enemyMove = !isFinite(AQ.x3) || s4.getDistance(AQ.x2, AQ.y2, AQ.x3, AQ.y3) <= Math.sqrt(3) ? null : Math.atan2(AQ.y3 - AQ.y2, AQ.x3 - AQ.x2);

            let enemyState = roboticsSim.simTick(roboticsSim.state(AQ), enemyMove);
            const me = roboticsSim.state(Ai);
            me.skinIndex = 53;

            let first = null;
            for (let i = 0; i < moves.length; i++) {
                const dir = moves[i] === null ? null : enemyAngle + moves[i];
                const state = roboticsSim.simTick(me, dir);
                const dx = state.x - enemyState.x;
                const dy = state.y - enemyState.y;
                if (dx * dx + dy * dy <= minDistSq) continue;
                first = { dir, state };
                break;
            }
            if (!first) return null;

            first.state.skinIndex = 7;
            first.state.weaponIndex = weapon;
            enemyState = roboticsSim.simTick(enemyState, enemyMove);
            const secondAngle = Math.atan2(enemyState.y - first.state.y, enemyState.x - first.state.x);
            const range = s5.weapons[weapon].range;

            let second = null;
            for (let i = 0; i < moves.length; i++) {
                const dir = moves[i] === null ? null : secondAngle + moves[i];
                const state = roboticsSim.simTick(first.state, dir);
                if (!roboticsInCombatRange(state, enemyState, range - 2)) continue;
                second = { dir, state };
                break;
            }
            if (!second) return null;

            let total = 25 + roboticsWeaponDamage(weapon, variant) * 1.5;
            const myTurnFirst = (Ai.updateOrder || 0) < (AQ.updateOrder || 0);
            const knock = roboticsSim.simulate(Object.assign({}, enemyState), [[{
                type: "knockback",
                pos: { x: second.state.x, y: second.state.y },
                knockPower: (s5.weapons[weapon].knock || 0) + 0.3,
                dontUse: !myTurnFirst
            }]], 1);
            if (!AQ.inTrap) total += knock.spikesHit * 35;
            if (!fu.oneTickIgnoreHats) {
                if (AQ.skinIndex == 6) total *= 0.75;
                if (AQ.skinIndex == 22) total -= 25;
            }
            if (total < 100) return null;
            return { firstDir: first.dir, secondDir: second.dir };
        }

        /* ---- Falcon attack modules ----
           Each checks the nearest enemy (AQ) once per tick and starts a
           sequence on sc when it passes. roboticsFalconAttacks() tries them in
           priority order and runs at most one per tick. Knockback checks use
           the movement simulator: "kills" means it one-ticks them, pit-traps
           them or bounces them into 3+ spikes, as in Falcon. */
        function roboticsKnockPower(weaponId) {
            const weapon = s5.weapons[weaponId];
            return (weapon && weapon.knock || 0) + 0.3;
        }
        function roboticsNextPos(player) {
            return { x: isFinite(player.x3) ? player.x3 : player.x2, y: isFinite(player.y3) ? player.y3 : player.y2 };
        }
        function roboticsTurretReady() {
            return !!Ai.skins[53] && !(Ai.reloads[53] > fU.tickRate);
        }
        function roboticsSecondaryReady() {
            const weapon = Ai.weapons[1];
            return weapon !== undefined && !(Ai.reloads[weapon] > 0);
        }
        // Server update order: players earlier in the list move first, so your hit's knockback lands this tick.
        function roboticsMeFirst(enemy) {
            return (Ai.updateOrder || 0) < (enemy.updateOrder || 0);
        }
        function roboticsInRangeOf(enemy, weaponId, pad) {
            const weapon = s5.weapons[weaponId];
            return !!weapon && roboticsInCombatRange({ x: Ai.x2, y: Ai.y2 }, { x: enemy.x2, y: enemy.y2 }, weapon.range - (pad || 0));
        }
        // Hat-only moves (no bull hit needed); never over a forced soldier / anti-insta hat.
        function roboticsCanGearMove() {
            return Ad.length && AQ.sid !== undefined && !sc.isTrue && !sc.ticking && !sV.active && AW.anti0Tick <= 0 && !AW.forceStop && !Ai.empAnti && !Ai.soldierAnti && !Ai.antiTurretSpam;
        }
        function roboticsKnockbackKills(res) {
            return res.oneTicked || res.pitTrapped || res.spikesHit >= 3;
        }

        /* Knockback Hits (Falcon AutoAttacker): bull hit when its knockback
           bounces the enemy into 3+ spikes or kills them. */
        function roboticsKnockbackHit() {
            if (!fu.knockbackHits || !roboticsCanBullHit() || !roboticsPrimaryReady() || AQ.inTrap) return false;
            const weapon = Ai.weapons[0];
            if (!roboticsInRangeOf(AQ, weapon)) return false;
            const knock = { type: "knockback", pos: { x: Ai.x2, y: Ai.y2 }, knockPower: roboticsKnockPower(weapon) };
            const actions = [[{ type: "damage", damage: roboticsWeaponDamage(weapon, Ai.primaryVariant) * 1.5 }], []];
            actions[roboticsMeFirst(AQ) ? 0 : 1].push(knock);
            if (!roboticsKnockbackKills(roboticsSim.simulate(roboticsSim.state(AQ), actions, 2))) return false;
            sc.bullHitType("knockback hit");
            return true;
        }

        /* Knockback Instakills (Falcon AutoInstakiller): a two-hit insta with
           turret gear, only when the simulated knockback ends on a spike (or a
           one tick / pit trap). Great hammer or an enemy in spike gear means
           reverse order. Needs a great hammer or a ranged secondary. */
        function roboticsKnockbackInsta() {
            if (!fu.knockbackInsta || !roboticsCanBullHit() || AQ.inTrap) return false;
            if (Ai.inTrap && !fu.knockbackInstaInTrap) return false;
            const primary = Ai.weapons[0];
            const secondary = Ai.weapons[1];
            if (secondary === undefined || primary === 0) return false;
            if (!roboticsPrimaryReady() || !roboticsSecondaryReady() || !roboticsTurretReady()) return false;
            const hammer = secondary === 10;
            if (!hammer && s5.weapons[secondary].projectile === undefined) return false;
            if (!roboticsInRangeOf(AQ, hammer ? secondary : primary, 1)) return false;

            const reverse = hammer || AQ.skinIndex == 11;
            const first = roboticsMeFirst(AQ);
            const here = { x: Ai.x2, y: Ai.y2 };
            const next = roboticsNextPos(Ai);
            const primaryHit = { type: "damage", damage: roboticsWeaponDamage(primary, Ai.primaryVariant) * 1.5 };
            const secondaryHit = { type: "damage", damage: roboticsWeaponDamage(secondary, Ai.secondaryVariant) };
            const turretHit = { type: "damage", damage: 25 };
            const actions = [[], [], []];
            if (reverse) {
                actions[0].push(turretHit, secondaryHit);
                actions[first ? 0 : 1].push({ type: "knockback", pos: here, knockPower: roboticsKnockPower(secondary) });
                actions[1].push({ type: "knockback", pos: here, knockPower: 0.3 }, primaryHit);
                actions[first ? 1 : 2].push({ type: "knockback", pos: next, knockPower: roboticsKnockPower(primary) });
            } else {
                actions[0].push(primaryHit);
                actions[first ? 0 : 1].push({ type: "knockback", pos: here, knockPower: roboticsKnockPower(primary) });
                actions[1].push(turretHit, secondaryHit);
                actions[2].push({ type: "knockback", pos: next, knockPower: 0.3 });
                actions[first ? 1 : 2].push({ type: "knockback", pos: next, knockPower: roboticsKnockPower(secondary) });
            }
            const res = roboticsSim.simulate(roboticsSim.state(AQ), actions, 2);
            const spikesNeeded = roboticsWeaponDamage(primary, Ai.primaryVariant) <= 25 ? 1 : 0;
            if (!(res.spikesHit > spikesNeeded || res.oneTicked || res.pitTrapped)) return false;
            sc.knockbackInstaType(reverse, reverse ? "reverse knockback insta" : "knockback insta");
            return true;
        }

        /* Auto Push Strikes (Falcon AutoPushStriker): while auto push shoves a
           trapped enemy into a spike, hit them. Per primary:
           daggers: Shame Strike (turret gear + daggers once their shame count
           reaches the threshold) or Bullspam; polearm/katana: Predictive
           (learns when this enemy puts on tank gear after reloading and hits
           one tick before) or Bullspam; others: Bullspam (bull hit whenever
           reloaded and they're on the spike). */
        let roboticsPredictive = { attacked: null };
        function roboticsTankRow(enemy, weapon) {
            if (!enemy.tankHits) enemy.tankHits = [];
            if (!enemy.tankHits[weapon]) enemy.tankHits[weapon] = new Array(16).fill(0);
            return enemy.tankHits[weapon];
        }
        function roboticsPushTouch(spike) {
            const scale = spike.scale + 35.8;
            const next = roboticsNextPos(AQ);
            return {
                scale,
                now: s4.getDistance(AQ.x2, AQ.y2, spike.x, spike.y) <= scale,
                next: s4.getDistance(next.x, next.y, spike.x, spike.y) <= scale - 0.8
            };
        }
        function roboticsPushStrikeMethod() {
            const primary = Ai.weapons[0];
            if (primary === 7) return fl.pushStrikeDagger || "shame";
            if (primary === 4 || primary === 5) return fl.pushStrikeHighDamage || "predictive";
            return fl.pushStrikeGeneric || "bullspam";
        }
        // Every tick: score the last predictive strike, and learn tank gear timing while pushing.
        function roboticsPredictiveUpdate() {
            const last = roboticsPredictive.attacked;
            if (last) {
                // Still visible = it didn't kill, so that timing was wrong.
                roboticsTankRow(last.enemy, last.weapon)[last.dt] += last.enemy.visible ? -1 : 1;
                roboticsPredictive.attacked = null;
            }
            const spike = AW.pushSpike;
            if (!fu.pushStrikes || !spike || !Ad.length || AQ.sid === undefined) return;
            const touch = roboticsPushTouch(spike);
            if (!touch.now && !touch.next) return;
            if (!roboticsPrimaryReady() || roboticsWeaponDamage(Ai.weapons[0], Ai.primaryVariant) * 1.5 + spike.dmg < 100) return;
            if (AQ.skinIndex == 40 && AQ.lastGatherTick === fU.tick && AQ.weaponIndex !== undefined) {
                const dt = fU.tick - (AQ.weaponIndex < 9 ? AQ.primaryReloadTick : AQ.secondaryReloadTick);
                if (dt >= 0 && dt < 16) roboticsTankRow(AQ, AQ.weaponIndex)[dt]++;
            }
        }
        function roboticsPushStrike() {
            const spike = AW.pushSpike;
            if (!fu.pushStrikes || !spike || !roboticsCanBullHit() || !roboticsPrimaryReady()) return false;
            const primary = Ai.weapons[0];
            const method = roboticsPushStrikeMethod();
            if (method === "off" || primary === 8 || !roboticsInRangeOf(AQ, primary)) return false;
            const touch = roboticsPushTouch(spike);
            const dist = s4.getDistance(AQ.x2, AQ.y2, spike.x, spike.y);

            if (method === "bullspam") {
                if (dist > touch.scale + (Ai.inTrap ? 0 : 10) || AQ.dist2 > 100) return false;
                sc.bullHitType("push strike", primary === 7 && roboticsTurretReady() ? 53 : 7);
                return true;
            }
            if (method === "shame") {
                const threshold = parseInt(fl.pushShameThreshold) || 4;
                if ((AQ.shameCount || 0) < threshold || AQ.skinIndex == 45 || !roboticsTurretReady() || AQ.dist2 > 100 || !touch.now) return false;
                sc.bullHitType("shame strike", 53);
                return true;
            }
            // predictive
            if ((!touch.now && !touch.next) || AQ.weaponIndex === undefined) return false;
            const row = roboticsTankRow(AQ, AQ.weaponIndex);
            let best = -1;
            for (let i = 0; i < row.length; i++) {
                if (row[i] <= 0) {
                    row[i] = 0;
                } else if (best < 0 || row[i] > row[best]) {
                    best = i;
                }
            }
            if (best < 0) return false;
            const dt = fU.tick - (AQ.weaponIndex < 9 ? AQ.primaryReloadTick : AQ.secondaryReloadTick);
            if (dt !== best - 1) return false;
            roboticsPredictive.attacked = { enemy: AQ, weapon: AQ.weaponIndex, dt: best };
            sc.bullHitType("predictive strike");
            return true;
        }

        /* Turret Gear Knockback (Falcon TurretGearKnockbacker): turret gear for
           a tick when its bullet's knockback bounces the enemy into 3+ spikes
           or kills them. Falcon's line-of-sight check was inverted (it only
           fired when the turret could NOT hit); here the line must be clear. */
        function roboticsTurretGearKB() {
            if (!fu.turretGearKB || !roboticsCanGearMove() || !roboticsTurretReady()) return false;
            if (AQ.skinIndex == 22 || AQ.inTrap || roboticsPlacePotential.canPlaceOnMe) return false;
            if (!(AQ.dist2 <= 700) || !roboticsTurretLineClear(AQ)) return false;
            const res = roboticsSim.simulate(roboticsSim.state(AQ), [
                [{ type: "damage", damage: 25 }],
                [{ type: "knockback", pos: roboticsNextPos(Ai), knockPower: 0.3 }]
            ], 2);
            if (!roboticsKnockbackKills(res)) return false;
            sc.gearTickType(53, "turret knockback");
            return true;
        }

        /* Turret Bullet Assist (Falcon TurretAPAssister): turret gear when the
           enemy is trapped, standing still, touching a spike that hurts them,
           took damage this tick and is in one-tick distance (150-310). */
        function roboticsTurretAssist() {
            if (!fu.turretAssist || !roboticsCanGearMove() || !roboticsTurretReady()) return false;
            if (!AQ.inTrap || AQ.skinIndex == 22 || AQ.damagedTick !== fU.tick) return false;
            if (AW.autoPush && !Ai.inTrap) return false;
            if (!(AQ.dist2 >= 150 && AQ.dist2 <= 310) || !roboticsTurretLineClear(AQ)) return false;
            const next = roboticsNextPos(AQ);
            if ((next.x - AQ.x2) ** 2 + (next.y - AQ.y2) ** 2 >= 25) return false;
            const victim = roboticsSim.state(AQ);
            const nearby = roboticsGrid.near(AQ.x2, AQ.y2, 120, roboticsNearTmp);
            let onSpike = false;
            for (let i = 0; i < nearby.length && !onSpike; i++) {
                const obj = nearby[i];
                onSpike = obj.active && !!obj.dmg && !roboticsSim.isTeam(victim, obj) && s4.getDistance(AQ.x2, AQ.y2, obj.x, obj.y) <= obj.scale + 36;
            }
            if (!onSpike) return false;
            sc.gearTickType(53, "turret assist");
            return true;
        }

        /* Barbarian Knockback (Falcon BarbarianKnockbacker): the enemy's melee
           weapon finished reloading this tick and you're in its range, so they
           are about to hit you. Barbarian armor knocks them back 0.6; wear it
           when that bounces them into 3+ spikes or kills them. */
        function roboticsBarbKB() {
            if (!fu.barbKB || !roboticsCanGearMove() || !Ai.skins[26] || AQ.inTrap || roboticsPlacePotential.canPlaceOnMe) return false;
            const weapon = s5.weapons[AQ.weaponIndex];
            if (!weapon || weapon.projectile !== undefined) return false;
            if (!roboticsInCombatRange({ x: AQ.x2, y: AQ.y2 }, { x: Ai.x2, y: Ai.y2 }, weapon.range - 1)) return false;
            const primary = AQ.weaponIndex < 9;
            const reloaded = primary ? AQ.primaryReloaded : AQ.secondaryReloaded;
            const wasReloaded = primary ? AQ.prevPrimaryReloaded : AQ.prevSecondaryReloaded;
            if (!reloaded || wasReloaded) return false;
            const res = roboticsSim.simulate(roboticsSim.state(AQ), [
                [],
                [{ type: "knockback", pos: roboticsNextPos(Ai), knockPower: 0.6 }]
            ], 2);
            if (!roboticsKnockbackKills(res)) return false;
            sc.gearTickType(26, "barbarian knockback");
            return true;
        }

        /* Apple Insta (Falcon AppleInstakiller): you have a great hammer and
           the enemy's trap breaks in one tank-gear hit: break it, then spike
           them and bull hit. Short sword / katana / polearm only unless "Apple
           Insta Low Damage" is on. */
        function roboticsAppleInsta() {
            if (!fu.appleInsta || !roboticsCanBullHit() || !AQ.inTrap || AW.pushSpike) return false;
            if (Ai.inTrap && !fu.appleInstaInTrap) return false;
            const primary = Ai.weapons[0];
            if (Ai.weapons[1] !== 10 || !Ai.skins[40]) return false;
            if (![3, 4, 5].includes(primary) && !fu.appleInstaLowDamage) return false;
            if (!roboticsPrimaryReady() || !roboticsSecondaryReady() || !roboticsInRangeOf(AQ, primary)) return false;
            const trap = AQ.inTrap;
            const hammer = s5.weapons[10];
            const variant = r.weaponVariants[Ai.secondaryVariant] || r.weaponVariants[0];
            if (trap.health > hammer.dmg * variant.val * (hammer.sDmg || 1) * 3.3) return false;
            const next = roboticsNextPos(Ai);
            if (s4.getDistance(next.x, next.y, trap.x, trap.y) > hammer.range - 1 + trap.scale) return false;
            sc.appleInstaType(trap);
            return true;
        }

        /* Melee Sync (Falcon AutoMeleeSyncer): a partner (by SID) and you both
           have primaries reloaded, both reach the same enemy, and both bull hits
           together kill: hit, aimed at the average direction of those enemies. */
        function roboticsMeleeSync() {
            if (!fu.meleeSync || !roboticsCanBullHit() || !roboticsPrimaryReady()) return false;
            const sid = parseInt(fl.meleeSync);
            if (!(sid >= 0) || sid === Ai.sid) return false;
            const partner = AM(sid);
            if (!partner || !partner.visible || partner === Ai || partner.primaryIndex === undefined || !partner.primaryReloaded) return false;
            const mine = roboticsWeaponDamage(Ai.weapons[0], Ai.primaryVariant) * 1.5;
            const theirs = roboticsWeaponDamage(partner.primaryIndex, partner.primaryVariant || 0) * 1.5;
            if (mine + theirs < 100) return false;
            const partnerRange = s5.weapons[partner.primaryIndex].range - 1;
            const me = roboticsNextPos(Ai);
            let ax = 0;
            let ay = 0;
            for (let i = 0; i < Ad.length; i++) {
                const enemy = Ad[i];
                if (enemy.sid === sid || !roboticsInRangeOf(enemy, Ai.weapons[0], 1)) continue;
                if (!roboticsInCombatRange({ x: partner.x2, y: partner.y2 }, { x: enemy.x2, y: enemy.y2 }, partnerRange)) continue;
                const next = roboticsNextPos(enemy);
                const angle = Math.atan2(next.y - me.y, next.x - me.x);
                ax += Math.cos(angle);
                ay += Math.sin(angle);
            }
            if (!ax && !ay) return false;
            sc.bullHitType("melee sync", 7, Math.atan2(ay, ax));
            return true;
        }

        function roboticsFalconAttacks() {
            roboticsPredictiveUpdate();
            return roboticsAntiBullCounter() || roboticsKnockbackInsta() || roboticsAppleInsta() || roboticsVelocityHit() || roboticsProjectileSync() ||
                roboticsMeleeSync() || roboticsKnockbackHit() || roboticsPushStrike() || roboticsTurretAssist() ||
                roboticsBarbKB() || roboticsTurretGearKB();
        }

        /* ---- Spike tick pattern recognition (Falcon DefenseSystem) ----
           Players bait the anti spike tick (soldier / heal when you leave a
           trap or could be knocked into spikes) to farm your shame. After
           currentMax answered threats the next one or two are ignored, and each
           repeat of the pattern lowers currentMax (down to 1). Two calm trap
           exits reset it. A real spike tick that lands in an ignored slot gets
           through: that is Falcon's trade-off. */
        let roboticsPatternRec = {
            max: 3,
            currentMax: 3,
            amount: 0,
            resolve: 0,
            seen: false,
            resetTicks: 0,
            process(reset) {
                if (reset) {
                    if (++this.resetTicks >= 2) {
                        this.amount = 0;
                        this.currentMax = this.max;
                        this.resolve = 0;
                        this.seen = false;
                        this.resetTicks = 0;
                    }
                    return true;
                }
                if (this.currentMax === 1 && Ai.shameCount === 0) return true;
                this.resetTicks = 0;
                if (this.resolve > 0) {
                    this.resolve--;
                    return false;
                }
                if (++this.amount >= this.currentMax) {
                    if (this.seen) {
                        this.currentMax = Math.max(this.currentMax - 1, 1);
                        this.resolve = Math.floor(Math.random() * 2) + 1;
                    } else {
                        this.resolve = 1;
                    }
                    this.amount = 0;
                    this.seen = true;
                }
                return true;
            }
        };
        // Answer this spike tick threat? One decision per threat (consecutive ticks).
        function roboticsSpikeTickRespond() {
            if (!fu.patternRec) return true;
            if (AW.spikeTickEpisode !== fU.tick && AW.spikeTickEpisode !== fU.tick - 1) {
                AW.spikeTickAnswer = roboticsPatternRec.process(false);
            }
            AW.spikeTickEpisode = fU.tick;
            return AW.spikeTickAnswer;
        }
        function roboticsPatternRecTick() {
            const trapped = !!Ai.inTrap;
            if (fu.patternRec && AW.wasTrapped && !trapped && AW.spikeTickEpisode !== fU.tick) {
                roboticsPatternRec.process(true);
            }
            AW.wasTrapped = trapped;
        }

        /* ---- Smart Hats (Falcon HatSystem) ----
           Idle near an enemy, soldier only when it matters. Daggers: when you
           are trapped, or they can break out of their trap in one hit and are
           (about to be) in dagger range. Polearm within 200: when you are
           trapped, can be spiked, under turret fire, near several enemies, or
           their polearm reloads within a tick. Anything else within 200:
           soldier. Otherwise the normal speed / biome hat. */
        function roboticsBuildingDamage(weaponId, variant, skinIndex) {
            const weapon = s5.weapons[weaponId];
            if (!weapon) return 0;
            const v = r.weaponVariants[variant] || r.weaponVariants[0];
            return (weapon.dmg || 0) * v.val * (weapon.sDmg || 1) * (skinIndex == 40 ? 3.3 : 1);
        }
        function roboticsDaggerCanEscape(enemy) {
            const trap = enemy.inTrap;
            if (!trap) return true;
            if (enemy.primaryReloaded && trap.health <= roboticsBuildingDamage(enemy.primaryIndex, enemy.primaryVariant, enemy.skinIndex)) return true;
            return enemy.secondaryIndex === 10 && !!enemy.secondaryReloaded && trap.health <= roboticsBuildingDamage(10, enemy.secondaryVariant, enemy.skinIndex);
        }
        function roboticsNeedSoldier(enemy) {
            if (enemy.primaryIndex === 7) {
                if (Ai.inTrap) return true;
                if (!roboticsDaggerCanEscape(enemy)) return false;
                const range = (s5.weapons[7].range + ROBOTICS_HITBOX) * 1.3;
                const dist = s4.getDistance(Ai.x2, Ai.y2, enemy.x2, enemy.y2);
                if (dist <= range) return true;
                const me = roboticsNextPos(Ai);
                const them = roboticsNextPos(enemy);
                const next = s4.getDistance(me.x, me.y, them.x, them.y);
                return next < dist && next <= range;
            }
            if (!(enemy.dist2 <= 200)) return false;
            if (enemy.primaryIndex === 5) {
                if (Ai.inTrap || roboticsPlacePotential.canPlaceOnMe || Ai.turretThreat > 0) return true;
                let near = 0;
                for (let i = 0; i < Ad.length; i++) {
                    if (Ad[i].dist2 <= 300) near++;
                }
                if (near > 1) return true;
                return !(enemy.reloads && enemy.reloads[5] > fU.tickRate);
            }
            return true;
        }
        function roboticsSmartHat() {
            if (!Ai.inWater && roboticsNeedSoldier(AQ)) {
                et(6, 0);
            } else {
                el(1);
            }
        }

        /* ---- Anti Bull (Falcon AntiBuller), Counter Insta "Falcon" mode ----
           Spike gear (with Corrupt X wings on) when the nearest enemy's short
           sword / katana / polearm just finished reloading (always, with Force
           Anti Bull, when no enemy spikes are within 150 and nobody can spike
           you). Never with 4+ shame, never when the reloaded bull hits around
           you add up to 100. When an enemy hits your spike gear and your bull
           hit now kills them, counter at once. */
        function roboticsAntiBullMode() {
            return fu.antiBullType && fl.antiBullType == "abfalcon";
        }
        function roboticsEnemySpikeNear(range) {
            const nearby = roboticsGrid.near(Ai.x2, Ai.y2, range + 60, roboticsNearTmp);
            for (let i = 0; i < nearby.length; i++) {
                const obj = nearby[i];
                if (!obj.active || !(obj.dmg && !obj.isTeamObject(Ai) || roboticsSim.isCactus(obj))) continue;
                if (s4.getDistance(Ai.x2, Ai.y2, obj.x, obj.y) <= range) return true;
            }
            return false;
        }
        function roboticsAntiBullWanted() {
            if (!roboticsAntiBullMode() || !Ai.skins[11] || Ai.tailIndex != 21 || !Ad.length || AQ.sid === undefined) return false;
            if (Ai.shameCount >= 4 || ![3, 4, 5].includes(Ai.weapons[0]) || roboticsPlacePotential.canPlaceOnMe) return false;
            const force = fu.forceAntiBull && !roboticsEnemySpikeNear(150);
            let total = 0;
            let consider = false;
            for (let i = 0; i < Ad.length; i++) {
                const enemy = Ad[i];
                if (!(enemy.dist2 <= 300) || !enemy.primaryReloaded || enemy.primaryIndex === undefined) continue;
                if (enemy === AQ && [3, 4, 5].includes(enemy.primaryIndex) && (force || !enemy.prevPrimaryReloaded)) consider = true;
                total += roboticsWeaponDamage(enemy.primaryIndex, enemy.primaryVariant || 0) * 1.5;
            }
            return consider && total < 100;
        }
        /* Falcon's kill estimate added the enemy's own hit and a raw 0.25 for
           the wings; the enemy's health after the reflection already holds it. */
        function roboticsAntiBullCounter() {
            if (!roboticsAntiBullMode() || !roboticsCanBullHit() || !roboticsPrimaryReady()) return false;
            if (Ai.skinIndex != 11 || Ai.damagedTick !== fU.tick || AQ.damagedTick !== fU.tick) return false;
            if (Ai.shameCount >= 4 || ![3, 4, 5].includes(Ai.weapons[0]) || !roboticsInRangeOf(AQ, Ai.weapons[0])) return false;
            const hit = roboticsWeaponDamage(Ai.weapons[0], Ai.primaryVariant) * 1.5 * (AQ.skinIndex == 6 ? 0.75 : 1);
            if (hit < AQ.health) return false;
            sc.bullHitType("anti bull");
            return true;
        }

        /* Graded Auto Place (Falcon AutoPlacer): with Auto Placer on, places
           the 4 best graded spikes/traps each tick (every other tick with Two
           Tick Placements) while an enemy is within Auto Place Range. */
        function roboticsGradedAutoPlace() {
            const range = Math.min(1200, Math.max(100, parseInt(fl.autoPlaceRange) || 400));
            const enemies = Ad.filter(enemy => enemy.dist2 <= range);
            if (!enemies.length || fu.twoTickPlacements && fU.tick % 2) return;
            const best = roboticsAngles.findPlacements([2, 4], enemies, roboticsAngles.levelBudget(), 4);
            for (let i = 0; i < best.length; i++) {
                if (!ev(best[i].slot, best[i].angle)) break;
            }
        }

        // Modules that read the placement potential (added with them).
        const roboticsPlacePotentialUsers = ["turretGearKB", "barbKB", "smartHats", "antiBullType"];
        function roboticsPlacePotentialWanted() {
            for (let i = 0; i < roboticsPlacePotentialUsers.length; i++) {
                if (fu[roboticsPlacePotentialUsers[i]]) return true;
            }
            return false;
        }
        /* ---- Enemy placement potential (Falcon PlayerPlacementManager) ----
           Where each nearby enemy could put a spike next tick (free angles
           around them, sampled). canPlaceOnMe: one of those spots touches you.
           Used by the graders and to skip moves that would get you spiked. */
        let roboticsPlacePotential = {
            canPlaceOnMe: false,
            range: 0,
            objectScale: 0,
            update() {
                this.canPlaceOnMe = false;
                if (!roboticsPlacePotentialWanted()) {
                    for (let i = 0; i < Ad.length; i++) {
                        Ad[i].placeOnMe = 0;
                    }
                    return;
                }
                const item = s5.list[9];
                const offset = 35 + item.scale + (item.placeOffset || 0);
                this.range = offset;
                this.objectScale = item.scale;
                for (let i = 0; i < Ad.length; i++) {
                    const enemy = Ad[i];
                    if (!enemy.placeAll) enemy.placeAll = [];
                    enemy.placeAll.length = 0;
                    enemy.placeOnMe = 0;
                    if (!(enemy.dist2 <= 400)) continue;
                    const raw = [];
                    const nearby = roboticsGrid.near(enemy.x2, enemy.y2, 300, roboticsNearTmp);
                    for (let j = 0; j < nearby.length; j++) {
                        if (nearby[j].active) roboticsAngles.pushInterval(enemy.x2, enemy.y2, nearby[j], item, raw, false, -0.05);
                    }
                    roboticsAngles.river.x = enemy.x2;
                    roboticsAngles.pushInterval(enemy.x2, enemy.y2, roboticsAngles.river, item, raw, false, -0.05);
                    const free = roboticsAngles.subtract([[0, Math.PI * 2]], roboticsAngles.merge(raw));
                    const angles = roboticsAngles.sample(free, 24);
                    for (let j = 0; j < angles.length; j++) {
                        const x = enemy.x2 + Math.cos(angles[j]) * offset;
                        const y = enemy.y2 + Math.sin(angles[j]) * offset;
                        enemy.placeAll.push({ x, y });
                        if (s4.getDistance(x, y, Ai.x2, Ai.y2) <= 35 + item.scale) {
                            enemy.placeOnMe++;
                            this.canPlaceOnMe = true;
                        }
                    }
                }
            }
        };

        /* ---- Graded placement (Falcon AngleFinder + AngleGrader) ----
           Free placement angles are computed exactly (law of cosines) against
           every nearby object and the river; for preplacing, the angles an
           about-to-break object covers become candidates. Candidates are sampled
           and graded (alignment with the breaking object, spikes/traps near the
           enemy, whether the enemy would be bounced into spikes, trapped or
           teleported) and the best one is used. */
        let roboticsAngles = {
            budget: 58,
            river: { x: 0, y: r.mapScale / 2, scale: r.riverWidth / 2, river: true, sid: -2 },

            pushInterval(px, py, obj, item, out, isPreplace, pad) {
                const itemScale = item.scale;
                const place = 35 + itemScale + (item.placeOffset || 0);
                const objScale = (obj.river ? obj.scale : obj.blocker ? obj.blocker : obj.getScale(0.6, obj.isItem)) + (pad === undefined ? 0.01 : pad);
                const total = itemScale + objScale;
                const dx = obj.x - px;
                const dy = obj.y - py;
                const distSq = dx * dx + dy * dy;
                const reach = place + total;
                if (distSq > reach * reach) return;

                const insideRiver = obj.river && distSq <= (obj.scale - 20) * (obj.scale - 20);
                const ownTrap = isPreplace && pad === undefined && Ai.inTrap && obj.sid === Ai.inTrap.sid;
                if (ownTrap || obj.blocker && distSq < 270 * 270 || distSq < 400 || insideRiver) {
                    out.push(0, Math.PI * 2);
                    return;
                }
                const dist = Math.sqrt(distSq);
                const cos = Math.max(-1, Math.min(1, (place * place + distSq - total * total) / (2 * dist * place)));
                const half = Math.acos(cos);
                const dir = Math.atan2(dy, dx);
                const start = sr.normalizeAngle(dir - half);
                const end = sr.normalizeAngle(dir + half);
                if (start > end) {
                    out.push(start, Math.PI * 2, 0, end);
                } else {
                    out.push(start, end);
                }
            },

            merge(list) {
                const pairs = [];
                for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
                pairs.sort((a, b) => a[0] - b[0]);
                const merged = [];
                for (const [start, end] of pairs) {
                    const last = merged[merged.length - 1];
                    if (last && start <= last[1]) {
                        last[1] = Math.max(last[1], end);
                    } else {
                        merged.push([start, end]);
                    }
                }
                return merged;
            },

            // Remove every blocked arc from the candidate arcs.
            subtract(arcs, blocked) {
                let result = arcs;
                for (const [bStart, bEnd] of blocked) {
                    const next = [];
                    for (let [start, end] of result) {
                        if (bEnd <= start || bStart >= end) {
                            next.push([start, end]);
                        } else if (bStart <= start && bEnd >= end) {
                            continue;
                        } else if (bStart > start && bEnd < end) {
                            next.push([start, bStart], [bEnd, end]);
                        } else {
                            if (bStart <= start) start = bEnd;
                            else end = bStart;
                            if (end > start) next.push([start, end]);
                        }
                    }
                    result = next;
                }
                return result;
            },

            sample(arcs, budget) {
                let width = 0;
                for (const [start, end] of arcs) width += end - start;
                const angles = [];
                if (width <= 0) return angles;
                for (const [start, end] of arcs) {
                    const count = (end - start) / width * budget | 0;
                    if (count <= 0) continue;
                    if (count === 1) {
                        angles.push((start + end) / 2);
                    } else {
                        const step = (end - start) / (count - 1);
                        for (let i = 0; i < count; i++) angles.push(start + step * i);
                    }
                }
                return angles;
            },

            // Spikes/traps near the candidate that would hurt or trap this enemy.
            countNear(candidate, enemy, breaking) {
                const counts = { traps: 0, spikes: 0 };
                const nearby = roboticsGrid.near(candidate.x, candidate.y, 150, roboticsNearTmp);
                const victim = roboticsSim.state(enemy);
                for (let i = 0; i < nearby.length; i++) {
                    const obj = nearby[i];
                    if (!obj.active || breaking.has(obj)) continue;
                    const isTeam = roboticsSim.isTeam(victim, obj);
                    const isSpike = roboticsSim.isCactus(obj) || obj.dmg && !isTeam;
                    const isTrap = obj.trap && !isTeam;
                    if (!isSpike && !isTrap) continue;
                    if (s4.getDistance(candidate.x, candidate.y, obj.x, obj.y) > 15 + candidate.scale + obj.scale) continue;
                    if (isSpike) counts.spikes++;
                    else counts.traps++;
                }
                return counts;
            },

            gradeSpike(candidate, enemy, near, myNext, breaking) {
                const enemyTrapped = enemy.inTrap && enemy.inTrap.active && !breaking.has(enemy.inTrap);
                // Don't spike the square you are about to walk into.
                if (myNext && s4.getDistance(myNext.x, myNext.y, candidate.x, candidate.y) <= candidate.scale + 35) {
                    candidate.grade -= near.traps > 0 && enemyTrapped ? 4 : 2.5;
                }
                if (near.traps) candidate.grade += 0.5;
                candidate.grade += near.traps;

                const dist = s4.getDistance(enemy.x2, enemy.y2, candidate.x, candidate.y);
                if (enemyTrapped && dist <= 150) candidate.grade += 0.5;
                if (dist >= candidate.scale + 34.5) return;
                if (enemyTrapped) {
                    candidate.grade += 2;
                    return;
                }

                // Would placing it bounce them into spikes, trap them or teleport them?
                const sim = roboticsSim.simulate(roboticsSim.state(enemy), [[{
                    type: "place", x: candidate.x, y: candidate.y, id: candidate.id, ownerSid: Ai.sid
                }]], 1, enemy.inTrap ? enemy.inTrap.sid : -1);
                if (sim.teleported) {
                    candidate.dontUse = true;
                    return;
                }
                if (sim.pitTrapped || sim.oneTicked) candidate.grade += 3;
                if (sim.totalDamage > 133) candidate.grade += 0.25;
                if (sim.spikesHit > 1) {
                    candidate.grade += (sim.spikesHit - 1) * 0.5;
                    if (sim.spikesHit > 2) candidate.grade += 0.5;
                }
                if (sim.trapped && !enemyTrapped) {
                    candidate.grade += 1.5;
                    const goldHammerDamage = 7.5 * 3.3 * 10 * 1.1;
                    const aroundTrap = roboticsGrid.near(sim.trap.x, sim.trap.y, 200, roboticsNearTmp);
                    const victim = roboticsSim.state(enemy);
                    for (let i = 0; i < aroundTrap.length; i++) {
                        const obj = aroundTrap[i];
                        if (!obj.active || obj === sim.trap) continue;
                        if (s4.getDistance(sim.trap.x, sim.trap.y, obj.x, obj.y) > 70 + obj.scale) continue;
                        const isEnemyObj = !roboticsSim.isTeam(victim, obj);
                        const isSpike = isEnemyObj && obj.dmg;
                        const isTrap = isEnemyObj && obj.trap;
                        if ((isSpike || isTrap) && obj.health <= goldHammerDamage) continue;
                        if (isSpike || roboticsSim.isCactus(obj)) candidate.grade += 0.5;
                        if (isTrap) candidate.grade += 0.25;
                        if (obj.teleport) candidate.grade -= 1;
                    }
                    candidate.grade += !Ai.inTrap || breaking.has(Ai.inTrap) ? 0.5 : -1;
                }
            },

            gradeTrap(candidate, enemy, breaking) {
                if (!enemy.inTrap || !enemy.inTrap.active || breaking.has(enemy.inTrap)) {
                    candidate.grade += 0.5;
                    if (enemy.lastTrap) candidate.grade += 0.5;
                }
                const distSq = (enemy.x2 - candidate.x) ** 2 + (enemy.y2 - candidate.y) ** 2;
                if (distSq < 49 * 49) candidate.grade++;
                if (distSq < 20 * 20) candidate.grade += 0.5;
            },

            grade(candidate, enemies, breaking, myNext) {
                // Preplaced items should sit where exactly one breaking object is.
                candidate.grade += 1;
                let overlapping = null;
                let count = 0;
                for (const obj of breaking) {
                    if (s4.getDistance(candidate.x, candidate.y, obj.x, obj.y) > obj.scale + candidate.scale) continue;
                    overlapping = obj;
                    if (++count >= 2) {
                        candidate.dontUse = true;
                        return;
                    }
                }
                if (overlapping) {
                    const dir = Math.atan2(overlapping.y - candidate.y, overlapping.x - candidate.x);
                    const dist = s4.getDistance(overlapping.x, overlapping.y, candidate.x, candidate.y);
                    candidate.grade += 1.5 * (1 - s4.getAngleDist(dir, candidate.angle) / Math.PI);
                    candidate.grade += 1.5 * (1 - dist / (overlapping.scale + candidate.scale));
                }
                for (let i = 0; i < enemies.length; i++) {
                    const enemy = enemies[i];
                    if (candidate.isTrap) {
                        this.gradeTrap(candidate, enemy, breaking);
                    } else {
                        this.gradeSpike(candidate, enemy, this.countNear(candidate, enemy, breaking), myNext, breaking);
                    }
                    if (candidate.dontUse) return;
                }
            },

            // Candidates per item, from Falcon's angle finder level (1-10).
            levelBudget() {
                const level = Math.min(10, Math.max(1, parseInt(fl.angleFinderLevel) || 7));
                return 16 + (level - 1) * 6;
            },

            /* Graded auto place / replace (Falcon AutoPlacer, AutoReplacer): the
               best `count` spots that don't overlap each other, for item slots
               (2 = spike, 4 = trap), graded against `enemies`. With `broken` (an
               object that just broke) only the angles it covered are candidates,
               graded on alignment with it as for preplacing. */
            findPlacements(slots, enemies, budget, count, broken) {
                if (!Ai || !enemies.length) return [];
                const px = Ai.x2;
                const py = Ai.y2;
                const objects = roboticsGrid.near(px, py, 350, []).filter(obj => obj.active && obj !== broken);
                const breaking = new Set();
                if (broken) breaking.add(broken);
                const myNext = roboticsSim.simTick(roboticsSim.state(Ai), Ai.moveDir);
                this.river.x = px;
                const candidates = [];

                for (const slot of slots) {
                    const item = s5.list[Ai.items[slot]];
                    if (!item || slot === 4 && item.id !== 15) continue;
                    const raw = [];
                    for (const obj of objects) this.pushInterval(px, py, obj, item, raw, false);
                    this.pushInterval(px, py, this.river, item, raw, false);
                    let arcs;
                    if (broken) {
                        const open = [];
                        this.pushInterval(px, py, broken, item, open, true);
                        arcs = this.subtract(this.merge(open), this.merge(raw));
                    } else {
                        arcs = this.subtract([[0, Math.PI * 2]], this.merge(raw));
                    }
                    const offset = 35 + item.scale + (item.placeOffset || 0);
                    for (const angle of this.sample(arcs, budget)) {
                        const candidate = {
                            slot, angle, id: item.id, scale: item.scale, isTrap: item.id === 15,
                            x: px + Math.cos(angle) * offset, y: py + Math.sin(angle) * offset,
                            grade: 0, dontUse: false
                        };
                        this.grade(candidate, enemies, breaking, myNext);
                        if (!candidate.dontUse) candidates.push(candidate);
                    }
                }
                candidates.sort((a, b) => b.grade - a.grade || b.isTrap - a.isTrap);
                const best = [];
                for (let i = 0; i < candidates.length && best.length < count; i++) {
                    const c = candidates[i];
                    let overlaps = false;
                    for (let j = 0; j < best.length && !overlaps; j++) {
                        overlaps = s4.getDistance(c.x, c.y, best[j].x, best[j].y) < c.scale + best[j].scale;
                    }
                    if (!overlaps) best.push(c);
                }
                return best;
            },

            /* Best preplace spot for the given item slots (2 = spike, 4 = trap),
               or null. Only objects that s6.canBeBroken() says break this tick
               open up candidate angles. */
            findPreplace(slots) {
                if (!Ai || !Ad.length) return null;
                const px = Ai.x2;
                const py = Ai.y2;
                const nx = isFinite(Ai.x3) ? Ai.x3 : px;
                const ny = isFinite(Ai.y3) ? Ai.y3 : py;
                const objects = roboticsGrid.near(px, py, 350, []).filter(obj => obj.active);
                const breaking = new Set();
                for (const obj of objects) {
                    // Same objects the old preplacer considered: your own hidden traps only when being broken on purpose.
                    if (!obj.isItem || s4.getDistance(px, py, obj.x, obj.y) > 200) continue;
                    if (obj.isTeamObject(Ai) && obj.hideFromEnemy && !sV.priority[1].includes(obj)) continue;
                    if (s6.canBeBroken(obj)) breaking.add(obj);
                }
                if (!breaking.size) return null;

                const enemies = Ad.filter(enemy => enemy.dist2 <= 400);
                const myNext = roboticsSim.simTick(roboticsSim.state(Ai), Ai.moveDir);
                this.river.x = px;
                let best = null;

                for (const slot of slots) {
                    const item = s5.list[Ai.items[slot]];
                    if (!item || slot === 4 && item.id !== 15) continue;
                    const raw = [];
                    const open = [];
                    for (const obj of objects) {
                        if (breaking.has(obj)) {
                            this.pushInterval(nx, ny, obj, item, open, true);
                        } else {
                            this.pushInterval(px, py, obj, item, raw, false);
                        }
                    }
                    this.pushInterval(px, py, this.river, item, raw, false);
                    const arcs = this.subtract(this.merge(open), this.merge(raw));
                    const offset = 35 + item.scale + (item.placeOffset || 0);

                    for (const angle of this.sample(arcs, this.budget)) {
                        const candidate = {
                            slot, angle, id: item.id, scale: item.scale, isTrap: item.id === 15,
                            x: px + Math.cos(angle) * offset, y: py + Math.sin(angle) * offset,
                            grade: 0, dontUse: false
                        };
                        this.grade(candidate, enemies, breaking, myNext);
                        if (!candidate.dontUse && (!best || candidate.grade > best.grade)) best = candidate;
                    }
                }
                return best;
            }
        };

        function sp(ci) {
            A0("6", ci);
        }
        function sW(ci, cC, cK, cd, ck, cQ, cg, cp, cX) {
            let cW = cQ == 0 ? 9 : cQ == 2 ? 12 : cQ == 3 ? 13 : cQ == 5 && 15;
            let ct = Ai.scale * 2;
            let cn = {
                x: cQ == 1 ? ci : ci - ct * Math.cos(cK),
                y: cQ == 1 ? cC : cC - ct * Math.sin(cK)
            };
            let cz = Ae.filter(cx => cx.visible && s4.getDist(cn, cx, 0, 2) <= cx.scale).sort(function (cx, cM) {
                return s4.getDist(cn, cx, 0, 2) - s4.getDist(cn, cM, 0, 2);
            })[0];
            if (cz) {
                if (cX) {
                    cX.owner = cz;
                }
                if (cQ == 1) {
                    cz.shooting[53] = 1;
                } else {
                    cz.shootIndex = cW;
                    cz.shooting[1] = 1;
                }
                sz(cz, cK, cd, ck, cQ, cW);
            } else {
                let cx = AF.filter(cM => s4.getDist(cn, cM, 0, 0) <= cM.scale).sort((cM, cY) => {
                    return s4.getDist(cn, cM, 0, 0) - s4.getDist(cn, cY, 0, 0);
                })[0];
            }
        }
        let st = 0;
        let sn = {
            count: 0,
            dmg: 0
        };
        function sz(ci, cC, cK, cd, ck, cQ) {
            if (Ai && !ci.isTeam(Ai)) {
                Al = s4.getDirect(Ai, ci, 2, 2);
                if (s4.getAngleDist(Al, cC) <= 0.3) {
                    let cg = false;
                    if (ck == 1) {
                        if (ci.sid == AQ.sid) {
                            sn.count++;
                            sn.dmg += s5.projectiles[ck].dmg;
                            cg = true;
                        }
                    } else {
                        ci.bowThreat[cQ]++;
                        if (ck == 5) {
                            st++;
                        }
                        sn.dmg += s5.projectiles[ck].dmg;
                        sn.count++;
                        cg = true;
                    }
                    // Forget the shot once it has flown its range.
                    if (cg) {
                        fU.tickBase(() => {
                            if (ck != 1) {
                                ci.bowThreat[cQ]--;
                            }
                            if (ck == 5) {
                                st--;
                            }
                            sn.count--;
                            sn.dmg -= s5.projectiles[ck].dmg;
                        }, Math.ceil(cK / cd / fU.tickRate));
                    }
                    if (ci.bowThreat[9] >= 1 && (ci.bowThreat[12] >= 1 || ci.bowThreat[15] >= 1)) {
                        eE(3, ci.aim2);
                        eE(1, ci.aim2);
                        AW.anti0Tick = 4;
                        Ai.chat.message = "anti bow insta by " + ci.sid + " " + ci.name;
                        Ai.chat.count = 445;
                        eO(1);
                    } else if (st >= 2 || sn.count >= 4) {
                        if (Ai.weapons[1] == 11) {
                            ez(Ai.weapons[1]);
                        }
                        eE(3, ci.aim2);
                        eE(1, ci.aim2);
                        AW.anti0Tick = 4;
                        Ai.chat.message = "anti proj sync";
                        Ai.chat.count = 445;
                        eO(2);
                    }
                }
            }
        }
        function sx(ci, cC, cK) {
            if (Ai && ci) {
                s4.removeAllChildren(f5);
                f5.classList.add("visible");
                s4.generateElement({
                    id: "itemInfoName",
                    text: s4.capitalizeFirst(ci.name),
                    parent: f5
                });
                s4.generateElement({
                    id: "itemInfoDesc",
                    text: ci.desc,
                    parent: f5
                });
                if (cK) {} else if (cC) {
                    s4.generateElement({
                        class: "itemInfoReq",
                        text: !ci.type ? "primary" : "secondary",
                        parent: f5
                    });
                } else {
                    for (let cd = 0; cd < ci.req.length; cd += 2) {
                        s4.generateElement({
                            class: "itemInfoReq",
                            html: ci.req[cd] + "<span class='itemInfoReqVal'> x" + ci.req[cd + 1] + "</span>",
                            parent: f5
                        });
                    }
                    if (ci.group.limit) {
                        s4.generateElement({
                            class: "itemInfoLmt",
                            text: (Ai.itemCounts[ci.group.id] || 0) + "/" + (r.isSandbox ? 99 : ci.group.limit),
                            parent: f5
                        });
                    }
                }
            } else {
                f5.classList.remove("visible");
            }
        }
        window.addEventListener("resize", s4.checkTrusted(sM));
        function sM() {
            AS = window.innerWidth;
            Av = window.innerHeight;
            let ci = Math.max(AS / AE, Av / Ab) * AR;
            p.width = AS * AR;
            p.height = Av * AR;
            p.style.width = AS + "px";
            p.style.height = Av + "px";
            fV.setTransform(ci, 0, 0, ci, (AS * AR - AE * ci) / 2, (Av * AR - Ab * ci) / 2);
        }
        sM();
        p = getEl("touch-controls-fullscreen");
        p.addEventListener("mousemove", sY, false);
        function sY(ci) {
            AB = ci.clientX;
            Aw = ci.clientY;
        }
        let so = {
            left: false,
            middle: false,
            right: false
        };
        p.addEventListener("mousedown", sG, false);
        function sG(ci) {
            if (AJ != 1) {
                AJ = 1;
                if (ci.button == 0) {
                    so.left = true;
                } else if (ci.button == 1) {
                    if (AT[16] && Ae.length) {
                        let cC = sR();
                        let cK = Ae.filter(cd => s4.getDist(cd, cC, 2, 0) <= Ai.scale + 69 && cd.sid != Ai.sid).sort((cd, ck) => s4.getDist(cd, cC, 2, 0) - s4.getDist(ck, cC, 2, 0))[0];
                        if (!cK || Ag?.sid == cK.sid) {
                            Ag = undefined;
                        } else {
                            Ag = cK;
                        }
                    } else {
                        so.middle = true;
                    }
                } else if (ci.button == 2) {
                    so.right = true;
                }
            }
        }
        window.addEventListener("mouseup", s4.checkTrusted(sS));
        function sS(ci) {
            if (AJ != 0) {
                AJ = 0;
                if (ci.button == 0) {
                    so.left = false;
                } else if (ci.button == 1) {
                    so.middle = false;
                } else if (ci.button == 2) {
                    so.right = false;
                }
            }
        }
        p.addEventListener("wheel", sv, false);
        function sv(ci) {
            if (ci.deltaY < 0) {
                AW.reSync = true;
            } else {
                AW.reSync = false;
            }
        }
        function sE() {
            let ci = 0;
            let cC = 0;
            for (let cK in Aj) {
                let cd = Aj[cK];
                ci += !!AT[cK] * cd[0];
                cC += !!AT[cK] * cd[1];
            }
            if (ci == 0 && cC == 0) {
                return undefined;
            } else {
                return Math.atan2(cC, ci);
            }
        }
        function sb() {
            return AQ.dist2 <= s5.weapons[Ai.weapons[0]].range + Ai.scale * 1.8;
        }
        function sR() {
            const ci = p.getBoundingClientRect();
            const cC = AB - ci.left;
            const cK = Aw - ci.top;
            const cd = cC / p.width - 0.5;
            const ck = cK / p.height - 0.5;
            let cQ = Aa + cd * AE;
            let cg = Au + ck * Ab;
            return {
                x: cQ,
                y: cg
            };
        }
        function sD() {
            if (!Ai) {
                return 0;
            }
            let ci = sR();
            if (!Ai.lockDir) {
                return s4.getDirect(ci, Ai, 0, 0);
            }
            return e2 || 0;
        }
        function sZ() {
            if (!Ai) {
                return 0;
            }
            if (AW.autoAim) {
                e2 = typeof AW.customAim === "number" ? AW.customAim : fu.weaponGrind ? sD() : Ad.length ? AW.revAim ? AQ.aim2 + Math.PI : AQ.aim2 : sD();
            } else if (sb && so.left) {
                e2 = Ad.length ? AQ.aim2 : sD();
            } else if (so.right) {
                e2 = sD();
            } else if (sV.active && Ai[(sV.useHammer(sV.target) ? "secondary" : "primary") + "Reloaded"]) {
                e2 = sV.aim;
            } else if (!Ai.lockDir) {
                if (fu.renderDir && fl.renderDir == "noDir") {
                    return undefined;
                }
                e2 = sD();
            }
            return e2 || 0;
        }
        function sO() {
            if (!Ai) {
                return 0;
            }
            if (AW.autoAim || sb() && so.left) {
                e2 = typeof AW.customAim === "number" ? AW.customAim : fu.weaponGrind ? sD() : Ad.length ? AW.revAim ? AQ.aim2 + Math.PI : AQ.aim2 : sD();
            } else if (so.right) {
                e2 = sD();
            } else if (sV.active) {
                e2 = sV.aim;
            } else if (!Ai.lockDir) {
                if (fu.renderDir && fl.renderDir == "noDir") {
                    return undefined;
                }
                e2 = sD();
            }
            return e2 || 0;
        }
        function sI() {
            return S.style.display != "block" && ff.style.display != "block" && !fD;
        }
        let sa = {
            help: ["Show Commands", function () {
                for (let ci in sa) {
                    fO("/" + ci, sa[ci][0], "lime", 1);
                }
            }],
            clear: ["Clear Chats", function () {
                fI();
            }],
            debug: ["Debug Mod For Development", function () {
                Vr(Ai);
                fO("Debug", "Done", "#99ee99", 1);
            }],
            play: ["Play Music ( /play [link] )", function (ci) {
                let cC = ci.split(" ");
                if (cC[1]) {
                    let cK = new Audio(cC[1]);
                    cK.play();
                } else {
                    fO("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
                }
            }],
            bye: ["Leave Game", function () {
                // Back to the main page without ?server=, so the close handler's rejoin does not apply.
                window.location.href = window.location.origin + window.location.pathname;
            }]
        };
        function su() {
            let ci = fR.value;
            if (ci != "") {
                let cC = ci.slice(1).split(" ")[0];
                if (ci.startsWith("/") && sa[cC]) {
                    sa[cC][1](ci);
                } else {
                    sp(ci);
                }
                fR.value = "";
                fR.blur();
            } else {
                fR[fD ? "blur" : "focus"]();
            }
        }
        let sl;
        const sB = {
            oneTick: false
        };
        // Keydown actions, keyed by CONFIG.keys (see the top of the file).
        const RK = CONFIG.keys;
        let sw = {};
        const roboticsKeyActions = {
            menu: () => {
                let ci = document.getElementById("modmenus");
                if (ci.classList.contains("open")) {
                    ci.classList.add("closed");
                    ci.classList.remove("open");
                    setTimeout(() => {
                        ci.style.display = "none";
                    }, 400);
                } else {
                    ci.classList.add("open");
                    ci.classList.remove("closed");
                    ci.style.display = "block";
                    setTimeout(() => {
                        document.getElementById("modmenus-sidebar").style.opacity = 1;
                    }, 400);
                }
            },
            markMap: () => {
                rX();
            },
            autoGather: () => {
                AW.userGather = !AW.userGather;
                if (AW.userGather !== eM) {
                    eY();
                }
            },
            selectWeapon: () => {
                ez(Ai.weaponCode);
            },
            spawnPads: () => {
                e1.placeSpawnPads = !e1.placeSpawnPads;
                if (e1.placeSpawnPads) {
                    ss.testCanPlace(Ai.getItemType(20), 0, Math.PI * 1.5, Math.PI / 2, sE() || 0, true);
                    e1.old = {
                        x: Ai.x2,
                        y: Ai.y2
                    };
                }
            },
            autoMill: () => {
                e1.place = !e1.place;
                if (e1.place) {
                    let ci = Ai.items[4] == 16 ? 1.4 : 1.23456789;
                    ss.testCanPlace(3, -ci, ci, ci, (sE() || 0) + Math.PI, true);
                    e1.old = {
                        x: Ai.x2,
                        y: Ai.y2
                    };
                }
            },
            lockDir: () => {
                Ai.lockDir = !Ai.lockDir;
            },
            resetMod: () => {
                window.debug();
            },
            hit: () => {
                A0("F", 1, sD(), 1);
                A0("F", 0, sD(), 1);
            },
            debugChat: () => {
                Ai.sync = true;
                sp(getEl("testInput2").value);
            },
            velocityTick: () => {
                sB.oneTick = !sB.oneTick;
                console.log("vel one tick toggle: ", sB.oneTick);
            },
            pauseAuto: () => {
                A7 = true;
                AW.pauseUntil = fU.tick + Math.round(5000 / fU.tickRate);
            },
            debugMenu: () => {
                eS.style.display = eS.style.display === "none" ? "block" : "none";
            },
            smartAntiInsta: () => roboticsToggleSetting("smartAntiInsta", "Smart Anti-Insta"),
            projectileSync: () => roboticsToggleSetting("projectileSync", "Projectile Sync"),
            velocityHits: () => roboticsToggleSetting("velocityHits", "Velocity Hits"),
            dynamicOneTick: () => roboticsToggleSetting("dynamicOneTick", "Dynamic One Tick"),
            gradedPreplace: () => roboticsToggleSetting("gradedPreplace", "Graded Preplace"),
            artificialPing: () => roboticsToggleSetting("artificialPing", "Artificial Ping"),
            knockbackHits: () => roboticsToggleSetting("knockbackHits", "Knockback Hits"),
            knockbackInsta: () => roboticsToggleSetting("knockbackInsta", "Knockback Instakills"),
            pushStrikes: () => roboticsToggleSetting("pushStrikes", "Auto Push Strikes"),
            turretGearKB: () => roboticsToggleSetting("turretGearKB", "Turret Gear Knockback"),
            turretAssist: () => roboticsToggleSetting("turretAssist", "Turret Bullet Assist"),
            barbKB: () => roboticsToggleSetting("barbKB", "Barbarian Knockback"),
            appleInsta: () => roboticsToggleSetting("appleInsta", "Apple Insta"),
            meleeSync: () => roboticsToggleSetting("meleeSync", "Melee Sync"),
            patternRec: () => roboticsToggleSetting("patternRec", "Pattern Recognition"),
            smartHats: () => roboticsToggleSetting("smartHats", "Smart Hats"),
            gradedAutoPlace: () => roboticsToggleSetting("gradedAutoPlace", "Graded Auto Place")
        };
        for (let ci in roboticsKeyActions) {
            if (RK[ci] && !sw[RK[ci]]) {
                sw[RK[ci]] = roboticsKeyActions[ci];
            }
        }
        function sL(ci) {
            let cC = ci.which || ci.keyCode || 0;
            // Keys typed into a text/number field (menu search, settings) are not commands.
            let cK = ci.target && ci.target.tagName;
            if (cK === "INPUT" || cK === "TEXTAREA" || cK === "SELECT") {
                return;
            }
            if (Ai && Ai.alive && sI()) {
                if (!AT[cC]) {
                    AT[cC] = 1;
                    e0[ci.key] = 1;
                    if (Ai.weapons[cC - 49] != undefined) {
                        Ai.weaponCode = Ai.weapons[cC - 49];
                    } else if (sw[ci.key]) {
                        // e.g. stops Firefox quick-find on "/" and "'"
                        ci.preventDefault();
                        sw[ci.key]();
                    }
                }
            }
        }
        addEventListener("keydown", s4.checkTrusted(sL));
        function sy(ci) {
            if (Ai && Ai.alive) {
                let cC = ci.which || ci.keyCode || 0;
                if (cC == 13) {
                    ci.preventDefault();
                    ci.stopImmediatePropagation();
                    su();
                    eo();
                    e0 = {};
                    AT = {};
                } else if (cC == 27) {
                    fR.blur();
                }
                if (sI()) {
                    if (AT[cC]) {
                        AT[cC] = 0;
                        e0[ci.key] = 0;
                        if (ci.key == RK.debugChat) {
                            Ai.sync = false;
                        } else if (ci.key == RK.song) {
                            Ve();
                        }
                    }
                }
            }
        }
        addEventListener("keyup", s4.checkTrusted(sy), true);
        let sh;
        function sP() {
            if (sc.ticking) {
                return;
            }
            if (fu.playerFollow) {
                // Follow by SID (Falcon): a number in the menu picks the player to follow.
                let ci = parseInt(fl.followSid);
                if (ci >= 0) {
                    let cC = AM(ci);
                    Ag = cC && cC.visible && cC !== Ai ? cC : Ag;
                }
                if (Ag) {
                    if (Ag.dist2 >= (fu.serverSync ? 10 : 135)) {
                        sh = Ag.aim2;
                    } else {
                        sh = undefined;
                    }
                }
            } else {
                sh = sE();
            }
            if (!AW.autoPush && !e0[RK.followPlace]) {
                A0("9", sh, 1);
            }
        }
        let sU = [];
        let sm = [];
        let roboticsActionBar = null;
        const sj = () => {
            // Called every frame by the render loop, which starts before the
            // player object exists (main menu). Without this guard the first
            // frame throws and the whole rAF loop stops.
            if (!Ai) {
                return;
            }
            let ci = s5;
            let cC = Ai;
            // The collection is live, so it is looked up once; each element remembers its index.
            if (!roboticsActionBar) {
                roboticsActionBar = document.getElementsByClassName("actionBarItem");
            }
            for (let cg = 0; cg < roboticsActionBar.length; cg++) {
                let cW = roboticsActionBar[cg];
                if (cW.style.display !== "inline-block") {
                    continue;
                }
                if (cW.roboticsIndex === undefined) {
                    cW.roboticsIndex = Number(cW.id.split("Item")[1]);
                }
                let cp = cW.roboticsIndex;
                let ct;
                let cn;
                if (cp >= 19) {
                    let cz = ci.list[cp - 16];
                    ct = r.isSandbox ? 299 : cz.group.limit;
                    cn = Math.min(ct, cC.itemCounts[cp - 18] || 0);
                } else if (cp <= 15) {
                    let cx = cC.reloads[cp] == 0 ? ci.weapons[cp].speed : cC.reloads[cp];
                    ct = ci.weapons[cp].speed;
                    cn = cx;
                } else {
                    ct = 8;
                    cn = cC.shameCount;
                }
                if (cn > 0 || cp <= 18) {
                    let cM = sm[cp];
                    if (!cM) {
                        cM = sm[cp] = document.createElement("canvas");
                        cM.id = "itemCount" + cp;
                        cM.classList.add("animated-progress");
                        cM.style.height = "66px";
                        cW.appendChild(cM);
                        cM.getContext("2d").translate(68, 66);
                    }
                    sJ(cM.getContext("2d"), ct, cn, cp <= 15, cp);
                }
            }
        };
        function sJ(ci, cC, cK, cd, ck) {
            let cQ = s5;
            let cg = Ai;
            ci.clearRect(-100, -100, 1000, 1000);
            if (cd) {
                let cp = {
                    primary: cg.primaryIndex === undefined ? 1 : (cQ.weapons[cg.primaryIndex].speed - cg.reloads[cg.primaryIndex]) / cQ.weapons[cg.primaryIndex].speed,
                    secondary: cg.secondaryIndex === undefined ? 1 : (cQ.weapons[cg.secondaryIndex].speed - cg.reloads[cg.secondaryIndex]) / cQ.weapons[cg.secondaryIndex].speed
                };
                if (!cg.currentReloads) {
                    cg.currentReloads = {
                        primary: cp.primary,
                        secondary: cp.secondary
                    };
                }
                const cW = 0.1;
                cg.currentReloads.primary = (1 - cW) * cg.currentReloads.primary + cW * cp.primary;
                cg.currentReloads.secondary = (1 - cW) * cg.currentReloads.secondary + cW * cp.secondary;
                let ct = ck;
                let cn = ct == cg.primaryIndex;
                if (cg.reloads[ct] != 0) {
                    ci.beginPath();
                    ci.lineWidth = 10;
                    ci.strokeStyle = "#FFFFFF";
                    ci.arc(10, 10, 60, 0, Math.PI * 2 * (cn ? cg.currentReloads.primary : cg.currentReloads.secondary) * -1);
                    ci.stroke();
                }
            } else {
                ci.beginPath();
                ci.lineWidth = 10;
                ci.strokeStyle = "#FFFFFF";
                ci.arc(0, 0, 60, 0, Math.PI * 2 * (cK / cC));
                ci.stroke();
            }
        }
        function sX(ci = undefined) {
            for (let cC = 3; cC < s5.list.length; ++cC) {
                let cK = s5.list[cC].group.id;
                let cd = s5.weapons.length + cC;
                if (!sU[cd]) {
                    sU[cd] = document.createElement("div");
                    sU[cd].id = "itemCount" + cd;
                    getEl("actionBarItem" + cd).appendChild(sU[cd]);
                    sU[cd].style = "\n                        display: block;\n                        position: absolute;\n                        padding-left: 27px;\n                        font-size: 1em;\n                        color: #fff;\n                        ";
                    sU[cd].innerHTML = Ai.itemCounts[cK] || 0;
                } else if (ci == cK) {
                    sU[cd].innerHTML = Ai.itemCounts[ci] || 0;
                }
            }
        }
        function V0(ci) {
            const cC = Ai.scale + ci.getScale();
            const cK = Math.cos(Ai.moveDir);
            const cd = Math.sin(Ai.moveDir);
            const ck = ci.x - Ai.x2;
            const cQ = ci.y - Ai.y2;
            let cg = ck * cK + cQ * cd;
            if (cg <= 0 || cg > 169) {
                return false;
            }
            const cp = Ai.x2 + cg * cK;
            const cW = Ai.y2 + cg * cd;
            const ct = s4.getDistance(cp, cW, ci.x, ci.y);
            return ct <= cC;
        }
        /* Safe walk also stops you walking onto boost pads and teleporters
           (Falcon). Your own teleporters and your allies' boost pads are fine
           unless "Avoid My Teleporters" / "Avoid Ally Boost Pads" are on. */
        function roboticsSafeWalkPad() {
            if (Ai.moveDir == undefined) {
                return null;
            }
            for (let ci = 0; ci < AF.length; ci++) {
                let cC = AF[ci];
                if (!cC.teleport && !cC.boostSpeed) {
                    continue;
                }
                let cK = cC.isTeamObject(Ai);
                if (cC.teleport && cK && !fu.safeWalkAvoidMyTps || cC.boostSpeed && cK && !fu.safeWalkAvoidAllyPads) {
                    continue;
                }
                if (V0(cC) && s4.getDist(Ai, cC, 3, 0) <= cC.getScale() + 75) {
                    return cC;
                }
            }
            return null;
        }
        function V1() {
            AW.safeWalk = false;
            if (!fu.safeWalk) {
                return;
            }
            if (roboticsSafeWalkPad()) {
                AW.safeWalk = true;
                A0("9", undefined, 1);
                return;
            }
            if (fl.safeWalk == "move") {
                let ci = AF.find(cC => cC.dmg && !cC.isTeamObject(Ai) && s4.getDist(cC, Ai, 0, 3) <= cC.getScale() + Ai.scale + Math.max(Ai.scale / 1.5, s4.getDist(Ai, Ai, 2, 3) / 1.5) || cC.type == 1 && cC.y >= 12000 && s4.getDist(cC, Ai, 0, 3) <= cC.scale + Ai.scale);
                if (ci) {
                    let cC = s4.getDirect(ci, Ai, 0, 2);
                    A0("9", cC + Math.PI, 1);
                    AW.safeWalk = true;
                }
            } else {
                let cK = AF.filter(cd => cd.type == 1 && cd.y >= 12000 || cd.dmg && !cd.isTeamObject(Ai));
                for (let cd of cK) {
                    if (V0(cd)) {
                        let ck = cd.getScale() + 75;
                        let cQ = s4.getDist(Ai, cd, 3, 0);
                        if (cQ <= ck) {
                            AW.safeWalk = true;
                            A0("9", undefined, 1);
                            break;
                        }
                    }
                }
            }
        }
        function V2() {
            const ci = AF.find(cC => (cC.type == 1 && cC.y >= 12000 || cC.dmg && !cC.isTeamObject(Ai)) && s4.getDist(cC, Ai, 0, 3) <= cC.getScale() + Ai.scale);
            if (ci) {
                Ai.addDamageThreat(ci.dmg || 35);
            }
            if (!Ad.length) {
                return;
            }
            ss.checkSpikeTick();
            if (ci && AQ.primaryReloaded && [3, 4, 5].includes(AQ.primaryIndex) && AQ.dist2 < 210) {
                if (Ai.inTrap) {
                    if (!Ai[(Ai.weaponIndex < 9 ? "primary" : "secondary") + "Reloaded"]) {
                        AW.anti0Tick = 1;
                        Ai.chat.message = "Anti SpikeTick by " + AQ.sid + " (" + AQ.name;
                        Ai.chat.count = 112;
                    }
                } else {
                    AW.anti0Tick = 2;
                    Ai.chat.message = "Anti SpikeTick by " + AQ.sid + " (" + AQ.name + ")";
                    Ai.chat.count = 223;
                }
            }
        }
        const V3 = () => {
            if (A7 || !fu.autoPush || !Ad.length || !AQ.inTrap || Ai.inTrap) {
                em.active = false;
                if (AW.autoPush) {
                    AW.autoPush = false;
                    A0("9", Ai.moveDir, 1);
                }
                return;
            }
            let ci = roboticsGrid.near(AQ.inTrap.x, AQ.inTrap.y, 300, roboticsNearTmp).filter(cM => cM.active && cM.dmg && cM.isTeamObject(Ai) && s4.getDist(cM, AQ.inTrap, 0, 0) <= cM.scale * 0.8 + AQ.inTrap.scale + AQ.scale);
            if (!ci.length) {
                em.active = false;
                if (AW.autoPush) {
                    AW.autoPush = false;
                    A0("9", Ai.moveDir, 1);
                }
                return;
            }
            let cC = {};
            let cK = ci[0];
            if (ci.length == 1) {
                cC = {
                    x: cK.x,
                    y: cK.y,
                    scale: cK.scale
                };
            } else {
                let cM = ci.sort((cG, cS) => cS.health - cG.health).sort((cG, cS) => s4.getDist(cG, AQ, 0, 2) - s4.getDist(cS, AQ, 0, 2));
                let cY = cM[0];
                let co = cM.filter(cG => cG.sid != cY.sid).sort((cG, cS) => s4.getDist(cG, cY, 0, 0) - s4.getDist(cS, cY, 0, 0))[0];
                if (co) {
                    let cG = s4.findMiddlePoint(cY, co, 0, 0);
                    if (s4.getDist(cG, cY, 0, 0) <= 32 + cY.scale && s4.getDist(cG, co, 0, 0) <= 32 + co.scale) {
                        cC = {
                            x: cG.x,
                            y: cG.y,
                            scale: Math.min(cY.scale, co.scale) * 0.7
                        };
                    } else {
                        cC = {
                            x: cY.x,
                            y: cY.y,
                            scale: cY.scale
                        };
                    }
                } else {
                    cC = {
                        x: cY.x,
                        y: cY.y,
                        scale: cY.scale
                    };
                }
            }
            if (!cC) {
                em.active = false;
                if (AW.autoPush) {
                    AW.autoPush = false;
                    A0("9", Ai.moveDir, 1);
                }
                return;
            }
            let cd = s4.getDirect(cC, AQ, 0, 2);
            let ck = s4.getDirect(cC, AQ.inTrap, 0, 0);
            let cQ = s4.findMiddlePoint(cC, AQ.inTrap, 0, 0);
            AW.pushData = {
                x: cC.x,
                y: cC.y
            };
            // The spike (or spike pair midpoint) being pushed into, for push strikes.
            AW.pushSpike = {
                x: cC.x,
                y: cC.y,
                scale: cC.scale,
                dmg: cK.dmg || 35
            };
            let cg;
            let cp;
            let cW;
            let ct;
            let cn;
            let cz;
            let cx = s4.getAngleDist(ck, cd);
            if (cx > 0.25) {
                let cS = s4.getDirect(AQ.inTrap, Ai, 0, 2);
                let cv = s4.getDirect(AQ.inTrap, AQ, 0, 2);
                let cE = s4.getDist(AQ.inTrap, AQ, 0, 2);
                cg = AQ.scale * 1.5;
                cp = Math.max(AQ.scale / 2, AQ.scale + cg - cE);
                cW = cv;
                ct = s4.getAngleDist(cS, cv) < 0.4;
                cn = cg;
                cz = 1;
            } else {
                let cb = s4.getDirect(cC, Ai, 0, 2);
                let cR = s4.getDist(cC, AQ, 0, 2);
                cg = AQ.scale * 1.5;
                cp = Math.max(AQ.scale / 2, cC.scale + AQ.scale + cg - cR);
                cW = cd;
                ct = s4.getAngleDist(cb, cd) < 0.5;
                cn = null;
                cz = 0;
            }
            if (AQ.dist2 <= cg * 2 && ct) {
                em.active = false;
                em.paths = [];
                AW.pushData.x2 = AQ.x2 - Math.cos(cW) * cp;
                AW.pushData.y2 = AQ.y2 - Math.sin(cW) * cp;
                let cD = s4.getDirect(AW.pushData, Ai, 2, 2);
                A0("9", cD, 1);
                AW.autoPush = true;
            } else {
                let cZ = Math.cos(cW) * 69;
                let cO = Math.sin(cW) * 69;
                let cI = sN.calc({
                    x: cZ,
                    y: cO
                }, false, "auto push");
                em.paths = cI.paths;
                em.attempts = cI.attempts;
                if (em.paths.length > 0) {
                    em.active = true;
                    let ca = s4.getDirect(em.paths[1], Ai, 0, 2);
                    A0("9", ca, 1);
                    AW.autoPush = true;
                    AW.pushData.x2 = AQ.x2 - cZ;
                    AW.pushData.y2 = AQ.y2 - cO;
                } else {
                    AW.autoPush = false;
                }
            }
        };
        let V4 = null;
        const V5 = CONFIG.sync.url;
        let V6 = [];
        let V7 = [];
        let V8Timer = null;
        let V8Delay = CONFIG.sync.retryMin;
        let V8Attempts = 0;
        function V8ScheduleReconnect() {
            if (V8Timer) {
                return;
            }
            const ci = V8Delay;
            V8Delay = Math.min(V8Delay * 2, CONFIG.sync.retryMax);
            V8Timer = setTimeout(() => {
                V8Timer = null;
                V8();
            }, ci);
        }
        // Opt-in only: nothing connects unless the "External Sync" menu toggle is on.
        function V8() {
            if (!fu.externalSync) {
                return;
            }
            if (V4 && (V4.readyState === WebSocket.OPEN || V4.readyState === WebSocket.CONNECTING)) {
                return;
            }
            if (V8Timer) {
                return;
            }
            let ci;
            try {
                ci = new WebSocket(V5);
            } catch (err) {
                V8Attempts++;
                console.warn("[Robotics] could not create sync WebSocket, retrying:", err);
                V8ScheduleReconnect();
                return;
            }
            V4 = ci;
            ci.addEventListener("open", () => {
                console.log("[Robotics] sync WebSocket connected.");
                V8Delay = CONFIG.sync.retryMin;
                V8Attempts = 0;
            });
            ci.addEventListener("message", cC => {
                try {
                    const cK = JSON.parse(cC.data);
                    // The server only tells us who else runs Robotics; it can no
                    // longer make this client send game packets.
                    if (cK.action === "update") {
                        if (!Ai || !Array.isArray(cK.data)) {
                            return;
                        }
                        let cd = cK.data.filter(ck => ck.sid !== Ai.sid);
                        V6 = cd.map(ck => ck.sid);
                        V7 = cd.filter(ck => ck.sync).map(ck => ck.sid);
                    }
                    if (cK.action == "listClients") {
                        console.log("Connected clients:", cK.data);
                    }
                } catch (err) {
                    console.warn("[Robotics] bad message from sync WebSocket:", err);
                }
            });
            ci.addEventListener("error", () => {
                console.warn("[Robotics] sync WebSocket error.");
            });
            ci.addEventListener("close", () => {
                if (V4 === ci) {
                    V4 = null;
                }
                V6 = [];
                V7 = [];
                if (!fu.externalSync) {
                    console.log("[Robotics] sync WebSocket closed (External Sync is off).");
                    return;
                }
                V8Attempts++;
                console.log("[Robotics] sync WebSocket closed; reconnecting (attempt " + V8Attempts + ").");
                V8ScheduleReconnect();
            });
        }
        // Closes the sync socket and stops reconnecting once the toggle is turned off.
        function roboticsSyncOff() {
            if (V8Timer) {
                clearTimeout(V8Timer);
                V8Timer = null;
            }
            V8Delay = CONFIG.sync.retryMin;
            if (V4) {
                V4.close();
            }
        }
        function V9() {
            if (!fu.externalSync) {
                return;
            }
            try {
                if (V4 && V4.readyState === WebSocket.OPEN) {
                    if (!Ai) {
                        return;
                    }
                    if (!serverID) {
                        const cC = window.location.href.match(/[?&]server=([^&]+)/);
                        if (cC && cC[1]) {
                            serverID = decodeURIComponent(cC[1]);
                        }
                    }
                    const ci = {
                        action: "update",
                        data: {
                            sid: Ai.sid,
                            name: Ai.name,
                            server: serverID,
                            sync: fu.serverSync,
                            ping: Ap,
                            x2: Ai.x2,
                            y2: Ai.y2
                        }
                    };
                    V4.send(JSON.stringify(ci));
                } else {
                    V8();
                }
            } catch (err) {
                console.warn("[Robotics] sync update failed:", err);
            }
        }
        // Every CONFIG.sync.updateTicks (~20 s): optional sync update, and drop
        // destroyed buildings from the object pool.
        function roboticsSlowTask() {
            if (!AX) {
                return;
            }
            V9();
            for (let ci = Ac.length - 1; ci >= 0; ci--) {
                if (Ac[ci].type == null && !Ac[ci].active && Date.now() - Ac[ci].breakTime > 5000) {
                    roboticsGrid.remove(Ac[ci]);
                    Ac.splice(ci, 1);
                }
            }
        }
        var songChatoe2735 = class {
            constructor (sendChat) {
                this.sendChat = sendChat;
                this.songs = [
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Avicii_-_The_Nights_(Hydr0.org).mp3", audio: null, lyrics: [
                        [3200, `Once upon a younger year`],
                        [4895, `When all our shadows`],
                        [5960, `disappeared`],
                        [6805, `The animals inside`],
                        [8017, `came out to play`],
                        [10754, `Went face to face`],
                        [11482, `with all our fears`],
                        [12731, `Learned our lessons`],
                        [13646, `through the tears`],
                        [14428, `Made memories we knew`],
                        [15761, `would never fade`],
                        [17794, `One day, my father,`],
                        [19150, `he told me,`],
                        [19864, `Son, don't let it slip away`],
                        [22065, `He took me in his arms,`],
                        [23325, `I heard him say`],
                        [25869, `When you get older,`],
                        [26778, `your wild heart will`],
                        [28002, `live for younger days`],
                        [29788, `Think of me if`],
                        [30689, `ever you're afraid`],
                        [32988, `He said,`],
                        [33654, `One day,`],
                        [34508, `you'll leave this world behind`],
                        [36777, `So live a life`],
                        [38205, `you will remember`],
                        [40695, `My father told me when`],
                        [42318, `I was just a child`],
                        [44429, `These are the nights`],
                        [45729, `that never die`],
                        [47686, `My father told me`],
                        [79400, `When thunderclouds`],
                        [80349, `start pouring down`],
                        [81219, `Light a fire`],
                        [81992, `they can't put out`],
                        [83286, `Carve your name`],
                        [83917, `into those shining stars`],
                        [86457, `He said,`],
                        [87010, `Go venture far`],
                        [87841, `beyond the shores`],
                        [88876, `Don't forsake this`],
                        [89746, `life of yours`],
                        [90527, `I'll guide you home`],
                        [91493, `no matter where you are`],
                        [93932, `One day, my father,`],
                        [95309, `he told me,`],
                        [96018, `Son, don't let it slip away`],
                        [98247, `When I was just a kid,`],
                        [99549, `I heard him say`],
                        [101853, `When you get older,`],
                        [103150, `your wild heart`],
                        [104064, `will live for younger days`],
                        [106088, `Think of me if`],
                        [106947, `ever you're afraid`],
                        [109229, `He said,`],
                        [109656, `One day,`],
                        [110614, `you'll leave this world behind`],
                        [113017, `So live a life`],
                        [114356, `you will remember`],
                        [116823, `My father told me when`],
                        [118283, `I was just a child`],
                        [120576, `These are the nights`],
                        [121980, `that never die`],
                        [124003, `My father told me`],
                        [136169, `These are the nights`],
                        [137292, `that never die`],
                        [139361, `My father told me`],
                        [163736, `Oh~`],
                        [169915, `My father told me`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Eurobeat_-_Manuel_-_Gas_Gas_Gas_(Hydr0.org).mp3", audio: null, lyrics: [
                        [17000, `Ahhhhh`],
                        [19954, `gas,`],
                        [20720, `Gas,`],
                        [21509, `gas`],
                        [24000, `Ahhhhh`],
                        [28432, `Do you like`],
                        [29789, `My car?`],
                        [31489, `my car`],
                        [33067, `m y  c a r`],
                        [53120, `Guess you're ready`],
                        [54234, `Cause I'm waiting for you`],
                        [55956, `It's gonna be so exciting!`],
                        [59140, `Got this feeling`],
                        [60397, `Really deep in my soul`],
                        [62309, `Let's get out, I wanna go`],
                        [63983, `Come along, get it on!`],
                        [65956, `Gonna take my car`],
                        [67536, `Gonna sit in`],
                        [69106, `Gona drive along til I get you`],
                        [71770, `Cause I'm crazy, hot and ready`],
                        [73609, `But you'll like it!`],
                        [74894, `I wanna race for you!`],
                        [76739, `(Shall I go now?)`],
                        [78426, `Gas Gas Gas!`],
                        [79661, `I'm gonna step on the gas`],
                        [81378, `Tonight I'll fly!`],
                        [82900, `And be your lover`],
                        [84218, `Yeah yeah yeah!`],
                        [85933, `I'll be so quick as a flash`],
                        [87594, `And I'll be your hero`],
                        [90462, `Gas Gas Gas!`],
                        [92184, `I'm gonna run as a flash`],
                        [93930, `Tonight I'll fight!`],
                        [95561, `To be the winner`],
                        [96766, `Yeah yeah yeah!`],
                        [98475, `I'm gonna step on the gas`],
                        [100093, `And you'll see the big show!`],
                        [115553, `Don't be lazy`],
                        [116577, `Cause I'm burning for you`],
                        [118431, `It's like a hot sensation!`],
                        [121661, `Got this power`],
                        [122805, `That is taking me out`],
                        [124524, `Yes, I've got a crush on you`],
                        [126383, `Ready, now`],
                        [127324, `Ready, go!`],
                        [128283, `Gonna take my car`],
                        [129837, `Gonna sit in`],
                        [131431, `Gona drive along til I get you`],
                        [134033, `Cause I'm crazy, hot and ready`],
                        [135838, `But you'll like it!`],
                        [137299, `I wanna race for you!`],
                        [139000, `Shall I go now?`],
                        [140495, `Gas Gas Gas!`],
                        [141981, `I'm gonna step on the gas`],
                        [143616, `Tonight I'll fly!`],
                        [145350, `And be your lover`],
                        [146554, `Yeah yeah yeah!`],
                        [148246, `I'll be so quick as a flash`],
                        [149886, `And I'll be your hero`],
                        [152696, `Gas Gas Gas!`],
                        [154549, `I'm gonna run as a flash`],
                        [156175, `Tonight I'll fight!`],
                        [157747, `To be the winner`],
                        [158965, `Yeah yeah yeah!`],
                        [160813, `I'm gonna step on the gas`],
                        [162436, `And you'll see the big show!`],
                        [190357, `Guess you're ready`],
                        [191319, `Cause I'm waiting for you`],
                        [193338, `It's gonna be so exciting!`],
                        [196258, `Got this feeling`],
                        [197534, `Really deep in my soul`],
                        [199240, `Let's get out, I wanna go`],
                        [201109, `Come along, get it on`],
                        [203124, `Gonna take my car`],
                        [206184, `Do you like my car?`],
                        [208904, `Cause I'm crazy, hot and ready`],
                        [210626, `But you'll like it!`],
                        [212057, `I wanna race for you!`],
                        [213833, `Shall I go now?`],
                        [216846, `Gas Gas Gas!`],
                        [218433, `I'm gonna step on the gas`],
                        [220052, `Tonight I'll fly!`],
                        [221687, `And be your lover`],
                        [222927, `Yeah yeah yeah!`],
                        [224791, `I'll be so quick as a flash`],
                        [226348, `And I'll be your hero`],
                        [229497, `Gas Gas Gas!`],
                        [230955, `I'm gonna run as a flash`],
                        [232590, `Tonight I'll fight!`],
                        [234096, `To be the winner`],
                        [235462, `Yeah yeah yeah!`],
                        [237258, `I'm gonna step on the gas`],
                        [238816, `And you'll see the big show!`],
                        [242147, `Gas Gas Gas!`],
                        [244960, `Yeah yeah yeah!`],
                        [248228, `Gas Gas Gas!`],
                        [251217, `And you'll see the big show!`]
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Ruth_B._-_Dandelions_(Hydr0.org).mp3", audio: null, lyrics: [
                        [12262, `Maybe it's the way you`],
                        [13658, `say my name`],
                        [18179, `Maybe it's the way you`],
                        [19909, `play your game`],
                        [23413, `But it's so good,`],
                        [25263, `I've never known`],
                        [26444, `anybody like you`],
                        [29395, `But it's so good,`],
                        [31377, `I've never dreamed`],
                        [32581, `of nobody like you`],
                        [36052, `And I've heard of a love`],
                        [38112, `that comes once in a lifetime`],
                        [42952, `And I'm pretty sure that`],
                        [44197, `you are that love of mine`],
                        [48426, `'Cause`],
                        [49149, `I'm in a field of dandelions`],
                        [52165, `Wishing on every one`],
                        [54328, `that you'd be mine,`],
                        [58249, `mine`],
                        [60742, `And I see forever`],
                        [62970, `in your eyes`],
                        [64612, `I feel okay when I`],
                        [66752, `see you smile,`],
                        [70601, `smile`],
                        [73029, `Wishing on dandelions`],
                        [74563, `all of the time`],
                        [76054, `Praying to God that`],
                        [77225, `one day you'll be mine`],
                        [79069, `Wishing on dandelions`],
                        [80697, `all of the time,`],
                        [82231, `all of the time`],
                        [85965, `I think that you`],
                        [87070, `are the one for me`],
                        [91994, `'Cause it gets so`],
                        [92369, `hard to breathe`],
                        [97220, `When you're looking at me,`],
                        [98988, `I've never felt so`],
                        [100361, `alive and free`],
                        [103448, `When you're looking at me,`],
                        [105249, `I've never felt so happy`],
                        [109930, `And I've heard of a love`],
                        [111902, `that comes once in a lifetime`],
                        [116665, `And I'm pretty sure that`],
                        [117986, `you are that love of mine`],
                        [122308, `'Cause`],
                        [123135, `I'm in a field of dandelions`],
                        [126030, `Wishing on every one`],
                        [128050, `that you'd be mine,`],
                        [131823, `mine`],
                        [134401, `And I see forever`],
                        [136962, `in your eyes`],
                        [138340, `I feel okay when I`],
                        [140597, `see you smile,`],
                        [144420, `smile`],
                        [147113, `Wishing on dandelions`],
                        [148588, `all of the time`],
                        [149911, `Praying to God that`],
                        [151384, `one day you'll be mine`],
                        [153038, `Wishing on dandelions`],
                        [154526, `all of the time`],
                        [155979, `All of the time`],
                        [159832, `Dandelion,`],
                        [160821, `into the wind you go`],
                        [162930, `Won't you let`],
                        [164150, `my darling know?`],
                        [166029, `Dandelion,`],
                        [167097, `into the wind you go`],
                        [169038, `Won't you let`],
                        [169975, `my darling know?`],
                        [171700, `That`],
                        [173969, `I'm in a field of dandelions`],
                        [176822, `Wishing on every one that`],
                        [179183, `you'd be mine,`],
                        [182976, `mine`],
                        [185325, `And I see forever`],
                        [187536, `in your eyes`],
                        [189051, `I feel okay when I`],
                        [191232, `see you smile,`],
                        [195272, `smile`],
                        [197665, `Wishing on dandelions`],
                        [199124, `all of the time`],
                        [200537, `Praying to God that`],
                        [201771, `one day you'll be mine`],
                        [203741, `Wishing on dandelions`],
                        [205284, `all of the time,`],
                        [206818, `all of the time`],
                        [210608, `I'm in a field of dandelions`],
                        [213827, `Wishing on every one that`],
                        [216100, `you'd be mine,`],
                        [219909, `mine`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Sub_Urban_-_Cradles_(Hydr0.org).mp3", audio: null, lyrics: [
                        [12757, `I live inside my own`],
                        [15758, `world of make-believe`],
                        [18587, `Kids screaming`],
                        [20238, `in their cradles,`],
                        [22040, `profanities`],
                        [24702, `I see the world through eyes`],
                        [27215, `covered in ink and bleach`],
                        [30746, `Cross out the ones who heard`],
                        [33242, `my cries and watched me weep`],
                        [36700, `I love everything`],
                        [39742, `Fire's spreading`],
                        [41193, `all around my room`],
                        [43257, `My world's so bright`],
                        [44664, `It's hard to breathe`],
                        [46165, `but that's alright`],
                        [47436, `Hush Shh`],
                        [72704, `Tape my eyes open`],
                        [74621, `to force reality`],
                        [76696, `(oh, no no)`],
                        [78525, `Why can't you just let me`],
                        [80876, `eat my weight in glee`],
                        [84737, `I live inside my own`],
                        [87595, `world of make-believe`],
                        [90622, `Kids screaming`],
                        [91974, `in their cradles,`],
                        [93934, `profanities`],
                        [96731, `Some days I feel skinnier`],
                        [99084, `than all the other days`],
                        [102780, `Sometimes I can't tell`],
                        [104407, `if my body belongs to me`],
                        [108800, `I love everything`],
                        [111452, `Fire's spreading`],
                        [112835, `all around my room`],
                        [115108, `My world's so bright`],
                        [116547, `It's hard to breathe`],
                        [118155, `but that's alright`],
                        [119402, `Hush Shh`],
                        [144344, `I wanna taste your content`],
                        [146703, `Hold your breath and`],
                        [148365, `feel the tension`],
                        [150024, `Devils hide behind redemption`],
                        [152745, `Honesty is a`],
                        [154330, `one-way gate to hell`],
                        [156300, `I wanna taste consumption`],
                        [159100, `Breathe faster to waste oxygen`],
                        [162090, `Hear the children sing aloud`],
                        [164628, `It's music 'til the`],
                        [166425, `wick burns out`],
                        [167776, `Hush`],
                        [180700, `Just wanna be`],
                        [181627, `care free lately,`],
                        [184477, `yeah`],
                        [185000, `Just kicking up daisies`],
                        [188225, `Got one too many`],
                        [189336, `quarters in my pockets`],
                        [191585, `Count 'em like the four-leaf`],
                        [193231, `clovers in my locket`],
                        [195292, `Untied laces, yeah`],
                        [198507, `Just tripping on daydreams`],
                        [201160, `Got dirty little lullabies`],
                        [203140, `playing on repeat`],
                        [204662, `Might as well just rot around`],
                        [206200, `the nursery and count sheep`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/KORDHELL_-_SCOPIN_(Hydr0.org).mp3", audio: null, lyrics: [
                        [2732, `I got that gauge 38`],
                        [3934, `and that four-five Glock`],
                        [5066, `Deep in the bushes, see`],
                        [5954, `I'm scopin' with that red dot`],
                        [7532, `I got that, I got that,`],
                        [8784, `I got that four-five Glock`],
                        [9905, `Deep in the bushes, see`],
                        [10848, `I'm scopin' with that red dot`],
                        [12486, `I got that gauge 38`],
                        [13583, `and that four-five Glock`],
                        [14860, `Deep in the bushes, see`],
                        [15688, `I'm scopin' with that red dot`],
                        [17365, `I got that, I got that,`],
                        [18203, `I got that, I got that`],
                        [19522, `I, I, I, I`],
                        [30581, `Scopin' with that red dot`],
                        [39267, `Deep in the bushes, see`],
                        [40266, `I'm scopin' with that red dot`],
                        [41762, `I got that gauge 38`],
                        [43041, `and that four-five Glock`],
                        [44272, `Deep in the bushes, see`],
                        [45270, `I'm scopin' with that red dot`],
                        [46746, `I got that, I got that,`],
                        [47901, `I got that four-five Glock`],
                        [49176, `Deep in the bushes, see`],
                        [50071, `I'm scopin' with that red dot`],
                        [51587, `I got that gauge 38`],
                        [52684, `and that four-five Glock`],
                        [53830, `Deep in the bushes, see`],
                        [54965, `I'm scopin' with that red dot`],
                        [56433, `I got that, I got that,`],
                        [57588, `I got that four-five Glock`],
                        [58831, `Deep in the bushes, see I'm`],
                        [59823, `scopin' with that red dot`],
                        [69768, `Scopin' with that red dot`],
                        [78434, `Deep in the bushes, see`],
                        [79314, `I'm scopin' with that red dot`],
                        [81811, `Scopin' with that red dot`],
                        [84108, `Scopin', scopin'`],
                        [84779, `with that red dot`],
                        [86825, `Scopin' with that red dot`],
                        [88363, `Deep in the bushes, see`],
                        [89175, `I'm scopin' with that red dot`],
                        [91900, `Scopin' with that red dot`],
                        [93989, `Scopin', scopin'`],
                        [94560, `with that red dot`],
                        [96801, `Scopin' with that red dot`],
                        [97969, `Deep in the bushes, see`],
                        [99088, `I'm scopin' with that red dot`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/he_Living_Tombstone_-_My_Ordinary_Life_(Hydr0.org).mp3", audio: null, lyrics: [
                        [29252, `They tell me keep it simple,`],
                        [30570, `I tell them take it slow`],
                        [31904, `I feed and water an idea,`],
                        [33362, `so I let it grow`],
                        [34596, `I tell them take it easy,`],
                        [35829, `they laugh and tell me no`],
                        [37143, `It's cool, but I dont see them`],
                        [38277, `laughin' at my money, though`],
                        [39705, `They spittin' facts at me,`],
                        [41002, `Im spittin' tracks, catch me?`],
                        [42366, `Im spinnin gold out my records`],
                        [43847, `know you can't combat me`],
                        [45121, `They tell me, Jesus walks,`],
                        [46289, `I tell them, money talks`],
                        [47504, `Bling got me chill, 'cause im`],
                        [48915, `living in an icebox`],
                        [50551, `They tell me I've been sleepin`],
                        [51669, `I say im wide awake`],
                        [52885, `Tracks hot and ready so they,`],
                        [54230, `call me Mr. Easy-Bake`],
                        [55574, `They say the grass is greener,`],
                        [56962, `I think my grass is dank`],
                        [58122, `Drivin' with a drank on an`],
                        [59514, `empty tank to the bank`],
                        [61220, `Do you feel me? Take a look,`],
                        [62413, `inside my brain`],
                        [63644, `The people always different,`],
                        [64569, `but it always feels the same`],
                        [66009, `That's the real me, pop the`],
                        [67614, `champagne`],
                        [68586, `The haters wanna hurt me,`],
                        [69775, `and im laughin' at the pain`],
                        [72107, `Stayin' still, eyes closed`],
                        [74235, `Let the world just pass me by,`],
                        [77245, `Pain pills, nice clothes`],
                        [79611, `If I fall, I think I'll fly`],
                        [82366, `Touch me, Midas`],
                        [84691, `Make me part of your design`],
                        [87629, `None to, guide us`],
                        [89943, `I feel fear`],
                        [91005, `for the very last time`],
                        [114272, `They tell me that im special,`],
                        [115274, `I smile and shake my head`],
                        [116527, `I'll give them stories to tell,`],
                        [117793, `friends bout the things I said`],
                        [119228, `They tell me im so humble,`],
                        [120424, `I say im turning red`],
                        [121833, `They let me lie to them`],
                        [122856, `and dont feel like`],
                        [123662, `they've been misled`],
                        [124661, `They give so much to me,`],
                        [125733, `Im losing touch, get me?`],
                        [127113, `Served on a silver platter,`],
                        [128150, `ask for seconds,`],
                        [129043, `they just let me`],
                        [129909, `They tell me im a god,`],
                        [131044, `Im lost in the facade`],
                        [132378, `Six feet off the ground at all`],
                        [133453, `times, I think im feelin' odd`],
                        [135203, `No matter what I make,`],
                        [136306, `they never see mistakes`],
                        [137493, `Makin' so much bread,`],
                        [138562, `I don't care that`],
                        [139300, `they're just fake`],
                        [140468, `They tell me they're below me,`],
                        [141579, `I act like im above`],
                        [142638, `The people blend together,`],
                        [143686, `but I'd be lost`],
                        [144496, `without their love`],
                        [145775, `Can you heal me?`],
                        [146578, `Have I gained too much?`],
                        [148125, `When you become untouchable,`],
                        [149228, `you're unable to touch`],
                        [150882, `Is there a real me?`],
                        [151910, `Pop the champagne`],
                        [153164, `It hurts me just to think,`],
                        [154310, `and I don't do pain`],
                        [156397, `Stayin' still, eyes closed,`],
                        [158726, `Let the world just pass me by`],
                        [161741, `Pain pills, nice clothes,`],
                        [164232, `If I fall, I think I'll fly`],
                        [167202, `Touch me, Midas,`],
                        [169509, `Make me part of your design,`],
                        [172527, `None to guide us,`],
                        [174481, `I feel fear`],
                        [175555, `for the very last time`],
                        [177913, `Lay still, restless,`],
                        [180073, `Losing sleep while`],
                        [181003, `I lose my mind`],
                        [182800, `All thrill, no stress,`],
                        [185234, `All my muses left behind`],
                        [188339, `World is below,`],
                        [190847, `So high up, im near-divine`],
                        [193805, `Lean in, let go,`],
                        [195774, `I feel fear`],
                        [196752, `for the very last time`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Ed_Sheeran_-_Shape_of_You_(Hydr0.org).mp3", audio: null, lyrics: [
                        [9932, `The club isn't the`],
                        [10541, `best place to find a lover`],
                        [11993, `So the bar is where I go`],
                        [14804, `Me and my friends at`],
                        [15739, `the table doing shots`],
                        [16766, `Drinking fast and then`],
                        [17807, `we talk slow`],
                        [19811, `Come over and start up`],
                        [20705, `a conversation with just me`],
                        [22328, `And trust me I'll`],
                        [23023, `give it a chance now`],
                        [24491, `Take my hand, stop,`],
                        [25571, `put Van the Man on the jukebox`],
                        [27131, `And then we start to dance,`],
                        [28640, `and now I'm singing like`],
                        [29671, `Girl, you know`],
                        [30587, `I want your love`],
                        [32163, `Your love was handmade`],
                        [33297, `for somebody like me`],
                        [35444, `Come on now, follow my lead`],
                        [37227, `I may be crazy, don't mind me`],
                        [39364, `Say, boy, let's`],
                        [40271, `not talk too much`],
                        [42178, `Grab on my waist`],
                        [43064, `and put that body on me`],
                        [45319, `Come on now, follow my lead`],
                        [46864, `Come, come on now,`],
                        [47705, `follow my lead`],
                        [50638, `I'm in love with`],
                        [51332, `the shape of you`],
                        [53147, `We push and pull`],
                        [53804, `like a magnet do`],
                        [55774, `Although my heart`],
                        [56427, `is falling too`],
                        [58193, `I'm in love with your body`],
                        [60855, `And last night you`],
                        [61509, `were in my room`],
                        [63160, `And now my bedsheets`],
                        [63980, `smell like you`],
                        [65010, `Every day discovering`],
                        [66300, `something brand new`],
                        [68273, `I'm in love with your body`],
                        [69772, `(Oh-I-oh-I-oh-I-oh-I)`],
                        [73218, `I'm in love with your body`],
                        [74974, `(Oh-I-oh-I-oh-I-oh-I)`],
                        [78230, `I'm in love with your body`],
                        [79674, `(Oh-I-oh-I-oh-I-oh-I)`],
                        [83028, `I'm in love with your body`],
                        [84677, `Every day discovering`],
                        [86248, `something brand new`],
                        [88183, `I'm in love with`],
                        [88814, `the shape of you`],
                        [89967, `One week in we`],
                        [90565, `let the story begin`],
                        [91774, `We're going out`],
                        [92392, `on our first date`],
                        [94690, `You and me are thrifty,`],
                        [95593, `so go all you can eat`],
                        [96776, `Fill up your bag`],
                        [97458, `and I fill up a plate`],
                        [99660, `We talk for hours and hours`],
                        [100463, `about the sweet and the sour`],
                        [101779, `And how your family`],
                        [102662, `is doing okay`],
                        [104709, `And leave and get in a taxi,`],
                        [105975, `then kiss in the backseat`],
                        [106839, `Tell the driver make the`],
                        [107909, `radio play, and`],
                        [109024, `I'm singing like`],
                        [109725, `Girl, you know`],
                        [110586, `I want your love`],
                        [112019, `Your love was handmade`],
                        [113299, `for somebody like me`],
                        [115514, `Come on now, follow my lead`],
                        [117395, `I may be crazy, don't mind me`],
                        [119499, `Say, boy, let's`],
                        [120864, `not talk too much`],
                        [122263, `Grab on my waist`],
                        [123225, `and put that body on me`],
                        [125389, `Come on now, follow my lead`],
                        [126886, `Come, come on now,`],
                        [127821, `follow my lead`],
                        [130575, `I'm in love with`],
                        [131312, `the shape of you`],
                        [133136, `We push and pull`],
                        [133753, `like a magnet do`],
                        [135717, `Although my heart`],
                        [136380, `is falling too`],
                        [138181, `I'm in love with your body`],
                        [140628, `And last night you`],
                        [141395, `were in my room`],
                        [143346, `And now my bedsheets`],
                        [144070, `smell like you`],
                        [145073, `Every day discovering`],
                        [146211, `something brand new`],
                        [148114, `I'm in love with your body`],
                        [149872, `(Oh-I-oh-I-oh-I-oh-I)`],
                        [153305, `I'm in love with your body`],
                        [154800, `(Oh-I-oh-I-oh-I-oh-I)`],
                        [158180, `I'm in love with your body`],
                        [159848, `(Oh-I-oh-I-oh-I-oh-I)`],
                        [163093, `I'm in love with your body`],
                        [165173, `Every day discovering`],
                        [166183, `something brand new`],
                        [168162, `I'm in love with`],
                        [168991, `the shape of you`],
                        [170090, `Come on, be my baby,`],
                        [171685, `come on`],
                        [172656, `Come on, be my baby,`],
                        [174142, `come on`],
                        [175123, `Come on, be my baby`],
                        [176592, `come on`],
                        [177579, `Come on, be my baby,`],
                        [179150, `come on`],
                        [180284, `Come on, be my baby,`],
                        [181486, `come on`],
                        [182483, `Come on, be my baby,`],
                        [184108, `come on`],
                        [185069, `Come on, be my baby,`],
                        [186558, `come on`],
                        [187570, `Come on, be my baby,`],
                        [189135, `come on`],
                        [190619, `I'm in love with`],
                        [191341, `the shape of you`],
                        [193197, `We push and pull`],
                        [193858, `like a magnet do`],
                        [195714, `Although my heart`],
                        [196391, `is falling too`],
                        [198208, `I'm in love with your body`],
                        [200686, `And last night you`],
                        [201398, `were in my room`],
                        [203141, `And now my bedsheets`],
                        [204049, `smell like you`],
                        [205060, `Every day discovering`],
                        [206256, `something brand new`],
                        [208147, `I'm in love with your body`],
                        [210279, `Come on, be my baby,`],
                        [211970, `come on`],
                        [212900, `Come on`],
                        [213513, `(I'm in love with your body),`],
                        [213514, `be my baby, come on`],
                        [215542, `Come on, be my baby, come on`],
                        [216636, `Come on`],
                        [218500, `(I'm in love with your body),`],
                        [218501, `be my baby, come on`],
                        [220481, `Come on, be my baby,`],
                        [221900, `come on`],
                        [222624, `Come on, be my baby,`],
                        [223420, `(I'm in love with your body),`],
                        [223421, `come on`],
                        [225305, `Every day discovering`],
                        [226240, `something brand new`],
                        [228190, `I'm in love with`],
                        [228817, `the shape of you`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Powfu_beabadoobee_-_death_bed_coffee_for_your_head_(Hydr0.org).mp3", audio: null, lyrics: [
                        [100, `Don't stay awake for too long`],
                        [3191, `Don't go to bed`],
                        [5514, `I'll make a cup of coffee`],
                        [7158, `for your head`],
                        [8867, `I'll get you up and going`],
                        [10537, `out of bed`],
                        [12069, `Yeah, I dont wanna fall asleep`],
                        [14395, `I don't wanna pass away`],
                        [16132, `I've been thinking`],
                        [16964, `of our future`],
                        [17819, `Cause Ill never see those days`],
                        [19581, `I don't know why`],
                        [20300, `this has happened,`],
                        [21169, `but I probably deserve it`],
                        [22700, `I tried to do my best,`],
                        [24216, `but you know that`],
                        [25214, `I'm not perfect`],
                        [26354, `I've been praying`],
                        [27097, `for forgiveness,`],
                        [27931, `you've been praying`],
                        [28628, `for my health`],
                        [29500, `When I leave this earth,`],
                        [30829, `hoping youll find someone else`],
                        [32706, `Cause, yeah, were still young,`],
                        [34232, `theres so much we haven't done`],
                        [36175, `Getting married,`],
                        [36843, `start a family,`],
                        [37767, `watch your husband`],
                        [38491, `with his son`],
                        [39544, `I wish it could be me,`],
                        [41012, `but I wont make it of this bed`],
                        [42648, `I hope I go to heaven,`],
                        [44284, `so I see you once again`],
                        [46446, `My life was kindda short,`],
                        [47660, `but I got so many blessings`],
                        [49825, `Happy you were mine,`],
                        [50969, `it sucks that it's all ending`],
                        [53399, `Don't stay awake for too long`],
                        [56507, `Don't go to bed`],
                        [58893, `I'll make a cup of coffee`],
                        [60529, `for your head`],
                        [62299, `I'll get you up and going`],
                        [63875, `out of bed, yeah`],
                        [65864, `And I,`],
                        [66474, `don't stay awake for too long`],
                        [69795, `Don't go to bed`],
                        [72103, `I'll make a cup of coffee`],
                        [73890, `for your head`],
                        [75499, `I'll get you up and going`],
                        [77154, `out of bed`],
                        [78552, `Yeah, I'm happy that`],
                        [80279, `you're here with me`],
                        [81416, `I'm sorry if I tear up`],
                        [83000, `When me and you were younger,`],
                        [84263, `you would always`],
                        [85100, `make me cheer up`],
                        [86359, `Taking goofy videos while`],
                        [87889, `walking through the park`],
                        [89320, `You would jump into my arms`],
                        [90772, `every time you heard a bark`],
                        [93127, `Cuddle in your sheets,`],
                        [94430, `sang me sound asleep`],
                        [96396, `And sneak out through`],
                        [97304, `your kitchen at exactly 1:03`],
                        [99767, `Sundays went to church,`],
                        [101567, `on Mondays watched a movie`],
                        [103081, `Soon you'll be alone,`],
                        [104556, `sorry that you have to lose me`],
                        [106457, `Don't stay awake for too long`],
                        [109810, `Don't go to bed`],
                        [112102, `I'll make a cup of coffee`],
                        [113983, `for your head`],
                        [115647, `I'll get you up and going`],
                        [117188, `out of bed`],
                        [118721, `And I,`],
                        [119877, `don't stay awake for too long`],
                        [123213, `Don't go to bed`],
                        [125613, `I'll make a cup of coffee`],
                        [127141, `for your head`],
                        [128934, `I'll get you up and going`],
                        [130436, `out of bed`],
                        [133392, `Don't stay awake for too long`],
                        [136507, `Don't go to bed`],
                        [138850, `I'll make a cup of coffee`],
                        [140560, `for your head`],
                        [142240, `I'll get you up and going`],
                        [143810, `out of bed`],
                        [145553, `And I,`],
                        [146501, `don't stay awake for too long`],
                        [149780, `Don't go to bed`],
                        [152281, `I'll make a cup of coffee`],
                        [154200, `for your head`],
                        [155540, `I'll get you up and going`],
                        [157185, `out of bed`],
                        [158938, `And I,`],
                        [159877, `don't stay awake for too long`],
                        [163084, `Don't go to bed`],
                        [165483, `I'll make a cup of coffee`],
                        [167378, `for your head`],
                        [168826, `I'll get you up and going`],
                        [170323, `out of bed`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Marina_And_The_Diamonds_-_Bubblegum_Bitch_(Hydr0.org).mp3", audio: null, lyrics: [
                        [14000, `I've got a figure`],
                        [14710, `like a pin-up`],
                        [15803, `Got a figure like a doll`],
                        [17428, `Don't care if you`],
                        [18091, `think I'm dumb`],
                        [18948, `I don't care at all`],
                        [20369, `Candy bear, sweetie pie`],
                        [21912, `I wanna be adored`],
                        [23489, `I'm the girl you'd die for`],
                        [26797, `I'll chew you up and`],
                        [28353, `I'll spit you out`],
                        [29885, `'Cause that's what young love`],
                        [31243, `is all about`],
                        [32897, `So pull me closer`],
                        [34457, `and kiss me hard`],
                        [35823, `I'm gonna pop your`],
                        [37003, `bubblegum heart`],
                        [38684, `I'm Miss Sugar Pink,`],
                        [40104, `liquor, liquor lips`],
                        [41614, `Hit me with your sweet love`],
                        [43110, `Steal me with a kiss`],
                        [44756, `I'm Miss Sugar Pink,`],
                        [46175, `liquor, liquor lips`],
                        [47645, `I'm gonna be your`],
                        [49368, `bubblegum Bitch`],
                        [50850, `I'm gonna be your`],
                        [52241, `bubblegum Bitch`],
                        [60048, `Queentex, latex,`],
                        [61433, `I'm your wonder maid`],
                        [62908, `Life gave me some lemons,`],
                        [64119, `so I made some lemonade`],
                        [66088, `Soda pop, soda pop,`],
                        [67439, `baby here I come`],
                        [68992, `Straight to number one`],
                        [72315, `Oh, Dear diary, I met a boy`],
                        [75314, `He made my doll heart`],
                        [76714, `light up with joy`],
                        [78347, `Oh, Dear diary, we fell apart`],
                        [81224, `Welcome to the life`],
                        [82184, `of Electra Heart`],
                        [84233, `I'm Miss Sugar Pink,`],
                        [85724, `liquor, liquor lips`],
                        [87192, `Hit me with your sweet love`],
                        [88753, `Steal me with a kiss`],
                        [90297, `I'm Miss Sugar Pink,`],
                        [91787, `liquor, liquor lips`],
                        [93254, `I'm gonna be your`],
                        [94813, `bubblegum Bitch`],
                        [96370, `I'm gonna be your`],
                        [97863, `bubblegum Bitch`],
                        [99490, `I think I want your-,`],
                        [101317, `your American tan`],
                        [104129, `Oh, oh, oh`],
                        [105700, `I think you're gonna`],
                        [107266, `be my biggest fan`],
                        [110427, `Oh, oh, oh`],
                        [123868, `I'm Miss Sugar Pink,`],
                        [125300, `liquor, liquor lips`],
                        [126826, `Hit me with your sweet love`],
                        [128235, `Steal me with a kiss`],
                        [129795, `I'm Miss Sugar Pink,`],
                        [131218, `liquor, liquor lips`],
                        [132789, `I'm gonna be your`],
                        [134310, `bubblegum Bitch`],
                        [135910, `I'm gonna be your`],
                        [137327, `bubblegum Bitch`],
                        [139100, `I'm Miss Sugar Pink,`],
                        [140388, `liquor, liquor lips`],
                        [142042, `Hit me with your sweet love`],
                        [143344, `Steal me with a kiss`],
                        [145000, `I'm Miss Sugar Pink,`],
                        [146309, `liquor, liquor lips`],
                        [147998, `I'm gonna be your`],
                        [149525, `bubblegum Bitch`],
                        [151000, `I'm gonna be your`],
                        [152518, `bubblegum Bitch`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/NYAN_CAT_-_Nyan_Cat_Original_Mix_(Hydr0.org).mp3", audio: null, lyrics: [
                        [8822, `Nyan nyan nyan nyan nyan nyan`],
                        [9502, `nyan nyan nyan nyan nyan nyan`],
                        [10182, `nyan nyan nyan nyan nyan`],
                        [10862, `nyan nyan nyan nyan`],
                        [11542, `Nyan nyan nyan nyan nyan nyan`],
                        [12222, `nyan nyan nyan nyan nyan nyan`],
                        [12902, `nyan nyan nyan nyan nyan`],
                        [13582, `nyan nyan nyan nyan`],
                        [14262, `Nyan nyan nyan nyan nyan nyan`],
                        [14942, `nyan nyan nyan nyan nyan nyan`],
                        [15622, `nyan nyan nyan nyan nyan`],
                        [16302, `nyan nyan nyan nyan`],
                        [16982, `Nyan nyan nyan nyan nyan nyan`],
                        [17662, `nyan nyan nyan nyan nyan nyan`],
                        [18342, `nyan nyan nyan nyan nyan`],
                        [19022, `nyan nyan nyan nyan`],
                        [19702, `Nyan nyan nyan nyan nyan nyan`],
                        [20382, `nyan nyan nyan nyan nyan nyan`],
                        [21062, `nyan nyan nyan nyan nyan`],
                        [21742, `nyan nyan nyan nyan`],
                        [22422, `Nyan nyan nyan nyan nyan nyan`],
                        [23102, `nyan nyan nyan nyan nyan nyan`],
                        [23782, `nyan nyan nyan nyan nyan`],
                        [24462, `nyan nyan nyan nyan`],
                        [25142, `Nyan nyan nyan nyan nyan nyan`],
                        [25822, `nyan nyan nyan nyan nyan nyan`],
                        [26502, `nyan nyan nyan nyan nyan`],
                        [27182, `nyan nyan nyan nyan`],
                        [27862, `Nyan nyan nyan nyan nyan nyan`],
                        [28542, `nyan nyan nyan nyan nyan nyan`],
                        [29222, `nyan nyan nyan nyan nyan`],
                        [29902, `nyan nyan nyan nyan`],
                        [30582, `Nyan nyan nyan nyan nyan nyan`],
                        [31262, `nyan nyan nyan nyan nyan nyan`],
                        [31942, `nyan nyan nyan nyan nyan`],
                        [32622, `nyan nyan nyan nyan`],
                        [33302, `Nyan nyan nyan nyan nyan nyan`],
                        [33982, `nyan nyan nyan nyan nyan nyan`],
                        [34662, `nyan nyan nyan nyan nyan`],
                        [35342, `nyan nyan nyan nyan`],
                        [36022, `Nyan nyan nyan nyan nyan nyan`],
                        [36702, `nyan nyan nyan nyan nyan nyan`],
                        [37382, `nyan nyan nyan nyan nyan`],
                        [38062, `nyan nyan nyan nyan`],
                        [38742, `Nyan nyan nyan nyan nyan nyan`],
                        [39422, `nyan nyan nyan nyan nyan nyan`],
                        [40102, `nyan nyan nyan nyan nyan`],
                        [40782, `nyan nyan nyan nyan`],
                        [41462, `Nyan nyan nyan nyan nyan nyan`],
                        [42142, `nyan nyan nyan nyan nyan nyan`],
                        [42822, `nyan nyan nyan nyan nyan`],
                        [43502, `nyan nyan nyan nyan`],
                        [44182, `Nyan nyan nyan nyan nyan nyan`],
                        [44862, `nyan nyan nyan nyan nyan nyan`],
                        [45542, `nyan nyan nyan nyan nyan`],
                        [46222, `nyan nyan nyan nyan`],
                        [46902, `Nyan nyan nyan nyan nyan nyan`],
                        [47582, `nyan nyan nyan nyan nyan nyan`],
                        [48262, `nyan nyan nyan nyan nyan`],
                        [48942, `nyan nyan nyan nyan`],
                        [49622, `Nyan nyan nyan nyan nyan nyan`],
                        [50302, `nyan nyan nyan nyan nyan nyan`],
                        [50982, `nyan nyan nyan nyan nyan`],
                        [51662, `nyan nyan nyan nyan`],
                        [52342, `Nyan nyan nyan nyan nyan nyan`],
                        [53022, `nyan nyan nyan nyan nyan nyan`],
                        [53702, `nyan nyan nyan nyan nyan`],
                        [54382, `nyan nyan nyan nyan`],
                        [55062, `Nyan nyan nyan nyan nyan nyan`],
                        [55742, `nyan nyan nyan nyan nyan nyan`],
                        [56422, `nyan nyan nyan nyan nyan`],
                        [57102, `nyan nyan nyan nyan`],
                        [57782, `Nyan nyan nyan nyan nyan nyan`],
                        [58462, `nyan nyan nyan nyan nyan nyan`],
                        [59142, `nyan nyan nyan nyan nyan`],
                        [59822, `nyan nyan nyan nyan`],
                        [60502, `Nyan nyan nyan nyan nyan nyan`],
                        [61182, `nyan nyan nyan nyan nyan nyan`],
                        [61862, `nyan nyan nyan nyan nyan`],
                        [62542, `nyan nyan nyan nyan`],
                        [63222, `Nyan nyan nyan nyan nyan nyan`],
                        [63902, `nyan nyan nyan nyan nyan nyan`],
                        [64582, `nyan nyan nyan nyan nyan nyan`],
                        [65262, `nyan nyan nyan Nyan nyan nyan`],
                        [65942, `nyan nyan nyan nyan nyan nyan`],
                        [66622, `nyan nyan nyan nyan nyan nyan`],
                        [67302, `nyan nyan nyan nyan nyan nyan`],
                        [67982, `nyan nyan nyan nyan`],
                        [68662, `Nyan nyan nyan nyan nyan nyan`],
                        [69342, `nyan nyan nyan nyan nyan nyan`],
                        [70022, `nyan nyan nyan nyan nyan`],
                        [70702, `nyan nyan nyan nyan`],
                        [71382, `Nyan nyan nyan nyan nyan nyan`],
                        [72062, `nyan nyan nyan nyan nyan nyan`],
                        [72742, `nyan nyan nyan nyan nyan`],
                        [73422, `nyan nyan nyan nyan`],
                        [74102, `Nyan nyan nyan nyan nyan nyan`],
                        [74782, `nyan nyan nyan nyan nyan nyan`],
                        [75462, `nyan nyan nyan nyan nyan`],
                        [76142, `nyan nyan nyan nyan`],
                        [76822, `Nyan nyan nyan nyan nyan nyan`],
                        [77502, `nyan nyan nyan nyan nyan nyan`],
                        [78182, `nyan nyan nyan nyan nyan`],
                        [78862, `nyan nyan nyan nyan`],
                        [79542, `Nyan nyan nyan nyan nyan nyan`],
                        [80222, `nyan nyan nyan nyan nyan nyan`],
                        [80902, `nyan nyan nyan nyan nyan`],
                        [81582, `nyan nyan nyan nyan`],
                        [82262, `Nyan nyan nyan nyan nyan nyan`],
                        [82942, `nyan nyan nyan nyan nyan nyan`],
                        [83622, `nyan nyan nyan nyan nyan`],
                        [84302, `nyan nyan nyan nyan`],
                        [84982, `Nyan nyan nyan nyan nyan nyan`],
                        [85662, `nyan nyan nyan nyan nyan nyan`],
                        [86342, `nyan nyan nyan nyan nyan`],
                        [87022, `nyan nyan nyan nyan`],
                        [87702, `Nyan nyan nyan nyan nyan nyan`],
                        [88382, `nyan nyan nyan nyan nyan nyan`],
                        [89062, `nyan nyan nyan nyan nyan`],
                        [89742, `nyan nyan nyan nyan`],
                        [90422, `Nyan nyan nyan nyan nyan nyan`],
                        [91102, `nyan nyan nyan nyan nyan nyan`],
                        [91782, `nyan nyan nyan nyan nyan`],
                        [92462, `nyan nyan nyan nyan`],
                        [93142, `Nyan nyan nyan nyan nyan nyan`],
                        [93822, `nyan nyan nyan nyan nyan nyan`],
                        [94502, `nyan nyan nyan nyan nyan`],
                        [95182, `nyan nyan nyan nyan`],
                        [95862, `Nyan nyan nyan nyan nyan nyan`],
                        [96542, `nyan nyan nyan nyan nyan nyan`],
                        [97222, `nyan nyan nyan nyan nyan`],
                        [97902, `nyan nyan nyan nyan`],
                        [98582, `Nyan nyan nyan nyan nyan nyan`],
                        [99262, `nyan nyan nyan nyan nyan nyan`],
                        [99942, `nyan nyan nyan nyan nyan`],
                        [100622, `nyan nyan nyan nyan`],
                        [101302, `Nyan nyan nyan nyan nyan nyan`],
                        [101982, `nyan nyan nyan nyan nyan nyan`],
                        [102662, `nyan nyan nyan nyan nyan`],
                        [103342, `nyan nyan nyan nyan`],
                        [104022, `Nyan nyan nyan nyan nyan nyan`],
                        [104702, `nyan nyan nyan nyan nyan nyan`],
                        [105382, `nyan nyan nyan nyan nyan`],
                        [106062, `nyan nyan nyan nyan`],
                        [106742, `Nyan nyan nyan nyan nyan nyan`],
                        [107422, `nyan nyan nyan nyan nyan nyan`],
                        [108102, `nyan nyan nyan nyan nyan`],
                        [108782, `nyan nyan nyan nyan`],
                        [109462, `Nyan nyan nyan nyan nyan nyan`],
                        [110142, `nyan nyan nyan nyan nyan nyan`],
                        [110822, `nyan nyan nyan nyan nyan`],
                        [111502, `nyan nyan nyan nyan`],
                        [112182, `Nyan nyan nyan nyan nyan nyan`],
                        [112862, `nyan nyan nyan nyan nyan nyan`],
                        [113542, `nyan nyan nyan nyan nyan`],
                        [114222, `nyan nyan nyan nyan`],
                        [114902, `Nyan nyan nyan nyan nyan nyan`],
                        [115582, `nyan nyan nyan nyan nyan nyan`],
                        [116262, `nyan nyan nyan nyan nyan`],
                        [116942, `nyan nyan nyan nyan`],
                        [117622, `Nyan nyan nyan nyan nyan nyan`],
                        [118302, `nyan nyan nyan nyan nyan nyan`],
                        [118982, `nyan nyan nyan nyan nyan`],
                        [119662, `nyan nyan nyan nyan`],
                        [120342, `Nyan nyan nyan nyan nyan nyan`],
                        [121022, `nyan nyan nyan nyan nyan nyan`],
                        [121702, `nyan nyan nyan nyan nyan`],
                        [122382, `nyan nyan nyan nyan`],
                        [123062, `Nyan nyan nyan nyan nyan nyan`],
                        [123742, `nyan nyan nyan nyan nyan nyan`],
                        [124422, `nyan nyan nyan nyan nyan`],
                        [125102, `nyan nyan nyan nyan`],
                        [125782, `Nyan nyan nyan nyan nyan nyan`],
                        [126462, `nyan nyan nyan nyan nyan nyan`],
                        [127142, `nyan nyan nyan nyan nyan`],
                        [127822, `nyan nyan nyan nyan`],
                        [128502, `Nyan nyan nyan nyan nyan nyan`],
                        [129182, `nyan nyan nyan nyan nyan nyan`],
                        [129862, `nyan nyan nyan nyan nyan`],
                        [130542, `nyan nyan nyan nyan`],
                        [131222, `Nyan nyan nyan nyan nyan nyan`],
                        [131902, `nyan nyan nyan nyan nyan nyan`],
                        [132582, `nyan nyan nyan nyan nyan`],
                        [133262, `nyan nyan nyan nyan`],
                        [133942, `Nyan nyan nyan nyan nyan nyan`],
                        [134622, `nyan nyan nyan nyan nyan nyan`],
                        [135302, `nyan nyan nyan nyan nyan`],
                        [135982, `nyan nyan nyan nyan`],
                        [136662, `Nyan nyan nyan nyan nyan nyan`],
                        [137342, `nyan nyan nyan nyan nyan nyan`],
                        [138022, `nyan nyan nyan nyan nyan`],
                        [138702, `nyan nyan nyan nyan`],
                        [139382, `Nyan nyan nyan nyan nyan nyan`],
                        [140062, `nyan nyan nyan nyan nyan nyan`],
                        [140742, `nyan nyan nyan nyan nyan`],
                        [141422, `nyan nyan nyan nyan`],
                        [142102, `Nyan nyan nyan nyan nyan nyan`],
                        [142782, `nyan nyan nyan nyan nyan nyan`],
                        [143462, `nyan nyan nyan nyan nyan`],
                        [144142, `nyan nyan nyan nyan`],
                        [144822, `Nyan nyan nyan nyan nyan nyan`],
                        [145502, `nyan nyan nyan nyan nyan nyan`],
                        [146182, `nyan nyan nyan nyan nyan`],
                        [146862, `nyan nyan nyan nyan`],
                        [147542, `Nyan nyan nyan nyan nyan nyan`],
                        [148222, `nyan nyan nyan nyan nyan nyan`],
                        [148902, `nyan nyan nyan nyan nyan`],
                        [149582, `nyan nyan nyan nyan`],
                        [150262, `Nyan nyan nyan nyan nyan nyan`],
                        [150942, `nyan nyan nyan nyan nyan nyan`],
                        [151622, `nyan nyan nyan nyan nyan`],
                        [152302, `nyan nyan nyan nyan`],
                        [152982, `Nyan nyan nyan nyan nyan nyan`],
                        [153662, `nyan nyan nyan nyan nyan nyan`],
                        [154342, `nyan nyan nyan nyan nyan`],
                        [155022, `nyan nyan nyan nyan`],
                        [155702, `Nyan nyan nyan nyan nyan nyan`],
                        [156382, `nyan nyan nyan nyan nyan nyan`],
                        [157062, `nyan nyan nyan nyan nyan`],
                        [157742, `nyan nyan nyan nyan`],
                        [158422, `Nyan nyan nyan nyan nyan nyan`],
                        [159102, `nyan nyan nyan nyan nyan nyan`],
                        [159782, `nyan nyan nyan nyan nyan`],
                        [160462, `nyan nyan nyan nyan`],
                        [161142, `Nyan nyan nyan nyan nyan nyan`],
                        [161822, `nyan nyan nyan nyan nyan nyan`],
                        [162502, `nyan nyan nyan nyan nyan`],
                        [163182, `nyan nyan nyan nyan`],
                        [163862, `Nyan nyan nyan nyan nyan nyan`],
                        [164542, `nyan nyan nyan nyan nyan nyan`],
                        [165222, `nyan nyan nyan nyan nyan`],
                        [165902, `nyan nyan nyan nyan`],
                        [166582, `Nyan nyan nyan nyan nyan nyan`],
                        [167262, `nyan nyan nyan nyan nyan nyan`],
                        [167942, `nyan nyan nyan nyan nyan`],
                        [168622, `nyan nyan nyan nyan`],
                        [169302, `Nyan nyan nyan nyan nyan nyan`],
                        [169982, `nyan nyan nyan nyan nyan nyan`],
                        [170662, `nyan nyan nyan nyan nyan`],
                        [171342, `nyan nyan nyan nyan`],
                        [172022, `Nyan nyan nyan nyan nyan nyan`],
                        [172702, `nyan nyan nyan nyan nyan nyan`],
                        [173382, `nyan nyan nyan nyan nyan`],
                        [174062, `nyan nyan nyan nyan`],
                        [174742, `Nyan nyan nyan nyan nyan nyan`],
                        [175422, `nyan nyan nyan nyan nyan nyan`],
                        [176102, `nyan nyan nyan nyan nyan`],
                        [176782, `nyan nyan nyan nyan`],
                        [177462, `Nyan nyan nyan nyan nyan nyan`],
                        [178142, `nyan nyan nyan nyan nyan nyan`],
                        [178822, `nyan nyan nyan nyan nyan`],
                        [179502, `nyan nyan nyan nyan`],
                        [180182, `Nyan nyan nyan nyan nyan nyan`],
                        [180862, `nyan nyan nyan nyan nyan nyan`],
                        [181542, `nyan nyan nyan nyan nyan`],
                        [182222, `nyan nyan nyan nyan`],
                        [182902, `Nyan nyan nyan nyan nyan nyan`],
                        [183582, `nyan nyan nyan nyan nyan nyan`],
                        [184262, `nyan nyan nyan nyan nyan`],
                        [184942, `nyan nyan nyan nyan`],
                        [185622, `Nyan nyan nyan nyan nyan nyan`],
                        [186302, `nyan nyan nyan nyan nyan nyan`],
                        [186982, `nyan nyan nyan nyan nyan`],
                        [187662, `nyan nyan nyan nyan`],
                        [188342, `Nyan nyan nyan nyan nyan nyan`],
                        [189022, `nyan nyan nyan nyan nyan nyan`],
                        [189702, `nyan nyan nyan nyan nyan`],
                        [190382, `nyan nyan nyan nyan`],
                        [191062, `Nyan nyan nyan nyan nyan nyan`],
                        [191742, `nyan nyan nyan nyan nyan nyan`],
                        [192422, `nyan nyan nyan nyan nyan`],
                        [193102, `nyan nyan nyan nyan`],
                        [193782, `Nyan nyan nyan nyan nyan nyan`],
                        [194462, `nyan nyan nyan nyan nyan nyan`],
                        [195142, `nyan nyan nyan nyan nyan`],
                        [195822, `nyan nyan nyan nyan`],
                        [196502, `Nyan nyan nyan nyan nyan nyan`],
                        [197182, `nyan nyan nyan nyan nyan nyan`],
                        [197862, `nyan nyan nyan nyan nyan`],
                        [198542, `nyan nyan nyan nyan`],
                        [199222, `Nyan nyan nyan nyan nyan nyan`],
                        [199902, `nyan nyan nyan nyan nyan nyan`],
                        [200582, `nyan nyan nyan nyan nyan`],
                        [201262, `nyan nyan nyan nyan`],
                        [201942, `Nyan nyan nyan nyan nyan nyan`],
                        [202622, `nyan nyan nyan nyan nyan nyan`],
                        [203302, `nyan nyan nyan nyan nyan`],
                        [203982, `nyan nyan nyan nyan`],
                        [204662, `Nyan nyan nyan nyan nyan nyan`],
                        [205342, `nyan nyan nyan nyan nyan nyan`],
                        [206022, `nyan nyan nyan nyan nyan`],
                        [206702, `nyan nyan nyan nyan`],
                        [207382, `Nyan nyan nyan nyan nyan nyan`],
                        [208062, `nyan nyan nyan nyan nyan nyan`],
                        [208742, `nyan nyan nyan nyan nyan`],
                        [209422, `nyan nyan nyan nyan`],
                        [210102, `Nyan nyan nyan nyan nyan nyan`],
                        [210782, `nyan nyan nyan nyan nyan nyan`],
                        [211462, `nyan nyan nyan nyan nyan`],
                        [212142, `nyan nyan nyan nyan`],
                        [212822, `Nyan nyan nyan nyan nyan nyan`],
                        [213502, `nyan nyan nyan nyan nyan nyan`],
                        [214182, `nyan nyan nyan nyan nyan`],
                        [214862, `nyan nyan nyan nyan`],
                        [215542, `Nyan nyan nyan nyan nyan nyan`],
                        [216222, `nyan nyan nyan nyan nyan nyan`],
                        [216902, `nyan nyan nyan nyan nyan`],
                        [217582, `nyan nyan nyan nyan`],
                        [218262, `Nyan nyan nyan nyan nyan nyan`],
                        [218942, `nyan nyan nyan nyan nyan nyan`],
                        [219622, `nyan nyan nyan nyan nyan`],
                        [220302, `nyan nyan nyan nyan`],
                        [220982, `Nyan nyan nyan nyan nyan nyan`],
                        [221662, `nyan nyan nyan nyan nyan nyan`],
                        [222342, `nyan nyan nyan nyan nyan`],
                        [223022, `nyan nyan nyan nyan`],
                        [223702, `Nyan nyan nyan nyan nyan nyan`],
                        [224382, `nyan nyan nyan nyan nyan nyan`],
                        [225062, `nyan nyan nyan nyan nyan`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Olly_Murs_-_That_Girl_(Hydr0.org).mp3", audio: null, lyrics: [
                        [100, `There's a girl,`],
                        [1850, `but I let her get away`],
                        [5603, `It's all my fault,`],
                        [7299, `'cause pride got in the way`],
                        [11100, `And I'd be lying if I said,`],
                        [13670, `I was okay`],
                        [16302, `About that girl,`],
                        [18048, `the one I let get away`],
                        [21405, `I keep saying no`],
                        [23774, `This can't be the way`],
                        [24647, `it was supposed to be`],
                        [26511, `I keep saying no`],
                        [29001, `There's gotta be a way`],
                        [30008, `to get you close to me`],
                        [32506, `Now I know, you gotta speak up`],
                        [34169, `if you want somebody`],
                        [36250, `Can't let them get away, oh no`],
                        [38961, `You don't wanna end up sorry`],
                        [41714, `The way that I'm feeling`],
                        [42544, `every day`],
                        [44444, `No, no, no, no`],
                        [47076, `There's no hope for`],
                        [47869, `the broken heart`],
                        [49300, `(Don't you know?)`],
                        [50000, `No, no, no, no`],
                        [52214, `There's no hope for the broken`],
                        [54400, `There's a girl,`],
                        [55700, `but I let her get away`],
                        [59477, `It's my fault,`],
                        [61223, `'cause I said I needed space`],
                        [64729, `And I've been torturing myself`],
                        [67693, `night and day`],
                        [70212, `About that girl,`],
                        [72038, `the one I let get away`],
                        [74945, `I keep saying no`],
                        [77514, `This can't be the way`],
                        [78598, `it was supposed to be`],
                        [80422, `I keep saying no`],
                        [83000, `There's gotta be`],
                        [83869, `a way to get you,`],
                        [84582, `gotta be a way to`],
                        [85569, `get you close to me`],
                        [86872, `You gotta speak up`],
                        [87956, `if you want somebody`],
                        [90131, `Can't let them get away, oh no`],
                        [92873, `You don't wanna end up sorry`],
                        [95511, `The way that I'm feeling`],
                        [96483, `every day`],
                        [98400, `No, no, no, no`],
                        [101013, `There's no hope for`],
                        [101869, `the broken heart`],
                        [103078, `(Don't you know?)`],
                        [103720, `No, no, no, no`],
                        [106231, `There's no hope for the broken`],
                        [109167, `No hope for me (no)`],
                        [111647, `No hope 'cause I'm broken`],
                        [114509, `No room to breathe (no)`],
                        [116899, `And I got no one to blame`],
                        [119836, `No home for me (no)`],
                        [122369, `No home 'cause I'm broken`],
                        [124458, `About that girl,`],
                        [125800, `the one I let get away`],
                        [129316, `So, you better speak up`],
                        [131969, `if you want somebody`],
                        [133349, `You can't let them get away,`],
                        [134900, `oh no, no`],
                        [136002, `You don't wanna end up sorry`],
                        [138300, `(oh, no)`],
                        [138800, `The way that I'm feeling`],
                        [139649, `every day`],
                        [141569, `No, no, no, no`],
                        [144076, `There's no home for`],
                        [145185, `the broken heart`],
                        [146333, `(Don't you know?)`],
                        [147000, `No, no, no, no`],
                        [149338, `There's no home for the broken`],
                        [151377, `Oh, you don't wanna`],
                        [153224, `lose that love`],
                        [154507, `It's only gonna hurt too much`],
                        [156406, `(I'm telling you)`],
                        [157600, `you don't wanna lose that love`],
                        [159880, `It's only gonna hurt too much`],
                        [161876, `(I'm telling you)`],
                        [162189, `you don't wanna lose that love`],
                        [165335, `'Cause there's no home`],
                        [166294, `for the broken`],
                        [167479, `About that girl,`],
                        [169222, `the one I let get away`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Lil_Nas_X_Jack_Harlow_-_INDUSTRY_BABY_(Hydr0.org).mp3", audio: null, lyrics: [
                        [4596, `D-D-Daytrip took it to ten`],
                        [5869, `(hey!)`],
                        [6764, `Baby back, ayy,`],
                        [8203, `couple racks, ayy`],
                        [9792, `Couple Grammys on him`],
                        [11426, `Couple plaques, ayy`],
                        [13125, `That's a fact, ayy`],
                        [14795, `Throw it back, ayy,`],
                        [16246, `throw it back, ayy`],
                        [17876, `And this one is`],
                        [18712, `for the champions`],
                        [21139, `I ain't lost since I began,`],
                        [23400, `yeah`],
                        [24000, `Funny how you said it`],
                        [24880, `was the end, yeah`],
                        [27360, `Then I went did it again, yeah`],
                        [30624, `I told you long ago`],
                        [32965, `on the road`],
                        [34156, `I got what they waiting for`],
                        [36994, `I don't run from nothing, dawg`],
                        [39463, `Get your soldiers,`],
                        [40686, `tell 'em I ain't laying low`],
                        [43555, `You was never really`],
                        [44553, `rooting for me anyway`],
                        [46808, `When I'm back up at the top,`],
                        [48011, `I wanna hear you say`],
                        [49870, `He dont run from nothing, dawg`],
                        [52281, `Get your soldiers,`],
                        [53501, `tell em that the break is over`],
                        [56079, `(uh)`],
                        [56300, `Need to, uh,`],
                        [57200, `need to get this album done`],
                        [58537, `Need a couple number ones`],
                        [60113, `Need a plaque on every song`],
                        [61816, `Need me like one`],
                        [62574, `with Nicki now`],
                        [63406, `Tell a rap Nigga`],
                        [64142, `I don't see ya (hah)`],
                        [64968, `I'm a pop Nigga`],
                        [65685, `like Bieber (hah)`],
                        [66548, `I don't Fuck Bitches,`],
                        [67286, `I'm queer (hah)`],
                        [68160, `But these Niggas`],
                        [68780, `Bitches like Madea,`],
                        [69367, `yeah, yeah, yeah, ayy`],
                        [71580, `Oh, let do it`],
                        [73089, `I ain't fall off,`],
                        [73765, `I jus aint release my new Shit`],
                        [76252, `I blew up,`],
                        [76887, `now everybody tryna sue me`],
                        [79368, `You call me Nas,`],
                        [80182, `but the hood call me Doobie`],
                        [82062, `And this one is`],
                        [82700, `for the champions`],
                        [85085, `I ain't lost since I began,`],
                        [87400, `yeah`],
                        [88000, `Funny how you said`],
                        [88767, `it was the end, yeah`],
                        [91362, `Then I went did it again, yeah`],
                        [94618, `I told you long ago`],
                        [96972, `on the road`],
                        [98241, `I got what they waiting for`],
                        [101235, `I don't run from nothing, dawg`],
                        [103400, `Get your soldiers,`],
                        [104592, `tell 'em I ain't laying low`],
                        [107666, `You was never really`],
                        [108696, `rooting for me anyway`],
                        [110213, `(ooh, ooh)`],
                        [110783, `When I'm back up at the top,`],
                        [111949, `I wanna hear you say`],
                        [113300, `(ooh, ooh)`],
                        [113916, `He dont run from nothing, dawg`],
                        [116107, `Get your soldiers,`],
                        [117319, `tell em that the break is over`],
                        [121000, `(yeah)`],
                        [121890, `My track record so clean,`],
                        [123869, `they couldn't wait`],
                        [124644, `to just bash me`],
                        [125479, `I must be getting too flashy,`],
                        [126896, `y'all shouldn't have`],
                        [127525, `let the world gas me (woo)`],
                        [128492, `It's too late 'cause`],
                        [129446, `I'm here to stay and`],
                        [130211, `these girls know that Im nasty`],
                        [131300, `(mm)`],
                        [131900, `I sent her back to`],
                        [132696, `her boyfriend with`],
                        [133284, `my handprint on her ass cheek`],
                        [136308, `City talking, we taking notes`],
                        [137966, `Tell 'em all to`],
                        [138581, `keep making posts`],
                        [139478, `Wish he could,`],
                        [140033, `but he can't get close`],
                        [141049, `OG so proud of me that he`],
                        [142554, `choking up while`],
                        [143487, `he making toasts`],
                        [144463, `I'm the type that`],
                        [145076, `you can't control,`],
                        [145796, `said I would then I made it so`],
                        [147969, `I don't clear up rumors (ayy),`],
                        [149612, `where's y'all sense of humor?`],
                        [150777, `(Ayy)`],
                        [151169, `I'm done making jokes 'cause`],
                        [152300, `they got old like baby boomers`],
                        [153971, `Turned my haters to consumers,`],
                        [155444, `I make vets feel`],
                        [156100, `like they juniors (juniors)`],
                        [156969, `Say your time is coming soon,`],
                        [158497, `but just like Oklahoma (mm)`],
                        [160800, `Mine is coming sooner (mm),`],
                        [162400, `I'm just a late bloomer (mm)`],
                        [164000, `I didn't peak in high school,`],
                        [164985, `I'm still out here`],
                        [165800, `getting cuter (woo)`],
                        [167164, `All these social`],
                        [167767, `networks and computers`],
                        [168965, `Got these pussies walking`],
                        [170169, `'round like they ain't losers`],
                        [171505, `I told you long ago`],
                        [173712, `on the road`],
                        [174991, `I got what they waiting for`],
                        [176700, `(I got what they waiting for)`],
                        [178109, `I don't run from nothing, dawg`],
                        [180227, `Get your soldiers,`],
                        [181498, `tell 'em I ain't laying low`],
                        [184098, `You was never really`],
                        [185307, `rooting for me anyway`],
                        [186666, `(ooh, ooh)`],
                        [187458, `When I'm back up at the top,`],
                        [188718, `I wanna hear you say`],
                        [189696, `(ooh, ooh)`],
                        [190326, `He dont run from nothing, dawg`],
                        [193013, `Get your soldiers,`],
                        [194304, `tell em that the break is over`],
                        [198000, `(yeah)`],
                        [202444, `I'm the industry baby, mmm`],
                        [204555, `(yeah)`],
                        [208888, `I'm the industry baby (yeah)`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Lollia_-_My_R_(Hydr0.org).mp3", audio: null, lyrics: [
                        [726, `Just as I was about`],
                        [1718, `to take my shoes`],
                        [3397, `Off of the rooftop,`],
                        [4459, `there I see`],
                        [5614, `A girl with braided hair`],
                        [6280, `here before me`],
                        [8003, `Despite myself,`],
                        [8575, `I go and scream`],
                        [10355, `Hey, don't do it, please!`],
                        [21521, `Whoa, wait a minute,`],
                        [22117, `what did I just say?`],
                        [23911, `I couldn't care less,`],
                        [24873, `either way`],
                        [26169, `To be honest,`],
                        [26569, `I was somewhat pissed`],
                        [28400, `This was an opportunity missed`],
                        [30718, `The girl with braided hair`],
                        [31474, `told me her woes`],
                        [32943, `You've probably`],
                        [33581, `heard it all before`],
                        [35222, `I really thought that`],
                        [35837, `he might be the one`],
                        [37462, `But then he told me`],
                        [38630, `he was done`],
                        [39757, `For God's sake, please!`],
                        [41508, `Are you serious?`],
                        [42755, `I just can't believe`],
                        [44095, `That for some stupid reason,`],
                        [45893, `you got here before me`],
                        [48643, `Are you upset`],
                        [50613, `'cause you can't have`],
                        [51663, `what you wanted?`],
                        [53226, `You're lucky that you've never`],
                        [55218, `gotten robbed of anything`],
                        [57953, `I'm feeling better,`],
                        [58696, `thank you for listening`],
                        [60075, `The girl with braided hair`],
                        [61775, `then disappeared`],
                        [67152, `Alright, today's the day,`],
                        [68325, `or so I thought`],
                        [69642, `Just as I took both`],
                        [70510, `of my shoes off`],
                        [71790, `There was but a girl,`],
                        [72587, `short as can be`],
                        [74112, `Despite myself,`],
                        [74828, `I go and scream`],
                        [76370, `The petite girl`],
                        [77224, `told me her woes`],
                        [78625, `You've probably`],
                        [79243, `heard it all before`],
                        [80955, `Everyone ignores me,`],
                        [82075, `everyone steals`],
                        [83262, `I dont fit in with anyone here`],
                        [85529, `For God's sake, please!`],
                        [87343, `Are you serious?`],
                        [88279, `I just can't believe`],
                        [89779, `That for some stupid reason`],
                        [91719, `you got here before me`],
                        [94464, `'Cause even so,`],
                        [96450, `you're still loved`],
                        [97115, `by everyone at home`],
                        [98918, `There's always dinner`],
                        [100325, `waiting on the table, you know`],
                        [103757, `I'm hungry, said the girl`],
                        [104601, `as she shed a tear`],
                        [105627, `The girl short as can be`],
                        [107543, `then disappeared`],
                        [109315, `And like that,`],
                        [110147, `there was someone every day`],
                        [112847, `I listened to their tale,`],
                        [115157, `I made them turn away`],
                        [117385, `And yet there was no one`],
                        [118733, `who would do this for me`],
                        [120713, `No way I could`],
                        [122072, `let out all this pain`],
                        [135795, `For the very first time,`],
                        [136931, `there I see`],
                        [138108, `Someone with the`],
                        [139069, `same pains as me`],
                        [140341, `Having done this`],
                        [141118, `time and time again`],
                        [142617, `She wore a yellow cardigan`],
                        [145025, `I just wanna stop the`],
                        [146098, `scars that grow`],
                        [147311, `Every time that I go home`],
                        [149552, `That's why I`],
                        [150169, `came up here instead`],
                        [151770, `That's what the girl`],
                        [152744, `in the cardigan said`],
                        [154081, `Whoa, wait a minute,`],
                        [154778, `what did I just say?`],
                        [156399, `I couldn't care less,`],
                        [157517, `either way`],
                        [158658, `But in the moment`],
                        [159686, `I just screamed`],
                        [160875, `Something that I`],
                        [161727, `could not believe`],
                        [163286, `Hey, don't do it, please!`],
                        [167744, `Ah, what to do?`],
                        [169493, `I can't stop this girl,`],
                        [170949, `oh this is new`],
                        [172104, `For once, I think I've`],
                        [173527, `bitten of more than I can chew`],
                        [176711, `But even so,`],
                        [178622, `please just go away,`],
                        [180055, `so I can't see`],
                        [181274, `Your pitiful expression`],
                        [183165, `is just too much for me`],
                        [185835, `I guess today is`],
                        [186971, `just not my day`],
                        [188125, `She looked away from me`],
                        [189247, `and then she disappeared`],
                        [192869, `There's no one here today,`],
                        [193800, `I guess it's time`],
                        [195297, `It's just me, myself and I`],
                        [197578, `There is no one`],
                        [198243, `who can interfere`],
                        [199852, `No one to get in my way here`],
                        [202142, `Taking off my yellow cardigan`],
                        [204442, `Watching my braids`],
                        [205400, `all come undone`],
                        [206661, `This petite girl,`],
                        [207265, `short as can be`],
                        [209033, `Is gonna jump now and be free`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/OMI_-_Cheerleader_Felix_Jaehn_Remix_Radio_Edit_(Hydr0.org).mp3", audio: null, lyrics: [
                        [16000, `When I need motivation`],
                        [18499, `My one solution is my queen`],
                        [20823, `'Cause she stay strong,`],
                        [22645, `yeah, yeah`],
                        [23913, `She is always in my corner`],
                        [26010, `Right there when I want her`],
                        [27943, `All these other`],
                        [28976, `girls are tempting`],
                        [29926, `But I'm empty when you're gone`],
                        [31900, `And they say`],
                        [32921, `Do you need me?`],
                        [34785, `Do you think I'm pretty?`],
                        [35994, `Do I make you feel`],
                        [37344, `like cheating?`],
                        [38369, `And I'm like no,`],
                        [39121, `not really 'cause`],
                        [40644, `Oh, I think that I found`],
                        [42981, `myself a cheerleader`],
                        [45346, `She is always right there`],
                        [47033, `when I need her`],
                        [48811, `Oh, I think that I found`],
                        [51063, `myself a cheerleader`],
                        [53371, `She is always right there`],
                        [55216, `when I need her`],
                        [56668, `She walks like a model`],
                        [59222, `She grants my wishes`],
                        [60467, `like a genie in a bottle,`],
                        [63335, `yeah, yeah`],
                        [64427, `'Cause I'm the wizard of love`],
                        [66706, `And I got the magic wand`],
                        [68500, `All these other`],
                        [69659, `girls are tempting`],
                        [70643, `But I'm empty when you're gone`],
                        [72495, `And they say`],
                        [73662, `Do you need me?`],
                        [75256, `Do you think I'm pretty?`],
                        [76798, `Do I make you feel`],
                        [78084, `like cheating?`],
                        [78900, `And I'm like no,`],
                        [79867, `not really 'cause`],
                        [81345, `Oh, I think that I found`],
                        [83703, `myself a cheerleader`],
                        [86008, `She is always right there`],
                        [87626, `when I need her`],
                        [89418, `Oh, I think that I found`],
                        [91696, `myself a cheerleader`],
                        [94047, `She is always right there`],
                        [95740, `when I need her`],
                        [129222, `Hmm, she gives me love`],
                        [130696, `and affection,`],
                        [132352, `baby, did I mention?`],
                        [134354, `You're the only girl for me,`],
                        [136032, `no, I don't need a next one`],
                        [138410, `Mama loves you too,`],
                        [139717, `she thinks I made`],
                        [140544, `the right selection`],
                        [142387, `Now all that's left to do`],
                        [143674, `is just for me to`],
                        [144850, `pop the question`],
                        [146471, `Oh, I think that I found`],
                        [148861, `myself a cheerleader`],
                        [151169, `She is always right there`],
                        [152728, `when I need her`],
                        [154508, `Oh, I think that I found`],
                        [156830, `myself a cheerleader`],
                        [159145, `She is always right there`],
                        [160952, `when I need her`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/yung_kai_-_yung_kai_-_blue_Official_Music_Video_(Hydr0.org).mp3", audio: null, lyrics: [
                        [19318, `Your morning eyes,`],
                        [21690, `I could stare`],
                        [22958, `like watching stars`],
                        [26200, `I could walk you by,`],
                        [29696, `and Ill tell without a thought`],
                        [32416, `You'd be mine,`],
                        [34571, `would you mind`],
                        [36518, `if I took your hand tonight?`],
                        [40574, `Know you're all`],
                        [41864, `that I want this life`],
                        [48134, `I'll imagine we fell in love`],
                        [50879, `I'll nap under`],
                        [51726, `moonlight skies with you`],
                        [54768, `I think I'll picture us,`],
                        [56408, `you with the waves`],
                        [58250, `The ocean's colors`],
                        [60042, `on your face`],
                        [61898, `I'll leave my heart`],
                        [63676, `with your air`],
                        [66316, `So let me fly with you`],
                        [69469, `Will you be forever with me?`],
                        [107151, `My love will always`],
                        [109128, `stay by you`],
                        [112900, `I'll keep it safe,`],
                        [115200, `so don't you worry a thing`],
                        [117969, `I'll tell you I love you more`],
                        [121831, `It's stuck with you forever,`],
                        [125319, `so promise you won't let it go`],
                        [128498, `I'll trust the universe`],
                        [130962, `will always bring me to you`],
                        [136721, `I'll imagine we fell in love`],
                        [139397, `I'll nap under`],
                        [140288, `moonlight skies with you`],
                        [143052, `I think I'll picture us,`],
                        [145012, `you with the waves`],
                        [146847, `The ocean's colors`],
                        [148625, `on your face`],
                        [150609, `I'll leave my heart`],
                        [152350, `with your air`],
                        [154900, `So let me fly with you`],
                        [158400, `Will you be forever with me?`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/BWO_-_Sunshine_In_The_Rain_Radio_Edit_(Hydr0.org).mp3", audio: null, lyrics: [
                        [14200, `When I'm in Berlin,`],
                        [15676, `you're off to London`],
                        [17826, `When I'm in New York,`],
                        [19439, `you're doing Rome`],
                        [21600, `All those crazy nights`],
                        [23224, `we spend together`],
                        [25408, `As voices on the phone`],
                        [29207, `Wishing we could`],
                        [30332, `be more telepathic`],
                        [33004, `Tired of the nights`],
                        [34371, `I sleep alone`],
                        [36677, `Wishing we could`],
                        [37698, `redirect the traffic`],
                        [40395, `And find ourselves a home`],
                        [44155, `Can you feel the`],
                        [45190, `raindrops in the desert?`],
                        [47750, `Have you seen the`],
                        [49010, `sunrays in the dark?`],
                        [51500, `Do you feel my love`],
                        [53132, `when I'm not present`],
                        [55326, `Standing by your side`],
                        [56933, `while miles apart?`],
                        [59034, `Sunshine in the rain,`],
                        [60889, `love is still the same`],
                        [62823, `Sunshine in the rain`],
                        [66500, `Sunshine in the rain,`],
                        [68424, `love is still the same`],
                        [70274, `Sunshine in the rain`],
                        [74247, `Even if we call`],
                        [75647, `the highest power`],
                        [77901, `We can only do one town a time`],
                        [81588, `Words are not enough,`],
                        [83133, `action speaks louder`],
                        [85400, `Second time around`],
                        [89001, `Can you feel the`],
                        [90299, `raindrops in the desert?`],
                        [92837, `Have you seen the`],
                        [93940, `sunrays in the dark?`],
                        [96544, `Do you feel my love`],
                        [98202, `when I'm not present`],
                        [100317, `Standing by your side`],
                        [101931, `while miles apart?`],
                        [104089, `Sunshine in the rain,`],
                        [105910, `love is still the same`],
                        [107816, `Sunshine in the rain`],
                        [109713, `(Sunshine in the rain)`],
                        [111589, `Sunshine in the rain,`],
                        [113387, `love is still the same`],
                        [115290, `Sunshine in the rain`],
                        [117229, `(Sunshine in the rain)`],
                        [133469, `When I'm in Berlin,`],
                        [135747, `you're off to London`],
                        [137695, `When I'm in New York,`],
                        [139409, `you're doing Rome`],
                        [141500, `All those crazy nights`],
                        [143219, `we spend together`],
                        [145319, `As voices on the phone`],
                        [149323, `Can you feel the`],
                        [150213, `raindrops in the desert?`],
                        [152791, `Have you seen the`],
                        [153964, `sunrays in the dark?`],
                        [156576, `Do you feel my love`],
                        [158165, `when I'm not present`],
                        [160411, `Standing by your side`],
                        [161935, `while miles apart?`],
                        [163979, `Sunshine in the rain,`],
                        [165850, `love is still the same`],
                        [167768, `Sunshine in the rain`],
                        [169605, `(Sunshine in the rain)`],
                        [171529, `Sunshine in the rain,`],
                        [173447, `love is still the same`],
                        [175305, `Sunshine in the rain`],
                        [177295, `(Sunshine in the rain)`],
                        [179101, `Can you feel the`],
                        [180251, `raindrops in the desert?`],
                        [182749, `Have you seen the`],
                        [183974, `sunrays in the dark?`],
                        [186509, `Do you feel my love`],
                        [188113, `when I'm not present`],
                        [190251, `Standing by your side`],
                        [191846, `while miles apart?`],
                        [193926, `Sunshine in the rain,`],
                        [195913, `love is still the same`],
                        [197747, `Sunshine in the rain`],
                        [199639, `(sunshine in the rain)`],
                        [201565, `Sunshine in the rain,`],
                        [203376, `love is still the same`],
                        [205369, `Sunshine in the rain`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Post_malone_-_Circles_(Hydr0.org).mp3", audio: null, lyrics: [
                        [32944, `We couldn't turn around`],
                        [36655, `'Til we were upside down`],
                        [40486, `I'll be the bad guy now`],
                        [44400, `But know I ain't too proud`],
                        [48222, `I couldn't be there`],
                        [52400, `Even when I tried`],
                        [56052, `You don't believe it`],
                        [59850, `We do this every time`],
                        [61700, `Seasons change and`],
                        [63030, `our love went cold`],
                        [65657, `Feed the flame 'cause`],
                        [66815, `we can't let go`],
                        [69480, `Run away,`],
                        [70393, `but we're running in circles`],
                        [73303, `Run away, run away`],
                        [75707, `I dare you to do something`],
                        [79469, `I'm waiting on you again`],
                        [82869, `So I don't take the blame`],
                        [84825, `Run away,`],
                        [85774, `but we're running in circles`],
                        [88717, `Run away, run away, run away`],
                        [92500, `Let go`],
                        [94369, `I got a feeling that`],
                        [95726, `it's time to let go`],
                        [99469, `I say so`],
                        [102081, `I knew that this was doomed`],
                        [103671, `from the get-go`],
                        [106543, `You thought that it was`],
                        [107463, `special, special`],
                        [110069, `But it was just the Sex,`],
                        [111805, `though, the Sex, though`],
                        [113890, `And I still hear the echoes`],
                        [116380, `(the echoes)`],
                        [117500, `I got a feeling that it's time`],
                        [119400, `to let it go, let it go`],
                        [123420, `Seasons change and`],
                        [124483, `our love went cold`],
                        [127155, `Feed the flame`],
                        [128056, `'cause we can't let go`],
                        [131042, `Run away,`],
                        [131953, `but we're running in circles`],
                        [134844, `Run away, run away`],
                        [137078, `I dare you to do something`],
                        [140928, `I'm waiting on you again`],
                        [144396, `So I don't take the blame`],
                        [146380, `Run away,`],
                        [147700, `but we're running in circles`],
                        [150295, `Run away, run away, run away`],
                        [154193, `Maybe you don't understand`],
                        [155795, `what I'm going through`],
                        [157969, `It's only me`],
                        [159888, `What you got to lose?`],
                        [161853, `Make up your mind, tell me`],
                        [163240, `What are you gonna do?`],
                        [165595, `It's only me`],
                        [167420, `Let it go`],
                        [169481, `Seasons change and`],
                        [170628, `our love went cold`],
                        [173296, `Feed the flame`],
                        [174285, `'cause we can't let go`],
                        [177132, `Run away,`],
                        [178091, `but we're running in circles`],
                        [180999, `Run away, run away`],
                        [183200, `I dare you to do something`],
                        [187000, `I'm waiting on you again`],
                        [190420, `So I don't take the blame`],
                        [192551, `Run away,`],
                        [193479, `but we're running in circles`],
                        [196456, `Run away, run away, run away`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Ledy_Gaga_-_Poker_face_(Hydr0.org).mp3", audio: null, lyrics: [
                        [7500, `Mum-mum-mum-mah`],
                        [11666, `Mum-mum-mum-mah`],
                        [15600, `Mum-mum-mum-mah`],
                        [19696, `Mum-mum-mum-mah`],
                        [23555, `Mum-mum-mum-mah`],
                        [24654, `I wanna hold 'em like`],
                        [25721, `they do in Texas, please (Woo)`],
                        [28369, `Fold 'em, let 'em hit me,`],
                        [29648, `raise it, baby, stay with me`],
                        [31440, `(I love it)`],
                        [32330, `LoveGame intuition,`],
                        [33677, `play the cards with`],
                        [34691, `spades to start`],
                        [36000, `And after he's been hooked,`],
                        [37399, `I'll play the one`],
                        [38376, `that's on his heart`],
                        [40569, `Oh, woah-oh, oh, oh`],
                        [42973, `Oh-oh-oh-oh-oh-oh`],
                        [44350, `I'll get him hot,`],
                        [45600, `show him what I've got`],
                        [48313, `Oh, woah-oh, oh, oh`],
                        [51103, `Oh-oh-oh-oh-oh-oh`],
                        [52335, `I'll get him hot,`],
                        [54114, `show him what I've got`],
                        [56715, `Can't read my, can't read my`],
                        [58586, `No, he cant read my poker face`],
                        [62427, `(She's got me like nobody)`],
                        [64748, `Can't read my, can't read my`],
                        [66620, `No, he cant read my poker face`],
                        [70553, `(She's got me like nobody)`],
                        [72792, `P-p-p-poker face,`],
                        [74156, `f-f-Fuck her face`],
                        [76000, `(Mum-mum-mum-mah)`],
                        [76878, `P-p-p-poker face,`],
                        [78270, `f-f-Fuck her face`],
                        [79882, `(Mum-mum-mum-mah)`],
                        [80951, `I wanna roll with him,`],
                        [82369, `a hard pair we will be (Woo)`],
                        [84700, `A little gamblin' is fun`],
                        [86898, `when you're with me`],
                        [88696, `(I love it, woo)`],
                        [89345, `Russian roulette is`],
                        [90169, `not the same without a gun`],
                        [92655, `And baby, when it's love,`],
                        [93849, `if its not rough, it isnt fun,`],
                        [96153, `fun`],
                        [96969, `Oh, woah-oh, oh, oh`],
                        [98623, `Oh-oh-oh-oh-oh-oh`],
                        [100808, `I'll get him hot,`],
                        [102286, `show him what I've got`],
                        [104800, `Oh, woah-oh, oh, oh`],
                        [106841, `Oh-oh-oh-oh-oh-oh`],
                        [109069, `I'll get him hot,`],
                        [110444, `show him what I've got`],
                        [113124, `Can't read my, can't read my`],
                        [115048, `No, he cant read my poker face`],
                        [118922, `(She's got me like nobody)`],
                        [121193, `Can't read my, can't read my`],
                        [123087, `No, he cant read my poker face`],
                        [126995, `(She's got me like nobody)`],
                        [129214, `P-p-p-poker face,`],
                        [130687, `f-f-Fuck her face`],
                        [132394, `(Mum-mum-mum-mah)`],
                        [133428, `P-p-p-poker face,`],
                        [134758, `f-f-Fuck her face`],
                        [136258, `(Mum-mum-mum-mah)`],
                        [140777, `(Mum-mum-mum-mah)`],
                        [144900, `I won't tell you`],
                        [145900, `that I love you`],
                        [147000, `Kiss or hug you`],
                        [147869, `'Cause I'm bluffin'`],
                        [148584, `with my muffin`],
                        [149637, `I'm not lyin',`],
                        [150541, `I'm just stunnin' with`],
                        [151899, `my love-glue-gunnin'`],
                        [153500, `Just like a chick`],
                        [154405, `in the casino`],
                        [155661, `Take your bank`],
                        [156475, `before I pay you out`],
                        [157978, `I promise this, promise this`],
                        [159982, `Check this hand`],
                        [160596, `'cause I'm marvelous`],
                        [161676, `Can't read my, can't read my`],
                        [163451, `No, he cant read my poker face`],
                        [167334, `(She's got me like nobody)`],
                        [169544, `Can't read my, can't read my`],
                        [171555, `No, he cant read my poker face`],
                        [175397, `(She's got me like nobody)`],
                        [177627, `Can't read my, can't read my`],
                        [179652, `No, he cant read my poker face`],
                        [183462, `(She's got me like nobody)`],
                        [185724, `Can't read my, can't read my`],
                        [187648, `No, he cant read my poker face`],
                        [191486, `(She's got me like nobody)`],
                        [193770, `Can't read my, can't read my`],
                        [195740, `No, he cant read my poker face`],
                        [199606, `(She's got me like nobody)`],
                        [201869, `Can't read my, can't read my`],
                        [203808, `No, he cant read my poker face`],
                        [207635, `(She's got me like nobody)`],
                        [209869, `P-p-p-poker face,`],
                        [211395, `f-f-Fuck her face`],
                        [213869, `P-p-p-poker face,`],
                        [215401, `f-f-Fuck her face`],
                        [216222, `(She's got me like nobody)`],
                        [217868, `P-p-p-poker face,`],
                        [219458, `f-f-Fuck her face`],
                        [220967, `(Mum-mum-mum-mah)`],
                        [222124, `P-p-p-poker face,`],
                        [223549, `f-f-Fuck her face`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Edward_Maya_ft._Vika_Jigulina_-_Stereo_love_(Hydr0.org).mp3", audio: null, lyrics: [
                        [4200, `When you gonna stop`],
                        [5770, `breaking my heart?`],
                        [11700, `I don't wanna be another one`],
                        [19300, `Paying for the`],
                        [20400, `things I never done`],
                        [25969, `Don't let go,`],
                        [27573, `don't let go to my love`],
                        [49300, `I think I found the one`],
                        [51007, `that'll hold my heart`],
                        [56869, `I wanna feel your heart,`],
                        [58686, `we're in love tonight`],
                        [60500, `I can fix all those lies`],
                        [62860, `Oh baby, baby, I run,`],
                        [64568, `but I'm running to you`],
                        [66696, `You won't see me cry,`],
                        [68569, `I'm hiding inside`],
                        [70373, `My heart is in pain,`],
                        [72111, `but I'm smiling for you`],
                        [76000, `Can I get to your soul?`],
                        [77777, `Can you get to my flow?`],
                        [79696, `Can we promise we wont let go?`],
                        [83500, `All the things that I need,`],
                        [85469, `all the things that you need`],
                        [87168, `You can make it feel so real`],
                        [91022, `'Cause you can't deny,`],
                        [92708, `you've blown my mind`],
                        [94637, `When I touch your body,`],
                        [96430, `I feel I'm losing control`],
                        [98358, `'Cause you can't deny,`],
                        [100096, `you've blown my mind`],
                        [102162, `When I see you baby,`],
                        [103906, `I just don't wanna let go`],
                        [106752, `(Oohh)`],
                        [109942, `When you gonna stop`],
                        [111609, `breaking my heart?`],
                        [117469, `I don't wanna be another one`],
                        [139966, `I think I found the one`],
                        [141800, `that'll hold my heart`],
                        [147606, `I wanna feel your heart,`],
                        [149379, `we're in love tonight`],
                        [151169, `I can fix all those lies`],
                        [153526, `Oh baby, baby, I run,`],
                        [155288, `but I'm running to you`],
                        [157479, `You won't see me cry,`],
                        [159310, `I'm hiding inside`],
                        [161190, `My heart is in pain,`],
                        [162868, `but I'm smiling for you`],
                        [165000, `Oh baby, I'll try`],
                        [166755, `to make the things right`],
                        [168688, `I need you more than air`],
                        [170305, `when I'm not with you`],
                        [172653, `Please don't ask me why,`],
                        [174385, `just kiss me this time`],
                        [176300, `My only dream`],
                        [178000, `is about you and I`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/The_Walters_-_I_Love_You_So_(Hydr0.org).mp3", audio: null, lyrics: [
                        [1250, `I just need someone in my life`],
                        [3969, `to give it structure`],
                        [7200, `To handle all the selfish ways`],
                        [9369, `I'd spend my time without her`],
                        [13600, `You're everything I want,`],
                        [14953, `but I can't deal`],
                        [16533, `with all your lovers`],
                        [20151, `You're saying I'm the one,`],
                        [21507, `but it's your actions`],
                        [23234, `that speak louder`],
                        [26700, `Giving me love when you are`],
                        [28854, `down and need another`],
                        [32722, `I've gotta get away an`],
                        [34300, `let you go, Ive gotta get over`],
                        [38915, `But I love you so`],
                        [42756, `(ooh-ooh-ooh)`],
                        [45312, `I love you so (ooh-ooh-ooh)`],
                        [51631, `I love you so (ooh-ooh-ooh)`],
                        [57929, `I love you so`],
                        [62500, `I'm gonna pack my things`],
                        [65933, `and leave you behind`],
                        [68850, `This feeling's old,`],
                        [70642, `and I know that`],
                        [72567, `I've made up my mind`],
                        [75079, `I hope you feel what I felt`],
                        [78529, `when you shattered my soul`],
                        [81332, `'Cause you were cruel,`],
                        [83000, `and I'm a fool,`],
                        [85000, `so please, let me go`],
                        [89569, `But I love you so`],
                        [92745, `(please, let me go)`],
                        [95978, `I love you so`],
                        [99107, `(please, let me go)`],
                        [102223, `I love you so`],
                        [106295, `(please, let me go)`],
                        [108659, `I love you so`],
                        [118169, `Ooh-ooh-ooh`],
                        [124500, `Ooh-ooh-ooh-ooh`],
                        [130696, `Ooh-ooh-ooh`],
                        [137195, `Ooh-ooh-ooh-ooh`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Sam_Gellaitry_-_Assumptions_(Hydr0.org).mp3", audio: null, lyrics: [
                        [60400, `If it's love that you want,`],
                        [62769, `I'll give my everything`],
                        [67800, `And have I made the`],
                        [68886, `right assumption?`],
                        [70819, `Do you feel the same?`],
                        [75756, `If it's love that you want,`],
                        [78300, `I'll give my everything`],
                        [83100, `And have I made the`],
                        [84030, `right assumption?`],
                        [86063, `Do you feel the same?`],
                        [121469, `If it's love that you want,`],
                        [124024, `I'll give my everything`],
                        [128900, `And have I made the`],
                        [129850, `right assumption?`],
                        [131661, `Do you feel the same?`],
                        [136600, `If it's love that you want,`],
                        [139287, `I'll give my everything`],
                        [143969, `And have I made the`],
                        [144889, `right assumption?`],
                        [146972, `Do you feel the same?`],
                        [167728, `Love that you want,`],
                        [169667, `I'll give my everything`],
                        [174469, `And have I made the`],
                        [175474, `right assumption?`],
                        [177398, `Do you feel the same?`],
                        [182400, `If it's love that you want,`],
                        [184800, `I'll give my everything`],
                        [189696, `And have I made the`],
                        [190600, `right assumption?`],
                        [192745, `Do you feel the same?`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/The_Weekend_-_Blinding_lights_(Hydr0.org).mp3", audio: null, lyrics: [
                        [13769, `Yeah`],
                        [27492, `I've been tryna call`],
                        [30043, `I've been on my own`],
                        [31269, `for long enough`],
                        [32800, `Maybe you can show me`],
                        [34169, `how to love, maybe`],
                        [38547, `I'm goin' through withdrawals`],
                        [41241, `You don't even have`],
                        [42242, `to do too much`],
                        [44119, `You can turn me on`],
                        [45082, `with just a touch, baby`],
                        [49691, `I look around and`],
                        [50693, `Sin City's cold and empty`],
                        [53121, `(oh)`],
                        [53705, `No one's around to judge me`],
                        [55880, `(oh)`],
                        [56304, `I can't see clearly`],
                        [57923, `when you're gone`],
                        [60842, `I said, ooh,`],
                        [63645, `I'm blinded by the lights`],
                        [66841, `No, I can't sleep until`],
                        [68631, `I feel your touch`],
                        [72172, `I said, ooh,`],
                        [75230, `I'm drowning in the night`],
                        [78004, `Oh, when I'm like this,`],
                        [79852, `you're the one I trust`],
                        [82123, `(Hey, hey, hey)`],
                        [94469, `I'm running out of time`],
                        [97366, `'Cause I can see the`],
                        [98220, `sun light up the sky`],
                        [100225, `So I hit the road`],
                        [101202, `in overdrive, baby, oh`],
                        [107000, `The city's cold and empty`],
                        [109269, `(oh)`],
                        [109807, `No one's around to judge me`],
                        [111900, `(oh)`],
                        [112512, `I can't see clearly`],
                        [114015, `when you're gone`],
                        [117000, `I said, ooh,`],
                        [120076, `I'm blinded by the lights`],
                        [122981, `No, I can't sleep until`],
                        [124924, `I feel your touch`],
                        [128169, `I said, ooh,`],
                        [131200, `I'm drowning in the night`],
                        [134146, `Oh, when I'm like this,`],
                        [136011, `you're the one I trust`],
                        [139600, `I'm just walking by to`],
                        [140696, `let you know`],
                        [141769, `(by to let you know)`],
                        [142300, `I could never say it`],
                        [143354, `on the phone`],
                        [144489, `(say it on the phone)`],
                        [145500, `Will never let you`],
                        [147000, `go this time`],
                        [150014, `(ooh)`],
                        [150696, `I said, ooh,`],
                        [153888, `I'm blinded by the lights`],
                        [156600, `No, I can't sleep until`],
                        [158606, `I feel your touch`],
                        [161000, `(Hey, hey, hey)`],
                        [172000, `(Hey, hey, hey)`],
                        [184369, `I said, ooh,`],
                        [187500, `I'm blinded by the lights`],
                        [190269, `No, I can't sleep until`],
                        [192304, `I feel your touch`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Sia_-_Cheap_Thrill_(Hydr0.org).mp3", audio: null, lyrics: [
                        [10883, `Come on, come on,`],
                        [11732, `turn the radio on`],
                        [13421, `It's Friday night`],
                        [14510, `and I won't be long`],
                        [15944, `Gotta do my hair,`],
                        [17139, `put my make up on`],
                        [18888, `It's Friday night`],
                        [19863, `and I won't be long`],
                        [21292, `'Til I hit the dance floor,`],
                        [23064, `hit the dance floor`],
                        [24248, `I got all I need`],
                        [26786, `No, I ain't got cash,`],
                        [28124, `I ain't got cash`],
                        [29483, `But I got you, baby`],
                        [31969, `Baby, I don't need dollar`],
                        [34169, `bills to have fun tonight`],
                        [35923, `(I love cheap thrills)`],
                        [37252, `Baby, I don't need dollar`],
                        [39407, `bills to have fun tonight`],
                        [41295, `(I love cheap thrills)`],
                        [43000, `I don't need no money`],
                        [48275, `As long as I can feel the beat`],
                        [53758, `I don't need no money`],
                        [59077, `As long as I keep dancing`],
                        [64400, `Come on, come on,`],
                        [65400, `turn the radio on`],
                        [66926, `It's Saturday`],
                        [68000, `and I won't be long`],
                        [69500, `Gotta paint my nails,`],
                        [70724, `put my high heels on`],
                        [72339, `It's Saturday`],
                        [73368, `and I won't be long`],
                        [74727, `'Til I hit the dance floor,`],
                        [76609, `hit the dance floor`],
                        [77854, `I got all I need`],
                        [80163, `No, I ain't got cash,`],
                        [81645, `I ain't got cash`],
                        [83017, `But I got you, baby`],
                        [85524, `Baby, I don't need dollar`],
                        [87653, `bills to have fun tonight`],
                        [89498, `(I love cheap thrills)`],
                        [91031, `Baby, I don't need dollar`],
                        [92982, `bills to have fun tonight`],
                        [94845, `(I love cheap thrills)`],
                        [96494, `I don't need no money`],
                        [102000, `As long as I can feel the beat`],
                        [107400, `I don't need no money`],
                        [112699, `As long as I keep dancing`],
                        [121700, `(I love cheap thrills)`],
                        [127200, `(I love cheap thrills)`],
                        [128820, `I don't need no money`],
                        [134086, `As long as I can feel the beat`],
                        [139501, `I don't need no money`],
                        [144800, `As long as I keep dancing`],
                        [149069, `(Oh, oh, oh)`],
                        [150300, `Baby, I don't need dollar`],
                        [152138, `bills to have fun tonight`],
                        [154025, `(I love cheap thrills)`],
                        [155500, `Baby, I don't need dollar`],
                        [157360, `bills to have fun tonight`],
                        [159213, `(I love cheap thrills)`],
                        [160736, `I don't need no money`],
                        [166313, `As long as I can feel the beat`],
                        [171761, `I don't need no money`],
                        [177068, `As long as I keep dancing`],
                        [182600, `La, la, la, la, la, la, la`],
                        [186969, `(I love cheap thrills)`],
                        [188169, `La, la, la, la, la, la, la`],
                        [191869, `(I love cheap thrills)`],
                        [193200, `La, la, la, la, la, la, la`],
                        [196700, `(I love cheap thrills)`],
                        [198708, `La, la, la, la, la, la, la`],
                        [202137, `(I love cheap thrills)`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/ATC_-_Atc_-_Around_The_World_(Hydr0.org).mp3", audio: null, lyrics: [
                        [8000, `The kisses of the sun`],
                        [10147, `were sweet, I didn't blink`],
                        [11527, `I let it in my eyes`],
                        [13736, `like an exotic dream`],
                        [15121, `The radio playing songs`],
                        [17420, `that I have never heard`],
                        [18690, `I don't know what to say,`],
                        [21036, `oh, not another word`],
                        [22326, `Just la la la la la,`],
                        [24696, `it goes around the world`],
                        [26049, `Just la la la la la,`],
                        [28404, `it's all around the world`],
                        [29673, `Just la la la la la,`],
                        [32012, `and everybody's singing`],
                        [33520, `La la la la la,`],
                        [35631, `and now the bells are ringing`],
                        [37125, `La la la la la,`],
                        [39296, `la la la la la la la,`],
                        [40765, `la la la la la,`],
                        [42868, `la la la la la la la`],
                        [44444, `La la la la la,`],
                        [46483, `la la la la la la la,`],
                        [48049, `la la la la la,`],
                        [50102, `la la la la la la la`],
                        [66222, `Inside an empty room,`],
                        [68365, `my inspiration flows`],
                        [69703, `Now wait to hear the tune,`],
                        [71970, `around my head it goes`],
                        [73363, `The magic melody,`],
                        [75643, `you want to sing with me`],
                        [76953, `Just la la la la la,`],
                        [79244, `the music is the key`],
                        [80618, `And now the night is gone,`],
                        [82896, `still it goes on and on`],
                        [84569, `So deep inside of me,`],
                        [86569, `I long to set it free`],
                        [87798, `I don't know what to do,`],
                        [90148, `just can't explain to you`],
                        [91520, `I don't know what to say,`],
                        [93719, `oh, not another word`],
                        [95102, `Just la la la la la,`],
                        [97370, `it goes around the world`],
                        [98686, `Just la la la la la,`],
                        [100998, `it's all around the world`],
                        [102346, `Just la la la la la,`],
                        [104654, `and everybody's singing`],
                        [106265, `La la la la la,`],
                        [108335, `and now the bells are ringing`],
                        [109934, `La la la la la,`],
                        [111990, `la la la la la la la,`],
                        [113570, `la la la la la,`],
                        [115638, `la la la la la la la`],
                        [117158, `La la la la la,`],
                        [119243, `la la la la la la la,`],
                        [120760, `la la la la la,`],
                        [122783, `la la la la la la la`],
                        [140666, `The kisses of the sun`],
                        [141800, `kisses of the sun,`],
                        [143170, `of the sun, of the sun`],
                        [146269, `Around, around, around,`],
                        [148656, `around, around, around,`],
                        [151500, `around the world`],
                        [155651, `La la la la la,`],
                        [157368, `it goes around the world`],
                        [158756, `Just la la la la la,`],
                        [160996, `it's all around the world`],
                        [162378, `Just la la la la la,`],
                        [164677, `and everybody's singing`],
                        [166255, `La la la la la,`],
                        [168325, `and now the bells are ringing`],
                        [169839, `La la la la la,`],
                        [171969, `la la la la la la la,`],
                        [173548, `la la la la la,`],
                        [175599, `la la la la la la la`],
                        [176854, `La la la la la,`],
                        [179229, `la la la la la la la,`],
                        [180845, `la la la la la,`],
                        [182973, `la la la la la la la`],
                        [184457, `La la la la la,`],
                        [186209, `la la la la la la la`],
                        [188100, `La la la la la,`],
                        [190191, `la la la la la la la,`],
                        [191725, `La la la la la,`],
                        [193897, `la la la la la la la`],
                        [195401, `La la la la la,`],
                        [197444, `la la la la la la la`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Edward_Sharpe_The_Magnetic_Zeros_-_Home_o1day_(Hydr0.org).mp3", audio: null, lyrics: [
                        [18904, `Alabama, Arkansas`],
                        [21420, `I do love my ma and pa`],
                        [23135, `Not that way that`],
                        [24222, `I do love you`],
                        [27329, `Well, holy moly, me oh my`],
                        [29568, `You're the apple of my eye`],
                        [31750, `Girl, I've never`],
                        [32802, `loved one like you`],
                        [35957, `Man, oh man,`],
                        [36756, `you're my best friend`],
                        [38000, `I scream it to`],
                        [38852, `the nothingness`],
                        [40696, `There aint nothing that I need`],
                        [44250, `Well, hot and heavy,`],
                        [45575, `pumpkin pie`],
                        [46620, `Chocolate candy,`],
                        [47712, `Jesus Christ`],
                        [48843, `Ain't nothing please`],
                        [50100, `me more than you`],
                        [52800, `Oh, home, let me come home`],
                        [57269, `Home is wherever I'm with you`],
                        [61250, `Oh, home, let me come home`],
                        [65835, `Home is wherever I'm with you`],
                        [84969, `La, la, la, la, take me home`],
                        [90069, `(Daddy) Mother, Im coming home`],
                        [114200, `I'll follow you into the park`],
                        [116453, `Through the jungle,`],
                        [117525, `through the dark`],
                        [118687, `Girl, I never`],
                        [119678, `loved one like you (hey)`],
                        [122943, `Moats and boats and waterfalls`],
                        [125210, `Alleyways and pay phone calls`],
                        [127420, `I've been everywhere`],
                        [129200, `(hey) with you`],
                        [130569, `That's true,`],
                        [131696, `laugh until we think we'll die`],
                        [133869, `Barefoot on a summer night`],
                        [135918, `Never could be sweeter`],
                        [137469, `than with you (hey)`],
                        [140200, `And in the streets`],
                        [141174, `you run a-free`],
                        [142452, `Like it's only you and me`],
                        [144654, `Geez, you're something to see`],
                        [148395, `Oh, home, let me come home`],
                        [153334, `Home is wherever I'm with you`],
                        [157269, `Oh, home, let me come home`],
                        [161840, `Home is wherever I'm with you`],
                        [181000, `La, la, la, la, take me home`],
                        [186532, `(Daddy) Mother, Im coming home`],
                        [193933, `Jade`],
                        [194859, `Alexander`],
                        [196300, `Do you remember that day`],
                        [197379, `you fell out of my window?`],
                        [198899, `I sure do, you came`],
                        [199956, `jumping out after me`],
                        [202000, `Well, you fell on the concrete`],
                        [204123, `nearly broke your ass`],
                        [205117, `And you were bleedin'`],
                        [206015, `all over the place`],
                        [206983, `And I rushed you out to the`],
                        [208067, `hospital, you remember that?`],
                        [209311, `Yes, I do`],
                        [210300, `Well, theres something I never`],
                        [211270, `told you about that night`],
                        [212757, `What didn't you tell me?`],
                        [214222, `While you were sitting in the`],
                        [215200, `backseat smoking a cigarette`],
                        [217038, `You thought was gonna`],
                        [217847, `be your last`],
                        [219500, `I was falling deep,`],
                        [221192, `deeply in love with you`],
                        [223400, `And I never told you`],
                        [224800, `'til just now`],
                        [225901, `Aww`],
                        [227545, `Oh, home, let me come home`],
                        [231988, `Home is wherever I'm with you`],
                        [235866, `Oh, home, let me come home`],
                        [240696, `Home is where I'm`],
                        [242000, `alone with you`],
                        [244780, `Home, let me come home`],
                        [249397, `Home is wherever I'm with you`],
                        [253686, `Oh, home, yes, I am home`],
                        [258716, `Home is when I'm`],
                        [260275, `alone with you`],
                        [263289, `Alabama, Arkansas`],
                        [267569, `I do love my ma and pa`],
                        [271618, `Moats and boats and waterfalls`],
                        [275960, `Alleyways and pay phone calls`],
                        [284569, `Home is when`],
                        [285600, `I'm alone with you`],
                        [293000, `Home is when`],
                        [294081, `I'm alone with you`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Unknown%20Brain,%20Marvin%20Divine%20-%20MATAFAKA%20(feat.%20Marvin%20Divine)%20%5BNCS%20Release%5D.mp3", audio: null, lyrics: [
                        [27769, `Matafaka, matafaka`],
                        [48000, `Matafaka, matafaka`],
                        [90696, `Uh, thank God that`],
                        [91960, `the brother's on the rise now`],
                        [93777, `Endless celebrations`],
                        [94772, `all at my house`],
                        [96300, `Levitatin' now I'm`],
                        [96935, `super duper fly now`],
                        [98696, `Lemon boy but they`],
                        [99560, `see why I reside now`],
                        [100900, `Put the time in while you`],
                        [102064, `always yellin' time out`],
                        [103700, `Fa critic 'cause I`],
                        [104218, `know I'm comin' wit it`],
                        [105761, `You were sittin`],
                        [106387, `you were wishin,`],
                        [106939, `I was handlin' my business`],
                        [108300, `Now I got the ball like`],
                        [109300, `Harry Potter playin' Quidditch`],
                        [110625, `And my nuts are so humongous`],
                        [111722, `you would think that`],
                        [112514, `Hagrid's in it`],
                        [113200, `Ah man, I'm all bad,`],
                        [114721, `yeah I'm all bad`],
                        [115888, `Workin' for that whip, yeah`],
                        [116989, `that what you call that`],
                        [118202, `I'ma blow up in the summer`],
                        [119437, `have 'em yellin', "Fall back"`],
                        [120643, `And I've always been ahead`],
                        [121978, `like an effin ball cap`],
                        [123304, `Man, I came in the`],
                        [124329, `game like, "Woah"`],
                        [125331, `Gotta couple chains on`],
                        [126412, `me 'cause I like gold`],
                        [127747, `They told me I'm the best,`],
                        [128733, `and I told 'em, "I know"`],
                        [130350, `'Cause when I'm in your`],
                        [131188, `town every ticket I sold`],
                        [133589, `Yeah, they sayin' I'm`],
                        [134808, `the man, facts bro`],
                        [136591, `A lot of haters, tell`],
                        [137706, `me where they at though`],
                        [138864, `I'm the new pop all`],
                        [140018, `I do is rap dough`],
                        [141365, `"Want me on your song?"`],
                        [142492, `Throw a couple stacks yo`],
                        [144500, `Everybody wanna`],
                        [145336, `do the same thing`],
                        [146754, `That's why we ain't`],
                        [148081, `on the same page`],
                        [149348, `Do my own thing,`],
                        [150200, `and I maintain`],
                        [151764, `Flow like water so`],
                        [152842, `I'm goin' mainstream`],
                        [155308, `I'm goin' mainstream`],
                        [156888, `Flow like water so`],
                        [157848, `I'm goin' mainstream`],
                        [160095, `Yeah, I'm goin' mainstream`],
                        [161840, `Flow like water so`],
                        [163000, `I'm goin' mainstream`],
                        [165600, `I'm going mainstream`],
                        [168300, `Mainstream`],
                        [172000, `Flow like water so`],
                        [173064, `I'm goin' mainstream`],
                        [177000, `Yup`],
                        [183615, `I'm goin' mainstream`],
                        [186930, `Damn`],
                        [192115, `Flow like water so`],
                        [193132, `I'm goin' mainstream`],
                        [196813, `Wooh`],
                        [203444, `I'm goin' mainstream`],
                        [212400, `Flow like water so`],
                        [213421, `I'm goin' mainstream`],
                        [215000, `They sayin' I'm`],
                        [215696, `the man, facts bro`],
                        [217369, `A lot of haters, tell`],
                        [218700, `me where they at though`],
                        [220000, `I'm the new pop all`],
                        [221080, `I do is rap dough`],
                        [222233, `"Want me on your song?"`],
                        [223270, `Throw a couple stacks yo`],
                        [225138, `Everybody wanna`],
                        [226185, `do the same thing`],
                        [227662, `That's why we ain't`],
                        [228949, `on the same page`],
                        [230224, `Do my own thing,`],
                        [231500, `and I maintain`],
                        [232585, `Flow like water so`],
                        [233700, `I'm goin' mainstream`],
                        [236488, `I'm goin' mainstream`],
                        [237842, `Flow like water so`],
                        [238658, `I'm goin' mainstream`],
                        [240700, `Yeah, I'm goin' mainstream`],
                        [242696, `Flow like water so`],
                        [243800, `I'm goin' mainstream`],
                        [246489, `I'm goin' mainstream`],
                        [249308, `Mainstream`],
                        [252903, `Flow like water so`],
                        [253917, `I'm goin' mainstream`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/nae%20nae%20niga.mp3", audio: null, lyrics: [
                        [8895, `Zen me neng ku ne`],
                        [11200, `yi que hui hao da`],
                        [13800, `yi qie dou qu ba`],
                        [16252, `ni jiu de xiang zhe`],
                        [18750, `ji ran mei ban fa`],
                        [21295, `hai hen ta gan ma`],
                        [23751, `hai guan ta gan ma`],
                        [26166, `xin li yao ji de`],
                        [29600, `ni shi nae niga`],
                        [30400, `nae nae niga niga nae nae`],
                        [32300, `nae niga nae nae niga niga`],
                        [34000, `nae nae`],
                        [34609, `yang guang cai hong`],
                        [35868, `xiao bai ma`],
                        [37014, `nae niga nae niga`],
                        [39615, `wo shi nae niga nae nae`],
                        [40802, `niga niga nae nae`],
                        [42133, `nae niga nae nae niga niga`],
                        [44003, `nae nae`],
                        [44653, `yang guang cai hong`],
                        [46033, `xiao bai ma`],
                        [47300, `nae niga nae niga`],
                        [50169, `Hey, hey, hey, hey!`],
                        [52178, `Wooh, Wooh!`],
                        [57400, `nae niga nae niga`],
                        [77564, `yang guang cai hong`],
                        [78354, `xiao bai ma`],
                        [79719, `ni shi zui qiang da`],
                        [80517, `zui bang da`],
                        [80992, `zui liang da`],
                        [81591, `zui fa guang da`],
                        [82180, `lan bu zhu ni fa ya`],
                        [84336, `ni shi zui hao da`],
                        [85276, `zui qiao da`],
                        [85914, `zui miao da`],
                        [86630, `zui jiao ao da`],
                        [87243, `jin qing de sheng kai ba`],
                        [89038, `ni jiu shi`],
                        [89690, `zui xiang da`],
                        [90297, `zui bang da`],
                        [90917, `zui liang da`],
                        [91551, `zui fa guang da`],
                        [92220, `xin xu yao ni hong ta`],
                        [94604, `ni shi zui hao da`],
                        [95302, `zui qiao da`],
                        [95937, `zui miao da`],
                        [96563, `zui jiao ao da`],
                        [97263, `yang guang cai hong`],
                        [98401, `xiao bai ma`],
                        [103666, `sheng huo shi xiao hua`],
                        [106094, `bie ku zhe ting ta`],
                        [108657, `bie zai yi beng kua`],
                        [111163, `bu le shi ni sha`],
                        [113753, `xin yao ni hong ta`],
                        [116167, `yi qie hui hao da`],
                        [118635, `yi qie dou lai ba`],
                        [121270, `tian di sui ni shua`],
                        [124497, `ni shi nae niga`],
                        [125275, `nae nae niga niga nae nae`],
                        [127154, `nae niga nae nae niga niga`],
                        [128975, `nae nae`],
                        [129601, `yang guang cai hong`],
                        [130916, `xiao bai ma`],
                        [132101, `nae niga nae niga`],
                        [134470, `wo shi nae niga`],
                        [135321, `nae nae niga niga nae nae`],
                        [137115, `nae niga nae nae niga niga`],
                        [138971, `nae nae`],
                        [139607, `yang guang cai hong`],
                        [140881, `xiao bai ma`],
                        [142066, `nae niga nae niga`],
                        [145169, `Hey, hey, hey, hey!`],
                        [147208, `Wooh, wooh!`],
                        [152153, `nae niga nae niga, hey!`],
                        [172400, `yang guang cai hong`],
                        [173385, `xiao bai ma`],
                        [174569, `ni shi zui qiang da`],
                        [175347, `zui bang da`],
                        [175952, `zui liang da`],
                        [176554, `zui fa guang da`],
                        [177247, `lan bu zhu ni fa ya`],
                        [179387, `ni shi zui hao da`],
                        [180228, `zui qiao da`],
                        [180949, `zui miao da`],
                        [181574, `zui jiao ao da`],
                        [182227, `jin qing de sheng kai ba`],
                        [184067, `ni jiu shi`],
                        [184711, `zui xiang da`],
                        [185343, `zui bang da`],
                        [185933, `zui liang da`],
                        [186550, `zui fa guang da`],
                        [187179, `xin xu yao ni hong ta`],
                        [189452, `ni shi zui hao da`],
                        [190268, `zui qiao da`],
                        [190975, `zui miao da`],
                        [191571, `zui jiao ao da`],
                        [192170, `yang guang cai hong`],
                        [193399, `xiao bai ma`],
                        [194696, `ni shi zui qiang da`],
                        [195307, `zui bang da`],
                        [195957, `zui liang da`],
                        [196567, `zui fa guang da`],
                        [197189, `lan bu zhu ni fa ya`],
                        [199358, `ni shi zui hao da`],
                        [200265, `zui qiao da`],
                        [201047, `zui miao da`],
                        [201601, `zui jiao ao da`],
                        [202185, `jin qing de sheng kai ba`],
                        [204069, `ni jiu shi`],
                        [204751, `zui xiang da`],
                        [205406, `zui bang da`],
                        [205977, `zui liang da`],
                        [206586, `zui fa guang da`],
                        [207242, `xin xu yao ni hong ta`],
                        [209506, `ni shi zui hao da`],
                        [210288, `zui qiao da`],
                        [210953, `zui miao da`],
                        [211569, `zui jiao ao da`],
                        [212197, `yang guang cai hong`],
                        [213397, `xiao bai ma`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Eminem_-_Mockingbird_(Hydr0.org).mp3", audio: null, lyrics: [
                        [2500, `Yeah`],
                        [4660, `I know sometimes`],
                        [6069, `Things may not always make`],
                        [7694, `sense to you right now`],
                        [10280, `But hey`],
                        [11950, `What Daddy always tell you?`],
                        [13956, `Straighten up, little soldier`],
                        [16466, `Stiffen up that upper lip`],
                        [19223, `What you cryin' about?`],
                        [21145, `You got me`],
                        [22300, `Hailie, I know you`],
                        [22990, `miss your mom,`],
                        [23812, `and I know you miss your dad`],
                        [25230, `When I'm gone, but I'm tryin'`],
                        [26202, `to give you the life`],
                        [26988, `that I never had`],
                        [28300, `I can see you're sad,`],
                        [28992, `even when you smile,`],
                        [30016, `even when you laugh`],
                        [31106, `I can see it in your eyes,`],
                        [32590, `deep inside you wanna cry`],
                        [33960, `'Cause you're scared,`],
                        [34686, `I ain't there, Daddy's wit'`],
                        [35379, `you in your prayers`],
                        [36623, `No more cryin',`],
                        [37405, `wipe them tears,`],
                        [38246, `Daddys here no more nightmares`],
                        [39615, `We gon' pull together`],
                        [40569, `through it, we gon' do it`],
                        [41752, `Lainie, Uncles crazy, aint he?`],
                        [43044, `Yeah, but he loves you, girl,`],
                        [44353, `and you better know it`],
                        [45323, `We're all we got in this world`],
                        [46579, `when it spins, when it swirls`],
                        [48098, `When it whirls, when it twirls`],
                        [49552, `two little beautiful girls`],
                        [51028, `Lookin' puzzled, in a daze,`],
                        [52361, `I know it's confusin' you`],
                        [53903, `Daddy's always on the move,`],
                        [55245, `Mama's always on the news`],
                        [56575, `I try to keep you sheltered`],
                        [57715, `from it, but somehow it seems`],
                        [59082, `The harder that I try`],
                        [59969, `to do that, the more`],
                        [60864, `it backfires on me`],
                        [61833, `All the things growin' up`],
                        [63335, `as Daddy that he had to see`],
                        [64708, `Daddy don't want you to see,`],
                        [66154, `but you see just as`],
                        [67046, `much as he did`],
                        [67926, `We did not plan it to be`],
                        [68888, `this way, your mother and me`],
                        [70435, `But things have got`],
                        [71106, `so bad between us, I don't`],
                        [72044, `see us ever bein' together`],
                        [73793, `ever again, like we used to`],
                        [75468, `be when we was teenagers`],
                        [76593, `But then, of course,`],
                        [77523, `everything always happens`],
                        [78831, `for a reason, I guess it was`],
                        [80170, `never meant to be`],
                        [81453, `But it's just somethin we have`],
                        [82548, `no control over, and that's`],
                        [83668, `what destiny is`],
                        [84602, `But no more worries,`],
                        [86073, `rest your head and go to sleep`],
                        [87303, `Maybe one day we'll wake up`],
                        [88708, `and thisll all just be a dream`],
                        [90204, `Now hush, little baby,`],
                        [92111, `don't you cry`],
                        [93499, `Everything's gonna be alright`],
                        [94800, `Stiffen that upper lip up,`],
                        [96705, `little lady, I told ya`],
                        [98402, `Daddy's here to hold ya`],
                        [99801, `through the night`],
                        [101108, `I know Mommy's not here`],
                        [102407, `right now and we dont know why`],
                        [104610, `We feel how we feel inside`],
                        [106486, `It may seem a little`],
                        [107675, `crazy, pretty baby`],
                        [109571, `But I promise Mama's`],
                        [111158, `gon' be alright`],
                        [112282, `Heh, it's funny`],
                        [113205, `I remember back one year when`],
                        [114970, `Daddy had no money`],
                        [116155, `Mommy wrapped the Christmas`],
                        [116999, `presents up and stuck 'em`],
                        [118014, `under the tree and said`],
                        [119100, `some of 'em were from me cause`],
                        [120211, `Daddy couldn't buy 'em`],
                        [121540, `Ill never forget that Chrismas`],
                        [122940, `I sat up the whole night`],
                        [124229, `crying cause Daddy felt`],
                        [125658, `like a bum see Daddy had a job`],
                        [126494, `But his job was to keep the`],
                        [128128, `food on the table for`],
                        [129196, `you and Mom and at the time,`],
                        [131111, `every house that we lived in`],
                        [132514, `Either kept gettin`],
                        [133400, `broken into and robbed or`],
                        [134869, `shot up on the block`],
                        [136000, `And your Mom was savin'`],
                        [137162, `money for you in a jar`],
                        [138696, `Tryin to start a piggy bank`],
                        [139884, `for you so you could`],
                        [140750, `go to college`],
                        [141465, `Almost had a thousand dollars`],
                        [142736, `til someone broke in`],
                        [144261, `and stole it an I know it hurt`],
                        [145577, `so bad it broke`],
                        [146341, `your Mama's heart`],
                        [147420, `And it seemed like everything`],
                        [148366, `was just startin to fall apart`],
                        [150200, `Mom and Dad was arguin' a lot`],
                        [151856, `So Mama moved back on to`],
                        [153313, `Chalmers in the flat,`],
                        [154425, `one-bedroom apartment`],
                        [155880, `And Dad moved back to the`],
                        [157000, `other side of 8 Mile on Novara`],
                        [158457, `And that's when Daddy went`],
                        [159775, `to California with his CD`],
                        [161518, `And met Dr. Dre, and flew`],
                        [162489, `you and Mama out to see me`],
                        [164118, `But Daddy had to work,`],
                        [165668, `you and Mama had to leave me`],
                        [167119, `Then you started seein`],
                        [168026, `Daddy on the TV`],
                        [169041, `And Mama didn't like it`],
                        [170491, `And you and Lainie were`],
                        [171657, `too young to understand it`],
                        [172886, `Papa was a rolling stone,`],
                        [174245, `Mama developed a habit`],
                        [175658, `And it all happened too fast`],
                        [177078, `for either one o us to grab it`],
                        [178465, `I'm just sorry you were there`],
                        [179870, `an had to witness it firsthand`],
                        [181304, `'Cause all I ever wanted to do`],
                        [182669, `was just make you proud`],
                        [184025, `Now I'm sittin' in this`],
                        [185275, `empty house just reminiscin'`],
                        [187070, `Lookin' at your baby pictures,`],
                        [188546, `it just trips me out`],
                        [189473, `To see how much you both`],
                        [190526, `have grown, it's almost like`],
                        [191481, `you're sisters now`],
                        [192969, `Wow, guess you pretty much are`],
                        [194732, `and Daddy's still here`],
                        [195851, `Lainie, I'm talkin' to you too`],
                        [197500, `Daddy's still here`],
                        [198829, `I like the sound of that, yeah`],
                        [200125, `its got a ring to it, dont it?`],
                        [201722, `Shh, Mama's only gone`],
                        [203030, `for the moment`],
                        [203962, `Now hush, little baby,`],
                        [205482, `don't you cry`],
                        [207053, `Everything's gonna be alright`],
                        [208832, `Stiffen that upper lip up,`],
                        [210235, `little lady, I told ya`],
                        [211972, `Daddy's here to hold ya`],
                        [213332, `through the night`],
                        [214487, `I know Mommy's not here`],
                        [215875, `right now and we dont know why`],
                        [218281, `We feel how we feel inside`],
                        [220129, `It may seem a little`],
                        [221169, `crazy, pretty baby`],
                        [223155, `But I promise Mama's`],
                        [224627, `gon' be alright`],
                        [225865, `And if you ask me to, Daddy's`],
                        [227328, `gonna buy you a mockingbird`],
                        [229718, `I'ma give you the world`],
                        [231082, `I'ma buy a diamond ring`],
                        [233000, `for you, I'ma sing for you`],
                        [234532, `I'll do anything for you`],
                        [236016, `to see you smile`],
                        [237228, `And if that mockingbird don't`],
                        [238843, `sing and that ring don't shine`],
                        [240982, `I'ma break that birdie's neck`],
                        [242699, `I'll go back to the`],
                        [243868, `jeweler who sold it to ya`],
                        [245633, `And make him eat every carat,`],
                        [247342, `don't fuck with Dad`],
                        [248564, `(Haha)`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Yungatina_-_7_Weeks_3_Days_(Hydr0.org).mp3", audio: null, lyrics: [
                        [15469, `When we met, I just knew`],
                        [18004, `That I already loved you,`],
                        [19907, `true, true`],
                        [22551, `I didn't even get it why`],
                        [26231, `Why you gotta stare`],
                        [27544, `with those eyes?`],
                        [30013, `I'm right across`],
                        [30735, `the dance floor`],
                        [32735, `Like it was just last night`],
                        [37240, `I didn't even get it why`],
                        [41076, `Why you gotta say goodbye?`],
                        [44700, `I should have called`],
                        [45400, `him by his last name`],
                        [47333, `It's been seven weeks`],
                        [48800, `and three days`],
                        [52110, `I should have called`],
                        [52836, `him by his last name`],
                        [55555, `It's been seven weeks`],
                        [56950, `and three days`],
                        [59519, `I should have called`],
                        [60300, `him by his last name`],
                        [62100, `It's been seven weeks`],
                        [63700, `and three days`],
                        [66830, `I should have called`],
                        [67542, `him by his last name`],
                        [70615, `It's been seven weeks`],
                        [71693, `and three days`],
                        [74500, `Boy, I let you in`],
                        [76969, `You didn't even have to knock`],
                        [81629, `An extra key on the first day`],
                        [85519, `I know the sheets`],
                        [86166, `by the first date`],
                        [89000, `We really made somethin'`],
                        [91869, `A miracle that most won't see`],
                        [96345, `But it meant a lot to me`],
                        [100109, `I don't get why you`],
                        [101018, `had to leave`],
                        [103768, `I should have called`],
                        [104521, `him by his last name`],
                        [106400, `It's been seven weeks`],
                        [107973, `and three days`],
                        [111125, `I should have called`],
                        [111856, `him by his last name`],
                        [114923, `It's been seven weeks`],
                        [116039, `and three days`],
                        [118539, `I should have called`],
                        [119300, `him by his last name`],
                        [121400, `It's been seven weeks`],
                        [122790, `and three days`],
                        [125950, `I should have called`],
                        [126769, `him by his last name`],
                        [129588, `It's been seven weeks`],
                        [130772, `and three days`],
                        [133396, `All my friends say, Fuck you!`],
                        [136060, `But I can't even help`],
                        [137459, `but love you`],
                        [140736, `And even though you`],
                        [141636, `run me out dry`],
                        [144400, `I still think you're`],
                        [145200, `a decent guy, why?`],
                        [162979, `I should have called`],
                        [163662, `him by his last name`],
                        [165500, `It's been seven weeks`],
                        [166881, `and three days`],
                        [170180, `I should have called`],
                        [170973, `him by his last name`],
                        [173911, `It's been seven weeks`],
                        [175137, `and three days`],
                        [177631, `I should have called`],
                        [178249, `him by his last name`],
                        [181276, `It's been seven weeks`],
                        [182558, `and three days`],
                        [184969, `I should have called`],
                        [185700, `him by his last name`],
                        [187900, `It's been seven weeks`],
                        [189150, `and three days, days`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/ABBA_-_Gimme_Gimme_Gimme_A_Man_After_Midnight_(Hydr0.org).mp3", audio: null, lyrics: [
                        [36154, `Half past twelve`],
                        [38000, `And I'm watchin' the late show`],
                        [39927, `in my flat, all alone`],
                        [41861, `How I hate to spend`],
                        [42969, `the evening on my own`],
                        [46500, `Autumn winds`],
                        [47863, `Blowin' outside the window`],
                        [49851, `as I look around the room`],
                        [51900, `And it makes me so depressed`],
                        [53607, `to see the gloom`],
                        [57000, `There's not a soul out there`],
                        [60844, `No one to hear my prayer`],
                        [68506, `Gimme, gimme, gimme`],
                        [69925, `a man after midnight`],
                        [72489, `Won't somebody help me`],
                        [74042, `chase these shadows away?`],
                        [76630, `Gimme, gimme, gimme`],
                        [78054, `a man after midnight`],
                        [80310, `Take me through the darkness`],
                        [81940, `to the break of the day`],
                        [104666, `Movie stars`],
                        [106200, `Find the end of the rainbow`],
                        [108198, `with a fortune to win`],
                        [109961, `It's so different from`],
                        [111291, `the world I'm living in`],
                        [114765, `Tired of TV`],
                        [116600, `I open the window`],
                        [118221, `and I gaze into the night`],
                        [120176, `But there's nothing`],
                        [121208, `there to see, no one in sight`],
                        [125400, `There's not a soul out there`],
                        [129180, `No one to hear my prayer`],
                        [136897, `Gimme, gimme, gimme`],
                        [138365, `a man after midnight`],
                        [140688, `Won't somebody help me`],
                        [142380, `chase these shadows away?`],
                        [144997, `Gimme, gimme, gimme`],
                        [146500, `a man after midnight`],
                        [148517, `Take me through the darkness`],
                        [150330, `to the break of the day`],
                        [153273, `Gimme, gimme, gimme`],
                        [154461, `a man after midnight`],
                        [161278, `Gimme, gimme, gimme`],
                        [162487, `a man after midnight`],
                        [220555, `There's not a soul out there`],
                        [224478, `No one to hear my prayer`],
                        [232240, `Gimme, gimme, gimme`],
                        [233628, `a man after midnight`],
                        [236180, `Won't somebody help me`],
                        [237630, `chase these shadows away?`],
                        [240256, `Gimme, gimme, gimme`],
                        [241650, `a man after midnight`],
                        [243998, `Take me through the darkness`],
                        [245584, `to the break of the day`],
                        [248150, `Gimme, gimme, gimme`],
                        [249645, `a man after midnight`],
                        [251905, `Won't somebody help me`],
                        [253531, `chase these shadows away?`],
                        [256205, `Gimme, gimme, gimme`],
                        [257617, `a man after midnight`],
                        [259823, `Take me through the darkness`],
                        [261543, `to the break of the day`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/One_Direction_-_What_Makes_You_Beautiful_(Hydr0.org).mp3", audio: null, lyrics: [
                        [6755, `You're insecure,`],
                        [8671, `don't know what for`],
                        [10589, `You're turnin' heads`],
                        [11748, `when you walk through the door`],
                        [14387, `Don't need makeup`],
                        [16391, `to cover up (Huh)`],
                        [18249, `Bein' the way`],
                        [19524, `that you are is enough`],
                        [22869, `Everyone else in the`],
                        [24627, `room can see it`],
                        [26577, `Everyone else but you`],
                        [29762, `Baby, you light up my world`],
                        [31726, `like nobody else`],
                        [33550, `The way that you flip your`],
                        [35237, `hair gets me overwhelmed`],
                        [37467, `But when you smile at the`],
                        [39032, `ground, it ain't hard to tell`],
                        [41259, `You don't know, oh-oh,`],
                        [43862, `you dont know you're beautiful`],
                        [45827, `If only you saw what I can see`],
                        [48987, `You'll understand why`],
                        [50300, `I want you so desperately`],
                        [52731, `Right now I'm looking`],
                        [54185, `at you and I can't believe`],
                        [56701, `You don't know, oh-oh,`],
                        [59238, `you dont know you're beautiful`],
                        [61866, `oh-oh`],
                        [63040, `Thats what makes you beautiful`],
                        [68069, `So c-come on, you got it wrong`],
                        [72002, `To prove I'm right,`],
                        [73153, `I put it in a song`],
                        [75794, `I don't know why`],
                        [77767, `you're being shy`],
                        [79744, `And turn away when`],
                        [81014, `I look into your eyes`],
                        [84196, `Everyone else in the`],
                        [86069, `room can see it`],
                        [88046, `Everyone else but you`],
                        [91195, `Baby, you light up my`],
                        [92809, `world like nobody else`],
                        [95065, `The way that you flip your`],
                        [96730, `hair gets me overwhelmed`],
                        [98762, `But when you smile at the`],
                        [100486, `ground, it ain't hard to tell`],
                        [102677, `You don't know, oh-oh,`],
                        [105315, `you dont know you're beautiful`],
                        [107248, `If only you saw what I can see`],
                        [110359, `You'll understand why`],
                        [111673, `I want you so desperately`],
                        [114054, `Right now I'm looking`],
                        [115584, `at you and I can't believe`],
                        [118040, `You don't know, oh-oh,`],
                        [120610, `you dont know you're beautiful`],
                        [123285, `oh-oh`],
                        [124440, `Thats what makes you beautiful`],
                        [127023, `Na, na-na-na, na-na-na, na, na`],
                        [130275, `Na, na-na-na, na-na`],
                        [134269, `Na, na-na-na, na-na-na, na, na`],
                        [137947, `Na, na-na-na, na-na`],
                        [141065, `Baby, you light up my world`],
                        [143125, `like nobody else`],
                        [144946, `The way that you flip your`],
                        [146769, `hair gets me overwhelmed`],
                        [148797, `But when you smile at the`],
                        [150449, `ground, it ain't hard to tell`],
                        [152684, `(You don't know, oh-oh)`],
                        [155257, `You dont know you're beautiful`],
                        [156666, `Baby, you light up my world`],
                        [158415, `like nobody else`],
                        [160242, `The way that you flip your`],
                        [162099, `hair Cmon gets me overwhelmed`],
                        [164116, `But when you smile at the`],
                        [165735, `ground, it ain't hard to tell`],
                        [167975, `You don't know, oh-oh,`],
                        [170595, `you dont know you're beautiful`],
                        [172614, `If only you saw what I can see`],
                        [175609, `You'll understand why`],
                        [177025, `I want you so desperately`],
                        [179459, `Right now I'm looking`],
                        [180956, `at you and I can't believe`],
                        [183277, `You don't know oh-oh,`],
                        [185983, `you dont know you're beautiful`],
                        [188557, `oh-oh`],
                        [189807, `You dont know you're beautiful`],
                        [192498, `oh-oh`],
                        [193665, `Thats what makes you beautiful`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Unknown_-_The_Coconut_Song_Da_Coconut_Nut_(Hydr0.org).mp3", audio: null, lyrics: [
                        [300, `La la la, la la la la,`],
                        [2238, `la la la la la la`],
                        [3847, `La la la, la la la la,`],
                        [5872, `la la la la la la`],
                        [7549, `La la la, la la la la,`],
                        [9376, `la la la la la la`],
                        [11039, `La la la, la la la la,`],
                        [13054, `la la la la la la`],
                        [14624, `KO KO NUT`],
                        [16210, `KO KO KO KO NUT`],
                        [17620, `(kokonut)`],
                        [18469, `KO KO NUT`],
                        [19697, `KO KO KO KO KO NUT`],
                        [20974, `(kokonut)`],
                        [21913, `KO KO NUT`],
                        [23181, `KO KO KO KO KO NUT`],
                        [24576, `(kokonut)`],
                        [25476, `KO KO NUT`],
                        [26701, `KO KO KO KO KO NUT`],
                        [28647, `The kokonut nut`],
                        [30081, `Is a giant nut`],
                        [31813, `If you eat too much...`],
                        [33417, `You'll get VERY fat!!!`],
                        [35291, `Now`],
                        [35958, `The kokonut nut`],
                        [37331, `Is a big big nut`],
                        [38895, `But this delicious nut...`],
                        [40908, `Is NOT a nut!!!`],
                        [42719, `It's a koko fruit`],
                        [44502, `(It's a koko fruit)`],
                        [46268, `Of the koko tree`],
                        [47969, `(Of the koko tree)`],
                        [49835, `From the koko palm family`],
                        [52607, `La la la la la`],
                        [53940, `There are so many uses`],
                        [55274, `Of the kokonut tree`],
                        [57242, `You can build a bigger`],
                        [58512, `House for the family`],
                        [60656, `All you need is to`],
                        [62333, `Find the kokonut man`],
                        [64737, `If he cuts the tree...`],
                        [66302, `I get the fruits free!!!`],
                        [68421, `It's a koko fruit`],
                        [69966, `(It's a koko fruit)`],
                        [71725, `Of the koko tree`],
                        [73555, `(Of the koko tree)`],
                        [75320, `From the koko palm family`],
                        [78193, `La la la la la`],
                        [79695, `KO KO NUT`],
                        [81110, `KO KO KO KO KO NUT`],
                        [82697, `(kokonut)`],
                        [83559, `KO KO NUT`],
                        [84605, `KO KO KO KO KO NUT`],
                        [86567, `The kokonut bark for`],
                        [88286, `the kitchen floor`],
                        [89676, `If you save some of it...`],
                        [91561, `You can build a door`],
                        [93401, `Now`],
                        [94110, `The kokonut trunk`],
                        [95293, `Do not throw this junk`],
                        [97138, `If you save some of it...`],
                        [98638, `You'll have a second floor!!!`],
                        [101111, `The kokonut wood`],
                        [102480, `Is very good`],
                        [104428, `It can stand 20 years...`],
                        [106121, `If you pray it wood!!! :D`],
                        [107809, `Now`],
                        [108400, `The kokonut root`],
                        [109821, `To tell you the truth`],
                        [111387, `You can throw it...`],
                        [112719, `Or use it as firewood!!!`],
                        [115338, `The kokonut leaves`],
                        [117128, `Good shade it gives`],
                        [119053, `For the roof...`],
                        [119975, `For the walls up`],
                        [120928, `against the theives!!!`],
                        [122441, `Now`],
                        [123073, `The kokonut fruit`],
                        [124486, `Says my relatives`],
                        [126029, `Makes good cannon balls...`],
                        [128202, `Up against the thieves!!!`],
                        [129928, `It's a kokofruit`],
                        [131557, `(It's a koko fruit)`],
                        [133410, `Of the koko tree`],
                        [135216, `(Of the koko tree)`],
                        [137017, `From the koko palm family`],
                        [139702, `La la la la la`],
                        [141221, `The kokonut nut`],
                        [142560, `Is a giant nut`],
                        [144156, `If you eat too much...`],
                        [145809, `You'll get very fat!!!`],
                        [147732, `Now`],
                        [148402, `The kokonut nut`],
                        [149549, `Is a big big nut`],
                        [151303, `But this delicious nut...`],
                        [153317, `Is not a nut!!!`],
                        [154817, `The kokonut nut`],
                        [156762, `Is a giant nut`],
                        [158314, `If you eat too much...`],
                        [160037, `You'll get very fat!!!`],
                        [161888, `Now`],
                        [162400, `The kokonut nut`],
                        [163918, `Is a big big nut`],
                        [165493, `But this delicious nut...`],
                        [167340, `Is not a nut!!!`],
                        [168950, `It's a koko fruit`],
                        [170888, `(It's a koko fruit)`],
                        [172653, `Of the koko tree`],
                        [174400, `(Of the koko tree)`],
                        [176200, `From the koko palm family`],
                        [178924, `La la la la la`],
                        [180196, `It's a koko fruit`],
                        [181669, `(It's a koko fruit)`],
                        [183408, `Of the koko tree`],
                        [185268, `(Of the koko tree)`],
                        [186990, `From the koko palm family`],
                        [189803, `La la la la la la`],
                        [191000, `It's a koko fruit`],
                        [192319, `(It's a koko fruit)`],
                        [194359, `Of the koko tree`],
                        [196295, `(Of the koko tree)`],
                        [197913, `From the cocopalm familyyyyyyy`],
                        [202400, `La la la la la la la la la`],
                        [205269, `la la la la la la`],
                        [206900, `la la la la la`],
                        [208630, `Hooray`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/The_Neighboorhood_-_Sweater_Weather_(Hydr0.org).mp3", audio: null, lyrics: [
                        [20957, `And all I am is a man`],
                        [24559, `I want the world in my hands`],
                        [28200, `I hate the beach`],
                        [30535, `But I stand in California`],
                        [33901, `with my toes in the sand`],
                        [36100, `Use the sleeves of my sweater`],
                        [38119, `Let's have an adventure`],
                        [40288, `Head in the clouds`],
                        [41600, `but my gravity centered`],
                        [44140, `Touch my neck`],
                        [45844, `and I'll touch yours`],
                        [47931, `You in those little`],
                        [49358, `high waisted shorts, oh`],
                        [52969, `She knows what I think about`],
                        [55400, `And what I think about`],
                        [56800, `One love, two mouths`],
                        [58913, `One love, one house`],
                        [60607, `No shirt, no blouse`],
                        [62627, `Just us, you find out`],
                        [64384, `Nothing that I wouldn't wanna`],
                        [65400, `tell you about, no`],
                        [67000, `'Cause it's too cold`],
                        [71187, `For you here`],
                        [73917, `And now, so let me hold`],
                        [78878, `Both your hands in`],
                        [81500, `the holes of my sweater`],
                        [83666, `And if I may just take`],
                        [84600, `your breath away`],
                        [85633, `I don't mind if there's`],
                        [86521, `not much to say`],
                        [87546, `Sometimes the silence`],
                        [88333, `guides a mind`],
                        [89468, `To move to a place so far away`],
                        [91969, `The goosebumps start to raise`],
                        [93402, `The minute that my left hand`],
                        [94222, `meets your waist`],
                        [95900, `And then I watch your face`],
                        [97300, `Put my finger on your tongue`],
                        [98100, `'cause you love to taste, yeah`],
                        [100053, `These hearts adore, everyone`],
                        [101600, `the other beats hardest for`],
                        [103200, `Inside this place is warm`],
                        [105200, `Outside it starts to pour`],
                        [107945, `Coming down`],
                        [109001, `One love, two mouths`],
                        [111128, `One love, one house`],
                        [112974, `No shirt, no blouse`],
                        [114827, `Just us, you find out`],
                        [116573, `Nothing that I wouldn't wanna`],
                        [117363, `tell you about, no, no, no`],
                        [121456, `'Cause it's too cold`],
                        [125367, `For you here`],
                        [128136, `And now, so let me hold`],
                        [133068, `Both your hands in`],
                        [135730, `the holes of my sweater`],
                        [137000, `'Cause it's too cold`],
                        [141000, `For you here`],
                        [143643, `And now, so let me hold`],
                        [148544, `Both your hands in`],
                        [151275, `the holes of my sweater`],
                        [153503, `Whoa, whoa, whoa`],
                        [166200, `Whoa, whoa, whoa`],
                        [173900, `Whoa, whoa, whoa`],
                        [181651, `Whoa, whoa, whoa`],
                        [189360, `Whoa, whoa, whoa`],
                        [197069, `Whoa, whoa, whoa`],
                        [202500, `'Cause it's too cold`],
                        [206658, `For you here`],
                        [209372, `And now, so let me hold`],
                        [214380, `Both your hands in`],
                        [217034, `the holes of my sweater`],
                        [218300, `It's too cold`],
                        [222133, `For you here`],
                        [224871, `And now, let me hold`],
                        [229934, `Both your hands in`],
                        [232466, `the holes of my sweater`],
                        [235598, `And it's too cold,`],
                        [237606, `it's too cold`],
                        [240600, `The holes of my sweater`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Eminem%20-%20Rap%20God%20(Explicit)%20%5BXbGs_qK2PQA%5D.mp3", audio: null, lyrics: [
                        [869, `Look,`],
                        [2000, `I was gonna go easy on`],
                        [2700, `you not to hurt your feelings`],
                        [4571, `But I'm only goin' to get`],
                        [6729, `this one chance`],
                        [9600, `Something's wrong,`],
                        [10300, `I can feel it`],
                        [11500, `Just a feelin' I've got, like`],
                        [14400, `somethings about to happen`],
                        [15885, `but I don't know what`],
                        [17674, `If that means what`],
                        [18369, `I think it means,`],
                        [19215, `we're in trouble, big trouble`],
                        [20924, `And if he is as bananas as you`],
                        [21858, `say, I'm not takin any chances`],
                        [24337, `ur just what the doc ordered`],
                        [25692, `I'm beginnin' to feel`],
                        [26904, `like a Rap God, Rap God`],
                        [28870, `All my people from the front`],
                        [30261, `to the back nod, back nod`],
                        [32046, `Now, who thinks their arms are`],
                        [33094, `long enough to slap box,`],
                        [34805, `slap box?`],
                        [35380, `They said I rap like a`],
                        [36093, `robot, so call me Rap-bot`],
                        [37624, `But for me to rap like a`],
                        [38500, `computer it mus be in my genes`],
                        [40059, `I got a laptop in`],
                        [40805, `my back pocket`],
                        [41681, `My pen'll go off when I`],
                        [42496, `half-cock it, got a fat knot`],
                        [43528, `from that rap profit`],
                        [44915, `Made a livin' and a killin off`],
                        [45748, `it, ever since Bill Clinton`],
                        [46998, `was still in office`],
                        [47873, `With Monica Lewinsky`],
                        [48595, `feelin' on his nut sack`],
                        [49858, `I'm an MC still as honest, but`],
                        [51014, `as rude and as`],
                        [51717, `indecent as all hell`],
                        [52606, `Syllables, skill-a-holic`],
                        [53804, `(kill 'em all with)`],
                        [54442, `This flippity dippity-hippity`],
                        [55162, `hip-hop, you dont really wanna`],
                        [56254, `get into a pissin' match`],
                        [57251, `With this rappity brat, packin`],
                        [58105, `a MAC in the back of the Ac',`],
                        [59491, `backpack rap crap,`],
                        [60298, `yap-yap, yackety-yack`],
                        [61261, `And at the exact same time, I`],
                        [62058, `attempt these lyrical acrobat`],
                        [63120, `stunts while im practicin that`],
                        [64296, `I'll still be able to break a`],
                        [65356, `motherfucking table over the`],
                        [66025, `back of a couple of fagots and`],
                        [66706, `crack it in half`],
                        [67499, `Only realized it was ironic, I`],
                        [68904, `was signed to aftermath`],
                        [70283, `after the fact`],
                        [71388, `How could I not blow?`],
                        [72231, `All I do is drop F-bombs,`],
                        [73299, `feel my wrath of attack`],
                        [74203, `Rappers are havin' a rough`],
                        [75074, `time period, here's a maxi pad`],
                        [76666, `It's actually disastrously bad`],
                        [78226, `for the wack while I'm`],
                        [79000, `masterfully constructin' this`],
                        [80222, `masterpiece`],
                        [80944, `'Cause I'm beginnin' to feel`],
                        [82017, `like a Rap God, Rap God`],
                        [84032, `All my people from the front`],
                        [85572, `to the back nod, back nod`],
                        [87142, `Now, who thinks their arms are`],
                        [88403, `long enough to slap box,`],
                        [89586, `slap box?`],
                        [90400, `Let me show u maintainin' this`],
                        [91696, `shit aint that hard, that hard`],
                        [93500, `Everybody want the key and the`],
                        [94455, `secret to rap immortality`],
                        [95700, `like Ι have got`],
                        [96890, `Well, to be truthful the`],
                        [97569, `blueprint's, simply rage and`],
                        [98765, `youthful exuberance`],
                        [99532, `Everybody loves to root for a`],
                        [100600, `nuisance, hit the Earth`],
                        [101500, `like an asteroid`],
                        [102105, `Did nothin' but shoot for`],
                        [103002, `the Moon since (pew)`],
                        [104200, `MCs get taken to school with`],
                        [105400, `this music 'cause I use it as`],
                        [106600, `a vehicle to, "Bus the rhyme"`],
                        [107898, `Now I lead a new school`],
                        [108634, `full of students`],
                        [109600, `Me? I'm a product of Rakim,`],
                        [110984, `Lakim Shabazz, 2Pac, N.W.A,`],
                        [113125, `Cube, hey Doc, Ren`],
                        [114341, `Yella, Eazy, thank you,`],
                        [115046, `they got Slim`],
                        [115797, `Inspired enough to one day`],
                        [117043, `grow up, blow up and`],
                        [117859, `be in a position`],
                        [119182, `To meet Run–D.M.C.,`],
                        [120060, `and induct them into`],
                        [120957, `the motherfucking`],
                        [121683, `Rock n Roll Hall of Fame even`],
                        [123400, `though I'll walk in the church`],
                        [124400, `and burst in a ball of flames`],
                        [125700, `Only Hall of Fame I'll be`],
                        [126600, `inducted in is the alcohol of`],
                        [128108, `fame on the wall of (shame)`],
                        [129769, `You fags think it's all a game`],
                        [131300, `'til I walk a flock of flames`],
                        [133169, `Off a plank and, tell me what`],
                        [134400, `in the fuck are you thinkin'?`],
                        [135892, `Little gay lookin' boy,`],
                        [136766, `so gay I can barely say it`],
                        [138058, `with a straight face,`],
                        [138700, `lookin' boy (haha)`],
                        [139400, `You're witnessin' a mass-occur`],
                        [140200, `like you're watchin' a church`],
                        [140800, `gatherin' take place,`],
                        [141826, `lookin' boy`],
                        [142800, `"Oy vey, that boy's gay",`],
                        [144300, `that's all they say,`],
                        [145100, `lookin' boy`],
                        [145750, `You get a thumbs up, pat on`],
                        [146500, `the back and a way to go from`],
                        [147600, `your label every day,`],
                        [148400, `lookin' boy`],
                        [149100, `Hey, lookin' boy,`],
                        [149700, `what you say, lookin' boy?`],
                        [150568, `I get a, hell yeah from Dre,`],
                        [151600, `lookin' boy`],
                        [152222, `I'ma work for everythin I have`],
                        [153600, `never asked nobody for shit,`],
                        [154569, `get outta my face, lookin' boy`],
                        [155500, `Basically, boy, you're never`],
                        [156217, `gonna be capable of keepin' up`],
                        [157541, `with the same pace,`],
                        [158120, `lookin' boy, 'cause`],
                        [158926, `I'm beginnin' to feel`],
                        [159869, `like a Rap God, Rap God`],
                        [161833, `All my people from the front`],
                        [163240, `to the back nod, back nod`],
                        [164998, `The way I'm racin' around the`],
                        [166100, `track, call me NASCAR, NASCAR`],
                        [168353, `Dale Earnhardt of the trailer`],
                        [169400, `park, the White Trash God`],
                        [170735, `Kneel before General Zod,`],
                        [172270, `this planet's Krypton,`],
                        [173131, `no, Asgard, Asgard`],
                        [174696, `So you'll be Thor,`],
                        [175589, `and I'll be Odin, you rodent,`],
                        [177098, `I'm omnipotent`],
                        [178400, `Let off, then I'm reloadin',`],
                        [179689, `immediately with these`],
                        [180700, `bombs I'm totin'`],
                        [181800, `And I should not be woken`],
                        [183200, `I'm the walkin' dead,`],
                        [183969, `but I'm just a talkin' head,`],
                        [185300, `a zombie floatin', but I got`],
                        [186900, `your mom deepthroating`],
                        [188030, `I'm out my Ramen Noodle, we`],
                        [189700, `have nothin' in common, poodle`],
                        [191142, `I'm a Doberman,`],
                        [191900, `pinch yourself in the arm`],
                        [192947, `and pay homage, pupil`],
                        [194603, `It's me, my honesty's brutal`],
                        [196940, `But it's honestly futile if I`],
                        [198600, `don't utilize what I do though`],
                        [200054, `For good, at least`],
                        [200844, `once in a while`],
                        [201495, `So I wanna make sure somewhere`],
                        [202500, `in this chicken scratch I`],
                        [203200, `scribble and doodle`],
                        [204052, `enough rhymes`],
                        [204750, `To maybe try to help get some`],
                        [205989, `people through tough times`],
                        [207200, `But I gotta keep a few`],
                        [207940, `punchlines just in case 'cause`],
                        [209300, `even you unsigned`],
                        [210200, `Rappers are hungry lookin'`],
                        [211269, `at me like it's lunchtime`],
                        [212800, `I know there was a time where`],
                        [213727, `once I was king of`],
                        [215000, `the underground`],
                        [215569, `But I still rap like I'm`],
                        [216269, `on my Pharoahe Monch grind`],
                        [217600, `So I crunch rhymes, but`],
                        [218652, `sometimes when you combine`],
                        [220169, `Appeal with the`],
                        [220700, `skin color of mine`],
                        [221765, `You get too big and here they`],
                        [222700, `come tryin' to censor`],
                        [223700, `you like that one line`],
                        [224800, `I said on, I'm back from`],
                        [225959, `The Mathers LP 1 when`],
                        [226969, `I tried to say I'll take seven`],
                        [228500, `kids from Columbine`],
                        [229996, `Put 'em all in a line, add an`],
                        [230900, `AK-47, a revolver and a .9`],
                        [233600, `See if I get away with it now`],
                        [234729, `that I ain't as big as I was,`],
                        [236100, `but I'm`],
                        [236747, `Morphin' into an immortal,`],
                        [238243, `comin' through the portal`],
                        [239259, `You're stuck in a time`],
                        [240150, `warp from 2004 though`],
                        [241570, `And I don't know what the`],
                        [242495, `fuck that you rhyme for`],
                        [243700, `You're pointless as Rapunzel`],
                        [244801, `with fuckin' cornrows`],
                        [246500, `You write normal?`],
                        [247159, `Fuck bein' normal`],
                        [248300, `And I just bought a new`],
                        [248822, `raygun from the future`],
                        [250061, `Just to come and shoot u, like`],
                        [251200, `when Fabolous made Ray J mad`],
                        [252681, `'Cause Fab said he looked like`],
                        [253570, `a fag at Mayweather's pad`],
                        [254347, `singin' to a man while`],
                        [255086, `he played piano`],
                        [256200, `Man, oh man, that was a 24-7`],
                        [257800, `special on the cable channel`],
                        [259427, `So Ray J went straight to the`],
                        [260300, `radio station, the very next`],
                        [261500, `day, "Hey Fab, I'ma kill you"`],
                        [263300, `Lyrics comin' at you at`],
                        [263974, `supersonic speed`],
                        [265269, `Uh, summa-lumma, dooma-lumma,`],
                        [266400, `you assumin' I'm a human`],
                        [267400, `What I gotta do to get it`],
                        [268012, `through to you? I'm superhuman`],
                        [268835, `Innovative and I'm made of`],
                        [269800, `rubber so that anythin you say`],
                        [270749, `is ricochetin' off of me, and`],
                        [271540, `it'll glue to you and I'm`],
                        [272192, `devastatin', more than ever`],
                        [273013, `demonstratin', how to give a`],
                        [273815, `motherfuckin audience a feelin`],
                        [274623, `like it's levitatin'`],
                        [275527, `Never fadin' and I know the`],
                        [276240, `haters are forever waitin' for`],
                        [277200, `the day that they can say I`],
                        [277880, `fell off, theyll be celebratin`],
                        [278548, `Cause I know the way to get em`],
                        [279345, `motivated, I make elevatin'`],
                        [280300, `music, you make elevator music`],
                        [282083, `"Oh, hes too mainstream", well`],
                        [283404, `that's what they do when they`],
                        [284300, `get jealous, they confuse it`],
                        [285349, `"It's not hip-hop, it's pop"`],
                        [286795, `'cause I found a`],
                        [287479, `hella way to fuse it`],
                        [288601, `With rock, shock rap with Doc,`],
                        [290291, `throw on "Lose Yourself"`],
                        [290983, `and make 'em lose it`],
                        [291840, `I don't know how to make songs`],
                        [292759, `like that, I don't know`],
                        [293900, `what words to use`],
                        [295000, `Let me know when it occurs to`],
                        [295938, `you while I'm rippin' any one`],
                        [296842, `of these verses that versus u`],
                        [298032, `Its curtains, Im inadvertently`],
                        [299001, `hurtin' you, how many`],
                        [299832, `verses I gotta murder to`],
                        [301169, `Prove that if you were half as`],
                        [302346, `nice, your songs, you could`],
                        [303364, `sacrifice virgins too?`],
                        [304499, `Ugh, school flunky,`],
                        [306139, `pill junkie, but look at the`],
                        [307613, `accolades this skills brung me`],
                        [309365, `Full of myself,`],
                        [310078, `but still hungry`],
                        [311300, `I bully myself 'cause I make`],
                        [312340, `me do what I put my mind to`],
                        [314000, `And I'm a million leagues`],
                        [315700, `above you, ill when I`],
                        [316963, `speak in tongues`],
                        [317690, `But it's still`],
                        [318405, `tongue-in-cheek, fuck you`],
                        [319299, `I'm drunk, so, Satan, take the`],
                        [321000, `fucking wheel, I'ma sleep`],
                        [322100, `in the front seat`],
                        [322800, `Bumpin' Heavy D and the Boyz,`],
                        [324213, `still "Chunky but Funky"`],
                        [326081, `But in my head`],
                        [326818, `there's somethin' I can feel`],
                        [327900, `tuggin' and strugglin'`],
                        [329252, `Angels fight with devils and`],
                        [330867, `here's what they want from me`],
                        [332900, `They're askin' me to eliminate`],
                        [333900, `some of the women hate`],
                        [334700, `But if you take into`],
                        [335400, `consideration the bitter`],
                        [336213, `hatred I have, then you may be`],
                        [337300, `a little patient, and more`],
                        [338115, `sympathetic to the situation`],
                        [339588, `And understand the`],
                        [340207, `discrimination`],
                        [341700, `But fuck it, life's handin you`],
                        [343240, `lemons? Make lemonade then`],
                        [344500, `But if I cant batter the women`],
                        [346000, `How the fuck am I supposed`],
                        [346834, `to bake 'em a cake, then?`],
                        [348300, `Don't mistake him for Satan`],
                        [349285, `It's a fatal mistake if you`],
                        [350269, `think I need to be overseas`],
                        [351533, `and take a vacation`],
                        [352717, `To trip a broad, and make`],
                        [353800, `her fall on her face and`],
                        [355148, `Don't be a retard, be a king?`],
                        [356976, `Think not, why be a king`],
                        [359100, `when you can be a God?`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Tung%20Tung%20Tung%20Sahur%20-%20Ratatung%20(official%20song)%20%5BTZAdoZy6y34%5D.mp3", audio: null, lyrics: [
                        [1, `Tung`],
                        [748, `Ratata ta tung`],
                        [2525, `Ratata ta tung`],
                        [4461, `Ratata ta tung tung tung SAHUR`],
                        [8293, `Ratata ta tung (hey)`],
                        [10300, `Ratata ta tung (hey)`],
                        [12090, `Ratata ta tung tung tung SAHUR`],
                        [15995, `Ratata ta tung (hey)`],
                        [17897, `Ratata ta tung (hey)`],
                        [19800, `Ratata ta tung tung tung SAHUR`],
                        [23200, `Crank it up,`],
                        [23867, `here's my master plan,`],
                        [25200, `Steal the crown like`],
                        [25969, `a wanted man,`],
                        [26993, `Pa pa pa pa da pa`],
                        [29200, `Tralelero Tralala`],
                        [30933, `Every hit is a battle won,`],
                        [32841, `Drop that sound like`],
                        [33700, `a smoking gun,`],
                        [34939, `Pa pa pa pa da pa`],
                        [36602, `Tralelero Tralala`],
                        [39269, `Can you feel it now,`],
                        [40947, `Rising through the crowd,`],
                        [42826, `I'm the one they play`],
                        [44444, `when the world gets loud!`],
                        [46369, `Hey!`],
                        [47000, `Ratata ta tung (hey)`],
                        [48610, `Ratata ta tung (hey)`],
                        [50422, `Ratata ta tung tung tung SAHUR`],
                        [54406, `Ratata ta tung (hey)`],
                        [56330, `Ratata ta tung (hey)`],
                        [58206, `Ratata ta tung tung tung SAHUR`],
                        [61600, `No...`],
                        [62400, `I don't like boring verses...`],
                        [64600, `So follow me!`],
                        [66969, `Tralalero Tralala`],
                        [69328, `Pa pa pa pa pa da pa pa`],
                        [71238, `Tralalero Tralala`],
                        [73088, `Pa pa pa pa pa da pa pa`],
                        [75000, `Tralalero Tralala`],
                        [76500, `Hey!`],
                        [77666, `Can you feel it now,`],
                        [79400, `Rising through the crowd,`],
                        [81300, `I'm the one they play`],
                        [82732, `when the world gets loud!`],
                        [84817, `Hey!`],
                        [85565, `Ratata ta tung (hey)`],
                        [87013, `Ratata ta tung (hey)`],
                        [89019, `Ratata ta tung tung tung SAHUR`],
                        [92700, `Ratata ta tung (hey)`],
                        [94640, `Ratata ta tung (hey)`],
                        [96590, `Ratata ta tung tung tung SAHUR`],
                        [100398, `Ratata ta tung (hey)`],
                        [102367, `Ratata ta tung (hey)`],
                        [104353, `Ratata ta tung tung tung SAHUR`],
                        [108210, `Ratata ta tung (hey)`],
                        [110035, `Ratata ta tung (hey)`],
                        [112012, `Ratata ta tung tung tung SAHUR`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/Quadeca%20-%20Candles%20On%20Fire!%20(Music%20Video)%20%5Bq--d8YJiJsE%5D.mp3", audio: null, lyrics: [
                        [24800, `Woke up feeling mad today`],
                        [26300, `Bitch, im ugly, but`],
                        [26900, `I act like Timmy Chalamet, uh`],
                        [28666, `I hate these motherFuckers`],
                        [29400, `so, so much`],
                        [30221, `Why I keep on tryna get em`],
                        [31100, `all to validate me?`],
                        [32600, `Its no help, im living like,`],
                        [33500, `Oh well`],
                        [34359, `Like my English teacher said,`],
                        [35083, `had to show em, I dont tell`],
                        [36170, `I show em I dont fail,`],
                        [37100, `they knowin me so well`],
                        [38114, `I been catchin all the shade`],
                        [39007, `they've been throwin im, Odell`],
                        [41000, `Turn the cameras on`],
                        [42311, `Quick water break`],
                        [43005, `in the marathon`],
                        [44242, `Walk in your room`],
                        [45000, `and I set the mood`],
                        [45883, `They aint gotta light the`],
                        [46569, `MotherFuckin candles on fire`],
                        [48500, `Cant see without da cameras on`],
                        [50049, `Without a platform`],
                        [50800, `to be standin on, uh`],
                        [52369, `All this baggage`],
                        [52971, `going over they heads`],
                        [53817, `So I keep it underneath`],
                        [54725, `how I carry on, ooh`],
                        [56647, `Im goin crazy`],
                        [58024, `Too hot for Milan,`],
                        [58852, `had to add the AC (Woo)`],
                        [60035, `Guess whats gettin`],
                        [60696, `to em lately?`],
                        [61916, `They been takin shots at a boy`],
                        [63100, `I just say Cheese!`],
                        [64154, `I smell the green,`],
                        [64669, `thats synesthesia`],
                        [65332, `Growin up, im already`],
                        [66100, `too old for Chris D'Elia`],
                        [67245, `They tryna run they mouth,`],
                        [68169, `checkin in on that big career`],
                        [69242, `and look, its nada`],
                        [70202, `Voila, it disappeared, ok, ayy`],
                        [72006, `These sparks are fickle`],
                        [72830, `and simple-minded`],
                        [73590, `Flashlight in the dark`],
                        [74501, `how people gon get behind em`],
                        [75500, `I never killed my ego,`],
                        [76447, `its trippin on psilocybin`],
                        [77453, `That Shit'll kill me inside if`],
                        [78367, `they hear it and never mind-it`],
                        [79546, `Ive been gassed up, thats why`],
                        [80750, `they dont hold a candle to me`],
                        [81958, `Masked up way before`],
                        [82747, `it was a standard duty`],
                        [83811, `Back up, I came in this Shit`],
                        [85295, `Put my sticks in the ground so`],
                        [86367, `I sorry but you cant remove me`],
                        [88241, `Turn the cameras on`],
                        [89447, `Quick water break`],
                        [90095, `in the marathon`],
                        [91402, `Walk in your room`],
                        [92122, `and I set the mood`],
                        [93200, `They aint gotta light the`],
                        [94000, `MotherFuckin candles on fire`],
                        [95634, `Cant see without da cameras on`],
                        [97305, `Without a platform`],
                        [98000, `to be standin on, uh`],
                        [99511, `All this baggage`],
                        [100207, `going over they heads`],
                        [100981, `So I keep it underneath`],
                        [101830, `how I carry on, ooh`],
                        [107300, `They put the red dot`],
                        [107958, `right back on his head`],
                        [109466, `In fact, it never left`],
                        [110527, `Fuck a gold plaque,`],
                        [111249, `I want platinum instead, uh`],
                        [113200, `It wont matter no less`],
                        [114573, `All my nights sleepless,`],
                        [115363, `but my dreams still vivid`],
                        [116629, `Hole getting deeper,`],
                        [117342, `but the team still winnin`],
                        [118586, `Let me look around,`],
                        [119163, `like will you please love me?`],
                        [120491, `End up in the ground,`],
                        [121124, `will they still think of me`],
                        [122411, `Where they stil feel something`],
                        [123396, `Aint nobody laughing,`],
                        [124186, `but it still feels funny to me`],
                        [125621, `Its all a game, all these`],
                        [126461, `people just a number to me`],
                        [127550, `And what could it be?`],
                        [128369, `No matter how I feel you could`],
                        [129422, `bet I give em somethin to see`],
                        [130681, `Whats the price of`],
                        [131292, `living comfortably?`],
                        [132098, `All these numbers mind numbing`],
                        [132822, `to me, its nothin to me`],
                        [134266, `Get my pants tailored`],
                        [135111, `with the big pockets`],
                        [136033, `I dont give em much room`],
                        [136966, `when they Shit talkin, ayy`],
                        [139300, `Turn the cameras on`],
                        [140666, `Quick water break`],
                        [141500, `in the marathon`],
                        [142615, `Walk in your room`],
                        [143306, `and I set the mood`],
                        [144334, `They aint gotta light the`],
                        [145121, `MotherFuckin candles on fire`],
                        [146819, `Cant see without da cameras on`],
                        [148460, `Without a platform`],
                        [149221, `to be standin on, uh`],
                        [150747, `All this baggage`],
                        [151395, `going over they heads`],
                        [152229, `So I keep it underneath`],
                        [153003, `how I carry on, ooh`],
                        [155313, `Turn the cameras on`],
                        [158388, `Walk in your room`],
                        [159059, `and I set the mood`],
                        [160060, `They aint gotta light the`],
                        [160644, `MotherFuckin candles on fire`],
                        [163265, `Cameras on`],
                        [164276, `Without a platform`],
                        [164968, `to be standing on`],
                        [166336, `All this baggage`],
                        [167039, `going over they heads`],
                        [167882, `So I keep it underneath`],
                        [168792, `how I carry on, ooh`],
                        [174644, `The route up the ice ridge`],
                        [175560, `was hard but safe`],
                        [177296, `Boyson could watch the`],
                        [178419, `avalanches go by and`],
                        [180230, `even enjoy the view`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/The%20Kid%20LAROI,%20Justin%20Bieber%20-%20STAY%20(Official%20Video)%20%5BkTJczUoc26U%5D.mp3", audio: null, lyrics: [
                        [30600, `I do the same`],
                        [31500, `thing I told you that`],
                        [32399, `I never would`],
                        [33325, `I told you I'd change,`],
                        [34347, `even when I knew I never could`],
                        [36018, `I know that I can't`],
                        [37133, `find nobody else as good as u`],
                        [38797, `I need you to stay,`],
                        [39822, `need you to stay, hey (oh)`],
                        [42100, `I get drunk,`],
                        [42869, `wake up,`],
                        [43755, `I'm wasted still`],
                        [44922, `I realize the time`],
                        [46235, `that I wasted here`],
                        [47700, `I feel like`],
                        [48511, `you can't feel the way I feel`],
                        [50479, `Oh, I'll be fucked up`],
                        [51699, `if you can't be right here`],
                        [53128, `Oh, ooh-woah`],
                        [54500, `(oh, ooh-woah, ooh-woah)`],
                        [55948, `Oh, ooh-woah`],
                        [57416, `(oh, ooh-woah, ooh-woah)`],
                        [58774, `Oh, ooh-woah`],
                        [59900, `(oh, ooh-woah, ooh-woah)`],
                        [61387, `Oh, I'll be fucked up`],
                        [62959, `if you can't be right here`],
                        [64384, `I do the same`],
                        [65500, `thing I told you that`],
                        [66141, `I never would`],
                        [67188, `I told you I'd change,`],
                        [68218, `even when I knew I never could`],
                        [69909, `I know that I can't`],
                        [70925, `find nobody else as good as u`],
                        [72730, `I need you to stay,`],
                        [73869, `need you to stay, hey`],
                        [75800, `I do the same`],
                        [76800, `thing I told you that`],
                        [77600, `I never would`],
                        [78467, `I told you I'd change,`],
                        [79539, `even when I knew I never could`],
                        [81217, `I know that I can't`],
                        [82353, `find nobody else as good as u`],
                        [84004, `I need you to stay,`],
                        [85260, `need you to stay, hey`],
                        [87106, `When I'm away from you,`],
                        [88438, `I miss your touch (ooh)`],
                        [90057, `You're the reason`],
                        [90762, `I believe in love`],
                        [92876, `It's been difficult`],
                        [93817, `for me to trust (ooh)`],
                        [95653, `And I'm afraid that`],
                        [96320, `I'ma fuck it up`],
                        [98560, `Ain't no way`],
                        [99133, `that I can leave you stranded`],
                        [101364, `'Cause you ain't ever`],
                        [102100, `left me empty-handed`],
                        [104129, `And you know that I know that`],
                        [105810, `I can't live without you`],
                        [107823, `So, baby, stay`],
                        [109657, `Oh, ooh-woah`],
                        [111013, `(oh, ooh-woah, ooh-woah)`],
                        [112382, `Oh, ooh-woah`],
                        [113799, `(oh, ooh-woah, ooh-woah)`],
                        [115300, `Oh, ooh-woah`],
                        [116585, `(oh, ooh-woah, ooh-woah)`],
                        [117900, `I'll be fucked up`],
                        [119500, `if you can't be right here`],
                        [120900, `I do the same`],
                        [121900, `thing I told you that`],
                        [122800, `I never would`],
                        [123535, `I told you I'd change,`],
                        [124625, `even when I knew I never could`],
                        [126351, `I know that I can't`],
                        [127624, `find nobody else as good as u`],
                        [129142, `I need you to stay,`],
                        [130318, `need you to stay, hey`],
                        [132319, `I do the same`],
                        [133150, `thing I told you that`],
                        [134000, `I never would`],
                        [134775, `I told you I'd change,`],
                        [135978, `even when I knew I never could`],
                        [137614, `I know that I can't`],
                        [138753, `find nobody else as good as u`],
                        [140407, `I need you to stay,`],
                        [141500, `need you to stay, hey`],
                        [148700, `Woah-oh`],
                        [151991, `I need you to stay,`],
                        [152856, `need you to stay, hey`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/the%20rare%20occasions%20-%20notion%20%5B%20sped%20up%20%5D%20lyrics.mp3", audio: null, lyrics: [
                        [9932, "Sure, it's a calming notion,"],
                        [12416, "perpetual in motion"],
                        [15056, "But I don't need the comfort"],
                        [17680, "of any lies"],
                        [20399, "For I have seen the ending,"],
                        [22898, "and there is no ascending"],
                        [25952, "Ri"],
                        [26622, "Rii"],
                        [27168, "Riii"],
                        [27743, "Riii"],
                        [28371, "Riiiise"],
                        [30646, "Oh, back when I was younger,"],
                        [33277, "was told by other youngsters"],
                        [35861, "That my end will be torture"],
                        [38422, "beneath the earth"],
                        [41042, "'Cause I don't see what they see,"],
                        [43707, "when death is staring at me"],
                        [46361, "I see a window,"],
                        [47150, "a limit,"],
                        [47774, "to live it,"],
                        [48337, "or not at all"],
                        [75021, "If you could pull the lever"],
                        [77533, "to carry on forever"],
                        [80149, "Would your life even"],
                        [81883, "matter anymore?"],
                        [85414, "Sure, it's a calming notion,"],
                        [87982, "perpetual in motion"],
                        [90878, "But it's not"],
                        [91625, "what"],
                        [92168, "you"],
                        [92746, "signed"],
                        [93366, "up"],
                        [94665, "for"],
                        [107215, "I'm sure there won't"],
                        [108481, "always be sunshine"],
                        [112456, "But there's this momentary beam"],
                        [115801, "of light"],
                        [117407, "You don't have to wait"],
                        [118400, "those salty decades"],
                        [119935, "To get through the gate,"],
                        [121020, "it's all in front of your face"],
                        [122609, "I'm sure there won't"],
                        [124303, "always be sunshine"],
                        [128335, "I'm sure"],
                        [129280, "there won't always be sunshine"],
                        [133414, "But there's this momentary beam"],
                        [136886, "of light"],
                        [138210, "I could-could cross the ocean"],
                        [140617, "in a fit of devotion"],
                        [143351, "For every shining second,"],
                        [145923, "this fragile body beckons"],
                        [148660, "You think you're owed it better"],
                        [151008, "believing ancient letters"],
                        [153887, "Sure, it's a calming notion,"],
                        [156736, "but it's a lie"],
                        [157414, "but it's a liee"],
                        [157958, "but it's a lieee"]
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/CLOSE%20CALL%20%5BOOwqHDVZy18%5D.mp3", audio: null, lyrics: [
                        [4969, `I just gotta let you know`],
                        [7100, `Ever since you called me`],
                        [9100, `Im tearing up my schedule`],
                        [11069, `Cause I've been thinking`],
                        [11844, `about you all week`],
                        [13516, `When I get you alone`],
                        [15100, `I don't feel loved like`],
                        [15915, `I say I do`],
                        [17801, `Cause he's calling your phone`],
                        [19460, `I'm dodging bullets`],
                        [20305, `the shape of you`],
                        [22322, `Close call`],
                        [23488, `I hope you never call me again`],
                        [26418, `And so far`],
                        [27789, `We're farther gone than`],
                        [29174, `where we began`],
                        [30800, `I'll let these memories fade`],
                        [32800, `But I don't wanna forget`],
                        [35303, `I'll never be your best`],
                        [37501, `I'm letting you go`],
                        [43700, `I should've known`],
                        [44238, `it would end up like this`],
                        [45600, `Late night body`],
                        [46421, `to somebody I'd miss`],
                        [47821, `Don't say you need`],
                        [48777, `time for yourself`],
                        [49956, `You mean somebody else`],
                        [51700, `I know these days`],
                        [54081, `I feel like I'm better alone`],
                        [56946, `Sweet escape to me babe`],
                        [59598, `I'm letting you go`],
                        [61226, `Ill let these memories fade`],
                        [63500, `So you can leave`],
                        [64362, `my mind in peace`],
                        [65774, `We made it one week`],
                        [66539, `Want a piece of my mind`],
                        [67764, `Baby do this on me`],
                        [68758, `cause darling`],
                        [70100, `When I get you alone`],
                        [71695, `I don't feel loved`],
                        [72509, `like I say I do`],
                        [74500, `Cause he's calling your phone`],
                        [76125, `I'm dodging bullets`],
                        [76920, `in the shape of you`],
                        [78934, `Close call`],
                        [80069, `I hope you never call me again`],
                        [83038, `And so far`],
                        [84443, `We're farther gone than`],
                        [85899, `where we began`],
                        [87469, `I'll let these memories fade`],
                        [89705, `But I don't wanna forget`],
                        [91984, `I'll never be your best`],
                        [94169, `I'm letting you go`],
                        [96356, `Slow down (slow down)`],
                        [97400, `let go (let go)`],
                        [98600, `I won't call back like an echo`],
                        [100437, `I could change my mind`],
                        [101425, `like presto (presto)`],
                        [102608, `But my heads held high`],
                        [103647, `and my stress low`],
                        [105000, `Alright let's go`],
                        [107300, `Imma sign off like XO`],
                        [109569, `You had a shot at this`],
                        [110800, `A close call I'm`],
                        [111300, `the one you'll miss`],
                        [112600, `So come on now`],
                        [122369, `Girl I really thought`],
                        [122900, `I met my match`],
                        [124122, `But without you and I`],
                        [125001, `stroke it off like that`],
                        [126128, `Baby now Im cutting a lit fuse`],
                        [128476, `I see you in hindsight`],
                        [129366, `it's all in my rearview`],
                        [130769, `Our better days bind us`],
                        [131769, `let it fade behind us`],
                        [132844, `Tore us apart quicker`],
                        [133852, `than get away drivers`],
                        [135200, `I've been running`],
                        [136000, `from the day I knew`],
                        [137195, `I'm dodging bullets`],
                        [138007, `the shape of you`],
                        [140005, `Close call`],
                        [141256, `I hope you never call me again`],
                        [144125, `And so far`],
                        [145504, `We're farther gone than`],
                        [147030, `where we began`],
                        [148433, `I'll let these memories fade`],
                        [150816, `But I don't wanna forget`],
                        [153060, `I'll never be your best`],
                        [155240, `I'm letting you go`],
                    ], index: 0},
                    {src: "https://github.com/oe2735/music/raw/refs/heads/main/North%20Memphis%20%5BtRF4J5WDJhw%5D.mp3", audio: null, lyrics: [
                        [11200, `Pharmacist motherfucker`],
                        [12500, `Project Pat don't give a fu-`],
                        [18400, `Project Pat don't give a fuck`],
                        [25485, `North Memphis nigga,`],
                        [26436, `North Memphis nigga`],
                        [27505, `North Memphis,`],
                        [28271, `North Memphis nigga`],
                        [29729, `Project Pat don't give a fuck`],
                        [31117, `North Memphis nigga,`],
                        [32182, `North Memphis nigga`],
                        [33275, `North Memphis-`],
                        [33984, `North Memphis nigga`],
                        [35500, `The definition of a player`],
                        [37392, `A nigga that play hoes`],
                        [38543, `to make the ends meet`],
                        [39696, `You gotta know the game,`],
                        [40700, `how it's played,`],
                        [41446, `it's all about thinkin' deep`],
                        [42521, `Sum' gonna cross you out,`],
                        [44000, `sum' gonna smoke you out`],
                        [45420, `But you can talk yo' ass`],
                        [46475, `off my Glock,`],
                        [47100, `I'm breakin' somethin' off`],
                        [48262, `Proper, I kick it at`],
                        [49514, `right up where the players at`],
                        [51116, `Bumpin', pimpin', smokin' sess`],
                        [52604, `with Dre and Ray-Ray`],
                        [53599, `in that mask`],
                        [54252, `We love to see these niggas`],
                        [55460, `sweat up on our bitch you see`],
                        [56901, `Drizzay hit them,`],
                        [57608, `baby, then we vampin'`],
                        [58579, `with them dead G's`],
                        [59969, `North Memphis niggas,`],
                        [60856, `North Memphis niggas`],
                        [61917, `North Memphis,`],
                        [62692, `North Memphis niggas`],
                        [64094, `Project Pat don't give a fuck`],
                        [65560, `North Memphis niggas,`],
                        [66595, `North Memphis niggas`],
                        [67687, `North Memphis,`],
                        [68412, `North Memphis niggas`],
                        [69838, `Project Pat don't give a fuck`],
                        [72700, `Pharmacist motherfucker`],
                    ], index: 0},
                ];
                this.playing = false;
                this.currentSong = null;
                this.lastSendTime = -1;
                this.sing = true;
                this.onEnd = null;
            }
            convertCurrenttime(seconds) {
                return Math.ceil(seconds*1000);
            }
            // Songs are only downloaded when first played.
            getAudio(song) {
                if (!song.audio) song.audio = new Audio(song.src);
                return song.audio;
            }
            playSong(id) {
                let song = this.songs[id];
                if (!song) return;
                if (this.playing) {
                    if (this.currentSong == id) {
                        return;
                    } else {
                        this.pauseSong();
                    }
                }
                this.currentSong = id;
                this.getAudio(song).play().catch((err) => {
                    console.warn("[Robotics] could not play song " + id + ":", err && err.message ? err.message : err);
                    this.playing = false;
                });
                this.playing = true;
                song.audio.ontimeupdate = () => {
                    let array = song.lyrics[song.index];
                    if (array) {
                        let time = array[0];
                        let part = array[1];
                        if (this.convertCurrenttime(song.audio.currentTime) >= (time - 200) && song.audio.currentTime - this.lastSendTime > 0.569) {
                            if (this.sing) A0("6", part)
                            song.index++;
                            this.lastSendTime = song.audio.currentTime;
                        }
                    }
                }
                song.audio.onended = () => {
                    this.playing = false;
                    song.index = 0;
                    this.lastSendTime = -1;
                    if (this.onEnd) this.onEnd();
                }
            }
            pauseSong() {
                this.playing = false;
                let song = this.songs[this.currentSong];
                if (song && song.audio) song.audio.pause();
                this.lastSendTime = -1;
            }
            resetSong(id) {
                this.songs[id].index = 0;
                if (this.songs[id].audio) this.songs[id].audio.currentTime = 0;
                this.lastSendTime = -1;
            }
            resetAll() {
                this.songs.forEach((e) => {
                    e.index = 0;
                    if (e.audio) e.audio.currentTime = 0;
                });
                this.lastSendTime = -1;
            }
        }
        let Vf = new songChatoe2735(sp);
        // Random mode: when a song ends, the next random one starts about a second later.
        let VA = false;
        Vf.onEnd = () => {
            if (VA) {
                fU.tickBase(() => {
                    if (VA && !Vf.playing) {
                        Vf.playSong(s4.randInt(0, Vf.songs.length));
                    }
                }, 9);
            }
        };
        function Ve() {
            if (Vf.playing) {
                VA = false;
                Vf.pauseSong();
            } else if (fu.songChat) {
                VA = true;
                Vf.resetAll();
                Vf.playSong(s4.randInt(0, Vf.songs.length));
            } else {
                VA = false;
                Vf.playSong(parseInt(fl.songChat) || 0);
            }
        }
        function Vs() {
            let ci = AQ.aim2;
            let cC = Infinity;
            let cK = AQ.inTrap;
            if (AQ.dist2 - Ai.scale * 1.8 <= s5.weapons[Ai.weapons[0]].range && !cK) {
                // Knockback reaches at most ~300 px from the enemy.
                for (let cd of roboticsGrid.near(AQ.x2, AQ.y2, 500, roboticsNearTmp)) {
                    if (cd.dmg && cd.active && cd.isTeamObject(Ai) || cd.type == 1 && cd.y >= 12000) {
                        let ck = ((s5.weapons[Ai.weapons[0]].knock || 0) + 0.3) * s5.weapons[Ai.weapons[0]].range + Ai.scale * 2;
                        let cQ = ![undefined, 9, 12, 13, 15].includes(Ai.weapons[1]) ? (s5.weapons[Ai.weapons[1]].knock || 0) * s5.weapons[Ai.weapons[1]].range + Ai.scale * 2 - 10 : Ai.weapons[1] != undefined ? 60 : 0;
                        let cg = ck + cQ;
                        let cp = Ai.reloads[53] == 0 ? ck + cQ + 75 : cg;
                        let cW = AQ.x2 + ck * Math.cos(ci);
                        let ct = AQ.y2 + ck * Math.sin(ci);
                        let cn = AQ.x2 + cQ * Math.cos(ci);
                        let cz = AQ.y2 + cQ * Math.sin(ci);
                        let cx = AQ.x2 + cg * Math.cos(ci);
                        let cM = AQ.y2 + cg * Math.sin(ci);
                        let cY = AQ.x2 + cp * Math.cos(ci);
                        let co = AQ.y2 + cp * Math.sin(ci);
                        if (s4.getDist({
                            x: cW,
                            y: ct
                        }, cd, 0, 0) < cd.getScale() + Ai.scale && Ai.primaryReloaded) {
                            return "primary sync";
                        }
                        if (s4.getDist({
                            x: cx,
                            y: cM
                        }, cd, 0, 0) < cd.getScale() + Ai.scale && Ai.primaryReloaded && Ai.secondaryReloaded && AQ.dist2 <= s5.weapons[Ai.weapons[1]].range + Ai.scale * 1.8) {
                            return "insta them";
                        }
                    }
                }
            } else {}
            return false;
        }
        // Marks the last point the spike-tick check sampled (A8).
        function VV(ci, cC, cK) {
            fV.globalAlpha = 0.5;
            fV.fillStyle = "#A9A9A9";
            fV.beginPath();
            fV.arc(A8.mex - cC, A8.mey - cK, 52.5, 0, Math.PI * 2);
            fV.fill();
        }
        function Vr(ci) {
            AN.push(new eK(ci.x, ci.y, ci.dir, ci.buildIndex, ci.weaponIndex, ci.weaponVariant, ci.skinColor, ci.scale, ci.name));
        }
        function Vc(ci) {
            As = ci.teams;
        }
        function VF(ci) {
            AT = {};
            e0 = {};
            AC = ci;
            AJ = 0;
            AX = true;
            A0("F", 0, sZ(), 1);
            AW.ageInsta = true;
            if (Am) {
                Am = false;
                Ac.length = 0;
                roboticsGrid.clear();
            }
            x.style.display = "block";
        }
        function VH(ci, cC) {
            let cK = Ax(ci[0]);
            if (!cK) {
                cK = new ed(ci[0], ci[1], r, s4, sf, s6, Ae, AA, s5, s8, s9);
                Ae.push(cK);
                if (ci[1] != AC) {
                    fO("Game", "Encountered " + ci[2] + " {" + ci[1] + "}.", "lightblue");
                }
            } else if (ci[1] != AC) {
                fO("Game", "Encountered " + ci[2] + " {" + ci[1] + "}.", "lightblue");
            }
            cK.spawn(cC ? true : null);
            cK.visible = false;
            cK.oldPos = {
                x2: undefined,
                y2: undefined
            };
            cK.x2 = undefined;
            cK.y2 = undefined;
            cK.x3 = undefined;
            cK.y3 = undefined;
            cK.setData(ci);
            if (cC) {
                if (!Ai) {
                    window.prepareUI(cK);
                }
                Ai = cK;
                Aa = Ai.x;
                Au = Ai.y;
                AW.lastDir = 0;
                VP();
                Vt();
                sX();
                if (Ai.skins[7]) {
                    AW.reSync = true;
                }
            }
        }
        function VN(ci) {
            for (let cC = 0; cC < Ae.length; cC++) {
                if (Ae[cC].id == ci) {
                    fO("Game", Ae[cC].name + " left the game", "yellow");
                    Ae.splice(cC, 1);
                    break;
                }
            }
        }
        /* Auto-heal. Same rules as before, but it runs when something can have
           changed (your health packet, every tick, and every frame for timing
           precision) instead of on a 4 ms interval, and it reads your own damage
           threat instead of the last player whose health changed.
           Normally it waits 120 ms - ping/2 after your last hit (no shame);
           it heals sooner when the predicted damage would kill you. */
        function roboticsAutoHeal() {
            if (!AX || !Ai || AW.healed || Ai.health >= 100) {
                return;
            }
            let ci = Date.now() - Ai.lastHit;
            let cC = Ap.avg / 2;
            let cK = Ai.shameCount <= 5;
            let cd = Ai.damageThreat >= Ai.health;
            let ck = ci > 120 - cC || cK && Ai.health < 70 && cd && ci > 85 - cC || cd && ci > 40 - cC || cK && Ai.health <= 50 && ci > 50 - cC || cK && Ai.health <= 70 && ci > 30 - cC && AQ.secondaryReloaded === false;
            if (ck) {
                eZ();
                // If the packet budget cut the heal short, try again next frame.
                AW.healed = eR() === 0;
            }
        }
        function VK(ci, cC) {
            AK = AM(ci);
            if (AK) {
                let ck = cC - AK.health;
                // Only your own health changes move your heal timer.
                if (AK === Ai) {
                    Ai.lastHeal = Date.now();
                    Ai.lastHit = Date.now();
                    Ai.outHealed = false;
                    // Damage: start counting heals from zero again. Healing: those heals have landed.
                    AW.pendingHeal = ck < 0 ? 0 : Math.max(0, AW.pendingHeal - ck);
                }
                if (ck < 0) {
                    AK.damagedTick = fU.tick + 1;
                }
                if (ck <= 0) {
                    AK.hitTime = Date.now();
                    AW.antiInsta = true;
                    // Damage of this hit (oldHealth is never updated after spawn).
                    AK.damaged = AK.health - cC;
                    ey.push([ci, cC, AK.damaged]);
                } else if (AK.hitTime) {
                    let cQ = Date.now() - AK.hitTime;
                    AK.hitTime = 0;
                    if (cQ <= 120) {
                        AK.shameCount += 1;
                        if (AK.shameCount > AK.maxShame) {
                            AK.maxShame = AK.shameCount;
                        }
                    } else {
                        AK.shameCount = Math.max(0, AK.shameCount - 2);
                    }
                }
                AK.health = cC;
                if (AK === Ai && ck < 0) {
                    roboticsAutoHeal();
                }
            }
        }
        let Vd = [];
        let Vk = 0;
        function VQ() {
            let ci = Date.now() - Vk;
            Vd.push(ci);
            if (Vd.length > 10) {
                Vd.shift();
            }
            Vg(Vd);
        }
        function Vg(ci) {
            if (ci.length === 0) {
                return 0;
            }
            let cC = [...ci].sort((cd, ck) => cd - ck);
            let cK = Math.floor(cC.length / 2);
            if (cC.length % 2 === 0) {
                Ap.avg = (cC[cK - 1] + cC[cK]) / 2;
            } else {
                Ap.avg = cC[cK];
            }
            Ap.min = cC[0];
            Ap.max = cC[cC.length - 1];
        }
        function Vp() {
            eM = false;
            AX = false;
            si = {
                x: Ai.x,
                y: Ai.y
            };
            fU.tickBase(() => {
                if (fu.autoRespawn) {
                    A0("M", {
                        name: fX[0],
                        moofoll: fX[1],
                        skin: fX[2]
                    });
                }
            }, 5);
            setTimeout(() => {
                if (AX) {
                    f4.style.display = "none";
                    k.style.display = "none";
                    Y.style.display = "none";
                }
            }, r.deathFadeout);
        }
        function VW(ci, cC) {
            if (Ai) {
                Ai.itemCounts[ci] = cC;
                sX(ci);
            }
        }
        function Vt(ci, cC, cK) {
            if (ci != undefined) {
                Ai.XP = ci;
            }
            if (cC != undefined) {
                Ai.maxXP = cC;
            }
            if (cK != undefined) {
                Ai.age = cK;
            }
        }
        function Vn(ci, cC) {
            Ai.upgradePoints = ci;
            Ai.upgrAge = cC;
            if (ci > 0) {
                s3.length = 0;
                s4.removeAllChildren(f6);
                for (let cK = 0; cK < s5.weapons.length; ++cK) {
                    if (s5.weapons[cK].age == cC && (s5.weapons[cK].pre == undefined || Ai.weapons.indexOf(s5.weapons[cK].pre) >= 0)) {
                        let cd = s4.generateElement({
                            id: "upgradeItem" + cK,
                            class: "actionBarItem",
                            onmouseout: function () {
                                sx();
                            },
                            parent: f6
                        });
                        cd.style.backgroundImage = getEl("actionBarItem" + cK).style.backgroundImage;
                        s3.push(cK);
                    }
                }
                for (let ck = 0; ck < s5.list.length; ++ck) {
                    if (s5.list[ck].age == cC && (s5.list[ck].pre == undefined || Ai.items.indexOf(s5.list[ck].pre) >= 0)) {
                        let cQ = s5.weapons.length + ck;
                        let cg = s4.generateElement({
                            id: "upgradeItem" + cQ,
                            class: "actionBarItem",
                            onmouseout: function () {
                                sx();
                            },
                            parent: f6
                        });
                        cg.style.backgroundImage = getEl("actionBarItem" + cQ).style.backgroundImage;
                        s3.push(cQ);
                    }
                }
                for (let cp = 0; cp < s3.length; cp++) {
                    (function (cW) {
                        let ct = getEl("upgradeItem" + cW);
                        ct.onmouseover = function () {
                            if (s5.weapons[cW]) {
                                sx(s5.weapons[cW], true);
                            } else {
                                sx(s5.list[cW - s5.weapons.length]);
                            }
                        };
                        ct.onclick = s4.checkTrusted(function () {
                            A0("H", cW);
                        });
                        s4.hookTouchEvents(ct);
                    })(s3[cp]);
                }
                if (s3.length) {
                    f6.style.display = "block";
                    Z.style.display = "block";
                    Z.innerHTML = "SELECT ITEMS (" + ci + ")";
                } else {
                    f6.style.display = "none";
                    Z.style.display = "none";
                    sx();
                }
            } else {
                f6.style.display = "none";
                Z.style.display = "none";
                sx();
            }
        }
        function Vz(ci) {
            let cC = Ao(ci);
            s6.disableBySid(ci);
            if (Ai && cC) {
                if (!Ai.canSee(cC)) {
                    sQ.push({
                        x: cC.x,
                        y: cC.y
                    });
                }
                if (sQ.length > 8) {
                    sQ.shift();
                }
                ss.autoReplace(cC);
            }
        }
        function Vx(ci) {
            if (Ai) {
                s6.removeAllItems(ci);
            }
        }
        function VM(ci) {
            return Ai.reloads[ci] > 0;
        }
        function VY(ci) {
            return Ai.weaponIndex != ci || Ai.buildIndex > -1;
        }
        let Vo = function () {
            if (AW.anti0Tick > 0 || AW.forceStop) {
                et(6, 0);
            } else {
                let ci = VS();
                if (fu.hatType && fl.hatType == "ag" && Date.now() - Ai.moveTime > 1234 && Ai.health == 100 && Date.now() - Ai.lastHit > 1234 && Date.now() - Ai.lastGather > 1234 && !eM) {
                    et(56, 0);
                } else if (so.left || so.right) {
                    if (so.left) {
                        et(Ai.primaryReloaded ? fu.weaponGrind ? 40 : 7 : Ai.tailIndex == 11 ? 7 : Ai.empAnti || Ai.antiTurretSpam ? 22 : Ai.soldierAnti ? 6 : fu.antiBullType && fl.antiBullType == "abreload" && AQ.antiBull > 0 ? 11 : AQ.dist2 <= 300 ? fu.antiBullType && fl.antiBullType == "abalway" && AQ.reloads[AQ.primaryIndex] == 0 ? 11 : 6 : el(1, 1), 0);
                    } else if (so.right) {
                        et(Ai[(sV.useHammer() ? "secondary" : "primary") + "Reloaded"] && eW != 40 ? 40 : Ai.empAnti || Ai.antiTurretSpam ? 22 : Ai.soldierAnti ? 6 : fu.antiBullType && fl.antiBullType == "abreload" && AQ.antiBull > 0 ? 11 : AQ.dist2 <= 300 ? fu.antiBullType && fl.antiBullType == "abalway" && AQ.reloads[AQ.primaryIndex] == 0 ? 11 : 6 : el(1, 1), 0);
                    }
                } else if (sV.active && sV.target) {
                    let cC = sV.useHammer(sV.target) ? Ai.weapons[1] : Ai.weapons[0];
                    if (sV.target.health > s5.weapons[cC].dmg * (s5.weapons[cC].sDmg || 1) && Ai[(cC < 9 ? "primary" : "secondary") + "Reloaded"]) {
                        et(40, 0);
                    } else if (ci && Ai.shameCount > 0 && !Ai.inTrap) {
                        et(7, 0);
                    } else {
                        et(Ai.empAnti || AQ.dist2 > 300 || !Ad.length ? 22 : 6, 0);
                    }
                } else if (Ai.empAnti || Ai.antiTurretSpam || Ai.soldierAnti) {
                    et(Ai.empAnti || Ai.antiTurretSpam ? 22 : 6, 0);
                } else if (ci && Ai.shameCount > 0 && !Ai.inTrap) {
                    et(7, 0);
                } else if (roboticsAntiBullWanted()) {
                    et(11, 0);
                } else if (fu.smartHats && Ad.length) {
                    roboticsSmartHat();
                } else if (Ai.inWater) {
                    if (!fu.alwaysFlipper) {
                        if (AQ.dist2 <= 300) {
                            et(fu.antiBullType && fl.antiBullType == "abreload" && AQ.antiBull > 0 ? 11 : fu.antiBullType && fl.antiBullType == "abalway" && AQ.primaryReloaded ? 11 : 6, 0);
                        } else {
                            el(1);
                        }
                    } else {
                        el(1);
                    }
                } else if (AQ.dist2 <= 300) {
                    et(fu.antiBullType && fl.antiBullType == "abreload" && AQ.antiBull > 0 ? 11 : fu.antiBullType && fl.antiBullType == "abalway" && AQ.primaryReloaded ? 11 : 6, 0);
                } else {
                    el(1);
                }
            }
        };
        let VG = function () {
            if (Ai.weapons[0] != 8 && (AW.autoPush && s4.getDist(Ai, AW.pushData, 2, 2) <= 169 || AQ.hitSpike || !AW.autoPush && (so.left || AQ.dist2 < 300))) {
                if (fu.antiBullType) {
                    et(21, 1);
                } else {
                    et(19, 1);
                }
            } else if (AQ.dist2 <= 400) {
                et(19, 1);
            } else {
                et(11, 1);
            }
        };
        function VS() {
            if (Ai.inTrap && Ai.hitSpike) {
                return false;
            }
            if (AW.reSync) {
                return true;
            }
            if (Ai.shameCount > 0 && AW.anti0Tick <= 0 && !AW.forceStop && Ai.skinIndex != 45 && Ai.health > 5 && !(Ai.poisonCounter > 0) && AW.bullTick && !Ai.canEmpAnti) {
                if ((fU.tick - Ai.bullTick) % 9 == 8 || Ai.needTick > 2) {
                    if (!sV.active && !sc.isTrue) {
                        Ai.needTick++;
                    }
                    return true;
                }
            }
            return false;
        }
        let Vv = new Set();
        let VE = performance.now();
        function Vb(ci, cC = 0) {
            let cK = VE + fU.tickRate;
            let cd = cK - Ap.avg / 2;
            let ck = cd - performance.now() + cC;
            setTimeout(() => {
                ci();
            }, ck);
        }
        function VZ(ci) {
            fU.tickSpeed = performance.now() - fU.lastTick;
            fU.lastTick = performance.now();
            VE = fU.lastTick - Ap.avg / 2;
            fU.beginTick(true);
            // Before your first spawn there is nothing to update, but scheduled work still runs.
            if (!Ai) {
                fU.runDue();
                return;
            }
            Ad = [];
            Ak = [];
            Ae.forEach(cC => {
                cC.forcePos = !cC.visible;
                cC.visible = false;
            });
            for (let cC = 0; cC < ci.length;) {
                AK = AM(ci[cC]);
                if (AK) {
                    AK.t1 = AK.t2 === undefined ? fU.lastTick : AK.t2;
                    AK.t2 = fU.lastTick;
                    AK.oldPos.x2 = AK.x2;
                    AK.oldPos.y2 = AK.y2;
                    AK.x1 = AK.x;
                    AK.y1 = AK.y;
                    AK.x2 = ci[cC + 1];
                    AK.y2 = ci[cC + 2];
                    AK.x3 = AK.x2 + (AK.x2 - AK.oldPos.x2);
                    AK.y3 = AK.y2 + (AK.y2 - AK.oldPos.y2);
                    // Velocity (px/ms), position in the server update order and incoming shots, for the simulator.
                    AK.vx = isFinite(AK.oldPos.x2) ? (AK.x2 - AK.oldPos.x2) / (fU.tickSpeed || fU.tickRate) : 0;
                    AK.vy = isFinite(AK.oldPos.y2) ? (AK.y2 - AK.oldPos.y2) / (fU.tickSpeed || fU.tickRate) : 0;
                    AK.updateOrder = cC / 13;
                    AK.projDamage = 0;
                    AK.d1 = AK.d2 === undefined ? ci[cC + 3] : AK.d2;
                    AK.d2 = ci[cC + 3];
                    AK.dt = 0;
                    AK.buildIndex = ci[cC + 4];
                    AK.weaponIndex = ci[cC + 5];
                    AK.weaponVariant = ci[cC + 6];
                    AK.team = ci[cC + 7];
                    AK.isLeader = ci[cC + 8];
                    AK.oldSkinIndex = AK.skinIndex;
                    AK.oldTailIndex = AK.tailIndex;
                    AK.skinIndex = ci[cC + 9];
                    AK.tailIndex = ci[cC + 10];
                    AK.iconIndex = ci[cC + 11];
                    AK.zIndex = ci[cC + 12];
                    AK.visible = true;
                    AK.update(fU.tickSpeed);
                    AK.dist2 = s4.getDist(AK, Ai, 2, 2);
                    AK.aim2 = s4.getDirect(AK, Ai, 2, 2);
                    AK.dist3 = s4.getDist(AK, Ai, 3, 3);
                    AK.aim3 = s4.getDirect(AK, Ai, 3, 3);
                    AK.hitSpike = 0;
                    AK.updateShameTimer();
                    if (AK.skinIndex == 45 && AK.shameTimer <= 0) {
                        AK.addShameTimer();
                    }
                    if (AK.oldSkinIndex == 45 && AK.skinIndex != 45) {
                        AK.shameTimer = 0;
                        AK.shameTimerEnd = 0;
                        AK.shameCount = 0;
                        if (AK == Ai) {
                            eZ();
                        }
                    }
                    let cK = roboticsGrid.near(AK.x2, AK.y2, 150, roboticsNearTmp).filter(cd => cd.trap && cd.active && s4.getDist(cd, AK, 0, 2) <= AK.scale + cd.getScale() + 3 && !cd.isTeamObject(AK)).sort(function (cd, ck) {
                        return s4.getDist(cd, AK, 0, 2) - s4.getDist(ck, AK, 0, 2);
                    })[0];
                    if (cK) {
                        cK.hideFromEnemy = false;
                    }
                    AK.lastTrap = AK.inTrap;
                    AK.inTrap = cK;
                    AK.escaped = !AK.inTrap && AK.lastTrap;
                    if (AK == Ai) {
                        AK.damageThreat = 0;
                        AK.mostDamageThreat = 0;
                        AK.leastDamageThreat = 0;
                        AK.turretThreat = 0;
                        let cd = 0;
                        AK.inWater = AK.y2 >= r.mapScale / 2 - r.riverWidth / 2 && AK.y2 <= r.mapScale / 2 + r.riverWidth / 2;
                        if (Ac.length) {
                            // Turret reloads only matter within range of you or the enemy you fight.
                            roboticsGrid.turrets.forEach(cQ => {
                                if (cQ.active && Math.abs(cQ.x - Ai.x2) <= 1500 && Math.abs(cQ.y - Ai.y2) <= 1500) {
                                    if (cQ.isItem && cQ.owner && cQ.name == "turret") {
                                        if (s4.getDist(Ai, cQ, 2, 0) < 680 && !cQ.isTeamObject(AK)) {
                                            cd++;
                                        }
                                        if (cQ.reloads <= 0) {
                                            cQ.reloads = 2200;
                                        } else {
                                            cQ.reloads -= fU.tickRate;
                                        }
                                        if (s4.getDist(Ai, cQ, 2, 0) < 680 && !cQ.isTeamObject(AK) && cQ.reloads <= Ap.max) {
                                            cd++;
                                            Ai.addDamageThreat(25);
                                            Ai.turretThreat += 25;
                                        }
                                    }
                                }
                            });
                            AK.antiTurretSpam = cd >= 5;
                            AF = roboticsGrid.near(AK.x2, AK.y2, 500, roboticsNearTmp).filter(cQ => cQ.active && s4.getDist(cQ, AK, 0, 2) <= 500).sort((cQ, cg) => {
                                return s4.getDist(cQ, AK, 0, 2) - s4.getDist(cg, AK, 0, 2);
                            });
                            let ck = AF.filter(cQ => cQ.dmg && s4.getDist(cQ, Ai, 0, 2) <= 169 && !cQ.isTeamObject(AK)).sort(function (cQ, cg) {
                                return s4.getDist(cQ, AK, 0, 2) - s4.getDist(cg, AK, 0, 2);
                            });
                            if (cK) {
                                ss.info = cK;
                                let cQ = s4.getDirect(cK, Ai, 0, 2);
                                if (!ss.antiTrapped) {
                                    ss.protect(cQ);
                                }
                                [ck[0], cK, ck[1]].forEach(cg => {
                                    if (cg && !sV.priority[0].includes(cg)) {
                                        sV.priority[0].push(cg);
                                    }
                                });
                            } else {
                                ss.antiTrapped = false;
                            }
                            if (fu.breakSpikeSwitch) {
                                ck.forEach(cg => {
                                    if (!sV.priority[1].includes(cg)) {
                                        sV.priority[1].push(cg);
                                    }
                                });
                            }
                            if (fu.breakTrapSwitch) {
                                let cg = AF.filter(cp => !cp.isTeamObject(Ai) && cp.trap);
                                cg.forEach(cp => {
                                    if (!sV.priority[1].includes(cp)) {
                                        sV.priority[1].push(cp);
                                    }
                                });
                            }
                            if (fu.breakTTBSwitch) {
                                let cp = AF.filter(cW => !cW.isTeamObject(Ai) && (cW.name == "turret" || cW.name == "teleporter" || cW.name == "blocker"));
                                cp.forEach(cW => {
                                    if (!sV.priority[2].includes(cW)) {
                                        sV.priority[2].push(cW);
                                    }
                                });
                            }
                            if (fu.breakAllSwitch) {
                                AF.forEach(cW => {
                                    if (cW.type == null && !sV.priority[3].includes(cW)) {
                                        sV.priority[3].push(cW);
                                    }
                                });
                            }
                        } else {
                            AF = [];
                        }
                    }
                    if (AK.weaponIndex < 9) {
                        AK.primaryIndex = AK.weaponIndex;
                        AK.primaryVariant = AK.weaponVariant;
                    } else if (AK.weaponIndex > 8) {
                        AK.secondaryIndex = AK.weaponIndex;
                        AK.secondaryVariant = AK.weaponVariant;
                    }
                }
                cC += 13;
            }
            if (se.stack.length) {
                let cW = [];
                let ct = [];
                let cn = 0;
                let cz = 0;
                let cx = {
                    x: null,
                    y: null
                };
                let cM = {
                    x: null,
                    y: null
                };
                se.stack.forEach(cY => {
                    if (cY.value >= 0) {
                        if (cn == 0) {
                            cx = {
                                x: cY.x,
                                y: cY.y
                            };
                        }
                        cn += Math.abs(cY.value);
                    } else {
                        if (cz == 0) {
                            cM = {
                                x: cY.x,
                                y: cY.y
                            };
                        }
                        cz += Math.abs(cY.value);
                    }
                });
                if (cz > 0) {
                    se.showText(cM.x, cM.y, Math.max(45, Math.min(50, cz)), 0.18, 500, cz, "#8ecc51");
                }
                if (cn > 0) {
                    se.showText(cx.x, cx.y, Math.max(45, Math.min(50, cn)), 0.18, 500, cn, "#fff");
                }
                se.stack = [];
            }
            if (fm.length) {
                fm.forEach(cY => {
                    sW(...cY);
                });
                fm = [];
            }
            AH.forEach(cY => {
                cY.tickUpdate(fU.tickSpeed);
            });
            for (let cY = 0; cY < ci.length;) {
                AK = AM(ci[cY]);
                if (AK) {
                    if (!AK.isTeam(Ai)) {
                        Ad.push(AK);
                        if (AK.dist2 <= s5.weapons[AK.primaryIndex == undefined ? 5 : AK.primaryIndex].range + Ai.scale * 2 + 69) {
                            Ak.push(AK);
                        }
                    }
                    AK.manageReload();
                }
                cY += 13;
            }
            AQ = {};
            if (Ad.length) {
                AQ = Ad.sort(function (co, cG) {
                    return co.dist2 - cG.dist2;
                })[0];
            }
            // Due tickBase() callbacks run every tick, alive or not, after AQ is fresh.
            fU.runDue();
            roboticsSafeCall(() => roboticsPlacePotential.update(), "placement potential");
            if (Ai && Ai.alive) {
                V2();
                roboticsPatternRecTick();
                Ai.processDamages();
                // One tick: armed once by the velocity tick key, or every tick with "Dynamic One Tick" on.
                if ((sB.oneTick || fu.dynamicOneTick) && AW.anti0Tick <= 0 && !AW.forceStop && fy < 69) {
                    let co = roboticsOneTickPlan();
                    if (co) {
                        sc.dynamicOneTickType(co);
                        sB.oneTick = false;
                        se.showText(Ai.x, Ai.y, 30, 0.15, 1850, "One Tick", "#7289DA", 2);
                    }
                }
                if (ey.length) {
                    ey.forEach(co => {
                        let cG = co[0];
                        let cS = co[1];
                        let cv = co[2];
                        let cE = false;
                        AK = AM(cG);
                        // The player may have left since the health packet arrived.
                        if (!AK) {
                            return;
                        }
                        if (AK.health <= 0) {
                            if (!AK.death) {
                                AK.death = true;
                                if (AK != Ai) {
                                    fO("", AK.name + " {" + AK.sid + "} has died.", "red");
                                }
                                Vr(AK);
                            }
                        }
                        let cb = AF.find(cR => (cR.type == 1 && cR.y >= 12000 || cR.dmg && !cR.isTeamObject(AK)) && s4.getDist(cR, AK, 0, 2) <= cR.scale + AK.scale + 1);
                        if (cb && cv == cb.dmg * (AK.skinIndex == 6 ? 0.75 : 1)) {
                            AK.hitSpike = cb.dmg || 35;
                        }
                        // Bull helmet drain / poison tick on you (other players' drains no longer move your bull timing).
                        if (AK.sid == Ai.sid && cv == (Ai.skinIndex == 6 ? 0.75 : 1) * 5) {
                            Ai.bullTick = fU.tick;
                            {
                                AK.needTick = 0;
                                AW.reSync &&= false;
                                if (Ai.skinIndex == 7) {
                                    cE = true;
                                } else {
                                    Ai.poisonCounter--;
                                }
                            }
                        }
                        if (AK.sid == Ai.sid) {
                            if (AX) {
                                let cR = AQ.primaryIndex == 5 && [undefined, 9, 12, 13, 15].includes(AQ.secondaryIndex) ? 6 : [7, 8].includes(AQ.primaryIndex) ? 3 : 5;
                                if (AK.hitSpike && (AK.inTrap || AK.lastTrap)) {
                                    cR = 7;
                                    AK.addDamageThreat(AK.hitSpike);
                                } else {
                                    AK.hitSpike = 0;
                                }
                                let cD = eD(cv);
                                let cZ = 100 - Ai.health;
                                let cO = 5;
                                if (cZ + AK.mostDamageThreat >= 100 && cZ + AK.damageThreat < 100) {
                                    AW.forceStop = true;
                                }
                                if (cD.some(cI => [undefined, 9, 12, 13, 15].includes(cI.secondaryIndex))) {
                                    if (cv > 39 && cv < 80 && cZ + AK.damageThreat >= 100) {
                                        if (fU.tick - AK.antiTimer > 1) {
                                            AK.canEmpAnti = true;
                                            AK.antiTimer = fU.tick;
                                        }
                                        if (AK.shameCount < cR) {
                                            roboticsAntiInstaHeal();
                                        }
                                    } else if ([18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(cv) && cZ + AK.damageThreat >= 100) {
                                        if (fU.tick - AK.antiTimer > 1) {
                                            AK.canEmpAnti = true;
                                            AK.antiTimer = fU.tick;
                                        }
                                        if (AK.shameCount < cR) {
                                            roboticsAntiInstaHeal();
                                        }
                                    } else if (cv > cO && cZ + AK.damageThreat >= 100) {
                                        if (AK.shameCount < cR) {
                                            roboticsAntiInstaHeal();
                                        }
                                    }
                                } else if (cv > cO && cZ + AK.damageThreat >= 100) {
                                    if (AK.shameCount < cR) {
                                        roboticsAntiInstaHeal();
                                    }
                                }
                                if (cv >= 20 && Ai.skinIndex == 11 && !roboticsAntiBullMode()) {
                                    sc.canCounter = true;
                                }
                            }
                        }
                    });
                    ey = [];
                    AW.healed = false;
                }
                roboticsAutoHeal();
                Ae.forEach(co => {
                    if (!co.visible && Ai != co) {
                        co.reloads = {
                            0: 0,
                            1: 0,
                            2: 0,
                            3: 0,
                            4: 0,
                            5: 0,
                            6: 0,
                            7: 0,
                            8: 0,
                            9: 0,
                            10: 0,
                            11: 0,
                            12: 0,
                            13: 0,
                            14: 0,
                            15: 0,
                            53: 0
                        };
                    }
                });
                if (AX) {
                    if (Ad.length) {
                        ss.preplaces[0] = [];
                        ss.preplaces[1] = [];
                        if (fu.autoPlace && fu.gradedAutoPlace) {
                            roboticsSafeCall(roboticsGradedAutoPlace, "graded auto place");
                        } else if (AQ.dist2 <= 222) {
                            if (AW.autoPush) {
                                ss.autoPlace(1, 4, 2, true);
                            } else if (AQ.inTrap) {
                                ss.autoPlace(0, 2, 4);
                            } else if (AQ.escaped) {
                                ss.autoPlace(0, 4, 2);
                            } else {
                                ss.autoPlace(1, 2, 4, true);
                            }
                        } else if (AQ.dist2 > 269 && AQ.dist2 < 400) {
                            ss.autoPlace(0, 4, 2);
                        } else if (AQ.dist2 <= 269) {
                            ss.autoPlace(1, 4, 2, true);
                        }
                        if (Ai.canEmpAnti) {
                            Ai.canEmpAnti = false;
                            // With Smart Anti-Insta on, roboticsLethalDecision() picks the hat instead.
                            if (!fu.smartAntiInsta && AQ.dist2 <= 300 && !AW.safePrimary(AQ) && !AW.safeSecondary(AQ)) {
                                if (AQ.reloads[53] == 0) {
                                    Ai.empAnti = true;
                                    Ai.soldierAnti = false;
                                } else {
                                    Ai.empAnti = false;
                                    Ai.soldierAnti = true;
                                }
                            }
                        }
                        if (fu.breakAroundSwitch) {
                            if (AQ.inTrap) {
                                let co = AF.filter(cG => s4.getDist(cG, AQ.inTrap, 0, 0) < 200 && (!cG.dmg || !cG.isTeamObject(Ai)) && cG.sid != AQ.inTrap.sid && !cG.trap);
                                co.forEach(cG => {
                                    if (!sV.priority[1].includes(cG)) {
                                        sV.priority[1].push(cG);
                                    }
                                });
                            }
                        }
                        if (!sc.isTrue && fu.spikeTick) {
                            if (AW.autoPush && AQ.hitSpike) {
                                let cG = AQ.reloads[AQ.secondaryIndex == 10 ? AQ.secondaryIndex : AQ.primaryIndex];
                                if (s5.weapons[Ai.weapons[0]].speed < cG || cG == 0) {
                                    AQ.hitSpike = 0;
                                    sc.canSpikeTick = true;
                                }
                            }
                        }
                        if (fu.anti1tick) {
                            Ad.forEach(cS => {
                                if (cS.primaryIndex == 5 && cS.primaryVariant >= 2) {
                                    if (cS.dist2 >= 169 && cS.dist2 <= 269) {
                                        if (cS.skinIndex == 53) {
                                            AW.anti0Tick = 2;
                                            eO(1);
                                            Ai.chat.message = "Anti 1 tick by " + cS.sid + " " + cS.name;
                                            Ai.chat.count = 334;
                                        }
                                    }
                                }
                            });
                        }
                        if (Ak.length > 1 && Ak.some(cS => [undefined, 3, 4, 5].includes(cS.primaryIndex)) && fy < 60) {
                            if (fu.autoQonSync && Ai.shameCount < 5) {
                                AW.anti0Tick = 3;
                                eO(2);
                                Ai.chat.message = "sync detect test";
                                Ai.chat.count = 334;
                            }
                        }
                        if (fu.serverSync && V7.length && Ak.length) {
                            Ak.forEach(cS => {
                                V7.forEach(cv => {
                                    if (cS.sid == cv) {
                                        return;
                                    }
                                    let cE = cS.dist2;
                                    let cb = AM(cv);
                                    if (!cb) {
                                        return;
                                    }
                                    let cR = s4.getDist(cb, cS, 2, 2);
                                    if (cE <= Ai.scale * 1.8 + s5.weapons[Ai.weapons[0]].range && cR <= Ai.scale * 1.8 + s5.weapons[cb.primaryIndex || 5].range && Ai.primaryReloaded && cb.primaryReloaded) {
                                        sc.spikeTickType();
                                    }
                                });
                            });
                        }
                        if (!sc.isTrue && fu.predictTick && AW.anti0Tick <= 0 && !AW.forceStop && !AQ.inTrap) {
                            let cS = Vs();
                            if (cS == "insta them" && (![9, 12, 13, 15].includes(Ai.weapons[1]) || AQ.dist2 <= s5.weapons[Ai.weapons[1]].range + Ai.scale * 1.8)) {
                                sc.changeType("rev");
                            }
                            if (cS == "primary sync") {
                                sc.spikeTickType("rev");
                            }
                            let cv = AF.filter(cE => cE.dmg && cE.isTeamObject(Ai) && s4.getDist(cE, AQ, 0, 3) <= cE.scale + AQ.scale).sort(function (cE, cb) {
                                return s4.getDist(cE, AQ, 0, 2) - s4.getDist(cb, AQ, 0, 2);
                            })[0];
                            if (cv) {
                                if (AQ.dist2 <= s5.weapons[Ai.weapons[0]].range + Ai.scale * 1.8) {
                                    sc.canSpikeTick = true;
                                }
                            }
                        }
                    }
                    if (AQ.dist2 <= s5.weapons[Ai.weapons[1] == 10 ? Ai.weapons[1] : Ai.weapons[0]].range + AQ.scale * 1.8 && sc.wait && !sc.isTrue && !AW.waitHit && Ai.primaryReloaded && Ai.secondaryReloaded && sc.perfCheck(Ai, AQ)) {
                        sc.can = true;
                    } else {
                        sc.can = false;
                    }
                    if (e0[RK.heal]) {
                        roboticsHealOnce();
                    }
                    if (e0[RK.trap]) {
                        ev(4, sD());
                    }
                    if (e0[RK.spike]) {
                        ev(2, sD());
                    }
                    if (e0[RK.stoneOrSapling]) {
                        ev(5, sD());
                    }
                    if (e0[RK.turretType]) {
                        ev(Ai.getItemType(22), sD());
                    }
                    if (e0[RK.mill]) {
                        ev(3, sD());
                    }
                    if (e0[RK.debugAngles]) {
                        // angleRanges() stores its result in sr.ranges and returns nothing.
                        sr.angleRanges(4);
                        sr.ranges.forEach(([cb, cR]) => {
                            let cD = Ai.items[4];
                            if (cD == undefined) {
                                return;
                            }
                            let cZ = s5.list[cD];
                            let cO = Ai.scale + cZ.scale + (cZ.placeOffset || 0);
                            let cI = (cR - cb + Math.PI * 2) % (Math.PI * 2) / 5;
                            for (let ca = 0; ca <= 5; ca++) {
                                let cu = cb + cI * ca;
                                if (cu > Math.PI) {
                                    cu -= Math.PI * 2;
                                }
                                let cl = Ai.x2 + cO * Math.cos(cu);
                                let cB = Ai.y2 + cO * Math.sin(cu);
                                e6.push({
                                    x: cl,
                                    y: cB,
                                    name: cZ.name,
                                    scale: cZ.scale
                                });
                                fU.tickBase(() => {
                                    e6.shift();
                                }, 1);
                            }
                        });
                    }
                    if (e0[RK.followPlace]) {
                        if (Ag) {
                            if (!fu.hatType || fl.hatType != "ag") {
                                A0("9", Ag.aim2, 1);
                                if (Ag.dist2 >= 145) {
                                    if (Ai.items[4] != 15) {
                                        ev(4, Ag.aim2);
                                    }
                                }
                            }
                            if (Ag.dist2 <= 70) {
                                ss.testCanPlace(2, 0, Math.PI * 2, Math.PI / 4, Ag.aim2, true, false, 2);
                            }
                        }
                    }
                    sP();
                    if (e1.place) {
                        if (s4.getDist(e1.old, Ai, 0, 2) > e1.millDist) {
                            let cb = Ai.items[4] == 16 ? 1.4 : 1.23456789;
                            ss.testCanPlace(3, -cb, cb, cb, s4.getDirect(e1.old, Ai, 0, 2), true);
                            e1.old = {
                                x: Ai.x2,
                                y: Ai.y2
                            };
                        }
                    }
                    if (e1.placeSpawnPads) {
                        if (s4.getDist(e1.old, Ai, 0, 2) > e1.spawnDist) {
                            ss.testCanPlace(Ai.getItemType(20), 0, Math.PI * 1.5, Math.PI / 2, s4.getDirect(e1.old, Ai, 0, 2), true);
                            e1.old = {
                                x: Ai.x2,
                                y: Ai.y2
                            };
                        }
                    }
                    AW.pushSpike = null;
                    V1();
                    if (!AW.safeWalk) {
                        V3();
                        if (!AW.autoPush && !A7) {
                            if (fu.autoPlay && Ad.length && AQ.dist2 < em.scale / 2) {
                                let cR = sN.calc({
                                    x: Math.cos(AQ.aim2 + Math.PI / 2) * (AQ.scale * 2),
                                    y: Math.sin(AQ.aim2 + Math.PI / 2) * (AQ.scale * 2)
                                }, false, "follow");
                                em.paths = cR.paths;
                                em.attempts = cR.attempts;
                                if (em.paths.length > 0) {
                                    em.finded = true;
                                    let cD = s4.getDirect(em.paths[1], Ai, 0, 2);
                                    A0("9", cD, 1);
                                } else if (em.attempts < 20) {
                                    cR = sN.calc({
                                        x: 0,
                                        y: 0
                                    }, true, "follow");
                                    em.paths = cR.paths;
                                    em.attempts = cR.attempts;
                                    if (em.paths.length > 0) {
                                        em.finded = true;
                                        let cZ = s4.getDirect(em.paths[1], Ai, 0, 2);
                                        A0("9", cZ, 1);
                                    } else {
                                        em.finded = false;
                                        A0("9", Ai.moveDir, 1);
                                    }
                                } else {
                                    em.finded = false;
                                }
                            } else {
                                em.finded = false;
                            }
                        } else {
                            em.finded = false;
                        }
                    } else if (AW.autoPush) {
                        AW.autoPush = false;
                        A0("9", Ai.moveDir, 1);
                    }
                    if (sc.can && AW.anti0Tick <= 0 && !AW.forceStop && fy < 69) {
                        sc.changeType(fu.revInsta || Ai.weapons[1] == 10 ? "rev" : "normal");
                    }
                    if (sc.canCounter && AW.anti0Tick <= 0 && fy < 69) {
                        sc.canCounter = false;
                        if (Ai.primaryReloaded && !sc.isTrue) {
                            sc.counterType();
                        }
                    }
                    if (sc.canSpikeTick && AW.anti0Tick <= 0 && !AW.forceStop && fy < 69) {
                        sc.canSpikeTick = false;
                        if (Ai.primaryReloaded && !sc.isTrue && AQ.dist2 <= s5.weapons[Ai.weapons[0]].range + Ai.scale * 1.8) {
                            sc.spikeTickType();
                        }
                    }
                    // Falcon attack modules, at most one per tick (roboticsFalconAttacks).
                    if (fy < 69) {
                        roboticsSafeCall(roboticsFalconAttacks, "falcon attacks");
                    }
                    sV.calculateAim();
                    if (AW.forceStop && eM) {
                        eY();
                    } else {
                        // When the mod is idle, auto gather goes back to what you chose with the auto gather key.
                        if (!so.middle && !so.left && !so.right && !sc.isTrue && !sV.active && eM !== !!AW.userGather) {
                            eY();
                        }
                        if (!so.middle && (so.left || so.right) && !sc.isTrue) {
                            if (Ai.weaponIndex != (so.right && sV.useHammer() ? Ai.weapons[1] : Ai.weapons[0]) || Ai.buildIndex > -1) {
                                ez(so.right && sV.useHammer() ? Ai.weapons[1] : Ai.weapons[0]);
                            }
                            if (Ai[(so.right && sV.useHammer() ? "secondary" : "primary") + "Reloaded"] && !AW.waitHit && !eM) {
                                eY();
                                AW.waitHit = 1;
                                fU.tickBase(() => {
                                    AW.waitHit = 0;
                                }, 1);
                            }
                        }
                        if (sV.active) {
                            if (!so.left && !so.right && !sc.isTrue) {
                                let cO = sV.useHammer(sV.target) ? Ai.weapons[1] : Ai.weapons[0];
                                if (Ai.weaponIndex != cO || Ai.buildIndex > -1) {
                                    ez(cO);
                                }
                                if (Ai[(cO < 9 ? "primary" : "secondary") + "Reloaded"] && !AW.waitHit && !eM) {
                                    eY();
                                    AW.waitHit = 1;
                                    fU.tickBase(() => {
                                        AW.waitHit = 0;
                                    }, 1);
                                }
                            }
                        }
                    }
                    if (so.middle && !Ai.inTrap) {
                        if (!sc.isTrue && Ai.secondaryReloaded) {
                            if (AW.ageInsta && Ai.weapons[0] != 4 && Ai.weapons[1] == 9 && Ai.age >= 9 && Ad.length) {
                                sc.bowMovement();
                            } else {
                                sc.rangeType();
                            }
                        }
                    }
                    if (!e0[RK.velocityTick] && !sc.isTrue && sc.ticking) {
                        sc.ticking = false;
                    }
                    if (e0[RK.boostTick] && !Ai.inTrap) {
                        if (!sc.isTrue && Ai.primaryReloaded && (![9, 12, 13, 15].includes(Ai.weapons[1]) || Ai.secondaryReloaded)) {
                            sc.boostTickMovement();
                        }
                    }
                    if (Ai.weapons[1] && !so.left && !so.right && !Ai.inTrap && !sc.isTrue && !sV.active) {
                        if (Ai.primaryReloaded && Ai.secondaryReloaded) {
                            if (!AW.reloaded) {
                                AW.reloaded = true;
                                let cI = s5.weapons[Ai.weapons[0]].spdMult < s5.weapons[Ai.weapons[1]].spdMult ? 1 : 0;
                                if (Ai.weaponIndex != Ai.weapons[cI] || Ai.buildIndex > -1) {
                                    ez(Ai.weapons[cI]);
                                }
                            }
                        } else {
                            AW.reloaded = false;
                            if (VM(Ai.weapons[0])) {
                                if (VY(Ai.weapons[0])) {
                                    ez(Ai.weapons[0]);
                                }
                            } else if (VM(Ai.weapons[1])) {
                                if (VY(Ai.weapons[1])) {
                                    ez(Ai.weapons[1]);
                                }
                            }
                        }
                    }
                    if (!e0[RK.heal] && !e0[RK.trap] && !e0[RK.spike] && !e0[RK.turretType] && !e0[RK.mill]) {
                        A0("D", sZ());
                    }
                    // Decide EMP / soldier / heal against a lethal tick before hats are picked.
                    if (fu.smartAntiInsta) {
                        roboticsLethalDecision();
                    }
                    if (Q.style.display != "block" && !sc.isTrue && !sc.ticking) {
                        Vo();
                        VG();
                    }
                    if (fu.autoPrePlace) {
                        eL();
                    }
                    if (VT.length && fU.tick % 10 == 0 && fu.autoAccept) {
                        A0("P", VT[0], 1);
                        s4.removeAllChildren(E);
                    }
                    sc.syncHit = false;
                    Ai.empAnti = false;
                    Ai.soldierAnti = false;
                    AW.anti0Tick--;
                    if (fu.weaponGrind) {
                        ss.testCanPlace(Ai.getItemType(22), 0, Math.PI * 2, Math.PI / 2, 0, true);
                    }
                    AW.forceStop = false;
                    AW.antiInsta = false;
                    sV.priority = [[], [], [], []];
                    ss.replaced = false;
                }
            }
        }
        let VO = document.getElementById("leaderboard");
        let VI = VO ? VO.firstChild : null;
        if (VI && VI.nodeType === 3 && VI.textContent === "Leaderboard") {
            VO.removeChild(VI);
        }
        function Va(ci) {
            s4.removeAllChildren(b);
            let cC = 1;
            let cK = ci[2];
            for (let cd = 0; cd < ci.length; cd += 3) {
                (function (ck) {
                    let cQ = ci[ck + 2];
                    let cg = cQ / cK * 100;
                    let cp = document.createElement("div");
                    cp.className = "leaderHolder";
                    cp.style = "\n                background-color: rgba(0, 0, 0, 0.45);\n                height: 20px;\n                border-radius: 5px;\n                margin-bottom: 5px;\n            ";
                    b.appendChild(cp);
                    let cW = ci[ck];
                    let ct = document.createElement("div");
                    ct.className = "leaderboardItem";
                    ct.style = "\n                color: " + (cW == Ai.sid ? "#fffb95" : V7.includes(cW) ? "#FF0000" : V6.includes(cW) ? "#00ff00" : "#fff") + ";\n            ";
                    ct.textContent = ci[ck + 1] + ": " + (s4.sFormat(cQ) || "0");
                    cp.appendChild(ct);
                    let cn = document.createElement("div");
                    cn.id = "leaderProsBar-" + ci[ck];
                    cn.className = "leaderProgressBar";
                    cn.style = "\n                margin-bottom: 5px;\n                display: block;\n                height: 20px;\n                border-radius: 5px;\n                background-color: #94e484;\n                width: " + cg + "% ;\n                transition: width 0.5s ease-in-out;\n            ";
                    cp.appendChild(cn);
                    if (cn.style.width) {
                        let cz = parseFloat(cn.style.width);
                        let cx = cg + "%";
                        cn.style.width = cx;
                    } else {
                        cn.style.width = cg + "%";
                    }
                })(cd);
                cC++;
            }
        }
        function Vu(ci) {
            for (let cC = 0; cC < ci.length;) {
                s6.add(ci[cC], ci[cC + 1], ci[cC + 2], ci[cC + 3], ci[cC + 4], ci[cC + 5], s5.list[ci[cC + 6]], true, ci[cC + 7] >= 0 ? {
                    sid: ci[cC + 7]
                } : null);
                cC += 8;
            }
        }
        function Vl(ci) {
            for (let cC = 0; cC < AA.length; ++cC) {
                AA[cC].forcePos = !AA[cC].visible;
                AA[cC].visible = false;
            }
            if (ci) {
                let cK = performance.now();
                for (let cd = 0; cd < ci.length;) {
                    AK = AY(ci[cd]);
                    if (AK) {
                        AK.index = ci[cd + 1];
                        AK.t1 = AK.t2 === undefined ? cK : AK.t2;
                        AK.t2 = cK;
                        AK.x1 = AK.x;
                        AK.y1 = AK.y;
                        AK.x2 = ci[cd + 2];
                        AK.y2 = ci[cd + 3];
                        AK.d1 = AK.d2 === undefined ? ci[cd + 4] : AK.d2;
                        AK.d2 = ci[cd + 4];
                        AK.health = ci[cd + 5];
                        AK.dt = 0;
                        AK.visible = true;
                    } else {
                        AK = sA.spawn(ci[cd + 2], ci[cd + 3], ci[cd + 4], ci[cd + 1]);
                        AK.x2 = AK.x;
                        AK.y2 = AK.y;
                        AK.d2 = AK.dir;
                        AK.health = ci[cd + 5];
                        if (!sA.aiTypes[ci[cd + 1]].name) {
                            AK.name = r.cowNames[ci[cd + 6]];
                        }
                        AK.forcePos = true;
                        AK.sid = ci[cd];
                        AK.visible = true;
                    }
                    cd += 7;
                }
            }
        }
        function VB(ci) {
            AK = AY(ci);
            if (AK) {
                AK.startAnim();
            }
        }
        function Vw(ci, cC, cK) {
            AK = AM(ci);
            if (AK) {
                AK.startAnim(cC, cK);
                AK.gatherIndex = cK;
                AK.gathering = 1;
                AK.lastGather = Date.now();
                AK.lastGatherTick = fU.tick + 1;
                if (cC) {
                    let cd = s6.hitObj;
                    s6.hitObj = [];
                    fU.tickBase(() => {
                        AK = AM(ci);
                        if (!AK || !s5.weapons[cK]) {
                            return;
                        }
                        let ck = s5.weapons[cK].dmg * (r.weaponVariants[AK[(cK < 9 ? "prima" : "seconda") + "ryVariant"]] || r.weaponVariants[0]).val * (s5.weapons[cK].sDmg || 1) * (AK.skinIndex == 40 ? 3.3 : 1);
                        cd.forEach(cQ => {
                            cQ.health -= ck;
                        });
                    }, 1);
                }
            }
        }
        function VL(ci, cC) {
            AK = Ao(cC);
            if (AK) {
                AK.xWiggle += r.gatherWiggle * Math.cos(ci);
                AK.yWiggle += r.gatherWiggle * Math.sin(ci);
                if (AK.health) {
                    s6.hitObj.push(AK);
                }
            }
        }
        function Vy(ci, cC) {
            AK = Ao(ci);
            if (AK) {
                if (r.anotherVisual) {
                    AK.lastDir = cC;
                } else {
                    AK.dir = cC;
                }
                AK.xWiggle += r.gatherWiggle * Math.cos(cC + Math.PI);
                AK.yWiggle += r.gatherWiggle * Math.sin(cC + Math.PI);
                AK.reloads = AK.shootRate;
            }
        }
        function Vh(ci, cC, cK) {
            if (Ai) {
                Ai[ci] = cC;
                if (ci == "points") {
                    if (fu.autoBuy) {
                        sF.buyNext();
                    }
                } else if (ci == "kills") {
                    if (fu.killChat) {
                        sp("abdo laffer better");
                    }
                }
            }
        }
        function VP(ci, cC) {
            if (ci) {
                if (cC) {
                    Ai.weapons = ci;
                    Ai.primaryIndex = Ai.weapons[0];
                    Ai.secondaryIndex = Ai.weapons[1];
                    if (!sc.isTrue) {
                        ez(Ai.weapons[0]);
                    }
                } else {
                    Ai.items = ci;
                }
            }
            for (let cd = 0; cd < s5.list.length; cd++) {
                let ck = s5.weapons.length + cd;
                getEl("actionBarItem" + ck).style.display = Ai.items.indexOf(s5.list[cd].id) >= 0 ? "inline-block" : "none";
            }
            for (let cQ = 0; cQ < s5.weapons.length; cQ++) {
                getEl("actionBarItem" + cQ).style.display = Ai.weapons[s5.weapons[cQ].type] == s5.weapons[cQ].id ? "inline-block" : "none";
            }
            let cK = Ai.weapons[0] == 3 && Ai.weapons[1] == 15;
            if (cK) {
                getEl("actionBarItem3").style.display = "none";
                getEl("actionBarItem4").style.display = "inline-block";
            }
        }
        // "X": a projectile was fired. Track it (it used to be ignored, so arrows and
        // bullets were never drawn or counted as incoming damage) and queue the
        // shooter lookup for the next tick (sW).
        function Vq(ci, cC, cK, cd, ck, cQ, cg, cp) {
            let cW = sf.addProjectile(ci, cC, cK, cd, ck, cQ, cg);
            cW.sid = cp;
            fm.push([ci, cC, cK, cd, ck, cQ, cg, cp, cW]);
        }
        function VU(ci, cC) {
            for (let cK = 0; cK < AH.length; ++cK) {
                if (AH[cK].sid == ci) {
                    AH[cK].range = cC;
                    AH[cK].r2 = cC;
                    let cd = s6.hitObj;
                    s6.hitObj = [];
                    fU.tickBase(() => {
                        let ck = AH[cK].dmg;
                        cd.forEach(cQ => {
                            if (cQ.projDmg) {
                                cQ.health -= ck;
                            }
                        });
                    }, 1);
                }
            }
        }
        function Vm(ci) {
            z.innerHTML = "Server restarting in " + ci + "s";
        }
        let VT = [];
        function VJ(ci, cC) {
            VT.push(ci);
        }
        function VX(ci, cC) {
            if (Ai) {
                Ai.team = ci;
                Ai.isOwner = cC;
                if (ci == null) {
                    AV = [];
                }
            }
        }
        function r0(ci) {
            AV = ci;
        }
        function r1(ci, cC, cK) {
            if (cK) {
                if (!ci) {
                    Ai.tails[cC] = 1;
                } else {
                    Ai.latestTail = cC;
                }
            } else if (!ci) {
                Ai.skins[cC] = 1;
            } else {
                Ai.latestSkin = cC;
            }
        }
        function r2(ci) {
            return ci == Ai || ci.team && ci.team == Ai.team;
        }
        function r3(ci, cC) {
            let cK = AM(ci);
            if (cK) {
                fO(cK.name + " {" + cK.sid + "}", cC, cK == Ai || cK.team && cK.team == Ai.team ? "#8ecc51" : "#fff");
                cK.chatMessage = cC;
                cK.chatCountdown = r.chatCountdown;
                if (cK.team == Ai.team && cC == getEl("testInput2").value) {
                    sc.musketSync();
                }
            }
        }
        function r4(ci) {
            sC = ci;
        }
        function r5(ci, cC, cK, cd) {
            se.showText(ci, cC, 50, 0.18, 500, Math.abs(cK), cK >= 0 ? "#fff" : "#8ecc51");
        }
        function r6(ci, cC) {
            se.showText(Ai.x, Ai.y, Ai.scale, 0.1, ci, cC, "#fff");
        }
        function r7(ci, cC, cK, cd, ck) {
            let cQ = ci + cK * Math.cos(cd);
            let cg = cC + cK * Math.sin(cd);
            let cp = cK * 0.4;
            ck.moveTo(ci, cC);
            ck.beginPath();
            ck.quadraticCurveTo((ci + cQ) / 2 + cp * Math.cos(cd + Math.PI / 2), (cC + cg) / 2 + cp * Math.sin(cd + Math.PI / 2), cQ, cg);
            ck.quadraticCurveTo((ci + cQ) / 2 - cp * Math.cos(cd + Math.PI / 2), (cC + cg) / 2 - cp * Math.sin(cd + Math.PI / 2), ci, cC);
            ck.closePath();
            ck.fill();
            ck.stroke();
        }
        function r8(ci, cC) {
            try {
                if (em.active) {
                    ci.lineWidth = 6;
                    ci.globalAlpha = 1;
                    ci.beginPath();
                    ci.strokeStyle = "#00ffff";
                    ci.moveTo(Ai.x - cC.x, Ai.y - cC.y);
                    for (let cK = 0; cK < em.paths.length; cK++) {
                        let cd = em.paths[cK];
                        if (cd) {
                            ci.lineTo(cd.x - cC.x, cd.y - cC.y);
                        }
                    }
                    ci.stroke();
                    if (AW.pushData) {
                        ci.lineWidth = 6;
                        ci.beginPath();
                        ci.strokeStyle = "#fff";
                        ci.moveTo(em.paths[em.paths.length - 1].x - cC.x, em.paths[em.paths.length - 1].y - cC.y);
                        ci.lineTo(AW.pushData.x - cC.x, AW.pushData.y - cC.y);
                        ci.stroke();
                    }
                } else if (AW.autoPush) {
                    ci.lineWidth = 6;
                    ci.globalAlpha = 1;
                    ci.beginPath();
                    ci.strokeStyle = "#fff";
                    ci.moveTo(Ai.x - cC.x, Ai.y - cC.y);
                    ci.lineTo(AW.pushData.x2 - cC.x, AW.pushData.y2 - cC.y);
                    ci.lineTo(AW.pushData.x - cC.x, AW.pushData.y - cC.y);
                    ci.stroke();
                } else if (em.finded) {
                    ci.globalAlpha = 1;
                    ci.lineWidth = 6;
                    ci.beginPath();
                    ci.strokeStyle = "#00ffff";
                    ci.moveTo(Ai.x - cC.x, Ai.y - cC.y);
                    for (let ck = 0; ck < em.paths.length; ck++) {
                        let cQ = em.paths[ck];
                        if (cQ) {
                            ci.lineTo(cQ.x - cC.x, cQ.y - cC.y);
                        }
                    }
                    ci.stroke();
                }
            } catch (cg) {
                console.error(cg);
            }
            ;
        }
        function r9(ci, cC, cK, cd, ck, cQ) {
            cd = cd || fV;
            cd.beginPath();
            cd.arc(ci, cC, cK, 0, Math.PI * 2);
            if (!cQ) {
                cd.fill();
            }
            if (!ck) {
                cd.stroke();
            }
        }
        function rA(ci, cC, cK, cd) {
            let ck = Math.PI / 2 * 3;
            let cQ;
            let cg;
            let cp = Math.PI / cC;
            ci.beginPath();
            ci.moveTo(0, -cK);
            for (let cW = 0; cW < cC; cW++) {
                cQ = Math.cos(ck) * cK;
                cg = Math.sin(ck) * cK;
                ci.lineTo(cQ, cg);
                ck += cp;
                cQ = Math.cos(ck) * cd;
                cg = Math.sin(ck) * cd;
                ci.lineTo(cQ, cg);
                ck += cp;
            }
            ci.lineTo(0, -cK);
            ci.closePath();
        }
        function rs(ci, cC, cK, cd, ck, cQ, cg) {
            if (!cg) {
                ck.fillRect(ci - cK / 2, cC - cd / 2, cK, cd);
            }
            if (!cQ) {
                ck.strokeRect(ci - cK / 2, cC - cd / 2, cK, cd);
            }
        }
        function rr(ci, cC, cK, cd, ck, cQ, cg, cp) {
            cQ.save();
            cQ.translate(ci, cC);
            ck = Math.ceil(ck / 2);
            for (let cW = 0; cW < ck; cW++) {
                rs(0, 0, cK * 2, cd, cQ, cg, cp);
                cQ.rotate(Math.PI / ck);
            }
            cQ.restore();
        }
        function rc(ci, cC, cK, cd) {
            let ck = Math.PI / 2 * 3;
            let cQ;
            let cg;
            let cp = Math.PI / cC;
            let cW;
            ci.beginPath();
            ci.moveTo(0, -cd);
            for (let ct = 0; ct < cC; ct++) {
                cW = s4.randInt(cK + 0.9, cK * 1.2);
                ci.quadraticCurveTo(Math.cos(ck + cp) * cW, Math.sin(ck + cp) * cW, Math.cos(ck + cp * 2) * cd, Math.sin(ck + cp * 2) * cd);
                ck += cp * 2;
            }
            ci.lineTo(0, -cd);
            ci.closePath();
        }
        function rF(ci, cC) {
            cC = cC || fV;
            let cK = ci * (Math.sqrt(3) / 2);
            cC.beginPath();
            cC.moveTo(0, -cK / 2);
            cC.lineTo(-ci / 2, cK / 2);
            cC.lineTo(ci / 2, cK / 2);
            cC.lineTo(0, -cK / 2);
            cC.fill();
            cC.closePath();
        }
        function rH(ci, cC, cK) {
            let cd = ci.lineWidth || 0;
            let ck = cK / 2;
            ci.beginPath();
            let cQ = Math.PI * 2 / cC;
            for (let cg = 0; cg < cC; cg++) {
                let cp = ck + (ck - cd / 2) * Math.cos(cQ * cg);
                let cW = ck + (ck - cd / 2) * Math.sin(cQ * cg);
                ci.lineTo(cp, cW);
            }
            ci.closePath();
        }
        function rN() {
            var ci = r.mapScale / 2;
            s6.add(0, ci, ci + 200, 0, r.treeScales[3], 0);
            s6.add(1, ci, ci - 480, 0, r.treeScales[3], 0);
            s6.add(2, ci + 300, ci + 450, 0, r.treeScales[3], 0);
            s6.add(3, ci - 950, ci - 130, 0, r.treeScales[2], 0);
            s6.add(4, ci - 750, ci - 400, 0, r.treeScales[3], 0);
            s6.add(5, ci - 700, ci + 400, 0, r.treeScales[2], 0);
            s6.add(6, ci + 800, ci - 200, 0, r.treeScales[3], 0);
            s6.add(7, ci - 260, ci + 340, 0, r.bushScales[3], 1);
            s6.add(8, ci + 760, ci + 310, 0, r.bushScales[3], 1);
            s6.add(9, ci - 800, ci + 100, 0, r.bushScales[3], 1);
            s6.add(10, ci - 800, ci + 300, 0, s5.list[4].scale, s5.list[4].id, s5.list[10]);
            s6.add(11, ci + 650, ci - 390, 0, s5.list[4].scale, s5.list[4].id, s5.list[10]);
            s6.add(12, ci - 400, ci - 450, 0, r.rockScales[2], 2);
        }
        const ri = 35;
        function rC(ci, cC) {
            fV.fillStyle = "#91b2db";
            // Drop faded death markers instead of keeping them forever.
            if (AN.length && !AN[0].active) {
                AN = AN.filter(cK => cK.active);
            }
            AN.forEach(cK => {
                cK.animate(AD);
                fV.globalAlpha = cK.alpha;
                fV.strokeStyle = Ah;
                fV.save();
                fV.translate(cK.x - ci, cK.y - cC);
                fV.rotate(cK.dir);
                fV.scale(cK.visScale / cK.scale, cK.visScale / cK.scale);
                rd(cK, fV);
                fV.restore();
                fV.font = "20px Ubuntu";
                let cd = fV.measureText("imagine using fixed mod L");
                let ck = 60;
                let cQ = cd.width + 10;
                fV.textBaseline = "middle";
                fV.textAlign = "center";
                fV.fillStyle = "#ccc";
                fV.strokeStyle = "#999";
                fV.roundRect(cK.x - ci - cQ / 2, cK.y - cC - ck / 2 + cK.scale * 1.5, cQ, ck, 6);
                fV.fill();
                fV.stroke();
                fV.fillStyle = "#fff";
                fV.strokeStyle = "#000";
                fV.strokeText("disney", cK.x - ci, cK.y + cK.scale * 1.5 - cC);
                fV.fillText("fixed", cK.x - ci, cK.y + cK.scale * 1.5 - cC);
                fV.strokeText(cK.name, cK.x - ci, cK.y + cK.scale * 1.5 + 20 - cC);
                fV.fillText(cK.name, cK.x - ci, cK.y + cK.scale * 1.5 + 20 - cC);
                fV.fillStyle = "#91b2db";
            });
        }
        function rK(ci, cC, cK) {
            fV.globalAlpha = 1;
            fV.fillStyle = "#91b2db";
            for (var cd = 0; cd < Ae.length; ++cd) {
                AK = Ae[cd];
                if (AK.zIndex == cK) {
                    AK.animate(AD);
                    if (AK.visible) {
                        AK.skinRot += AD * 0.002;
                        // "Always" draws the direction the server has; otherwise your own player follows your aim.
                        Al = !(fu.renderDir && fl.renderDir == "showDir") && !fL && AK == Ai ? fu.renderDir && fl.renderDir == "attackDir" ? sO() : sD() : AK.dir || 0;
                        fV.save();
                        fV.translate(AK.x - ci, AK.y - cC);
                        fV.rotate(Al + AK.dirPlus);
                        rk(AK, fV);
                        fV.restore();
                    }
                }
            }
        }
        function rd(ci, cC) {
            cC = cC || fV;
            cC.lineWidth = Aq;
            cC.lineJoin = "miter";
            let cK = Math.PI / 4 * (s5.weapons[ci.weaponIndex].armS || 1);
            let cd = ci.buildIndex < 0 ? s5.weapons[ci.weaponIndex].hndS || 1 : 1;
            let ck = ci.buildIndex < 0 ? s5.weapons[ci.weaponIndex].hndD || 1 : 1;
            if (ci.buildIndex < 0 && !s5.weapons[ci.weaponIndex].aboveHand) {
                rM(s5.weapons[ci.weaponIndex], r.weaponVariants[ci.weaponVariant].src, ci.scale, 0, cC);
                if (s5.weapons[ci.weaponIndex].projectile != undefined && !s5.weapons[ci.weaponIndex].hideProjectile) {
                    rG(ci.scale, 0, s5.projectiles[s5.weapons[ci.weaponIndex].projectile], fV);
                }
            }
            cC.fillStyle = r.skinColors[ci.skinColor];
            r9(ci.scale * Math.cos(cK), ci.scale * Math.sin(cK), 14);
            r9(ci.scale * ck * Math.cos(-cK * cd), ci.scale * ck * Math.sin(-cK * cd), 14);
            if (ci.buildIndex < 0 && s5.weapons[ci.weaponIndex].aboveHand) {
                rM(s5.weapons[ci.weaponIndex], r.weaponVariants[ci.weaponVariant].src, ci.scale, 0, cC);
                if (s5.weapons[ci.weaponIndex].projectile != undefined && !s5.weapons[ci.weaponIndex].hideProjectile) {
                    rG(ci.scale, 0, s5.projectiles[s5.weapons[ci.weaponIndex].projectile], fV);
                }
            }
            if (ci.buildIndex >= 0) {
                var cQ = rZ(s5.list[ci.buildIndex]);
                cC.drawImage(cQ, ci.scale - s5.list[ci.buildIndex].holdOffset, -cQ.width / 2);
            }
            r9(0, 0, ci.scale, cC);
            cC.lineWidth = 2;
            cC.fillStyle = "#555";
            cC.font = "35px Hammersmith One";
            cC.textBaseline = "middle";
            cC.textAlign = "center";
            cC.fillText("(", 20, 5);
            cC.rotate(Math.PI / 2);
            cC.font = "30px Hammersmith One";
            cC.fillText("X", -15, 15 / 2);
            cC.fillText("D", 15, 15 / 2);
        }
        function rk(ci, cC) {
            cC = cC || fV;
            cC.lineWidth = Aq;
            cC.lineJoin = "miter";
            let cK = Math.PI / 4 * (s5.weapons[ci.weaponIndex].armS || 1);
            let cd = ci.buildIndex < 0 ? s5.weapons[ci.weaponIndex].hndS || 1 : 1;
            let ck = ci.buildIndex < 0 ? s5.weapons[ci.weaponIndex].hndD || 1 : 1;
            let cQ = ci == Ai && ci.weapons[0] == 3 && ci.weapons[1] == 15;
            if (ci.tailIndex > 0) {
                rz(ci.tailIndex, cC, ci);
            }
            if (ci.buildIndex < 0 && !s5.weapons[ci.weaponIndex].aboveHand) {
                rM(s5.weapons[cQ ? 4 : ci.weaponIndex], r.weaponVariants[ci.weaponVariant].src, ci.scale, 0, cC);
                if (s5.weapons[ci.weaponIndex].projectile != undefined && !s5.weapons[ci.weaponIndex].hideProjectile) {
                    rG(ci.scale, 0, s5.projectiles[s5.weapons[ci.weaponIndex].projectile], fV);
                }
            }
            cC.fillStyle = r.skinColors[ci.skinColor];
            r9(ci.scale * Math.cos(cK), ci.scale * Math.sin(cK), 14);
            r9(ci.scale * ck * Math.cos(-cK * cd), ci.scale * ck * Math.sin(-cK * cd), 14);
            if (ci.buildIndex < 0 && s5.weapons[ci.weaponIndex].aboveHand) {
                rM(s5.weapons[ci.weaponIndex], r.weaponVariants[ci.weaponVariant].src, ci.scale, 0, cC);
                if (s5.weapons[ci.weaponIndex].projectile != undefined && !s5.weapons[ci.weaponIndex].hideProjectile) {
                    rG(ci.scale, 0, s5.projectiles[s5.weapons[ci.weaponIndex].projectile], fV);
                }
            }
            if (ci.buildIndex >= 0) {
                var cg = rZ(s5.list[ci.buildIndex]);
                cC.drawImage(cg, ci.scale - s5.list[ci.buildIndex].holdOffset, -cg.width / 2);
            }
            r9(0, 0, ci.scale, cC);
            if (ci.skinIndex > 0) {
                cC.rotate(Math.PI / 2);
                rW(ci.skinIndex, cC, null, ci);
            }
        }
        let rQ = {};
        let rp;
        function rW(ci, cC, cK, cd) {
            rp = rQ[ci];
            if (!rp) {
                let cQ = new Image();
                cQ.onload = function () {
                    this.isLoaded = true;
                    this.onload = null;
                };
                cQ.src = roboticsImg("hats/hat_" + ci + ".png");
                rQ[ci] = cQ;
                rp = cQ;
            }
            let ck = cK || roboticsHatById.get(ci);
            if (!ck) {
                return;
            }
            if (rp.isLoaded) {
                cC.drawImage(rp, -ck.scale / 2, -ck.scale / 2, ck.scale, ck.scale);
            }
            if (!cK && ck.topSprite) {
                cC.save();
                cC.rotate(cd.skinRot);
                rW(ci + "_top", cC, ck, cd);
                cC.restore();
            }
        }
        let rt = {};
        function rz(ci, cC, cK) {
            rp = rt[ci];
            if (!rp) {
                let ck = new Image();
                ck.onload = function () {
                    this.isLoaded = true;
                    this.onload = null;
                };
                ck.src = roboticsImg("accessories/access_" + ci + ".png");
                rt[ci] = ck;
                rp = ck;
            }
            let cd = roboticsTailById.get(ci);
            if (!cd) {
                return;
            }
            if (rp.isLoaded) {
                cC.save();
                cC.translate(-20 - (cd.xOff || 0), 0);
                if (cd.spin) {
                    cC.rotate(cK.skinRot);
                }
                cC.drawImage(rp, -(cd.scale / 2), -(cd.scale / 2), cd.scale, cd.scale);
                cC.restore();
            }
        }
        let rx = {};
        function rM(ci, cC, cK, cd, ck) {
            let cQ = ci.src + (cC || "");
            let cg = rx[cQ];
            if (!cg) {
                cg = new Image();
                cg.onload = function () {
                    this.isLoaded = true;
                };
                cg.src = roboticsImg("weapons/" + cQ + ".png");
                rx[cQ] = cg;
            }
            if (cg.isLoaded) {
                ck.drawImage(cg, cK + ci.xOff - ci.length / 2, cd + ci.yOff - ci.width / 2, ci.length, ci.width);
            }
        }
        function rY(ci, cC, cK) {
            for (let cd = 0; cd < AH.length; cd++) {
                AK = AH[cd];
                if (AK.active && AK.layer == ci) {
                    AK.update(AD);
                    if (AK.active && rl(AK.x - cC, AK.y - cK, AK.scale)) {
                        fV.save();
                        fV.translate(AK.x - cC, AK.y - cK);
                        fV.rotate(AK.dir);
                        rG(0, 0, AK, fV, 1);
                        fV.restore();
                    }
                }
            }
            ;
        }
        let ro = {};
        function rG(ci, cC, cK, cd, ck) {
            if (cK.src) {
                let cQ = s5.projectiles[cK.indx].src;
                let cg = ro[cQ];
                if (!cg) {
                    cg = new Image();
                    cg.onload = function () {
                        this.isLoaded = true;
                    };
                    cg.src = roboticsImg("weapons/" + cQ + ".png");
                    ro[cQ] = cg;
                }
                if (cg.isLoaded) {
                    cd.drawImage(cg, ci - cK.scale / 2, cC - cK.scale / 2, cK.scale, cK.scale);
                }
            } else if (cK.indx == 1) {
                cd.fillStyle = "#939393";
                r9(ci, cC, cK.scale, cd);
            }
        }
        let rS = {};
        function rv(ci, cC) {
            let cK = ci.index;
            let cd = rS[cK];
            if (!cd) {
                let ck = new Image();
                ck.onload = function () {
                    this.isLoaded = true;
                    this.onload = null;
                };
                ck.src = roboticsImg("animals/" + ci.src + ".png");
                cd = ck;
                rS[cK] = cd;
            }
            if (cd.isLoaded) {
                let cQ = ci.scale * 1.2 * (ci.spriteMlt || 1);
                cC.drawImage(cd, -cQ, -cQ, cQ * 2, cQ * 2);
            }
        }
        function rE(ci, cC, cK, cd) {
            let ck = r.riverWidth + cd;
            let cQ = r.mapScale / 2 - cC - ck / 2;
            if (cQ < Ab && cQ + ck > 0) {
                cK.fillRect(0, cQ, AE, ck);
            }
        }
        let rb = {};
        function rR(ci) {
            let cC = ci.y >= r.mapScale - r.snowBiomeTop ? 2 : ci.y <= r.snowBiomeTop ? 1 : 0;
            let cK = ci.type + "_" + ci.scale + "_" + cC;
            let cd = rb[cK];
            if (!cd) {
                let ck = 15;
                let cQ = document.createElement("canvas");
                cQ.width = cQ.height = ci.scale * 2.1 + Aq;
                let cg = cQ.getContext("2d");
                cg.translate(cQ.width / 2, cQ.height / 2);
                cg.rotate(s4.randFloat(0, Math.PI));
                cg.strokeStyle = Ah;
                cg.lineWidth = Aq;
                if (AU) {
                    cg.shadowBlur = ck;
                    cg.shadowColor = "rgba(0, 0, 0, " + ci.alpha + ")";
                }
                if (ci.type == 0) {
                    let cp;
                    let cW = s4.randInt(5, 7);
                    cg.globalAlpha = AU ? 0.6 : 0.8;
                    for (let ct = 0; ct < 2; ++ct) {
                        cp = AK.scale * (!ct ? 1 : 0.5);
                        rA(cg, cW, cp, cp * 0.7);
                        cg.fillStyle = !cC ? !ct ? "#9ebf57" : "#b4db62" : !ct ? "#e3f1f4" : "#fff";
                        cg.fill();
                        if (!ct) {
                            cg.stroke();
                            cg.shadowBlur = null;
                            cg.shadowColor = null;
                            cg.globalAlpha = 1;
                        }
                    }
                } else if (ci.type == 1) {
                    if (cC == 2) {
                        cg.fillStyle = "#606060";
                        rA(cg, 6, ci.scale * 0.3, ci.scale * 0.71);
                        cg.fill();
                        cg.stroke();
                        cg.fillStyle = "#89a54c";
                        r9(0, 0, ci.scale * 0.55, cg);
                        cg.fillStyle = "#a5c65b";
                        r9(0, 0, ci.scale * 0.3, cg, true);
                    } else {
                        rc(cg, 6, AK.scale, AK.scale * 0.7);
                        cg.fillStyle = cC ? "#e3f1f4" : "#89a54c";
                        cg.fill();
                        cg.stroke();
                        cg.fillStyle = cC ? "#6a64af" : "#c15555";
                        let cn;
                        let cz = 4;
                        let cx = Math.PI * 2 / cz;
                        for (let cM = 0; cM < cz; ++cM) {
                            cn = s4.randInt(AK.scale / 3.5, AK.scale / 2.3);
                            r9(cn * Math.cos(cx * cM), cn * Math.sin(cx * cM), s4.randInt(10, 12), cg);
                        }
                    }
                } else if (ci.type == 2 || ci.type == 3) {
                    cg.fillStyle = ci.type == 2 ? cC == 2 ? "#938d77" : "#939393" : "#e0c655";
                    rA(cg, 3, ci.scale, ci.scale);
                    cg.fill();
                    cg.stroke();
                    cg.shadowBlur = null;
                    cg.shadowColor = null;
                    cg.fillStyle = ci.type == 2 ? cC == 2 ? "#b2ab90" : "#bcbcbc" : "#ebdca3";
                    rA(cg, 3, ci.scale * 0.55, ci.scale * 0.65);
                    cg.fill();
                }
                cd = cQ;
                rb[cK] = cd;
            }
            return cd;
        }
        let rD = [];
        function rZ(ci, cC) {
            let cK = rD[ci.id];
            if (!cK || cC) {
                let cd = !cC && AU ? 15 : 0;
                let ck = document.createElement("canvas");
                let cQ = !cC && ci.name == "windmill" ? s5.list[4].scale : ci.scale;
                ck.width = ck.height = cQ * 2.5 + Aq + (s5.list[ci.id].spritePadding || 0) + cd;
                let cY = ck.getContext("2d");
                cY.translate(ck.width / 2, ck.height / 2);
                cY.rotate(cC ? 0 : Math.PI / 2);
                cY.strokeStyle = Ah;
                cY.lineWidth = Aq * (cC ? ck.width / 81 : 1);
                if (AU && !cC) {
                    cY.shadowBlur = cd;
                    cY.shadowColor = "rgba(0, 0, 0, " + Math.min(ci.name == "pit trap" ? 0.6 : 0.3, ci.alpha) + ")";
                }
                if (ci.name == "apple") {
                    cY.fillStyle = "#c15555";
                    r9(0, 0, ci.scale, cY);
                    cY.fillStyle = "#89a54c";
                    let co = -(Math.PI / 2);
                    r7(ci.scale * Math.cos(co), ci.scale * Math.sin(co), 25, co + Math.PI / 2, cY);
                } else if (ci.name == "cookie") {
                    cY.fillStyle = "#cca861";
                    r9(0, 0, ci.scale, cY);
                    cY.fillStyle = "#937c4b";
                    let cG = 4;
                    let cS = Math.PI * 2 / cG;
                    let cv;
                    for (let cE = 0; cE < cG; ++cE) {
                        cv = s4.randInt(ci.scale / 2.5, ci.scale / 1.7);
                        r9(cv * Math.cos(cS * cE), cv * Math.sin(cS * cE), s4.randInt(4, 5), cY, true);
                    }
                } else if (ci.name == "cheese") {
                    cY.fillStyle = "#f4f3ac";
                    r9(0, 0, ci.scale, cY);
                    cY.fillStyle = "#c3c28b";
                    let cb = 4;
                    let cR = Math.PI * 2 / cb;
                    let cD;
                    for (let cZ = 0; cZ < cb; ++cZ) {
                        cD = s4.randInt(ci.scale / 2.5, ci.scale / 1.7);
                        r9(cD * Math.cos(cR * cZ), cD * Math.sin(cR * cZ), s4.randInt(4, 5), cY, true);
                    }
                } else if (ci.name == "wood wall" || ci.name == "stone wall" || ci.name == "castle wall") {
                    cY.fillStyle = ci.name == "castle wall" ? "#83898e" : ci.name == "wood wall" ? "#a5974c" : "#939393";
                    let cO = ci.name == "castle wall" ? 4 : 3;
                    rA(cY, cO, ci.scale * 1.1, ci.scale * 1.1);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = ci.name == "castle wall" ? "#9da4aa" : ci.name == "wood wall" ? "#c9b758" : "#bcbcbc";
                    rA(cY, cO, ci.scale * 0.65, ci.scale * 0.65);
                    cY.fill();
                } else if (ci.name == "spikes" || ci.name == "greater spikes" || ci.name == "poison spikes" || ci.name == "spinning spikes") {
                    cY.fillStyle = ci.name == "poison spikes" ? "#7b935d" : "#939393";
                    let cI = ci.scale * 0.6;
                    rA(cY, ci.name == "spikes" ? 5 : 6, ci.scale, cI);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = "#a5974c";
                    r9(0, 0, cI, cY);
                    cY.fillStyle = "#c9b758";
                    r9(0, 0, cI / 2, cY, true);
                } else if (ci.name == "windmill" || ci.name == "faster windmill" || ci.name == "power mill") {
                    cY.fillStyle = "#a5974c";
                    r9(0, 0, cQ, cY);
                    cY.fillStyle = "#c9b758";
                    rr(0, 0, cQ * 1.5, 29, 4, cY);
                    cY.fillStyle = "#a5974c";
                    r9(0, 0, cQ * 0.5, cY);
                } else if (ci.name == "mine") {
                    cY.fillStyle = "#939393";
                    rA(cY, 3, ci.scale, ci.scale);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = "#bcbcbc";
                    rA(cY, 3, ci.scale * 0.55, ci.scale * 0.65);
                    cY.fill();
                } else if (ci.name == "sapling") {
                    for (let ca = 0; ca < 2; ++ca) {
                        let cu = ci.scale * (!ca ? 1 : 0.5);
                        rA(cY, 7, cu, cu * 0.7);
                        cY.fillStyle = !ca ? "#9ebf57" : "#b4db62";
                        cY.fill();
                        if (!ca) {
                            cY.stroke();
                        }
                    }
                } else if (ci.name == "pit trap") {
                    cY.fillStyle = "#a5974c";
                    rA(cY, 3, ci.scale * 1.1, ci.scale * 1.1);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = Ah;
                    rA(cY, 3, ci.scale * 0.65, ci.scale * 0.65);
                    cY.fill();
                } else if (ci.name == "boost pad") {
                    cY.fillStyle = "#7e7f82";
                    rs(0, 0, ci.scale * 2, ci.scale * 2, cY);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = "#dbd97d";
                    rF(ci.scale * 1, cY);
                } else if (ci.name == "turret") {
                    cY.fillStyle = "#a5974c";
                    r9(0, 0, ci.scale, cY);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = "#939393";
                    let cl = 50;
                    rs(0, -cl / 2, ci.scale * 0.9, cl, cY);
                    r9(0, 0, ci.scale * 0.6, cY);
                    cY.fill();
                    cY.stroke();
                } else if (ci.name == "platform") {
                    cY.fillStyle = "#cebd5f";
                    let cB = 4;
                    let cw = ci.scale * 2;
                    let cL = cw / cB;
                    let cy = -(ci.scale / 2);
                    for (let ch = 0; ch < cB; ++ch) {
                        rs(cy - cL / 2, 0, cL, ci.scale * 2, cY);
                        cY.fill();
                        cY.stroke();
                        cy += cw / cB;
                    }
                } else if (ci.name == "healing pad") {
                    cY.fillStyle = "#7e7f82";
                    rs(0, 0, ci.scale * 2, ci.scale * 2, cY);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = "#db6e6e";
                    rr(0, 0, ci.scale * 0.65, 20, 4, cY, true);
                } else if (ci.name == "spawn pad") {
                    cY.fillStyle = "#7e7f82";
                    rs(0, 0, ci.scale * 2, ci.scale * 2, cY);
                    cY.fill();
                    cY.stroke();
                    cY.fillStyle = "#71aad6";
                    r9(0, 0, ci.scale * 0.6, cY);
                } else if (ci.name == "blocker") {
                    cY.fillStyle = "#7e7f82";
                    r9(0, 0, ci.scale, cY);
                    cY.fill();
                    cY.stroke();
                    cY.rotate(Math.PI / 4);
                    cY.fillStyle = "#db6e6e";
                    rr(0, 0, ci.scale * 0.65, 20, 4, cY, true);
                } else if (ci.name == "teleporter") {
                    cY.fillStyle = "#7e7f82";
                    r9(0, 0, ci.scale, cY);
                    cY.fill();
                    cY.stroke();
                    cY.rotate(Math.PI / 4);
                    cY.fillStyle = "#d76edb";
                    r9(0, 0, ci.scale * 0.5, cY, true);
                }
                cK = ck;
                if (!cC) {
                    rD[ci.id] = cK;
                }
            }
            return cK;
        }
        let rI = [];
        function ra(ci) {
            let cC = rI[ci.id];
            if (!cC) {
                let cK = AU ? 15 : 0;
                let cd = document.createElement("canvas");
                cd.width = cd.height = ci.scale * 2.5 + Aq + (s5.list[ci.id].spritePadding || 0) + cK;
                let ck = cd.getContext("2d");
                ck.translate(cd.width / 2, cd.height / 2);
                ck.rotate(Math.PI / 2);
                ck.strokeStyle = Ah;
                ck.lineWidth = Aq;
                if (AU) {
                    ck.shadowBlur = cK;
                    ck.shadowColor = "rgba(0, 0, 0, " + Math.min(0.3, ci.alpha) + ")";
                }
                if (ci.name == "spikes" || ci.name == "greater spikes" || ci.name == "poison spikes" || ci.name == "spinning spikes") {
                    ck.fillStyle = ci.name == "poison spikes" ? "#7b935d" : "#939393";
                    let cQ = ci.scale * 0.6;
                    rA(ck, ci.name == "spikes" ? 5 : 6, ci.scale, cQ);
                    ck.fill();
                    ck.stroke();
                    ck.fillStyle = "#a5974c";
                    r9(0, 0, cQ, ck);
                    ck.fillStyle = "#cc5151";
                    r9(0, 0, cQ / 2, ck, true);
                } else if (ci.name == "pit trap") {
                    ck.fillStyle = "#a5974c";
                    rA(ck, 3, ci.scale * 1.1, ci.scale * 1.1);
                    ck.fill();
                    ck.stroke();
                    ck.fillStyle = "#cc5151";
                    rA(ck, 3, ci.scale * 0.65, ci.scale * 0.65);
                    ck.fill();
                }
                cC = cd;
                rI[ci.id] = cC;
            }
            return cC;
        }
        function ru(ci, cC, cK, cd, ck) {
            cC.lineWidth = Aq;
            cC.globalAlpha = 1;
            cC.strokeStyle = Ah;
            cC.save();
            cC.translate(cK, cd);
            cC.rotate(ci.dir);
            if (ck) {
                cC.globalAlpha = 0.6;
                cC.fillStyle = "rgba(0, 255, 255, 0.6)";
                r9(0, 0, AK.scale, cC);
                cC.fill();
                cC.stroke();
            } else if (ci.name == "wood wall" || ci.name == "stone wall" || ci.name == "castle wall") {
                let cQ = ci.name == "castle wall" ? 4 : 3;
                rA(cC, cQ, ci.scale * 1.1, ci.scale * 1.1);
                cC.stroke();
            } else if (ci.name == "spikes" || ci.name == "greater spikes" || ci.name == "poison spikes" || ci.name == "spinning spikes") {
                let cg = ci.scale * 0.6;
                rA(cC, ci.name == "spikes" ? 5 : 6, ci.scale, cg);
                cC.stroke();
            } else if (ci.name == "windmill" || ci.name == "faster windmill" || ci.name == "power mill") {
                r9(0, 0, ci.scale, cC, false, true);
            } else if (ci.name == "mine") {
                rA(cC, 3, ci.scale, ci.scale);
                cC.stroke();
            } else if (ci.name == "sapling") {
                let cp = ci.scale * 0.7;
                rA(cC, 7, ci.scale, cp);
                cC.stroke();
            } else if (ci.name == "pit trap") {
                rA(cC, 3, ci.scale * 1.1, ci.scale * 1.1);
                cC.stroke();
            } else if (ci.name == "boost pad") {
                rs(0, 0, ci.scale * 2, ci.scale * 2, cC, false, true);
            } else if (ci.name == "turret") {
                r9(0, 0, ci.scale, cC, false, true);
            } else if (ci.name == "platform") {
                rs(0, 0, ci.scale * 2, ci.scale * 2, cC, false, true);
            } else if (ci.name == "healing pad") {
                rs(0, 0, ci.scale * 2, ci.scale * 2, cC, false, true);
            } else if (ci.name == "spawn pad") {
                rs(0, 0, ci.scale * 2, ci.scale * 2, cC, false, true);
            } else if (ci.name == "blocker") {
                r9(0, 0, ci.scale, cC, false, true);
            } else if (ci.name == "teleporter") {
                r9(0, 0, ci.scale, cC, false, true);
            }
            cC.restore();
        }
        function rl(ci, cC, cK) {
            return ci + cK >= 0 && ci - cK <= AE && cC + cK >= 0 && cC - cK <= Ab;
        }
        function rB() {
            let ci = r.volcanoScale * 2;
            let cC = document.createElement("canvas");
            cC.width = ci;
            cC.height = ci;
            let cK = cC.getContext("2d");
            cK.strokeStyle = "#3e3e3e";
            cK.lineWidth = 11;
            cK.fillStyle = "#7f7f7f";
            rH(cK, 10, ci);
            cK.fill();
            cK.stroke();
            A6.land = cC;
            let cd = document.createElement("canvas");
            let ck = r.innerVolcanoScale * 2;
            cd.width = ck;
            cd.height = ck;
            let cQ = cd.getContext("2d");
            cQ.strokeStyle = "#525252";
            cQ.lineWidth = 8.8;
            cQ.fillStyle = "#f54e16";
            cQ.strokeStyle = "#f56f16";
            rH(cQ, 10, ck);
            cQ.fill();
            cQ.stroke();
            A6.lava = cd;
        }
        rB();
        function rw() {
            let ci = A4;
            let cC = A5;
            A6.animationTime += AD;
            A6.animationTime %= r.volcanoAnimationDuration;
            let cK = r.volcanoAnimationDuration / 2;
            let cd = 1.7 + Math.abs(cK - A6.animationTime) / cK * 0.3;
            let ck = r.innerVolcanoScale * cd;
            fV.drawImage(A6.land, A6.x - r.volcanoScale - ci, A6.y - r.volcanoScale - cC, r.volcanoScale * 2, r.volcanoScale * 2);
            fV.drawImage(A6.lava, A6.x - ck - ci, A6.y - ck - cC, ck * 2, ck * 2);
        }
        let rL = 0.1;
        let ry = 1;
        const rh = 0.009;
        /* Per-frame render data: objects near the camera (from the grid) and the
           objects your current aim would hit, both computed once per frame
           instead of once per layer and once per drawn building. */
        let roboticsFrame = {
            visible: [],
            hit: new Set()
        };
        function roboticsPrepareFrame(ci, cC) {
            roboticsGrid.near(ci + AE / 2, cC + Ab / 2, Math.max(AE, Ab) / 2 + 400, roboticsFrame.visible);
            roboticsFrame.hit.clear();
            if (Ai) {
                let cK = sV.objectsHit(sZ());
                for (let cd = 0; cd < cK.length; cd++) {
                    roboticsFrame.hit.add(cK[cd]);
                }
            }
        }
        function rP(ci, cC, cK) {
            let cd;
            let ck;
            let cQ;
            roboticsFrame.visible.forEach(cg => {
                AK = cg;
                if (AK.alive) {
                    ck = AK.x + AK.xWiggle - cC;
                    cQ = AK.y + AK.yWiggle - cK;
                    if (ci == 0) {
                        AK.update(AD);
                    }
                    fV.globalAlpha = AK.alpha;
                    if (AK.layer == ci && rl(ck, cQ, AK.scale + (AK.blocker || 0))) {
                        if (AK.isItem) {
                            if ((AK.dmg || AK.trap) && !AK.isTeamObject(Ai)) {
                                cd = ra(AK);
                            } else {
                                cd = rZ(AK);
                            }
                            fV.save();
                            fV.translate(ck, cQ);
                            fV.rotate(AK.dir);
                            if (!AK.active) {
                                fV.scale(AK.visScale / AK.scale, AK.visScale / AK.scale);
                            }
                            if (!AK.hideFromEnemy) {
                                fV.globalAlpha = 1;
                            }
                            if (AK.reloads <= 0) {
                                fV.globalAlpha = 0.2;
                            }
                            if (roboticsFrame.hit.has(AK)) {
                                rL += rh * ry;
                                if (rL >= 1) {
                                    rL = 1;
                                    ry = -1;
                                } else if (rL <= 0.1) {
                                    rL = 0.1;
                                    ry = 1;
                                }
                                fV.globalAlpha = rL;
                            } else {
                                fV.globalAlpha = 1;
                            }
                            fV.drawImage(cd, -(cd.width / 2), -(cd.height / 2));
                            if (AK.blocker) {
                                fV.strokeStyle = "#db6e6e";
                                fV.globalAlpha = 0.3;
                                fV.lineWidth = 6;
                                r9(0, 0, AK.blocker, fV, false, true);
                            }
                            fV.restore();
                        } else if (AK.type == 4) {
                            rw();
                        } else {
                            cd = rR(AK);
                            fV.drawImage(cd, ck - cd.width / 2, cQ - cd.height / 2);
                        }
                    }
                    if (ci == 3 && !fL) {
                        if (AK.health < AK.maxHealth) {
                            fV.fillStyle = AP;
                            fV.roundRect(ck - r.healthBarWidth / 2 - r.healthBarPad, cQ - r.healthBarPad, r.healthBarWidth + r.healthBarPad * 2, 17, 8);
                            fV.fill();
                            fV.fillStyle = AK.isTeamObject(Ai) ? "#8ecc51" : "#cc5151";
                            fV.roundRect(ck - r.healthBarWidth / 2, cQ, r.healthBarWidth * (AK.health / AK.maxHealth), 17 - r.healthBarPad * 2, 7);
                            fV.fill();
                        }
                    }
                }
            });
            if (ci == 0) {
                if (e5.length) {
                    e5.forEach(cg => {
                        ck = cg.x - cC;
                        cQ = cg.y - cK;
                        rq(cg, ck, cQ);
                    });
                }
                if (e6.length) {
                    e6.forEach(cg => {
                        ck = cg.x - cC;
                        cQ = cg.y - cK;
                        rU(cg, ck, cQ);
                    });
                }
            }
        }
        function rq(ci, cC, cK) {
            ru(ci, fV, cC, cK);
        }
        function rU(ci, cC, cK) {
            if (ci.name == "pit trap") {
                rm(fV, cC, cK);
            } else {
                rT(fV, cC, cK);
            }
        }
        function rm(ci, cC, cK) {
            ci.fillStyle = "rgba(0, 255, 255, 0.4)";
            ci.beginPath();
            ci.arc(cC, cK, 55, 0, Math.PI * 2);
            ci.fill();
            ci.closePath();
        }
        function rT(ci, cC, cK) {
            ci.fillStyle = "rgba(255, 0, 0, 0.4)";
            ci.beginPath();
            ci.arc(cC, cK, 55, 0, Math.PI * 2);
            ci.fill();
            ci.closePath();
        }
        class rj {
            constructor(ci, cC) {
                this.init = function (cK, cd) {
                    this.scale = 0;
                    this.x = cK;
                    this.y = cd;
                    this.active = true;
                };
                this.update = function (cK, cd) {
                    if (this.active) {
                        this.scale += cd * 0.05;
                        if (this.scale >= cC) {
                            this.active = false;
                        } else {
                            cK.globalAlpha = 1 - Math.max(0, this.scale / cC);
                            cK.beginPath();
                            cK.arc(this.x / r.mapScale * t.width, this.y / r.mapScale * t.width, this.scale, 0, Math.PI * 2);
                            cK.stroke();
                        }
                    }
                };
                this.color = ci;
            }
        }
        function rJ(ci, cC) {
            sk = sd.find(cK => !cK.active);
            if (!sk) {
                sk = new rj("#fff", r.mapPingScale);
                sd.push(sk);
            }
            sk.init(ci, cC);
        }
        function rX() {
            sK.x = Ai.x;
            sK.y = Ai.y;
        }
        function c0(ci) {
            if (Ai && Ai.alive) {
                n.clearRect(0, 0, t.width, t.height);
                n.lineWidth = 4;
                for (let cC = 0; cC < sd.length; ++cC) {
                    sk = sd[cC];
                    n.strokeStyle = sk.color;
                    sk.update(n, ci);
                }
                n.globalAlpha = 1;
                n.fillStyle = "#ff0000";
                if (sQ.length) {
                    n.fillStyle = "#abcdef";
                    n.font = "34px Hammersmith One";
                    n.textBaseline = "middle";
                    n.textAlign = "center";
                    for (let cK = 0; cK < sQ.length;) {
                        n.fillText("!", sQ[cK].x / r.mapScale * t.width, sQ[cK].y / r.mapScale * t.height);
                        cK += 2;
                    }
                }
                n.globalAlpha = 1;
                n.fillStyle = "#fff";
                r9(Ai.x / r.mapScale * t.width, Ai.y / r.mapScale * t.height, 7, n, true);
                n.fillStyle = "rgba(255,255,255,0.35)";
                if (Ai.team && sC) {
                    for (let cd = 0; cd < sC.length;) {
                        r9(sC[cd] / r.mapScale * t.width, sC[cd + 1] / r.mapScale * t.height, 7, n, true);
                        cd += 2;
                    }
                }
                if (si) {
                    n.fillStyle = "#fc5553";
                    n.font = "34px Hammersmith One";
                    n.textBaseline = "middle";
                    n.textAlign = "center";
                    n.fillText("x", si.x / r.mapScale * t.width, si.y / r.mapScale * t.height);
                }
                if (sK) {
                    n.fillStyle = "#fff";
                    n.font = "34px Hammersmith One";
                    n.textBaseline = "middle";
                    n.textAlign = "center";
                    n.fillText("x", sK.x / r.mapScale * t.width, sK.y / r.mapScale * t.height);
                }
            }
        }
        let c1 = "https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg";
        let c2;
        let c3 = {};
        let c4 = ["crown", "skull"];
        function c5() {
            for (let cC = 0; cC < c4.length; ++cC) {
                let cK = new Image();
                cK.onload = function () {
                    this.isLoaded = true;
                };
                cK.src = roboticsImg("icons/" + c4[cC] + ".png");
                c3[c4[cC]] = cK;
            }
            let ci = new Image();
            ci.onload = function () {
                this.isLoaded = true;
            };
            ci.src = c1;
            c2 = ci;
        }
        c5();
        function c6(ci) {
            var cC = Math.abs(ci.x - Ai.x) - ci.scale;
            var cK = Math.abs(ci.y - Ai.y) - ci.scale;
            var cd = AE / 2 * 1.3;
            var ck = Ab / 2 * 1.3;
            return cC <= cd && cK <= ck;
        }
        function c7(ci, cC, cK, cd, ck) {
            this.startX = ci;
            this.startY = cC;
            this.endX = cK;
            this.distance = cd;
            this.float = ck;
            this.amountPaths = Math.ceil(this.endX / this.distance);
            this.path = new Map();
            this.generate = function () {
                for (let cQ = 1; cQ <= this.amountPaths; cQ += 1) {
                    const cg = cQ % 2 === 0 ? this.distance : 0;
                    const cp = this.startX + this.distance * (cQ - 1);
                    const cW = Math.floor(Math.random() * 35) + 10;
                    const ct = this.startY + ((this.float === "down" ? cg : -cg) + (cQ % 2 === 0 ? Math.random() < 0.55 ? cW : -cW : 0));
                    this.path.set(cQ, [cp, ct, cg, cW]);
                }
            };
            this.render = function (cQ, cg, cp) {
                const cW = Array.from(this.path.values());
                if (!Ai?.active || !Ai?.alive) {
                    return;
                }
                for (let ct = 1; ct < cW.length; ct++) {
                    const cn = cW[ct - 1];
                    const cz = cW[ct];
                    if (!c6({
                        x: cn[0],
                        y: cn[1],
                        scale: 10
                    })) {
                        continue;
                    }
                    if (!c6({
                        x: cz[0],
                        y: cz[1],
                        scale: 10
                    })) {
                        continue;
                    }
                    const cx = this.distance / 2;
                    const cM = [cn[0] - cx / 2, cn[1] + (cn[2] === 0 ? cx : -cx)];
                    const cY = [cz[0] + cx * 1.15, cz[1] + cx * 1.2];
                    const co = [cz[0] + cx * 1.35, cz[1] - cx * 1.15];
                    const cG = [cz[0] - cx * 1.35, cz[1] + cx * 1.15];
                    fV.save();
                    fV.fillStyle = cQ;
                    fV.lineCap = "round";
                    fV.lineJoin = "round";
                    fV.beginPath();
                    fV.moveTo(cn[0] - cg, cn[1] - cp);
                    fV.lineTo(cn[0] + this.distance * 2 - cg, this.startY - cp);
                    fV.lineTo(cz[0] - cg, cz[1] - cp);
                    fV.fill();
                    fV.beginPath();
                    fV.moveTo(cn[0] - cg, cn[1] - cp);
                    fV.bezierCurveTo(cM[0] - cg, cM[1] - cp, cY[0] - cg, cY[1] - cp, cz[0] + (cz[3] >= 10 ? 3.5 : 1) - cg, cz[1] - cp);
                    fV.fill();
                    fV.beginPath();
                    fV.moveTo(cz[0] - cg, cz[1] - cp);
                    fV.bezierCurveTo(cY[0] - cg, cY[1] - cp, co[0] - cg, co[1] - cp, cz[0] + this.distance * 2 - cg, this.startY - cp);
                    fV.fill();
                    fV.restore();
                }
            };
            return this.generate();
        }
        const c8 = new c7(-AE, r.snowBiomeTop - 1, r.mapScale + AE * 2, 50, "down");
        const c9 = new c7(-AE, r.mapScale - r.snowBiomeTop + 1, r.mapScale + AE * 2, 50, "up");
        function cF() {
            sj();
            let cK = {
                width: 1920,
                height: 1080
            };
            if (fu.CAmera) {
                if (Ai) {
                    let cp;
                    let cW;
                    let ct = 0.1;
                    let cn = 0;
                    let cz = Ai.x;
                    let cx = Ai.y;
                    if (Ad.length) {
                        if (AQ.dist2 <= 650) {
                            cn = (650 - AQ.dist2) / 650;
                            cz = Ai.x2 + (AQ.x2 - Ai.x2) * cn;
                            cx = Ai.y2 + (AQ.y2 - Ai.y2) * cn;
                        }
                    }
                    cp = cK.width;
                    cW = cK.height;
                    if (cn === 0) {
                        cp *= 1.2;
                        cW *= 1.4;
                    }
                    Aa = (Aa * 24 + cz) / 25;
                    Au = (Au * 24 + cx) / 25;
                    Aa = Math.max(540, Math.min(13840, Aa));
                    Au = Math.max(200, Math.min(14240, Au));
                    AE += (cp - AE) * ct;
                    Ab += (cW - Ab) * ct;
                    sM();
                } else {
                    AE = r.maxScreenWidth;
                    Ab = r.maxScreenHeight;
                    Aa = Math.max(540, Math.min(13840, r.mapScale / 2));
                    Au = Math.max(200, Math.min(14240, r.mapScale / 2));
                    sM();
                }
            } else if (Ai) {
                let cM = s4.getDistance(Aa, Au, Ai.x, Ai.y);
                let cY = s4.getDirection(Ai.x, Ai.y, Aa, Au);
                let co = Math.min(cM * 0.01 * AD, cM);
                if (cM > 0.05) {
                    Aa += co * Math.cos(cY);
                    Au += co * Math.sin(cY);
                } else {
                    Aa = Ai.x;
                    Au = Ai.y;
                }
            } else {
                Aa = r.mapScale / 2 + r.riverWidth;
                Au = r.mapScale / 2;
            }
            let cd = AZ - 1000 / r.serverUpdateRate;
            let ck;
            for (let cG = 0; cG < Ae.length + AA.length; ++cG) {
                AK = Ae[cG] || AA[cG - Ae.length];
                if (AK && AK.visible) {
                    if (AK.forcePos) {
                        AK.x = AK.x2;
                        AK.y = AK.y2;
                        AK.dir = AK.d2;
                    } else {
                        let cS = AK.t2 - AK.t1;
                        let cv = cd - AK.t1;
                        let cE = cv / cS;
                        let cb = 170;
                        AK.dt += AD;
                        let cR = Math.min(1.7, AK.dt / cb);
                        ck = AK.x2 - AK.x1;
                        AK.x = AK.x1 + ck * cR;
                        ck = AK.y2 - AK.y1;
                        AK.y = AK.y1 + ck * cR;
                        AK.dir = Math.lerpAngle(AK.d2, AK.d1, Math.min(1.2, cE));
                    }
                }
            }
            let cQ = Aa - AE / 2;
            let cg = Au - Ab / 2;
            A4 = cQ;
            A5 = cg;
            if (r.snowBiomeTop - cg <= 0 && r.mapScale - r.snowBiomeTop - cg >= Ab) {
                fV.fillStyle = "#b6db66";
                fV.fillRect(0, 0, AE, Ab);
            } else if (r.mapScale - r.snowBiomeTop - cg <= 0) {
                fV.fillStyle = "#dbc666";
                fV.fillRect(0, 0, AE, Ab);
            } else if (r.snowBiomeTop - cg >= Ab) {
                fV.fillStyle = "#fff";
                fV.fillRect(0, 0, AE, Ab);
            } else if (r.snowBiomeTop - cg >= 0) {
                fV.fillStyle = "#fff";
                fV.fillRect(0, 0, AE, r.snowBiomeTop - cg);
                fV.fillStyle = "#b6db66";
                fV.fillRect(0, r.snowBiomeTop - cg, AE, Ab - (r.snowBiomeTop - cg));
                c8.render("#fff", cQ, cg);
            } else {
                fV.fillStyle = "#b6db66";
                fV.fillRect(0, 0, AE, r.mapScale - r.snowBiomeTop - cg);
                fV.fillStyle = "#dbc666";
                fV.fillRect(0, r.mapScale - r.snowBiomeTop - cg, AE, Ab - (r.mapScale - r.snowBiomeTop - cg));
                c9.render("#b6db66", cQ, cg);
            }
            if (!Am) {
                AL += Ay * r.waveSpeed * AD;
                if (AL >= r.waveMax) {
                    AL = r.waveMax;
                    Ay = -1;
                } else if (AL <= 1) {
                    AL = Ay = 1;
                }
                fV.globalAlpha = 1;
                fV.fillStyle = "#dbc666";
                rE(cQ, cg, fV, r.riverPadding);
                fV.fillStyle = "#91b2db";
                rE(cQ, cg, fV, (AL - 1) * 250);
            }
            if (Ai) {
                if (si) {
                    fV.globalAlpha = 1;
                    fV.fillStyle = "#fc5553";
                    fV.font = "100px Hammersmith One";
                    fV.textBaseline = "middle";
                    fV.textAlign = "center";
                    fV.fillText("x", si.x - cQ, si.y - cg);
                }
            }
            fV.globalAlpha = 1;
            fV.strokeStyle = Ah;
            rC(cQ, cg);
            fV.globalAlpha = 1;
            fV.strokeStyle = Ah;
            roboticsPrepareFrame(cQ, cg);
            rP(-1, cQ, cg);
            fV.globalAlpha = 1;
            fV.lineWidth = Aq;
            rY(0, cQ, cg);
            rK(cQ, cg, 0);
            fV.globalAlpha = 1;
            for (let cD = 0; cD < AA.length; ++cD) {
                AK = AA[cD];
                if (AK.active && AK.visible) {
                    AK.animate(AD);
                    fV.save();
                    fV.translate(AK.x - cQ, AK.y - cg);
                    fV.rotate(AK.dir + AK.dirPlus - Math.PI / 2);
                    rv(AK, fV);
                    fV.restore();
                }
            }
            rP(0, cQ, cg);
            rY(1, cQ, cg);
            rP(1, cQ, cg);
            rK(cQ, cg, 1);
            rP(2, cQ, cg);
            rP(3, cQ, cg);
            ss.renderPlacementAngles(fV);
            fV.fillStyle = "#000";
            fV.globalAlpha = 0.09;
            if (cQ <= 0) {
                fV.fillRect(0, 0, -cQ, Ab);
            }
            if (r.mapScale - cQ <= AE) {
                let cZ = Math.max(0, -cg);
                fV.fillRect(r.mapScale - cQ, cZ, AE - (r.mapScale - cQ), Ab - cZ);
            }
            if (cg <= 0) {
                fV.fillRect(-cQ, 0, AE + cQ, -cg);
            }
            if (r.mapScale - cg <= Ab) {
                let cO = Math.max(0, -cQ);
                let cI = 0;
                if (r.mapScale - cQ <= AE) {
                    cI = AE - (r.mapScale - cQ);
                }
                fV.fillRect(cO, r.mapScale - cg, AE - cO - cI, Ab - (r.mapScale - cg));
            }
            fV.globalAlpha = 1;
            fV.fillStyle = "rgba(0, 0, 70, 0.35)";
            fV.fillRect(0, 0, AE, Ab);
            fV.strokeStyle = AP;
            fV.globalAlpha = 1;
            for (let ca = 0; ca < Ae.length + AA.length; ++ca) {
                AK = Ae[ca] || AA[ca - Ae.length];
                if (AK.visible) {
                    fV.strokeStyle = AP;
                    if (AK.skinIndex != 10 || AK == Ai || AK.team && AK.team == Ai.team) {
                        let cu = (AK.team ? "[" + AK.team + "] " : "") + (AK.name || "") + (AK.isPlayer ? " {" + AK.sid + "}" : "");
                        if (cu != "") {
                            fV.font = (AK.nameScale || 30) + "px Hammersmith One";
                            fV.fillStyle = AK.isPlayer ? V7.includes(AK.sid) ? "#FF0000" : V6.includes(AK.sid) ? "#00ff00" : "#fff" : "#fff";
                            fV.textBaseline = "middle";
                            fV.textAlign = "center";
                            fV.lineWidth = AK.nameScale ? 11 : 8;
                            fV.lineJoin = "round";
                            fV.strokeText(cu, AK.x - cQ, AK.y - cg - AK.scale - r.nameY);
                            fV.fillText(cu, AK.x - cQ, AK.y - cg - AK.scale - r.nameY);
                            // Measured once per name change, not three times a frame.
                            if (AK.nameText !== cu) {
                                AK.nameText = cu;
                                AK.nameWidth = fV.measureText(cu).width;
                            }
                            if (AK.isLeader && c3.crown.isLoaded) {
                                let cl = r.crownIconScale;
                                let cB = AK.x - cQ - cl / 2 - (AK.nameWidth || 0) / 2 - r.crownPad;
                                fV.drawImage(c3.crown, cB, AK.y - cg - AK.scale - r.nameY - cl / 2 - 5, cl, cl);
                            }
                            if (AK.iconIndex == 1 && c3.skull.isLoaded) {
                                let cw = r.crownIconScale;
                                let cL = AK.x - cQ - cw / 2 + (AK.nameWidth || 0) / 2 + r.crownPad;
                                fV.drawImage(c3.skull, cL, AK.y - cg - AK.scale - r.nameY - cw / 2 - 5, cw, cw);
                            }
                            if (AK.isPlayer && sc.wait && AQ == AK && Ad.length && !fL) {
                                let cy = AK.scale * 2.2;
                                fV.drawImage(c2, AK.x - cQ - cy / 2, AK.y - cg - cy / 2, cy, cy);
                            }
                            if (AK.isPlayer && AK.sid == Ag?.sid) {
                                let ch = AK.scale * 2.2;
                                fV.drawImage(c2, AK.x - cQ - ch / 2, AK.y - cg - ch / 2, ch, ch);
                            }
                        }
                        if (AK.health > 0) {
                            let cP = AK.prevHW || r.healthBarWidth * 2 * (AK.health / AK.maxHealth);
                            fV.fillStyle = AP;
                            fV.roundRect(AK.x - cQ - r.healthBarWidth - r.healthBarPad, AK.y - cg + AK.scale + r.nameY, r.healthBarWidth * 2 + r.healthBarPad * 2, 17, 8);
                            fV.fill();
                            let cq = r.healthBarWidth * 2 * (AK.health / AK.maxHealth);
                            if (AK.prevHW !== undefined) {
                                AK.prevDW = AK.prevDW || AK.prevHW;
                                AK.prevDW += (cq - AK.prevDW) * 0.03;
                            }
                            cP += (cq - cP) * 0.2;
                            AK.prevHW = cP;
                            fV.fillStyle = AK == Ai || AK.team && AK.team == Ai.team ? "#FF6666" : "#FFFF66";
                            fV.roundRect(AK.x - cQ - r.healthBarWidth, AK.y - cg + AK.scale + r.nameY + r.healthBarPad, AK.prevDW, 17 - r.healthBarPad * 2, 7);
                            fV.fill();
                            fV.fillStyle = AK == Ai || AK.team && AK.team == Ai.team ? "#8ecc51" : "#cc5151";
                            fV.roundRect(AK.x - cQ - r.healthBarWidth, AK.y - cg + AK.scale + r.nameY + r.healthBarPad, cP, 17 - r.healthBarPad * 2, 7);
                            fV.fill();
                            if (AK.isPlayer) {
                                fV.globalAlpha = 1;
                                fV.globalAlpha = 1;
                                fV.font = "20px Hammersmith One";
                                fV.fillStyle = "#fff";
                                fV.strokeStyle = AP;
                                fV.textBaseline = "middle";
                                fV.textAlign = "center";
                                fV.lineWidth = 8;
                                fV.lineJoin = "round";
                                fV.globalAlpha = 1;
                                fV.font = "30px Hammersmith One";
                                fV.fillStyle = "#fff";
                                fV.strokeStyle = AP;
                                fV.textBaseline = "middle";
                                fV.textAlign = "center";
                                fV.lineWidth = 8;
                                fV.lineJoin = "round";
                                let cU = r.crownIconScale;
                                let cm = AK.x - cQ - cU / 2 + (AK.nameWidth || 0) / 2 + r.crownPad + (AK.iconIndex == 1 ? 82.5 : 30);
                                fV.strokeText(AK.skinIndex == 45 && AK.shameTimer > 0 ? AK.shameTimer : AK.shameCount, cm, AK.y - cg - AK.scale - r.nameY);
                                fV.fillText(AK.skinIndex == 45 && AK.shameTimer > 0 ? AK.shameTimer : AK.shameCount, cm, AK.y - cg - AK.scale - r.nameY);
                                // Arrow around you pointing at this enemy.
                                if (!AK.isTeam(Ai)) {
                                    let cT = Av / 2;
                                    let cj = Math.min(1, s4.getDistance(0, 0, Ai.x - AK.x, (Ai.y - AK.y) * (16 / 9)) * 100 / (r.maxScreenHeight / 2) / cT);
                                    let cJ = cT * cj;
                                    let F2 = s4.getDirect(AK, Ai, 0, 0);
                                    fV.save();
                                    fV.translate(Ai.x - cQ + cJ * Math.cos(F2), Ai.y - cg + cJ * Math.sin(F2));
                                    fV.rotate(AK.aim2 + Math.PI / 2);
                                    let F1 = 255 - AK.sid * 2;
                                    fV.fillStyle = "rgb(" + F1 + ", " + F1 + ", " + F1 + ")";
                                    fV.globalAlpha = cj;
                                    let F5 = 25 * (Math.sqrt(3) / 2);
                                    fV.beginPath();
                                    fV.moveTo(0, -F5 / 1.5);
                                    fV.lineTo(-12.5, F5 / 2);
                                    fV.lineTo(12.5, F5 / 2);
                                    fV.lineTo(0, -F5 / 1.5);
                                    fV.fill();
                                    fV.closePath();
                                    fV.restore();
                                }
                            }
                        }
                    }
                }
            }
            if (Ai) {
                r8(fV, {
                    x: cQ,
                    y: cg
                });
                if (Ai.alive) {
                    VV(AK, cQ, cg);
                    fV.globalAlpha = 1;
                    fV.fillStyle = "#fff";
                    fV.strokeStyle = "#000";
                    if (AW.pushData.x2 !== undefined) {
                        r9(AW.pushData.x2 - cQ, AW.pushData.y2 - cg, 25);
                    }
                    if (At.x) {
                        r9(At.x - cQ, At.y - cg, 35);
                    }
                }
            }
            fV.globalAlpha = 1;
            se.update(AD, fV, cQ, cg);
            for (let F3 = 0; F3 < Ae.length; ++F3) {
                AK = Ae[F3];
                if (AK.visible) {
                    if (AK.chatCountdown > 0) {
                        AK.chatCountdown -= AD;
                        if (AK.chatCountdown <= 0) {
                            AK.chatCountdown = 0;
                        }
                        fV.font = "32px Hammersmith One";
                        let F4 = fV.measureText(AK.chatMessage);
                        fV.textBaseline = "middle";
                        fV.textAlign = "center";
                        let F5 = AK.x - cQ;
                        let F6 = AK.y - AK.scale - cg - 90;
                        let F7 = 47;
                        let F8 = F4.width + 17;
                        fV.fillStyle = "rgba(0,0,0,0.2)";
                        fV.roundRect(F5 - F8 / 2, F6 - F7 / 2, F8, F7, 6);
                        fV.fill();
                        fV.fillStyle = "#fff";
                        fV.fillText(AK.chatMessage, F5, F6);
                    }
                    if (AK.chat.count > 0) {
                        if (!fL) {
                            AK.chat.count -= AD;
                            if (AK.chat.count <= 0) {
                                AK.chat.count = 0;
                            }
                            fV.font = "32px Hammersmith One";
                            let F9 = fV.measureText(AK.chat.message);
                            fV.textBaseline = "middle";
                            fV.textAlign = "center";
                            let Ff = AK.x - cQ;
                            let FA = AK.y - AK.scale - cg + 180;
                            let Fe = 47;
                            let Fs = F9.width + 17;
                            fV.fillStyle = "rgba(0,0,0,0.2)";
                            fV.roundRect(Ff - Fs / 2, FA - Fe / 2, Fs, Fe, 6);
                            fV.fill();
                            fV.fillStyle = "#ffffff99";
                            fV.fillText(AK.chat.message, Ff, FA);
                        } else {
                            AK.chat.count = 0;
                        }
                    }
                }
            }
            fV.globalAlpha = 1;
            c0(AD);
        }
        window.requestAnimFrame = function () {
            return null;
        };
        window.rAF = function () {
            return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (cK) {
                window.setTimeout(cK, 1000 / 60);
            };
        }();
        function cH() {
            AZ = performance.now();
            AD = AZ - AO;
            AO = AZ;
            let cK = performance.now();
            let cd = cK - fJ.last;
            if (cd >= 1000) {
                fJ.ltime = fJ.time * (1000 / cd);
                fJ.last = cK;
                fJ.time = 0;
            }
            fJ.time++;
            // Fallback ticks while the server is quiet, and frame-precise heal timing.
            fU.pump(AZ);
            roboticsSafeCall(roboticsAutoHeal, "auto heal");
            let cg = performance.now();
            roboticsSafeCall(cF, "render");
            roboticsPerf.add(roboticsPerf.frame, performance.now() - cg);
            // The status line changes once a second, so only write it then.
            if (roboticsPerf.roll(AZ)) {
                roboticsLimiter.purge(AZ);
                fy = roboticsLimiter.count;
                x.textContent = "Ping: " + Math.round(Ap.avg) + " FPS: " + s4.round(fJ.ltime, 10) + " Packets: " + fy + (CONFIG.perfReadout ? roboticsPerf.text : "");
            }
            window.rAF(cH);
        }
        // Periodic work, all on the one scheduler.
        fU.every(CONFIG.pingEveryTicks, () => {
            if (fB && fB.readyState === WebSocket.OPEN) {
                A0("0", 1);
            }
        });
        fU.every(CONFIG.sync.updateTicks, roboticsSlowTask);
        fU.every(1, () => {
            if (A7 && AW.pauseUntil && fU.tick >= AW.pauseUntil) {
                A7 = false;
                AW.pauseUntil = 0;
            }
        });
        rN();
        cH();
        let cN;
        window.debug = function () {
            AW.waitHit = 0;
            AW.autoAim = false;
            sc.isTrue = false;
            sV.active = false;
            AW.anti0Tick = false;
            Ai.antiTimer = 2;
            rD = [];
            rI = [];
            rb = [];
            A7 = true;
            AW.pauseUntil = fU.tick + Math.round(10000 / fU.tickRate);
            // Drop pending tick callbacks (the tick counter itself keeps running).
            fU.clear();
        };
        window.wasdMode = function () {
            fL = !fL;
        };
        window.toggleVisual = function () {
            r.anotherVisual = !r.anotherVisual;
            Ac.forEach(cK => {
                if (cK.active) {
                    cK.dir = cK.lastDir;
                }
            });
        };
        window.prepareUI = function (cK) {
            sM();
            s4.removeAllChildren(R);
            for (let cd = 0; cd < s5.weapons.length + s5.list.length; ++cd) {
                (function (ck) {
                    s4.generateElement({
                        id: "actionBarItem" + ck,
                        class: "actionBarItem",
                        style: "display:none",
                        onmouseout: function () {
                            sx();
                        },
                        parent: R
                    });
                })(cd);
            }
            for (let ck = 0; ck < s5.list.length + s5.weapons.length; ++ck) {
                (function (cQ) {
                    let cg = document.createElement("canvas");
                    cg.width = cg.height = 66;
                    let cp = cg.getContext("2d");
                    cp.translate(cg.width / 2, cg.height / 2);
                    cp.imageSmoothingEnabled = false;
                    cp.webkitImageSmoothingEnabled = false;
                    cp.mozImageSmoothingEnabled = false;
                    if (s5.weapons[cQ]) {
                        cp.rotate(Math.PI / 4 + Math.PI);
                        let cW = new Image();
                        rx[s5.weapons[cQ].src] = cW;
                        cW.onload = function () {
                            this.isLoaded = true;
                            let cn = 1 / (this.height / this.width);
                            let cz = s5.weapons[cQ].iPad || 1;
                            cp.drawImage(this, -(cg.width * cz * r.iconPad * cn) / 2, -(cg.height * cz * r.iconPad) / 2, cg.width * cz * cn * r.iconPad, cg.height * cz * r.iconPad);
                            cp.fillStyle = "rgba(0, 0, 70, 0.1)";
                            cp.globalCompositeOperation = "source-atop";
                            cp.fillRect(-cg.width / 2, -cg.height / 2, cg.width, cg.height);
                            getEl("actionBarItem" + cQ).style.backgroundImage = "url(" + cg.toDataURL() + ")";
                        };
                        cW.src = roboticsImg("weapons/" + s5.weapons[cQ].src + ".png");
                        let ct = getEl("actionBarItem" + cQ);
                        ct.onmouseover = s4.checkTrusted(function () {
                            sx(s5.weapons[cQ], true);
                        });
                        ct.onclick = s4.checkTrusted(function () {
                            ez(cK.weapons[s5.weapons[cQ].type]);
                        });
                        s4.hookTouchEvents(ct);
                    } else {
                        let cn = rZ(s5.list[cQ - s5.weapons.length], true);
                        let cz = Math.min(cg.width - r.iconPadding, cn.width);
                        cp.globalAlpha = 1;
                        cp.drawImage(cn, -cz / 2, -cz / 2, cz, cz);
                        cp.fillStyle = "rgba(0, 0, 70, 0.1)";
                        cp.globalCompositeOperation = "source-atop";
                        cp.fillRect(-cz / 2, -cz / 2, cz, cz);
                        getEl("actionBarItem" + cQ).style.backgroundImage = "url(" + cg.toDataURL() + ")";
                        let cx = getEl("actionBarItem" + cQ);
                        cx.onmouseover = s4.checkTrusted(function () {
                            sx(s5.list[cQ - s5.weapons.length]);
                        });
                        cx.onclick = s4.checkTrusted(function () {
                            en(cK.items[cK.getItemType(cQ - s5.weapons.length)]);
                        });
                        s4.hookTouchEvents(cx);
                    }
                })(ck);
            }
        };
    }
});
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", roboticsStart, { once: true });
} else {
    roboticsStart();
}
