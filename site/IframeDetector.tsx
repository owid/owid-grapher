import {
    GRAPHER_IS_IN_IFRAME_CLASS,
    GRAPHER_SHOW_CONTEXT_CLASS,
    GRAPHER_SHOW_CONTEXT_PARAM,
} from "../grapher/core/GrapherConstants.js"
import React from "react"

export const IFrameDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `
            if (window != window.top) document.documentElement.classList.add('${GRAPHER_IS_IN_IFRAME_CLASS}')
            const params = new URLSearchParams(window.location.search)
            if(params.get("${GRAPHER_SHOW_CONTEXT_PARAM}")) document.documentElement.classList.add('${GRAPHER_SHOW_CONTEXT_CLASS}')
            `,
        }}
    />
)
