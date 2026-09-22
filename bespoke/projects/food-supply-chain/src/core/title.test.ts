import { describe, expect, it } from "vitest"

import { buildSubtitle, buildTitle } from "./title.js"

describe(buildTitle, () => {
    it("takes an apostrophe with no trailing s for an entity with an article", () => {
        expect(buildTitle("United States")).toBe(
            "What happens to the United States' food?"
        )
    })

    it("takes 's for an entity with no article", () => {
        expect(buildTitle("Germany")).toBe("What happens to Germany's food?")
    })
})

describe(buildSubtitle, () => {
    it("capitalises the unit and appends the year", () => {
        expect(buildSubtitle("kilocalories per person per day", 2023)).toBe(
            "Kilocalories per person per day, 2023"
        )
    })
})
