import Menu, { ChatLog } from "../Menu";

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
export default function drawChatLog() {
    const chatLogger = document.getElementById(CHAT_LOGGER_ID) || document.createElement("div");

    chatLogger.id = CHAT_LOGGER_ID;
    chatLogger.innerHTML = "";
    chatLogger.classList.add("chatLogger");

    for (const log of Menu.chatLogs) chatLogger.appendChild(createRow(log));

    Menu.contentElement.appendChild(chatLogger);
    scrollToBottom(chatLogger);
}

/** Adds one entry and, while the console tab is open, one row instead of redrawing every row. */
export function addChatLog(log: ChatLog) {
    Menu.chatLogs.push(log);
    if (Menu.chatLogs.length > MAX_CHAT_LOGS) Menu.chatLogs.shift();

    if (Menu.selectedTab !== 5) return;

    const chatLogger = document.getElementById(CHAT_LOGGER_ID);
    if (!chatLogger) {
        drawChatLog();
        return;
    }

    chatLogger.appendChild(createRow(log));
    // Drop the oldest rows to match chatLogs (also after "!clear" emptied it).
    while (chatLogger.childElementCount > Menu.chatLogs.length) chatLogger.firstElementChild!.remove();

    if (chatLogger.childElementCount !== Menu.chatLogs.length) drawChatLog();
    else scrollToBottom(chatLogger);
}
