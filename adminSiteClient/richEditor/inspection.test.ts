// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { getRichEditorBaseExtensions } from "../../adminShared/richEditor/extensions.js"
import { enrichedBlocksToPmDoc } from "../../adminShared/richEditor/serialization/serialization.js"
import { pmNodeNames } from "../../adminShared/richEditor/serialization/pmJson.js"
import { convertSelectedChartBlockToNarrativeChart } from "./inspection.js"

const chartBlock: OwidEnrichedGdocBlock = {
    type: "chart",
    url: "https://ourworldindata.org/grapher/life-expectancy",
    size: "narrow",
    height: "700",
    caption: [{ spanType: "span-simple-text", text: "A caption" }],
    parseErrors: [],
} as OwidEnrichedGdocBlock

function makeEditorWithSelectedChart(): Editor {
    const editor = new Editor({
        extensions: getRichEditorBaseExtensions(),
        content: enrichedBlocksToPmDoc([chartBlock]),
    })
    editor.commands.setNodeSelection(0)
    return editor
}

describe(convertSelectedChartBlockToNarrativeChart, () => {
    it("converts the selected chart block, preserving embed options", () => {
        const editor = makeEditorWithSelectedChart()

        const pos = convertSelectedChartBlockToNarrativeChart(
            editor,
            "my-narrative-chart"
        )
        expect(pos).toBe(0)

        const node = editor.state.doc.nodeAt(0)
        expect(node?.type.name).toBe(pmNodeNames.narrativeChart)
        expect(node?.attrs.props).toEqual({
            name: "my-narrative-chart",
            size: "narrow",
            height: "700",
            caption: [{ spanType: "span-simple-text", text: "A caption" }],
        })

        // the block stays selected so the inspector remains open
        const selection = editor.state.selection
        expect(selection).toBeInstanceOf(NodeSelection)
        expect(selection.from).toBe(0)

        // the conversion is a normal transaction, so undo restores the chart
        editor.commands.undo()
        const restored = editor.state.doc.nodeAt(0)
        expect(restored?.type.name).toBe(pmNodeNames.chart)
        expect(restored?.attrs.props).toEqual({
            url: "https://ourworldindata.org/grapher/life-expectancy",
            size: "narrow",
            height: "700",
            caption: [{ spanType: "span-simple-text", text: "A caption" }],
        })

        editor.destroy()
    })

    it("does nothing when the selection is not a chart block", () => {
        const editor = new Editor({
            extensions: getRichEditorBaseExtensions(),
            content: enrichedBlocksToPmDoc([
                {
                    type: "text",
                    value: [{ spanType: "span-simple-text", text: "hi" }],
                    parseErrors: [],
                } as OwidEnrichedGdocBlock,
            ]),
        })
        expect(
            convertSelectedChartBlockToNarrativeChart(editor, "nope")
        ).toBeNull()
        editor.destroy()
    })
})
