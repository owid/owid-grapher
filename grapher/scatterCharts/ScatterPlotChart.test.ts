#! /usr/bin/env yarn jest

import { ScatterPlotChart } from "grapher/scatterCharts/ScatterPlotChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ScatterPlotManager } from "./ScatterPlotChartConstants"
import {
    ScaleType,
    ScatterPointLabelStrategy,
} from "grapher/core/GrapherConstants"
import { OwidTable } from "coreTable/OwidTable"
import { ErrorValueTypes } from "coreTable/ErrorValues"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { ContinentColors } from "grapher/color/ColorConstants"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"
import { Color } from "coreTable/CoreTableConstants"
import { makeOriginalTimeSlugFromColumnSlug } from "coreTable/OwidTableUtil"
import { uniq, uniqBy } from "grapher/utils/Util"

it("can create a new chart", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeGDPTable(),
    }

    const chart = new ScatterPlotChart({ manager })
    expect(chart.failMessage).toBeFalsy()
    expect(chart.getSeriesNamesToShow().size).toEqual(2)
    expect(chart.series.length).toEqual(2)
    expect(chart.allPoints.length).toBeGreaterThan(0)
})

it("shows error when X or Y columns are missing", () => {
    const manager: ScatterPlotManager = {
        table: new OwidTable([
            ["entityId", "entityName", "entityCode", "year"],
            [1, "World", undefined, 2020],
        ]),
    }
    const chart = new ScatterPlotChart({ manager })
    expect(chart.failMessage).toBeTruthy()
})

it("doesn't show 'No data' bin when there is no color column", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeGDPTable(),
        colorColumnSlug: undefined,
    }
    const chart = new ScatterPlotChart({ manager })
    expect(chart.failMessage).toBeFalsy()
    expect(chart.hasNoDataBin).toBeFalsy()
})

it("can remove points outside domain", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeFruitTable(undefined, 2),
    }
    const chart = new ScatterPlotChart({ manager })
    const initialCount = chart.allPoints.length
    manager.xAxisConfig = { removePointsOutsideDomain: true, max: 1100 }
    expect(chart.allPoints.length).toBeGreaterThan(0)
    expect(chart.allPoints.length).toBeLessThan(initialCount)
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

    const chart = new ScatterPlotChart({ manager })
    expect(chart.series.length).toEqual(2)
    expect(chart.allPoints.length).toEqual(200)

    const logScaleManager = {
        ...manager,
        yAxisConfig: {
            scaleType: ScaleType.log,
        },
        xAxisConfig: {
            scaleType: ScaleType.log,
        },
    }
    const logChart = new ScatterPlotChart({ manager: logScaleManager })
    expect(logChart.dualAxis.horizontalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.dualAxis.verticalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.series.length).toEqual(2)
    expect(logChart.allPoints.length).toEqual(180)
})

describe("interpolation defaults", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "UK", "", -1000, 1, 1, null, null],
            [1, "UK", "", 1000, 1, 1, "Europe", 100],
            [1, "UK", "", 2020, 1, 1, null, null],
        ],
        [
            { slug: "x", type: ColumnTypeNames.Numeric },
            { slug: "y", type: ColumnTypeNames.Numeric },
            { slug: "color", type: ColumnTypeNames.String },
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
    const chart = new ScatterPlotChart({ manager })

    it("color defaults to infinity tolerance if none specified", () => {
        expect(
            chart.transformedTable.get("color").valuesIncludingErrorValues
        ).toEqual(["Europe", "Europe", "Europe"])
    })

    it("size defaults to infinity tolerance regardless if one specified", () => {
        expect(
            chart.transformedTable.get("size").valuesIncludingErrorValues
        ).toEqual([100, 100, 100])
    })
})

