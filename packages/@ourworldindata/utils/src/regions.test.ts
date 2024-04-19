#! /usr/bin/env jest

import {
    isCountryName,
    getCountryBySlug,
    getRegionByNameOrVariantName,
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
