import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ScaleType } from "grapher/core/GrapherConstants"
import * as React from "react"
import { ScatterPlotChart } from "./ScatterPlotChart"
import { ScatterPlotManager } from "./ScatterPlotChartConstants"

export default {
    title: "ScatterPlotChart",
    component: ScatterPlotChart,
}

const table = SynthesizeGDPTable({ entityCount: 20 })
const basicSetup: ScatterPlotManager = {
    table,
    selection: table.availableEntityNames,
    yColumnSlug: SampleColumnSlugs.GDP,
    xColumnSlug: SampleColumnSlugs.Population,
    yAxisConfig: {
        min: 0,
    },
    xAxisConfig: {
        min: 0,
    },
}

const table2 = SynthesizeGDPTable({ entityCount: 20 }).filterByTargetTimes(
    [2000],
    0
)
const oneYear: ScatterPlotManager = {
    ...basicSetup,
    selection: table2.availableEntityNames,
    table: table2,
}

const oneYearWithSizeColumn = {
    ...oneYear,
    sizeColumnSlug: SampleColumnSlugs.LifeExpectancy,
}

const oneYearWithComparisons = {
    ...oneYear,
    comparisonLines: [
        {
            label: "GDP = Population * 1000",
            yEquals: "1000*x",
        },
    ],
}

export const OneYearWithSizeColumn = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart manager={oneYearWithSizeColumn} />
        </svg>
    )
}

export const WithComparisonLinesAndSelection = () => {
    const table = SynthesizeGDPTable({ entityCount: 20 }).filterByTargetTimes(
        [2000],
        0
    )
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart
                manager={{
                    ...oneYearWithComparisons,
                    table,
                    selection: table.sampleEntityName(5),
                }}
            />
        </svg>
    )
}

export const LogScales = () => {
    const yAxisConfig = {
        scaleType: ScaleType.log,
        min: 0,
    }
    const xAxisConfig = {
        scaleType: ScaleType.log,
        min: 0,
    }
    return (
        <div>
            <svg width={600} height={600}>
                <ScatterPlotChart manager={oneYearWithComparisons} />
            </svg>
            <svg width={600} height={600}>
                <ScatterPlotChart
                    manager={{ ...oneYearWithComparisons, yAxisConfig }}
                />
            </svg>
            <svg width={600} height={600}>
                <ScatterPlotChart
                    manager={{ ...oneYearWithComparisons, xAxisConfig }}
                />
            </svg>
            <svg width={600} height={600}>
                <ScatterPlotChart
                    manager={{
                        ...oneYearWithComparisons,
                        yAxisConfig,
                        xAxisConfig,
                    }}
                />
            </svg>
        </div>
    )
}

export const LogScaleWithNonPositives = () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeFruitTableWithNonPositives(),
        selection: table.availableEntityNames,
        yColumnSlug: SampleColumnSlugs.Fruit,
        xColumnSlug: SampleColumnSlugs.Vegetables,
        yAxisConfig: {
            min: 0,
            scaleType: ScaleType.log,
        },
        xAxisConfig: {
            min: 0,
            scaleType: ScaleType.log,
        },
    }
    return (
        <div>
            <svg width={600} height={600}>
                <ScatterPlotChart manager={manager} />
            </svg>
        </div>
    )
}

export const MultipleYearsWithConnectedLines = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart manager={basicSetup} />
        </svg>
    )
}

export const MultipleYearsWithConnectedLinesAndBackgroundLines = () => {
    const table = SynthesizeGDPTable({ entityCount: 20 })
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart
                manager={{
                    ...basicSetup,
                    table,
                    selection: table.sampleEntityName(2),
                }}
            />
        </svg>
    )
}

// TODO
export const OneYearWithSizeAndColorColumn = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart
                manager={{
                    ...oneYearWithSizeColumn,
                    colorColumnSlug: SampleColumnSlugs.LifeExpectancy,
                }}
            />
        </svg>
    )
}

// TODO
export const AverageAnnualChange = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart manager={oneYear} />
        </svg>
    )
}

// TODO
export const CustomColors = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart manager={oneYear} />
        </svg>
    )
}
