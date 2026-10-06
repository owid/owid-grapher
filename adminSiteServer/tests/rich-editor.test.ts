import { describe, expect, it } from "vitest"
import {
    OwidGdocAuthoringMode,
    PostsGdocsDraftsTableName,
    PostsGdocsRevisionsTableName,
    PostsGdocsTableName,
    type DbRawPostGdoc,
} from "@ourworldindata/types"
import { getAdminTestEnv } from "./testEnv.js"

const env = getAdminTestEnv()

const makeTextBlock = (text: string) => ({
    type: "text",
    value: [{ spanType: "span-simple-text", text }],
    parseErrors: [],
})

async function rawRequest(arg: {
    method: "POST" | "PUT"
    path: string
    body?: string
}): Promise<Response> {
    return fetch(env.baseUrl + arg.path, {
        method: arg.method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.apiKey}`,
        },
        body: arg.body,
    })
}

async function createNativeDoc(title: string): Promise<any> {
    return env.request({
        method: "POST",
        path: "/gdocs/createNative",
        body: JSON.stringify({ title }),
    })
}

describe("rich editor API", { timeout: 20000 }, () => {
    it("creates a native doc with a draft and initial revision", async () => {
        const created = await createNativeDoc("My test insight")
        expect(created.id).toMatch(/^native-/)
        expect(created.authoringMode).toBe(OwidGdocAuthoringMode.Native)
        expect(created.draftRevisionId).toBeGreaterThan(0)
        expect(created.content.type).toBe("data-insight")

        const row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(row.authoringMode).toBe("native")
        expect(row.published).toBe(0)

        const draft = await env
            .testKnex(PostsGdocsDraftsTableName)
            .where({ gdocId: created.id })
            .first()
        expect(draft).toBeDefined()

        const editorView = await env.fetchJson(`/gdocs/${created.id}/editor`)
        expect(editorView.draftRevisionId).toBe(created.draftRevisionId)
        expect(editorView.content.title).toBe("My test insight")
    })

    it("saves the body, bumping the revision and keeping content in sync while unpublished", async () => {
        const created = await createNativeDoc("Save test")

        const save = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Hello native world")],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })
        expect(save.revisionId).toBeGreaterThan(created.draftRevisionId)

        // unpublished: posts_gdocs.content and markdown follow the draft
        const row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(row.markdown).toContain("Hello native world")
        expect(JSON.parse(row.content).body[0].value[0].text).toBe(
            "Hello native world"
        )

        // saving against a stale base revision is rejected with a 409
        const conflictResponse = await rawRequest({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Stale write")],
                baseRevisionId: created.draftRevisionId,
            }),
        })
        expect(conflictResponse.status).toBe(409)
        const conflict = await conflictResponse.json()
        expect(conflict.currentRevisionId).toBe(save.revisionId)
    })

    it("lists revisions and restores an older one", async () => {
        const created = await createNativeDoc("Restore test")

        const firstSave = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Version one")],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })
        await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Version two")],
                baseRevisionId: firstSave.revisionId,
                kind: "manual",
            }),
        })

        const { revisions } = await env.fetchJson(
            `/gdocs/${created.id}/revisions`
        )
        expect(revisions.length).toBe(3) // created + two saves
        expect(revisions[0].createdByFullName).toBe("Admin")

        const restored = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/revisions/${firstSave.revisionId}/restore`,
        })
        expect(restored.revisionId).toBeGreaterThan(firstSave.revisionId)

        const editorView = await env.fetchJson(`/gdocs/${created.id}/editor`)
        expect(editorView.content.body[0].value[0].text).toBe("Version one")

        const revisionRows = await env
            .testKnex(PostsGdocsRevisionsTableName)
            .where({ gdocId: created.id })
        expect(
            revisionRows.filter((r: { kind: string }) => r.kind === "restore")
        ).toHaveLength(1)
    })

    it("rejects body saves for gdocs-mode documents and supports conversion", async () => {
        const gdocId = "rich-editor-conversion-test"
        await env.testKnex(PostsGdocsTableName).insert({
            id: gdocId,
            slug: "conversion-test",
            content: JSON.stringify({
                type: "article",
                title: "Conversion test",
                authors: ["Admin"],
                body: [makeTextBlock("From gdocs")],
            }),
            published: 0,
        })

        const rejected = await rawRequest({
            method: "PUT",
            path: `/gdocs/${gdocId}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Nope")],
                baseRevisionId: null,
            }),
        })
        expect(rejected.status).toBe(400)

        const converted = await env.request({
            method: "POST",
            path: `/gdocs/${gdocId}/convertToNative`,
        })
        expect(converted.authoringMode).toBe(OwidGdocAuthoringMode.Native)
        expect(converted.content.body[0].value[0].text).toBe("From gdocs")

        const save = await env.request({
            method: "PUT",
            path: `/gdocs/${gdocId}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Now native")],
                baseRevisionId: converted.draftRevisionId,
            }),
        })
        expect(save.revisionId).toBeGreaterThan(0)
    })

    it("resolves image references", async () => {
        // images is not part of the standard test-table cleanup, so clean up
        // manually at the end
        await env.testKnex("images").insert({
            filename: "test-image.png",
            cloudflareId: "cf-test-id",
            originalWidth: 800,
            originalHeight: 600,
            defaultAlt: "A test image",
            googleId: "google-test-id",
            hash: "test-hash",
        })

        try {
            const resolved = await env.request({
                method: "POST",
                path: "/editor/resolveReferences",
                body: JSON.stringify({
                    filenames: ["test-image.png", "nope.png"],
                }),
            })
            expect(resolved.imageMetadata["test-image.png"].cloudflareId).toBe(
                "cf-test-id"
            )
            expect(resolved.imageMetadata["nope.png"]).toBeUndefined()
            expect(resolved.linkedCharts).toEqual({})
        } finally {
            await env
                .testKnex("images")
                .where({ filename: "test-image.png" })
                .delete()
        }
    })
})
