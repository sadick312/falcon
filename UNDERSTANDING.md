# Understanding Falcon (full review, Phase 1)

Written on 13 Nov 2026 on branch `full-review` (made from `review/stability` at `814870f`).
This file only describes. No code was changed in Phase 1.

Words used below:

- **Tick**: the game server sends an update about 9 times a second (every 111 ms). Falcon thinks once per tick.
- **Packet**: one message between the game and the server (for example "equip hat 7" or "swing").
- **Toggle**: an on/off switch in the Falcon menu (press **Esc** in game).
- **Replay**: a recorded fight (`.fpl` file). Tests play it back and check that Falcon sends exactly the same
  packets as before ("replay fingerprints").
- **Status words**: **works** = has tests and was used in game; **tested, not live** = has tests that pass but
  nobody has tried it in a real game yet; **partly works** = works, but with a known bug; **broken** = does not do
  what it says; **unknown** = no test and no live check.

---

## 1. What Falcon is and how you load it

Falcon is your own MooMoo.io v1.8.2 client. You use it only on `sandbox.moomodding.io`.

1. In the repo folder run `npm run inject:build`.
2. It makes `mod-source/dist/falcon-quick-inject.js`.
3. On the game page you paste that file into the F12 console (or use the Quick Inject steps in README.md).

The Chrome extension (`falcon-launcher`, built with `npm run ext:build`) is the other way to load it.

## 2. The branches (where the work is)

| Branch | What is on it | State |
|---|---|---|
| `review/stability` | Your main branch. All the work this review is about. | Up to date on `fork`. |
| `full-review` | This review. Starts equal to `review/stability`. | New. |
| `test-fix-optimize` | `review/stability` + 1 commit (`7326a21`, stops exporting three names in `updateUpgrades.ts`). | Not merged. Tiny. |
| `fork/auto-improve` | A **separate line of work** (115 commits, 10–12 Nov) that started from the original upstream code, not from `review/stability`. It has its own `PROGRESS.md`. | Not merged. See section 5. |
| `feat/robotics-v2` | The "Robotics" userscript (v2.1.1), 21 commits, Oct 2026. | Separate project, old. |
| `claude/falcon-dual-version-support-21cc32` | v1.6.9 + v1.8.2 side by side, Test Mode, 15 commits, Oct 2026. | Old, not merged. |
| `origin/main` / `fork/main` | The original upstream Falcon. | Never open PRs to `origin`. |

`review/stability` has 368 commits that `main` does not have.

## 3. Past updates, grouped by area

Each line: what changed → why → status. Commit ids are in brackets so you can look them up.

### 3.1 Networking and ping

- **Support for moomodding.io v1.8.2** (packet layout adapter, cipher, item/hat tables) → so Falcon works on that
  site → **works** (used in game since early Nov). `LegacyPacketAdapter.ts`, `gameVersion.ts`.
- **New site page** (`/assets/bundle.js`) recognised as 1.8.2 (`d12a520`); vanilla game's own connection closed
  (`a6b99cb`, `9f5725b`) → the site changed its loader in early Nov → **works**.
