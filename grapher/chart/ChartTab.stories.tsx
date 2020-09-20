import { Grapher, GrapherProps } from "grapher/core/Grapher"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import * as React from "react"
import { ChartTab } from "./ChartTab"

export default {
    title: "ChartTab",
    component: ChartTab,
}

const table = SynthesizeOwidTable()
const props: GrapherProps = {
    table,
    hasMapTab: true,
    dimensions: [{ slug: "Population", property: "y", variableId: 1 }],
    tab: "map",
    type: "LineChart",
}

export const Default = () => {
    return <ChartTab options={new Grapher(props)} />
}
