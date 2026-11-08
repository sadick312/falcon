import getElem from "@utils/dom/getElem";

/** The main menu's "Enter Game" button. In its own file so the socket code can use it without importing Hook. */
export const enterGameBtn = getElem<"button">("enter-game-btn");