describe("basic scatterplot", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "UK", "", 2000, 1, 1, null, null],
            [1, "UK", "", 2001, null, 1, "Europe", 100],
            [1, "UK", "", 2002, 1, null, null, null],
            [1, "UK", "", 2003, null, null, null, null],
            [2, "USA", "", 2000, 1, 1, null, null],
        ],
        [
            { slug: "x", type: ColumnTypeNames.Numeric },
            { slug: "y", type: ColumnTypeNames.Numeric },
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 1 },
            },
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
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

    const chart = new ScatterPlotChart({ manager })

    it("removes error values from X and Y", () => {
        expect(chart.transformedTable.numRows).toEqual(2)
        expect(chart.transformedTable.timeColumn.uniqValues).toEqual([2000])
    })

    it("interpolates color & size columns before removing rows", () => {
        const ukTable = chart.transformedTable.where({ entityName: "UK" })
        expect(ukTable.get("color").valuesIncludingErrorValues).toEqual([
            "Europe",
        ])
        expect(ukTable.get("size").valuesIncludingErrorValues).toEqual([100])
    })

    it("color & size interpolation doesn't leak", () => {
        const usTable = chart.transformedTable.where({ entityName: "USA" })
        expect(usTable.get("color").valuesIncludingErrorValues).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
        ])
        expect(usTable.get("size").valuesIncludingErrorValues).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
        ])
    })

    it("shows 'No data' bin", () => {
        expect(chart.hasNoDataBin).toEqual(true)
    })

    it("plots correct series", () => {
        expect(chart.series).toEqual([
            {
                color: ContinentColors.Africa, // First "continents" color
                isScaleColor: true,
                label: "UK",
                points: [
                    {
                        color: "Europe",
                        entityName: "UK",
                        label: "2000",
                        size: 100,
                        time: {
                            x: 2000,
                            y: 2000,
                        },
                        timeValue: 2000,
                        x: 1,
                        y: 1,
                    },
                ],
                seriesName: "UK",
                size: 100,
            },
            {
                color: chart.defaultNoDataColor,
                isScaleColor: true,
                label: "USA",
                points: [
                    {
                        color: undefined,
                        entityName: "USA",
                        label: "2000",
                        size: 0,
                        time: {
                            x: 2000,
                            y: 2000,
                        },
                        timeValue: 2000,
                        x: 1,
                        y: 1,
                    },
                ],
                seriesName: "USA",
                size: 0,
            },
        ])
    })
})

describe("label point strategies", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "UK", "", 2000, 1, 2, null, null],
        ],
        [
            { slug: "x", type: ColumnTypeNames.Numeric },
            { slug: "y", type: ColumnTypeNames.Numeric },
            {
                slug: "color",
                type: ColumnTypeNames.String,
            },
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
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

    it("year", () => {
        const chart = new ScatterPlotChart({
            manager: {
                ...manager,
                scatterPointLabelStrategy: ScatterPointLabelStrategy.year,
            },
        })
        expect(chart.allPoints[0].label).toEqual("2000")
    })

    it("y", () => {
        const chart = new ScatterPlotChart({
            manager: {
                ...manager,
                scatterPointLabelStrategy: ScatterPointLabelStrategy.y,
            },
        })
        expect(chart.allPoints[0].label).toEqual("2")
    })

    it("x", () => {
        const chart = new ScatterPlotChart({
            manager: {
                ...manager,
                scatterPointLabelStrategy: ScatterPointLabelStrategy.x,
            },
        })
        expect(chart.allPoints[0].label).toEqual("1")
    })
})

it("assigns entity colors to series, overriding colorScale color", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
                OwidTableSlugs.entityColor,
            ],
            [1, "UK", "", 2000, 1, 2, "Europe", null, "#ccc"],
        ],
        [
            { slug: "x", type: ColumnTypeNames.Numeric },
            { slug: "y", type: ColumnTypeNames.Numeric },
            {
                slug: "color",
                type: ColumnTypeNames.String,
            },
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
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

    const chart = new ScatterPlotChart({ manager })

    expect(chart.series[0].color).toEqual("#ccc")
})

describe("entity exclusion", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "UK", "", 2000, 1, 1, null, null],
            [1, "UK", "", 2001, null, 1, "Europe", 100],
            [1, "UK", "", 2002, 1, null, null, null],
            [1, "UK", "", 2003, null, null, null, null],
            [2, "USA", "", 2000, 1, 1, null, null],
        ],
        [
            { slug: "x", type: ColumnTypeNames.Numeric },
            { slug: "y", type: ColumnTypeNames.Numeric },
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 1 },
            },
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
            },
        ]
    )

    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        matchingEntitiesOnly: true,
        table,
    }

    const chart = new ScatterPlotChart({ manager })

    it("excludes entities without color when matchingEntitiesOnly is enabled", () => {
        expect(chart.allPoints.length).toEqual(1)
        expect(chart.allPoints[0].entityName).toEqual("UK")
    })

    it("doesn't show No data bin", () => {
        expect(chart.hasNoDataBin).toEqual(false)
    })
})

