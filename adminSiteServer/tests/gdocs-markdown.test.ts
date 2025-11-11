import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    OwidGdocType,
    PostsGdocsTableName,
    type DbRawPostGdoc,
} from "@ourworldindata/types"

const env = getAdminTestEnv()

const makeTextBlock = (text: string) => ({
    type: "text",
    value: [
        {
            spanType: "span-simple-text",
            text,
        },
    ],
    parseErrors: [],
})

describe("Gdoc markdown regeneration via API", { timeout: 20000 }, () => {
    it("recomputes markdown when saving a published document", async () => {
        const gdocId = "gdoc-markdown-api-test"

        // Create an empty draft so we have a row in posts_gdocs
        await env.request({
            method: "PUT",
            path: `/gdocs/${gdocId}`,
        })

        const base = await env.fetchJson(`/gdocs/${gdocId}`)

        const draftPayload = {
            ...base,
            slug: "markdown-api-test",
            revisionId: "rev-draft",
            published: false,
            publishedAt: null,
            markdown: "outdated draft markdown",
            content: {
                ...base.content,
                type: OwidGdocType.Article,
                title: "Markdown API test",
                body: [makeTextBlock("First published text")],
                authors: base.content.authors?.length
                    ? base.content.authors
                    : ["Our World in Data"],
            },
        }

        await env.request({
            method: "PUT",
            path: `/gdocs/${gdocId}`,
            body: JSON.stringify(draftPayload),
        })

        const firstSave = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: gdocId })
            .first()) as DbRawPostGdoc
        expect(firstSave.markdown).toContain("First published text")

        const updatePayload = {
            ...draftPayload,
            revisionId: "rev-update",
            published: true,
            publishedAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
            markdown: "still stale markdown",
            content: {
                ...draftPayload.content,
                body: [makeTextBlock("Second version of the text")],
            },
        }

        await env.request({
            method: "PUT",
            path: `/gdocs/${gdocId}`,
            body: JSON.stringify(updatePayload),
        })

        const updated = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: gdocId })
            .first()) as DbRawPostGdoc

        expect(updated.markdown).toContain("Second version of the text")
        expect(updated.markdown).not.toContain("First published text")
    })
})
