import { expect, it, describe } from "vitest"

import * as _ from "lodash-es"
import { ScatterPlotChart } from "../scatterCharts/ScatterPlotChart"
import { ScatterPlotChartState } from "../scatterCharts/ScatterPlotChartState"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
    ErrorValueTypes,
    makeOriginalTimeSlugFromColumnSlug,
    OwidTable,
    numericDefs,
    stringDefs,
    yearDef,
} from "@ourworldindata/core-table"
import { InteractionState } from "../interaction/InteractionState.js"
import {
    ScatterPlotManager,
    SCATTER_POINT_DEFAULT_RADIUS,
    SCATTER_POINT_MAX_RADIUS,
    SCATTER_POINT_MIN_RADIUS,
} from "./ScatterPlotChartConstants"
import {
    ScaleType,
    ScatterPointLabelStrategy,
    ColumnTypeNames,
    Color,
    GRAPHER_CHART_TYPES,
} from "@ourworldindata/types"
import { ContinentColors } from "../color/CustomSchemes"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import { GrapherState } from "../core/GrapherState"
import { GrapherProgrammaticInterface } from "../core/Grapher.js"

function makeScatterChartState(
    table: OwidTable,
    config: Partial<GrapherProgrammaticInterface> = {}
): ScatterPlotChartState {
    const grapher = new GrapherState({
        chartTypes: [GRAPHER_CHART_TYPES.ScatterPlot],
        xSlug: "x",
        ySlugs: "y",
        colorSlug: "color",
        sizeSlug: "size",
        table,
        ...config,
    })
    return grapher.chartState as ScatterPlotChartState
}

it("can create a new chart", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeGDPTable(),
    }

    const chartState = new ScatterPlotChartState({ manager })
    expect(chartState.errorInfo.reason).toBeFalsy()
    expect(chartState.seriesNamesToHighlight.size).toEqual(0)
    expect(chartState.series.length).toEqual(2)
    expect(chartState.allPoints.length).toBeGreaterThan(0)
})

it("shows error when X or Y columns are missing", () => {
    const manager: ScatterPlotManager = {
        table: new OwidTable([
            ["entityName", "year"],
            ["World", 2020],
        ]),
    }
    const chartState = new ScatterPlotChartState({ manager })
    expect(chartState.errorInfo.reason).toBeTruthy()
})

it("doesn't show 'No data' bin when there is no color column", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeGDPTable(),
        colorColumnSlug: undefined,
    }
    const chartState = new ScatterPlotChartState({ manager })
    expect(chartState.errorInfo.reason).toBeFalsy()
    expect(chartState.hasNoDataBin).toBeFalsy()
})

it("can remove points outside domain", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeFruitTable(undefined, 2),
        yColumnSlug: SampleColumnSlugs.Fruit,
        xColumnSlug: SampleColumnSlugs.Vegetables,
    }
    const chartState = new ScatterPlotChartState({ manager })
    const initialCount = chartState.allPoints.length
    manager.xAxisConfig = { removePointsOutsideDomain: true, max: 1100 }
    expect(chartState.allPoints.length).toBeGreaterThan(0)
    expect(chartState.allPoints.length).toBeLessThan(initialCount)
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

    const manager: ScatterPlotManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Fruit,
        xColumnSlug: SampleColumnSlugs.Vegetables,
        selection: table.availableEntityNames,
        yAxisConfig: {},
        xAxisConfig: {},
    }

    const chartState = new ScatterPlotChartState({ manager })
    expect(chartState.series.length).toEqual(2)
    expect(chartState.allPoints.length).toEqual(200)

    const logScaleManager = {
        ...manager,
        yAxisConfig: {
            scaleType: ScaleType.log,
        },
        xAxisConfig: {
            scaleType: ScaleType.log,
        },
    }
    const logChartState = new ScatterPlotChartState({
        manager: logScaleManager,
    })
    const logChart = new ScatterPlotChart({ chartState: logChartState })
    expect(logChart.dualAxis.horizontalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.dualAxis.verticalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChartState.series.length).toEqual(2)
    expect(logChartState.allPoints.length).toEqual(180)
})

