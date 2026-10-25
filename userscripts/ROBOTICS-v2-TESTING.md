# Robotics v2.0.0 — live test checklist

Items marked **[host]** depend on the host profile (`CONFIG.hosts`). Watch the console for `[Robotics]` lines and the status line (`Packets: n/limit [profile]`).

## sandbox.moomodding.io

### Start-up and connection [host]
- [ ] Console shows `[Robotics] v2.0.0 on sandbox.moomodding.io (profile sandbox, 69 packets/s)`.
- [ ] Status line shows `Packets: n/69 [sandbox]` and never passes 69. No kick after 5 minutes of fighting with every toggle on.
- [ ] Switch server from the menu, or reload with another `?server=`. Console says `new game socket; clearing the old server's state`, no old players or buildings remain, and the mod works on the new server.
- [ ] Kill the connection (DevTools > Network > Offline for 5 s). The page reloads once, at most 3 times a minute.
- [ ] Packet Budget Limit "Host default" = 69; picking 100 is allowed (capped at 120).

### Offense
- [ ] Attack Planner on, two enemies close, only the farther one standing next to your spikes with Knockback Hits on: the hit goes to the farther one and the follow-up aims at the same player.
- [ ] Attack Planner off: behaviour is the same as v1.9.0.
- [ ] Reload Timing: play 5 minutes on each of Legacy, Tick-exact and Falcon with the same insta. Note how often the bull hit lands (chat shows the module name). Keep the best mode.
- [ ] Knockback Insta / Velocity Hits fire on an enemy at 30–60 HP who has a spike one knockback away (current-health simulation).
- [ ] Hat flicker: during an insta, no soldier/tank hat flashes in between (watch your hat). With Anti 1 tick triggered during a sequence, the soldier wins.

### Defense
- [ ] Predictive Heal: get hit to ~60 with an enemy polearm about to reload. The heal comes a tick earlier than with the toggle off. Shame should not climb faster (check your shame in the leaderboard or mod chat).
- [ ] Heal Timing "Precise": heals come sooner after a hit. If shame rises, switch back to Legacy.
- [ ] Knockback Threat: stand between an enemy and their spike. The threat readout (HUD: Threat) rises by the spike damage and soldier/heal come in time.
- [ ] Safe Walk "Smart": walk straight at an enemy spike. You slide around it instead of stopping. Walk into an arrow's path and you sidestep.

### Placing and movement
- [ ] Keep Escape Path: fight against a wall with Graded Auto Place on. You are never fully boxed in by your own spikes.
- [ ] Auto Turret: enemy within 600 px and no turret of yours nearby: one turret goes behind you, then none for 9 ticks.
- [ ] Auto Play / Auto Push: path goes around a spike wall 600 px away and keeps a gap from enemy spikes.
- [ ] Auto Farm: no enemy in sight, release all keys. You walk to the nearest tree/rock and gather it. Press a key or let an enemy appear and it stops.
- [ ] Left click without an enemy in range aims at the mouse again (it used to snap to the enemy).

### HUD and menu
- [ ] Render tab: each HUD toggle draws only its overlay: reload bars, predicted lines, `now / next` threat, green insta ring, danger rings, projectile lines.
- [ ] Presets: each one switches the listed toggles and never External Sync.
- [ ] Export, then paste into the other host's menu and Import: settings and keys carry over; External Sync stays off.
- [ ] Key editor: rebind Mark Map to `e`. The conflict with Auto Gather shows in red. Reset clears it. The new key works without a reload.

## moomodding.io

### Hub page [host]
- [ ] Console shows `waiting up to 30 s for a game page`, then after 30 s `no game on this page (moomodding.io); staying idle`. Nothing else from the mod (no menu, no errors), and the site works normally.
- [ ] If the site opens the game in an iframe, the iframe (sandbox.moomodding.io) gets the sandbox profile and works as above.
- [ ] Run `userscripts/ws-capture.user.js` (Robotics off) on both hosts and send the `copy(__wsCapture.report())` output. The moomodding.io profile (packet ids, socket URL, limits) is only confirmed from that.

### If a game does run on moomodding.io itself [host]
- [ ] Console shows `profile moomodding.io, 50 packets/s` and the status line `n/50 [moomodding.io]`.
- [ ] No kick in 5 minutes at 50/s. Only then try an override in the console:
  ```js
  localStorage.setItem("robotics_host_overrides", JSON.stringify({"moomodding.io": {"maxPerSecond": 69, "packets": {"perSecond": 60, "perTick": 12}}}))
  ```
  then reload.
- [ ] Item counters use the normal limits (not 99/299), unless the capture shows the sandbox limits.

## Not done / not confirmed
- moomodding.io packet names, socket URL, payload shapes, rate limit and tick rate: not confirmed (needs the capture). Its profile is a guess with low limits.
- Reload Timing "Tick-exact" and Heal Timing "Precise" rest on server timing I inferred and could not test. Both are opt-in.
- Not done: Bow/musket follow-up timing, reverse-insta weapon order changes, auto teleporter/base building, enemy-placement prediction in Safe Walk, the anti-trap escape rework and auto age-upgrades.
- Everything was tested offline only: unit tests (237 checks) plus a replayed packet sequence in a browser. Nothing has run against a live server.
