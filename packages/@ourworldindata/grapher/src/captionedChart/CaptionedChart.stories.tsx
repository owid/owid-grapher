import { SynthesizeGDPTable } from "@ourworldindata/core-table"
import {
    GRAPHER_CHART_TYPES,
    FacetStrategy,
    GRAPHER_TAB_OPTIONS,
    SeriesStrategy,
} from "@ourworldindata/types"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import React from "react"
import {
    CaptionedChart,
    CaptionedChartManager,
    StaticCaptionedChart,
} from "./CaptionedChart"

export default {
    title: "CaptionedChart",
    component: CaptionedChart,
}

const table = SynthesizeGDPTable({ entityCount: 5 })

const manager: CaptionedChartManager = {
    captionedChartBounds: DEFAULT_BOUNDS,
    table,
    selection: table.availableEntityNames,
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    note: "Here are some footer notes",
    isReady: true,
    availableFacetStrategies: [FacetStrategy.none],
    detailRenderers: [],
}

export const LineChart = (): React.ReactElement => (
    <CaptionedChart manager={manager} />
)

export const StaticLineChartForExport = (): React.ReactElement => {
    return (
        <StaticCaptionedChart
            manager={{
                ...manager,
                isExportingToSvgOrPng: true,
            }}
        />
    )
}

export const MapChart = (): React.ReactElement => (
    <CaptionedChart manager={{ ...manager, tab: GRAPHER_TAB_OPTIONS.map }} />
)
export const StackedArea = (): React.ReactElement => (
    <CaptionedChart
        manager={{
            ...manager,
            type: GRAPHER_CHART_TYPES.StackedArea,
            seriesStrategy: SeriesStrategy.entity,
        }}
    />
)
export const Scatter = (): React.ReactElement => (
    <CaptionedChart
        manager={{
            ...manager,
            type: GRAPHER_CHART_TYPES.ScatterPlot,
            table: table.filterByTargetTimes([1999], 0),
        }}
    />
)
