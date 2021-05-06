import * as React from "react"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart"
import { SynthesizeFruitTable } from "../../coreTable/OwidTableSynthesizers"

export default {
    title: "StackedDiscreteBarChart",
    component: StackedDiscreteBarChart,
}

export const ColumnsAsSeries = () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })

    return (
        <svg width={600} height={600}>
            <StackedDiscreteBarChart
                manager={{ table, selection: table.sampleEntityName(5) }}
            />
        </svg>
    )
}
