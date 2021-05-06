#! /usr/bin/env jest

import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "../../coreTable/OwidTableSynthesizers"
import { ChartManager } from "../chart/ChartManager"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart"

it("can create a chart", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const selection = new SelectionArray()
    const manager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
        selection,
    }

    const chart = new StackedDiscreteBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(5))
    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.series[0].points.length).toEqual(5)
})

describe("columns as series", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const manager: ChartManager = {
        table,
        selection: table.sampleEntityName(5),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
    }
    const chart = new StackedDiscreteBarChart({ manager })

    it("renders the legend items in the order of yColumns", () => {
        expect(chart.categoricalLegendData.length).toEqual(2)
        expect(chart.categoricalLegendData.map((bin) => bin.value)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })

    it("render the stacked bars in order of yColumns", () => {
        expect(chart.series.length).toEqual(2)
        expect(chart.series.map((series) => series.seriesName)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })
})
