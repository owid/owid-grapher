import { describe, expect, it } from "vitest"

import {
    EnrichedBlockChartRows,
    EnrichedBlockPullChart,
} from "@ourworldindata/types"

import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"

const GRAPHER_URL = "https://ourworldindata.org/grapher/foo"
// This is what an author's `url:` value looks like once Google Docs has
// auto-linked (or the author has pasted) a URL: gdocToArchie serializes link
// spans as HTML before ArchieML ever sees them.
const LINKIFIED_GRAPHER_URL = `<a href="${GRAPHER_URL}">${GRAPHER_URL}</a>`

describe("parseChartRows", () => {
    it("extracts the href when a row's url has been linkified by Google Docs", () => {
        const enriched = parseRawBlocksToEnrichedBlocks({
            type: "chart-rows",
            value: {
                rows: [
                    {
                        image: "some-thumbnail.png",
                        url: LINKIFIED_GRAPHER_URL,
                        content: [{ type: "text", value: "Some text" }],
                    },
                ],
            },
        }) as EnrichedBlockChartRows

        expect(enriched.rows[0].url).toBe(GRAPHER_URL)
        expect(enriched.parseErrors).toEqual([])
    })

    it("leaves a plain url untouched", () => {
        const enriched = parseRawBlocksToEnrichedBlocks({
            type: "chart-rows",
            value: {
                rows: [
                    {
                        image: "some-thumbnail.png",
                        url: GRAPHER_URL,
                        content: [{ type: "text", value: "Some text" }],
                    },
                ],
            },
        }) as EnrichedBlockChartRows

        expect(enriched.rows[0].url).toBe(GRAPHER_URL)
    })
})

describe("parsePullChart", () => {
    it("extracts the href when the url has been linkified by Google Docs", () => {
        const enriched = parseRawBlocksToEnrichedBlocks({
            type: "pull-chart",
            value: {
                image: "some-thumbnail.png",
                url: LINKIFIED_GRAPHER_URL,
                content: [{ type: "text", value: "Some text" }],
            },
        }) as EnrichedBlockPullChart

        expect(enriched.url).toBe(GRAPHER_URL)
        expect(enriched.parseErrors).toEqual([])
    })

    it("leaves a plain url untouched", () => {
        const enriched = parseRawBlocksToEnrichedBlocks({
            type: "pull-chart",
            value: {
                image: "some-thumbnail.png",
                url: GRAPHER_URL,
                content: [{ type: "text", value: "Some text" }],
            },
        }) as EnrichedBlockPullChart

        expect(enriched.url).toBe(GRAPHER_URL)
    })
})
