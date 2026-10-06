import { describe, expect, it } from "vitest"
import { type docs_v1 } from "@googleapis/docs"
import {
    findComponentPreviewBlocks,
    makeComponentPreviewRequests,
} from "./componentPreviewBlocks.js"

type ElementSpec =
    | string
    | { image: string }
    | {
          link?: string
          text: string
          /** Suggestion fields of the text run */
          suggestion?: Pick<
              docs_v1.Schema$TextRun,
              | "suggestedInsertionIds"
              | "suggestedDeletionIds"
              | "suggestedTextStyleChanges"
          >
      }
    | { richLink: string }

/** The suggestion fields of a text run whose link is suggested to change */
function suggestLink(
    url: string
): Pick<docs_v1.Schema$TextRun, "suggestedTextStyleChanges"> {
    return {
        suggestedTextStyleChanges: {
            "suggest.1": {
                textStyle: { link: { url } },
                textStyleSuggestionState: { linkSuggested: true },
            },
        },
    }
}

/** Builds paragraphs with consecutive indices, like the Docs API returns */
function makeContent(
    paragraphs: ElementSpec[][],
    startIndex = 1
): docs_v1.Schema$StructuralElement[] {
    let index = startIndex
    return paragraphs.map((specs) => {
        const paragraphStart = index
        const elements = [...specs, "\n"].map(
            (spec): docs_v1.Schema$ParagraphElement => {
                const elementStart = index
                if (typeof spec === "string") {
                    index += spec.length
                    return {
                        startIndex: elementStart,
                        textRun: { content: spec },
                    }
                }
                index += "text" in spec ? spec.text.length : 1
                if ("image" in spec)
                    return {
                        startIndex: elementStart,
                        inlineObjectElement: { inlineObjectId: spec.image },
                    }
                if ("richLink" in spec)
                    return {
                        startIndex: elementStart,
                        richLink: {
                            richLinkProperties: { uri: spec.richLink },
                        },
                    }
                return {
                    startIndex: elementStart,
                    textRun: {
                        content: spec.text,
                        ...(spec.link
                            ? { textStyle: { link: { url: spec.link } } }
                            : {}),
                        ...spec.suggestion,
                    },
                }
            }
        )
        return {
            startIndex: paragraphStart,
            endIndex: index,
            paragraph: { elements },
        }
    })
}

function makeDocument(
    content: docs_v1.Schema$StructuralElement[],
    inlineObjects: Record<string, docs_v1.Schema$EmbeddedObject> = {}
): docs_v1.Schema$Document {
    return {
        documentId: "doc",
        tabs: [
            {
                tabProperties: { tabId: "t.0", title: "Tab" },
                documentTab: {
                    body: { content },
                    inlineObjects: Object.fromEntries(
                        Object.entries(inlineObjects).map(
                            ([id, embeddedObject]) => [
                                id,
                                { inlineObjectProperties: { embeddedObject } },
                            ]
                        )
                    ),
                },
            },
        ],
    }
}

const URL_A = "https://ourworldindata.org/grapher/a"
const URL_B = "https://ourworldindata.org/grapher/b?tab=map"

