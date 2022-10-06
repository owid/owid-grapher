import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import {
    ChartTypeName,
    FacetStrategy,
    GrapherTabOption,
    SeriesStrategy,
} from "../core/GrapherConstants.js"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import React from "react"
import {
    CaptionedChart,
    CaptionedChartManager,
    StaticCaptionedChart,
} from "./CaptionedChart.js"

export default {
    title: "CaptionedChart",
    component: CaptionedChart,
}

const table = SynthesizeGDPTable({ entityCount: 5 })

const manager: CaptionedChartManager = {
    tabBounds: DEFAULT_BOUNDS,
    table,
    selection: table.availableEntityNames,
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    note: "Here are some footer notes",
    isReady: true,
    availableFacetStrategies: [FacetStrategy.none],
    detailRenderers: [],
}

export const LineChart = (): JSX.Element => <CaptionedChart manager={manager} />

export const StaticLineChartForExport = (): JSX.Element => {
    return (
        <StaticCaptionedChart
            manager={{
                ...manager,
                isExportingtoSvgOrPng: true,
            }}
        />
    )
}

export const MapChart = (): JSX.Element => (
    <CaptionedChart manager={{ ...manager, tab: GrapherTabOption.map }} />
)
export const StackedArea = (): JSX.Element => (
    <CaptionedChart
        manager={{
            ...manager,
            type: ChartTypeName.StackedArea,
            seriesStrategy: SeriesStrategy.entity,
        }}
    />
)
export const Scatter = (): JSX.Element => (
    <CaptionedChart
        manager={{
            ...manager,
            type: ChartTypeName.ScatterPlot,
            table: table.filterByTargetTimes([1999], 0),
        }}
    />
)
