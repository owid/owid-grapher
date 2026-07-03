import { describe, expect, it } from "vitest"
import { type docs_v1 } from "@googleapis/docs"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"
import { gdocToSourceMappedLines, joinSourceLines } from "./engine/sourceMap.js"
import { scanScopes } from "./engine/scopeScanner.js"
import { extractRawBlock } from "./engine/extractBlock.js"
import {
    buildPatches,
    diffBlockValues,
    PropertyEdit,
} from "./engine/propertyPatcher.js"
import {
    composeTransforms,
    removeProperty,
    renameProperty,
    rewriteProperty,
} from "../../db/gdocMigrations/helpers.js"
import { MigrationContext, RawBlockJson } from "./types.js"
import {
    buildDoc,
    docPlainText,
    para,
    ParagraphSpec,
    simulateRequests,
} from "./testUtils.js"

const context: MigrationContext = {
    gdocId: "test-doc",
    resolveOwidUrlToGdocUrl: async () => null,
}

const chartDocSpecs: Array<string | ParagraphSpec> = [
    "title: My article",
    "",
    "[+body]",
    "{.chart}",
    "url: https://ourworldindata.org/grapher/life-expectancy",
    para("caption: Some ", { text: "bold", bold: true }, " caption"),
    "{}",
    "[]",
]

async function applyTransformToDoc(
    document: docs_v1.Schema$Document,
    blockType: string,
    transform: (
        block: RawBlockJson,
        ctx: MigrationContext
    ) => RawBlockJson | null | Promise<RawBlockJson | null>
): Promise<ReturnType<typeof buildPatches>> {
    const lines = gdocToSourceMappedLines(document)
    const scan = scanScopes(lines)
    const blockEdits: Array<{
        match: (typeof scan.blocks)[number]
        edits: PropertyEdit[]
    }> = []
    for (const match of scan.blocks.filter((b) => b.type === blockType)) {
        const block = extractRawBlock(lines, match)
        if (!block) continue
        const transformed = await transform(structuredClone(block), context)
        const diff = diffBlockValues(block, transformed)
        if (diff.flags.length > 0) return { requests: [], flags: diff.flags }
        if (diff.edits.length > 0) blockEdits.push({ match, edits: diff.edits })
    }
    return buildPatches(lines, blockEdits)
}

// ---------------------------------------------------------------------------

describe("sourceMap", () => {
    it("reproduces gdocToArchie output exactly for a plain document", async () => {
        const document = buildDoc(chartDocSpecs)
        const lines = gdocToSourceMappedLines(document)
        const { text } = await gdocToArchie(document)
        expect(joinSourceLines(lines)).toEqual(text)
        expect(lines.map((l) => l.kind)).toEqual(
            Array.from({ length: 8 }, () => "paragraph")
        )
    })

    it("reproduces gdocToArchie output for lists and marks wrapper lines synthetic", async () => {
        const document = buildDoc([
            "before",
            { segments: ["item one"], bullet: true },
            { segments: ["item two"], bullet: true },
            "after",
        ])
        const lines = gdocToSourceMappedLines(document)
        const { text } = await gdocToArchie(document)
        expect(joinSourceLines(lines)).toEqual(text)
        expect(lines.map((l) => [l.text, l.kind])).toEqual([
            ["before", "paragraph"],
            ["", "synthetic"],
            ["[.list]", "synthetic"],
            ["* item one", "derived"],
            ["* item two", "derived"],
            ["[]", "synthetic"],
            ["after", "paragraph"],
        ])
    })

    it("reproduces gdocToArchie output for headings and marks their lines derived", async () => {
        const document = buildDoc([
            "before",
            { segments: ["My heading"], heading: 2 },
        ])
        const lines = gdocToSourceMappedLines(document)
        const { text } = await gdocToArchie(document)
        expect(joinSourceLines(lines)).toEqual(text)
        const headingLines = lines.slice(1)
        expect(headingLines.map((l) => l.text)).toEqual([
            "",
            "{.heading}",
            "text: My heading",
            "level: 2",
            "{}",
        ])
        expect(headingLines.every((l) => l.kind === "derived")).toBe(true)
    })

    it("marks lines containing smart chips and keeps styled text in runs", () => {
        const document = buildDoc([
            para("url: ", {
                chip: {
                    uri: "https://docs.google.com/document/d/abc/edit",
                    title: "Some doc",
                },
            }),
        ])
        const lines = gdocToSourceMappedLines(document)
        expect(lines).toHaveLength(1)
        expect(lines[0].containsChip).toBe(true)
        expect(lines[0].kind).toBe("paragraph")
        expect(lines[0].text).toContain(
            `<a href="https://docs.google.com/document/d/abc/edit">Some doc</a>`
        )
    })

    it("computes runs whose ranges cover the paragraph text", () => {
        const document = buildDoc(chartDocSpecs)
        const lines = gdocToSourceMappedLines(document)
        const captionLine = lines[5]
        expect(captionLine.text).toEqual("caption: Some <b>bold</b> caption")
        expect(captionLine.runs.map((run) => run.content).join("")).toEqual(
            "caption: Some bold caption\n"
        )
        const spans = captionLine.runs.map(
            (run) => run.endIndex - run.startIndex
        )
        expect(spans).toEqual(captionLine.runs.map((run) => run.content.length))
    })
})

