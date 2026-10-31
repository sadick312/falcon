import drawNumberInput from "@menu/utils/drawNumberInput";
import getElem from "@utils/dom/getElem";
import { profileEnd, profileStart } from "@services/profiler/Profiler";
import readJson from "@utils/storage/readJson";
import "./menuStyle";
import Stack from "./misc/Stack";
import drawChatLog from "./utils/drawChatLog";
import drawConfigUI from "./utils/drawConfigUI";
import drawMenuGroup from "./utils/drawMenuGroup";
import drawMenuParagraph from "./utils/drawMenuParagraph";
import drawMenuSelect from "./utils/drawMenuSelect";
import drawMenuSlider from "./utils/drawMenuSlider";
import drawMenuToggle from "./utils/drawMenuToggle";
import drawSavedConfigs from "./utils/drawSavedConfigs";
import {
    gearIcon,
    GRID_ICON,
    MOON_ICON,
    SWORD_ICON,
    SHIELD_ICON,
    WIFI_ICON,
    PACKAGE_ICON,
    TOMBSTONE_ICON,
    STACKED_ICON,
    CONSOLE_ICON,
    SHAME_HAT_ICON,
    HEALING_ICON,
    SPIEK_ICON,
    NAME_TAG_ICON,
    BUILDING_ICON,
    PUNCH_ICON,
    WALKING_ICON,
    SPEAR_ICON,
    FAVORITES_ICON,
    UTILITY_ICON,
    VISUAL_ICON,
    EXPERIMENTALS_ICON,
    CREDITS_ICON,
    FARMING_STORE_UTILITIES_ICON,
    AUTO_GRIND_ICON,
    AUTO_BUY_ICON,
    AUTO_BREAK_ICON,
    AUTO_PLAY_ICON,
    BLOOD_WINGS_OPTIMIZATIONS_ICON,
    SELECT_BEST_WEAPON_ICON,
    BUILDING_HEALTH_BAR_ICON,
    BUILDING_OVERLAY_ICON,
    RELOAD_BARS_ICON,
    FALCON_LOGO
} from "./icons";

interface IMenuTab {
    label: string;
    icon: string;
}

interface IMenuOptions {
    label: string;
    value: any;
}

export interface IMenuItem {
    label: string;
    description?: string;
    id: string;
    type: "toggle" | "select" | "number" | "slider" | "paragraph" | "group" | "chat-log" | "saved-configs" | "config-ui";
    settings?: IMenuItem[];
    icon?: string;
    options?: IMenuOptions[];
    status?: any;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    isDropdownToggled?: boolean;
    isFavorited?: boolean;
    unchangable?: boolean;
    neverSave?: boolean;
    update?: () => void;
}

/** "falcon-configs" in localStorage: config name -> saved item statuses (undefined once deleted). */
export type SavedConfigs = Record<string, Record<string, unknown> | undefined>;

/**
 * Format version of saved settings ("falcon-settings" and each saved config), stored under SETTINGS_VERSION_KEY.
 * When a setting's id or kind of value changes, bump this and add a step to SETTINGS_MIGRATIONS.
 */
export const SETTINGS_VERSION = 1;
const SETTINGS_VERSION_KEY = "__version";

/** SETTINGS_MIGRATIONS[n] upgrades settings saved at version n to version n + 1, in place. */
const SETTINGS_MIGRATIONS: Record<number, (data: Record<string, unknown>) => void> = {
    // Version 0: saved before versioning existed. Same ids and kinds of values as version 1.
    0: () => { }
};

/** A copy of saved settings upgraded to SETTINGS_VERSION, without the version key. Non-objects become {}. */
function migrateSettings(saved: unknown): Record<string, unknown> {
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

    const data: Record<string, unknown> = { ...saved };
    const savedVersion = data[SETTINGS_VERSION_KEY];
    delete data[SETTINGS_VERSION_KEY];

    // Settings from a newer Falcon load as they are: unknown ids and misfitting values are skipped anyway.
    let version = typeof savedVersion === "number" ? savedVersion : 0;
    for (; version < SETTINGS_VERSION; version++) SETTINGS_MIGRATIONS[version]?.(data);

    return data;
}

