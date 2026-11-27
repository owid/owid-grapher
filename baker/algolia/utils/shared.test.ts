import { describe, expect, it, vi } from "vitest"
import {
    DimensionProperty,
    OwidChartDimensionInterface,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import {
    loadGrapherStateWithMetadata,
    parseJsonStringArray,
    uniqNonEmptyStrings,
} from "./shared.js"

describe(parseJsonStringArray, () => {
    it("returns empty array for null or undefined", () => {
        expect(parseJsonStringArray(null)).toEqual([])
        expect(parseJsonStringArray(undefined)).toEqual([])
    })

    it("filters nulls from parsed arrays", () => {
        const raw = JSON.stringify(["who", null, "faostat"])
        expect(parseJsonStringArray(raw)).toEqual(["who", "faostat"])
    })

    it("filters empty strings", () => {
        const raw = JSON.stringify(["who", "", "faostat"])
        expect(parseJsonStringArray(raw)).toEqual(["who", "faostat"])
    })

    it("handles empty arrays", () => {
        const raw = JSON.stringify([])
        expect(parseJsonStringArray(raw)).toEqual([])
    })
})

describe(uniqNonEmptyStrings, () => {
    it("deduplicates and filters empty values from strings", () => {
        const result = uniqNonEmptyStrings(["who", "", "faostat", "who", null])
        expect(result).toEqual(["who", "faostat"])
    })

    it("flattens and deduplicates string arrays", () => {
        const result = uniqNonEmptyStrings([
            ["who", "faostat"],
            ["faostat", ""],
            undefined,
            "who",
        ])
        expect(result).toEqual(["who", "faostat"])
    })
})

describe(loadGrapherStateWithMetadata, () => {
    it("falls back to the descriptionShort of a single y indicator", async () => {
        const loader = vi.fn(async (id: number) =>
            makeMetadata(id, { descriptionShort: "From the indicator." })
        )
        const grapherState = await loadGrapherStateWithMetadata(
            { dimensions: [yDimension(1)] },
            loader
        )

        expect(grapherState.effectiveSubtitle).toBe("From the indicator.")
    })

    it("prefers the authored subtitle over descriptionShort", async () => {
        const loader = vi.fn(async (id: number) =>
            makeMetadata(id, { descriptionShort: "From the indicator." })
        )
        const grapherState = await loadGrapherStateWithMetadata(
            { subtitle: "Authored subtitle", dimensions: [yDimension(1)] },
            loader
        )

        expect(grapherState.effectiveSubtitle).toBe("Authored subtitle")
    })

    it("has no subtitle for several y indicators without an authored subtitle", async () => {
        const loader = vi.fn(async (id: number) =>
            makeMetadata(id, { descriptionShort: `Indicator ${id}.` })
        )
        const grapherState = await loadGrapherStateWithMetadata(
            { dimensions: [yDimension(1), yDimension(2)] },
            loader
        )

        expect(grapherState.effectiveSubtitle).toBe("")
    })
})

function yDimension(variableId: number): OwidChartDimensionInterface {
    return { variableId, property: DimensionProperty.y }
}

function makeMetadata(
    id: number,
    overrides: Partial<OwidVariableWithSourceAndDimension> = {}
): OwidVariableWithSourceAndDimension {
    return {
        id,
        name: `Indicator ${id}`,
        dimensions: { years: { values: [] }, entities: { values: [] } },
        ...overrides,
    }
}