describe("scopeScanner", () => {
    it("finds blocks with their direct properties and frontmatter", () => {
        const document = buildDoc(chartDocSpecs)
        const lines = gdocToSourceMappedLines(document)
        const scan = scanScopes(lines)

        expect(scan.balanced).toBe(true)
        expect(scan.frontmatter.map((p) => p.key)).toEqual(["title"])
        expect(scan.blocks).toHaveLength(1)
        const chart = scan.blocks[0]
        expect(chart.type).toEqual("chart")
        expect(chart.openLineIndex).toEqual(3)
        expect(chart.closeLineIndex).toEqual(6)
        expect(chart.properties.map((p) => p.key)).toEqual(["url", "caption"])
        expect(chart.properties[1].keyOffsetInRaw).toEqual(0)
        expect(chart.properties[1].colonEndOffsetInRaw).toEqual(8)
    })

    it("keeps nested block properties out of the outer block", () => {
        const document = buildDoc([
            "{.outer}",
            "position: right",
            "{.inner}",
            "url: https://example.com",
            "{}",
            "{}",
        ])
        const lines = gdocToSourceMappedLines(document)
        const scan = scanScopes(lines)
        expect(scan.balanced).toBe(true)
        expect(scan.blocks.map((b) => b.type)).toEqual(["inner", "outer"])
        const outer = scan.blocks.find((b) => b.type === "outer")!
        expect(outer.properties.map((p) => p.key)).toEqual(["position"])
    })

    it("tracks multiline (:end) values", () => {
        const document = buildDoc([
            "{.html}",
            "html: <div>",
            "</div>",
            ":end",
            "{}",
        ])
        const lines = gdocToSourceMappedLines(document)
        const scan = scanScopes(lines)
        const html = scan.blocks[0]
        expect(html.properties).toHaveLength(1)
        expect(html.properties[0].multiline).toBe(true)
        expect(html.properties[0].extentEndLineIndex).toEqual(3)
    })

    it("reports unbalanced scopes", () => {
        const document = buildDoc(["{.chart}", "url: something"])
        const lines = gdocToSourceMappedLines(document)
        expect(scanScopes(lines).balanced).toBe(false)
    })
})

describe(diffBlockValues, () => {
    const before: RawBlockJson = {
        type: "chart",
        value: { url: "https://x.org", caption: "hello" },
    }

    it("detects a property rename as a single rename-key edit", () => {
        const after: RawBlockJson = {
            type: "chart",
            value: { url: "https://x.org", subtitle: "hello" },
        }
        const { edits, flags } = diffBlockValues(before, after)
        expect(flags).toEqual([])
        expect(edits).toEqual([
            { kind: "rename-key", oldKey: "caption", newKey: "subtitle" },
        ])
    })

    it("detects value changes, removals and additions", () => {
        const after: RawBlockJson = {
            type: "chart",
            value: { url: "https://y.org", size: "narrow" },
        }
        const { edits, flags } = diffBlockValues(before, after)
        expect(flags).toEqual([])
        expect(edits).toContainEqual({
            kind: "delete-property",
            key: "caption",
        })
        expect(edits).toContainEqual({
            kind: "insert-property",
            key: "size",
            value: "narrow",
        })
        expect(edits).toContainEqual({
            kind: "set-value",
            key: "url",
            value: "https://y.org",
        })
    })

    it("flags non-scalar value changes", () => {
        const after: RawBlockJson = {
            type: "chart",
            value: { url: "https://x.org", caption: ["a", "b"] },
        }
        const { flags } = diffBlockValues(before, after)
        expect(flags.map((f) => f.reason)).toEqual(["non-string-value-change"])
    })

    it("turns a null transform result into a block deletion", () => {
        expect(diffBlockValues(before, null).edits).toEqual([
            { kind: "delete-block" },
        ])
    })

    it("detects block type renames", () => {
        const after: RawBlockJson = { type: "graph", value: before.value }
        expect(diffBlockValues(before, after).edits).toEqual([
            { kind: "rename-block-type", oldType: "chart", newType: "graph" },
        ])
    })
})

