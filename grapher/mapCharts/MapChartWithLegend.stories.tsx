import * as React from "react"
import { MapChartWithLegend } from "./MapChartWithLegend"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { MapChartManager } from "./MapChartConstants"

export default {
    title: "MapChartWithLegend",
    component: MapChartWithLegend,
}

export const Default = () => {
    const table = SynthesizeOwidTable({
        timeRange: [2000, 2010],
        countryCount: 200,
    })

    const manager: MapChartManager = {
        table,
        mapColumnSlug: "Population",
    }

    return (
        <svg width={640} height={480}>
            <MapChartWithLegend manager={manager} />
        </svg>
    )
}
