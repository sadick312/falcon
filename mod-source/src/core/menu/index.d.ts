declare module "*.css" {
    /** esbuild's "text" loader: the stylesheet's contents. */
    const css: string;
    export default css;
}
