import { expect, it } from "vitest"

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
    SynthesizeProjectedPopulationTable,
} from "@ourworldindata/core-table"
import { MapChartManager } from "./MapChartConstants"
import { MapChart } from "./MapChart"

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
    const chart = new MapChart({ manager })
    expect(Object.keys(chart.series).length).toEqual(2)

    const legends = chart.colorScale.legendBins
    expect(Object.keys(legends).length).toBeGreaterThan(1)
})

it("filters out non-map entities from colorScaleColumn", () => {
    const chart = new MapChart({ manager })
    expect(chart.colorScaleColumn.uniqEntityNames).toEqual(
        expect.arrayContaining(["France", "Germany"])
    )
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

    const chart = new MapChart({ manager })
    expect(chart.mapColumnSlug).toEqual(combinedSlug)
})
