import { expect, it, describe } from "vitest"
import {
    omitEmptyStringValues,
    omitEmptyObjectValues,
} from "./GrapherGrammar.js"
describe("GrapherGrammar helper functions", () => {
    describe("omitEmptyStringValues", () => {
        it("should remove properties with empty string values", () => {
            const input = {
                title: "Chart Title",
                subtitle: "",
                note: "Some note",
                missingDataStrategy: "",
            }

            const result = omitEmptyStringValues(input)

            expect(result).toEqual({
                title: "Chart Title",
                note: "Some note",
            })
        })

        it("should preserve non-empty string values", () => {
            const input = {
                title: "Chart Title",
                subtitle: "Chart Subtitle",
                zero: "0",
                space: " ",
            }

            const result = omitEmptyStringValues(input)

            expect(result).toEqual(input)
        })

        it("should preserve non-string values", () => {
            const input = {
                title: "",
                count: 0,
                enabled: false,
                data: null,
                items: [],
                config: {},
            }

            const result = omitEmptyStringValues(input)

            expect(result).toEqual({
                count: 0,
                enabled: false,
                data: null,
                items: [],
                config: {},
            })
        })

        it("should handle empty object", () => {
            const result = omitEmptyStringValues({})
            expect(result).toEqual({})
        })
    })

    describe("omitEmptyObjectValues", () => {
        it("should remove properties with empty plain object values", () => {
            const input = {
                title: "Chart Title",
                map: {},
                dimensions: { x: "variable1" },
                filters: {},
            }

            const result = omitEmptyObjectValues(input)

            expect(result).toEqual({
                title: "Chart Title",
                dimensions: { x: "variable1" },
            })
        })

        it("should preserve non-empty object values", () => {
            const input = {
                map: { time: 2020 },
                dimensions: { x: "variable1", y: "variable2" },
            }

            const result = omitEmptyObjectValues(input)

            expect(result).toEqual(input)
        })

        it("should preserve non-object values", () => {
            const input = {
                emptyObject: {},
                title: "Chart Title",
                count: 0,
                enabled: false,
                data: null,
                items: [],
            }

            const result = omitEmptyObjectValues(input)

            expect(result).toEqual({
                title: "Chart Title",
                count: 0,
                enabled: false,
                data: null,
                items: [],
            })
        })

        it("should not remove arrays (even empty ones)", () => {
            const input = {
                emptyObject: {},
                emptyArray: [],
                filledArray: [1, 2, 3],
            }

            const result = omitEmptyObjectValues(input)

            expect(result).toEqual({
                emptyArray: [],
                filledArray: [1, 2, 3],
            })
        })

        it("should handle nested objects", () => {
            const input = {
                map: {
                    time: 2020,
                    projection: {},
                },
                dimensions: {},
            }

            const result = omitEmptyObjectValues(input)

            expect(result).toEqual({
                map: {
                    time: 2020,
                    projection: {},
                },
            })
        })

        it("should handle empty object", () => {
            const result = omitEmptyObjectValues({})
            expect(result).toEqual({})
        })
    })

    describe("combined usage", () => {
        it("should work together at top level", () => {
            const input = {
                title: "Chart Title",
                subtitle: "",
                map: {
                    time: "",
                    projection: {},
                    targetTime: 2020,
                },
                dimensions: {},
                note: "Important note",
            }

            // First remove empty strings, then empty objects
            const withoutEmptyStrings = omitEmptyStringValues(input)
            const result = omitEmptyObjectValues(withoutEmptyStrings)

            expect(result).toEqual({
                title: "Chart Title",
                map: {
                    time: "", // empty strings in nested objects are preserved
                    projection: {}, // empty objects in nested objects are preserved
                    targetTime: 2020,
                },
                note: "Important note",
                // dimensions: {} was removed as it's an empty object at top level
            })
        })

        it("should be used as intended in GrapherGrammar toGrapherObject functions", () => {
            // Test the pattern used in GrapherGrammar
            const parsedValue = ""
            const result1 = omitEmptyStringValues({
                missingDataStrategy: parsedValue,
            })
            expect(result1).toEqual({}) // Empty string value is omitted

            const result2 = omitEmptyObjectValues({
                map: omitEmptyStringValues({ time: parsedValue }),
            })
            expect(result2).toEqual({}) // Empty object is omitted after inner function returns {}

            const validValue = "hide"
            const result3 = omitEmptyStringValues({
                missingDataStrategy: validValue,
            })
            expect(result3).toEqual({ missingDataStrategy: "hide" }) // Non-empty string is preserved
        })
    })
})
