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
    // Example:
    // "my-widget": {
    //     scriptUrl: "/assets/bespoke/my-widget.mjs",
    //     cssUrl: "/assets/bespoke/my-widget.css",
    // },
    example: {
        scriptUrl: "http://localhost:8089/example/src/index.ts",
        cssUrl: "http://localhost:8089/example/src/index.css",
    },
}
