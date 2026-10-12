/**
 * Public API of @ourworldindata/grapher-editor.
 *
 * The editor's sources live in the admin (adminSiteClient/), so that the
 * admin, its first consumer, always runs the same code; this package is the
 * publishable build of that slice.
 */
import * as React from "react"
import { createRoot } from "react-dom/client"
import {
    GrapherEditor,
    type GrapherEditorProps,
} from "../../../../adminSiteClient/GrapherEditor.js"

export { GrapherEditor, type GrapherEditorProps }
export type {
    ConfigEditor,
    EditorExtraTab,
    EditorNoteSlot,
    EditorTabName,
    OriginUrlSuggestion,
} from "../../../../adminSiteClient/ConfigEditor.js"
export {
    type IndicatorStore,
    dataApiIndicatorStore,
    tableIndicatorStore,
    csvIndicatorStore,
} from "../../../../adminSiteClient/indicatorStores.js"
export {
    type DetailsProvider,
    type EditorEnvironment,
    type IndicatorCatalog,
    defaultEditorEnvironment,
} from "../../../../adminSiteClient/editorProviders.js"
export type { IndicatorCatalogData } from "../../../../adminSiteClient/EditorDatabase.js"

// What a host needs to describe its own data and configs.
export { OwidTable } from "@ourworldindata/core-table"
export {
    ColumnTypeNames,
    DimensionProperty,
    type GrapherInterface,
    type OwidChartDimensionInterface,
    type OwidColumnDef,
} from "@ourworldindata/types"

/** A mounted editor, for hosts that don't use React themselves */
export interface GrapherEditorHandle {
    /** Re-render with new props; a new `config` or `store` starts a fresh editor */
    update(props: GrapherEditorProps): void
    unmount(): void
}

/**
 * Mount the editor into a container element. React hosts render
 * `<GrapherEditor />` instead.
 */
export function mountGrapherEditor(
    container: HTMLElement,
    props: GrapherEditorProps
): GrapherEditorHandle {
    const root = createRoot(container)
    let current = props
    // The editor reads `config` and `store` once, when it starts
    let generation = 0
    const render = (): void =>
        root.render(
            React.createElement(GrapherEditor, { ...current, key: generation })
        )
    render()
    return {
        update(next: GrapherEditorProps): void {
            if (next.config !== current.config || next.store !== current.store)
                generation++
            current = next
            render()
        },
        unmount(): void {
            root.unmount()
        },
    }
}
