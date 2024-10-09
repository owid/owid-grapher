import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { ScaleType } from "@ourworldindata/types"
import { DEFAULT_BOUNDS } from "@ourworldindata/utils"
import React from "react"
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

const size = { width: DEFAULT_BOUNDS.width, height: DEFAULT_BOUNDS.height }

export const OneYearWithSizeColumn = (): React.ReactElement => {
    return (
        <svg {...size}>
            <ScatterPlotChart manager={oneYearWithSizeColumn} />
        </svg>
    )
}

export const WithComparisonLinesAndSelection = (): React.ReactElement => {
    const table = SynthesizeGDPTable({ entityCount: 200 }).filterByTargetTimes(
        [2000],
        0
    )
    const manager = {
        ...oneYearWithComparisons,
        table,
        selection: table.sampleEntityName(5),
    }
    return (
        <>
            <svg {...size}>
                <ScatterPlotChart manager={manager} />
            </svg>
        </>
    )
}

export const LogScales = (): React.ReactElement => {
    const yAxisConfig = {
        scaleType: ScaleType.log,
        min: 0,
    }
    const xAxisConfig = {
        scaleType: ScaleType.log,
        min: 0,
    }
    return (
        <>
            <svg {...size}>
                <ScatterPlotChart manager={oneYearWithComparisons} />
            </svg>
            <svg {...size}>
                <ScatterPlotChart
                    manager={{ ...oneYearWithComparisons, yAxisConfig }}
                />
            </svg>
            <svg {...size}>
                <ScatterPlotChart
                    manager={{ ...oneYearWithComparisons, xAxisConfig }}
                />
            </svg>
            <svg {...size}>
                <ScatterPlotChart
                    manager={{
                        ...oneYearWithComparisons,
                        yAxisConfig,
                        xAxisConfig,
                    }}
                />
            </svg>
        </>
    )
}

export const LogScaleWithNonPositives = (): React.ReactElement => {
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
        <svg {...size}>
            <ScatterPlotChart manager={manager} />
        </svg>
    )
}

export const MultipleYearsWithConnectedLines = (): React.ReactElement => (
    <svg {...size}>
        <ScatterPlotChart manager={basicSetup} />
    </svg>
)

export const MultipleYearsWithConnectedLinesAndBackgroundLines =
    (): React.ReactElement => {
        const table = SynthesizeGDPTable({ entityCount: 20 })
        return (
            <svg {...size}>
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
export const OneYearWithSizeAndColorColumn = (): React.ReactElement => {
    return (
        <svg {...size}>
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
export const AverageAnnualChange = (): React.ReactElement => {
    return (
        <svg {...size}>
            <ScatterPlotChart manager={oneYear} />
        </svg>
    )
}

// TODO
export const CustomColors = (): React.ReactElement => {
    return (
        <svg {...size}>
            <ScatterPlotChart manager={oneYear} />
        </svg>
    )
}
