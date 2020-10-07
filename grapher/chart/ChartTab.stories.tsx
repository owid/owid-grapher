import { SynthesizeGDPTable } from "coreTable/OwidTable"
import {
    ChartTypeName,
    GrapherTabOption,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import * as React from "react"
import { ChartTab, ChartTabManager, StaticChartTab } from "./ChartTab"

export default {
    title: "ChartTab",
    component: ChartTab,
}

const table = SynthesizeGDPTable({ entityCount: 5 }).selectAll()

const manager: ChartTabManager = {
    tabBounds: DEFAULT_BOUNDS,
    table,
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    note: "Here are some footer notes",
    populateFromQueryParams: () => {},
    isReady: true,
}

export const LineChart = () => <ChartTab manager={manager} />

export const StaticLineChartForExport = () => {
    return (
        <StaticChartTab
            manager={{
                ...manager,
                isStaticSvg: true,
            }}
        />
    )
}

export const MapChart = () => (
    <ChartTab manager={{ ...manager, tab: GrapherTabOption.map }} />
)
export const StackedArea = () => (
    <ChartTab
        manager={{
            ...manager,
            type: ChartTypeName.StackedArea,
            seriesStrategy: SeriesStrategy.entity,
        }}
    />
)
export const Scatter = () => (
    <ChartTab
        manager={{
            ...manager,
            type: ChartTypeName.ScatterPlot,
            table: table.filterByTargetTime(1999, 0),
        }}
    />
)
