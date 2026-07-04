// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import * as Y from "yjs"
import { Collaboration } from "@tiptap/extension-collaboration"
import type { AgentTool } from "@earendil-works/pi-agent-core"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../../../adminShared/richEditor/extensions.js"
import { enrichedBlocksToPmDoc } from "../../../adminShared/richEditor/serialization/serialization.js"
import { BlockIdAssignment, ensureBlockIds } from "../blockIdentity.js"
import { Admin } from "../../Admin.js"
import {
    createDocTools,
    describeSelection,
    type DocToolHost,
} from "./docTools.js"

const textBlock = (text: string, id?: string): OwidEnrichedGdocBlock =>
    ({
        type: "text",
        value: [{ spanType: "span-simple-text", text }],
        parseErrors: [],
        ...(id ? { id } : {}),
    }) as OwidEnrichedGdocBlock

const headingBlock = (
    text: string,
    level: number,
    id?: string
): OwidEnrichedGdocBlock =>
    ({
        type: "heading",
        text: [{ spanType: "span-simple-text", text }],
        level,
        parseErrors: [],
        ...(id ? { id } : {}),
    }) as OwidEnrichedGdocBlock

const chartBlock = (url: string, id?: string): OwidEnrichedGdocBlock =>
    ({
        type: "chart",
        url,
        size: "wide",
        parseErrors: [],
        ...(id ? { id } : {}),
    }) as OwidEnrichedGdocBlock

function makeEditor(
    blocks: OwidEnrichedGdocBlock[],
    { collaboration = false } = {}
): Editor {
    const extensions = [
        ...getRichEditorBaseExtensions({ collaboration }),
        BlockIdAssignment,
        ...(collaboration
            ? [Collaboration.configure({ document: new Y.Doc() })]
            : []),
    ]
    const editor = new Editor({ extensions })
    editor.commands.setContent(enrichedBlocksToPmDoc(blocks))
    ensureBlockIds(editor)
    // setContent leaves a whole-document selection; a collapsed cursor is
    // what a freshly opened editor has
    editor.commands.setTextSelection(1)
    return editor
}

interface ToolBag {
    editor: Editor
    tools: Map<string, AgentTool>
}

function makeTools(
    blocks: OwidEnrichedGdocBlock[],
    { collaboration = false } = {}
): ToolBag {
    const editor = makeEditor(blocks, { collaboration })
    const host: DocToolHost = {
        getEditor: () => editor,
        getDocInfo: () => ({
            id: "gdoc-1",
            type: "article",
            title: "Test document",
        }),
        admin: {} as Admin,
    }
    const tools = new Map(createDocTools(host).map((tool) => [tool.name, tool]))
    return { editor, tools }
}

async function run(
    bag: ToolBag,
    name: string,
    params: Record<string, unknown> = {}
): Promise<string> {
    const tool = bag.tools.get(name)
    if (!tool) throw new Error(`no tool ${name}`)
    const result = await tool.execute("call-1", params, undefined as never)
    return result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
}

const BODY = [
    headingBlock("Introduction", 1, "h-intro"),
    textBlock("Global life expectancy has risen dramatically.", "t-1"),
    chartBlock("https://ourworldindata.org/grapher/life-expectancy", "c-1"),
    headingBlock("Details", 1, "h-details"),
    textBlock("More words about mortality.", "t-2"),
]

describe("outline", () => {
    it("lists blocks with ids, types, and section sizes", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "outline")
        expect(out).toContain('"Test document" (article, id gdoc-1)')
        expect(out).toContain("h-intro [heading h1]")
        expect(out).toContain("t-1 [text]")
        expect(out).toContain("c-1 [chart]")
        // the intro section holds the text and the chart
        expect(out).toMatch(/h-intro.*section: 2 blocks/)
        expect(out).toMatch(/h-details.*section: 1 blocks/)
    })
})

describe("read", () => {
    it("reads specific blocks as XHTML with ids", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "read", { blocks: ["t-1", "c-1"] })
        expect(out).toContain('<text id="t-1">')
        expect(out).toContain("life expectancy has risen")
        expect(out).toContain('id="c-1"')
        expect(out).toContain("grapher/life-expectancy")
    })

    it("reads a heading's section", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "read", { section: "h-intro" })
        expect(out).toContain('id="h-intro"')
        expect(out).toContain('id="t-1"')
        expect(out).toContain('id="c-1"')
        expect(out).not.toContain('id="h-details"')
    })

    it("rejects unknown ids with a helpful error", async () => {
        const bag = makeTools(BODY)
        await expect(run(bag, "read", { blocks: ["nope"] })).rejects.toThrow(
            /No block with id "nope"/
        )
    })
})

