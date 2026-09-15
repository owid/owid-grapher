import { expect, it, describe } from "vitest"

import { SortOrder, SortBy, MissingDataStrategy } from "@ourworldindata/utils"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { numericDefs, yearDef } from "../testData/columnDefs"

function makeStackedDiscreteBar(
    rows: (number | string | null)[][],
    config: Partial<ChartManager> = {}
): { chartState: StackedDiscreteBarChartState; table: OwidTable } {
    const table = new OwidTable(
        [["coal", "gas", "year", "entityName"], ...rows],
        [...numericDefs("coal", "gas"), yearDef()]
    )
    const chartState = new StackedDiscreteBarChartState({
        manager: {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: ["coal", "gas"],
            ...config,
        },
    })
    return { chartState, table }
}

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

    const chartState = new StackedDiscreteBarChartState({ manager })
    expect(chartState.errorInfo.reason).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(5))
    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points.length).toEqual(5)
})

it("can display a StackedDiscreteBar chart in relative mode", () => {
    const { chartState } = makeStackedDiscreteBar(
        [
            [20, 30, 2000, "France"],
            [6, 14, 2000, "Spain"],
        ],
        { isRelativeMode: true }
    )

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)
    expect(
        chartState.series[0].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
        ])
    ).toEqual([
        ["France", 40, 0],
        ["Spain", 30, 0],
    ])
    expect(
        chartState.series[1].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
        ])
    ).toEqual([
        ["France", 60, 40],
        ["Spain", 70, 30],
    ])
})

it("can display a chart with missing variable data for some entities", () => {
    const { chartState, table } = makeStackedDiscreteBar([
        [20, null, 2000, "France"],
        [null, 14, 2000, "Spain"],
    ])

    expect(chartState.errorInfo.reason).toEqual("")
    expect(
        chartState.transformTableForSelection(table).availableEntityNames
    ).toEqual(["France", "Spain"])

    expect(chartState.series.length).toEqual(2)
    expect(
        chartState.series[0].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
            p.missing,
        ])
    ).toEqual([
        ["France", 20, 0, false],
        ["Spain", 0, 0, true],
    ])
    expect(
        chartState.series[1].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
            p.missing,
        ])
    ).toEqual([
        ["France", 0, 20, true],
        ["Spain", 14, 0, false],
    ])
})

it("can display a chart with missing variable data for some entities, while hiding missing data", () => {
    const { chartState, table } = makeStackedDiscreteBar(
        [
            [20, null, 2000, "France"],
            [10, 20, 2000, "Italy"],
            [null, 14, 2000, "Spain"],
        ],
        { missingDataStrategy: MissingDataStrategy.hide }
    )

    expect(chartState.errorInfo.reason).toEqual("")
    expect(
        chartState.transformTableForSelection(table).availableEntityNames
    ).toEqual(["Italy"])

    expect(chartState.series.length).toEqual(2)
    expect(
        chartState.series[0].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
        ])
    ).toEqual([["Italy", 10, 0]])
    expect(
        chartState.series[1].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
        ])
    ).toEqual([["Italy", 20, 10]])
})

it("can display a chart with missing variable data for some entities, while hiding missing data in relative mode", () => {
    const { chartState, table } = makeStackedDiscreteBar(
        [
            [20, null, 2000, "France"],
            [10, 30, 2000, "Italy"],
            [null, 14, 2000, "Spain"],
        ],
        { isRelativeMode: true }
    )

    expect(chartState.errorInfo.reason).toEqual("")
    expect(
        chartState.transformTableForSelection(table).availableEntityNames
    ).toEqual(["Italy"])

    expect(chartState.series.length).toEqual(2)
    expect(
        chartState.series[0].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
        ])
    ).toEqual([["Italy", 25, 0]])
    expect(
        chartState.series[1].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
        ])
    ).toEqual([["Italy", 75, 25]])
})

