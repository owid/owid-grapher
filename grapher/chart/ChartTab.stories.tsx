import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { ChartTypeName, GrapherTabOption } from "grapher/core/GrapherConstants"
import * as React from "react"
import { ChartTab, ChartTabManager } from "./ChartTab"

export default {
    title: "ChartTab",
    component: ChartTab,
}

const table = SynthesizeGDPTable()
table.selectAll()
const manager: ChartTabManager = {
    table,
    mapColumnSlug: "GDP",
    yColumnSlug: "GDP",
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    tab: GrapherTabOption.chart,
    note: "Here are some footer notes",
    type: ChartTypeName.LineChart,
}

export const Default = () => {
    return <ChartTab manager={manager} />
}
