import { describe, expect, it } from "vitest"

import { entityNameForSentence, toDisplayName } from "./entityNames.js"

describe(toDisplayName, () => {
    it("maps divergent UN country names to OWID names", () => {
        expect(toDisplayName("Viet Nam")).toBe("Vietnam")
        expect(toDisplayName("Russian Federation")).toBe("Russia")
    })

    it("keeps matching names as-is", () => {
        expect(toDisplayName("Kenya")).toBe("Kenya")
        expect(toDisplayName("Sub-Saharan Africa")).toBe("Sub-Saharan Africa")
    })

    it("title-cases all-caps UN aggregates", () => {
        expect(toDisplayName("WORLD")).toBe("World")
        expect(toDisplayName("LATIN AMERICA AND THE CARIBBEAN")).toBe(
            "Latin America and the Caribbean"
        )
        expect(toDisplayName("SUB-SAHARAN AFRICA")).toBe("Sub-Saharan Africa")
    })
})

describe(entityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["United States", "the United States"],
        ["Kenya", "Kenya"],
        ["Caribbean", "the Caribbean"],
        ["High-income countries", "high-income countries"],
        ["Less developed regions", "less developed regions"],
    ])("%s → %s", (name, expected) => {
        expect(entityNameForSentence(name)).toBe(expected)
    })
})
