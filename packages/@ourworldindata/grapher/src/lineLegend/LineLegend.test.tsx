#! /usr/bin/env jest

import { PartialBy } from "@ourworldindata/utils"
import { AxisConfig } from "../axis/AxisConfig"
import {
    LEGEND_ITEM_MIN_SPACING,
    LineLabelSeries,
    LineLegend,
} from "./LineLegend"

const makeAxis = ({
    min = 0,
    max = 100,
    yRange,
}: {
    min?: number
    max?: number
    yRange: [number, number]
}) => {
    const yAxis = new AxisConfig({ min, max }).toVerticalAxis()
    yAxis.range = yRange
    return yAxis
}

const makeSeries = (
    series: PartialBy<LineLabelSeries, "label" | "color">[]
): LineLabelSeries[] =>
    series.map((s) => ({
        label: s.seriesName,
        color: "blue",
        ...s,
    }))

const series = makeSeries([
    {
        seriesName: "Canada",
        yValue: 50,
        annotation: "A country in North America",
    },
    { seriesName: "Mexico", yValue: 20, annotation: "Below Canada" },
])

it("can create a new legend", () => {
    const legend = new LineLegend({
        series,
        yAxis: makeAxis({ yRange: [0, 100] }),
    })

    expect(legend.visibleSeriesNames.length).toEqual(2)
})

describe("dropping labels", () => {
    it("drops labels that don't fit into the available space", () => {
        const lineLegend = new LineLegend({
            series,
            yAxis: makeAxis({ yRange: [0, 50] }),
        })

        // two labels are given, but only one fits
        expect(lineLegend.sizedSeries).toHaveLength(2)
        expect(lineLegend.visibleSeriesNames).toEqual(["Canada"])
    })

    it("prioritises labels based on importance sorting", () => {
        const lineLegend = new LineLegend({
            series,
            yAxis: makeAxis({ yRange: [0, 50] }),
            seriesNamesSortedByImportance: ["Mexico", "Canada"],
        })

        // 'Mexico' is picked since it's given higher importance
        expect(lineLegend.visibleSeriesNames).toEqual(["Mexico"])
    })

    it("skips more important series if they don't fit", () => {
        const series = makeSeries([
            { seriesName: "Canada", yValue: 5 },
            { seriesName: "Mexico", yValue: 20 },
            { seriesName: "Spain", yValue: 40 },
            { seriesName: "Democratic Republic of Congo", yValue: 45 },
        ])

        const lineLegend = new LineLegend({
            series,
            yAxis: makeAxis({ yRange: [0, 50] }),
            maxWidth: 100,
            seriesNamesSortedByImportance: [
                "Mexico",
                "Canada",
                "Democratic Republic of Congo",
                "Spain",
            ],
        })

        // 'Democratic Republic of Congo' is skipped since it doesn't fit
        expect(lineLegend.visibleSeriesNames).toEqual([
            "Mexico",
            "Canada",
            "Spain",
        ])
    })

    it("prioritises to label focused series", () => {
        const seriesWithFocus = series.map((s) => ({
            ...s,
            focus: {
                active: s.seriesName === "Mexico",
                background: s.seriesName !== "Mexico",
            },
        }))

        const lineLegendWithFocus = new LineLegend({
            series: seriesWithFocus,
            yAxis: makeAxis({ yRange: [0, 50] }),
        })

        // 'Mexico' is picked since it's focused
        expect(lineLegendWithFocus.visibleSeriesNames).toEqual(["Mexico"])
    })

    it("uses all available space", () => {
        const series = makeSeries([
            { seriesName: "Canada", yValue: 5 },
            { seriesName: "Mexico", yValue: 20 },
            { seriesName: "Spain", yValue: 40 },
            { seriesName: "France", yValue: 45 },
        ])

        const yRange: [number, number] = [0, 50]
        const lineLegend = new LineLegend({
            series,
            yAxis: makeAxis({ yRange }),
        })

        // 'Spain' is dropped since it doesn't fit
        expect(lineLegend.visibleSeriesNames).toEqual([
            "Canada",
            "Mexico",
            "France",
        ])

        // verify that we can't fit 'Spain' into the available space
        const droppedLabel = lineLegend.sizedSeries.find(
            (series) => series.seriesName === "Spain"
        )!
        const droppedLabelHeight = droppedLabel.height + LEGEND_ITEM_MIN_SPACING
        const availableHeight = yRange[1] - yRange[0]
        const remainingHeight = availableHeight - lineLegend.visibleSeriesHeight
        expect(remainingHeight).toBeLessThan(droppedLabelHeight)
    })

    it("picks labels from the edges", () => {
        const series = makeSeries([
            { seriesName: "Canada", yValue: 10 },
            { seriesName: "Mexico", yValue: 50 },
            { seriesName: "France", yValue: 90 },
        ])

        const lineLegend = new LineLegend({
            series,
            yAxis: makeAxis({ yRange: [0, 40] }),
        })

        expect(lineLegend.visibleSeriesNames).toEqual(["Canada", "France"])
    })

    it("picks labels in a balanced way", () => {
        const series = makeSeries([
            { seriesName: "Canada", yValue: 10 },
            { seriesName: "Mexico", yValue: 12 },
            { seriesName: "Brazil", yValue: 14 },
            { seriesName: "Argentina", yValue: 15 },
            { seriesName: "Chile", yValue: 60 },
            { seriesName: "Peru", yValue: 90 },
        ])

        const lineLegend = new LineLegend({
            series,
            yAxis: makeAxis({ yRange: [0, 50] }),
        })

        // drops 'Mexico', 'Brazil' and 'Argentina' since they're close to each other
        expect(lineLegend.visibleSeriesNames).toEqual([
            "Canada",
            "Chile",
            "Peru",
        ])
    })
})
