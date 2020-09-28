import * as React from "react"
import { SourcesTab, SourcesTabManager } from "./SourcesTab"

export default {
    title: "SourcesTab",
    component: SourcesTab,
}

const manager: SourcesTabManager = {
    columnsWithSources: [],
}

export const Default = () => {
    return <SourcesTab manager={manager} />
}
