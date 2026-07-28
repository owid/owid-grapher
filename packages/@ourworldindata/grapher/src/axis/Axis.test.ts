import { expect, it, describe } from "vitest"
import * as R from "remeda"

import { HorizontalAxis } from "../axis/Axis"
import {
    ScaleType,
    AxisConfigInterface,
    ColumnTypeNames,
} from "@ourworldindata/types"
import {
    CoreColumn,
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
    Tickmark,
} from "@ourworldindata/utils"

// Day-since-epoch for a "YYYY-MM-DD" date
const day = (date: string): number =>
    convertDateToDaysSinceEpoch(dayjs.utc(date))

/** A horizontal time axis over a column of the given time type */
function makeTimeAxis({
    columnType = ColumnTypeNames.Month,
    min,
    max,
    maxTicks,
    ticks,
    bandValues,
    range = [0, 800],
    hideFractionalTicks = false,
}: {
    columnType?: ColumnTypeNames
    min?: number
    max?: number
    maxTicks?: number
    ticks?: Tickmark[]
    bandValues?: number[]
    range?: [number, number]
    hideFractionalTicks?: boolean
}): HorizontalAxis {
    const slug = "timeValue"
    const table = new OwidTable({ entityName: ["usa"], [slug]: [0] }, [
        { slug, type: columnType },
    ])
    const axis = new HorizontalAxis(
        new AxisConfig({
            scaleType: ScaleType.linear,
            min: min ?? bandValues?.[0],
            max: max ?? (bandValues ? R.last(bandValues) : undefined),
            maxTicks,
            ticks,
            bandValues,
        })
    )
    axis.formatColumn = table.get(slug)
    axis.hideFractionalTicks = hideFractionalTicks
    axis.range = range
    return axis
}

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
        tickFormattingOptions: {
            numberAbbreviation: "short",
            abbreviationThreshold: 1e3,
        },
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

it("keeps abbreviated labels distinguishable on narrow high-magnitude domains", () => {
    // ticks like 10.02M/10.04M need more than the default 3 significant
    // figures, otherwise they'd all render as "10M"
    const config: AxisConfigInterface = {
        min: 10_020_000,
        max: 10_080_000,
        tickFormattingOptions: {
            numberAbbreviation: "short",
            abbreviationThreshold: 1e3,
        },
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 500]
    axis.formatColumn = SynthesizeGDPTable().get("GDP")
    const labels = axis.tickLabels.map((tickLabel) => tickLabel.formattedValue)
    expect(labels).toEqual([
        "$10.02M",
        "$10.03M",
        "$10.04M",
        "$10.05M",
        "$10.06M",
        "$10.07M",
        "$10.08M",
    ])
})

