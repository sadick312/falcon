// Every tab's settings. Menu.buildItemMap and Menu.renderItems read this.
import { IMenuContent } from "../types";
import { combatSettings } from "./combat";
import { utilitySettings } from "./utility";
import { defenseSettings } from "./defense";
import { visualSettings } from "./visual";
import { consoleSettings, configsSettings, experimentalsSettings, creditsSettings } from "./other";

export const menuContent: IMenuContent = {
    favorites: [],
    combat: combatSettings,
    utility: utilitySettings,
    defense: defenseSettings,
    visual: visualSettings,
    console: consoleSettings,
    configs: configsSettings,
    experimentals: experimentalsSettings,
    credits: creditsSettings
};
