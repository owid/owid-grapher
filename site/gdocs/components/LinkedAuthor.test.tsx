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

    it("links non-person bylines without author pages to the team page", () => {
        const html = renderLinkedAuthor("Our World in Data team")

        expect(html).toContain('href="/team"')
        expect(html).not.toContain('href="/team#our-world-in-data-team"')
    })
})

describe("LinkedAuthor avatars", () => {
    const withPhoto: Attachments = {
        ...attachments,
        linkedAuthors: [
            {
                name: "Fiona Spooner",
                slug: "fiona-spooner",
                featuredImage: "fiona.jpg",
                updatedAt: new Date("2026-01-01"),
            },
        ],
    }
    const photoMetadata: Attachments["imageMetadata"] = {
        "fiona.jpg": {
            filename: "fiona.jpg",
            cloudflareId: "abc",
            originalWidth: 100,
            originalHeight: 100,
            defaultAlt: "",
            updatedAt: null,
        },
    }

    const render = (
        name: string,
        value: Attachments,
        props: { includeImage?: boolean; includeInitials?: boolean }
    ): string =>
        renderToStaticMarkup(
            <AttachmentsContext.Provider value={value}>
                <LinkedAuthor name={name} {...props} />
            </AttachmentsContext.Provider>
        )

    it("shows initials in place of a missing photo when asked to", () => {
        const html = render("Lars Yencken", attachments, {
            includeImage: true,
            includeInitials: true,
        })

        expect(html).toContain("linked-author-initials")
        expect(html).toContain(">LY<")
    })

    it("shows the photo, not initials, when the photo can render", () => {
        const html = render(
            "Fiona Spooner",
            { ...withPhoto, imageMetadata: photoMetadata },
            { includeImage: true, includeInitials: true }
        )

        expect(html).toContain("linked-author-image")
        expect(html).not.toContain("linked-author-initials")
    })

    it("falls back to initials when the photo has no image metadata, as on archived pages", () => {
        const html = render("Fiona Spooner", withPhoto, {
            includeImage: true,
            includeInitials: true,
        })

        expect(html).not.toContain("linked-author-image")
        expect(html).toContain(">FS<")
    })

    it("shows no initials unless asked to", () => {
        const html = render("Lars Yencken", attachments, {
            includeImage: true,
        })

        expect(html).not.toContain("linked-author-initials")
    })
})
