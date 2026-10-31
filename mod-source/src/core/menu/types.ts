// Shapes of the menu's tabs and settings.
export interface IMenuTab {
    label: string;
    icon: string;
}

export interface IMenuOptions {
    label: string;
    value: unknown;
}

export interface IMenuItem {
    label: string;
    description?: string;
    id: string;
    type: "toggle" | "select" | "number" | "slider" | "paragraph" | "group" | "chat-log" | "saved-configs" | "config-ui";
    settings?: IMenuItem[];
    icon?: string;
    options?: IMenuOptions[];
    status?: unknown;
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

export interface IMenuContent {
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