/**
 * Whether a saved value is one the menu itself could have stored for this setting. Sliders and number inputs
 * hold a number until edited, then the input's text; selects hold an option's value or its text.
 */
function isValidSettingValue(item: IMenuItem, value: unknown) {
    switch (item.type) {
        case "toggle":
            return typeof value === "boolean";
        case "slider":
        case "number":
            return (typeof value === "number" || typeof value === "string") && value !== "" && Number.isFinite(Number(value));
        case "select":
            return item.options?.some(option => String(option.value) === String(value)) ?? false;
        default:
            return true;
    }
}

interface IMenuContent {
    favorites: IMenuItem[];
    combat: IMenuItem[];
    utility: IMenuItem[];
    defense: IMenuItem[];
    visual: IMenuItem[];
    console: IMenuItem[];
    configs: IMenuItem[];
    experimentals: IMenuItem[];
    credits: IMenuItem[];
}

/** The settings gear at a given size (the menu used 15.5 and 22). */
const menuTabs: IMenuTab[] = [{
    label: "Favorites",
    icon: FAVORITES_ICON
}, {
    label: "Combat",
    icon: SWORD_ICON
}, {
    label: "Utility",
    icon: UTILITY_ICON
}, {
    label: "Defense",
    icon: SHIELD_ICON
}, {
    label: "Visual",
    icon: VISUAL_ICON
}, {
    label: "Console",
    icon: CONSOLE_ICON
}, {
    label: "Configs",
    icon: gearIcon(15.5)
}, {
    label: "Experimentals",
    icon: EXPERIMENTALS_ICON
}, {
    label: "Credits",
    icon: CREDITS_ICON
}];

export class ChatLog {
    time: string;
    type: "chat" | "encounter" | "leave" | "death" = "chat";

    constructor(
        public msg: string,
        type?: "encounter" | "leave" | "death"
    ) {
        if (type) this.type = type;

        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";

        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutesStr = minutes < 10 ? "0" + minutes : minutes;

        this.time = `${hours}:${minutesStr} ${ampm}`;
    }
}

