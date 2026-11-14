# Upgrades: how they work (research for "Classic upgrades (1.6.9 style)")

Step 1 of the "Classic upgrades" task. This file is research only: no code was changed.

Words used here:
- **Primary** = the weapon in slot 1 (axes, swords, polearm, ...). **Secondary** = slot 2 (bows, shield, hammer, musket, ...).
- **Pre-requisite ("pre")** = the weapon you must already own before the game offers this one.
- **Verified** = I checked it in a real file (named next to it). **Unverified** = not checked; please don't rely on it yet.

## 1. Short answer

- You can hold **one primary and one secondary** at a time. So "Katana + Musket" fits in your hands.
- The normal menu never offers it: Katana and Crossbow are **both age 8**, you get **one pick at age 8**, and the Musket (age 9) needs the Crossbow.
- An earlier Falcon session tested the sandbox server on 2026-11-13 and reported: the **server checks the age but not the pre-requisite**. If that is still true, Katana + Musket is possible by simply sending "Katana" at age 8 and "Musket" at age 9. **Step 2 must test this again** (see section 6).
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

**What the server checks** (from the 2026-11-13 live probes, see section 6; unverified until Step 2 repeats them): it refuses a weapon whose age is higher than your current upgrade age (a Musket sent at age 8 was ignored), but it does **not** check the pre-requisite.

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

What may make this matter less: if the server really ignores pre-requisites (section 6), the "1.6.9 feel" can be built from the 1.8.2 table alone: at age 8 take any age 8 weapon, at age 9 take any age 9 weapon.

## 6. Earlier work found (important for Step 2)

The fork branch **`fork/old-age-upgrades`** (not merged into `review/stability`) already has a first version of this idea:
- `c9cbe90` `oldStyleCombos()` in `mod-source/src/core/events/weaponBuilds.ts`: buttons "Katana + Musket", "Katana + Repeater Crossbow", "Great Axe + Musket", "Great Axe + Repeater Crossbow", and "<your primary> + Musket / Repeater" (crossbow at 8).
- `1df6365` "Combo Buttons at Age 8" under the upgrade bar; `5f20ed8` test checklist section 14.
- Its commit message records **live probes on sandbox (2026-11-13)**: Katana given after Polearm, Great Axe after Short Sword, Musket and Repeater given without a Crossbow; Musket sent at age 8 ignored.

Those probes are written evidence from an earlier session, not something I re-ran. That branch is built on a different line of work (`weaponBuilds.ts` does not exist on `review/stability`), so it can't simply be merged. Step 2 will re-test on the server and read the `V` (items) reply packets, not just the screen.

## 7. Possible combos (if section 6 is still true)

| Age 8 pick | Age 9 pick | Result in hands | Normal 1.8.2 menu offers it? |
|---|---|---|---|
| katana | musket | katana + musket | no |
| katana | repeater crossbow | katana + repeater | no |
| great axe | musket | great axe + musket | no |
| great axe | repeater crossbow | great axe + repeater | no |
| crossbow | musket | (your age 2 primary) + musket | yes (needs hunting bow) |
| crossbow | repeater crossbow | (your age 2 primary) + repeater | yes (needs hunting bow) |

Open question for Step 2: does taking a katana at age 8 without a short sword also work (the earlier probe says yes: "Katana after Polearm").

## 8. Questions for you

1. Do you have the 1.6.9 game file? If not, is it OK to build "1.6.9 style" as "any age 8 weapon + any age 9 weapon", based only on what the server accepts?
2. Step 2 needs a live test on sandbox (close other game tabs first: the server allows few connections per IP). OK to start Step 2?
3. Should Step 3 reuse ideas from `fork/old-age-upgrades` (combo buttons), or start fresh as one data table + planner as planned?
