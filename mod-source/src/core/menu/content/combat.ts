// Settings in the combat tab. Plain data: Menu.ts builds the UI from it.
import { IMenuItem } from "../types";
import { BUILDING_ICON, SHAME_HAT_ICON, SPEAR_ICON, SPIEK_ICON, SWORD_ICON, WALKING_ICON } from "../icons";

export const combatSettings: IMenuItem[] = [{
    label: "",
    id: "",
    description: `This module offers multiple toggles to customize the combat modules in the script. Click the settings button to adjust sub-settings for each module.`,
    type: "paragraph"
}, {
    label: "Combat Modules",
    id: "",
    type: "group",
    description: "General purpose combat modules grouped up to clean up the menu interface.",
    icon: SWORD_ICON,
    settings: [{
        label: "Velocity Hits",
        id: "velocityHits",
        description: "Automatically strikes enemies if they will run into spikes.",
        type: "toggle",
        status: true
    }, {
        label: "Knockback Hits",
        id: "attackFactoringKB:hits",
        description: "Automatically strikes enemies factoring knocking potential.",
        type: "toggle",
        status: true
    }, {
        label: "Accurate Enemy Shame",
        id: "accurateEnemyShame",
        description: "Counts an enemy's heal toward their shame only when it looks like food (20+ health, or 16+ to full health). Off: every heal counts, including healing pads and regen hats/accessories, which push the count wrong. Shame Grinder, Shame Strike, One Tick and Apple Insta read this count.",
        type: "toggle",
        status: true
    }, {
        label: "Trust Seen Weapons",
        id: "trustSeenWeapons",
        description: "Keeps an enemy's hunting bow or crossbow (and its reload) once seen, instead of assuming a loaded musket whenever they hold their primary. Guesses a katana, not a polearm, for a short sword. Off: the old worst-case guesses.",
        type: "toggle",
        status: false
    }, {
        label: "Knockback Instakills",
        id: "attackFactoringKB:insta",
        description: "Automatically instakills enemies factoring knocking potential.",
        type: "toggle",
        settings: [{
            label: "Allow While Trapped",
            id: "attackFactoringKB:insta:allowInTrap",
            description: "Lets these instakills run while you are trapped, as long as Auto Breaker has no spikes to break around you.",
            type: "toggle",
            status: false
        }, {
            label: "Insta Uses Enemy Health",
            id: "instaUsesEnemyHealth",
            description: "Also runs the insta when its two hits together (soldier helmet assumed for the second) reach the enemy's current health. Off: only when spikes, a pit trap or 100+ damage in one tick finish them, so a hurt enemy is often left alone. An enemy who heals between the two hits survives.",
            type: "toggle",
            status: false
        }],
        status: true
    }, {
        label: "Musket Insta",
        id: "musketInsta",
        description: "With polearm + musket: bull helmet + polearm, then turret gear + musket, when the damage kills the nearest enemy at its current health (assuming soldier helmet for the second hit).",
        type: "toggle",
        settings: [{
            label: "Katana + musket",
            id: "musketInsta:katana",
            description: "Also runs the combo with katana + musket, using the katana's damage (40) and shorter reach (118).",
            type: "toggle",
            status: true
        }],
        status: false
    }, {
        label: "EMP-Aware Instas",
        id: "empAwareInstas",
        description: "Musket Insta and Knockback Instakills leave out the turret bullet when the enemy wears an EMP Helmet (it blocks turret damage), so they don't fire an insta that can't kill. Off: the turret's 25 is always counted.",
        type: "toggle",
        status: false
    }, {
        label: "Auto Push Strikes",
        id: "attackInPush",
        description: "Automatically attacks enemies during auto pushing once collision is made with a spike.",
        type: "toggle",
        settings: [{
            label: "Dagger Shame Strike Threshold",
            id: "daggerShameStrikeThres",
            description: "Shame Strike waits until the enemy's shame count reaches this number.",
            type: "slider",
            min: 2,
            max: 7,
            step: 1,
            status: 4
        }, {
            label: "Dagger Attack Method",
            id: "attackInPush:dagger_method",
            description: `
                Determines what method to use to attack enemies when our primary weapon is daggers.
                Shame Strike method makes the mod wait for enemies to gain a high shameCount before attacking with turret.
                Bullspam method makes the mod do constant brute force attacking.
                Disabled makes the mod do nothing.
                `,
            type: "select",
            options: [{
                label: "Shame Strike",
                value: 0
            }, {
                label: "Bullspam",
                value: 1
            }, {
                label: "Disabled",
                value: 2
            }],
            status: 0
        }, {
            label: "High Damage Attack Method",
            id: "attackInPush:polearm_katana_method",
            description: `
                Determines what method to use to attack enemies when our primary weapon is either polearm or katana.
                Predictive method makes mod try to sync the attacks with enemies' tank gear equip.
                Bullspam method makes the mod do constant brute force bullspamming.
                Disabled makes the mod do nothing.
                `,
            type: "select",
            options: [{
                label: "Predictive",
                value: 0
            }, {
                label: "Bullspam",
                value: 1
            }, {
                label: "Disabled",
                value: 2
            }],
            status: 0
        }, {
            label: "Generic Attack Method",
            id: "attackInPush:generic_method",
            description: `
                Determines what method to use to attack enemies for any other primary weapon.
                Bullspam method makes the mod do constant brute force bullspamming.
                Disabled makes the mod do nothing.
                `,
            type: "select",
            options: [{
                label: "Bullspam",
                value: 0
            }, {
                label: "Disabled",
                value: 1
            }],
            status: 0
        }, {
            label: "Turret Bullet Assist",
            id: "turretBulletAssistOnAP",
            description: "Uses turret gear to attack pit-spiked enemies if other attack methods are unavailable.",
            type: "toggle",
            status: true
        }],
        status: true
    }, {
        id: "objectBreaker:pit_spike",
        label: "Pit-Spike Breaker",
        description: "Automatically breaks objects near traps to accelerate pit-spiking. If you used Chicken V3, you'll have a more clear idea of what this does. Requires Object Breaker to be enabled for this to work.",
        type: "toggle",
        status: false
    }, {
        label: "Projectile Sync",
        id: "projectileSync",
        description: "Automatically attacks enemies the moment it can onetick with any projectile.",
        type: "toggle",
        status: true
    }, {
        label: "Turret Gear Knockback",
        id: "turretGearKB",
        description: "Automatically uses turret gear's knockback to kill enemies if possible.",
        type: "toggle",
        status: true
    }, {
        label: "Barbarian Knockback",
        id: "barbKnockback",
        description: "Automatically uses barbarian armor if the knockback kills the enemy.",
        type: "toggle",
        status: true
    }, {
        label: "Sync Hits Use Enemy Health",
        id: "syncHitsUseHealth",
        description: "Velocity Hits and Projectile Sync decide \"does it kill\" with the enemy's current health and their hat (Soldier Helmet takes 0.75 of the damage). So they also hit a hurt enemy, and skip a bull hit a Soldier Helmet would survive. An enemy who heals in the same tick first can still survive. Off: the classic check (100 damage or more).",
        type: "toggle",
        status: false
    }]
}, {
    label: "Spike Oneshots",
    id: "",
    description: "Modules that customize oneshots using spikes",
    icon: SPIEK_ICON,
    type: "group",
    settings: [{
        label: "Shame Grind",
        id: "shameGrind",
        description: "While the enemy is trapped, fakes Apple Insta with bull hits so they eat too fast and gain shame. Lets Apple Insta finish once they're shamed (can't heal) or stop eating right after hits, or after 12 fakes. Needs a great hammer, Apple Insta, Auto Place and Preplacements.",
        type: "toggle",
        icon: SHAME_HAT_ICON,
        status: false
    }, {
        label: "Apple Insta",
        id: "appleInsta",
        description: "Automatically breaks enemy traps and spike one shots them. Requires preplacements module to be turned on.",
        icon: SPIEK_ICON,
        type: "toggle",
        settings: [{
            label: "Allow While Trapped",
            id: "appleInstaWhileTrapped",
            description: "Triggers even when trapped.",
            type: "toggle",
            status: true
        }, {
            label: "Allow Low Damage Primaries",
            id: "appleAllowsLowDamagePri",
            description: "Triggers even for daggers, bat, etc.",
            type: "toggle",
            status: true
        }],
        status: true
    }, {
        label: "Spike Tick",
        id: "spikeTick",
        description: "Automatically spike instakills enemies when trap breaks.",
        icon: SPIEK_ICON,
        type: "toggle",
        status: true
    }]
}, {
    label: "Auto Place",
    id: "autoPlacing",
    description: "Automatically places buildings quickly and efficiently.",
    icon: BUILDING_ICON,
    type: "toggle",
    status: false,
    settings: [{
        label: "Range",
        id: "autoPlaceRange",
        description: "How close the nearest enemy must be before Auto Place starts placing traps.",
        type: "slider",
        min: 100,
        max: 1200,
        status: 400,
        step: 10
    }, {
        label: "Angle Finder Level",
        id: "angleFinderLevel",
        description: "Determines the levels of budget the angle finder has. The higher it is, the more accurate angles become. This toggle also affects defensive modules.",
        type: "slider",
        min: 1,
        max: 10,
        status: 7,
        step: 1
    }, {
        label: "Two Tick Placements",
        description: "Automatic placements occur every two game ticks instead of one. Reduces packet usage, makes placement less 'spammy', but reduces overall placement effectiveness.",
        id: "twoTickPlacements",
        type: "toggle",
        status: false
    }, {
        label: "Preplacements",
        description: "Preemptively places buildings in places where buildings are about to break.",
        id: "preplacer",
        type: "toggle",
        status: true
    }, {
        label: "Replacements",
        description: "Places buildings once it receives a killObject packet from the game server.",
        id: "replacer",
        type: "toggle",
        status: true
    }]
}, {
    label: "Melee Sync",
    id: "meleeSync",
    description: "Automatically melee syncs with allies on targets with primary weapon. For this to work correctly, the person you want to sync with must choose to sync with you as well. Which means that this toggle will generally NOT work with non-falcon users.",
    icon: SPEAR_ICON,
    type: "toggle",
    settings: [{
        label: "Sync With",
        id: "meleeSyncTarget",
        description: "Select ANY player to sync with via their in-game SID. To sync with no one, set the value to -1.",
        type: "number",
        min: -1,
        max: 50,
        step: 1,
        neverSave: true,
        status: -1
    }],
    status: false
}, {
    label: "Aim Assist",
    id: "aimAssist",
    description: "When you hit by hand (mouse click tank spam, or E auto-gather with \"Aim With Mouse While Gathering\"), turns your swing to an enemy inside a cone around your mouse. Never outside the cone (at most 60° wide), never teammates or dead players. Melee aims at the enemy's centre; musket, crossbow and bow aim where the enemy will be when the shot arrives. L locks on to the current target (kept while it stays in the cone); J switches to the next enemy in the cone.",
    icon: SWORD_ICON,
    type: "toggle",
    settings: [{
        label: "Cone Width (FOV)",
        id: "aimAssist:fov",
        description: "How wide the cone around your mouse is, in degrees (all of it, not each side). 60 at most.",
        type: "slider",
        min: 10,
        max: 60,
        step: 5,
        status: 40
    }, {
        label: "Max Distance",
        id: "aimAssist:maxDist",
        description: "Enemies farther away than this are never picked.",
        type: "slider",
        min: 100,
        max: 1400,
        step: 50,
        status: 700
    }, {
        label: "Pick",
        id: "aimAssist:pick",
        description: "Which enemy in the cone to aim at.",
        type: "select",
        options: [{
            label: "Nearest",
            value: 0
        }, {
            label: "Lowest Health",
            value: 1
        }, {
            label: "Closest To Mouse",
            value: 2
        }],
        status: 0
    }, {
        label: "Lead Falcon's Ranged Shots",
        id: "aimAssist:leadOwnShots",
        description: "Falcon's own attacks aimed at the nearest enemy (instas and the like) aim a musket, crossbow or bow shot where the enemy will be, not where it is. Off = aim straight at the enemy, as before.",
        type: "toggle",
        status: false
    }, {
        label: "Show Markers",
        id: "aimAssist:markers",
        description: "Draws a ring on the current target (yellow, red while locked) and a dot where a ranged shot is aimed.",
        type: "toggle",
        status: true
    }],
    status: false
}, {
    label: "Dynamic One Tick",
    id: "dynamicOneTick",
    description: "Automatically does one ticks whenever possible. This toggle must be turned on for 'Active' oneTick mode to work.",
    icon: SPEAR_ICON,
    settings: [{
        label: "Ignore Hats",
        id: "oneTickIgnoreHats",
        description: "Leaves the enemy's Soldier, Tank and EMP Helmet damage reduction out when deciding if a one tick kills.",
        type: "toggle",
        status: false
    }],
    status: true,
    type: "toggle"
}, {
    label: "Auto Push",
    id: "autoPush",
    description: "Automatically pushes enemies into spikes.",
    icon: WALKING_ICON,
    settings: [{
        label: "Range",
        id: "autoPushRange",
        description: "How close a trapped enemy must be before Auto Push starts pushing them.",
        type: "slider",
        min: 100,
        max: 300,
        status: 250,
        step: 5
    }, {
        label: "Render Pathfinding Line",
        id: "renderAutoPushingPathfindingLine",
        description: "Draws the path Auto Push is following.",
        type: "toggle",
        status: true
    }],
    type: "toggle",
    status: true
}, {
    label: "Anti Bull",
    id: "antiBull",
    description: "Counters bullspamming by using Spike Gear and CX Wings. This toggle completely overrides Shadow Wings.",
    type: "toggle",
    icon: SPIEK_ICON,
    settings: [{
        label: "Force Spike Gear",
        id: "forceAntiBull",
        type: "toggle",
        description: "Force equips Spike Gear in situations where enemies cannot do non-soldier vulnerable counter attacks (e.g. spikeTick).",
        status: true
    }, {
        label: "Keep On at High Shame",
        id: "antiBullHighShame",
        type: "toggle",
        description: "Keeps Anti Bull working when your shame is 4 or more, which is when bull spam hurts most. A due bull tick still comes first. Off: Anti Bull stands down from 4 shame, as before.",
        status: true
    }],
    status: false
}];
