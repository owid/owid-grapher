import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { ScatterPlot } from "./ScatterPlot"
import { basicScatterGrapher } from "charts/test/samples"

export default {
    title: "ScatterPlot",
    component: ScatterPlot
}

export const Default = () => {
    return (
        <svg width={640} height={480}>
            <ScatterPlot chart={basicScatterGrapher()} />
        </svg>
    )
}
