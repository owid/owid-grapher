import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { ScatterPlot } from "./ScatterPlot"
import { basicScatter } from "./ScatterPlot.tests"

export default {
    title: "ScatterPlot",
    component: ScatterPlot
}

export const Default = () => {
    const chartRuntime = basicScatter()

    return (
        <svg width={640} height={480}>
            <ScatterPlot config={chartRuntime} />
        </svg>
    )
}
