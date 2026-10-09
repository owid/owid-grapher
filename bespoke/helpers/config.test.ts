import { describe, expect, expectTypeOf, it, vi } from "vitest"

import type { BespokeConfigSpec } from "../shared/bespokeComponentTypes.js"
import { parseConfigFromSpec, parseEmbedConfig } from "./config.js"

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
        parse: (value: string) =>
            value.split(",").every((part) => part.trim() !== "")
                ? value.split(",").map(Number)
                : undefined,
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

    it("keeps an allowed enum value and replaces any other with the default, if there is one", () => {
        expect(
            parseConfigFromSpec(SPEC, { flow: "import", unit: "percent" })
        ).toMatchObject({ flow: "import", unit: "percent" })
        expect(
            parseConfigFromSpec(SPEC, { flow: "sideways", unit: "relative" })
        ).toMatchObject({ flow: "both", unit: undefined })
    })

    it("treats an empty value as unset", () => {
        expect(parseConfigFromSpec(SPEC, { product: "" }).product).toBe("Maize")
        expect(parseConfigFromSpec(SPEC, { year: " " }).year).toBeUndefined()
    })

    it("trims values before parsing", () => {
        expect(
            parseConfigFromSpec(SPEC, { flow: " import ", product: " Wheat " })
        ).toMatchObject({ flow: "import", product: "Wheat" })
    })

    it("treats a value that is not a finite number as invalid", () => {
        expect(
            parseConfigFromSpec(SPEC, { scale: "abc", year: "abc" })
        ).toMatchObject({ scale: 1, year: undefined })
        expect(
            parseConfigFromSpec(SPEC, { scale: "Infinity", year: "Infinity" })
        ).toMatchObject({ scale: 1, year: undefined })
    })

    it("reads a boolean as unset when it is not true or false", () => {
        expect(parseConfigFromSpec(SPEC, {})).toMatchObject({
            hideControls: undefined,
            showLegend: true,
        })
        expect(
            parseConfigFromSpec(SPEC, {
                hideControls: "yes",
                showLegend: "yes",
            })
        ).toMatchObject({ hideControls: undefined, showLegend: true })
        expect(
            parseConfigFromSpec(SPEC, {
                hideControls: "true",
                showLegend: "false",
            })
        ).toMatchObject({ hideControls: true, showLegend: false })
    })

    it("rounds a fractional integer", () => {
        expect(parseConfigFromSpec(SPEC, { year: "2023.6" }).year).toBe(2024)
    })

    it("leaves a custom value unset when its parser rejects it", () => {
        expect(
            parseConfigFromSpec(SPEC, { points: "1,,3" }).points
        ).toBeUndefined()
        expect(parseConfigFromSpec(SPEC, { points: "1,2" }).points).toEqual([
            1, 2,
        ])
    })

    it("never calls a custom parser for an unset value", () => {
        const parse = vi.fn((value: string) => value)
        const spec = {
            points: { type: "custom", format: "text", parse, description: "" },
        } as const satisfies BespokeConfigSpec

        expect(parseConfigFromSpec(spec, {}).points).toBeUndefined()
        expect(
            parseConfigFromSpec(spec, { points: " " }).points
        ).toBeUndefined()
        expect(parse).not.toHaveBeenCalled()

        expect(parseConfigFromSpec(spec, { points: "a" }).points).toBe("a")
        expect(parse).toHaveBeenCalledExactlyOnceWith("a")
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

        const numberDefaultNotANumber = {
            year: { type: "integer", default: "latest", description: "Year" },
        } as const satisfies BespokeConfigSpec
        expect(() => parseConfigFromSpec(numberDefaultNotANumber, {})).toThrow(
            '"year" has a default that is not a valid integer'
        )

        const booleanDefaultNotABoolean = {
            hideControls: {
                type: "boolean",
                default: "yes",
                description: "Hide the controls",
            },
        } as const satisfies BespokeConfigSpec
        expect(() =>
            parseConfigFromSpec(booleanDefaultNotABoolean, {})
        ).toThrow('"hideControls" has a default that is not a valid boolean')
    })
})

describe(parseEmbedConfig, () => {
    it("reads each flag as true only when it says true", () => {
        expect(parseEmbedConfig({})).toStrictEqual({
            urlSync: false,
            hideMetadataModal: false,
        })
        expect(
            parseEmbedConfig({ urlSync: "true", hideMetadataModal: "yes" })
        ).toStrictEqual({ urlSync: true, hideMetadataModal: false })
    })
})
