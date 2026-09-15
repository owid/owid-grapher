import { expect, it, describe } from "vitest"

import type { KnexReadonlyTransaction } from "../db/db.js"
import {
    OwidGdocType,
    type ImageMetadata,
    type OwidGdocMinimalPostInterface,
} from "@ourworldindata/utils"
import {
    SiteBaker,
    type GdocAttachmentPicks,
    type PrefetchedAttachments,
} from "./SiteBaker.js"

it("can init", () => {
    const baker = new SiteBaker(
        __dirname + "/example.com",
        "https://example.com"
    )
    expect(baker).toBeTruthy()
})

describe("attaching documents resolved by path", () => {
    const SELF_ID = "self-gdoc-id"
    const OTHER_ID = "other-gdoc-id"

    const minimalPost = (
        id: string,
        slug: string,
        featuredImage: string
    ): OwidGdocMinimalPostInterface => ({
        id,
        title: slug,
        slug,
        authors: [],
        publishedAt: "October 17, 2022",
        published: true,
        subtitle: "",
        excerpt: "",
        type: OwidGdocType.TopicPage,
        "featured-image": featuredImage,
    })

    const image = (filename: string) => ({ filename }) as ImageMetadata

    // `getPrefetchedGdocAttachments` only touches the database when the cache is
    // empty, so priming the cache exercises the real filtering without one.
    const bakerWithPrimedCache = (): SiteBaker => {
        const baker = new SiteBaker(
            __dirname + "/example.com",
            "https://example.com"
        )
        baker._prefetchedAttachmentsCache = {
            donors: [],
            linkedAuthors: [],
            linkedDocuments: {
                [SELF_ID]: minimalPost(SELF_ID, "poverty", "poverty.png"),
                [OTHER_ID]: minimalPost(OTHER_ID, "energy", "energy.png"),
            },
            imageMetadata: {
                "poverty.png": image("poverty.png"),
                "energy.png": image("energy.png"),
            },
            archivedVersions: { charts: {}, multiDims: {} },
            linkedCharts: { graphers: {}, explorers: {} },
            linkedIndicators: {},
            linkedNarrativeCharts: {},
            linkedStaticViz: {},
            previewableGdocIdsByPath: new Map([
                ["/poverty", SELF_ID],
                ["/energy", OTHER_ID],
            ]),
        }
        return baker
    }

    const attachmentsFor = async (
        gdocId: string,
        sameSiteInlineLinkPaths: string[],
        linkedDocumentIds: string[] = []
    ): Promise<PrefetchedAttachments> => {
        const picks: GdocAttachmentPicks = [
            [],
            linkedDocumentIds,
            [],
            [],
            [],
            [],
            [],
            sameSiteInlineLinkPaths,
        ]
        // getPrefetchedGdocAttachments is private, and never reaches for the
        // knex it takes once the cache is primed.
        const baker = bakerWithPrimedCache() as unknown as {
            getPrefetchedGdocAttachments(
                knex: KnexReadonlyTransaction,
                gdocId: string,
                picks: GdocAttachmentPicks
            ): Promise<PrefetchedAttachments>
        }
        return baker.getPrefetchedGdocAttachments(
            undefined as unknown as KnexReadonlyTransaction,
            gdocId,
            picks
        )
    }

    it("attaches a document named by an inline same-site link path", async () => {
        const { linkedDocuments } = await attachmentsFor(SELF_ID, ["/energy"])
        expect(Object.keys(linkedDocuments)).toEqual([OTHER_ID])
    })

    // Regression test: the baker used to _.pick path-resolved ids into
    // linkedDocuments without checking them against the gdoc's own id, so every
    // page containing a link to itself attached its own document to itself. That
    // wasted an attachment, pulled in its featured image, and would have shown a
    // preview card for the page the reader was already on.
    it("does not attach a gdoc's own document when it links to itself", async () => {
        const { linkedDocuments } = await attachmentsFor(SELF_ID, [
            "/poverty",
            "/energy",
        ])
        expect(Object.keys(linkedDocuments)).toEqual([OTHER_ID])
        expect(linkedDocuments).not.toHaveProperty(SELF_ID)
    })

    it("does not pull in the gdoc's own featured image via a self-link", async () => {
        const { imageMetadata } = await attachmentsFor(SELF_ID, [
            "/poverty",
            "/energy",
        ])
        expect(Object.keys(imageMetadata)).toEqual(["energy.png"])
    })

    it("does not attach a document twice when it is also linked by gdoc id", async () => {
        const { linkedDocuments } = await attachmentsFor(
            SELF_ID,
            ["/energy"],
            [OTHER_ID]
        )
        expect(Object.keys(linkedDocuments)).toEqual([OTHER_ID])
    })
})
