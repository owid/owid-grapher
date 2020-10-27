#! /usr/bin/env yarn jest

import { LineChart } from "./LineChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { ScaleType } from "grapher/core/GrapherConstants"
import { OwidTable } from "coreTable/OwidTable"
import { SelectionArray } from "grapher/core/SelectionArray"

it("can create a new chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.GDP],
    }
    const chart = new LineChart({ manager })

    expect(chart.failMessage).toBeTruthy()

    manager.selection = table.availableEntityNames

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.placedSeries.length).toEqual(2)
    expect(chart.placedSeries[0].placedPoints[0].x).toBeGreaterThan(0)
})

it("can filter points with negative values when using a log scale", () => {
    const table = SynthesizeFruitTableWithNonPositives(
        {
            entityCount: 2,
            timeRange: [1900, 2000],
        },
        20,
        1
    )

    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chart = new LineChart({ manager })
    expect(chart.series.length).toEqual(2)
    expect(chart.allPoints.length).toEqual(200)

    const logScaleManager = {
        ...manager,
        yAxisConfig: {
            scaleType: ScaleType.log,
        },
    }
    const logChart = new LineChart({ manager: logScaleManager })
    expect(logChart.verticalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.series.length).toEqual(2)
    expect(logChart.allPoints.length).toEqual(180)
})

it("will combine entity and column name when we set multi country multi column", () => {
    const table = SynthesizeGDPTable()
    const manager = {
        table,
        selection: table.availableEntityNames,
    }
    const chart = new LineChart({ manager })
    expect(chart.series[0].seriesName).toContain(" - ")
})

describe("colors", () => {
    const table = new OwidTable({
        entityName: ["usa", "canada", "usa", "canada"],
        time: [2000, 2000, 2001, 2001],
        gdp: [100, 200, 200, 300],
        entityColor: ["blue", "red", "blue", "red"],
    })
    const selection = ["usa", "canada"]
    it("can add custom colors", () => {
        const manager = {
            yColumnSlugs: ["gdp"],
            table,
            selection,
        }
        const chart = new LineChart({ manager })
        expect(chart.series.map((series) => series.color)).toEqual([
            "blue",
            "red",
        ])
    })

    it("can assign colors to selected entities and preserve those colors when selection changes when using a color map", () => {
        const selection = new SelectionArray(["usa", "canada"])
        const manager: ChartManager = {
            yColumnSlugs: ["gdp"],
            table: table.dropColumns(["entityColor"]),
            selection,
            seriesColorMap: new Map(),
        }
        const chart = new LineChart({ manager })
        const series = chart.series
        expect(series).toHaveLength(2)

        selection.deselectEntity("usa")

        const newSeries = chart.series
        expect(newSeries).toHaveLength(1)
        expect(newSeries[0].color).toEqual(series[1].color)
    })
})
