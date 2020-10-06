import { SynthesizeGDPTable } from "coreTable/OwidTable"
import {
    ChartTypeName,
    GrapherTabOption,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import * as React from "react"
import { ChartTab, ChartTabManager } from "./ChartTab"

export default {
    title: "ChartTab",
    component: ChartTab,
}

const table = SynthesizeGDPTable({ entityCount: 5 }).selectAll()

const manager: ChartTabManager = {
    table,
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    note: "Here are some footer notes",
    populateFromQueryParams: () => {},
}

export const LineChart = () => <ChartTab manager={manager} />

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
