#! /usr/bin/env yarn jest

import { EnrichedBlockHeading, RawBlockHeading } from "@ourworldindata/utils"
import { stringToArchieML } from "./gdocToArchieml.js"
import {
    owidRawArticleBlockToArchieMLString,
    removeStylesOfLeadingTrackingNonwordSpans,
    spansToHtmlString,
} from "./gdocUtils.js"
function getArchieMLDocWithContent(content: string): string {
    return `title: Writing OWID Articles With Google Docs
subtitle: This article documents how to use and configure the various built in features of our template system
byline: Matthew Conlen
dateline: June 30, 2022
template: centered


[+body]
${content}
[]
`
}

const examples: { name: string; input: Span[]; expected: Span[] }[] = [
    {
        name: "2 ws spans no nesting",
        input: [
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "  ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "2 ws spans no nesting 2 ws",
        input: [
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-simple-text",
                text: " ",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "  ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
            {
                spanType: "span-simple-text",
                text: "  ",
            },
        ],
    },
    {
        name: "2 ws spans with 1 level nesting",
        input: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: " ",
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "  ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "2 ws spans with 1 level nesting, nested item is second",
        input: [
            {
                spanType: "span-simple-text",
                text: " ",
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: " ",
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "  ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "2 ws spans with 2 level nesting",
        input: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: " ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "  ",
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "No ws in the beginning, 2 nested levels",
        input: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "non-ws ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "non-ws ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "WS in the first word, 2 nested levels",
        input: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "   non-ws ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "   ",
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "non-ws ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "WS in the first span, WS in the second span at nesting level 2, WS at the beginning of the third span at nesting level 3",
        input: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "   ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                            {
                                spanType: "span-superscript",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "   non-ws ",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "       ",
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-superscript",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "non-ws ",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "hello",
            },
        ],
    },
    {
        name: "WS in the first span, WS in the second span at nesting level 2, WS at the beginning of the third span at nesting level 3, WS after the word, then 1 WS only span",
        input: [
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "   ",
                    },
                ],
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: " ",
                            },
                            {
                                spanType: "span-superscript",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "   non-ws  ",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "  ",
            },
        ],
        expected: [
            {
                spanType: "span-simple-text",
                text: "       ",
            },
            {
                spanType: "span-bold",
                children: [
                    {
                        spanType: "span-italic",
                        children: [
                            {
                                spanType: "span-superscript",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "non-ws",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                spanType: "span-simple-text",
                text: "    ",
            },
        ],
    },
]

describe("gdoc parsing works", () => {
    it("can parse an aside block", () => {
        const doc = getArchieMLDocWithContent(
            `
{.aside}
caption: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
{}`
        )
        const article = stringToArchieML(doc)
        expect(article?.body?.length).toBe(1)
        expect(article?.body && article?.body[0]).toEqual({
            type: "aside",
            caption: [
                {
                    spanType: "span-simple-text",
                    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                },
            ],
            position: undefined,
            parseErrors: [],
        })
    })

    it("can parse a heading block", () => {
        const archieMLString = `{.heading}
text: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
level: 2
{}
`
        const doc = getArchieMLDocWithContent(archieMLString)
        const article = stringToArchieML(doc)
        expect(article?.body?.length).toBe(1)
        const expectedEnrichedBlock: EnrichedBlockHeading = {
            type: "heading",
            text: [
                {
                    spanType: "span-simple-text",
                    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                },
            ],
            supertitle: undefined,
            level: 2,
            parseErrors: [],
        }
        expect(article?.body && article?.body[0]).toEqual(expectedEnrichedBlock)

        const expectedRawBlock: RawBlockHeading = {
            type: "heading",
            value: {
                text: spansToHtmlString(expectedEnrichedBlock.text),
                level: expectedEnrichedBlock.level.toString(),
            },
        }

        const serializedRawBlock =
            owidRawArticleBlockToArchieMLString(expectedRawBlock)
        expect(serializedRawBlock).toEqual(archieMLString)
    })

    it.each(examples)(
        "removes styling of leading/tracking whitespace only spans correctly - #$#",
        (example) => {
            expect(
                removeStylesOfLeadingTrackingNonwordSpans(example.input)
            ).toEqual(example.expected)
        }
    )
})
