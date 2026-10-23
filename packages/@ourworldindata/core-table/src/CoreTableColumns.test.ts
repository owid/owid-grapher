import { expect, it, describe } from "vitest"

import { ColumnTypeNames } from "@ourworldindata/types"
import { convertDateToDaysSinceEpoch, dayjs } from "@ourworldindata/utils"
import { ColumnTypeMap, TimeColumn } from "./CoreTableColumns.js"
import { OwidTable } from "./OwidTable.js"

const day = (iso: string): number => convertDateToDaysSinceEpoch(dayjs.utc(iso))

describe(ColumnTypeNames.Numeric, () => {
    const col = new ColumnTypeMap.Numeric(new OwidTable(), { slug: "test" })

    it("should format correctly for csv", () => {
        const testValue = 12345678.9
        const parsed = col.parse(testValue) as number
        const csvFormatted = col.formatForCsv(parsed)
        expect(csvFormatted).toEqual("12345678.9")
    })
})

describe(ColumnTypeNames.Quarter, () => {
    const col = new ColumnTypeMap.Quarter(new OwidTable(), { slug: "test" })

    it("formats days-since-epoch as quarters", () => {
        // day 0 = EPOCH_DATE = 2020-01-21 (Q1 2020)
        expect(col.formatValue(0)).toEqual("Q1 2020")
        expect(col.formatForCsv(0)).toEqual("2020-Q1")
        // 200 days later = 2020-08-08 (Q3 2020)
        expect(col.formatValue(200)).toEqual("Q3 2020")
        expect(col.formatForCsv(200)).toEqual("2020-Q3")
        // 400 days later = 2021-02-24 (Q1 2021)
        expect(col.formatValue(400)).toEqual("Q1 2021")
        expect(col.formatForCsv(400)).toEqual("2021-Q1")
    })

    it("formats the short timeline label as the quarter's start month", () => {
        // day 0 = 2020-01-21 (Q1 2020) → start month Jan 2020
        expect(col.formatTimeShort(0)).toEqual("Jan 2020")
        // day 200 = 2020-08-08 (Q3 2020) → start month Jul 2020
        expect(col.formatTimeShort(200)).toEqual("Jul 2020")
    })

    it("formats a range from start-quarter start month to end-quarter end month", () => {
        // 2025-02-15 → Q1 2025 (starts Jan)
        // 2026-11-20 → Q4 2026 (ends Dec)
        expect(
            col.formatTimeRange(day("2025-02-15"), day("2026-11-20"))
        ).toEqual("Jan 2025 to Dec 2026")
    })

    it("formats a comparison as the two quarters themselves", () => {
        expect(
            col.formatTimeComparison(day("2025-02-15"), day("2026-11-20"))
        ).toEqual("Q1 2025 vs. Q4 2026")
    })
})

describe(ColumnTypeNames.Decade, () => {
    const col = new ColumnTypeMap.Decade(new OwidTable(), { slug: "test" })

    it("formats representative years as decades", () => {
        expect(col.formatValue(2020)).toEqual("2020s")
        expect(col.formatValue(2025)).toEqual("2020s")
        expect(col.formatForCsv(2025)).toEqual("2020s")
        expect(col.formatValue(-500)).toEqual("500s BCE")
        expect(col.formatValue(-505)).toEqual("510s BCE")
    })
})

describe(ColumnTypeNames.Month, () => {
    const col = new ColumnTypeMap.Month(new OwidTable(), { slug: "test" })

    it("formats days-since-epoch as months", () => {
        // day 0 = EPOCH_DATE = 2020-01-21
        expect(col.formatValue(0)).toEqual("Jan 2020")
        expect(col.formatForCsv(0)).toEqual("2020-01")
        // 400 days later = 2021-02-24
        expect(col.formatValue(400)).toEqual("Feb 2021")
        expect(col.formatForCsv(400)).toEqual("2021-02")
    })
})

