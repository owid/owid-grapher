import { describe, expect, it } from "vitest"

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
import { NOT_APPLICABLE_COLOR } from "../color/ColorScale"

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
    const makeTableWithNotApplicableEntities = (
        notApplicableEntities: string[]
    ): OwidTable =>
        SynthesizeGDPTable({
            timeRange: [2000, 2001],
            entityNames: ["Germany", "Spain", "World"],
        }).updateDefs((def) =>
            def.slug === SampleColumnSlugs.Population
                ? { ...def, display: { notApplicableEntities } }
                : def
        )

    it("renders not-applicable entities with their own legend bin", () => {
        const table = makeTableWithNotApplicableEntities(["France"])
        const chartState = new MapChartState({
            manager: {
                table,
                mapColumnSlug: SampleColumnSlugs.Population,
                endTime: 2000,
            },
        })

        // France is recognized as not-applicable, but has no series
        expect(chartState.notApplicableEntityNamesSet).toEqual(
            new Set(["France"])
        )
        expect(chartState.seriesMap.has("France")).toBe(false)

        // A "Not applicable" legend bin is injected
        const bin = chartState.colorScale.legendBins.find(
            (bin) =>
                bin instanceof CategoricalBin && bin.value === "Not applicable"
        )
        expect(bin?.label).toEqual("Not applicable")
        expect(bin?.color).toEqual(NOT_APPLICABLE_COLOR)

        // The tooltip also reads "Not applicable"
        expect(chartState.colorScale.notApplicableLabel).toEqual(
            "Not applicable"
        )
    })

    it("lets the color scale config override the not-applicable label", () => {
        const table = makeTableWithNotApplicableEntities(["France"])
        const mapConfig = new MapConfig()
        mapConfig.colorScale.customCategoryLabels = {
            "Not applicable": "Selected country",
        }

        const chartState = new MapChartState({
            manager: {
                table,
                mapColumnSlug: SampleColumnSlugs.Population,
                endTime: 2000,
                mapConfig,
            },
        })

        const bin = chartState.colorScale.legendBins.find(
            (bin) =>
                bin instanceof CategoricalBin && bin.value === "Not applicable"
        )
        expect(bin?.label).toEqual("Selected country")

        // The custom label is also used in the map tooltip
        expect(chartState.colorScale.notApplicableLabel).toEqual(
            "Selected country"
        )
    })

    it("ignores not-applicable entities that aren't on the map", () => {
        const table = makeTableWithNotApplicableEntities(["World"])
        const chartState = new MapChartState({
            manager: {
                table,
                mapColumnSlug: SampleColumnSlugs.Population,
                endTime: 2000,
            },
        })

        expect(chartState.notApplicableEntityNamesSet).toEqual(new Set())
        expect(chartState.seriesMap.get("World")).toBeUndefined()
    })

    it("handles multiple not-applicable entities", () => {
        const table = makeTableWithNotApplicableEntities(["France", "Germany"])
        const chartState = new MapChartState({
            manager: {
                table,
                mapColumnSlug: SampleColumnSlugs.Population,
                endTime: 2000,
            },
        })

        // Both are recognized as not-applicable
        expect(chartState.notApplicableEntityNamesSet).toEqual(
            new Set(["France", "Germany"])
        )
        expect(chartState.seriesMap.has("France")).toBe(false)
        expect(chartState.seriesMap.has("Germany")).toBe(false)

        // The shared "Not applicable" bin is injected once
        const notApplicableBins = chartState.colorScale.legendBins.filter(
            (bin) =>
                bin instanceof CategoricalBin && bin.value === "Not applicable"
        )
        expect(notApplicableBins).toHaveLength(1)
        expect(notApplicableBins[0]?.color).toEqual(NOT_APPLICABLE_COLOR)
    })
})
