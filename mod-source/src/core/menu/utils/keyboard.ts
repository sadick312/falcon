// Keyboard access for the menu's clickable divs. The game listens for keys on the whole document (Enter opens
// chat, Space and letters are game controls), so keys handled here stop before they reach it.

/** Lets Tab focus the element and Enter/Space press it, like a button. */
export function makeKeyboardClickable(element: HTMLElement, label?: string, role = "button") {
    element.tabIndex = 0;
    element.setAttribute("role", role);
    if (label) element.setAttribute("aria-label", label);

    element.addEventListener("keydown", (event) => {
        // Only the focused element itself; keys from a focused child are handled by that child.
        if (event.target !== element) return;
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        event.stopPropagation();
        element.click();
    });
}

/** Stops Enter in a text or number box from also opening the game chat. */
export function keepEnterInInput(input: HTMLInputElement) {
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") event.stopPropagation();
    });
}