export const menuContent: IMenuContent = {
    favorites: [],
    combat: [{
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
            }],
            status: true
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
            description: "Fakes appleInstas repeatedly and once the enemy stops shaming, finishes off with appleInsta. Must have appleInsta and preplacements toggled on for this to work.",
            type: "toggle",
            icon: SHAME_HAT_ICON,
            disabled: true,
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
        }],
        status: false
    }],
    utility: [{
        label: "",
        id: "",
        description: `This module offers multiple toggles to customize the general use modules in the script. Click the settings button to adjust sub-settings for each module.`,
        type: "paragraph"
    }, {
        label: "Farming / Store Utilities",
        id: "",
        description: "Modules that help automate the annoying parts of the store and grinding.",
        icon: FARMING_STORE_UTILITIES_ICON,
        type: "group",
        settings: [{
            label: "Auto Grinding",
            id: "autoGrind",
            neverSave: true,
            description: "Helps with leveling up weapons to higher variants.",
            icon: AUTO_GRIND_ICON,
            settings: [{
                label: "Primary Limit",
                id: "grindPrimaryLimit",
                description: "Set the limit of primary grinding.",
                type: "slider",
                min: 0,
                max: 3,
                status: 2
            }, {
                label: "Secondary Limit",
                id: "grindSecondaryLimit",
                description: "Set the limit of secondary grinding.",
                type: "slider",
                min: 0,
                max: 3,
                status: 1
            }],
            type: "toggle"
        }, {
            label: "Auto Buy",
            id: "autoBuy",
            description: "Automatically purchases hats and accessories.",
            icon: AUTO_BUY_ICON,
            type: "toggle",
            status: true
        }, {
            label: "Auto Upgrade",
            id: "autoUpgrade",
            description: "Automatically upgrades weapons and items.",
            icon: AUTO_BUY_ICON,
            status: true,
            settings: [{
                label: "7th Slot",
                id: "7thSlot",
                type: "select",
                description: "Set what the Auto Upgrader picks for the 7th slot.",
                options: [{
                    label: "Teleport",
                    value: 38
                }, {
                    label: "Turret",
                    value: 33
                }, {
                    label: "Healing Pad",
                    value: 35
                }, {
                    label: "Blocker",
                    value: 37
                }, {
                    label: "Platform",
                    value: 34
                }],
                status: 38
            }],
            type: "toggle"
        }]
    }, {
        label: "Packet Management",
        description: "Customize modules to modify the client's method for managing packet usage.",
        id: "",
        icon: PACKAGE_ICON,
        type: "group",
        settings: [{
            label: "Packet Budget Strictness",
            id: "packetBudgetStrictness",
            description: "Sets how many ticks ahead the budget tracker reserves packets.",
            type: "slider",
            icon: WIFI_ICON,
            min: 2,
            max: 4,
            step: 1,
            status: 2
        }, {
            label: "Packet Budget Limit",
            id: "packetBudgetLimit",
            description: "Determines the maximum capacity for packet usage.",
            type: "slider",
            icon: PACKAGE_ICON,
            min: 100,
            max: 110,
            step: 5,
            status: 110
        }, {
            label: "Artificial Ping",
            id: "artificialPing",
            description: "Artificially increases ping. This toggle does actually make your ping worse. Unlike with other toggles, this toggle will not be automatically saved.",
            icon: WIFI_ICON,
            type: "toggle",
            neverSave: true,
            settings: [{
                label: "Artificial Amount",
                id: "artificialPingAmt",
                description: "Extra delay added to your connection, in ms (half on sending, half on receiving).",
                type: "slider",
                min: 10,
                step: 5,
                max: 80,
                status: 35
            }],
            status: false
        }]
    }, {
        label: "Auto Break",
        id: "autoBreak",
        description: "Automatically breaks buildings while trapped.",
        icon: AUTO_BREAK_ICON,
        type: "toggle",
        status: true
    }, {
        id: "autoRespawn",
        label: "Auto Respawn",
        icon: TOMBSTONE_ICON,
        description: "Automatically respawns when you die.",
        type: "toggle"
    }, {
        label: "Kill Chat",
        id: "killChat",
        description: "Automatically chats something whenever your killCount increases.",
        type: "toggle",
        icon: CONSOLE_ICON,
        status: false
    }, {
        label: "Auto Play",
        id: "autoPlay",
        description: "Auto play? Might as well, the whole client basically does everything for you. Now let's automate movement too! Requires you to enable all the other modules for this to be good.",
        icon: AUTO_PLAY_ICON,
        type: "toggle",
        settings: [{
            label: "Follow",
            id: "followTo",
            description: "Follow ANY player with via their in-game SID. To follow with no one, set the value to -1.",
            type: "number",
            min: -1,
            max: 500,
            step: 1,
            neverSave: true,
            status: -1
        }],
        status: false
    }],
    defense: [{
        label: "",
        id: "",
        description: `This module offers multiple toggles to customize the defensive modules in the script. Click the settings button to adjust sub-settings for each module.`,
        type: "paragraph"
    }, {
        label: "Defense System",
        description: "Manage the mod's main defensive system.",
        id: "",
        type: "group",
        icon: SHIELD_ICON,
        settings: [{
            label: "Pattern Recognition",
            id: "usePatternRec",
            description: "Adapts defensive calculations based on common enemy attack patterns.",
            icon: CONSOLE_ICON,
            type: "toggle",
            status: true
        }, {
            label: "Auto Healing",
            id: "autoHeal",
            description: "Responds to dangers by auto healing.",
            icon: HEALING_ICON,
            type: "toggle",
            status: true
        }, {
            label: "Hat Switching",
            id: "defensiveHatSwitching",
            description: "Allows the action of hat switching to mitigate potential damages.",
            icon: SHIELD_ICON,
            type: "toggle",
            status: true
        }, {
            label: "Blood Wings Optimizations",
            id: "bloodWingsOptimizations",
            description: "Uses blood wings for defensive purposes (e.g. no-soldier antionetick, no-shame antishamegrind, etc).",
            type: "toggle",
            icon: BLOOD_WINGS_OPTIMIZATIONS_ICON,
            disabled: true
        }]
    }, {
        label: "Safe Walk",
        id: "safeWalk",
        description: "Prevents walking into dangerous or annoying buildings.",
        icon: SPIEK_ICON,
        type: "toggle",
        settings: [{
            id: "safeWalkIgnoreMyTps",
            label: "Ignore My Teleports",
            description: "Safe walk doesn't stop you from walking into your own teleports.",
            type: "toggle",
            status: true
        }, {
            id: "safeWalkIgnoreAllyBoostPads",
            label: "Ignore Allied Boost Pads",
            description: "Safe walk doesn't stop you from walking into boost pads placed by allies.",
            type: "toggle",
            status: true
        }],
        status: true
    }, {
        label: "Always Pick Best Weapon",
        id: "selectBestWeapon",
        description: "Automatically selects the best weapon for every scenario.",
        icon: SELECT_BEST_WEAPON_ICON,
        type: "toggle",
        status: true
    }, {
        label: "Auto Object Breaker",
        id: "walkBreaker",
        description: "Automatically breaks spikes, traps, and teleports.",
        icon: AUTO_BREAK_ICON,
        type: "toggle",
        status: true
    }, {
        label: "Defensive Knockbacks",
        id: "defensiveKB",
        description: "Uses highly 'advanced' complex spatial trigonometry to determine perfect knockback vectors to knock enemies away for defensive purposes.",
        type: "toggle",
        icon: PUNCH_ICON,
        settings: [{
            label: "Require Turret Bullet",
            id: "defKBRequireTurret",
            type: "toggle",
            description: "Only executes defensive knockbacks only when primary AND turret is fully reloaded.",
            status: true
        }],
        status: true
    }],
    visual: [{
        label: "",
        id: "",
        description: `This module offers multiple toggles to customize the appearance of the script. Click the settings button to adjust sub-settings for each module.`,
        type: "paragraph"
    }, {
        label: "Building Visuals",
        id: "",
        icon: BUILDING_ICON,
        description: "Modules that customizes visuals relating to buildings.",
        type: "group",
        settings: [{
            label: "Building Health Bars",
            id: "buildingHealthBar",
            description: "Draws health bars on buildings.",
            icon: BUILDING_HEALTH_BAR_ICON,
            settings: [{
                label: "Always Show",
                type: "toggle",
                id: "buildingHealthAlwaysShow",
                description: "Render health bars regardless if the object has taken damage or not."
            }],
            type: "toggle",
            status: true
        }, {
            label: "Draw Building Overlay",
            id: "buildingOverlay",
            description: "Draws indicators that tell if a building is friendly or not.",
            icon: BUILDING_OVERLAY_ICON,
            type: "toggle",
            status: true
        }]
    }, {
        label: "Debugging Visuals",
        id: "",
        type: "group",
        description: "Modules that help with debugging the mod's features.",
        icon: CONSOLE_ICON,
        settings: [{
            label: "Render Placement",
            id: "renderPlacements",
            description: "Draws ghost objects to where we'll place.",
            icon: SPIEK_ICON,
            type: "toggle",
            status: true
        }, {
            label: "Render Packet Count",
            id: "renderPacketCounter",
            description: "Draws a packet counter on top of the player.",
            icon: PACKAGE_ICON,
            status: true,
            type: "toggle"
        }, {
            label: "Show Activity",
            id: "showActivity",
            description: "Displays a live list of active modules and behaviors.",
            type: "toggle",
            icon: CONSOLE_ICON,
            status: true
        }, {
            label: "Render Ownership",
            id: "renderOwnership",
            description: "Draws the unqiue sid values on both players and game objects.",
            type: "toggle",
            icon: NAME_TAG_ICON,
            status: true
        }, {
            label: "Render Placement Times",
            id: "renderPlacementTime",
            description: "Shows runtimes for the 6 most recent placements.",
            type: "toggle",
            icon: CONSOLE_ICON,
            status: true
        }, {
            label: "Render Real Direction",
            id: "renderRealDir",
            description: "Renders the real direction of our player.",
            type: "toggle",
            status: true
        }]
    }, {
        label: "Render Grid",
        id: "renderGrid",
        description: "Draws the background grid.",
        icon: GRID_ICON,
        settings: [{
            label: "Static Grid",
            id: "staticGrid",
            description: "Makes the grid not resize with zoom.",
            type: "toggle",
            status: false
        }],
        type: "toggle",
        status: true
    }, {
        label: "Night Mode",
        id: "nightMode",
        description: "Renders a darker tint on the screen.",
        icon: MOON_ICON,
        type: "toggle",
        status: false
    }, {
        label: "Reload Bars",
        id: "reloadBars",
        description: "Draws reload bars.",
        icon: RELOAD_BARS_ICON,
        settings: [{
            id: "renderTurretReload",
            description: "Shows a reload bar next to players while their Turret Gear is reloading.",
            label: "Render Turret Gear Reload",
            type: "toggle"
        }],
        type: "toggle",
        status: true
    }, {
        label: "Shame Counter",
        id: "renderShameCounter",
        description: "Draws a entities' shame count.",
        icon: SHAME_HAT_ICON,
        type: "toggle",
        status: true
    }, {
        type: "toggle",
        label: "Stacked Text",
        id: "stackedText",
        description: "Damage and healing text are merged.",
        icon: STACKED_ICON
    }, {
        label: "Render Names",
        id: "renderNames",
        description: "Draws player and ai names.",
        type: "toggle",
        icon: NAME_TAG_ICON,
        status: true
    }],
    console: [{
        label: "",
        id: "",
        type: "chat-log"
    }],
    configs: [{
        label: "Development Analytics",
        id: "improvementLogging",
        type: "toggle",
        description: "Nothing is sent anywhere. While this is on, a packet log (.fpl) is only saved when you die if Download Local Copy is on; while it is off, one is saved on every death.",
        icon: gearIcon(22),
        settings: [{
            label: "Download Local Copy",
            description: "Saves the last 15 seconds of packets as an .fpl file each time you die.",
            id: "improvementLoggingLCopy",
            type: "toggle"
        }],
        status: true
    }, {
        label: "Auto Save Configs",
        description: "Automatically saves setting configurations to local storage.",
        id: "autoSaveSettings",
        type: "toggle",
        status: false,
        icon: gearIcon(22)
    }, {
        label: "",
        id: "",
        type: "config-ui"
    }, {
        label: "",
        type: "saved-configs",
        id: ""
    }],
    experimentals: [{
        label: "",
        id: "",
        description: `Experimental toggles and module configurations. All modules listed are usually experimental algorithmic adjustments for modules in other categories. Modules under this section here may or may not be fully integrated with the rest of the client. By default, experimental toggles will not be automatically saved.`,
        type: "paragraph"
    }, {
        label: "preplacer dont round",
        id: "prenorounding",
        description: "makes preplace not round timing to the nearest int.",
        type: "toggle",
        neverSave: true,
        status: false
    }],
    credits: [{
        label: "",
        id: "",
        description: `By using this software, you acknowledge that the developers and anyone associated with this software are not responsible or liable for any direct, indirect, incidental, consequential, or other damages, losses, or issues of any kind arising from its use, including but not limited to data loss, system crashes, or other malfunctions.`,
        type: "paragraph"
    }]
};

