import * as React from "react"
import { LineChart } from "grapher/lineCharts/LineChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ScaleType } from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"

export default {
    title: "LineChart",
    component: LineChart,
}

export const SingleColumnMultiCountry = () => {
    const table = SynthesizeGDPTable().selectAll()
    const bounds = new Bounds(0, 0, 500, 250)
    return (
        <div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{ table, yColumnSlugs: [SampleColumnSlugs.GDP] }}
                />
            </svg>
            <div>With missing data:</div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{
                        table: table.dropRandomRows(50),
                        yColumnSlugs: [SampleColumnSlugs.GDP],
                    }}
                />
            </svg>
        </div>
    )
}

export const WithLogScaleAndNegativeAndZeroValues = () => {
    const table = SynthesizeFruitTableWithNonPositives({
        entityCount: 2,
        timeRange: [1900, 2000],
    }).selectAll()
    const bounds = new Bounds(0, 0, 500, 250)
    const bounds2 = new Bounds(0, 270, 500, 250)
    return (
        <svg width={500} height={550}>
            <LineChart
                bounds={bounds}
                manager={{
                    table,
                    yColumnSlugs: [SampleColumnSlugs.Fruit],
                }}
            />
            <LineChart
                bounds={bounds2}
                manager={{
                    table,
                    yColumnSlugs: [SampleColumnSlugs.Fruit],
                    yAxisConfig: { scaleType: ScaleType.log },
                }}
            />
        </svg>
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
                <LineChart
                    manager={{ table, yColumnSlugs: [SampleColumnSlugs.GDP] }}
                />
            </svg>
        </div>
    )
}

export const MultiColumnSingleCountry = () => {
    const table = SynthesizeGDPTable().selectSample(1)
    const bounds = new Bounds(0, 0, 500, 250)
    return (
        <div>
            <svg width={500} height={250}>
                <LineChart bounds={bounds} manager={{ table }} />
            </svg>
            <div>With missing data:</div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{ table: table.dropRandomRows(100) }}
                />
            </svg>
        </div>
    )
}
