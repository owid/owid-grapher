import { ChartManager } from "grapher/chart/ChartManager"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import * as React from "react"
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
).selectSample(5)
const entitiesChart: ChartManager = {
    table,
    yColumnSlugs: [SampleColumnSlugs.GDP],
}

export const EntitiesAsSeriesRelative = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{ ...entitiesChart, isRelativeMode: true }}
        />
    </svg>
)

export const EntitiesAsSeries = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{ ...entitiesChart, isRelativeMode: false }}
        />
    </svg>
)

export const EntitiesAsSeriesWithMissingRowsAndInterpolation = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{
                ...entitiesChart,
                table: table.dropRandomRows(30, seed),
            }}
        />
    </svg>
)

export const EntitiesAsSeriesWithMissingRowsNoInterpolation = () => (
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

const columnsChart: ChartManager = {
    table: SynthesizeFruitTable().selectSample(1),
}

export const ColumnsAsSeries = () => (
    <svg width={600} height={600}>
        <StackedAreaChart manager={columnsChart} />
    </svg>
)

export const ColumnsAsSeriesRelative = () => (
    <svg width={600} height={600}>
        <StackedAreaChart manager={{ ...columnsChart, isRelativeMode: true }} />
    </svg>
)

export const ColumnsAsSeriesWithMissingCells = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{
                table: SynthesizeFruitTable()
                    .selectSample(1)
                    .replaceRandomCells(200, [SampleColumnSlugs.Fruit]),
            }}
        />
    </svg>
)
