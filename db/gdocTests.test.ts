import { expect, it, describe } from "vitest"

import {
    EnrichedBlockAdditionalCharts,
    RawBlockAdditionalCharts,
    EnrichedBlockHeading,
    RawBlockHeading,
    OwidRawGdocBlock,
    omitUndefinedValues,
    RawBlockText,
    EnrichedBlockTopicPageIntro,
    EnrichedBlockSocials,
    SocialLinkType,
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
import { gdocToArchie } from "./model/Gdoc/gdocToArchie.js"
import { docs_v1 } from "@googleapis/docs"

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
        // gdocToArchie wraps Google Docs lists with the [.list] tag,
        // so there, it doesn't need to be explicitly set in the gdoc
        // But when we're writing this archie for tests, we *do* need to explicitly write the tag
        const archieMLString = `{.additional-charts}
[.list]
* ${links[0]}
* ${links[1]}
[]
{}
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
            value: {
                list: links,
            },
        }

        const serializedRawBlock =
            OwidRawGdocBlockToArchieMLString(expectedRawBlock)
        expect(serializedRawBlock).toEqual(archieMLString)
    })

    it("surfaces block type restriction in topic-page-intro content", () => {
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

    it("parses emails in socials block", () => {
        const archieMLString = `
            [.socials]
                url: edouard@ourworldindata.org
                text: Edouard's email
                type: email
            []
        `
        const doc = getArchieMLDocWithContent(archieMLString)
        const article = archieToEnriched(doc)
        const expectedEnrichedBlock: EnrichedBlockSocials = {
            type: "socials",
            links: [
                {
                    url: "mailto:edouard@ourworldindata.org",
                    text: "Edouard's email",
                    type: SocialLinkType.Email,
                    parseErrors: [],
                },
            ],
            parseErrors: [],
        }

        expect(article?.body?.[0]).toEqual(expectedEnrichedBlock)
    })

    it("keeps subscripts inside a single link span", async () => {
        const url = "http://ourworldindata.org/grapher/life-expectancy"
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "CO",
                                        textStyle: {
                                            link: { url },
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: "2",
                                        textStyle: {
                                            link: { url },
                                            baselineOffset: "SUBSCRIPT",
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: " Emissions Data Explorer",
                                        textStyle: {
                                            link: { url },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(
            `<a href="${url}">CO<sub>2</sub> Emissions Data Explorer</a>`
        )
        const matches = text.match(new RegExp(`<a href="${url}"`, "g")) ?? []
        expect(matches.length).toBe(1)
    })

    it("keeps consecutive links to different targets separate", async () => {
        const url1 = "http://ourworldindata.org/grapher/life-expectancy"
        const url2 = "http://ourworldindata.org/grapher/co2-emissions"
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "First link",
                                        textStyle: {
                                            link: { url: url1 },
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: " and ",
                                        textStyle: {},
                                    },
                                },
                                {
                                    textRun: {
                                        content: "second link",
                                        textStyle: {
                                            link: { url: url2 },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(`<a href="${url1}">First link</a>`)
        expect(text).toContain(`<a href="${url2}">second link</a>`)
        const matches1 = text.match(new RegExp(`<a href="${url1}"`, "g")) ?? []
        const matches2 = text.match(new RegExp(`<a href="${url2}"`, "g")) ?? []
        expect(matches1.length).toBe(1)
        expect(matches2.length).toBe(1)
    })

    it("keeps adjacent links to different targets separate without text between", async () => {
        const url1 = "http://ourworldindata.org/grapher/life-expectancy"
        const url2 = "http://ourworldindata.org/grapher/co2-emissions"
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "First link",
                                        textStyle: {
                                            link: { url: url1 },
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: "Second link",
                                        textStyle: {
                                            link: { url: url2 },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(`<a href="${url1}">First link</a>`)
        expect(text).toContain(`<a href="${url2}">Second link</a>`)
        const matches1 = text.match(new RegExp(`<a href="${url1}"`, "g")) ?? []
        const matches2 = text.match(new RegExp(`<a href="${url2}"`, "g")) ?? []
        expect(matches1.length).toBe(1)
        expect(matches2.length).toBe(1)
    })

    it("merges multiple consecutive elements with the same link and mixed styles", async () => {
        const url = "http://ourworldindata.org/grapher/life-expectancy"
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "Bold",
                                        textStyle: {
                                            link: { url },
                                            bold: true,
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: " italic",
                                        textStyle: {
                                            link: { url },
                                            italic: true,
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: " plain",
                                        textStyle: {
                                            link: { url },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(`<a href="${url}">`)
        expect(text).toContain(`<b>Bold</b>`)
        expect(text).toContain(`<i> italic</i>`)
        expect(text).toContain(` plain`)
        const matches = text.match(new RegExp(`<a href="${url}"`, "g")) ?? []
        expect(matches.length).toBe(1)
    })

    it("keeps superscripts inside a single link span", async () => {
        const url = "http://ourworldindata.org/grapher/area-calculation"
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "Area in km",
                                        textStyle: {
                                            link: { url },
                                        },
                                    },
                                },
                                {
                                    textRun: {
                                        content: "2",
                                        textStyle: {
                                            link: { url },
                                            baselineOffset: "SUPERSCRIPT",
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(`<a href="${url}">Area in km<sup>2</sup></a>`)
        const matches = text.match(new RegExp(`<a href="${url}"`, "g")) ?? []
        expect(matches.length).toBe(1)
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
