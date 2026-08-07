import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { OwidGdocType, type OwidGdocPostInterface } from "@ourworldindata/types"
import type { SearchClient } from "@algolia/client-search"
import type * as db from "../../../db/db.js"
import type { GdocProfile } from "../../../db/model/Gdoc/GdocProfile.js"

vi.mock(
    import("../../../settings/serverSettings.js"),
    async (importOriginal) => ({
        ...(await importOriginal()),
        ALGOLIA_INDEXING: true,
    })
)

const algoliaError = new Error("Algolia is unavailable")
const rejects = (): Promise<never> => Promise.reject(algoliaError)

// A client that fails on every call, including the reads these functions make
// before writing anything.
const throwingClient = {
    getSettings: vi.fn(rejects),
    browseObjects: vi.fn(rejects),
    saveObjects: vi.fn(rejects),
    deleteObjects: vi.fn(rejects),
} as unknown as SearchClient

vi.mock(import("../configureAlgolia.js"), () => ({
    getAlgoliaClient: () => throwingClient,
}))

// Imported dynamically so that `throwingClient` above is initialised before the
// mock factory runs.
const {
    indexIndividualGdoc,
    removeIndividualGdocFromIndex,
    indexIndividualProfile,
    removeIndividualProfileFromIndex,
} = await import("./pages.js")

const knex = {} as db.KnexReadonlyTransaction

const gdoc = {
    id: "gdoc-id",
    slug: "some-article",
    publishedAt: new Date("2020-01-01"),
    content: { type: OwidGdocType.Article },
} as OwidGdocPostInterface

const profileTemplate = {
    id: "profile-id",
    slug: "some-profile",
    publishedAt: new Date("2020-01-01"),
    content: { type: OwidGdocType.Profile },
} as GdocProfile

/**
 * These functions are called from the admin's gdoc save handler, inside the
 * read-write transaction that persists the gdoc. If they rejected, knex would
 * roll the transaction back and the author's content edit would be lost, so an
 * Algolia outage must be logged rather than thrown.
 */
describe("individual page indexing tolerates Algolia failures", () => {
    let consoleError: MockInstance

    beforeEach(() => {
        vi.clearAllMocks()
        consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined)
        vi.spyOn(console, "log").mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const cases: [string, () => Promise<void>][] = [
        [
            "indexIndividualGdoc",
            () => indexIndividualGdoc(gdoc, knex, gdoc.slug),
        ],
        [
            "removeIndividualGdocFromIndex",
            () => removeIndividualGdocFromIndex(gdoc),
        ],
        [
            "indexIndividualProfile",
            () => indexIndividualProfile(profileTemplate, knex),
        ],
        [
            "removeIndividualProfileFromIndex",
            () => removeIndividualProfileFromIndex(profileTemplate),
        ],
    ]

    it.each(cases)("%s logs instead of throwing", async (_name, run) => {
        await expect(run()).resolves.toBeUndefined()
        expect(consoleError).toHaveBeenCalled()
    })
})
