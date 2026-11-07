import items from "@constants/items";
import Client from "@core/Client";
import getElem from "@utils/dom/getElem";

export default function updateItems(data: number[] | null, wpn: boolean) {
    const player = Client.player;

    if (data) {
        if (wpn) player.weapons = data;
        else player.items = data;
    }

    const itemSet = new Set(player.items);

    for (const [i, item] of items.list.entries()) {
        const tmpId = items.weapons.length + i;
        getElem<"div">(`action-bar-item-${tmpId}`).style.display = itemSet.has(item.id!) ? "inline-block" : "none";
    }

    for (const [i, weapon] of items.weapons.entries()) {
        getElem<"div">(`action-bar-item-${i}`).style.display = player.weapons[weapon.type] == weapon.id ? "inline-block" : "none";
    }
}