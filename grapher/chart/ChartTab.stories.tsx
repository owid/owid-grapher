import { SynthesizeOwidTable } from "coreTable/OwidTable"
import * as React from "react"
import { ChartTab, ChartTabOptionsProvider } from "./ChartTab"

export default {
    title: "ChartTab",
    component: ChartTab,
}

const table = SynthesizeOwidTable()
table.selectAll()
const options: ChartTabOptionsProvider = {
    table,
    mapColumn: table.get("GDP")!,
    yColumns: [table.get("GDP")!],
    currentTitle: "This is the Title",
    subtitle: "A Subtitle",
    tab: "chart",
    note: "Here are some footer notes",
    type: "LineChart",
}

export const Default = () => {
    return <ChartTab options={options} />
}