export default class Menu {
    static chatLogs: ChatLog[] = [new ChatLog("Loaded Falcon Mod")];

    static tabHolder: HTMLDivElement;
    static contentElement: HTMLDivElement;
    static menuElement: HTMLDivElement;

    static forwardButton: HTMLDivElement;
    static backwardButton: HTMLDivElement;
    static utilsTitle: HTMLDivElement;

    static backwardStack: Stack<IMenuItem> = new Stack();
    static forwardStack: Stack<IMenuItem> = new Stack();

    static currentItem: IMenuItem;

    static getValue(id: string): any {
        return this.itemMap[id]?.status;
    }

    static setValue(id: string, val: boolean) {
        if (typeof this.itemMap[id].status === "boolean") {
            this.itemMap[id].status = val;
            if (typeof this.itemMap[id].update === "function") this.itemMap[id].update();
        }

        this.saveSettings();
    }

    static async loadSettings(customSettings?: Record<string, unknown>) {
        const saved = customSettings ?? readJson<Record<string, unknown>>("falcon-settings", {});
        const data = migrateSettings(saved);

        for (const id in data) {
            // Own keys only: `in` would also match inherited names such as "__proto__".
            if (!Object.hasOwn(this.itemMap, id)) continue;

            // A value that no longer fits its setting (e.g. a toggle that became a slider) keeps the default.
            const item = this.itemMap[id];
            if (isValidSettingValue(item, data[id])) item.status = data[id];
        }

        return true;
    }

