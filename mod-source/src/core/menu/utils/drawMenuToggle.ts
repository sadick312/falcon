import getElem from "@utils/dom/getElem";
import type Menu from "@menu/Menu";
import type { IMenuItem } from "@menu/Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";
import drawResetButton from "./drawResetButton";
import { makeKeyboardClickable } from "./keyboard";

export default function drawMenuToggle(item: IMenuItem, contentElement: HTMLElement, isNested: boolean, menu: typeof Menu) {
    const isInDropdownContent = contentElement !== menu.contentElement;

    const body = drawItemBody();
    body.classList.add("menuToggle");

    const toggle = document.createElement("div");
    const iconHolderElem = document.createElement("div");
    toggle.classList.add("menuToggle");
    body.appendChild(toggle);

    if (item.icon) {
        iconHolderElem.classList.add("menuItemIconHolder");
        if (item.status) iconHolderElem.classList.add("activeMenuItem");

        iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(${item.status ? "--theme-primary" : "--generic-white-2"})`)}
        `;

        toggle.appendChild(iconHolderElem);
    }

    drawItemLabel(item, toggle, isInDropdownContent);
    drawResetButton(item, toggle, menu);

    if (item.status) toggle.classList.add("activeMenuItem");

    const toggleHolder = document.createElement("div");
    toggleHolder.classList.add("menuItemToggleHolder");
    if (item.status) toggleHolder.style.backgroundColor = "var(--theme-primary)";

    const toggleCircle = document.createElement("div");
    toggleCircle.classList.add("menuItemToggleCircle");
    if (item.status) toggleCircle.classList.add("active");

    if (!isInDropdownContent && !isNested && !item.neverSave) {
        const favoriteButton = document.createElement("div");
        const favoriteIcon = document.createElement("span");

        favoriteButton.classList.add("menuItemSettings");
        favoriteButton.style.marginRight = "10px";
        favoriteIcon.classList.add("material-icons", "menuSettingsIcon");
        favoriteIcon.style.fontSize = `16px`;
        favoriteIcon.innerHTML = "star";

        if (item.isFavorited) {
            favoriteButton.classList.add("active");
            favoriteIcon.classList.add("active");
        }

        makeKeyboardClickable(favoriteButton, `Favorite ${item.label}`);
        favoriteButton.onclick = (ev) => {
            ev.stopPropagation();
            item.isFavorited = !item.isFavorited;

            if (item.isFavorited) {
                favoriteButton.classList.add("active");
                favoriteIcon.classList.add("active");
            } else {
                favoriteButton.classList.remove("active");
                favoriteIcon.classList.remove("active");
            }

            menu.saveFavorites();
            if (menu.isInFavoritesTab) getElem(`menuTab:0`).click();
        };

        favoriteButton.appendChild(favoriteIcon);
        toggle.appendChild(favoriteButton);
    }

    if (item.settings) {
        const dropdownContent = document.createElement("div");
        dropdownContent.classList.add("dropdownContent");

        const useDropdown = item.settings.length < 3;
        toggleHolder.style.marginLeft = "14px";

        const settingButton = document.createElement("div");
        const settingIcon = document.createElement("span");

        settingButton.classList.add("menuItemSettings");
        settingIcon.classList.add("material-icons", "menuSettingsIcon");
        settingIcon.style.fontSize = `${useDropdown ? 22 : 16}px`;
        settingIcon.innerHTML = useDropdown ? item.isDropdownToggled ? "keyboard_arrow_up" : "keyboard_arrow_down" : "settings";
        dropdownContent.style.display = item.isDropdownToggled ? "block" : "none";
        if (item.isDropdownToggled) menu.renderItems(item.settings!, dropdownContent, undefined, true);

        settingButton.appendChild(settingIcon);
        toggle.appendChild(settingButton);

        makeKeyboardClickable(settingButton, `${item.label} settings`);
        settingButton.onclick = (ev) => {
            ev.stopPropagation();

            if (useDropdown) {
                item.isDropdownToggled = !item.isDropdownToggled;
                settingIcon.innerHTML = item.isDropdownToggled ? "keyboard_arrow_up" : "keyboard_arrow_down";
                dropdownContent.style.display = item.isDropdownToggled ? "flex" : "none";
                menu.renderItems(item.settings!, dropdownContent, undefined, true);
                return;
            }

            menu.renderItems(item.settings!, undefined, undefined, true);
            menu.currentItem = item.settings![0];

            menu.backwardStack.push(item);
            menu.forwardStack.clear();
            menu.updateUtilsBar(`${item.label} Settings`);
        };

        if (useDropdown)
            body.appendChild(dropdownContent);
    }

    item.update = () => {
        toggle.setAttribute("aria-checked", String(!!item.status));
        item.refreshReset?.();
        if (item.icon) iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(${item.status ? "--theme-primary" : "--generic-white-2"})`)}
        `;

        if (item.status) {
            toggleHolder.style.backgroundColor = "var(--theme-primary)";
            toggleCircle.classList.add("active");
            iconHolderElem.classList.add("activeMenuItem");
            toggle.classList.add("activeMenuItem");
        } else {
            toggleHolder.style.backgroundColor = "";
            toggleCircle.classList.remove("active");
            iconHolderElem.classList.remove("activeMenuItem");
            toggle.classList.remove("activeMenuItem");
        }
    };

    makeKeyboardClickable(toggle, item.label, "switch");
    toggle.setAttribute("aria-checked", String(!!item.status));

    toggle.onclick = () => {
        item.status = !item.status;
        menu.saveSettings();
        if (typeof item.update === "function") item.update();
    };

    toggleHolder.appendChild(toggleCircle);
    toggle.appendChild(toggleHolder);

    if (item.disabled || item.unchangable) {
        toggle.style.pointerEvents = "none";
        toggle.tabIndex = -1;
        toggle.setAttribute("aria-disabled", "true");

        const grayOut = document.createElement("div");
        grayOut.classList.add(item.unchangable ? "menuItemGrayOutUnchangable" : "menuItemGrayOutDisabled");

        const lockIcon = document.createElement("span");
        lockIcon.classList.add("material-icons", "menuItemLockIcon");
        lockIcon.textContent = "lock";

        toggle.appendChild(grayOut);
        toggle.appendChild(lockIcon);
    }

    contentElement.appendChild(body);
}