describe("interpolation defaults", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", -1000, 1, 1, null, null],
            ["UK", 1000, 1, 1, "Europe", 100],
            ["UK", 2020, 1, 1, null, null],
        ],
        [...numericDefs("x", "y", "size"), ...stringDefs("color")]
    )

    const chartState = makeScatterChartState(table)

    it("color defaults to infinity tolerance if none specified", () => {
        expect(
            chartState.transformedTable.get("color").valuesIncludingErrorValues
        ).toEqual(["Europe", "Europe", "Europe"])
    })

    it("size defaults to infinity tolerance if none specified", () => {
        expect(
            chartState.transformedTable.get("size").valuesIncludingErrorValues
        ).toEqual([100, 100, 100])
    })
})

describe("basic scatterplot", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", 2000, 1, 1, null, null],
            ["UK", 2001, null, 1, "Europe", 100],
            ["UK", 2002, 1, null, null, null],
            ["UK", 2003, null, null, null, null],
            ["USA", 2000, 1, 1, null, null],
        ],
        [
            ...numericDefs("x", "y", "size"),
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 1 },
            },
        ]
    )

    const chartState = makeScatterChartState(table)

    it("removes error values from X and Y", () => {
        expect(chartState.transformedTable.numRows).toEqual(2)
        expect(chartState.transformedTable.timeColumn.uniqValues).toEqual([
            2000,
        ])
    })

    it("interpolates color & size columns before removing rows", () => {
        const ukTable = chartState.transformedTable.where({ entityName: "UK" })
        expect(ukTable.get("color").valuesIncludingErrorValues).toEqual([
            "Europe",
        ])
        expect(ukTable.get("size").valuesIncludingErrorValues).toEqual([100])
    })

    it("color & size interpolation doesn't leak", () => {
        const usTable = chartState.transformedTable.where({ entityName: "USA" })
        expect(usTable.get("color").valuesIncludingErrorValues).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
        ])
        expect(usTable.get("size").valuesIncludingErrorValues).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
        ])
    })

    it("shows 'No data' bin", () => {
        expect(chartState.hasNoDataBin).toEqual(true)
    })

    it("plots correct series", () => {
        expect(chartState.series).toEqual([
            {
                seriesName: "UK",
                label: "UK",
                color: ContinentColors.Europe,
                isScaleColor: true,
                focus: new InteractionState(),
                points: [
                    {
                        entityName: "UK",
                        label: "2000",
                        x: 1,
                        y: 1,
                        color: "Europe",
                        size: 100,
                        time: { x: 2000, y: 2000 },
                        timeValue: 2000,
                    },
                ],
            },
            {
                seriesName: "USA",
                label: "USA",
                color: chartState.defaultNoDataColor,
                isScaleColor: true,
                focus: new InteractionState(),
                points: [
                    {
                        entityName: "USA",
                        label: "2000",
                        x: 1,
                        y: 1,
                        color: undefined,
                        size: undefined,
                        time: { x: 2000, y: 2000 },
                        timeValue: 2000,
                    },
                ],
            },
        ])
    })
})

describe("label point strategies", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", 2000, 1, 2, null, null],
        ],
        [...numericDefs("x", "y", "size"), ...stringDefs("color")]
    )

    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        table,
    }

    // Each label source reads a different coordinate from this same point.
    it.each<[ScatterPointLabelStrategy, string]>([
        [ScatterPointLabelStrategy.year, "2000"],
        [ScatterPointLabelStrategy.y, "2"],
        [ScatterPointLabelStrategy.x, "1"],
    ])("labels points using the %s strategy", (strategy, expectedLabel) => {
        const chartState = new ScatterPlotChartState({
            manager: {
                ...manager,
                scatterPointLabelStrategy: strategy,
            },
        })
        expect(chartState.allPoints[0].label).toEqual(expectedLabel)
    })
})

it("assigns entity colors to series, overriding colorScale color", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size", "entityColor"],
            ["UK", 2000, 1, 2, "Europe", null, "#ccc"],
        ],
        [...numericDefs("x", "y", "size"), ...stringDefs("color")]
    )

    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        table,
    }

    const chartState = new ScatterPlotChartState({ manager })

    expect(chartState.series[0].color).toEqual("#ccc")
})

