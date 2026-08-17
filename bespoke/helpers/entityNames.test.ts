import { describe, expect, it } from "vitest"

import { entityNameForSentence } from "./entityNames.js"

describe(entityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["France", "France"],
        ["United States", "the United States"],
        ["Channel Islands", "the Channel Islands"],
        ["High-income countries", "high-income countries"],
        // Suffixed aggregates aren't regions, so they pass through untouched
        ["Africa (UN)", "Africa (UN)"],
    ])("%s reads as %s", (name, expected) => {
        expect(entityNameForSentence(name)).toEqual(expected)
    })
})