it("keeps log-axis labels at default precision", () => {
    const config: AxisConfigInterface = {
        min: 1e10,
        max: 1e30,
        scaleType: ScaleType.log,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 400]
    axis.formatColumn = SynthesizeGDPTable().get("GDP")
    const labels = axis.tickLabels.map((tickLabel) => tickLabel.formattedValue)
    expect(labels.length).toBeGreaterThan(1)
    expect(labels).toContain("$1,000,000 septillion")
    expect(labels.every((label) => !label.includes("."))).toBeTruthy()
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

describe("axis height", () => {
    const day = (date: string): number =>
        convertDateToDaysSinceEpoch(dayjs.utc(date))

    const timeColumn = (type: ColumnTypeNames, slug: string): CoreColumn =>
        new OwidTable({ entityName: ["usa"], [slug]: [0] }, [
            { slug, type },
        ]).get(slug)

    /**
     * The height given by `HorizontalAxis.height` should match the height of the placed tick labels plus padding and label offset in all cases, or `minSize` if that is larger.
     */
    const heightFromPlacedTickLabels = (axis: HorizontalAxis): number => {
        if (axis.hideAxis) return 0
        const maxTickHeight = axis.tickLabels.length
            ? Math.max(...axis.tickLabels.map((tick) => tick.height))
            : undefined
        const paddedTickHeight = maxTickHeight
            ? maxTickHeight + axis.tickPadding
            : 0
        return Math.max(
            paddedTickHeight + axis.labelOffset,
            axis.config.minSize ?? 0
        )
    }

    const cases: [string, () => HorizontalAxis][] = [
        [
            "a plain linear axis",
            () => new AxisConfig({ min: 0, max: 100 }).toHorizontalAxis(),
        ],
        [
            "a fractional domain, which has no whole-number start tick",
            () => new AxisConfig({ min: 0.3, max: 0.9 }).toHorizontalAxis(),
        ],
        [
            "a log axis",
            () =>
                new AxisConfig({
                    min: 1,
                    max: 10000,
                    scaleType: ScaleType.log,
                }).toHorizontalAxis(),
        ],
        [
            "a degenerate domain, as used before any data has loaded",
            () => new AxisConfig({}).toHorizontalAxis(),
        ],
        [
            "an axis with a label",
            () =>
                new AxisConfig({
                    min: 0,
                    max: 100,
                    label: "A rather long axis label that has to wrap",
                }).toHorizontalAxis(),
        ],
        [
            "a hidden axis with a minSize",
            () =>
                new AxisConfig({
                    min: 0,
                    max: 100,
                    minSize: 200,
                    hideAxis: true,
                }).toHorizontalAxis(),
        ],
        [
            "an axis with author-supplied ticks, all outside the domain",
            () =>
                new AxisConfig({
                    min: 0.5,
                    max: 10.5,
                    ticks: [{ value: 1000, priority: 1 }],
                }).toHorizontalAxis(),
        ],
        [
            "a continuous monthly time axis",
            () => {
                const axis = new AxisConfig({
                    min: day("2020-01-01"),
                    max: day("2022-12-01"),
                }).toHorizontalAxis()
                axis.formatColumn = timeColumn(ColumnTypeNames.Month, "month")
                return axis
            },
        ],
        [
            "a monthly time axis too short to span a month",
            () => {
                const axis = new AxisConfig({
                    min: day("2020-01-01"),
                    max: day("2020-01-08"),
                }).toHorizontalAxis()
                axis.formatColumn = timeColumn(ColumnTypeNames.Month, "month")
                return axis
            },
        ],
        [
            "a discrete monthly band axis",
            () => {
                const bandValues = ["2020-01-01", "2020-04-01"].map(day)
                const axis = new AxisConfig({
                    min: bandValues[0],
                    max: bandValues[1],
                    bandValues,
                }).toHorizontalAxis()
                axis.formatColumn = timeColumn(ColumnTypeNames.Month, "month")
                return axis
            },
        ],
        [
            "a discrete band axis with no bands, as used when there's no data",
            () => {
                const axis = new AxisConfig({
                    bandValues: [],
                }).toHorizontalAxis()
                axis.formatColumn = timeColumn(ColumnTypeNames.Month, "month")
                return axis
            },
        ],
    ]

    for (const [description, makeAxis] of cases) {
        it(`matches the placed tick labels for ${description}`, () => {
            const axis = makeAxis()
            axis.range = [0, 800]
            expect(axis.height).toEqual(heightFromPlacedTickLabels(axis))
        })
    }
})

describe("calendar-aware time ticks", () => {
    it("places monthly time-axis ticks on first-of-month, January-anchored boundaries", () => {
        const axis = makeTimeAxis({
            min: day("2020-01-01"),
            max: day("2022-12-01"),
            hideFractionalTicks: true,
        })

        const values = axis.getTickValues().map((tick) => tick.value)

        // every tick lands on the first of a month...
        for (const value of values)
            expect(convertDaysSinceEpochToDate(value).date()).toBe(1)
        // ...and year boundaries are always on the grid regardless of the step
        expect(values).toContain(day("2021-01-01"))
        expect(values).toContain(day("2022-01-01"))
    })

    it("drops repeated years on a sub-year monthly axis, keeping months and Januaries", () => {
        const labels = makeTimeAxis({
            min: day("2020-03-01"),
            max: day("2021-11-01"),
            maxTicks: 8,
            hideFractionalTicks: true,
        }).tickLabels.map((tick) => tick.formattedValue)

        // no bare year: every label is a month, optionally with a year
        for (const label of labels)
            expect(label).toMatch(/^[A-Z][a-z]{2}( \d{4})?$/)
        // the year rides along on each January
        expect(labels).toContain("Jan 2021")
        // ...but not on the intervening months
        expect(labels).toContain("Jul")
    })

    it("keeps the year on every tick of a half-yearly axis", () => {
        // At a 6-month step, half the ticks are Januaries carrying the year
        // anyway, so all ticks get it for consistency
        const labels = makeTimeAxis({
            min: day("2020-03-01"),
            max: day("2022-11-01"),
            maxTicks: 8,
            hideFractionalTicks: true,
        }).tickLabels.map((tick) => tick.formattedValue)

        for (const label of labels)
            expect(label).toMatch(/^[A-Z][a-z]{2} \d{4}$/)
        expect(labels).toContain("Jul 2021")
    })

    it("labels a yearly-cadence monthly axis with bare years only", () => {
        const labels = makeTimeAxis({
            min: day("2000-01-01"),
            max: day("2020-01-01"),
            maxTicks: 6,
            hideFractionalTicks: true,
        }).tickLabels.map((tick) => tick.formattedValue)

        expect(labels.length).toBeGreaterThan(1)
        for (const label of labels) expect(label).toMatch(/^\d{4}$/)
    })

    it("keeps per-value labels when a monthly axis has author-supplied ticks", () => {
        // Custom ticks (as stacked bars / slope / sparkline set) get thinned by
        // overlap-hiding after labeling, so the year-suppression is skipped and every
        // label keeps its year — even same-year ticks.
        const axis = makeTimeAxis({
            min: day("2020-01-01"),
            max: day("2020-11-01"),
            ticks: [
                { value: day("2020-01-01"), priority: 2 },
                { value: day("2020-06-01"), priority: 2 },
                { value: day("2020-11-01"), priority: 2 },
            ],
        })

        const labels = axis.tickLabels.map((tick) => tick.formattedValue)
        expect(labels).toEqual(["Jan 2020", "Jun 2020", "Nov 2020"])
    })

    it("labels every band value with month + year on a discrete monthly axis", () => {
        const bandValues = ["2020-01-01", "2020-04-01", "2020-07-01"].map(day)
        const axis = makeTimeAxis({ bandValues })

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
                    values.push(day(`${y}-${String(m).padStart(2, "0")}-01`))
            return values
        }
        const monthIndex = (value: number): number => {
            const d = convertDaysSinceEpochToDate(value)
            return d.year() * 12 + d.month()
        }

        const bandValues = monthlyDomain(2016, 2023)
        const tickCountAt = (width: number): number => {
            const axis = makeTimeAxis({ bandValues, range: [0, width] })

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

    it("labels every band value with its quarter on a discrete quarterly axis", () => {
        const bandValues = ["2020-01-01", "2020-04-01", "2020-07-01"].map(day)
        const axis = makeTimeAxis({
            columnType: ColumnTypeNames.Quarter,
            bandValues,
        })

        // one tick per band value, labeled with the column's quarter format
        expect(axis.tickLabels.map((t) => t.formattedValue)).toEqual([
            "Q1 2020",
            "Q2 2020",
            "Q3 2020",
        ])
    })

    it("falls back to overlap-hiding when no evenly-spaced option fits on a daily band axis", () => {
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
        const axis = makeTimeAxis({
            columnType: ColumnTypeNames.Day,
            bandValues,
            range: [0, 120], // far too narrow to label every value
        })

        // labeling every value does not fit, so the axis greedily
        // drops overlapping labels instead of rendering them all
        const labels = axis.tickLabels
        expect(labels.length).toBeGreaterThan(0)
        expect(labels.length).toBeLessThan(bandValues.length)
    })

    it("keeps monthly ticks aligned when min/max are not month boundaries", () => {
        const min = day("2020-01-15")
        const max = day("2022-12-20")

        const axis = makeTimeAxis({ min, max, hideFractionalTicks: true })
        const values = axis.getTickValues().map((tick) => tick.value)

        expect(values.length).toBeGreaterThan(0)
        for (const value of values)
            expect(convertDaysSinceEpochToDate(value).date()).toBe(1)
        // at least one generated tick falls in the actual requested range
        expect(values.some((value) => value >= min && value <= max)).toBe(true)
    })

    it("keeps January boundaries on the grid across sparse and dense cadences", () => {
        const tickValuesAt = (maxTicks: number): number[] =>
            makeTimeAxis({
                min: day("2020-01-01"),
                max: day("2022-12-01"),
                maxTicks,
                hideFractionalTicks: true,
            })
                .getTickValues()
                .map((tick) => tick.value)

        for (const values of [tickValuesAt(4), tickValuesAt(20)]) {
            expect(values).toContain(day("2021-01-01"))
            expect(values).toContain(day("2022-01-01"))
        }
    })

    it("uses sensible month labels when maxTicks is very low", () => {
        const labels = makeTimeAxis({
            min: day("2020-01-01"),
            max: day("2022-12-01"),
            maxTicks: 1,
            hideFractionalTicks: true,
        }).tickLabels.map((tick) => tick.formattedValue)

        expect(labels.length).toBeGreaterThanOrEqual(1)
        for (const label of labels)
            expect(label).toMatch(/^(\d{4}|[A-Z][a-z]{2}( \d{4})?)$/)
    })

    it("does not invent missing months on an irregular discrete monthly domain", () => {
        const bandValues = [
            day("2020-01-01"),
            day("2020-03-01"),
            day("2020-10-01"),
        ]
        const axis = makeTimeAxis({ bandValues })

        const values = axis.getTickValues().map((tick) => tick.value)
        expect(values).toEqual(bandValues)
    })
})
