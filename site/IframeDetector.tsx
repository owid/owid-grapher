import {
    GRAPHER_IFRAME_POSSIBLY_WITH_CONTEXT_CLASS,
    GRAPHER_IS_IN_IFRAME_CLASS,
} from "../grapher/core/GrapherConstants.js"
import React from "react"

/**
 * Adds classes to embedded grapher iframe documents based on embedding context:
 * - GRAPHER_IS_IN_IFRAME_CLASS: all iframes
 * - GRAPHER_IFRAME_POSSIBLY_WITH_CONTEXT_CLASS: iframe with relevant
 *   data-attribute, embedded locally only (window.frameElement is null in
 *   cross-origin scenarios so this detection isn't available for iframes on
 *   external sites). Used for the "All charts" gallery.
 *
 */
export const IFrameDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `
            if (window != window.top) document.documentElement.classList.add('${GRAPHER_IS_IN_IFRAME_CLASS}')

            if(window.frameElement && window.frameElement.getAttribute("data-possibly-with-context")) {
                document.documentElement.classList.add('${GRAPHER_IFRAME_POSSIBLY_WITH_CONTEXT_CLASS}')
            }
            `,
        }}
    />
)