- **Packet `Z` clash fixed** (Falcon's marker is now `falcon:marker`, `Z` shows "Server restarting") and **packet
  `B`** shows the server's kick reason (`2c79092`, `6d9a922`) → **tested, not live**.
- **Ping measurement fixed** (no wrong samples after stalls, hidden tab, reconnect) (`bcbfa6d`) → **tested**.
- **Send Movement Instantly** (`d95f956`, off) → movement key goes out at once, ~55 ms sooner → **tested, not live**.
- **Jitter-Safe Timing** (`a622ff9`, off) → leaves room for jumpy ping in 3 timings → **tested, not live**.
- **Reconnect without page reload** (`55bd182`, `1c58924`) → old server data was kept and handlers were lost →
  **works** (tested + used).
- **PacketBatcher fake ticks** stop while dead (`536fbd8`) → the mod ran on the death screen → **works**.
- Ping is sent every 1 s (vanilla 2.5 s). Kept on purpose (AUDIT #6).

### 3.2 State (what Falcon knows about the world)

- `TickState.ts` holds the per-tick state; ~12 import cycles removed; `noUncheckedIndexedAccess` on everywhere
  (1,180 places) → safer code → **done**.
- "Who updates first" (gold tech order) returns "unknown" on fake ticks (`c0b125e`) → modules guessed wrong on
  laggy ticks → **tested**.
- Samurai Armor reload speed (`67e463c`), our own weapon variant starts as stone (`71deef8`), guessed enemy weapon
  fixes (`1203952`), **Trust Seen Weapons** (`a005a54`, off) → **tested**.
- Ghost traps expire (`2ac3381`), projectiles with reused ids kept (`95ea940`) → **tested**.
- **Resync Predicted Speed** (`78402da`, off) → the predicted next position kept a stuck speed, so Falcon thought
  we hit a spike every tick → panic-eating and shame. **Tested on replays** (heals 70 → 59 on the busy replay),
  **not live**. Default is still the old behaviour.

### 3.3 Combat (attack modules)

- Attack choice: highest grade wins, module order breaks ties (`fe2d6f3`) → **tested**.
- Auto Push Strikes and Anti Bull wait for a running combo (`3ffb6b0`, P4) → **tested**.
- Turret Gear Knockback missing `!` fixed (`cf476c1`) → it only fired when it could not hit → **tested**.
- Anti Bull damage formula fixed (`589ecbb`); **Keep On at High Shame** (`c24f5ad`, on) → **tested**.
- **Shame Grind** built (`fe8cbb7`, off) → it was greyed out → **tested, not live**.
- **Accurate Enemy Shame** (`2645aa9`, on by default since `c24f5ad`) → **tested**.
- **Aim With Mouse While Gathering** (`77a106e`, off) → **tested, not live**.
- **Aim Assist** (`159f6c8`, `40ebc63`, off): picks an enemy inside a ≤60° cone around your mouse, L lock, J switch,
  ranged lead → **partly works** (see the bugs in section 6).

### 3.4 Defense

- Defense System decisions without coin flips (`742b9f2`); late-hit counted once (`665c1a2`) → **tested**.
- **Shame-Safe Healing**, **Exact Threat Reload** (`2645aa9`, `67d62e4`, both off) → **tested, not live**.
- Monkey Tail damage guess fixed (`b09c0b7`), turret target/timing fixed (`7d290db`, `fd8fb53`) → **tested**.
- **Safe Walk** counts snow, water and river current (`eaef9eb`), platforms (`f7e336e`) → **tested**.
- **Blood Wings Optimizations** and **Angel Wings Regen** (off) → **tested, not live**.
- "Soldier + Angel Wings" setting removed (`663e041`, 9 Nov) → your decision at the time.

### 3.5 Breaker (Auto Break while trapped, Auto Object Breaker)

- Katana-spike check ignored blocking buildings (`2726e06`) → **fixed + tested**.
- **Break Traps From Any Angle** (`ddca101`, off) → still only aims within the normal swing → **tested, not live**.
- **Exact Break Hit Count** (`f9c2c4b`, off) → **tested, not live**.
- **Closest First, Detection Range, Walk To Targets, Show Range** (`9fac847`, `0d5a1e3`, all off/0) →
  **partly works**: Walk To Targets never gives up on a target it can't reach (section 6).

### 3.6 Insta

- **Knockback Instakills**: hunting bow works (`784113f`), **Insta Uses Enemy Health** and **EMP-Aware Instas**
  (`e965dfd`, off) → **tested, not live**.
- **Musket Insta** (polearm + musket) and **Katana + musket** (`1dca09e`, on by default since `ecfa40c`) →
  **tested, not live**.
- Apple Insta now checks Preplacements (P2), Spike Tick hit counted (`dc2f5ca`) → **tested**.
- Damage numbers checked against 1.8.2: match.

### 3.7 Hats and accessories

- Hat System: a test for each rule of the classic priority table (`35f88c4`, `4a52a8d`, `923d5ac`, `91d9a78`) →
  the classic behaviour is locked in by tests.
- Counters reset on respawn (`e5d1836`); keep the current hat when the wanted one isn't owned (`4fb2047`) →
  **tested**.
- **Hat Debug** overlay (`f2732b1`, off), **Remember Sent Equips** (`f834d54`, off), **Classic Hat Switching**
  (`6c255ad`, off: a plain MooMoo hat changer for rules 9–13) → **tested, not live**.
- **Auto Buy Fight-First Order** (`c2181c7`, off) → **tested, not live**.

### 3.8 Weapons (including Katana and Musket)

- Reload timing for every weapon, with and without Samurai Armor, tested (`a005a54`). Gold/diamond/ruby reload the
  same as plain (`f186d3f`) → **tested**.
- Musket: enemy musket guess, Katana + musket insta (above). **Always Pick Best Weapon** unchanged.
- Weapon drawing back to the original look (`b355504`) → **works**.

### 3.9 Rendering and visuals

- **Original MooMoo Artwork** (`b7c4d16`, **on**) → official hat/weapon pictures on moomodding.io → **works**.
- Menu and ping line look like the original Falcon again (`e2eea0a`) → **works**.
- **Reload HUD** (`f186d3f`, off) → **partly works**: an unheld weapon's tick countdown is off (section 6).
- Aim Assist markers, breaker Show Range → **tested, not live**.
- Marker/text caps (`cbead59`), contrast-theme switches visible (`9473852`) → **works**.
- **Wide view / View Distance: not on this branch.** It exists only on `auto-improve` (`3e3f2ca`).
- "Classic hats" as a *look*: on this branch that is Original MooMoo Artwork. On `auto-improve` there is a separate
  "Classic Hats" visual toggle (`6d1b8f3`) that is not here.

### 3.10 Menu and settings

- Menu split into one file per tab (`bb8887a`); every toggle can be flipped mid-fight; setting ids checked by a
  test; saved settings carry a version number → **works**.
- Export/Import of settings files, saved configs fixed (`f462da9`) → **works**.
- The search box and reset buttons were later removed again to match the original look (`e2eea0a`).
- `docs/SETTINGS.md` is generated by `npm run docs:settings`.

### 3.11 Upgrades

- Building prerequisites fixed (`dd7423c`) → the menu offered castle wall without stone wall → **tested**.
- **Age 2 / 6 / 8 / 9 Pick** and **Spend Every Point** (`ce5dd6b`, Manual/off) → **tested, not live**.
- `auto-improve` has more (Katana + Musket build, "Choose Every Age Yourself"); not here.

### 3.12 Utilities and tools

- Packet recorder / replayer fixes, `!plog`, `check:dead`, `stats`, many benchmarks (`BENCHMARKS.md`),
  long-tick, aim and heal reports, Angle Finder and Grader speed-ups (7–19% faster) → **done**.
- Auto Grind asks the packet budget (`f72da0d`); Auto Mill counts toward the 4-per-tick cap (`e07c493`) →
  **tested**.

## 4. What you wanted but isn't done

There is **no PROGRESS.md on `review/stability`**. These come from the CHANGELOG, AUDIT.md, the Phase 3B notes,
the open code review, and `auto-improve`'s PROGRESS.md.

**Never tested in a real game (your Phase 3B test list, `docs/PHASE-3B-TESTING.md`):**
Reload HUD, Combat Debug Log, the 4 breaker options, Aim Assist, Resync Predicted Speed.

**Open bugs from the last code review (not fixed):** see section 6.

**Skipped by your choice (AUDIT):** P26 (own shame counted from food we send, not from health gains) and P27
(split a two-tick packet burst). Both still open.

**Measured but left alone:** Pathfinder heap orders one node wrong (paths were still shortest on 561 maps);
smoothing/extrapolation trade-offs; Angle Finder redesign.

**Only on `auto-improve` (not here):** View Distance / zoom keys, rebindable Keybinds tab, Debug Mode panel and
`falconDebug` API, "save settings by default" (`adbf0cb`), Insta Now (R) expiry, ping-led aim, bow-insta tick
counting, EMP hold while a loaded turret is in range, Katana + Musket upgrade builds, resource/name sprite caches,
boot smoke test. Some of these may overlap with work that was redone here in a different way. Bringing any of them
over is a decision for you.

**`auto-improve` "couldn't verify" list (still true):** Replacer live, Auto Place against an approaching enemy,
moomodding's exact building limit (Falcon keeps 99 / 299), whether hats cost gold on moomodding, One Tick / Spike
Tick / Melee Sync / Projectile Sync / Auto Push / Anti Bull never seen live (need a teammate or 2 enemies; the site
allows about 2 connections per IP, error 4001).

**No TODO or FIXME comments** exist in `mod-source/src` or `falcon-launcher/src`.

## 5. How the code works

All paths are inside `mod-source/src/`.

### 5.1 One tick, from packet in to packets out

```
server packet
  -> core/socket/Socket.ts          decode (1.8.2 cipher), LegacyPacketAdapter reshapes 1.8.2 data
  -> core/utils/PacketBatcher.ts    collects the packets of one tick, puts the player update last,
                                    fakes a tick if the real one is late (not while dead)
  -> core/socket/SocketListener.ts  one handler per packet: players, buildings, hits, health, shame...
  -> PlayerUpdateEvent.ts           the player update ends the tick and calls ModManager.main()
  -> core/ModManager.ts main()      the "brain", in a fixed order (5.2)
  -> modules choose hat, weapon, aim, swing, food, buildings, movement
  -> core/utils/PacketManager.ts    builds packets; PacketTracker.ts checks the packet budget
  -> Socket.send                    encoder (CustomEncoder.ts) -> server
rendering (separate, every frame)   rendering/RendererSystem.ts draws what the state says
```

### 5.2 The update order inside `ModManager.main()` (do not change it)

1. Stop if we have not spawned or are dead.
2. **Prepare**: `preTick`, queued actions, `updateStates` (players, predicted positions, projectiles, ghost
   buildings), `GameEventTracker.prepare`.
3. `autoPlayMovement` (only with Auto Play).
4. `AutoBreaker.preTick`, then **`DefenseSystem.start`**: add up all damage we could take this tick.
5. `updateObjects`, then `AutoPlacer.preStart` (pick placement spots).
6. **Attack side**: `AutoPusher.main` → `AttackManager.main` (runs the attack modules, keeps the best one) →
   `CombatController.main` (weapon and hat for the current mode).
7. **`DefenseSystem.respond`**: heal, allow or block soldier/EMP, knowing what the attack side wants.
8. **`DefenseSystem.resolve`** (sends hat/accessory and movement) → `PlacementSystem.main` (sends buildings).
9. `DefenseSystem.conclude`, `CombatController.postTick`, `updateDirection`, `resolveAttackState`, `postTick`.
10. `PacketTracker.allocate` (budget for next tick), `GameEventTracker.clean`.

**Gold tech** (GOLD_TECH.md): the server updates players in gold order (richest first). The player update packet
is already in that order, so Falcon remembers each player's position in it. If an enemy updates *before* us, its
knockback lands on us this tick; if *after*, next tick. Damage and knockback predictions depend on this, which is
why the order above must stay.

### 5.3 Who decides what each tick (priority)

**Attack**: `AttackManager` asks the modules in this order (`core/mod/combat/core/attackModules.ts`): Anti Bull,
Knockback Instakills, Musket Insta, Knockback Hits, Projectile Sync, Push Strikes, Turret Assist, Velocity Hits,
Defensive Knockback, Melee Sync, Turret Gear KB, Barbarian KB, Shame Grind, Apple Insta, Spike Tick, One Tick. Each one
that can act queues an attack with a **grade**; the highest grade wins, list order breaks ties. A running combo is
not interrupted.

**Weapon** (`CombatController.main`), first match wins:
1. a chosen attack's own weapon → 2. Auto Break while trapped → 3. tank spam (mouse) → 4. Auto Grind →
5. Space = bull spam → 6. Object Breaker → 7. reload the secondary, then the primary →
8. **Always Pick Best Weapon**: great hammer if you have polearm/katana + hammer, else the primary.

**Hat** (`HatSystem`, the classic table; first match wins; never changed without your OK):
1. defense forces a hat → 2. attack combo hat → 3. One Tick tap mode → 4. breaking (soldier, EMP, bull tick,
anti-bull, or what the breaker asks) → 5. EMP vs ranged insta → 6. bull tick → 7. EMP vs turret →
8. anti-bull Spike Gear → *(Classic Hat Switching on: rules 9–13 replaced by a simple hat changer)* →
9. river: Flipper → 10. enemy close: Soldier (or EMP) → 11. snow: Winter Cap → 12. moving: Booster →
13. stopped: keep for 1 tick, then Soldier.

**Accessory**: 1. attack combo → 2. One Tick move → 3. push strike → 4. Blood Wings heal → 5. enemy close →
6. Angel Wings regen → 7. default.

**Aim**: Falcon's own attacks aim at their target. Your manual swings use the mouse; Aim Assist (if on) may turn
them to an enemy inside the cone. The only 360° turning is breaking the trap you are stuck in.

### 5.4 How settings are saved and loaded

- Every setting is plain data in `core/menu/content/*.ts` (one file per tab). `Menu.getValue("id")` reads it, and
  every module reads its setting every tick, so a switch takes effect on the next tick.
- Saved in the browser's `localStorage`:
  - `falcon-settings`: your current settings. **Only kept while "Auto Save Configs" is on (default off).** While
    it is off, every change deletes this entry, so after a reload you get the defaults again (the original Falcon
    did the same).
  - `falcon-configs`: your named configs (Configs tab). Loading one applies it and redraws the menu.
  - `falcon-favorites`: starred settings.
  - Export/Import uses a `falcon-settings.json` file.
- Each save has `__version` (now 1). `settingsVersion.ts` upgrades old saves; unknown ids and values that no longer
  fit (for example a toggle that became a slider) are skipped, so **old configs still load**.
- Settings marked "not saved" (for example Auto Grinding, Artificial Ping, Melee Sync target) always start at
  their default.

## 6. Every feature and its status

Short version. All of these have unit tests unless marked (AUDIT.md: 79 features, every one "tested", "fixed +
tested" or "checked"). "Works" here means it is on by default, tested, and nothing in the notes says it fails in
game; no feature has a written live-test record on this branch, so Phase 2/6 should confirm.

| Area | Feature (setting) | Default | Status |
|---|---|---|---|
| Combat | Velocity Hits, Knockback Hits, Knockback Instakills | on | works |
| Combat | Allow While Trapped, Insta Uses Enemy Health, EMP-Aware Instas | off | tested, not live |
| Combat | Accurate Enemy Shame | on | tested |
| Combat | Trust Seen Weapons | off | tested, not live |
| Combat | Musket Insta (+ Katana + musket) | off (+on) | tested, not live |
| Combat | Auto Push Strikes (+ methods), Turret Bullet Assist | on | tested; not seen live |
| Combat | Pit-Spike Breaker | off | tested |
| Combat | Projectile Sync, Melee Sync | on / off | tested; need a teammate, not seen live |
| Combat | Turret Gear Knockback, Barbarian Knockback | on | tested |
| Combat | Shame Grind | off | tested, not live |
| Combat | Apple Insta (+ options), Spike Tick | on | tested; Spike Tick not seen live |
| Combat | Auto Place (+ Preplacements, Replacements, Two Tick) | off | tested; Replacer never verified live |
| Combat | **Aim Assist** (+ Lead Falcon's Ranged Shots, Markers) | off | **partly works** (bugs below) |
| Combat | Dynamic One Tick, Ignore Hats | on / off | tested; not seen live |
| Combat | Auto Push (+ path line) | on | tested; not seen live |
| Combat | Anti Bull (+ Force Spike Gear, Keep On at High Shame) | off (+on) | tested |
| Utility | Auto Grinding | off | tested |
| Utility | Auto Buy (+ Fight-First Order) | on (+off) | works / tested |
| Utility | Auto Upgrade (+ 7th Slot, Age picks, Spend Every Point) | on (+Manual/off) | works / tested |
| Utility | Packet budget, Send Movement Instantly, Jitter-Safe Timing, Artificial Ping | — / off | tested |
| Utility | Auto Break (+ Break Traps From Any Angle) | on (+off) | works / tested |
| Utility | Auto Respawn, Kill Chat, Auto Play (+ Follow) | off | unknown live |
| Utility | Aim With Mouse While Gathering | off | tested, not live |
| Defense | Pattern Recognition, Auto Healing | on | works |
| Defense | Shame-Safe Healing, Exact Threat Reload, Exact Break Hit Count | off | tested, not live |
| Defense | **Resync Predicted Speed** | off | tested on replays, not live |
| Defense | Hat Switching (classic table) | on | works |
| Defense | Classic Hat Switching, Remember Sent Equips | off | tested, not live |
| Defense | Blood Wings Optimizations, Angel Wings Regen | off | tested, not live |
| Defense | Safe Walk (+ teleports, boost pads) | on | works |
| Defense | Always Pick Best Weapon | on | works |
| Defense | Auto Object Breaker | on | works |
| Defense | **Closest First, Detection Range, Walk To Targets, Show Range** | off/0 | **partly works** (Walk To Targets bug) |
| Defense | Defensive Knockbacks (+ Require Turret) | on | tested |
| Visual | Building health bars, overlay, grid, night mode, names, shame counter, stacked text | mixed | works |
| Visual | Original MooMoo Artwork | on | works |
| Visual | Debug visuals (placements, packet count, activity, ownership, times, real direction) | on | works |
| Visual | Hat Debug | off | tested |
| Visual | Reload Bars (+ Turret Reload) | on (+off) | works |
| Visual | **Reload HUD** | off | **partly works** (countdown bug below) |
| Visual | Wide view / View Distance | — | **not on this branch** |
| Configs | Development Analytics, Download Local Copy, Combat Debug Log, Auto Save Configs | on/off | works / tested |
| Other | Reconnect, server browser, `!` chat commands, `!plog`, packet replayer | — | works |

### Known open bugs (from the last code review; checked in the code where noted)

1. **Aim Assist J switch reverts** (checked: `AimAssist.ts` line 165–178). J picks the next enemy, but on the
   next tick, if you are not locked, the normal pick runs again and goes back. J only "sticks" with L lock on.
2. **Lead Falcon's Ranged Shots uses the held weapon** (checked: `leadOwnShot` reads `Client.weaponIndex`, not the
   attack's weapon `action.wpnId`). If Falcon switches weapon for the shot in the same tick, the lead is wrong or
   missing.
3. **Ranged lead misses one tick of send delay**: the shot leaves a tick after the aim is worked out, so the lead
   is a little short. (From the review; to confirm in Phase 3.)
4. **WingsUtils uses the raw mouse aim during tank spam**, not the Aim Assist direction, so the Blood Wings "will
   this hit" check can disagree with the real swing. (From the review; to confirm.)
5. **Walk To Targets never gives up** on a building it cannot reach (blocked path): it keeps walking into it.
   (From the review; to confirm.)
6. **Reload HUD countdown for an unheld weapon** shows a tick count that doesn't match how that weapon reloads
   while not held. (From the review; to confirm.)

## 7. Couldn't verify

- Exact building limit on moomodding.io (Falcon keeps 99, 299 for mills/pads/teleporters).
- Whether hats cost gold on moomodding.io (all hats are owned at spawn in sandbox).
- Whether the server lets an enemy change accessory in the same tick it hits (Monkey Tail case, P17).
- Whether turrets target animals (P19).
- Any feature that needs two Falcon players or two enemies: blocked by the ~2 connections per IP limit (4001).
  Playwright's "Singleplayer" joins the live public server, so it is not a safe test place.

## 8. Rules for the next phases (from your brief)

Never change packet formats, encoder output or the update order in 5.2. Never change the classic hat table or hat
combos (bug fixes only if classic behaviour stays exactly the same). No 360° hitting except breaking the trap
you're in. Every behaviour change goes behind a toggle that defaults to the old behaviour. Old configs must still
load. Never guess 1.8.2 values. Never remove a feature. One change per commit, PROGRESS.md updated after each.
