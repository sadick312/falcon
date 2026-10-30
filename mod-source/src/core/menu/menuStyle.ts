import menuCss from "./menu.css";

// Injects the menu stylesheet when this module loads, as esbuild-plugin-inline-css used to.
// Imported from Menu.ts in the old "./menu.css" position so the <style> lands in the same order.
if (!document.getElementById("falcon-menu-css")) {
    const style = document.createElement("style");
    style.id = "falcon-menu-css";
    style.textContent = menuCss;
    document.head.appendChild(style);
}
