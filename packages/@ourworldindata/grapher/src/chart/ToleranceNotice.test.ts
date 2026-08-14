import { expect, it, describe } from "vitest"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { ColumnTypeNames, ToleranceStrategy } from "@ourworldindata/types"
import { formatToleranceNotice } from "./ToleranceNotice"

const timeColumnOfType = (
    slug: string,
    type: ColumnTypeNames,
    times: number[] = [0, 1]
): CoreColumn =>
    new OwidTable(
        [
            ["entityName", slug, "gdp"],
            ...times.map((time) => ["France", time, 100]),
        ],
        [
            { slug: "gdp", type: ColumnTypeNames.Numeric },
            { slug, type },
        ]
    ).timeColumn

const yearColumn = (times?: number[]): CoreColumn =>
    timeColumnOfType("year", ColumnTypeNames.Year, times)
const monthColumn = (times?: number[]): CoreColumn =>
    timeColumnOfType("month", ColumnTypeNames.Month, times)

describe(formatToleranceNotice, () => {
    it("names the years a value can come from", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
            })
        ).toEqual(
            "Where data for 2000 is unavailable, the value from the closest year between 1997 and 2003 is shown instead."
        )
    })

    it("clips the window to the years the data covers", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2009]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
            })
        ).toEqual(
            "Where data for 2009 is unavailable, the value from the closest year between 2006 and 2010 is shown instead."
        )
    })

    it("only looks back when the chart shows the last year of the data", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2010]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
            })
        ).toEqual(
            "Where data for 2010 is unavailable, the value from the closest year between 2007 and 2009 is shown instead."
        )
    })

    it("only looks ahead when the chart shows the first year of the data", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([1990]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
            })
        ).toEqual(
            "Where data for 1990 is unavailable, the value from the closest year between 1991 and 1993 is shown instead."
        )
    })

    it("only looks back when the tolerance strategy is backwards", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
                toleranceStrategy: ToleranceStrategy.backwards,
            })
        ).toEqual(
            "Where data for 2000 is unavailable, the value from the closest year between 1997 and 1999 is shown instead."
        )
    })

    it("only looks ahead when the tolerance strategy is forwards", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
                toleranceStrategy: ToleranceStrategy.forwards,
            })
        ).toEqual(
            "Where data for 2000 is unavailable, the value from the closest year between 2001 and 2003 is shown instead."
        )
    })

    it("is absent when a one-directional window has no years to reach", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([1990]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
                toleranceStrategy: ToleranceStrategy.backwards,
            })
        ).toBeUndefined()
    })

    it("names the one year a value can come from where the window leaves just the one", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2010]),
                timeTolerance: 1,
                timeRange: [1990, 2010],
            })
        ).toEqual(
            "Where data for 2010 is unavailable, the value from 2009 is shown instead."
        )
    })

    it("states the tolerance as a window when the chart covers several times", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn(),
                timeTolerance: 3,
                timeRange: [1990, 2002],
            })
        ).toEqual(
            "Where data is unavailable, the closest available value within 3 years is shown instead."
        )
    })

    it("states the tolerance of a monthly indicator as a window of days", () => {
        expect(
            formatToleranceNotice({
                timeColumn: monthColumn([100]),
                timeTolerance: 90,
                timeRange: [0, 730],
            })
        ).toEqual(
            "Where data is unavailable, the closest available value within 90 days is shown instead."
        )
    })

    it("drops the window when the tolerance spans the whole chart", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([1990, 2002]),
                timeTolerance: 9999,
                timeRange: [1990, 2002],
            })
        ).toEqual(
            "Where data is unavailable, the closest available value is shown instead."
        )
    })

    it("names the years even where the tolerance covers all of them", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2022]),
                timeTolerance: 3,
                timeRange: [2019, 2022],
            })
        ).toEqual(
            "Where data for 2022 is unavailable, the value from the closest year between 2019 and 2021 is shown instead."
        )
    })

    it("names the direction of a one-directional tolerance in the plainer sentence", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2000, 2010]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
                toleranceStrategy: ToleranceStrategy.backwards,
            })
        ).toEqual(
            "Where data is unavailable, the closest earlier value within 3 years is shown instead."
        )
    })

    it("is absent when no tolerance is configured", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 0,
                timeRange: [1990, 2002],
            })
        ).toBeUndefined()
    })

    it("is absent when the chart covers a single point in time", () => {
        expect(
            formatToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 5,
                timeRange: [2000, 2000],
            })
        ).toBeUndefined()
    })
})
