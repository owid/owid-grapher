/**
 * The chart editor as a component a host mounts: a config in, an
 * `IndicatorStore` for data and metadata, and callbacks that hand the edited
 * config back. This is the shape the future editor package exports. The
 * admin's chart editor page is its main consumer and adds its chart-record
 * features (revisions, references, tags, publishing) through the extension
 * props rather than a different editor.
 *
 * Compared with Plotly's `react-chart-editor`, which takes `data` + `layout`
 * and a `dataSources` object of column arrays and calls `onUpdate`: `config`
 * is our data + layout, `store` is our dataSources (with column metadata),
 * `store.catalog` is our dataSourceOptions, `onChange`/`onSave` are our
 * onUpdate split in two.
 */
import * as React from "react"
import { observer } from "mobx-react"
import { makeObservable } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import {
    ConfigEditor,
    ConfigEditorManager,
    EditorExtensions,
    EditorExtraTab,
} from "./ConfigEditor.js"
import { EditorTab } from "./AbstractChartEditor.js"
import { DetailsProvider, IndicatorCatalog } from "./editorProviders.js"
import { IndicatorStore } from "./indicatorStores.js"

export interface GrapherEditorProps {
    /** The chart config to edit, in the store's own form. */
    config: GrapherInterface
    /** Where indicator data and metadata come from. */
    store: IndicatorStore
    /**
     * Receives the edited config, in the store's own form. May return the
     * config as actually stored, which then counts as the saved state.
     */
    onSave: ConfigEditorManager["onSave"]
    /** Fires on every change of the edited config. */
    onChange?: (config: GrapherInterface) => void
    /** What "Add indicator" can offer. Defaults to `store.catalog`; pass
     *  `null` for no picker. */
    indicators?: IndicatorCatalog | null
    /** Details on demand for validating text fields. Absent → none. */
    details?: DetailsProvider
    /** Restrict the tabs shown. */
    tabs?: EditorTab[]

    // --- Inheritance: layers the config sits on top of ---------------------
    /** The indicator's own config (variables.grapherConfig), if any. */
    parentConfig?: GrapherInterface
    /** Id of the indicator `parentConfig` was loaded from. */
    parentVariableId?: number
    /** An ETL-authored layer between `parentConfig` and the config. */
    etlConfig?: GrapherInterface
    /** Whether `parentConfig` is applied. Defaults to false. */
    isInheritanceEnabled?: boolean
    /** Lookups the Basic tab's "add population / GDP" shortcuts use. */
    variableIdsByCatalogPath?: Record<string, number | null>

    // --- Host extensions ---------------------------------------------------
    /** Tabs the host adds (e.g. revisions, references). */
    extraTabs?: EditorExtraTab[]
    /** Replaces the default "Save config" button. */
    renderSaveButtons?: ConfigEditorManager["renderSaveButtons"]
    /** Small hooks into the generic tabs. */
    extensions?: EditorExtensions
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

    get onSave(): ConfigEditorManager["onSave"] {
        return this.props.onSave
    }

    get onChange(): ((config: GrapherInterface) => void) | undefined {
        return this.props.onChange
    }

    get parentConfig(): GrapherInterface | undefined {
        return this.props.parentConfig
    }

    get parentVariableId(): number | undefined {
        return this.props.parentVariableId
    }

    get etlConfig(): GrapherInterface | undefined {
        return this.props.etlConfig
    }

    get isInheritanceEnabled(): boolean {
        return this.props.isInheritanceEnabled ?? false
    }

    get variableIdsByCatalogPath(): Record<string, number | null> | undefined {
        return this.props.variableIdsByCatalogPath
    }

    get extraTabs(): EditorExtraTab[] | undefined {
        return this.props.extraTabs
    }

    get renderSaveButtons(): ConfigEditorManager["renderSaveButtons"] {
        return this.props.renderSaveButtons
    }

    get extensions(): EditorExtensions | undefined {
        return this.props.extensions
    }

    // One editor for the lifetime of the component. Not a `computed`: the
    // constructor reads `store` and `environment` off the props, and any new
    // props object (a host re-rendering after a save) would otherwise
    // recompute it into a fresh editor and reset the chart being edited.
    // Hosts that change the store or the config remount via `key`.
    private _editor: ConfigEditor | undefined = undefined
    get editor(): ConfigEditor {
        this._editor ??= new ConfigEditor({ manager: this })
        return this._editor
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
