import { GRAPHER_IS_IN_IFRAME_CLASS } from "@ourworldindata/grapher"

export const IFrameDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `if (window != window.top) document.documentElement.classList.add('${GRAPHER_IS_IN_IFRAME_CLASS}')`,
        }}
    />
)
