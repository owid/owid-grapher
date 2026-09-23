import * as _ from "lodash-es"
import { describe, expect, it } from "vitest"
import {
    NARRATIVE_CHART_PROPS_TO_OMIT,
    OwidGdocAuthoringMode,
    PostsGdocsCommentThreadsTableName,
    PostsGdocsDraftsTableName,
    PostsGdocsRevisionsTableName,
    PostsGdocsTableName,
    type DbRawPostGdoc,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
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

    it("publishes and unpublishes a native doc via the dedicated endpoints", async () => {
        const created = await createNativeDoc("Publish test")
        const save = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Ready to publish")],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })

        // publishing against a stale revision is rejected
        const stale = await rawRequest({
            method: "POST",
            path: `/gdocs/${created.id}/publish`,
            body: JSON.stringify({
                baseRevisionId: created.draftRevisionId,
            }),
        })
        expect(stale.status).toBe(409)

        const published = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/publish`,
            body: JSON.stringify({ baseRevisionId: save.revisionId }),
        })
        expect(published.published).toBe(true)
        expect(published.publishedAt).toBeTruthy()

        let row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(row.published).toBe(1)
        expect(row.publishedAt).toBeTruthy()
        expect(row.authoringMode).toBe("native")
        expect(JSON.parse(row.content).body[0].value[0].text).toBe(
            "Ready to publish"
        )

        const revisionRows = await env
            .testKnex(PostsGdocsRevisionsTableName)
            .where({ gdocId: created.id, kind: "publish" })
        expect(revisionRows).toHaveLength(1)

        // draft edits after publishing must not touch the live content
        await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Unpublished edit")],
                baseRevisionId: published.revisionId,
                kind: "manual",
            }),
        })
        row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(JSON.parse(row.content).body[0].value[0].text).toBe(
            "Ready to publish"
        )

        const unpublished = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/unpublish`,
        })
        expect(unpublished.published).toBe(false)
        row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(row.published).toBe(0)
    })

    it("saves settings without touching the body, with slug rules", async () => {
        const created = await createNativeDoc("Settings test")
        const save = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Body stays")],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })

        const settingsSave = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/editorSettings`,
            body: JSON.stringify({
                settings: {
                    title: "Settings test (renamed)",
                    "grapher-url":
                        "https://ourworldindata.org/grapher/life-expectancy",
                },
                slug: "settings-test-renamed",
                baseRevisionId: save.revisionId,
            }),
        })
        expect(settingsSave.revisionId).toBeGreaterThan(save.revisionId)

        const editorView = await env.fetchJson(`/gdocs/${created.id}/editor`)
        expect(editorView.content.title).toBe("Settings test (renamed)")
        expect(editorView.content["grapher-url"]).toBe(
            "https://ourworldindata.org/grapher/life-expectancy"
        )
        expect(editorView.content.body[0].value[0].text).toBe("Body stays")
        expect(editorView.slug).toBe("settings-test-renamed")

        // clearing a field via null removes it
        const cleared = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/editorSettings`,
            body: JSON.stringify({
                settings: { "grapher-url": null },
                baseRevisionId: settingsSave.revisionId,
            }),
        })
        expect(cleared.revisionId).toBeGreaterThan(settingsSave.revisionId)
        const clearedView = await env.fetchJson(`/gdocs/${created.id}/editor`)
        expect(clearedView.content["grapher-url"]).toBeUndefined()

        // body changes via the settings endpoint are rejected
        const bodyRejected = await rawRequest({
            method: "PUT",
            path: `/gdocs/${created.id}/editorSettings`,
            body: JSON.stringify({
                settings: { body: [] },
                baseRevisionId: cleared.revisionId,
            }),
        })
        expect(bodyRejected.status).toBe(400)
    })

    it("prevents the gdocs settings PUT from clobbering native body or publish state", async () => {
        const created = await createNativeDoc("Guard test")
        await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Native body")],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })

        const gdoc = await env.fetchJson(`/gdocs/${created.id}`)

        // publish-state change through the legacy endpoint is rejected
        const publishAttempt = await rawRequest({
            method: "PUT",
            path: `/gdocs/${created.id}`,
            body: JSON.stringify({
                ...gdoc,
                published: true,
                publishedAt: new Date(),
            }),
        })
        expect(publishAttempt.status).toBe(400)

        // body sent through the legacy endpoint is ignored in favor of the DB
        await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}`,
            body: JSON.stringify({
                ...gdoc,
                content: {
                    ...gdoc.content,
                    title: "Guard test (renamed)",
                    body: [makeTextBlock("Should be ignored")],
                },
            }),
        })
        const row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        const content = JSON.parse(row.content)
        expect(content.title).toBe("Guard test (renamed)")
        expect(content.body[0].value[0].text).toBe("Native body")
    })

    it("supports comment threads: create, reply, resolve, orphan via anchors", async () => {
        const created = await createNativeDoc("Comments test")
        const save = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Some commented text")],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })

        const thread = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/comments`,
            body: JSON.stringify({
                anchorType: "range",
                anchorFrom: 1,
                anchorTo: 10,
                anchorText: "Some comm",
                text: "Is this number right?",
            }),
        })
        expect(thread.status).toBe("open")
        expect(thread.comments).toHaveLength(1)
        expect(thread.comments[0].userFullName).toBe("Admin")

        const replied = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/comments/${thread.id}/replies`,
            body: JSON.stringify({ text: "Checked — it is." }),
        })
        expect(replied.comments).toHaveLength(2)

        const resolved = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/comments/${thread.id}`,
            body: JSON.stringify({ status: "resolved" }),
        })
        expect(resolved.status).toBe("resolved")
        expect(resolved.resolvedAt).toBeTruthy()

        const reopened = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/comments/${thread.id}`,
            body: JSON.stringify({ status: "open" }),
        })
        expect(reopened.status).toBe("open")

        // a body save reporting the anchor as gone orphans the thread…
        const orphanSave = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Rewritten")],
                baseRevisionId: save.revisionId,
                kind: "manual",
                commentAnchors: [
                    {
                        threadId: thread.id,
                        anchorFrom: null,
                        anchorTo: null,
                        anchorText: "Some comm",
                        orphaned: true,
                    },
                ],
            }),
        })
        let threadRow = await env
            .testKnex(PostsGdocsCommentThreadsTableName)
            .where({ id: thread.id })
            .first()
        expect(threadRow.status).toBe("orphaned")

        // …and a save reporting it back (e.g. after undo) reopens it
        await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Some commented text again")],
                baseRevisionId: orphanSave.revisionId,
                kind: "manual",
                commentAnchors: [
                    {
                        threadId: thread.id,
                        anchorFrom: 1,
                        anchorTo: 10,
                        anchorText: "Some comm",
                        orphaned: false,
                    },
                ],
            }),
        })
        threadRow = await env
            .testKnex(PostsGdocsCommentThreadsTableName)
            .where({ id: thread.id })
            .first()
        expect(threadRow.status).toBe("open")
        expect(threadRow.anchorFrom).toBe(1)

        const list = await env.fetchJson(`/gdocs/${created.id}/comments`)
        expect(list.threads).toHaveLength(1)
        expect(list.threads[0].comments).toHaveLength(2)
    })

    it("keeps block ids in drafts and revisions but strips them from live content", async () => {
        const created = await createNativeDoc("Block id test")
        const identifiedBlock = {
            type: "blockquote",
            text: [makeTextBlock("Quoted words")],
            parseErrors: [],
            id: "img-block-1",
        }
        const save = await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("With identity"), identifiedBlock],
                baseRevisionId: created.draftRevisionId,
                kind: "manual",
            }),
        })

        // the draft keeps the id …
        const draft = await env
            .testKnex(PostsGdocsDraftsTableName)
            .where({ gdocId: created.id })
            .first()
        expect(JSON.parse(draft.content).body[1].id).toBe("img-block-1")

        // … while live content (unpublished ⇒ synced from the draft) is stripped
        let row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(JSON.parse(row.content).body[1].id).toBeUndefined()
        expect(JSON.parse(row.content).body[1].type).toBe("blockquote")

        // publishing strips ids from live content, revision keeps them
        const published = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/publish`,
            body: JSON.stringify({ baseRevisionId: save.revisionId }),
        })
        expect(published.published).toBe(true)
        row = (await env
            .testKnex(PostsGdocsTableName)
            .where({ id: created.id })
            .first()) as DbRawPostGdoc
        expect(JSON.parse(row.content).body[1].id).toBeUndefined()

        const publishRevision = await env
            .testKnex(PostsGdocsRevisionsTableName)
            .where({ gdocId: created.id, kind: "publish" })
            .first()
        expect(JSON.parse(publishRevision.content).body[1].id).toBe(
            "img-block-1"
        )
    })

    it("supports block-anchored comment threads keyed by block id", async () => {
        const created = await createNativeDoc("Block thread test")

        // block threads require an anchorBlockId
        const missing = await rawRequest({
            method: "POST",
            path: `/gdocs/${created.id}/comments`,
            body: JSON.stringify({
                anchorType: "block",
                text: "No block id",
            }),
        })
        expect(missing.status).toBe(400)

        const thread = await env.request({
            method: "POST",
            path: `/gdocs/${created.id}/comments`,
            body: JSON.stringify({
                anchorType: "block",
                anchorBlockId: "img-block-9",
                anchorText: "image",
                text: "This chart looks wrong",
            }),
        })
        expect(thread.anchorType).toBe("block")
        expect(thread.anchorBlockId).toBe("img-block-9")
        expect(thread.status).toBe("open")

        // the client reports orphaning through the same anchors channel
        await env.request({
            method: "PUT",
            path: `/gdocs/${created.id}/body`,
            body: JSON.stringify({
                body: [makeTextBlock("Block was deleted")],
                baseRevisionId: created.draftRevisionId,
                commentAnchors: [
                    {
                        threadId: thread.id,
                        anchorFrom: null,
                        anchorTo: null,
                        anchorText: thread.anchorText,
                        orphaned: true,
                    },
                ],
            }),
        })
        const threads = await env.fetchJson(`/gdocs/${created.id}/comments`)
        const orphaned = threads.threads.find(
            (candidate: { id: number }) => candidate.id === thread.id
        )
        expect(orphaned.status).toBe("orphaned")
        expect(orphaned.anchorBlockId).toBe("img-block-9")
    })

    it("creates native articles when requested, rejects unsupported types", async () => {
        const created = await env.request({
            method: "POST",
            path: "/gdocs/createNative",
            body: JSON.stringify({
                title: "A native article",
                type: "article",
            }),
        })
        expect(created.content.type).toBe("article")
        expect(created.authoringMode).toBe(OwidGdocAuthoringMode.Native)

        // every non-singleton doc type can be born natively
        for (const type of [
            "linear-topic-page",
            "topic-page",
            "about-page",
            "announcement",
            "author",
            "profile",
        ]) {
            const doc = await env.request({
                method: "POST",
                path: "/gdocs/createNative",
                body: JSON.stringify({ title: `A native ${type}`, type }),
            })
            expect(doc.content.type).toBe(type)
            expect(doc.authoringMode).toBe(OwidGdocAuthoringMode.Native)
        }

        const rejected = await rawRequest({
            method: "POST",
            path: "/gdocs/createNative",
            body: JSON.stringify({
                title: "A native homepage",
                type: "homepage",
            }),
        })
        expect(rejected.status).toBe(400)
    })

    it("resolves narrative chart references without error", async () => {
        const resolved = await env.request({
            method: "POST",
            path: "/editor/resolveReferences",
            body: JSON.stringify({ narrativeChartNames: ["does-not-exist"] }),
        })
        expect(resolved.narrativeCharts).toEqual({})
    })

    it("resolves narrative charts with their id, slug and config id", async () => {
        // Mirrors the rich editor's create-narrative-chart flow: create a
        // parent chart, derive a narrative chart from its full config, then
        // resolve it by name.
        const chartResponse = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "parent-chart",
                title: "Parent chart",
                chartTypes: ["LineChart"],
                isPublished: true,
            }),
        })
        const parentChartId = chartResponse.chartId

        const fullConfig = await env.fetchJson(
            `/charts/${parentChartId}.config.json`
        )
        const created = await env.request({
            method: "POST",
            path: "/narrative-charts",
            body: JSON.stringify({
                type: "chart",
                name: "parent-chart-nc",
                parentChartId,
                config: _.omit(fullConfig, NARRATIVE_CHART_PROPS_TO_OMIT),
            }),
        })
        expect(created.narrativeChartId).toBeGreaterThan(0)

        const resolved = await env.request({
            method: "POST",
            path: "/editor/resolveReferences",
            body: JSON.stringify({
                narrativeChartNames: ["parent-chart-nc", "does-not-exist"],
            }),
        })
        const info = resolved.narrativeCharts["parent-chart-nc"]
        expect(info.id).toBe(created.narrativeChartId)
        expect(info.parentChartSlug).toBe("parent-chart")
        expect(typeof info.chartConfigId).toBe("string")
        expect(resolved.narrativeCharts["does-not-exist"]).toBeUndefined()
    })

    // (presence moved into the sync connection's awareness states in M5c;
    // the heartbeat endpoint is gone — see rich-editor-sync.test.ts)

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
