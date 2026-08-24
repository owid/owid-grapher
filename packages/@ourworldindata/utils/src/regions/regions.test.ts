import { describe, expect, it } from "vitest"

import type { Continent, IncomeGroup, Aggregate } from "./regionsTypes.js"
import {
    getCountryBySlug,
    getRegionByNameOrVariantName,
    getRegionByName,
    getCountryNamesForRegion,
    getAggregates,
    getRegionPublishers,
    articulateEntity,
    parseRegionNameSuffix,
} from "./regionsUtils.js"

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

describe(articulateEntity, () => {
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

describe(getCountryNamesForRegion, () => {
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

describe(getRegionPublishers, () => {
    it("gives one key per publisher, not per region set", () => {
        const keys = getRegionPublishers()

        // fao_1/fao_2/fao_sdg and ihme_gbd_1/ihme_gbd_2 collapse to one key each
        expect(keys).toContain("fao")
        expect(keys).toContain("ihme_gbd")
        expect(keys).not.toContain("fao_1")
        expect(keys).not.toContain("ihme_gbd_1")

        // "European Union (27)" is an aggregate with no `definedBy`, so it has no publisher
        expect(keys).not.toContain("27")
    })
})

describe(parseRegionNameSuffix, () => {
    it("splits off the last parenthetical", () => {
        expect(parseRegionNameSuffix("Africa (WHO)")).toEqual({
            name: "Africa",
            suffix: "WHO",
            publisherKey: "who",
        })
        expect(parseRegionNameSuffix("Africa (non-OECD) (IHME GBD)")).toEqual({
            name: "Africa (non-OECD)",
            suffix: "IHME GBD",
            publisherKey: "ihme_gbd",
        })
        expect(parseRegionNameSuffix("Africa (PIP) ")).toMatchObject({
            name: "Africa",
            suffix: "PIP",
        })
    })

    it("requires a non-empty suffix in trailing parens, preceded by a space", () => {
        expect(parseRegionNameSuffix("United States")).toEqual(undefined)
        expect(parseRegionNameSuffix("(WHO)")).toEqual(undefined)
        expect(parseRegionNameSuffix("Africa ()")).toEqual(undefined)
        // no space before the parenthesis
        expect(parseRegionNameSuffix("Africa(WHO)")).toEqual(undefined)
        // extra whitespace before the parenthesis is not kept in the name
        expect(parseRegionNameSuffix("Africa  (WHO)")).toMatchObject({
            name: "Africa",
            suffix: "WHO",
        })
    })
})

describe(getAggregates, () => {
    it("gives every region of a published set a publisher", () => {
        const withoutPublisher = getAggregates()
            .filter((region) => region.definedBy && !region.publisher)
            .map((region) => region.name)

        expect(withoutPublisher).toEqual([])
    })
})
