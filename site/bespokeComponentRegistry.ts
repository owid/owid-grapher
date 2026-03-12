/**
 * Registry of known bespoke components that can be embedded in gdocs.
 * Each component is identified by a unique name and specifies URLs for
 * its ESM script and CSS stylesheet.
 */

import type { BespokeComponentDefinition } from "../bespoke/shared/bespokeComponentTypes.js"

/**
 * Map of component names to their definitions.
 * Add new bespoke components here.
 */
export const BESPOKE_COMPONENT_REGISTRY: Record<
    string,
    BespokeComponentDefinition
> = {
    example: {
        scriptUrl: "/example/index.js",
    },
    // Example:
    // "my-widget": {
    //     scriptUrl: "/assets/bespoke/my-widget.mjs",
    //     cssUrl: "/assets/bespoke/my-widget.css",
    // },
    "income-plots": {
        scriptUrl:
            "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/poverty-plots/income-plots.mjs",
        cssUrl: "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/poverty-plots/income-plots.css",
    },
    "how-rich-are-you": {
        scriptUrl:
            "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/how-rich-am-i/how-rich-am-i.mjs?nocache",
        cssUrl: "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/how-rich-am-i/how-rich-am-i.css?nocache",
    },
}
