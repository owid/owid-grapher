import { describe, expect, it } from "vitest"
import { placeEntityAnnotationsInTooltip } from "./DumbbellTooltips"

describe(placeEntityAnnotationsInTooltip, () => {
    it("shares the text when every column has the same one", () => {
        const textBySlug = new Map([
            ["population", "Estimate"],
            ["gdp", "Estimate"],
        ])
        expect(
            placeEntityAnnotationsInTooltip(textBySlug, ["population", "gdp"])
        ).toEqual({ kind: "shared", text: "Estimate" })
    })

    it("places texts per column when they differ", () => {
        const textBySlug = new Map([
            ["population", "A"],
            ["gdp", "B"],
        ])
        expect(
            placeEntityAnnotationsInTooltip(textBySlug, ["population", "gdp"])
        ).toEqual({ kind: "perColumn", textBySlug })
    })

    it("places texts per column when only one column is annotated", () => {
        const textBySlug = new Map([["population", "A"]])
        expect(
            placeEntityAnnotationsInTooltip(textBySlug, ["population", "gdp"])
        ).toEqual({ kind: "perColumn", textBySlug })
    })
})
