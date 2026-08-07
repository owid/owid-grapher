import { expect, it } from "vitest"

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
