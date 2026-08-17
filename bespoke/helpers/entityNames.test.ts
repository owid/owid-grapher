import { describe, expect, it } from "vitest"

import { entityNameForSentence } from "./entityNames.js"

describe(entityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["France", "France"],
        ["United States", "the United States"],
        ["Channel Islands", "the Channel Islands"],
        ["High-income countries", "high-income countries"],
        // The source suffix has no place mid-sentence
        ["Africa (UN)", "Africa"],
        [
            "Latin America and the Caribbean (UN)",
            "Latin America and the Caribbean",
        ],
    ])("%s reads as %s", (name, expected) => {
        expect(entityNameForSentence(name)).toEqual(expected)
    })
})
