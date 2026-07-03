import { describe, expect, it } from "vitest"
import { applyGdocMigrationToDb, ContentQueryRunner } from "./dbApplier.js"
import {
    mapValue,
    removeKey,
    renameEnrichedProperty,
    renameKey,
    setValue,
} from "./helpers.js"
import { defineGdocMigration, EnrichedBlockJson } from "./types.js"

interface FakeRow {
    id: string
    content: string
}

interface CapturedUpdate {
    id: string
    content: string
    /** Parameters between content and id — the denormalized column values */
    extraParams: unknown[]
}

function fakeQueryRunner(rows: FakeRow[]): {
    runner: ContentQueryRunner
    updates: CapturedUpdate[]
    sqls: string[]
} {
    const updates: CapturedUpdate[] = []
    const sqls: string[] = []
    const runner: ContentQueryRunner = {
        query: async (sql: string, parameters?: unknown[]) => {
            sqls.push(sql)
            if (sql.startsWith("SELECT")) return rows
            if (sql.startsWith("UPDATE")) {
                const params = parameters!
                updates.push({
                    id: String(params[params.length - 1]),
                    content: String(params[0]),
                    extraParams: params.slice(1, -1),
                })
                return undefined
            }
            throw new Error(`unexpected sql: ${sql}`)
        },
    }
    return { runner, updates, sqls }
}

const captionSpans = [{ spanType: "span-simple-text", text: "A caption" }]

const migration = defineGdocMigration({
    name: "test-db-rename",
    mode: "component",
    blockType: "chart",
    discover: "SELECT 1",
    transform: (block) => block,
    dbTransform: renameEnrichedProperty("caption", "subtitle"),
})

describe(applyGdocMigrationToDb, () => {
    it("renames the property on matching blocks, including nested ones", async () => {
        const content = {
            title: "My article",
            body: [
                { type: "text", value: [] },
                {
                    type: "chart",
                    url: "https://x.org/a",
                    caption: captionSpans,
                },
                {
                    type: "sticky-right",
                    left: [{ type: "chart", caption: captionSpans }],
                    right: [{ type: "chart", url: "https://x.org/b" }],
                },
            ],
        }
        const { runner, updates } = fakeQueryRunner([
            { id: "doc-1", content: JSON.stringify(content) },
        ])

        const result = await applyGdocMigrationToDb(runner, migration)
        expect(result).toEqual({ scanned: 1, updated: 1 })
        expect(updates).toHaveLength(1)

        const updated = JSON.parse(updates[0].content)
        expect(updated.body[1].subtitle).toEqual(captionSpans)
        expect(updated.body[1].caption).toBeUndefined()
        expect(updated.body[2].left[0].subtitle).toEqual(captionSpans)
        // untouched parts survive byte-identically
        expect(updated.title).toEqual("My article")
        expect(updated.body[2].right[0]).toEqual({
            type: "chart",
            url: "https://x.org/b",
        })
    })

    it("does not write rows without matches", async () => {
        const content = {
            body: [{ type: "chart", url: "https://x.org/a" }],
        }
        const { runner, updates } = fakeQueryRunner([
            { id: "doc-1", content: JSON.stringify(content) },
        ])
        const result = await applyGdocMigrationToDb(runner, migration)
        expect(result).toEqual({ scanned: 1, updated: 0 })
        expect(updates).toEqual([])
    })

    it("removes blocks from arrays when dbTransform returns null", async () => {
        const removal = defineGdocMigration({
            name: "test-db-remove",
            mode: "component",
            blockType: "chart",
            discover: "SELECT 1",
            transform: () => null,
            dbTransform: () => null,
        })
        const content = {
            body: [
                { type: "text", value: [] },
                { type: "chart", url: "https://x.org/a" },
            ],
        }
        const { runner, updates } = fakeQueryRunner([
            { id: "doc-1", content: JSON.stringify(content) },
        ])
        await applyGdocMigrationToDb(runner, removal)
        expect(JSON.parse(updates[0].content).body).toEqual([
            { type: "text", value: [] },
        ])
    })

    it("supports async dbTransforms with context", async () => {
        const contextual = defineGdocMigration({
            name: "test-db-context",
            mode: "component",
            blockType: "chart",
            discover: "SELECT 1",
            transform: (block) => block,
            dbTransform: async (
                block,
                context
            ): Promise<EnrichedBlockJson> => ({
                ...block,
                source: context.gdocId,
            }),
        })
        const { runner, updates } = fakeQueryRunner([
            {
                id: "doc-42",
                content: JSON.stringify({ body: [{ type: "chart" }] }),
            },
        ])
        await applyGdocMigrationToDb(runner, contextual)
        expect(JSON.parse(updates[0].content).body[0].source).toEqual("doc-42")
    })

    it("throws when the migration has no dbTransform", async () => {
        const withoutDb = defineGdocMigration({
            name: "test-no-db",
            mode: "component",
            blockType: "chart",
            discover: "SELECT 1",
            transform: (block) => block,
        })
        const { runner } = fakeQueryRunner([])
        await expect(applyGdocMigrationToDb(runner, withoutDb)).rejects.toThrow(
            /no dbTransform/
        )
    })
})

