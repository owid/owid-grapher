import * as React from "react"
import { MapChart } from "./MapChart"
import { SynthesizeGDPTable } from "coreTable/OwidTableSynthesizers"

export default {
    title: "MapChart",
    component: MapChart,
}

export const AutoColors = () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 200,
    })

    return (
        <svg width={600} height={600}>
            <MapChart manager={{ table }} />
        </svg>
    )
}
