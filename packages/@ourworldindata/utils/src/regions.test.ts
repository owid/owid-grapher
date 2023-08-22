#! /usr/bin/env jest

import { isCountryName, getCountryBySlug } from "./regions.js"

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
