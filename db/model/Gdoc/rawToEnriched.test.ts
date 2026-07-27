import { describe, expect, it } from "vitest"

import {
    EnrichedBlockChart,
    EnrichedBlockChartRows,
    EnrichedBlockChartStory,
    EnrichedBlockPullChart,
    EnrichedBlockSDGGrid,
    EnrichedBlockTopicPageIntro,
    EnrichedBlockWithParseErrors,
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    ParseError,
    RawSDGGridItem,
} from "@ourworldindata/types"

import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"

const GRAPHER_URL = "https://ourworldindata.org/grapher/life-expectancy"

// Google Docs auto-links pasted URLs, and gdocToArchie serializes link spans as
// HTML (see spanToHtmlString) before ArchieML ever sees them. So an
// author-supplied url field can arrive as an anchor tag rather than a bare URL,
// and every one of these fields ends up in an href or in a linked-chart lookup.
const linkify = (url: string, text: string = url): string =>
    `<a href="${url}">${text}</a>`

/** A parse function with one author-supplied URL field, exercised end to end. */
interface UrlFieldCase {
    name: string
    makeRawBlock: (url: string) => OwidRawGdocBlock
    getUrl: (block: OwidEnrichedGdocBlock) => string | undefined
}

const urlFieldCases: UrlFieldCase[] = [
    {
        name: "parseChart (shorthand string value)",
        makeRawBlock: (url) => ({ type: "chart", value: url }),
        getUrl: (block) => (block as EnrichedBlockChart).url,
    },
    {
        name: "parseChart (url property)",
        makeRawBlock: (url) => ({ type: "chart", value: { url } }),
        getUrl: (block) => (block as EnrichedBlockChart).url,
    },
    {
        name: "parseChartStory (item chart)",
        makeRawBlock: (url) => ({
            type: "chart-story",
            value: [{ narrative: "Some narrative", chart: url }],
        }),
        getUrl: (block) =>
            (block as EnrichedBlockChartStory).items[0]?.chart.url,
    },
    {
        name: "parseChartRows (row url)",
        makeRawBlock: (url) => ({
            type: "chart-rows",
            value: {
                rows: [
                    {
                        image: "some-thumbnail.png",
                        url,
                        content: [{ type: "text", value: "Some text" }],
                    },
                ],
            },
        }),
        getUrl: (block) => (block as EnrichedBlockChartRows).rows[0]?.url,
    },
    {
        name: "parsePullChart (url)",
        makeRawBlock: (url) => ({
            type: "pull-chart",
            value: {
                image: "some-thumbnail.png",
                url,
                content: [{ type: "text", value: "Some text" }],
            },
        }),
        getUrl: (block) => (block as EnrichedBlockPullChart).url,
    },
    {
        name: "parseSdgGrid (item link)",
        makeRawBlock: (url) => ({
            type: "sdg-grid",
            // Annotated because RawBlockSDGGrid["value"] is a union with
            // `string`, which makes `link` resolve to the deprecated
            // String.prototype.link and trips oxlint's no-deprecated rule.
            value: [
                { goal: "A test goal", link: url },
            ] satisfies RawSDGGridItem[],
        }),
        getUrl: (block) => (block as EnrichedBlockSDGGrid).items[0]?.link,
    },
    {
        name: "parseTopicPageIntro (download button url)",
        makeRawBlock: (url) => ({
            type: "topic-page-intro",
            value: {
                content: [{ type: "text", value: "Some text" }],
                "download-button": { text: "Download", url },
                "related-topics": undefined,
            },
        }),
        getUrl: (block) =>
            (block as EnrichedBlockTopicPageIntro).downloadButton?.url,
    },
]

const parseBlock = (raw: OwidRawGdocBlock): OwidEnrichedGdocBlock => {
    const enriched = parseRawBlocksToEnrichedBlocks(raw)
    if (!enriched) throw new Error(`Failed to parse a ${raw.type} block`)
    return enriched
}

const parseErrorsOf = (block: OwidEnrichedGdocBlock): ParseError[] =>
    (block as EnrichedBlockWithParseErrors).parseErrors

describe.each(urlFieldCases)("$name", ({ makeRawBlock, getUrl }) => {
    it("extracts the href when Google Docs has linkified the url", () => {
        const enriched = parseBlock(makeRawBlock(linkify(GRAPHER_URL)))

        expect(parseErrorsOf(enriched)).toEqual([])
        expect(getUrl(enriched)).toBe(GRAPHER_URL)
    })

    it("prefers the href over the link text when the two differ", () => {
        // A Google Docs "rich link" pill renders as an anchor whose text is the
        // page title, so the link text is not usable as a URL.
        const enriched = parseBlock(
            makeRawBlock(linkify(GRAPHER_URL, "Life expectancy"))
        )

        expect(parseErrorsOf(enriched)).toEqual([])
        expect(getUrl(enriched)).toBe(GRAPHER_URL)
    })

    it("leaves a plain url untouched", () => {
        const enriched = parseBlock(makeRawBlock(GRAPHER_URL))

        expect(parseErrorsOf(enriched)).toEqual([])
        expect(getUrl(enriched)).toBe(GRAPHER_URL)
    })

    it("passes through a value that is neither an anchor nor an absolute url", () => {
        // Relative links and bare slugs must survive: extractUrl only unwraps
        // anchors, and otherwise falls back to the trimmed input.
        const enriched = parseBlock(makeRawBlock("  /grapher/life-expectancy "))

        expect(parseErrorsOf(enriched)).toEqual([])
        expect(getUrl(enriched)).toBe("/grapher/life-expectancy")
    })
})
