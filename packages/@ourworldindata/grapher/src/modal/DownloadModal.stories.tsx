import * as React from "react"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "../core/GrapherConstants"
import { DownloadModal } from "./DownloadModal"

export default {
    title: "DownloadModalContent",
    component: DownloadModal,
}

export const Default = (): React.ReactElement => {
    return (
        <DownloadModal
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
