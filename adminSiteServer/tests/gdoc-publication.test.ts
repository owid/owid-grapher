import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SearchClient } from "@algolia/client-search"
import { OwidGdocType, type OwidGdocPostInterface } from "@ourworldindata/types"
import { getAdminTestEnv } from "./testEnv.js"

const transport = vi.hoisted(() => ({
    getSettings: vi.fn(async () => ({ attributesForFaceting: ["path"] })),
    browseObjects: vi.fn(async () => undefined),
    saveObjects: vi.fn(async () => undefined),
    deleteObjects: vi.fn(async () => undefined),
}))
vi.mock(import("../../settings/serverSettings.js"), async (original) => ({
    ...(await original()),
    ALGOLIA_INDEXING: true,
}))
vi.mock(
    import("../../baker/algolia/configureAlgolia.js"),
    async (original) => ({
        ...(await original()),
        getAlgoliaClient: () => transport as unknown as SearchClient,
    })
)
vi.mock(import("../../baker/GrapherBakingUtils.js"), async (original) => ({
    ...(await original()),
    triggerStaticBuild: vi.fn(async () => undefined),
}))
const env = getAdminTestEnv()
beforeEach(async () => {
    vi.clearAllMocks()
    await env.testKnex("tags").insert({ name: "tag-graph-root" })
    await env
        .testKnex("redirects")
        .whereIn("source", ["/first-slug", "/second-slug"])
        .delete()
})

afterEach(async () => {
    await env
        .testKnex("redirects")
        .whereIn("source", ["/first-slug", "/second-slug"])
        .delete()
})

async function draft(): Promise<OwidGdocPostInterface> {
    await env.request({ method: "PUT", path: "/gdocs/publication-fixture" })
    const base = await env.fetchJson("/gdocs/publication-fixture")
    return {
        ...base,
        slug: "first-slug",
        published: true,
        publishedAt: new Date("2024-01-01T00:00:00Z"),
        content: {
            ...base.content,
            type: OwidGdocType.Article,
            title: "Saved author content",
            authors: [],
            body: [
                {
                    type: "text",
                    value: [
                        {
                            spanType: "span-simple-text",
                            text: "The author's saved words.",
                        },
                    ],
                    parseErrors: [],
                },
            ],
        },
    }
}
async function save(gdoc: OwidGdocPostInterface): Promise<void> {
    await env.request({
        method: "PUT",
        path: `/gdocs/${gdoc.id}`,
        body: JSON.stringify(gdoc),
    })
}

describe("CMS publication persistence", () => {
    it("publishes, redirects renamed slugs without chains, and unpublishes saved content", async () => {
        const gdoc = await draft()
        await save(gdoc)
        expect((await env.fetchJson(`/gdocs/${gdoc.id}`)).published).toBe(true)
        expect(transport.saveObjects).toHaveBeenCalled()
        await save({ ...gdoc, slug: "second-slug" })
        await save({ ...gdoc, slug: "final-slug" })
        expect(
            await env
                .testKnex("redirects")
                .whereIn("source", ["/first-slug", "/second-slug"])
                .select("source", "target")
                .orderBy("source")
        ).toEqual([
            { source: "/first-slug", target: "/final-slug" },
            { source: "/second-slug", target: "/final-slug" },
        ])
        await save({ ...gdoc, slug: "final-slug", published: false })
        const row = await env
            .testKnex("posts_gdocs")
            .where({ id: gdoc.id })
            .first()
        expect(Boolean(row.published)).toBe(false)
        expect(row.markdown).toContain("The author's saved words.")
        expect(JSON.parse(row.content).title).toBe("Saved author content")
    })

    it("commits the author's edit when enabled Algolia indexing fails", async () => {
        const gdoc = await draft()
        await save(gdoc)
        transport.saveObjects.mockClear()
        transport.saveObjects.mockRejectedValueOnce(
            new Error("Controlled indexing outage")
        )
        await save({
            ...gdoc,
            content: {
                ...gdoc.content,
                title: "New saved title",
                body: [
                    {
                        type: "text",
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "New words survive indexing failure.",
                            },
                        ],
                        parseErrors: [],
                    },
                ],
            },
        })
        await expect(
            transport.saveObjects.mock.results[0].value
        ).rejects.toThrow("Controlled indexing outage")
        const row = await env
            .testKnex("posts_gdocs")
            .where({ id: gdoc.id })
            .first()
        expect(Boolean(row.published)).toBe(true)
        expect(JSON.parse(row.content).title).toBe("New saved title")
        expect(row.markdown).toContain("New words survive indexing failure.")
        expect(row.markdown).not.toContain("The author's saved words.")
    })
})
