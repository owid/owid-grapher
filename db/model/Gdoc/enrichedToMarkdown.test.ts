import { describe, it, expect } from "vitest"
import {
    enrichedBlocksToMarkdown,
    stripCustomMarkdownComponents,
} from "./enrichedToMarkdown.js"
import {
    EnrichedBlockDataCallout,
    EnrichedBlockText,
    LinkedCallouts,
} from "@ourworldindata/types"
import { makeLinkedCalloutKey } from "@ourworldindata/utils"

describe("stripCustomMarkdownComponents", () => {
    describe("single-line components", () => {
        it("should strip single-line components", () => {
            const content = `Some text\n<Image filename="test.png" alt="Test"/>\nMore text`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("Some text\n\nMore text")
        })

        it("should strip multiple single-line components", () => {
            const content = `Text before
<Image filename="img1.png" alt="First"/>
Some middle text
<Chart url="https://example.com"/>
Text after`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("Text before\n\nSome middle text\n\nText after")
        })
    })

    describe("multiline components", () => {
        it("should strip multiline components", () => {
            const content = `Before text
<AdditionalCharts>
* Chart 1
* Chart 2
</AdditionalCharts>
After text`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("Before text\n\nAfter text")
        })

        it("should handle multiple multiline components", () => {
            const content = `<AdditionalCharts>
* Chart A
</AdditionalCharts>
Middle text
<KeyIndicatorCollection>
Content here
</KeyIndicatorCollection>`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("\nMiddle text\n")
        })
    })

    describe("mixed components", () => {
        it("should strip both single-line and multiline components", () => {
            const content = `# Heading

Some text here

<Image filename="test.png" alt="Test"/>

More content

<AdditionalCharts>
* Chart 1
* Chart 2
</AdditionalCharts>

<Video url="https://example.com/video.mp4"/>

Final text`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe(`# Heading

Some text here



More content





Final text`)
        })
    })
})

describe("enrichedBlocksToMarkdown", () => {
    describe("data-callout with linkedCallouts", () => {
        it("should resolve span-callout values from linkedCallouts", () => {
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
                                    formattedValue: "5.2 billion tonnes",
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
                        functionName: "latestValue",
                        parameters: ["co2_emissions"],
                        children: [{ spanType: "span-simple-text", text: "" }],
                    },
                    { spanType: "span-simple-text", text: " in " },
                    {
                        spanType: "span-callout",
                        functionName: "latestYear",
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

            const result = enrichedBlocksToMarkdown([dataCalloutBlock], false, {
                linkedCallouts,
            })

            expect(result).toBe("CO2 emissions: 5.2 billion tonnes in 2022")
        })

        it("should filter out data-callout when linkedCallouts option is not provided", () => {
            const url = "/grapher/co2-emissions?country=USA"

            const textBlock: EnrichedBlockText = {
                type: "text",
                parseErrors: [],
                value: [
                    { spanType: "span-simple-text", text: "Value: " },
                    {
                        spanType: "span-callout",
                        functionName: "latestValue",
                        parameters: ["co2_emissions"],
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: "",
                            },
                        ],
                    },
                ],
            }

            const dataCalloutBlock: EnrichedBlockDataCallout = {
                type: "data-callout",
                parseErrors: [],
                url,
                content: [textBlock],
            }

            // When no linkedCallouts option is provided, filter out the block
            const result = enrichedBlocksToMarkdown([dataCalloutBlock], false)

            expect(result).toBeUndefined()
        })

        it("should filter out data-callout when linkedCallouts is provided but data is missing", () => {
            const url = "/grapher/co2-emissions?country=USA"

            const textBlock: EnrichedBlockText = {
                type: "text",
                parseErrors: [],
                value: [
                    { spanType: "span-simple-text", text: "Value: " },
                    {
                        spanType: "span-callout",
                        functionName: "latestValue",
                        parameters: ["co2_emissions"],
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: "",
                            },
                        ],
                    },
                ],
            }

            const dataCalloutBlock: EnrichedBlockDataCallout = {
                type: "data-callout",
                parseErrors: [],
                url,
                content: [textBlock],
            }

            // When linkedCallouts is provided but empty, the block should be filtered out
            const result = enrichedBlocksToMarkdown([dataCalloutBlock], false, {
                linkedCallouts: {},
            })

            expect(result).toBeUndefined()
        })
    })
})
