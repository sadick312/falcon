# Combat, Defense and Ping: Step 1 findings

Branch `combat-defense-ping`. It starts from `full-review` with `review/stability` and `classic-upgrades` merged in
(you asked for all of them). Both merges had small conflicts, only in tests and one unused export, and all checks
pass after them (see PROGRESS.md, "Baseline").

How this was done: the full review's UNDERSTANDING.md already describes the whole tick (sections 5.1–5.3), so this
file builds on it and goes deeper only into ping, combat and defense. Files read line by line: `PingTracker.ts`,
`PacketBatcher.ts`, the ping parts of `SocketListener.ts`, `AutoHealer.ts`, the threat part of `DefenseSystem.ts`
(`isInRange`, `processEnemy`), `PlacementSystem.place`, and every place that uses ping. Other modules (each insta
module, Hat System rules) were read only where they touch these.

All paths are inside `mod-source/src/`.

## 1. How it works now, in plain words

### Ping

1. Once a second Falcon sends a ping packet and notes the time (`SocketListener.pingSocket`).
2. The reply (pong) is handled at once, not held back with the game packets (`Socket.ts` sends "UI packets"
   straight through). Round trip = now − send time.
3. Bad samples are thrown away: a reply to an older ping, a ping sent while the tab was hidden, anything over 2 s.
4. `PingTracker` keeps three numbers:
   - **current**: the last sample (shown on screen: `Ping: 50 ms | FPS | BWin`);
   - **stable**: the median of the last 5 samples. One Wi-Fi spike can't move it; a real change shows after ~3 s;
   - **jitter**: a smoothed average of how much the ping jumps from one sample to the next.
5. A new connection resets all of it (default 50 ms until the first sample).

### Server tick timing

- The server sends one player update every 111 ms (`SERVER_UPDATE_SPEED`). `PacketBatcher` collects each tick's
  packets, puts the player update last, and runs the tick.
- `PlayerUpdateEvent.lastReceive` = when the last tick arrived. `PacketBatcher.tickJitter` = how unevenly ticks
  arrive (smoothed).
- If a tick is late by more than 5–40 ms (more on a jumpy connection), a **fake tick** runs so Falcon doesn't freeze.
  A fake tick sets `lastReceive` to "now − 5 ms".

### Where ping is used (4 places, each with its own formula)

| Where | What it works out | Formula |
|---|---|---|
| Auto Place preplacement (`AutoPlacer.placePreplacement`) | when to send a building so it reaches the server as its next tick starts | wait = 111 − stable ping + 0.5 (+ jitter with Jitter-Safe Timing) − time since `lastReceive` |
| Packet budget (`PacketTracker.request`) | the server's clock, to count packets in its 1 s window | now − stable/2 (− jitter) |
| Remember Sent Equips (`HatSystem.onItsWay`) | how many ticks a hat change takes to show | ceil(stable / 111), at least 1, +1 |
| Own shame count (`HealthUpdateEvent.ateRecently`) | whether a heal is our food coming back | 2 + ceil((stable + 2×jitter) / 111) ticks |

These agree with each other: a packet takes half the round trip to reach the server, and a reply takes the whole
round trip. But each place writes the maths out itself.

### Combat (per tick, inside the fixed order in UNDERSTANDING.md 5.2)

- **Target**: the nearest enemy (`tickState.enemyData.nearest`). Aim Assist (off by default) can pick inside a
  ≤60° cone around your mouse instead.
- **Attack choice**: `AttackManager` asks each attack module; each one that can act offers an attack with a grade;
  the highest grade wins and a running combo isn't interrupted.
- **Hit timing**: a weapon is "ready" on exactly the last tick before the server allows the next swing. Tested for
  every weapon, both slots, Samurai Armor, and enemies (`reload-timing.test.ts`). Reload starts from the server's
  swing packet, not a timer.
- **Aim**: Falcon's own attacks aim at the target's current position. Ranged lead exists only in Aim Assist (one
  tick of send delay, then the flight time).

### Defense

- **DefenseSystem.start** adds up every hit we could take this tick: each enemy's primary, secondary and turret if
  reloaded and in range, spikes we may be pushed into, projectiles, knockback, and buildings placed on us.
- **AutoHealer**: if that damage would kill us, it tries EMP Helmet, then Soldier Helmet (×0.75 damage), otherwise
  eats right away. If we're safe and weren't hit this tick or the last, it **eats back to full health**.
- **Hat**: the Hat System's classic table (unchanged; defense's forced hat is rule 1).
- **Breaker**: Auto Break while trapped (Great Hammer + Tank Gear, or Soldier if a one-shot is possible), Auto Object
  Breaker for enemy buildings in reach.
- **Placement**: Auto Place and Preplacements (off by default), Safe Walk stops us walking into spikes.

### Who decides the weapon and hat each tick (one place each, checked)

- **Weapon**: only `CombatController.selectWeapon` sends a weapon switch. Order, first match wins: the chosen
  attack → Auto Break (trapped) → Tank Spam → Auto Grind → Space (bull spam) → Object Breaker → reload the
  secondary, then the primary → Always Pick Best Weapon. Placing a building switches to it and straight back
  (`PlacementSystem.place`).
