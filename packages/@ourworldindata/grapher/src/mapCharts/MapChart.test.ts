import { describe, expect, it } from "vitest"

import {
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

it("highlights the countries of a hovered legend bracket", () => {
    const chartState = new MapChartState({ manager })
    const chart = new MapChart({ chartState })
    const bracket = chartState.colorScale.legendBins.find((bin) =>
        chartState.series.some((series) => bin.contains(series.value))
    )!

    expect(chart.getHoverState("France").background).toBe(false)

    chart.onLegendMouseOver(bracket)
    for (const series of chartState.series) {
        expect(chart.getHoverState(series.seriesName).active).toBe(
            bracket.contains(series.value)
        )
    }

    chart.onLegendMouseLeave()
    expect(chart.getHoverState("France").background).toBe(false)
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