describe(ColumnTypeNames.Day, () => {
    const col = new ColumnTypeMap.Day(new OwidTable(), { slug: "test" })

    it("formats days-since-epoch as days", () => {
        // day 0 = EPOCH_DATE = 2020-01-21
        expect(col.formatValue(0)).toEqual("Jan 21, 2020")
        expect(col.formatForCsv(0)).toEqual("2020-01-21")
        // 400 days later = 2021-02-24
        expect(col.formatValue(400)).toEqual("Feb 24, 2021")
        expect(col.formatForCsv(400)).toEqual("2021-02-24")
    })
})

describe(ColumnTypeNames.Week, () => {
    const col = new ColumnTypeMap.Week(new OwidTable(), { slug: "test" })

    it("formats a week as 'Week of <week-start Monday>'", () => {
        // day 0 = EPOCH_DATE = 2020-01-21, a Tuesday in the ISO week
        // that starts on Monday 2020-01-20
        expect(col.formatValue(0)).toEqual("Week of Jan 20, 2020")
        // CSV keeps the machine-readable ISO week
        expect(col.formatForCsv(0)).toEqual("2020-W04")
    })

    it("anchors 'Week of' on the Monday across a year boundary", () => {
        // day -22 = Monday 2019-12-30 (ISO week 1 of 2020)
        expect(col.formatValue(-22)).toEqual("Week of Dec 30, 2019")
        // day -20 = 2020-01-01 falls into the same week
        expect(col.formatValue(-20)).toEqual("Week of Dec 30, 2019")
    })

    it("formats a range as start-week Monday to end-week Sunday", () => {
        // 2026-06-03 (Wed) → week starts Mon 2026-06-01
        // 2026-07-08 (Wed) → week ends Sun 2026-07-12
        expect(
            col.formatTimeRange(day("2026-06-03"), day("2026-07-08"))
        ).toEqual("Jun 1, 2026 to Jul 12, 2026")
    })

    it("formats a comparison as the two weeks themselves", () => {
        expect(
            col.formatTimeComparison(day("2026-06-03"), day("2026-07-08"))
        ).toEqual("Week of Jun 1, 2026 vs. Week of Jul 6, 2026")
    })

    it("formats the short timeline label as the plain week-start date", () => {
        // 2026-06-03 (Wed) → week starts Mon 2026-06-01, no "Week of" prefix
        expect(col.formatTimeShort(day("2026-06-03"))).toEqual("Jun 1, 2026")
    })
})

