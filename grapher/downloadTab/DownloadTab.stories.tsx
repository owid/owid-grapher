import * as React from "react"
import { DownloadTab } from "./DownloadTab"

export default {
    title: "DownloadTab",
    component: DownloadTab,
}

export const Default = () => {
    return <DownloadTab manager={{ displaySlug: "some-graph" }} />
}