it("can display chart with negative values", () => {
    const { chartState } = makeStackedDiscreteBar([
        [-20, 30, 2000, "France"],
        [40, 10, 2000, "Spain"],
    ])

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)

    expect(
        chartState.series[0].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
            p.time,
        ])
    ).toEqual([
        ["France", -20, 0, 2000],
        ["Spain", 40, 0, 2000],
    ])

    expect(
        chartState.series[1].points.map((p) => [
            p.position,
            p.value,
            p.valueOffset,
            p.time,
        ])
    ).toEqual([
        // offset is 0 because the previous series has a negative value
        ["France", 30, 0, 2000],
        ["Spain", 10, 40, 2000],
    ])
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
        showLegend: true,
    }
    const chartState = new StackedDiscreteBarChartState({ manager })
    const chart = new StackedDiscreteBarChart({ chartState })

    it("renders the legend items in the order of yColumns", () => {
        expect(chart["categoricalLegendData"].length).toEqual(2)
        expect(chart["categoricalLegendData"].map((bin) => bin.value)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })

    it("render the stacked bars in order of yColumns", () => {
        expect(chartState.series.length).toEqual(2)
        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })
})

describe("sorting", () => {
    const table = new OwidTable(
        [
            ["coal", "gas", "year", "entityName"],
            [10, 20, 2000, "France"],
            [35, 2, 2000, "Spain"],
            [11, 8, 2000, "Germany"],
        ],
        [...numericDefs("coal", "gas"), yearDef()]
    )

    const baseManager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
    }

    it("defaults to sorting by total value descending", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: baseManager,
        })
        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can sort by entity name", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.entityName,
                    sortOrder: SortOrder.asc,
                },
            },
        })

        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })

    it("can sort by total descending", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can sort by total descending", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can use custom sort order", () => {
        const selection = ["France", "Spain", "Germany"]
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.custom,
                    sortOrder: SortOrder.asc,
                },
                selection,
            },
        })

        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual(
            selection
        )
    })

    it("can sort by single dimension", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.column,
                    sortColumnSlug: "coal",
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual([
            "Spain",
            "Germany",
            "France",
        ])
    })

    it("can sort by column that's missing values", () => {
        const table = new OwidTable(
            [
                ["coal", "gas", "year", "entityName"],
                [null, 20, 2000, "France"],
                [null, 2, 2000, "Spain"],
                [9, 8, 2000, "Germany"],
                [11, null, 2000, "Belgium"],
            ],
            [...numericDefs("coal", "gas"), yearDef()]
        )

        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                table,
                selection: table.availableEntityNames,
                sortConfig: {
                    sortBy: SortBy.column,
                    sortColumnSlug: "coal",
                    sortOrder: SortOrder.desc,
                },
            },
        })

        // Expected behavior: Belgium and Germany are sorted first because they have values.
        expect(chartState.sortedRows.map((item) => item.entityName)).toEqual([
            "Belgium",
            "Germany",
            "Spain",
            "France",
        ])
    })
})

describe("showLegend", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const baseManager: ChartManager = {
        table,
        selection: table.sampleEntityName(5),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
    }

    it("renders internal legend when showLegend is true", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: { ...baseManager, showLegend: true },
        })
        const chart = new StackedDiscreteBarChart({ chartState })
        expect(chart["legendState"].height).toBeGreaterThan(0)
        expect(chart["categoricalLegendData"].length).toBeGreaterThan(0)
        expect(chart["externalLegend"]).toBeUndefined()
    })

    it("exposes externalLegendBins when showLegend is false", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: { ...baseManager, showLegend: false },
        })
        const chart = new StackedDiscreteBarChart({ chartState })
        expect(chart["legendState"].height).toEqual(0)
        expect(chart["categoricalLegendData"].length).toEqual(0)
        expect(chart["externalLegend"]?.categoricalLegendData?.length).toEqual(
            2
        )
    })
})
