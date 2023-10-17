import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import React from "react"
import { SourcesModal } from "./SourcesModal"

export default {
    title: "SourcesModal",
    component: SourcesModal,
}

export const WithSources = (): JSX.Element => (
    <SourcesModal
        manager={{
            columnsWithSourcesExtensive: SynthesizeGDPTable().columnsAsArray,
        }}
    />
)
export const NoSources = (): JSX.Element => (
    <SourcesModal manager={{ columnsWithSourcesExtensive: [] }} />
)
