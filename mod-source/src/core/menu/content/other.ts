// Settings in the console, configs, experimentals, credits tabs. Plain data: Menu.ts builds the UI from it.
import { IMenuItem } from "../types";
import { gearIcon } from "../icons";

export const consoleSettings: IMenuItem[] = [{
    label: "",
    id: "",
    type: "chat-log"
}];

export const configsSettings: IMenuItem[] = [{
    label: "Development Analytics",
    id: "improvementLogging",
    type: "toggle",
    description: "Nothing is sent anywhere. While this is on, a packet log (.fpl) is only saved when you die if Download Local Copy is on; while it is off, one is saved on every death.",
    icon: gearIcon(22),
    settings: [{
        label: "Download Local Copy",
        description: "Saves the last 15 seconds of packets as an .fpl file each time you die.",
        id: "improvementLoggingLCopy",
        type: "toggle",
        status: false
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
}];

export const experimentalsSettings: IMenuItem[] = [{
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
}];

export const creditsSettings: IMenuItem[] = [{
    label: "",
    id: "",
    description: `By using this software, you acknowledge that the developers and anyone associated with this software are not responsible or liable for any direct, indirect, incidental, consequential, or other damages, losses, or issues of any kind arising from its use, including but not limited to data loss, system crashes, or other malfunctions.`,
    type: "paragraph"
}];
