# Upgrades: how they work (research for "Classic upgrades (1.6.9 style)")

Step 1 of the "Classic upgrades" task. This file is research only: no code was changed.

Words used here:
- **Primary** = the weapon in slot 1 (axes, swords, polearm, ...). **Secondary** = slot 2 (bows, shield, hammer, musket, ...).
- **Pre-requisite ("pre")** = the weapon you must already own before the game offers this one.
- **Verified** = I checked it in a real file (named next to it). **Unverified** = not checked; please don't rely on it yet.

## 1. Short answer

- You can hold **one primary and one secondary** at a time. So "Katana + Musket" fits in your hands.
- The normal menu never offers it: Katana and Crossbow are **both age 8**, you get **one pick at age 8**, and the Musket (age 9) needs the Crossbow.
- **Tested on the sandbox server on 2026-11-14 (section 9):** the server checks that the weapon's age is **exactly** your current upgrade age, but it does **not** check the pre-requisite. So Katana + Musket works: send "Katana" at age 8 and "Musket" at age 9. The server's own reply packets (`V`) confirmed it.
- I could **not** find any v1.6.9 code (section 5). I need the 1.6.9 game file from you to describe 1.6.9 exactly.

## 2. Where Falcon handles age-ups (verified, branch `review/stability`, commit 814870f)

| What | Where |
|---|---|
| Server says "you have N points, next pick is for age A" | `mod-source/src/core/socket/SocketListener.ts:197` calls `updateUpgrades(points, age)` |
| Build the upgrade bar (which icons appear) | `mod-source/src/core/events/updateUpgrades.ts:60` (`updateUpgrades`) |
| A weapon appears only if `wpn.age === age` and you own its `pre` (or on a localhost private server) | `updateUpgrades.ts:71-73` |
| Same for buildings (`item.pre`) | `updateUpgrades.ts:86-88` |
| Auto Upgrade's choice (only option, then cookie / pit trap / greater spikes / 7th Slot, then the "Age 2/6/8/9 Pick" menu value, then "Spend Every Point") | `updateUpgrades.ts:36` (`chooseAutoUpgrade`, `AutoUpgradeChoice`, `MANUAL_PICK = -1`) |
| Clicking an icon sends the pick | `updateUpgrades.ts:129-134` |
| The menu settings ("Auto Upgrade", "Age 8 Pick", "Age 9 Pick", "Spend Every Point", "Manual Pick Wait") | `mod-source/src/core/menu/content/utility.ts:69-135` |
| Before sending: the same id is never sent twice (`Client.upgradesObtained`), and the held weapon index is updated | `mod-source/src/core/utils/PacketManager.ts:250-262` |
| `upgradesObtained` is cleared at age 2, on spawn, on death and on a new session | `updateUpgrades.ts:63`, `SocketListener.ts:268, 320, 466`, `GameSession.ts:59` |
| Server sends your weapons/items list | `SocketListener.ts:494` calls `updateItems(data, wpn)` (`mod-source/src/core/events/updateItems.ts`) |
| Your own weapons are read as `[primary, secondary]` from that list | `mod-source/src/core/logic/players/core/PlayerCombatManager.ts:87-100` |
| Weapon / item data (id, type, age, pre, ...) | `mod-source/src/utils/constants/items.ts:235-515` (weapons), `:520-` (items) |

The Auto Upgrade feature from commit ce5dd6b added the "Age 2 / 6 / 8 / 9 Pick" settings and "Spend Every Point". All default to the old behaviour (Manual / off).

## 3. How upgrades work in v1.8.2 (verified unless marked)

**Packets** (`mod-source/src/utils/socket/PacketMap.ts`):

| Direction | Name in Falcon | Code | Contents |
|---|---|---|---|
| Server → you | `UPDATE_UPGRADES` | `"U"` | `points, age` — how many picks you have, and which age the next pick is for |
| You → server | `SEND_UPGRADE` | `"H"` | `[id]` — one number |
| Server → you | `UPDATE_ITEMS` | `"V"` | `data, isWeapon` — your full weapon list (`[primary, secondary]`) or item list after a change |

**The upgrade id** is one number for weapons and buildings together:
- weapon → its weapon id (0-15)
- building → 16 + item id (for example power mill = 16 + 12 = 28)

**How a pick goes:**
1. Server sends `U` with `points > 0` and `age`.
2. The client shows every weapon/item with `age == that age` whose pre-requisite you own.
3. You click; the client sends `H [id]`.
4. If the server accepts, it sends `V` (new weapon or item list) and a new `U` (points left, next age).

**What the server checks** (verified live 2026-11-14, section 9): the weapon's age must be **exactly** your current upgrade age. Too early (Musket at 8) or too late (Katana at 9, Great Axe at 10, Musket at 10) is silently ignored: no reply, the point stays. The pre-requisite is **not** checked.

