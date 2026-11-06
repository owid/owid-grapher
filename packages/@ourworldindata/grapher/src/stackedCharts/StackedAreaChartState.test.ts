import { expect, it, describe } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    IndicatorAnnotation,
    SeriesStrategy,
} from "@ourworldindata/types"
import { StackedAreaChartState } from "./StackedAreaChartState.js"

describe("entity annotations", () => {
    const entityAnnotation = (
        text: string,
        entityName: string
    ): IndicatorAnnotation => ({
        text,
        entityNames: [entityName],
        timeScope: "all",
    })

    const annotationTextsBySeries = (
        chartState: StackedAreaChartState
    ): Record<string, string | undefined> =>
        Object.fromEntries(
            chartState.series.map((series) => [
                series.seriesName,
                series.entityAnnotation?.text,
            ])
        )

    it("gives the series of an annotated entity its annotation in entity strategy", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa", "fra", "fra"],
                year: [2000, 2001, 2000, 2001],
                gdp: [100, 200, 300, 400],
            },
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    annotations: [entityAnnotation("usa note", "usa")],
                },
            ]
        )
        const chartState = new StackedAreaChartState({
            manager: {
                table,
                yColumnSlugs: ["gdp"],
                selection: ["usa", "fra"],
                seriesStrategy: SeriesStrategy.entity,
            },
        })

        expect(annotationTextsBySeries(chartState)).toEqual({
            usa: "usa note",
            fra: undefined,
        })
    })

    it("gives each series its own column's annotation in column strategy", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa"],
                year: [2000, 2001],
                gdp: [100, 200],
                pop: [10, 20],
            },
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    annotations: [entityAnnotation("gdp note", "usa")],
                },
                {
                    slug: "pop",
                    type: ColumnTypeNames.Numeric,
                    annotations: [entityAnnotation("pop note", "usa")],
                },
            ]
        )
        const chartState = new StackedAreaChartState({
            manager: {
                table,
                yColumnSlugs: ["gdp", "pop"],
                selection: ["usa"],
                seriesStrategy: SeriesStrategy.column,
            },
        })

        expect(annotationTextsBySeries(chartState)).toEqual({
            gdp: "gdp note",
            pop: "pop note",
        })
    })
})
