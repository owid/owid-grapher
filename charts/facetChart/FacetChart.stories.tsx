import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { FacetChart } from "./FacetChart"
import { basicGdpChart } from "charts/test/samples"
import { Bounds } from "charts/utils/Bounds"

export default {
    title: "FacetChart",
    component: FacetChart,
    argTypes: {
        number: { control: "range" }
    }
}

export const Default = (args: any) => {
    const chart = basicGdpChart()
    const bounds = new Bounds(0, 0, 640, 480)

    return (
        <svg width={640} height={480}>
            <FacetChart
                number={args.number || 4}
                chart={chart}
                bounds={bounds}
            />
        </svg>
    )
}
