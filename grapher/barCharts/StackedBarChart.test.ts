#! /usr/bin/env yarn jest

import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"
import { StackedBarChart } from "./StackedBarChart"

it("can create a chart", () => {
    const manager = {
        table: SynthesizeGDPTable({ timeRange: [2000, 2010] }),
        yColumnSlugs: [SampleColumnSlugs.Population],
    }

    const chart = new StackedBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    manager.table.selectSample(1)
    expect(chart.failMessage).toEqual("")
    expect(chart.series[0].points.length).toEqual(10)
})

describe("stackedbar chart with columns as series", () => {
    const manager = {
        table: SynthesizeGDPTable().selectSample(1),
        yColumnSlugs: [SampleColumnSlugs.Population, SampleColumnSlugs.GDP],
    }
    const chart = new StackedBarChart({ manager })

    it("render the legend items in the same stack order as the chart, bottom stack item on bottom of chart", () => {
        expect(chart.series.length).toEqual(2)
        expect(chart.categoricalValues).toEqual(
            chart.series.map((series) => series.seriesName)
        )
        expect(chart.series[0].seriesName).toEqual(SampleColumnSlugs.GDP)
    })
})

describe("stackedbar chart with entities as series", () => {
    const manager = {
        table: SynthesizeGDPTable({ entityCount: 5 }).selectAll(),
        yColumnSlugs: [SampleColumnSlugs.Population],
    }
    const chart = new StackedBarChart({ manager })

    it("can render complete data correctly", () => {
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].y).toBeTruthy()
    })

    it("can handle a missing row", () => {
        const manager = {
            table: SynthesizeGDPTable({ entityCount: 5 })
                .selectAll()
                .dropRandomRows(1, 1),
            yColumnSlugs: [SampleColumnSlugs.Population],
        }
        const chart = new StackedBarChart({ manager })
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].y).toBeTruthy()
    })
})