    /** Every saveable setting's value, plus the format version, as stored in "falcon-settings" and saved configs. */
    static collectSettings() {
        const settings: Record<string, unknown> = { [SETTINGS_VERSION_KEY]: SETTINGS_VERSION };

        for (const id in this.itemMap) {
            const item = this.itemMap[id];
            if (item.neverSave) continue;
            if (item.type === "paragraph") continue;
            settings[item.id] = item.status;
        }

        return settings;
    }

    static loadFavorites() {
        const allFavorites = readJson<unknown>("falcon-favorites", null);
        if (!Array.isArray(allFavorites)) return;

        for (const id in this.itemMap) {
            const item = this.itemMap[id];

            if (allFavorites.includes(item.id)) {
                item.isFavorited = true;
            }
        }
    }

    static saveFavorites() {
        const allFavorites: string[] = [];

        for (const id in this.itemMap) {
            const item = this.itemMap[id];
            if (!item.isFavorited) continue;
            allFavorites.push(item.id);
        }

        localStorage.setItem("falcon-favorites", JSON.stringify(allFavorites));
    }

    static async saveSettings() {
        if (!Menu.getValue("autoSaveSettings")) {
            localStorage.removeItem("falcon-settings");
            return;
        }

        localStorage.setItem("falcon-settings", JSON.stringify(this.collectSettings()));
    }

