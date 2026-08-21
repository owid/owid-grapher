import { describe, expect, it } from "vitest"

import { ColumnTypeNames } from "@ourworldindata/types"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
    SynthesizeProjectedPopulationTable,
} from "@ourworldindata/core-table"
import { MapChartManager } from "./MapChartConstants"
import { MapChart } from "./MapChart"
import { MapChartState } from "./MapChartState"
import { MapConfig } from "./MapConfig"
import { CategoricalBin } from "../color/ColorScaleBin"
import { INAPPLICABLE_COLOR } from "../color/ColorScale"

const table = SynthesizeGDPTable({
    timeRange: [2000, 2001],
    entityNames: ["France", "Germany", "World"],
})
const manager: MapChartManager = {
    table,
    mapColumnSlug: SampleColumnSlugs.Population,
    endTime: 2000,
}

it("can create a new Map chart", () => {
    const chartState = new MapChartState({ manager })
    expect(Object.keys(chartState.series).length).toEqual(2)

    const legends = chartState.colorScale.legendBins
    expect(Object.keys(legends).length).toBeGreaterThan(1)
})

it("filters out non-map entities from colorScaleColumn", () => {
    const chartState = new MapChartState({ manager })
    expect(chartState.colorScaleColumn.uniqEntityNames).toEqual(
        expect.arrayContaining(["France", "Germany"])
    )
})

it("pins a map bracket selected by touch until the next touch", () => {
    const chartState = new MapChartState({ manager })
    const chart = new MapChart({ chartState })
    const [firstBracket, secondBracket] = chartState.colorScale.legendBins

    expect(firstBracket).toBeDefined()
    expect(secondBracket).toBeDefined()

    chart.onLegendMouseOver(firstBracket)
    chart.onLegendTouchSelect(firstBracket)
    chart.onLegendMouseLeave()
    chart.onLegendMouseOver(secondBracket)

    expect(chart.hoverBracket).toBe(firstBracket)

    chart.onDocumentPointerDown()

    expect(chart.hoverBracket).toBeUndefined()

    chart.onLegendMouseOver(secondBracket)

    expect(chart.hoverBracket).toBe(secondBracket)
})

it("combines projected data with its historical counterpart", () => {
    const table = SynthesizeProjectedPopulationTable({
        timeRange: [2000, 2001],
        entityNames: ["France", "Germany", "World"],
    })

    const combinedSlug = `${SampleColumnSlugs.ProjectedPopulation}-${SampleColumnSlugs.Population}`
    const projectionColumnInfos = [
        {
            projectedSlug: SampleColumnSlugs.ProjectedPopulation,
            historicalSlug: SampleColumnSlugs.Population,
            combinedSlug,
            slugForIsProjectionColumn: `${combinedSlug}-isProjection`,
        },
    ]

    const manager: MapChartManager = {
        table,
        mapColumnSlug: SampleColumnSlugs.ProjectedPopulation,
        endTime: 2000,
        projectionColumnInfoBySlug: new Map(
            projectionColumnInfos.map((info) => [info.projectedSlug, info])
        ),
    }

    const chartState = new MapChartState({ manager })
    expect(chartState.mapColumnSlug).toEqual(combinedSlug)
})

describe("not applicable entities", () => {
    // Not-applicable entities are expected to have no data,
    // so they're not included in the table
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2001],
        entityNames: ["Germany", "Spain", "World"],
    })

    const makeManager = (
        inapplicableEntityNames: string[],
        mapConfig = new MapConfig()
    ): MapChartManager => ({
        table,
        mapColumnSlug: SampleColumnSlugs.Population,
        endTime: 2000,
        mapConfig,
        inapplicableEntityNames,
    })

    it("renders not-applicable entities with their own legend bin", () => {
        const chartState = new MapChartState({
            manager: makeManager(["France"]),
        })

        // France is recognized as not-applicable, but has no series
        expect(chartState.inapplicableEntityNamesSet).toEqual(
            new Set(["France"])
        )
        expect(chartState.seriesMap.has("France")).toBe(false)

        // A "Not applicable" legend bin is injected
        const bin = chartState.colorScale.legendBins.find(
            (bin) =>
                bin instanceof CategoricalBin && bin.value === "Not applicable"
        )
        expect(bin?.label).toEqual("Not applicable")
        expect(bin?.color).toEqual(INAPPLICABLE_COLOR)

        // The tooltip also reads "Not applicable"
        expect(chartState.colorScale.inapplicableLabel).toEqual(
            "Not applicable"
        )
    })

    it("lets the color scale config override the not-applicable label", () => {
        const mapConfig = new MapConfig()
        mapConfig.colorScale.customCategoryLabels = {
            "Not applicable": "Selected country",
        }

        const chartState = new MapChartState({
            manager: makeManager(["France"], mapConfig),
        })

        const bin = chartState.colorScale.legendBins.find(
            (bin) =>
                bin instanceof CategoricalBin && bin.value === "Not applicable"
        )
        expect(bin?.label).toEqual("Selected country")

        // The custom label is also used in the map tooltip
        expect(chartState.colorScale.inapplicableLabel).toEqual(
            "Selected country"
        )
    })
})

