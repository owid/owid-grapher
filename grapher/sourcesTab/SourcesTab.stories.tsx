import { SynthesizeGDPTable } from "coreTable/OwidTable"
import * as React from "react"
import { SourcesTab } from "./SourcesTab"

export default {
    title: "SourcesTab",
    component: SourcesTab,
}

export const WithSources = () => (
    <SourcesTab
        manager={{ columnsWithSources: SynthesizeGDPTable().columnsAsArray }}
    />
)
export const NoSources = () => (
    <SourcesTab manager={{ columnsWithSources: [] }} />
)
