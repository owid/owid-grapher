#! /usr/bin/env yarn jest

import {
    EnrichedBlockAdditionalCharts,
    RawBlockAdditionalCharts,
    EnrichedBlockHeading,
    RawBlockHeading,
    OwidRawGdocBlock,
    omitUndefinedValues,
    RawBlockText,
    EnrichedBlockRecirc,
    EnrichedBlockTopicPageIntro,
} from "@ourworldindata/utils"
import { spansToHtmlString } from "./model/Gdoc/gdocUtils.js"
import { archieToEnriched } from "./model/Gdoc/archieToEnriched.js"
import { OwidRawGdocBlockToArchieMLString } from "./model/Gdoc/rawToArchie.js"
import { enrichedBlockExamples } from "./model/Gdoc/exampleEnrichedBlocks.js"
import { enrichedBlockToRawBlock } from "./model/Gdoc/enrichedToRaw.js"
import { load } from "archieml"
import {
    parseRawBlocksToEnrichedBlocks,
    parseSimpleText,
} from "./model/Gdoc/rawToEnriched.js"

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

describe("gdoc parsing works", () => {
    it("can parse an aside block", () => {
        const doc = getArchieMLDocWithContent(
            `
{.aside}
caption: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
{}`
        )
        const article = archieToEnriched(doc)
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
        const article = archieToEnriched(doc)
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
            OwidRawGdocBlockToArchieMLString(expectedRawBlock)
        expect(serializedRawBlock).toEqual(archieMLString)
    })

    it("can parse an additional charts block", () => {
        const links = [
            '<a href="https://ourworldindata.org/grapher/annual-number-of-births-by-world-region">Annual number of births</a>',
            '<a href="https://ourworldindata.org/grapher/fish-catch-gear-type?stackMode=relative&country=~OWID_WRL">Fish catch by gear type</a>',
        ]
        const archieMLString = `[.additional-charts]
* ${links[0]}
* ${links[1]}
[]
`
        const doc = getArchieMLDocWithContent(archieMLString)
        const article = archieToEnriched(doc)
        expect(article?.body?.length).toBe(1)
        const expectedEnrichedBlock: EnrichedBlockAdditionalCharts = {
            type: "additional-charts",
            items: [
                [
                    {
                        url: "https://ourworldindata.org/grapher/annual-number-of-births-by-world-region",
                        children: [
                            {
                                text: "Annual number of births",
                                spanType: "span-simple-text",
                            },
                        ],
                        spanType: "span-link",
                    },
                ],
                [
                    {
                        url: "https://ourworldindata.org/grapher/fish-catch-gear-type?stackMode=relative&country=~OWID_WRL",
                        children: [
                            {
                                text: "Fish catch by gear type",
                                spanType: "span-simple-text",
                            },
                        ],
                        spanType: "span-link",
                    },
                ],
            ],
            parseErrors: [],
        }

        expect(article?.body && article?.body[0]).toEqual(expectedEnrichedBlock)

        const expectedRawBlock: RawBlockAdditionalCharts = {
            type: "additional-charts",
            value: links,
        }

        const serializedRawBlock =
            OwidRawGdocBlockToArchieMLString(expectedRawBlock)
        expect(serializedRawBlock).toEqual(archieMLString)
    })

    it("surfaces missing support for external urls in recirc block", () => {
        const archieMLString = `
            {.recirc}
                title: More Articles on Mammals

                [.links]
                    url:https://docs.google.com/document/d/1__qnfvbuEsT5EkU-3-TF65jShUuOefyxvy5CUmZRAvI/edit
                    url:https://ourworldindata.org/large-mammals-extinction
                []
            {}
        `
        const doc = getArchieMLDocWithContent(archieMLString)
        const article = archieToEnriched(doc)
        const expectedEnrichedBlock: EnrichedBlockRecirc = {
            type: "recirc",
            links: [
                {
                    url: "https://docs.google.com/document/d/1__qnfvbuEsT5EkU-3-TF65jShUuOefyxvy5CUmZRAvI/edit",
                    type: "recirc-link",
                },
                {
                    url: "https://ourworldindata.org/large-mammals-extinction",
                    type: "recirc-link",
                },
            ],
            title: {
                text: "More Articles on Mammals",
                spanType: "span-simple-text",
            },
            parseErrors: [
                {
                    message: "External urls are not supported in recirc blocks",
                    isWarning: true,
                },
            ],
        }

        expect(article?.body?.[0]).toEqual(expectedEnrichedBlock)
    })

    it.only("surfaces block type restriction in topic-page-intro content", () => {
        const archieMLString = `
        {.topic-page-intro}
            {.download-button}
                text: Download all data on blah
                url: https://github.com
            {}
        
            [.related-topics]
                text: Poverty
                url: https://docs.google.com/d/1234
        
                text: GDP Growth
                url: https://docs.google.com/d/abcd
            []
        
            [+.content]
                <b>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</b> Suspendisse dictum consectetur turpis sit amet vestibulum.
                {.prominent-link}
                    url: https://docs.google.com/d/1234
                {}
            []
        {}
        `
        const doc = getArchieMLDocWithContent(archieMLString)
        const article = archieToEnriched(doc)
        const expectedEnrichedBlock: EnrichedBlockTopicPageIntro = {
            type: "topic-page-intro",
            content: [
                {
                    value: [
                        {
                            children: [
                                {
                                    spanType: "span-simple-text",
                                    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                                },
                            ],
                            spanType: "span-bold",
                        },
                        {
                            text: " Suspendisse dictum consectetur turpis sit amet vestibulum.",
                            spanType: "span-simple-text",
                        },
                    ],
                    parseErrors: [],
                    type: "text",
                },
            ],
            parseErrors: [
                {
                    message:
                        "Only paragraphs are supported in topic-page-intro blocks.",
                    isWarning: true,
                },
            ],
            relatedTopics: [
                {
                    url: "https://docs.google.com/d/1234",
                    text: "Poverty",
                    type: "topic-page-intro-related-topic",
                },
                {
                    url: "https://docs.google.com/d/abcd",
                    text: "GDP Growth",
                    type: "topic-page-intro-related-topic",
                },
            ],
            downloadButton: {
                url: "https://github.com",
                text: "Download all data on blah",
                type: "topic-page-intro-download-button",
            },
        }

        expect(article?.body?.[0]).toEqual(expectedEnrichedBlock)
    })

    it.each(Object.values(enrichedBlockExamples))(
        "Parse <-> Serialize roundtrip should be equal - example type $type",
        (example) => {
            const rawBlock = enrichedBlockToRawBlock(example)
            const serializedRawBlock =
                OwidRawGdocBlockToArchieMLString(rawBlock)
            const simpleArchieMLDocument = `[+body]
            ${serializedRawBlock}
            []
            `
            const deserializedRawBlock = load(simpleArchieMLDocument)
            const bodyNodes: OwidRawGdocBlock[] = deserializedRawBlock.body
            let deserializedEnrichedBlocks = bodyNodes.map(
                parseRawBlocksToEnrichedBlocks
            )
            if (example.type === "simple-text") {
                // RawBlockText blocks are always parsed to EnrichedBlockText, never automatically
                // to EnrichedBlockSimpleText. So we need to manually parse them here.
                deserializedEnrichedBlocks = [
                    parseSimpleText(bodyNodes[0] as RawBlockText),
                ]
            }
            expect(deserializedEnrichedBlocks).toHaveLength(1)
            expect(omitUndefinedValues(bodyNodes[0])).toEqual(
                omitUndefinedValues(rawBlock)
            )
            expect(omitUndefinedValues(deserializedEnrichedBlocks[0])).toEqual(
                omitUndefinedValues(example)
            )
        }
    )
})
