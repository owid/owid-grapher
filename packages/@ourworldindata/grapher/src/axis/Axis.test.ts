import { expect, it, describe } from "vitest"
import * as R from "remeda"

import { HorizontalAxis } from "../axis/Axis"
import {
    ScaleType,
    AxisConfigInterface,
    ColumnTypeNames,
} from "@ourworldindata/types"
import {
    OwidTable,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { AxisConfig } from "./AxisConfig"
import {
    AxisAlign,
    dayjs,
    convertDateToDaysSinceEpoch,
    convertDaysSinceEpochToDate,
} from "@ourworldindata/utils"

it("can create an axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })
    const axis = new HorizontalAxis(axisConfig)
    expect(axis.domain).toEqual([0, 100])

    axis.range = [0, 200]
    const ticks = axis.getTickValues()
    expect(ticks.length).toBeGreaterThan(1)
})

it("can assign a column to an axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })
    const table = SynthesizeGDPTable()
    const axis = new HorizontalAxis(axisConfig)
    axis.formatColumn = table.get("GDP")
    axis.range = [0, 200]

    const ticks = axis.getTickValues()
    expect(ticks.length).toBeGreaterThan(1)
})

it("respects minSize unless hidden", () => {
    const config: AxisConfigInterface = {
        min: 0,
        max: 100,
    }
    const { size } = new AxisConfig(config).toHorizontalAxis()
    const configWithMinSize: AxisConfigInterface = {
        ...config,
        minSize: size + 10,
    }
    const axisWithMinSize = new AxisConfig(configWithMinSize).toHorizontalAxis()
    expect(axisWithMinSize.size).toEqual(size + 10)

    const hiddenAxis = new AxisConfig({
        ...configWithMinSize,
        hideAxis: true,
    }).toHorizontalAxis()
    expect(hiddenAxis.size).toEqual(0)
})

it("respects maxTicks parameter", () => {
    const config: AxisConfigInterface = {
        min: 0,
        max: 100,
        maxTicks: 10,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 500]

    const axisWithLessTicks = new AxisConfig({
        ...config,
        maxTicks: 1,
    }).toVerticalAxis()

    expect(axis.getTickValues().length).toBeGreaterThan(
        axisWithLessTicks.getTickValues().length
    )
})

it("respects nice parameter", () => {
    const config: AxisConfigInterface = {
        min: 0.0001,
        max: 99.9999,
        maxTicks: 2,
        nice: true,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 300]
    const tickValues = axis.getTickValues()
    expect(tickValues[0].value).toEqual(0)
    expect(R.last(tickValues)?.value).toEqual(100)
})

it("doesn't add 'nice' ticks to eagerly", () => {
    const config: AxisConfigInterface = {
        min: 0.0001,
        max: 90.0001,
        maxTicks: 10,
        nice: true,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 300]
    const tickValues = axis.getTickValues()
    expect(tickValues[0].value).toEqual(0)
    expect(R.last(tickValues)?.value).toEqual(90)
})

it("creates compact labels", () => {
    const config: AxisConfigInterface = {
        min: 1000,
        max: 4000,
        maxTicks: 3,
        tickFormattingOptions: { numberAbbreviation: "short" },
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 500]
    axis.formatColumn = SynthesizeGDPTable().get("GDP")
    const { tickLabels } = axis
    expect(tickLabels.length).toBeGreaterThan(0)
    expect(
        tickLabels.every((tickLabel) => tickLabel.formattedValue.endsWith("k"))
    ).toBeTruthy()
})

it("shows labelled ticks even when the domain doesn't span nice log values", () => {
    const config: AxisConfigInterface = {
        min: 11000,
        max: 16000,
        scaleType: ScaleType.log,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 200]

    const ticks = axis.getTickValues()
    const labelledTicks = ticks.filter((t) => !t.gridLineOnly)

    // We should have at least 2 labelled ticks
    expect(labelledTicks.length).toBeGreaterThanOrEqual(2)
})

