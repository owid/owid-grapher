import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"
import { ScaleType } from "grapher/core/GrapherConstants"
import * as React from "react"
import { ScatterPlot } from "./ScatterPlot"
import { ScatterPlotManager } from "./ScatterPlotConstants"

export default {
    title: "ScatterPlot",
    component: ScatterPlot,
}

const table = SynthesizeGDPTable({ entityCount: 20 }).selectAll()

const basicSetup: Partial<ScatterPlotManager> = {
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
    table: table.filterByTargetTime(2000, 0),
    ...basicSetup,
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
            <ScatterPlot manager={oneYearWithSizeColumn} />
        </svg>
    )
}

export const WithComparisonLines = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlot
                manager={{
                    ...oneYearWithComparisons,
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
                <ScatterPlot manager={oneYearWithComparisons} />
            </svg>
            <svg width={600} height={600}>
                <ScatterPlot
                    manager={{ ...oneYearWithComparisons, yAxisConfig }}
                />
            </svg>
            <svg width={600} height={600}>
                <ScatterPlot
                    manager={{ ...oneYearWithComparisons, xAxisConfig }}
                />
            </svg>
            <svg width={600} height={600}>
                <ScatterPlot
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
            <ScatterPlot
                manager={{
                    ...basicSetup,
                    table,
                }}
            />
        </svg>
    )
}

export const MultipleYearsWithConnectedLinesAndBackgroundLines = () => {
    return (
        <svg width={600} height={600}>
            <ScatterPlot
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
