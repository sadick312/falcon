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

## What was already tested automatically (live, with a test bot)
See the final report in the pull request / chat: heal timing, shame, instas, turret, traps, Safe Walk,
prediction accuracy, hat rendering (all 47 hats + 21 accessories), reconnect, server change, memory.
