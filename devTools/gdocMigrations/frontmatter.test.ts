import { describe, expect, it } from "vitest"
import { planDocumentPatch } from "./engine/planDoc.js"
import {
    buildExpectedLines,
    compareToExpectedLines,
} from "./engine/verifyDoc.js"
import { gdocToSourceMappedLines } from "./engine/sourceMap.js"
import {
    mapValue,
    removeKey,
    renameKey,
    setValue,
} from "../../db/gdocMigrations/helpers.js"
import { defineGdocMigration, FrontmatterOp, GdocMigration } from "./types.js"
import {
    buildDoc,
    docFromPlainText,
    para,
    simulateRequests,
} from "./testUtils.js"

function frontmatterMigration(ops: FrontmatterOp[]): GdocMigration {
    return defineGdocMigration({
        name: "test-frontmatter",
        mode: "frontmatter",
        discover: "SELECT 1",
        ops,
    })
}

const docSpecs = [
    "title: My article",
    "Hide-Subscribe-Banner: true",
    "type: linear-topic-page",
    "",
    "[+body]",
    "{.chart}",
    "caption: unrelated",
    "{}",
    "[]",
]

describe("frontmatter mode", () => {
    it("renames a key case-insensitively, leaving component properties alone", async () => {
        const document = buildDoc(docSpecs)
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([
                renameKey("hide-subscribe-banner", "hide-newsletter-banner"),
            ])
        )
        expect(plan.flags).toEqual([])
        expect(plan.editSummaries).toEqual([
            `frontmatter: rename "Hide-Subscribe-Banner" → "hide-newsletter-banner"`,
        ])
        const result = simulateRequests(document, plan.requests)
        expect(result).toContain("hide-newsletter-banner: true\n")
        expect(result).not.toContain("Hide-Subscribe-Banner")
        expect(result).toContain("caption: unrelated\n") // component untouched
    })

    it("maps a value and survives the full verify cycle", async () => {
        const migration = frontmatterMigration([
            mapValue("type", (value) =>
                value === "linear-topic-page" ? "topic-page" : value
            ),
        ])
        const document = buildDoc(docSpecs)
        const plan = await planDocumentPatch("doc-1", document, migration)
        expect(plan.flags).toEqual([])
        expect(plan.editSummaries).toEqual([
            `frontmatter: set "type" = "topic-page"`,
        ])

        const migrated = docFromPlainText(
            simulateRequests(document, plan.requests)
        )
        const mismatches = compareToExpectedLines(
            buildExpectedLines(plan.lines, plan.blockEdits),
            gdocToSourceMappedLines(migrated)
        )
        expect(mismatches).toEqual([])

        const replan = await planDocumentPatch("doc-1", migrated, migration)
        expect(replan.flags).toEqual([])
        expect(replan.requests).toEqual([])
    })

    it("removes a key and inserts a missing one after the last frontmatter line", async () => {
        const document = buildDoc(docSpecs)
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([
                removeKey("hide-subscribe-banner"),
                setValue("sidebar-toc", true),
            ])
        )
        expect(plan.flags).toEqual([])
        const result = simulateRequests(document, plan.requests)
        expect(result).not.toContain("Hide-Subscribe-Banner")
        expect(result).toContain(
            "type: linear-topic-page\nsidebar-toc: true\n\n[+body]"
        )
    })

    it("treats setValue on an already-correct value as a no-op", async () => {
        const document = buildDoc(docSpecs)
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([setValue("type", "linear-topic-page")])
        )
        expect(plan.flags).toEqual([])
        expect(plan.requests).toEqual([])
    })

    it("does not match keys inside blocks", async () => {
        const document = buildDoc(docSpecs)
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([renameKey("caption", "subtitle")])
        )
        expect(plan.flags).toEqual([])
        expect(plan.requests).toEqual([])
        expect(plan.matchedBlockCount).toEqual(0)
    })

    it("flags duplicate frontmatter keys", async () => {
        const document = buildDoc([
            "type: article",
            "Type: article",
            "[+body]",
            "[]",
        ])
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([mapValue("type", () => "post")])
        )
        expect(plan.requests).toEqual([])
        expect(plan.flags.map((flag) => flag.reason)).toEqual([
            "duplicate-frontmatter-key",
        ])
    })

    it("flags a rename whose target key already exists", async () => {
        const document = buildDoc([
            "byline: Jane Doe",
            "authors: Jane Doe",
            "[+body]",
            "[]",
        ])
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([renameKey("byline", "authors")])
        )
        expect(plan.requests).toEqual([])
        expect(plan.flags.map((flag) => flag.reason)).toEqual([
            "duplicate-frontmatter-key",
        ])
    })

    it("flags non-idempotent mapValue ops", async () => {
        const document = buildDoc(docSpecs)
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([
                mapValue("type", (value) => `${String(value)}!`),
            ])
        )
        expect(plan.requests).toEqual([])
        expect(plan.flags.map((flag) => flag.reason)).toEqual([
            "non-idempotent-transform",
        ])
    })

    it("fails closed when a suggestion overlaps a target line", async () => {
        const document = buildDoc([
            "title: My article",
            para("type: ", {
                text: "linear-topic-page",
                suggestedDeletion: true,
            }),
            "[+body]",
            "[]",
        ])
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            frontmatterMigration([mapValue("type", () => "topic-page")])
        )
        expect(plan.requests).toEqual([])
        expect(plan.flags.map((flag) => flag.reason)).toEqual([
            "pending-suggestions-in-target",
        ])
    })

    it("refuses migrations that touch refs/faqs/details at definition time", () => {
        expect(() => frontmatterMigration([removeKey("refs")])).toThrow(
            /off limits/
        )
    })
})
