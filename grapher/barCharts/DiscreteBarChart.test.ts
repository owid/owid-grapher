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

it("can create a new bar chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2001] })

    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Population,
        endTime: 2000,
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

    it("can filter a series when there are no points (column strategy)", () => {
        const chart = new DiscreteBarChart({
            manager: {
                seriesStrategy: SeriesStrategy.column,
                yColumnSlugs: [
                    SampleColumnSlugs.Fruit,
                    SampleColumnSlugs.Vegetables,
                ],
                table: SynthesizeFruitTable({
                    entityCount: 1,
                    timeRange: [2000, 2001],
                })
                    .selectSample(1)
                    .replaceRandomCells(1, [SampleColumnSlugs.Fruit]),
            },
        })

        expect(chart.series.length).toEqual(1)
    })

    it("can filter a series when there are no points (entity strategy)", () => {
        const chart = new DiscreteBarChart({
            manager: {
                seriesStrategy: SeriesStrategy.entity,
                yColumnSlugs: [SampleColumnSlugs.Fruit],
                table: SynthesizeFruitTable({
                    entityCount: 2,
                    timeRange: [2000, 2001],
                })
                    .selectSample(2)
                    .replaceRandomCells(1, [SampleColumnSlugs.Fruit]),
            },
        })

        expect(chart.series.length).toEqual(1)
    })
})
