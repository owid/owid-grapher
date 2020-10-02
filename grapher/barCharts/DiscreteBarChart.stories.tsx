import * as React from "react"
import { DiscreteBarChart } from "./DiscreteBarChart"
import {
    SynthesizeGDPTable,
    SynthesizeNonCountryTable,
} from "coreTable/OwidTable"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants"

export default {
    title: "DiscreteBarChart",
    component: DiscreteBarChart,
}

export const Countries = () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] }).selectAll()

    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlug: "Population",
    }

    return (
        <svg width={600} height={600}>
            <DiscreteBarChart manager={manager} />
        </svg>
    )
}

export const Other = () => {
    const table = SynthesizeNonCountryTable().selectAll()
    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlug: "Disasters",
    }

    return (
        <svg width={600} height={600}>
            <DiscreteBarChart manager={manager} />
        </svg>
    )
}
