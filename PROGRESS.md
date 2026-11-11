# Falcon auto-improve progress

Branch: `auto-improve` (created from `fix/1.8.2-overhaul` tip, which branched off `main`; branching from
bare `main` would have discarded all finished 1.8.2 work). Never commit to `main`.

## Current task in progress
- High-ping (~300ms sim) trap-break + turret EMP redo; then launcher extension live test, 30-min session.

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
- Docs: README Quick Inject section, docs/TEST_CHECKLIST.md (146 lines)

## Next up
1. Musket real-fight hit count: redo with R pressed only when not armed (use falconDebug.instaArmed)
2. High-ping (~300ms) trap-break + turret EMP redo (bot placement kept failing)
3. Launcher extension live test; 30-min session memory/FPS
4. Reload start lag (`tick - lastHit > 1`): verify vs server and with ping
5. Predicted-damage over-estimate (assumed musket+turret+spike) → too many emergency heals; consider confidence per source
6. Auto-place: verify trap/spike angles live (bot victim, count traps landing on target)
7. Target selection: nearest by distance only — consider threat-weighted (health, trapped)
8. Combo edge cases: target dies / leaves range mid-combo (live)
9. ProjectileManager projFired 4-tick setTimeout → tick-based
10. Packet budget: measure real outgoing rate in a fight vs server limits

## Feature review tracker (round 1)
- Ping: measurement ✓, display ✓, prediction ✓, lag spikes ✓, compensation ✓, shame timing ✓, turret lead ✓, safe walk ✓
- Combat: reload ✓, ranges ✓, insta R ✓ (live), aim lead ✓ (accuracy measured), musket live hits ⏳, one-tick ✗, spike tick ✗, melee/proj sync ✗, auto push ✗
- Defense: heal ✓, anti-insta ✓, turret ✓, trap break ✓, safe walk ✓, anti-bull ✓ (live), shame spiral ✓, auto place ⏳, replacer ✗, auto mill ✗
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
- Musket strafe test pressing R every 1.7 s: R is a toggle, so it disarmed half the time; only 1-3 instas/run (inconclusive)
- Chrome offline mode to drop WS in tests (doesn't close existing sockets) → close via send hook
- page.screenshot clip on vanilla page (black) → full screenshots + CSS crop

## Known issues / couldn't verify
- Exact moomodding placement limit (≥22 walls seen); kept sandboxLimit 99/299
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
- Python edits: use String.fromCharCode(10) for "\n" in JS strings written via heredocs
