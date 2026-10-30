import { describe, expect, it } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    GRAPHER_CHART_TYPES,
    GrapherVariant,
    IndicatorAnnotation,
    SortBy,
    SortOrder,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { GrapherProgrammaticInterface } from "../core/Grapher"
import { GrapherState } from "../core/GrapherState"
import { Emphasis } from "../interaction/Emphasis"
import { SwimlaneChart } from "./SwimlaneChart"
import { SwimlaneChartState } from "./SwimlaneChartState"
import {
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
} from "./SwimlaneChartConstants"

const { Highlighted, Muted } = Emphasis

// France: Monarchy 2000–2002, no data 2003–2004, Republic 2005.
// Germany: Republic 2000, no data 2001–2002, Republic 2003–2005.
const REGIME_ROWS = [
    { entityName: "France", year: 2000, regime: "Monarchy" },
    { entityName: "France", year: 2001, regime: "Monarchy" },
    { entityName: "France", year: 2002, regime: "Monarchy" },
    { entityName: "France", year: 2005, regime: "Republic" },
    { entityName: "Germany", year: 2000, regime: "Republic" },
    { entityName: "Germany", year: 2003, regime: "Republic" },
    { entityName: "Germany", year: 2004, regime: "Republic" },
    { entityName: "Germany", year: 2005, regime: "Republic" },
]

function makeChart(
    regimeColumnType: ColumnTypeNames,
    config: Partial<GrapherProgrammaticInterface> = {},
    annotations: IndicatorAnnotation[] = []
): { grapherState: GrapherState; chart: SwimlaneChart } {
    const table = new OwidTable(REGIME_ROWS, [
        { slug: "year", type: ColumnTypeNames.Year },
        {
            slug: "regime",
            type: regimeColumnType,
            sort: ["Republic", "Monarchy"],
            annotations,
        },
    ])
    const grapherState = new GrapherState({
        table,
        ySlugs: "regime",
        chartTypes: [GRAPHER_CHART_TYPES.Swimlane],
        selectedEntityNames: ["France", "Germany"],
        sortBy: SortBy.custom,
        sortOrder: SortOrder.asc,
        bounds: new Bounds(0, 0, 800, 600),
        ...config,
    })
    const chartState = new SwimlaneChartState({ manager: grapherState })
    const chart = new SwimlaneChart({
        chartState,
        bounds: grapherState.externalBounds,
    })
    return { grapherState, chart }
}

function findRow(
    chart: SwimlaneChart,
    entityName: string
): PlacedSwimlaneSeries {
    const row = chart["placedSeries"].find(
        (series) => series.entityName === entityName
    )
    if (!row) throw new Error(`No row for ${entityName}`)
    return row
}

function findLegendLabels(chart: SwimlaneChart): string[] {
    return chart["categoricalLegendBins"].map((bin) => bin.text)
}

function findSegmentEmphases(
    chart: SwimlaneChart,
    entityName: string
): Emphasis[] {
    const row = chart["renderSeries"].find(
        (series) => series.entityName === entityName
    )
    if (!row) throw new Error(`No row for ${entityName}`)
    return row.placedSegments.map((segment) => segment.emphasis)
}

function hasLabel(segment: PlacedSwimlaneSegment): boolean {
    return "label" in segment && segment.label !== undefined
}

describe("legend", () => {
    it("is an ordinal legend for an ordinal indicator, in the indicator's order", () => {
        const { chart } = makeChart(ColumnTypeNames.Ordinal)

        expect(chart["ordinalLegendState"]).toBeDefined()
        expect(chart["categoricalLegendState"]).toBeUndefined()
        expect(findLegendLabels(chart)).toEqual([
            "No data",
            "Republic",
            "Monarchy",
        ])
    })

    it("labels every category of an ordinal indicator with long labels at a narrow size", () => {
        const categories = [
            "Legal",
            "Civil union or other partnership",
            "Foreign same-sex marriages recognized only",
            "Unregistered cohabitation",
            "Varies by region",
            "Ambiguous",
            "Unrecognized",
            "Banned",
        ]
        const table = new OwidTable(
            categories.map((regime, index) => ({
                entityName: "France",
                year: 2000 + index,
                regime,
            })),
            [
                { slug: "year", type: ColumnTypeNames.Year },
                {
                    slug: "regime",
                    type: ColumnTypeNames.Ordinal,
                    sort: categories,
                },
            ]
        )
        const { chart } = makeChart(ColumnTypeNames.Ordinal, {
            table,
            selectedEntityNames: ["France"],
            bounds: new Bounds(0, 0, 375, 600),
        })

        expect(
            chart["ordinalLegendState"]!.labels.map((label) => label.bin.text)
        ).toEqual(["No data", ...categories])
    })

    it("is a categorical legend for a categorical indicator", () => {
        const { chart } = makeChart(ColumnTypeNames.String)

        expect(chart["categoricalLegendState"]).toBeDefined()
        expect(chart["ordinalLegendState"]).toBeUndefined()
    })

    it("merges categories that share a label and colour into one bin", () => {
        const { chart } = makeChart(ColumnTypeNames.String, {
            colorScale: {
                customCategoryLabels: {
                    Monarchy: "Regime",
                    Republic: "Regime",
                },
                customCategoryColors: {
                    Monarchy: "#123456",
                    Republic: "#123456",
                },
            },
        })

        expect(findLegendLabels(chart)).toEqual(["No data", "Regime"])
    })

    it.each([ColumnTypeNames.String, ColumnTypeNames.Ordinal])(
        "leaves hidden categories out of the %s legend",
        (regimeColumnType) => {
            const { chart } = makeChart(regimeColumnType, {
                colorScale: {
                    customHiddenCategories: { Monarchy: true },
                },
            })

            expect(findLegendLabels(chart)).toEqual(["No data", "Republic"])
        }
    )
})

