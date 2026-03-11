import { describe, expect, it } from "vitest"

import { getSafeComparisonUrl } from "./testPageRouter.js"

describe("getSafeComparisonUrl", () => {
    it("returns the default comparison URL when the query param is missing", () => {
        expect(getSafeComparisonUrl(undefined)).toBe(
            "https://ourworldindata.org"
        )
    })

    it("returns an empty string for blank input", () => {
        expect(getSafeComparisonUrl("   ")).toBe("")
    })

    it("returns an empty string for invalid URLs", () => {
        expect(getSafeComparisonUrl("not a url")).toBe("")
    })

    it("returns an empty string for non-http protocols", () => {
        expect(getSafeComparisonUrl("javascript:alert(1)")).toBe("")
    })

    it("normalizes valid http and https URLs to origin and path", () => {
        expect(
            getSafeComparisonUrl(
                "https://example.com/grapher/chart-slug?foo=bar#section"
            )
        ).toBe("https://example.com/grapher/chart-slug")
        expect(getSafeComparisonUrl("http://example.com/explorers/co2")).toBe(
            "http://example.com/explorers/co2"
        )
    })

    it("returns an empty string when Express provides repeated comparisonUrl params", () => {
        expect(
            getSafeComparisonUrl([
                "https://example.com/one",
                "https://example.com/two",
            ])
        ).toBe("")
    })
})
