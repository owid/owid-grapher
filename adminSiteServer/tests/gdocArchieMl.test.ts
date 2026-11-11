import { describe, expect, it } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    JsonError,
    type OwidGdocBaseInterface,
    PostsGdocsTableName,
    PostsGdocsXTagsTableName,
    TagGraphRootName,
    TagGraphTableName,
    TagsTableName,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { getGdocBaseObjectById } from "../../db/model/Gdoc/GdocFactory.js"
import {
    type DocReport,
    getDocReport,
    loadWritableGdoc,
} from "../gdocArchieMl.js"

const env = getAdminTestEnv()

// A registered, unpublished draft, inserted directly so nothing is fetched
// from Google
async function seedDraft(
    id: string,
    slug: string = id,
    published: boolean = false
): Promise<void> {
    await env.testKnex(PostsGdocsTableName).insert({
        id,
        slug,
        content: JSON.stringify({ title: "Draft", type: "article", body: [] }),
        published: published ? 1 : 0,
        publishedAt: published ? new Date("2026-01-01") : null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
    })
}

// Runs `fn` with the doc's base, loaded like the endpoints load it (tags
// included), from the DB only
async function withBase<T>(
    gdocId: string,
    fn: (
        trx: db.KnexReadonlyTransaction,
        base: OwidGdocBaseInterface
    ) => Promise<T>
): Promise<T> {
    return db.knexReadonlyTransaction(
        async (trx) => {
            const base = await getGdocBaseObjectById(trx, gdocId, true)
            if (!base) throw new Error(`No posts_gdocs row for ${gdocId}`)
            return fn(trx, base)
        },
        db.TransactionCloseMode.KeepOpen,
        env.testKnex
    )
}

async function reportFor(gdocId: string, text: string): Promise<DocReport> {
    return withBase(gdocId, (trx, base) => getDocReport(trx, base, text))
}

const ARTICLE_TEXT =
    "type: article\ntitle: A report test\n\n[+body]\nSome text.\n[]\n"

describe(getDocReport, { timeout: 20000 }, () => {
    it("lists the missing excerpt of an article as an error", async () => {
        const gdocId = "gdoc-archieml-report-test"
        await seedDraft(gdocId)

        const report = await reportFor(gdocId, ARTICLE_TEXT)

        expect(report.errors).toContainEqual(
            expect.objectContaining({ property: "excerpt", type: "error" })
        )
    })

    it("doesn't warn about missing tags on a tagged article", async () => {
        const gdocId = "gdoc-archieml-report-tagged-test"
        await seedDraft(gdocId)
        // Loading tags also loads their breadcrumbs, which need a tag graph
        await env.testKnex(TagsTableName).insert([
            { id: 90000, name: TagGraphRootName },
            { id: 90001, name: "Archieml report test tag" },
        ])
        await env
            .testKnex(TagGraphTableName)
            .insert({ parentId: 90000, childId: 90001 })
        await env
            .testKnex(PostsGdocsXTagsTableName)
            .insert({ gdocId, tagId: 90001 })

        const report = await reportFor(gdocId, ARTICLE_TEXT)

        expect(report.warnings).not.toContainEqual(
            expect.objectContaining({
                message: expect.stringMatching(/no tags set/),
            })
        )
    })

    it("leaves out the empty-slug error of an unpublished draft", async () => {
        const gdocId = "gdoc-archieml-report-empty-slug-test"
        await seedDraft(gdocId, "")

        const report = await reportFor(gdocId, ARTICLE_TEXT)

        expect(report.errors).not.toContainEqual(
            expect.objectContaining({ property: "slug" })
        )
    })

    it("keeps the empty-slug error of a published doc", async () => {
        const gdocId = "gdoc-archieml-report-published-empty-slug-test"
        await seedDraft(gdocId, "", true)

        const report = await reportFor(gdocId, ARTICLE_TEXT)

        expect(report.errors).toContainEqual(
            expect.objectContaining({ property: "slug", type: "error" })
        )
    })

    it("reports a missing type as a single body error", async () => {
        const gdocId = "gdoc-archieml-report-no-type-test"
        await seedDraft(gdocId)

        const report = await reportFor(gdocId, "title: No type here\n")

        expect(report).toEqual({
            errors: [
                {
                    property: "body",
                    type: "error",
                    message: expect.stringMatching(/"type" is missing/),
                },
            ],
            warnings: [],
        })
    })
})

describe(loadWritableGdoc, { timeout: 20000 }, () => {
    it("refuses with a 400 an author doc whose subclass enrichment throws", async () => {
        const gdocId = "gdoc-archieml-author-bio-test"
        await seedDraft(gdocId)

        // `bio` should be an array; as a scalar, the plain parse accepts it
        // but GdocAuthor's enrichment throws
        const thrown = await withBase(gdocId, (trx, base) =>
            loadWritableGdoc(
                trx,
                base,
                "type: author\ntitle: Jane Doe\nbio: Not an array\n"
            )
        ).catch((error: unknown) => error)

        expect(thrown).toBeInstanceOf(JsonError)
        expect((thrown as JsonError).status).toBe(400)
        expect((thrown as JsonError).message).toMatch(/"author" doc/)
    })
})