describe(findComponentPreviewBlocks, () => {
    it("finds a chart with an image in its own paragraph above", () => {
        const document = makeDocument(
            makeContent([
                ["Some text"],
                [{ image: "kix.1" }],
                ["{.chart}"],
                [`url: ${URL_A}`],
                ["{}"],
            ]),
            {
                "kix.1": {
                    imageProperties: {
                        sourceUri: "https://example.com/old.png",
                    },
                    size: {
                        width: { magnitude: 400, unit: "PT" },
                        height: { magnitude: 300, unit: "PT" },
                    },
                },
            }
        )
        expect(findComponentPreviewBlocks(document)).toEqual([
            {
                tabId: "t.0",
                tabTitle: "Tab",
                componentStartIndex: 13,
                spec: { type: "chart", kind: "chartUrl", target: URL_A },
                image: {
                    objectId: "kix.1",
                    startIndex: 11,
                    sourceUri: "https://example.com/old.png",
                    size: { width: 400, height: 300 },
                },
            },
        ])
    })

    it("finds an image at the end of the paragraph above, across blank lines", () => {
        const document = makeDocument(
            makeContent([
                ["As the chart shows.", { image: "kix.1" }, " "],
                [""],
                ["{.chart}"],
                [`url: ${URL_A}`],
                ["{}"],
            ])
        )
        const [block] = findComponentPreviewBlocks(document)
        expect(block.image).toMatchObject({ objectId: "kix.1", startIndex: 20 })
    })

    it("ignores images followed by text", () => {
        const document = makeDocument(
            makeContent([
                [{ image: "kix.1" }, "and then some text"],
                ["{.chart}"],
                [`url: ${URL_A}`],
                ["{}"],
            ])
        )
        expect(findComponentPreviewBlocks(document)[0].image).toBeUndefined()
    })

    it("doesn't take an image from before a preceding component", () => {
        const document = makeDocument(
            makeContent([
                [{ image: "kix.1" }],
                ["{.chart}"],
                [`url: ${URL_A}`],
                ["{}"],
                ["{.chart}"],
                [`url: ${URL_B}`],
                ["{}"],
            ])
        )
        const blocks = findComponentPreviewBlocks(document)
        expect(blocks.map((b) => b.image?.objectId)).toEqual([
            "kix.1",
            undefined,
        ])
    })

    it("reads single-line components, links and smart chips", () => {
        const document = makeDocument(
            makeContent([
                [`chart: ${URL_A}`],
                ["{.chart}"],
                ["url: ", { link: URL_B, text: "the map" }],
                ["{}"],
                ["{.chart}"],
                ["url: ", { richLink: URL_A }],
                ["{}"],
            ])
        )
        expect(
            findComponentPreviewBlocks(document).map((b) => b.spec.target)
        ).toEqual([URL_A, URL_B, URL_A])
    })

    it("reads linked urls like ingestion, where the link target wins", () => {
        const document = makeDocument(
            makeContent([
                ["{.chart}"],
                ["url: ", { link: URL_B, text: URL_A }],
                ["{}"],
            ])
        )
        expect(
            findComponentPreviewBlocks(document).map((b) => b.spec.target)
        ).toEqual([URL_B])
    })

    it("finds key indicators, pull charts and chart story slides", () => {
        const document = makeDocument(
            makeContent([
                ["{.key-indicator}"],
                [`datapageUrl: ${URL_A}`],
                ["title: How has life expectancy changed?"],
                ["{}"],
                ["{.pull-chart}"],
                ["image: thumbnail.png"],
                [`url: ${URL_B}`],
                ["{}"],
                ["[.chart-story]"],
                ["narrative: Some narrative"],
                [`chart: ${URL_B}`],
                ["[]"],
            ])
        )
        expect(findComponentPreviewBlocks(document).map((b) => b.spec)).toEqual(
            [
                { type: "key-indicator", kind: "chartUrl", target: URL_A },
                // Pull charts show their uploaded thumbnail, not their url
                {
                    type: "pull-chart",
                    kind: "imageFilename",
                    target: "thumbnail.png",
                },
                { type: "chart", kind: "chartUrl", target: URL_B },
            ]
        )
    })

    it("finds narrative charts by name, ignoring links", () => {
        const document = makeDocument(
            makeContent([
                [{ image: "kix.1" }],
                ["{.narrative-chart}"],
                ["name: ", { link: URL_A, text: "my-narrative" }],
                ["{}"],
                ["narrative-chart: other-narrative"],
            ])
        )
        expect(
            findComponentPreviewBlocks(document).map((b) => [
                b.spec,
                b.image?.objectId,
            ])
        ).toEqual([
            [
                {
                    type: "narrative-chart",
                    kind: "narrativeChartName",
                    target: "my-narrative",
                },
                "kix.1",
            ],
            [
                {
                    type: "narrative-chart",
                    kind: "narrativeChartName",
                    target: "other-narrative",
                },
                undefined,
            ],
        ])
    })

    it("finds images by filename and static viz by name", () => {
        const document = makeDocument(
            makeContent([
                [{ image: "kix.1" }],
                ["{.image}"],
                ["filename: my-chart.png"],
                ["alt: Some alt text"],
                ["{}"],
                ["{.static-viz}"],
                ["name: my-static-viz"],
                ["{}"],
                // Unlike charts, these have no single-line form
                ["image: not-a-component.png"],
            ])
        )
        expect(
            findComponentPreviewBlocks(document).map((b) => [
                b.spec,
                b.image?.objectId,
            ])
        ).toEqual([
            [
                {
                    type: "image",
                    kind: "imageFilename",
                    target: "my-chart.png",
                },
                "kix.1",
            ],
            [
                {
                    type: "static-viz",
                    kind: "staticVizName",
                    target: "my-static-viz",
                },
                undefined,
            ],
        ])
    })

    it("reads suggested changes to a component as if they were accepted", () => {
        const document = makeDocument(
            makeContent([
                ["{.chart}"],
                [
                    "url: ",
                    {
                        text: URL_A,
                        suggestion: { suggestedDeletionIds: ["suggest.1"] },
                    },
                    {
                        text: URL_B,
                        suggestion: { suggestedInsertionIds: ["suggest.1"] },
                    },
                ],
                ["{}"],
                ["{.chart}"],
                [
                    "url: ",
                    {
                        link: URL_A,
                        text: "this chart",
                        suggestion: suggestLink(URL_B),
                    },
                ],
                ["{}"],
            ])
        )
        expect(
            findComponentPreviewBlocks(document).map((block) => block.spec)
        ).toEqual([
            { type: "chart", kind: "chartUrl", target: URL_B },
            { type: "chart", kind: "chartUrl", target: URL_B },
        ])
    })

    it("doesn't treat an image suggested for deletion as the preview", () => {
        const content = makeContent([[{ image: "kix.1" }], [`chart: ${URL_A}`]])
        content[0].paragraph!.elements![0].inlineObjectElement!.suggestedDeletionIds =
            ["suggest.1"]
        const [block] = findComponentPreviewBlocks(makeDocument(content))
        expect(block.image).toBeUndefined()
    })

    it("skips components without a url", () => {
        const document = makeDocument(
            makeContent([["{.chart}"], ["caption: hi"], ["{}"], ["{.image}"]])
        )
        expect(findComponentPreviewBlocks(document)).toEqual([])
    })

    it("finds components in table cells and child tabs", () => {
        const cellContent = makeContent(
            [[{ image: "kix.2" }], ["{.chart}"], [`url: ${URL_B}`], ["{}"]],
            100
        )
        const document = makeDocument([
            {
                startIndex: 99,
                table: {
                    tableRows: [{ tableCells: [{ content: cellContent }] }],
                },
            },
        ])
        document.tabs![0].childTabs = [
            {
                tabProperties: { tabId: "t.1", title: "Child" },
                documentTab: {
                    body: {
                        content: makeContent([
                            ["{.chart}"],
                            [`url: ${URL_A}`],
                            ["{}"],
                        ]),
                    },
                },
            },
        ]
        expect(
            findComponentPreviewBlocks(document).map((b) => [
                b.tabId,
                b.spec.target,
                b.image?.objectId,
            ])
        ).toEqual([
            ["t.0", URL_B, "kix.2"],
            ["t.1", URL_A, undefined],
        ])
    })
})

