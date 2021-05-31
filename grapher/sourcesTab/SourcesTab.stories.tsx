import { SynthesizeGDPTable } from "../../coreTable/OwidTableSynthesizers"
import * as React from "react"
import { SourcesTab } from "./SourcesTab"

export default {
    title: "SourcesTab",
    component: SourcesTab,
}

export const WithSources = (): JSX.Element => (
    <SourcesTab
        manager={{ columnsWithSources: SynthesizeGDPTable().columnsAsArray }}
    />
)
export const NoSources = (): JSX.Element => (
    <SourcesTab manager={{ columnsWithSources: [] }} />
)
