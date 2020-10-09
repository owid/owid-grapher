import {
    SampleColumnSlugs,
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

const basicSetup: ScatterPlotManager = {
    table: SynthesizeGDPTable({ entityCount: 20 }).selectAll(),
    yColumnSlug: SampleColumnSlugs.GDP,
    xColumnSlug: SampleColumnSlugs.Population,
    yAxisConfig: {
        min: 0,
    },
    xAxisConfig: {
        min: 0,
    },
}

const oneYear: ScatterPlotManager = {
    ...basicSetup,
    table: SynthesizeGDPTable({ entityCount: 20 })
        .selectAll()
        .filterByTargetTime(2000, 0),
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
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart
                manager={{
                    ...oneYearWithComparisons,
                    table: SynthesizeGDPTable({ entityCount: 20 })
                        .filterByTargetTime(2000, 0)
                        .selectSample(5),
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

export const MultipleYearsWithConnectedLines = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart manager={basicSetup} />
        </svg>
    )
}

export const MultipleYearsWithConnectedLinesAndBackgroundLines = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlotChart
                manager={{
                    ...basicSetup,
                    table: SynthesizeGDPTable({ entityCount: 20 }).selectSample(
                        2
                    ),
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
