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
import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import { INAPPLICABLE_COLOR } from "../color/ColorScale"
import { renderToStaticMarkup } from "react-dom/server"
import { GrapherState } from "../core/GrapherState"
import { legacyMapGrapher, legacyMapGrapherData } from "./MapChart.sample"
import { legacyToOwidTableAndDimensions } from "../core/LegacyToOwidTable"

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

it.each([false, true])(
    "applies authored bracket overrides with metadata colour scales: %s",
    (isOpen) => {
        const metadataTable = table.updateDefs((def) =>
            def.slug === SampleColumnSlugs.Population
                ? { ...def, colorScaleNumericBins: "10;20" }
                : def
        )
        const chartState = new MapChartState({
            manager: {
                ...manager,
                table: metadataTable,
                mapConfig: new MapConfig({
                    colorScale: { isOpenLeft: isOpen, isOpenRight: isOpen },
                }),
            },
        })
        const bins = chartState.colorScale.legendBins.filter(
            (bin): bin is NumericBin => bin instanceof NumericBin
        )
        expect(bins.map((bin) => [bin.min, bin.max])).toEqual([
            [0, 10],
            [10, 20],
        ])
        expect(bins[0].props.isOpenLeft).toBe(isOpen)
        expect(bins[1].props.isOpenRight).toBe(isOpen)
        expect(chartState.colorScale.getBinForValue(-1)).toEqual(
            isOpen ? bins[0] : undefined
        )
        expect(chartState.colorScale.getBinForValue(30)).toEqual(
            isOpen ? bins[1] : undefined
        )
    }
)

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

    it.each([
        { case: "default", customColor: undefined, expected: "#ccc" },
        { case: "custom", customColor: "#f4c9c9", expected: "#f4c9c9" },
    ])(
        "draws the not-applicable stripes over the $case color",
        async ({ customColor, expected }) => {
            const grapherState = new GrapherState({
                ...legacyMapGrapher,
                inapplicableEntityNames: ["Argentina"],
                map: {
                    ...legacyMapGrapher.map,
                    ...(customColor && {
                        colorScale: {
                            customCategoryColors: {
                                "Not applicable": customColor,
                            },
                        },
                    }),
                },
            })
            grapherState.inputTable = legacyToOwidTableAndDimensions(
                legacyMapGrapherData,
                legacyMapGrapher.dimensions!,
                legacyMapGrapher.selectedEntityColors
            )
            const svg =
                await grapherState.generateStaticSvg(renderToStaticMarkup)

            const patterns =
                svg.match(
                    /<pattern id="inapplicablePattern[^>]*>.*?<\/pattern>/g
                ) ?? []
            expect(
                patterns
                    .map((pattern) => pattern.match(/id="([^"]+)"/)![1])
                    .sort()
            ).toEqual(["inapplicablePattern", "inapplicablePatternForMap"])
            for (const pattern of patterns)
                expect(pattern).toContain(`fill="${expected}"`)
        }
    )
})
