import { describe, expect, it } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    GRAPHER_CHART_TYPES,
    SortBy,
    SortOrder,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { GrapherProgrammaticInterface } from "../core/Grapher"
import { GrapherState } from "../core/GrapherState"
import { SwimlaneChart } from "./SwimlaneChart"
import { SwimlaneChartState } from "./SwimlaneChartState"
import {
    PlacedSwimlaneSegment,
    PlacedSwimlaneSeries,
} from "./SwimlaneChartConstants"

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
    config: Partial<GrapherProgrammaticInterface> = {}
): { grapherState: GrapherState; chart: SwimlaneChart } {
    const table = new OwidTable(REGIME_ROWS, [
        { slug: "year", type: ColumnTypeNames.Year },
        {
            slug: "regime",
            type: regimeColumnType,
            sort: ["Republic", "Monarchy"],
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
    const bins = chart["ordinalLegendState"]
        ? chart["ordinalLegendBins"]
        : chart["categoricalLegendBins"]
    return bins.map((bin) => bin.text)
}

function hasLabel(segment: PlacedSwimlaneSegment): boolean {
    return "label" in segment && segment.label !== undefined
}

describe("legend", () => {
    it("is a numeric legend for an ordinal indicator, in the indicator's order", () => {
        const { chart } = makeChart(ColumnTypeNames.Ordinal)

        expect(chart["ordinalLegendState"]).toBeDefined()
        expect(chart["categoricalLegendState"]).toBeUndefined()
        expect(findLegendLabels(chart)).toEqual([
            "No data",
            "Republic",
            "Monarchy",
        ])
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
