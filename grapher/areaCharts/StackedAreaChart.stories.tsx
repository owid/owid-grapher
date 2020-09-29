import { ChartManager } from "grapher/chart/ChartManager"
import { SynthesizeFruitTable, SynthesizeGDPTable } from "coreTable/OwidTable"
import * as React from "react"
import { StackedAreaChart } from "./StackedAreaChart"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

const entitiesChart: ChartManager = {
    table: SynthesizeGDPTable({
        countryCount: 10,
        timeRange: [1950, 2010],
    }),
    yColumnSlugs: ["GDP"],
}
entitiesChart.table.selectSample(5)

export const EntitiesAsSeries = () => {
    entitiesChart.isRelativeMode = false
    return <StackedAreaChart manager={entitiesChart} />
}

export const EntitiesAsSeriesRelative = () => {
    entitiesChart.isRelativeMode = true
    return <StackedAreaChart manager={entitiesChart} />
}

const columnsChart: ChartManager = {
    table: SynthesizeFruitTable({
        timeRange: [1950, 2000],
    }),
    yColumnSlugs: ["Fruit", "Vegetables"],
}

columnsChart.table.selectSample(1)

export const ColumnsAsSeries = () => {
    columnsChart.isRelativeMode = false
    return <StackedAreaChart manager={columnsChart} />
}

export const ColumnsAsSeriesRelative = () => {
    columnsChart.isRelativeMode = true
    return <StackedAreaChart manager={columnsChart} />
}
