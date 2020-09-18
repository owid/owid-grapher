import * as React from "react"
import { StackedAreaChart } from "./StackedAreaChart"
import { basicGdpGrapher } from "grapher/test/samples"
import { Bounds } from "grapher/utils/Bounds"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

export const Default = () => {
    const grapher = basicGdpGrapher()
    const bounds = new Bounds(0, 0, 640, 480)

    return (
        <svg width={640} height={480}>
            <StackedAreaChart options={grapher} bounds={bounds} />
        </svg>
    )
}
