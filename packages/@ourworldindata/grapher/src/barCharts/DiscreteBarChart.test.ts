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
import {
    ColorSchemeName,
    ColumnTypeNames,
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    SeriesStrategy,
} from "@ourworldindata/types"
import { SelectionArray } from "../selection/SelectionArray"
import { SortBy, SortOrder } from "@ourworldindata/utils"
import { OwidDistinctColorScheme } from "../color/CustomSchemes"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import { renderToStaticMarkup } from "react-dom/server"
import { GrapherState } from "../core/GrapherState"

function makeDiscreteBarChart(
    table: OwidTable,
    config: Partial<DiscreteBarChartManager> = {}
): { chartState: DiscreteBarChartState; chart: DiscreteBarChart } {
    const manager: DiscreteBarChartManager = { table, ...config }
    const chartState = new DiscreteBarChartState({ manager })
    const chart = new DiscreteBarChart({ chartState })
    return { chartState, chart }
}

it("can create a new bar chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2001] })
    const selection = new SelectionArray()
    const { chartState } = makeDiscreteBarChart(table, {
        selection,
        yColumnSlug: SampleColumnSlugs.Population,
        endTime: 2000,
    })

    expect(chartState.errorInfo.reason).toBeTruthy()
    selection.setSelectedEntities(table.availableEntityNames)
    expect(chartState.errorInfo.reason).toEqual("")

    const series = chartState.series
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
    const chartState = new DiscreteBarChartState({ manager })

    expect(chartState.series.length).toEqual(2)

    it("can add colors to columns as series", () => {
        manager.baseColorScheme = ColorSchemeName.Reds
        const chartState = new DiscreteBarChartState({ manager })
        expect(chartState.series[0].color).not.toEqual(
            OwidDistinctColorScheme.colorSets[0][0]
        )
    })

    it("can filter a series when there are no points (column strategy)", () => {
        const table = SynthesizeFruitTable({
            entityCount: 1,
            timeRange: [2000, 2001],
        }).replaceRandomCells(1, [SampleColumnSlugs.Fruit], 1)
        const { chartState } = makeDiscreteBarChart(table, {
            seriesStrategy: SeriesStrategy.column,
            yColumnSlugs: [
                SampleColumnSlugs.Fruit,
                SampleColumnSlugs.Vegetables,
            ],
            selection: table.sampleEntityName(1),
        })

        expect(chartState.series.length).toEqual(1)
    })

    it("can filter a series when there are no points (entity strategy)", () => {
        const table = SynthesizeFruitTable({
            entityCount: 2,
            timeRange: [2000, 2001],
        }).replaceRandomCells(1, [SampleColumnSlugs.Fruit], 1)
        const { chartState } = makeDiscreteBarChart(table, {
            seriesStrategy: SeriesStrategy.entity,
            yColumnSlugs: [SampleColumnSlugs.Fruit],
            selection: table.sampleEntityName(2),
        })

        expect(chartState.series.length).toEqual(1)
    })

    it("displays interpolated date when value is not from current year", () => {
        const table = new OwidTable([
            ["gdp", "year", "entityName", "entityCode", "entityId"],
            [1000, 2019, "USA", null, null],
            [1001, 2019, "UK", null, null],
            [1002, 2020, "UK", null, null],
        ])
            .interpolateColumnWithTolerance("gdp", { toleranceOverride: 1 })
            .filterByTargetTimes([2020])
        const { chartState, chart } = makeDiscreteBarChart(table, {
            transformedTable: table,
            seriesStrategy: SeriesStrategy.entity,
            yColumnSlugs: ["gdp"],
            endTime: 2020,
        })
        expect(chart.formatValue(chartState.series[0])).toMatchObject({
            valueString: "1,002",
            timeString: "",
        })
        expect(chart.formatValue(chartState.series[1])).toMatchObject({
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
    const { chartState } = makeDiscreteBarChart(table, {
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    })
    expect(chartState.series.length).toEqual(1)
    expect(
        chartState.series.every((series) => _.isNumber(series.value))
    ).toBeTruthy()
})

it("ignores the author-configured axis min but respects the max", () => {
    const table = new OwidTable([
        ["gdp", "year", "entityName"],
        [102, 2019, "United States"],
        [101, 2019, "Sweden"],
    ])
    const { chart } = makeDiscreteBarChart(table, {
        seriesStrategy: SeriesStrategy.entity,
        selection: table.availableEntityNames,
        yColumnSlugs: ["gdp"],
        // The min is usually intended for the line chart and would push the
        // zero line (where bars start) away from the left edge of the chart
        yAxisConfig: { min: -50, max: 200 },
    })
    expect(chart.yAxis.domain).toEqual([0, 200])
})

describe("sorting", () => {
    const table = new OwidTable([
        ["gdp", "year", "entityName"],
        [102, 2019, "United States"],
        [101, 2019, "Sweden"],
        [98, 2019, "Zambia"],
    ])
    const config: Partial<DiscreteBarChartManager> = {
        seriesStrategy: SeriesStrategy.entity,
        selection: table.availableEntityNames,
        yColumnSlugs: ["gdp"],
    }

    it("defaults to sorting by value descending", () => {
        const { chartState } = makeDiscreteBarChart(table, config)
        expect(chartState.series.map((item) => item.seriesName)).toEqual([
            "United States",
            "Sweden",
            "Zambia",
        ])
    })

    it("can sort by value ascending", () => {
        const { chartState } = makeDiscreteBarChart(table, {
            ...config,
            sortConfig: {
                sortBy: SortBy.total,
                sortOrder: SortOrder.asc,
            },
        })
        expect(chartState.series.map((item) => item.seriesName)).toEqual([
            "Zambia",
            "Sweden",
            "United States",
        ])
    })

    it("can sort by entity name descending", () => {
        const { chartState } = makeDiscreteBarChart(table, {
            ...config,
            sortConfig: {
                sortBy: SortBy.entityName,
                sortOrder: SortOrder.desc,
            },
        })
        expect(chartState.series.map((item) => item.seriesName)).toEqual([
            "Zambia",
            "United States",
            "Sweden",
        ])
    })
})

describe("static SVG export of projected data", () => {
    it("keeps projected bars' colors as solid fills and leaves them out of the stripe patterns", async () => {
        const table = new OwidTable(
            [
                ["entityName", "year", "population"],
                ["France", 2030, 100],
                ["Germany", 2030, 200],
            ],
            [
                {
                    slug: "population",
                    type: ColumnTypeNames.Numeric,
                    display: { isProjection: true },
                },
            ]
        )
        const grapherState = new GrapherState({
            table,
            dimensions: [{ slug: "population", property: DimensionProperty.y }],
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedEntityNames: ["France", "Germany"],
        })
        const svg = await grapherState.generateStaticSvg(renderToStaticMarkup)

        const projectedBars = grapherState.chartState.series
        expect(projectedBars.map((series) => series.seriesName).sort()).toEqual(
            ["France", "Germany"]
        )

        const patternContents = [
            ...svg.matchAll(
                /<pattern id="DiscreteBarChart_stripes[^>]*>(.*?)<\/pattern>/g
            ),
        ].map((match) => match[1])
        expect(patternContents.length).toBeGreaterThan(0)

        // Figma drops pattern fills, so a pattern must not paint a color
        for (const content of patternContents)
            for (const { color } of projectedBars)
                expect(content).not.toContain(color)

        for (const { seriesName, color } of projectedBars) {
            const bar = svg.match(
                new RegExp(`<rect id="${seriesName}"[^>]*>`)
            )![0]
            expect(bar).toContain(`fill="${color}"`)
        }
    })
})
