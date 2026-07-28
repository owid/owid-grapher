import { describe, expect, it } from "vitest"
import {
    OwidEnrichedGdocBlock,
    OwidGdoc,
    OwidGdocErrorMessageType,
    OwidGdocType,
} from "@ourworldindata/utils"
import { getErrors } from "./gdocsValidation.js"

function makeGdoc(body: OwidEnrichedGdocBlock[]): OwidGdoc {
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
    } as unknown as OwidGdoc
}

describe(getErrors, () => {
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
