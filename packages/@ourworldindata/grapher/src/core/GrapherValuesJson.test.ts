import { describe, expect, it } from "vitest"
import {
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
} from "@ourworldindata/types"
import { isValuesJsonValid } from "./GrapherValuesJson"

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
