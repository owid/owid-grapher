import { describe, expect, it } from "vitest"

import {
    isCountryName,
    getCountryBySlug,
    getRegionByNameOrVariantName,
    getRegionByName,
    getCountryNamesForRegion,
    Continent,
    IncomeGroup,
    Aggregate,
    articulateEntity,
} from "./regions.js"

it("isCountryName", () => {
    expect(isCountryName("United States")).toEqual(true)
    expect(isCountryName("Not a country")).toEqual(false)
})

it("getCountryBySlug", () => {
    expect(getCountryBySlug("united-states")).toMatchObject({
        name: "United States",
        slug: "united-states",
        code: "USA",
    })
    expect(getCountryBySlug("not-a-country")).toEqual(undefined)
})

it("getRegionByNameOrVariantName", () => {
    expect(getRegionByNameOrVariantName("United States")).toMatchObject({
        name: "United States",
        slug: "united-states",
        code: "USA",
    })

    expect(getRegionByNameOrVariantName("USA")).toMatchObject({
        name: "United States",
        slug: "united-states",
        code: "USA",
    })

    // Test case-insensitivity
    expect(getRegionByNameOrVariantName("UNITED KINGDOM")).toMatchObject({
        name: "United Kingdom",
        slug: "united-kingdom",
        code: "GBR",
    })

    expect(getRegionByNameOrVariantName("uae")).toMatchObject({
        name: "United Arab Emirates",
        slug: "united-arab-emirates",
        code: "ARE",
    })
})

describe("articulateEntity", () => {
    it("adds an article when one is defined", () => {
        expect(articulateEntity("United States")).toEqual("the United States")
        expect(articulateEntity("Democratic Republic of Congo")).toEqual(
            "the Democratic Republic of Congo"
        )
    })

    it("avoids duplicating an existing article", () => {
        expect(articulateEntity("the United Kingdom")).toEqual(
            "the United Kingdom"
        )
    })

    it("returns the original name when no article is defined", () => {
        expect(articulateEntity("France")).toEqual("France")
    })
})

describe("getCountryNamesForRegion", () => {
    it("handles owid continents", () => {
        const region = getRegionByName("Africa") as Continent
        const countryNames = getCountryNamesForRegion(region)

        // Check for some known African countries
        expect(countryNames).toContain("Nigeria")
        expect(countryNames).toContain("Egypt")
        expect(countryNames).toContain("South Africa")

        // Should not contain non-African countries
        expect(countryNames).not.toContain("France")
        expect(countryNames).not.toContain("Japan")
    })

    it("handles non-owid regions", () => {
        const region = getRegionByName("South-East Asia (WHO)") as Aggregate
        const countryNames = getCountryNamesForRegion(region)

        // Check for some known countries in the region
        expect(countryNames).toContain("Thailand")
        expect(countryNames).toContain("India")

        // Should not contain other countries
        expect(countryNames).not.toContain("China")
        expect(countryNames).not.toContain("Australia")
    })

    it("handles income groups", () => {
        const region = getRegionByName("High-income countries") as IncomeGroup
        const countryNames = getCountryNamesForRegion(region)

        // Check for some high-income countries
        expect(countryNames).toContain("United States")
        expect(countryNames).toContain("Japan")

        // Should not contain non-high-income countries
        expect(countryNames).not.toContain("India")
    })

    it("handles World", () => {
        const region = getRegionByName("World") as Aggregate
        const countryNames = getCountryNamesForRegion(region)

        // Check for countries from different continents
        expect(countryNames).toContain("United States") // North America
        expect(countryNames).toContain("Brazil") // South America
        expect(countryNames).toContain("Germany") // Europe
        expect(countryNames).toContain("China") // Asia
        expect(countryNames).toContain("Australia") // Oceania
        expect(countryNames).toContain("Nigeria") // Africa
    })
})
