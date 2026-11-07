import { describe, expect, it } from "vitest"
import * as _ from "lodash-es"
import { excludeNullish } from "@ourworldindata/utils"
import { OwidTable, numericDefs, yearDef } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    GRAPHER_CHART_TYPES,
    IndicatorAnnotation,
} from "@ourworldindata/types"
import { GrapherState } from "../core/GrapherState"
import { ScatterPlotChartState } from "./ScatterPlotChartState"
import { selectScatterTooltipAnnotationTexts } from "./ScatterUtils"

function makeScatterChartState(
    table: OwidTable,
    { minTime, maxTime }: { minTime: number; maxTime: number }
): ScatterPlotChartState {
    const grapher = new GrapherState({
        chartTypes: [GRAPHER_CHART_TYPES.ScatterPlot],
        xSlug: "x",
        ySlugs: "y",
        sizeSlug: table.has("size") ? "size" : undefined,
        table,
        minTime,
        maxTime,
    })
    return grapher.chartState as ScatterPlotChartState
}

describe(selectScatterTooltipAnnotationTexts, () => {
    function selectTextsForTable(
        table: OwidTable,
        range: { minTime: number; maxTime: number },
        { hasSizeRow = false }: { hasSizeRow?: boolean } = {}
    ): { texts: Map<string, string>; chartState: ScatterPlotChartState } {
        const chartState = makeScatterChartState(table, range)
        const { points } = chartState.series[0]
        const texts = selectScatterTooltipAnnotationTexts({
            chartState,
            rowColumns: [
                chartState.xColumn,
                chartState.yColumn,
                ...(hasSizeRow ? [chartState.sizeColumn] : []),
            ],
            points: excludeNullish(_.uniq([_.first(points), _.last(points)])),
            entityName: "UK",
        })
        return { texts, chartState }
    }

    function selectTexts(
        annotations: {
            x?: IndicatorAnnotation[]
            y?: IndicatorAnnotation[]
        },
        range: { minTime: number; maxTime: number } = {
            minTime: 2000,
            maxTime: 2002,
        }
    ): Map<string, string> {
        const table = new OwidTable(
            [
                ["entityName", "year", "x", "y"],
                ["UK", 2000, 1, 1],
                ["UK", 2001, 2, 2],
                ["UK", 2002, 3, 3],
            ],
            [
                {
                    slug: "x",
                    type: ColumnTypeNames.Numeric,
                    annotations: annotations.x,
                },
                {
                    slug: "y",
                    type: ColumnTypeNames.Numeric,
                    annotations: annotations.y,
                },
                yearDef(),
            ]
        )
        return selectTextsForTable(table, range).texts
    }

    const pointAt = (time: number, text: string): IndicatorAnnotation => ({
        text,
        entityNames: ["UK"],
        timeScope: "point",
        time,
    })
    const allTime = (text: string): IndicatorAnnotation => ({
        text,
        entityNames: ["UK"],
        timeScope: "all",
    })

    it("shows a point annotation at the shown y time under y", () => {
        const texts = selectTexts({ y: [pointAt(2002, "end of y")] })
        expect(texts.get("y")).toEqual("2002: end of y")
        expect(texts.has("x")).toBe(false)
    })

    it("hides a point annotation at an intermediate trajectory time", () => {
        const texts = selectTexts({ y: [pointAt(2001, "middle")] })
        expect(texts.size).toEqual(0)
    })

    it("joins an all-time and a point annotation on one row", () => {
        const texts = selectTexts({
            y: [pointAt(2000, "point"), allTime("all")],
        })
        expect(texts.get("y")).toEqual("2000: point / all")
    })

    it("shows an identical all-time and point text once", () => {
        const texts = selectTexts(
            { y: [allTime("same"), pointAt(2002, "same")] },
            { minTime: 2002, maxTime: 2002 }
        )
        expect(texts.get("y")).toEqual("same")
    })

    it("prefixes point annotations with their time when the row shows a start and an end", () => {
        const texts = selectTexts({
            y: [pointAt(2000, "start"), pointAt(2002, "end"), allTime("all")],
        })
        expect(texts.get("y")).toEqual("2000: start / 2002: end / all")
    })

    it("shows point annotations without a time prefix for a single year", () => {
        const texts = selectTexts(
            { y: [pointAt(2002, "end")] },
            { minTime: 2002, maxTime: 2002 }
        )
        expect(texts.get("y")).toEqual("end")
    })

    it("uses x's own tolerance-resolved time for x annotations", () => {
        const table = new OwidTable(
            [
                ["entityName", "year", "x", "y"],
                ["UK", 2000, 1, null],
                ["UK", 2001, null, 2],
            ],
            [
                {
                    slug: "x",
                    type: ColumnTypeNames.Numeric,
                    display: { tolerance: 1 },
                    annotations: [
                        pointAt(2000, "at resolved time"),
                        pointAt(2001, "at target time"),
                    ],
                },
                {
                    slug: "y",
                    type: ColumnTypeNames.Numeric,
                    display: { tolerance: 1 },
                },
                yearDef(),
            ]
        )
        const { texts, chartState } = selectTextsForTable(table, {
            minTime: 2000,
            maxTime: 2001,
        })
        expect(
            chartState.series[0].points.map((point) => point.time.x)
        ).toEqual([2000, 2000])
        expect(texts.get("x")).toEqual("at resolved time")
    })

    it("uses the point's time for size annotations", () => {
        const table = new OwidTable(
            [
                ["entityName", "year", "x", "y", "size"],
                ["UK", 2001, 1, 1, 10],
            ],
            [
                ...numericDefs("x", "y"),
                {
                    slug: "size",
                    type: ColumnTypeNames.Numeric,
                    annotations: [pointAt(2001, "point annotation on size")],
                },
                yearDef(),
            ]
        )
        const { texts } = selectTextsForTable(
            table,
            { minTime: 2001, maxTime: 2001 },
            { hasSizeRow: true }
        )
        expect(texts.get("size")).toEqual("point annotation on size")
    })
})
