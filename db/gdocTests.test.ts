#! /usr/bin/env yarn jest

import {
    EnrichedBlockAdditionalCharts,
    RawBlockAdditionalCharts,
    EnrichedBlockHeading,
    RawBlockHeading,
    OwidRawArticleBlock,
    omitUndefinedValues,
    RawBlockText,
} from "@ourworldindata/utils"
import { spansToHtmlString } from "./model/Gdoc/gdocUtils.js"
import { archieToEnriched } from "./model/Gdoc/archieToEnriched.js"
import { owidRawArticleBlockToArchieMLString } from "./model/Gdoc/rawToArchie.js"
import { enrichedBlockExamples } from "./model/Gdoc/exampleEnrichedBlocks.js"
import { enrichedBlockToRawBlock } from "./model/Gdoc/enrichtedToRaw.js"
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
            owidRawArticleBlockToArchieMLString(expectedRawBlock)
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
            owidRawArticleBlockToArchieMLString(expectedRawBlock)
        expect(serializedRawBlock).toEqual(archieMLString)
    })

    it.each(Object.values(enrichedBlockExamples))(
        "Parse <-> Serialize roundtrip should be equal - example type $type",
        (example) => {
            const rawBlock = enrichedBlockToRawBlock(example)
            const serializedRawBlock =
                owidRawArticleBlockToArchieMLString(rawBlock)
            const simpleArchieMLDocument = `[+body]
            ${serializedRawBlock}
            []
            `
            const deserializedRawBlock = load(simpleArchieMLDocument)
            const bodyNodes: OwidRawArticleBlock[] = deserializedRawBlock.body
            let deserializedEnrichedBlocks = bodyNodes.map(
                parseRawBlocksToEnrichedBlocks
            )
            if (example.type === "simple-text")
                // RawBlockText blocks are always parsed to EnrichedBlockText, never automatically
                // to EnrichedBlockSimpleText. So we need to manually parse them here.
                deserializedEnrichedBlocks = [
                    parseSimpleText(bodyNodes[0] as RawBlockText),
                ]
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
