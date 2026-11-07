import type Menu from "@menu/Menu";
import type { ChatLog } from "@menu/ChatLog";

const CHAT_LOGGER_ID = "such_a_sigma_chat_logger";
/** Oldest entries are dropped past this, one at a time. */
const MAX_CHAT_LOGS = 500;

const CHAT_LOG_COLORS: Record<ChatLog["type"], string> = {
    chat: "var(--generic-white)",
    encounter: "#fff531",
    leave: "#ff0000",
    death: "#ffa600"
};

function createRow(log: ChatLog) {
    const color = CHAT_LOG_COLORS[log.type];
    const holder = document.createElement("div");

    const time = document.createElement("span");
    time.style.color = color;
    time.innerText = `[${log.time}]`;
    holder.appendChild(time);

    const msg = document.createElement("span");
    msg.style.color = color;
    msg.style.marginLeft = "4px";
    msg.innerText = log.msg;
    holder.appendChild(msg);

    return holder;
}

function scrollToBottom(chatLogger: HTMLElement) {
    window.requestAnimationFrame(() => { chatLogger.scrollTop = chatLogger.scrollHeight; });
}

/** Rebuilds the whole log. Used when the console tab is opened. */
export default function drawChatLog(menu: typeof Menu) {
    const chatLogger = document.getElementById(CHAT_LOGGER_ID) || document.createElement("div");

    chatLogger.id = CHAT_LOGGER_ID;
    chatLogger.innerHTML = "";
    chatLogger.classList.add("chatLogger");

    for (const log of menu.chatLogs) chatLogger.appendChild(createRow(log));

    menu.contentElement.appendChild(chatLogger);
    scrollToBottom(chatLogger);
}

/** Adds one entry and, while the console tab is open, one row instead of redrawing every row. Called as menu.addChatLog. */
export function appendChatLog(menu: typeof Menu, log: ChatLog) {
    menu.chatLogs.push(log);
    if (menu.chatLogs.length > MAX_CHAT_LOGS) menu.chatLogs.shift();

    if (menu.selectedTab !== 5) return;

    const chatLogger = document.getElementById(CHAT_LOGGER_ID);
    if (!chatLogger) {
        drawChatLog(menu);
        return;
    }

    chatLogger.appendChild(createRow(log));
    // Drop the oldest rows to match chatLogs (also after "!clear" emptied it).
    while (chatLogger.childElementCount > menu.chatLogs.length) chatLogger.firstElementChild!.remove();

    if (chatLogger.childElementCount !== menu.chatLogs.length) drawChatLog(menu);
    else scrollToBottom(chatLogger);
}
