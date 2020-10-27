#! /usr/bin/env yarn jest

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { SelectionArray } from "grapher/core/SelectionArray"
import { StackedBarChart } from "./StackedBarChart"

it("can create a chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const selection = new SelectionArray()
    const manager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Population],
        selection,
    }

    const chart = new StackedBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(1))
    expect(chart.failMessage).toEqual("")
    expect(chart.series[0].points.length).toEqual(10)
})

describe("stackedbar chart with columns as series", () => {
    const table = SynthesizeGDPTable()
    const manager: ChartManager = {
        table,
        selection: table.sampleEntityName(1),
        selectedColumnSlugs: [
            SampleColumnSlugs.GDP,
            SampleColumnSlugs.Population,
        ],
        yColumnSlugs: [SampleColumnSlugs.Population, SampleColumnSlugs.GDP],
    }
    const chart = new StackedBarChart({ manager })

    it("render the legend items in the same stack order as the chart, bottom stack item on bottom of chart", () => {
        expect(chart.series.length).toEqual(2)
        expect(chart.categoricalValues).toEqual([
            SampleColumnSlugs.GDP,
            SampleColumnSlugs.Population,
        ])
        expect(chart.series[0].seriesName).toEqual(SampleColumnSlugs.Population)
    })
})

describe("stackedbar chart with entities as series", () => {
    const table = SynthesizeGDPTable({ entityCount: 5 })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: [SampleColumnSlugs.Population],
    }
    const chart = new StackedBarChart({ manager })

    it("can render complete data correctly", () => {
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].y).toBeTruthy()
    })

    it("can handle a missing row", () => {
        const table = SynthesizeGDPTable({ entityCount: 5 }).dropRandomRows(
            1,
            1
        )
        const manager = {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: [SampleColumnSlugs.Population],
        }
        const chart = new StackedBarChart({ manager })
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].y).toBeTruthy()
    })
})
