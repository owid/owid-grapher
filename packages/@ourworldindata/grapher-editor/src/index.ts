/**
 * Public API of @ourworldindata/grapher-editor.
 *
 * The editor's source still lives in the admin (adminSiteClient/) so that the
 * admin, which is its first consumer, always runs the same code; this package
 * is the publishable build of that slice. Moving the files here is a later,
 * mechanical step.
 */
import * as React from "react"
import { createRoot, type Root } from "react-dom/client"
import {
    GrapherEditor,
    type GrapherEditorProps,
} from "../../../../adminSiteClient/GrapherEditor.js"

export { GrapherEditor, type GrapherEditorProps }
export type {
    ConfigEditor,
    EditorExtraTab,
} from "../../../../adminSiteClient/ConfigEditor.js"
export type { EditorTab } from "../../../../adminSiteClient/AbstractChartEditor.js"
export {
    type IndicatorStore,
    dataApiIndicatorStore,
    tableIndicatorStore,
    csvIndicatorStore,
} from "../../../../adminSiteClient/indicatorStores.js"
export {
    type IndicatorCatalog,
    type DetailsProvider,
    type EditorEnvironment,
    defaultEditorEnvironment,
} from "../../../../adminSiteClient/editorProviders.js"
export type { IndicatorCatalogData } from "../../../../adminSiteClient/EditorDatabase.js"

// What a host needs to describe its own data and configs.
export { OwidTable } from "@ourworldindata/core-table"
export {
    ColumnTypeNames,
    DimensionProperty,
    type GrapherInterface,
    type OwidColumnDef,
} from "@ourworldindata/types"

/** A mounted editor, for hosts that don't use React themselves. */
export interface GrapherEditorHandle {
    /** Re-render with new props (a new config or store remounts the editor). */
    update(props: GrapherEditorProps): void
    unmount(): void
}

/**
 * Mount the editor into a container element. The container must have a size;
 * the editor fills it.
 *
 * React hosts should render `<GrapherEditor />` directly instead.
 */
export function mountGrapherEditor(
    container: HTMLElement,
    props: GrapherEditorProps
): GrapherEditorHandle {
    const root: Root = createRoot(container)
    let current = props
    const render = (): void => {
        root.render(
            React.createElement(GrapherEditor, {
                ...current,
                // a different config or store is a different editor
                key: `${current.store === props.store ? "s" : "S"}:${JSON.stringify(current.config)}`,
            })
        )
    }
    render()
    return {
        update(next) {
            current = next
            render()
        },
        unmount() {
            root.unmount()
        },
    }
}
