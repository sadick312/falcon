// Settings in the defense tab. Plain data: Menu.ts builds the UI from it.
import { IMenuItem } from "../types";
import { CONSOLE_ICON, HEALING_ICON, PUNCH_ICON, SHIELD_ICON, SPIEK_ICON } from "../icons";

export const defenseSettings: IMenuItem[] = [{
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
        description: "While hurt, wears Blood Wings for melee hits on enemies (heals 20% of the damage, without shame). At 4+ shame, Auto Heal lets such a hit heal instead of eating.",
        type: "toggle",
        status: false,
        icon: `
            <svg width="35px" height="35px" viewBox="0 0 122.88 57.38">
                <g>
                    <path fill="REPLACE_WITH_COLOR" d="M52.2 57.4C43.9 43 22.9 55.2 17.8 38.2c5.3 1.5 9.4 1.5 12.9.3C14.3 36.2 6.9 30.4 6.5 21c5.3 3.4 10.1 4.8 14.6 4.6C6.6 19.3-2.3 7.4.5 0 9.1 6.8 14.2 10.1 18.6 12c8.6 3.9 17.5 5.2 26.1 10.5 8.2 5 13.7 12 13.3 21.3-.2 4.5-2 9-5.8 13.6Zm18.5 0C79 43 100 55.2 105 38.2c-5.3 1.5-9.4 1.5-12.9.3 16.4-2.3 23.8-8.1 24.2-17.5-5.3 3.4-10.1 4.8-14.6 4.6 14.5-6.3 23.4-18.2 20.6-25.6-8.5 6.8-13.7 10-18 12-8.6 3.9-17.5 5.2-26.1 10.5-8.2 5-13.7 12-13.3 21.3.2 4.5 2 9 5.8 13.6Z"/>
                </g>
            </svg>
            `
    }, {
        label: "Angel Wings Regen",
        id: "angelWingsRegen",
        description: "While hurt and no enemy is close, wears Angel Wings (3 health a second, without shame) instead of Monkey Tail.",
        type: "toggle",
        status: false,
        icon: `
            <svg width="35px" height="35px" viewBox="0 0 122.88 57.38">
                <g>
                    <path fill="REPLACE_WITH_COLOR" d="M52.2 57.4C43.9 43 22.9 55.2 17.8 38.2c5.3 1.5 9.4 1.5 12.9.3C14.3 36.2 6.9 30.4 6.5 21c5.3 3.4 10.1 4.8 14.6 4.6C6.6 19.3-2.3 7.4.5 0 9.1 6.8 14.2 10.1 18.6 12c8.6 3.9 17.5 5.2 26.1 10.5 8.2 5 13.7 12 13.3 21.3-.2 4.5-2 9-5.8 13.6Zm18.5 0C79 43 100 55.2 105 38.2c-5.3 1.5-9.4 1.5-12.9.3 16.4-2.3 23.8-8.1 24.2-17.5-5.3 3.4-10.1 4.8-14.6 4.6 14.5-6.3 23.4-18.2 20.6-25.6-8.5 6.8-13.7 10-18 12-8.6 3.9-17.5 5.2-26.1 10.5-8.2 5-13.7 12-13.3 21.3.2 4.5 2 9 5.8 13.6Z"/>
                </g>
            </svg>
            `
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
    icon: `
        <svg width="19" height="19" viewBox="0 0 300 300">
            <g transform="translate(0, 300) scale(0.1, -0.1)" fill="REPLACE_WITH_COLOR">
                <path d="M1282 2985c61 9 145 13 243 10 235-6 409-48 624-151l114-54 103 100c86 83 108 100 134 100 38 0 66-14 80-40 5-10 39-222 75-471 70-492 70-487 13-518-25-14-48-13-265 18-395 55-681 99-692 106-22 13-43 67-36 93 4 15 49 70 102 123l95 97-78 25c-121 38-219 50-352 44-237-11-433-94-606-257-159-150-252-318-292-528-8-40-14-97-14-125 0-84-16-126-53-142-28-12-54-10-197 11-232 33-230 33-256 61-29 31-30 70-9 223 49 341 182 608 424 851 240 239 504 372 843 424Z" />
                <path d="M2509 1562c17 16 37 28 44 28 6 0 99-13 206-29 186-27 195-29 219-56 23-28 24-33 18-120-19-258-109-516-256-736-82-122-265-306-385-386C1893-46 1328-83 836 162l-99 49L636 111C580 56 523 8 509 5c-36-9-83 17-97 52-6 15-39 229-73 474-61 433-62 447-45 473 9 15 28 31 40 36 16 6 163-11 472-56 247-35 453-64 457-64 23 0 57-51 57-86 0-33-10-47-96-134l-96-98 64-21c308-102 648-48 897 144 31 23 85 73 121 111 158 168 239 352 260 594 8 99 10 106 39 132Z" />
            </g>
        </svg>
        `,
    type: "toggle",
    status: true
}, {
    label: "Auto Object Breaker",
    id: "walkBreaker",
    description: "Automatically breaks spikes, traps, and teleports.",
    icon: `
        <svg viewBox="0 0 360 360" width="29" height="29">
            <path fill="REPLACE_WITH_COLOR" d="M0 0C-12.5-8.7-30.4 1.8-39.4 11c-2.5 2.8-4.6 4.8-8.1 6.3-2-1.9-3.6-3.7-6-5-3 .2-4.7.7-7.1 2.5-.7.7-1.3 1.4-2 2.1-.8.8-1.6 1.5-2.4 2.3s-1.6 1.7-2.5 2.5c-1.7 1.7-3.5 3.5-5.2 5.2-2.8 2.8-5.5 5.6-8.3 8.3-1.8 1.8-3.6 3.6-5.4 5.4-.9.9-1.8 1.7-2.6 2.6-.9.8-1.7 1.7-2.5 2.5-.8.8-1.6 1.6-2.4 2.3-2.5 2.6-3.5 3.9-4.4 7.4-.2 2.9-.2 2.9 1.2 5 1.7 1.8 1.7 1.8 2.4 3.8.5 2.2.5 2.2-1.2 3.9-1.5 1.3-2.9 2.6-4.3 3.9-8.2 8.2-13.4 18.1-13.7 29.8.1 5 1.1 7.2 4.7 10.8 1.8 1.8 3.5 3.5 5.3 5.2 1.9 1.9 3.8 3.9 5.6 5.8 1.1 1 2.1 2 3.1 3.1 3 3 6 6 9 8.9.9.9 1.8 1.8 2.7 2.7 3.6 3.5 6.3 6.6 11.2 7.7 1 0 1.9-.1 2.9-.2 10-.6 17.9-4 25.7-10.2.5-.4 1.1-.9 1.6-1.3 2.7-2.2 5.2-4.3 7-7.3.2-.6.4-1.2.6-1.7 1 .3 2 .6 3 1 2.3 2.1 2.3 2.1 5 4 3.4-.2 5.5-.6 8.2-2.6.7-.7 1.4-1.4 2.1-2 1.2-1.2 1.2-1.2 2.3-2.4.9-.8 1.7-1.6 2.5-2.5 1.8-1.7 3.5-3.5 5.3-5.2 2.7-2.8 5.4-5.6 8.2-8.3 1.8-1.8 3.6-3.6 5.4-5.4.9-.9 1.8-1.8 2.6-2.6.9-.9 1.7-1.7 2.5-2.5 1.2-1.2 1.2-1.2 2.3-2.4 2.3-2.3 3.5-3.7 4.4-6.8.2-2.3.2-2.3-.8-4-1.4-1.4-2.7-2.8-4-4.3.8-3.1.8-3.1 3.1-5.2 9.1-8.5 16-17.8 17.2-30.5.1-5.5-.2-9-3.9-13.2-.7-.7-1.4-1.3-2-1.9-2.1-2.1-4.2-4-6.4-5.9-2.8-2.5-5.6-4.9-8.1-7.7C9.8 9.7 5.2 4.6 0 0Z" transform="translate(158.48046875, 47.72265625)" />
            <path fill="REPLACE_WITH_COLOR" d="M0 0C-2.8 0-2.8 0-6.6 3.7c-.5.6-1.1 1.1-1.6 1.7-1.2 1.2-2.3 2.3-3.5 3.5-1.8 1.9-3.6 3.7-5.5 5.5-1.2 1.2-2.4 2.4-3.6 3.6-.6.6-1.1 1.2-1.7 1.7-2.8 2.8-5.3 5.1-6.6 8.9 0 2.3 0 2.3 1.6 4.7 1.2 1.3 1.2 1.3 2.4 2.5 1.2 1.3 1.2 1.3 2.3 2.6 3.8 4.1 7.6 8.2 11.2 12.4 3.3 3.8 6.7 7.6 10.1 11.4C-.3 63.7-.3 63.7.8 65c4.8 5.4 9.7 10.8 14.6 16.1 2.4 2.6 4.8 5.2 7.1 7.9 3.3 3.8 6.7 7.5 10.1 11.2 5.8 6.2 11.5 12.4 16.9 18.9 3 3.5 5.9 6.9 9 10.3 2 2.2 4 4.4 5.9 6.6 3.4 3.9 6.8 7.7 10.2 11.5 2.3 2.6 4.7 5.1 6.9 7.8 3.5 4.1 7.2 9.1 12.1 11.7 2.6-.3 3.9-.9 6-2.6.7-.7 1.4-1.4 2.1-2 1.2-1.2 1.2-1.2 2.4-2.3.9-.9 1.7-1.7 2.5-2.5 1.8-1.7 3.5-3.5 5.3-5.3 2.8-2.8 5.5-5.6 8.3-8.3 1.8-1.8 3.6-3.6 5.5-5.4.9-.9 1.7-1.7 2.6-2.6.9-.8 1.7-1.7 2.5-2.5 1.2-1.2 1.2-1.2 2.3-2.4 2.1-2.1 2.1-2.1 3.5-4.1.3-2.9.5-4.3-1.3-6.6-.6-.5-1.2-.9-1.7-1.4-.8-.7-.8-.7-1.7-1.5-3-2.6-6.1-5.3-9-8-4.1-3.7-8.2-7.5-12.4-11.1-2.1-1.9-4.3-3.7-6.4-5.6-3.8-3.5-7.7-6.9-11.6-10.3-3-2.6-6-5.3-9-8-2.3-2.1-4.7-4.2-7-6.3-6.5-5.9-13.1-11.9-19.7-18-6.9-6.3-13.8-12.7-20.9-18.9-3.1-2.7-6.2-5.4-9.2-8.2-5.5-5.2-11-10.3-16.7-15.3-.6-.5-1.2-1-1.8-1.6C5.6 3.9 3.1 1.7 0 0Z" transform="translate(178.192626953125, 149.02001953125)" />
        </svg>
        `,
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
}];
