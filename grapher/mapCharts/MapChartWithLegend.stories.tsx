import * as React from "react"
import { MapChartWithLegend } from "./MapChartWithLegend"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { MapChartManager } from "./MapChartConstants"

export default {
    title: "MapChartWithLegend",
    component: MapChartWithLegend,
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

    return <MapChartWithLegend manager={manager} />
}
