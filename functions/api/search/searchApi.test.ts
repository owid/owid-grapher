import { describe, it, expect } from "vitest"
import {
    formatCountryFilter,
    formatFeaturedMetricFilter,
    formatIncomeGroupFMFilter,
    formatTopicFilter,
} from "./searchApi.js"

describe("formatCountryFilter", () => {
    it("returns undefined when no countries provided", () => {
        const result = formatCountryFilter(new Set(), false)
        expect(result).toBeUndefined()
    })

    it("formats single country with OR logic (requireAll=false)", () => {
        const result = formatCountryFilter(new Set(["United States"]), false)
        expect(result).toBe("availableEntities:=[`United States`]")
    })

    it("formats multiple countries with OR logic (requireAll=false)", () => {
        const result = formatCountryFilter(
            new Set(["United States", "China", "India"]),
            false
        )
        expect(result).toBe(
            "availableEntities:=[`United States`, `China`, `India`]"
        )
    })

    it("formats single country with AND logic (requireAll=true)", () => {
        const result = formatCountryFilter(new Set(["United States"]), true)
        expect(result).toBe("availableEntities:=`United States`")
    })

    it("formats multiple countries with AND logic (requireAll=true)", () => {
        const result = formatCountryFilter(
            new Set(["United States", "China", "India"]),
            true
        )
        expect(result).toBe(
            "availableEntities:=`United States` && availableEntities:=`China` && availableEntities:=`India`"
        )
    })
})

describe("formatFeaturedMetricFilter", () => {
    it("returns filter to exclude FMs when query is non-empty", () => {
        const result = formatFeaturedMetricFilter("population")
        expect(result).toBe("isFM:!=true")
    })

    it("returns undefined when query is empty", () => {
        const result = formatFeaturedMetricFilter("")
        expect(result).toBeUndefined()
    })

    it("returns undefined when query is only whitespace", () => {
        const result = formatFeaturedMetricFilter("   ")
        expect(result).toBeUndefined()
    })
})

describe("formatIncomeGroupFMFilter", () => {
    it("returns filter when no countries selected", () => {
        const result = formatIncomeGroupFMFilter(new Set())
        expect(result).toBe("isIncomeGroupSpecificFM:!=true")
    })

    it("returns undefined when countries are selected", () => {
        const result = formatIncomeGroupFMFilter(new Set(["India"]))
        expect(result).toBeUndefined()
    })
})

describe("formatTopicFilter", () => {
    it("returns undefined when no topics provided", () => {
        const result = formatTopicFilter(new Set())
        expect(result).toBeUndefined()
    })

    it("formats single topic", () => {
        const result = formatTopicFilter(new Set(["Health"]))
        expect(result).toBe("tags:=[`Health`]")
    })

    it("formats multiple topics with OR logic", () => {
        const result = formatTopicFilter(
            new Set(["Health", "Education", "Climate"])
        )
        expect(result).toBe("tags:=[`Health`, `Education`, `Climate`]")
    })
})
