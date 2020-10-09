import * as React from "react"
import { LineChart } from "grapher/lineCharts/LineChart"
import { SynthesizeGDPTable } from "coreTable/OwidTableSynthesizers"

export default {
    title: "LineChart",
    component: LineChart,
}

export const SingleColumnMultiCountry = () => {
    const table = SynthesizeGDPTable().selectAll()
    return (
        <div>
            <svg width={600} height={600}>
                <LineChart manager={{ table, yColumnSlugs: ["GDP"] }} />
            </svg>
            <div>With missing data:</div>
            <svg width={600} height={600}>
                <LineChart
                    manager={{
                        table: table.dropRandomRows(50),
                        yColumnSlugs: ["GDP"],
                    }}
                />
            </svg>
        </div>
    )
}

export const WithPointsHidden = () => {
    const table = SynthesizeGDPTable({
        entityCount: 6,
        timeRange: [1900, 2000],
    }).selectAll()
    return (
        <div>
            <svg width={600} height={600}>
                <LineChart manager={{ table, yColumnSlugs: ["GDP"] }} />
            </svg>
        </div>
    )
}

export const MultiColumnSingleCountry = () => {
    const table = SynthesizeGDPTable().selectSample(1)

    return (
        <div>
            <svg width={600} height={600}>
                <LineChart manager={{ table }} />
            </svg>
            <div>With missing data:</div>
            <svg width={600} height={600}>
                <LineChart manager={{ table: table.dropRandomRows(100) }} />
            </svg>
        </div>
    )
}