    static itemMap: Record<string, IMenuItem> = {};

    static buildItemMap(items?: IMenuItem[]) {
        if (!items) items = Object.values(menuContent).flat() as IMenuItem[];

        for (const item of items) {
            this.itemMap[item.id] = item;
            if (item.settings) this.buildItemMap(item.settings);
        }
    }

    static async init() {
        const menuElement = this.menuElement = document.createElement("div");
        menuElement.id = "scriptMenu";
        document.body.appendChild(menuElement);

        menuElement.style.display = "none";

        const headerElement = document.createElement("div");
        headerElement.id = "headerElement";
        headerElement.classList.add("bunPadding");
        menuElement.appendChild(headerElement);

        headerElement.innerHTML = `
            ${FALCON_LOGO}
            <div style="pointer-events: none; margin-left: 3px;">
                <div style="font-size: 34px; color: var(--generic-white);">FALCON</div>
                <div style="color: var(--theme-primary); margin-top: -12px;">v1.0.0-pub</div>
            </div>
        `;

        const closeMenuButton = document.createElement("div");
        closeMenuButton.id = "closeMenuButton";
        closeMenuButton.innerHTML = `<i class="material-icons" style="color: var(--theme-secondary); font-size: 20px;">close</i>`;
        closeMenuButton.onclick = () => menuElement.style.display = "none";
        headerElement.appendChild(closeMenuButton);

        const contentHolderElement = document.createElement("div");
        contentHolderElement.id = "contentHolderElement";
        menuElement.appendChild(contentHolderElement);

        const tabHolder = document.createElement("div");
        tabHolder.id = "tabHolder";
        this.tabHolder = tabHolder;
        contentHolderElement.appendChild(tabHolder);

        const contentElement = document.createElement("div");
        contentElement.id = "contentElement";
        this.contentElement = contentElement;
        contentHolderElement.appendChild(contentElement);

        const utilsHolder = document.createElement("div");
        utilsHolder.id = "utilsHolder";
        headerElement.appendChild(utilsHolder);

        const backwardButton = document.createElement("div");
        backwardButton.classList.add("arrowButton");
        backwardButton.innerHTML = `
            <span class="material-icons" style="font-size: inherit; color: inherit;">arrow_back_ios</span>
        `;

        const forwardButton = document.createElement("div");
        forwardButton.classList.add("arrowButton");
        forwardButton.innerHTML = `
            <span class="material-icons" style="font-size: inherit; color: inherit;">arrow_forward_ios</span>
        `;

        const utilsTitle = document.createElement("div");
        utilsTitle.classList.add("utilsTitle");

        this.backwardButton = backwardButton;
        this.forwardButton = forwardButton;
        this.utilsTitle = utilsTitle;

        utilsHolder.appendChild(backwardButton);
        utilsHolder.appendChild(forwardButton);
        utilsHolder.appendChild(utilsTitle);

        backwardButton.onclick = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();

            if (!this.backwardStack.isEmpty()) {
                const prev = this.backwardStack.pop()!;
                this.forwardStack.push(this.currentItem);
                this.goToItem(prev);
            }
        };

