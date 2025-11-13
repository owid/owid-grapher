import { expect, it, describe } from "vitest"

import { grapherSlugToExportFileKey } from "./GrapherBakingUtils.js"

describe(grapherSlugToExportFileKey, () => {
    it("can handle empty query string", () => {
        const slug = "soil-lifespans"
        const queryStr = ""
        expect(grapherSlugToExportFileKey(slug, queryStr)).toEqual(
            "soil-lifespans"
        )
    })

    it("can handle undefined query string", () => {
        const slug = "soil-lifespans"
        const queryStr = undefined
        expect(grapherSlugToExportFileKey(slug, queryStr)).toEqual(
            "soil-lifespans"
        )
    })

    it("can handle non-empty query string", () => {
        const slug = "soil-lifespans"
        const queryStr = "?tab=map"
        expect(grapherSlugToExportFileKey(slug, queryStr)).toEqual(
            "soil-lifespans-a42c8357c168ebd03c90930b9d3c439b"
        )
    })

    it("can handle slugs with uppercase letters", () => {
        const slug = "real-gdp-per-capita-pennWT"
        const queryStr = ""
        expect(grapherSlugToExportFileKey(slug, queryStr)).toEqual(
            "real-gdp-per-capita-pennWT"
        )
    })
})
