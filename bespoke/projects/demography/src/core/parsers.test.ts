import { describe, expect, it } from "vitest"

import { parseControlPoints } from "./parsers.js"

describe(parseControlPoints, () => {
    it("maps each entry to its control year, skipping empty ones", () => {
        expect(parseControlPoints("1.8, ,1.5")).toStrictEqual({
            2030: 1.8,
            2100: 1.5,
        })
    })

    it("returns undefined when every entry is empty", () => {
        expect(parseControlPoints(",,")).toBe(undefined)
    })

    it("throws on an entry that is not a number", () => {
        expect(() => parseControlPoints("1.8,abc")).toThrow('"abc"')
    })
})
