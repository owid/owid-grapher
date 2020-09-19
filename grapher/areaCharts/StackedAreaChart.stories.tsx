import * as React from "react"
import { StackedAreaChart } from "./StackedAreaChart"
import { basicGdpGrapher } from "grapher/test/samples"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

export const Default = () => {
    const grapher = basicGdpGrapher()

    return (
        <svg width={640} height={480}>
            <StackedAreaChart options={grapher} />
        </svg>
    )
}