describe("fixed-length periods", () => {
    const table = new OwidTable()

    type FixedLengthColumnTypeName =
        | ColumnTypeNames.Day
        | ColumnTypeNames.Week
        | ColumnTypeNames.Year
        | ColumnTypeNames.Decade

    const makeColumn = (column: FixedLengthColumnTypeName): TimeColumn =>
        new ColumnTypeMap[column](table, { slug: "t" })

    it.each([
        {
            name: "a day step adds days",
            column: ColumnTypeNames.Day,
            from: day("2021-03-01"),
            count: 2,
            to: day("2021-03-03"),
        },
        {
            name: "a week step keeps the weekday",
            column: ColumnTypeNames.Week,
            from: day("2021-01-12"), // Tuesday
            count: 2,
            to: day("2021-01-26"), // Tuesday
        },
        {
            name: "a backward week step keeps the weekday",
            column: ColumnTypeNames.Week,
            from: day("2021-01-12"), // Tuesday
            count: -1,
            to: day("2021-01-05"), // Tuesday
        },
        {
            name: "a year step adds years",
            column: ColumnTypeNames.Year,
            from: 2000,
            count: 2,
            to: 2002,
        },
        {
            name: "a decade step adds ten years each",
            column: ColumnTypeNames.Decade,
            from: 1950,
            count: 2,
            to: 1970,
        },
    ] as const)("$name", ({ column, from, count, to }) => {
        expect(makeColumn(column).addPeriods(from, count)).toEqual(to)
    })

    it.each([
        {
            name: "days",
            column: ColumnTypeNames.Day,
            from: day("2021-03-01"),
            to: day("2021-03-03"),
            count: 3,
        },
        {
            name: "weeks",
            column: ColumnTypeNames.Week,
            from: day("2021-01-12"),
            to: day("2021-01-26"),
            count: 3,
        },
        {
            name: "years",
            column: ColumnTypeNames.Year,
            from: 2000,
            to: 2003,
            count: 4,
        },
        {
            name: "decades",
            column: ColumnTypeNames.Decade,
            from: 1950,
            to: 1970,
            count: 3,
        },
        {
            name: "a decade that ends before the next one starts",
            column: ColumnTypeNames.Decade,
            from: 1950,
            to: 1959,
            count: 1,
        },
    ] as const)(
        "counts whole periods: $name",
        ({ column, from, to, count }) => {
            expect(makeColumn(column).countPeriods(from, to)).toEqual(count)
        }
    )

    it("lists times at the representative year of each decade", () => {
        const col = makeColumn(ColumnTypeNames.Decade)
        expect(col.getConsecutiveTimes(1955, 1975)).toEqual([1955, 1965, 1975])
    })

    it("lists a single time when the range holds one", () => {
        const col = makeColumn(ColumnTypeNames.Year)
        expect(col.getConsecutiveTimes(2000, 2000)).toEqual([2000])
    })

    it("never lists a time past the end of the range", () => {
        const col = makeColumn(ColumnTypeNames.Week)
        expect(
            col.getConsecutiveTimes(
                day("2021-01-12"), // Tuesday
                day("2021-01-18") // the following Monday
            )
        ).toEqual([day("2021-01-12")])
    })

    describe("getUniformlySpacedTimes", () => {
        it("fills missing years for year columns", () => {
            const col = makeColumn(ColumnTypeNames.Year)
            // GCD of the gaps is 1 (from 2000→2001), so the missing 2002 is filled
            expect(col.getUniformlySpacedTimes([2000, 2001, 2003])).toEqual([
                2000, 2001, 2002, 2003,
            ])
        })

        it("respects a regular multi-year cadence (e.g. every 5 years)", () => {
            const col = makeColumn(ColumnTypeNames.Year)
            // GCD of the gaps is 5
            expect(
                col.getUniformlySpacedTimes([2000, 2005, 2010, 2025])
            ).toEqual([2000, 2005, 2010, 2015, 2020, 2025])
        })

        it("fills one filler per missing week for week columns", () => {
            const col = makeColumn(ColumnTypeNames.Week)
            // weeks are 7 days apart; a gap of 14 means one missing week
            expect(col.getUniformlySpacedTimes([0, 7, 21])).toEqual([
                0, 7, 14, 21,
            ])
        })
    })
})

