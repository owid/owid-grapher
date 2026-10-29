import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import { SlopeChart } from "./SlopeChart"
import { SlopeChartManager } from "./SlopeChartConstants"
import {
    ErrorValueTypes,
    OwidTable,
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    FacetStrategy,
    ScaleType,
    SeriesStrategy,
} from "@ourworldindata/utils"
import { IndicatorAnnotation } from "@ourworldindata/types"
import { SelectionArray } from "../selection/SelectionArray"
import { SlopeChartState } from "./SlopeChartState"

function makeSlopeChart(
    table: OwidTable,
    config: Partial<SlopeChartManager> = {}
): { chartState: SlopeChartState; chart: SlopeChart } {
    const manager: SlopeChartManager = {
        table,
        selection: table.availableEntityNames,
        ...config,
    }
    const chartState = new SlopeChartState({ manager })
    const chart = new SlopeChart({ chartState })
    return { chartState, chart }
}

it("can create a new slope chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const { chart } = makeSlopeChart(table, {
        yColumnSlug: SampleColumnSlugs.Population,
    })
    expect(chart.series.length).toEqual(2)
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        {
            entityCount: 2,
            timeRange: [2000, 2002],
        },
        1,
        1
    )
    const { chart } = makeSlopeChart(table, {
        yColumnSlugs: [SampleColumnSlugs.Fruit],
    })
    expect(chart.series.length).toEqual(1)
    expect(
        chart.series.every(
            (series) =>
                _.isNumber(series.start.value) && _.isNumber(series.end.value)
        )
    ).toBeTruthy()
})

it("can filter points with negative values when using a log scale", () => {
    const table = SynthesizeFruitTableWithNonPositives(
        {
            entityCount: 2,
            timeRange: [2000, 2002],
        },
        1,
        1
    )

    const { chartState } = makeSlopeChart(table, {
        yColumnSlugs: [SampleColumnSlugs.Fruit],
    })
    expect(chartState.allYValues.length).toEqual(4)

    const { chartState: logChartState, chart: logChart } = makeSlopeChart(
        table,
        {
            yColumnSlugs: [SampleColumnSlugs.Fruit],
            yAxisConfig: { scaleType: ScaleType.log },
        }
    )
    expect(logChart.yAxis.domain[0]).toBeGreaterThan(0)
    expect(logChartState.allYValues.length).toEqual(2)
})

describe("series naming in multi-column mode", () => {
    const table = SynthesizeGDPTable()

    it("only displays column name if only one entity is selected and multi entity selection is disabled", () => {
        const { chart } = makeSlopeChart(table, {
            canSelectMultipleEntities: false,
            selection: [table.availableEntityNames[0]],
        })
        expect(chart.series[0].seriesName).not.toContain(" - ")
    })

    it("combines entity and column name if only one entity is selected and multi entity selection is enabled", () => {
        const { chart } = makeSlopeChart(table, {
            canSelectMultipleEntities: true,
            selection: [table.availableEntityNames[0]],
        })
        expect(chart.series[0].seriesName).toContain(" - ")
    })

    it("combines entity and column name if multiple entities are selected and multi entity selection is disabled", () => {
        const { chart } = makeSlopeChart(table, {
            canSelectMultipleEntities: false,
            selection: new SelectionArray(table.availableEntityNames),
        })
        expect(chart.series[0].seriesName).toContain(" - ")
    })
})