describe("find", () => {
    it("finds text and attribute matches with block ids", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "find", { query: "life" })
        expect(out).toContain("t-1 (text)")
        // the chart url matches too, via the serialized attributes
        expect(out).toContain("c-1 (chart)")
    })

    it("reports no matches", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "find", { query: "zebra unicorns" })
        expect(out).toBe("No matches.")
    })
})

describe("edit", () => {
    it("replaces a block in place, preserving its id", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "edit", {
            action: "replace",
            from: "t-1",
            xhtml: '<text id="t-1">Rewritten sentence.</text>',
        })
        expect(out).toContain("t-1 [text]")
        const read = await run(bag, "read", { blocks: ["t-1"] })
        expect(read).toContain("Rewritten sentence.")
    })

    it("inserts new blocks with fresh ids and reports them", async () => {
        const bag = makeTools(BODY)
        const before = bag.editor.state.doc.childCount
        const out = await run(bag, "edit", {
            action: "insert_after",
            after: "t-1",
            xhtml: "<text>One.</text><text>Two.</text>",
        })
        expect(bag.editor.state.doc.childCount).toBe(before + 2)
        expect(out).toMatch(/Inserted 2 blocks: .+ \[text\], .+ \[text\]/)
        // fresh ids, not copies of an existing one
        expect(out).not.toContain("t-1 [text]")
    })

    it("supports insert at the document start", async () => {
        const bag = makeTools(BODY)
        await run(bag, "edit", {
            action: "insert_after",
            after: "start",
            xhtml: "<text>Now first.</text>",
        })
        expect(bag.editor.state.doc.child(0).textContent).toBe("Now first.")
    })

    it("deletes a range", async () => {
        const bag = makeTools(BODY)
        const before = bag.editor.state.doc.childCount
        await run(bag, "edit", {
            action: "delete",
            from: "t-1",
            to: "c-1",
        })
        expect(bag.editor.state.doc.childCount).toBe(before - 2)
        await expect(run(bag, "read", { blocks: ["t-1"] })).rejects.toThrow()
    })

    it("rejects invalid XHTML with the parse reason", async () => {
        const bag = makeTools(BODY)
        await expect(
            run(bag, "edit", {
                action: "replace",
                from: "t-1",
                xhtml: "<mystery-block>?</mystery-block>",
            })
        ).rejects.toThrow(/Unknown block type/)
    })

    it("rejects blocks that fail enriched validation", async () => {
        const bag = makeTools(BODY)
        await expect(
            run(bag, "edit", {
                action: "insert_after",
                after: "t-1",
                xhtml: "<image/>",
            })
        ).rejects.toThrow(/did not validate/)
    })

    it("rejects stale ids with guidance", async () => {
        const bag = makeTools(BODY)
        await run(bag, "edit", { action: "delete", from: "t-2" })
        await expect(
            run(bag, "edit", {
                action: "replace",
                from: "t-2",
                xhtml: "<text>too late</text>",
            })
        ).rejects.toThrow(/No block with id "t-2"/)
    })

    it("edits are single undo steps under collaboration", async () => {
        const bag = makeTools(BODY, { collaboration: true })
        // simulate the user typing first (separate undo group)
        bag.editor.commands.insertContentAt(
            bag.editor.state.doc.child(0).nodeSize,
            { type: "paragraph", content: [{ type: "text", text: "user" }] }
        )
        const childCountAfterTyping = bag.editor.state.doc.childCount
        await run(bag, "edit", {
            action: "insert_after",
            after: "t-1",
            xhtml: "<text>Agent one.</text>",
        })
        await run(bag, "edit", {
            action: "insert_after",
            after: "t-1",
            xhtml: "<text>Agent two.</text>",
        })
        expect(bag.editor.state.doc.childCount).toBe(childCountAfterTyping + 2)
        // one undo removes exactly one agent edit
        bag.editor.commands.undo()
        expect(bag.editor.state.doc.childCount).toBe(childCountAfterTyping + 1)
        bag.editor.commands.undo()
        expect(bag.editor.state.doc.childCount).toBe(childCountAfterTyping)
        // the user's own typing is still there
        expect(bag.editor.state.doc.textContent).toContain("user")
    })
})

