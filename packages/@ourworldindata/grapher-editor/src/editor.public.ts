import * as React from "react"
import { createRoot } from "react-dom/client"
import type { GrapherInterface } from "@ourworldindata/types"
import {
    GrapherEditor as AdminGrapherEditor,
    type GrapherEditorProps as AdminGrapherEditorProps,
} from "../../../../adminSiteClient/GrapherEditor.js"

// The admin's own props (revisions, references, save buttons, its catalog
// and details) stay out of the package's API
export type GrapherEditorProps = Pick<
    AdminGrapherEditorProps,
    "config" | "store" | "tabs" | "indicatorUrl" | "syncTabWithUrl"
> & {
    onSave: (
        config: GrapherInterface
    ) => void | GrapherInterface | Promise<void | GrapherInterface>
    onChange?: (config: GrapherInterface) => void
    onModifiedChange?: (isModified: boolean) => void
}

export function GrapherEditor(props: GrapherEditorProps): React.ReactElement {
    return React.createElement(AdminGrapherEditor, props)
}

export type { EditorTabName } from "../../../../adminSiteClient/ConfigEditor.js"
export {
    type IndicatorStore,
    dataApiIndicatorStore,
    tableIndicatorStore,
    csvIndicatorStore,
    listIndicatorCatalog,
    type IndicatorListDataset,
} from "../../../../adminSiteClient/indicatorStores.js"
export type {
    IndicatorCatalog,
    IndicatorSearchPage,
    CatalogDataset,
    CatalogIndicator,
    PickedColumn,
} from "../../../../adminSiteClient/editorProviders.js"

export { OwidTable } from "@ourworldindata/core-table"
export {
    ColumnTypeNames,
    DimensionProperty,
    type GrapherInterface,
    type OwidChartDimensionInterface,
    type OwidColumnDef,
} from "@ourworldindata/types"

export interface GrapherEditorHandle {
    unmount(): void
}

/** For hosts without React. To open another config, unmount and mount again. */
export function mountGrapherEditor(
    container: HTMLElement,
    props: GrapherEditorProps
): GrapherEditorHandle {
    const root = createRoot(container)
    root.render(React.createElement(GrapherEditor, props))
    return { unmount: (): void => root.unmount() }
}
