import * as React from "react"
import "site/client/owid.scss"
import "charts/core/grapher.scss"
import { DiscreteBarChart } from "./DiscreteBarChart"
import { basicGdpGrapher } from "charts/test/samples"
import { Bounds } from "charts/utils/Bounds"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart
}

export const Default = () => {
    const chart = basicGdpGrapher()
    const bounds = new Bounds(0, 0, 640, 480)

    return (
        <svg width={640} height={480}>
            <DiscreteBarChart grapher={chart} bounds={bounds} />
        </svg>
    )
}
