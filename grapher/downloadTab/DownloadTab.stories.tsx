import * as React from "react"
import { DownloadTab } from "./DownloadTab"

export default {
    title: "DownloadTab",
    component: DownloadTab,
}

export const Default = () => {
    return (
        <DownloadTab
            manager={{
                displaySlug: "some-graph",
                staticSVG: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="850" height="600" viewBox="0 0 850 600">
<rect x="10" y="10" width="30" height="30" fill="blue"/>
</svg>`,
            }}
        />
    )
}