describe("selection context", () => {
    it("describes text selections with the containing block", () => {
        const bag = makeTools(BODY)
        // select "life" inside t-1
        const paragraphPos = bag.editor.state.doc.child(0).nodeSize
        bag.editor.commands.setTextSelection({
            from: paragraphPos + 8,
            to: paragraphPos + 12,
        })
        const description = describeSelection(bag.editor)
        expect(description).toContain("selected text")
        expect(description).toContain("t-1")
    })

    it("describes block selections with their XHTML", () => {
        const bag = makeTools(BODY)
        const chartPos =
            bag.editor.state.doc.child(0).nodeSize +
            bag.editor.state.doc.child(1).nodeSize
        bag.editor.commands.setNodeSelection(chartPos)
        const description = describeSelection(bag.editor)
        expect(description).toContain("whole chart block")
        expect(description).toContain("c-1")
        expect(description).toContain("grapher/life-expectancy")
    })

    it("says so when nothing is selected", () => {
        const bag = makeTools(BODY)
        expect(describeSelection(bag.editor)).toContain("Nothing is selected")
    })
})

describe("describe_component", () => {
    it("returns the catalog without arguments", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "describe_component")
        expect(out).toContain("text —")
        expect(out).toContain("chart —")
    })

    it("returns details plus in-document instances", async () => {
        const bag = makeTools(BODY)
        const out = await run(bag, "describe_component", {
            components: ["chart"],
        })
        expect(out).toContain("Minimal form:")
        expect(out).toContain("<chart")
        expect(out).toContain("In this document: c-1")
    })
})

describe("search_charts", () => {
    it("filters and formats the chart list", async () => {
        const editor = makeEditor(BODY)
        const admin = {
            getJSON: async () => ({
                charts: [
                    {
                        id: 42,
                        title: "Life expectancy at birth",
                        slug: "life-expectancy",
                        type: "LineChart",
                        variantName: null,
                        isPublished: 1,
                        tags: [{ name: "Health" }],
                    },
                    {
                        id: 43,
                        title: "CO2 emissions",
                        slug: "co2-emissions",
                        type: "LineChart",
                        variantName: null,
                        isPublished: 1,
                        tags: [],
                    },
                ],
            }),
        } as unknown as Admin
        const host: DocToolHost = {
            getEditor: () => editor,
            getDocInfo: () => ({
                id: "gdoc-1",
                type: "article",
                title: "Test",
            }),
            admin,
        }
        const tools = new Map(
            createDocTools(host).map((tool) => [tool.name, tool])
        )
        const bag = { editor, tools }
        const out = await run(bag, "search_charts", {
            query: "life expectancy",
        })
        expect(out).toContain(
            "https://ourworldindata.org/grapher/life-expectancy"
        )
        expect(out).not.toContain("co2-emissions")
    })
})

describe("applyDocFileDiff (write_doc_from_file)", () => {
    it("applies replace/insert/delete by id, leaving unchanged blocks alone", async () => {
        const bag = makeTools(BODY, { collaboration: true })
        const { fullDocXhtml, applyDocFileDiff, parseXhtmlBlocks } =
            await import("./docTools.js")
        const file = fullDocXhtml(bag.editor)
        // rewrite t-1, drop t-2, add a new block after the chart
        const edited = file
            .replace(
                /<text id="t-1">[\s\S]*?<\/text>/,
                '<text id="t-1">Rewritten via file.</text>'
            )
            .replace(/<text id="t-2">[\s\S]*?<\/text>/, "")
            .replace(
                /(<chart[^>]*id="c-1"[^>]*\/>)/,
                "$1\n\n<text>Brand new block.</text>"
            )
        const result = applyDocFileDiff(bag.editor, parseXhtmlBlocks(edited))
        expect(result).toMatchObject({
            replaced: 1,
            inserted: 1,
            deleted: 1,
        })
        const text = bag.editor.state.doc.textContent
        expect(text).toContain("Rewritten via file.")
        expect(text).toContain("Brand new block.")
        expect(text).not.toContain("More words about mortality.")
        // whole application is one undo step
        bag.editor.commands.undo()
        const reverted = bag.editor.state.doc.textContent
        expect(reverted).not.toContain("Rewritten via file.")
        expect(reverted).toContain("More words about mortality.")
    })

    it("rejects reordering of existing blocks", async () => {
        const bag = makeTools(BODY)
        const { applyDocFileDiff, parseXhtmlBlocks } =
            await import("./docTools.js")
        const reordered =
            '<text id="t-2">More words about mortality.</text>' +
            '<text id="t-1">Global life expectancy has risen dramatically.</text>'
        expect(() =>
            applyDocFileDiff(bag.editor, parseXhtmlBlocks(reordered))
        ).toThrow(/reorders existing blocks/)
    })
})