describe("colors & legend", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "Germany", "", 2001, 1, 1, "Europe", null],
            [2, "Canada", "", 2000, 1, 1, "North America", null],
            [3, "China", "", 2000, 1, null, "Asia", null],
            [4, "Australia", "", 2000, 1, 1, "Oceania", null],
            [5, "Antarctica", "", 2000, null, null, "Antarctica", null],
            [6, "Chile", "", 2000, 1, 1, "South America", null],
            [7, "Nigeria", "", 2000, 1, 1, "Africa", null],
        ],
        [
            { slug: "x", type: ColumnTypeNames.Numeric },
            { slug: "y", type: ColumnTypeNames.Numeric },
            {
                slug: "color",
                type: ColumnTypeNames.String,
                display: { tolerance: 1 },
            },
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
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
        tableAfterAuthorTimelineAndActiveChartTransformAndPopulationFilter: tableWithoutChina,
    }

    const chart = new ScatterPlotChart({ manager })

    it("assigns correct continent colors", () => {
        // Every series color is the same as the point color
        chart.series.forEach((series) => {
            const seriesNameToContinent: { [key: string]: string } = {
                Germany: "Europe",
                Canada: "North America",
                China: "Asia",
                Australia: "Oceania",
                Antarctica: "Antarctica",
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
                expect(chart.colorScale.getColor(continentName)).toEqual(
                    continentColor
                )
            }
        })
    })

    it("legend contains every continent for which there is data (before timeline filter)", () => {
        expect(chart.legendItems.map((item) => item.label).sort()).toEqual([
            "Africa",
            "Antarctica",
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
                ContinentColors["North America"],
                ContinentColors.Oceania,
                ContinentColors["South America"],
            ].sort()
        )
    })
})

describe("series transformations", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "UK", "", 2001, 1, 1, null, null],
            [1, "UK", "", 2004, 2, 1, null, null],
            [1, "UK", "", 2002, null, 1, null, null],
            [1, "UK", "", 2000, 1, null, null, null],
            [1, "UK", "", 2003, 2, 1, null, null],
            [2, "Germany", "", 2000, 1, 1, null, null],
            [2, "Germany", "", 2003, 2, 2, null, null],
            [3, "USA", "", 2001, 0, 0, null, null],
            [3, "USA", "", 2002, 1, 1, null, null],
            [3, "USA", "", 2003, 2, 2, null, null],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
            },
            {
                slug: "y",
                type: ColumnTypeNames.Numeric,
            },
            { slug: "color", type: ColumnTypeNames.String },
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
    const chart = new ScatterPlotChart({ manager })

    it("sorts points by time", () => {
        const ukSeries = chart.series.find((s) => s.seriesName === "UK")!
        expect(ukSeries.points.map((p) => p.timeValue)).toEqual([
            2001,
            2003,
            2004,
        ])
    })

    it("endpointsOnly drops trailing and in-between points", () => {
        const chart = new ScatterPlotChart({
            manager: { ...manager, compareEndPointsOnly: true },
        })
        const ukSeries = chart.series.find((s) => s.seriesName === "UK")!
        expect(ukSeries.points.map((p) => p.timeValue)).toEqual([2001, 2004])
    })

    it("hides entities without full time span", () => {
        const chart = new ScatterPlotChart({
            manager: {
                ...manager,
                hideLinesOutsideTolerance: true,
                startTime: 2000,
                endTime: 2003,
            },
        })
        // Because of the assumption that the timeline filter is applied,
        // only Germany can be visible in this case.
        expect(chart.series.map((s) => s.seriesName)).toEqual(["Germany"])
    })

    it("calculates average annual change", () => {
        const chart = new ScatterPlotChart({
            manager: {
                ...manager,
                isRelativeMode: true,
            },
        })
        const uk = chart.series.find((s) => s.seriesName === "UK")!.points[0]
        const usa = chart.series.find((s) => s.seriesName === "USA")!.points[0]
        const germany = chart.series.find((s) => s.seriesName === "Germany")!
            .points[0]

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
            { slug: "color", type: ColumnTypeNames.String },
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
        // intentionally setting compareEndPointsOnly to make sure it's
        // ignored in relative mode
        compareEndPointsOnly: true,
        table,
    }
    const chart = new ScatterPlotChart({ manager })

    it("drops series with a single point", () => {
        expect(chart.series.length).toEqual(1)
    })

    it("calculates average annual change based on originalTime", () => {
        const point = chart.series[0].points[0]
        expect(point.x).toEqual(100)
        expect(Math.abs(point.y)).toEqual(0)
    })

    it("formats axes with %", () => {
        expect(chart.dualAxis.verticalAxis.formatTick(0)).toEqual("+0%")
        expect(chart.dualAxis.horizontalAxis.formatTick(0)).toEqual("+0%")
    })
})

