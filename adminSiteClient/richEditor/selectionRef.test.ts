// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import * as Y from "yjs"
import { Collaboration } from "@tiptap/extension-collaboration"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../../adminShared/richEditor/extensions.js"
import { enrichedBlocksToPmDoc } from "../../adminShared/richEditor/serialization/serialization.js"
import { resolveSelectionRef, selectionRefFromEditor } from "./selectionRef.js"

const textBlock = (text: string): OwidEnrichedGdocBlock =>
    ({
        type: "text",
        value: [{ spanType: "span-simple-text", text }],
        parseErrors: [],
    }) as OwidEnrichedGdocBlock

const chartBlock: OwidEnrichedGdocBlock = {
    type: "chart",
    url: "https://ourworldindata.org/grapher/life-expectancy",
    size: "wide",
    parseErrors: [],
    id: "chart-ref-1",
} as OwidEnrichedGdocBlock

function makeEditor(blocks: OwidEnrichedGdocBlock[]): Editor {
    return new Editor({
        extensions: getRichEditorBaseExtensions(),
        content: enrichedBlocksToPmDoc(blocks),
    })
}

describe("selection refs", () => {
    it("captures and resolves a block selection by stable id", () => {
        const editor = makeEditor([textBlock("Intro"), chartBlock])
        // the chart block sits after the paragraph
        const chartPos = editor.state.doc.child(0).nodeSize
        editor.commands.setNodeSelection(chartPos)

        const ref = selectionRefFromEditor(editor)
        expect(ref).toEqual({
            kind: "block",
            blockId: "chart-ref-1",
            blockType: "chart",
        })

        // an edit above the block moves it; the ref still resolves
        editor.commands.insertContentAt(0, { type: "paragraph" })
        const resolved = resolveSelectionRef(editor, ref)
        expect(resolved?.kind).toBe("block")
        if (resolved?.kind === "block") {
            expect(resolved.node.attrs.blockId).toBe("chart-ref-1")
            expect(resolved.pos).toBeGreaterThan(chartPos)
        }

        // deleting the block orphans the ref
        if (resolved?.kind === "block") {
            editor.commands.deleteRange({
                from: resolved.pos,
                to: resolved.pos + resolved.node.nodeSize,
            })
        }
        expect(resolveSelectionRef(editor, ref)).toBeNull()
    })

    it("captures a text selection with excerpt and containing block", () => {
        const editor = makeEditor([textBlock("Hello selection world")])
        editor.commands.setTextSelection({ from: 7, to: 16 })

        const ref = selectionRefFromEditor(editor)
        expect(ref.kind).toBe("text")
        if (ref.kind !== "text") return
        expect(ref.excerpt).toBe("selection")
        // no collaboration: absolute fallback positions
        expect(ref.absoluteAnchor).toBe(7)
        expect(ref.absoluteHead).toBe(16)

        const resolved = resolveSelectionRef(editor, ref)
        expect(resolved).toEqual({ kind: "text", anchor: 7, head: 16 })
    })

    it("uses relative positions under collaboration, surviving edits", () => {
        const ydoc = new Y.Doc()
        const editor = new Editor({
            extensions: [
                ...getRichEditorBaseExtensions({ collaboration: true }),
                Collaboration.configure({ document: ydoc }),
            ],
        })
        editor.commands.setContent(
            enrichedBlocksToPmDoc([textBlock("Hello selection world")])
        )
        editor.commands.setTextSelection({ from: 7, to: 16 })

        const ref = selectionRefFromEditor(editor)
        expect(ref.kind).toBe("text")
        if (ref.kind !== "text") return
        expect(ref.anchor).toBeDefined()
        expect(ref.head).toBeDefined()
        expect(ref.absoluteAnchor).toBeUndefined()

        // an insertion before the selection shifts it; the relative
        // positions follow the text
        editor.commands.insertContentAt(1, "abcde ")
        const resolved = resolveSelectionRef(editor, ref)
        expect(resolved?.kind).toBe("text")
        if (resolved?.kind !== "text") return
        expect(
            editor.state.doc.textBetween(resolved.anchor, resolved.head, " ")
        ).toBe("selection")
    })

    it("returns a document ref when nothing is selected", () => {
        const editor = makeEditor([textBlock("Nothing selected")])
        const ref = selectionRefFromEditor(editor)
        expect(ref).toEqual({ kind: "document" })
        expect(resolveSelectionRef(editor, ref)).toEqual({ kind: "document" })
    })
})