describe("propertyPatcher end to end", () => {
    it("renames a property key, leaving the styled value untouched", async () => {
        const document = buildDoc(chartDocSpecs)
        const patch = await applyTransformToDoc(
            document,
            "chart",
            renameProperty("caption", "subtitle")
        )
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toEqual(
            docPlainText(document).replace(
                "caption: Some bold caption",
                "subtitle: Some bold caption"
            )
        )
    })

    it("replaces a property value with styled text", async () => {
        const document = buildDoc(chartDocSpecs)
        const newValue = `<a href="https://docs.google.com/document/d/abc/edit">Life expectancy</a>`
        const patch = await applyTransformToDoc(
            document,
            "chart",
            rewriteProperty("url", () => newValue)
        )
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toContain("url: Life expectancy\n")
        const linkStyles = patch.requests.filter(
            (r) =>
                r.updateTextStyle?.textStyle?.link?.url ===
                "https://docs.google.com/document/d/abc/edit"
        )
        expect(linkStyles).toHaveLength(1)
    })

    it("deletes a property line entirely", async () => {
        const document = buildDoc(chartDocSpecs)
        const patch = await applyTransformToDoc(
            document,
            "chart",
            removeProperty("caption")
        )
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toEqual(
            docPlainText(document).replace("caption: Some bold caption\n", "")
        )
    })

    it("inserts a new property before the closing tag", async () => {
        const document = buildDoc(chartDocSpecs)
        const patch = await applyTransformToDoc(document, "chart", (block) => ({
            ...block,
            value: { ...block.value, size: "narrow" },
        }))
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toContain("caption: Some bold caption\nsize: narrow\n{}")
    })

    it("deletes a whole block when the transform returns null", async () => {
        const document = buildDoc(chartDocSpecs)
        const patch = await applyTransformToDoc(document, "chart", () => null)
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toEqual("title: My article\n\n[+body]\n[]\n")
    })

    it("applies edits to multiple blocks bottom-up without index drift", async () => {
        const document = buildDoc([
            "[+body]",
            "{.chart}",
            "url: https://x.org/a",
            "caption: first",
            "{}",
            "{.chart}",
            "url: https://x.org/b",
            "caption: second",
            "{}",
            "[]",
        ])
        const patch = await applyTransformToDoc(
            document,
            "chart",
            composeTransforms(
                renameProperty("caption", "subtitle"),
                rewriteProperty("url", (url) =>
                    String(url).replace("x.org", "y.org")
                )
            )
        )
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toEqual(
            [
                "[+body]",
                "{.chart}",
                "url: https://y.org/a",
                "subtitle: first",
                "{}",
                "{.chart}",
                "url: https://y.org/b",
                "subtitle: second",
                "{}",
                "[]",
                "",
            ].join("\n")
        )
    })

    it("fails closed when a value line contains a smart chip", async () => {
        const document = buildDoc([
            "{.prominent-link}",
            para("url: ", {
                chip: {
                    uri: "https://docs.google.com/document/d/abc/edit",
                    title: "Some doc",
                },
            }),
            "{}",
        ])
        const patch = await applyTransformToDoc(
            document,
            "prominent-link",
            rewriteProperty("url", () => "https://example.com")
        )
        expect(patch.requests).toEqual([])
        expect(patch.flags.map((f) => f.reason)).toEqual([
            "chip-in-target-line",
        ])
    })

    it("fails closed on multiline (:end) values", async () => {
        const document = buildDoc([
            "{.html}",
            "html: <div>",
            "</div>",
            ":end",
            "{}",
        ])
        const patch = await applyTransformToDoc(
            document,
            "html",
            rewriteProperty("html", () => "<span>replaced</span>")
        )
        expect(patch.requests).toEqual([])
        expect(patch.flags.map((f) => f.reason)).toEqual([
            "multiline-value-not-supported",
        ])
    })

    it("still allows deleting a multiline property", async () => {
        const document = buildDoc([
            "{.expander}",
            "title: Some title",
            "html: <div>",
            "</div>",
            ":end",
            "{}",
        ])
        const patch = await applyTransformToDoc(
            document,
            "expander",
            removeProperty("html")
        )
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toEqual("{.expander}\ntitle: Some title\n{}\n")
    })

    it("renames a block type in place", async () => {
        const document = buildDoc(chartDocSpecs)
        const patch = await applyTransformToDoc(document, "chart", (block) => ({
            ...block,
            type: "graph",
        }))
        expect(patch.flags).toEqual([])
        const result = simulateRequests(document, patch.requests)
        expect(result).toContain("{.graph}\nurl:")
    })

    it("produces no requests when the transform is a no-op", async () => {
        const document = buildDoc(chartDocSpecs)
        const patch = await applyTransformToDoc(
            document,
            "chart",
            (block) => block
        )
        expect(patch.flags).toEqual([])
        expect(patch.requests).toEqual([])
    })
})
