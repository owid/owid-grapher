#! /usr/bin/env yarn jest

import { DiscreteBarChart } from "./DiscreteBarChart"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import {
    DEFAULT_BAR_COLOR,
    DiscreteBarChartManager,
} from "./DiscreteBarChartConstants"
import { ColorSchemeName } from "grapher/color/ColorConstants"

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

describe("barcharts with columns as the series", () => {
    const manager: DiscreteBarChartManager = {
        table: SynthesizeGDPTable({ timeRange: [2000, 2010] }).selectSample(1),
        yColumnSlugs: [SampleColumnSlugs.Population, SampleColumnSlugs.GDP],
    }
    const chart = new DiscreteBarChart({ manager })

    expect(chart.series.length).toEqual(2)

    it("can add colors to columns as series", () => {
        manager.baseColorScheme = ColorSchemeName.Reds
        const chart = new DiscreteBarChart({ manager })
        expect(chart.series[0].color).not.toEqual(DEFAULT_BAR_COLOR)
    })
})