describe("singleValueAxisPointAlign", () => {
    const testAlign = (
        align: AxisAlign | undefined,
        expected: number
    ): void => {
        const config: AxisConfigInterface = {
            min: 0,
            max: 0,
            singleValueAxisPointAlign: align,
        }
        const axis = new AxisConfig(config).toVerticalAxis()
        axis.range = [0, 500]
        expect(axis.place(-1)).toEqual(expected)
        expect(axis.place(0)).toEqual(expected)
        expect(axis.place(1)).toEqual(expected)
    }
    it("aligns to start", () => testAlign(AxisAlign.start, 0))
    it("aligns to middle", () => testAlign(AxisAlign.middle, 250))
    it("aligns to end", () => testAlign(AxisAlign.end, 500))
    it("defaults to middle", () => testAlign(undefined, 250))
})

describe("tick labels", () => {
    // see https://github.com/owid/owid-grapher/issues/1267
    it("includes sufficient decimal places for small values", () => {
        const config: AxisConfigInterface = {
            min: 0,
            max: 0.0004,
        }
        const axis = new AxisConfig(config).toHorizontalAxis()
        axis.range = [0, 500]
        // we need to set a formatColumn, otherwise the tick labels are not formatted at all
        axis.formatColumn = SynthesizeFruitTable().get("Fruit")

        const formattedTickLabels = axis.tickLabels.map((l) => l.formattedValue)
        expect(formattedTickLabels).toEqual([
            "0",
            "0.00005",
            "0.0001",
            "0.00015",
            "0.0002",
            "0.00025",
            "0.0003",
            "0.00035",
        ])
    })
})

describe("manual ticks", () => {
    const defaultConfig: AxisConfigInterface = {
        ticks: [
            { value: -1, priority: 1 },
            { value: -Infinity, priority: 1 },
            { value: 49.5, priority: 1 },
            { value: 99, priority: 2 },
            { value: Infinity, priority: 1 },
        ],
    }
    const defaultAxis = new AxisConfig(defaultConfig, {
        fontSize: 16,
    }).toHorizontalAxis()
    defaultAxis.domain = [0, 100]
    defaultAxis.range = [0, 300]
    defaultAxis.hideFractionalTicks = true // should have no effect

    it("hides manual ticks outside the axis domain", () => {
        expect(
            defaultAxis.getTickValues().map((tick) => tick.value)
        ).not.toContain(-1)
    })

    it("includes manually specified ticks", () => {
        expect(defaultAxis.getTickValues().map((tick) => tick.value)).toEqual(
            expect.arrayContaining([49.5, 99])
        )
    })

    it("replaces ±infinity with min/max of the data", () => {
        expect(defaultAxis.getTickValues().map((tick) => tick.value)).toEqual(
            expect.arrayContaining([0, 100])
        )
    })

    it("doesn't generate any automatic ticks", () => {
        expect(
            defaultAxis.getTickValues().map((tick) => tick.value)
        ).toHaveLength(4)
    })

    it("hides tick labels that overlap", () => {
        expect(
            defaultAxis.tickLabels.map((label) => label.value)
        ).not.toContain(99)
    })
})

