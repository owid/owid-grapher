import { expect, it, describe } from "vitest"

import { grapherSlugToExportFileKey, numberBoundsClipPaths } from "./utils.js"

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

describe(numberBoundsClipPaths, () => {
    // With guids disabled, every facet of a faceted map renders a clip path
    // with the same id, followed by the group it clips
    const facet = (x: number): string =>
        `<defs><clipPath id="boundsClip-1"><rect x="${x}"></rect></clipPath></defs>` +
        `<g clip-path="url(#boundsClip-1)"></g>`

    it("gives each facet's clip path its own id and points its group at it", () => {
        expect(numberBoundsClipPaths(facet(0) + facet(400))).toEqual(
            `<defs><clipPath id="boundsClip-1"><rect x="0"></rect></clipPath></defs>` +
                `<g clip-path="url(#boundsClip-1)"></g>` +
                `<defs><clipPath id="boundsClip-2"><rect x="400"></rect></clipPath></defs>` +
                `<g clip-path="url(#boundsClip-2)"></g>`
        )
    })

    it("leaves a chart with a single clip path unchanged", () => {
        expect(numberBoundsClipPaths(facet(0))).toEqual(facet(0))
    })

    it("leaves differently named clip paths alone", () => {
        const svg =
            `<clipPath id="scatterBounds-1"></clipPath>` +
            `<g clip-path="url(#scatterBounds-1)"></g>`
        expect(numberBoundsClipPaths(svg + svg)).toEqual(svg + svg)
    })
})
