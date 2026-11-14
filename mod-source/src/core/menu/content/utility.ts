// Settings in the utility tab. Plain data: Menu.ts builds the UI from it.
import { IMenuItem } from "../types";
import { CONSOLE_ICON, PACKAGE_ICON, TOMBSTONE_ICON, WIFI_ICON } from "../icons";

export const utilitySettings: IMenuItem[] = [{
    label: "",
    id: "",
    description: `This module offers multiple toggles to customize the general use modules in the script. Click the settings button to adjust sub-settings for each module.`,
    type: "paragraph"
}, {
    label: "Farming / Store Utilities",
    id: "",
    description: "Modules that help automate the annoying parts of the store and grinding.",
    icon: `
        <svg viewBox="0 0 512 512" width="21" height="21">
            <path fill="REPLACE_WITH_COLOR" d="M0 0c-9.4-7.5-17.1-13.1-28.3-5.6-.6.4-1.3.8-1.9 1.2-6.8 4.7-13.5 9.6-20 14.6-2.1 1.6-4.2 3.2-6.3 4.7-8.2 6.2-16.2 12.5-24 19.2-2.5 2.2-5 4.4-7.6 6.5-5.6 4.4-10.8 9-15.9 13.8-3.1 2.9-6 5.8-9.2 8.5-4.2 3.6-8.2 7.4-12.1 11.4-1.5 1.5-2.9 2.9-4.4 4.4-2.3 2.4-4.6 4.7-6.9 7.1-2.3 2.3-4.7 4.7-7 7.1-1.1 1.1-1.1 1.1-2.2 2.2-.7.8-1.4 1.5-2.1 2.2s-1.3 1.4-2 2c-1.6 1.8-1.6 1.8-3.4 3-3.8.3-3.8.3-6.2-.9-1.6-.7-3.2-1.5-4.9-2.2-7.6-2.3-15.5-1.5-22.7 1.7-6.6 3.4-10.9 8.4-13.2 15.4-2 8.2-1.6 15.6 2.6 23 1.6 2.4 1.6 2.4 2.4 5-.9 3.8-2.9 6.3-5.4 9.2-1 1.1-1.9 2.2-2.9 3.3-.5.6-1 1.1-1.5 1.7-8.8 10.3-17.3 20.8-25.6 31.4-1.3 1.7-2.6 3.4-4 5.1-6.9 8.6-13.5 17.5-20 26.4-1.8 2.4-3.6 4.9-5.4 7.4-5.7 7.6-11.4 15.3-17 23.1-.5.7-.9 1.4-1.4 2.1-9 12.7-17.7 25.6-26.3 38.5-.5.7-1 1.4-1.4 2.1-3.3 4.9-6.6 9.9-9.9 14.8-.4.7-.8 1.3-1.2 1.9-6.6 9.9-17 21.6-19.5 33.2-.4 5 1.3 8.1 4.5 11.8 3.4 3.1 6 4.3 10.6 4.4 4-.1 6.9-.9 9.7-3.8 2.2-2.7 4.4-5.3 6.7-7.9 3.2-3.4 6.3-6.8 9.2-10.4 3.7-4.6 7.4-9.1 11.4-13.5 2-2.2 4.1-4.5 6.2-6.8 6.6-7.7 13.4-15.2 20.3-22.6 2.6-2.9 5.3-5.8 7.9-8.7 2.9-3.4 5.8-6.6 9-9.7 1.8-1.8 3.6-3.5 5.2-5.5 8.2-9 8.2-9 16.7-17.6 1.3-1.2 2.5-2.5 3.7-3.7 2.6-2.6 5.2-5.2 7.8-7.7 2.6-2.7 5.3-5.4 8-8 11.6-11.7 23.2-23.4 35-34.8.7-.7 1.4-1.3 2.1-2 2.9-2.8 5.3-5.3 9.3-6.6 2.2-.3 2.2-.3 3.8 1.1.4.6.9 1.2 1.4 1.8.7.9.7.9 1.5 1.8 2.4 2.8 4.8 5.6 7.4 8.2 2.7 2.7 5.4 5.2 7.8 8 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 2.4 2.8 4.7 5.5 7.2 8 2.7 2.6 5.3 5.2 7.8 8 3.1 3.6 6.3 7.1 9.8 10.5 2.8 2.8 5.4 5.6 8 8.6 2.4 2.8 4.9 5.4 7.5 7.9 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 2.4 2.8 4.7 5.5 7.2 8 2.6 2.6 5.2 5.1 7.6 7.8 7.8 9.3 16.7 19.9 27.3 26.1 1.1.6 1.1.6 2.2 1.1 6.3 3.3 12.3 4.4 19.4 4.5 11.5-.1 21.3-3.2 29.6-11.5 8.6-9.6 12.7-20.3 12.2-33.2-1.5-16.2-10.5-26-22.4-36.4-2.7-2.4-5.3-4.8-7.8-7.4-2.6-2.6-5.3-5.1-8-7.5-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.8-2.4-5.5-4.9-8-7.5-2.6-2.6-5.3-5.1-8.1-7.5-2-1.7-3.9-3.4-5.7-5.2-2.4-2.4-4.7-4.8-7.2-7-2.7-2.4-5.5-4.7-8.1-7.2-3.2-3.3-6.4-6.6-9.9-9.6-2.1-1.7-4.1-3.5-6-5.4-2.7-2.7-5.2-5.4-8-7.8-2.9-2.5-5.7-5-8.6-7.5-.8-.8-1.6-1.6-2.4-2.4-2.4-2.1-2.4-2.1-4-4.4-.6-2.6-.6-2.6 0-5 1.5-1 3-2 4.5-3.2.5-.4 1.1-.9 1.6-1.3.6-.5 1.3-1.1 1.9-1.6C-59.1 109.6-19.4 81 24.1 60.1c1.2-.5 1.2-.5 2.4-1.1 1.5-.7 2.9-1.4 4.3-2.1 1.3-.5 2.5-1.1 3.8-1.7 4.1-2.6 6.4-5.5 7.7-10.2.1-.8.2-1.5.2-2.2.1-.7.2-1.4.3-2.1-.2-4.4-1.2-7.4-4.3-10.5-1.3-1.1-1.3-1.1-2.6-2.1-1-.8-2-1.5-3-2.3-1.6-1.2-3.3-2.5-4.9-3.8-2.3-1.8-4.6-3.6-6.9-5.4-3-2.4-6-4.7-9-7.1C9.7 7.6 7.4 5.8 5 4 3.4 2.7 1.7 1.3 0 0Z" transform="translate(339.349609375, 26.67626953125)" />
        </svg>
        `,
    type: "group",
    settings: [{
        label: "Auto Grinding",
        id: "autoGrind",
        neverSave: true,
        description: "Helps with leveling up weapons to higher variants.",
        icon: `
            <svg viewBox="0 0 512 512" width="21" height="21">
                <path fill="REPLACE_WITH_COLOR" d="M0 0c-9.4-7.5-17.1-13.1-28.3-5.6-.6.4-1.3.8-1.9 1.2-6.8 4.7-13.5 9.6-20 14.6-2.1 1.6-4.2 3.2-6.3 4.7-8.2 6.2-16.2 12.5-24 19.2-2.5 2.2-5 4.4-7.6 6.5-5.6 4.4-10.8 9-15.9 13.8-3.1 2.9-6 5.8-9.2 8.5-4.2 3.6-8.2 7.4-12.1 11.4-1.5 1.5-2.9 2.9-4.4 4.4-2.3 2.4-4.6 4.7-6.9 7.1-2.3 2.3-4.7 4.7-7 7.1-1.1 1.1-1.1 1.1-2.2 2.2-.7.8-1.4 1.5-2.1 2.2s-1.3 1.4-2 2c-1.6 1.8-1.6 1.8-3.4 3-3.8.3-3.8.3-6.2-.9-1.6-.7-3.2-1.5-4.9-2.2-7.6-2.3-15.5-1.5-22.7 1.7-6.6 3.4-10.9 8.4-13.2 15.4-2 8.2-1.6 15.6 2.6 23 1.6 2.4 1.6 2.4 2.4 5-.9 3.8-2.9 6.3-5.4 9.2-1 1.1-1.9 2.2-2.9 3.3-.5.6-1 1.1-1.5 1.7-8.8 10.3-17.3 20.8-25.6 31.4-1.3 1.7-2.6 3.4-4 5.1-6.9 8.6-13.5 17.5-20 26.4-1.8 2.4-3.6 4.9-5.4 7.4-5.7 7.6-11.4 15.3-17 23.1-.5.7-.9 1.4-1.4 2.1-9 12.7-17.7 25.6-26.3 38.5-.5.7-1 1.4-1.4 2.1-3.3 4.9-6.6 9.9-9.9 14.8-.4.7-.8 1.3-1.2 1.9-6.6 9.9-17 21.6-19.5 33.2-.4 5 1.3 8.1 4.5 11.8 3.4 3.1 6 4.3 10.6 4.4 4-.1 6.9-.9 9.7-3.8 2.2-2.7 4.4-5.3 6.7-7.9 3.2-3.4 6.3-6.8 9.2-10.4 3.7-4.6 7.4-9.1 11.4-13.5 2-2.2 4.1-4.5 6.2-6.8 6.6-7.7 13.4-15.2 20.3-22.6 2.6-2.9 5.3-5.8 7.9-8.7 2.9-3.4 5.8-6.6 9-9.7 1.8-1.8 3.6-3.5 5.2-5.5 8.2-9 8.2-9 16.7-17.6 1.3-1.2 2.5-2.5 3.7-3.7 2.6-2.6 5.2-5.2 7.8-7.7 2.6-2.7 5.3-5.4 8-8 11.6-11.7 23.2-23.4 35-34.8.7-.7 1.4-1.3 2.1-2 2.9-2.8 5.3-5.3 9.3-6.6 2.2-.3 2.2-.3 3.8 1.1.4.6.9 1.2 1.4 1.8.7.9.7.9 1.5 1.8 2.4 2.8 4.8 5.6 7.4 8.2 2.7 2.7 5.4 5.2 7.8 8 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 2.4 2.8 4.7 5.5 7.2 8 2.7 2.6 5.3 5.2 7.8 8 3.1 3.6 6.3 7.1 9.8 10.5 2.8 2.8 5.4 5.6 8 8.6 2.4 2.8 4.9 5.4 7.5 7.9 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 3 3.5 6 6.8 9.3 10 1.9 2 3.9 3.9 5.7 6 2.4 2.8 4.7 5.5 7.2 8 2.6 2.6 5.2 5.1 7.6 7.8 7.8 9.3 16.7 19.9 27.3 26.1 1.1.6 1.1.6 2.2 1.1 6.3 3.3 12.3 4.4 19.4 4.5 11.5-.1 21.3-3.2 29.6-11.5 8.6-9.6 12.7-20.3 12.2-33.2-1.5-16.2-10.5-26-22.4-36.4-2.7-2.4-5.3-4.8-7.8-7.4-2.6-2.6-5.3-5.1-8-7.5-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.1-1.7-4.1-3.5-6-5.4-3.3-3.3-6.5-6.6-10-9.6-2.8-2.4-5.5-4.9-8-7.5-2.6-2.6-5.3-5.1-8.1-7.5-2-1.7-3.9-3.4-5.7-5.2-2.4-2.4-4.7-4.8-7.2-7-2.7-2.4-5.5-4.7-8.1-7.2-3.2-3.3-6.4-6.6-9.9-9.6-2.1-1.7-4.1-3.5-6-5.4-2.7-2.7-5.2-5.4-8-7.8-2.9-2.5-5.7-5-8.6-7.5-.8-.8-1.6-1.6-2.4-2.4-2.4-2.1-2.4-2.1-4-4.4-.6-2.6-.6-2.6 0-5 1.5-1 3-2 4.5-3.2.5-.4 1.1-.9 1.6-1.3.6-.5 1.3-1.1 1.9-1.6C-59.1 109.6-19.4 81 24.1 60.1c1.2-.5 1.2-.5 2.4-1.1 1.5-.7 2.9-1.4 4.3-2.1 1.3-.5 2.5-1.1 3.8-1.7 4.1-2.6 6.4-5.5 7.7-10.2.1-.8.2-1.5.2-2.2.1-.7.2-1.4.3-2.1-.2-4.4-1.2-7.4-4.3-10.5-1.3-1.1-1.3-1.1-2.6-2.1-1-.8-2-1.5-3-2.3-1.6-1.2-3.3-2.5-4.9-3.8-2.3-1.8-4.6-3.6-6.9-5.4-3-2.4-6-4.7-9-7.1C9.7 7.6 7.4 5.8 5 4 3.4 2.7 1.7 1.3 0 0Z" transform="translate(339.349609375, 26.67626953125)" />
            </svg>
            `,
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
        type: "toggle",
        status: false
    }, {
        label: "Auto Buy",
        id: "autoBuy",
        description: "Automatically purchases hats and accessories.",
        settings: [{
            label: "Fight-First Order",
            id: "autoBuy:fightFirst",
            description: "Buys fight hats first (Monkey Tail, Soldier, Bull, Booster, EMP...) and picks up cheaper items while saving for an expensive one. Also buys Angel Wings and Blood Wings. Off: the original order, one item at a time.",
            type: "toggle",
            status: false
        }],
        icon: `
            <svg viewBox="0 0 512 512" width="21" height="21">
                <path fill="REPLACE_WITH_COLOR" d="M0 0C-4.9 0-9.2 0-13.6 2.3c-4.6 3.1-8.3 6.6-10 12-.4 5.8-1.2 12 2.4 16.9.6.7 1.2 1.4 1.8 2.1C-15.8 37.6-12 40-6.3 40.7c1.2-.1 2.4-.1 3.6-.1 2.1 0 4.2 0 6.3 0 1.5 0 3 0 4.5 0 3.9 0 7.9-.1 11.8-.1 4.1 0 8.1 0 12.2-.1 7.9 0 15.8 0 23.7-.1 1.3 0 1.3 0 2.6 0 0 3 .5 5.5 1.1 8.4.4 1.5.8 3.1 1.1 4.6.2.9.4 1.7.6 2.6 1 4.6 2 9.3 3 13.9.3 1 .5 2 .7 3 .4 2.1.9 4.3 1.3 6.4.8 3.4 1.5 6.9 2.3 10.3 2 9.7 4.1 19.4 6.2 29 2 9.6 4.1 19.1 6.1 28.7.3 1 .3 1 .5 2 4 18.7 8 37.4 12.1 56.1.8 3.6 1.6 7.3 2.3 10.9.3 1.2.6 2.4.8 3.6.5 2.3 1 4.6 1.5 7 1.5 6.7 2.9 13.3 4.4 20 .9 4.2 1.8 8.4 2.7 12.6.5 2 .9 3.9 1.3 5.9 2.1 9.7 6.9 22.3 4.1 32.1-.5.9-1 1.8-1.5 2.7-.8 1.5-.8 1.5-1.5 3-5.2 9.2-12.4 19.7-13.4 30.4-.1 6.1.4 10.1 4.5 14.8 6.1 6.7 11.4 7.4 20.2 7.9.9 0 1.7.1 2.6.1-6.8 2.5-11.9 5.8-17 11-8 8.7-10.6 18.2-10.4 29.9.4 11.1 4.7 19.7 12.8 27.4.9.6 1.7 1.1 2.6 1.7 6.7 4.8 13.2 7.7 21.6 8.2 12.1.1 22.4-2.6 31.4-11.2 10.5-12.2 11.8-22.4 11-38-3.1-9.4-7.5-16.7-15-23-3.8-2-7.4-4-11-6 84.6 0 166.8 0 249 0-2.7 1.4-5.4 2.7-8 4-8.9 6.4-15.3 14-17.9 24.8-2.2 12.2-.6 23.1 6.4 33.5 6.5 7.9 15.2 14.1 25.5 15.7 11 .6 22.4-.1 31.3-7.4 1.4-1.3 1.4-1.3 2.7-2.6 2.3-2.1 4.4-4.2 6.3-6.8 7-10.3 8.1-21.7 6.1-33.9-5.3-12.8-11.9-20.6-24.5-26.5-.7-.3-1.3-.5-1.9-.8.9-.1 1.8-.1 2.7-.2 1.8-.1 1.8-.1 3.5-.2 3.3-.2 6-.3 9-1.5 5.9-3.6 9.8-7.5 11.8-14.1.5-5.3.6-10.2-2.1-14.9-.5-.7-1-1.4-1.5-2-.4-.7-.9-1.4-1.4-2.1-5.4-5.4-11.1-6.5-18.6-6.5-1.1 0-2.2 0-3.3 0-3.7 0-7.5 0-11.3 0-3.4 0-6.9 0-10.4 0-6 0-12 0-18 .1-8.8 0-17.6 0-26.4 0-14.2 0-28.4 0-42.6.1-13.9 0-27.8.1-41.6.1-.9 0-1.8 0-2.6 0-4.3 0-8.6 0-12.9 0-35.8 0-71.7.1-107.5.2-.6 0-1.2 0-1.8 0 4.1-8.2 8.1-15.8 6.5-25.1-.3-2-.7-4-1-6.1-.2-1-.4-2.1-.6-3.1-.3-1.9-.6-3.8-.9-5.7 39.3-4.6 78.6-9.1 117.9-13.7 4.7-.6 9.4-1.1 14.2-1.7 1.4-.1 1.4-.1 2.8-.3 15.3-1.8 30.7-3.6 46-5.4 15.7-1.8 31.5-3.6 47.3-5.5 9.7-1.1 19.4-2.2 29.1-3.3 6.8-.8 13.5-1.6 20.2-2.4 3.9-.4 7.8-.9 11.6-1.3 3.6-.5 7.2-.9 10.8-1.3 1.4-.2 2.7-.3 4-.5 10-1.1 21.5-1 29.1-8.6 4.6-6.7 4.6-6.7 4.5-22 0-1.7 0-3.3 0-4.9 0-4.4 0-8.8 0-13.3 0-4.7 0-9.4 0-14.1 0-7.8 0-15.7 0-23.6-.1-9.1-.1-18.3-.1-27.5 0-8.9 0-17.7 0-26.6 0-3.8 0-7.6 0-11.3 0-4.5 0-9.1 0-13.6 0-1.6 0-3.3 0-4.9 0-2.4 0-4.7 0-7 0-1 0-1 0-2.1 0-6.7-1.3-11-6.1-15.8-7.5-5.7-15.1-5.7-24.2-5.7-1.5 0-3 0-4.5 0-4.1 0-8.2 0-12.3 0-4.6 0-9.1.1-13.6.1-7.8-.1-15.6 0-23.4 0-11.4 0-22.8 0-34.1 0-18.5 0-36.9 0-55.4.1-18 0-36 0-53.9 0-1.2 0-2.3 0-3.4 0-5.6 0-11.2 0-16.7 0-46.5.1-93 .1-139.4.2-.8 0-1.6 0-2.4 0-.1-.6-.1-1.2-.2-1.8-.1-.8-.2-1.6-.3-2.4-1-10.1-2.8-20.6-8.6-29C85.5 1.7 80.2-.2 73.8-.2c-.8 0-1.6 0-2.4 0-2.7 0-5.5 0-8.2 0-1.9 0-3.9 0-5.8 0-4.1 0-8.2 0-12.2.1-5.3 0-10.6 0-15.8 0-4.2 0-8.3 0-12.4 0-2 0-4 0-5.9.1C8.2 0 5.4 0 2.6 0 1.3 0 1.3 0 0 0Z" transform="translate(23.610595703125, 38.70947265625)" />
            </svg>
            `,
        type: "toggle",
        status: true
    }, {
        label: "Auto Upgrade",
        id: "autoUpgrade",
        description: "Automatically upgrades weapons and items.",
        icon: `
            <svg viewBox="0 0 512 512" width="21" height="21">
                <path fill="REPLACE_WITH_COLOR" d="M0 0C-4.9 0-9.2 0-13.6 2.3c-4.6 3.1-8.3 6.6-10 12-.4 5.8-1.2 12 2.4 16.9.6.7 1.2 1.4 1.8 2.1C-15.8 37.6-12 40-6.3 40.7c1.2-.1 2.4-.1 3.6-.1 2.1 0 4.2 0 6.3 0 1.5 0 3 0 4.5 0 3.9 0 7.9-.1 11.8-.1 4.1 0 8.1 0 12.2-.1 7.9 0 15.8 0 23.7-.1 1.3 0 1.3 0 2.6 0 0 3 .5 5.5 1.1 8.4.4 1.5.8 3.1 1.1 4.6.2.9.4 1.7.6 2.6 1 4.6 2 9.3 3 13.9.3 1 .5 2 .7 3 .4 2.1.9 4.3 1.3 6.4.8 3.4 1.5 6.9 2.3 10.3 2 9.7 4.1 19.4 6.2 29 2 9.6 4.1 19.1 6.1 28.7.3 1 .3 1 .5 2 4 18.7 8 37.4 12.1 56.1.8 3.6 1.6 7.3 2.3 10.9.3 1.2.6 2.4.8 3.6.5 2.3 1 4.6 1.5 7 1.5 6.7 2.9 13.3 4.4 20 .9 4.2 1.8 8.4 2.7 12.6.5 2 .9 3.9 1.3 5.9 2.1 9.7 6.9 22.3 4.1 32.1-.5.9-1 1.8-1.5 2.7-.8 1.5-.8 1.5-1.5 3-5.2 9.2-12.4 19.7-13.4 30.4-.1 6.1.4 10.1 4.5 14.8 6.1 6.7 11.4 7.4 20.2 7.9.9 0 1.7.1 2.6.1-6.8 2.5-11.9 5.8-17 11-8 8.7-10.6 18.2-10.4 29.9.4 11.1 4.7 19.7 12.8 27.4.9.6 1.7 1.1 2.6 1.7 6.7 4.8 13.2 7.7 21.6 8.2 12.1.1 22.4-2.6 31.4-11.2 10.5-12.2 11.8-22.4 11-38-3.1-9.4-7.5-16.7-15-23-3.8-2-7.4-4-11-6 84.6 0 166.8 0 249 0-2.7 1.4-5.4 2.7-8 4-8.9 6.4-15.3 14-17.9 24.8-2.2 12.2-.6 23.1 6.4 33.5 6.5 7.9 15.2 14.1 25.5 15.7 11 .6 22.4-.1 31.3-7.4 1.4-1.3 1.4-1.3 2.7-2.6 2.3-2.1 4.4-4.2 6.3-6.8 7-10.3 8.1-21.7 6.1-33.9-5.3-12.8-11.9-20.6-24.5-26.5-.7-.3-1.3-.5-1.9-.8.9-.1 1.8-.1 2.7-.2 1.8-.1 1.8-.1 3.5-.2 3.3-.2 6-.3 9-1.5 5.9-3.6 9.8-7.5 11.8-14.1.5-5.3.6-10.2-2.1-14.9-.5-.7-1-1.4-1.5-2-.4-.7-.9-1.4-1.4-2.1-5.4-5.4-11.1-6.5-18.6-6.5-1.1 0-2.2 0-3.3 0-3.7 0-7.5 0-11.3 0-3.4 0-6.9 0-10.4 0-6 0-12 0-18 .1-8.8 0-17.6 0-26.4 0-14.2 0-28.4 0-42.6.1-13.9 0-27.8.1-41.6.1-.9 0-1.8 0-2.6 0-4.3 0-8.6 0-12.9 0-35.8 0-71.7.1-107.5.2-.6 0-1.2 0-1.8 0 4.1-8.2 8.1-15.8 6.5-25.1-.3-2-.7-4-1-6.1-.2-1-.4-2.1-.6-3.1-.3-1.9-.6-3.8-.9-5.7 39.3-4.6 78.6-9.1 117.9-13.7 4.7-.6 9.4-1.1 14.2-1.7 1.4-.1 1.4-.1 2.8-.3 15.3-1.8 30.7-3.6 46-5.4 15.7-1.8 31.5-3.6 47.3-5.5 9.7-1.1 19.4-2.2 29.1-3.3 6.8-.8 13.5-1.6 20.2-2.4 3.9-.4 7.8-.9 11.6-1.3 3.6-.5 7.2-.9 10.8-1.3 1.4-.2 2.7-.3 4-.5 10-1.1 21.5-1 29.1-8.6 4.6-6.7 4.6-6.7 4.5-22 0-1.7 0-3.3 0-4.9 0-4.4 0-8.8 0-13.3 0-4.7 0-9.4 0-14.1 0-7.8 0-15.7 0-23.6-.1-9.1-.1-18.3-.1-27.5 0-8.9 0-17.7 0-26.6 0-3.8 0-7.6 0-11.3 0-4.5 0-9.1 0-13.6 0-1.6 0-3.3 0-4.9 0-2.4 0-4.7 0-7 0-1 0-1 0-2.1 0-6.7-1.3-11-6.1-15.8-7.5-5.7-15.1-5.7-24.2-5.7-1.5 0-3 0-4.5 0-4.1 0-8.2 0-12.3 0-4.6 0-9.1.1-13.6.1-7.8-.1-15.6 0-23.4 0-11.4 0-22.8 0-34.1 0-18.5 0-36.9 0-55.4.1-18 0-36 0-53.9 0-1.2 0-2.3 0-3.4 0-5.6 0-11.2 0-16.7 0-46.5.1-93 .1-139.4.2-.8 0-1.6 0-2.4 0-.1-.6-.1-1.2-.2-1.8-.1-.8-.2-1.6-.3-2.4-1-10.1-2.8-20.6-8.6-29C85.5 1.7 80.2-.2 73.8-.2c-.8 0-1.6 0-2.4 0-2.7 0-5.5 0-8.2 0-1.9 0-3.9 0-5.8 0-4.1 0-8.2 0-12.2.1-5.3 0-10.6 0-15.8 0-4.2 0-8.3 0-12.4 0-2 0-4 0-5.9.1C8.2 0 5.4 0 2.6 0 1.3 0 1.3 0 0 0Z" transform="translate(23.610595703125, 38.70947265625)" />
            </svg>
            `,
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
        }, {
            label: "Age 2 Pick",
            id: "upgradeAge2",
            type: "select",
            description: "Your primary weapon at age 2. Manual: you pick (Auto Upgrade used to leave this age to you).",
            options: [{ label: "Manual", value: -1 }, { label: "Hand Axe", value: 1 }, { label: "Short Sword", value: 3 }, { label: "Polearm", value: 5 }, { label: "Bat", value: 6 }, { label: "Daggers", value: 7 }, { label: "Stick", value: 8 }],
            status: -1
        }, {
            label: "Age 6 Pick",
            id: "upgradeAge6",
            type: "select",
            description: "Your secondary weapon at age 6. Manual: you pick.",
            options: [{ label: "Manual", value: -1 }, { label: "Hunting Bow", value: 9 }, { label: "Great Hammer", value: 10 }, { label: "Wooden Shield", value: 11 }, { label: "McGrabby", value: 14 }],
            status: -1
        }, {
            label: "Age 8 Pick",
            id: "upgradeAge8",
            type: "select",
            description: "At age 8 (each needs what it upgrades: great axe the hand axe, katana the short sword, crossbow the hunting bow, power mill the faster windmill). Manual: you pick.",
            options: [{ label: "Manual", value: -1 }, { label: "Great Axe", value: 2 }, { label: "Katana", value: 4 }, { label: "Crossbow", value: 12 }, { label: "Power Mill", value: 28 }],
            status: -1
        }, {
            label: "Age 9 Pick",
            id: "upgradeAge9",
            type: "select",
            description: "At age 9 (repeater and musket need the crossbow, poison and spinning spikes the greater spikes). Manual: you pick.",
            options: [{ label: "Manual", value: -1 }, { label: "Repeater Crossbow", value: 13 }, { label: "Musket", value: 15 }, { label: "Poison Spikes", value: 24 }, { label: "Spinning Spikes", value: 25 }, { label: "Spawn Pad", value: 36 }],
            status: -1
        }, {
            label: "Spend Every Point",
            id: "upgradeSpendAll",
            type: "toggle",
            description: "Never leave an upgrade point unspent: when an age's pick isn't offered it takes the first offered upgrade (buildings before weapons); an age set to Manual is picked the same way when only buildings are offered, or after the wait below when weapons are and you haven't picked.",
            status: false
        }, {
            label: "Manual Pick Wait",
            id: "upgradeManualWait",
            type: "slider",
            description: "With Spend Every Point: seconds to wait for your own pick at a Manual age before Auto Upgrade picks.",
            min: 3,
            max: 30,
            status: 10
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
        label: "Send Movement Instantly",
        id: "sendMovementInstantly",
        description: "Sends a new walking direction the moment you press or release a movement key, instead of with the next server tick (about 55 ms sooner on average). Only while your keys steer (not during one ticks or auto push), Safe Walk still applies, and it waits for the next tick as before when the packet budget is full.",
        icon: WIFI_ICON,
        type: "toggle",
        status: false
    }, {
        label: "Jitter-Safe Timing",
        id: "jitterSafeTiming",
        description: "When your ping jumps around, leaves room for it in the three timings that use ping: preplacements are sent later by the jitter (late still places, early fails), the check that a heal of ours was food waits longer, and the packet budget counts older packets a little longer. No effect on a steady connection.",
        icon: WIFI_ICON,
        type: "toggle",
        status: false
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
    icon: `
        <svg viewBox="0 0 360 360" width="29" height="29">
            <path fill="REPLACE_WITH_COLOR" d="M0 0C-12.5-8.7-30.4 1.8-39.4 11c-2.5 2.8-4.6 4.8-8.1 6.3-2-1.9-3.6-3.7-6-5-3 .2-4.7.7-7.1 2.5-.7.7-1.3 1.4-2 2.1-.8.8-1.6 1.5-2.4 2.3s-1.6 1.7-2.5 2.5c-1.7 1.7-3.5 3.5-5.2 5.2-2.8 2.8-5.5 5.6-8.3 8.3-1.8 1.8-3.6 3.6-5.4 5.4-.9.9-1.8 1.7-2.6 2.6-.9.8-1.7 1.7-2.5 2.5-.8.8-1.6 1.6-2.4 2.3-2.5 2.6-3.5 3.9-4.4 7.4-.2 2.9-.2 2.9 1.2 5 1.7 1.8 1.7 1.8 2.4 3.8.5 2.2.5 2.2-1.2 3.9-1.5 1.3-2.9 2.6-4.3 3.9-8.2 8.2-13.4 18.1-13.7 29.8.1 5 1.1 7.2 4.7 10.8 1.8 1.8 3.5 3.5 5.3 5.2 1.9 1.9 3.8 3.9 5.6 5.8 1.1 1 2.1 2 3.1 3.1 3 3 6 6 9 8.9.9.9 1.8 1.8 2.7 2.7 3.6 3.5 6.3 6.6 11.2 7.7 1 0 1.9-.1 2.9-.2 10-.6 17.9-4 25.7-10.2.5-.4 1.1-.9 1.6-1.3 2.7-2.2 5.2-4.3 7-7.3.2-.6.4-1.2.6-1.7 1 .3 2 .6 3 1 2.3 2.1 2.3 2.1 5 4 3.4-.2 5.5-.6 8.2-2.6.7-.7 1.4-1.4 2.1-2 1.2-1.2 1.2-1.2 2.3-2.4.9-.8 1.7-1.6 2.5-2.5 1.8-1.7 3.5-3.5 5.3-5.2 2.7-2.8 5.4-5.6 8.2-8.3 1.8-1.8 3.6-3.6 5.4-5.4.9-.9 1.8-1.8 2.6-2.6.9-.9 1.7-1.7 2.5-2.5 1.2-1.2 1.2-1.2 2.3-2.4 2.3-2.3 3.5-3.7 4.4-6.8.2-2.3.2-2.3-.8-4-1.4-1.4-2.7-2.8-4-4.3.8-3.1.8-3.1 3.1-5.2 9.1-8.5 16-17.8 17.2-30.5.1-5.5-.2-9-3.9-13.2-.7-.7-1.4-1.3-2-1.9-2.1-2.1-4.2-4-6.4-5.9-2.8-2.5-5.6-4.9-8.1-7.7C9.8 9.7 5.2 4.6 0 0Z" transform="translate(158.48046875, 47.72265625)" />
            <path fill="REPLACE_WITH_COLOR" d="M0 0C-2.8 0-2.8 0-6.6 3.7c-.5.6-1.1 1.1-1.6 1.7-1.2 1.2-2.3 2.3-3.5 3.5-1.8 1.9-3.6 3.7-5.5 5.5-1.2 1.2-2.4 2.4-3.6 3.6-.6.6-1.1 1.2-1.7 1.7-2.8 2.8-5.3 5.1-6.6 8.9 0 2.3 0 2.3 1.6 4.7 1.2 1.3 1.2 1.3 2.4 2.5 1.2 1.3 1.2 1.3 2.3 2.6 3.8 4.1 7.6 8.2 11.2 12.4 3.3 3.8 6.7 7.6 10.1 11.4C-.3 63.7-.3 63.7.8 65c4.8 5.4 9.7 10.8 14.6 16.1 2.4 2.6 4.8 5.2 7.1 7.9 3.3 3.8 6.7 7.5 10.1 11.2 5.8 6.2 11.5 12.4 16.9 18.9 3 3.5 5.9 6.9 9 10.3 2 2.2 4 4.4 5.9 6.6 3.4 3.9 6.8 7.7 10.2 11.5 2.3 2.6 4.7 5.1 6.9 7.8 3.5 4.1 7.2 9.1 12.1 11.7 2.6-.3 3.9-.9 6-2.6.7-.7 1.4-1.4 2.1-2 1.2-1.2 1.2-1.2 2.4-2.3.9-.9 1.7-1.7 2.5-2.5 1.8-1.7 3.5-3.5 5.3-5.3 2.8-2.8 5.5-5.6 8.3-8.3 1.8-1.8 3.6-3.6 5.5-5.4.9-.9 1.7-1.7 2.6-2.6.9-.8 1.7-1.7 2.5-2.5 1.2-1.2 1.2-1.2 2.3-2.4 2.1-2.1 2.1-2.1 3.5-4.1.3-2.9.5-4.3-1.3-6.6-.6-.5-1.2-.9-1.7-1.4-.8-.7-.8-.7-1.7-1.5-3-2.6-6.1-5.3-9-8-4.1-3.7-8.2-7.5-12.4-11.1-2.1-1.9-4.3-3.7-6.4-5.6-3.8-3.5-7.7-6.9-11.6-10.3-3-2.6-6-5.3-9-8-2.3-2.1-4.7-4.2-7-6.3-6.5-5.9-13.1-11.9-19.7-18-6.9-6.3-13.8-12.7-20.9-18.9-3.1-2.7-6.2-5.4-9.2-8.2-5.5-5.2-11-10.3-16.7-15.3-.6-.5-1.2-1-1.8-1.6C5.6 3.9 3.1 1.7 0 0Z" transform="translate(178.192626953125, 149.02001953125)" />
        </svg>
        `,
    type: "toggle",
    settings: [{
        label: "Restore Weapon After Break",
        id: "autoBreak:restoreWeapon",
        description: "Once the trap is gone and your weapons are reloaded, switches back to the weapon you held before breaking. Off (classic): you keep holding the breaking weapon (usually the great hammer). Does nothing while \"Always Pick Best Weapon\" is on, which picks your weapon itself.",
        type: "toggle",
        status: false
    }, {
        label: "Break Traps From Any Angle",
        id: "trapBreakAnyAngle",
        description: "While trapped, turns the swing to hit as many enemy spikes and traps at once as possible (a swing hits everything in reach within about 69 degrees of the aim), while still hitting every enemy spike and trap the usual aim hits. Avoids hitting your own buildings when it can. Only while trapped.",
        type: "toggle",
        status: false
    }],
    status: true
}, {
    id: "autoRespawn",
    label: "Auto Respawn",
    icon: TOMBSTONE_ICON,
    description: "Automatically respawns when you die.",
    type: "toggle",
    status: false
}, {
    label: "Aim With Mouse While Gathering",
    id: "mouseAimWhileGathering",
    description: "With auto-gather on (E), swings toward your mouse. Off: Falcon doesn't send your mouse direction in normal play, so the swings go wherever it was last aiming.",
    type: "toggle",
    status: false
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
    icon: `
        <svg width="25" height="25" viewBox="0 0 100 100">
            <polygon fill="REPLACE_WITH_COLOR" points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" />
        </svg>
        `,
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
}];
