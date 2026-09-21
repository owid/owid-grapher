import { describe, expect, it } from "vitest"
import {
    BlockSize,
    OwidEnrichedGdocBlock,
    OwidGdocPostInterface,
    OwidGdocErrorMessageType,
    OwidGdocType,
} from "@ourworldindata/utils"
import { getErrors } from "./gdocsValidation.js"

function makeGdoc(body: OwidEnrichedGdocBlock[]): OwidGdocPostInterface {
    return {
        id: "abc123",
        slug: "some-article",
        published: false,
        publishedAt: new Date(),
        content: {
            type: OwidGdocType.Article,
            title: "Some article",
            authors: ["Our World in Data team"],
            excerpt: "An excerpt",
            body,
        },
    } as unknown as OwidGdocPostInterface
}

describe(getErrors, () => {
    it("labels body parse errors with the block type", () => {
        const gdoc = makeGdoc([
            {
                type: "chart",
                url: "",
                size: BlockSize.Wide,
                parseErrors: [{ message: "Missing url" }],
            },
            {
                type: "heading",
                text: [],
                level: 7,
                parseErrors: [
                    {
                        message: "Heading level must be between 1 and 6",
                        isWarning: true,
                    },
                ],
            },
        ])

        expect(
            getErrors(gdoc).filter((error) => error.property === "body")
        ).toEqual([
            {
                property: "body",
                type: OwidGdocErrorMessageType.Error,
                message: "[chart] Missing url",
            },
            {
                property: "body",
                type: OwidGdocErrorMessageType.Warning,
                message: "[heading] Heading level must be between 1 and 6",
            },
        ])
    })

    it("identifies the reference in footnote parse errors", () => {
        const gdoc = makeGdoc([])
        gdoc.content.refs = {
            definitions: {
                broken_source: {
                    id: "broken_source",
                    index: 0,
                    content: [
                        {
                            type: "text",
                            value: [],
                            parseErrors: [
                                {
                                    message: "Value is a not a string",
                                },
                            ],
                        },
                    ],
                    parseErrors: [],
                },
            },
            errors: [],
        }

        expect(
            getErrors(gdoc).filter((error) => error.property === "refs")
        ).toEqual([
            {
                property: "refs",
                type: OwidGdocErrorMessageType.Error,
                message:
                    'Parse error in "broken_source" ref content: Value is a not a string',
            },
        ])
    })

    it("surfaces unused and undefined ref errors from the parser", () => {
        const gdoc = makeGdoc([])
        gdoc.content.refs = {
            definitions: {},
            errors: [
                {
                    property: "refs",
                    type: OwidGdocErrorMessageType.Error,
                    message:
                        '"missing_source" is used as a ref ID but no definition for this ref has been written.',
                },
            ],
        }

        expect(
            getErrors(gdoc).filter((error) => error.property === "refs")
        ).toEqual([
            {
                property: "refs",
                type: OwidGdocErrorMessageType.Error,
                message:
                    '"missing_source" is used as a ref ID but no definition for this ref has been written.',
            },
        ])
    })

    it("reports body findings in document order, parse errors before embeds of the same block", () => {
        const gdoc = makeGdoc([
            {
                type: "html",
                value: '<iframe src="https://admin.owid.io/admin/slideshows/4/preview"></iframe>',
                parseErrors: [{ message: "Malformed html" }],
            },
            {
                type: "chart",
                url: "",
                size: BlockSize.Wide,
                parseErrors: [{ message: "Missing url" }],
            },
        ])

        expect(
            getErrors(gdoc)
                .filter((error) => error.property === "body")
                .map((error) => error.message)
        ).toEqual([
            "[html] Malformed html",
            expect.stringContaining(
                "https://admin.owid.io/admin/slideshows/4/preview"
            ),
            "[chart] Missing url",
        ])
    })

    it("blocks publish when an html block embeds an iframe pointing at admin.owid.io", () => {
        const gdoc = makeGdoc([
            {
                type: "html",
                value: '<iframe src="https://admin.owid.io/admin/slideshows/4/preview"></iframe>',
                parseErrors: [],
            },
        ])

        const errors = getErrors(gdoc)
        const embedError = errors.find((error) =>
            error.message.includes("internal admin URL")
        )

        expect(embedError).toBeDefined()
        expect(embedError!.type).toBe(OwidGdocErrorMessageType.Error)
        expect(embedError!.message).toContain(
            "https://admin.owid.io/admin/slideshows/4/preview"
        )
    })

    it("blocks publish when a chart block's url points at a staging site", () => {
        const gdoc = makeGdoc([
            {
                type: "chart",
                url: "https://staging-site-my-branch/grapher/some-chart",
                size: "wide",
                parseErrors: [],
            } as unknown as OwidEnrichedGdocBlock,
        ])

        const errors = getErrors(gdoc)
        const embedError = errors.find((error) =>
            error.message.includes("internal admin URL")
        )

        expect(embedError).toBeDefined()
        expect(embedError!.type).toBe(OwidGdocErrorMessageType.Error)
    })

    it("does not flag embeds pointing at the public site", () => {
        const gdoc = makeGdoc([
            {
                type: "html",
                value: '<iframe src="https://ourworldindata.org/slideshows/some-slideshow"></iframe>',
                parseErrors: [],
            },
        ])

        const errors = getErrors(gdoc)
        const embedError = errors.find((error) =>
            error.message.includes("internal admin URL")
        )

        expect(embedError).toBeUndefined()
    })
})
