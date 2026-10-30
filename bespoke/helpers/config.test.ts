import { describe, expect, expectTypeOf, it } from "vitest"

import type { BespokeConfigSpec } from "../shared/bespokeComponentTypes.js"
import { parseConfigFromSpec } from "./config.js"

const FLOWS = ["both", "import", "export"] as const

const SPEC = {
    flow: {
        type: "enum",
        values: FLOWS,
        default: "both",
        description: "Trade direction",
    },
    unit: {
        type: "enum",
        values: ["percent", "absolute"],
        description: "Unit",
    },
    product: { type: "string", default: "Maize", description: "Product" },
    hideControls: { type: "boolean", description: "Hide the controls" },
    showLegend: { type: "boolean", default: "true", description: "Legend" },
    year: { type: "integer", description: "Year" },
    scale: { type: "number", default: "1", description: "Scale" },
    points: {
        type: "custom",
        format: "comma-separated numbers",
        parse: (value: string) => {
            const parts = value.split(",").map((part) => part.trim())
            if (parts.every((part) => part === "")) return undefined
            if (parts.some((part) => part === "")) throw new Error("Gap")
            return parts.map(Number)
        },
        description: "Points",
    },
} as const satisfies BespokeConfigSpec

describe(parseConfigFromSpec, () => {
    it("returns exactly the spec's keys, keeping valid values", () => {
        expect(
            parseConfigFromSpec(SPEC, {
                flow: "export",
                unit: "absolute",
                product: "Wheat",
                hideControls: "true",
                showLegend: "false",
                year: "1990",
                scale: "2.5",
                points: "1,2",
                tradeFlow: "import",
                urlSync: "true",
            })
        ).toStrictEqual({
            flow: "export",
            unit: "absolute",
            product: "Wheat",
            hideControls: true,
            showLegend: false,
            year: 1990,
            scale: 2.5,
            points: [1, 2],
        })
    })

    it("treats an empty value as unset", () => {
        expect(parseConfigFromSpec(SPEC, { product: "" }).product).toBe("Maize")
        expect(parseConfigFromSpec(SPEC, { year: " " }).year).toBeUndefined()
        expect(
            parseConfigFromSpec(SPEC, { points: " " }).points
        ).toBeUndefined()
    })

    it("trims values before parsing", () => {
        expect(
            parseConfigFromSpec(SPEC, { flow: " import ", product: " Wheat " })
        ).toMatchObject({ flow: "import", product: "Wheat" })
    })

    it("throws on an enum value outside its values, naming the key, value and allowed values", () => {
        expect(() => parseConfigFromSpec(SPEC, { flow: "sideways" })).toThrow(
            'flow: "sideways" is not valid. Expected: one of "both", "import", "export"'
        )
    })

    it("throws when a custom parser rejects a set value, naming the format", () => {
        expect(() => parseConfigFromSpec(SPEC, { points: "1,,3" })).toThrow(
            'points: "1,,3" is not valid. Expected: comma-separated numbers'
        )
    })

    it("leaves a custom key unset when its parser returns undefined", () => {
        expect(parseConfigFromSpec(SPEC, { points: ",," }).points).toBe(
            undefined
        )
    })

    it.each([
        { key: "scale", value: "abc", expected: "a number" },
        { key: "scale", value: "Infinity", expected: "a number" },
        { key: "year", value: "abc", expected: "a whole number" },
        { key: "year", value: "2023.6", expected: "a whole number" },
        { key: "hideControls", value: "yes", expected: '"true" or "false"' },
    ])("throws on $key set to $value", ({ key, value, expected }) => {
        expect(() => parseConfigFromSpec(SPEC, { [key]: value })).toThrow(
            `${key}: "${value}" is not valid. Expected: ${expected}`
        )
    })

    it("falls back to the default for an unset boolean", () => {
        expect(parseConfigFromSpec(SPEC, {})).toMatchObject({
            hideControls: undefined,
            showLegend: true,
        })
    })

    it("types keys with a default as always set and narrows enums to their values", () => {
        const config = parseConfigFromSpec(SPEC, {})
        expectTypeOf(config.flow).toEqualTypeOf<"both" | "import" | "export">()
        expectTypeOf(config.product).toEqualTypeOf<string>()
        expectTypeOf(config.hideControls).toEqualTypeOf<boolean | undefined>()
        expectTypeOf(config.showLegend).toEqualTypeOf<boolean>()
        expectTypeOf(config.unit).toEqualTypeOf<
            "percent" | "absolute" | undefined
        >()
        expectTypeOf(config.points).toEqualTypeOf<number[] | undefined>()
    })

    it("throws on a default that does not parse, even when the value is set", () => {
        const enumDefaultOutsideValues = {
            flow: {
                type: "enum",
                values: FLOWS,
                default: "sideways",
                description: "Trade direction",
            },
        } as const satisfies BespokeConfigSpec
        expect(() =>
            parseConfigFromSpec(enumDefaultOutsideValues, { flow: "import" })
        ).toThrow(
            'Bespoke config key "flow" has a default that is not a valid enum: "sideways"'
        )
    })

    it("throws on a blank default instead of reading it as zero", () => {
        const blankNumberDefault = {
            year: { type: "integer", default: " ", description: "Year" },
        } as const satisfies BespokeConfigSpec
        expect(() => parseConfigFromSpec(blankNumberDefault, {})).toThrow(
            '"year" has a default that is not a valid integer'
        )
    })
})
