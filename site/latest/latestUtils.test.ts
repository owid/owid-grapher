import { describe, expect, it } from "vitest"
import { hasViewToggle } from "./latestUtils.js"

describe(hasViewToggle, () => {
    it("offers the Expanded/Compact toggle for data insights only", () => {
        expect(hasViewToggle("data-insight")).toBe(true)
        expect(hasViewToggle("data-update")).toBe(false)
        expect(hasViewToggle("article")).toBe(false)
    })

    it("offers nothing when no type filter is active", () => {
        expect(hasViewToggle(null)).toBe(false)
    })
})
