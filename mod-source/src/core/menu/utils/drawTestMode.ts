import TestMode, { SCENARIOS, TEST_CONFIG } from "@core/mod/testing/TestMode";
import Menu from "../Menu";
import drawItemBody from "./drawItemBody";

interface TestModeView {
    root: HTMLElement;
    startButton: HTMLDivElement;
    stopButton: HTMLDivElement;
    status: HTMLDivElement;
    bar: HTMLDivElement;
    table: HTMLTableSectionElement;
    checkboxes: HTMLInputElement[];
    shownResults: number;
}

let view: TestModeView | null = null;
let listening = false;

function button(label: string) {
    const elem = document.createElement("div");
    elem.classList.add("menuConfigUIButton");
    elem.style.cursor = "pointer";
    elem.textContent = label;
    return elem;
}

function copyText(text: string) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    return Promise.resolve();
}

/** Updates the open Test Mode tab in place. Does nothing when the tab isn't on screen. */
function refresh() {
    if (!view || !view.root.isConnected) return;

    const running = TestMode.running;
    view.startButton.style.opacity = running ? ".4" : "1";
    view.stopButton.style.opacity = running ? "1" : ".4";
    for (const box of view.checkboxes) box.disabled = running;

    const percent = TestMode.total ? Math.round(TestMode.progress / TestMode.total * 100) : 0;
    view.bar.style.width = `${running || TestMode.progress ? percent : 0}%`;

    view.status.textContent = running
        ? `${TestMode.progress}/${TestMode.total} · ${TestMode.currentName}${TestMode.notice ? ` · ${TestMode.notice}` : ""}`
        : TestMode.notice || TestMode.blockedReason() || "Ready. Stand still in an open area, then press Start.";

    // Results only ever grow during a run, so append new rows instead of rebuilding the table.
    const results = TestMode.results;
    if (results.length < view.shownResults) {
        view.table.textContent = "";
        view.shownResults = 0;
    }

    for (let i = view.shownResults; i < results.length; i++) {
        const row = view.table.insertRow();
        for (const text of [results[i].test, results[i].setup, results[i].result]) {
            const cell = row.insertCell();
            cell.textContent = text;
            cell.style.padding = "3px 6px";
            cell.style.borderTop = "1px solid var(--border-color)";
        }
    }

    view.shownResults = results.length;
}

export default function drawTestMode() {
    if (!listening) {
        TestMode.onChange(refresh);
        listening = true;
    }

    const root = drawItemBody();
    root.style.flexDirection = "column";
    root.style.alignItems = "stretch";
    root.style.rowGap = "8px";

    const intro = document.createElement("div");
    intro.className = "menuItemDescription";
    intro.innerHTML = `Runs tests against the sandbox practice bot (<b>${TEST_CONFIG.botName}</b>) by typing its commands for you, ` +
        `one every ${TEST_CONFIG.commandGapMs / 1000}s. It never starts on its own. ` +
        `Stop (or ${TEST_CONFIG.stopKey}) ends the run and sends <b>\\c a</b>. The bot never attacks, so survival and heal timing need a <b>\\f</b> duel.`;
    root.appendChild(intro);

    const checkboxes: HTMLInputElement[] = [];
    for (const scenario of SCENARIOS) {
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.columnGap = "8px";
        label.style.alignItems = "flex-start";
        label.style.cursor = "pointer";

        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = TestMode.enabledScenarios[scenario.id];
        box.onchange = () => {
            TestMode.setScenario(scenario.id, box.checked);
            refresh();
        };
        checkboxes.push(box);

        const text = document.createElement("div");
        text.innerHTML = `<div class="menuItemLabel">${scenario.label}</div><div class="menuItemDescription">${scenario.description}</div>`;

        label.append(box, text);
        root.appendChild(label);
    }

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.columnGap = "8px";

    const startButton = button("Start");
    const stopButton = button("Stop");
    const copyButton = button("Copy results");
    startButton.onclick = () => TestMode.start();
    stopButton.onclick = () => TestMode.stop();
    copyButton.onclick = () => {
        copyText(TestMode.resultsAsText()).then(() => {
            copyButton.textContent = "Copied";
            setTimeout(() => copyButton.textContent = "Copy results", 1200);
        });
    };
    controls.append(startButton, stopButton, copyButton);
    root.appendChild(controls);

    const track = document.createElement("div");
    track.style.cssText = "height:8px;border-radius:4px;background:var(--border-color);overflow:hidden";
    const bar = document.createElement("div");
    bar.style.cssText = "height:100%;width:0;background:var(--theme-primary);transition:width .2s";
    track.appendChild(bar);
    root.appendChild(track);

    const status = document.createElement("div");
    status.className = "menuItemDescription";
    root.appendChild(status);

    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-size:12px;color:var(--generic-white)";
    const head = table.createTHead().insertRow();
    for (const text of ["Test", "Setup", "Result"]) {
        const cell = document.createElement("th");
        cell.textContent = text;
        cell.style.textAlign = "left";
        cell.style.padding = "3px 6px";
        head.appendChild(cell);
    }
    const body = table.createTBody();
    root.appendChild(table);

    Menu.contentElement.appendChild(root);
    view = { root, startButton, stopButton, status, bar, table: body, checkboxes, shownResults: 0 };
    refresh();
}
