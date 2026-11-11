# Falcon auto-improve progress

Branch: `auto-improve` (created from `fix/1.8.2-overhaul` tip, which branched off `main`; branching from
bare `main` would have discarded all finished 1.8.2 work). Never commit to `main`.

## Current task in progress
- Next: pick from Next up (tank spam early-hat tried and reverted).

## Done (one line each)
- 1.8.2 protocol (plain msgpack, LegacyAdapter for "a"/"I"), moomodding server list, WebSocket wrapper fix
- Quick Inject single-file build (`npm run quickinject`), hook-mode: closes vanilla socket + stops vanilla loop
- Hat data = 1.8.2 (Megalodon 59, Shame dontSell); hats side-by-side verified vs vanilla (47 hats, 21 acc)
- Reload: Samurai atkSpd; projectile→weapon by indx (Marksman fix); unaffordable shots = not reloaded
- Item limits, upgrade prereqs, alive gating, no death log spam, team owner optional
- Reconnect / Change Server without reload; GameReset; render guards when no player
- Settings default autosave, safe JSON reads, chat log cap, recorder fixes, projectile id reuse
- Shame rule measured live (hit→eat gap + RTT > 120ms); ping-aware timed 0-shame heal; in-flight heal tracking
- Katana/GreatAxe ⇒ no crossbow line (secondary guess = bow); EMP held while loaded turret in range
- Combo cancelled on death; resource check on non-sandbox
- Ping: FIFO ping matching, median/min/jitter, Latency module, compensation toggle + adjust, ping display
- Prediction: aim lead (incl. projectile flight), landing-time range checks, defense lead check
- Lag: burst collapse (brain runs on newest update only), no new combos while lagging, real-receive timestamp
- Keybinds registry + Keybinds tab; Debug Mode panel + packet logging; debug API (`falconDebug`)
- Perf: name/label sprite cache, grid loop start, ais.all in-place sort bug, instant movement (0.2ms input lag)
- Safe Walk ping + glide aware (0 hits head-on at ~95 and ~205ms)
- Auto Upgrade weapon builds (Katana / Polearm+Musket), Classic Hats toggle, Falcon Launcher bundles build
- Bow-insta detection tick-based (no fixed 444 ms timer); all remaining timers are ping-computed or UI-only
- Anti-bull verified live: bot dies after 5 swings, 0 Falcon deaths (CX wings/spike gear reflect)
- Own shame counted at eat send (server counts failed eats too); high-shame (>=6, HP>40) defers emergency heals → bull spam: 0 deaths, never Shamed (was Shamed + died)
- Auto Upgrade weapon builds verified live ([5,15],[4,10],[4,9],[5,10]); upgrade retry if same age re-offered
- Classic Hats toggle (spin/static)
- High-ping (~300ms) verified: turret 0 shots/0 hits; trap break works (2.1 s median vs 1.3 s at ~95ms)
- Launcher extension verified live (install via CDP with puppeteer-core 24 `installExtension`; Chrome 157 ignores --load-extension)
- Hook-mode detection by window.requestAnimFrame (not #gameCanvas); Insta Now expires after 30 ticks
- Auto-break pre-tank at high ping: trap break @300ms 2116 -> 1447 ms median (root cause: Soldier/Tank flip, hat late)
- Anti-insta @~405ms (Miami+200 sim): 16 instas, 0 deaths, no shame, min HP 12
- One Tick: correctly refuses with stone weapons (needs Diamond Polearm/Ruby Katana: 45*1.18*1.5+25=104.7 >= 100); live test needs ~7000 weapon XP (not done)
- Auto Mill verified live: 72 mill packets -> 65 mills placed in 3-wide lanes (also: sandbox accepted 65 mills, normal limit 7)
- Auto-place angle search skipped with no enemy within 800px: brain 69 -> 41 us/frame idle
- Resource sprite cached per object: renderGameObjects 131 -> 64 us/frame
- Packet rate in a real fight (22 hits, 32 heals): median 16/s, max 31/s; no kicks seen anywhere (raw probes ~33/s also fine)
- Katana+Bow R-insta correctly does NOT fire on a full-HP Soldier target (60+25+25=110 x0.75 = 82.5 < 100); Polearm+Musket = 107 through Soldier
- R-insta verified at ~95/~205/~305 ms: kills 2/1/2 (presses 5/2/9), 0 Falcon deaths
- 31-min session: 60 FPS, 0 errors, heap 8->11 MB (plateaus after ~10 min), DOM flat
- Docs: README Quick Inject section, docs/TEST_CHECKLIST.md (146 lines)

## Next up
1. Round 2 (deeper): shame safety margin from measured jitter instead of fixed 15 ms
2. Replacer: verify auto-replace of broken traps/spikes live (needs trap-break by bot)
3. Spike Tick / Auto Push: need spikes near a trapped enemy - build a harness (bot traps itself? use Falcon traps)
4. Target selection: prefer trapped/low-HP enemies for instas when several are near (needs 2 enemies: IP limit 2 - blocked)
5. Melee/Projectile Sync: needs a Falcon teammate (blocked: IP limit)
6. postMessage polling in PacketBatcher/TaskScheduler (~1 ms/s): replace busy re-post loop with a single microtask/timeout
7. Debug overlay: show placement counters (autoPlace best/allowed, itemSelects)
8. Code quality: AttackManager/CombatController size; extract shared "ready on arrival" style helpers if reused
9. Re-run full regression (stage2 all-on/all-off, insta, hammer) after every ~10 commits
10. Keep Desktop deliverables refreshed at milestones

## Feature review tracker (round 1)
- Ping: measurement ✓, display ✓, prediction ✓, lag spikes ✓, compensation ✓, shame timing ✓, turret lead ✓, safe walk ✓
- Combat: reload ✓, ranges ✓, insta R ✓ (live), aim lead ✓ (accuracy measured), musket live hits ⏳, one-tick ✓ (logic; live needs diamond weapon), spike tick ✗, melee/proj sync ✗, auto push ✗
- Defense: heal ✓, anti-insta ✓, turret ✓, trap break ✓, safe walk ✓, anti-bull ✓ (live), shame spiral ✓, auto place ⏳, replacer ✗, auto mill ✓ (live)
- Other: hats ✓, keybinds ✓, settings ✓, perf ✓ (profiled), debug ✓

## Decisions
- Branch base: fix/1.8.2-overhaul tip (keeps finished work) > bare main (would lose it)
- Reconnect: in-place reset > page reload (moomodding drops pasted mod on reload)
- Shame: real-time 120ms window + RTT (measured) > tick-based guess
- Turret: hold EMP while loaded turret in range > periodic flicker (EMP blocks targeting, not damage)
- Hat style toggle: spin/static (real difference) > fake "old style" (vanilla already exact)

## Decisions (cont.)
- Own shame: count at eat send (+RTT) > count from health packets (misses failed eats at full HP)
- High-shame emergency: defer to safe heal when HP > 40 (one musket through soldier = 37.5) > always instant (spirals into Shame)

## Tried, didn't work
- Early Tank Gear for tank attack (left click) @~300ms: wall break slower (2670 vs 2338 ms median, 2 runs each) and 1 death -> reverted. Auto-break keeps its own pre-tank (that one helped: 2116 -> 1447 ms). Likely: during tank attack the held early attack fires with the mouse aim before the hat lands; auto-break aims at the trap itself.
- Musket real-fight count (armed-aware R, strafing bot @~180px): only 2-5 instas per 75 s because the bot sits at the polearm range edge; inconclusive, dropped (aim accuracy measured separately: 82% vs 13% @205ms)
- Ping-lead "ready on arrival" for tank spam / auto-break / object breaker: no change (trap break 2116 vs 2114 ms @300, 1335 vs 1335 @95) -> reverted
- Musket strafe test pressing R every 1.7 s: R is a toggle, so it disarmed half the time; only 1-3 instas/run (inconclusive)
- Chrome offline mode to drop WS in tests (doesn't close existing sockets) → close via send hook
- page.screenshot clip on vanilla page (black) → full screenshots + CSS crop

## Known issues / couldn't verify
- Auto Place effectiveness vs an approaching enemy: unverified (harness unreliable); it does place (1 trap landed in victim test)
- Exact moomodding placement limit (≥22 walls, ≥65 mills seen); kept sandboxLimit 99/299
- Whether hats cost gold on moomodding (all hats owned on spawn in sandbox)
- Turret projectile speed missing in 1.8.2 data; live server sends 1.5 (matches Falcon)
- One-tick, spike tick, syncs, auto push, anti-bull not verified live (need specific setups/teammate)

## Codebase notes
- Build: `npm run quickinject` → mod-source/dist/falcon-quickinject.js; `FALCON_DEBUG_BUILD=1` unminified; `npm run launcher:build` → falcon-launcher/dist
- Tests: `npm test --workspace=mod-source` (node:test + esbuild loader tests/loadTs.mjs; modules importing Menu/DOM can't be unit tested)
- Live e2e harness lives in the session scratchpad (puppeteer-core + Chrome, bot.mjs, duel*.mjs) — not in repo
- Protocol switch: core/socket/Protocol.ts; 1.8.2 reshaping: LegacyAdapter.ts
- Ping: core/mod/utils/Latency.ts + PingTracker.ts; hats: RendererUtils.renderSkin/renderTail; hat arbiter: HatSystem.fetchBestHat
- IP limit: ~2 connections per IP on moomodding; never run two live tests at once
- Extension tests: scratchpad/e2e-ext (puppeteer-core 24, pipe:true, enableExtensions:true, browser.installExtension)
- Python edits: use String.fromCharCode(10) for "\n" in JS strings written via heredocs
