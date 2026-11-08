import getElem from "@utils/dom/getElem";

// Keyboard and mouse state, read by the combat and defense code every tick. In its own file so that code doesn't
// import Hook (the page's event handlers), which imports the combat code back. Hook fills in `keys`.
const gameCanvas = getElem<"canvas">("game-canvas");

export class Input {
    static keys: Record<string | number, boolean> = {};

    private static mouseX: number = 0;
    private static mouseY: number = 0;

    static init() {
        gameCanvas.addEventListener("mousemove", (event) => {
            Input.mouseX = event.clientX;
            Input.mouseY = event.clientY;
        });
    }

    static getAttackDir() {
        const mouseDir = Math.atan2(this.mouseY - (window.innerHeight / 2), this.mouseX - (window.innerWidth / 2));
        return mouseDir;
    }
}

Input.init();
