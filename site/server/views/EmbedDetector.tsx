import * as React from "react"

export const EmbedDetector = () => (
    <script
        dangerouslySetInnerHTML={{
            __html: `if (window != window.top) document.documentElement.classList.add('iframe')`,
        }}
    />
)
