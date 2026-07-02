import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import { Node as PmNode } from "@tiptap/pm/model"
import { BlockSize, OwidEnrichedGdocBlock, Span } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../extensions.js"
import {
    enrichedBlocksToPmDoc,
    pmDocToEnrichedBlocks,
} from "./serialization.js"
import { enrichedBodiesMatch } from "./normalizeForComparison.js"
import { runsToSpanTree, spanTreeToRuns } from "./spanRuns.js"

// The exhaustive sweep over every example block type lives in
// adminSiteServer/richEditorRoundtrip.test.ts (it needs fixtures from db/).
// These tests cover the serialization behavior itself.

function roundTrip(blocks: OwidEnrichedGdocBlock[]): OwidEnrichedGdocBlock[] {
    return pmDocToEnrichedBlocks(enrichedBlocksToPmDoc(blocks))
}

describe("enriched ⇄ ProseMirror serialization", () => {
    const schema = getSchema(getRichEditorBaseExtensions())

    it("round-trips an empty body (schema allows an empty doc)", () => {
        const pmDoc = enrichedBlocksToPmDoc([])
        expect(() => PmNode.fromJSON(schema, pmDoc).check()).not.toThrow()
        expect(pmDocToEnrichedBlocks(pmDoc)).toEqual([])
    })

    it("round-trips nested formatting spans", () => {
        const value: Span[] = [
            { spanType: "span-simple-text", text: "Plain " },
            {
                spanType: "span-bold",
                children: [
                    { spanType: "span-simple-text", text: "bold " },
                    {
                        spanType: "span-link",
                        url: "https://ourworldindata.org",
                        children: [
                            {
                                spanType: "span-italic",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "bold italic link",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            { spanType: "span-newline" },
            {
                spanType: "span-dod",
                id: "gdp",
                children: [{ spanType: "span-simple-text", text: "GDP" }],
            },
        ]
        const original: OwidEnrichedGdocBlock[] = [
            { type: "text", value, parseErrors: [] },
        ]
        expect(enrichedBodiesMatch(original, roundTrip(original))).toBe(true)
    })

    it("drops empty text spans without breaking equality", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "text",
                value: [
                    { spanType: "span-simple-text", text: "" },
                    { spanType: "span-simple-text", text: "kept" },
                ],
                parseErrors: [],
            },
        ]
        expect(enrichedBodiesMatch(original, roundTrip(original))).toBe(true)
    })

    it("round-trips a data-insight-shaped document", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "image",
                filename: "test.png",
                smallFilename: "test-small.png",
                size: BlockSize.Narrow,
                hasOutline: false,
                preferSmallFilename: true,
                parseErrors: [],
            },
            {
                type: "text",
                value: [
                    { spanType: "span-simple-text", text: "Some insight " },
                    {
                        spanType: "span-bold",
                        children: [
                            { spanType: "span-simple-text", text: "text" },
                        ],
                    },
                ],
                parseErrors: [],
            },
            { type: "horizontal-rule", value: {}, parseErrors: [] },
            {
                type: "cta",
                text: "Explore the data",
                url: "https://ourworldindata.org/grapher/life-expectancy",
                parseErrors: [],
            },
        ]
        const pmDoc = enrichedBlocksToPmDoc(original)
        expect(() => PmNode.fromJSON(schema, pmDoc).check()).not.toThrow()
        expect(
            enrichedBodiesMatch(original, pmDocToEnrichedBlocks(pmDoc))
        ).toBe(true)
    })

    it("treats a blockquote with an empty citation as equal", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "blockquote",
                citation: "",
                text: [
                    {
                        type: "text",
                        value: [
                            { spanType: "span-simple-text", text: "Quote" },
                        ],
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            },
        ]
        expect(enrichedBodiesMatch(original, roundTrip(original))).toBe(true)
    })

    it("round-trips chart blocks as first-class props atoms", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "chart",
                url: "https://ourworldindata.org/grapher/life-expectancy?tab=map",
                size: BlockSize.Wide,
                height: "700",
                caption: [
                    { spanType: "span-simple-text", text: "Life expectancy, " },
                    {
                        spanType: "span-italic",
                        children: [
                            { spanType: "span-simple-text", text: "at birth" },
                        ],
                    },
                ],
                parseErrors: [],
            },
        ]
        const pmDoc = enrichedBlocksToPmDoc(original)
        expect(pmDoc.content?.[0].type).toBe("chart")
        expect(() => PmNode.fromJSON(schema, pmDoc).check()).not.toThrow()
        expect(roundTrip(original)).toEqual(original)
    })

    it("round-trips sticky-right with nested content in both columns", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "sticky-right",
                left: [
                    {
                        type: "text",
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "Prose on the left",
                            },
                        ],
                        parseErrors: [],
                    },
                    {
                        type: "heading",
                        level: 2,
                        text: [
                            { spanType: "span-simple-text", text: "Section" },
                        ],
                        parseErrors: [],
                    },
                ],
                right: [
                    {
                        type: "chart",
                        url: "https://ourworldindata.org/grapher/co2",
                        size: BlockSize.Wide,
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            },
        ]
        const pmDoc = enrichedBlocksToPmDoc(original)
        expect(() => PmNode.fromJSON(schema, pmDoc).check()).not.toThrow()
        expect(enrichedBodiesMatch(original, roundTrip(original))).toBe(true)
    })

    it("round-trips gray sections, asides and expandable paragraphs", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "gray-section",
                items: [
                    {
                        type: "text",
                        value: [
                            { spanType: "span-simple-text", text: "Shaded" },
                        ],
                        parseErrors: [],
                    },
                    {
                        type: "chart",
                        url: "https://ourworldindata.org/grapher/co2",
                        size: BlockSize.Wide,
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            },
            {
                type: "aside",
                position: "right" as never,
                caption: [
                    { spanType: "span-simple-text", text: "A margin note" },
                ],
                parseErrors: [],
            },
            {
                type: "expandable-paragraph",
                items: [
                    {
                        type: "text",
                        value: [
                            { spanType: "span-simple-text", text: "Hidden" },
                        ],
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            },
        ]
        const pmDoc = enrichedBlocksToPmDoc(original)
        expect(() => PmNode.fromJSON(schema, pmDoc).check()).not.toThrow()
        expect(enrichedBodiesMatch(original, roundTrip(original))).toBe(true)
    })

    it("keeps unsupported blocks nested inside containers as raw blocks", () => {
        const original: OwidEnrichedGdocBlock[] = [
            {
                type: "gray-section",
                items: [
                    {
                        type: "sdg-grid",
                        items: [{ goal: "No poverty", link: "https://x" }],
                        parseErrors: [],
                    } as never,
                ],
                parseErrors: [],
            },
        ]
        const pmDoc = enrichedBlocksToPmDoc(original)
        expect(pmDoc.content?.[0].content?.[0].type).toBe("rawBlock")
        expect(enrichedBodiesMatch(original, roundTrip(original))).toBe(true)
    })
})

describe("span runs", () => {
    it("flatten → rebuild → flatten is stable", () => {
        const spans: Span[] = [
            {
                spanType: "span-italic",
                children: [
                    {
                        spanType: "span-bold",
                        children: [{ spanType: "span-simple-text", text: "a" }],
                    },
                    { spanType: "span-simple-text", text: "b" },
                ],
            },
            {
                spanType: "span-bold",
                children: [{ spanType: "span-simple-text", text: "c" }],
            },
        ]
        const runs = spanTreeToRuns(spans)
        const rebuilt = runsToSpanTree(runs)
        expect(spanTreeToRuns(rebuilt)).toEqual(runs)
    })

    it("merges adjacent equally-formatted text", () => {
        const spans: Span[] = [
            {
                spanType: "span-bold",
                children: [{ spanType: "span-simple-text", text: "a" }],
            },
            {
                spanType: "span-bold",
                children: [{ spanType: "span-simple-text", text: "b" }],
            },
        ]
        expect(spanTreeToRuns(spans)).toEqual([
            { kind: "text", text: "ab", marks: [{ type: "bold" }] },
        ])
    })
})