describe("entity exclusion", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", 2000, 1, 1, null, null],
            ["UK", 2001, null, 1, "Europe", 100],
            ["UK", 2002, 1, null, null, null],
            ["UK", 2003, null, null, null, null],
            ["USA", 2000, 1, 1, null, null],
        ],
        [
            ...numericDefs("x", "y", "size"),
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 1 },
            },
        ]
    )

    const chartState = makeScatterChartState(table, {
        matchingEntitiesOnly: true,
    })

    it("excludes entities without color when matchingEntitiesOnly is enabled", () => {
        expect(chartState.allPoints.length).toEqual(1)
        expect(chartState.allPoints[0].entityName).toEqual("UK")
    })

    it("doesn't show No data bin", () => {
        expect(chartState.hasNoDataBin).toEqual(false)
    })
})

describe("colors & legend", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["Germany", 2001, 1, 1, "Europe", null],
            ["Canada", 2000, 1, 1, "North America", null],
            ["China", 2000, 1, null, "Asia", null],
            ["Australia", 2000, 1, 1, "Oceania", null],
            ["Chile", 2000, 1, 1, "South America", null],
            ["Nigeria", 2000, 1, 1, "Africa", null],
        ],
        [
            ...numericDefs("x", "y", "size"),
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 1 },
            },
        ]
    )

    const tableWithoutChina = table.columnFilter(
        "entityName",
        (name) => name !== "China",
        "filter out China"
    )

    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        table,
        tableAfterAuthorTimelineAndActiveChartTransform: tableWithoutChina,
    }

    const chartState = new ScatterPlotChartState({ manager })
    const chart = new ScatterPlotChart({ chartState })

    it("assigns correct continent colors", () => {
        // Every series color is the same as the point color
        chartState.series.forEach((series) => {
            const seriesNameToContinent: { [key: string]: string } = {
                Germany: "Europe",
                Canada: "North America",
                China: "Asia",
                Australia: "Oceania",
                Chile: "South America",
                Nigeria: "Africa",
            }
            const continentColors: { [key: string]: Color } = {
                ...ContinentColors,
            }
            expect(series.color).toEqual(
                continentColors[seriesNameToContinent[series.seriesName]]
            )

            for (const seriesName in seriesNameToContinent) {
                const continentName = seriesNameToContinent[seriesName]
                const continentColor = continentColors[continentName]
                expect(chartState.colorScale.getColor(continentName)).toEqual(
                    continentColor
                )
            }
        })
    })

    it("legend contains every continent for which there is data (before timeline filter)", () => {
        expect(
            chart["categoricalLegendData"].map((item) => item.label).sort()
        ).toEqual([
            "Africa",
            "Europe",
            "North America",
            "Oceania",
            "South America",
        ])
    })

    it("legend items faint if without points for current timeline selection", () => {
        expect(chart.activeColors.sort()).toEqual(
            [
                ContinentColors.Africa,
                ContinentColors.Europe,
                ContinentColors.NorthAmerica,
                ContinentColors.Oceania,
                ContinentColors.SouthAmerica,
            ].sort()
        )
    })
})

describe("series transformations", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", 2001, 1, 1, null, null],
            ["UK", 2004, 2, 1, null, null],
            ["UK", 2002, null, 1, null, null],
            ["UK", 2000, 1, null, null, null],
            ["UK", 2003, 2, 1, null, null],
            ["Germany", 2000, 1, 1, null, null],
            ["Germany", 2003, 2, 2, null, null],
            ["USA", 2001, 0, 0, null, null],
            ["USA", 2002, 1, 1, null, null],
            ["USA", 2003, 2, 2, null, null],
        ],
        [
            ...numericDefs("x", "y"),
            ...stringDefs("color"),
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 1 },
            },
        ]
    )
    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        table,
    }
    const chartState = new ScatterPlotChartState({ manager })

    it("sorts points by time", () => {
        const ukSeries = chartState.series.find((s) => s.seriesName === "UK")!
        expect(ukSeries.points.map((p) => p.timeValue)).toEqual([
            2001, 2003, 2004,
        ])
    })

    it("endpointsOnly drops trailing and in-between points", () => {
        const chartState = new ScatterPlotChartState({
            manager: { ...manager, compareEndPointsOnly: true },
        })
        const ukSeries = chartState.series.find((s) => s.seriesName === "UK")!
        expect(ukSeries.points.map((p) => p.timeValue)).toEqual([2001, 2004])
    })

    it("calculates average annual change", () => {
        const chartState = new ScatterPlotChartState({
            manager: {
                ...manager,
                isRelativeMode: true,
            },
        })
        const uk = chartState.series.find((s) => s.seriesName === "UK")!
            .points[0]
        const usa = chartState.series.find((s) => s.seriesName === "USA")!
            .points[0]
        const germany = chartState.series.find(
            (s) => s.seriesName === "Germany"
        )!.points[0]

        expect(uk.x.toFixed(1)).toEqual("26.0")
        expect(uk.y.toFixed(1)).toEqual("0.0")
        // The initial USA point is dropped to avoid an Infinity result
        expect(usa.x.toFixed(1)).toEqual("100.0")
        expect(usa.y.toFixed(1)).toEqual("100.0")
        expect(germany.x.toFixed(1)).toEqual("26.0")
        expect(germany.y.toFixed(1)).toEqual("26.0")
    })
})

