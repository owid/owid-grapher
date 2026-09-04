import { describe, expect, it } from "vitest"
import { planDocumentPatch } from "./engine/planDoc.js"
import {
    ContentQueryRunner,
    planGdocMigrationDb,
} from "../../db/gdocMigrations/dbApplier.js"
import migration from "../../db/gdocMigrations/migrations/2026-09-image-has-outline.js"
import { buildDoc, docFromPlainText, simulateRequests } from "./testUtils.js"

describe("image-has-outline migration (gdoc side)", () => {
    it("adds hasOutline: true to images that don't set it and leaves the rest alone", async () => {
        const document = buildDoc([
            "[+body]",
            "{.image}",
            "filename: a.png",
            "{}",
            "{.image}",
            "filename: b.png",
            "hasOutline: false",
            "{}",
            "{.image}",
            "filename: c.png",
            "hasOutline: true",
            "{}",
            "{.sticky-right}",
            "[.+right]",
            "{.image}",
            "filename: nested.png",
            "size: narrow",
            "{}",
            "[]",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, migration)
        expect(plan.flags).toEqual([])
        expect(plan.matchedBlockCount).toEqual(4)
        expect(plan.editSummaries).toEqual([
            `{.image}: add "hasOutline" = "true"`,
            `{.image}: add "hasOutline" = "true"`,
        ])
        expect(simulateRequests(document, plan.requests)).toEqual(
            [
                "[+body]",
                "{.image}",
                "filename: a.png",
                "hasOutline: true",
                "{}",
                "{.image}",
                "filename: b.png",
                "hasOutline: false",
                "{}",
                "{.image}",
                "filename: c.png",
                "hasOutline: true",
                "{}",
                "{.sticky-right}",
                "[.+right]",
                "{.image}",
                "filename: nested.png",
                "size: narrow",
                "hasOutline: true",
                "{}",
                "[]",
                "{}",
                "[]",
                "",
            ].join("\n")
        )
    })

    it("fills in an empty hasOutline value", async () => {
        const document = buildDoc([
            "[+body]",
            "{.image}",
            "filename: a.png",
            "hasOutline:",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, migration)
        expect(plan.flags).toEqual([])
        expect(plan.editSummaries).toEqual([
            `{.image}: set "hasOutline" = "true"`,
        ])
        expect(simulateRequests(document, plan.requests)).toContain(
            "filename: a.png\nhasOutline: true\n{}"
        )
    })

    it("is a no-op on already-migrated docs", async () => {
        const document = buildDoc([
            "[+body]",
            "{.image}",
            "filename: a.png",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, migration)
        const migrated = docFromPlainText(
            simulateRequests(document, plan.requests)
        )
        const replan = await planDocumentPatch("doc-1", migrated, migration)
        expect(replan.flags).toEqual([])
        expect(replan.requests).toEqual([])
        expect(replan.editSummaries).toEqual([])
    })
})

describe("image-has-outline migration (db side)", () => {
    function fakeQueryRunner(content: unknown): ContentQueryRunner {
        return {
            query: async (sql: string) => {
                if (sql.startsWith("SELECT"))
                    return [{ id: "doc-1", content: JSON.stringify(content) }]
                throw new Error(`unexpected sql: ${sql}`)
            },
        }
    }

    it("adds hasOutline: true where the stored block lacks it, at any depth", async () => {
        const content = {
            body: [
                { type: "image", filename: "a.png", size: "wide" },
                { type: "image", filename: "b.png", hasOutline: false },
                {
                    type: "sticky-right",
                    left: [],
                    right: [{ type: "image", filename: "nested.png" }],
                },
            ],
        }
        const plan = await planGdocMigrationDb(
            fakeQueryRunner(content),
            migration
        )
        expect(plan.changes).toHaveLength(1)
        expect(plan.changes[0].after).toEqual({
            body: [
                {
                    type: "image",
                    filename: "a.png",
                    size: "wide",
                    hasOutline: true,
                },
                { type: "image", filename: "b.png", hasOutline: false },
                {
                    type: "sticky-right",
                    left: [],
                    right: [
                        {
                            type: "image",
                            filename: "nested.png",
                            hasOutline: true,
                        },
                    ],
                },
            ],
        })
    })

    it("leaves docs whose images all set hasOutline unchanged", async () => {
        const content = {
            body: [
                { type: "image", filename: "a.png", hasOutline: true },
                { type: "image", filename: "b.png", hasOutline: false },
            ],
        }
        const plan = await planGdocMigrationDb(
            fakeQueryRunner(content),
            migration
        )
        expect(plan.changes).toEqual([])
    })
})
