import * as React from "react"
import { basicGdpGrapher } from "grapher/test/samples"
import { GrapherView } from "grapher/core/GrapherView"
import { ChartTab } from "./ChartTab"
import { Bounds } from "grapher/utils/Bounds"

export default {
    title: "ChartTab",
    component: ChartTab,
}

export const Default = () => {
    const grapher = basicGdpGrapher()
    grapher.hasMapTab = true
    grapher.tab = "map"
    const bounds = new Bounds(0, 0, 600, 600)

    // Todo: should not need GrapherView?
    return <GrapherView grapher={grapher} bounds={bounds} />
}
