import * as React from "react"
import { MapChart } from "./MapChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { MapChartManager } from "./MapChartConstants"

export default {
    title: "MapChart",
    component: MapChart,
}

export const Default = () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        countryCount: 200,
    })

    const manager: MapChartManager = {
        table,
        mapColumnSlug: "Population",
    }

    return (
        <svg width={600} height={600}>
            <MapChart manager={manager} />
        </svg>
    )
}
