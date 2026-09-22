import { describe, expect, it } from "vitest"

import { clampYear } from "./clampYear.js"

describe(clampYear, () => {
    it("returns the year unchanged when the entity has it", () => {
        expect(clampYear([2010, 2011, 2012], 2011)).toBe(2011)
    })

    it("clamps to the first year when selected is earlier", () => {
        expect(clampYear([2019, 2020, 2021], 2011)).toBe(2019)
    })

    it("clamps to the last year when selected is later", () => {
        expect(clampYear([2010, 2011, 2018], 2023)).toBe(2018)
    })
})
