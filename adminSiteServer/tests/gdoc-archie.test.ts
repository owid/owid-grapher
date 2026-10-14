import { describe, it, expect } from "vitest"
import { PostsGdocsTableName } from "@ourworldindata/types"
import { getAdminTestEnv } from "./testEnv.js"

const env = getAdminTestEnv()

// Google Docs API calls are mocked to read from
// adminSiteServer/test-files/<documentId>.json (see setupDbTest.ts)
const FIXTURE_DOC_ID = "gdoc-archie-api-test"
const FIXTURE_REVISION_ID = "archie-test-revision-1"

const VALID_ARCHIE = `title: Archie API test
authors: Author
type: article
[+body]
Hello world
[]
`

const INVALID_ARCHIE = `title: Archie API test
authors: Author
type: article
[+body]
{.small-chart}
url: https://ourworldindata.org/grapher/life-expectancy
{}
[]
`

// env.request()/fetchJson() assert status 200, so error paths use raw fetch
async function rawRequest(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: object
): Promise<Response> {
    return await fetch(env.baseUrl + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}

async function seedGdocRow(id: string, published: boolean): Promise<void> {
    const row = {
        id,
        slug: id,
        content: JSON.stringify({ title: "Archie API test", type: "article" }),
        published: published ? 1 : 0,
    }
    await env.testKnex(PostsGdocsTableName).insert(row).onConflict("id").merge()
}

describe("gdoc ArchieML API", { timeout: 20000 }, () => {
    it("GET /gdocs/:id/archie returns the ArchieML view of the doc", async () => {
        const json = await env.fetchJson(`/gdocs/${FIXTURE_DOC_ID}/archie`)
        expect(typeof json.archieMl).toBe("string")
        expect(json.archieMl.length).toBeGreaterThan(0)
        expect(json.revisionId).toBe(FIXTURE_REVISION_ID)
        expect(json.registered).toBe(false)
        expect(json.published).toBe(false)
    })

    it("PUT ?dryRun=true validates without writing", async () => {
        const res = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie?dryRun=true`,
            { archieMl: VALID_ARCHIE }
        )
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.writable).toBe(true)
        expect(json.errors).toEqual([])
        // dry run must not create or touch any DB row
        const row = await env
            .testKnex(PostsGdocsTableName)
            .where({ id: FIXTURE_DOC_ID })
            .first()
        expect(row).toBeUndefined()
    })

    it("PUT ?dryRun=true warns that invented front matter like slug is dropped", async () => {
        const res = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie?dryRun=true`,
            { archieMl: `slug: my-new-slug\n${VALID_ARCHIE}` }
        )
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.writable).toBe(true)
        expect(json.warnings).toContainEqual(
            expect.objectContaining({
                property: "slug",
                message: expect.stringContaining("managed in the admin"),
            })
        )
    })

    it("PUT rejects invalid ArchieML with 400 and structured errors", async () => {
        const res = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie?dryRun=true`,
            { archieMl: INVALID_ARCHIE }
        )
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.writable).toBe(false)
        expect(json.errors.length).toBeGreaterThan(0)
        expect(json.errors[0].message).toContain("failed to parse")
    })

    it("PUT accepts leading/trailing :skip blocks but rejects mid-document ones", async () => {
        const edges = `:skip\npreview link\n:endskip\n${VALID_ARCHIE}:ignore\ngraveyard\n`
        const okRes = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie?dryRun=true`,
            { archieMl: edges }
        )
        expect(okRes.status).toBe(200)
        expect((await okRes.json()).writable).toBe(true)

        const midDoc = VALID_ARCHIE.replace(
            "Hello world",
            "Hello world\n:skip\nhidden draft\n:endskip\nMore text"
        )
        const midRes = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie?dryRun=true`,
            { archieMl: midDoc }
        )
        expect(midRes.status).toBe(400)
        const json = await midRes.json()
        expect(json.writable).toBe(false)
        expect(json.errors[0].message).toContain("middle of the document")
    })

    it("POST rejects any :skip/:ignore in a new doc", async () => {
        const res = await rawRequest("POST", `/gdocs?dryRun=true`, {
            archieMl: `:skip\nnote\n:endskip\n${VALID_ARCHIE}`,
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.errors[0].message).toContain("should not contain")
    })

    it("PUT rejects a missing archieMl body with 400", async () => {
        const res = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie`,
            {}
        )
        expect(res.status).toBe(400)
    })

    it("PUT refuses a doc that is not registered in the admin with 404", async () => {
        const res = await rawRequest(
            "PUT",
            `/gdocs/gdoc-archie-unregistered/archie`,
            { archieMl: VALID_ARCHIE, expectedRevisionId: "whatever" }
        )
        expect(res.status).toBe(404)
    })

    it("GET /gdocs/:id/validation refuses an unregistered doc with 404", async () => {
        const res = await rawRequest(
            "GET",
            `/gdocs/gdoc-archie-unregistered/validation`
        )
        expect(res.status).toBe(404)
    })

    it("PUT refuses a published doc with 403", async () => {
        await seedGdocRow(FIXTURE_DOC_ID, true)
        const res = await rawRequest("PUT", `/gdocs/${FIXTURE_DOC_ID}/archie`, {
            archieMl: VALID_ARCHIE,
            expectedRevisionId: FIXTURE_REVISION_ID,
        })
        expect(res.status).toBe(403)
    })

    it("PUT requires expectedRevisionId and rejects a stale one with 409", async () => {
        await seedGdocRow(FIXTURE_DOC_ID, false)

        const missing = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie`,
            { archieMl: VALID_ARCHIE }
        )
        expect(missing.status).toBe(400)

        const stale = await rawRequest(
            "PUT",
            `/gdocs/${FIXTURE_DOC_ID}/archie`,
            { archieMl: VALID_ARCHIE, expectedRevisionId: "stale-revision" }
        )
        expect(stale.status).toBe(409)
    })

    it("POST /gdocs ?dryRun=true validates creation input", async () => {
        const ok = await rawRequest("POST", `/gdocs?dryRun=true`, {
            archieMl: VALID_ARCHIE,
        })
        expect(ok.status).toBe(200)
        expect((await ok.json()).writable).toBe(true)

        const bad = await rawRequest("POST", `/gdocs?dryRun=true`, {
            archieMl: INVALID_ARCHIE,
        })
        expect(bad.status).toBe(400)
        expect((await bad.json()).writable).toBe(false)
    })

    it("POST /gdocs without a configured target folder returns 400", async () => {
        // GDOCS_AGENT_DRAFTS_FOLDER is not set in the test environment
        const res = await rawRequest("POST", `/gdocs`, {
            archieMl: VALID_ARCHIE,
        })
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error.message).toContain("target Drive folder")
    })
})
