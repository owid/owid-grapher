import { describe, it, expect } from "vitest"
import {
    spanToXhtml,
    spansToXhtml,
    enrichedBlockToXhtml,
    enrichedBlocksToXhtmlDocument,
} from "./enrichedToXhtml.js"
import { xhtmlToSpans, xhtmlToRawBlocks } from "./xhtmlToEnriched.js"
import {
    parseRawBlocksToEnrichedBlocks,
    parseSimpleText,
} from "./rawToEnriched.js"
import {
    Span,
    OwidEnrichedGdocBlock,
    EnrichedBlockText,
    EnrichedBlockHeading,
    EnrichedBlockChart,
    EnrichedBlockImage,
    EnrichedBlockList,
    EnrichedBlockTable,
    EnrichedBlockCallout,
    EnrichedBlockSideBySideContainer,
    EnrichedBlockKeyInsights,
    BlockSize,
    omitUndefinedValues,
    RawBlockText,
} from "@ourworldindata/utils"
import { enrichedBlockExamples } from "./exampleEnrichedBlocks.js"

describe("spanToXhtml", () => {
    describe("simple text", () => {
        it("escapes special XML characters", () => {
            const span: Span = {
                spanType: "span-simple-text",
                text: 'Hello <world> & "friends"',
            }
            // Note: quotes don't need escaping in XML content, only in attribute values
            expect(spanToXhtml(span)).toBe(
                'Hello &lt;world&gt; &amp; "friends"'
            )
        })

        it("handles empty text", () => {
            const span: Span = { spanType: "span-simple-text", text: "" }
            expect(spanToXhtml(span)).toBe("")
        })
    })

    describe("formatting spans", () => {
        it("converts bold", () => {
            const span: Span = {
                spanType: "span-bold",
                children: [{ spanType: "span-simple-text", text: "bold text" }],
            }
            expect(spanToXhtml(span)).toBe("<b>bold text</b>")
        })

        it("converts italic", () => {
            const span: Span = {
                spanType: "span-italic",
                children: [
                    { spanType: "span-simple-text", text: "italic text" },
                ],
            }
            expect(spanToXhtml(span)).toBe("<i>italic text</i>")
        })

        it("converts underline", () => {
            const span: Span = {
                spanType: "span-underline",
                children: [
                    { spanType: "span-simple-text", text: "underlined text" },
                ],
            }
            expect(spanToXhtml(span)).toBe("<u>underlined text</u>")
        })

        it("converts subscript", () => {
            const span: Span = {
                spanType: "span-subscript",
                children: [{ spanType: "span-simple-text", text: "2" }],
            }
            expect(spanToXhtml(span)).toBe("<sub>2</sub>")
        })

        it("converts superscript", () => {
            const span: Span = {
                spanType: "span-superscript",
                children: [{ spanType: "span-simple-text", text: "2" }],
            }
            expect(spanToXhtml(span)).toBe("<sup>2</sup>")
        })

        it("converts quote", () => {
            const span: Span = {
                spanType: "span-quote",
                children: [
                    { spanType: "span-simple-text", text: "quoted text" },
                ],
            }
            expect(spanToXhtml(span)).toBe("<q>quoted text</q>")
        })

        it("converts newline", () => {
            const span: Span = { spanType: "span-newline" }
            expect(spanToXhtml(span)).toBe("<br/>")
        })
    })

    describe("link spans", () => {
        it("converts link", () => {
            const span: Span = {
                spanType: "span-link",
                url: "https://example.com",
                children: [{ spanType: "span-simple-text", text: "link text" }],
            }
            expect(spanToXhtml(span)).toBe(
                '<a href="https://example.com">link text</a>'
            )
        })

        it("converts ref", () => {
            const span: Span = {
                spanType: "span-ref",
                url: "#footnote-1",
                children: [{ spanType: "span-simple-text", text: "1" }],
            }
            expect(spanToXhtml(span)).toBe('<ref url="#footnote-1">1</ref>')
        })

        it("converts dod", () => {
            const span: Span = {
                spanType: "span-dod",
                id: "gdp-definition",
                children: [{ spanType: "span-simple-text", text: "GDP" }],
            }
            expect(spanToXhtml(span)).toBe('<dod id="gdp-definition">GDP</dod>')
        })

        it("converts guided-chart-link", () => {
            const span: Span = {
                spanType: "span-guided-chart-link",
                url: "#chart-section",
                children: [{ spanType: "span-simple-text", text: "see chart" }],
            }
            expect(spanToXhtml(span)).toBe(
                '<glink url="#chart-section">see chart</glink>'
            )
        })
    })

    describe("nested spans", () => {
        it("handles nested formatting", () => {
            const span: Span = {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: "bold italic",
                            },
                        ],
                    },
                ],
            }
            expect(spanToXhtml(span)).toBe("<b><i>bold italic</i></b>")
        })

        it("handles link with formatting inside", () => {
            const span: Span = {
                spanType: "span-link",
                url: "https://example.com",
                children: [
                    {
                        spanType: "span-bold",
                        children: [
                            { spanType: "span-simple-text", text: "bold link" },
                        ],
                    },
                ],
            }
            expect(spanToXhtml(span)).toBe(
                '<a href="https://example.com"><b>bold link</b></a>'
            )
        })
    })

    describe("fallback span", () => {
        it("strips fallback wrapper", () => {
            const span: Span = {
                spanType: "span-fallback",
                children: [{ spanType: "span-simple-text", text: "text" }],
            }
            expect(spanToXhtml(span)).toBe("text")
        })
    })
})

