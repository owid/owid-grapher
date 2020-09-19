import * as React from "react"
import { DiscreteBarChart } from "./DiscreteBarChart"
import { basicGdpGrapher } from "grapher/test/samples"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart,
}

export const Default = () => {
    const grapher = basicGdpGrapher()

    return (
        <svg width={640} height={480}>
            <DiscreteBarChart options={grapher} />
        </svg>
    )
}
