/**
 * Registry of known bespoke components that can be embedded in gdocs.
 * Each component is identified by a unique name and specifies URLs for
 * its ESM script and CSS stylesheet.
 */
export interface BespokeComponentDefinition {
    /** URL to the ES module that exports the component's mount function */
    scriptUrl: string
    /** URL to the component's CSS stylesheet (loaded into shadow DOM) */
    cssUrl: string
}

/**
 * Map of component names to their definitions.
 * Add new bespoke components here.
 */
export const BESPOKE_COMPONENT_REGISTRY: Record<
    string,
    BespokeComponentDefinition
> = {
    // Example:
    // "my-widget": {
    //     scriptUrl: "/assets/bespoke/my-widget.mjs",
    //     cssUrl: "/assets/bespoke/my-widget.css",
    // },
}

/**
 * The expected interface for a bespoke component's ESM module.
 * The module must export a `mount` function that receives a container div
 * and configuration object. The container is isolated via Shadow DOM.
 */
export interface BespokeComponentModule {
    mount: (container: HTMLDivElement, config: Record<string, unknown>) => void
}
