#! /usr/bin/env yarn jest

import { DiscreteBarChart } from "./DiscreteBarChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import {
    DEFAULT_BAR_COLOR,
    DiscreteBarChartManager,
} from "./DiscreteBarChartConstants"
import { ColorSchemeName } from "grapher/color/ColorConstants"
import { SeriesStrategy } from "grapher/core/GrapherConstants"
import { SelectionArray } from "grapher/core/SelectionArray"

it("can create a new bar chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2001] })
    const selection = new SelectionArray({
        availableEntities: table.availableEntities,
        selectedEntityNames: [],
    })
    const manager: DiscreteBarChartManager = {
        table,
        selection,
        yColumnSlug: SampleColumnSlugs.Population,
        endTime: 2000,
    }
    const chart = new DiscreteBarChart({ manager })

    expect(chart.failMessage).toBeTruthy()
    selection.selectAll()
    expect(chart.failMessage).toEqual("")

    const series = chart.series
    expect(series.length).toEqual(2)
    expect(series[0].time).toBeTruthy()
})

describe("barcharts with columns as the series", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Population, SampleColumnSlugs.GDP],
        selection: table.sampleEntityName(1),
    }
    const chart = new DiscreteBarChart({ manager })

    expect(chart.series.length).toEqual(2)

    it("can add colors to columns as series", () => {
        manager.baseColorScheme = ColorSchemeName.Reds
        const chart = new DiscreteBarChart({ manager })
        expect(chart.series[0].color).not.toEqual(DEFAULT_BAR_COLOR)
    })

    it("can filter a series when there are no points (column strategy)", () => {
        const table = SynthesizeFruitTable({
            entityCount: 1,
            timeRange: [2000, 2001],
        }).replaceRandomCells(1, [SampleColumnSlugs.Fruit])
        const chart = new DiscreteBarChart({
            manager: {
                seriesStrategy: SeriesStrategy.column,
                yColumnSlugs: [
                    SampleColumnSlugs.Fruit,
                    SampleColumnSlugs.Vegetables,
                ],
                selection: table.sampleEntityName(1),
                table,
            },
        })

        expect(chart.series.length).toEqual(1)
    })

    it("can filter a series when there are no points (entity strategy)", () => {
        const table = SynthesizeFruitTable({
            entityCount: 2,
            timeRange: [2000, 2001],
        }).replaceRandomCells(1, [SampleColumnSlugs.Fruit])
        const chart = new DiscreteBarChart({
            manager: {
                seriesStrategy: SeriesStrategy.entity,
                yColumnSlugs: [SampleColumnSlugs.Fruit],
                selection: table.sampleEntityName(2),
                table,
            },
        })

        expect(chart.series.length).toEqual(1)
    })
})
