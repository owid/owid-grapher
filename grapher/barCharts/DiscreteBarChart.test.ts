#! /usr/bin/env yarn jest

import { DiscreteBarChart } from "./DiscreteBarChart"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants"

it("can create a new bar chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })

    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Population,
    }
    const chart = new DiscreteBarChart({ manager })

    expect(chart.failMessage).toBeTruthy()
    table.selectAll()
    expect(chart.failMessage).toEqual("")

    const series = chart.series
    expect(series.length).toEqual(2)
    expect(series[0].time).toBeTruthy()
})

it("transposed charts", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] }).selectSample(
        1
    )

    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Population, SampleColumnSlugs.GDP],
    }
    const chart = new DiscreteBarChart({ manager })

    const series = chart.series
    expect(series.length).toEqual(2)
})
