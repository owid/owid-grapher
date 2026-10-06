import * as React from "react"
import { observer } from "mobx-react"
import { makeObservable } from "mobx"
import { GrapherInterface, GrapherQueryParams } from "@ourworldindata/types"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import {
    ConfigEditor,
    ConfigEditorManager,
    EditorExtraTab,
    EditorTabName,
} from "./ConfigEditor.js"
import { DetailsProvider } from "./editorProviders.js"
import { IndicatorStore } from "./indicatorStores.js"

export interface GrapherEditorProps {
    /**
     * The chart config to edit. Its dimensions name columns by `variableId`
     * or by `slug`, whichever the store resolves. Read once on mount.
     */
    config: GrapherInterface
    /** Where indicator data and metadata come from. Read once on mount. */
    store: IndicatorStore
    /**
     * Receives the edited config. May return the config as actually stored,
     * which then counts as the saved state.
     */
    onSave: ConfigEditorManager["onSave"]
    /** Fires on every change of the edited config. */
    onChange?: ConfigEditorManager["onChange"]
    /** Details on demand for validating text fields. Absent → none. */
    details?: DetailsProvider
    tabs?: EditorTabName[]
    /**
     * Query params to apply once, after the initial data load: opens the
     * editor in a particular view (tab, time range, selection) rather than
     * the authored one.
     */
    initialQueryParams?: GrapherQueryParams

    /**
     * The config this one is a patch against, if any: the editor shows its
     * values as inherited and hands back only the differences. Change it and
     * the editor re-applies it underneath the user's edits.
     */
    baseConfig?: GrapherInterface

    /**
     * Where the chart can be seen as published. Shown as a link above the
     * preview; absent → no link.
     */
    previewUrl?: string
    /** Tabs the host adds (e.g. revisions, references). */
    extraTabs?: EditorExtraTab[]
    /**
     * A note to show next to one part of the config. Called while that
     * section renders.
     */
    renderNote?: ConfigEditorManager["renderNote"]
    /**
     * URLs to offer for the chart's "Origin url". Called while the field
     * renders.
     */
    originUrlSuggestions?: ConfigEditorManager["originUrlSuggestions"]
    /** Replaces the default "Save config" button. */
    renderSaveButtons?: ConfigEditorManager["renderSaveButtons"]
    /** Indicators to fill a scatter plot's empty slots with. Absent → none. */
    scatterDefaults?: ConfigEditorManager["scatterDefaults"]
}

@observer
export class GrapherEditor
    extends React.Component<GrapherEditorProps>
    implements ConfigEditorManager, ChartEditorViewManager
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

    get details(): DetailsProvider | undefined {
        return this.props.details
    }

    get tabs(): EditorTabName[] | undefined {
        return this.props.tabs
    }

    get initialQueryParams(): GrapherQueryParams | undefined {
        return this.props.initialQueryParams
    }

    get onSave(): ConfigEditorManager["onSave"] {
        return this.props.onSave
    }

    get onChange(): ConfigEditorManager["onChange"] {
        return this.props.onChange
    }

    get baseConfig(): GrapherInterface | undefined {
        return this.props.baseConfig
    }

    get previewUrl(): string | undefined {
        return this.props.previewUrl
    }

    get extraTabs(): EditorExtraTab[] | undefined {
        return this.props.extraTabs
    }

    get renderSaveButtons(): ConfigEditorManager["renderSaveButtons"] {
        return this.props.renderSaveButtons
    }

    get renderNote(): ConfigEditorManager["renderNote"] {
        return this.props.renderNote
    }

    get originUrlSuggestions(): ConfigEditorManager["originUrlSuggestions"] {
        return this.props.originUrlSuggestions
    }

    get scatterDefaults(): ConfigEditorManager["scatterDefaults"] {
        return this.props.scatterDefaults
    }

    private _editor: ConfigEditor | undefined = undefined
    get editor(): ConfigEditor {
        this._editor ??= new ConfigEditor({ manager: this })
        return this._editor
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
