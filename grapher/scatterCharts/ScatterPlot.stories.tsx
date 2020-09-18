import * as React from "react"
import { ScatterPlot } from "./ScatterPlot"
import { basicScatterGrapher } from "grapher/test/samples"

export default {
    title: "ScatterPlot",
    component: ScatterPlot,
}

export const Default = () => {
    return (
        <svg width={640} height={480}>
            <ScatterPlot options={basicScatterGrapher()} />
        </svg>
    )
}
