import { describe, expect, it } from "vitest"

import {
    buildScatterPoints,
    buildTrajectory,
    getLatestValueUpTo,
    getSliderYears,
    getValueInYear,
} from "./scatterData.js"
import type { IndicatorData, IndicatorSeries } from "./types.js"

const series: IndicatorSeries = {
    years: [2000, 2005, 2010],
    values: [1, 2, 3],
}

function makeIndicator(
    entries: Record<string, IndicatorSeries>,
    maxYear = 2010
): IndicatorData {
    return {
        byEntity: new Map(Object.entries(entries)),
        metadata: { name: "", attributions: [], minYear: 2000, maxYear },
    }
}

describe(getValueInYear, () => {
    it("returns the value for the exact year only", () => {
        expect(getValueInYear(series, 2005)).toEqual({ value: 2, year: 2005 })
        expect(getValueInYear(series, 2006)).toBeUndefined()
    })
})

describe(getLatestValueUpTo, () => {
    it("prefers the exact year", () => {
        expect(getLatestValueUpTo(series, 2005, 5)).toEqual({
            value: 2,
            year: 2005,
        })
    })

    it("falls back to the most recent value within the tolerance", () => {
        expect(getLatestValueUpTo(series, 2008, 5)).toEqual({
            value: 2,
            year: 2005,
        })
    })

    it("returns nothing when the last value is too old", () => {
        expect(getLatestValueUpTo(series, 2016, 5)).toBeUndefined()
    })

    it("never looks into the future", () => {
        expect(getLatestValueUpTo(series, 1999, 5)).toBeUndefined()
    })
})

describe(buildScatterPoints, () => {
    const democracy = makeIndicator({
        France: { years: [2009, 2010], values: [0.8, 0.81] },
        India: { years: [2010], values: [0.5] },
        // No democracy score in 2010
        Chad: { years: [2009], values: [0.1] },
    })
    const indicator = makeIndicator({
        France: { years: [2007], values: [30_000] },
        // Value too old for 2010 with a 5-year window
        India: { years: [2004], values: [1_000] },
        Chad: { years: [2010], values: [800] },
    })

    it("pairs each country's democracy score with a recent indicator value", () => {
        const points = buildScatterPoints({
            democracy,
            indicator,
            year: 2010,
            tolerance: 5,
        })
        expect(points).toHaveLength(1)
        expect(points[0]).toMatchObject({
            entityName: "France",
            continent: "Europe",
            democracy: { value: 0.81, year: 2010 },
            indicator: { value: 30_000, year: 2007 },
        })
    })

    it("attaches population when given", () => {
        const population = makeIndicator({
            France: { years: [2008], values: [64_000_000] },
        })
        const [point] = buildScatterPoints({
            democracy,
            indicator,
            population,
            year: 2010,
            tolerance: 5,
        })
        expect(point.population).toBe(64_000_000)
    })
})

describe(getSliderYears, () => {
    it("runs from the start year to the last democracy year", () => {
        expect(getSliderYears(makeIndicator({}, 2012), 2010)).toEqual([
            2010, 2011, 2012,
        ])
    })
})

describe(buildTrajectory, () => {
    it("follows one country year by year, skipping years without a pair", () => {
        const democracy = makeIndicator({
            France: {
                years: [2000, 2001, 2002, 2003],
                values: [0.7, 0.71, 0.72, 0.73],
            },
        })
        const indicator = makeIndicator({
            France: { years: [2000, 2002], values: [10, 12] },
        })
        const path = buildTrajectory({
            democracy,
            indicator,
            entityName: "France",
            fromYear: 2000,
            toYear: 2003,
            tolerance: 1,
        })
        expect(path.map((p) => p.year)).toEqual([2000, 2001, 2002, 2003])
        expect(path.map((p) => p.indicator.value)).toEqual([10, 10, 12, 12])
    })

    it("is empty for an unknown country", () => {
        expect(
            buildTrajectory({
                democracy: makeIndicator({}),
                indicator: makeIndicator({}),
                entityName: "Atlantis",
                fromYear: 2000,
                toYear: 2001,
                tolerance: 5,
            })
        ).toEqual([])
    })
})
