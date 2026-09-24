import { describe, expect, it } from "vitest"
import { type docs_v1 } from "@googleapis/docs"
import {
    findChartPreviewBlocks,
    makeChartPreviewRequests,
} from "./chartPreviewBlocks.js"

type ElementSpec =
    | string
    | { image: string }
    | { link: string; text: string }
    | { richLink: string }

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
                        textStyle: { link: { url: spec.link } },
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
    inlineObjects: Record<string, string | undefined> = {}
): docs_v1.Schema$Document {
    return {
        documentId: "doc",
        tabs: [
            {
                tabProperties: { tabId: "t.0", title: "Tab" },
                documentTab: {
                    body: { content },
                    inlineObjects: Object.fromEntries(
                        Object.entries(inlineObjects).map(([id, uri]) => [
                            id,
                            {
                                inlineObjectProperties: {
                                    embeddedObject: {
                                        imageProperties: { sourceUri: uri },
                                    },
                                },
                            },
                        ])
                    ),
                },
            },
        ],
    }
}

const URL_A = "https://ourworldindata.org/grapher/a"
const URL_B = "https://ourworldindata.org/grapher/b?tab=map"

describe(findChartPreviewBlocks, () => {
    it("finds a chart with an image in its own paragraph above", () => {
        const document = makeDocument(
            makeContent([
                ["Some text"],
                [{ image: "kix.1" }],
                ["{.chart}"],
                [`url: ${URL_A}`],
                ["{}"],
            ]),
            { "kix.1": "https://example.com/old.png" }
        )
        expect(findChartPreviewBlocks(document)).toEqual([
            {
                tabId: "t.0",
                tabTitle: "Tab",
                componentStartIndex: 13,
                spec: { type: "chart", target: URL_A },
                image: {
                    objectId: "kix.1",
                    sourceUri: "https://example.com/old.png",
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
        const [block] = findChartPreviewBlocks(document)
        expect(block.image).toEqual({ objectId: "kix.1" })
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
        expect(findChartPreviewBlocks(document)[0].image).toBeUndefined()
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
        const blocks = findChartPreviewBlocks(document)
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
            findChartPreviewBlocks(document).map((b) => b.spec.target)
        ).toEqual([URL_A, URL_B, URL_A])
    })

    it("skips components without a url", () => {
        const document = makeDocument(
            makeContent([["{.chart}"], ["caption: hi"], ["{}"], ["{.image}"]])
        )
        expect(findChartPreviewBlocks(document)).toEqual([])
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
            findChartPreviewBlocks(document).map((b) => [
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

describe(makeChartPreviewRequests, () => {
    const block = (
        tabId: string,
        componentStartIndex: number,
        objectId?: string
    ): Parameters<typeof makeChartPreviewRequests>[0][number]["block"] => ({
        tabId,
        tabTitle: "",
        componentStartIndex,
        spec: { type: "chart", target: URL_A },
        image: objectId ? { objectId } : undefined,
    })

    it("replaces first, then inserts from the end of each tab", () => {
        const requests = makeChartPreviewRequests(
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
        const requests = makeChartPreviewRequests(
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
})