describe("scatter plot with xOverrideTime", () => {
    const xOriginalTimeSlug = makeOriginalTimeSlugFromColumnSlug("x")
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "day",
                "x",
                "y",
                "color",
                "size",
                xOriginalTimeSlug,
            ],
            [1, "UK", "", 2001, 0, 0, null, null, 2000],
            [2, "Germany", "", 2001, 1, 1, null, null, 2001],
            [3, "USA", "", 2001, 2, 2, null, null, 2003],
        ],
        [
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 1 },
            },
            { slug: "y", type: ColumnTypeNames.Numeric },
            { slug: "year", type: ColumnTypeNames.Year },
            { slug: "color", type: ColumnTypeNames.String },
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
                display: { tolerance: 1 },
            },
            { slug: xOriginalTimeSlug, type: ColumnTypeNames.Year },
        ]
    )
    const manager: ScatterPlotManager = {
        xColumnSlug: "x",
        yColumnSlug: "y",
        colorColumnSlug: "color",
        sizeColumnSlug: "size",
        table,
    }
    const chart = new ScatterPlotChart({ manager })

    it("all points have correct times", () => {
        expect(uniq(chart.allPoints.map((p) => p.timeValue))).toEqual([2001])
        expect(uniq(chart.allPoints.map((p) => p.time.y))).toEqual([2001])
        expect(chart.allPoints.map((p) => p.time.x)).toEqual(
            expect.arrayContaining([2000, 2001, 2003])
        )
    })
})

describe("x/y tolerance", () => {
    const table = new OwidTable(
        [
            [
                "entityId",
                "entityName",
                "entityCode",
                "year",
                "x",
                "y",
                "color",
                "size",
            ],
            [1, "UK", "", 2000, 0, null, "Europe", 100],
            [1, "UK", "", 2001, null, null, null, null],
            [1, "UK", "", 2002, null, null, null, null],
            [1, "UK", "", 2003, null, 3, null, null],
            [1, "UK", "", 2004, null, null, null, null],
            [1, "UK", "", 2005, 5, null, null, null],
            [1, "UK", "", 2006, 6, 6, null, null],
            [1, "UK", "", 2007, null, 7, null, null],
            [1, "UK", "", 2008, 8, null, null, null],
            [1, "UK", "", 2009, null, null, null, null],
            [1, "UK", "", 2010, null, null, "Europe", 100],
            // should be removed because it has no X/Y values
            [2, "USA", "", 2020, null, null, "North America", 0],
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
            {
                slug: "size",
                type: ColumnTypeNames.Numeric,
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

    const chart = new ScatterPlotChart({ manager })

    const transformedTable = chart.transformedTable

    it("removes rows without X or Y value", () => {
        expect(transformedTable.get("year").values).toEqual([
            2003,
            2004,
            2005,
            2006,
            2007,
            2008,
        ])
    })

    it("applies tolerance on color & size before filtering rows", () => {
        expect(
            uniq(transformedTable.get("color").valuesIncludingErrorValues)
        ).toEqual(["Europe"])
        expect(
            uniq(transformedTable.get("size").valuesIncludingErrorValues)
        ).toEqual([100])
    })

    it("matches rows correctly", () => {
        const xTimeSlug = makeOriginalTimeSlugFromColumnSlug("x")
        const yTimeSlug = makeOriginalTimeSlugFromColumnSlug("y")

        const rows = transformedTable.rows
        expect(rows.length).toEqual(6)

        const uniqRows = uniqBy(
            rows,
            (row) => `${row[xTimeSlug]}-${row[yTimeSlug]}`
        )
        expect(uniqRows).toEqual([
            expect.objectContaining({
                color: "Europe",
                entityName: "UK",
                size: 100,
                x: 5,
                [xTimeSlug]: 2005,
                y: 3,
                [yTimeSlug]: 2003,
                year: 2003,
            }),
            expect.objectContaining({
                color: "Europe",
                entityName: "UK",
                size: 100,
                x: 6,
                [xTimeSlug]: 2006,
                y: 6,
                [yTimeSlug]: 2006,
                year: 2006,
            }),
            expect.objectContaining({
                color: "Europe",
                entityName: "UK",
                size: 100,
                x: 8,
                [xTimeSlug]: 2008,
                y: 7,
                [yTimeSlug]: 2007,
                year: 2008,
            }),
        ])
    })
})