describe(makeComponentPreviewRequests, () => {
    const block = (
        tabId: string,
        componentStartIndex: number,
        objectId?: string
    ): Parameters<typeof makeComponentPreviewRequests>[0][number]["block"] => ({
        tabId,
        tabTitle: "",
        componentStartIndex,
        spec: { type: "chart", kind: "chartUrl", target: URL_A },
        // The image sits in its own paragraph right above the component
        image: objectId
            ? { objectId, startIndex: componentStartIndex - 2 }
            : undefined,
    })

    it("replaces first, then inserts from the end of each tab", () => {
        const requests = makeComponentPreviewRequests(
            [{ block: block("t.0", 50, "kix.1"), imageUrl: "r" }],
            [
                { block: block("t.0", 10), imageUrl: "a" },
                { block: block("t.0", 90), imageUrl: "b" },
                { block: block("t.1", 5), imageUrl: "c" },
            ]
        )
        expect(requests[0].replaceImage).toMatchObject({
            imageObjectId: "kix.1",
            tabId: "t.0",
            uri: "r",
        })
        expect(
            requests
                .filter((r) => r.insertInlineImage)
                .map((r) => r.insertInlineImage!.uri)
        ).toEqual(["b", "a", "c"])
    })

    it("inserts the image in a new paragraph above the component", () => {
        const requests = makeComponentPreviewRequests(
            [],
            [{ block: block("t.0", 42), imageUrl: "a" }]
        )
        expect(requests).toMatchObject([
            {
                insertText: {
                    location: { index: 42, tabId: "t.0" },
                    text: "\n",
                },
            },
            {
                insertInlineImage: {
                    location: { index: 42, tabId: "t.0" },
                    uri: "a",
                },
            },
        ])
    })

    it("reinserts images in place at the same width, sorted with inserts", () => {
        const reinserted = {
            ...block("t.0", 52, "kix.1"),
            image: {
                objectId: "kix.1",
                startIndex: 50,
                size: { width: 300, height: 200 },
            },
        }
        const requests = makeComponentPreviewRequests(
            [],
            [
                { block: block("t.0", 10), imageUrl: "a" },
                { block: block("t.0", 90), imageUrl: "b" },
            ],
            [{ block: reinserted, imageUrl: "r" }]
        )
        expect(
            requests
                .filter((r) => r.insertInlineImage)
                .map((r) => r.insertInlineImage!.uri)
        ).toEqual(["b", "r", "a"])
        const deleteIndex = requests.findIndex((r) => r.deleteContentRange)
        expect(requests.slice(deleteIndex, deleteIndex + 2)).toMatchObject([
            {
                deleteContentRange: {
                    range: { startIndex: 50, endIndex: 51, tabId: "t.0" },
                },
            },
            {
                insertInlineImage: {
                    location: { index: 50, tabId: "t.0" },
                    uri: "r",
                    objectSize: { width: { magnitude: 300, unit: "PT" } },
                },
            },
        ])
    })
})
