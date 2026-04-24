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
    "causes-of-death": {
        scriptUrl: "/causes-of-death/index.js",
    },
}
