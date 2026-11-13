# Phase 3B: in-game test

Step-by-step checks for the reload, breaker and aim changes (commits f186d3f, 9fac847, 159f6c8). Every new option
is **off by default**, so turn on only what a step says. Test on sandbox.moomodding.io, ideally with a friend (or a
second tab) as the "enemy".

Before you start:
- Open the browser console (F12, then the **Console** tab). Some steps read lines from it.
- Turn on **Configs → Combat Debug Log**. It writes `[reload]`, `[breaker]` and `[aim]` lines to the console. Turn it
  off again when you are done; it is for testing only.

## 1. Reload

Turn on **Visual → Reload Bars → Reload HUD**.

1. **Your own reload.** Hold a polearm and hit once (left click starts Tank Spam; click again to stop it).
   - The panel on the left shows `You: polearm` going from empty to full.
   - The console shows `[reload] event=swing ... weapon=polearm reloadMs=700`, then
     `[reload] event=ready ... ticksAfterSwing=7`.
   - Expected ticks per weapon: polearm 7, katana/short sword/tool hammer/bat 3, great hammer 4, daggers 1,
     musket 14, crossbow 7. With **Samurai Armor** worn when you swing: polearm 5, musket 11.
2. **Gold / diamond / ruby.** Repeat step 1 with an upgraded weapon. The tick count must be the **same** as the
   plain weapon (variants only add damage).
3. **Enemy reload.** Stand near the enemy and let them hit. The panel shows `Enemy: ...` rows counting down, and
   the console shows `who=sid N` lines with the same tick counts as above.
   - A `?` after an enemy weapon (for example `musket?`) means Falcon hasn't seen it yet and is guessing.
4. **Nothing early.** With Tank Spam on, watch the console: every `swing` should come right after a `ready` for that
   weapon, never before it.

## 2. Breaker

Turn on **Defense → Auto Object Breaker** (it is on by default) and its **Show Range**. Have the enemy place spikes,
traps and boost pads near you. Your own and your tribe's buildings must never be hit.

1. **Hit range.** Stand still and let the enemy put a spike just outside the white dashed circle. Falcon must **not**
   swing at it. Step closer until the spike's edge touches the white circle: the spike gets a red ring and Falcon
   breaks it (Great Hammer + Tank Gear when you have them, as before).
2. **Detection Range.** Set **Detection Range** to 150. A yellow circle appears. A spike between the white and yellow
   circles gets a yellow ring, but Falcon still doesn't swing at it.
   - Console: `[breaker] seen=spikes ... dist=... reach=...`, with `dist` bigger than `reach`.
3. **Walk To Targets.** Turn it on, let go of all keys, and keep the enemy player more than 300 away. You walk to the
   yellow-ringed spike and break it once it turns red.
   - Press any movement key: you move where you steer, not to the spike.
   - Hold Shift, or let the enemy come within 300: the walking stops.
   - Safe Walk still stops you from walking into a spike.
4. **Closest First.** Turn it on. Put two enemy buildings in reach on opposite sides of you, one closer. Falcon hits
   spikes first; between two non-spikes, the closer one first, then the one with less health.
   - Console: `[breaker] target=... dist=... reach=... health=... reload=...` for each hit.
5. **Trapped.** Walk into an enemy trap with a spike next to it: Auto Break still handles the trap first, as before.

## 3. Aim Assist

Turn on **Combat → Aim Assist**. Keep **Show Markers** on. Defaults: cone 40°, max distance 700, pick Nearest.

1. **Cone only.** Point the mouse away from the enemy (more than half the cone away) and start Tank Spam: you swing
   at the mouse, not at the enemy. Move the mouse towards the enemy: once they are inside the cone they get a yellow
   ring and your swings turn to them. Falcon never turns you to an enemy behind you.
2. **Teammates and dead players.** A teammate in the cone gets no ring and is never aimed at.
3. **Melee vs ranged.**
   - Melee (polearm, katana...): the aim goes to the enemy's centre, standing or moving.
   - Musket, crossbow or bow: a dot shows where the shot is aimed. With a **standing** enemy the dot is on them.
     With a **moving** enemy the dot is ahead of them, in the direction they walk; farther enemies get a bigger lead.
     Check that shots at a walking enemy hit more often than with Aim Assist off.
4. **Lock and switch.** With two enemies in the cone, press **L**: the ring turns red and stays on that enemy while
   they stay in the cone, even if the other is nearer. Press **L** again to let go. Press **J** to switch to the next
   enemy in the cone. If the locked enemy leaves the cone, dies or goes too far, the lock lets go.
5. **Max distance and Pick.** Set Max Distance to 300: enemies farther than 300 get no ring. Try Pick = Lowest Health
   and Closest To Mouse with two enemies in the cone.
6. **Falcon's own ranged shots.** Turn on **Lead Falcon's Ranged Shots** and let a musket insta fire at a walking
   enemy: the shot should be aimed ahead of them. Off = straight at them, as before.
7. **No jitter.** With a target, move the mouse a little inside the cone: the aim stays on the target and doesn't
   flick back to the mouse.
   - Console: `[aim] target=sid N dist=... health=... locked=... candidates=...` (candidates = enemies in the cone).
     With no enemy in the cone it says `target=none`.

## When something is wrong

Write down what you did, what you expected and what happened, and copy the console lines from around that moment.
If it was a death, the packet log (.fpl, see Configs → Development Analytics) helps replay it exactly.
