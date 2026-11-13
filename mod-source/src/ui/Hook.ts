import Client from "@core/Client";
import updateClanMenu, { allianceHolder } from "@core/events/updateClanMenu";
import TextManager from "@core/logic/TextManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import CombatController from "@core/mod/combat/core/CombatController";
import AimAssist from "@core/mod/combat/modules/AimAssist";
import MovementManager from "@core/mod/defense/defense-modules/MovementManager";
import ChatCommands from "@core/utils/ChatCommands";
import PacketReplayer from "@core/PacketReplayer";
import Menu from "@menu/Menu";
import AutoGrinder from "@placing/modules/AutoGrinder";
import AutoMiller from "@placing/modules/AutoMiller";
import SpriteCache from "@rendering/core/SpriteCache";
import WindowResizer from "@rendering/core/WindowResizer";
import RenderingConfig from "@rendering/RenderingConfig";
import PacketMap from "@root/utils/socket/PacketMap";
import Loader, { loadingCirclePage } from "@ui/Loader";
import getElem from "@utils/dom/getElem";
import { enterGameBtn } from "@ui/enterGameBtn";
import { Input } from "@ui/Input";

const moveKeys: Record<number, [number, number]> = {
    87: [0, -1],
    38: [0, -1],
    83: [0, 1],
    40: [0, 1],
    65: [-1, 0],
    37: [-1, 0],
    68: [1, 0],
    39: [1, 0]
};

function getMoveDir(): number | null {
    let dx = 0;
    let dy = 0;

    for (const key in moveKeys) {
        const keyNum = Number(key);

        if (Input.keys[keyNum]) {
            const buf = moveKeys[keyNum];
            if (!buf) continue;
            const mx = buf[0], my = buf[1];

            dx += mx;
            dy += my;
        }
    }

    return (dx === 0 && dy === 0) ? null : parseFloat(Math.atan2(dy, dx).toFixed(2));
}

const gameCanvas = getElem<"canvas">("game-canvas");
const chatInput = getElem<"input">("chat-input");


function sendMoveDir() {
    const moveDir = getMoveDir();
    Client.lastMoveDir = moveDir;
    // With "Send Movement Instantly" on, the new direction goes out now instead of with the next tick.
    MovementManager.sendNow();
}

document.addEventListener("contextmenu", (event) => event.preventDefault());

function resetMovementDir() {
    Input.keys = {};
    Client.lastMoveDir = null;
}

/** Normal chat is capped at 30 characters by the game; commands need room for their arguments. */
const MAX_CHAT_LENGTH = 30;
const MAX_COMMAND_LENGTH = 100;

const chatHint = getElem("chat-hint");
const chatHistory: string[] = [];
const MAX_CHAT_HISTORY = 20;
/** Position while browsing history with the arrow keys; equal to the length when not browsing. */
let historyIndex = 0;

function updateChatHint() {
    const matches = ChatCommands.suggest(chatInput.value);

    if (!matches.length) {
        chatHint.style.display = "none";
        return;
    }

    chatHint.innerHTML = "";
    for (const [name, desc] of matches) {
        const row = document.createElement("div");
        const nameEl = document.createElement("b");
        nameEl.textContent = name;
        row.append(nameEl, ` ${desc}`);
        chatHint.appendChild(row);
    }

    chatHint.style.display = "block";
}

function rememberChat(msg: string) {
    if (chatHistory[chatHistory.length - 1] !== msg) chatHistory.push(msg);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
    historyIndex = chatHistory.length;
}

chatInput.addEventListener("input", updateChatHint);

chatInput.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
        // Stop here so the menu's own Escape shortcut doesn't open the menu as the chat closes.
        event.stopPropagation();
        closeChat();
    } else if (event.code === "Tab") {
        // Complete to the first matching command, keeping any arguments already typed.
        event.preventDefault();
        const match = ChatCommands.suggest(chatInput.value)[0];
        if (!match) return;

        const args = chatInput.value.split(" ").slice(1).join(" ");
        chatInput.value = `${match[0]} ${args}`;
        updateChatHint();
    } else if (event.code === "ArrowUp" || event.code === "ArrowDown") {
        if (!chatHistory.length) return;
        event.preventDefault();

        const step = event.code === "ArrowUp" ? -1 : 1;
        historyIndex = Math.min(chatHistory.length, Math.max(0, historyIndex + step));
        chatInput.value = chatHistory[historyIndex] ?? "";
        updateChatHint();
    }
});

function closeChat() {
    chatInput.style.display = "none";
    chatHint.style.display = "none";
    chatInput.blur();
}

function toggleChat() {
    if (chatInput.style.display === "block") {
        closeChat();

        const msg = chatInput.value.trim();
        if (!msg || !Client.socket || !Client.player) return;

        rememberChat(msg);
        const isCommand = msg.startsWith("/") || msg.startsWith("!");
        Client.socket.sendMsg(
            PacketMap.CLIENT_TO_SERVER.SEND_CHAT,
            msg.slice(0, isCommand ? MAX_COMMAND_LENGTH : MAX_CHAT_LENGTH)
        );
    } else {
        chatInput.style.display = "block";
        chatInput.focus();
        chatInput.value = "";
        historyIndex = chatHistory.length;
        updateChatHint();
    }
}