it("keeps the source time of combined values that tolerance was applied to", () => {
    // France has a projected value for the target time; Germany's closest
    // projected value is from 2003; Italy only has historical data, from 2002
    const table = new OwidTable(
        [
            ["entityName", "year", "population", "projected_population"],
            ["France", 2002, 100, ""],
            ["France", 2003, "", 300],
            ["France", 2004, "", 400],
            ["Germany", 2002, 150, ""],
            ["Germany", 2003, "", 350],
            ["Italy", 2002, 200, ""],
        ],
        [
            {
                slug: "population",
                type: ColumnTypeNames.Numeric,
                tolerance: 3,
            },
            {
                slug: "projected_population",
                type: ColumnTypeNames.Numeric,
                tolerance: 3,
                display: { isProjection: true },
            },
            { slug: "year", type: ColumnTypeNames.Year },
        ]
    )

    const combinedSlug = "projected_population-population"
    const manager: MapChartManager = {
        table,
        mapColumnSlug: "projected_population",
        targetTime: 2004,
        projectionColumnInfoBySlug: new Map([
            [
                "projected_population",
                {
                    projectedSlug: "projected_population",
                    historicalSlug: "population",
                    combinedSlug,
                    slugForIsProjectionColumn: `${combinedSlug}-isProjection`,
                },
            ],
        ]),
    }

    const chartState = new MapChartState({ manager })
    expect(chartState.series).toEqual([
        expect.objectContaining({
            seriesName: "France",
            time: 2004,
            value: 400,
            isProjection: true,
        }),
        expect.objectContaining({
            seriesName: "Germany",
            time: 2003,
            value: 350,
            isProjection: true,
        }),
        expect.objectContaining({
            seriesName: "Italy",
            time: 2002,
            value: 200,
            isProjection: false,
        }),
    ])
})

it("doesn't apply tolerance a second time to a plain map column", () => {
    // Spain's only value is from 2000, which a tolerance of 3 carries as far as
    // 2003, so it must not appear on a map showing 2006 — reaching that far
    // would mean applying the tolerance a second time
    const table = new OwidTable(
        [
            ["entityName", "year", "population"],
            ["France", 2000, 100],
            ["France", 2003, 150],
            ["France", 2006, 200],
            ["Spain", 2000, 300],
        ],
        [
            {
                slug: "population",
                type: ColumnTypeNames.Numeric,
                tolerance: 3,
            },
            { slug: "year", type: ColumnTypeNames.Year },
        ]
    )

    const chartState = new MapChartState({
        manager: { table, mapColumnSlug: "population", targetTime: 2006 },
    })

    // Spain is not included because its value is too far away from the target time
    expect(chartState.series.map((series) => series.seriesName)).toEqual([
        "France",
    ])
})

describe("doesn't apply tolerance a second time across the stitch", () => {
    // Spain's only value is historical, from 2000. A tolerance of 3 carries it
    // as far as 2003, so it must not appear on a map showing 2006 — reaching
    // that far would mean applying the tolerance twice
    const makeChartState = (mapConfig?: MapConfig): MapChartState => {
        const table = new OwidTable(
            [
                ["entityName", "year", "population", "projected_population"],
                ["France", 2000, 100, ""],
                ["France", 2003, 150, ""],
                ["France", 2006, "", 200],
                ["Spain", 2000, 300, ""],
            ],
            [
                {
                    slug: "population",
                    type: ColumnTypeNames.Numeric,
                    tolerance: 3,
                },
                {
                    slug: "projected_population",
                    type: ColumnTypeNames.Numeric,
                    tolerance: 3,
                    display: { isProjection: true },
                },
                { slug: "year", type: ColumnTypeNames.Year },
            ]
        )

        const combinedSlug = "projected_population-population"
        return new MapChartState({
            manager: {
                table,
                mapColumnSlug: "projected_population",
                targetTime: 2006,
                mapConfig,
                projectionColumnInfoBySlug: new Map([
                    [
                        "projected_population",
                        {
                            projectedSlug: "projected_population",
                            historicalSlug: "population",
                            combinedSlug,
                            slugForIsProjectionColumn: `${combinedSlug}-isProjection`,
                        },
                    ],
                ]),
            },
        })
    }

    it("when the tolerance comes from the columns", () => {
        // Spain is not included because its value is too far away from the target time
        expect(
            makeChartState().series.map((series) => series.seriesName)
        ).toEqual(["France"])
    })

    it("when the tolerance comes from the map config", () => {
        // Spain is not included because its value is too far away from the target time
        expect(
            makeChartState(new MapConfig({ timeTolerance: 3 })).series.map(
                (series) => series.seriesName
            )
        ).toEqual(["France"])
    })
})
