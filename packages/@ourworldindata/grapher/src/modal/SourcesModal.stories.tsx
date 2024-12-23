import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import * as React from "react"
import { SourcesModal } from "./SourcesModal"

export default {
    title: "SourcesModal",
    component: SourcesModal,
}

export const WithSources = (): React.ReactElement => (
    <SourcesModal
        manager={{
            columnsWithSourcesExtensive: SynthesizeGDPTable().columnsAsArray,
        }}
    />
)
export const NoSources = (): React.ReactElement => (
    <SourcesModal manager={{ columnsWithSourcesExtensive: [] }} />
)