describe("average annual change", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", 2000, 1, 1, null, null],
            ["UK", 2001, null, 2, null, null],
            // Using a 0 end value for Y to make sure we don't naively
            // ignore all zero values, instead of start-only zeroes.
            ["UK", 2002, null, 0, null, null],
            ["UK", 2004, 16, null, null, null],
            // intentionally creating two partial rows for USA that after
            // interpolation turn into one duplicated row
            ["USA", 2000, 1, null, null, null],
            ["USA", 2001, null, 1, null, null],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 3 },
            },
            {
                slug: "y",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 3 },
            },
            ...stringDefs("color"),
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 1 },
            },
        ]
    )
    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        isRelativeMode: true,
        // Setting log axes to make sure they're ignored in relative mode
        yAxisConfig: { scaleType: ScaleType.log },
        xAxisConfig: { scaleType: ScaleType.log },
        // intentionally setting compareEndPointsOnly to make sure it's
        // ignored in relative mode
        compareEndPointsOnly: true,
        table,
    }
    const chartState = new ScatterPlotChartState({ manager })
    const chart = new ScatterPlotChart({ chartState })

    it("drops series with a single point", () => {
        expect(chartState.series.length).toEqual(1)
    })

    it("calculates average annual change based on originalTime", () => {
        const point = chartState.series[0].points[0]
        expect(point.x).toEqual(100)
        expect(Math.abs(point.y)).toEqual(0)
    })

    it("formats axes with %", () => {
        expect(chart.dualAxis.verticalAxis.formatTick(0)).toEqual("+0%")
        expect(chart.dualAxis.horizontalAxis.formatTick(0)).toEqual("+0%")
    })

    it("ignores config and sets linear axes", () => {
        expect(chart.dualAxis.horizontalAxis.canChangeScaleType).toBeFalsy()
        expect(chart.dualAxis.verticalAxis.canChangeScaleType).toBeFalsy()
        expect(chart.dualAxis.horizontalAxis.scaleType).toEqual(
            ScaleType.linear
        )
        expect(chart.dualAxis.verticalAxis.scaleType).toEqual(ScaleType.linear)
    })

    it("sets time.span correctly in relative mode", () => {
        const point = chartState.series[0].points[0]
        expect(point.time.span).toEqual([2000, 2002])
    })
})

describe("scatter plot with xOverrideTime", () => {
    const xOriginalTimeSlug = makeOriginalTimeSlugFromColumnSlug("x")
    const table = new OwidTable(
        [
            ["entityName", "day", "x", "y", "color", "size", xOriginalTimeSlug],
            ["UK", 2001, 0, 0, null, null, 2000],
            ["Germany", 2001, 1, 1, null, null, 2001],
            ["USA", 2001, 2, 2, null, null, 2003],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 1 },
            },
            ...numericDefs("y"),
            yearDef(),
            ...stringDefs("color"),
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 1 },
            },
            yearDef(xOriginalTimeSlug),
        ]
    )
    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        table,
    }
    const chartState = new ScatterPlotChartState({ manager })

    it("all points have correct times", () => {
        expect(_.uniq(chartState.allPoints.map((p) => p.timeValue))).toEqual([
            2001,
        ])
        expect(_.uniq(chartState.allPoints.map((p) => p.time.y))).toEqual([
            2001,
        ])
        expect(chartState.allPoints.map((p) => p.time.x)).toEqual(
            expect.arrayContaining([2000, 2001, 2003])
        )
    })
})

