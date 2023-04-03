import { GRAPHER_IS_IN_IFRAME_CLASS } from "@ourworldindata/grapher"
import React from "react"

export const IFrameDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `if (window != window.top) document.documentElement.classList.add('${GRAPHER_IS_IN_IFRAME_CLASS}')`,
        }}
    />
)

export const useIframeDetector = () => {
    const [isEmbedded, setIsEmbedded] = React.useState(false)
    // Using useLayoutEffect here to avoid flashing non-embedded content
    React.useLayoutEffect(() => {
        if (window !== window.top) {
            document.documentElement.classList.add(GRAPHER_IS_IN_IFRAME_CLASS)
            setIsEmbedded(true)
        }
    }, [])
    return isEmbedded
}