describe("frontmatter mode", () => {
    it("applies ops to top-level content fields, case-insensitively", async () => {
        const frontmatter = defineGdocMigration({
            name: "test-fm",
            mode: "frontmatter",
            discover: "SELECT 1",
            ops: [
                renameKey("hide-subscribe-banner", "hide-newsletter-banner"),
                setValue("sidebar-toc", "true"),
                removeKey("atom-title"),
            ],
        })
        const content = {
            title: "My article",
            "hide-subscribe-banner": true,
            "atom-title": "Old atom title",
            body: [{ type: "chart", caption: captionSpans }],
        }
        const { runner, updates } = fakeQueryRunner([
            { id: "doc-1", content: JSON.stringify(content) },
        ])
        const result = await applyGdocMigrationToDb(runner, frontmatter)
        expect(result).toEqual({ scanned: 1, updated: 1 })

        const updated = JSON.parse(updates[0].content)
        expect(updated["hide-newsletter-banner"]).toBe(true)
        expect(updated["hide-subscribe-banner"]).toBeUndefined()
        expect(updated["sidebar-toc"]).toBe(true) // "true" coerced like the parser
        expect(updated["atom-title"]).toBeUndefined()
        expect(updated.body).toEqual(content.body) // body untouched
    })

    it("re-derives denormalized columns when type changes", async () => {
        const frontmatter = defineGdocMigration({
            name: "test-fm-type",
            mode: "frontmatter",
            discover: "SELECT 1",
            ops: [
                mapValue("type", (value) =>
                    value === "linear-topic-page" ? "topic-page" : value
                ),
            ],
        })
        const { runner, updates, sqls } = fakeQueryRunner([
            {
                id: "doc-1",
                content: JSON.stringify({ type: "linear-topic-page" }),
            },
        ])
        await applyGdocMigrationToDb(runner, frontmatter)
        expect(JSON.parse(updates[0].content).type).toEqual("topic-page")
        const updateSql = sqls.find((sql) => sql.startsWith("UPDATE"))
        expect(updateSql).toContain("`type` = ?")
        expect(updates[0].extraParams).toEqual(["topic-page"])
    })

    it("does not write rows whose frontmatter is already correct", async () => {
        const frontmatter = defineGdocMigration({
            name: "test-fm-noop",
            mode: "frontmatter",
            discover: "SELECT 1",
            ops: [renameKey("byline", "authors")],
        })
        const { runner, updates } = fakeQueryRunner([
            { id: "doc-1", content: JSON.stringify({ authors: ["Jane"] }) },
        ])
        const result = await applyGdocMigrationToDb(runner, frontmatter)
        expect(result).toEqual({ scanned: 1, updated: 0 })
        expect(updates).toEqual([])
    })
})
