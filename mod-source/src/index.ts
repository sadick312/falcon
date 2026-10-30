import Loader from "./ui/Loader";

declare global {
    interface Window {
        /** Called once by the loader (falcon-launcher/src/gameLoader.ts), which then deletes it. */
        initFalconClient?: () => void;
        /** The official page's HTML, saved by the loader before it replaces the document. */
        oldHTML?: string;
    }
}

window.initFalconClient = () => Loader.main(); // Glorious index.ts file