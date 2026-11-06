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
    IndicatorAnnotation,
    OwidColumnDef,
    GRAPHER_CHART_TYPES,
    SeriesStrategy,
} from "@ourworldindata/types"
import { SelectionArray } from "../selection/SelectionArray"
import { Bounds, SortBy, SortOrder } from "@ourworldindata/utils"
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

describe("entity annotations", () => {
    const annotations: IndicatorAnnotation[] = [
        { text: "Estimate", entityNames: ["France"], timeScope: "all" },
    ]

    const makeChartState = (
        columnDefs: OwidColumnDef[],
        row: (number | string)[][],
        selectedEntityNames: string[],
        maxTime?: number
    ): DiscreteBarChartState => {
        const slugs = columnDefs.map((def) => def.slug)
        const grapherState = new GrapherState({
            table: new OwidTable(
                [["entityName", "year", ...slugs], ...row],
                columnDefs
            ),
            dimensions: slugs.map((slug) => ({
                slug,
                property: DimensionProperty.y,
            })),
            chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
            selectedEntityNames,
            maxTime,
        })
        return grapherState.chartState as DiscreteBarChartState
    }

    it("attaches an entity's annotation to its bar when bars are entities", () => {
        const chartState = makeChartState(
            [
                {
                    slug: "population",
                    type: ColumnTypeNames.Numeric,
                    annotations,
                },
            ],
            [
                ["France", 2000, 100],
                ["Germany", 2000, 200],
            ],
            ["France", "Germany"]
        )

        const annotationByEntity = Object.fromEntries(
            chartState.series.map((series) => [
                series.seriesName,
                series.annotation,
            ])
        )
        expect(annotationByEntity).toEqual({
            France: "Estimate",
            Germany: undefined,
        })
    })

    describe("when historical and projected columns are combined", () => {
        const makeCombinedChartState = (
            maxTime: number,
            historicalTolerance = 0
        ): DiscreteBarChartState => {
            const columnDefs: OwidColumnDef[] = [
                {
                    slug: "population",
                    type: ColumnTypeNames.Numeric,
                    display: { tolerance: historicalTolerance },
                    annotations: [
                        {
                            text: "Estimate",
                            entityNames: ["France"],
                            timeScope: "all",
                        },
                    ],
                },
                {
                    slug: "population_projection",
                    type: ColumnTypeNames.Numeric,
                    display: { isProjection: true },
                    annotations: [
                        {
                            text: "Medium scenario",
                            entityNames: ["France"],
                            timeScope: "all",
                        },
                    ],
                },
            ]
            return makeChartState(
                columnDefs,
                [
                    ["France", 2000, 100, ""],
                    ["France", 2010, "", 150],
                    ["France", 2020, 120, 130],
                    ["Germany", 2000, 200, ""],
                    ["Germany", 2010, "", 250],
                    ["Germany", 2020, 220, 230],
                ],
                ["France", "Germany"],
                maxTime
            )
        }

        const annotationByEntity = (
            chartState: DiscreteBarChartState
        ): Record<string, string | undefined> =>
            Object.fromEntries(
                chartState.series.map((series) => [
                    series.seriesName,
                    series.annotation,
                ])
            )

        it("takes the historical annotation for a historical year", () => {
            const chartState = makeCombinedChartState(2000)
            expect(chartState.yColumnMode.type).toEqual("combined")
            expect(annotationByEntity(chartState)).toEqual({
                France: "Estimate",
                Germany: undefined,
            })
        })

        it("takes the projected annotation for a projected year", () => {
            const chartState = makeCombinedChartState(2010)
            expect(annotationByEntity(chartState)).toEqual({
                France: "Medium scenario",
                Germany: undefined,
            })
        })

        it("ignores a historical value carried into a projected year by tolerance", () => {
            const chartState = makeCombinedChartState(2010, 10)
            expect(annotationByEntity(chartState)).toEqual({
                France: "Medium scenario",
                Germany: undefined,
            })
        })

        it("joins both annotations for a year with both a historical and a projected value", () => {
            const chartState = makeCombinedChartState(2020)
            expect(annotationByEntity(chartState)).toEqual({
                France: "Estimate / Medium scenario",
                Germany: undefined,
            })
        })
    })

    it("attaches each column's annotation to its bar when bars are columns", () => {
        const chartState = makeChartState(
            [
                {
                    slug: "population",
                    type: ColumnTypeNames.Numeric,
                    annotations,
                },
                {
                    slug: "area",
                    type: ColumnTypeNames.Numeric,
                    annotations: [
                        {
                            text: "Surveyed",
                            entityNames: ["France"],
                            timeScope: "all",
                        },
                    ],
                },
            ],
            [["France", 2000, 100, 50]],
            ["France"]
        )

        expect(chartState.seriesStrategy).toEqual(SeriesStrategy.column)
        expect(
            Object.fromEntries(
                chartState.series.map((series) => [
                    series.yColumn.slug,
                    series.annotation,
                ])
            )
        ).toEqual({ population: "Estimate", area: "Surveyed" })
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

describe("entity labels", () => {
    const habitatLoss: [string, number][] = [
        ["World", -5.79],
        ["Sub-Saharan Africa", -12.72],
        ["South and East Asia", -2.51],
        ["Europe", -1.18],
        ["North America", -3.67],
        ["Latin America", -4.19],
        ["North Africa", -2.86],
        ["Oceania", -1.18],
    ]

    function makeChart(
        rows: [string, number][] = habitatLoss
    ): DiscreteBarChart {
        const table = new OwidTable([
            ["loss", "year", "entityName", "entityCode", "entityId"],
            ...rows.map(([entityName, value], index) => [
                value,
                2050,
                entityName,
                null,
                index + 1,
            ]),
        ])
        const chartState = new DiscreteBarChartState({
            manager: {
                table,
                transformedTable: table,
                seriesStrategy: SeriesStrategy.entity,
                yColumnSlugs: ["loss"],
                selection: rows.map(([entityName]) => entityName),
                endTime: 2050,
            },
        })
        return new DiscreteBarChart({
            chartState,
            bounds: new Bounds(0, 0, 321, 290),
        })
    }

    function negate(rows: [string, number][]): [string, number][] {
        return rows.map(([entityName, value]) => [entityName, -value])
    }

    function getLeftmostLabelEdge(chart: DiscreteBarChart): number | undefined {
        return _.min(
            chart.placedSeries.map(
                (series) => series.entityLabelX - series.label.width
            )
        )
    }

    function getLineTexts(
        chart: DiscreteBarChart,
        entityName: string
    ): string[] {
        const series = chart.sizedSeries.find(
            (series) => series.entityName === entityName
        )
        return series!.label.spanLines.map((line) =>
            line.map((span) => span.text).join("")
        )
    }

    it("wraps the label that sets the left padding", () => {
        expect(getLineTexts(makeChart(), "Sub-Saharan Africa")).toEqual([
            "Sub-Saharan",
            "Africa",
        ])
    })

    it("keeps labels of shorter negative bars on one line", () => {
        expect(getLineTexts(makeChart(), "South and East Asia")).toEqual([
            "South and East Asia",
        ])
    })

    it("leaves no gap left of the leftmost label", () => {
        expect(getLeftmostLabelEdge(makeChart())).toBeCloseTo(0, 0)
    })

    it("leaves no gap left of the leftmost label when all bars are positive", () => {
        expect(
            getLeftmostLabelEdge(makeChart(negate(habitatLoss)))
        ).toBeCloseTo(0, 0)
    })

    it("lets labels of positive bars fill the label column", () => {
        const chart = makeChart([
            ...negate(habitatLoss),
            ["Pneumonoultramicroscopic Africa", 2],
        ])
        expect(getLineTexts(chart, "Pneumonoultramicroscopic Africa")).toEqual([
            "Pneumonoultramicroscopic",
            "Africa",
        ])
        expect(getLineTexts(chart, "South and East Asia")).toEqual([
            "South and East Asia",
        ])
    })
})
