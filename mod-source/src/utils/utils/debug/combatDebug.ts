import Menu from "@menu/Menu";

/** True while "Combat Debug Log" is on. Check it before building a message, so nothing is built while it is off. */
export function combatDebugOn() {
    return Menu.getValue("combatDebugLog") === true;
}

/** Writes one combat debug line to the console, as "[topic] key=value key=value". Only while "Combat Debug Log" is on. */
export function combatDebug(topic: string, fields: Record<string, string | number | boolean>) {
    if (!combatDebugOn()) return;
    let line = `[${topic}]`;
    for (const key in fields) {
        const value = fields[key];
        line += ` ${key}=${typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : String(value)}`;
    }
    console.log(line);
}
