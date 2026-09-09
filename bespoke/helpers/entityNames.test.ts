import { describe, expect, it } from "vitest"

import { formatEntityNameForSentence } from "./entityNames.js"

describe(formatEntityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["France", "France"],
        ["United States", "the United States"],
        ["Channel Islands", "the Channel Islands"],
        ["High-income countries", "high-income countries"],
        ["Africa (UN)", "Africa (UN)"],
        ["Americas (WHO)", "Americas (WHO)"],
    ])("%s reads as %s", (name, expected) => {
        expect(formatEntityNameForSentence(name)).toEqual(expected)
    })

    it.each([
        ["Africa (UN)", "Africa"],
        [
            "Latin America and the Caribbean (UN)",
            "Latin America and the Caribbean",
        ],
    ])("%s reads as %s when stripping (UN)", (name, expected) => {
        expect(formatEntityNameForSentence(name, ["UN"])).toEqual(expected)
    })
})
