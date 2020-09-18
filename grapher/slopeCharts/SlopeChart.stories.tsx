import * as React from "react"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
import { SlopeChart } from "./SlopeChart"
import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { SlopeChartOptionsProvider } from "./SlopeChartOptionsProvider"

export default {
    title: "SlopeChart",
    component: SlopeChart,
}

const table = SynthesizeOwidTable({
    timeRange: [1950, 2010],
})

export const Default = () => {
    const options: SlopeChartOptionsProvider = {
        entityType: "Country",
        addCountryMode: "add-country",
        table,
        yColumnSlug: "GDP",
    }

    return (
        <svg width={640} height={480}>
            <SlopeChart options={options} bounds={new Bounds(0, 0, 800, 400)} />
        </svg>
    )
}