**The live sandbox client** (`https://sandbox.moomodding.io/assets/bundle.js`, downloaded 2026-11-14) has the same upgrade-bar logic as Falcon (age + pre filter, `id = weapons.length + item index` for buildings, `pre = id - pre` for items). Its weapon and item data come from the npm package `moomodding` (v1.1.1, `dist/moo.umd.js`); I compared it with Falcon's `items.ts` and every weapon id, type, age and pre matches, and every age 7-9 item matches. The server's own upgrade check is **not** in that file, so it can only be learned by testing.

**Which choices appear at ages 7, 8, 9 (normal 1.8.2 menu):**

| Age | Weapons offered (only if you own the pre) | Buildings offered |
|---|---|---|
| 7 | none | cheese, castle wall (needs stone wall), turret, platform, healing pad, blocker, teleporter |
| 8 | great axe (needs hand axe), katana (needs short sword), crossbow (needs hunting bow) | power mill (needs faster windmill) |
| 9 | repeater crossbow (needs crossbow), musket (needs crossbow) | poison spikes, spinning spikes (need greater spikes), spawn pad |

So in 1.8.2: you take **one** of great axe / katana / crossbow at age 8. Only the crossbow path can get a musket or repeater at age 9.

Note: on sandbox, "you get 9 upgrade points" when you join (written in the earlier session's test checklist). I have not checked this myself: **unverified**.

## 4. Weapon table (all values verified against Falcon `items.ts` **and** moomodding npm v1.1.1, 2026-11-14)

| ID | Weapon | Type | Unlock age | Pre-requisite (upgrades from) |
|---|---|---|---|---|
| 0 | tool hammer | primary | start | none |
| 1 | hand axe | primary | 2 | none |
| 2 | great axe | primary | 8 | 1 hand axe |
| 3 | short sword | primary | 2 | none |
| 4 | katana | primary | 8 | 3 short sword |
| 5 | polearm | primary | 2 | none |
| 6 | bat | primary | 2 | none |
| 7 | daggers | primary | 2 | none |
| 8 | stick | primary | 2 | none |
| 9 | hunting bow | secondary | 6 | none |
| 10 | great hammer | secondary | 6 | none |
| 11 | wooden shield | secondary | 6 | none |
| 12 | crossbow | secondary | 8 | 9 hunting bow |
| 13 | repeater crossbow | secondary | 9 | 12 crossbow |
| 14 | mc grabby | secondary | 6 | none |
| 15 | musket | secondary | 9 | 12 crossbow |

These are the **1.8.2** values. The **1.6.9** values are **unverified** (section 5).

## 5. How v1.6.9 handled ages 8 and 9: NOT verified

What I searched:
- Upstream `origin` (duckybyte/falcon), `origin/main`: 13 commits. "1.6.9" appears only inside SVG icon numbers in `Menu.ts`, nothing about upgrades.
- All branches' commit messages for "1.6.9": nothing.
- The live sandbox bundle: it is the moomodding client with 1.8.2 data, not 1.6.9.

So I **cannot** say from a real source which weapons 1.6.9 offered at ages 8 and 9, or which combos it allowed. I did not write a 1.6.9 tree from memory, as asked.

**I need from you:** the 1.6.9 game file (the main `.js` bundle) if you have it, or a link to it. With it I can fill in the 1.6.9 column.

What makes this matter less: the server ignores pre-requisites (verified, section 9), so the "1.6.9 feel" can be built from the 1.8.2 table alone: at age 8 take any age 8 weapon, at age 9 take any age 9 weapon.

## 6. Earlier work found (important for Step 2)

The fork branch **`fork/old-age-upgrades`** (not merged into `review/stability`) already has a first version of this idea:
- `c9cbe90` `oldStyleCombos()` in `mod-source/src/core/events/weaponBuilds.ts`: buttons "Katana + Musket", "Katana + Repeater Crossbow", "Great Axe + Musket", "Great Axe + Repeater Crossbow", and "<your primary> + Musket / Repeater" (crossbow at 8).
- `1df6365` "Combo Buttons at Age 8" under the upgrade bar; `5f20ed8` test checklist section 14.
- Its commit message records **live probes on sandbox (2026-11-13)**: Katana given after Polearm, Great Axe after Short Sword, Musket and Repeater given without a Crossbow; Musket sent at age 8 ignored.

Step 2 re-ran these tests on 2026-11-14 (section 9), and they still hold. That branch is built on a different line of work (`weaponBuilds.ts` does not exist on `review/stability`), so it can't simply be merged.

## 7. Possible combos (server-tested 2026-11-14, see section 9)

| Age 8 pick | Age 9 pick | Result in hands | Normal 1.8.2 menu offers it? | Server |
|---|---|---|---|---|
| katana | musket | katana + musket | no | **works** (test A) |
| katana | repeater crossbow | katana + repeater | no | **works** (test D) |
| great axe | musket | great axe + musket | no | **works** (test C) |
| great axe | repeater crossbow | great axe + repeater | no | not tested; expected to work (same rules: great axe at 8 and repeater at 9 were each accepted) |
| crossbow | musket | (your age 2 primary) + musket | only with a hunting bow | crossbow without a bow **works** (test B); musket after it is the normal path |
| crossbow | repeater crossbow | (your age 2 primary) + repeater | only with a hunting bow | **works** without a bow (test B) |

What does **not** work: a weapon sent at the wrong age (Musket at 8, Katana at 9, Great Axe or Musket at 10). So you can never get **two** age 8 weapons, or **two** age 9 weapons; the server gives exactly one weapon pick at age 8 and one at age 9.

## 8. Questions for you

1. Do you have the 1.6.9 game file? If not, is it OK to build "1.6.9 style" as "any age 8 weapon + any age 9 weapon", based only on what the server accepts?
2. Should Step 3 reuse ideas from `fork/old-age-upgrades` (combo buttons), or start fresh as one data table + planner as planned?

## 9. Step 2: server test (2026-11-14, sandbox.moomodding.io, server `wss://s1.moomodding.io/`)

**How:** a plain browser tab (Playwright, no Falcon) with a small hook on the page's WebSocket. It sent `H [id]` itself and logged every `U` and `V` packet the server sent back. Each test was a new life. On join the server sent `U [10, 2]` (10 points, next pick for age 2), so ages 2 to 9 can be picked at once without playing.

How to read the logs: `OUT H [id]` = we asked for upgrade `id`. `IN V [[a, b], 1]` = the server says your weapons are now primary `a`, secondary `b`. `IN U [points, age]` = points left and the next age. No `V`/`U` after an `OUT` = the server ignored it. Building ids (17 cookie, 31 pit trap, 23 greater spikes, 33 turret) were used for ages 3, 4, 5 and 7. The item-list `V [..., 0]` lines are left out below.

**Test A** — Polearm, Great Hammer (no bow), then off-menu picks:
```
OUT H [5]   -> V [[5],1]      U [9,3]     polearm at 2
OUT H [10]  -> V [[5,10],1]   U [5,7]     great hammer at 6
OUT H [15]  -> (nothing)                  musket at 8: ignored (too early)
OUT H [4]   -> V [[4,10],1]   U [3,9]     katana at 8, no short sword: ACCEPTED
OUT H [15]  -> V [[4,15],1]   U [2,10]    musket at 9, no crossbow: ACCEPTED -> katana + musket
OUT H [2]   -> (nothing)                  great axe at 10: ignored (too late)
```
**Test B** — Short Sword, Great Hammer (no bow):
```
OUT H [12]  -> V [[3,12],1]   U [3,9]     crossbow at 8, no hunting bow: ACCEPTED
OUT H [4]   -> (nothing)                  katana at 9: ignored (age 8 weapon, too late)
OUT H [13]  -> V [[3,13],1]   U [2,10]    repeater at 9: ACCEPTED
OUT H [15]  -> (nothing)                  musket at 10: ignored
```
**Test C** — Bat, Wooden Shield:
```
OUT H [2]   -> V [[2,11],1]   U [3,9]     great axe at 8, no hand axe: ACCEPTED
OUT H [15]  -> V [[2,15],1]   U [2,10]    musket at 9, no crossbow: ACCEPTED -> great axe + musket
```
**Test D** — Daggers, McGrabby:
```
OUT H [4]   -> V [[4,14],1]   U [3,9]     katana at 8: ACCEPTED
OUT H [13]  -> V [[4,13],1]   U [2,10]    repeater at 9, no crossbow: ACCEPTED -> katana + repeater
```

**Rules learned (verified):**
1. The weapon's `age` must equal the current upgrade age (`U`'s second number). Otherwise the server ignores it: no reply, the point stays.
2. The pre-requisite (`pre`) is never checked by the server.
3. After an accepted pick the server sends `V` (items), then `V` (weapons), then `U`. A new primary replaces the old one, and a new secondary replaces the old one.
4. One weapon per age: since 8 and 9 each give one pick, a build has exactly one age 8 pick and one age 9 pick.

**What this means for Step 3:** the planner only needs "at age A, send the weapon whose `age == A`". A combo = (age 8 weapon, age 9 weapon). Falcon's own `updateUpgrades.ts:71` hides off-menu weapons (it checks `pre`), so the Classic toggle must add them to the bar.

Not tested: great axe + repeater (expected to work), and whether this also holds on servers other than sandbox (Falcon is only used on sandbox). The test used `s1` only.