describe("colors", () => {
    const table = new OwidTable({
        entityName: ["usa", "canada", "usa", "canada"],
        year: [2000, 2000, 2001, 2001],
        gdp: [100, 200, 200, 300],
        entityColor: ["blue", "red", "blue", "red"],
    })
    const selection = ["usa", "canada"]
    it("can add custom colors", () => {
        const { chart } = makeSlopeChart(table, {
            yColumnSlugs: ["gdp"],
            selection,
        })
        expect(chart.series.map((series) => series.color)).toEqual([
            "blue",
            "red",
        ])
    })

    it("uses column color selections when series strategy is column", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa"],
                year: [2000, 2001],
                gdp: [100, 200],
                entityColor: ["blue", "blue"],
            },
            [{ slug: "gdp", color: "green", type: ColumnTypeNames.Numeric }]
        )

        const { chart } = makeSlopeChart(table, {
            yColumnSlugs: ["gdp"],
            selection,
            seriesStrategy: SeriesStrategy.column,
        })

        expect(chart.series).toHaveLength(1)
        expect(chart.series[0].color).toEqual("green")
    })

    it("can assign colors to selected entities and preserve those colors when selection changes when using a color map", () => {
        const selection = new SelectionArray(["usa", "canada"])
        const { chart } = makeSlopeChart(table.dropColumns(["entityColor"]), {
            yColumnSlugs: ["gdp"],
            selection,
            seriesColorMap: new Map(),
        })
        const series = chart.series
        expect(series).toHaveLength(2)

        selection.deselectEntity("usa")

        const newSeries = chart.series
        expect(newSeries).toHaveLength(1)
        expect(newSeries[0].color).toEqual(series[1].color)
    })

    it("uses variable colors when only one entity selected (even if multiple can be selected with controls)", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa", "canada"],
                year: [2000, 2001, 2000],
                gdp: [100, 200, 100],
                pop: [100, 200, 100],
            },
            [
                { slug: "gdp", color: "green", type: ColumnTypeNames.Numeric },
                { slug: "pop", color: "orange", type: ColumnTypeNames.Numeric },
            ]
        )

        const { chart } = makeSlopeChart(table, {
            yColumnSlugs: ["gdp", "pop"],
            selection: ["usa"],
            seriesStrategy: SeriesStrategy.column,
            facetStrategy: FacetStrategy.entity,
            canSelectMultipleEntities: true,
        })

        expect(chart.series).toHaveLength(2)
        expect(chart.series[0].color).toEqual("green")
        expect(chart.series[1].color).toEqual("orange")
    })

    it("doesn't use variable colors if 2 variables have single entities which are different", () => {
        const table = new OwidTable(
            {
                entityName: ["usa", "usa", "canada", "canada"],
                year: [2000, 2001, 2000, 2001],
                gdp: [
                    100,
                    200,
                    ErrorValueTypes.MissingValuePlaceholder,
                    ErrorValueTypes.MissingValuePlaceholder,
                ],
                pop: [
                    ErrorValueTypes.MissingValuePlaceholder,
                    ErrorValueTypes.MissingValuePlaceholder,
                    100,
                    200,
                ],
            },
            [
                { slug: "gdp", color: "green", type: ColumnTypeNames.Numeric },
                { slug: "pop", color: "orange", type: ColumnTypeNames.Numeric },
            ]
        )

        const { chart } = makeSlopeChart(table, {
            yColumnSlugs: ["gdp", "pop"],
            selection: new SelectionArray(["usa", "canada"]),
            seriesStrategy: SeriesStrategy.column,
            canSelectMultipleEntities: true,
        })

        expect(chart.series).toHaveLength(2)
        expect(chart.series[0].color).not.toEqual("green")
        expect(chart.series[1].color).not.toEqual("orange")
    })
})

