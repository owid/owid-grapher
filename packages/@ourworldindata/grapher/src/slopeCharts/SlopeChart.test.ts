import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import { SlopeChart } from "./SlopeChart"
import { SlopeChartManager } from "./SlopeChartConstants"
import {
    ErrorValueTypes,
    OwidTable,
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import {
    ColumnTypeNames,
    FacetStrategy,
    ScaleType,
    SeriesStrategy,
} from "@ourworldindata/utils"
import { SelectionArray } from "../selection/SelectionArray"
import { SlopeChartState } from "./SlopeChartState"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
const manager: SlopeChartManager = {
    table,
    yColumnSlug: SampleColumnSlugs.Population,
    selection: table.availableEntityNames,
}

it("can create a new slope chart", () => {
    const chartState = new SlopeChartState({ manager })
    const chart = new SlopeChart({ chartState })
    expect(chart.series.length).toEqual(2)
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        {
            entityCount: 2,
            timeRange: [2000, 2002],
        },
        1,
        1
    )
    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chartState = new SlopeChartState({ manager })
    const chart = new SlopeChart({ chartState })
    expect(chart.series.length).toEqual(1)
    expect(
        chart.series.every(
            (series) =>
                _.isNumber(series.start.value) && _.isNumber(series.end.value)
        )
    ).toBeTruthy()
})

it("can filter points with negative values when using a log scale", () => {
    const table = SynthesizeFruitTableWithNonPositives(
        {
            entityCount: 2,
            timeRange: [2000, 2002],
        },
        1,
        1
    )

    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chartState = new SlopeChartState({ manager })
    const chart = new SlopeChart({ chartState })
    expect(chart.allYValues.length).toEqual(4)

    const logScaleManager = {
        ...manager,
        yAxisConfig: {
            scaleType: ScaleType.log,
        },
    }
    const logChartState = new SlopeChartState({ manager: logScaleManager })
    const logChart = new SlopeChart({ chartState: logChartState })
    expect(logChart.yAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.allYValues.length).toEqual(2)
})

describe("series naming in multi-column mode", () => {
    const table = SynthesizeGDPTable()

    it("only displays column name if only one entity is selected and multi entity selection is disabled", () => {
        const manager = {
            table,
            canSelectMultipleEntities: false,
            selection: [table.availableEntityNames[0]],
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        expect(chart.series[0].seriesName).not.toContain(" - ")
    })

    it("combines entity and column name if only one entity is selected and multi entity selection is enabled", () => {
        const manager = {
            table,
            canSelectMultipleEntities: true,
            selection: [table.availableEntityNames[0]],
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        expect(chart.series[0].seriesName).toContain(" - ")
    })

    it("combines entity and column name if multiple entities are selected and multi entity selection is disabled", () => {
        const selection = new SelectionArray(table.availableEntityNames)
        const manager = {
            table,
            canSelectMultipleEntities: false,
            selection,
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        expect(chart.series[0].seriesName).toContain(" - ")
    })
})

describe("colors", () => {
    const table = new OwidTable({
        entityName: ["usa", "canada", "usa", "canada"],
        year: [2000, 2000, 2001, 2001],
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
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        expect(chart.series.map((series) => series.color)).toEqual([
            "blue",
            "red",
        ])
    })

    it("uses column color selections when series strategy is column", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa"],
                year: [2000, 2001],
                gdp: [100, 200],
                entityColor: ["blue", "blue"],
            },
            [{ slug: "gdp", color: "green", type: ColumnTypeNames.Numeric }]
        )

        const manager: ChartManager = {
            yColumnSlugs: ["gdp"],
            table: table,
            selection,
            seriesStrategy: SeriesStrategy.column,
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        const series = chart.series

        expect(series).toHaveLength(1)
        expect(series[0].color).toEqual("green")
    })

    it("can assign colors to selected entities and preserve those colors when selection changes when using a color map", () => {
        const selection = new SelectionArray(["usa", "canada"])
        const manager: ChartManager = {
            yColumnSlugs: ["gdp"],
            table: table.dropColumns(["entityColor"]),
            selection,
            seriesColorMap: new Map(),
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        const series = chart.series
        expect(series).toHaveLength(2)

        selection.deselectEntity("usa")

        const newSeries = chart.series
        expect(newSeries).toHaveLength(1)
        expect(newSeries[0].color).toEqual(series[1].color)
    })

    it("uses variable colors when only one entity selected (even if multiple can be selected with controls)", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa", "canada"],
                year: [2000, 2001, 2000],
                gdp: [100, 200, 100],
                pop: [100, 200, 100],
            },
            [
                { slug: "gdp", color: "green", type: ColumnTypeNames.Numeric },
                { slug: "pop", color: "orange", type: ColumnTypeNames.Numeric },
            ]
        )

        const manager: SlopeChartManager = {
            yColumnSlugs: ["gdp", "pop"],
            table: table,
            selection: ["usa"],
            seriesStrategy: SeriesStrategy.column,
            facetStrategy: FacetStrategy.entity,
            canSelectMultipleEntities: true,
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        const series = chart.series

        expect(series).toHaveLength(2)
        expect(series[0].color).toEqual("green")
        expect(series[1].color).toEqual("orange")
    })

    it("doesn't use variable colors if 2 variables have single entities which are different", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa", "canada", "canada"],
                year: [2000, 2001, 2000, 2001],
                gdp: [
                    100,
                    200,
                    ErrorValueTypes.MissingValuePlaceholder,
                    ErrorValueTypes.MissingValuePlaceholder,
                ],
                pop: [
                    ErrorValueTypes.MissingValuePlaceholder,
                    ErrorValueTypes.MissingValuePlaceholder,
                    100,
                    200,
                ],
            },
            [
                { slug: "gdp", color: "green", type: ColumnTypeNames.Numeric },
                { slug: "pop", color: "orange", type: ColumnTypeNames.Numeric },
            ]
        )

        const selection = new SelectionArray(["usa", "canada"])
        const manager: SlopeChartManager = {
            yColumnSlugs: ["gdp", "pop"],
            table: table,
            selection,
            seriesStrategy: SeriesStrategy.column,
            canSelectMultipleEntities: true,
        }
        const chartState = new SlopeChartState({ manager })
        const chart = new SlopeChart({ chartState })
        const series = chart.series

        expect(series).toHaveLength(2)
        expect(series[0].color).not.toEqual("green")
        expect(series[1].color).not.toEqual("orange")
    })
})
