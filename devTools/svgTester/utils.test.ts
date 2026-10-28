import { expect, it, describe } from "vitest"

import {
    breakSvgTagsOntoLines,
    grapherSlugToExportFileKey,
    numberBoundsClipPaths,
} from "./utils.js"

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

describe(breakSvgTagsOntoLines, () => {
    it("puts each tag on its own line", () => {
        expect(
            breakSvgTagsOntoLines(`<svg><g id="a"><rect></rect></g></svg>`)
        ).toEqual(`<svg>\n<g id="a">\n<rect>\n</rect>\n</g>\n</svg>`)
    })

    it("keeps each text element on one line, since a line break in it renders as a space", () => {
        const sourceLine =
            `<text x="16"><tspan x="16"><tspan font-weight="700">Data source:</tspan>` +
            `<tspan dy="0.01" xml:space="preserve"> UN WPP</tspan></tspan></text>`
        const title = `<text x="16"><tspan>Life expectancy</tspan></text>`

        expect(breakSvgTagsOntoLines(`<g>${sourceLine}${title}</g>`)).toEqual(
            `<g>\n${sourceLine}\n${title}\n</g>`
        )
    })

    it("keeps a text element with several textPaths on one line", () => {
        const label =
            `<text><textPath href="#path-1">y = x</textPath>` +
            `<textPath href="#path-1">y = x</textPath></text>`

        expect(breakSvgTagsOntoLines(`<g>${label}</g>`)).toEqual(
            `<g>\n${label}\n</g>`
        )
    })
})