describe("x/y tolerance", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", 2000, 0, null, "Europe", 100],
            ["UK", 2001, null, null, null, null],
            ["UK", 2002, null, null, null, null],
            ["UK", 2003, null, 3, null, null],
            ["UK", 2004, null, null, null, null],
            ["UK", 2005, 5, null, null, null],
            ["UK", 2006, 6, 6, null, null],
            ["UK", 2007, null, 7, null, null],
            ["UK", 2008, 8, null, null, null],
            ["UK", 2009, null, null, null, null],
            ["UK", 2010, null, null, "Europe", 100],
            // should be removed because it has no X/Y values
            ["USA", 2020, null, null, "North America", 0],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 3 },
            },
            {
                slug: "y",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 3 },
            },
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 10 },
            },
            ...numericDefs("size"),
        ]
    )

    const chartState = makeScatterChartState(table)

    const transformedTable = chartState.transformedTable

    it("removes rows without X or Y value", () => {
        expect(transformedTable.get("year").values).toEqual([
            2003, 2004, 2005, 2006, 2007, 2008,
        ])
    })

    it("applies tolerance on color & size before filtering rows", () => {
        expect(
            _.uniq(transformedTable.get("color").valuesIncludingErrorValues)
        ).toEqual(["Europe"])
        expect(
            _.uniq(transformedTable.get("size").valuesIncludingErrorValues)
        ).toEqual([100])
    })

    it("matches rows correctly", () => {
        const xTimeSlug = makeOriginalTimeSlugFromColumnSlug("x")
        const yTimeSlug = makeOriginalTimeSlugFromColumnSlug("y")

        const rows = transformedTable.rows
        expect(rows.length).toEqual(6)

        const uniqRows = _.uniqBy(
            rows,
            (row) => `${row[xTimeSlug]}-${row[yTimeSlug]}`
        )
        expect(uniqRows).toEqual([
            expect.objectContaining({
                x: 5,
                [xTimeSlug]: 2005,
                y: 3,
                [yTimeSlug]: 2003,
                year: 2003,
            }),
            expect.objectContaining({
                x: 6,
                [xTimeSlug]: 2006,
                y: 6,
                [yTimeSlug]: 2006,
                year: 2006,
            }),
            expect.objectContaining({
                x: 8,
                [xTimeSlug]: 2008,
                y: 7,
                [yTimeSlug]: 2007,
                year: 2008,
            }),
        ])
    })
})

