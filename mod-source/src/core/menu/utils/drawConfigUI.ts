import readJson from "@utils/storage/readJson";
import Menu, { menuContent, SavedConfigs } from "../Menu";
import drawItemBody from "./drawItemBody";

export default function drawConfigUI() {
    const body = drawItemBody();
    body.style.pointerEvents = "none";
    body.classList.add("menuConfigUI");

    const nameInput = document.createElement("input");
    nameInput.classList.add("menuConfigUIInput");
    nameInput.type = "text";
    nameInput.maxLength = 45;
    nameInput.placeholder = "Config Name";

    const saveButton = document.createElement("div");
    saveButton.classList.add("menuConfigUIButton");
    saveButton.innerHTML = "Save";

    body.appendChild(nameInput);
    body.appendChild(saveButton);

    saveButton.onclick = async () => {
        if (nameInput.value) {
            const savedConfigs = readJson<SavedConfigs>("falcon-configs", {});
            savedConfigs[nameInput.value] = Menu.collectSettings();
            localStorage.setItem("falcon-configs", JSON.stringify(savedConfigs));
            Menu.renderItems(menuContent.configs);
        }
    };

    Menu.contentElement.appendChild(body);
}