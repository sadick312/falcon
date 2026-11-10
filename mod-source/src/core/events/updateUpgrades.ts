import items from "@constants/items";
import Client from "@core/Client";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import getElem from "@utils/dom/getElem";

const upgradeHolder = getElem<"div">("upgrade-holder");
const upgradeCounter = getElem<"div">("upgrade-counter");
const tmpUpgradeList: number[] = [];

/**
 * The Menu value for "leave this age to me", in the age 2 / 6 / 8 / 9 choices ("upgradeAge2" ...): mostly weapons,
 * which Auto Upgrade used to leave to you.
 */
export const MANUAL_PICK = -1;

/** Upgrade ids Auto Upgrade always takes when offered (cookie, pit trap, greater spikes), plus the 7th Slot choice. */
const PREFERRED = [17, 31, 23];

let fallbackTimer: number | undefined;

export interface AutoUpgradeChoice {
    /** Send this upgrade now. */
    now?: number;
    /** Send this one after the manual-pick wait, if the same upgrade is still waiting. */
    later?: number;
}

/**
 * What Auto Upgrade picks from `offered` (upgrade ids: weapons by id, buildings by weapons.length + item id) at `age`:
 * the only option; else cookie / pit trap / greater spikes / the 7th Slot choice; else this age's Menu choice. With
 * "Spend Every Point", a point is never left unspent: a chosen upgrade that isn't offered (its prerequisite is
 * missing) is replaced by the first offered one, buildings before weapons; and an age left to you is picked the same
 * way once only buildings are offered, or after the manual-pick wait when weapons are.
 */
export function chooseAutoUpgrade(offered: readonly number[], age: number): AutoUpgradeChoice {
    if (offered.length === 0) return {};
    if (offered.length === 1) return { now: offered[0] };

    const seventh = parseInt(Menu.getValue("7thSlot"));
    const preferred = offered.find(id => PREFERRED.includes(id) || id === seventh);
    if (preferred !== undefined) return { now: preferred };

    const choiceId = age === 2 ? parseInt(Menu.getValue("upgradeAge2")) :
        age === 6 ? parseInt(Menu.getValue("upgradeAge6")) :
            age === 8 ? parseInt(Menu.getValue("upgradeAge8")) :
                age === 9 ? parseInt(Menu.getValue("upgradeAge9")) : MANUAL_PICK;
    const chosen = isNaN(choiceId) ? MANUAL_PICK : choiceId;
    if (chosen !== MANUAL_PICK && offered.includes(chosen)) return { now: chosen };

    if (!Menu.getValue("upgradeSpendAll")) return {};

    const firstBuilding = offered.find(id => id >= items.weapons.length);
    const fallback = firstBuilding ?? offered[0];
    if (chosen !== MANUAL_PICK) return { now: fallback };
    if (firstBuilding !== undefined && offered.every(id => id >= items.weapons.length)) return { now: fallback };
    return { later: fallback };
}

export default function updateUpgrades(points: number, age: number) {
    Client.player.upgradePoints = points;
    Client.player.upgrAge = age;
    if (age === 2) Client.upgradesObtained.clear();

    if (points > 0) {
        const tmpList = tmpUpgradeList;
        tmpUpgradeList.length = 0;
        upgradeHolder.innerHTML = "";

        for (const [i, wpn] of items.weapons.entries()) {
            const isWithinAge = wpn.pre === undefined || Client.player.weapons.indexOf(wpn.pre) >= 0;

            if (wpn.age === age && (Client.socket.isPrivateServer || isWithinAge)) {
                const elem = document.createElement("div");
                elem.id = `upgrade-item-${i}`;
                elem.className = "action-bar-item";

                elem.style.backgroundImage = getElem<"div">(`action-bar-item-${i}`).style.backgroundImage;
                upgradeHolder.appendChild(elem);
                tmpList.push(i);
            }
        }

        for (const [i, item] of items.list.entries()) {
            // Like weapons above, and like the game: a building is only offered once you own its prerequisite.
            const hasPrerequisite = item.pre === undefined || Client.player.items.indexOf(item.pre) >= 0;

            if (item.age == age && (Client.socket.isPrivateServer || hasPrerequisite)) {
                const tmpId = i + items.weapons.length;
                const elem = document.createElement("div");
                elem.id = `upgrade-item-${tmpId}`;
                elem.className = "action-bar-item";

                elem.style.backgroundImage = getElem<"div">(`action-bar-item-${tmpId}`).style.backgroundImage;
                upgradeHolder.appendChild(elem);
                tmpList.push(tmpId);
            }
        }

        // A new offer (or a pick made by hand) replaces any waiting fallback pick.
        if (fallbackTimer !== undefined) {
            clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
        }

        if (Menu.getValue("autoUpgrade")) {
            const choice = chooseAutoUpgrade(tmpList, age);
            if (choice.now !== undefined) {
                Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, choice.now);
                return;
            }

            const later = choice.later;
            if (later !== undefined) {
                const waitSeconds = parseInt(Menu.getValue("upgradeManualWait"));
                fallbackTimer = window.setTimeout(() => {
                    fallbackTimer = undefined;
                    const player = Client.player;
                    // Only if that upgrade is still waiting: no pick by hand, no new age since.
                    if (!player || player.upgradePoints <= 0 || player.upgrAge !== age || !Menu.getValue("autoUpgrade")) return;
                    Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, later);
                }, (isNaN(waitSeconds) ? 10 : waitSeconds) * 1e3);
            }
        }

        for (const tmpId of tmpList) {
            const elem = getElem(`upgrade-item-${tmpId}`);

            elem.onclick = () => {
                Client.socket.sendMsg(
                    PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE,
                    tmpId
                );
            };
        }

        if (tmpList.length) {
            upgradeHolder.style.display = "flex";
            upgradeCounter.style.display = "block";
            upgradeCounter.innerHTML = `SELECT ITEMS (${Math.min(9, points)})`;
        } else {
            upgradeHolder.style.display = "none";
            upgradeCounter.style.display = "none";
        }
    } else {
        upgradeHolder.style.display = "none";
        upgradeCounter.style.display = "none";
    }
}