describe("annotations", () => {
    const pointAnnotation = (
        text: string,
        time: number,
        entityNames: [string, ...string[]] = ["usa"]
    ): IndicatorAnnotation => ({
        text,
        entityNames,
        timeScope: "point",
        time,
    })

    const rangeAnnotation = (
        text: string,
        startTime: number,
        endTime: number
    ): IndicatorAnnotation => ({
        text,
        entityNames: ["usa"],
        timeScope: "range",
        startTime,
        endTime,
    })

    const makeAnnotatedSlopeChart = ({
        annotations,
        entityNames = ["usa"],
        legacyAnnotation = "",
        ...managerOptions
    }: {
        annotations: IndicatorAnnotation[]
        entityNames?: string[]
        legacyAnnotation?: string
    } & Partial<SlopeChartManager>): {
        chartState: SlopeChartState
        chart: SlopeChart
    } => {
        const years = [2000, 2001, 2002, 2003, 2004]
        const rowCount = entityNames.length * years.length
        const table = new OwidTable(
            {
                entityName: entityNames.flatMap((name) =>
                    years.map(() => name)
                ),
                year: entityNames.flatMap(() => years),
                gdp: entityNames.flatMap(() => [100, 200, 300, 400, 500]),
                "gdp-annotations": _.times(rowCount, () => legacyAnnotation),
            },
            [
                { slug: "gdp", type: ColumnTypeNames.Numeric, annotations },
                { slug: "gdp-annotations", type: ColumnTypeNames.String },
            ]
        )
        return makeSlopeChart(table, {
            yColumnSlugs: ["gdp"],
            selection: entityNames,
            ...managerOptions,
        })
    }

    it("places a point annotation from the middle of the period on the series", () => {
        const chartState = makeAnnotatedSlopeChart({
            annotations: [pointAnnotation("middle", 2002)],
        }).chartState
        expect(
            chartState.series[0].pointAnnotations.map((a) => a.text)
        ).toEqual(["middle"])
    })

    it("includes point annotations on the start and end year and drops those outside the period", () => {
        const chartState = makeAnnotatedSlopeChart({
            annotations: [
                pointAnnotation("before", 1999),
                pointAnnotation("start", 2000),
                pointAnnotation("end", 2004),
                pointAnnotation("after", 2005),
            ],
        }).chartState
        expect(
            chartState.series[0].pointAnnotations.map((a) => a.text)
        ).toEqual(["start", "end"])
    })

    it("places a range annotation that overlaps the period and drops one outside it", () => {
        const chartState = makeAnnotatedSlopeChart({
            annotations: [
                rangeAnnotation("overlapping", 1990, 2002),
                rangeAnnotation("outside", 1990, 1995),
            ],
        }).chartState
        expect(
            chartState.series[0].rangeAnnotations.map((a) => a.text)
        ).toEqual(["overlapping"])
    })

    it("places annotations only on the series of the entity they name", () => {
        const { chartState } = makeAnnotatedSlopeChart({
            annotations: [pointAnnotation("fra only", 2002, ["fra"])],
            entityNames: ["usa", "fra"],
        })
        const pointTextsByEntity = Object.fromEntries(
            chartState.series.map((series) => [
                series.entityName,
                series.pointAnnotations.map((a) => a.text),
            ])
        )
        expect(pointTextsByEntity).toEqual({ usa: [], fra: ["fra only"] })
    })

    describe("label series", () => {
        const annotations = [
            pointAnnotation("point note", 2003),
            rangeAnnotation("range note", 2001, 2002),
        ]

        it("gives the right label the annotation list in time order", () => {
            const { chart } = makeAnnotatedSlopeChart({ annotations })
            expect(chart.rightLabelsSeries[0].annotations).toEqual([
                { heading: "2001 to 2002", text: "range note" },
                { heading: "2003", text: "point note" },
            ])
        })

        it("gives the left label no annotations", () => {
            const { chart } = makeAnnotatedSlopeChart({ annotations })
            expect(chart.leftLabelsSeries[0].annotations).toBeUndefined()
        })

        it("keeps the list but drops the inline text in compact layout", () => {
            const wide = makeAnnotatedSlopeChart({
                annotations,
                legacyAnnotation: "legacy note",
            }).chart
            const compact = makeAnnotatedSlopeChart({
                annotations,
                legacyAnnotation: "legacy note",
                isSemiNarrow: true,
            }).chart
            expect(wide.rightLabelsSeries[0].inlineAnnotation).toBe(
                "legacy note"
            )
            expect(
                compact.rightLabelsSeries[0].inlineAnnotation
            ).toBeUndefined()
            expect(compact.rightLabelsSeries[0].annotations).toHaveLength(2)
        })
    })
})
