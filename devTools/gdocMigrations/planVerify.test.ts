import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"
import { planDocumentPatch } from "./engine/planDoc.js"
import {
    buildExpectedLines,
    compareToExpectedLines,
} from "./engine/verifyDoc.js"
import {
    collectSuggestedRanges,
    rangesIntersect,
} from "./engine/suggestions.js"
import { gdocToSourceMappedLines } from "./engine/sourceMap.js"
import { Journal } from "./engine/journal.js"
import {
    composeTransforms,
    removeProperty,
    renameProperty,
} from "../../db/gdocMigrations/helpers.js"
import { defineGdocMigration, GdocMigration } from "./types.js"
import {
    buildDoc,
    docFromPlainText,
    para,
    simulateRequests,
} from "./testUtils.js"

const renameMigration = defineGdocMigration({
    name: "test-rename",
    mode: "component",
    blockType: "chart",
    discover: "SELECT 1",
    transform: renameProperty("caption", "subtitle"),
})

describe(planDocumentPatch, () => {
    it("plans a rename with summaries and the doc's revision id", async () => {
        const document = buildDoc([
            "[+body]",
            "{.chart}",
            "url: https://x.org/a",
            "caption: first",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, renameMigration)
        expect(plan.flags).toEqual([])
        expect(plan.requests.length).toBeGreaterThan(0)
        expect(plan.revisionId).toEqual("rev-1")
        expect(plan.matchedBlockCount).toEqual(1)
        expect(plan.editSummaries).toEqual([
            `{.chart}: rename "caption" → "subtitle"`,
        ])
    })

    it("returns no edits for docs without matching blocks", async () => {
        const document = buildDoc([
            "[+body]",
            "{.image}",
            "filename: a.png",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, renameMigration)
        expect(plan.matchedBlockCount).toEqual(0)
        expect(plan.requests).toEqual([])
        expect(plan.flags).toEqual([])
    })

    it("fails closed when a pending suggestion overlaps the target block", async () => {
        const document = buildDoc([
            "[+body]",
            "{.chart}",
            "url: https://x.org/a",
            para("caption: ", { text: "first", suggestedInsertion: true }),
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, renameMigration)
        expect(plan.requests).toEqual([])
        expect(plan.flags.map((flag) => flag.reason)).toContain(
            "pending-suggestions-in-target"
        )
    })

    it("ignores suggestions outside the target block", async () => {
        const document = buildDoc([
            para("title: My ", { text: "article", suggestedDeletion: true }),
            "[+body]",
            "{.chart}",
            "url: https://x.org/a",
            "caption: first",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, renameMigration)
        expect(plan.flags).toEqual([])
        expect(plan.requests.length).toBeGreaterThan(0)
    })

    it("flags non-idempotent transforms at plan time", async () => {
        const badMigration: GdocMigration = defineGdocMigration({
            name: "test-bad",
            mode: "component",
            blockType: "chart",
            discover: "SELECT 1",
            transform: (block) => ({
                ...block,
                value: {
                    ...block.value,
                    caption: `${String(block.value.caption)}!`,
                },
            }),
        })
        const document = buildDoc([
            "[+body]",
            "{.chart}",
            "url: https://x.org/a",
            "caption: first",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch("doc-1", document, badMigration)
        expect(plan.requests).toEqual([])
        expect(plan.flags.map((flag) => flag.reason)).toContain(
            "non-idempotent-transform"
        )
    })
})

describe("post-apply verification", () => {
    const migration = defineGdocMigration({
        name: "test-multi",
        mode: "component",
        blockType: "chart",
        discover: "SELECT 1",
        transform: composeTransforms(
            renameProperty("caption", "subtitle"),
            removeProperty("extra"),
            (block) =>
                "size" in block.value
                    ? block
                    : {
                          ...block,
                          value: { ...block.value, size: "narrow" },
                      }
        ),
    })
    const specs = [
        "[+body]",
        "{.chart}",
        "url: https://x.org/a",
        "caption: first",
        "{}",
        "{.chart}",
        "url: https://x.org/b",
        "extra: gone",
        "caption: second",
        "{}",
        "[]",
    ]

    it("accepts a correctly migrated doc and re-plans to a no-op", async () => {
        const document = buildDoc(specs)
        const plan = await planDocumentPatch("doc-1", document, migration)
        expect(plan.flags).toEqual([])

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
        expect(replan.editSummaries).toEqual([])
    })

    it("detects collateral damage to untouched lines", async () => {
        const document = buildDoc(specs)
        const plan = await planDocumentPatch("doc-1", document, migration)
        const tampered = docFromPlainText(
            simulateRequests(document, plan.requests).replace(
                "url: https://x.org/b",
                "url: https://x.org/CORRUPTED"
            )
        )
        const mismatches = compareToExpectedLines(
            buildExpectedLines(plan.lines, plan.blockEdits),
            gdocToSourceMappedLines(tampered)
        )
        expect(mismatches).toHaveLength(1)
        expect(mismatches[0]).toContain("CORRUPTED")
    })

    it("detects unexpectedly deleted lines via the length check", async () => {
        const document = buildDoc(specs)
        const plan = await planDocumentPatch("doc-1", document, migration)
        const tampered = docFromPlainText(
            simulateRequests(document, plan.requests).replace(
                "url: https://x.org/b\n",
                ""
            )
        )
        const mismatches = compareToExpectedLines(
            buildExpectedLines(plan.lines, plan.blockEdits),
            gdocToSourceMappedLines(tampered)
        )
        expect(mismatches.length).toBeGreaterThan(0)
    })
})

describe("prominent-link migration", async () => {
    const { default: prominentLinkMigration } =
        await import("../../db/gdocMigrations/migrations/2026-07-prominent-link-gdoc-urls.js")
    const helpers = {
        resolveOwidUrlToGdocUrl: async (url: string) =>
            url === "https://ourworldindata.org/life-expectancy"
                ? "https://docs.google.com/document/d/gdoc-abc/edit"
                : null,
    }

    it("rewrites resolvable urls and drops explicit metadata, leaving others alone", async () => {
        const document = buildDoc([
            "[+body]",
            "{.prominent-link}",
            "url: https://ourworldindata.org/life-expectancy",
            "title: Life expectancy",
            "filename: life-expectancy.png",
            "{}",
            "{.prominent-link}",
            "url: https://ourworldindata.org/grapher/life-expectancy",
            "title: A grapher page",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            prominentLinkMigration,
            helpers
        )
        expect(plan.flags).toEqual([])
        const result = simulateRequests(document, plan.requests)
        expect(result).toEqual(
            [
                "[+body]",
                "{.prominent-link}",
                "url: https://docs.google.com/document/d/gdoc-abc/edit",
                "{}",
                "{.prominent-link}",
                "url: https://ourworldindata.org/grapher/life-expectancy",
                "title: A grapher page",
                "{}",
                "[]",
                "",
            ].join("\n")
        )
    })

    it("is a no-op on already-migrated docs", async () => {
        const document = buildDoc([
            "[+body]",
            "{.prominent-link}",
            "url: https://docs.google.com/document/d/gdoc-abc/edit",
            "{}",
            "[]",
        ])
        const plan = await planDocumentPatch(
            "doc-1",
            document,
            prominentLinkMigration,
            helpers
        )
        expect(plan.flags).toEqual([])
        expect(plan.requests).toEqual([])
    })
})

describe(collectSuggestedRanges, () => {
    it("collects ranges of suggested insertions and deletions", () => {
        const document = buildDoc([
            "plain line",
            para("kept ", { text: "suggested", suggestedInsertion: true }),
        ])
        const ranges = collectSuggestedRanges(document)
        expect(ranges).toHaveLength(1)
        // "plain line\n" occupies 1..12, "kept " occupies 12..17, and the
        // suggested run carries the paragraph's trailing newline (17..27)
        expect(ranges[0]).toEqual({ startIndex: 17, endIndex: 27 })
    })

    it("intersects ranges correctly", () => {
        expect(
            rangesIntersect(
                { startIndex: 1, endIndex: 5 },
                { startIndex: 4, endIndex: 9 }
            )
        ).toBe(true)
        expect(
            rangesIntersect(
                { startIndex: 1, endIndex: 5 },
                { startIndex: 5, endIndex: 9 }
            )
        ).toBe(false)
    })
})

describe(Journal, () => {
    it("persists entries across instances and counts statuses", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdoc-migration-"))
        const journal = new Journal(dir, "test-migration")
        journal.update("doc-a", { status: "verified" })
        journal.update("doc-b", {
            status: "flagged",
            flags: [{ reason: "chip-in-target-line", detail: "…" }],
        })

        const reloaded = new Journal(dir, "test-migration")
        expect(reloaded.get("doc-a")?.status).toEqual("verified")
        expect(reloaded.get("doc-b")?.flags).toHaveLength(1)
        expect(reloaded.countByStatus()).toEqual({ verified: 1, flagged: 1 })
        fs.rmSync(dir, { recursive: true, force: true })
    })
})