        forwardButton.onclick = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();

            if (!this.forwardStack.isEmpty()) {
                const next = this.forwardStack.pop()!;
                this.backwardStack.push(this.currentItem);
                this.goToItem(next);
            }
        };

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                menuElement.style.display =
                    menuElement.style.display === "none" ? "block" : "none";
                if (this.selectedTab === 5) drawChatLog();
            }
        });

        this.updateUtilsBar(menuTabs[1].label);
        this.makeDraggable(menuElement, headerElement);
        this.buildItemMap();

        await this.loadSettings();
        this.loadFavorites();
        this.renderTabs();
    }

    static goToItem(stackItem: IMenuItem, items?: IMenuItem[], parentLabel: string = "", tabIndex: number = 0): boolean {
        if (!items) {
            let i = 0;

            if (this.isInFavoritesTab) {
                getElem(`menuTab:0`).click();
                return true;
            }

            for (const category of Object.values(menuContent)) {
                if (this.goToItem(stackItem, category as IMenuItem[], "", i)) return true;
                i++;
            }

            return false;
        }

        for (const item of items) {
            if (item === stackItem) {
                const title = parentLabel || menuTabs[tabIndex].label;
                this.updateUtilsBar(title);
                this.renderItems(items);
                this.currentItem = item;
                return true;
            }

            if (item.settings) {
                if (this.goToItem(stackItem, item.settings, item.type === "group" ? item.label : `${item.label} Settings`, tabIndex)) return true;
            }
        }

        return false;
    }

    static updateUtilsBar(title = "") {
        this.utilsTitle.innerText = title;

        if (this.backwardStack.isEmpty()) {
            this.backwardButton.style.color = "var(--generic-white-3)";
            this.backwardButton.style.pointerEvents = "none";
        } else {
            this.backwardButton.style.color = "var(--generic-white-2)";
            this.backwardButton.style.pointerEvents = "all";
        }

        if (this.forwardStack.isEmpty()) {
            this.forwardButton.style.color = "var(--generic-white-3)";
            this.forwardButton.style.pointerEvents = "none";
        } else {
            this.forwardButton.style.color = "var(--generic-white-2)";
            this.forwardButton.style.pointerEvents = "all";
        }
    }

    private static oldItems: IMenuItem[] = [];

    static renderItems(items: IMenuItem[], contentElement?: HTMLElement, tabIndex?: number, isNested: boolean = false) {
        // Nested calls draw dropdowns inside an outer render; time only the outer one.
        const drawStart = __DEV__ && !isNested ? profileStart() : 0;
        contentElement = contentElement ?? this.contentElement;
        contentElement.innerHTML = "";

        if (this.contentElement === contentElement) {
            for (const item of this.oldItems) item.update = undefined;
            this.oldItems = items; // This will help with the GC
        }

        if (items.length) {
            for (const item of items) {
                if (item.type === "toggle") drawMenuToggle(item, contentElement, isNested);
                else if (item.type === "select") drawMenuSelect(item, contentElement);
                else if (item.type === "slider") drawMenuSlider(item, contentElement);
                else if (item.type === "paragraph") drawMenuParagraph(item), contentElement;
                else if (item.type === "group") drawMenuGroup(item, contentElement);
                else if (item.type === "number") drawNumberInput(item, contentElement);
                else if (item.type === "chat-log") drawChatLog();
                else if (item.type === "config-ui") drawConfigUI();
                else if (item.type === "saved-configs") drawSavedConfigs();
            }
        } else {
            const noItemsElem = document.createElement("div");
            noItemsElem.classList.add("noTabTtems");
            noItemsElem.innerHTML = tabIndex === 0 ? "You haven't favorited any toggles just yet." : "There are no items in this tab yet.<br>Please check back in a future update.";
            contentElement.appendChild(noItemsElem);
        }

        if (__DEV__ && !isNested) profileEnd("menu", drawStart);
    }

    static selectedTab = 1;
    static isInFavoritesTab = false;

    static renderTabs() {
        const tabHolder = this.tabHolder;

        for (let i = 0; i < menuTabs.length; i++) {
            const tab = menuTabs[i];

            const tabElem = document.createElement("div");
            tabElem.id = `menuTab:${i}`;
            tabElem.classList.add("menuTab");
            tabElem.innerHTML = `
                ${tab.icon.replace(/REPLACE_WITH_COLOR/g, "var(--generic-white)")}
                ${tab.label}
            `;

            tabElem.onclick = ({ isTrusted }) => {
                if (isTrusted) {
                    const oldElem = getElem(`menuTab:${this.selectedTab}`);
                    const tab = menuTabs[this.selectedTab];

                    oldElem.classList.remove("activeTab");
                    oldElem.innerHTML = `
                        ${tab.icon.replace(/REPLACE_WITH_COLOR/g, "var(--generic-white)")}
                        ${tab.label}
                    `;
                    this.selectedTab = i;
                }

                tabElem.classList.add("activeTab");
                tabElem.innerHTML = `
                    ${tab.icon.replace(/REPLACE_WITH_COLOR/g, "var(--theme-primary)")}
                    ${tab.label}
                `;

                const key = tab.label.toLowerCase() as keyof typeof menuContent;

                if (i === 0) {
                    const favoriteItems = [];

                    for (const id in this.itemMap) {
                        const item = this.itemMap[id];
                        if (!item.isFavorited) continue;
                        favoriteItems.push(item);
                    }

                    this.renderItems(favoriteItems, undefined, i);
                    this.isInFavoritesTab = true;
                    this.currentItem = favoriteItems[0];
                } else {
                    this.renderItems(menuContent[key]);
                    this.currentItem = menuContent[key][0];
                    this.isInFavoritesTab = false;
                }

                this.backwardStack.clear();
                this.forwardStack.clear();
                this.updateUtilsBar(tab.label);
            };

            tabHolder.appendChild(tabElem);
        }

        getElem(`menuTab:1`).click();
    }

    static makeDraggable(menu: HTMLElement, handle: HTMLElement) {
        let offsetX = 0;
        let offsetY = 0;
        let isDragging = false;

        handle.addEventListener("mousedown", (e) => {
            isDragging = true;

            menu.style.transform = "none";

            const rect = menu.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            document.body.style.userSelect = "none";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            e.preventDefault();

            menu.style.left = `${e.clientX - offsetX}px`;
            menu.style.top = `${e.clientY - offsetY}px`;
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            document.body.style.userSelect = "";
        });
    }
}