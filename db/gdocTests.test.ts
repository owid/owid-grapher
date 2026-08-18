import { expect, it, describe } from "vitest"

import {
    EnrichedBlockAdditionalCharts,
    RawBlockAdditionalCharts,
    EnrichedBlockHeading,
    RawBlockHeading,
    OwidRawGdocBlock,
    omitUndefinedValues,
    RawBlockText,
    EnrichedBlockText,
    EnrichedBlockTopicPageIntro,
    EnrichedBlockSocials,
    SocialLinkType,
    traverseEnrichedBlock,
} from "@ourworldindata/utils"
import {
    spansToHtmlString,
    spanToArchieMLSourceString,
} from "./model/Gdoc/gdocUtils.js"
import { archieToEnriched } from "./model/Gdoc/archieToEnriched.js"
import { OwidRawGdocBlockToArchieMLString } from "./model/Gdoc/rawToArchie.js"
import { owidArticleToArchieMLStringGenerator } from "./model/Gdoc/archieToGdoc.js"
import {
    compareArchieMlContent,
    validateArchieMl,
} from "./model/Gdoc/validateArchieMl.js"
import {
    joinArchieMlSkipSegments,
    splitArchieMlSkipSegments,
} from "./model/Gdoc/archieMlSkipBlocks.js"
import {
    getContentKeysForGdocType,
    OWID_GDOC_DATA_INSIGHT_CONTENT_KEYS,
    OWID_GDOC_POST_CONTENT_KEYS,
    OwidEnrichedGdocBlock,
    OwidGdocPostContent,
    OwidGdocType,
    SpanRef,
} from "@ourworldindata/types"
import { enrichedBlockExamples } from "./model/Gdoc/exampleEnrichedBlocks.js"
import { enrichedBlockToRawBlock } from "./model/Gdoc/enrichedToRaw.js"
import { load } from "archieml"
import {
    parseLatestFeedExcerpt,
    parseSimpleText,
} from "./model/Gdoc/rawToEnriched.js"
import { gdocToArchie } from "./model/Gdoc/gdocToArchie.js"
import { docs_v1 } from "@googleapis/docs"
import { documentContainsMixedStraightAndCurlyQuotes } from "./model/Gdoc/gdocValidation.js"

function getArchieMLDocWithContent(
    content: string,
    extraFrontmatter: string = ""
): string {
    return `title: Writing OWID Articles With Google Docs
subtitle: This article documents how to use and configure the various built in features of our template system
authors: Matthew Conlen
dateline: June 30, 2022
${extraFrontmatter}
[+body]
${content}
[]
`
}

// Builds a [.refs] frontmatter block in the same shape the write-back
// emits, for use as extraFrontmatter above.
function getRefsFrontmatter(refs: { id: string; content: string }[]): string {
    return [
        "[.refs]",
        ...refs.flatMap((ref) => [
            `id: ${ref.id}`,
            "[.+content]",
            ref.content,
            "[]",
        ]),
        "[]",
    ].join("\n")
}

