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
    config: GrapherInterface
    baseConfig?: GrapherInterface
    initialQueryParams?: GrapherQueryParams

    store: IndicatorStore
    details?: DetailsProvider
    scatterDefaults?: ConfigEditorManager["scatterDefaults"]

    onSave: ConfigEditorManager["onSave"]
    onChange?: ConfigEditorManager["onChange"]

    /** Default editor tabs to show */
    tabs?: EditorTabName[]
    /** Tabs provided by the the host */
    extraTabs?: EditorExtraTab[]
    previewUrl?: string
    renderSaveButtons?: ConfigEditorManager["renderSaveButtons"]

    renderNote?: ConfigEditorManager["renderNote"]
    originUrlSuggestions?: ConfigEditorManager["originUrlSuggestions"]
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

    get baseConfig(): GrapherInterface | undefined {
        return this.props.baseConfig
    }

    get initialQueryParams(): GrapherQueryParams | undefined {
        return this.props.initialQueryParams
    }

    get store(): IndicatorStore {
        return this.props.store
    }

    get details(): DetailsProvider | undefined {
        return this.props.details
    }

    get scatterDefaults(): ConfigEditorManager["scatterDefaults"] {
        return this.props.scatterDefaults
    }

    get onSave(): ConfigEditorManager["onSave"] {
        return this.props.onSave
    }

    get onChange(): ConfigEditorManager["onChange"] {
        return this.props.onChange
    }

    get tabs(): EditorTabName[] | undefined {
        return this.props.tabs
    }

    get extraTabs(): EditorExtraTab[] | undefined {
        return this.props.extraTabs
    }

    get renderSaveButtons(): ConfigEditorManager["renderSaveButtons"] {
        return this.props.renderSaveButtons
    }

    get previewUrl(): string | undefined {
        return this.props.previewUrl
    }

    get renderNote(): ConfigEditorManager["renderNote"] {
        return this.props.renderNote
    }

    get originUrlSuggestions(): ConfigEditorManager["originUrlSuggestions"] {
        return this.props.originUrlSuggestions
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
