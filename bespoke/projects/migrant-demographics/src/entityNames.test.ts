import { describe, expect, it } from "vitest"

import { entityNameForSentence } from "./entityNames.js"

describe(entityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["Kenya", "Kenya"],
        ["United States", "the United States"],
        ["Channel Islands", "the Channel Islands"],
        ["Africa (UN)", "Africa"],
        ["Northern America (UN)", "Northern America"],
        [
            "Latin America and the Caribbean (UN)",
            "Latin America and the Caribbean",
        ],
        ["High-income countries", "high-income countries"],
        ["Upper-middle-income countries", "upper-middle-income countries"],
    ])("%s → %s", (name, expected) => {
        expect(entityNameForSentence(name)).toBe(expected)
    })
})
