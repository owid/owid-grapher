import * as React from "react"
import { SourcesTab, SourcesTabOptionsProvider } from "./SourcesTab"

export default {
    title: "SourcesTab",
    component: SourcesTab,
}

const options: SourcesTabOptionsProvider = {
    columnsWithSources: [],
}

export const Default = () => {
    return <SourcesTab options={options} />
}
