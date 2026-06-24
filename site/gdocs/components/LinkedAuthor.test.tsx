import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Attachments, AttachmentsContext } from "../AttachmentsContext.js"
import LinkedAuthor from "./LinkedAuthor.js"

const attachments: Attachments = {
    linkedAuthors: [],
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    linkedIndicators: {},
    relatedCharts: [],
    linkedNarrativeCharts: {},
    linkedStaticViz: {},
    tags: [],
}

const renderLinkedAuthor = (
    name: string,
    value: Attachments = attachments
): string =>
    renderToStaticMarkup(
        <AttachmentsContext.Provider value={value}>
            <LinkedAuthor name={name} />
        </AttachmentsContext.Provider>
    )

describe(LinkedAuthor, () => {
    it("links authors with an author page to their author page", () => {
        const html = renderLinkedAuthor("Max Roser", {
            ...attachments,
            linkedAuthors: [
                {
                    name: "Max Roser",
                    slug: "max-roser",
                    featuredImage: null,
                    updatedAt: new Date("2026-01-01"),
                },
            ],
        })

        expect(html).toContain('href="/team/max-roser"')
    })

    it("links authors without an author page to their team page anchor", () => {
        const html = renderLinkedAuthor("Daniel Bachler")

        expect(html).toContain('href="/team#daniel-bachler"')
    })

    it("strips a trailing role when linking to a team page anchor", () => {
        const html = renderLinkedAuthor("Daniel Bachler (concept & modeling)")

        expect(html).toContain('href="/team#daniel-bachler"')
    })
})
