# Falcon v1.1.0 — Manual Test Checklist (sandbox.moomodding.io, MooMoo 1.8.2)

How to use: load the Quick Inject build, open the menu with **Esc**, turn on **Utility > Debug Mode**
(the panel on the left shows ping, weapon, hat, which feature is in control, and an error counter).
Tick each line. "Errors" in the Debug panel should stay **0** the whole time.

Tip: many combat/anti tests need a second player. A friend in another browser/PC works best.

## 0. Loading and connection
| ✔ | Feature | What to do | What should happen |
|---|---|---|---|
| ☐ | Quick Inject | Paste `falcon-quickinject.js` into Quick Inject and play | Falcon main menu (FALCON V1.1.0) replaces the normal game |
| ☐ | Server list | Multiplayer | Frankfurt 1 / Miami 1 / Singapore 1 listed |
| ☐ | Join | Pick a server, Join Server, type a name, Join | You spawn at age 10; hotbar, resources, leaderboard visible |
| ☐ | Recent server | Back on the main menu, use the "recent" button next to Multiplayer | Joins the same server again |
| ☐ | Reconnect | Turn Wi-Fi off for ~5 s (or wait for a kick), then press **Reconnect** | Disconnected screen, then Join card again; you can play |
| ☐ | Change Server | On the Disconnected screen press **Change Server** | Server list opens; joining another server works |
| ☐ | Death / respawn | Die, press Join (or turn on Auto Respawn) | "YOU DIED", then Join card; respawn works; no errors |