- **Hat and accessory**: only `HatSystem` sends them. Defense's forced hat (EMP/Soldier) is rule 1 and beats
  everything, then the attack combo hat, then breaking, then the everyday hats.
- So today the order is already **defense > attack combo > breaker > everyday**, decided in one place each. The
  hat report shows the one regular clash: 15 ticks where defense's Soldier Helmet replaced the Object Breaker's Tank
  Gear (`sample-base`). That is the intended order: staying alive beats breaking faster.

## 2. Bugs, weak spots and conflicts, ranked by impact

The 6 open bugs from the last code review are already fixed on this branch (full review Phase 3), so none of them
are listed again.

| # | Area | What | Why it matters | Sure? |
|---|---|---|---|---|
| 1 | Defense + ping | **Defense never looks at ping.** It works out the damage for this tick and answers with a hat or food, but that packet reaches the server half a round trip later. Above about 110 ms round trip the answer can land a tick after the hit it was meant for. | The main reason anti-insta and auto-heal fail at high ping. | Reasoned from the code; the exact tick at which the server applies it couldn't be verified (no 1.8.2 server code). |
| 2 | Ping / tick timing | **Preplacement times itself from the last tick's arrival.** That one arrival carries its own network jitter, and after a fake tick it's "now − 5 ms", not a real tick. | A late tick shifts the next preplacement by the same amount: it misses the server tick and lands a tick late. | Yes (code). |
| 3 | Ping | **The ping-timing maths is written in 4 places** (table in section 1). | Correct today, but a change in one place won't reach the others; brief Step 2 asks for one shared helper. | Yes. |
| 4 | Ping / HUD | **You can't see stable ping, jitter or tick jitter.** The ping line shows only the last sample (the line was set back to the original Falcon format on purpose). | Hard to test "at low and high ping" or to tell lag from a bug. | Yes. |
| 5 | Defense: heal | **Top-up eats to full whenever you're not being hit**, even 1–2 HP down (a cookie heals 40). | Wastes food. On sandbox food is cheap, so this mostly matters for shame (each food after a hit adds shame) and packets. | Yes (code). |
| 6 | Defense: range | **The danger range uses a fixed +63 for the hitbox** (`DefenseSystem.isInRange`), and also counts both players' movement. | Errs on the safe side: an enemy counts as "in range" a little early, so Falcon puts on Soldier or eats a little more often than needed. | Couldn't verify the 1.8.2 hit-range rule exactly; it's safe, not wrong. |
| 7 | Combat: aim | **Falcon's own attacks aim at where the enemy is now**, not where it will be when the swing lands (melee) or the shot arrives (ranged, unless "Lead Falcon's Ranged Shots" is on). | A running enemy can step out of a melee arc or a shot. A melee swing hits players within 90° either side of the aim (`HIT_ANGLE`), so this matters most for ranged. | Yes (code). |
| 8 | Combat: aim + ping | **Ranged lead uses one tick of send delay at any ping.** With a round trip over ~111 ms the shot may leave two ticks later. | The lead is short at high ping. | Couldn't verify (already in PROGRESS "Known issues"). |
| 9 | Ping | **Stable ping follows a real change only after ~3 s** (median of 5 samples, 1 per second). | Fine for steady Wi-Fi; slow after a sudden lasting change (switching network). | Yes; a trade-off, not a bug. |
| 10 | Tests | **TaskScheduler / jitter-safe timing tests are flaky** on a busy PC (already noted on review/stability). | False alarms in the test run. | Yes. |

Not found: no feature sends a second weapon or hat packet in the same tick. The one place that switches the held
item (placing a building) switches back right away. Listeners and intervals weren't checked in this step (Step 6).

## 3. What I'd do in each step (needs your OK first)

- **Step 2 (ping)**: one shared timing helper (`Timing`: the server's clock, the time until the next tick, ticks
  for a round trip) used by all 4 places, with identical results, so replays don't change. A smoothed tick clock
  that estimates when the next server tick will be from many arrivals, not only the last (behind a new setting,
  off by default, for #2). Stable ping, jitter and tick jitter in a debug HUD line (a new Visual setting, off).
  Tests with fake timestamps: normal, spikes, packet loss, 200 ms+.
- **Step 3 (defense)**: a "Ping-Aware Defense" setting (off) that, when the round trip is longer than a tick, also
  counts the threats of the next tick (#1). A "Don't Top Up Small Losses" setting (off) that only eats back when
  the missing health is at least one food's worth or a threat is near (#5). Tests with fake game states.
- **Step 4 (combat)**: optional melee and ranged lead for Falcon's own attacks (#7, off), using the shared timing
  helper so the delay follows the ping (#8). Reload tracking and the insta order are already tested to the tick; I'd
  add tests only where Step 3/4 changes them.
- **Step 5 (no conflicts)**: the order is already one place each (section 1). I don't plan to change it; a hat
  report check that no tick sends two hats or two weapons will lock that in.
- **Step 6**: speed work only with bench proof, then load the build with Playwright and check the console (the IP
  limit 4001 may block it again; close other game tabs first).
