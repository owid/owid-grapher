import React from "react"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "../core/GrapherConstants"
import { DownloadTab } from "./DownloadTab"

export default {
    title: "DownloadTab",
    component: DownloadTab,
}

export const Default = (): JSX.Element => {
    return (
        <DownloadTab
            manager={{
                displaySlug: "some-graph",
                staticSVG: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${DEFAULT_GRAPHER_WIDTH}" height="${DEFAULT_GRAPHER_HEIGHT}" viewBox="0 0 ${DEFAULT_GRAPHER_WIDTH} ${DEFAULT_GRAPHER_HEIGHT}">
<rect x="10" y="10" width="30" height="30" fill="blue"/>
</svg>`,
                detailRenderers: [],
            }}
        />
    )
}
