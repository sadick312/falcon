// Settings in the visual tab. Plain data: Menu.ts builds the UI from it.
import { IMenuItem } from "../types";
import { BUILDING_ICON, CONSOLE_ICON, GRID_ICON, MOON_ICON, NAME_TAG_ICON, PACKAGE_ICON, SHAME_HAT_ICON, SPIEK_ICON, STACKED_ICON } from "../icons";

export const visualSettings: IMenuItem[] = [{
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
        icon: `
            <svg viewBox="0 0 200 200" width="27" height="27">
                <g fill="REPLACE_WITH_COLOR" transform="translate(0, 200) scale(0.1, -0.1)" stroke="none">
                    <path d="M276 1285c-56-20-113-80-137-145-17-46-20-72-17-160 3-95 6-110 34-160 18-32 49-68 73-85l43-30 706-3c500-2 718 0 745 8 55 16 120 85 142 149 13 41 16 76 13 159-4 117-20 161-74 216-65 64-19 61-789 63-579 2-707 0-739-12zm112-141c21-14 22-22 22-141 0-143-8-163-67-163-62 0-73 24-73 155 0 110 1 117 25 140 28 29 61 32 93 9zm190 0c21-14 22-22 22-141 0-104-3-130-17-145-20-22-71-24-101-2-21 14-22 22-22 138 0 123 6 147 40 159 28 10 55 7 78-9zm199-11c9-11 13-57 13-139 0-116-1-124-22-138-29-21-77-20-100 1-16 14-18 33-18 144 0 121 1 129 23 144 27 20 86 13 104-12zm178 2c24-23 25-30 25-140 0-130-11-155-72-155-60 0-68 18-68 161 0 121 1 129 22 143 32 23 65 20 93-9zm183 9c21-14 22-22 22-149 0-123-2-135-19-145-25-13-67-13-92 0-17 10-19 22-19 145 0 127 1 135 22 149 12 9 32 16 43 16s31-7 43-16zm190 0c21-14 22-22 22-141 0-104-3-130-17-145-22-24-77-24-103 2-18 18-20 33-20 139 0 117 1 120 26 140 32 25 61 27 92 5z"/>
                </g>
            </svg>
            `,
        settings: [{
            label: "Always Show",
            type: "toggle",
            id: "buildingHealthAlwaysShow",
            description: "Render health bars regardless if the object has taken damage or not.",
            status: false
        }],
        type: "toggle",
        status: true
    }, {
        label: "Draw Building Overlay",
        id: "buildingOverlay",
        description: "Draws indicators that tell if a building is friendly or not.",
        icon: `
            <svg viewBox="0 0 500 500" width="29" height="29">
                <path fill="REPLACE_WITH_COLOR" d="M0 0C-9.5-4.7-17.7-5.4-27.3-1.2-29.2-.4-31.1.4-33 1.2-39.5 3.8-45.7 6.8-52 10c-4.7 2.4-9.3 4.8-14.1 7.1-.6.3-1.3.6-1.9.9-9.7 4.8-18.3 5.7-29 5.9-1.3 0-2.7 0-4 .1-1 1-1 1-1.8 3.5-2.6 8.7-5.4 17.3-8.3 25.9-.2.6-.4 1.3-.7 1.9-1 3.3-2.1 6.6-3.2 9.8-2.3 6.7-4.5 13.4-6.8 20.2-1.7 5.1-3.4 10.3-5.2 15.5-.3.9-.6 1.8-.9 2.7-.5 1.6-1.1 3.3-1.6 4.9-1.4 4.1-2.8 8.2-3.5 12.6 1.6.8 3.2 1.6 4.7 2.4.7.4 1.3.7 2 1 4 2.1 7.7 4 12.3 4.6 2.8-3.2 5.5-6.3 8-9.8 3.6-5.1 6.3-9.4 12-12.2 6.5-2.9 13.7-3.1 20.4-.6 1.2.5 2.4 1.1 3.6 1.6 3.6 1.4 4.4 2.5 6 6 1.6 4 2.4 8.1 6.2 10.3 2.7.6 2.7.6 4.7 1.5 5.8 2.7 9.8 5.7 12 11.7.7 1.8 1.3 3.6 2 5.4 1.1 2.1 1.1 2.1 4.3 3.4 3.6.5 3.6.5 5.9 1.7 5.2 3.1 8.8 6.2 10.6 12.3.4 1.6.8 3.2 1.3 4.8 1 1.9 1 1.9 4.2 3.2 5.9 1.1 10 3.3 13.6 8.1 5.6 8.7 4.5 16.8 2.6 26.5-.2 1-.2 1-.4 2.1 1.3 1 2.7 2 4 3 5.8 3.8 11.1 5.2 18 4 5-2.8 8.2-7.4 9.9-12.9.1-3.1.1-3.1-1.5-5.5-.9-.8-1.7-1.6-2.5-2.4-.9-.9-1.8-1.7-2.7-2.6-1.4-1.3-1.4-1.3-2.8-2.7-1.9-1.7-3.7-3.5-5.5-5.2-1.6-1.6-3.3-3.1-4.9-4.7-2.2-2.2-4.3-4.4-6.7-6.4-3.4-2.5-5.1-4.5-6.3-8.6 5.8 1.9 10.2 6.9 14.1 11.6 2 2.4 4 4.4 6.4 6.4 1.8 1.5 3.5 3 5 4.7 5.4 6.5 10.9 12.7 19.5 14.3 5.6.1 9.7-.2 14-4 2.9-3.5 3.8-6.9 3.8-11.3-1.3-4.5-1.3-4.5-10.6-13.2-1.1-1.1-2.2-2.1-3.3-3.2-5.1-5-10.3-9.8-15.7-14.4-.6-.5-1.3-1-1.9-1.5-1.6-1.4-1.6-1.4-1.3-4.4 2.1-.2 2.1-.2 3.4 1.3 1.6 1.7 1.6 1.7 3.2 3.1 2.5 2 4.8 3.9 6.9 6.3 2.7 3.3 5.4 6.2 8.6 8.9 1.3 1.1 2.6 2.3 3.9 3.4.9.8 1.7 1.7 2.5 2.5.9.8 1.7 1.7 2.5 2.5 2.5 2.6 5 5 8 7 5.2.9 8.7 0 13-3 4.3-4.9 6.6-9.6 7.3-16.1-.3-1.9-.3-1.9-1.6-3.5-1.7-1.4-3-3-4.4-4.7-1.5-1.8-3-3.5-4.8-5-3.9-3.3-7.7-6.7-11.3-10.3-.7-.7-1.3-1.3-1.9-2-4-3.9-7.7-7.4-10.3-12.4 3-.3 3-.3 5 1.7.8.8 1.5 1.5 2.3 2.3s1.6 1.7 2.5 2.5c.9.9 1.7 1.8 2.6 2.7 3.2 3.3 6.4 6.5 9.6 9.8 1.6 1.7 3.3 3.4 5 5 .7 0 1.3 0 2 0 0 .7 0 1.3 0 2 .7 0 1.3 0 2 0 0 .7 0 1.3 0 2 .7 0 1.3 0 2 0 0 .7 0 1.3 0 2 4.1 2.7 7.2 2.6 12 2 5.5-2.5 8.6-6.6 11-12 .5-4.5.2-8-2-12-1-.3-2-.7-3-1 0-.7 0-1.3 0-2-1.4-.7-2.7-1.3-4-2 0-.7 0-1.3 0-2-.9-.8-1.8-1.6-2.7-2.3-11.2-9.7-11.2-9.7-22-19.9-.7-.8-1.5-1.5-2.2-2.2-2.7-2.5-5.4-5-8.1-7.6-2.4-2.4-4.8-4.8-7.3-7.1C59.5 84 57.2 82 55 80c-1.7-1.7-3.3-3.3-5-5-2.7-2.2-5.4-4.5-8-6.9-.7-.7-1.4-1.4-2.1-2.1-1.5-1.4-3-2.8-4.5-4.2-.7-.8-1.5-1.5-2.2-2.3-.8-.7-1.5-1.4-2.2-2.1-2-1.9-2-1.9-4-3.4-3.1-.9-4.4-1.3-7.4 0-7 4.3-14.3 7.8-21.8 11.2-.6.3-1.2.5-1.8.8-5.1 2.3-10.3 4.4-15.6 6.2C-34.2 76.5-47.3 76.3-61 69c0-2 0-2-1.4-3.4-1.6-1.5-1.6-1.5-2.8-3.3-4-8.1-4.1-17.6-1.9-26.2.7-3.2.7-3.2 3.1-4.1 4.3-1.8 8.6-3.7 12.9-5.8 1.4-.6 2.9-1.3 4.4-2 .7-.4 1.5-.7 2.3-1.1 2.6-1.3 5.3-2.5 8-3.8 1.2-.5 2.3-1.1 3.5-1.6 3.6-1.7 7.2-3.4 10.9-5 1.1-.5 2.2-1 3.2-1.5 2.3-1 4.5-2 6.7-2.9 1.1-.5 2.2-1 3.2-1.5 1.6-.7 1.6-.7 3.1-1.3 1.4-.7 1.4-.7 2.7-1.3C-1 3-1 3 0 0Z" transform="translate(240,163)"/>
                <path fill="REPLACE_WITH_COLOR" d="M0 0C-14.5-10.7-32-7.7-47.3-.8-48.5-.3-49.6.2-50.7.8-54.2 2.3-57.6 3.9-61 5.4-62.2 6-63.3 6.5-64.4 7c-5.4 2.5-10.8 5-16.2 7.5-5.9 2.7-11.7 5.3-17.5 8-.9.4-1.8.8-2.7 1.2-3.9 1.7-7.7 3.5-11.6 5.2-2.6 1-5.1 2.2-7.7 3.4-.7.4-1.5.8-2.2 1.2-2.3 1.2-2.3 1.2-4.1 2.5-1.8 5.4-1.8 11.6-.5 17.2 2.3 6 6.3 9.5 12 12.1 10.6 3.9 21.1 1.5 31.3-2.3 1-.4 1-.4 2-.8 7.3-2.8 14.5-5.7 21.4-9.4.8-.4 1.6-.9 2.5-1.3 1.7-.9 3.4-1.8 5.1-2.7 5-2.8 9.3-5.3 15.2-5.8 0 .7 0 1.3 0 2 2.3 2.1 4.5 3.8 7.3 5.3.6.2 1.1.5 1.7.7 0 .7 0 1.3 0 2 3.3 3.7 6.9 6.9 11.3 9.3.6.2 1.1.5 1.7.7 0 .7 0 1.3 0 2 .5.4 1 .8 1.5 1.2 2.3 1.7 4 3.4 6 5.4 1.8 1.9 3.3 3.3 5.7 4.6.6.3 1.2.5 1.8.8 0 .7 0 1.3 0 2 2.9 1.8 2.9 1.8 4.8 3.6.7.7 1.3 1.3 2 1.9 1.1 1.1 1.1 1.1 2.2 2.1.8.8 1.6 1.5 2.3 2.2 3.5 3.2 6.9 6.4 10.2 9.8 3.4 3.3 6.6 6.4 10.8 8.7.6.2 1.1.5 1.7.7 0 2 0 2 1.8 3.9.8.7 1.6 1.5 2.4 2.2 2.3 2.1 2.3 2.1 4.8 3.9 5.7 1.8 5.7 1.8 27-5 .1-3.5 0-6.7-.7-10.2-.5-1.8-.9-3.7-1.4-5.5-.2-.8-.4-1.5-.6-2.2-1.3-4.9-2.5-9.8-3.8-14.7-.3-1.1-.6-2.3-.8-3.5-1.8-7-3.6-14.1-5.2-21.2-.1-.7-.3-1.4-.4-2.1-.8-3.5-1.6-6.9-2.3-10.3-1.5-7-3.1-13.7-5.8-20.3-19.4-2.3-30.7-9.3-46-21C1.7 1.3.8.7 0 0Z" transform="translate(305.43359375,164.99609375)"/>
                <path fill="REPLACE_WITH_COLOR" d="M0 0C4.2.9 8.1 2.1 12.1 3.5c1.6.5 3.2 1.1 4.8 1.6.8.3 1.6.6 2.4.8 2.6.9 5.1 1.7 7.6 2.6.9.2 1.7.5 2.5.8 1.6.5 3.2 1 4.8 1.5 5.4 1.8 5.4 1.8 7.6 4 .4 4.9-.3 8.6-2 13.1-2.3 6.1-4.4 12.2-6.5 18.4C31 53.4 28.6 60.5 26 67.5c-.9 2.5-1.7 5-2.4 7.6-2.2 7.2-4.6 14.2-7 21.3-.6 1.7-1.1 3.3-1.7 4.9-.7 2.4-1.5 4.7-2.4 7.1-.2.7-.4 1.4-.7 2.2-1.7 5.1-1.7 5.1-4 6.2-8.4.9-15.7-1.8-23.5-4.5-2.3-.8-4.6-1.5-6.8-2.2-1.5-.5-2.9-1-4.4-1.5-.6-.2-1.3-.5-2-.7-4-1.4-6.7-2.8-9.3-6.1-.1-7.2 2.9-13.9 5.2-20.6 1.7-4.8 3.2-9.6 4.8-14.4.7-1.9 1.3-3.9 2-5.8 1-3.2 2.1-6.4 3.2-9.6.8-2.5 1.6-5 2.4-7.4 1-3 2-6 3-8.9 1.4-4.2 2.8-8.4 4.2-12.6.6-1.7 1.2-3.4 1.7-5.1.9-2.6 1.7-5.1 2.6-7.6.4-1.2.4-1.2.7-2.4C-5.7-.4-5.7-.4 0 0Z" transform="translate(92.16796875,165.20703125)"/>
                <path fill="REPLACE_WITH_COLOR" d="M0 0C-3.1-.6-3.1-.6-10.6 1.2c-1.5.4-2.9.7-4.4 1.1-1.1.3-1.1.3-2.3.6-2.3.5-4.7 1.1-7.1 1.6-.7.2-1.5.4-2.3.6-1.5.3-3 .6-4.5 1-4.9 1-9.6 2-13.8 4.9-1.1 3.2-1.1 5.5-.7 8.8.3 1 .5 2.1.8 3.1.4 1.9.9 3.8 1.3 5.8.2.8.4 1.5.6 2.3 2.2 8.8 4.4 17.7 6.6 26.5 1.7 6.4 3.3 12.8 4.5 19.4.5 3.3 1.3 6.5 2.3 9.8.7 2.4 1.5 4.8 2.1 7.2.1.8.3 1.5.5 2.2.3 1.4.7 2.9 1 4.3.7 3.4 1.4 6.6 3.1 9.6 4.6 2.5 4.6 2.5 17.4-.6.9-.2 1.7-.4 2.6-.6 2.8-.7 5.6-1.4 8.3-2.1.9-.3 1.7-.5 2.6-.7 5.5-1.4 13.7-1.9 17-7 .5-4.4-.4-8.3-1.4-12.5-.5-1.7-.9-3.5-1.3-5.3-.4-1.4-.4-1.4-.8-2.9-1-4.3-2.1-8.7-3.1-13-1.1-5-2.3-10-3.4-14.9-.9-3.6-1.7-7.2-2.6-10.8-.9-4.2-1.9-8.4-2.9-12.7-.4-1.6-.8-3.3-1.2-5-.5-2.4-1.1-4.8-1.7-7.2-.1-.7-.3-1.4-.5-2.2C5 7.5 3.7 3.8 0 0Z" transform="translate(406,171)"/>
                <path fill="REPLACE_WITH_COLOR" d="M0 0C4.1 2.3 6.3 5 7.8 9.4c.5 3 .8 6 1 9 .5 0 1.1 0 1.7 0 5.8-.2 9.7 0 14.4 3.7 2.9 3.6 4.9 7 4.8 11.8-.2 2.2-.5 4.4-.9 6.5 1.1 0 1.1 0 2.4-.1 10.5-.2 10.5-.2 15.6 3.1 0 .7 0 1.4 0 2 .6 0 1.3 0 2 0 2.6 5.4 3.3 9 3 15 0 .7 0 1.4 0 2 .7 0 1.4-.1 2.1-.1 6.6-.3 10.7-.2 15.9 4.1 3.5 5.1 4.5 9.9 3.5 16-.8 2.9-2 5.4-3.5 8-.7 0-1.4 0-2 0-.2.7-.4 1.4-.5 2.1-2.6 4.9-6.6 8.5-11.5 10.9-4.7 1.5-8.5 1-12.9-.8-3.7-2-6.2-4.4-8.1-8.2-.8-3.3-1-6.5-1-10-.6.2-1.2.4-1.8.5-5.2 1.2-10.3 1.4-15.1-1.1-4-3-6.6-5.6-8.1-10.4-.1-1.5-.1-3.1-.1-4.6 0-.9 0-1.7 0-2.5 0-.6 0-1.2.1-1.9-1.2.1-2.4.2-3.6.2-5.8 0-9.9-1.8-14.3-5.5-4.3-5.2-4.4-9.2-4.2-15.7-.9.1-.9.1-1.9.1-5.5.2-9.4.1-14.1-3.1-4.5-4.9-5.4-8.9-5.3-15.4.6-4.4 2.6-7.1 5.3-10.6.8-.9 1.5-1.8 2.2-2.8C-19.8 2.4-12.4-5.4 0 0Z" transform="translate(165.25,275.5625)"/>
            </svg>
            `,
        type: "toggle",
        status: true
    }]
}, {
    label: "Original MooMoo Artwork",
    id: "originalArtwork",
    description: "On sandbox.moomodding.io, draws hats, accessories, weapons and arrows with the official MooMoo.io pictures (the look of the original Falcon), not moomodding's redrawn ones. The hotbar keeps the site's pictures. Takes effect after a page reload.",
    icon: SHAME_HAT_ICON,
    type: "toggle",
    status: true
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
        label: "Hat Debug",
        id: "showHatDecision",
        description: "Shows which hat and accessory the Hat System wants this tick, and which of its rules chose them.",
        type: "toggle",
        icon: CONSOLE_ICON,
        status: false
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
    label: "Camera",
    id: "",
    icon: GRID_ICON,
    description: "How much of the map you see.",
    type: "group",
    settings: [{
        label: "View Distance",
        id: "viewDistance",
        description: "How much of the map you see, in % of the normal view. Used when you join a server and when you press = to reset the zoom. The mouse wheel still zooms from there. 100 = the classic view. Very far out, the edge of the view can be empty: the server only sends what is near you.",
        type: "slider",
        min: 75,
        max: 250,
        status: 100,
        step: 5
    }, {
        label: "Limit Wheel Zoom",
        id: "limitWheelZoom",
        description: "Keeps mouse-wheel zoom between 75% and 250% of the normal view. Off: the wheel zooms without limit (classic), so you can zoom far in or out by accident.",
        type: "toggle",
        status: false
    }]
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
    icon: `
        <svg viewBox="0 0 200 200" width="27" height="27">
            <g fill="REPLACE_WITH_COLOR" transform="translate(0, 200) scale(0.1, -0.1)" stroke="none">
                <path d="M276 1285c-56-20-113-80-137-145-17-46-20-72-17-160 3-95 6-110 34-160 18-32 49-68 73-85l43-30 706-3c500-2 718 0 745 8 55 16 120 85 142 149 13 41 16 76 13 159-4 117-20 161-74 216-65 64-19 61-789 63-579 2-707 0-739-12zm112-141c21-14 22-22 22-141 0-143-8-163-67-163-62 0-73 24-73 155 0 110 1 117 25 140 28 29 61 32 93 9zm190 0c21-14 22-22 22-141 0-104-3-130-17-145-20-22-71-24-101-2-21 14-22 22-22 138 0 123 6 147 40 159 28 10 55 7 78-9zm199-11c9-11 13-57 13-139 0-116-1-124-22-138-29-21-77-20-100 1-16 14-18 33-18 144 0 121 1 129 23 144 27 20 86 13 104-12zm178 2c24-23 25-30 25-140 0-130-11-155-72-155-60 0-68 18-68 161 0 121 1 129 22 143 32 23 65 20 93-9zm183 9c21-14 22-22 22-149 0-123-2-135-19-145-25-13-67-13-92 0-17 10-19 22-19 145 0 127 1 135 22 149 12 9 32 16 43 16s31-7 43-16zm190 0c21-14 22-22 22-141 0-104-3-130-17-145-22-24-77-24-103 2-18 18-20 33-20 139 0 117 1 120 26 140 32 25 61 27 92 5z"/>
            </g>
        </svg>
        `,
    settings: [{
        id: "renderTurretReload",
        description: "Shows a reload bar next to players while their Turret Gear is reloading.",
        label: "Render Turret Gear Reload",
        type: "toggle",
        status: false
    }, {
        id: "reloadBars:hud",
        description: "Shows a panel on the left of the screen with your primary and secondary reload and the nearest enemy's, with the server ticks left until each is ready. A \"?\" after an enemy weapon means it is a guess (not seen yet). Grey means that weapon isn't held, so it isn't reloading: the ticks count down once it is held again.",
        label: "Reload HUD",
        type: "toggle",
        status: false
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
    status: false,
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
}];
