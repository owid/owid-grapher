import { ChartManager } from "../chart/ChartManager"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import React from "react"
import { StackedAreaChart } from "./StackedAreaChart"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

const seed = Date.now()
const table = SynthesizeGDPTable(
    {
        entityCount: 10,
        timeRange: [1950, 2010],
    },
    seed
)
const entitiesChart: ChartManager = {
    table,
    selection: table.sampleEntityName(5),
    yColumnSlugs: [SampleColumnSlugs.GDP],
}

export const EntitiesAsSeriesRelative = (): JSX.Element => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{ ...entitiesChart, isRelativeMode: true }}
        />
    </svg>
)

export const EntitiesAsSeries = (): JSX.Element => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{ ...entitiesChart, isRelativeMode: false }}
        />
    </svg>
)

export const EntitiesAsSeriesWithMissingRowsAndInterpolation =
    (): JSX.Element => (
        <svg width={600} height={600}>
            <StackedAreaChart
                manager={{
                    ...entitiesChart,
                    table: table.dropRandomRows(30, seed),
                }}
            />
        </svg>
    )

export const EntitiesAsSeriesWithMissingRowsNoInterpolation =
    (): JSX.Element => (
        <svg width={600} height={600}>
            <StackedAreaChart
                disableLinearInterpolation={true}
                manager={{
                    ...entitiesChart,
                    table: table.dropRandomRows(30, seed),
                }}
            />
        </svg>
    )

export const EntitiesAsSeriesWithMissingRowsAndInterpolationRelative =
    (): JSX.Element => (
        <svg width={600} height={600}>
            <StackedAreaChart
                manager={{
                    ...entitiesChart,
                    table: table.dropRandomRows(30, seed),
                    isRelativeMode: true,
                }}
            />
        </svg>
    )

export const EntitiesAsSeriesWithMissingRowsNoInterpolationRelative =
    (): JSX.Element => (
        <svg width={600} height={600}>
            <StackedAreaChart
                disableLinearInterpolation={true}
                manager={{
                    ...entitiesChart,
                    table: table.dropRandomRows(30, seed),
                    isRelativeMode: true,
                }}
            />
        </svg>
    )

const colTable = SynthesizeFruitTable()
const columnsChart: ChartManager = {
    table: colTable,
    selection: colTable.sampleEntityName(1),
}

export const ColumnsAsSeries = (): JSX.Element => (
    <svg width={600} height={600}>
        <StackedAreaChart manager={columnsChart} />
    </svg>
)

export const ColumnsAsSeriesRelative = (): JSX.Element => (
    <svg width={600} height={600}>
        <StackedAreaChart manager={{ ...columnsChart, isRelativeMode: true }} />
    </svg>
)

export const ColumnsAsSeriesWithMissingCells = (): JSX.Element => {
    const table = SynthesizeFruitTable().replaceRandomCells(200, [
        SampleColumnSlugs.Fruit,
    ])
    return (
        <svg width={600} height={600}>
            <StackedAreaChart
                manager={{
                    selection: table.sampleEntityName(1),
                    table,
                }}
            />
        </svg>
    )
}

export const ColumnsAsSeriesWithMissingRowsAndInterpolationRelative =
    (): JSX.Element => {
        let table = SynthesizeFruitTable().dropRandomRows(30, seed)
        const firstCol = table.columnsAsArray[0]
        const junkFoodColumn = {
            ...firstCol.def,
            slug: "junkFood",
            name: "JunkFood",
            values: firstCol.values.slice().reverse(),
        }
        table = table.appendColumns([junkFoodColumn])
        return (
            <svg width={600} height={600}>
                <StackedAreaChart
                    manager={{
                        selection: table.sampleEntityName(1),
                        table,
                        isRelativeMode: true,
                    }}
                />
            </svg>
        )
    }
