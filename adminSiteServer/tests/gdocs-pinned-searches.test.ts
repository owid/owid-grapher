import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    OwidGdocType,
    PostsGdocsTableName,
    type DbRawPostGdoc,
    type OwidGdocErrorMessage,
} from "@ourworldindata/types"

const env = getAdminTestEnv()

const makeTextBlock = (text: string) => ({
    type: "text",
    value: [{ spanType: "span-simple-text", text }],
    parseErrors: [],
})

// Inserted directly: creating a gdoc through the API fetches it from a
// per-id fixture file of the Google Docs response.
async function createFeaturedViz(options: {
    id: string
    pinnedForSearches: string[]
}): Promise<Record<string, any>> {
    await env.testKnex(PostsGdocsTableName).insert({
        id: options.id,
        slug: options.id,
        content: JSON.stringify({
            type: OwidGdocType.FeaturedViz,
            title: `Featured viz ${options.id}`,
            authors: ["Our World in Data"],
            body: [makeTextBlock("Some text")],
            "pinned-for-searches": options.pinnedForSearches,
        }),
        published: 0,
        publishedAt: null,
        createdAt: new Date("2024-01-01"),
    })
    return env.fetchJson(`/gdocs/${options.id}`)
}

async function publish(
    draft: Record<string, any>,
    expectStatus?: number
): Promise<any> {
    return env.request({
        method: "PUT",
        path: `/gdocs/${draft.id}`,
        body: JSON.stringify({
            ...draft,
            published: true,
            publishedAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
        }),
        expectStatus,
    })
}

async function isPublished(id: string): Promise<boolean> {
    const row = (await env
        .testKnex(PostsGdocsTableName)
        .where({ id })
        .first()) as DbRawPostGdoc
    return Boolean(row.published)
}

async function pinnedSearchErrors(id: string): Promise<string[]> {
    const gdoc = await env.fetchJson(`/gdocs/${id}`)
    return (gdoc.errors as OwidGdocErrorMessage[])
        .filter((error) => error.property === "pinned-for-searches")
        .map((error) => error.message)
}

describe("Featured viz pinned searches", { timeout: 20000 }, () => {
    it("rejects publishing a featured viz pinned for a search a published one already has", async () => {
        const a = await createFeaturedViz({
            id: "pinned-clash-a",
            pinnedForSearches: ["population", "world population"],
        })
        await publish(a)
        const b = await createFeaturedViz({
            id: "pinned-clash-b",
            pinnedForSearches: ["world population", "fertility"],
        })

        const response = await publish(b, 400)

        expect(response.error.message).toContain('"world population"')
        expect(response.error.message).toContain('"pinned-clash-a"')
        expect(response.error.message).not.toContain('"fertility"')
        expect(await isPublished(b.id)).toBe(false)
    })

    it("reports the clash on the draft that would cause it", async () => {
        const a = await createFeaturedViz({
            id: "pinned-draft-a",
            pinnedForSearches: ["migration"],
        })
        await publish(a)
        const b = await createFeaturedViz({
            id: "pinned-draft-b",
            pinnedForSearches: ["migration"],
        })

        const errors = await pinnedSearchErrors(b.id)

        expect(errors).toHaveLength(1)
        expect(errors[0]).toContain('"migration"')
        expect(errors[0]).toContain('"pinned-draft-a"')
    })

    it("allows the same search when the other featured viz is a draft", async () => {
        await createFeaturedViz({
            id: "pinned-unpublished-a",
            pinnedForSearches: ["deforestation"],
        })
        const b = await createFeaturedViz({
            id: "pinned-unpublished-b",
            pinnedForSearches: ["deforestation"],
        })

        expect(await pinnedSearchErrors(b.id)).toEqual([])
        await publish(b)
        expect(await isPublished(b.id)).toBe(true)
    })

    it("warns, without blocking publishing, when no searches are pinned", async () => {
        const draft = await createFeaturedViz({
            id: "pinned-none",
            pinnedForSearches: [],
        })

        const gdoc = await env.fetchJson(`/gdocs/${draft.id}`)
        const warnings = (gdoc.errors as OwidGdocErrorMessage[]).filter(
            (error) => error.property === "pinned-for-searches"
        )

        expect(warnings).toHaveLength(1)
        expect(warnings[0].type).toBe("warning")
        expect(warnings[0].message).toContain(
            "/suggest-pinned-searches https://docs.google.com/document/d/pinned-none/edit"
        )
        await publish(draft)
        expect(await isPublished(draft.id)).toBe(true)
    })

    it("allows publishing featured vizzes pinned for different searches", async () => {
        const a = await createFeaturedViz({
            id: "pinned-distinct-a",
            pinnedForSearches: ["food"],
        })
        await publish(a)
        const b = await createFeaturedViz({
            id: "pinned-distinct-b",
            pinnedForSearches: ["trade"],
        })

        expect(await pinnedSearchErrors(b.id)).toEqual([])
        await publish(b)
        expect(await isPublished(b.id)).toBe(true)
    })
})