describe("spansToXhtml", () => {
    it("concatenates multiple spans", () => {
        const spans: Span[] = [
            { spanType: "span-simple-text", text: "Hello " },
            {
                spanType: "span-bold",
                children: [{ spanType: "span-simple-text", text: "world" }],
            },
            { spanType: "span-simple-text", text: "!" },
        ]
        expect(spansToXhtml(spans)).toBe("Hello <b>world</b>!")
    })

    it("handles empty array", () => {
        expect(spansToXhtml([])).toBe("")
    })
})

describe("enrichedBlockToXhtml", () => {
    describe("text blocks", () => {
        it("converts text block", () => {
            const block: EnrichedBlockText = {
                type: "text",
                value: [{ spanType: "span-simple-text", text: "Hello world" }],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe("<text>Hello world</text>")
        })

        it("converts text block with formatting", () => {
            const block: EnrichedBlockText = {
                type: "text",
                value: [
                    { spanType: "span-simple-text", text: "Hello " },
                    {
                        spanType: "span-bold",
                        children: [
                            { spanType: "span-simple-text", text: "world" },
                        ],
                    },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                "<text>Hello <b>world</b></text>"
            )
        })
    })

    describe("heading block", () => {
        it("converts heading with level", () => {
            const block: EnrichedBlockHeading = {
                type: "heading",
                level: 2,
                text: [{ spanType: "span-simple-text", text: "Section Title" }],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<heading level="2">Section Title</heading>'
            )
        })

        it("includes supertitle when present", () => {
            const block: EnrichedBlockHeading = {
                type: "heading",
                level: 1,
                text: [{ spanType: "span-simple-text", text: "Main Title" }],
                supertitle: [
                    { spanType: "span-simple-text", text: "Supertitle" },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<heading level="1" supertitle="Supertitle">Main Title</heading>'
            )
        })
    })

    describe("chart block", () => {
        it("converts chart with url only", () => {
            const block: EnrichedBlockChart = {
                type: "chart",
                url: "https://ourworldindata.org/grapher/population",
                size: BlockSize.Wide,
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<chart url="https://ourworldindata.org/grapher/population"/>'
            )
        })

        it("converts chart with all properties", () => {
            const block: EnrichedBlockChart = {
                type: "chart",
                url: "https://ourworldindata.org/grapher/population",
                height: "400",
                size: BlockSize.Narrow,
                caption: [
                    { spanType: "span-simple-text", text: "Chart caption" },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<chart url="https://ourworldindata.org/grapher/population" height="400" size="narrow"><caption>Chart caption</caption></chart>'
            )
        })
    })

    describe("image block", () => {
        it("converts image with required properties", () => {
            const block: EnrichedBlockImage = {
                type: "image",
                filename: "image.png",
                alt: "An image",
                size: BlockSize.Wide,
                hasOutline: true,
                parseErrors: [],
            }
            // hasOutline is always included for round-trip fidelity
            expect(enrichedBlockToXhtml(block)).toBe(
                '<image filename="image.png" alt="An image" hasOutline="true"/>'
            )
        })

        it("converts image with non-default values", () => {
            const block: EnrichedBlockImage = {
                type: "image",
                filename: "image.png",
                alt: "An image",
                size: BlockSize.Narrow,
                hasOutline: false,
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<image filename="image.png" alt="An image" size="narrow" hasOutline="false"/>'
            )
        })
    })

    describe("list block", () => {
        it("converts unordered list", () => {
            const block: EnrichedBlockList = {
                type: "list",
                items: [
                    {
                        type: "text",
                        value: [
                            { spanType: "span-simple-text", text: "Item 1" },
                        ],
                        parseErrors: [],
                    },
                    {
                        type: "text",
                        value: [
                            { spanType: "span-simple-text", text: "Item 2" },
                        ],
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                "<list><li>Item 1</li><li>Item 2</li></list>"
            )
        })
    })

    describe("table block", () => {
        it("converts table", () => {
            const block: EnrichedBlockTable = {
                type: "table",
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
                                        value: [
                                            {
                                                spanType: "span-simple-text",
                                                text: "Header",
                                            },
                                        ],
                                        parseErrors: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                "<table><row><cell><text>Header</text></cell></row></table>"
            )
        })
    })

    describe("callout block", () => {
        it("converts callout", () => {
            const block: EnrichedBlockCallout = {
                type: "callout",
                title: "Note",
                icon: "info",
                text: [
                    {
                        type: "text",
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "Important info",
                            },
                        ],
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<callout icon="info" title="Note"><text>Important info</text></callout>'
            )
        })
    })

    describe("layout blocks", () => {
        it("converts side-by-side", () => {
            const block: EnrichedBlockSideBySideContainer = {
                type: "side-by-side",
                left: [
                    {
                        type: "text",
                        value: [{ spanType: "span-simple-text", text: "Left" }],
                        parseErrors: [],
                    },
                ],
                right: [
                    {
                        type: "text",
                        value: [
                            { spanType: "span-simple-text", text: "Right" },
                        ],
                        parseErrors: [],
                    },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                "<side-by-side><left><text>Left</text></left><right><text>Right</text></right></side-by-side>"
            )
        })
    })

    describe("key-insights block", () => {
        it("converts key-insights", () => {
            const block: EnrichedBlockKeyInsights = {
                type: "key-insights",
                heading: "Key findings",
                insights: [
                    {
                        type: "key-insight-slide",
                        title: "Insight 1",
                        url: "https://ourworldindata.org/grapher/test",
                        content: [
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Content",
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                    },
                ],
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe(
                '<key-insights heading="Key findings"><slide title="Insight 1" url="https://ourworldindata.org/grapher/test"><text>Content</text></slide></key-insights>'
            )
        })
    })

    describe("self-closing blocks", () => {
        it("converts horizontal-rule", () => {
            const block: OwidEnrichedGdocBlock = {
                type: "horizontal-rule",
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe("<horizontal-rule/>")
        })

        it("converts donors", () => {
            const block: OwidEnrichedGdocBlock = {
                type: "donors",
                parseErrors: [],
            }
            expect(enrichedBlockToXhtml(block)).toBe("<donors/>")
        })
    })
})

describe("enrichedBlocksToXhtmlDocument", () => {
    it("wraps blocks in document structure", () => {
        const blocks: OwidEnrichedGdocBlock[] = [
            {
                type: "text",
                value: [{ spanType: "span-simple-text", text: "Hello" }],
                parseErrors: [],
            },
        ]
        const doc = enrichedBlocksToXhtmlDocument(blocks)
        expect(doc).toContain('<?xml version="1.0" encoding="UTF-8"?>')
        expect(doc).toContain('<gdoc xmlns="urn:owid:gdoc:v1">')
        expect(doc).toContain("<text>Hello</text>")
        expect(doc).toContain("</gdoc>")
    })
})

describe("round-trip: span serialization and deserialization", () => {
    const roundTripSpan = (span: Span): Span[] => {
        const xhtml = spanToXhtml(span)
        return xhtmlToSpans(xhtml)
    }

    it("round-trips simple text", () => {
        const span: Span = { spanType: "span-simple-text", text: "Hello world" }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips bold text", () => {
        const span: Span = {
            spanType: "span-bold",
            children: [{ spanType: "span-simple-text", text: "bold" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips italic text", () => {
        const span: Span = {
            spanType: "span-italic",
            children: [{ spanType: "span-simple-text", text: "italic" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips underline text", () => {
        const span: Span = {
            spanType: "span-underline",
            children: [{ spanType: "span-simple-text", text: "underlined" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips subscript", () => {
        const span: Span = {
            spanType: "span-subscript",
            children: [{ spanType: "span-simple-text", text: "2" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips superscript", () => {
        const span: Span = {
            spanType: "span-superscript",
            children: [{ spanType: "span-simple-text", text: "2" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips quote", () => {
        const span: Span = {
            spanType: "span-quote",
            children: [{ spanType: "span-simple-text", text: "quoted" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips newline", () => {
        const span: Span = { spanType: "span-newline" }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips link", () => {
        const span: Span = {
            spanType: "span-link",
            url: "https://example.com",
            children: [{ spanType: "span-simple-text", text: "link" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips ref", () => {
        const span: Span = {
            spanType: "span-ref",
            url: "#fn1",
            children: [{ spanType: "span-simple-text", text: "1" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips dod", () => {
        const span: Span = {
            spanType: "span-dod",
            id: "term-id",
            children: [{ spanType: "span-simple-text", text: "term" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips guided-chart-link", () => {
        const span: Span = {
            spanType: "span-guided-chart-link",
            url: "#guide",
            children: [{ spanType: "span-simple-text", text: "guide" }],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips nested spans", () => {
        const span: Span = {
            spanType: "span-bold",
            children: [
                {
                    spanType: "span-italic",
                    children: [
                        { spanType: "span-simple-text", text: "nested" },
                    ],
                },
            ],
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })

    it("round-trips multiple spans", () => {
        const spans: Span[] = [
            { spanType: "span-simple-text", text: "Hello " },
            {
                spanType: "span-bold",
                children: [{ spanType: "span-simple-text", text: "world" }],
            },
            { spanType: "span-simple-text", text: "!" },
        ]
        const xhtml = spansToXhtml(spans)
        const result = xhtmlToSpans(xhtml)
        expect(result).toEqual(spans)
    })

    it("round-trips special characters", () => {
        const span: Span = {
            spanType: "span-simple-text",
            text: "Test <tag> & 'quote'",
        }
        const result = roundTripSpan(span)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(span)
    })
})

describe("round-trip: block serialization and deserialization", () => {
    const roundTripBlock = (
        block: OwidEnrichedGdocBlock
    ): OwidEnrichedGdocBlock | null => {
        const xhtml = enrichedBlockToXhtml(block)
        const rawBlocks = xhtmlToRawBlocks(xhtml)
        expect(rawBlocks).toHaveLength(1)
        return parseRawBlocksToEnrichedBlocks(rawBlocks[0])
    }

    it("round-trips text block", () => {
        const block: EnrichedBlockText = {
            type: "text",
            value: [
                { spanType: "span-simple-text", text: "Hello " },
                {
                    spanType: "span-bold",
                    children: [{ spanType: "span-simple-text", text: "world" }],
                },
            ],
            parseErrors: [],
        }
        const result = roundTripBlock(block)
        expect(result?.type).toBe("text")
        // The round-trip produces equivalent output but may have different parseErrors array reference
        expect((result as EnrichedBlockText).value).toEqual(block.value)
    })

    it("round-trips heading block", () => {
        const block: EnrichedBlockHeading = {
            type: "heading",
            level: 2,
            text: [{ spanType: "span-simple-text", text: "Title" }],
            parseErrors: [],
        }
        const result = roundTripBlock(block)
        expect(result?.type).toBe("heading")
        expect((result as EnrichedBlockHeading).level).toBe(2)
        expect((result as EnrichedBlockHeading).text).toEqual(block.text)
    })

    it("round-trips horizontal-rule", () => {
        const block: OwidEnrichedGdocBlock = {
            type: "horizontal-rule",
            parseErrors: [],
        }
        const result = roundTripBlock(block)
        expect(result?.type).toBe("horizontal-rule")
    })

    it("round-trips list block", () => {
        const block: EnrichedBlockList = {
            type: "list",
            items: [
                {
                    type: "text",
                    value: [{ spanType: "span-simple-text", text: "Item 1" }],
                    parseErrors: [],
                },
                {
                    type: "text",
                    value: [{ spanType: "span-simple-text", text: "Item 2" }],
                    parseErrors: [],
                },
            ],
            parseErrors: [],
        }
        const result = roundTripBlock(block)
        expect(result?.type).toBe("list")
        expect((result as EnrichedBlockList).items).toHaveLength(2)
    })
})

describe("comprehensive round-trip tests for all block types", () => {
    it.each(Object.values(enrichedBlockExamples))(
        "XHTML round-trip should be equal for block type $type",
        (example) => {
            const xhtml = enrichedBlockToXhtml(example)
            const rawBlocks = xhtmlToRawBlocks(xhtml)

            expect(rawBlocks).toHaveLength(1)

            let deserializedEnrichedBlocks = rawBlocks.map(
                parseRawBlocksToEnrichedBlocks
            )

            if (example.type === "simple-text") {
                // RawBlockText blocks are always parsed to EnrichedBlockText, never automatically
                // to EnrichedBlockSimpleText. So we need to manually parse them here.
                deserializedEnrichedBlocks = [
                    parseSimpleText(rawBlocks[0] as RawBlockText),
                ]
            }

            expect(deserializedEnrichedBlocks).toHaveLength(1)
            expect(deserializedEnrichedBlocks[0]).not.toBeNull()

            // Compare with omitUndefinedValues to handle normalization during round-trip
            expect(omitUndefinedValues(deserializedEnrichedBlocks[0])).toEqual(
                omitUndefinedValues(example)
            )
        }
    )
})
