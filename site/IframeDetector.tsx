import { GRAPHER_IS_IN_IFRAME_CLASS } from "@ourworldindata/grapher"
import { DISABLE_IFRAME_EMBED_PARAM } from "./SiteConstants.js"

export const IFrameDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `if (window != window.top && !new URLSearchParams(window.location.search).has('${DISABLE_IFRAME_EMBED_PARAM}')) document.documentElement.classList.add('${GRAPHER_IS_IN_IFRAME_CLASS}')`,
        }}
    />
)
