import { describe, expect, it, vi } from "vitest"
import { DimensionProperty } from "@ourworldindata/types"
import {
    buildSourcesLineFromConfig,
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

describe(buildSourcesLineFromConfig, () => {
    it("returns sourceDesc as plain text without loading any indicator metadata", async () => {
        const loader = vi.fn()
        const sourcesLine = await buildSourcesLineFromConfig(
            {
                sourceDesc: "[IHME (2025)](#dod:ihme); **WHO** (2024)",
                dimensions: [{ variableId: 1, property: DimensionProperty.y }],
            },
            loader
        )

        expect(sourcesLine).toBe("IHME (2025); WHO (2024)")
        expect(loader).not.toHaveBeenCalled()
    })
})
