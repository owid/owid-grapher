import { describe, expect, it } from "vitest"
import {
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    OwidTableSlugs,
} from "@ourworldindata/types"
import {
    isValuesJsonValid,
    findClosestTimeInArray,
    makeDimensionValuesForTimeDirect,
} from "./GrapherValuesJson"
import { OwidTable } from "@ourworldindata/core-table"

const makeDataPoint = (
    columnSlug: string,
    value: number,
    time: number
): GrapherValuesJsonDataPoint => ({
    columnSlug,
    value,
    time,
    formattedValueShort: String(value),
    formattedTime: String(time),
})

const makeValidValuesJson = (): GrapherValuesJson => ({
    entityName: "Testland",
    startTime: 2000,
    endTime: 2020,
    columns: {
        y: { name: "Y" },
        x: { name: "X" },
    },
    startValues: {
        y: [makeDataPoint("y", 1, 2000)],
        x: makeDataPoint("x", 10, 2000),
    },
    endValues: {
        y: [makeDataPoint("y", 2, 2020)],
        x: makeDataPoint("x", 20, 2020),
    },
    source: "Example source",
})

describe(isValuesJsonValid, () => {
    it("accepts a complete values json", () => {
        expect(isValuesJsonValid(makeValidValuesJson())).toBe(true)
    })

    it("accepts missing start values when start time is undefined", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.startTime = undefined
        valuesJson.startValues = undefined

        expect(isValuesJsonValid(valuesJson)).toBe(true)
    })

    it("rejects values json without column metadata", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.columns = {}

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when a referenced column is missing", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.columns = { x: { name: "X" } }

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when a y data point is missing", () => {
        const valuesJson = makeValidValuesJson()
        const missingPoint = undefined as unknown as GrapherValuesJsonDataPoint
        valuesJson.endValues = {
            ...valuesJson.endValues,
            y: [missingPoint],
        }

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when a y data point lacks a value", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.endValues = {
            ...valuesJson.endValues,
            y: [{ columnSlug: "y" }],
        }

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when an x data point lacks a value", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.endValues = {
            ...valuesJson.endValues,
            x: { columnSlug: "x" },
        } as typeof valuesJson.endValues

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when start values are missing but start time exists", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.startValues = undefined

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when end values are missing but end time exists", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.endValues = undefined

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })

    it("rejects values json when end values are missing even without end time", () => {
        const valuesJson = makeValidValuesJson()
        valuesJson.endTime = undefined
        valuesJson.endValues = undefined

        expect(isValuesJsonValid(valuesJson)).toBe(false)
    })
})

describe(findClosestTimeInArray, () => {
    it("returns undefined for empty array", () => {
        expect(findClosestTimeInArray([], 2000)).toBeUndefined()
    })

    it("returns the only element for single-element array", () => {
        expect(findClosestTimeInArray([2000], 1990)).toBe(2000)
        expect(findClosestTimeInArray([2000], 2000)).toBe(2000)
        expect(findClosestTimeInArray([2000], 2010)).toBe(2000)
    })

    it("returns first element when target is before all times", () => {
        expect(findClosestTimeInArray([2000, 2010, 2020], 1990)).toBe(2000)
    })

    it("returns last element when target is after all times", () => {
        expect(findClosestTimeInArray([2000, 2010, 2020], 2030)).toBe(2020)
    })

    it("returns exact match when target exists in array", () => {
        expect(findClosestTimeInArray([2000, 2010, 2020], 2010)).toBe(2010)
    })

    it("returns closer element when target is between two times", () => {
        // 2004 is closer to 2000 than to 2010
        expect(findClosestTimeInArray([2000, 2010, 2020], 2004)).toBe(2000)
        // 2006 is closer to 2010 than to 2000
        expect(findClosestTimeInArray([2000, 2010, 2020], 2006)).toBe(2010)
    })

    it("returns earlier element when equidistant", () => {
        // 2005 is equidistant from 2000 and 2010; should return 2000
        expect(findClosestTimeInArray([2000, 2010, 2020], 2005)).toBe(2000)
    })

    it("works with negative times", () => {
        expect(findClosestTimeInArray([-100, 0, 100], -50)).toBe(-100)
        expect(findClosestTimeInArray([-100, 0, 100], -49)).toBe(0)
    })
})

describe(makeDimensionValuesForTimeDirect, () => {
    const makeTestTable = (): OwidTable => {
        return new OwidTable([
            {
                [OwidTableSlugs.entityName]: "France",
                [OwidTableSlugs.time]: 2000,
                gdp: 1000,
                population: 60,
            },
            {
                [OwidTableSlugs.entityName]: "France",
                [OwidTableSlugs.time]: 2010,
                gdp: 1500,
                population: 65,
            },
            {
                [OwidTableSlugs.entityName]: "Germany",
                [OwidTableSlugs.time]: 2000,
                gdp: 2000,
                population: 80,
            },
            {
                [OwidTableSlugs.entityName]: "Germany",
                [OwidTableSlugs.time]: 2010,
                gdp: 2500,
                population: 82,
            },
        ])
    }

    it("returns undefined when time is undefined", () => {
        const table = makeTestTable()
        expect(
            makeDimensionValuesForTimeDirect(
                table,
                ["gdp"],
                undefined,
                "France",
                undefined
            )
        ).toBeUndefined()
    })

    it("extracts y values for a single column", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "France",
            2000
        )

        expect(result).toBeDefined()
        expect(result?.y).toHaveLength(1)
        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBe(1000)
        expect(result?.y?.[0].time).toBe(2000)
    })

    it("extracts y values for multiple columns", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp", "population"],
            undefined,
            "Germany",
            2010
        )

        expect(result?.y).toHaveLength(2)
        expect(result?.y?.[0].value).toBe(2500)
        expect(result?.y?.[1].value).toBe(82)
    })

    it("extracts x value when x column is specified", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            "population",
            "France",
            2010
        )

        expect(result?.y?.[0].value).toBe(1500)
        expect(result?.x?.columnSlug).toBe("population")
        expect(result?.x?.value).toBe(65)
    })

    it("returns data point with only columnSlug when no data exists for entity/time", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "France",
            2020 // No data for 2020
        )

        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBeUndefined()
    })

    it("returns data point with only columnSlug for non-existent entity", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "Spain", // Entity not in table
            2000
        )

        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBeUndefined()
    })

})
