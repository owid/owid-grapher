import { ChartManager } from "grapher/chart/ChartManager"
import { SynthesizeFruitTable, SynthesizeGDPTable } from "coreTable/OwidTable"
import * as React from "react"
import { StackedAreaChart } from "./StackedAreaChart"

export default {
    title: "StackedAreaChart",
    component: StackedAreaChart,
}

export const Default = () => {
    const manager: ChartManager = {
        table: SynthesizeGDPTable({
            timeRange: [1950, 2010],
        }),
        yColumnSlugs: ["GDP"],
    }

    manager.table.selectAll()

    return (
        <svg width={640} height={480}>
            <StackedAreaChart manager={manager} />
        </svg>
    )
}

export const RelativeMode = () => {
    const manager: ChartManager = {
        table: SynthesizeFruitTable({
            timeRange: [1950, 2000],
        }),
        yColumnSlugs: ["Fruit", "Vegetables"],
    }

    manager.table.selectAll()

    return (
        <svg width={640} height={480}>
            <StackedAreaChart manager={manager} />
        </svg>
    )
}
