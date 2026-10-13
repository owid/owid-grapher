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
    unmount(): void
}

/**
 * Mount the editor into a container element. React hosts render
 * `<GrapherEditor />` instead. To open another config, unmount and mount
 * again.
 */
export function mountGrapherEditor(
    container: HTMLElement,
    props: GrapherEditorProps
): GrapherEditorHandle {
    const root = createRoot(container)
    root.render(React.createElement(GrapherEditor, props))
    return { unmount: (): void => root.unmount() }
}
