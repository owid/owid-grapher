import { expect, it, describe } from "vitest"
import {
    BlockSize,
    EnrichedBlockCta,
    EnrichedBlockHeading,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
    Span,
} from "@ourworldindata/types"
import { resolveBodyLinks, resolveExcerptLinks } from "./excerptLinks.js"

const BASE_URL = "https://ourworldindata.org"

const GDOC_URL = "https://docs.google.com/document/d/abc123/edit"

const makeLinkedDocument = (
    overrides: Partial<OwidGdocMinimalPostInterface> = {}
): OwidGdocMinimalPostInterface => ({
    id: "abc123",
    title: "Where do migrants live?",
    slug: "where-do-migrants-live",
    authors: [],
    publishedAt: "2026-08-01",
    published: true,
    subtitle: "",
    excerpt: "",
    type: OwidGdocType.Article,
    ...overrides,
})

const simpleText = (text: string): Span => ({
    spanType: "span-simple-text",
    text,
})

const block = (value: Span[]): EnrichedBlockText => ({
    type: "text",
    value,
    parseErrors: [],
})

const link = (url: string, text: string): Span => ({
    spanType: "span-link",
    url,
    children: [simpleText(text)],
})

const resolve = (
    spans: Span[],
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {
        abc123: makeLinkedDocument(),
    }
) => resolveExcerptLinks([block(spans)], linkedDocuments, BASE_URL)[0].value

describe(resolveExcerptLinks, () => {
    it("resolves a Google Doc link to the document's public URL", () => {
        expect(resolve([link(GDOC_URL, "our migration article")])).toEqual([
            link(`${BASE_URL}/where-do-migrants-live`, "our migration article"),
        ])
    })

    it("prefixes data insight URLs with their folder", () => {
        expect(
            resolve([link(GDOC_URL, "an insight")], {
                abc123: makeLinkedDocument({
                    slug: "cereal-yields",
                    type: OwidGdocType.DataInsight,
                }),
            })
        ).toEqual([
            link(`${BASE_URL}/data-insights/cereal-yields`, "an insight"),
        ])
    })

    it("leaves already-public links untouched", () => {
        const spans = [
            link("https://example.com/paper", "a study"),
            link(`${BASE_URL}/grapher/cereal-yields`, "a chart"),
            link(`${BASE_URL}/explorers/migration`, "an explorer"),
        ]
        expect(resolve(spans)).toEqual(spans)
    })

    it("resolves links nested inside other formatting", () => {
        expect(
            resolve([
                {
                    spanType: "span-bold",
                    children: [link(GDOC_URL, "our migration article")],
                },
            ])
        ).toEqual([
            {
                spanType: "span-bold",
                children: [
                    link(
                        `${BASE_URL}/where-do-migrants-live`,
                        "our migration article"
                    ),
                ],
            },
        ])
    })

    // A Google Doc URL must never reach a subscriber, so anything that can't
    // be resolved keeps its words and loses the link.
    it("degrades an unregistered doc link to plain text", () => {
        expect(resolve([link(GDOC_URL, "an unregistered doc")], {})).toEqual([
            {
                spanType: "span-fallback",
                children: [simpleText("an unregistered doc")],
            },
        ])
    })

    it("degrades a link to an unpublished doc to plain text", () => {
        expect(
            resolve([link(GDOC_URL, "a draft")], {
                abc123: makeLinkedDocument({ published: false }),
            })
        ).toEqual([
            {
                spanType: "span-fallback",
                children: [simpleText("a draft")],
            },
        ])
    })

    it("degrades a details-on-demand link to plain text", () => {
        expect(
            resolve([link("#dod:life-expectancy", "life expectancy")])
        ).toEqual([
            {
                spanType: "span-fallback",
                children: [simpleText("life expectancy")],
            },
        ])
    })

    it("leaves link-free formatting untouched", () => {
        const spans = [
            { spanType: "span-bold" as const, children: [simpleText("Beef")] },
            simpleText(" was the largest driver."),
        ]
        expect(resolve(spans)).toEqual(spans)
    })
})

describe(resolveBodyLinks, () => {
    const linkedDocuments = { abc123: makeLinkedDocument() }

    it("resolves links in text and heading blocks", () => {
        const heading: EnrichedBlockHeading = {
            type: "heading",
            level: 2,
            text: [link(GDOC_URL, "Migrants")],
            parseErrors: [],
        }
        expect(
            resolveBodyLinks(
                [block([link(GDOC_URL, "our article")]), heading],
                linkedDocuments,
                BASE_URL
            )
        ).toEqual([
            block([link(`${BASE_URL}/where-do-migrants-live`, "our article")]),
            {
                ...heading,
                text: [link(`${BASE_URL}/where-do-migrants-live`, "Migrants")],
            },
        ])
    })

    it("resolves links in list items", () => {
        const list: OwidEnrichedGdocBlock = {
            type: "list",
            items: [block([link(GDOC_URL, "our article")])],
            parseErrors: [],
        }
        expect(resolveBodyLinks([list], linkedDocuments, BASE_URL)).toEqual([
            {
                ...list,
                items: [
                    block([
                        link(
                            `${BASE_URL}/where-do-migrants-live`,
                            "our article"
                        ),
                    ]),
                ],
            },
        ])
    })

    it("resolves a cta block's link", () => {
        const cta: EnrichedBlockCta = {
            type: "cta",
            text: "Read the article",
            url: GDOC_URL,
            parseErrors: [],
        }
        expect(resolveBodyLinks([cta], linkedDocuments, BASE_URL)).toEqual([
            { ...cta, url: `${BASE_URL}/where-do-migrants-live` },
        ])
    })

    it("drops a cta block whose link can't be resolved", () => {
        const cta: EnrichedBlockCta = {
            type: "cta",
            text: "Read the article",
            url: GDOC_URL,
            parseErrors: [],
        }
        expect(
            resolveBodyLinks(
                [cta],
                { abc123: makeLinkedDocument({ published: false }) },
                BASE_URL
            )
        ).toEqual([])
    })

    it("passes other blocks through untouched", () => {
        const image: OwidEnrichedGdocBlock = {
            type: "image",
            filename: "chart.png",
            size: BlockSize.Wide,
            hasOutline: true,
            parseErrors: [],
        }
        expect(resolveBodyLinks([image], linkedDocuments, BASE_URL)).toEqual([
            image,
        ])
    })
})
