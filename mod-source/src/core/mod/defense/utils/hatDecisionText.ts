import { accessoryMap, hatMap, STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";

function itemName(id: number, ignore: number, map: Map<number, { name: string }>) {
    if (id === ignore) return "keep current";
    if (id === 0) return "none";
    return map.get(id)?.name ?? `#${id}`;
}

/**
 * The Hat Debug line: what the Hat System wanted this tick and which rule of its classic contract chose it, e.g.
 * "hat: Soldier Helmet (10 enemy close) · acc: Shadow Wings (5 enemy close)". The numbers match the contract tables.
 */
export default function hatDecisionText(): string {
    const hat = itemName(HatSystem.hatPick, STORE_HAT_MAP.IGNORE, hatMap);
    const acc = itemName(HatSystem.accPick, STORE_ACCESSORY_MAP.IGNORE, accessoryMap);
    return `hat: ${hat} (${HatSystem.hatRule}) · acc: ${acc} (${HatSystem.accRule})`;
}