describe("for months", () => {
    function makeMonthlyTimeAxis(
        min: string,
        max: string,
        maxTicks?: number
    ): HorizontalAxis {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        const table = new OwidTable({ entityName: ["usa"], month: [0] }, [
            { slug: "month", type: ColumnTypeNames.Month },
        ])
        const axis = new HorizontalAxis(
            new AxisConfig({
                scaleType: ScaleType.linear,
                min: day(min),
                max: day(max),
                ...(maxTicks !== undefined ? { maxTicks } : {}),
            })
        )
        axis.formatColumn = table.get("month")
        axis.hideFractionalTicks = true
        axis.range = [0, 800]
        return axis
    }

    it("places monthly time-axis ticks on first-of-month, January-anchored boundaries", () => {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        const axis = makeMonthlyTimeAxis("2020-01-01", "2022-12-01")

        const values = axis.getTickValues().map((tick) => tick.value)

        // every tick lands on the first of a month...
        for (const value of values)
            expect(convertDaysSinceEpochToDate(value).date()).toBe(1)
        // ...and year boundaries are always on the grid regardless of the step
        expect(values).toContain(day("2021-01-01"))
        expect(values).toContain(day("2022-01-01"))
    })

    it("drops repeated years on a sub-year monthly axis, keeping months and Januaries", () => {
        const labels = makeMonthlyTimeAxis(
            "2020-03-01",
            "2022-11-01",
            8
        ).tickLabels.map((tick) => tick.formattedValue)

        // no bare year: every label is a month, optionally with a year
        for (const label of labels)
            expect(label).toMatch(/^[A-Z][a-z]{2}( \d{4})?$/)
        // the year rides along on each January
        expect(labels).toContain("Jan 2021")
        expect(labels).toContain("Jan 2022")
        // ...but not on the intervening months
        expect(labels).toContain("Jul")
    })

    it("labels a yearly-cadence monthly axis with bare years only", () => {
        const labels = makeMonthlyTimeAxis(
            "2000-01-01",
            "2020-01-01",
            6
        ).tickLabels.map((tick) => tick.formattedValue)

        expect(labels.length).toBeGreaterThan(1)
        for (const label of labels) expect(label).toMatch(/^\d{4}$/)
    })

    it("keeps per-value labels when a monthly axis has author-supplied ticks", () => {
        // Custom ticks (as stacked bars / slope / sparkline set) get thinned by
        // overlap-hiding after labeling, so the year-suppression is skipped and every
        // label keeps its year — even same-year ticks.
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        const table = new OwidTable({ entityName: ["usa"], month: [0] }, [
            { slug: "month", type: ColumnTypeNames.Month },
        ])
        const axis = new HorizontalAxis(
            new AxisConfig({
                scaleType: ScaleType.linear,
                min: day("2020-01-01"),
                max: day("2020-11-01"),
                ticks: [
                    { value: day("2020-01-01"), priority: 2 },
                    { value: day("2020-06-01"), priority: 2 },
                    { value: day("2020-11-01"), priority: 2 },
                ],
            })
        )
        axis.formatColumn = table.get("month")
        axis.range = [0, 800]

        const labels = axis.tickLabels.map((tick) => tick.formattedValue)
        expect(labels).toEqual(["Jan 2020", "Jun 2020", "Nov 2020"])
    })

    it("labels every band value with month + year on a discrete monthly axis", () => {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        const bandValues = ["2020-01-01", "2020-04-01", "2020-07-01"].map(day)
        const table = new OwidTable({ entityName: ["usa"], month: [0] }, [
            { slug: "month", type: ColumnTypeNames.Month },
        ])
        const axis = new HorizontalAxis(
            new AxisConfig({
                scaleType: ScaleType.linear,
                min: bandValues[0],
                max: bandValues[bandValues.length - 1],
                bandValues,
            })
        )
        axis.formatColumn = table.get("month")
        axis.range = [0, 800]

        // one tick per band value, labeled with the column's full month + year format
        expect(axis.tickLabels.map((t) => t.formattedValue)).toEqual([
            "Jan 2020",
            "Apr 2020",
            "Jul 2020",
        ])
    })

    it("thins a discrete monthly axis to a uniform cadence (no ragged gaps)", () => {
        const monthlyDomain = (
            startYear: number,
            endYear: number
        ): number[] => {
            const values: number[] = []
            for (let y = startYear; y <= endYear; y++)
                for (let m = 1; m <= 12; m++)
                    values.push(
                        convertDateToDaysSinceEpoch(
                            dayjs.utc(`${y}-${String(m).padStart(2, "0")}-01`)
                        )
                    )
            return values
        }
        const monthIndex = (value: number): number => {
            const d = convertDaysSinceEpochToDate(value)
            return d.year() * 12 + d.month()
        }
        const table = new OwidTable({ entityName: ["usa"], month: [0] }, [
            { slug: "month", type: ColumnTypeNames.Month },
        ])

        const bandValues = monthlyDomain(2016, 2023)
        const tickCountAt = (width: number): number => {
            const axis = new HorizontalAxis(
                new AxisConfig({
                    scaleType: ScaleType.linear,
                    min: bandValues[0],
                    max: bandValues[bandValues.length - 1],
                    bandValues,
                })
            )
            axis.formatColumn = table.get("month")
            axis.range = [0, width]

            const months = axis.tickLabels
                .map((label) => monthIndex(label.value))
                .sort((a, b) => a - b)
            const gaps = months.slice(1).map((m, i) => m - months[i])
            // every gap identical → a single uniform tier, never ragged (0 gaps
            // when only one tick survives)
            expect(new Set(gaps).size).toBeLessThanOrEqual(1)
            return months.length
        }

        const narrow = tickCountAt(120)
        const wide = tickCountAt(2000)
        expect(wide).toBeGreaterThan(1) // a wide axis shows a real cadence
        expect(wide).toBeGreaterThanOrEqual(narrow) // wider fits at least as many
    })

    it("falls back to overlap-hiding when no evenly-spaced option fits on a daily band axis", () => {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        // Irregular dates — no Mondays, no first-of-month — so the only
        // evenly-spaced labeling option is labeling every value
        const bandValues = [
            "2020-03-03",
            "2020-03-06",
            "2020-03-07",
            "2020-03-12",
            "2020-03-13",
            "2020-03-17",
            "2020-03-20",
            "2020-03-26",
        ].map(day)
        const table = new OwidTable({ entityName: ["usa"], day: [0] }, [
            { slug: "day", type: ColumnTypeNames.Day },
        ])
        const axis = new HorizontalAxis(
            new AxisConfig({
                scaleType: ScaleType.linear,
                min: bandValues[0],
                max: bandValues[bandValues.length - 1],
                bandValues,
            })
        )
        axis.formatColumn = table.get("day")
        axis.range = [0, 120] // far too narrow to label every value

        // labeling every value does not fit, so the axis greedily
        // drops overlapping labels instead of rendering them all
        const labels = axis.tickLabels
        expect(labels.length).toBeGreaterThan(0)
        expect(labels.length).toBeLessThan(bandValues.length)
    })

    it("keeps monthly ticks aligned when min/max are not month boundaries", () => {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        const min = day("2020-01-15")
        const max = day("2022-12-20")

        const axis = makeMonthlyTimeAxis("2020-01-15", "2022-12-20")
        const values = axis.getTickValues().map((tick) => tick.value)

        expect(values.length).toBeGreaterThan(0)
        for (const value of values)
            expect(convertDaysSinceEpochToDate(value).date()).toBe(1)
        // at least one generated tick falls in the actual requested range
        expect(values.some((value) => value >= min && value <= max)).toBe(true)
    })

    it("keeps January boundaries on the grid across sparse and dense cadences", () => {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))

        const sparse = makeMonthlyTimeAxis("2020-01-01", "2022-12-01", 4)
            .getTickValues()
            .map((tick) => tick.value)
        const dense = makeMonthlyTimeAxis("2020-01-01", "2022-12-01", 20)
            .getTickValues()
            .map((tick) => tick.value)

        for (const values of [sparse, dense]) {
            expect(values).toContain(day("2021-01-01"))
            expect(values).toContain(day("2022-01-01"))
        }
    })

    it("uses sensible month labels when maxTicks is very low", () => {
        const labels = makeMonthlyTimeAxis(
            "2020-01-01",
            "2022-12-01",
            1
        ).tickLabels.map((tick) => tick.formattedValue)

        expect(labels.length).toBeGreaterThanOrEqual(1)
        for (const label of labels)
            expect(label).toMatch(/^(\d{4}|[A-Z][a-z]{2}( \d{4})?)$/)
    })

    it("does not invent missing months on an irregular discrete monthly domain", () => {
        const day = (date: string): number =>
            convertDateToDaysSinceEpoch(dayjs.utc(date))
        const bandValues = [
            day("2020-01-01"),
            day("2020-03-01"),
            day("2020-10-01"),
        ]
        const table = new OwidTable({ entityName: ["usa"], month: [0] }, [
            { slug: "month", type: ColumnTypeNames.Month },
        ])
        const axis = new HorizontalAxis(
            new AxisConfig({
                scaleType: ScaleType.linear,
                min: bandValues[0],
                max: bandValues[bandValues.length - 1],
                bandValues,
            })
        )
        axis.formatColumn = table.get("month")
        axis.range = [0, 800]

        const values = axis.getTickValues().map((tick) => tick.value)
        expect(values).toEqual(bandValues)
    })
})
