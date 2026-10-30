/** Set by the esbuild define: true in development builds (build --dev, watch), false in production. */
declare const __DEV__: boolean;

declare global {
    interface HTMLImageElement {
        isLoaded: boolean;
    }

    interface Window {
        changeStoreIndex: (index: number) => void;
    }
}

declare module "*.worker.js" {
    const WorkerConstructor: new () => Worker;
    export default WorkerConstructor;
}