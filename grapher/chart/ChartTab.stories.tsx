import * as React from "react"
import { basicGdpGrapher } from "grapher/test/samples"
import { ChartTab } from "./ChartTab"

export default {
    title: "ChartTab",
    component: ChartTab,
}

export const Default = () => {
    const grapher = basicGdpGrapher()
    grapher.hasMapTab = true
    grapher.tab = "map"

    return <ChartTab options={grapher} />
}