gameCanvas.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
        CombatController.tankSpam = !CombatController.tankSpam;
    }
});

gameCanvas.addEventListener("wheel", (event) => {
    if (!Client.player) return;
    const delta = event.deltaY || event.deltaX;

    if (delta > 0) {
        RenderingConfig.maxScreenWidth *= 0.95;
        RenderingConfig.maxScreenHeight *= 0.95;
    } else {
        RenderingConfig.maxScreenWidth /= 0.95;
        RenderingConfig.maxScreenHeight /= 0.95;
    }

    WindowResizer.resize();
});

export function resetScreenSize() {
    RenderingConfig.maxScreenWidth = RenderingConfig.baseScreenWidth;
    RenderingConfig.maxScreenHeight = RenderingConfig.baseScreenHeight;
    WindowResizer.resize();
}

// Keys held while the window lost focus never get their keyup. This only cleared the keys, so the last direction
// stayed and we kept walking after alt-tabbing out with a movement key down.
window.onblur = () => {
    resetMovementDir();
};

function isKeyboardActive() {
    return chatInput.style.display !== "block" && allianceHolder.style.display !== "flex" && document.activeElement?.tagName !== "INPUT" && !document.activeElement?.classList.contains("menuConfigUIInput");
}

const pauseIcon = getElem("paused-icon");

document.addEventListener("keydown", (event) => {
    if (!Client.player) return;

    if (event.code === "Enter" || event.code === "NumpadEnter") {
        toggleChat();
    } else if (isKeyboardActive()) {
        Input.keys[event.code] = true;
        Input.keys[event.keyCode] = true;
        Input.keys[event.key] = true;

        if (moveKeys[event.keyCode]) {
            sendMoveDir();
        } else {
            if (event.code === "KeyR") {
                AttackManager.autoInstaToggle = !AttackManager.autoInstaToggle;
            } else if (event.code === "Equal") {
                resetScreenSize();
            } else if (event.code === "KeyE") {
                Client.socket.sendMsg(
                    PacketMap.CLIENT_TO_SERVER.AUTO_GATHER,
                    1
                );
                CombatController.manualGather = !CombatController.manualGather;
            } else if (event.shiftKey && event.code === "KeyZ") {
                SpriteCache.reset();
                SpriteCache.renderIcons();
            } else if (event.code === "KeyT" && Menu.getValue("dynamicOneTick")) {
                AttackManager.oneTicker.tapMode = !AttackManager.oneTicker.tapMode;
                TextManager.add(
                    Client.player.render_position.x,
                    Client.player.render_position.y,
                    AttackManager.oneTicker.tapMode ? "Active" : "Passive",
                    0
                );
            } else if (event.code === "KeyZ") {
                AutoMiller.data.status = !AutoMiller.data.status;
            } else if (event.code === "KeyL" && AimAssist.enabled()) {
                AimAssist.toggleLock();
                TextManager.add(
                    Client.player.render_position.x,
                    Client.player.render_position.y,
                    AimAssist.locked ? "Locked" : "Unlocked",
                    0
                );
            } else if (event.code === "KeyJ" && AimAssist.enabled()) {
                AimAssist.requestSwitch();
            } else if (/Digit[0-9]/.test(event.code)) {
                const player = Client.player;
                const id = parseInt(event.code.split("Digit")[1] ?? "") - 1;
                const weapon = player.weapons[id];
                const item = player.items[id - player.weapons.length];

                if (typeof weapon === "number") {
                    Client.weaponIndex = AutoGrinder.weaponIndex = weapon;
                    Client.socket.sendMsg(
                        PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD,
                        weapon,
                        true
                    );
                } else if (typeof item === "number") {
                    Client.socket.sendMsg(
                        PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD,
                        item,
                        false
                    );
                }
            } else if (event.code === "Space") {
                PacketReplayer.isPaused = !PacketReplayer.isPaused;

                const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
                if (pauseMaterialIcon)
                    pauseMaterialIcon.innerHTML = PacketReplayer.isPaused ? "play_arrow" : "pause";
            }
        }
    }
});

document.addEventListener("keyup", (event) => {
    Input.keys[event.code] = false;
    Input.keys[event.keyCode] = false;
    Input.keys[event.key] = false;

    if (moveKeys[event.keyCode]) {
        sendMoveDir();
    }
});

const nameInput = getElem<"input">("username-input");
const allianceBtn = getElem<"button">("alliance-btn");

export default function Hook() {
    nameInput.value = localStorage.getItem("moo_name") ?? "";

    enterGameBtn.onclick = () => {
        localStorage.setItem("moo_name", nameInput.value);

        Client.socket.sendMsg(
            PacketMap.CLIENT_TO_SERVER.JOIN_GAME,
            {
                name: nameInput.value || "unknown",
                moofoll: "1",
                skin: Loader.skinColor
            }
        );

        loadingCirclePage.style.display = "flex";
    };

    allianceBtn.onclick = () => {
        if (allianceHolder.style.display === "none")
            allianceHolder.style.display = "flex";
        else allianceHolder.style.display = "none";

        resetMovementDir();
        updateClanMenu();
    };
}