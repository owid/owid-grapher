import * as React from "react"
import { LineChart } from "grapher/lineCharts/LineChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ScaleType } from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"
import { makeAnnotationsSlug } from "coreTable/LegacyToOwidTable"
import { range } from "grapher/utils/Util"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"

export default {
    title: "LineChart",
    component: LineChart,
}

export const SingleColumnMultiCountry = () => {
    const table = SynthesizeGDPTable()
    const bounds = new Bounds(0, 0, 500, 250)
    return (
        <div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{
                        table,
                        yColumnSlugs: [SampleColumnSlugs.GDP],
                        selection: table.availableEntityNames,
                    }}
                />
            </svg>
            <div>With missing data:</div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{
                        table: table.dropRandomRows(50),
                        selection: table.availableEntityNames,
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
    })
    const bounds = new Bounds(0, 0, 500, 250)
    const bounds2 = new Bounds(0, 270, 500, 250)
    return (
        <svg width={500} height={550}>
            <LineChart
                bounds={bounds}
                manager={{
                    table,
                    selection: table.availableEntityNames,
                    yColumnSlugs: [SampleColumnSlugs.Fruit],
                }}
            />
            <LineChart
                bounds={bounds2}
                manager={{
                    table,
                    selection: table.availableEntityNames,
                    yColumnSlugs: [SampleColumnSlugs.Fruit],
                    yAxisConfig: { scaleType: ScaleType.log },
                }}
            />
        </svg>
    )
}

export const WithoutCirclesOnPoints = () => {
    const table = SynthesizeGDPTable({
        entityCount: 6,
        timeRange: [1900, 2000],
    })
    return (
        <div>
            <svg width={600} height={600}>
                <LineChart
                    manager={{
                        table,
                        yColumnSlugs: [SampleColumnSlugs.GDP],
                        selection: table.availableEntityNames,
                    }}
                />
            </svg>
        </div>
    )
}

export const WithAnnotations = () => {
    let table = SynthesizeGDPTable({
        entityCount: 6,
        timeRange: [1900, 2000],
    })
    // todo: eventually we should create a better API for annotations
    table = table.appendColumns([
        {
            slug: makeAnnotationsSlug(SampleColumnSlugs.GDP),
            values: table
                .get(OwidTableSlugs.entityName)
                .values.map((name) => `${name} is a country`),
        },
    ])
    return (
        <div>
            <svg width={600} height={600}>
                <LineChart
                    manager={{
                        table,
                        yColumnSlugs: [SampleColumnSlugs.GDP],
                        selection: table.availableEntityNames,
                    }}
                />
            </svg>
        </div>
    )
}

export const MultiColumnSingleCountry = () => {
    const table = SynthesizeGDPTable()
    const bounds = new Bounds(0, 0, 500, 250)
    return (
        <div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{ table, selection: table.sampleEntityName(1) }}
                />
            </svg>
            <div>With missing data:</div>
            <svg width={500} height={250}>
                <LineChart
                    bounds={bounds}
                    manager={{
                        table: table.dropRandomRows(100),
                        selection: table.sampleEntityName(1),
                    }}
                />
            </svg>
        </div>
    )
}

export const MultiColumnMultiCountry = () => {
    const table = SynthesizeFruitTable({ entityCount: 5 })
    const bounds = new Bounds(0, 0, 500, 250)
    return (
        <svg width={500} height={250}>
            <LineChart
                bounds={bounds}
                manager={{ table, selection: table.availableEntityNames }}
            />
        </svg>
    )
}
