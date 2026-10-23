import { beforeEach, describe, expect, it, vi } from "vitest"
import { DbInsertUser, OwidGdocType } from "@ourworldindata/types"
import { gdocFromJSON } from "../../db/model/Gdoc/GdocFactory.js"
import * as db from "../../db/db.js"
import {
    indexIndividualGdoc,
    removeIndividualGdocFromIndex,
} from "../../baker/algolia/utils/pages.js"
import { indexAndBakeGdocIfNeccesary } from "./gdocs.js"

// Stand-ins for the Algolia writes and the deploy queue, so the test only
// checks which index calls the publish hook makes.
vi.mock(import("../../baker/algolia/utils/pages.js"), () => ({
    indexIndividualGdoc: vi.fn(async () => undefined),
    removeIndividualGdocFromIndex: vi.fn(async () => undefined),
    getIndividualGdocRecords: vi.fn(async () => []),
    indexIndividualProfile: vi.fn(async () => undefined),
    removeIndividualProfileFromIndex: vi.fn(async () => undefined),
}))
vi.mock(import("../../baker/algolia/utils/pagesChronological.js"), () => ({
    indexIndividualGdocInChronological: vi.fn(async () => undefined),
    removeIndividualGdocFromChronological: vi.fn(async () => undefined),
}))
vi.mock(import("../../baker/GrapherBakingUtils.js"), () => ({
    triggerStaticBuild: vi.fn(async () => undefined),
}))
vi.mock(import("./routeUtils.js"), () => ({
    enqueueLightningChange: vi.fn(async () => undefined),
}))

const user = { id: 1, email: "test@example.com" } as Required<DbInsertUser>
const trx = {} as db.KnexReadWriteTransaction

function makeFeaturedViz(published: boolean, title = "Migration flows") {
    return gdocFromJSON({
        id: "featured-viz-gdoc",
        slug: "migration-flows",
        published,
        publishedAt: published ? "2026-01-01T00:00:00Z" : null,
        content: { type: OwidGdocType.FeaturedViz, title },
    })
}

describe("publishing a featured-viz page", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("indexes it when it's published", async () => {
        const nextGdoc = makeFeaturedViz(true)
        await indexAndBakeGdocIfNeccesary(
            trx,
            user,
            makeFeaturedViz(false),
            nextGdoc
        )

        expect(indexIndividualGdoc).toHaveBeenCalledOnce()
        expect(indexIndividualGdoc).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "featured-viz-gdoc",
                content: expect.objectContaining({
                    type: OwidGdocType.FeaturedViz,
                }),
            }),
            trx,
            "migration-flows"
        )
        expect(removeIndividualGdocFromIndex).not.toHaveBeenCalled()
    })

    it("reindexes it when a published page is updated", async () => {
        await indexAndBakeGdocIfNeccesary(
            trx,
            user,
            makeFeaturedViz(true),
            makeFeaturedViz(true, "Migration flows, updated")
        )

        expect(indexIndividualGdoc).toHaveBeenCalledOnce()
        expect(indexIndividualGdoc).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({
                    title: "Migration flows, updated",
                }),
            }),
            trx,
            "migration-flows"
        )
        expect(removeIndividualGdocFromIndex).not.toHaveBeenCalled()
    })

    it("removes its record when it's unpublished", async () => {
        await indexAndBakeGdocIfNeccesary(
            trx,
            user,
            makeFeaturedViz(true),
            makeFeaturedViz(false)
        )

        expect(removeIndividualGdocFromIndex).toHaveBeenCalledOnce()
        expect(removeIndividualGdocFromIndex).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: "migration-flows",
                content: expect.objectContaining({
                    type: OwidGdocType.FeaturedViz,
                }),
            })
        )
        expect(indexIndividualGdoc).not.toHaveBeenCalled()
    })

    it("leaves the index alone when a draft is saved", async () => {
        await indexAndBakeGdocIfNeccesary(
            trx,
            user,
            makeFeaturedViz(false),
            makeFeaturedViz(false, "Migration flows, draft")
        )

        expect(indexIndividualGdoc).not.toHaveBeenCalled()
        expect(removeIndividualGdocFromIndex).not.toHaveBeenCalled()
    })
})