describe(documentContainsMixedStraightAndCurlyQuotes, () => {
    it.each([
        [
            "straight apostrophe with curly apostrophe",
            `{"text":"don't mix it’s"}`,
        ],
        [
            "straight double quote with curly double quote",
            `{"text":"\\"hello”"}`,
        ],
        ["straight apostrophe with curly opening quote", `{"text":"'hello‘"}`],
    ])("detects %s", (_description, content) => {
        expect(documentContainsMixedStraightAndCurlyQuotes(content)).toBe(true)
    })

    it.each([
        ["straight quotes only", `{"text":"don't mix \\"quotes\\""}`],
        ["curly quotes only", `{"text":"don’t mix “quotes”"}`],
        ["no quotes", `{"text":"plain text"}`],
    ])("ignores %s", (_description, content) => {
        expect(documentContainsMixedStraightAndCurlyQuotes(content)).toBe(false)
    })
})

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

    it("reads underline text style into <u> tags", async () => {
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "Underlined",
                                        textStyle: { underline: true },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(`<u>Underlined</u>`)
    })

    it("reads strikethrough text style into <s> tags", async () => {
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    textRun: {
                                        content: "Strikethrough",
                                        textStyle: { strikethrough: true },
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        }

        const { text } = await gdocToArchie(doc)
        expect(text).toContain(`<s>Strikethrough</s>`)
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

    it("handles rich links the same way as regular links", async () => {
        const url = "https://docs.google.com/document/d/1234567890"
        const title = "My Google Doc"
        const doc: docs_v1.Schema$Document = {
            body: {
                content: [
                    {
                        paragraph: {
                            elements: [
                                {
                                    richLink: {
                                        richLinkProperties: {
                                            uri: url,
                                            title: title,
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
        expect(text).toContain(`<a href="${url}">${title}</a>`)
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
            expect(bodyNodes).toHaveLength(1)
            expect(omitUndefinedValues(bodyNodes[0])).toEqual(
                omitUndefinedValues(rawBlock)
            )

            // Parse back through the full document pipeline rather than bare
            // load(), so every block type also proves immune to the
            // document-level text surgery (extractRefs, whitespace-link
            // fixups, stripIgnoredArchieml).
            const article = archieToEnriched(
                getArchieMLDocWithContent(serializedRawBlock)
            )
            expect(article.body).toHaveLength(1)
            // RawBlockText blocks are always parsed to EnrichedBlockText, never automatically
            // to EnrichedBlockSimpleText. So we need to manually parse them here.
            const deserializedEnrichedBlock =
                example.type === "simple-text"
                    ? parseSimpleText(bodyNodes[0] as RawBlockText)
                    : article.body?.[0]
            expect(omitUndefinedValues(deserializedEnrichedBlock)).toEqual(
                omitUndefinedValues(example)
            )
        }
    )

    it("round-trips a text block with an inline ref through the document pipeline", () => {
        // Unlike the catalogue examples above, a span-ref can only round-trip
        // through archieToEnriched: its serialized form `{ref}…{/ref}` is
        // ArchieML-layer syntax that extractRefs resolves before load(), and
        // its url/children (#note-1, <sup>1</sup>) are document-derived. This
        // pins single-block fillInlineRefSourceContent behavior, including
        // formatting inside the ref content.
        const example: EnrichedBlockText = {
            type: "text",
            value: [
                { spanType: "span-simple-text", text: "A claim" },
                {
                    spanType: "span-ref",
                    url: "#note-1",
                    sourceForm: {
                        kind: "inline",
                        content: [
                            { spanType: "span-simple-text", text: "see " },
                            {
                                spanType: "span-bold",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "this paper",
                                    },
                                ],
                            },
                        ],
                    },
                    children: [
                        {
                            spanType: "span-superscript",
                            children: [
                                { spanType: "span-simple-text", text: "1" },
                            ],
                        },
                    ],
                },
                { spanType: "span-simple-text", text: " and more." },
            ],
            parseErrors: [],
        }
        const serializedRawBlock = OwidRawGdocBlockToArchieMLString(
            enrichedBlockToRawBlock(example)
        )
        const article = archieToEnriched(
            getArchieMLDocWithContent(serializedRawBlock)
        )
        expect(article.body).toHaveLength(1)
        expect(omitUndefinedValues(article.body?.[0])).toEqual(
            omitUndefinedValues(example)
        )
    })
})

describe("document-level ArchieML round trip", () => {
    // The inverse of archieToEnriched: full-document enriched → ArchieML
    // write-back, including frontmatter and the [.refs] block.
    const enrichedToArchieML = (content: OwidGdocPostContent): string =>
        [...owidArticleToArchieMLStringGenerator(content)].join("\n")

    // Asserts that parsing a handwritten ArchieML document and writing it
    // back is a fixed point. The write-back canonicalizes formatting —
    // property order, key casing, whitespace — without losing content, so the
    // string comparison is against that canonical form rather than the
    // handwritten input; content preservation is checked by validateArchieMl,
    // the same gate the admin API uses, so CI exercises exactly the code the
    // endpoint runs. Returns the first parse and its canonical write-back
    // for fixture-specific assertions.
    function expectDocToRoundTrip(archieml: string): {
        first: OwidGdocPostContent
        canonicalArchieML: string
    } {
        const result = validateArchieMl(archieml, { requireType: false })
        expect(result.errors).toEqual([])
        const first = result.content!
        const canonicalArchieML = enrichedToArchieML(first)
        // The canonical form must itself be a fixed point at the string level.
        expect(enrichedToArchieML(archieToEnriched(canonicalArchieML))).toEqual(
            canonicalArchieML
        )
        return { first, canonicalArchieML }
    }

    const collectRefSpans = (
        body: OwidEnrichedGdocBlock[] | undefined
    ): SpanRef[] => {
        const refs: SpanRef[] = []
        for (const block of body ?? []) {
            traverseEnrichedBlock(
                block,
                () => undefined,
                (span) => {
                    if (span.spanType === "span-ref") refs.push(span)
                }
            )
        }
        return refs
    }

    it("round-trips inline refs and fills their sourceForm content", () => {
        const { first } = expectDocToRoundTrip(
            getArchieMLDocWithContent(
                `One claim{ref}An inline citation with spaces.{/ref} and another{ref}A second, <b>bolder</b> citation.{/ref}.`
            )
        )
        const refSpans = collectRefSpans(first.body)
        expect(refSpans.map((span) => span.sourceForm)).toEqual([
            {
                kind: "inline",
                content: [
                    {
                        spanType: "span-simple-text",
                        text: "An inline citation with spaces.",
                    },
                ],
            },
            {
                kind: "inline",
                content: [
                    { spanType: "span-simple-text", text: "A second, " },
                    {
                        spanType: "span-bold",
                        children: [
                            { spanType: "span-simple-text", text: "bolder" },
                        ],
                    },
                    { spanType: "span-simple-text", text: " citation." },
                ],
            },
        ])
    })

    it("round-trips multi-paragraph inline refs without gluing their paragraphs", () => {
        const { first, canonicalArchieML } = expectDocToRoundTrip(
            getArchieMLDocWithContent(
                `One claim{ref}First citation, 283–295.\n\nSecond citation, 31–54.{/ref} and text after.`
            )
        )
        // The definition keeps the two paragraphs as separate text blocks
        const definitions = Object.values(first.refs?.definitions ?? {})
        expect(definitions).toHaveLength(1)
        expect(definitions[0].content).toHaveLength(2)
        // The write-back reproduces the paragraph break inside {ref}…{/ref}
        // instead of gluing "…295.Second citation…"
        expect(canonicalArchieML).toContain(
            "First citation, 283–295.\n\nSecond citation, 31–54."
        )
        expect(canonicalArchieML).not.toContain("295.Second")
    })

    it("re-escapes key-like prefixes in inline ref content", () => {
        // "See:" at the start of a {ref} would be swallowed as an ArchieML
        // key when extractRefs re-loads the content, so authors escape it as
        // "See\:" in the gdoc — the write-back must do the same.
        const { first, canonicalArchieML } = expectDocToRoundTrip(
            getArchieMLDocWithContent(
                `A claim{ref}See\\: (i) Feenstra, 2017. (ii) Khandelwal, 2016.{/ref} and after.`
            )
        )
        const definitions = Object.values(first.refs?.definitions ?? {})
        expect(definitions).toHaveLength(1)
        expect(JSON.stringify(definitions[0].content)).toContain(
            "See: (i) Feenstra"
        )
        expect(canonicalArchieML).toContain("{ref}See\\: (i) Feenstra")
    })

    it("round-trips detail-on-demand spans, including inside formatting", () => {
        const { first, canonicalArchieML } = expectDocToRoundTrip(
            getArchieMLDocWithContent(
                `A rank of 1 means <u><a href="#dod:comparative-advantage">comparative advantage</a></u> applies.`
            )
        )
        const spans: string[] = []
        for (const block of first.body ?? [])
            traverseEnrichedBlock(
                block,
                () => undefined,
                (span) => {
                    if (span.spanType === "span-dod") spans.push(span.id)
                }
            )
        expect(spans).toEqual(["comparative-advantage"])
        // The write-back emits the authoring form, not the site markup
        expect(canonicalArchieML).toContain(
            '<a href="#dod:comparative-advantage">'
        )
        expect(canonicalArchieML).not.toContain("dod-span")
    })

    it("round-trips a data insight, including its specific frontmatter", () => {
        const doc = `title: Test data insight
authors: OWID Team
type: data-insight
grapher-url: https://ourworldindata.org/grapher/life-expectancy
figma-url: https://www.figma.com/design/abc/def
[+body]
A one-paragraph insight with <b>bold</b> text.
[]
`
        const { first, canonicalArchieML } = expectDocToRoundTrip(doc)
        expect(first.type).toBe(OwidGdocType.DataInsight)
        expect(canonicalArchieML).toContain("type: data-insight")
        expect(canonicalArchieML).toContain(
            "grapher-url: https://ourworldindata.org/grapher/life-expectancy"
        )
        expect(canonicalArchieML).toContain(
            "figma-url: https://www.figma.com/design/abc/def"
        )
        // post-only frontmatter is not emitted for data insights
        expect(canonicalArchieML).not.toContain("sidebar-toc")
    })

    it("round-trips ID-based refs and regenerates the [.refs] frontmatter block", () => {
        const doc = getArchieMLDocWithContent(
            `A claim{ref}first_ref{/ref} and another{ref}second_ref{/ref}.`,
            getRefsFrontmatter([
                { id: "first_ref", content: "The first citation." },
                { id: "second_ref", content: "The second citation." },
            ])
        )
        const { first } = expectDocToRoundTrip(doc)
        expect(Object.keys(first.refs?.definitions ?? {})).toEqual([
            "first_ref",
            "second_ref",
        ])
    })

    it("keeps note numbering stable for interleaved inline and ID refs across blocks", () => {
        const doc = getArchieMLDocWithContent(
            `First paragraph{ref}An inline citation first.{/ref} of text.

Second paragraph{ref}an_id_ref{/ref} of text.`,
            getRefsFrontmatter([
                { id: "an_id_ref", content: "The ID-based citation." },
            ])
        )
        const { first } = expectDocToRoundTrip(doc)
        const refSpans = collectRefSpans(first.body)
        expect(refSpans.map((s) => s.url)).toEqual(["#note-1", "#note-2"])
        expect(refSpans.map((s) => s.sourceForm.kind)).toEqual(["inline", "id"])
    })

    it("emits a single [.refs] entry and note number for a repeated ID ref", () => {
        const doc = getArchieMLDocWithContent(
            `A claim{ref}reused_ref{/ref} and the same claim again{ref}reused_ref{/ref}.`,
            getRefsFrontmatter([
                { id: "reused_ref", content: "The reused citation." },
            ])
        )
        const { first, canonicalArchieML } = expectDocToRoundTrip(doc)
        const refSpans = collectRefSpans(first.body)
        expect(refSpans.map((s) => s.url)).toEqual(["#note-1", "#note-1"])
        expect(canonicalArchieML.match(/id: reused_ref/g)).toHaveLength(1)
    })

    it("gives repeated identical inline refs one note number and fills both spans", () => {
        const doc = getArchieMLDocWithContent(
            `First{ref}The same citation text.{/ref} and second{ref}The same citation text.{/ref}.`
        )
        const { first } = expectDocToRoundTrip(doc)
        expect(Object.keys(first.refs?.definitions ?? {})).toHaveLength(1)
        const refSpans = collectRefSpans(first.body)
        expect(refSpans.map((span) => span.url)).toEqual(["#note-1", "#note-1"])
        const expectedSourceForm = {
            kind: "inline",
            content: [
                {
                    spanType: "span-simple-text",
                    text: "The same citation text.",
                },
            ],
        }
        expect(refSpans.map((span) => span.sourceForm)).toEqual([
            expectedSourceForm,
            expectedSourceForm,
        ])
    })

    it("fills inline ref content inside list items", () => {
        const doc = getArchieMLDocWithContent(`[.list]
* Item one{ref}A citation inside a list.{/ref}
* Item two
[]`)
        const { first } = expectDocToRoundTrip(doc)
        const refSpans = collectRefSpans(first.body)
        expect(refSpans.map((span) => span.sourceForm)).toEqual([
            {
                kind: "inline",
                content: [
                    {
                        spanType: "span-simple-text",
                        text: "A citation inside a list.",
                    },
                ],
            },
        ])
    })

    it("round-trips rich spans at the document level", () => {
        expectDocToRoundTrip(
            getArchieMLDocWithContent(
                `Plain, <b>bold</b>, <i>italic</i>, <u>underlined</u>, <s>struck</s>, H<sub>2</sub>O, E=mc<sup>2</sup> and <a href="https://ourworldindata.org">a link</a>.`
            )
        )
    })

    // Mirrors GdocPost._enrichSubclassContent for the one front-matter field
    // whose enrichment lives in the subclass rather than archieToEnriched.
    const enrichLikeGdocPost = (content: Record<string, any>): void => {
        if (content["latest-feed-excerpt"]) {
            content["latest-feed-excerpt"] = parseLatestFeedExcerpt(
                content["latest-feed-excerpt"]
            )
        }
    }

    it("round-trips every front-matter key the spine classifies as emitted", () => {
        const doc = `title: Full front-matter fixture
supertitle: The supertitle
subtitle: A subtitle
authors: Jane Doe
dateline: June 30, 2025
excerpt: A short excerpt
type: article
sidebar-toc: true
heading-variant: light
hide-subscribe-banner: true
hide-citation: true
cover-image: cover.png
cover-color: amber
featured-image: featured.png
atom-title: An atom title
atom-excerpt: An atom excerpt
latest-feed-featured-image: latest.png
[.sticky-nav]
target: #introduction
text: Introduction
[]
[+deprecation-notice]
This article is deprecated.
[]
[+latest-feed-excerpt]
A feed excerpt with <b>bold</b> text.
[]
[.refs]
id: a_ref
[.+content]
The canonical citation.
[]
[]
[+body]
Some text{ref}a_ref{/ref} with a reference.
[]
`
        const first = archieToEnriched(doc, enrichLikeGdocPost)
        const canonicalArchieML = enrichedToArchieML(first)
        const second = archieToEnriched(canonicalArchieML, enrichLikeGdocPost)
        const firstByKey = first as unknown as Record<string, unknown>
        const secondByKey = second as unknown as Record<string, unknown>

        for (const [key, fate] of Object.entries(OWID_GDOC_POST_CONTENT_KEYS)) {
            if (fate !== "emitted") continue
            expect(
                secondByKey[key],
                `front-matter key "${key}" should survive the round trip`
            ).toBeDefined()
            if (key === "body" || key === "refs") continue
            expect(omitUndefinedValues(secondByKey[key])).toEqual(
                omitUndefinedValues(firstByKey[key])
            )
        }
        expect(omitUndefinedValues(second.body)).toEqual(
            omitUndefinedValues(first.body)
        )
        expect(omitUndefinedValues(second.refs?.definitions)).toEqual(
            omitUndefinedValues(first.refs?.definitions)
        )
        // The write-back of the second parse is a fixed point
        expect(enrichedToArchieML(second)).toEqual(canonicalArchieML)
    })

    it("round-trips author roles authored in the authors field", () => {
        const doc = `title: Roles fixture
authors: Jane Doe (Editor), John Smith
type: article
[+body]
Hello world.
[]
`
        const first = archieToEnriched(doc)
        const canonicalArchieML = enrichedToArchieML(first)
        const second = archieToEnriched(canonicalArchieML)
        expect(first.authorRoles).toEqual({ "Jane Doe": "Editor" })
        expect(canonicalArchieML).toContain(
            "authors: Jane Doe (Editor), John Smith"
        )
        expect(second.authors).toEqual(first.authors)
        expect(second.authorRoles).toEqual(first.authorRoles)
    })

    it("maps gdoc types to their content-key classification", () => {
        expect(getContentKeysForGdocType(OwidGdocType.Article)).toBe(
            OWID_GDOC_POST_CONTENT_KEYS
        )
        expect(getContentKeysForGdocType(OwidGdocType.Fragment)).toBe(
            OWID_GDOC_POST_CONTENT_KEYS
        )
        expect(getContentKeysForGdocType(OwidGdocType.DataInsight)).toBe(
            OWID_GDOC_DATA_INSIGHT_CONTENT_KEYS
        )
        expect(getContentKeysForGdocType(OwidGdocType.Homepage)).toBeUndefined()
    })
})

describe("refs source-form serializer", () => {
    it("emits {ref}id{/ref} for an ID-based SpanRef", () => {
        const span: SpanRef = {
            spanType: "span-ref",
            url: "#note-1",
            sourceForm: { kind: "id", id: "example_id" },
            children: [
                {
                    spanType: "span-superscript",
                    children: [{ spanType: "span-simple-text", text: "1" }],
                },
            ],
        }
        expect(spanToArchieMLSourceString(span)).toBe("{ref}example_id{/ref}")
    })

    it("emits {ref}content{/ref} for an inline SpanRef", () => {
        const span: SpanRef = {
            spanType: "span-ref",
            url: "#note-2",
            sourceForm: {
                kind: "inline",
                content: [{ spanType: "span-simple-text", text: "the body" }],
            },
            children: [
                {
                    spanType: "span-superscript",
                    children: [{ spanType: "span-simple-text", text: "2" }],
                },
            ],
        }
        expect(spanToArchieMLSourceString(span)).toBe("{ref}the body{/ref}")
    })

    it("recurses through formatting in inline ref content", () => {
        const span: SpanRef = {
            spanType: "span-ref",
            url: "#note-3",
            sourceForm: {
                kind: "inline",
                content: [
                    { spanType: "span-simple-text", text: "see " },
                    {
                        spanType: "span-bold",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: "this paper",
                            },
                        ],
                    },
                ],
            },
            children: [],
        }
        expect(spanToArchieMLSourceString(span)).toBe(
            "{ref}see <b>this paper</b>{/ref}"
        )
    })

    it("emits a [.refs] frontmatter block listing only ID-based refs used in the body", () => {
        const content: OwidGdocPostContent = {
            title: "T",
            type: OwidGdocType.Article,
            authors: ["A"],
            excerpt: "E",
            body: [
                {
                    type: "text",
                    value: [
                        {
                            spanType: "span-ref",
                            url: "#note-1",
                            sourceForm: { kind: "id", id: "used_id" },
                            children: [],
                        },
                        {
                            spanType: "span-ref",
                            url: "#note-2",
                            sourceForm: {
                                kind: "inline",
                                content: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "inline body",
                                    },
                                ],
                            },
                            children: [],
                        },
                    ],
                    parseErrors: [],
                },
            ],
            refs: {
                definitions: {
                    used_id: {
                        id: "used_id",
                        index: 0,
                        content: [
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Citation.",
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                        parseErrors: [],
                    },
                    // An inline-ref dictionary entry (keyed by content hash);
                    // must NOT appear in the emitted [.refs] block.
                    abc123hash: {
                        id: "abc123hash",
                        index: 1,
                        content: [
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "inline body",
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                        parseErrors: [],
                    },
                },
                errors: [],
            },
        } as OwidGdocPostContent

        const text = [...owidArticleToArchieMLStringGenerator(content)].join(
            "\n"
        )

        expect(text).toContain("[.refs]")
        expect(text).toContain("id: used_id")
        expect(text).toContain("Citation.")
        expect(text).not.toContain("id: abc123hash")
        expect(text).not.toContain("inline body\n[]")
    })
})

describe(validateArchieMl, () => {
    const doc = (body: string, frontmatter: string = "type: article"): string =>
        `title: Test doc
authors: Author
${frontmatter}
[+body]
${body}
[]
`

    it("accepts a valid document", () => {
        const result = validateArchieMl(doc("Hello world"))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
        expect(result.content?.body).toHaveLength(1)
    })

    it("reports an unknown block type as a parse failure", () => {
        const result = validateArchieMl(doc("{.small-chart}\nurl: test\n{}"))
        expect(result.valid).toBe(false)
        expect(result.content).toBeUndefined()
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toContain("failed to parse")
    })

    it("reports attribute-level parseErrors on known blocks", () => {
        const result = validateArchieMl(doc("{.chart}\ncaption: hi\n{}"))
        expect(result.valid).toBe(false)
        expect(result.errors).toEqual([
            expect.objectContaining({
                property: "body",
                message: "[chart] url property is missing",
            }),
        ])
        // The parse itself succeeded, so the content is still returned
        expect(result.content).toBeDefined()
    })

    it("requires a writable gdoc type by default", () => {
        const missing = validateArchieMl(doc("Hello", ""))
        expect(missing.valid).toBe(false)
        expect(missing.errors).toEqual([
            expect.objectContaining({ property: "type" }),
        ])

        const wrong = validateArchieMl(doc("Hello", "type: homepage"))
        expect(wrong.valid).toBe(false)
        expect(wrong.errors[0].message).toContain('"homepage"')

        const dataInsight = validateArchieMl(doc("Hello", "type: data-insight"))
        expect(dataInsight.valid).toBe(true)

        const off = validateArchieMl(doc("Hello", ""), { requireType: false })
        expect(off.valid).toBe(true)
    })

    it("tolerates empty text blocks dropped by canonicalization", () => {
        // An inline tag left open across a paragraph break (as produced by
        // some real gdocs) yields a text block with zero spans. The write-back
        // emits nothing for it, so the re-parse legitimately drops it — the
        // fixed-point check must not flag that as content loss.
        const result = validateArchieMl(
            doc("Some <i>italic text\n\n</i>\n\nNext paragraph")
        )
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    it("passes documents with warnings but reports them", () => {
        const result = validateArchieMl(
            doc('Some <a href="https://owid.cloud/foo">link</a>')
        )
        expect(result.valid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("rejects unrecognized front-matter keys (e.g. a misspelled field)", () => {
        // A typo of a real field would otherwise be silently dropped on
        // write, losing the intended value — so an unknown key is an error.
        const result = validateArchieMl(
            doc("Hello", "type: article\nsutitle: Oops a typo")
        )
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
            expect.objectContaining({
                property: "sutitle",
                message: expect.stringContaining("Unrecognized"),
            })
        )
    })

    it("points admin-managed keys like slug to the admin settings", () => {
        const result = validateArchieMl(
            doc("Hello", "type: article\nslug: my-slug")
        )
        expect(result.valid).toBe(true)
        expect(result.warnings).toContainEqual(
            expect.objectContaining({
                property: "slug",
                message: expect.stringContaining("admin"),
            })
        )
    })

    it("refuses front matter the write-back cannot serialize yet", () => {
        const result = validateArchieMl(
            doc(
                "Hello",
                "type: article\n[.faqs]\nid: what-is-this\n[.+content]\nAn answer.\n[]\n[]"
            )
        )
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
            expect.objectContaining({
                property: "faqs",
                message: expect.stringContaining("not yet supported"),
            })
        )
    })

    it("rejects the legacy byline key (new drafts must use authors)", () => {
        // `byline` is a pre-2023 alias the parse still honours (so authorship
        // is understood), but it is not a field new drafts should use — the
        // write-back emits `authors`, so the stray `byline` key is rejected as
        // unrecognized. The fix is to rename it to `authors`.
        const result = validateArchieMl(`title: Test doc
byline: Jane Doe (Editor)
type: article
[+body]
Hello world.
[]
`)
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
            expect.objectContaining({
                property: "byline",
                message: expect.stringContaining("Unrecognized"),
            })
        )
        // the parse still understood the authorship, it's just the wrong key
        expect(result.content?.authorRoles).toEqual({ "Jane Doe": "Editor" })
    })
})

describe(splitArchieMlSkipSegments, () => {
    const skipBlock = ":skip\nSome hidden preview link\n:endskip"

    it("passes through documents without directives", () => {
        const text = "title: t\n[+body]\nHello\n[]\n"
        const s = splitArchieMlSkipSegments(text)
        expect(s.prefix).toBe("")
        expect(s.core).toBe(text)
        expect(s.suffix).toBe("")
        expect(s.midDocumentDirectiveLines).toEqual([])
    })

    it("captures a leading skip block as prefix", () => {
        const text = `${skipBlock}\n\ntitle: t\n[+body]\nHello\n[]\n`
        const s = splitArchieMlSkipSegments(text)
        expect(s.prefix).toBe(skipBlock)
        expect(s.core.startsWith("\ntitle: t")).toBe(true)
        expect(s.midDocumentDirectiveLines).toEqual([])
        expect(joinArchieMlSkipSegments(s, "CANON")).toBe(`${skipBlock}\nCANON`)
    })

    it("captures a trailing skip block and an :ignore tail as suffix", () => {
        const text = `title: t\n[+body]\nHello\n[]\n\n${skipBlock}\n:ignore\ngraveyard text`
        const s = splitArchieMlSkipSegments(text)
        expect(s.prefix).toBe("")
        expect(s.core).toContain("Hello")
        expect(s.core).not.toContain(":skip")
        expect(s.suffix).toContain(":skip")
        expect(s.suffix).toContain(":ignore\ngraveyard text")
        expect(s.midDocumentDirectiveLines).toEqual([])
    })

    it("treats an unterminated :skip as a suffix (it runs to EOF)", () => {
        const text = `title: t\n[+body]\nHello\n[]\n:skip\ndraft stuff`
        const s = splitArchieMlSkipSegments(text)
        expect(s.core).not.toContain(":skip")
        expect(s.suffix).toBe(":skip\ndraft stuff")
        expect(s.midDocumentDirectiveLines).toEqual([])
    })

    it("flags mid-document skip blocks with their line numbers", () => {
        const text = `title: t\n[+body]\nBefore\n${skipBlock}\nAfter\n[]\n`
        const s = splitArchieMlSkipSegments(text)
        expect(s.midDocumentDirectiveLines).toEqual([4, 6])
        expect(s.prefix).toBe("")
        expect(s.suffix).toBe("")
    })
})

describe(compareArchieMlContent, () => {
    const parse = (body: string): ReturnType<typeof archieToEnriched> =>
        archieToEnriched(`title: t\ntype: article\n[+body]\n${body}\n[]\n`)

    it("reports identical for equivalent content", () => {
        const result = compareArchieMlContent(
            parse("Hello <b>world</b>"),
            parse("Hello <b>world</b>")
        )
        expect(result.identical).toBe(true)
    })

    it("pinpoints differing blocks", () => {
        const result = compareArchieMlContent(
            parse("Same\n\nDiffers here\n\nSame again"),
            parse("Same\n\nDiffers HERE\n\nSame again")
        )
        expect(result.identical).toBe(false)
        expect(result.differingBodyBlocks).toEqual([1])
        expect(result.refsMatch).toBe(true)
    })
})
