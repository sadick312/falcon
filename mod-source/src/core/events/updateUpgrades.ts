import items, { WEAPON_ID_MAP } from "@constants/items";
import Client from "@core/Client";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import getElem from "@utils/dom/getElem";

const upgradeHolder = getElem<"div">("upgrade-holder");
const upgradeCounter = getElem<"div">("upgrade-counter");
const tmpUpgradeList: number[] = [];
let lastUpgradeAge = -1;
let lastUpgradeId = -1;

function sendUpgrade(id: number, age: number) {
    lastUpgradeAge = age;
    lastUpgradeId = id;
    Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, id);
}

/**
 * Auto Upgrade weapon builds: age -> weapon id. Every path is legal in 1.8.2 (one upgrade per
 * age; Katana and Crossbow share age 8, and the Musket needs the Crossbow), checked against the
 * game data. Ages not listed fall back to the item choices below.
 */
export const WEAPON_BUILDS: Record<string, Record<number, number>> = {
    polearmMusket: { 2: WEAPON_ID_MAP.POLEARM, 6: WEAPON_ID_MAP.HUNTING_BOW, 8: WEAPON_ID_MAP.CROSSBOW, 9: WEAPON_ID_MAP.MUSKET },
    katanaHammer: { 2: WEAPON_ID_MAP.SHORT_SWORD, 6: WEAPON_ID_MAP.GREAT_HAMMER, 8: WEAPON_ID_MAP.KATANA },
    katanaBow: { 2: WEAPON_ID_MAP.SHORT_SWORD, 6: WEAPON_ID_MAP.HUNTING_BOW, 8: WEAPON_ID_MAP.KATANA },
    polearmHammer: { 2: WEAPON_ID_MAP.POLEARM, 6: WEAPON_ID_MAP.GREAT_HAMMER },
};

export default function updateUpgrades(points: number, age: number) {
    Client.player.upgradePoints = points;
    Client.player.upgrAge = age;
    if (age === 2) Client.upgradesObtained.clear();

    // The server offered the same age again: our last upgrade didn't take (e.g. lost while
    // reconnecting). Forget it so it can be sent again instead of the chain stalling.
    if (age === lastUpgradeAge && lastUpgradeId !== -1) Client.upgradesObtained.delete(lastUpgradeId);

    if (points > 0) {
        const tmpList = tmpUpgradeList;
        tmpUpgradeList.length = 0;
        upgradeHolder.innerHTML = "";

        for (let i = 0; i < items.weapons.length; i++) {
            const wpn = items.weapons[i];
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

        for (let i = 0; i < items.list.length; i++) {
            const item = items.list[i];

            // Same rule as the game: an item needing a previous one is only offered if owned.
            // Item "pre" is relative in the data (castle wall pre 1 = stone wall, id 5 - 1).
            if (item.age == age && (item.pre === undefined || Client.player.items.indexOf(item.id - item.pre) >= 0)) {
                const tmpId = i + items.weapons.length;
                const elem = document.createElement("div");
                elem.id = `upgrade-item-${tmpId}`;
                elem.className = "action-bar-item";

                elem.style.backgroundImage = getElem<"div">(`action-bar-item-${tmpId}`).style.backgroundImage;
                upgradeHolder.appendChild(elem);
                tmpList.push(tmpId);
            }
        }

        if (Menu.getValue("autoUpgrade")) {
            const wantedWeapon = WEAPON_BUILDS[Menu.getValue("weaponBuild")]?.[age];
            if (wantedWeapon !== undefined && tmpList.includes(wantedWeapon)) {
                sendUpgrade(wantedWeapon, age);
                return;
            }

            if (tmpList.length === 1) {
                sendUpgrade(tmpList[0], age);
                return;
            } else {
                const _7thSlot = parseInt(Menu.getValue("7thSlot"));

                for (const id of tmpList) {
                    if ([17, 31, 23, _7thSlot].includes(id)) {
                        sendUpgrade(id, age);
                        return;
                    }
                }
            }
        }

        for (let i = 0; i < tmpList.length; i++) {
            const tmpId = tmpList[i];
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