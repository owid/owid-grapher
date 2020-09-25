import * as React from "react"
import { MapChartWithLegend } from "./MapChartWithLegend"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { MapChartOptionsProvider } from "./MapChartConstants"

export default {
    title: "MapChartWithLegend",
    component: MapChartWithLegend,
}

export const Default = () => {
    const table = SynthesizeOwidTable({
        timeRange: [2000, 2010],
        countryCount: 200,
    })

    const options: MapChartOptionsProvider = {
        table,
        mapColumnSlug: "Population",
    }

    return (
        <svg width={640} height={480}>
            <MapChartWithLegend options={options} />
        </svg>
    )
}
