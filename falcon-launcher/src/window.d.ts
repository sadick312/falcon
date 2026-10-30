// Globals the loader and the mod bundle share on the game page's window.
export { };

declare global {
    interface Window {
        /** The official page's HTML, saved before Falcon replaces the document (read by ProtocolLoader). */
        oldHTML?: string;
        /** Defined by the mod bundle; the loader calls it once and deletes it. */
        initFalconClient?: () => void;
    }
}
