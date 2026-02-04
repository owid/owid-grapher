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
    test: {
        scriptUrl:
            "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/poverty-plots/income-plots.mjs",
        cssUrl: "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/poverty-plots/income-plots.css",
    },
    "how-rich-am-i": {
        scriptUrl:
            "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/how-rich-am-i/how-rich-am-i.mjs?nocache",
        cssUrl: "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/how-rich-am-i/how-rich-am-i.css?nocache",
    },
}

/**
 * The expected interface for a bespoke component's ESM module.
 * The module must export a `mount` function that receives a container div
 * and configuration object. The container is isolated via Shadow DOM.
 */
export interface BespokeComponentModule {
    mount: (
        container: HTMLDivElement,
        opts: { variant?: string; config: Record<string, unknown> }
    ) => void | Promise<void> | Promise<() => void>
}
