#! /usr/bin/env yarn jest

import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { StackedBarChart } from "./StackedBarChart"

it("can create a chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })

    const manager = {
        table,
        yColumnSlugs: ["Population"],
    }

    const chart = new StackedBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    table.selectSample(1)
    expect(chart.failMessage).toEqual("")
    expect(chart.series[0].points.length).toEqual(10)
})

describe("stackedbar chart with columns as series", () => {
    const table = SynthesizeGDPTable()
    const yColumnSlugs = ["Population", "GDP"]
    const manager = {
        table,
        yColumnSlugs,
    }
    const chart = new StackedBarChart({ manager })

    it("render the legend items in the same stack order as the chart, bottom stack item on bottom of chart", () => {
        expect(chart.series.length).toEqual(2)
        expect(chart.categoricalValues).toEqual(yColumnSlugs.reverse())
        expect(chart.series[0].seriesName).toEqual("GDP")
    })
})

describe("stackedbar chart with entities as series", () => {
    const manager = {
        table: SynthesizeGDPTable({ entityCount: 5 }).selectAll(),
        yColumnSlugs: ["Population"],
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
            yColumnSlugs: ["Population"],
        }
        const chart = new StackedBarChart({ manager })
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].y).toBeTruthy()
    })
})