describe("interaction", () => {
    it("highlights the hovered legend category even when another category shares its label", () => {
        const { chart } = makeChart(ColumnTypeNames.String, {
            colorScale: {
                customCategoryLabels: {
                    Monarchy: "Regime",
                    Republic: "Regime",
                },
            },
        })
        const legendBins = chart["categoricalLegendBins"]
        expect(legendBins.map((bin) => bin.value)).toEqual([
            "No data",
            "Monarchy",
            "Republic",
        ])

        chart["onLegendMouseOver"](legendBins[2])

        expect(findSegmentEmphases(chart, "France")).toEqual([
            Muted,
            Muted,
            Highlighted,
        ])
        expect(findSegmentEmphases(chart, "Germany")).toEqual([
            Highlighted,
            Muted,
            Highlighted,
        ])
    })

    it.each([
        {
            interaction: "a segment is hovered",
            interact: (chart: SwimlaneChart): void => {
                const [segment] = findRow(chart, "France").placedSegments
                chart["onSegmentMouseEnter"]("France", segment)
            },
        },
        {
            interaction: "a legend category is hovered",
            interact: (chart: SwimlaneChart): void => {
                chart["onLegendMouseOver"](chart["categoricalLegendBins"][1])
            },
        },
    ])("clears the author's focus when $interaction", ({ interact }) => {
        const { grapherState, chart } = makeChart(ColumnTypeNames.String, {
            focusedSeriesNames: ["Germany"],
        })
        expect(grapherState.focusArray.seriesNames).toEqual(["Germany"])

        interact(chart)

        expect(grapherState.focusArray.seriesNames).toEqual([])
    })
})

describe("segments", () => {
    it("crops a segment the timeline window cuts and labels it with the full run", () => {
        const { chart } = makeChart(ColumnTypeNames.String, {
            minTime: 2001,
            maxTime: 2005,
        })
        const segments = findRow(chart, "France").placedSegments

        expect(
            segments.map((segment) =>
                segment.kind === "category"
                    ? {
                          isStartCropped: segment.isStartCropped,
                          isEndCropped: segment.isEndCropped,
                      }
                    : undefined
            )
        ).toEqual([
            { isStartCropped: true, isEndCropped: false },
            undefined,
            { isStartCropped: false, isEndCropped: false },
        ])
        expect(segments[0].timeRangeLabel).toEqual("2000 to 2002")
        expect(hasLabel(segments[0])).toBe(true)
    })
})

describe("thumbnail", () => {
    function makeThumbnail(
        config: Partial<GrapherProgrammaticInterface> = {}
    ): SwimlaneChart {
        return makeChart(ColumnTypeNames.String, {
            variant: GrapherVariant.Thumbnail,
            bounds: new Bounds(0, 0, 300, 160),
            ...config,
        }).chart
    }

    it("lays out a row for every entity and the legend, without segment labels", () => {
        const chart = makeThumbnail()

        expect(chart["categoricalLegendState"]).toBeDefined()
        for (const entityName of ["France", "Germany"]) {
            const segments = findRow(chart, entityName).placedSegments
            expect(segments).not.toHaveLength(0)
            expect(segments.map(hasLabel)).toEqual(segments.map(() => false))
        }
    })

    it("ends the x-axis endpoint labels on the last time", () => {
        const chart = makeThumbnail()

        expect(
            chart.xAxis.endpointTickLabels.map((tick) => tick.formattedValue)
        ).toEqual(["2000", "2005"])
    })

    it("drops the legend but keeps the rows with minimal labeling", () => {
        const chart = makeThumbnail({ useMinimalLabeling: true })

        expect(chart["categoricalLegendState"]).toBeUndefined()
        expect(chart["ordinalLegendState"]).toBeUndefined()
        expect(findRow(chart, "France").placedSegments).not.toHaveLength(0)
        expect(findRow(chart, "Germany").placedSegments).not.toHaveLength(0)
    })

    it("still labels segments and every year, but not the axis end, outside the thumbnail variant", () => {
        const { chart } = makeChart(ColumnTypeNames.String)

        expect(hasLabel(findRow(chart, "France").placedSegments[0])).toBe(true)
        expect(
            chart.xAxis.tickLabels.map((tick) => tick.formattedValue)
        ).toEqual(["2000", "2001", "2002", "2003", "2004", "2005"])
    })
})

describe("annotations", () => {
    it("places an entity's annotation in its row only", () => {
        const { chart } = makeChart(ColumnTypeNames.String, {}, [
            {
                text: "Fifth Republic",
                entityNames: ["France"],
                timeScope: "all",
            },
        ])

        expect(findRow(chart, "France").annotationPosition).toBeDefined()
        expect(findRow(chart, "Germany").annotationPosition).toBeUndefined()
    })
})
