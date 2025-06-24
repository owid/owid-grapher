import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import { DiscreteBarChart } from "./DiscreteBarChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
    OwidTable,
} from "@ourworldindata/core-table"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants"
import { ColorSchemeName, SeriesStrategy } from "@ourworldindata/types"
import { SelectionArray } from "../selection/SelectionArray"
import { SortBy, SortOrder } from "@ourworldindata/utils"
import { OwidDistinctColorScheme } from "../color/CustomSchemes"

it("can create a new bar chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2001] })
    const selection = new SelectionArray()
    const manager: DiscreteBarChartManager = {
        table,
        selection,
        yColumnSlug: SampleColumnSlugs.Population,
        endTime: 2000,
    }
    const chart = new DiscreteBarChart({ manager })

    expect(chart.failMessage).toBeTruthy()
    selection.setSelectedEntities(table.availableEntityNames)
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
        expect(chart.series[0].color).not.toEqual(
            OwidDistinctColorScheme.colorSets[0][0]
        )
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

    it("displays interpolated date when value is not from current year", () => {
        const csv = `gdp,year,entityName,entityCode,entityId
1000,2019,USA,,
1001,2019,UK,,
1002,2020,UK,,`

        const table = new OwidTable(csv)
            .interpolateColumnWithTolerance("gdp", 1)
            .filterByTargetTimes([2020])
        const chart = new DiscreteBarChart({
            manager: {
                table,
                transformedTable: table,
                seriesStrategy: SeriesStrategy.entity,
                yColumnSlugs: ["gdp"],
                endTime: 2020,
            },
        })
        expect(chart.formatValue(chart.series[0])).toMatchObject({
            valueString: "1,002",
            timeString: "",
        })
        expect(chart.formatValue(chart.series[1])).toMatchObject({
            valueString: "1,000",
            timeString: " in 2019",
        })
    })
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        {
            entityCount: 2,
            timeRange: [2000, 2001],
        },
        1,
        1
    )
    const manager: DiscreteBarChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chart = new DiscreteBarChart({ manager })
    expect(chart.series.length).toEqual(1)
    expect(
        chart.series.every((series) => _.isNumber(series.value))
    ).toBeTruthy()
})

describe("sorting", () => {
    const csv = `gdp,year,entityName
102,2019,United States
101,2019,Sweden
98,2019,Zambia`

    const table = new OwidTable(csv)
    const manager = {
        table,
        seriesStrategy: SeriesStrategy.entity,
        selection: table.availableEntityNames,
        yColumnSlugs: ["gdp"],
    }

    it("defaults to sorting by value descending", () => {
        const chart = new DiscreteBarChart({ manager })
        expect(chart.series.map((item) => item.seriesName)).toEqual([
            "United States",
            "Sweden",
            "Zambia",
        ])
    })

    it("can sort by value ascending", () => {
        const chart = new DiscreteBarChart({
            manager: {
                ...manager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.asc,
                },
            },
        })
        expect(chart.series.map((item) => item.seriesName)).toEqual([
            "Zambia",
            "Sweden",
            "United States",
        ])
    })

    it("can sort by entity name descending", () => {
        const chart = new DiscreteBarChart({
            manager: {
                ...manager,
                sortConfig: {
                    sortBy: SortBy.entityName,
                    sortOrder: SortOrder.desc,
                },
            },
        })
        expect(chart.series.map((item) => item.seriesName)).toEqual([
            "Zambia",
            "United States",
            "Sweden",
        ])
    })
})
