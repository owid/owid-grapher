import { expect, it, describe } from "vitest"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { ColumnTypeNames } from "@ourworldindata/types"
import { makeToleranceNotice } from "./ToleranceNotice"

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

describe(makeToleranceNotice, () => {
    it("names the years a value can come from", () => {
        expect(
            makeToleranceNotice({
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
            makeToleranceNotice({
                timeColumn: yearColumn([2010]),
                timeTolerance: 3,
                timeRange: [1990, 2010],
            })
        ).toEqual(
            "Where data for 2010 is unavailable, the value from the closest year between 2007 and 2010 is shown instead."
        )
    })

    it("states the tolerance as a window when the chart covers several times", () => {
        expect(
            makeToleranceNotice({
                timeColumn: yearColumn(),
                timeTolerance: 3,
                timeRange: [1990, 2002],
            })
        ).toEqual(
            "Where data is unavailable, the closest value within 3 years is shown instead."
        )
    })

    it("states the tolerance of a monthly indicator as a window of days", () => {
        expect(
            makeToleranceNotice({
                timeColumn: monthColumn([100]),
                timeTolerance: 90,
                timeRange: [0, 730],
            })
        ).toEqual(
            "Where data is unavailable, the closest value within 90 days is shown instead."
        )
    })

    it("drops the window when the tolerance spans the whole chart", () => {
        expect(
            makeToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 9999,
                timeRange: [1990, 2002],
            })
        ).toEqual(
            "Where data is unavailable, the closest available value is shown instead."
        )
    })

    it("is absent when no tolerance is configured", () => {
        expect(
            makeToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 0,
                timeRange: [1990, 2002],
            })
        ).toBeUndefined()
    })

    it("is absent when the chart covers a single point in time", () => {
        expect(
            makeToleranceNotice({
                timeColumn: yearColumn([2000]),
                timeTolerance: 5,
                timeRange: [2000, 2000],
            })
        ).toBeUndefined()
    })
})