## 1. Anti features
| ✔ | Feature | What to do | What should happen |
|---|---|---|---|
| ☐ | Auto Heal | Let something hit you (animal, friend, Bull Helmet's -5/s) | You heal back to full; the Shame hat (red clown) never appears |
| ☐ | Shame-free timing | Get hit repeatedly for 30 s | Debug "Heal:" shows `0shame heal in Xms`; shame stays below 8 |
| ☐ | Anti-insta | Friend does Bull Helmet + Polearm then Musket on you | You survive (Soldier Helmet on, heal right after the first hit) |
| ☐ | Anti-insta (Katana) | Friend does Bull + Katana + Bow | You survive |
| ☐ | Anti-turret (EMP) | Stand within ~700 of an enemy turret | You switch to EMP Helmet and keep it; the turret doesn't shoot you |
| ☐ | Anti-trap (Auto Break) | Get caught in an enemy Pit Trap | You break out in ~1–2 s, using Tank Gear |
| ☐ | Anti-spike (Safe Walk) | Walk straight at an enemy spike | You stop just before it; no damage. Hold **Left Shift** to walk anyway |
| ☐ | Anti-bull | Enemy with Bull Helmet + Polearm/Katana close to you | Corrupt X Wings / Spike Gear used as configured |
| ☐ | No false triggers | Stand near an enemy that does nothing for 30 s | No heals, very few hat changes |
| ☐ | Hat priority | During any fight | Hat never flickers between two hats every tick |

## 2. Combat features
| ✔ | Feature | What to do | What should happen |
|---|---|---|---|
| ☐ | Toggle attacking | **Left click** | Starts hitting with Tank Gear; click again stops |
| ☐ | Bull Spam | Hold **Space** near an enemy | Bull Helmet + primary hits while held |
| ☐ | Insta Now (ATOS) | Get Polearm + Musket, stand next to an enemy, press **R** | Crosshair on enemy; Bull + Polearm, Musket, Turret Gear combo |
| ☐ | Dynamic One Tick | Turn on, press **T** (Active), get in range | One-tick combo fires; "Active/Passive" text shows |
| ☐ | Auto insta on trap/spike | Push an enemy toward your spike/trap | Insta fires automatically when the knockback lands them on it |
| ☐ | Spike Tick / Apple Insta / Velocity / Knockback hits | Fight a trapped enemy | Combos fire without errors |
| ☐ | Melee / Projectile Sync | With a Falcon teammate, set the partner id | Both hit on the same tick |
| ☐ | Always Pick Best Weapon | Have Great Hammer + Polearm/Katana | Holds the right weapon; reloads secondary first |
| ☐ | Musket aim | Insta a moving enemy | Musket shot hits (aim leads the target by your ping) |
| ☐ | Dying mid-combo | Die during a combo, respawn | Combo does not continue after respawn |

## 3. Defense / building
| ✔ | Feature | What to do | What should happen |
|---|---|---|---|
| ☐ | Eat | Hold **Q** while hurt | Eats food |
| ☐ | Place trap | Hold **F** | Places your 5th-slot item (trap) where you aim |
| ☐ | Place spike | Hold **V** | Places spikes |
| ☐ | 7th slot | Hold **H** | Places the item chosen in Utility > Auto Upgrade > 7th Slot |
| ☐ | Spawn pads | Hold **K** (needs spawn pad) | Places up to 4 around you |
| ☐ | Auto Mill | Press **Z**, walk | Windmills placed behind you; Z again stops |
| ☐ | Auto Place / Preplace / Replace | Turn on, fight an enemy near your base | Traps/spikes placed around the enemy; broken ones replaced |
| ☐ | Auto Grind | Turn on near your own buildings | Hits them for gold/xp up to the limits |
| ☐ | Item not owned | Hold a key for an item you don't have | Nothing happens, no packets/errors |

## 4. Movement, visuals, menu
| ✔ | Feature | What to do | What should happen |
|---|---|---|---|
| ☐ | Movement | WASD / arrows | Moves instantly (no delay) |
| ☐ | Hats while moving | Walk / stop / enter river / snow | Booster when moving, Flipper in river, Winter Cap in snow |
| ☐ | Auto Gather | Press **E** | Auto-hits like the normal game |
| ☐ | Zoom | Mouse wheel, then **=** | Zooms; = resets |
| ☐ | Hats and accessories | Look at players with many hats | Same look and position as the normal game; Sawblade spins |
| ☐ | Bow arrow | Hold a Hunting Bow | Arrow shown on the bow |
| ☐ | Visual toggles | Turn each Visual toggle on and off | Each draws or hides its overlay; no errors |
| ☐ | Ping display | Look at the top bar | `Ping: X ms (±J) | FPS ...`; hide with Show Ping Display |
| ☐ | Keybinds | Esc > Keybinds, rebind Eat to G | G eats, Q no longer does; red if two actions share a key |
| ☐ | Settings saved | Change toggles, reload, re-inject | Same settings and keybinds |
| ☐ | Chat | **Enter**, type, Enter | Message sent; chat bubble shows |
| ☐ | Clan menu | Clan button: create / join / leave | Works like the normal game |
| ☐ | Auto Upgrade | Turn on, spawn | Cookie / Trap / Greater Spikes / 7th slot picked automatically |

## 4b. Katana, Musket, Axe and other builds
Set Menu > Utility > Auto Upgrade > **Weapon Build** to get the weapons quickly (sandbox spawns at age 10).
| ✔ | Test | What to do | What should happen |
|---|---|---|---|
| ☐ | Katana: equip | Weapon Build = Katana + Great Hammer, spawn | Hotbar shows Katana (slot 1) and Great Hammer; Debug shows `katana (4)` |
| ☐ | Katana: swing | Left click (attack toggle) near a tree | Swings about every 0.3 s; Debug reload goes 0% -> 100% |
| ☐ | Katana: range | Walk slowly toward an enemy/animal while attacking | Hits start at about 118 game units + body size (a bit longer than Short Sword) |
| ☐ | Katana: damage | Hit a friend without hats | 40 per hit (44 gold, 47.2 diamond/ruby); 60 with Bull Helmet |
| ☐ | Katana: combos | Hold Space (bull spam) / press R next to an enemy | Bull Helmet + Katana combos fire; no errors |
| ☐ | Musket: equip | Weapon Build = Polearm + Musket | Hotbar shows Polearm and Musket; Debug shows `musket (15)` when held |
| ☐ | Musket: shoot | Hold the Musket, click | Bullet flies far (range 1400); you get pushed back a little (recoil) |
| ☐ | Musket: reload | Shoot, watch Debug "secondary" reload | Reload takes 1.5 s; Falcon won't plan a shot until it's back to 100% |
| ☐ | Musket: no stone | (non-sandbox servers only) run out of stone | Falcon won't plan Musket shots without 10 stone |
| ☐ | Musket: close hit | Press R next to a standing enemy | Polearm hit then Musket hit (50, or 37.5 through Soldier Helmet) |
| ☐ | Musket: far hit | Enemy standing still ~600-1000 units away, shoot with aim | Bullet reaches and hits |
| ☐ | Musket: moving target | Press R on an enemy running sideways | Musket still hits most of the time (aim leads the target by your ping) |
| ☐ | Can't have both | Try to take Katana and Musket | Impossible in 1.8.2: Katana and Crossbow are both age 8 and the Musket needs the Crossbow |
| ☐ | Build: Short Sword + Musket | Weapon Build = Short Sword + Musket, spawn | Hotbar: Short Sword + Musket (closest legal build to Katana + Musket) |
| ☐ | Build: Hand Axe + Musket | Weapon Build = Hand Axe + Musket, spawn | Hotbar: Hand Axe + Musket |
| ☐ | Build: Polearm + Repeater | Weapon Build = Polearm + Repeater Crossbow, spawn | Hotbar: Polearm + Repeater Crossbow (fast shots, 0.23 s reload) |
| ☐ | Build: Great Axe + Hammer | Weapon Build = Great Axe + Great Hammer, spawn | Hotbar: Great Axe + Great Hammer |
| ☐ | Build: Great Axe + Bow | Weapon Build = Great Axe + Hunting Bow, spawn | Hotbar: Great Axe + Hunting Bow |
| ☐ | Great Axe combat | Great Axe build, enemy trapped next to spikes / Bull Helmet enemy near you | Spike tick and anti-bull work like with Short Sword (Great Axe counts as an attack weapon) |

## 4c. Enemies using Katana / Musket
| ✔ | Test | What to do | What should happen |
|---|---|---|---|
| ☐ | Detect Katana | Friend equips Katana near you | Debug (`falconDebug.weaponData(id)` in console) shows primary 4 |
| ☐ | Detect Musket | Friend shoots a Musket | Shown as secondary 15 right after the shot; reload tracked 0 -> 100% over 1.5 s |
| ☐ | Katana guess | Friend with Katana never shows a secondary | Falcon assumes a Hunting Bow, not a Musket (fewer needless reactions) |
| ☐ | Anti vs Katana insta | Friend: Bull + Katana, then Bow | You survive (Soldier + heal) |
| ☐ | Anti vs Musket insta | Friend: Bull + Polearm, then Musket | You survive |
| ☐ | Samurai Armor | Friend wears Samurai Armor (faster reload) | Falcon still predicts their next hit correctly (reload x0.78) |

## 4d. Every hat and accessory
Turn **Classic Hats** on (Visual tab). Look at a player (or yourself) wearing each item, standing, moving and attacking.
Nothing should be stretched, blurry, offset or missing. Turning Classic Hats off should only stop the spinning parts.

| ✔ | Id | Hat | Looks correct when |
|---|---|---|---|
| ☐ | 45 | Shame! | Centred on the head, faces where the player aims |
| ☐ | 51 | Moo Cap | Centred on the head, faces where the player aims |
| ☐ | 50 | Apple Cap | Centred on the head, faces where the player aims |
| ☐ | 28 | Moo Head | Centred on the head, faces where the player aims |
| ☐ | 29 | Pig Head | Centred on the head, faces where the player aims |
| ☐ | 30 | Fluff Head | Centred on the head, faces where the player aims |
| ☐ | 36 | Pandou Head | Centred on the head, faces where the player aims |
| ☐ | 37 | Bear Head | Centred on the head, faces where the player aims |
| ☐ | 38 | Monkey Head | Centred on the head, faces where the player aims |
| ☐ | 44 | Polar Head | Centred on the head, faces where the player aims |
| ☐ | 35 | Fez Hat | Centred on the head, faces where the player aims |
| ☐ | 42 | Enigma Hat | Centred on the head, faces where the player aims |
| ☐ | 43 | Blitz Hat | Centred on the head, faces where the player aims |
| ☐ | 49 | Bob XIII Hat | Centred on the head, faces where the player aims |
| ☐ | 59 | Megalodon Hat | Centred on the head, faces where the player aims |
| ☐ | 57 | Pumpkin | Centred on the head, faces where the player aims |
| ☐ | 8 | Bummle Hat | Centred on the head, faces where the player aims |
| ☐ | 2 | Straw Hat | Centred on the head, faces where the player aims |
| ☐ | 15 | Winter Cap | Centred on the head, faces where the player aims |
| ☐ | 5 | Cowboy Hat | Centred on the head, faces where the player aims |
| ☐ | 4 | Ranger Hat | Centred on the head, faces where the player aims |
| ☐ | 18 | Explorer Hat | Centred on the head, faces where the player aims |
| ☐ | 31 | Flipper Hat | Centred on the head, faces where the player aims |
| ☐ | 1 | Marksman Cap | Centred on the head, faces where the player aims |
| ☐ | 10 | Bush Gear | Centred on the head, faces where the player aims |
| ☐ | 48 | Halo | Centred on the head, faces where the player aims |
| ☐ | 6 | Soldier Helmet | Centred on the head, faces where the player aims |
| ☐ | 23 | Anti Venom Gear | Centred on the head, faces where the player aims |
| ☐ | 13 | Medic Gear | Centred on the head, faces where the player aims |
| ☐ | 9 | Miners Helmet | Centred on the head, faces where the player aims |
| ☐ | 32 | Musketeer Hat | Centred on the head, faces where the player aims |
| ☐ | 7 | Bull Helmet | Centred on the head, faces where the player aims |
| ☐ | 22 | Emp Helmet | Centred on the head, faces where the player aims |
| ☐ | 12 | Booster Hat | Centred on the head, faces where the player aims |
| ☐ | 26 | Barbarian Armor | Centred on the head, faces where the player aims |
| ☐ | 21 | Plague Mask | Centred on the head, faces where the player aims |
| ☐ | 46 | Bull Mask | Centred on the head, faces where the player aims |
| ☐ | 14 | Windmill Hat | Top part spins (stops with Classic Hats off) |
| ☐ | 11 | Spike Gear | Top part spins (stops with Classic Hats off) |
| ☐ | 53 | Turret Gear | Top part spins (stops with Classic Hats off) |
| ☐ | 20 | Samurai Armor | Centred on the head, faces where the player aims |
| ☐ | 58 | Dark Knight | Centred on the head, faces where the player aims |
| ☐ | 27 | Scavenger Gear | Centred on the head, faces where the player aims |
| ☐ | 40 | Tank Gear | Centred on the head, faces where the player aims |
| ☐ | 52 | Thief Gear | Centred on the head, faces where the player aims |
| ☐ | 55 | Bloodthirster | Centred on the head, faces where the player aims |
| ☐ | 56 | Assassin Gear | Wearer is invisible to others (correct) |

| ✔ | Id | Accessory | Looks correct when |
|---|---|---|---|
| ☐ | 12 | Snowball | Behind the player, follows rotation |
| ☐ | 9 | Tree Cape | Behind the player, follows rotation |
| ☐ | 10 | Stone Cape | Behind the player, follows rotation |
| ☐ | 3 | Cookie Cape | Behind the player, follows rotation |
| ☐ | 8 | Cow Cape | Behind the player, follows rotation |
| ☐ | 11 | Monkey Tail | Behind the player, follows rotation |
| ☐ | 17 | Apple Basket | Behind the player, follows rotation |
| ☐ | 6 | Winter Cape | Behind the player, follows rotation |
| ☐ | 4 | Skull Cape | Behind the player, follows rotation |
| ☐ | 5 | Dash Cape | Behind the player, follows rotation |
| ☐ | 2 | Dragon Cape | Behind the player, follows rotation |
| ☐ | 1 | Super Cape | Behind the player, follows rotation |
| ☐ | 7 | Troll Cape | Behind the player, follows rotation |
| ☐ | 14 | Thorns | Behind the player, follows rotation |
| ☐ | 15 | Blockades | Behind the player, follows rotation |
| ☐ | 20 | Devils Tail | Behind the player, follows rotation |
| ☐ | 16 | Sawblade | Behind the player and spins (stops with Classic Hats off) |
| ☐ | 13 | Angel Wings | Behind the player, follows rotation |
| ☐ | 19 | Shadow Wings | Behind the player, follows rotation |
| ☐ | 18 | Blood Wings | Behind the player, follows rotation |
| ☐ | 21 | Corrupt X Wings | Behind the player, follows rotation |

## 5. Ping tests (repeat sections 1–3 at each level)
Use **Utility > Packet Management > Artificial Ping** to add delay on a fast connection.
| ✔ | Level | Setting | Check |
|---|---|---|---|
| ☐ | Low (<50–100 ms) | Artificial Ping off, Frankfurt | Debug shows your real ping; antis, combos, Safe Walk work |
| ☐ | Medium (~150–200 ms) | Artificial Ping +100, or play on Miami | Same, no deaths to normal instas, no shame |
| ☐ | High (~300 ms+) | Artificial Ping +200 to +300 | Same; heals happen right after hits; EMP still blocks turrets |
| ☐ | Adjust | Ping Compensation > Adjust +50 / -50 | Feels earlier/later; 0 is the default |
| ☐ | Compensation off | Turn Ping Compensation off | Everything still works (old one-tick timing) |

## 6. Stress tests
| ✔ | Test | What to do | What should happen |
|---|---|---|---|
| ☐ | Long session | Play 30+ minutes | FPS steady, no slowdown, Debug errors 0 |
| ☐ | Crowds | Play near many players | FPS steady, names readable |
| ☐ | Die repeatedly | Turn on Auto Respawn, die 10 times | Every respawn works, no stuck screen, errors 0 |
| ☐ | Rapid switching | Mash 1/2/3, click, Space for 20 s | No errors; final weapon matches what you selected |
| ☐ | Lag spikes | Pause your connection 1–2 s a few times in a fight | No double heals/combos; "LAG SPIKE" shows briefly; play continues |

## 7. Upgrades and on-screen messages
| ✔ | Test | What to do | What should happen |
|---|---|---|---|
| ☐ | Next build hotkey | Press B a few times | A message at the top shows each build name; Menu > Utility > Auto Upgrade > Weapon Build shows the last one after reopening the menu |
| ☐ | Build note | Press B with "Choose Every Age Yourself" on | The message ends with "(Choose Every Age Yourself is on)" |
| ☐ | Upgrade works | Click an upgrade in the bar | You get it; no red message |
| ☐ | Upgrade failed | (Hard to cause by hand) If an upgrade doesn't arrive | Red "Upgrade failed: ... - click it again" after ~1.5 s; clicking it again works |
| ☐ | Bad packet | Turn on Artificial Ping, play 1 minute | Game keeps moving; no frozen players |

## What was already tested automatically (live, with a test bot)
See the final report in the pull request / chat: heal timing, shame, instas, turret, traps, Safe Walk,
prediction accuracy, hat rendering (all 47 hats + 21 accessories), reconnect, server change, memory.
