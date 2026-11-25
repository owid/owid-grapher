import { describe, expect, it } from "vitest"

import { argMax } from "./argMax.js"

describe(argMax, () => {
    it("finds the largest value, the first one on a tie", () => {
        expect(argMax([1, 5, 3])).toBe(1)
        expect(argMax([2, 7, 7, 1])).toBe(1)
        expect(argMax([-3, -1, -2])).toBe(1)
    })

    it("has no answer for no values", () => {
        expect(argMax([])).toBeUndefined()
    })
})
