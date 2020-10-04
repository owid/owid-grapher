import { ChartManager } from "grapher/chart/ChartManager"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTable"
import * as React from "react"
import { StackedAreaChart } from "./StackedAreaChart"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

const entitiesChart: ChartManager = {
    table: SynthesizeGDPTable({
        entityCount: 10,
        timeRange: [1950, 2010],
    }).selectSample(5),
    yColumnSlugs: [SampleColumnSlugs.GDP],
}

export const EntitiesAsSeries = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{ ...entitiesChart, isRelativeMode: false }}
        />
    </svg>
)

export const EntitiesAsSeriesRelative = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{ ...entitiesChart, isRelativeMode: true }}
        />
    </svg>
)

export const EntitiesAsSeriesWithMissingRows = () => (
    <svg width={600} height={600}>
        <StackedAreaChart
            manager={{
                ...entitiesChart,
                table: entitiesChart.table.dropRandomRows(30),
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
                    .dropRandomCells(200, [SampleColumnSlugs.Fruit]),
            }}
        />
    </svg>
)