describe("correct bubble sizes", () => {
    it("with column", () => {
        const table = new OwidTable(
            [
                ["entityName", "year", "x", "y", "size"],
                // sorted alphabetically
                ["SWE", 2000, 2, 2, undefined],
                ["UK", 2000, 1, 1, 0],
                ["USA", 2000, 2, 2, 2],
                ["ZZZ", 2000, 2, 2, -20],
            ],
            numericDefs("x", "y", "size")
        )

        const manager: ScatterPlotManager = {
            xColumnSlug: "x",
            yColumnSlug: "y",
            sizeColumnSlug: "size",
            table,
        }

        const chartState = new ScatterPlotChartState({ manager })
        const chart = new ScatterPlotChart({ chartState })

        const scatterPoints = new ScatterPointsWithLabels({
            noDataMessageManager: manager,
            isConnected: chartState["isConnected"],
            hideConnectedScatterLines: chart["hideConnectedScatterLines"],
            seriesArray: chart["series"],
            dualAxis: chart["dualAxis"],
            sizeScale: chart["sizeScale"],
            fontScale: chart["fontScale"],
            baseFontSize: chart["fontSize"],
            focusedSeriesNames: chart["selectedEntityNames"],
            hoveredSeriesNames: chart["hoveredSeriesNames"],
            onMouseEnter: chart["onScatterMouseEnter"],
            onMouseLeave: chart["onScatterMouseLeave"],
            onClick: chart["onScatterClick"],
            quadtree: chart["quadtree"],
        })

        const sortedRenderSeries = _.sortBy(
            scatterPoints["initialRenderSeries"],
            (s) => s.seriesName
        )

        expect(
            sortedRenderSeries.map((s) => [s.seriesName, s.size, s.fontSize])
        ).toEqual([
            ["SWE", SCATTER_POINT_MIN_RADIUS, 10],
            ["UK", SCATTER_POINT_MIN_RADIUS, 10],
            ["USA", SCATTER_POINT_MAX_RADIUS, 13],
            ["ZZZ", SCATTER_POINT_MIN_RADIUS, 10],
        ])
    })

    it("without column", () => {
        const table = new OwidTable(
            [
                ["entityName", "year", "x", "y"],
                // sorted alphabetically
                ["SWE", 2000, 2, 2],
                ["UK", 2000, 1, 1],
            ],
            numericDefs("x", "y")
        )

        const manager: ScatterPlotManager = {
            xColumnSlug: "x",
            yColumnSlug: "y",
            table,
        }

        const chartState = new ScatterPlotChartState({ manager })
        const chart = new ScatterPlotChart({ chartState })

        const scatterPoints = new ScatterPointsWithLabels({
            noDataMessageManager: manager,
            isConnected: chartState["isConnected"],
            hideConnectedScatterLines: chart["hideConnectedScatterLines"],
            seriesArray: chart["series"],
            dualAxis: chart["dualAxis"],
            sizeScale: chart["sizeScale"],
            fontScale: chart["fontScale"],
            baseFontSize: chart["fontSize"],
            focusedSeriesNames: chart["selectedEntityNames"],
            hoveredSeriesNames: chart["hoveredSeriesNames"],
            onMouseEnter: chart["onScatterMouseEnter"],
            onMouseLeave: chart["onScatterMouseLeave"],
            onClick: chart["onScatterClick"],
            quadtree: chart["quadtree"],
        })

        const sortedRenderSeries = _.sortBy(
            scatterPoints["initialRenderSeries"],
            (s) => s.seriesName
        )

        expect(
            sortedRenderSeries.map((s) => [s.seriesName, s.size, s.fontSize])
        ).toEqual([
            ["SWE", SCATTER_POINT_DEFAULT_RADIUS, 10.5],
            ["UK", SCATTER_POINT_DEFAULT_RADIUS, 10.5],
        ])
    })
})

it("applies color tolerance before applying the author timeline filter", () => {
    const table = new OwidTable(
        [
            ["entityName", "year", "x", "y", "color", "size"],
            ["UK", -1000, 1, 1, null, null],
            ["UK", 1000, 1, 1, null, 100],
            ["UK", 2020, 1, 1, null, null],
            ["UK", 2023, null, null, "Europe", null],
        ],
        [...numericDefs("x", "y", "size"), ...stringDefs("color")]
    )

    const chartState = makeScatterChartState(table, { timelineMaxTime: 2020 })

    expect(
        _.uniq(
            chartState.transformedTable.get("color").valuesIncludingErrorValues
        )
    ).toEqual(["Europe"])
})

describe("continent colors remain consistent regardless of data", () => {
    it("assigns correct colors even when some continents are missing", () => {
        // Test with only Asia and Europe (missing Africa, which is first in palette)
        const table1 = new OwidTable(
            [
                ["entityName", "year", "x", "y", "color"],
                ["China", 2000, 1, 1, "Asia"],
                ["Germany", 2000, 2, 2, "Europe"],
            ],
            [...numericDefs("x", "y"), ...stringDefs("color")]
        )

        const manager: ScatterPlotManager = {
            xColumnSlug: "x",
            yColumnSlug: "y",
            colorColumnSlug: "color",
            table: table1,
        }

        const chartState1 = new ScatterPlotChartState({ manager })

        // Asia should get its designated color (Teal), not the first color (Africa's Mauve)
        expect(chartState1.colorScale.getColor("Asia")).toEqual(
            ContinentColors.Asia
        )
        // Europe should get its designated color (Denim), not the second color (Asia's Teal)
        expect(chartState1.colorScale.getColor("Europe")).toEqual(
            ContinentColors.Europe
        )
    })
})
