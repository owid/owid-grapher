import { describe, it, expect } from "vitest"
import { enrichedBlocksToIndexableText } from "./enrichedToIndexableText.js"
import {
    BlockSize,
    EnrichedBlockChart,
    EnrichedBlockDataCallout,
    EnrichedBlockHeading,
    EnrichedBlockHtml,
    EnrichedBlockTable,
    EnrichedBlockText,
    LinkedCallouts,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { makeLinkedCalloutKey } from "@ourworldindata/utils"

describe("enrichedBlocksToIndexableText", () => {
    const makeTextBlock = (text: string): OwidEnrichedGdocBlock => ({
        type: "text",
        parseErrors: [],
        value: [{ spanType: "span-simple-text", text }],
    })

    it("should extract plaintext from text blocks", () => {
        const block: EnrichedBlockText = {
            type: "text",
            parseErrors: [],
            value: [
                { spanType: "span-simple-text", text: "Hello " },
                {
                    spanType: "span-bold",
                    children: [{ spanType: "span-simple-text", text: "world" }],
                },
            ],
        }
        expect(enrichedBlocksToIndexableText([block])).toBe("Hello world")
    })

    it("should extract plaintext from heading blocks", () => {
        const block: EnrichedBlockHeading = {
            type: "heading",
            parseErrors: [],
            level: 2,
            text: [{ spanType: "span-simple-text", text: "My Heading" }],
        }
        expect(enrichedBlocksToIndexableText([block])).toBe("My Heading")
    })

    it("should extract plaintext from heading blocks with supertitle", () => {
        const block: EnrichedBlockHeading = {
            type: "heading",
            parseErrors: [],
            level: 2,
            text: [{ spanType: "span-simple-text", text: "Main Title" }],
            supertitle: [{ spanType: "span-simple-text", text: "Supertitle" }],
        }
        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Supertitle. Main Title"
        )
    })

    it("should strip footnote reference numbers from text spans", () => {
        const block: EnrichedBlockText = {
            type: "text",
            parseErrors: [],
            value: [
                { spanType: "span-simple-text", text: "Before the footnote" },
                {
                    spanType: "span-ref",
                    url: "#note-4",
                    children: [
                        {
                            spanType: "span-superscript",
                            children: [
                                {
                                    spanType: "span-simple-text",
                                    text: "4",
                                },
                            ],
                        },
                    ],
                },
                { spanType: "span-simple-text", text: ". More content" },
            ],
        }
        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Before the footnote. More content"
        )
    })

    it("should extract plaintext from table blocks", () => {
        const block: EnrichedBlockTable = {
            type: "table",
            parseErrors: [],
            template: "header-row",
            size: "narrow",
            rows: [
                {
                    type: "table-row",
                    cells: [
                        {
                            type: "table-cell",
                            content: [
                                {
                                    type: "text",
                                    parseErrors: [],
                                    value: [
                                        {
                                            spanType: "span-simple-text",
                                            text: "A",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            type: "table-cell",
                            content: [
                                {
                                    type: "text",
                                    parseErrors: [],
                                    value: [
                                        {
                                            spanType: "span-simple-text",
                                            text: "B",
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    type: "table-row",
                    cells: [
                        {
                            type: "table-cell",
                            content: [
                                {
                                    type: "text",
                                    parseErrors: [],
                                    value: [
                                        {
                                            spanType: "span-simple-text",
                                            text: "C",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            type: "table-cell",
                            content: [
                                {
                                    type: "text",
                                    parseErrors: [],
                                    value: [
                                        {
                                            spanType: "span-simple-text",
                                            text: "D",
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        expect(enrichedBlocksToIndexableText([block])).toBe("A | B | C | D")
    })

    it("should include table caption text in plaintext output", () => {
        const block: EnrichedBlockTable = {
            type: "table",
            parseErrors: [],
            template: "header-row",
            size: "narrow",
            rows: [
                {
                    type: "table-row",
                    cells: [
                        {
                            type: "table-cell",
                            content: [
                                {
                                    type: "text",
                                    parseErrors: [],
                                    value: [
                                        {
                                            spanType: "span-simple-text",
                                            text: "Cell",
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
            caption: [{ spanType: "span-simple-text", text: "Table caption" }],
        }

        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Cell. Table caption"
        )
    })

    it("should extract text from HTML tables", () => {
        const block: EnrichedBlockHtml = {
            type: "html",
            parseErrors: [],
            value: "<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>",
        }
        expect(enrichedBlocksToIndexableText([block])).toBe("Cell 1 | Cell 2")
    })

    it("should preserve separators for list items inside HTML table cells", () => {
        const block: EnrichedBlockHtml = {
            type: "html",
            parseErrors: [],
            value: "<table><tr><td><ul><li>Item 1</li><li>Item 2</li></ul></td><td>Cell 2</td></tr></table>",
        }
        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Item 1; Item 2 | Cell 2"
        )
    })

    it("should include non-list text alongside list items in HTML table cells", () => {
        const block: EnrichedBlockHtml = {
            type: "html",
            parseErrors: [],
            value: "<table><tr><td><p>Heading text</p><ul><li>Item 1</li><li>Item 2</li></ul></td></tr></table>",
        }
        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Heading text.\n\nItem 1; Item 2"
        )
    })

    it("should include callout title and content in indexable text", () => {
        const block: OwidEnrichedGdocBlock = {
            type: "callout",
            parseErrors: [],
            title: "Key takeaway",
            text: [
                {
                    type: "text",
                    parseErrors: [],
                    value: [
                        {
                            spanType: "span-simple-text",
                            text: "Important text",
                        },
                    ],
                },
            ],
        }

        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Key takeaway. Important text"
        )
    })

    it("should include media captions", () => {
        const blocks: OwidEnrichedGdocBlock[] = [
            {
                type: "chart",
                parseErrors: [],
                url: "https://ourworldindata.org/grapher/example",
                size: BlockSize.Wide,
                caption: [{ spanType: "span-simple-text", text: "Chart cap" }],
            },
            {
                type: "narrative-chart",
                parseErrors: [],
                name: "example",
                size: BlockSize.Wide,
                caption: [
                    { spanType: "span-simple-text", text: "Narrative cap" },
                ],
            },
            {
                type: "static-viz",
                parseErrors: [],
                name: "viz",
                size: BlockSize.Wide,
                hasOutline: true,
                caption: [{ spanType: "span-simple-text", text: "Static cap" }],
            },
            {
                type: "video",
                parseErrors: [],
                url: "https://example.com/video",
                filename: "video.mp4",
                shouldLoop: false,
                shouldAutoplay: false,
                caption: [{ spanType: "span-simple-text", text: "Video cap" }],
            },
        ]

        expect(enrichedBlocksToIndexableText(blocks)).toBe(
            "Chart cap.\n\nNarrative cap.\n\nStatic cap.\n\nVideo cap"
        )
    })

    it("should include key-indicator text content", () => {
        const block: OwidEnrichedGdocBlock = {
            type: "key-indicator",
            parseErrors: [],
            datapageUrl: "/grapher/life-expectancy",
            title: "Life expectancy",
            source: "UN WPP",
            text: [
                {
                    type: "text",
                    parseErrors: [],
                    value: [
                        {
                            spanType: "span-simple-text",
                            text: "Average years lived at birth.",
                        },
                    ],
                },
            ],
        }

        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Life expectancy. Average years lived at birth. UN WPP"
        )
    })

    it("should include key-indicator-collection heading and indicator content", () => {
        const block: OwidEnrichedGdocBlock = {
            type: "key-indicator-collection",
            parseErrors: [],
            heading: "Core indicators",
            subtitle: "Global snapshot",
            blocks: [
                {
                    type: "key-indicator",
                    parseErrors: [],
                    datapageUrl: "/grapher/population",
                    title: "Population",
                    text: [
                        {
                            type: "text",
                            parseErrors: [],
                            value: [
                                {
                                    spanType: "span-simple-text",
                                    text: "Total population in latest year.",
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Core indicators. Global snapshot. Population. Total population in latest year."
        )
    })

    it("should include chart-story narrative and technical text but not chart URLs", () => {
        const block: OwidEnrichedGdocBlock = {
            type: "chart-story",
            parseErrors: [],
            items: [
                {
                    narrative: {
                        type: "text",
                        parseErrors: [],
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "Narrative step one",
                            },
                        ],
                    },
                    chart: {
                        type: "chart",
                        parseErrors: [],
                        url: "https://ourworldindata.org/grapher/example-chart",
                        size: BlockSize.Wide,
                    },
                    technical: [
                        {
                            type: "text",
                            parseErrors: [],
                            value: [
                                {
                                    spanType: "span-simple-text",
                                    text: "Technical note A",
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Narrative step one. Technical note A"
        )
    })

    it("should return undefined for component blocks", () => {
        const block: EnrichedBlockChart = {
            type: "chart",
            parseErrors: [],
            url: "https://ourworldindata.org/grapher/example",
            size: BlockSize.Wide,
        }
        expect(enrichedBlocksToIndexableText([block])).toBeUndefined()
    })

    it("should include image alt and caption in plaintext output", () => {
        const blocks: OwidEnrichedGdocBlock[] = [
            {
                type: "text",
                parseErrors: [],
                value: [{ spanType: "span-simple-text", text: "Before" }],
            },
            {
                type: "image",
                parseErrors: [],
                filename: "example.png",
                alt: "Example image",
                size: BlockSize.Wide,
                hasOutline: true,
                caption: [
                    { spanType: "span-simple-text", text: "First line" },
                    { spanType: "span-newline" },
                    { spanType: "span-simple-text", text: "Second line" },
                ],
            },
            {
                type: "text",
                parseErrors: [],
                value: [{ spanType: "span-simple-text", text: "After" }],
            },
        ]

        expect(enrichedBlocksToIndexableText(blocks)).toBe(
            "Before.\n\nExample image. First line Second line.\n\nAfter"
        )
    })

    it("should return undefined for undefined input", () => {
        expect(enrichedBlocksToIndexableText(undefined)).toBeUndefined()
    })

    it("should include blockquote citation text in plaintext output", () => {
        const block: OwidEnrichedGdocBlock = {
            type: "blockquote",
            parseErrors: [],
            text: [
                {
                    type: "text",
                    parseErrors: [],
                    value: [
                        { spanType: "span-simple-text", text: "Quote text" },
                    ],
                },
            ],
            citation: "Citation source",
        }

        expect(enrichedBlocksToIndexableText([block])).toBe(
            "Quote text; Citation source"
        )
    })

    it("should resolve data-callout span-callout values from linkedCallouts", () => {
        const url = "/grapher/co2-emissions?country=USA"
        const linkedCallouts: LinkedCallouts = {
            [makeLinkedCalloutKey(url)]: {
                url,
                values: {
                    source: "test",
                    columns: {
                        "123": {
                            name: "CO2 Emissions",
                            shortName: "co2_emissions",
                        },
                    },
                    endValues: {
                        y: [
                            {
                                columnSlug: "123",
                                formattedValueShort: "5.2 billion tonnes",
                                formattedTime: "2022",
                            },
                        ],
                    },
                },
            },
        }

        const textBlock: EnrichedBlockText = {
            type: "text",
            parseErrors: [],
            value: [
                { spanType: "span-simple-text", text: "CO2 emissions: " },
                {
                    spanType: "span-callout",
                    functionName: "latestValueWithUnit",
                    parameters: ["co2_emissions"],
                    children: [{ spanType: "span-simple-text", text: "" }],
                },
                { spanType: "span-simple-text", text: " in " },
                {
                    spanType: "span-callout",
                    functionName: "latestTime",
                    parameters: ["co2_emissions"],
                    children: [{ spanType: "span-simple-text", text: "" }],
                },
            ],
        }

        const dataCalloutBlock: EnrichedBlockDataCallout = {
            type: "data-callout",
            parseErrors: [],
            url,
            content: [textBlock],
        }

        expect(
            enrichedBlocksToIndexableText([dataCalloutBlock], {
                linkedCallouts,
            })
        ).toBe("CO2 emissions: 5.2 billion tonnes in 2022")
    })

    it("should filter out data-callout when linkedCallouts option is not provided", () => {
        const dataCalloutBlock: EnrichedBlockDataCallout = {
            type: "data-callout",
            parseErrors: [],
            url: "/grapher/co2-emissions?country=USA",
            content: [
                {
                    type: "text",
                    parseErrors: [],
                    value: [
                        { spanType: "span-simple-text", text: "Value: " },
                        {
                            spanType: "span-callout",
                            functionName: "latestValue",
                            parameters: ["co2_emissions"],
                            children: [
                                { spanType: "span-simple-text", text: "" },
                            ],
                        },
                    ],
                },
            ],
        }

        expect(
            enrichedBlocksToIndexableText([dataCalloutBlock])
        ).toBeUndefined()
    })

    it("should filter out data-callout when linkedCallouts is missing required data", () => {
        const dataCalloutBlock: EnrichedBlockDataCallout = {
            type: "data-callout",
            parseErrors: [],
            url: "/grapher/co2-emissions?country=USA",
            content: [
                {
                    type: "text",
                    parseErrors: [],
                    value: [
                        { spanType: "span-simple-text", text: "Value: " },
                        {
                            spanType: "span-callout",
                            functionName: "latestValue",
                            parameters: ["co2_emissions"],
                            children: [
                                { spanType: "span-simple-text", text: "" },
                            ],
                        },
                    ],
                },
            ],
        }

        expect(
            enrichedBlocksToIndexableText([dataCalloutBlock], {
                linkedCallouts: {},
            })
        ).toBeUndefined()
    })

    it("should skip component blocks and return remaining text", () => {
        const blocks: OwidEnrichedGdocBlock[] = [
            {
                type: "text",
                parseErrors: [],
                value: [{ spanType: "span-simple-text", text: "Before" }],
            },
            {
                type: "chart",
                parseErrors: [],
                url: "https://example.com",
                size: BlockSize.Wide,
            },
            {
                type: "text",
                parseErrors: [],
                value: [{ spanType: "span-simple-text", text: "After" }],
            },
        ]
        expect(enrichedBlocksToIndexableText(blocks)).toBe("Before.\n\nAfter")
    })

    it("should preserve spacing around list content", () => {
        const blocks: OwidEnrichedGdocBlock[] = [
            {
                type: "text",
                parseErrors: [],
                value: [{ spanType: "span-simple-text", text: "Before" }],
            },
            {
                type: "list",
                parseErrors: [],
                items: [
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            { spanType: "span-simple-text", text: "Item1" },
                        ],
                    },
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            { spanType: "span-simple-text", text: "Item2" },
                        ],
                    },
                ],
            },
            {
                type: "text",
                parseErrors: [],
                value: [{ spanType: "span-simple-text", text: "After" }],
            },
        ]
        expect(enrichedBlocksToIndexableText(blocks)).toBe(
            "Before.\n\nItem1; Item2.\n\nAfter"
        )
    })

    it("should avoid duplicating semicolons when list items already end with semicolons", () => {
        const blocks: OwidEnrichedGdocBlock[] = [
            {
                type: "list",
                parseErrors: [],
                items: [
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            { spanType: "span-simple-text", text: "Item1;" },
                        ],
                    },
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            { spanType: "span-simple-text", text: "Item2" },
                        ],
                    },
                ],
            },
        ]

        expect(enrichedBlocksToIndexableText(blocks)).toBe("Item1; Item2")
    })

    it("should add sentence separators only when the first block lacks terminal punctuation", () => {
        const cases: Array<{
            first: string
            second: string
            expected: string
        }> = [
            // Ends with `?`, so regex matches and we keep a plain paragraph join (`\n\n`).
            {
                first: "Why now?",
                second: "Because later.",
                expected: "Why now?\n\nBecause later.",
            },
            // Ends with `."` (punctuation + closing quote), so regex still matches.
            {
                first: 'He said "stop."',
                second: "Then left",
                expected: 'He said "stop."\n\nThen left',
            },
            // Ends with `.”` (punctuation + smart closing quote), so regex matches.
            {
                first: "text with preceding”.”",
                second: "Next text",
                expected: "text with preceding”.”\n\nNext text",
            },
            // Ends with `?)` (punctuation + closing paren), so regex still matches.
            {
                first: "Really?)",
                second: "Yes",
                expected: "Really?)\n\nYes",
            },
            // Contains `;` internally but does not end with punctuation, so we add `. `.
            {
                first: "One; two",
                second: "three",
                expected: "One; two.\n\nthree",
            },
            // No terminal punctuation, so we add `. ` between parts.
            {
                first: "No punctuation",
                second: "Next",
                expected: "No punctuation.\n\nNext",
            },
        ]

        for (const { first, second, expected } of cases) {
            const blocks: OwidEnrichedGdocBlock[] = [
                makeTextBlock(first),
                makeTextBlock(second),
            ]
            expect(enrichedBlocksToIndexableText(blocks)).toBe(expected)
        }
    })
})
