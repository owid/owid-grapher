/**
 * The chart editor as a component a host mounts: a config in, an
 * `IndicatorStore` for data and metadata, and callbacks that hand the edited
 * config back. This is the shape the future editor package exports; the
 * playground is its first consumer, the admin's own pages keep using the
 * chart-record editors around the same `ChartEditorView`.
 *
 * Compared with Plotly's `react-chart-editor`, which takes `data` + `layout`
 * and a `dataSources` object of column arrays and calls `onUpdate`: `config`
 * is our data + layout, `store` is our dataSources (with column metadata),
 * `store.catalog` is our dataSourceOptions, `onChange`/`onSave` are our
 * onUpdate split in two.
 */
import * as React from "react"
import { observer } from "mobx-react"
import { computed, makeObservable } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import { ConfigEditor, ConfigEditorManager } from "./ConfigEditor.js"
import { EditorTab } from "./AbstractChartEditor.js"
import { DetailsProvider, IndicatorCatalog } from "./editorProviders.js"
import { IndicatorStore } from "./indicatorStores.js"

export interface GrapherEditorProps {
    /** The chart config to edit, in the store's own form. */
    config: GrapherInterface
    /** Where indicator data and metadata come from. */
    store: IndicatorStore
    /** Receives the edited config, in the store's own form. */
    onSave: (config: GrapherInterface) => void | Promise<void>
    /** Fires on every change of the edited config. */
    onChange?: (config: GrapherInterface) => void
    /** What "Add indicator" can offer. Defaults to `store.catalog`; pass
     *  `null` for no picker. */
    indicators?: IndicatorCatalog | null
    /** Details on demand for validating text fields. Absent → none. */
    details?: DetailsProvider
    /** Restrict the tabs shown. */
    tabs?: EditorTab[]
}

@observer
export class GrapherEditor
    extends React.Component<GrapherEditorProps>
    implements ConfigEditorManager, ChartEditorViewManager<ConfigEditor>
{
    constructor(props: GrapherEditorProps) {
        super(props)
        makeObservable(this)
    }

    isInheritanceEnabled = false

    get patchConfig(): GrapherInterface {
        return this.props.config
    }

    get store(): IndicatorStore {
        return this.props.store
    }

    get indicators(): IndicatorCatalog | undefined {
        const { indicators, store } = this.props
        if (indicators === null) return undefined
        return indicators ?? store.catalog
    }

    get details(): DetailsProvider | undefined {
        return this.props.details
    }

    get tabs(): EditorTab[] | undefined {
        return this.props.tabs
    }

    get onSave(): (config: GrapherInterface) => void | Promise<void> {
        return this.props.onSave
    }

    get onChange(): ((config: GrapherInterface) => void) | undefined {
        return this.props.onChange
    }

    @computed get editor(): ConfigEditor {
        return new ConfigEditor({ manager: this })
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
