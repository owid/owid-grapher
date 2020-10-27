import { SynthesizeGDPTable } from "coreTable/OwidTableSynthesizers"
import {
    ChartTypeName,
    GrapherTabOption,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import * as React from "react"
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
    tabBounds: DEFAULT_BOUNDS,
    table,
    selection: table.availableEntityNames,
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    note: "Here are some footer notes",
    populateFromQueryParams: () => {},
    isReady: true,
}

export const LineChart = () => <CaptionedChart manager={manager} />

export const StaticLineChartForExport = () => {
    return (
        <StaticCaptionedChart
            manager={{
                ...manager,
                isStaticSvg: true,
            }}
        />
    )
}

export const MapChart = () => (
    <CaptionedChart manager={{ ...manager, tab: GrapherTabOption.map }} />
)
export const StackedArea = () => (
    <CaptionedChart
        manager={{
            ...manager,
            type: ChartTypeName.StackedArea,
            seriesStrategy: SeriesStrategy.entity,
        }}
    />
)
export const Scatter = () => (
    <CaptionedChart
        manager={{
            ...manager,
            type: ChartTypeName.ScatterPlot,
            table: table.filterByTargetTimes([1999], 0),
        }}
    />
)
