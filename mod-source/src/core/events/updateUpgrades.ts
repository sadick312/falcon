import items from "@constants/items";
import { autoPicksAge, buildUpgradePick, itemOffers, ownsUpgrade, weaponOffers } from "@core/events/weaponBuilds";
import PingTracker from "@core/mod/utils/PingTracker";
import showNotice from "@ui/Notice";
import Client from "@core/Client";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import getElem from "@utils/dom/getElem";
import { copyHotbarIcon } from "@ui/HotbarIcons";

const upgradeHolder = getElem<"div">("upgrade-holder");
const upgradeCounter = getElem<"div">("upgrade-counter");
const tmpUpgradeList: number[] = [];
const autoUpgradeList: number[] = [];
let lastUpgradeAge = -1;
let lastUpgradeId = -1;

let failCheckTimer: number | null = null;

function upgradeName(id: number) {
    return id < items.weapons.length ? items.weapons[id]?.name : items.list[id - items.weapons.length]?.name;
}

/**
 * The server doesn't say "no" to an upgrade it refuses; it just doesn't give it. So a moment after
 * sending one, check that we own it, and show "Upgrade failed" on screen if we don't.
 */
function checkUpgradeLater(id: number) {
    if (failCheckTimer !== null) window.clearTimeout(failCheckTimer);

    const player = Client.player;
    const waitMs = Math.max(1500, PingTracker.getMedianPing() * 3);

    failCheckTimer = window.setTimeout(() => {
        failCheckTimer = null;
        // Died, respawned or changed server meanwhile: the old pick doesn't matter any more.
        if (!Client.isAlive || Client.player !== player) return;
        if (ownsUpgrade(id, items.weapons.length, player.weapons, player.items)) return;

        // PacketManager blocks sending an upgrade twice; this one never arrived, so allow a retry.
        Client.upgradesObtained.delete(id);
        showNotice(`Upgrade failed: ${upgradeName(id) ?? `#${id}`} - click it again`, "warn");
        console.warn(`[Falcon] upgrade ${id} was sent but not received`);
    }, waitMs);
}

function sendUpgrade(id: number, age: number) {
    lastUpgradeAge = age;
    lastUpgradeId = id;
    Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, id);
    checkUpgradeLater(id);
}

/**
 * Auto Upgrade weapon builds: age -> weapon id (see weaponBuilds.ts). Builds follow the 1.8.2
 * upgrade rules, except "skipPre" builds (Katana + Musket) that rely on the sandbox server not
 * checking a weapon's "pre". Ages not listed fall back to the item choices below.
 */

export default function updateUpgrades(points: number, age: number) {
    Client.player.upgradePoints = points;
    Client.player.upgrAge = age;
    if (age === 2) Client.upgradesObtained.clear();

    // The server offered the same age again: our last upgrade didn't take (e.g. lost while
    // reconnecting). Forget it so it can be sent again instead of the chain stalling.
    if (age === lastUpgradeAge && lastUpgradeId !== -1) Client.upgradesObtained.delete(lastUpgradeId);

    if (points > 0) {
        // tmpList: what the bar shows. autoList: what the normal game offers; Auto Upgrade decides from
        // this one, so "Show Every Weapon Upgrade" only adds buttons and never changes its picks.
        const tmpList = tmpUpgradeList;
        const autoList = autoUpgradeList;
        tmpUpgradeList.length = 0;
        autoUpgradeList.length = 0;
        upgradeHolder.innerHTML = "";

        const anyPre = Menu.getValue("showEveryWeaponUpgrade") !== false && location.hostname.endsWith("moomodding.io");
        const offers = weaponOffers(age, items.weapons, Client.player.weapons, anyPre, Client.socket.isPrivateServer);
        autoList.push(...offers.legal);

        for (const i of offers.shown) {
            const elem = document.createElement("div");
            elem.id = `upgrade-item-${i}`;
            elem.className = "action-bar-item";

            copyHotbarIcon(getElem<"div">(`action-bar-item-${i}`), elem);
            upgradeHolder.appendChild(elem);
            tmpList.push(i);
        }

        // Items: same as weapons. Auto Upgrade decides from the normal game's list (`legal`).
        const itemOffer = itemOffers(age, items.list, Client.player.items, anyPre);
        for (const i of itemOffer.shown) {
            const tmpId = i + items.weapons.length;
            const elem = document.createElement("div");
            elem.id = `upgrade-item-${tmpId}`;
            elem.className = "action-bar-item";

            copyHotbarIcon(getElem<"div">(`action-bar-item-${tmpId}`), elem);
            upgradeHolder.appendChild(elem);
            tmpList.push(tmpId);
            if (itemOffer.legal.includes(i)) autoList.push(tmpId);
        }

        // "Choose Every Age Yourself" / "Choose Ages 8 & 9 Yourself": no auto pick, the bar below stays open.
        if (Menu.getValue("autoUpgrade") && autoPicksAge(age, Menu.getValue("manualAges89") !== false, Menu.getValue("manualAllAges") !== false)) {
            const wantedWeapon = buildUpgradePick(Menu.getValue("weaponBuild"), age, autoList, (id) => items.weapons[id]?.age);
            if (wantedWeapon !== undefined) {
                sendUpgrade(wantedWeapon, age);
                return;
            }

            if (autoList.length === 1) {
                sendUpgrade(autoList[0], age);
                return;
            } else {
                const _7thSlot = parseInt(Menu.getValue("7thSlot"));

                for (const id of autoList) {
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
                Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, tmpId);
                checkUpgradeLater(tmpId);
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