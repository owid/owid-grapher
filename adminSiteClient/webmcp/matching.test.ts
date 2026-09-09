import { describe, expect, it } from "vitest"
import {
    alphanumericInsensitive,
    describeUnresolved,
    matchNames,
} from "./matching.js"

const available = ["Czechia", "Slovakia", "Czechoslovakia", "World"]

describe(matchNames, () => {
    it("resolves exact names in the order requested", () => {
        expect(matchNames(["World", "Czechia"], available)).toEqual({
            resolved: ["World", "Czechia"],
            unresolved: [],
        })
    })

    it("resolves case-insensitively using the page's spelling", () => {
        expect(matchNames(["czechia", " WORLD "], available).resolved).toEqual([
            "Czechia",
            "World",
        ])
    })

    it("does not guess: unknown names come back with substring candidates", () => {
        const { resolved, unresolved } = matchNames(["Czech"], available)
        expect(resolved).toEqual([])
        expect(unresolved).toEqual([
            { requested: "Czech", candidates: ["Czechia", "Czechoslovakia"] },
        ])
    })

    it("returns no candidates when nothing is similar", () => {
        expect(matchNames(["Mars"], available).unresolved).toEqual([
            { requested: "Mars", candidates: [] },
        ])
    })

    it("caps the candidate list", () => {
        const many = Array.from({ length: 30 }, (_, i) => `Region ${i}`)
        const { unresolved } = matchNames(["Region"], many, {
            maxCandidates: 5,
        })
        expect(unresolved[0].candidates).toHaveLength(5)
    })

    it("matches chart type spellings with the alphanumeric normalizer", () => {
        const types = ["LineChart", "ScatterPlot", "StackedDiscreteBar"]
        const { resolved } = matchNames(
            ["line chart", "scatter_plot", "stacked-discrete-bar"],
            types,
            { normalize: alphanumericInsensitive }
        )
        expect(resolved).toEqual(types)
    })
})

describe(describeUnresolved, () => {
    it("writes one sentence per name, with suggestions when there are any", () => {
        expect(
            describeUnresolved(
                [
                    { requested: "Czech", candidates: ["Czechia"] },
                    { requested: "Mars", candidates: [] },
                ],
                "an entity on this chart"
            )
        ).toBe(
            '"Czech" is not an entity on this chart. Did you mean: Czechia? ' +
                '"Mars" is not an entity on this chart.'
        )
    })
})