describe("calendar periods", () => {
    const table = new OwidTable()
    const month = new ColumnTypeMap.Month(table, { slug: "t" })
    const quarter = new ColumnTypeMap.Quarter(table, { slug: "t" })

    it.each([
        {
            name: "forward",
            from: day("2021-03-20"),
            count: 1,
            to: day("2021-04-01"),
        },
        {
            name: "in place",
            from: day("2021-03-20"),
            count: 0,
            to: day("2021-03-01"),
        },
        {
            name: "backward",
            from: day("2021-03-20"),
            count: -1,
            to: day("2021-02-01"),
        },
        {
            name: "in place before the epoch",
            from: day("2019-11-20"),
            count: 0,
            to: day("2019-11-01"),
        },
    ])(
        "snaps a month step $name to the first of the month",
        ({ from, count, to }) => {
            expect(month.addPeriods(from, count)).toEqual(to)
        }
    )

    it.each([
        {
            name: "a month step from January lands on February",
            column: month,
            from: day("2021-01-01"),
            to: day("2021-02-01"),
        },
        {
            name: "a month step from December rolls into the next year",
            column: month,
            from: day("2020-12-01"),
            to: day("2021-01-01"),
        },
        {
            name: "a quarter step from October rolls into the next year",
            column: quarter,
            from: day("2020-10-01"),
            to: day("2021-01-01"),
        },
    ])("$name", ({ column, from, to }) => {
        expect(column.addPeriods(from, 1)).toEqual(to)
        expect(column.countPeriods(from, to)).toEqual(2)
    })

    it("counts a single period when both times fall in the same month", () => {
        expect(
            month.countPeriods(day("2021-03-01"), day("2021-03-20"))
        ).toEqual(1)
    })

    it("lists every month between two times, across months of different lengths", () => {
        expect(
            month.getConsecutiveTimes(day("2021-01-01"), day("2021-04-01"))
        ).toEqual([
            day("2021-01-01"),
            day("2021-02-01"),
            day("2021-03-01"),
            day("2021-04-01"),
        ])
    })

    describe("getUniformlySpacedTimes", () => {
        it("snaps observed days to the first of their month", () => {
            expect(
                month.getUniformlySpacedTimes([
                    day("2021-01-31"),
                    day("2021-02-28"),
                ])
            ).toEqual([day("2021-01-01"), day("2021-02-01")])
        })

        it("collapses two days of the same month into one month", () => {
            expect(
                month.getUniformlySpacedTimes([
                    day("2021-01-05"),
                    day("2021-01-20"),
                ])
            ).toEqual([day("2021-01-01")])
        })

        it("fills one filler per missing month", () => {
            // Jan and Feb present, March missing before April
            const result = month.getUniformlySpacedTimes([
                day("2021-01-01"),
                day("2021-02-01"),
                day("2021-04-01"),
            ])
            expect(result).toEqual([
                day("2021-01-01"),
                day("2021-02-01"),
                day("2021-03-01"), // filler
                day("2021-04-01"),
            ])
        })

        it("respects a regular cadence (e.g. two points per year) without inserting fillers", () => {
            // Two data points per year, 6 months apart
            const input = [
                day("2021-01-01"),
                day("2021-07-01"),
                day("2022-01-01"),
                day("2022-07-01"),
            ]
            expect(month.getUniformlySpacedTimes(input)).toEqual(input)
        })

        it("handles months before the epoch date and across the epoch boundary", () => {
            // EPOCH_DATE is 2020-01-21. Nov 2019, Dec 2019, Feb 2020 (Jan 2020
            // missing) — all around/before the epoch, so month numbers go negative.
            const result = month.getUniformlySpacedTimes([
                day("2019-11-01"),
                day("2019-12-01"),
                day("2020-02-01"),
            ])
            expect(result).toEqual([
                day("2019-11-01"),
                day("2019-12-01"),
                day("2020-01-01"), // filler
                day("2020-02-01"),
            ])
        })

        it("fills one filler per missing quarter", () => {
            // Q1, Q2 and Q4 of 2021 present; Q3 missing
            const result = quarter.getUniformlySpacedTimes([
                day("2021-01-01"), // Q1
                day("2021-04-01"), // Q2
                day("2021-10-01"), // Q4
            ])
            expect(result).toEqual([
                day("2021-01-01"), // Q1
                day("2021-04-01"), // Q2
                day("2021-07-01"), // Q3 filler
                day("2021-10-01"), // Q4
            ])
        })
    })
})

describe(ColumnTypeMap.NumberOrString, () => {
    const col = new ColumnTypeMap.NumberOrString(new OwidTable(), {
        slug: "test",
    })

    it("should format values correctly", () => {
        expect(col.formatValue(null)).toEqual("")
        expect(col.formatValue("")).toEqual("")
        expect(col.formatValue("test")).toEqual("test")
        expect(col.formatValue(1.19)).toEqual("1.19")
        expect(col.formatValue(1.191919)).toEqual("1.19")
    })

    it("should parse values correctly", () => {
        expect(col.parse(1.19)).toEqual(1.19)
        expect(col.parse("1.19")).toEqual(1.19)
        expect(col.parse(-5.62431784101729e-5)).toEqual(-5.62431784101729e-5)
        expect(col.parse("test")).toEqual("test")
    })
})
