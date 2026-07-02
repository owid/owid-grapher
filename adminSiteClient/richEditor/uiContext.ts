import { createContext } from "react"

// Context bridging React NodeViews (rendered via ReactNodeViewRenderer inside
// the editor tree) and the page chrome (right rail inspector).

export interface InspectedBlock {
    /** ProseMirror node type name */
    nodeType: string
    /** Enriched block type, e.g. "chart" */
    blockType: string
    props: Record<string, unknown>
    updateProps: (props: Record<string, unknown>) => void
    deleteBlock: () => void
}

export interface RichEditorUI {
    inspectBlock: (inspected: InspectedBlock) => void
}

export const RichEditorUIContext = createContext<RichEditorUI>({
    inspectBlock: () => undefined,
})
